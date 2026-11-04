import * as Location from "expo-location";
import React, { useEffect, useRef, useState } from "react";
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
import { useAuth } from "../context/AuthContext";
import { Vehicle, VehicleType } from "../types";

const VEHICLE_TYPES: VehicleType[] = ["Bus", "Auto", "Taxi", "Bike", "Truck", "Ambulance", "Other"];
const LOCATION_INTERVAL_MS = 5000;

export default function DriverScreen() {
  const { token, name, signOut } = useAuth();
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [loading, setLoading] = useState(true);
  const [regNumber, setRegNumber] = useState("");
  const [vehicleType, setVehicleType] = useState<VehicleType>("Bus");
  const [activeVehicleId, setActiveVehicleId] = useState<string | null>(null);
  const [tracking, setTracking] = useState(false);
  const watchSubscription = useRef<Location.LocationSubscription | null>(null);

  useEffect(() => {
    loadVehicles();
    return () => {
      watchSubscription.current?.remove();
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
    try {
      await vehicleApi.registerVehicle(token, regNumber, vehicleType);
      setRegNumber("");
      loadVehicles();
    } catch (err) {
      Alert.alert("Could not add vehicle", String(err));
    }
  }

  async function startTracking(vehicleId: string) {
    if (!token) return;

    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") {
        Alert.alert("Permission required", "Location permission is needed to share your vehicle's position.");
        return;
      }

      await vehicleApi.startTracking(token, vehicleId);
      setActiveVehicleId(vehicleId);
      setTracking(true);

      watchSubscription.current = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.High,
          timeInterval: LOCATION_INTERVAL_MS,
          distanceInterval: 10,
        },
        (loc) => {
          vehicleApi
            .postLocation(
              token,
              vehicleId,
              loc.coords.latitude,
              loc.coords.longitude,
              loc.coords.speed ? loc.coords.speed * 3.6 : null,
              loc.coords.heading,
              loc.coords.accuracy
            )
            .catch((err) => console.warn("Failed to post location:", err));
        }
      );
    } catch (err) {
      const message = err instanceof ApiError ? err.message : String(err);
      Alert.alert("Could not start tracking", message);
      setTracking(false);
      setActiveVehicleId(null);
    }
  }

  async function stopTracking() {
    if (!token || !activeVehicleId) return;
    watchSubscription.current?.remove();
    watchSubscription.current = null;
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
        <ActivityIndicator size="large" />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Hi, {name}</Text>
        <TouchableOpacity onPress={signOut}>
          <Text style={styles.logout}>Log out</Text>
        </TouchableOpacity>
      </View>

      {!tracking && (
        <View style={styles.addRow}>
          <TextInput
            style={styles.input}
            placeholder="Vehicle number (e.g. UP70AB1234)"
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
              >
                <Text style={vehicleType === t ? styles.typeTextActive : styles.typeText}>{t}</Text>
              </TouchableOpacity>
            ))}
          </View>
          <TouchableOpacity style={styles.addButton} onPress={handleAddVehicle}>
            <Text style={styles.addButtonText}>Add Vehicle</Text>
          </TouchableOpacity>
        </View>
      )}

      <FlatList
        data={vehicles}
        keyExtractor={(v) => v.id}
        contentContainerStyle={{ paddingTop: 12 }}
        renderItem={({ item }) => (
          <View style={styles.vehicleCard}>
            <View>
              <Text style={styles.vehicleReg}>{item.registrationNumber}</Text>
              <Text style={styles.vehicleType}>{item.type}</Text>
            </View>
            {tracking && activeVehicleId === item.id ? (
              <TouchableOpacity style={styles.stopButton} onPress={stopTracking}>
                <Text style={styles.stopButtonText}>Stop</Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity
                style={styles.startButton}
                disabled={tracking}
                onPress={() => startTracking(item.id)}
              >
                <Text style={styles.startButtonText}>Start</Text>
              </TouchableOpacity>
            )}
          </View>
        )}
        ListEmptyComponent={<Text style={styles.empty}>No vehicles yet. Add one above.</Text>}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fff", padding: 20 },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 16 },
  title: { fontSize: 22, fontWeight: "700" },
  logout: { color: "#dc2626" },
  addRow: { marginBottom: 16, borderBottomWidth: 1, borderBottomColor: "#eee", paddingBottom: 16 },
  input: { borderWidth: 1, borderColor: "#ccc", borderRadius: 8, padding: 12, marginBottom: 10 },
  typeRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 10 },
  typeChip: { borderWidth: 1, borderColor: "#2563eb", borderRadius: 16, paddingHorizontal: 12, paddingVertical: 6 },
  typeChipActive: { backgroundColor: "#2563eb" },
  typeText: { color: "#2563eb" },
  typeTextActive: { color: "#fff" },
  addButton: { backgroundColor: "#16a34a", borderRadius: 8, padding: 12, alignItems: "center" },
  addButtonText: { color: "#fff", fontWeight: "600" },
  vehicleCard: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 16,
    borderWidth: 1,
    borderColor: "#eee",
    borderRadius: 10,
    marginBottom: 10,
  },
  vehicleReg: { fontSize: 16, fontWeight: "600" },
  vehicleType: { color: "#666" },
  startButton: { backgroundColor: "#2563eb", borderRadius: 8, paddingHorizontal: 16, paddingVertical: 8 },
  startButtonText: { color: "#fff", fontWeight: "600" },
  stopButton: { backgroundColor: "#dc2626", borderRadius: 8, paddingHorizontal: 16, paddingVertical: 8 },
  stopButtonText: { color: "#fff", fontWeight: "600" },
  empty: { textAlign: "center", color: "#999", marginTop: 40 },
});
