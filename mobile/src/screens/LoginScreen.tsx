import React, { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
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
    <View style={styles.container}>
      <Text style={styles.title}>Vehicle Tracking</Text>
      <TextInput
        style={styles.input}
        placeholder="Phone number"
        placeholderTextColor="#888"
        keyboardType="phone-pad"
        value={phone}
        onChangeText={setPhone}
        autoCapitalize="none"
      />
      <TextInput
        style={styles.input}
        placeholder="Password"
        placeholderTextColor="#888"
        secureTextEntry
        value={password}
        onChangeText={setPassword}
      />
      <TouchableOpacity style={styles.button} onPress={handleLogin} disabled={loading}>
        {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Log In</Text>}
      </TouchableOpacity>
      <TouchableOpacity onPress={() => navigation.navigate("Register")}>
        <Text style={styles.link}>Don't have an account? Register</Text>
      </TouchableOpacity>

      <View style={styles.divider} />

      <TouchableOpacity style={styles.searchLink} onPress={() => navigation.navigate("PublicSearch")}>
        <Text style={styles.searchLinkText}>🔍 Just want to track a vehicle? Search without an account</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: "center", padding: 24, backgroundColor: "#fff" },
  title: { fontSize: 28, fontWeight: "700", marginBottom: 32, textAlign: "center" },
  input: {
    borderWidth: 1,
    borderColor: "#ccc",
    borderRadius: 8,
    padding: 14,
    marginBottom: 14,
    fontSize: 16,
    color: "#111",
  },
  button: {
    backgroundColor: "#2563eb",
    borderRadius: 8,
    padding: 16,
    alignItems: "center",
    marginTop: 8,
  },
  buttonText: { color: "#fff", fontSize: 16, fontWeight: "600" },
  link: { color: "#2563eb", textAlign: "center", marginTop: 20 },
  divider: { height: 1, backgroundColor: "#eee", marginTop: 28, marginBottom: 20 },
  searchLink: {
    backgroundColor: "#eff6ff",
    borderRadius: 12,
    padding: 14,
  },
  searchLinkText: { color: "#1e3a8a", textAlign: "center", fontWeight: "600", fontSize: 14 },
});
