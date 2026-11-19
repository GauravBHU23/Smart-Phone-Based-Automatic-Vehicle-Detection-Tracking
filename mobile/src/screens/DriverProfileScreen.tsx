import { useNavigation } from "@react-navigation/native";
import * as ImagePicker from "expo-image-picker";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
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

type PickedPhoto = { uri: string; name: string; type: string };

async function pickPhoto(): Promise<PickedPhoto | null> {
  const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (status !== "granted") {
    Alert.alert("Permission needed", "Photo library access is needed to choose a photo.");
    return null;
  }
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ImagePicker.MediaTypeOptions.Images,
    quality: 0.7,
  });
  if (result.canceled || !result.assets[0]) return null;
  const asset = result.assets[0];
  const fileName = asset.uri.split("/").pop() ?? "photo.jpg";
  return { uri: asset.uri, name: fileName, type: "image/jpeg" };
}

export default function DriverProfileScreen() {
  const { token, name, phone, profilePhotoUrl, signIn } = useAuth();
  const navigation = useNavigation<any>();

  const [nameInput, setNameInput] = useState(name ?? "");
  const [phoneInput, setPhoneInput] = useState(phone ?? "");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPasswordFields, setShowPasswordFields] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);

  useEffect(() => {
    setNameInput(name ?? "");
    setPhoneInput(phone ?? "");
  }, [name, phone]);

  async function handleChangePhoto() {
    if (!token) return;
    const photo = await pickPhoto();
    if (!photo) return;
    setUploadingPhoto(true);
    try {
      const updated = await authApi.uploadProfilePhoto(token, photo);
      await signIn(updated);
    } catch (err) {
      Alert.alert("Could not upload photo", String(err));
    } finally {
      setUploadingPhoto(false);
    }
  }

  async function handleSave() {
    if (!token) return;

    if (newPassword && newPassword !== confirmPassword) {
      Alert.alert("Passwords don't match", "New password and confirm password must be the same.");
      return;
    }

    setSaving(true);
    try {
      const updated = await authApi.updateProfile(token, {
        name: nameInput.trim() !== name ? nameInput.trim() : undefined,
        phone: phoneInput.trim() !== phone ? phoneInput.trim() : undefined,
        currentPassword: newPassword ? currentPassword : undefined,
        newPassword: newPassword || undefined,
      });
      await signIn(updated);
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setShowPasswordFields(false);
      Alert.alert("Saved", "Your profile has been updated.");
    } catch (err) {
      Alert.alert("Could not save changes", String(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <SafeAreaView style={styles.container} edges={["top", "left", "right"]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backIcon}>
          <Text style={styles.backIconText}>←</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Edit profile</Text>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.photoSection}>
          <View style={styles.avatarWrap}>
            {profilePhotoUrl ? (
              <Image source={{ uri: profilePhotoUrl }} style={styles.avatarImage} />
            ) : (
              <Text style={{ fontSize: 36 }}>👤</Text>
            )}
            {uploadingPhoto && (
              <View style={styles.avatarOverlay}>
                <ActivityIndicator size="small" color="#fff" />
              </View>
            )}
          </View>
          <TouchableOpacity onPress={handleChangePhoto} disabled={uploadingPhoto}>
            <Text style={styles.changePhotoText}>Change photo</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.form}>
          <Text style={styles.label}>Name</Text>
          <TextInput style={styles.input} value={nameInput} onChangeText={setNameInput} />

          <Text style={styles.label}>Phone</Text>
          <TextInput style={styles.input} value={phoneInput} onChangeText={setPhoneInput} keyboardType="phone-pad" />

          {!showPasswordFields ? (
            <TouchableOpacity onPress={() => setShowPasswordFields(true)}>
              <Text style={styles.linkText}>Change password</Text>
            </TouchableOpacity>
          ) : (
            <View style={styles.passwordBox}>
              <Text style={styles.label}>Current password</Text>
              <TextInput
                style={styles.input}
                value={currentPassword}
                onChangeText={setCurrentPassword}
                secureTextEntry
              />
              <Text style={styles.label}>New password</Text>
              <TextInput style={styles.input} value={newPassword} onChangeText={setNewPassword} secureTextEntry />
              <Text style={styles.label}>Confirm new password</Text>
              <TextInput
                style={styles.input}
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                secureTextEntry
              />
              <TouchableOpacity
                onPress={() => {
                  setShowPasswordFields(false);
                  setCurrentPassword("");
                  setNewPassword("");
                  setConfirmPassword("");
                }}
              >
                <Text style={styles.cancelText}>Cancel password change</Text>
              </TouchableOpacity>
            </View>
          )}

          <TouchableOpacity style={styles.saveButton} onPress={handleSave} disabled={saving}>
            {saving ? <ActivityIndicator size="small" color="#fff" /> : <Text style={styles.saveButtonText}>Save changes</Text>}
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f8fafc" },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: "#e2e8f0",
    backgroundColor: "#fff",
  },
  backIcon: { padding: 4 },
  backIconText: { fontSize: 22, color: "#1e293b" },
  headerTitle: { fontSize: 19, fontWeight: "800", color: "#1e293b" },
  content: { padding: 16, paddingBottom: 32 },
  photoSection: { alignItems: "center", gap: 8, backgroundColor: "#fff", borderRadius: 14, padding: 20, marginBottom: 16 },
  avatarWrap: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: "#f1f5f9",
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  avatarImage: { width: "100%", height: "100%" },
  avatarOverlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: "rgba(0,0,0,0.4)",
    alignItems: "center",
    justifyContent: "center",
  },
  changePhotoText: { color: "#2563eb", fontWeight: "700", fontSize: 13 },
  form: { backgroundColor: "#fff", borderRadius: 14, padding: 16, gap: 10 },
  label: { fontSize: 13, fontWeight: "600", color: "#334155", marginBottom: 4 },
  input: {
    borderWidth: 1,
    borderColor: "#e2e8f0",
    backgroundColor: "#f8fafc",
    borderRadius: 10,
    padding: 13,
    fontSize: 15,
    color: "#1e293b",
    marginBottom: 6,
  },
  linkText: { color: "#2563eb", fontWeight: "700", fontSize: 13, marginTop: 4 },
  cancelText: { color: "#64748b", fontWeight: "600", fontSize: 12, marginTop: 2 },
  passwordBox: { borderWidth: 1, borderColor: "#e2e8f0", backgroundColor: "#f8fafc", borderRadius: 10, padding: 12, marginTop: 4 },
  saveButton: { backgroundColor: "#2563eb", borderRadius: 10, paddingVertical: 14, alignItems: "center", marginTop: 8 },
  saveButtonText: { color: "#fff", fontWeight: "700", fontSize: 15 },
});
