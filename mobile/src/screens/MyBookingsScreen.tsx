import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { bookingApi } from "../api/endpoints";
import { useTrackingHub } from "../api/useTrackingHub";
import { useAuth } from "../context/AuthContext";
import { Booking, BookingStatus } from "../types";

const STATUS_COLORS: Record<BookingStatus, { bg: string; text: string }> = {
  Pending: { bg: "#fef3c7", text: "#92400e" },
  Accepted: { bg: "#dcfce7", text: "#16a34a" },
  Rejected: { bg: "#fee2e2", text: "#dc2626" },
  Cancelled: { bg: "#f1f5f9", text: "#64748b" },
  Completed: { bg: "#dbeafe", text: "#1d4ed8" },
};

function timeAgo(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const min = Math.floor(diffMs / 60000);
  if (min < 1) return "just now";
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  return `${Math.floor(hr / 24)}d ago`;
}

export default function MyBookingsScreen() {
  const { token, role } = useAuth();
  const isDriver = role === "Driver";
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  const loadBookings = useCallback(async () => {
    if (!token) return;
    try {
      const list = isDriver ? await bookingApi.driverList(token) : await bookingApi.mine(token);
      setBookings(list);
    } catch (err) {
      console.warn("Failed to load bookings:", err);
    } finally {
      setLoading(false);
    }
  }, [token, isDriver]);

  useEffect(() => {
    loadBookings();
  }, [loadBookings]);

  // Safety-net polling alongside SignalR, same pattern as the passenger map screen.
  useEffect(() => {
    const interval = setInterval(loadBookings, 15000);
    return () => clearInterval(interval);
  }, [loadBookings]);

  const vehicleIdsToWatch = isDriver ? Array.from(new Set(bookings.map((b) => b.vehicleId))) : [];

  useTrackingHub(
    {
      onLocationUpdate: () => {},
      onBookingRequested: (booking) => {
        if (isDriver) setBookings((prev) => [booking, ...prev.filter((b) => b.id !== booking.id)]);
      },
      onBookingAccepted: (booking) => setBookings((prev) => prev.map((b) => (b.id === booking.id ? booking : b))),
      onBookingRejected: (booking) => setBookings((prev) => prev.map((b) => (b.id === booking.id ? booking : b))),
      onBookingCancelled: (booking) => setBookings((prev) => prev.map((b) => (b.id === booking.id ? booking : b))),
    },
    vehicleIdsToWatch
  );

  async function onRefresh() {
    setRefreshing(true);
    await loadBookings();
    setRefreshing(false);
  }

  async function handleAccept(booking: Booking) {
    if (!token) return;
    setBusyId(booking.id);
    try {
      const updated = await bookingApi.accept(token, booking.id);
      setBookings((prev) => prev.map((b) => (b.id === updated.id ? updated : b)));
    } catch (err) {
      Alert.alert("Could not accept request", String(err));
      await loadBookings();
    } finally {
      setBusyId(null);
    }
  }

  async function handleReject(booking: Booking) {
    if (!token) return;
    setBusyId(booking.id);
    try {
      const updated = await bookingApi.reject(token, booking.id);
      setBookings((prev) => prev.map((b) => (b.id === updated.id ? updated : b)));
    } catch (err) {
      Alert.alert("Could not reject request", String(err));
      await loadBookings();
    } finally {
      setBusyId(null);
    }
  }

  function handleCancel(booking: Booking) {
    if (!token) return;
    Alert.alert("Cancel this request?", "The driver will no longer see this as a pending request.", [
      { text: "No", style: "cancel" },
      {
        text: "Yes, cancel",
        style: "destructive",
        onPress: async () => {
          setBusyId(booking.id);
          try {
            await bookingApi.cancel(token, booking.id);
            setBookings((prev) =>
              prev.map((b) => (b.id === booking.id ? { ...b, status: "Cancelled" as BookingStatus } : b))
            );
          } catch (err) {
            Alert.alert("Could not cancel request", String(err));
          } finally {
            setBusyId(null);
          }
        },
      },
    ]);
  }

  if (loading) {
    return (
      <SafeAreaView style={styles.center}>
        <ActivityIndicator size="large" color="#2563eb" />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={["top", "left", "right"]}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>{isDriver ? "Ride requests" : "My Bookings"}</Text>
      </View>

      <FlatList
        data={bookings}
        keyExtractor={(b) => b.id}
        contentContainerStyle={styles.listContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={["#2563eb"]} />}
        renderItem={({ item }) => {
          const colors = STATUS_COLORS[item.status];
          return (
            <View style={styles.card}>
              <View style={styles.cardTopRow}>
                <Text style={styles.vehicleReg}>{item.vehicleRegistrationNumber}</Text>
                <View style={[styles.statusPill, { backgroundColor: colors.bg }]}>
                  <Text style={[styles.statusPillText, { color: colors.text }]}>{item.status}</Text>
                </View>
              </View>
              {isDriver && (
                <Text style={styles.personLine}>
                  {item.passengerName} · {item.passengerPhone}
                </Text>
              )}
              {!isDriver && item.status === "Accepted" && item.driverPhone && (
                <Text style={styles.personLine}>Driver phone: {item.driverPhone}</Text>
              )}
              {(item.fromLocation || item.toLocation) && (
                <Text style={styles.routeLine}>
                  {item.fromLocation ?? "—"} → {item.toLocation ?? "—"}
                </Text>
              )}
              {item.note && <Text style={styles.noteLine}>&quot;{item.note}&quot;</Text>}
              <Text style={styles.timeLine}>
                {item.status === "Pending" ? "Requested" : "Responded"}{" "}
                {timeAgo(item.respondedAt ?? item.createdAt)}
              </Text>

              {item.status === "Pending" && isDriver && (
                <View style={styles.actionRow}>
                  <TouchableOpacity
                    style={[styles.actionButton, styles.rejectButton]}
                    onPress={() => handleReject(item)}
                    disabled={busyId === item.id}
                  >
                    {busyId === item.id ? (
                      <ActivityIndicator size="small" color="#fff" />
                    ) : (
                      <Text style={styles.actionButtonText}>Reject</Text>
                    )}
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.actionButton, styles.acceptButton]}
                    onPress={() => handleAccept(item)}
                    disabled={busyId === item.id}
                  >
                    {busyId === item.id ? (
                      <ActivityIndicator size="small" color="#fff" />
                    ) : (
                      <Text style={styles.actionButtonText}>Accept</Text>
                    )}
                  </TouchableOpacity>
                </View>
              )}

              {item.status === "Pending" && !isDriver && (
                <TouchableOpacity
                  style={[styles.actionButton, styles.cancelButton]}
                  onPress={() => handleCancel(item)}
                  disabled={busyId === item.id}
                >
                  {busyId === item.id ? (
                    <ActivityIndicator size="small" color="#dc2626" />
                  ) : (
                    <Text style={styles.cancelButtonText}>Cancel request</Text>
                  )}
                </TouchableOpacity>
              )}
            </View>
          );
        }}
        ListEmptyComponent={
          <View style={styles.emptyWrap}>
            <Text style={styles.emptyIcon}>📋</Text>
            <Text style={styles.empty}>{isDriver ? "No ride requests yet" : "No bookings yet"}</Text>
            <Text style={styles.emptySub}>
              {isDriver
                ? "Ride requests from passengers will show up here."
                : "Book a vehicle from its status page to see it here."}
            </Text>
          </View>
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f8fafc" },
  center: { flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "#f8fafc" },
  header: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 10 },
  headerTitle: { fontSize: 22, fontWeight: "800", color: "#1e293b" },
  listContent: { paddingHorizontal: 16, paddingBottom: 24 },
  card: {
    backgroundColor: "#fff",
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
    elevation: 1,
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
  },
  cardTopRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  vehicleReg: { fontSize: 16, fontWeight: "700", color: "#1e293b" },
  statusPill: { borderRadius: 10, paddingHorizontal: 10, paddingVertical: 4 },
  statusPillText: { fontSize: 11, fontWeight: "800", letterSpacing: 0.3 },
  personLine: { fontSize: 13, color: "#334155", marginTop: 6, fontWeight: "600" },
  routeLine: { fontSize: 13, color: "#475569", marginTop: 4 },
  noteLine: { fontSize: 12, color: "#64748b", marginTop: 4, fontStyle: "italic" },
  timeLine: { fontSize: 11, color: "#94a3b8", marginTop: 6 },
  actionRow: { flexDirection: "row", gap: 10, marginTop: 12 },
  actionButton: {
    flex: 1,
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 40,
  },
  acceptButton: { backgroundColor: "#16a34a" },
  rejectButton: { backgroundColor: "#dc2626" },
  actionButtonText: { color: "#fff", fontWeight: "700", fontSize: 13 },
  cancelButton: {
    marginTop: 12,
    backgroundColor: "#fef2f2",
    borderWidth: 1,
    borderColor: "#fecaca",
  },
  cancelButtonText: { color: "#dc2626", fontWeight: "700", fontSize: 13 },
  emptyWrap: { alignItems: "center", marginTop: 60, paddingHorizontal: 40 },
  emptyIcon: { fontSize: 40, marginBottom: 10 },
  empty: { textAlign: "center", color: "#475569", fontSize: 16, fontWeight: "600" },
  emptySub: { textAlign: "center", color: "#94a3b8", fontSize: 13, marginTop: 4 },
});
