"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import Spinner from "../../../../components/Spinner";
import { ApiError } from "../../../../lib/api/client";
import { vehicleApi } from "../../../../lib/api/endpoints";
import { useAuth } from "../../../../lib/auth/AuthContext";
import { useToast } from "../../../../lib/toast/ToastContext";
import { VehicleStatus } from "../../../../lib/types";

export default function BookVehiclePage() {
  const { id: vehicleId } = useParams<{ id: string }>();
  const router = useRouter();
  const { token, role, isLoading } = useAuth();
  const { showToast } = useToast();
  const [status, setStatus] = useState<VehicleStatus | null>(null);
  const [loadingStatus, setLoadingStatus] = useState(true);
  const [fromLocation, setFromLocation] = useState("");
  const [toLocation, setToLocation] = useState("");
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!isLoading && (!token || role !== "Passenger")) router.replace("/login");
  }, [isLoading, token, role, router]);

  useEffect(() => {
    vehicleApi
      .getStatus(vehicleId)
      .then((data) => {
        setStatus(data);
        setFromLocation(data.fromLocation ?? "");
        setToLocation(data.toLocation ?? "");
      })
      .catch((err) => console.warn(err))
      .finally(() => setLoadingStatus(false));
  }, [vehicleId]);

  async function handleSubmit() {
    if (!token) return;
    setSubmitting(true);
    try {
      const booking = await vehicleApi.createBooking(token, vehicleId, {
        fromLocation: fromLocation.trim() || undefined,
        toLocation: toLocation.trim() || undefined,
        note: note.trim() || undefined,
      });
      showToast(
        booking.status === "Pending" ? "Ride request sent!" : "You already have a pending request on this vehicle",
        booking.status === "Pending" ? "success" : "info"
      );
      router.push("/passenger/bookings");
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        showToast("You already have a pending request on this vehicle", "info");
        router.push("/passenger/bookings");
        return;
      }
      showToast(err instanceof ApiError ? err.message : String(err), "error");
    } finally {
      setSubmitting(false);
    }
  }

  if (isLoading || loadingStatus) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-accent border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 pb-10">
      <div className="flex items-center gap-3 border-b border-slate-200 bg-white px-4 py-3">
        <Link href={`/vehicle/${vehicleId}`} className="p-1.5 text-2xl text-slate-800">
          ←
        </Link>
        <div>
          <p className="text-lg font-bold text-slate-800">Book a ride</p>
          {status && <p className="text-[13px] text-slate-500">{status.registrationNumber}</p>}
        </div>
      </div>

      <div className="mx-auto max-w-md p-5">
        <label className="mb-1.5 mt-3 block text-xs font-bold uppercase tracking-wide text-slate-500">From</label>
        <input
          type="text"
          placeholder="Pickup location"
          value={fromLocation}
          onChange={(e) => setFromLocation(e.target.value)}
          className="w-full rounded-[10px] border border-slate-200 bg-white p-3.5 text-[15px] text-slate-800 outline-none focus:border-accent"
        />

        <label className="mb-1.5 mt-3 block text-xs font-bold uppercase tracking-wide text-slate-500">To</label>
        <input
          type="text"
          placeholder="Drop-off location"
          value={toLocation}
          onChange={(e) => setToLocation(e.target.value)}
          className="w-full rounded-[10px] border border-slate-200 bg-white p-3.5 text-[15px] text-slate-800 outline-none focus:border-accent"
        />

        <label className="mb-1.5 mt-3 block text-xs font-bold uppercase tracking-wide text-slate-500">
          Note (optional)
        </label>
        <textarea
          placeholder="e.g. Waiting near the main gate"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          rows={3}
          className="w-full resize-none rounded-[10px] border border-slate-200 bg-white p-3.5 text-[15px] text-slate-800 outline-none focus:border-accent"
        />

        <button
          onClick={handleSubmit}
          disabled={submitting}
          className="mt-6 flex min-h-[50px] w-full items-center justify-center rounded-[10px] bg-accent text-base font-bold text-white transition hover:bg-accent-dark disabled:bg-slate-300"
        >
          {submitting ? (
            <>
              <Spinner />
              <span className="ml-2">Sending…</span>
            </>
          ) : (
            "Send request"
          )}
        </button>

        <p className="mt-3.5 text-center text-xs text-slate-400">
          The driver will see your name and phone number so they can coordinate the ride.
        </p>
      </div>
    </div>
  );
}
