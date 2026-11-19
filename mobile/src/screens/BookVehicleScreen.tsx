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
import { useAuth } from "../context/AuthContext";

export default function BookVehicleScreen({ route, navigation }: any) {
  const {
    vehicleId,
    registrationNumber,
    fromLocation: initialFrom,
    toLocation: initialTo,
  }: { vehicleId: string; registrationNumber?: string; fromLocation?: string | null; toLocation?: string | null } =
    route.params;
  const { token } = useAuth();
  const [fromLocation, setFromLocation] = useState(initialFrom ?? "");
  const [toLocation, setToLocation] = useState(initialTo ?? "");
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit() {
    if (!token) return;
    setSubmitting(true);
    try {
      const booking = await vehicleApi.createBooking(token, vehicleId, {
        fromLocation: fromLocation.trim() || undefined,
        toLocation: toLocation.trim() || undefined,
        note: note.trim() || undefined,
      });
      Alert.alert(
        booking.status === "Pending" ? "Request sent" : "Request already pending",
        booking.status === "Pending"
          ? "We've sent your ride request to the driver. You'll be notified when they respond."
          : "You already have a pending request on this vehicle.",
        [{ text: "OK", onPress: () => navigation.navigate("MyBookings") }]
      );
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        Alert.alert("Request already pending", "You already have a pending request on this vehicle.", [
          { text: "OK", onPress: () => navigation.navigate("MyBookings") },
        ]);
        return;
      }
      const message = err instanceof ApiError ? err.message : String(err);
      Alert.alert("Could not send request", message);
    } finally {
      setSubmitting(false);
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
            <Text style={styles.title}>Book a ride</Text>
            {registrationNumber && <Text style={styles.subtitle}>{registrationNumber}</Text>}
          </View>
        </View>

        <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
          <Text style={styles.cardLabel}>From</Text>
          <TextInput
            style={styles.input}
            placeholder="Pickup location"
            placeholderTextColor="#9ca3af"
            value={fromLocation}
            onChangeText={setFromLocation}
          />

          <Text style={styles.cardLabel}>To</Text>
          <TextInput
            style={styles.input}
            placeholder="Drop-off location"
            placeholderTextColor="#9ca3af"
            value={toLocation}
            onChangeText={setToLocation}
          />

          <Text style={styles.cardLabel}>Note (optional)</Text>
          <TextInput
            style={[styles.input, styles.noteInput]}
            placeholder="e.g. Waiting near the main gate"
            placeholderTextColor="#9ca3af"
            value={note}
            onChangeText={setNote}
            multiline
          />

          <TouchableOpacity
            style={[styles.submitButton, submitting && styles.submitButtonDisabled]}
            onPress={handleSubmit}
            disabled={submitting}
            activeOpacity={0.85}
          >
            {submitting ? <ActivityIndicator color="#fff" /> : <Text style={styles.submitButtonText}>Send request</Text>}
          </TouchableOpacity>

          <Text style={styles.hint}>
            The driver will see your name and phone number so they can coordinate the ride.
          </Text>
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
    marginTop: 14,
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
  noteInput: { minHeight: 80, textAlignVertical: "top" },
  submitButton: {
    backgroundColor: "#2563eb",
    borderRadius: 10,
    padding: 15,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 50,
    marginTop: 24,
  },
  submitButtonDisabled: { backgroundColor: "#cbd5e1" },
  submitButtonText: { color: "#fff", fontSize: 16, fontWeight: "700" },
  hint: { fontSize: 12, color: "#94a3b8", marginTop: 14, textAlign: "center", lineHeight: 17 },
});
