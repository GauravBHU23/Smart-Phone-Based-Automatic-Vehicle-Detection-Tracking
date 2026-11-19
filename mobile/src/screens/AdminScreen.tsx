import { LinearGradient } from "expo-linear-gradient";
import { StatusBar } from "expo-status-bar";
import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  Modal,
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
import LogoutConfirmModal from "../components/LogoutConfirmModal";
import { useAuth } from "../context/AuthContext";
import { AdminDriver, AdminStats, AdminVehicle, Booking, BookingStatus } from "../types";

type Tab = "overview" | "drivers" | "vehicles" | "bookings" | "verifications";

const TAB_LABELS: Record<Tab, string> = {
  overview: "Overview",
  drivers: "Drivers",
  vehicles: "Vehicles",
  bookings: "Bookings",
  verifications: "Verify",
};

const STATUS_COLORS: Record<BookingStatus, { bg: string; text: string }> = {
  Pending: { bg: "#fef3c7", text: "#92400e" },
  Accepted: { bg: "#dcfce7", text: "#16a34a" },
  Rejected: { bg: "#fee2e2", text: "#dc2626" },
  Cancelled: { bg: "#f1f5f9", text: "#64748b" },
  Completed: { bg: "#dbeafe", text: "#1d4ed8" },
};

export default function AdminScreen() {
  const { token, signOut } = useAuth();
  const [tab, setTab] = useState<Tab>("overview");
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [drivers, setDrivers] = useState<AdminDriver[]>([]);
  const [vehicles, setVehicles] = useState<AdminVehicle[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [logoutConfirmOpen, setLogoutConfirmOpen] = useState(false);
  const [reviewDriver, setReviewDriver] = useState<AdminDriver | null>(null);
  const [showRejectInput, setShowRejectInput] = useState(false);
  const [rejectReason, setRejectReason] = useState("");

  const loadAll = useCallback(async () => {
    if (!token) return;
    try {
      const [statsRes, driversRes, vehiclesRes, bookingsRes] = await Promise.all([
        adminApi.getStats(token),
        adminApi.getDrivers(token),
        adminApi.getVehicles(token),
        adminApi.getBookings(token),
      ]);
      setStats(statsRes);
      setDrivers(driversRes);
      setVehicles(vehiclesRes);
      setBookings(bookingsRes);
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
    setLogoutConfirmOpen(true);
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

  async function handleApproveVerification() {
    if (!token || !reviewDriver) return;
    setBusyId(reviewDriver.id);
    try {
      await adminApi.approveVerification(token, reviewDriver.id);
      await loadAll();
      setReviewDriver(null);
    } catch (err) {
      Alert.alert("Could not approve", String(err));
    } finally {
      setBusyId(null);
    }
  }

  async function handleRejectVerification() {
    if (!token || !reviewDriver || !rejectReason.trim()) return;
    setBusyId(reviewDriver.id);
    try {
      await adminApi.rejectVerification(token, reviewDriver.id, rejectReason.trim());
      await loadAll();
      setReviewDriver(null);
      setShowRejectInput(false);
      setRejectReason("");
    } catch (err) {
      Alert.alert("Could not reject", String(err));
    } finally {
      setBusyId(null);
    }
  }

  const pendingVerifications = drivers.filter((d) => d.verificationStatus === "Pending");
  const filteredPendingVerifications = pendingVerifications.filter(
    (d) => !search.trim() || d.name.toLowerCase().includes(search.toLowerCase()) || d.phone.includes(search)
  );

  const filteredDrivers = drivers.filter(
    (d) => !search.trim() || d.name.toLowerCase().includes(search.toLowerCase()) || d.phone.includes(search)
  );
  const filteredVehicles = vehicles.filter(
    (v) =>
      !search.trim() ||
      v.registrationNumber.toLowerCase().includes(search.toLowerCase()) ||
      v.driverName.toLowerCase().includes(search.toLowerCase())
  );
  const filteredBookings = bookings.filter(
    (b) =>
      !search.trim() ||
      b.vehicleRegistrationNumber.toLowerCase().includes(search.toLowerCase()) ||
      b.passengerName.toLowerCase().includes(search.toLowerCase())
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
      <StatusBar style="dark" />
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
          {(["overview", "drivers", "vehicles", "bookings", "verifications"] as Tab[]).map((t) => (
            <TouchableOpacity
              key={t}
              style={[styles.tabButton, tab === t && styles.tabButtonActive]}
              onPress={() => setTab(t)}
            >
              <Text style={[styles.tabText, tab === t && styles.tabTextActive]}>
                {TAB_LABELS[t]}
                {t === "verifications" && pendingVerifications.length > 0 ? ` (${pendingVerifications.length})` : ""}
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
            <StatCard label="Total bookings" value={stats.totalBookings} color="#4f46e5" />
            <StatCard label="Pending bookings" value={stats.pendingBookings} color="#d97706" />
            <StatCard label="Completed rides" value={stats.completedRides} color="#2563eb" />
          </View>
        </ScrollView>
      )}

      {(tab === "drivers" || tab === "vehicles" || tab === "bookings" || tab === "verifications") && (
        <>
          <View style={styles.searchBox}>
            <TextInput
              style={styles.searchInput}
              placeholder={
                tab === "drivers" || tab === "verifications"
                  ? "Search by name or phone"
                  : tab === "vehicles"
                    ? "Search by number or driver"
                    : "Search by number or passenger"
              }
              placeholderTextColor="#9ca3af"
              value={search}
              onChangeText={setSearch}
            />
          </View>

          {tab === "verifications" ? (
            <FlatList
              data={filteredPendingVerifications}
              keyExtractor={(d) => d.id}
              contentContainerStyle={styles.listContent}
              refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={["#2563eb"]} />}
              renderItem={({ item }) => (
                <View style={styles.row}>
                  <View style={styles.rowInfo}>
                    <Text style={styles.rowTitle}>{item.name}</Text>
                    <Text style={styles.rowSub}>{item.phone}</Text>
                  </View>
                  <TouchableOpacity
                    style={[styles.actionButton, styles.reviewButton]}
                    onPress={() => setReviewDriver(item)}
                  >
                    <Text style={styles.actionButtonText}>Review</Text>
                  </TouchableOpacity>
                </View>
              )}
              ListEmptyComponent={<Text style={styles.empty}>No pending verifications.</Text>}
            />
          ) : tab === "drivers" ? (
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
          ) : tab === "vehicles" ? (
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
          ) : (
            <FlatList
              data={filteredBookings}
              keyExtractor={(b) => b.id}
              contentContainerStyle={styles.listContent}
              refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={["#2563eb"]} />}
              renderItem={({ item }) => {
                const colors = STATUS_COLORS[item.status];
                return (
                  <View style={styles.row}>
                    <View style={styles.rowInfo}>
                      <View style={styles.bookingTopRow}>
                        <Text style={styles.rowTitle}>{item.vehicleRegistrationNumber}</Text>
                        <View style={[styles.statusPill, { backgroundColor: colors.bg }]}>
                          <Text style={[styles.statusPillText, { color: colors.text }]}>{item.status}</Text>
                        </View>
                      </View>
                      <Text style={styles.rowSub}>
                        {item.passengerName} · {item.passengerPhone}
                      </Text>
                      {item.driverPhone && <Text style={styles.rowSub}>Driver: {item.driverPhone}</Text>}
                      {(item.fromLocation || item.toLocation) && (
                        <Text style={styles.rowSub}>
                          {item.fromLocation ?? "—"} → {item.toLocation ?? "—"}
                        </Text>
                      )}
                    </View>
                  </View>
                );
              }}
              ListEmptyComponent={<Text style={styles.empty}>No bookings found.</Text>}
            />
          )}
        </>
      )}

      <LogoutConfirmModal
        visible={logoutConfirmOpen}
        onCancel={() => setLogoutConfirmOpen(false)}
        onConfirm={() => {
          setLogoutConfirmOpen(false);
          signOut();
        }}
      />

      <Modal
        visible={reviewDriver !== null}
        transparent
        animationType="fade"
        onRequestClose={() => {
          setReviewDriver(null);
          setShowRejectInput(false);
          setRejectReason("");
        }}
      >
        <View style={styles.modalOverlay}>
          <ScrollView contentContainerStyle={styles.modalCard}>
            {reviewDriver && (
              <>
                <Text style={styles.modalTitle}>{reviewDriver.name}</Text>
                <Text style={styles.modalSub}>
                  {reviewDriver.phone}
                  {reviewDriver.dateOfBirth ? ` · DOB: ${new Date(reviewDriver.dateOfBirth).toLocaleDateString()}` : ""}
                </Text>

                <View style={styles.docGrid}>
                  <DocThumb label="Profile" url={reviewDriver.profilePhotoUrl} />
                  <DocThumb label="Driving License" url={reviewDriver.dlPhotoUrl} />
                  <DocThumb label="Aadhaar" url={reviewDriver.aadhaarPhotoUrl} />
                  <DocThumb label="RC certificate" url={reviewDriver.rcPhotoUrl} />
                </View>

                {showRejectInput ? (
                  <View style={{ marginTop: 16 }}>
                    <Text style={styles.label}>Reason for rejection</Text>
                    <TextInput
                      style={styles.searchInput}
                      value={rejectReason}
                      onChangeText={setRejectReason}
                      placeholder="e.g. DL photo is blurry"
                      placeholderTextColor="#9ca3af"
                    />
                    <View style={styles.modalActionsRow}>
                      <TouchableOpacity style={styles.modalSecondaryButton} onPress={() => setShowRejectInput(false)}>
                        <Text style={styles.modalSecondaryButtonText}>Back</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[styles.modalPrimaryButton, { backgroundColor: "#dc2626" }]}
                        onPress={handleRejectVerification}
                        disabled={!rejectReason.trim() || busyId === reviewDriver.id}
                      >
                        {busyId === reviewDriver.id ? (
                          <ActivityIndicator size="small" color="#fff" />
                        ) : (
                          <Text style={styles.modalPrimaryButtonText}>Confirm reject</Text>
                        )}
                      </TouchableOpacity>
                    </View>
                  </View>
                ) : (
                  <View style={styles.modalActionsRow}>
                    <TouchableOpacity
                      style={[styles.modalPrimaryButton, { backgroundColor: "#dc2626" }]}
                      onPress={() => setShowRejectInput(true)}
                      disabled={busyId === reviewDriver.id}
                    >
                      <Text style={styles.modalPrimaryButtonText}>Reject</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.modalPrimaryButton, { backgroundColor: "#16a34a" }]}
                      onPress={handleApproveVerification}
                      disabled={busyId === reviewDriver.id}
                    >
                      {busyId === reviewDriver.id ? (
                        <ActivityIndicator size="small" color="#fff" />
                      ) : (
                        <Text style={styles.modalPrimaryButtonText}>Approve</Text>
                      )}
                    </TouchableOpacity>
                  </View>
                )}
              </>
            )}
          </ScrollView>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

function DocThumb({ label, url }: { label: string; url: string | null }) {
  return (
    <View style={styles.docThumb}>
      <Text style={styles.docThumbLabel}>{label}</Text>
      {url ? (
        <Image source={{ uri: url }} style={styles.docThumbImage} />
      ) : (
        <View style={styles.docThumbPlaceholder}>
          <Text style={{ fontSize: 11, color: "#94a3b8" }}>Not uploaded</Text>
        </View>
      )}
    </View>
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
  bookingTopRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  statusPill: { borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 },
  statusPillText: { fontSize: 10, fontWeight: "800", letterSpacing: 0.3 },
  suspendedLabel: { fontSize: 11, fontWeight: "700", color: "#dc2626", marginTop: 4, letterSpacing: 0.5 },
  actionButton: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 8, minWidth: 90, alignItems: "center" },
  suspendButton: { backgroundColor: "#dc2626" },
  unsuspendButton: { backgroundColor: "#16a34a" },
  reviewButton: { backgroundColor: "#2563eb" },
  actionButtonText: { color: "#fff", fontWeight: "700", fontSize: 12 },
  empty: { textAlign: "center", color: "#94a3b8", marginTop: 40 },
  modalOverlay: { flex: 1, backgroundColor: "rgba(15,23,42,0.55)", justifyContent: "center", padding: 20 },
  modalCard: { backgroundColor: "#fff", borderRadius: 20, padding: 20 },
  modalTitle: { fontSize: 18, fontWeight: "800", color: "#1e293b" },
  modalSub: { fontSize: 13, color: "#64748b", marginTop: 2, marginBottom: 14 },
  label: { fontSize: 13, fontWeight: "600", color: "#334155", marginBottom: 6 },
  docGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  docThumb: { width: "47%" },
  docThumbLabel: { fontSize: 11, fontWeight: "600", color: "#64748b", marginBottom: 4 },
  docThumbImage: { width: "100%", height: 90, borderRadius: 10, backgroundColor: "#f1f5f9" },
  docThumbPlaceholder: { width: "100%", height: 90, borderRadius: 10, borderWidth: 1, borderColor: "#cbd5e1", borderStyle: "dashed", alignItems: "center", justifyContent: "center" },
  modalActionsRow: { flexDirection: "row", gap: 10, marginTop: 16 },
  modalPrimaryButton: { flex: 1, borderRadius: 12, paddingVertical: 13, alignItems: "center" },
  modalPrimaryButtonText: { color: "#fff", fontWeight: "700", fontSize: 14 },
  modalSecondaryButton: { flex: 1, borderRadius: 12, paddingVertical: 13, alignItems: "center", backgroundColor: "#f1f5f9" },
  modalSecondaryButtonText: { color: "#334155", fontWeight: "700", fontSize: 14 },
});
