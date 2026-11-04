import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import MapView, { Marker, Polyline, Region } from "react-native-maps";
import { SafeAreaView } from "react-native-safe-area-context";
import { vehicleApi } from "../api/endpoints";
import { useTrackingHub } from "../api/useTrackingHub";
import { useAuth } from "../context/AuthContext";
import { registerForPushNotifications } from "../tracking/pushNotifications";
import { RouteStop, VehicleStatus } from "../types";

const VEHICLE_ICONS: Record<string, string> = {
  Bus: "🚌",
  Auto: "🛺",
  Taxi: "🚕",
  Bike: "🏍️",
  Truck: "🚚",
  Ambulance: "🚑",
  Other: "🚗",
};

function timeAgo(iso: string | null): string {
  if (!iso) return "—";
  const diffMs = Date.now() - new Date(iso).getTime();
  const sec = Math.floor(diffMs / 1000);
  if (sec < 10) return "just now";
  if (sec < 60) return `${sec}s ago`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  return `${hr}h ago`;
}

export default function VehicleStatusScreen({ route, navigation }: any) {
  const { vehicleId }: { vehicleId: string } = route.params;
  const { token } = useAuth();
  const [status, setStatus] = useState<VehicleStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [watching, setWatching] = useState(false);
  const [togglingWatch, setTogglingWatch] = useState(false);
  const [refreshedAt, setRefreshedAt] = useState(Date.now());

  async function load() {
    try {
      const data = await vehicleApi.getStatus(vehicleId);
      setStatus(data);
    } catch (err) {
      console.warn(err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, [vehicleId]);

  // Re-render periodically so "time ago" labels stay fresh even without new data.
  useEffect(() => {
    const interval = setInterval(() => setRefreshedAt(Date.now()), 15000);
    return () => clearInterval(interval);
  }, []);

  useTrackingHub({
    onLocationUpdate: (update) => {
      if (update.vehicleId !== vehicleId) return;
      setStatus((prev) =>
        prev
          ? {
              ...prev,
              latitude: update.latitude,
              longitude: update.longitude,
              speedKmh: update.speedKmh,
              lastUpdatedAt: update.recordedAt,
              isActive: true,
            }
          : prev
      );
    },
    onVehicleStarted: (id) => {
      if (id === vehicleId) load();
    },
    onVehicleStopped: (id) => {
      if (id !== vehicleId) return;
      setStatus((prev) => (prev ? { ...prev, isActive: false } : prev));
    },
    onVehicleReachedDestination: (id) => {
      if (id === vehicleId) load();
    },
  });

  async function toggleWatch() {
    if (!token) {
      Alert.alert(
        "Log in to get alerts",
        "Create a free passenger account to get notified when this vehicle starts, stops, or reaches its destination."
      );
      return;
    }
    setTogglingWatch(true);
    try {
      if (watching) {
        await vehicleApi.unwatch(token, vehicleId);
        setWatching(false);
      } else {
        await vehicleApi.watch(token, vehicleId);
        const granted = await registerForPushNotifications(token);
        setWatching(true);
        Alert.alert(
          "You're set",
          granted
            ? "We'll notify you when this vehicle starts, stops, or arrives."
            : "You're watching this vehicle, but notifications are off. Enable notifications in your phone settings to get alerts."
        );
      }
    } catch (err) {
      Alert.alert("Could not update alert", String(err));
    } finally {
      setTogglingWatch(false);
    }
  }

  if (loading) {
    return (
      <SafeAreaView style={styles.center}>
        <ActivityIndicator size="large" color="#2563eb" />
      </SafeAreaView>
    );
  }

  if (!status) {
    return (
      <SafeAreaView style={styles.center}>
        <Text style={styles.notFoundIcon}>🔍</Text>
        <Text style={styles.notFoundText}>Vehicle not found</Text>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <Text style={styles.backButtonText}>Go back</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  const stops: RouteStop[] =
    status.stops.length > 0
      ? status.stops
      : ([
          status.fromLocation ? { name: status.fromLocation, latitude: null, longitude: null } : null,
          status.toLocation ? { name: status.toLocation, latitude: null, longitude: null } : null,
        ].filter(Boolean) as RouteStop[]);

  // Rough "current stop index" from distance covered isn't precise without per-stop
  // coordinates, so we show progress as: first stop always "departed", last stop
  // "reached" only once the vehicle is inactive after being active (trip complete),
  // and everything else as "upcoming" while active.
  const currentStopIndex = status.isActive ? Math.min(Math.floor(stops.length / 2), stops.length - 1) : -1;

  const routeCoordinates = stops
    .filter((s) => s.latitude != null && s.longitude != null)
    .map((s) => ({ latitude: s.latitude!, longitude: s.longitude! }));

  const mapRegion: Region | null = (() => {
    const points = [...routeCoordinates];
    if (status.latitude != null && status.longitude != null) {
      points.push({ latitude: status.latitude, longitude: status.longitude });
    }
    if (points.length === 0) return null;
    const lats = points.map((p) => p.latitude);
    const lngs = points.map((p) => p.longitude);
    const minLat = Math.min(...lats);
    const maxLat = Math.max(...lats);
    const minLng = Math.min(...lngs);
    const maxLng = Math.max(...lngs);
    return {
      latitude: (minLat + maxLat) / 2,
      longitude: (minLng + maxLng) / 2,
      latitudeDelta: Math.max(0.03, (maxLat - minLat) * 1.6),
      longitudeDelta: Math.max(0.03, (maxLng - minLng) * 1.6),
    };
  })();

  return (
    <SafeAreaView style={styles.container} edges={["top", "left", "right"]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backIcon}>
          <Text style={styles.backIconText}>←</Text>
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.regNumber}>{status.registrationNumber}</Text>
          <Text style={styles.vehicleTypeLabel}>
            {VEHICLE_ICONS[status.type] ?? "🚗"} {status.type}
          </Text>
        </View>
        <TouchableOpacity
          style={[styles.watchButton, watching && styles.watchButtonActive]}
          onPress={toggleWatch}
          disabled={togglingWatch}
        >
          {togglingWatch ? (
            <ActivityIndicator size="small" color={watching ? "#fff" : "#2563eb"} />
          ) : (
            <Text style={[styles.watchButtonText, watching && styles.watchButtonTextActive]}>
              {watching ? "🔔 Alerts on" : "🔔 Get alerts"}
            </Text>
          )}
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={[styles.statusBanner, status.isActive ? styles.statusBannerLive : styles.statusBannerIdle]}>
          <View style={[styles.statusDot, status.isActive && styles.statusDotLive]} />
          <View style={{ flex: 1 }}>
            <Text style={styles.statusBannerTitle}>
              {status.isActive ? "Live — on the move" : "Not currently tracking"}
            </Text>
            {status.isActive && (
              <Text style={styles.statusBannerSub}>
                Last update {timeAgo(status.lastUpdatedAt)}
                {status.speedKmh != null ? ` · ${Math.round(status.speedKmh)} km/h` : ""}
              </Text>
            )}
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardLabel}>Driver</Text>
          <Text style={styles.driverName}>{status.driverName}</Text>
        </View>

        {(status.fromLocation || status.toLocation) && (
          <View style={styles.card}>
            <Text style={styles.cardLabel}>Route</Text>
            <View style={styles.routeRow}>
              <Text style={styles.routeText}>{status.fromLocation ?? "—"}</Text>
              <Text style={styles.routeArrow}>→</Text>
              <Text style={styles.routeText}>{status.toLocation ?? "—"}</Text>
            </View>
          </View>
        )}

        {mapRegion && (
          <View style={[styles.card, styles.mapCard]}>
            <MapView style={styles.map} initialRegion={mapRegion} region={mapRegion}>
              {routeCoordinates.length > 1 && (
                <Polyline coordinates={routeCoordinates} strokeColor="#2563eb" strokeWidth={4} />
              )}
              {stops.map(
                (s, i) =>
                  s.latitude != null &&
                  s.longitude != null && (
                    <Marker
                      key={`${s.name}-${i}`}
                      coordinate={{ latitude: s.latitude, longitude: s.longitude }}
                      title={s.name}
                      pinColor={i === 0 ? "#16a34a" : i === stops.length - 1 ? "#dc2626" : "#2563eb"}
                    />
                  )
              )}
              {status.latitude != null && status.longitude != null && (
                <Marker
                  coordinate={{ latitude: status.latitude, longitude: status.longitude }}
                  title={`${VEHICLE_ICONS[status.type] ?? "🚗"} ${status.registrationNumber}`}
                >
                  <View style={styles.vehicleMapMarker}>
                    <Text style={styles.vehicleMapMarkerIcon}>{VEHICLE_ICONS[status.type] ?? "🚗"}</Text>
                  </View>
                </Marker>
              )}
            </MapView>
          </View>
        )}

        {stops.length > 0 && (
          <View style={styles.card}>
            <Text style={styles.cardLabel}>Stops</Text>
            {stops.map((stop, i) => {
              const isPast = status.isActive ? i < currentStopIndex : i < stops.length - 1;
              const isCurrent = status.isActive && i === currentStopIndex;
              return (
                <View key={`${stop.name}-${i}`} style={styles.stopRow}>
                  <View style={styles.stopTimelineCol}>
                    <View
                      style={[
                        styles.stopDot,
                        isPast && styles.stopDotPast,
                        isCurrent && styles.stopDotCurrent,
                      ]}
                    />
                    {i < stops.length - 1 && (
                      <View style={[styles.stopLine, isPast && styles.stopLinePast]} />
                    )}
                  </View>
                  <View style={styles.stopTextCol}>
                    <Text style={[styles.stopName, isCurrent && styles.stopNameCurrent]}>{stop.name}</Text>
                    {isCurrent && <Text style={styles.stopCurrentLabel}>Vehicle is near here</Text>}
                  </View>
                </View>
              );
            })}
          </View>
        )}

        <View style={styles.card}>
          <Text style={styles.cardLabel}>Trip details</Text>
          <View style={styles.detailRow}>
            <Text style={styles.detailKey}>Started</Text>
            <Text style={styles.detailValue}>
              {status.tripStartedAt ? new Date(status.tripStartedAt).toLocaleTimeString() : "—"}
            </Text>
          </View>
          <View style={styles.detailRow}>
            <Text style={styles.detailKey}>Distance covered</Text>
            <Text style={styles.detailValue}>
              {status.distanceCoveredKm != null ? `${status.distanceCoveredKm} km` : "—"}
            </Text>
          </View>
          <View style={styles.detailRow}>
            <Text style={styles.detailKey}>Current speed</Text>
            <Text style={styles.detailValue}>
              {status.speedKmh != null ? `${Math.round(status.speedKmh)} km/h` : "—"}
            </Text>
          </View>
        </View>

        <Text style={styles.privacyNote}>
          For driver safety, contact details aren't shown here.
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f8fafc" },
  center: { flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "#f8fafc", padding: 24 },
  notFoundIcon: { fontSize: 40, marginBottom: 10 },
  notFoundText: { fontSize: 16, color: "#475569", fontWeight: "600", marginBottom: 20 },
  backButton: { backgroundColor: "#2563eb", borderRadius: 10, paddingHorizontal: 20, paddingVertical: 10 },
  backButtonText: { color: "#fff", fontWeight: "600" },
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
  regNumber: { fontSize: 18, fontWeight: "700", color: "#1e293b" },
  vehicleTypeLabel: { fontSize: 13, color: "#64748b", marginTop: 2 },
  watchButton: {
    borderWidth: 1,
    borderColor: "#2563eb",
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 8,
    minWidth: 100,
    alignItems: "center",
  },
  watchButtonActive: { backgroundColor: "#2563eb" },
  watchButtonText: { color: "#2563eb", fontSize: 12, fontWeight: "600" },
  watchButtonTextActive: { color: "#fff" },
  scrollContent: { padding: 16, paddingBottom: 32 },
  statusBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderRadius: 14,
    padding: 16,
    marginBottom: 14,
  },
  statusBannerLive: { backgroundColor: "#dcfce7" },
  statusBannerIdle: { backgroundColor: "#f1f5f9" },
  statusDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: "#94a3b8" },
  statusDotLive: { backgroundColor: "#16a34a" },
  statusBannerTitle: { fontSize: 15, fontWeight: "700", color: "#1e293b" },
  statusBannerSub: { fontSize: 13, color: "#475569", marginTop: 2 },
  card: {
    backgroundColor: "#fff",
    borderRadius: 14,
    padding: 16,
    marginBottom: 14,
    elevation: 1,
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
  },
  cardLabel: {
    fontSize: 12,
    fontWeight: "700",
    color: "#94a3b8",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 10,
  },
  driverName: { fontSize: 17, fontWeight: "700", color: "#1e293b" },
  mapCard: { padding: 0, overflow: "hidden" },
  map: { width: "100%", height: 220 },
  vehicleMapMarker: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: "#fff",
    borderWidth: 2,
    borderColor: "#2563eb",
    alignItems: "center",
    justifyContent: "center",
  },
  vehicleMapMarkerIcon: { fontSize: 16 },
  routeRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  routeText: { fontSize: 15, fontWeight: "600", color: "#1e293b", flex: 1 },
  routeArrow: { fontSize: 16, color: "#2563eb" },
  stopRow: { flexDirection: "row" },
  stopTimelineCol: { width: 24, alignItems: "center" },
  stopDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: "#e2e8f0",
    borderWidth: 2,
    borderColor: "#cbd5e1",
  },
  stopDotPast: { backgroundColor: "#2563eb", borderColor: "#2563eb" },
  stopDotCurrent: { backgroundColor: "#16a34a", borderColor: "#16a34a" },
  stopLine: { width: 2, flex: 1, minHeight: 24, backgroundColor: "#e2e8f0" },
  stopLinePast: { backgroundColor: "#2563eb" },
  stopTextCol: { flex: 1, paddingBottom: 16, paddingLeft: 10 },
  stopName: { fontSize: 15, color: "#1e293b", fontWeight: "500" },
  stopNameCurrent: { fontWeight: "700", color: "#16a34a" },
  stopCurrentLabel: { fontSize: 12, color: "#16a34a", marginTop: 2 },
  detailRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 6 },
  detailKey: { fontSize: 14, color: "#64748b" },
  detailValue: { fontSize: 14, fontWeight: "600", color: "#1e293b" },
  privacyNote: { textAlign: "center", color: "#94a3b8", fontSize: 12, marginTop: 4 },
});
