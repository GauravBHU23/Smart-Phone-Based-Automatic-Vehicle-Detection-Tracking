import * as Location from "expo-location";
import React, { useEffect, useState } from "react";
import { ActivityIndicator, FlatList, Modal, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import MapView, { MapStyleElement, MapType, Marker, Region } from "react-native-maps";
import { SafeAreaView } from "react-native-safe-area-context";
import { vehicleApi } from "../api/endpoints";
import { useTrackingHub } from "../api/useTrackingHub";
import LogoutConfirmModal from "../components/LogoutConfirmModal";
import { useAuth } from "../context/AuthContext";
import { VehicleType, VehicleWithLocation } from "../types";
import { DARK_MAP_STYLE, LIGHT_MAP_STYLE } from "./mapStyles";

const VEHICLE_TYPES: (VehicleType | "All")[] = ["All", "Bus", "Auto", "Taxi", "Bike"];

const VEHICLE_MARKER_ICON: Record<string, string> = {
  Bus: "🚌",
  Auto: "🛺",
  Taxi: "🚕",
  Bike: "🏍️",
  Truck: "🚚",
  Ambulance: "🚑",
  Other: "🚗",
};

type MapTheme = "light" | "dark" | "standard" | "satellite" | "hybrid";

const MAP_THEMES: { value: MapTheme; label: string; icon: string; mapType: MapType; customStyle: MapStyleElement[] }[] = [
  { value: "light", label: "Light", icon: "☀️", mapType: "standard", customStyle: LIGHT_MAP_STYLE },
  { value: "dark", label: "Dark", icon: "🌙", mapType: "standard", customStyle: DARK_MAP_STYLE },
  { value: "standard", label: "Standard", icon: "🗺️", mapType: "standard", customStyle: [] },
  { value: "satellite", label: "Satellite", icon: "🛰️", mapType: "satellite", customStyle: [] },
  { value: "hybrid", label: "Hybrid", icon: "🌐", mapType: "hybrid", customStyle: [] },
];

const DEFAULT_REGION: Region = {
  latitude: 25.4358,
  longitude: 81.8463,
  latitudeDelta: 0.1,
  longitudeDelta: 0.1,
};

export default function PassengerScreen({ navigation }: any) {
  const { name, signOut } = useAuth();
  const [vehicles, setVehicles] = useState<Record<string, VehicleWithLocation>>({});
  const [filter, setFilter] = useState<VehicleType | "All">("All");
  const [region, setRegion] = useState<Region>(DEFAULT_REGION);
  const [mapTheme, setMapTheme] = useState<MapTheme>("light");
  const [menuOpen, setMenuOpen] = useState(false);
  const [logoutConfirmOpen, setLogoutConfirmOpen] = useState(false);
  const [listOpen, setListOpen] = useState(false);
  const [loading, setLoading] = useState(true);
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
    setLoading(true);
    try {
      const list = await vehicleApi.activeVehicles(filter === "All" ? undefined : filter);
      const map: Record<string, VehicleWithLocation> = {};
      list.forEach((v) => (map[v.id] = v));
      setVehicles(map);
    } catch (err) {
      console.warn("Failed to load active vehicles:", err);
    } finally {
      setLoading(false);
    }
  }

  useTrackingHub({
    onLocationUpdate: (update) => {
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
    onVehicleStarted: () => loadActiveVehicles(),
    onVehicleStopped: (vehicleId) => {
      setVehicles((prev) => {
        const { [vehicleId]: _removed, ...rest } = prev;
        return rest;
      });
    },
  });

  const markers = Object.values(vehicles).filter((v) => v.latitude != null && v.longitude != null);

  function openVehicle(vehicleId: string) {
    setListOpen(false);
    navigation.navigate("VehicleStatus", { vehicleId });
  }

  function handleSignOutPress() {
    setMenuOpen(false);
    setLogoutConfirmOpen(true);
  }

  return (
    <SafeAreaView style={styles.container} edges={["top", "left", "right"]}>
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <View>
            <Text style={styles.headerGreeting}>Live Map</Text>
            <View style={styles.liveBadgeRow}>
              <View style={styles.liveDot} />
              <Text style={styles.liveBadgeText}>
                {loading ? "Updating…" : `${markers.length} vehicle${markers.length === 1 ? "" : "s"} live`}
              </Text>
            </View>
          </View>
          <TouchableOpacity style={styles.menuButton} onPress={() => setMenuOpen(true)} activeOpacity={0.7}>
            <Text style={styles.menuIcon}>⋮</Text>
          </TouchableOpacity>
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filterRow}
        >
          {VEHICLE_TYPES.map((t) => (
            <TouchableOpacity
              key={t}
              style={[styles.chip, filter === t && styles.chipActive]}
              onPress={() => setFilter(t)}
              activeOpacity={0.8}
            >
              <Text style={filter === t ? styles.chipTextActive : styles.chipText}>{t}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      <View style={styles.mapWrap}>
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
              title={`${VEHICLE_MARKER_ICON[v.type] ?? ""} ${v.registrationNumber}`}
              description={v.fromLocation && v.toLocation ? `${v.fromLocation} → ${v.toLocation}` : undefined}
              onPress={() => openVehicle(v.id)}
            />
          ))}
        </MapView>

        {loading && (
          <View style={styles.mapLoadingOverlay}>
            <View style={styles.mapLoadingPill}>
              <ActivityIndicator size="small" color="#2563eb" />
              <Text style={styles.mapLoadingText}>Finding nearby vehicles…</Text>
            </View>
          </View>
        )}
      </View>

      <TouchableOpacity
        style={styles.listFooter}
        onPress={() => setListOpen(true)}
        disabled={markers.length === 0 || loading}
        activeOpacity={0.85}
      >
        {!loading && (
          <>
            <Text style={styles.footerText}>
              {markers.length > 0
                ? `${markers.length} active vehicle${markers.length === 1 ? "" : "s"} nearby`
                : "No vehicles are sharing their location right now"}
            </Text>
            {markers.length > 0 && <Text style={styles.footerChevron}>▲</Text>}
          </>
        )}
      </TouchableOpacity>

      {/* Map type + account menu */}
      <Modal
        visible={menuOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setMenuOpen(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setMenuOpen(false)}
        >
          <View style={styles.menuCard}>
            <Text style={styles.menuTitle}>Map type</Text>
            {MAP_THEMES.map((m) => (
              <TouchableOpacity
                key={m.value}
                style={styles.menuItem}
                onPress={() => {
                  setMapTheme(m.value);
                  setMenuOpen(false);
                }}
                activeOpacity={0.7}
              >
                <View style={styles.menuItemLeft}>
                  <Text style={styles.menuItemIcon}>{m.icon}</Text>
                  <Text style={[styles.menuItemText, mapTheme === m.value && styles.menuItemTextActive]}>
                    {m.label}
                  </Text>
                </View>
                {mapTheme === m.value && <Text style={styles.menuCheck}>✓</Text>}
              </TouchableOpacity>
            ))}

            <View style={styles.menuDivider} />
            <Text style={styles.menuTitle}>Signed in as {name}</Text>
            <TouchableOpacity style={styles.menuItem} onPress={handleSignOutPress} activeOpacity={0.7}>
              <View style={styles.menuItemLeft}>
                <Text style={styles.menuItemIcon}>⏻</Text>
                <Text style={styles.menuItemLogout}>Log out</Text>
              </View>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

      <LogoutConfirmModal
        visible={logoutConfirmOpen}
        message="You'll need to log in again to see live vehicles and alerts."
        onCancel={() => setLogoutConfirmOpen(false)}
        onConfirm={() => {
          setLogoutConfirmOpen(false);
          signOut();
        }}
      />

      {/* Nearby vehicles list */}
      <Modal
        visible={listOpen}
        transparent
        animationType="slide"
        onRequestClose={() => setListOpen(false)}
      >
        <TouchableOpacity
          style={styles.sheetOverlay}
          activeOpacity={1}
          onPress={() => setListOpen(false)}
        >
          <TouchableOpacity activeOpacity={1} style={styles.sheetCard} onPress={() => {}}>
            <View style={styles.sheetHandle} />
            <Text style={styles.sheetTitle}>
              {markers.length} vehicle{markers.length === 1 ? "" : "s"} nearby
            </Text>
            <FlatList
              data={markers}
              keyExtractor={(v) => v.id}
              style={styles.sheetList}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={styles.sheetRow}
                  onPress={() => openVehicle(item.id)}
                  activeOpacity={0.7}
                >
                  <View style={styles.sheetRowIconWrap}>
                    <Text style={styles.sheetRowIcon}>{VEHICLE_MARKER_ICON[item.type] ?? "🚗"}</Text>
                  </View>
                  <View style={styles.sheetRowInfo}>
                    <Text style={styles.sheetRowReg}>{item.registrationNumber}</Text>
                    <Text style={styles.sheetRowSub}>
                      {item.type}
                      {item.fromLocation && item.toLocation ? ` · ${item.fromLocation} → ${item.toLocation}` : ""}
                    </Text>
                  </View>
                  {item.speedKmh != null && (
                    <Text style={styles.sheetRowSpeed}>{Math.round(item.speedKmh)} km/h</Text>
                  )}
                  <Text style={styles.sheetRowArrow}>›</Text>
                </TouchableOpacity>
              )}
            />
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fff" },
  header: {
    backgroundColor: "#fff",
    paddingTop: 12,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#eef2f7",
  },
  headerTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    marginBottom: 10,
  },
  headerGreeting: { fontSize: 20, fontWeight: "800", color: "#1e293b" },
  liveBadgeRow: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 3 },
  liveDot: { width: 7, height: 7, borderRadius: 3.5, backgroundColor: "#16a34a" },
  liveBadgeText: { fontSize: 12, color: "#64748b", fontWeight: "500" },
  menuButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: "#f1f5f9",
    alignItems: "center",
    justifyContent: "center",
  },
  menuIcon: { fontSize: 20, color: "#334155", fontWeight: "700" },
  filterRow: {
    alignItems: "center",
    paddingHorizontal: 16,
    gap: 8,
  },
  chip: { borderWidth: 1, borderColor: "#dbeafe", backgroundColor: "#eff6ff", borderRadius: 16, paddingHorizontal: 14, paddingVertical: 7 },
  chipActive: { backgroundColor: "#2563eb", borderColor: "#2563eb" },
  chipText: { color: "#2563eb", fontSize: 13, fontWeight: "500" },
  chipTextActive: { color: "#fff", fontSize: 13, fontWeight: "700" },
  mapWrap: { flex: 1 },
  map: { flex: 1 },
  mapLoadingOverlay: {
    position: "absolute",
    top: 12,
    left: 0,
    right: 0,
    alignItems: "center",
  },
  mapLoadingPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#fff",
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 9,
    elevation: 3,
    shadowColor: "#000",
    shadowOpacity: 0.12,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
  },
  mapLoadingText: { fontSize: 13, color: "#334155", fontWeight: "600" },
  listFooter: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    padding: 14,
    borderTopWidth: 1,
    borderTopColor: "#eee",
    backgroundColor: "#fff",
    minHeight: 48,
  },
  footerText: { textAlign: "center", color: "#334155", fontWeight: "600" },
  footerChevron: { color: "#94a3b8", fontSize: 11 },
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
    borderRadius: 14,
    paddingVertical: 8,
    minWidth: 200,
    elevation: 4,
    shadowColor: "#000",
    shadowOpacity: 0.2,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
  },
  menuTitle: {
    fontSize: 12,
    fontWeight: "700",
    color: "#94a3b8",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  menuItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 11,
  },
  menuItemLeft: { flexDirection: "row", alignItems: "center", gap: 10 },
  menuItemIcon: { fontSize: 16, width: 20, textAlign: "center" },
  menuItemText: { fontSize: 15, color: "#334155" },
  menuItemTextActive: { color: "#2563eb", fontWeight: "700" },
  menuCheck: { color: "#2563eb", fontWeight: "700" },
  menuDivider: { height: 1, backgroundColor: "#eee", marginVertical: 4 },
  menuItemLogout: { fontSize: 15, color: "#dc2626", fontWeight: "600" },

  sheetOverlay: { flex: 1, backgroundColor: "rgba(15,23,42,0.4)", justifyContent: "flex-end" },
  sheetCard: {
    backgroundColor: "#fff",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingTop: 10,
    paddingHorizontal: 16,
    maxHeight: "65%",
  },
  sheetHandle: { width: 40, height: 4, borderRadius: 2, backgroundColor: "#e2e8f0", alignSelf: "center", marginBottom: 14 },
  sheetTitle: { fontSize: 15, fontWeight: "800", color: "#1e293b", marginBottom: 10, paddingHorizontal: 4 },
  sheetList: { marginBottom: 12 },
  sheetRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    paddingHorizontal: 4,
    borderBottomWidth: 1,
    borderBottomColor: "#f1f5f9",
  },
  sheetRowIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#eff6ff",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  sheetRowIcon: { fontSize: 19 },
  sheetRowInfo: { flex: 1 },
  sheetRowReg: { fontSize: 15, fontWeight: "700", color: "#1e293b" },
  sheetRowSub: { fontSize: 12, color: "#64748b", marginTop: 2 },
  sheetRowSpeed: { fontSize: 12, color: "#16a34a", fontWeight: "700", marginRight: 6 },
  sheetRowArrow: { fontSize: 20, color: "#cbd5e1" },
});
