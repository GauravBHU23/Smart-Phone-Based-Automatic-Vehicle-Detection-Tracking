import * as Location from "expo-location";
import React, { useEffect, useState } from "react";
import { Modal, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import MapView, { MapStyleElement, MapType, Marker, Region } from "react-native-maps";
import { SafeAreaView } from "react-native-safe-area-context";
import { vehicleApi } from "../api/endpoints";
import { useTrackingHub } from "../api/useTrackingHub";
import { useAuth } from "../context/AuthContext";
import { VehicleType, VehicleWithLocation } from "../types";
import { DARK_MAP_STYLE, LIGHT_MAP_STYLE } from "./mapStyles";

const VEHICLE_TYPES: (VehicleType | "All")[] = ["All", "Bus", "Auto", "Taxi", "Bike"];

type MapTheme = "light" | "dark" | "standard" | "satellite" | "hybrid";

const MAP_THEMES: { value: MapTheme; label: string; mapType: MapType; customStyle: MapStyleElement[] }[] = [
  { value: "light", label: "Light", mapType: "standard", customStyle: LIGHT_MAP_STYLE },
  { value: "dark", label: "Dark", mapType: "standard", customStyle: DARK_MAP_STYLE },
  { value: "standard", label: "Standard", mapType: "standard", customStyle: [] },
  { value: "satellite", label: "Satellite", mapType: "satellite", customStyle: [] },
  { value: "hybrid", label: "Hybrid", mapType: "hybrid", customStyle: [] },
];

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
  const [mapTheme, setMapTheme] = useState<MapTheme>("light");
  const [mapMenuOpen, setMapMenuOpen] = useState(false);
  const activeTheme = MAP_THEMES.find((m) => m.value === mapTheme)!;

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

  useTrackingHub(
    (update) => {
      setVehicles((prev) => {
        const existing = prev[update.vehicleId];
        if (!existing) {
          // A vehicle we don't know about yet just went live — refresh the list
          // from the server so it appears with its full details (type, reg no.).
          loadActiveVehicles();
          return prev;
        }
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
    },
    (vehicleId) => {
      setVehicles((prev) => {
        const { [vehicleId]: _removed, ...rest } = prev;
        return rest;
      });
    }
  );

  const markers = Object.values(vehicles).filter((v) => v.latitude != null && v.longitude != null);

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.topBar}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filterRow}
          style={styles.filterScroll}
        >
          {VEHICLE_TYPES.map((t) => (
            <TouchableOpacity
              key={t}
              style={[styles.chip, filter === t && styles.chipActive]}
              onPress={() => setFilter(t)}
            >
              <Text style={filter === t ? styles.chipTextActive : styles.chipText}>{t}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
        <TouchableOpacity style={styles.menuButton} onPress={() => setMapMenuOpen(true)}>
          <Text style={styles.menuIcon}>☰</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.logoutButton} onPress={signOut}>
          <Text style={styles.logout}>Log out</Text>
        </TouchableOpacity>
      </View>

      <MapView
        style={styles.map}
        initialRegion={region}
        region={region}
        mapType={activeTheme.mapType}
        customMapStyle={activeTheme.customStyle}
      >
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

      <Modal
        visible={mapMenuOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setMapMenuOpen(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setMapMenuOpen(false)}
        >
          <View style={styles.menuCard}>
            <Text style={styles.menuTitle}>Map type</Text>
            {MAP_THEMES.map((m) => (
              <TouchableOpacity
                key={m.value}
                style={styles.menuItem}
                onPress={() => {
                  setMapTheme(m.value);
                  setMapMenuOpen(false);
                }}
              >
                <Text style={[styles.menuItemText, mapTheme === m.value && styles.menuItemTextActive]}>
                  {m.label}
                </Text>
                {mapTheme === m.value && <Text style={styles.menuCheck}>✓</Text>}
              </TouchableOpacity>
            ))}
          </View>
        </TouchableOpacity>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fff" },
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    borderBottomWidth: 1,
    borderBottomColor: "#eee",
  },
  filterScroll: { flex: 1 },
  filterRow: {
    alignItems: "center",
    padding: 10,
    gap: 8,
  },
  chip: { borderWidth: 1, borderColor: "#2563eb", borderRadius: 16, paddingHorizontal: 12, paddingVertical: 6 },
  chipActive: { backgroundColor: "#2563eb" },
  chipText: { color: "#2563eb" },
  chipTextActive: { color: "#fff" },
  menuButton: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginRight: 4,
  },
  menuIcon: { fontSize: 20, color: "#333" },
  logoutButton: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    marginRight: 8,
    borderWidth: 1,
    borderColor: "#dc2626",
    borderRadius: 16,
  },
  logout: { color: "#dc2626", fontWeight: "600" },
  map: { flex: 1 },
  listFooter: { padding: 12, borderTopWidth: 1, borderTopColor: "#eee" },
  footerText: { textAlign: "center", color: "#666" },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.3)",
    justifyContent: "flex-start",
    alignItems: "flex-end",
  },
  menuCard: {
    marginTop: 60,
    marginRight: 10,
    backgroundColor: "#fff",
    borderRadius: 10,
    paddingVertical: 8,
    minWidth: 160,
    elevation: 4,
    shadowColor: "#000",
    shadowOpacity: 0.2,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
  },
  menuTitle: {
    fontSize: 13,
    fontWeight: "700",
    color: "#999",
    paddingHorizontal: 16,
    paddingVertical: 6,
  },
  menuItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  menuItemText: { fontSize: 15, color: "#333" },
  menuItemTextActive: { color: "#2563eb", fontWeight: "600" },
  menuCheck: { color: "#2563eb", fontWeight: "700" },
});
