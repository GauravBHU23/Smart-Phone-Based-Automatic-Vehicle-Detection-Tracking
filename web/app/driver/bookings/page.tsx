"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import Spinner from "../../../components/Spinner";
import { bookingApi } from "../../../lib/api/endpoints";
import { useTrackingHub } from "../../../lib/api/useTrackingHub";
import { useAuth } from "../../../lib/auth/AuthContext";
import { useToast } from "../../../lib/toast/ToastContext";
import { Booking, BookingStatus } from "../../../lib/types";

const STATUS_STYLES: Record<BookingStatus, string> = {
  Pending: "bg-amber-100 text-amber-800",
  Accepted: "bg-green-100 text-green-700",
  Rejected: "bg-red-100 text-red-700",
  Cancelled: "bg-slate-100 text-slate-500",
};

function timeAgo(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const min = Math.floor(diffMs / 60000);
  if (min < 1) return "just now";
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  return `${Math.floor(hr / 24)}d ago`;
}

export default function DriverBookingsPage() {
  const { token, role, isLoading } = useAuth();
  const { showToast } = useToast();
  const router = useRouter();
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);

  useEffect(() => {
    if (!isLoading && (!token || role !== "Driver")) router.replace("/login");
  }, [isLoading, token, role, router]);

  const loadBookings = useCallback(async () => {
    if (!token) return;
    try {
      const list = await bookingApi.driverList(token);
      setBookings(list);
    } catch (err) {
      console.warn("Failed to load bookings:", err);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    loadBookings();
    const interval = setInterval(loadBookings, 15000);
    return () => clearInterval(interval);
  }, [loadBookings]);

  const vehicleIdsToWatch = Array.from(new Set(bookings.map((b) => b.vehicleId)));

  useTrackingHub(
    {
      onLocationUpdate: () => {},
      onBookingRequested: (booking) => {
        setBookings((prev) => [booking, ...prev.filter((b) => b.id !== booking.id)]);
        showToast(`New ride request on ${booking.vehicleRegistrationNumber}`, "info");
      },
      onBookingCancelled: (booking) => setBookings((prev) => prev.map((b) => (b.id === booking.id ? booking : b))),
    },
    vehicleIdsToWatch
  );

  async function handleAccept(booking: Booking) {
    if (!token) return;
    setBusyId(booking.id);
    try {
      const updated = await bookingApi.accept(token, booking.id);
      setBookings((prev) => prev.map((b) => (b.id === updated.id ? updated : b)));
      showToast("Request accepted", "success");
    } catch (err) {
      showToast("Could not accept request: " + String(err), "error");
      await loadBookings();
    } finally {
      setBusyId(null);
    }
  }

  async function handleReject(booking: Booking) {
    if (!token) return;
    setBusyId(booking.id);
    try {
      const updated = await bookingApi.reject(token, booking.id);
      setBookings((prev) => prev.map((b) => (b.id === updated.id ? updated : b)));
      showToast("Request rejected", "info");
    } catch (err) {
      showToast("Could not reject request: " + String(err), "error");
      await loadBookings();
    } finally {
      setBusyId(null);
    }
  }

  if (isLoading || loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-accent border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 pb-10">
      <div className="border-b border-slate-200 bg-white px-5 py-5">
        <p className="text-xl font-extrabold text-slate-800">Ride requests</p>
      </div>

      <div className="mx-auto max-w-2xl p-4">
        {bookings.length === 0 && (
          <div className="mt-16 flex flex-col items-center text-center">
            <div className="mb-2.5 text-4xl">📋</div>
            <p className="text-base font-semibold text-slate-600">No ride requests yet</p>
            <p className="mt-1 text-[13px] text-slate-400">Requests from passengers will show up here.</p>
          </div>
        )}

        <div className="flex flex-col gap-3">
          {bookings.map((b) => (
            <div key={b.id} className="rounded-[14px] bg-white p-4 shadow-sm">
              <div className="flex items-center justify-between">
                <Link href={`/vehicle/${b.vehicleId}`} className="text-[15px] font-bold text-slate-800 hover:text-accent">
                  {b.vehicleRegistrationNumber}
                </Link>
                <span className={`rounded-lg px-2.5 py-1 text-[11px] font-extrabold tracking-wide ${STATUS_STYLES[b.status]}`}>
                  {b.status}
                </span>
              </div>
              <p className="mt-1.5 text-[13px] font-semibold text-slate-700">
                {b.passengerName} · {b.passengerPhone}
              </p>
              {(b.fromLocation || b.toLocation) && (
                <p className="mt-1.5 text-[13px] text-slate-600">
                  {b.fromLocation ?? "—"} → {b.toLocation ?? "—"}
                </p>
              )}
              {b.note && <p className="mt-1 text-xs italic text-slate-500">&quot;{b.note}&quot;</p>}
              <p className="mt-1.5 text-[11px] text-slate-400">
                {b.status === "Pending" ? "Requested" : "Responded"} {timeAgo(b.respondedAt ?? b.createdAt)}
              </p>

              {b.status === "Pending" && (
                <div className="mt-3 flex gap-2.5">
                  <button
                    onClick={() => handleReject(b)}
                    disabled={busyId === b.id}
                    className="flex min-h-[40px] flex-1 items-center justify-center rounded-[10px] bg-red-600 text-[13px] font-bold text-white transition hover:bg-red-700 disabled:opacity-60"
                  >
                    {busyId === b.id ? <Spinner className="h-3.5 w-3.5 border-2 border-white border-t-transparent" /> : "Reject"}
                  </button>
                  <button
                    onClick={() => handleAccept(b)}
                    disabled={busyId === b.id}
                    className="flex min-h-[40px] flex-1 items-center justify-center rounded-[10px] bg-green-600 text-[13px] font-bold text-white transition hover:bg-green-700 disabled:opacity-60"
                  >
                    {busyId === b.id ? <Spinner className="h-3.5 w-3.5 border-2 border-white border-t-transparent" /> : "Accept"}
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
