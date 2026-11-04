import { LinearGradient } from "expo-linear-gradient";
import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { adminApi } from "../api/endpoints";
import { useAuth } from "../context/AuthContext";
import { AdminDriver, AdminStats, AdminVehicle } from "../types";

type Tab = "overview" | "drivers" | "vehicles";

export default function AdminScreen() {
  const { token, signOut } = useAuth();
  const [tab, setTab] = useState<Tab>("overview");
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [drivers, setDrivers] = useState<AdminDriver[]>([]);
  const [vehicles, setVehicles] = useState<AdminVehicle[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  const loadAll = useCallback(async () => {
    if (!token) return;
    try {
      const [statsRes, driversRes, vehiclesRes] = await Promise.all([
        adminApi.getStats(token),
        adminApi.getDrivers(token),
        adminApi.getVehicles(token),
      ]);
      setStats(statsRes);
      setDrivers(driversRes);
      setVehicles(vehiclesRes);
    } catch (err) {
      console.warn("Failed to load admin data:", err);
    }
  }, [token]);

  useEffect(() => {
    (async () => {
      setLoading(true);
      await loadAll();
      setLoading(false);
    })();
  }, [loadAll]);

  async function onRefresh() {
    setRefreshing(true);
    await loadAll();
    setRefreshing(false);
  }

  function confirmSignOut() {
    Alert.alert("Log out?", "", [
      { text: "Cancel", style: "cancel" },
      { text: "Log out", style: "destructive", onPress: signOut },
    ]);
  }

  async function toggleDriverSuspend(driver: AdminDriver) {
    if (!token) return;
    const action = driver.isSuspended ? "unsuspend" : "suspend";
    Alert.alert(
      driver.isSuspended ? "Unsuspend driver?" : "Suspend driver?",
      driver.isSuspended
        ? `${driver.name} will be able to log in and drive again.`
        : `${driver.name} will be logged out immediately and can't log in or drive until unsuspended.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: driver.isSuspended ? "Unsuspend" : "Suspend",
          style: driver.isSuspended ? "default" : "destructive",
          onPress: async () => {
            setBusyId(driver.id);
            try {
              if (driver.isSuspended) {
                await adminApi.unsuspendDriver(token, driver.id);
              } else {
                await adminApi.suspendDriver(token, driver.id);
              }
              await loadAll();
            } catch (err) {
              Alert.alert(`Could not ${action} driver`, String(err));
            } finally {
              setBusyId(null);
            }
          },
        },
      ]
    );
  }

  async function toggleVehicleSuspend(vehicle: AdminVehicle) {
    if (!token) return;
    const action = vehicle.isSuspended ? "unsuspend" : "suspend";
    Alert.alert(
      vehicle.isSuspended ? "Unsuspend vehicle?" : "Suspend vehicle?",
      vehicle.isSuspended
        ? `${vehicle.registrationNumber} will be trackable again.`
        : `${vehicle.registrationNumber} will stop sharing its location immediately and can't be started again until unsuspended.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: vehicle.isSuspended ? "Unsuspend" : "Suspend",
          style: vehicle.isSuspended ? "default" : "destructive",
          onPress: async () => {
            setBusyId(vehicle.id);
            try {
              if (vehicle.isSuspended) {
                await adminApi.unsuspendVehicle(token, vehicle.id);
              } else {
                await adminApi.suspendVehicle(token, vehicle.id);
              }
              await loadAll();
            } catch (err) {
              Alert.alert(`Could not ${action} vehicle`, String(err));
            } finally {
              setBusyId(null);
            }
          },
        },
      ]
    );
  }

  const filteredDrivers = drivers.filter(
    (d) => !search.trim() || d.name.toLowerCase().includes(search.toLowerCase()) || d.phone.includes(search)
  );
  const filteredVehicles = vehicles.filter(
    (v) =>
      !search.trim() ||
      v.registrationNumber.toLowerCase().includes(search.toLowerCase()) ||
      v.driverName.toLowerCase().includes(search.toLowerCase())
  );

  if (loading) {
    return (
      <SafeAreaView style={styles.center}>
        <ActivityIndicator size="large" color="#2563eb" />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={["top", "left", "right"]}>
      <LinearGradient colors={["#1e293b", "#334155"]} style={styles.header}>
        <View style={styles.headerTop}>
          <View>
            <Text style={styles.greeting}>Admin Panel</Text>
            <Text style={styles.title}>Fleet Overview</Text>
          </View>
          <TouchableOpacity style={styles.logoutButton} onPress={confirmSignOut} activeOpacity={0.7}>
            <Text style={styles.logout}>Log out</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.tabRow}>
          {(["overview", "drivers", "vehicles"] as Tab[]).map((t) => (
            <TouchableOpacity
              key={t}
              style={[styles.tabButton, tab === t && styles.tabButtonActive]}
              onPress={() => setTab(t)}
            >
              <Text style={[styles.tabText, tab === t && styles.tabTextActive]}>
                {t === "overview" ? "Overview" : t === "drivers" ? "Drivers" : "Vehicles"}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </LinearGradient>

      {tab === "overview" && stats && (
        <ScrollView
          contentContainerStyle={styles.statsGrid}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={["#2563eb"]} />}
        >
          <View style={styles.statsGridInner}>
            <StatCard label="Active now" value={stats.activeVehiclesNow} color="#16a34a" />
            <StatCard label="Total vehicles" value={stats.totalVehicles} color="#2563eb" />
            <StatCard label="Total drivers" value={stats.totalDrivers} color="#2563eb" />
            <StatCard label="Total passengers" value={stats.totalPassengers} color="#2563eb" />
            <StatCard label="Trips today" value={stats.tripsToday} color="#9333ea" />
            <StatCard label="Trips all-time" value={stats.tripsAllTime} color="#9333ea" />
            <StatCard label="Suspended drivers" value={stats.suspendedDrivers} color="#dc2626" />
            <StatCard label="Suspended vehicles" value={stats.suspendedVehicles} color="#dc2626" />
          </View>
        </ScrollView>
      )}

      {(tab === "drivers" || tab === "vehicles") && (
        <>
          <View style={styles.searchBox}>
            <TextInput
              style={styles.searchInput}
              placeholder={tab === "drivers" ? "Search by name or phone" : "Search by number or driver"}
              placeholderTextColor="#9ca3af"
              value={search}
              onChangeText={setSearch}
            />
          </View>

          {tab === "drivers" ? (
            <FlatList
              data={filteredDrivers}
              keyExtractor={(d) => d.id}
              contentContainerStyle={styles.listContent}
              refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={["#2563eb"]} />}
              renderItem={({ item }) => (
                <View style={[styles.row, item.isSuspended && styles.rowSuspended]}>
                  <View style={styles.rowInfo}>
                    <Text style={styles.rowTitle}>{item.name}</Text>
                    <Text style={styles.rowSub}>
                      {item.phone} · {item.vehicleCount} vehicle{item.vehicleCount === 1 ? "" : "s"}
                    </Text>
                    {item.isSuspended && <Text style={styles.suspendedLabel}>SUSPENDED</Text>}
                  </View>
                  <TouchableOpacity
                    style={[styles.actionButton, item.isSuspended ? styles.unsuspendButton : styles.suspendButton]}
                    onPress={() => toggleDriverSuspend(item)}
                    disabled={busyId === item.id}
                  >
                    {busyId === item.id ? (
                      <ActivityIndicator size="small" color="#fff" />
                    ) : (
                      <Text style={styles.actionButtonText}>{item.isSuspended ? "Unsuspend" : "Suspend"}</Text>
                    )}
                  </TouchableOpacity>
                </View>
              )}
              ListEmptyComponent={<Text style={styles.empty}>No drivers found.</Text>}
            />
          ) : (
            <FlatList
              data={filteredVehicles}
              keyExtractor={(v) => v.id}
              contentContainerStyle={styles.listContent}
              refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={["#2563eb"]} />}
              renderItem={({ item }) => (
                <View style={[styles.row, item.isSuspended && styles.rowSuspended]}>
                  <View style={styles.rowInfo}>
                    <Text style={styles.rowTitle}>{item.registrationNumber}</Text>
                    <Text style={styles.rowSub}>
                      {item.type} · {item.driverName}
                      {item.isActive ? " · live" : ""}
                    </Text>
                    {item.isSuspended && <Text style={styles.suspendedLabel}>SUSPENDED</Text>}
                  </View>
                  <TouchableOpacity
                    style={[styles.actionButton, item.isSuspended ? styles.unsuspendButton : styles.suspendButton]}
                    onPress={() => toggleVehicleSuspend(item)}
                    disabled={busyId === item.id}
                  >
                    {busyId === item.id ? (
                      <ActivityIndicator size="small" color="#fff" />
                    ) : (
                      <Text style={styles.actionButtonText}>{item.isSuspended ? "Unsuspend" : "Suspend"}</Text>
                    )}
                  </TouchableOpacity>
                </View>
              )}
              ListEmptyComponent={<Text style={styles.empty}>No vehicles found.</Text>}
            />
          )}
        </>
      )}
    </SafeAreaView>
  );
}

function StatCard({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <View style={styles.statCard}>
      <Text style={[styles.statValue, { color }]}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f8fafc" },
  center: { flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "#f8fafc" },
  header: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 16, borderBottomLeftRadius: 24, borderBottomRightRadius: 24 },
  headerTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16 },
  greeting: { color: "rgba(255,255,255,0.75)", fontSize: 13 },
  title: { color: "#fff", fontSize: 22, fontWeight: "700", marginTop: 2 },
  logoutButton: { backgroundColor: "rgba(255,255,255,0.15)", paddingHorizontal: 12, paddingVertical: 8, borderRadius: 20 },
  logout: { color: "#fff", fontWeight: "600", fontSize: 13 },
  tabRow: { flexDirection: "row", gap: 8 },
  tabButton: { flex: 1, paddingVertical: 8, borderRadius: 10, alignItems: "center", backgroundColor: "rgba(255,255,255,0.1)" },
  tabButtonActive: { backgroundColor: "#fff" },
  tabText: { color: "rgba(255,255,255,0.8)", fontSize: 13, fontWeight: "600" },
  tabTextActive: { color: "#1e293b" },
  statsGrid: { padding: 16 },
  statsGridInner: { flexDirection: "row", flexWrap: "wrap", gap: 12 },
  statCard: {
    flexBasis: "47%",
    backgroundColor: "#fff",
    borderRadius: 14,
    padding: 16,
    elevation: 1,
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
  },
  statValue: { fontSize: 28, fontWeight: "800" },
  statLabel: { fontSize: 13, color: "#64748b", marginTop: 4 },
  searchBox: { paddingHorizontal: 16, paddingTop: 14, paddingBottom: 8 },
  searchInput: {
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 10,
    padding: 12,
    fontSize: 14,
  },
  listContent: { paddingHorizontal: 16, paddingBottom: 24 },
  row: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
    padding: 14,
    borderRadius: 12,
    marginBottom: 10,
    elevation: 1,
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
  },
  rowSuspended: { borderWidth: 1.5, borderColor: "#fca5a5", backgroundColor: "#fef2f2" },
  rowInfo: { flex: 1 },
  rowTitle: { fontSize: 15, fontWeight: "700", color: "#1e293b" },
  rowSub: { fontSize: 13, color: "#64748b", marginTop: 2 },
  suspendedLabel: { fontSize: 11, fontWeight: "700", color: "#dc2626", marginTop: 4, letterSpacing: 0.5 },
  actionButton: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 8, minWidth: 90, alignItems: "center" },
  suspendButton: { backgroundColor: "#dc2626" },
  unsuspendButton: { backgroundColor: "#16a34a" },
  actionButtonText: { color: "#fff", fontWeight: "700", fontSize: 12 },
  empty: { textAlign: "center", color: "#94a3b8", marginTop: 40 },
});
