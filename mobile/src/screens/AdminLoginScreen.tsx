import React, { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { StyleSheet } from "react-native";
import { ApiError } from "../api/client";
import { authApi } from "../api/endpoints";
import { useAuth } from "../context/AuthContext";

const ADMIN_PHONE = "9999999000";

export default function AdminLoginScreen({ navigation }: any) {
  const { signIn } = useAuth();
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleLogin() {
    if (!password) {
      Alert.alert("Missing password", "Password is required.");
      return;
    }
    setLoading(true);
    try {
      const auth = await authApi.login(ADMIN_PHONE, password);
      if (auth.role !== "Admin") {
        Alert.alert("Not an admin account", "This account is not an admin.");
        return;
      }
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
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <View style={styles.center}>
          <View style={styles.card}>
            <Text style={styles.icon}>🛡️</Text>
            <Text style={styles.title}>Admin Login</Text>
            <Text style={styles.subtitle}>Restricted access</Text>

            <Text style={styles.label}>Password</Text>
            <TextInput
              style={styles.input}
              placeholder="Enter admin password"
              placeholderTextColor="#64748b"
              secureTextEntry
              autoFocus
              value={password}
              onChangeText={setPassword}
            />

            <TouchableOpacity
              style={[styles.button, (!password || loading) && styles.buttonDisabled]}
              onPress={handleLogin}
              disabled={!password || loading}
              activeOpacity={0.85}
            >
              {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Log In</Text>}
            </TouchableOpacity>

            <TouchableOpacity onPress={() => navigation.navigate("Login")} activeOpacity={0.7}>
              <Text style={styles.backLink}>← Back to regular login</Text>
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0f172a" },
  flex: { flex: 1 },
  center: { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 24 },
  card: {
    width: "100%",
    maxWidth: 360,
    backgroundColor: "#1e293b",
    borderRadius: 18,
    padding: 24,
  },
  icon: { fontSize: 36, textAlign: "center", marginBottom: 6 },
  title: { color: "#fff", fontSize: 20, fontWeight: "800", textAlign: "center" },
  subtitle: { color: "#94a3b8", fontSize: 13, textAlign: "center", marginTop: 2, marginBottom: 20 },
  label: { fontSize: 12, fontWeight: "700", color: "#94a3b8", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 6 },
  input: {
    borderWidth: 1,
    borderColor: "#334155",
    backgroundColor: "#0f172a",
    borderRadius: 10,
    padding: 14,
    fontSize: 16,
    color: "#fff",
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
  buttonDisabled: { backgroundColor: "#334155" },
  buttonText: { color: "#fff", fontSize: 16, fontWeight: "700" },
  backLink: { color: "#64748b", textAlign: "center", marginTop: 18, fontSize: 13, fontWeight: "600" },
});
