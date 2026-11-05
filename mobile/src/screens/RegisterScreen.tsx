import { LinearGradient } from "expo-linear-gradient";
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
import { UserRole } from "../types";

const ROLE_OPTIONS: { value: UserRole; label: string; icon: string }[] = [
  { value: "Passenger", label: "Passenger", icon: "🧑" },
  { value: "Driver", label: "Driver", icon: "🚐" },
];

export default function RegisterScreen({ navigation }: any) {
  const { signIn } = useAuth();
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<UserRole>("Passenger");
  const [loading, setLoading] = useState(false);

  async function handleRegister() {
    if (!name || !phone || !password) {
      Alert.alert("Missing fields", "All fields are required.");
      return;
    }
    setLoading(true);
    try {
      const auth = await authApi.register(name, phone, password, role);
      await signIn(auth);
    } catch (err) {
      const message = err instanceof ApiError ? err.message : "Registration failed.";
      Alert.alert("Registration failed", message);
    } finally {
      setLoading(false);
    }
  }

  const canSubmit = !!name && !!phone && !!password && !loading;

  return (
    <SafeAreaView style={styles.container} edges={["top", "left", "right", "bottom"]}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          <LinearGradient colors={["#1e3a8a", "#2563eb"]} style={styles.hero}>
            <TouchableOpacity
              style={styles.backIcon}
              onPress={() => navigation.goBack()}
              activeOpacity={0.7}
            >
              <Text style={styles.backIconText}>←</Text>
            </TouchableOpacity>
            <Text style={styles.heroIcon}>✨</Text>
            <Text style={styles.heroTitle}>Create Account</Text>
            <Text style={styles.heroSubtitle}>Join to track or share vehicle locations</Text>
          </LinearGradient>

          <View style={styles.formCard}>
            <Text style={styles.cardLabel}>I am a</Text>
            <View style={styles.roleRow}>
              {ROLE_OPTIONS.map((r) => (
                <TouchableOpacity
                  key={r.value}
                  style={[styles.roleButton, role === r.value && styles.roleButtonActive]}
                  onPress={() => setRole(r.value)}
                  activeOpacity={0.8}
                >
                  <Text style={styles.roleIcon}>{r.icon}</Text>
                  <Text style={role === r.value ? styles.roleTextActive : styles.roleText}>{r.label}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.cardLabel}>Full name</Text>
            <TextInput
              style={styles.input}
              placeholder="Your name"
              placeholderTextColor="#9ca3af"
              value={name}
              onChangeText={setName}
            />

            <Text style={styles.cardLabel}>Phone number</Text>
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
              placeholder="Choose a password"
              placeholderTextColor="#9ca3af"
              secureTextEntry
              value={password}
              onChangeText={setPassword}
            />

            <TouchableOpacity
              style={[styles.button, !canSubmit && styles.buttonDisabled]}
              onPress={handleRegister}
              disabled={!canSubmit}
              activeOpacity={0.85}
            >
              {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Create Account</Text>}
            </TouchableOpacity>

            <TouchableOpacity onPress={() => navigation.navigate("Login")} activeOpacity={0.7}>
              <Text style={styles.link}>
                Already have an account? <Text style={styles.linkBold}>Log in</Text>
              </Text>
            </TouchableOpacity>
          </View>
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
    paddingTop: 20,
    paddingBottom: 40,
    alignItems: "center",
    borderBottomLeftRadius: 28,
    borderBottomRightRadius: 28,
  },
  backIcon: {
    position: "absolute",
    top: 16,
    left: 16,
    padding: 8,
    zIndex: 1,
  },
  backIconText: { color: "#fff", fontSize: 22, fontWeight: "600" },
  heroIcon: { fontSize: 40, marginBottom: 8, marginTop: 20 },
  heroTitle: { color: "#fff", fontSize: 24, fontWeight: "800", letterSpacing: 0.3 },
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
  cardLabel: {
    fontSize: 12,
    fontWeight: "700",
    color: "#64748b",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 6,
    marginTop: 12,
  },
  roleRow: { flexDirection: "row", gap: 10 },
  roleButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    borderWidth: 1.5,
    borderColor: "#dbeafe",
    backgroundColor: "#eff6ff",
    borderRadius: 12,
    paddingVertical: 14,
  },
  roleButtonActive: { backgroundColor: "#2563eb", borderColor: "#2563eb" },
  roleIcon: { fontSize: 18 },
  roleText: { color: "#2563eb", fontWeight: "600", fontSize: 14 },
  roleTextActive: { color: "#fff", fontWeight: "700", fontSize: 14 },
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
});
