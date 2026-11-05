import React, { useState } from "react";
import {
  ActivityIndicator,
  FlatList,
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
import { RouteSearchResult } from "../types";

const VEHICLE_ICONS: Record<string, string> = {
  Bus: "🚌",
  Auto: "🛺",
  Taxi: "🚕",
  Bike: "🏍️",
  Truck: "🚚",
  Ambulance: "🚑",
  Other: "🚗",
};

type SearchMode = "number" | "route";

export default function SearchScreen({ navigation }: any) {
  const { token, name, signOut } = useAuth();
  const [mode, setMode] = useState<SearchMode>("number");
  const [regNumber, setRegNumber] = useState("");
  const [fromLocation, setFromLocation] = useState("");
  const [toLocation, setToLocation] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [routeResults, setRouteResults] = useState<RouteSearchResult[] | null>(null);
  const [logoutConfirmOpen, setLogoutConfirmOpen] = useState(false);

  function switchMode(next: SearchMode) {
    setMode(next);
    setError(null);
    setRouteResults(null);
  }

  async function handleSearchByNumber() {
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

  async function handleSearchByRoute() {
    if (!fromLocation.trim() || !toLocation.trim()) return;
    setLoading(true);
    setError(null);
    setRouteResults(null);
    try {
      const results = await vehicleApi.searchByRoute(fromLocation.trim(), toLocation.trim());
      setRouteResults(results);
      if (results.length === 0) {
        setError("No vehicles found on this route yet. Try different place names, or check back later.");
      }
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  const canSearchByNumber = !!regNumber.trim() && !loading;
  const canSearchByRoute = !!fromLocation.trim() && !!toLocation.trim() && !loading;

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

      <View style={styles.hero}>
        <Text style={styles.heroIcon}>🚌</Text>
        <Text style={styles.heroTitle}>Find any vehicle</Text>
      </View>

      <View style={styles.modeRow}>
        <TouchableOpacity
          style={[styles.modeTab, mode === "number" && styles.modeTabActive]}
          onPress={() => switchMode("number")}
          activeOpacity={0.8}
        >
          <Text style={mode === "number" ? styles.modeTabTextActive : styles.modeTabText}>By number</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.modeTab, mode === "route" && styles.modeTabActive]}
          onPress={() => switchMode("route")}
          activeOpacity={0.8}
        >
          <Text style={mode === "route" ? styles.modeTabTextActive : styles.modeTabText}>By route</Text>
        </TouchableOpacity>
      </View>

      {mode === "number" ? (
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
            onSubmitEditing={handleSearchByNumber}
            returnKeyType="search"
          />
          <TouchableOpacity
            style={[styles.searchButton, !canSearchByNumber && styles.searchButtonDisabled]}
            onPress={handleSearchByNumber}
            disabled={!canSearchByNumber}
            activeOpacity={0.85}
          >
            {loading ? <ActivityIndicator color="#fff" size="small" /> : <Text style={styles.searchButtonText}>Search</Text>}
          </TouchableOpacity>
        </View>
      ) : (
        <View style={styles.searchBox}>
          <View style={styles.routeInputRow}>
            <View style={styles.routeDotCol}>
              <View style={styles.routeDotFrom} />
              <View style={styles.routeDotLine} />
              <View style={styles.routeDotTo} />
            </View>
            <View style={styles.routeFieldCol}>
              <TextInput
                style={styles.routeInput}
                placeholder="From (e.g. Civil Lines)"
                placeholderTextColor="#9ca3af"
                value={fromLocation}
                onChangeText={(text) => {
                  setFromLocation(text);
                  setError(null);
                }}
              />
              <View style={styles.routeFieldDivider} />
              <TextInput
                style={styles.routeInput}
                placeholder="To (e.g. Naini)"
                placeholderTextColor="#9ca3af"
                value={toLocation}
                onChangeText={(text) => {
                  setToLocation(text);
                  setError(null);
                }}
                onSubmitEditing={handleSearchByRoute}
                returnKeyType="search"
              />
            </View>
          </View>
          <TouchableOpacity
            style={[styles.searchButton, !canSearchByRoute && styles.searchButtonDisabled]}
            onPress={handleSearchByRoute}
            disabled={!canSearchByRoute}
            activeOpacity={0.85}
          >
            {loading ? <ActivityIndicator color="#fff" size="small" /> : <Text style={styles.searchButtonText}>Find vehicles</Text>}
          </TouchableOpacity>
        </View>
      )}

      {error && (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}

      {mode === "route" && routeResults && routeResults.length > 0 && (
        <FlatList
          data={routeResults}
          keyExtractor={(v) => v.id}
          style={styles.resultsList}
          contentContainerStyle={styles.resultsListContent}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={styles.resultRow}
              onPress={() => navigation.navigate("VehicleStatus", { vehicleId: item.id })}
              activeOpacity={0.7}
            >
              <View style={styles.resultIconWrap}>
                <Text style={styles.resultIcon}>{VEHICLE_ICONS[item.type] ?? "🚗"}</Text>
              </View>
              <View style={styles.resultInfo}>
                <View style={styles.resultTopRow}>
                  <Text style={styles.resultReg}>{item.registrationNumber}</Text>
                  {item.isActive && (
                    <View style={styles.liveBadge}>
                      <View style={styles.liveDot} />
                      <Text style={styles.liveBadgeText}>LIVE</Text>
                    </View>
                  )}
                </View>
                <Text style={styles.resultRoute}>
                  {item.fromLocation ?? "—"} → {item.toLocation ?? "—"}
                </Text>
                <Text style={styles.resultDriver}>Driver: {item.driverName}</Text>
              </View>
              <Text style={styles.resultArrow}>›</Text>
            </TouchableOpacity>
          )}
        />
      )}

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
  hero: { alignItems: "center", paddingTop: 20, paddingHorizontal: 32, marginBottom: 16 },
  heroIcon: { fontSize: 40, marginBottom: 8 },
  heroTitle: { fontSize: 22, fontWeight: "700", color: "#1e293b" },
  modeRow: {
    flexDirection: "row",
    marginHorizontal: 20,
    marginBottom: 16,
    backgroundColor: "#eef2f7",
    borderRadius: 12,
    padding: 4,
    gap: 4,
  },
  modeTab: { flex: 1, paddingVertical: 9, borderRadius: 9, alignItems: "center" },
  modeTabActive: { backgroundColor: "#fff", elevation: 1, shadowColor: "#000", shadowOpacity: 0.08, shadowRadius: 4, shadowOffset: { width: 0, height: 1 } },
  modeTabText: { color: "#64748b", fontSize: 13, fontWeight: "600" },
  modeTabTextActive: { color: "#1e293b", fontSize: 13, fontWeight: "700" },
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
  routeInputRow: {
    flexDirection: "row",
    backgroundColor: "#fff",
    borderWidth: 1.5,
    borderColor: "#e2e8f0",
    borderRadius: 14,
    padding: 16,
  },
  routeDotCol: { width: 16, alignItems: "center", paddingTop: 8 },
  routeDotFrom: { width: 10, height: 10, borderRadius: 5, backgroundColor: "#16a34a" },
  routeDotLine: { width: 2, flex: 1, minHeight: 20, backgroundColor: "#cbd5e1", marginVertical: 4 },
  routeDotTo: { width: 10, height: 10, borderRadius: 5, backgroundColor: "#dc2626" },
  routeFieldCol: { flex: 1, marginLeft: 10 },
  routeInput: { fontSize: 15, fontWeight: "600", color: "#1e293b", paddingVertical: 8 },
  routeFieldDivider: { height: 1, backgroundColor: "#f1f5f9" },
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
  resultsList: { marginTop: 16 },
  resultsListContent: { paddingHorizontal: 20, paddingBottom: 16 },
  resultRow: {
    flexDirection: "row",
    alignItems: "center",
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
  resultIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#eff6ff",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  resultIcon: { fontSize: 20 },
  resultInfo: { flex: 1 },
  resultTopRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  resultReg: { fontSize: 15, fontWeight: "700", color: "#1e293b" },
  liveBadge: { flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: "#dcfce7", borderRadius: 8, paddingHorizontal: 6, paddingVertical: 2 },
  liveDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: "#16a34a" },
  liveBadgeText: { fontSize: 10, fontWeight: "800", color: "#16a34a", letterSpacing: 0.3 },
  resultRoute: { fontSize: 13, color: "#475569", marginTop: 3 },
  resultDriver: { fontSize: 12, color: "#94a3b8", marginTop: 2 },
  resultArrow: { fontSize: 22, color: "#cbd5e1" },
});
