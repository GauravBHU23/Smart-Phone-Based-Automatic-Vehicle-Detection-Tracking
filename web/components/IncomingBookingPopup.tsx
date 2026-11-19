"use client";

import { useEffect, useState } from "react";
import { bookingApi, vehicleApi } from "../lib/api/endpoints";
import { useTrackingHub } from "../lib/api/useTrackingHub";
import { useAuth } from "../lib/auth/AuthContext";
import { estimateFare, formatDistance, haversineKm } from "../lib/fareEstimate";
import { useToast } from "../lib/toast/ToastContext";
import { Booking } from "../lib/types";

const VEHICLE_ICONS: Record<string, string> = {
  Bus: "🚌",
  Auto: "🛺",
  Taxi: "🚕",
  Bike: "🏍️",
  Truck: "🚚",
  Ambulance: "🚑",
  Other: "🚗",
};

/**
 * Mounted once at the app root so an incoming ride request is actionable
 * from wherever the driver currently is, not just the driver dashboard —
 * matches Rapido/Ola's floating-card pattern. A booking's pickup distance
 * and fare are only shown when real coordinates exist (a Nominatim-geocoded
 * pickup); a free-typed pickup with no coordinates simply omits those rows
 * rather than showing a fabricated number.
 */
export default function IncomingBookingPopup() {
  const { token, role } = useAuth();
  const { showToast } = useToast();
  const [vehicleIds, setVehicleIds] = useState<string[]>([]);
  const [queue, setQueue] = useState<Booking[]>([]);
  const [driverPosition, setDriverPosition] = useState<GeolocationCoordinates | null>(null);
  const [busy, setBusy] = useState(false);

  const isDriver = role === "Driver";

  useEffect(() => {
    if (!token || !isDriver) return;
    vehicleApi
      .myVehicles(token)
      .then((list) => setVehicleIds(list.map((v) => v.id)))
      .catch((err) => console.warn("Failed to load vehicles for booking popup:", err));
  }, [token, isDriver]);

  useTrackingHub(
    {
      onLocationUpdate: () => {},
      onBookingRequested: (booking) => {
        if (!isDriver) return;
        setQueue((prev) => (prev.some((b) => b.id === booking.id) ? prev : [...prev, booking]));
        if ("geolocation" in navigator) {
          navigator.geolocation.getCurrentPosition(
            (pos) => setDriverPosition(pos.coords),
            () => {},
            { enableHighAccuracy: true, maximumAge: 15000, timeout: 8000 }
          );
        }
      },
      onBookingCancelled: (booking) => setQueue((prev) => prev.filter((b) => b.id !== booking.id)),
    },
    isDriver ? vehicleIds : []
  );

  if (!isDriver || queue.length === 0) return null;

  const booking = queue[0];
  const distanceKm =
    booking.fromLatitude != null && booking.fromLongitude != null && driverPosition
      ? haversineKm(driverPosition.latitude, driverPosition.longitude, booking.fromLatitude, booking.fromLongitude)
      : null;

  async function handleAccept() {
    if (!token) return;
    setBusy(true);
    try {
      await bookingApi.accept(token, booking.id);
      setQueue((prev) => prev.filter((b) => b.id !== booking.id));
      showToast("Request accepted", "success");
    } catch (err) {
      showToast("Could not accept request: " + String(err), "error");
    } finally {
      setBusy(false);
    }
  }

  async function handleReject() {
    if (!token) return;
    setBusy(true);
    try {
      await bookingApi.reject(token, booking.id);
      setQueue((prev) => prev.filter((b) => b.id !== booking.id));
    } catch (err) {
      showToast("Could not reject request: " + String(err), "error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-x-4 top-14 z-[200] flex justify-center sm:inset-x-auto sm:top-16 sm:right-6 sm:justify-end">
      <div className="w-full max-w-sm rounded-2xl bg-white p-4 shadow-2xl ring-1 ring-slate-200">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-xl">{VEHICLE_ICONS[booking.vehicleType] ?? "🚗"}</span>
            <span className="text-[15px] font-bold text-slate-800">{booking.vehicleRegistrationNumber}</span>
          </div>
          {distanceKm != null && (
            <span className="rounded-lg bg-accent-light px-2.5 py-1 text-sm font-extrabold text-accent-dark">
              ₹{estimateFare(distanceKm)} <span className="text-[10px] font-semibold text-accent">(Cash)</span>
            </span>
          )}
        </div>

        <div className="mt-3 flex flex-col gap-1.5">
          {distanceKm != null && (
            <div className="flex items-center gap-2 text-[13px] text-slate-600">
              <span className="h-1.5 w-1.5 rounded-full bg-green-600" />
              <span>{formatDistance(distanceKm)} to pickup</span>
            </div>
          )}
          {(booking.fromLocation || booking.toLocation) && (
            <div className="flex items-start gap-2 text-[13px] text-slate-700">
              <span className="mt-0.5 text-slate-400">📍</span>
              <span className="font-medium">
                {booking.fromLocation ?? "—"} → {booking.toLocation ?? "—"}
              </span>
            </div>
          )}
          <p className="text-[12px] text-slate-500">
            {booking.passengerName} · {booking.passengerPhone}
          </p>
        </div>

        <div className="mt-4 flex gap-2.5">
          <button
            onClick={handleReject}
            disabled={busy}
            className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-full border border-slate-300 text-lg font-bold text-slate-500 transition hover:bg-slate-50 disabled:opacity-60"
          >
            ✕
          </button>
          <button
            onClick={handleAccept}
            disabled={busy}
            className="flex-1 rounded-xl bg-accent py-3 text-sm font-bold text-white transition hover:bg-accent-dark disabled:opacity-60"
          >
            Accept
          </button>
        </div>

        {queue.length > 1 && (
          <p className="mt-2 text-center text-[11px] text-slate-400">+{queue.length - 1} more waiting</p>
        )}
      </div>
    </div>
  );
}
