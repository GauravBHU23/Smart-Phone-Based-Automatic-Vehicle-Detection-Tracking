"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import LiveMap, { MapMarkerSpec } from "../../../../components/LiveMap";
import { bookingApi, vehicleApi } from "../../../../lib/api/endpoints";
import { useTrackingHub } from "../../../../lib/api/useTrackingHub";
import { useRoute } from "../../../../lib/api/useRoute";
import { useAuth } from "../../../../lib/auth/AuthContext";
import { GOOGLE_MAPS_API_KEY } from "../../../../lib/mapsConfig";
import { useToast } from "../../../../lib/toast/ToastContext";
import { Booking, LatLng, VehicleStatus } from "../../../../lib/types";

function formatElapsed(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

export default function WaitingForDriverPage() {
  const { id: bookingId } = useParams<{ id: string }>();
  const router = useRouter();
  const { token, role, isLoading } = useAuth();
  const { showToast } = useToast();
  const [booking, setBooking] = useState<Booking | null>(null);
  const [loadingBooking, setLoadingBooking] = useState(true);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [cancelling, setCancelling] = useState(false);
  const [vehicleStatus, setVehicleStatus] = useState<VehicleStatus | null>(null);

  useEffect(() => {
    if (!isLoading && (!token || role !== "Passenger")) router.replace("/login");
  }, [isLoading, token, role, router]);

  async function loadBooking() {
    if (!token) return;
    try {
      const list = await bookingApi.mine(token);
      const found = list.find((b) => b.id === bookingId);
      if (found) setBooking(found);
    } catch (err) {
      console.warn("Failed to load booking:", err);
    } finally {
      setLoadingBooking(false);
    }
  }

  useEffect(() => {
    loadBooking();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, bookingId]);

  // A real elapsed-time counter, not a fake countdown — genuinely reflects
  // how long the passenger has actually been waiting.
  useEffect(() => {
    const interval = setInterval(() => setElapsedSeconds((s) => s + 1), 1000);
    return () => clearInterval(interval);
  }, []);

  // Fallback polling alongside SignalR — a dropped/throttled connection
  // must never leave someone staring at a stale "searching" animation.
  useEffect(() => {
    const interval = setInterval(loadBooking, 5000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, bookingId]);

  // Once accepted, the passenger needs the driver's live position for the
  // route map — the booking itself never carries live coordinates, only the
  // separate vehicle-status feed does (same pattern as vehicle/[id]/page.tsx).
  useEffect(() => {
    if (!booking || booking.status !== "Accepted") return;
    vehicleApi
      .getStatus(booking.vehicleId)
      .then(setVehicleStatus)
      .catch((err) => console.warn("Failed to load vehicle status:", err));
  }, [booking?.vehicleId, booking?.status]);

  useTrackingHub(
    {
      onLocationUpdate: (update) => {
        if (!booking || update.vehicleId !== booking.vehicleId) return;
        setVehicleStatus((prev) =>
          prev ? { ...prev, latitude: update.latitude, longitude: update.longitude, isActive: true } : prev
        );
      },
      onBookingAccepted: (b) => {
        if (b.id === bookingId) setBooking(b);
      },
      onBookingRejected: (b) => {
        if (b.id === bookingId) setBooking(b);
      },
      onBookingCancelled: (b) => {
        if (b.id === bookingId) setBooking(b);
      },
      onBookingOtpVerified: (b) => {
        if (b.id === bookingId) setBooking(b);
      },
    },
    booking ? [booking.vehicleId] : []
  );

  // Two legs, never a guessed one: before the ride starts, the route runs
  // from wherever the driver actually is right now to the passenger's real
  // pickup point; once the OTP is verified, it switches to pickup →
  // destination. Either leg is simply omitted (no line, no distance/ETA) if
  // its coordinates aren't known - matches this app's standing rule against
  // fabricated numbers.
  const rideStarted = booking ? booking.status === "Completed" || booking.otpVerified : false;
  const driverPosition: LatLng | null =
    !rideStarted && vehicleStatus?.latitude != null && vehicleStatus?.longitude != null
      ? { lat: vehicleStatus.latitude, lng: vehicleStatus.longitude }
      : null;
  const pickupPoint: LatLng | null =
    booking?.fromLatitude != null && booking?.fromLongitude != null
      ? { lat: booking.fromLatitude, lng: booking.fromLongitude }
      : null;
  const destinationPoint: LatLng | null =
    booking?.toLatitude != null && booking?.toLongitude != null
      ? { lat: booking.toLatitude, lng: booking.toLongitude }
      : null;
  const routeOrigin = rideStarted ? pickupPoint : driverPosition;
  const routeDestination = rideStarted ? destinationPoint : pickupPoint;
  const { route } = useRoute(token, routeOrigin, routeDestination);

  async function handleCancel() {
    if (!token || !booking) return;
    setCancelling(true);
    try {
      await bookingApi.cancel(token, booking.id);
      setBooking((prev) => (prev ? { ...prev, status: "Cancelled" } : prev));
      showToast("Request cancelled", "info");
    } catch (err) {
      showToast("Could not cancel request: " + String(err), "error");
    } finally {
      setCancelling(false);
    }
  }

  if (isLoading || loadingBooking) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-accent border-t-transparent" />
      </div>
    );
  }

  if (!booking) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-slate-50 p-6 text-center">
        <div className="text-4xl">🔍</div>
        <p className="text-base font-semibold text-slate-600">Booking not found</p>
        <Link href="/passenger/bookings" className="rounded-[10px] bg-accent px-5 py-2.5 font-semibold text-white">
          Go to my bookings
        </Link>
      </div>
    );
  }

  if (booking.status === "Pending") {
    return (
      <div className="flex min-h-screen flex-col bg-slate-50">
        <div className="flex flex-1 flex-col items-center justify-center px-6">
          <div className="relative mb-8 flex h-40 w-40 items-center justify-center">
            <span
              className="absolute h-full w-full rounded-full bg-accent/20"
              style={{ animation: "radar-ping 2s ease-out infinite" }}
            />
            <span
              className="absolute h-full w-full rounded-full bg-accent/20"
              style={{ animation: "radar-ping 2s ease-out infinite", animationDelay: "0.6s" }}
            />
            <span
              className="absolute h-full w-full rounded-full bg-accent/20"
              style={{ animation: "radar-ping 2s ease-out infinite", animationDelay: "1.2s" }}
            />
            <div className="relative flex h-20 w-20 items-center justify-center rounded-full bg-accent text-4xl shadow-lg">
              🚖
            </div>
          </div>

          <h1 className="mb-1.5 text-xl font-extrabold text-slate-800">Finding your driver…</h1>
          <p className="mb-6 text-sm text-slate-500">Searching for {formatElapsed(elapsedSeconds)}</p>

          <div className="w-full max-w-sm rounded-[14px] bg-white p-4 shadow-sm">
            <p className="text-[15px] font-bold text-slate-800">{booking.vehicleRegistrationNumber}</p>
            {(booking.fromLocation || booking.toLocation) && (
              <p className="mt-1 text-[13px] text-slate-500">
                {booking.fromLocation ?? "—"} → {booking.toLocation ?? "—"}
              </p>
            )}
          </div>

          <button
            onClick={handleCancel}
            disabled={cancelling}
            className="mt-8 rounded-[10px] border border-red-200 bg-red-50 px-6 py-3 text-sm font-bold text-red-600 transition hover:bg-red-100 disabled:opacity-60"
          >
            {cancelling ? "Cancelling…" : "Cancel request"}
          </button>
        </div>
      </div>
    );
  }

  if (booking.status === "Accepted" || booking.status === "Completed") {
    const mapCenter = routeOrigin ?? routeDestination ?? pickupPoint ?? destinationPoint;
    const markerCandidates: (MapMarkerSpec | null)[] = [
      driverPosition ? { id: "driver", lat: driverPosition.lat, lng: driverPosition.lng, label: booking.vehicleRegistrationNumber, pinColor: "blue" } : null,
      pickupPoint ? { id: "pickup", lat: pickupPoint.lat, lng: pickupPoint.lng, label: "Pickup", pinColor: "green" } : null,
      rideStarted && destinationPoint ? { id: "destination", lat: destinationPoint.lat, lng: destinationPoint.lng, label: "Destination", pinColor: "red" } : null,
    ];
    const markers = markerCandidates.filter((m): m is MapMarkerSpec => m !== null);

    return (
      <div className="flex min-h-screen flex-col bg-slate-50 pb-8">
        {mapCenter && (
          <div className="h-[280px] w-full lg:h-[380px]">
            <LiveMap
              apiKey={GOOGLE_MAPS_API_KEY}
              center={mapCenter}
              markers={markers}
              path={route?.polyline.map((p) => ({ lat: p.lat, lng: p.lng }))}
            />
          </div>
        )}

        <div className="mx-auto w-full max-w-lg px-6">
          {route && (
            <div className="-mt-5 mb-4 flex items-center justify-center">
              <div className="rounded-full bg-white px-4 py-2 text-[13px] font-bold text-slate-700 shadow-md">
                {route.distanceKm} km · {route.etaMinutes} min {rideStarted ? "to destination" : "away"}
              </div>
            </div>
          )}

          <div className="flex flex-col items-center gap-4 text-center">
            <h1 className="text-xl font-extrabold text-slate-800">
              {rideStarted ? "Ride in progress" : "Driver on the way"}
            </h1>

            <div className="w-full rounded-[14px] bg-white p-4 shadow-sm">
              <div className="flex items-center justify-between">
                <div className="text-left">
                  <p className="text-[15px] font-bold text-slate-800">{booking.vehicleRegistrationNumber}</p>
                  <p className="text-[13px] text-slate-500">{booking.vehicleType}</p>
                </div>
                {booking.driverPhone && (
                  <a
                    href={`tel:${booking.driverPhone}`}
                    className="flex items-center gap-1.5 rounded-[10px] bg-accent-light px-4 py-2.5 text-sm font-bold text-accent-dark"
                  >
                    📞 Call
                  </a>
                )}
              </div>
            </div>

            {!rideStarted && booking.otpCode && (
              <div className="w-full rounded-2xl bg-accent-light px-6 py-4">
                <p className="text-xs font-semibold text-accent">Share this code with your driver to start the ride</p>
                <p className="mt-1 text-3xl font-extrabold tracking-[0.3em] text-accent-dark">{booking.otpCode}</p>
              </div>
            )}

            <div className="mt-1 flex gap-3">
              <Link
                href={`/vehicle/${booking.vehicleId}`}
                className="rounded-[10px] border border-accent px-5 py-2.5 text-sm font-bold text-accent"
              >
                Track live
              </Link>
              <Link href="/passenger/bookings" className="rounded-[10px] bg-accent px-5 py-2.5 text-sm font-bold text-white">
                My bookings
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Rejected or Cancelled
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-slate-50 px-6 text-center">
      <div className="flex h-20 w-20 items-center justify-center rounded-full bg-red-100 text-4xl">
        {booking.status === "Cancelled" ? "🚫" : "😕"}
      </div>
      <h1 className="text-xl font-extrabold text-slate-800">
        {booking.status === "Cancelled" ? "Request cancelled" : "Driver couldn't take this ride"}
      </h1>
      <p className="text-sm text-slate-500">Try another vehicle, or search again.</p>
      <Link href="/search" className="mt-2 rounded-[10px] bg-accent px-6 py-3 text-sm font-bold text-white">
        Try another vehicle
      </Link>
    </div>
  );
}
