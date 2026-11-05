import { LinearGradient } from "expo-linear-gradient";
import * as Location from "expo-location";
import { StatusBar } from "expo-status-bar";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { ApiError } from "../api/client";
import { vehicleApi } from "../api/endpoints";
import LogoutConfirmModal from "../components/LogoutConfirmModal";
import { useAuth } from "../context/AuthContext";
import { startBackgroundTracking, stopBackgroundTracking } from "../tracking/locationTask";
import { Vehicle, VehicleType } from "../types";

const VEHICLE_TYPES: VehicleType[] = ["Bus", "Auto", "Taxi", "Bike", "Truck", "Ambulance", "Other"];
const LOCATION_INTERVAL_MS = 5000;

export default function DriverScreen() {
  const { token, name, signOut } = useAuth();
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [loading, setLoading] = useState(true);
  const [regNumber, setRegNumber] = useState("");
  const [vehicleType, setVehicleType] = useState<VehicleType>("Bus");
  const [fromLocation, setFromLocation] = useState("");
  const [toLocation, setToLocation] = useState("");
  const [stopsText, setStopsText] = useState("");
  const [showRouteFields, setShowRouteFields] = useState(false);
  const [activeVehicleId, setActiveVehicleId] = useState<string | null>(null);
  const [tracking, setTracking] = useState(false);
  const [adding, setAdding] = useState(false);
  const [logoutConfirmOpen, setLogoutConfirmOpen] = useState(false);

  useEffect(() => {
    loadVehicles();
    return () => {
      stopBackgroundTracking();
    };
  }, []);

  async function loadVehicles() {
    if (!token) return;
    setLoading(true);
    try {
      const list = await vehicleApi.myVehicles(token);
      setVehicles(list);
    } catch (err) {
      console.warn(err);
    } finally {
      setLoading(false);
    }
  }

  async function handleAddVehicle() {
    if (!token || !regNumber) return;
    setAdding(true);
    try {
      let destinationLatitude: number | undefined;
      let destinationLongitude: number | undefined;

      if (toLocation.trim()) {
        try {
          const results = await Location.geocodeAsync(toLocation.trim());
          if (results.length > 0) {
            destinationLatitude = results[0].latitude;
            destinationLongitude = results[0].longitude;
          }
        } catch (geocodeErr) {
          console.warn("Could not geocode destination:", geocodeErr);
        }
      }

      const stopNames = stopsText
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);

      const stops = await Promise.all(
        stopNames.map(async (name) => {
          try {
            const results = await Location.geocodeAsync(name);
            return { name, latitude: results[0]?.latitude, longitude: results[0]?.longitude };
          } catch {
            return { name };
          }
        })
      );

      await vehicleApi.registerVehicle(token, regNumber, vehicleType, {
        fromLocation: fromLocation.trim() || undefined,
        toLocation: toLocation.trim() || undefined,
        destinationLatitude,
        destinationLongitude,
        stops: stops.length > 0 ? stops : undefined,
      });

      const hadDestinationName = toLocation.trim().length > 0;
      setRegNumber("");
      setFromLocation("");
      setToLocation("");
      setStopsText("");
      setShowRouteFields(false);
      await loadVehicles();

      if (hadDestinationName && destinationLatitude === undefined) {
        Alert.alert(
          "Vehicle added",
          "We couldn't pinpoint your destination on the map, so arrival alerts won't trigger automatically for this trip. You can still track it live."
        );
      }
    } catch (err) {
      const message = err instanceof ApiError ? err.message : String(err);
      Alert.alert("Could not add vehicle", message);
    } finally {
      setAdding(false);
    }
  }

  function confirmSignOut() {
    setLogoutConfirmOpen(true);
  }

  async function handleConfirmedSignOut() {
    setLogoutConfirmOpen(false);
    if (tracking) {
      await stopTracking();
    }
    signOut();
  }

  async function startTracking(vehicleId: string) {
    if (!token) return;

    try {
      const fg = await Location.requestForegroundPermissionsAsync();
      if (fg.status !== "granted") {
        Alert.alert("Permission required", "Location permission is needed to share your vehicle's position.");
        return;
      }

      const bg = await Location.requestBackgroundPermissionsAsync();
      if (bg.status !== "granted") {
        Alert.alert(
          "Background location recommended",
          "Without background location, sharing stops as soon as you lock your phone or switch apps. You can enable \"Allow all the time\" in Settings for uninterrupted tracking."
        );
      }

      await vehicleApi.startTracking(token, vehicleId);
      setActiveVehicleId(vehicleId);
      setTracking(true);

      await startBackgroundTracking(token, vehicleId, LOCATION_INTERVAL_MS);
    } catch (err) {
      const message = err instanceof ApiError ? err.message : String(err);
      Alert.alert("Could not start tracking", message);
      setTracking(false);
      setActiveVehicleId(null);
    }
  }

  async function stopTracking() {
    if (!token || !activeVehicleId) return;
    await stopBackgroundTracking();
    try {
      await vehicleApi.stopTracking(token, activeVehicleId);
    } catch (err) {
      const message = err instanceof ApiError ? err.message : String(err);
      Alert.alert("Could not stop tracking", message);
    } finally {
      setTracking(false);
      setActiveVehicleId(null);
      loadVehicles();
    }
  }

  if (loading) {
    return (
      <SafeAreaView style={styles.center}>
        <ActivityIndicator size="large" color="#2563eb" />
      </SafeAreaView>
    );
  }

  const activeVehicle = vehicles.find((v) => v.id === activeVehicleId);

  return (
    <SafeAreaView style={styles.container} edges={["top", "left", "right"]}>
      <StatusBar style="dark" />
      <LinearGradient colors={["#1e3a8a", "#2563eb"]} style={styles.header}>
        <View style={styles.headerTop}>
          <View>
            <Text style={styles.greeting}>Welcome back</Text>
            <Text style={styles.title}>{name}</Text>
          </View>
          <TouchableOpacity style={styles.logoutButton} onPress={confirmSignOut} activeOpacity={0.7}>
            <Text style={styles.logoutIcon}>⏻</Text>
            <Text style={styles.logout}>Log out</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.statusPill}>
          <View style={[styles.statusDot, tracking && styles.statusDotLive]} />
          <Text style={styles.statusText}>
            {tracking ? `Live — sharing ${activeVehicle?.registrationNumber ?? "vehicle"} location` : "Not sharing location"}
          </Text>
        </View>
      </LinearGradient>

      {!tracking && (
        <View style={styles.addCard}>
          <Text style={styles.cardLabel}>Add a vehicle</Text>
          <TextInput
            style={styles.input}
            placeholder="Vehicle number (e.g. UP70AB1234)"
            placeholderTextColor="#9ca3af"
            value={regNumber}
            onChangeText={setRegNumber}
            autoCapitalize="characters"
          />
          <View style={styles.typeRow}>
            {VEHICLE_TYPES.map((t) => (
              <TouchableOpacity
                key={t}
                style={[styles.typeChip, vehicleType === t && styles.typeChipActive]}
                onPress={() => setVehicleType(t)}
                activeOpacity={0.8}
              >
                <Text style={vehicleType === t ? styles.typeTextActive : styles.typeText}>{t}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <TouchableOpacity
            style={styles.routeToggle}
            onPress={() => setShowRouteFields((v) => !v)}
            activeOpacity={0.7}
          >
            <Text style={styles.routeToggleText}>
              {showRouteFields ? "− Hide route details" : "+ Add route (recommended)"}
            </Text>
          </TouchableOpacity>

          {showRouteFields && (
            <View style={styles.routeFields}>
              <Text style={styles.routeHint}>
                Adding a route lets passengers and family see where this vehicle is
                headed and when it has arrived — just like a train's status.
              </Text>
              <TextInput
                style={styles.input}
                placeholder="From (e.g. Civil Lines)"
                placeholderTextColor="#9ca3af"
                value={fromLocation}
                onChangeText={setFromLocation}
              />
              <TextInput
                style={styles.input}
                placeholder="To (e.g. Naini)"
                placeholderTextColor="#9ca3af"
                value={toLocation}
                onChangeText={setToLocation}
              />
              <TextInput
                style={styles.input}
                placeholder="Stops, separated by commas (optional)"
                placeholderTextColor="#9ca3af"
                value={stopsText}
                onChangeText={setStopsText}
              />
            </View>
          )}

          <TouchableOpacity
            style={[styles.addButton, (!regNumber || adding) && styles.addButtonDisabled]}
            onPress={handleAddVehicle}
            disabled={!regNumber || adding}
            activeOpacity={0.85}
          >
            {adding ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <Text style={styles.addButtonText}>+ Add Vehicle</Text>
            )}
          </TouchableOpacity>
        </View>
      )}

      <Text style={styles.sectionLabel}>Your vehicles</Text>

      <FlatList
        data={vehicles}
        keyExtractor={(v) => v.id}
        contentContainerStyle={styles.listContent}
        renderItem={({ item }) => {
          const isLive = tracking && activeVehicleId === item.id;
          return (
            <View style={[styles.vehicleCard, isLive && styles.vehicleCardLive]}>
              <View style={styles.vehicleIconWrap}>
                <Text style={styles.vehicleIcon}>{vehicleEmoji(item.type)}</Text>
              </View>
              <View style={styles.vehicleInfo}>
                <Text style={styles.vehicleReg}>{item.registrationNumber}</Text>
                <Text style={styles.vehicleType}>
                  {item.type}
                  {item.fromLocation && item.toLocation ? ` · ${item.fromLocation} → ${item.toLocation}` : ""}
                </Text>
              </View>
              {isLive ? (
                <TouchableOpacity style={styles.stopButton} onPress={stopTracking} activeOpacity={0.85}>
                  <Text style={styles.stopButtonText}>■ Stop</Text>
                </TouchableOpacity>
              ) : (
                <TouchableOpacity
                  style={[styles.startButton, tracking && styles.startButtonDisabled]}
                  disabled={tracking}
                  onPress={() => startTracking(item.id)}
                  activeOpacity={0.85}
                >
                  <Text style={styles.startButtonText}>▶ Start</Text>
                </TouchableOpacity>
              )}
            </View>
          );
        }}
        ListEmptyComponent={
          <View style={styles.emptyWrap}>
            <Text style={styles.emptyIcon}>🚐</Text>
            <Text style={styles.empty}>No vehicles yet</Text>
            <Text style={styles.emptySub}>Add your vehicle above to start sharing your live location.</Text>
          </View>
        }
      />

      <LogoutConfirmModal
        visible={logoutConfirmOpen}
        message={
          tracking
            ? "You're still sharing your live location. Logging out will stop tracking and you'll need to log in again to continue driving."
            : "You'll need to log in again to continue driving."
        }
        onCancel={() => setLogoutConfirmOpen(false)}
        onConfirm={handleConfirmedSignOut}
      />
    </SafeAreaView>
  );
}

function vehicleEmoji(type: VehicleType): string {
  switch (type) {
    case "Bus":
      return "🚌";
    case "Auto":
      return "🛺";
    case "Taxi":
      return "🚕";
    case "Bike":
      return "🏍️";
    case "Truck":
      return "🚚";
    case "Ambulance":
      return "🚑";
    default:
      return "🚗";
  }
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f8fafc" },
  center: { flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "#f8fafc" },
  header: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 20,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
  },
  headerTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 16,
  },
  greeting: { color: "rgba(255,255,255,0.75)", fontSize: 13 },
  title: { color: "#fff", fontSize: 24, fontWeight: "700", marginTop: 2 },
  logoutButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "rgba(255,255,255,0.15)",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
  },
  logoutIcon: { color: "#fff", fontSize: 14 },
  logout: { color: "#fff", fontWeight: "600", fontSize: 13 },
  statusPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "rgba(255,255,255,0.12)",
    alignSelf: "flex-start",
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 16,
  },
  statusDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: "rgba(255,255,255,0.4)" },
  statusDotLive: { backgroundColor: "#4ade80" },
  statusText: { color: "#fff", fontSize: 13, fontWeight: "500" },
  addCard: {
    backgroundColor: "#fff",
    marginHorizontal: 16,
    marginTop: -14,
    borderRadius: 16,
    padding: 16,
    elevation: 3,
    shadowColor: "#000",
    shadowOpacity: 0.08,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
  },
  cardLabel: { fontSize: 13, fontWeight: "700", color: "#64748b", marginBottom: 10, textTransform: "uppercase", letterSpacing: 0.5 },
  input: {
    borderWidth: 1,
    borderColor: "#e2e8f0",
    backgroundColor: "#f8fafc",
    borderRadius: 10,
    padding: 13,
    marginBottom: 12,
    fontSize: 15,
    color: "#1e293b",
  },
  typeRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 14 },
  typeChip: { borderWidth: 1, borderColor: "#dbeafe", backgroundColor: "#eff6ff", borderRadius: 16, paddingHorizontal: 12, paddingVertical: 6 },
  typeChipActive: { backgroundColor: "#2563eb", borderColor: "#2563eb" },
  typeText: { color: "#2563eb", fontSize: 13, fontWeight: "500" },
  typeTextActive: { color: "#fff", fontSize: 13, fontWeight: "600" },
  routeToggle: { marginBottom: 10 },
  routeToggleText: { color: "#2563eb", fontSize: 13, fontWeight: "600" },
  routeFields: { marginBottom: 4 },
  routeHint: { fontSize: 12, color: "#64748b", marginBottom: 10, lineHeight: 17 },
  addButton: {
    backgroundColor: "#16a34a",
    borderRadius: 10,
    padding: 14,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 46,
  },
  addButtonDisabled: { backgroundColor: "#cbd5e1" },
  addButtonText: { color: "#fff", fontWeight: "700", fontSize: 15 },
  sectionLabel: {
    fontSize: 13,
    fontWeight: "700",
    color: "#64748b",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginTop: 20,
    marginBottom: 8,
    marginHorizontal: 20,
  },
  listContent: { paddingHorizontal: 16, paddingBottom: 24 },
  vehicleCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
    padding: 14,
    borderRadius: 14,
    marginBottom: 10,
    elevation: 1,
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
  },
  vehicleCardLive: { borderWidth: 1.5, borderColor: "#4ade80" },
  vehicleIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#eff6ff",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  vehicleIcon: { fontSize: 22 },
  vehicleInfo: { flex: 1 },
  vehicleReg: { fontSize: 16, fontWeight: "700", color: "#1e293b" },
  vehicleType: { color: "#64748b", fontSize: 13, marginTop: 2 },
  startButton: { backgroundColor: "#2563eb", borderRadius: 10, paddingHorizontal: 16, paddingVertical: 10 },
  startButtonDisabled: { backgroundColor: "#cbd5e1" },
  startButtonText: { color: "#fff", fontWeight: "700", fontSize: 13 },
  stopButton: { backgroundColor: "#dc2626", borderRadius: 10, paddingHorizontal: 16, paddingVertical: 10 },
  stopButtonText: { color: "#fff", fontWeight: "700", fontSize: 13 },
  emptyWrap: { alignItems: "center", marginTop: 50, paddingHorizontal: 40 },
  emptyIcon: { fontSize: 40, marginBottom: 10 },
  empty: { textAlign: "center", color: "#475569", fontSize: 16, fontWeight: "600" },
  emptySub: { textAlign: "center", color: "#94a3b8", fontSize: 13, marginTop: 4 },
});
