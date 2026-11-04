import * as Location from "expo-location";
import React, { useEffect, useState } from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import MapView, { Marker, Region } from "react-native-maps";
import { vehicleApi } from "../api/endpoints";
import { useTrackingHub } from "../api/useTrackingHub";
import { useAuth } from "../context/AuthContext";
import { VehicleType, VehicleWithLocation } from "../types";

const VEHICLE_TYPES: (VehicleType | "All")[] = ["All", "Bus", "Auto", "Taxi", "Bike"];

const DEFAULT_REGION: Region = {
  latitude: 25.4358,
  longitude: 81.8463,
  latitudeDelta: 0.1,
  longitudeDelta: 0.1,
};

export default function PassengerScreen() {
  const { signOut } = useAuth();
  const [vehicles, setVehicles] = useState<Record<string, VehicleWithLocation>>({});
  const [filter, setFilter] = useState<VehicleType | "All">("All");
  const [region, setRegion] = useState<Region>(DEFAULT_REGION);

  useEffect(() => {
    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status === "granted") {
        const loc = await Location.getCurrentPositionAsync({});
        setRegion({
          latitude: loc.coords.latitude,
          longitude: loc.coords.longitude,
          latitudeDelta: 0.05,
          longitudeDelta: 0.05,
        });
      }
    })();
  }, []);

  useEffect(() => {
    loadActiveVehicles();
  }, [filter]);

  async function loadActiveVehicles() {
    const list = await vehicleApi.activeVehicles(filter === "All" ? undefined : filter);
    const map: Record<string, VehicleWithLocation> = {};
    list.forEach((v) => (map[v.id] = v));
    setVehicles(map);
  }

  useTrackingHub((update) => {
    setVehicles((prev) => {
      const existing = prev[update.vehicleId];
      if (!existing) return prev;
      return {
        ...prev,
        [update.vehicleId]: {
          ...existing,
          latitude: update.latitude,
          longitude: update.longitude,
          speedKmh: update.speedKmh,
          lastUpdatedAt: update.recordedAt,
        },
      };
    });
  });

  const markers = Object.values(vehicles).filter((v) => v.latitude != null && v.longitude != null);

  return (
    <View style={styles.container}>
      <View style={styles.filterRow}>
        {VEHICLE_TYPES.map((t) => (
          <TouchableOpacity
            key={t}
            style={[styles.chip, filter === t && styles.chipActive]}
            onPress={() => setFilter(t)}
          >
            <Text style={filter === t ? styles.chipTextActive : styles.chipText}>{t}</Text>
          </TouchableOpacity>
        ))}
        <TouchableOpacity onPress={signOut}>
          <Text style={styles.logout}>Log out</Text>
        </TouchableOpacity>
      </View>

      <MapView style={styles.map} initialRegion={region} region={region}>
        {markers.map((v) => (
          <Marker
            key={v.id}
            coordinate={{ latitude: v.latitude!, longitude: v.longitude! }}
            title={`${v.type} ${v.registrationNumber}`}
            description={v.routeName ?? undefined}
          />
        ))}
      </MapView>

      <View style={styles.listFooter}>
        <Text style={styles.footerText}>{markers.length} active vehicle(s) nearby</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fff" },
  filterRow: {
    flexDirection: "row",
    alignItems: "center",
    padding: 10,
    gap: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#eee",
  },
  chip: { borderWidth: 1, borderColor: "#2563eb", borderRadius: 16, paddingHorizontal: 12, paddingVertical: 6 },
  chipActive: { backgroundColor: "#2563eb" },
  chipText: { color: "#2563eb" },
  chipTextActive: { color: "#fff" },
  logout: { color: "#dc2626", marginLeft: "auto" },
  map: { flex: 1 },
  listFooter: { padding: 12, borderTopWidth: 1, borderTopColor: "#eee" },
  footerText: { textAlign: "center", color: "#666" },
});
