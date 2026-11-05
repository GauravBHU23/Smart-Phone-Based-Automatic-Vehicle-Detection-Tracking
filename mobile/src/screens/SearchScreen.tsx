import React, { useState } from "react";
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { ApiError } from "../api/client";
import { vehicleApi } from "../api/endpoints";
import LogoutConfirmModal from "../components/LogoutConfirmModal";
import { useAuth } from "../context/AuthContext";

export default function SearchScreen({ navigation }: any) {
  const { token, name, signOut } = useAuth();
  const [regNumber, setRegNumber] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [logoutConfirmOpen, setLogoutConfirmOpen] = useState(false);

  async function handleSearch() {
    if (!regNumber.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const result = await vehicleApi.searchByRegistrationNumber(regNumber.trim());
      navigation.navigate("VehicleStatus", { vehicleId: result.id });
    } catch (err) {
      if (err instanceof ApiError && err.status === 404) {
        setError(`No vehicle found with number "${regNumber.trim().toUpperCase()}". Check the number and try again.`);
      } else {
        setError("Something went wrong. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <SafeAreaView style={styles.container} edges={["top", "left", "right"]}>
      {token && (
        <View style={styles.accountRow}>
          <Text style={styles.accountText}>Signed in as {name}</Text>
          <TouchableOpacity onPress={() => setLogoutConfirmOpen(true)}>
            <Text style={styles.accountLogout}>Log out</Text>
          </TouchableOpacity>
        </View>
      )}

      <View>
        <View style={styles.hero}>
          <Text style={styles.heroIcon}>🚌</Text>
          <Text style={styles.heroTitle}>Find any vehicle</Text>
          <Text style={styles.heroSubtitle}>
            Enter a bus, auto, taxi, or bike's registration number to see its live
            location, route, and status.
          </Text>
        </View>

        <View style={styles.searchBox}>
          <TextInput
            style={styles.input}
            placeholder="e.g. UP70AB1234"
            placeholderTextColor="#9ca3af"
            value={regNumber}
            onChangeText={(text) => {
              setRegNumber(text);
              setError(null);
            }}
            autoCapitalize="characters"
            autoCorrect={false}
            onSubmitEditing={handleSearch}
            returnKeyType="search"
          />
          <TouchableOpacity
            style={[styles.searchButton, (!regNumber.trim() || loading) && styles.searchButtonDisabled]}
            onPress={handleSearch}
            disabled={!regNumber.trim() || loading}
            activeOpacity={0.85}
          >
            {loading ? <ActivityIndicator color="#fff" size="small" /> : <Text style={styles.searchButtonText}>Search</Text>}
          </TouchableOpacity>
        </View>

        {error && (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}
      </View>

      <LogoutConfirmModal
        visible={logoutConfirmOpen}
        onCancel={() => setLogoutConfirmOpen(false)}
        onConfirm={() => {
          setLogoutConfirmOpen(false);
          signOut();
        }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f8fafc" },
  accountRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingTop: 12,
  },
  accountText: { fontSize: 13, color: "#64748b" },
  accountLogout: { fontSize: 13, color: "#dc2626", fontWeight: "600" },
  hero: { alignItems: "center", paddingTop: 20, paddingHorizontal: 32, marginBottom: 24 },
  heroIcon: { fontSize: 44, marginBottom: 12 },
  heroTitle: { fontSize: 22, fontWeight: "700", color: "#1e293b", marginBottom: 8 },
  heroSubtitle: { fontSize: 14, color: "#64748b", textAlign: "center", lineHeight: 20 },
  searchBox: { paddingHorizontal: 20, gap: 12 },
  input: {
    backgroundColor: "#fff",
    borderWidth: 1.5,
    borderColor: "#e2e8f0",
    borderRadius: 14,
    padding: 16,
    fontSize: 17,
    fontWeight: "600",
    color: "#1e293b",
    letterSpacing: 1,
  },
  searchButton: {
    backgroundColor: "#2563eb",
    borderRadius: 14,
    padding: 16,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 52,
  },
  searchButtonDisabled: { backgroundColor: "#cbd5e1" },
  searchButtonText: { color: "#fff", fontSize: 16, fontWeight: "700" },
  errorBox: {
    marginTop: 16,
    marginHorizontal: 20,
    backgroundColor: "#fef2f2",
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: "#fecaca",
  },
  errorText: { color: "#b91c1c", fontSize: 13 },
});
