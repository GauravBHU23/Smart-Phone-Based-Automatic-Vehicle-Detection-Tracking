import * as Location from "expo-location";
import React, { useEffect, useState } from "react";
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { bookingApi, vehicleApi } from "../api/endpoints";
import { useTrackingHub } from "../api/useTrackingHub";
import { useAuth } from "../context/AuthContext";
import { estimateFare, formatDistance, haversineKm } from "../lib/fareEstimate";
import { Booking } from "../types";

const VEHICLE_ICONS: Record<string, string> = {
  Bus: "🚌",
  Auto: "🛺",
  Taxi: "🚕",
  Bike: "🏍️",
  Truck: "🚚",
  Ambulance: "🚑",
  Other: "🚗",
};

/**
 * Mounted once at the root of the Driver navigation stack so an incoming
 * ride request is actionable from whatever screen the driver is currently
 * on — matches Rapido/Ola's floating-card pattern. Pickup distance/fare
 * are only shown when the booking has real coordinates (a Nominatim-
 * geocoded pickup); a free-typed pickup simply omits those rows.
 */
export default function IncomingBookingPopup() {
  const { token } = useAuth();
  const [vehicleIds, setVehicleIds] = useState<string[]>([]);
  const [queue, setQueue] = useState<Booking[]>([]);
  const [driverCoords, setDriverCoords] = useState<{ latitude: number; longitude: number } | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!token) return;
    vehicleApi
      .myVehicles(token)
      .then((list) => setVehicleIds(list.map((v) => v.id)))
      .catch((err) => console.warn("Failed to load vehicles for booking popup:", err));
  }, [token]);

  useTrackingHub(
    {
      onLocationUpdate: () => {},
      onBookingRequested: async (booking) => {
        setQueue((prev) => (prev.some((b) => b.id === booking.id) ? prev : [...prev, booking]));
        try {
          const { status } = await Location.requestForegroundPermissionsAsync();
          if (status === "granted") {
            const loc = await Location.getCurrentPositionAsync({});
            setDriverCoords({ latitude: loc.coords.latitude, longitude: loc.coords.longitude });
          }
        } catch (err) {
          console.warn("Could not get driver location for distance estimate:", err);
        }
      },
      onBookingCancelled: (booking) => setQueue((prev) => prev.filter((b) => b.id !== booking.id)),
    },
    vehicleIds
  );

  if (queue.length === 0) return null;

  const booking = queue[0];
  const distanceKm =
    booking.fromLatitude != null && booking.fromLongitude != null && driverCoords
      ? haversineKm(driverCoords.latitude, driverCoords.longitude, booking.fromLatitude, booking.fromLongitude)
      : null;

  async function handleAccept() {
    if (!token) return;
    setBusy(true);
    try {
      await bookingApi.accept(token, booking.id);
      setQueue((prev) => prev.filter((b) => b.id !== booking.id));
    } catch {
      // Silently retry-able: the booking stays in the queue and the driver
      // can tap Accept again, or it'll be visible on the bookings list.
    } finally {
      setBusy(false);
    }
  }

  async function handleReject() {
    if (!token) return;
    setBusy(true);
    try {
      await bookingApi.reject(token, booking.id);
      setQueue((prev) => prev.filter((b) => b.id !== booking.id));
    } finally {
      setBusy(false);
    }
  }

  return (
    <SafeAreaView style={styles.overlay} edges={["top"]} pointerEvents="box-none">
      <View style={styles.card}>
        <View style={styles.topRow}>
          <View style={styles.vehicleRow}>
            <Text style={styles.vehicleIcon}>{VEHICLE_ICONS[booking.vehicleType] ?? "🚗"}</Text>
            <Text style={styles.vehicleReg}>{booking.vehicleRegistrationNumber}</Text>
          </View>
          {distanceKm != null && (
            <View style={styles.farePill}>
              <Text style={styles.fareText}>₹{estimateFare(distanceKm)}</Text>
              <Text style={styles.fareCashText}> (Cash)</Text>
            </View>
          )}
        </View>

        {distanceKm != null && (
          <View style={styles.distanceRow}>
            <View style={styles.distanceDot} />
            <Text style={styles.distanceText}>{formatDistance(distanceKm)} to pickup</Text>
          </View>
        )}

        {(booking.fromLocation || booking.toLocation) && (
          <Text style={styles.routeText}>
            📍 {booking.fromLocation ?? "—"} → {booking.toLocation ?? "—"}
          </Text>
        )}

        <Text style={styles.passengerText}>
          {booking.passengerName} · {booking.passengerPhone}
        </Text>

        <View style={styles.actionsRow}>
          <TouchableOpacity style={styles.rejectButton} onPress={handleReject} disabled={busy} activeOpacity={0.8}>
            <Text style={styles.rejectButtonText}>✕</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.acceptButton} onPress={handleAccept} disabled={busy} activeOpacity={0.85}>
            {busy ? <ActivityIndicator color="#fff" size="small" /> : <Text style={styles.acceptButtonText}>Accept</Text>}
          </TouchableOpacity>
        </View>

        {queue.length > 1 && <Text style={styles.moreText}>+{queue.length - 1} more waiting</Text>}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  overlay: {
    position: "absolute",
    left: 0,
    right: 0,
    top: 0,
    alignItems: "center",
    backgroundColor: "transparent",
  },
  card: {
    width: "92%",
    marginTop: 10,
    backgroundColor: "#fff",
    borderRadius: 18,
    padding: 16,
    elevation: 8,
    shadowColor: "#000",
    shadowOpacity: 0.2,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
  },
  topRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  vehicleRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  vehicleIcon: { fontSize: 20 },
  vehicleReg: { fontSize: 15, fontWeight: "700", color: "#1e293b" },
  farePill: { flexDirection: "row", alignItems: "baseline", backgroundColor: "#eff6ff", borderRadius: 10, paddingHorizontal: 10, paddingVertical: 5 },
  fareText: { fontSize: 15, fontWeight: "800", color: "#1e3a8a" },
  fareCashText: { fontSize: 10, fontWeight: "600", color: "#2563eb" },
  distanceRow: { flexDirection: "row", alignItems: "center", gap: 7, marginTop: 10 },
  distanceDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: "#16a34a" },
  distanceText: { fontSize: 13, color: "#475569" },
  routeText: { fontSize: 13, color: "#334155", fontWeight: "500", marginTop: 7 },
  passengerText: { fontSize: 12, color: "#64748b", marginTop: 5 },
  actionsRow: { flexDirection: "row", gap: 10, marginTop: 14 },
  rejectButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: "#cbd5e1",
    alignItems: "center",
    justifyContent: "center",
  },
  rejectButtonText: { fontSize: 17, fontWeight: "700", color: "#64748b" },
  acceptButton: {
    flex: 1,
    backgroundColor: "#2563eb",
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  acceptButtonText: { color: "#fff", fontWeight: "700", fontSize: 14 },
  moreText: { textAlign: "center", fontSize: 11, color: "#94a3b8", marginTop: 8 },
});
