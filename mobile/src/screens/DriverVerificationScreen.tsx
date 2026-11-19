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
import { vehicleApi, verificationApi } from "../api/endpoints";
import { useAuth } from "../context/AuthContext";
import { DriverVerificationStatus, Vehicle, VerificationStatusInfo } from "../types";

type PickedPhoto = { uri: string; name: string; type: string };

async function pickPhoto(): Promise<PickedPhoto | null> {
  const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (status !== "granted") {
    Alert.alert("Permission needed", "Photo library access is needed to upload your document.");
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

export default function DriverVerificationScreen() {
  const { token, name } = useAuth();
  const navigation = useNavigation<any>();
  const [status, setStatus] = useState<VerificationStatusInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [submitting, setSubmitting] = useState(false);

  const [dateOfBirth, setDateOfBirth] = useState("");
  const [profilePhoto, setProfilePhoto] = useState<PickedPhoto | null>(null);
  const [dlPhoto, setDlPhoto] = useState<PickedPhoto | null>(null);
  const [aadhaarPhoto, setAadhaarPhoto] = useState<PickedPhoto | null>(null);
  const [rcPhoto, setRcPhoto] = useState<PickedPhoto | null>(null);

  useEffect(() => {
    if (!token) return;
    Promise.all([verificationApi.getStatus(token), vehicleApi.myVehicles(token)])
      .then(([statusRes, vehiclesRes]) => {
        setStatus(statusRes);
        setVehicles(vehiclesRes);
        if (statusRes.dateOfBirth) setDateOfBirth(statusRes.dateOfBirth.slice(0, 10));
      })
      .catch((err) => console.warn("Failed to load verification status:", err))
      .finally(() => setLoading(false));
  }, [token]);

  async function handleSubmit() {
    if (!token) return;
    setSubmitting(true);
    try {
      const updated = await verificationApi.submitDocuments(token, {
        dateOfBirth: dateOfBirth || undefined,
        profilePhoto: profilePhoto ?? undefined,
        dlPhoto: dlPhoto ?? undefined,
        aadhaarPhoto: aadhaarPhoto ?? undefined,
        rcPhoto: rcPhoto ?? undefined,
      });
      setStatus(updated);
      setProfilePhoto(null);
      setDlPhoto(null);
      setAadhaarPhoto(null);
      setRcPhoto(null);
      Alert.alert("Submitted", "An admin will review your documents soon.");
    } catch (err) {
      Alert.alert("Could not submit", String(err));
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <SafeAreaView style={styles.center}>
        <ActivityIndicator size="large" color="#2563eb" />
      </SafeAreaView>
    );
  }

  const vehicle = vehicles[0];

  return (
    <SafeAreaView style={styles.container} edges={["top", "left", "right"]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backIcon}>
          <Text style={styles.backIconText}>←</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Driver verification</Text>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {status?.status === "Approved" && (
          <View style={styles.idCard}>
            <View style={styles.idCardHeader}>
              <Text style={styles.idCardHeaderSmall}>Smart Phone Based Automatic Vehicle Detector</Text>
              <Text style={styles.idCardHeaderBig}>Verified Driver ID</Text>
            </View>
            <View style={styles.idCardBody}>
              {status.profilePhotoUrl ? (
                <Image source={{ uri: status.profilePhotoUrl }} style={styles.idPhoto} />
              ) : (
                <View style={styles.idPhotoPlaceholder}>
                  <Text style={{ fontSize: 28 }}>🪪</Text>
                </View>
              )}
              <View style={{ flex: 1 }}>
                <Text style={styles.idName}>{name}</Text>
                {status.dateOfBirth && <Text style={styles.idSub}>DOB: {new Date(status.dateOfBirth).toLocaleDateString()}</Text>}
                {vehicle && (
                  <Text style={styles.idVehicle}>
                    {vehicle.registrationNumber} · {vehicle.type}
                  </Text>
                )}
              </View>
            </View>
          </View>
        )}

        {status?.status === "Pending" && (
          <View style={styles.pendingBanner}>
            <Text style={styles.pendingBannerText}>Your documents are under review. You&apos;ll be notified once an admin responds.</Text>
          </View>
        )}

        {status?.status === "Rejected" && status.rejectionReason && (
          <View style={styles.rejectedBanner}>
            <Text style={styles.rejectedBannerText}>Not approved: {status.rejectionReason}. Please resubmit below.</Text>
          </View>
        )}

        {status?.status !== "Approved" && (
          <View style={styles.form}>
            <Text style={styles.label}>Date of birth (YYYY-MM-DD)</Text>
            <TextInput
              style={styles.input}
              value={dateOfBirth}
              onChangeText={setDateOfBirth}
              placeholder="1995-06-15"
              placeholderTextColor="#94a3b8"
            />

            <PhotoPicker label="Profile photo" photo={profilePhoto} existingUrl={status?.profilePhotoUrl ?? null} onPick={async () => setProfilePhoto(await pickPhoto())} />
            <PhotoPicker label="Driving License (DL)" photo={dlPhoto} existingUrl={status?.dlPhotoUrl ?? null} onPick={async () => setDlPhoto(await pickPhoto())} />
            <PhotoPicker label="Aadhaar card" photo={aadhaarPhoto} existingUrl={status?.aadhaarPhotoUrl ?? null} onPick={async () => setAadhaarPhoto(await pickPhoto())} />
            <PhotoPicker label="Vehicle RC certificate" photo={rcPhoto} existingUrl={status?.rcPhotoUrl ?? null} onPick={async () => setRcPhoto(await pickPhoto())} />

            <TouchableOpacity style={styles.submitButton} onPress={handleSubmit} disabled={submitting}>
              {submitting ? <ActivityIndicator size="small" color="#fff" /> : <Text style={styles.submitButtonText}>Submit for review</Text>}
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function PhotoPicker({
  label,
  photo,
  existingUrl,
  onPick,
}: {
  label: string;
  photo: PickedPhoto | null;
  existingUrl: string | null;
  onPick: () => void;
}) {
  const previewUri = photo?.uri ?? existingUrl ?? null;
  return (
    <View style={styles.photoField}>
      <Text style={styles.label}>{label}</Text>
      {previewUri && <Image source={{ uri: previewUri }} style={styles.photoPreview} />}
      <TouchableOpacity style={styles.photoButton} onPress={onPick}>
        <Text style={styles.photoButtonText}>{previewUri ? "Change photo" : "Choose photo"}</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f8fafc" },
  center: { flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "#f8fafc" },
  header: { flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: "#e2e8f0", backgroundColor: "#fff" },
  backIcon: { padding: 4 },
  backIconText: { fontSize: 22, color: "#1e293b" },
  headerTitle: { fontSize: 19, fontWeight: "800", color: "#1e293b" },
  content: { padding: 16, paddingBottom: 32 },
  idCard: { borderRadius: 18, overflow: "hidden", backgroundColor: "#fff", marginBottom: 18, elevation: 2, shadowColor: "#000", shadowOpacity: 0.08, shadowRadius: 8 },
  idCardHeader: { backgroundColor: "#2563eb", paddingVertical: 12, paddingHorizontal: 16, alignItems: "center" },
  idCardHeaderSmall: { color: "rgba(255,255,255,0.9)", fontSize: 10, fontWeight: "700", textTransform: "uppercase", letterSpacing: 0.4, textAlign: "center" },
  idCardHeaderBig: { color: "#fff", fontSize: 13, fontWeight: "700", marginTop: 2 },
  idCardBody: { flexDirection: "row", alignItems: "center", gap: 14, padding: 16 },
  idPhoto: { width: 80, height: 80, borderRadius: 12 },
  idPhotoPlaceholder: { width: 80, height: 80, borderRadius: 12, backgroundColor: "#f1f5f9", alignItems: "center", justifyContent: "center" },
  idName: { fontSize: 17, fontWeight: "800", color: "#1e293b" },
  idSub: { fontSize: 13, color: "#64748b", marginTop: 2 },
  idVehicle: { fontSize: 13, fontWeight: "700", color: "#334155", marginTop: 4 },
  pendingBanner: { backgroundColor: "#fef3c7", borderRadius: 14, padding: 14, marginBottom: 16 },
  pendingBannerText: { color: "#92400e", fontSize: 13, fontWeight: "600" },
  rejectedBanner: { backgroundColor: "#fee2e2", borderRadius: 14, padding: 14, marginBottom: 16 },
  rejectedBannerText: { color: "#b91c1c", fontSize: 13, fontWeight: "600" },
  form: { backgroundColor: "#fff", borderRadius: 14, padding: 16, gap: 14 },
  label: { fontSize: 13, fontWeight: "600", color: "#334155", marginBottom: 6 },
  input: { borderWidth: 1, borderColor: "#e2e8f0", backgroundColor: "#f8fafc", borderRadius: 10, padding: 13, fontSize: 15, color: "#1e293b" },
  photoField: {},
  photoPreview: { width: "100%", height: 110, borderRadius: 10, marginBottom: 8, backgroundColor: "#f1f5f9" },
  photoButton: { backgroundColor: "#eff6ff", borderRadius: 10, paddingVertical: 10, alignItems: "center" },
  photoButtonText: { color: "#1d4ed8", fontWeight: "700", fontSize: 13 },
  submitButton: { backgroundColor: "#2563eb", borderRadius: 10, paddingVertical: 14, alignItems: "center", marginTop: 4 },
  submitButtonText: { color: "#fff", fontWeight: "700", fontSize: 15 },
});
