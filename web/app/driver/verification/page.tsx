"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import Spinner from "../../../components/Spinner";
import { ApiError } from "../../../lib/api/client";
import { vehicleApi, verificationApi } from "../../../lib/api/endpoints";
import { useAuth } from "../../../lib/auth/AuthContext";
import { useToast } from "../../../lib/toast/ToastContext";
import { Vehicle, VerificationStatusInfo } from "../../../lib/types";

export default function DriverVerificationPage() {
  const { token, name, role, isLoading } = useAuth();
  const { showToast } = useToast();
  const router = useRouter();

  const [status, setStatus] = useState<VerificationStatusInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [submitting, setSubmitting] = useState(false);

  const [dateOfBirth, setDateOfBirth] = useState("");
  const [profilePhoto, setProfilePhoto] = useState<File | null>(null);
  const [dlPhoto, setDlPhoto] = useState<File | null>(null);
  const [aadhaarPhoto, setAadhaarPhoto] = useState<File | null>(null);
  const [rcPhoto, setRcPhoto] = useState<File | null>(null);

  useEffect(() => {
    if (!isLoading && (!token || role !== "Driver")) router.replace("/login");
  }, [isLoading, token, role, router]);

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
      showToast("Documents submitted — an admin will review them soon", "success");
    } catch (err) {
      showToast(err instanceof ApiError ? err.message : String(err), "error");
    } finally {
      setSubmitting(false);
    }
  }

  if (isLoading || loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-accent border-t-transparent" />
      </div>
    );
  }

  const vehicle = vehicles[0];

  return (
    <div className="min-h-screen bg-slate-50 pb-10">
      <div className="flex items-center gap-3 border-b border-slate-200 bg-white px-5 py-5">
        <Link href="/driver" className="p-1 text-2xl text-slate-800 transition hover:text-accent">
          ←
        </Link>
        <p className="text-xl font-extrabold text-slate-800">Driver verification</p>
      </div>

      <div className="mx-auto max-w-xl p-4">
        {status?.status === "Approved" && (
          <div className="mb-5 overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-slate-200">
            <div className="bg-accent px-5 py-3 text-center">
              <p className="text-[11px] font-bold uppercase tracking-wide text-white/90">
                Smart Phone Based Automatic Vehicle Detector
              </p>
              <p className="text-[13px] font-semibold text-white">Verified Driver ID</p>
            </div>
            <div className="flex items-center gap-4 p-5">
              {status.profilePhotoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={status.profilePhotoUrl} alt={name ?? "Driver"} className="h-20 w-20 rounded-xl object-cover" />
              ) : (
                <div className="flex h-20 w-20 items-center justify-center rounded-xl bg-slate-100 text-3xl">🪪</div>
              )}
              <div>
                <p className="text-lg font-extrabold text-slate-800">{name}</p>
                {status.dateOfBirth && (
                  <p className="text-[13px] text-slate-500">DOB: {new Date(status.dateOfBirth).toLocaleDateString()}</p>
                )}
                {vehicle && (
                  <p className="mt-1 text-[13px] font-semibold text-slate-700">
                    {vehicle.registrationNumber} · {vehicle.type}
                  </p>
                )}
              </div>
            </div>
          </div>
        )}

        {status?.status === "Pending" && (
          <div className="mb-5 rounded-2xl bg-amber-50 p-4 text-[13px] font-semibold text-amber-800 ring-1 ring-amber-200">
            Your documents are under review. You&apos;ll be notified once an admin responds.
          </div>
        )}

        {status?.status === "Rejected" && status.rejectionReason && (
          <div className="mb-5 rounded-2xl bg-red-50 p-4 text-[13px] font-semibold text-red-700 ring-1 ring-red-200">
            Not approved: {status.rejectionReason}. Please resubmit below.
          </div>
        )}

        {status?.status !== "Approved" && (
          <div className="flex flex-col gap-4 rounded-[14px] bg-white p-4 shadow-sm">
            <div>
              <label className="mb-1 block text-[13px] font-semibold text-slate-700">Date of birth</label>
              <input
                type="date"
                value={dateOfBirth}
                onChange={(e) => setDateOfBirth(e.target.value)}
                className="w-full rounded-[10px] border border-slate-200 bg-slate-50 p-3 text-[15px] text-slate-800 outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/20"
              />
            </div>

            <PhotoField label="Profile photo" value={profilePhoto} existingUrl={status?.profilePhotoUrl ?? null} onChange={setProfilePhoto} />
            <PhotoField label="Driving License (DL)" value={dlPhoto} existingUrl={status?.dlPhotoUrl ?? null} onChange={setDlPhoto} />
            <PhotoField label="Aadhaar card" value={aadhaarPhoto} existingUrl={status?.aadhaarPhotoUrl ?? null} onChange={setAadhaarPhoto} />
            <PhotoField label="Vehicle RC certificate" value={rcPhoto} existingUrl={status?.rcPhotoUrl ?? null} onChange={setRcPhoto} />

            <button
              onClick={handleSubmit}
              disabled={submitting}
              className="mt-1 flex min-h-[46px] items-center justify-center rounded-[10px] bg-accent text-sm font-bold text-white transition hover:bg-accent-dark disabled:opacity-60"
            >
              {submitting ? <Spinner className="h-4 w-4 border-2 border-white border-t-transparent" /> : "Submit for review"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function PhotoField({
  label,
  value,
  existingUrl,
  onChange,
}: {
  label: string;
  value: File | null;
  existingUrl: string | null;
  onChange: (file: File | null) => void;
}) {
  return (
    <div>
      <label className="mb-1 block text-[13px] font-semibold text-slate-700">{label}</label>
      {existingUrl && !value && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={existingUrl} alt={label} className="mb-2 h-24 w-full rounded-[10px] object-cover" />
      )}
      <input
        type="file"
        accept="image/*"
        onChange={(e) => onChange(e.target.files?.[0] ?? null)}
        className="block w-full text-[13px] text-slate-600 file:mr-3 file:rounded-[10px] file:border-0 file:bg-accent-light file:px-3 file:py-2 file:text-[13px] file:font-semibold file:text-accent-dark"
      />
    </div>
  );
}
