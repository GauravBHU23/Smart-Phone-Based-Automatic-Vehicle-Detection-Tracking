import React from "react";
import { Modal, StyleSheet, Text, TouchableOpacity, View } from "react-native";

export default function LogoutConfirmModal({
  visible,
  message,
  onCancel,
  onConfirm,
}: {
  visible: boolean;
  message?: string;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <View style={styles.overlay}>
        <View style={styles.card}>
          <View style={styles.iconWrap}>
            <Text style={styles.icon}>⏻</Text>
          </View>
          <Text style={styles.title}>Log out?</Text>
          <Text style={styles.subtitle}>
            {message ?? "You'll need to log in again to continue."}
          </Text>
          <View style={styles.buttonRow}>
            <TouchableOpacity style={styles.cancelButton} onPress={onCancel} activeOpacity={0.8}>
              <Text style={styles.cancelText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.logoutButton} onPress={onConfirm} activeOpacity={0.8}>
              <Text style={styles.logoutText}>Log out</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(15,23,42,0.5)",
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 32,
  },
  card: {
    backgroundColor: "#fff",
    borderRadius: 20,
    padding: 24,
    width: "100%",
    alignItems: "center",
    elevation: 6,
    shadowColor: "#000",
    shadowOpacity: 0.25,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
  },
  iconWrap: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: "#fef2f2",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 14,
  },
  icon: { fontSize: 24, color: "#dc2626" },
  title: { fontSize: 18, fontWeight: "800", color: "#1e293b", marginBottom: 6 },
  subtitle: { fontSize: 13, color: "#64748b", textAlign: "center", lineHeight: 19, marginBottom: 20 },
  buttonRow: { flexDirection: "row", gap: 10, width: "100%" },
  cancelButton: {
    flex: 1,
    paddingVertical: 13,
    borderRadius: 12,
    alignItems: "center",
    backgroundColor: "#f1f5f9",
  },
  cancelText: { color: "#334155", fontWeight: "700", fontSize: 14 },
  logoutButton: {
    flex: 1,
    paddingVertical: 13,
    borderRadius: 12,
    alignItems: "center",
    backgroundColor: "#dc2626",
  },
  logoutText: { color: "#fff", fontWeight: "700", fontSize: 14 },
});
