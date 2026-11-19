import * as Location from "expo-location";
import React, { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { ApiError } from "../api/client";
import { vehicleApi } from "../api/endpoints";
import PlaceAutocomplete from "../components/PlaceAutocomplete";
import { useAuth } from "../context/AuthContext";
import { PlaceSelection, Vehicle, VehicleType } from "../types";

const VEHICLE_TYPES: VehicleType[] = ["Bus", "Auto", "Taxi", "Bike", "Truck", "Ambulance", "Other"];

let nextStopKey = 0;

async function resolveCoordinates(place: PlaceSelection | null): Promise<{ latitude?: number; longitude?: number }> {
  if (!place || place.id !== null) return {};
  if (place.latitude != null && place.longitude != null) {
    return { latitude: place.latitude, longitude: place.longitude };
  }
  try {
    const results = await Location.geocodeAsync(place.name);
    if (results.length > 0) return { latitude: results[0].latitude, longitude: results[0].longitude };
  } catch (geocodeErr) {
    console.warn("Could not geocode place:", geocodeErr);
  }
  return {};
}

export default function EditVehicleScreen({ route, navigation }: any) {
  const { vehicle }: { vehicle: Vehicle } = route.params;
  const { token } = useAuth();
  const [regNumber, setRegNumber] = useState(vehicle.registrationNumber);
  const [vehicleType, setVehicleType] = useState<VehicleType>(vehicle.type);
  const [fromPlace, setFromPlace] = useState<PlaceSelection | null>(
    vehicle.fromLocation ? { id: null, name: vehicle.fromLocation } : null
  );
  const [toPlace, setToPlace] = useState<PlaceSelection | null>(
    vehicle.toLocation ? { id: null, name: vehicle.toLocation } : null
  );
  const [stops, setStops] = useState<{ key: number; place: PlaceSelection | null }[]>(
    vehicle.stops.map((s) => ({ key: nextStopKey++, place: { id: null, name: s.name } }))
  );
  const [saving, setSaving] = useState(false);

  function addStopRow() {
    setStops((prev) => [...prev, { key: nextStopKey++, place: null }]);
  }

  function removeStopRow(key: number) {
    setStops((prev) => prev.filter((s) => s.key !== key));
  }

  function updateStopRow(key: number, place: PlaceSelection) {
    setStops((prev) => prev.map((s) => (s.key === key ? { ...s, place } : s)));
  }

  async function handleSave() {
    if (!token || !regNumber) return;
    setSaving(true);
    try {
      const toCoords = await resolveCoordinates(toPlace);
      const stopInputs = await Promise.all(
        stops
          .filter((s) => s.place && s.place.name.trim())
          .map(async (s) => {
            const place = s.place!;
            const coords = await resolveCoordinates(place);
            return {
              name: place.name,
              placeId: place.id ?? undefined,
              latitude: coords.latitude,
              longitude: coords.longitude,
            };
          })
      );

      await vehicleApi.updateVehicle(token, vehicle.id, regNumber, vehicleType, {
        fromLocation: fromPlace?.name.trim() || undefined,
        toLocation: toPlace?.name.trim() || undefined,
        fromPlaceId: fromPlace?.id ?? undefined,
        toPlaceId: toPlace?.id ?? undefined,
        destinationLatitude: toCoords.latitude,
        destinationLongitude: toCoords.longitude,
        stops: stopInputs.length > 0 ? stopInputs : undefined,
      });

      navigation.goBack();
    } catch (err) {
      const message = err instanceof ApiError ? err.message : String(err);
      Alert.alert("Could not save changes", message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <SafeAreaView style={styles.container} edges={["top", "left", "right", "bottom"]}>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backIcon}>
            <Text style={styles.backIconText}>←</Text>
          </TouchableOpacity>
          <View style={styles.headerCenter}>
            <Text style={styles.title}>Edit vehicle</Text>
            <Text style={styles.subtitle}>{vehicle.registrationNumber}</Text>
          </View>
        </View>

        <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
          <Text style={styles.cardLabel}>Vehicle number</Text>
          <TextInput
            style={styles.input}
            placeholder="Vehicle number"
            placeholderTextColor="#9ca3af"
            value={regNumber}
            onChangeText={(t) => setRegNumber(t.toUpperCase())}
            autoCapitalize="characters"
          />

          <Text style={styles.cardLabel}>Type</Text>
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

          <Text style={styles.cardLabel}>From</Text>
          <PlaceAutocomplete value={fromPlace} onChange={setFromPlace} placeholder="From (e.g. Civil Lines)" allowNew />

          <Text style={styles.cardLabel}>To</Text>
          <PlaceAutocomplete value={toPlace} onChange={setToPlace} placeholder="To (e.g. Naini)" allowNew />

          {stops.map((stop, i) => (
            <View key={stop.key} style={styles.stopRow}>
              <View style={styles.stopAutocompleteWrap}>
                <PlaceAutocomplete
                  value={stop.place}
                  onChange={(place) => updateStopRow(stop.key, place)}
                  placeholder={`Stop ${i + 1}`}
                  allowNew
                />
              </View>
              <TouchableOpacity style={styles.removeStopButton} onPress={() => removeStopRow(stop.key)} activeOpacity={0.7}>
                <Text style={styles.removeStopText}>✕</Text>
              </TouchableOpacity>
            </View>
          ))}

          <TouchableOpacity style={styles.addStopButton} onPress={addStopRow} activeOpacity={0.7}>
            <Text style={styles.addStopText}>+ Add a stop</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.saveButton, (!regNumber || saving) && styles.saveButtonDisabled]}
            onPress={handleSave}
            disabled={!regNumber || saving}
            activeOpacity={0.85}
          >
            {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveButtonText}>Save changes</Text>}
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f8fafc" },
  flex: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderBottomColor: "#eee",
  },
  backIcon: { padding: 6, marginRight: 8 },
  backIconText: { fontSize: 22, color: "#1e293b" },
  headerCenter: { flex: 1 },
  title: { fontSize: 18, fontWeight: "700", color: "#1e293b" },
  subtitle: { fontSize: 13, color: "#64748b", marginTop: 2 },
  scrollContent: { padding: 20, paddingBottom: 32 },
  cardLabel: {
    fontSize: 12,
    fontWeight: "700",
    color: "#64748b",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 6,
    marginTop: 16,
  },
  input: {
    borderWidth: 1,
    borderColor: "#e2e8f0",
    backgroundColor: "#fff",
    borderRadius: 10,
    padding: 14,
    fontSize: 15,
    color: "#1e293b",
  },
  typeRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  typeChip: { borderWidth: 1, borderColor: "#dbeafe", backgroundColor: "#eff6ff", borderRadius: 16, paddingHorizontal: 12, paddingVertical: 6 },
  typeChipActive: { backgroundColor: "#2563eb", borderColor: "#2563eb" },
  typeText: { color: "#2563eb", fontSize: 13, fontWeight: "500" },
  typeTextActive: { color: "#fff", fontSize: 13, fontWeight: "600" },
  stopRow: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 10 },
  stopAutocompleteWrap: { flex: 1 },
  removeStopButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#fef2f2",
    alignItems: "center",
    justifyContent: "center",
  },
  removeStopText: { color: "#dc2626", fontSize: 14, fontWeight: "700" },
  addStopButton: { marginTop: 10 },
  addStopText: { color: "#2563eb", fontSize: 13, fontWeight: "600" },
  saveButton: {
    backgroundColor: "#2563eb",
    borderRadius: 10,
    padding: 15,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 50,
    marginTop: 28,
  },
  saveButtonDisabled: { backgroundColor: "#cbd5e1" },
  saveButtonText: { color: "#fff", fontSize: 16, fontWeight: "700" },
});
