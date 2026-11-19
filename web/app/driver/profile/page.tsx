"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import Spinner from "../../../components/Spinner";
import { ApiError } from "../../../lib/api/client";
import { authApi } from "../../../lib/api/endpoints";
import { useAuth } from "../../../lib/auth/AuthContext";
import { useToast } from "../../../lib/toast/ToastContext";

export default function DriverProfilePage() {
  const { token, name, phone, profilePhotoUrl, role, isLoading, signIn } = useAuth();
  const { showToast } = useToast();
  const router = useRouter();

  const [nameInput, setNameInput] = useState("");
  const [phoneInput, setPhoneInput] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPasswordFields, setShowPasswordFields] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);

  useEffect(() => {
    if (!isLoading && (!token || role !== "Driver")) router.replace("/login");
  }, [isLoading, token, role, router]);

  useEffect(() => {
    setNameInput(name ?? "");
    setPhoneInput(phone ?? "");
  }, [name, phone]);

  async function handlePhotoChange(file: File | null) {
    if (!token || !file) return;
    setUploadingPhoto(true);
    try {
      const updated = await authApi.uploadProfilePhoto(token, file);
      signIn(updated);
      showToast("Profile photo updated", "success");
    } catch (err) {
      showToast(err instanceof ApiError ? err.message : String(err), "error");
    } finally {
      setUploadingPhoto(false);
    }
  }

  async function handleSave() {
    if (!token) return;

    if (newPassword && newPassword !== confirmPassword) {
      showToast("New passwords don't match", "error");
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
      signIn(updated);
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setShowPasswordFields(false);
      showToast("Profile updated", "success");
    } catch (err) {
      showToast(err instanceof ApiError ? err.message : String(err), "error");
    } finally {
      setSaving(false);
    }
  }

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-accent border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 pb-10">
      <div className="flex items-center gap-3 border-b border-slate-200 bg-white px-5 py-5">
        <Link href="/driver" className="p-1 text-2xl text-slate-800 transition hover:text-accent">
          ←
        </Link>
        <p className="text-xl font-extrabold text-slate-800">Edit profile</p>
      </div>

      <div className="mx-auto max-w-xl p-4">
        <div className="flex flex-col items-center gap-3 rounded-[14px] bg-white p-5 shadow-sm">
          <div className="relative flex h-24 w-24 items-center justify-center overflow-hidden rounded-full bg-slate-100">
            {profilePhotoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={profilePhotoUrl} alt={name ?? "Profile"} className="h-full w-full object-cover" />
            ) : (
              <span className="text-4xl">👤</span>
            )}
            {uploadingPhoto && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/40">
                <Spinner className="h-5 w-5 border-2 border-white border-t-transparent" />
              </div>
            )}
          </div>
          <label className="cursor-pointer text-[13px] font-semibold text-accent hover:text-accent-dark">
            Change photo
            <input
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => handlePhotoChange(e.target.files?.[0] ?? null)}
            />
          </label>
        </div>

        <div className="mt-4 flex flex-col gap-4 rounded-[14px] bg-white p-4 shadow-sm">
          <div>
            <label className="mb-1 block text-[13px] font-semibold text-slate-700">Name</label>
            <input
              type="text"
              value={nameInput}
              onChange={(e) => setNameInput(e.target.value)}
              className="w-full rounded-[10px] border border-slate-200 bg-slate-50 p-3 text-[15px] text-slate-800 outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/20"
            />
          </div>

          <div>
            <label className="mb-1 block text-[13px] font-semibold text-slate-700">Phone</label>
            <input
              type="tel"
              value={phoneInput}
              onChange={(e) => setPhoneInput(e.target.value)}
              className="w-full rounded-[10px] border border-slate-200 bg-slate-50 p-3 text-[15px] text-slate-800 outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/20"
            />
          </div>

          {!showPasswordFields ? (
            <button
              onClick={() => setShowPasswordFields(true)}
              className="self-start text-[13px] font-semibold text-accent hover:text-accent-dark"
            >
              Change password
            </button>
          ) : (
            <div className="flex flex-col gap-3 rounded-[10px] border border-slate-100 bg-slate-50 p-3">
              <div>
                <label className="mb-1 block text-[13px] font-semibold text-slate-700">Current password</label>
                <input
                  type="password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  className="w-full rounded-[10px] border border-slate-200 bg-white p-3 text-[15px] text-slate-800 outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/20"
                />
              </div>
              <div>
                <label className="mb-1 block text-[13px] font-semibold text-slate-700">New password</label>
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="w-full rounded-[10px] border border-slate-200 bg-white p-3 text-[15px] text-slate-800 outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/20"
                />
              </div>
              <div>
                <label className="mb-1 block text-[13px] font-semibold text-slate-700">Confirm new password</label>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full rounded-[10px] border border-slate-200 bg-white p-3 text-[15px] text-slate-800 outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/20"
                />
              </div>
              <button
                onClick={() => {
                  setShowPasswordFields(false);
                  setCurrentPassword("");
                  setNewPassword("");
                  setConfirmPassword("");
                }}
                className="self-start text-[12px] font-semibold text-slate-500 hover:text-slate-700"
              >
                Cancel password change
              </button>
            </div>
          )}

          <button
            onClick={handleSave}
            disabled={saving}
            className="mt-1 flex min-h-[46px] items-center justify-center rounded-[10px] bg-accent text-sm font-bold text-white transition hover:bg-accent-dark disabled:opacity-60"
          >
            {saving ? <Spinner className="h-4 w-4 border-2 border-white border-t-transparent" /> : "Save changes"}
          </button>
        </div>
      </div>
    </div>
  );
}
