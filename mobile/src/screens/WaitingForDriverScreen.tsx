import React, { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Alert, Animated, Easing, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { bookingApi } from "../api/endpoints";
import { useTrackingHub } from "../api/useTrackingHub";
import { useAuth } from "../context/AuthContext";
import { Booking } from "../types";

function formatElapsed(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

function RadarRing({ delayMs }: { delayMs: number }) {
  const anim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.delay(delayMs),
        Animated.timing(anim, { toValue: 1, duration: 2000, easing: Easing.out(Easing.ease), useNativeDriver: true }),
        Animated.timing(anim, { toValue: 0, duration: 0, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [anim, delayMs]);

  const scale = anim.interpolate({ inputRange: [0, 1], outputRange: [0.6, 1.8] });
  const opacity = anim.interpolate({ inputRange: [0, 1], outputRange: [0.7, 0] });

  return <Animated.View style={[styles.radarRing, { transform: [{ scale }], opacity }]} />;
}

export default function WaitingForDriverScreen({ route, navigation }: any) {
  const { bookingId }: { bookingId: string } = route.params;
  const { token } = useAuth();
  const [booking, setBooking] = useState<Booking | null>(null);
  const [loadingBooking, setLoadingBooking] = useState(true);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [cancelling, setCancelling] = useState(false);

  async function loadBooking() {
    if (!token) return;
    try {
      const list = await bookingApi.mine(token);
      const found = list.find((b) => b.id === bookingId);
      if (found) setBooking(found);
    } catch (err) {
      console.warn("Failed to load booking:", err);
    } finally {
      setLoadingBooking(false);
    }
  }

  useEffect(() => {
    loadBooking();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, bookingId]);

  // Real elapsed-time counter, not a fake countdown.
  useEffect(() => {
    const interval = setInterval(() => setElapsedSeconds((s) => s + 1), 1000);
    return () => clearInterval(interval);
  }, []);

  // Fallback polling alongside SignalR — a dropped connection must never
  // leave the passenger staring at a stale "searching" animation forever.
  useEffect(() => {
    const interval = setInterval(loadBooking, 5000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, bookingId]);

  useTrackingHub(
    {
      onLocationUpdate: () => {},
      onBookingAccepted: (b) => {
        if (b.id === bookingId) setBooking(b);
      },
      onBookingRejected: (b) => {
        if (b.id === bookingId) setBooking(b);
      },
      onBookingCancelled: (b) => {
        if (b.id === bookingId) setBooking(b);
      },
    },
    booking ? [booking.vehicleId] : []
  );

  function handleCancel() {
    if (!token || !booking) return;
    Alert.alert("Cancel this request?", "The driver will no longer see this as a pending request.", [
      { text: "No", style: "cancel" },
      {
        text: "Yes, cancel",
        style: "destructive",
        onPress: async () => {
          setCancelling(true);
          try {
            await bookingApi.cancel(token, booking.id);
            setBooking((prev) => (prev ? { ...prev, status: "Cancelled" } : prev));
          } catch (err) {
            Alert.alert("Could not cancel request", String(err));
          } finally {
            setCancelling(false);
          }
        },
      },
    ]);
  }

  if (loadingBooking) {
    return (
      <SafeAreaView style={styles.center}>
        <ActivityIndicator size="large" color="#2563eb" />
      </SafeAreaView>
    );
  }

  if (!booking) {
    return (
      <SafeAreaView style={styles.center}>
        <Text style={styles.notFoundIcon}>🔍</Text>
        <Text style={styles.notFoundText}>Booking not found</Text>
        <TouchableOpacity style={styles.primaryButton} onPress={() => navigation.navigate("MyBookings")}>
          <Text style={styles.primaryButtonText}>Go to my bookings</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  if (booking.status === "Pending") {
    return (
      <SafeAreaView style={styles.container} edges={["top", "left", "right", "bottom"]}>
        <View style={styles.center}>
          <View style={styles.radarWrap}>
            <RadarRing delayMs={0} />
            <RadarRing delayMs={600} />
            <RadarRing delayMs={1200} />
            <View style={styles.radarCenter}>
              <Text style={styles.radarCenterIcon}>🚖</Text>
            </View>
          </View>

          <Text style={styles.title}>Finding your driver…</Text>
          <Text style={styles.subtitle}>Searching for {formatElapsed(elapsedSeconds)}</Text>

          <View style={styles.infoCard}>
            <Text style={styles.infoReg}>{booking.vehicleRegistrationNumber}</Text>
            {(booking.fromLocation || booking.toLocation) && (
              <Text style={styles.infoRoute}>
                {booking.fromLocation ?? "—"} → {booking.toLocation ?? "—"}
              </Text>
            )}
          </View>

          <TouchableOpacity style={styles.cancelButton} onPress={handleCancel} disabled={cancelling} activeOpacity={0.8}>
            {cancelling ? (
              <ActivityIndicator size="small" color="#dc2626" />
            ) : (
              <Text style={styles.cancelButtonText}>Cancel request</Text>
            )}
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  if (booking.status === "Accepted" || booking.status === "Completed") {
    const rideStarted = booking.status === "Completed" || booking.otpVerified;
    return (
      <SafeAreaView style={styles.container} edges={["top", "left", "right", "bottom"]}>
        <View style={styles.center}>
          <View style={styles.successIconWrap}>
            <Text style={styles.successIcon}>✅</Text>
          </View>
          <Text style={styles.title}>{rideStarted ? "Ride in progress" : "Driver confirmed!"}</Text>
          <Text style={styles.subtitle}>
            {booking.vehicleRegistrationNumber} is on the way.
            {booking.driverPhone ? ` Call ${booking.driverPhone} to coordinate.` : ""}
          </Text>
          {!rideStarted && booking.otpCode && (
            <View style={styles.otpCard}>
              <Text style={styles.otpLabel}>Share this code with your driver to start the ride</Text>
              <Text style={styles.otpCode}>{booking.otpCode}</Text>
            </View>
          )}
          <View style={styles.buttonRow}>
            <TouchableOpacity
              style={styles.secondaryButton}
              onPress={() => navigation.navigate("VehicleStatus", { vehicleId: booking.vehicleId })}
            >
              <Text style={styles.secondaryButtonText}>Track live</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.primaryButton} onPress={() => navigation.navigate("MyBookings")}>
              <Text style={styles.primaryButtonText}>My bookings</Text>
            </TouchableOpacity>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={["top", "left", "right", "bottom"]}>
      <View style={styles.center}>
        <View style={styles.errorIconWrap}>
          <Text style={styles.errorIcon}>{booking.status === "Cancelled" ? "🚫" : "😕"}</Text>
        </View>
        <Text style={styles.title}>{booking.status === "Cancelled" ? "Request cancelled" : "Driver couldn't take this ride"}</Text>
        <Text style={styles.subtitle}>Try another vehicle, or search again.</Text>
        <TouchableOpacity style={styles.primaryButton} onPress={() => navigation.navigate("PublicSearch")}>
          <Text style={styles.primaryButtonText}>Try another vehicle</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f8fafc" },
  center: { flex: 1, justifyContent: "center", alignItems: "center", padding: 24 },
  notFoundIcon: { fontSize: 40, marginBottom: 10 },
  notFoundText: { fontSize: 16, color: "#475569", fontWeight: "600", marginBottom: 20 },
  radarWrap: { width: 160, height: 160, alignItems: "center", justifyContent: "center", marginBottom: 28 },
  radarRing: {
    position: "absolute",
    width: 160,
    height: 160,
    borderRadius: 80,
    backgroundColor: "rgba(37,99,235,0.2)",
  },
  radarCenter: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: "#2563eb",
    alignItems: "center",
    justifyContent: "center",
    elevation: 4,
    shadowColor: "#000",
    shadowOpacity: 0.2,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
  },
  radarCenterIcon: { fontSize: 36 },
  title: { fontSize: 20, fontWeight: "800", color: "#1e293b", marginBottom: 6, textAlign: "center" },
  subtitle: { fontSize: 14, color: "#64748b", marginBottom: 24, textAlign: "center" },
  infoCard: {
    width: "100%",
    maxWidth: 340,
    backgroundColor: "#fff",
    borderRadius: 14,
    padding: 16,
    elevation: 1,
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
  },
  infoReg: { fontSize: 15, fontWeight: "700", color: "#1e293b" },
  infoRoute: { fontSize: 13, color: "#64748b", marginTop: 4 },
  otpCard: {
    width: "100%",
    maxWidth: 340,
    backgroundColor: "#eff6ff",
    borderRadius: 14,
    padding: 16,
    alignItems: "center",
    marginBottom: 20,
  },
  otpLabel: { fontSize: 12, fontWeight: "600", color: "#1d4ed8", textAlign: "center" },
  otpCode: { fontSize: 28, fontWeight: "800", color: "#1e3a8a", letterSpacing: 6, marginTop: 4 },
  cancelButton: {
    marginTop: 32,
    borderWidth: 1,
    borderColor: "#fecaca",
    backgroundColor: "#fef2f2",
    borderRadius: 10,
    paddingHorizontal: 24,
    paddingVertical: 13,
    minWidth: 160,
    alignItems: "center",
  },
  cancelButtonText: { color: "#dc2626", fontWeight: "700", fontSize: 14 },
  successIconWrap: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: "#dcfce7",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 20,
  },
  successIcon: { fontSize: 36 },
  errorIconWrap: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: "#fee2e2",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 20,
  },
  errorIcon: { fontSize: 36 },
  buttonRow: { flexDirection: "row", gap: 12, marginTop: 8 },
  primaryButton: {
    backgroundColor: "#2563eb",
    borderRadius: 10,
    paddingHorizontal: 20,
    paddingVertical: 13,
    alignItems: "center",
  },
  primaryButtonText: { color: "#fff", fontWeight: "700", fontSize: 14 },
  secondaryButton: {
    borderWidth: 1.5,
    borderColor: "#2563eb",
    borderRadius: 10,
    paddingHorizontal: 20,
    paddingVertical: 13,
    alignItems: "center",
  },
  secondaryButtonText: { color: "#2563eb", fontWeight: "700", fontSize: 14 },
});
