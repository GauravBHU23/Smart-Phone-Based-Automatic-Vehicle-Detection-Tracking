import { LinearGradient } from "expo-linear-gradient";
import { StatusBar } from "expo-status-bar";
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
import { authApi } from "../api/endpoints";
import { useAuth } from "../context/AuthContext";
import { ApiError } from "../api/client";

export default function LoginScreen({ navigation }: any) {
  const { signIn } = useAuth();
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleLogin() {
    if (!phone || !password) {
      Alert.alert("Missing fields", "Phone and password are required.");
      return;
    }
    setLoading(true);
    try {
      const auth = await authApi.login(phone, password);
      await signIn(auth);
    } catch (err) {
      const message = err instanceof ApiError ? err.message : "Login failed.";
      Alert.alert("Login failed", message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <SafeAreaView style={styles.container} edges={["top", "left", "right", "bottom"]}>
      <StatusBar style="dark" />
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          <LinearGradient colors={["#1e3a8a", "#2563eb"]} style={styles.hero}>
            <Text style={styles.heroIcon}>🚐</Text>
            <Text style={styles.heroTitle}>Vehicle Tracking</Text>
            <Text style={styles.heroSubtitle}>Live location, real-time status, always on.</Text>
          </LinearGradient>

          <View style={styles.formCard}>
            <View style={styles.cardLabelRow}>
              <Text style={styles.cardLabel}>Phone number</Text>
              <TouchableOpacity onPress={() => setPhone("9999999000")}>
                <Text style={styles.adminLoginLink}>Admin login</Text>
              </TouchableOpacity>
            </View>
            <TextInput
              style={styles.input}
              placeholder="e.g. 9876543210"
              placeholderTextColor="#9ca3af"
              keyboardType="phone-pad"
              value={phone}
              onChangeText={setPhone}
              autoCapitalize="none"
            />

            <Text style={styles.cardLabel}>Password</Text>
            <TextInput
              style={styles.input}
              placeholder="Enter your password"
              placeholderTextColor="#9ca3af"
              secureTextEntry
              value={password}
              onChangeText={setPassword}
            />

            <TouchableOpacity
              style={[styles.button, (!phone || !password || loading) && styles.buttonDisabled]}
              onPress={handleLogin}
              disabled={!phone || !password || loading}
              activeOpacity={0.85}
            >
              {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Log In</Text>}
            </TouchableOpacity>

            <TouchableOpacity onPress={() => navigation.navigate("Register")} activeOpacity={0.7}>
              <Text style={styles.link}>Don't have an account? <Text style={styles.linkBold}>Register</Text></Text>
            </TouchableOpacity>
          </View>

          <View style={styles.divider}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>OR</Text>
            <View style={styles.dividerLine} />
          </View>

          <TouchableOpacity
            style={styles.searchLink}
            onPress={() => navigation.navigate("PublicSearch")}
            activeOpacity={0.85}
          >
            <Text style={styles.searchLinkIcon}>🚌</Text>
            <View style={styles.searchLinkTextWrap}>
              <Text style={styles.searchLinkTitle}>Track a vehicle</Text>
            </View>
            <Text style={styles.searchLinkArrow}>→</Text>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f8fafc" },
  flex: { flex: 1 },
  scrollContent: { flexGrow: 1, paddingBottom: 32 },
  hero: {
    paddingTop: 48,
    paddingBottom: 40,
    alignItems: "center",
    borderBottomLeftRadius: 28,
    borderBottomRightRadius: 28,
  },
  heroIcon: { fontSize: 44, marginBottom: 8 },
  heroTitle: { color: "#fff", fontSize: 26, fontWeight: "800", letterSpacing: 0.3 },
  heroSubtitle: { color: "rgba(255,255,255,0.85)", fontSize: 13, marginTop: 6 },
  formCard: {
    backgroundColor: "#fff",
    marginHorizontal: 20,
    marginTop: -24,
    borderRadius: 18,
    padding: 20,
    elevation: 3,
    shadowColor: "#000",
    shadowOpacity: 0.08,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
  },
  cardLabelRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 12 },
  cardLabel: {
    fontSize: 12,
    fontWeight: "700",
    color: "#64748b",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 6,
  },
  adminLoginLink: { fontSize: 12, fontWeight: "700", color: "#2563eb" },
  input: {
    borderWidth: 1,
    borderColor: "#e2e8f0",
    backgroundColor: "#f8fafc",
    borderRadius: 10,
    padding: 14,
    fontSize: 16,
    color: "#1e293b",
  },
  button: {
    backgroundColor: "#2563eb",
    borderRadius: 10,
    padding: 15,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 50,
    marginTop: 20,
  },
  buttonDisabled: { backgroundColor: "#cbd5e1" },
  buttonText: { color: "#fff", fontSize: 16, fontWeight: "700" },
  link: { color: "#64748b", textAlign: "center", marginTop: 16, fontSize: 14 },
  linkBold: { color: "#2563eb", fontWeight: "700" },
  divider: { flexDirection: "row", alignItems: "center", marginHorizontal: 20, marginTop: 24, marginBottom: 16, gap: 10 },
  dividerLine: { flex: 1, height: 1, backgroundColor: "#e2e8f0" },
  dividerText: { color: "#94a3b8", fontSize: 12, fontWeight: "600" },
  searchLink: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#eff6ff",
    borderRadius: 14,
    padding: 16,
    marginHorizontal: 20,
    borderWidth: 1,
    borderColor: "#dbeafe",
  },
  searchLinkIcon: { fontSize: 24, marginRight: 12 },
  searchLinkTextWrap: { flex: 1 },
  searchLinkTitle: { color: "#1e3a8a", fontWeight: "700", fontSize: 14 },
  searchLinkArrow: { color: "#2563eb", fontSize: 18, fontWeight: "700", marginLeft: 8 },
});
