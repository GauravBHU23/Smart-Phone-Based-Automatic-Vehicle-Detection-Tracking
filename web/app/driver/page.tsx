"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import LogoutConfirmModal from "../../components/LogoutConfirmModal";
import PlaceAutocomplete from "../../components/PlaceAutocomplete";
import Spinner from "../../components/Spinner";
import { ApiError } from "../../lib/api/client";
import { bookingApi, vehicleApi, verificationApi } from "../../lib/api/endpoints";
import { useTrackingHub } from "../../lib/api/useTrackingHub";
import { useAuth } from "../../lib/auth/AuthContext";
import { GOOGLE_MAPS_API_KEY } from "../../lib/mapsConfig";
import { clearTrackingToken, loadTrackingToken, saveTrackingToken } from "../../lib/tracking/trackingToken";
import { useForegroundLocation } from "../../lib/tracking/useForegroundLocation";
import { useToast } from "../../lib/toast/ToastContext";
import { DriverVerificationStatus, PlaceSelection, Vehicle, VehicleType } from "../../lib/types";

const VEHICLE_TYPES: VehicleType[] = ["Bus", "Auto", "Taxi", "Bike", "Truck", "Ambulance", "Other"];

let nextStopKey = 0;

function vehicleEmoji(type: VehicleType): string {
  switch (type) {
    case "Bus":
      return "🚌";
    case "Auto":
      return "🛺";
    case "Taxi":
      return "🚕";
    case "Bike":
      return "🏍️";
    case "Truck":
      return "🚚";
    case "Ambulance":
      return "🚑";
    default:
      return "🚗";
  }
}

async function resolveCoordinates(place: PlaceSelection | null): Promise<{ latitude?: number; longitude?: number }> {
  if (!place) return {};
  if (place.id !== null) return {}; // existing Place directory entry — coordinates resolved server-side already.
  // A place picked from the Nominatim "Other places" suggestions already
  // carries real coordinates — no need to geocode it again.
  if (place.latitude != null && place.longitude != null) {
    return { latitude: place.latitude, longitude: place.longitude };
  }
  if (!place.name.trim()) return {};
  try {
    const res = await fetch(
      `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(place.name)}&key=${GOOGLE_MAPS_API_KEY}`
    );
    const data = await res.json();
    const loc = data?.results?.[0]?.geometry?.location;
    if (loc) return { latitude: loc.lat, longitude: loc.lng };
  } catch (err) {
    console.warn("Could not geocode place:", err);
  }
  return {};
}

export default function DriverPage() {
  const { token, name, role, isLoading, signOut } = useAuth();
  const { showToast } = useToast();
  const router = useRouter();
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [loading, setLoading] = useState(true);
  const [regNumber, setRegNumber] = useState("");
  const [vehicleType, setVehicleType] = useState<VehicleType>("Bus");
  const [fromPlace, setFromPlace] = useState<PlaceSelection | null>(null);
  const [toPlace, setToPlace] = useState<PlaceSelection | null>(null);
  const [stops, setStops] = useState<{ key: number; place: PlaceSelection | null }[]>([]);
  const [showRouteFields, setShowRouteFields] = useState(false);
  const [activeVehicleId, setActiveVehicleId] = useState<string | null>(null);
  const [tracking, setTracking] = useState(false);
  const [adding, setAdding] = useState(false);
  const [trackingActionBusyId, setTrackingActionBusyId] = useState<string | null>(null);
  const [logoutConfirmOpen, setLogoutConfirmOpen] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [pendingBookingCount, setPendingBookingCount] = useState(0);
  const [verificationStatus, setVerificationStatus] = useState<DriverVerificationStatus | null>(null);
  const [profilePhotoUrl, setProfilePhotoUrl] = useState<string | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);
  const [deleteConfirmVehicle, setDeleteConfirmVehicle] = useState<Vehicle | null>(null);
  const [deletingVehicleId, setDeletingVehicleId] = useState<string | null>(null);
  // Tracking keeps running off its own saved token after logout, the same
  // way the mobile app's background task does — see trackingToken.ts.
  const [trackingToken, setTrackingToken] = useState<string | null>(null);

  const { lastSuccessfulPingAt } = useForegroundLocation(trackingToken ?? token, activeVehicleId, tracking);
  const [locationStale, setLocationStale] = useState(false);

  useEffect(() => {
    setTrackingToken(loadTrackingToken());
  }, []);

  // Logging out must never silently kill an in-progress tracking session —
  // this page's own useForegroundLocation interval only runs while this
  // component is mounted, so redirecting away on logout would stop GPS
  // pings immediately, even though the UI (and the driver) believe
  // tracking survives logout until Stop is explicitly pressed. Only
  // redirect once there's no active tracking left to protect.
  useEffect(() => {
    if (!isLoading && !tracking && (!token || role !== "Driver")) router.replace("/login");
  }, [isLoading, token, role, tracking, router]);

  useEffect(() => {
    if (!token) return;
    async function loadPendingCount() {
      try {
        const bookings = await bookingApi.driverList(token!);
        setPendingBookingCount(bookings.filter((b) => b.status === "Pending").length);
      } catch (err) {
        console.warn("Failed to load bookings:", err);
      }
    }
    loadPendingCount();
    const interval = setInterval(loadPendingCount, 15000);
    return () => clearInterval(interval);
  }, [token]);

  useEffect(() => {
    if (!token) return;
    verificationApi
      .getStatus(token)
      .then((status) => {
        setVerificationStatus(status.status);
        setProfilePhotoUrl(status.profilePhotoUrl);
      })
      .catch((err) => console.warn("Failed to load verification status:", err));
  }, [token]);

  useTrackingHub(
    {
      onLocationUpdate: () => {},
      onBookingRequested: () => {
        // The global IncomingBookingPopup (mounted in layout.tsx) is the
        // one visible surface for a new request - this just keeps the
        // badge count in sync, no second toast for the same event.
        setPendingBookingCount((c) => c + 1);
      },
      onBookingCancelled: () => setPendingBookingCount((c) => Math.max(0, c - 1)),
    },
    vehicles.map((v) => v.id)
  );

  useEffect(() => {
    if (token) loadVehicles();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  useEffect(() => {
    if (!tracking) {
      setLocationStale(false);
      return;
    }
    const STALE_AFTER_MS = 30000;
    const trackingStartedAt = Date.now();
    const checkInterval = setInterval(() => {
      const lastSignalAt = lastSuccessfulPingAt ?? trackingStartedAt;
      setLocationStale(Date.now() - lastSignalAt > STALE_AFTER_MS);
    }, 5000);
    return () => clearInterval(checkInterval);
  }, [tracking, lastSuccessfulPingAt]);

  async function loadVehicles() {
    if (!token) return;
    setLoading(true);
    try {
      const list = await vehicleApi.myVehicles(token);
      setVehicles(list);
      // A brand-new driver with no vehicles yet should see the add-vehicle
      // form immediately; a returning driver with vehicles already
      // registered should see their list first, not a form pushed above it.
      if (list.length === 0) setShowAddForm(true);
      const stillActive = list.find((v) => v.isActive);
      if (stillActive) {
        setActiveVehicleId(stillActive.id);
        setTracking(true);
      }
    } catch (err) {
      console.warn(err);
    } finally {
      setLoading(false);
    }
  }

  async function handleAddVehicle() {
    if (!token || !regNumber) return;
    setAdding(true);
    setNotice(null);
    try {
      const toCoords = await resolveCoordinates(toPlace);

      const stopInputs = await Promise.all(
        stops
          .filter((s) => s.place && s.place.name.trim())
          .map(async (s) => {
            const place = s.place!;
            const coords = await resolveCoordinates(place);
            return {
              name: place.name,
              placeId: place.id ?? undefined,
              latitude: coords.latitude,
              longitude: coords.longitude,
            };
          })
      );

      await vehicleApi.registerVehicle(token, regNumber, vehicleType, {
        fromLocation: fromPlace?.name.trim() || undefined,
        toLocation: toPlace?.name.trim() || undefined,
        fromPlaceId: fromPlace?.id ?? undefined,
        toPlaceId: toPlace?.id ?? undefined,
        destinationLatitude: toCoords.latitude,
        destinationLongitude: toCoords.longitude,
        stops: stopInputs.length > 0 ? stopInputs : undefined,
      });

      const hadDestinationName = !!toPlace?.name.trim();
      const destinationUnresolved = hadDestinationName && toPlace?.id === null && toCoords.latitude === undefined;

      setRegNumber("");
      setFromPlace(null);
      setToPlace(null);
      setStops([]);
      setShowRouteFields(false);
      setShowAddForm(false);
      await loadVehicles();

      if (destinationUnresolved) {
        setNotice(
          "Vehicle added. We couldn't pinpoint your destination on the map, so arrival alerts won't trigger automatically for this trip. You can still track it live."
        );
        showToast("Vehicle added", "success");
      } else {
        showToast("Vehicle added successfully!", "success");
      }
    } catch (err) {
      const message = err instanceof ApiError ? err.message : String(err);
      setNotice(message);
      showToast(message, "error");
    } finally {
      setAdding(false);
    }
  }

  function addStopRow() {
    setStops((prev) => [...prev, { key: nextStopKey++, place: null }]);
  }

  function removeStopRow(key: number) {
    setStops((prev) => prev.filter((s) => s.key !== key));
  }

  function updateStopRow(key: number, place: PlaceSelection) {
    setStops((prev) => prev.map((s) => (s.key === key ? { ...s, place } : s)));
  }

  function handleConfirmedSignOut() {
    setLogoutConfirmOpen(false);
    signOut();
    showToast("Logged out", "info");
    // If tracking is active, deliberately stay on this page instead of
    // navigating to /login — this component unmounting would kill the
    // GPS-ping interval (useForegroundLocation), silently stopping
    // tracking despite the logout confirmation promising it wouldn't.
    // The redirect effect above takes over once Stop is pressed.
    if (!tracking) router.push("/login");
  }

  async function startTracking(vehicleId: string) {
    if (!token) return;
    if (!("geolocation" in navigator)) {
      setNotice("This browser does not support location sharing.");
      return;
    }
    setTrackingActionBusyId(vehicleId);
    try {
      await vehicleApi.startTracking(token, vehicleId);
      setActiveVehicleId(vehicleId);
      setTracking(true);
      saveTrackingToken(token);
      setTrackingToken(token);
      showToast("Tracking started — you're live!", "success");
    } catch (err) {
      const message = err instanceof ApiError ? err.message : String(err);
      setNotice(message);
      showToast(message, "error");
      setTracking(false);
      setActiveVehicleId(null);
    } finally {
      setTrackingActionBusyId(null);
    }
  }

  async function stopTracking() {
    // Stop must work even after logout — it uses whichever token is still
    // available (the tracking-specific one survives logout on purpose; the
    // auth token covers the normal case where the driver never logged out).
    const stopToken = trackingToken ?? token;
    if (!stopToken || !activeVehicleId) return;
    setTrackingActionBusyId(activeVehicleId);
    try {
      await vehicleApi.stopTracking(stopToken, activeVehicleId);
      showToast("Tracking stopped", "info");
    } catch (err) {
      const message = err instanceof ApiError ? err.message : String(err);
      setNotice(message);
      showToast(message, "error");
    } finally {
      setTracking(false);
      setActiveVehicleId(null);
      setTrackingActionBusyId(null);
      clearTrackingToken();
      setTrackingToken(null);
      if (!token) router.push("/login");
      else loadVehicles();
    }
  }

  async function handleDeleteVehicle() {
    if (!token || !deleteConfirmVehicle) return;
    const vehicleId = deleteConfirmVehicle.id;
    setDeletingVehicleId(vehicleId);
    try {
      await vehicleApi.deleteVehicle(token, vehicleId);
      setVehicles((prev) => prev.filter((v) => v.id !== vehicleId));
      setDeleteConfirmVehicle(null);
      showToast("Vehicle deleted", "info");
    } catch (err) {
      showToast(err instanceof ApiError ? err.message : String(err), "error");
    } finally {
      setDeletingVehicleId(null);
    }
  }

  if (isLoading || loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-accent border-t-transparent" />
      </div>
    );
  }

  const activeVehicle = vehicles.find((v) => v.id === activeVehicleId);

  return (
    <div className="min-h-screen bg-slate-50 pb-10">
      <div className="rounded-b-3xl bg-gradient-to-br from-accent-dark to-accent px-5 pb-5 pt-4 lg:rounded-none lg:px-10 lg:pb-8 lg:pt-6">
        <div className="mx-auto max-w-6xl">
          <div className="mb-4 flex items-start justify-between">
            <div className="flex items-center gap-3">
              {token && (
                <button
                  onClick={() => setMenuOpen(true)}
                  className="flex h-11 w-11 flex-shrink-0 items-center justify-center overflow-hidden rounded-full bg-white/15 transition hover:bg-white/25"
                  aria-label="Open menu"
                >
                  {profilePhotoUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={profilePhotoUrl} alt={name ?? "Profile"} className="h-full w-full object-cover" />
                  ) : (
                    <span className="text-lg">👤</span>
                  )}
                </button>
              )}
              <div>
                <p className="text-[13px] text-white/75">{token ? "Welcome back" : "Logged out"}</p>
                <p className="mt-0.5 text-2xl font-bold text-white lg:text-3xl">{token ? name : "Still sharing location"}</p>
              </div>
            </div>
          </div>
          <div className="flex flex-col gap-2 lg:flex-row lg:flex-wrap lg:items-center">
            <div className="flex w-full items-center gap-2 rounded-2xl bg-white/10 px-3 py-1.5 lg:w-auto">
              <span className={`h-2 w-2 flex-shrink-0 rounded-full ${tracking ? "animate-pulse bg-green-400" : "bg-white/40"}`} />
              <span className="text-[13px] font-medium text-white">
                {tracking ? `Live — sharing ${activeVehicle?.registrationNumber ?? "vehicle"} location` : "Not sharing location"}
              </span>
            </div>
            {token && verificationStatus && verificationStatus !== "Approved" && (
              <Link
                href="/driver/verification"
                className="flex w-full items-center gap-1.5 rounded-2xl bg-amber-400/90 px-3 py-1.5 text-[13px] font-semibold text-amber-950 transition hover:bg-amber-400 lg:w-auto"
              >
                🪪{" "}
                {verificationStatus === "Pending"
                  ? "Verification pending"
                  : verificationStatus === "Rejected"
                    ? "Verification rejected — resubmit"
                    : "Get verified"}
              </Link>
            )}
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-6xl lg:px-10">
        {tracking && (
          <div className="mx-4 mt-3 rounded-xl border border-blue-100 bg-accent-light p-3 text-[12px] text-accent-dark lg:mx-0">
            Keep this browser tab open while sharing your location — tracking stops if you close the tab.
          </div>
        )}

        {tracking && locationStale && (
          <div className="mx-4 mt-3 flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-100 p-3 lg:mx-0">
            <span>⚠️</span>
            <p className="flex-1 text-xs font-medium text-amber-800">
              Location isn&apos;t reaching the server — passengers may not see you moving. Check your internet connection.
            </p>
          </div>
        )}

        {notice && (
          <div className="mx-4 mt-3 rounded-xl border border-slate-200 bg-white p-3 text-[13px] text-slate-600 lg:mx-0">
            {notice}
          </div>
        )}

        <div className="lg:grid lg:grid-cols-[1fr_380px] lg:items-start lg:gap-6 lg:pt-6">
          <div className="lg:order-2 lg:sticky lg:top-6">
            {!tracking && !showAddForm && (
              <button
                onClick={() => setShowAddForm(true)}
                className="mx-4 -mt-3.5 flex w-[calc(100%-32px)] items-center justify-center rounded-2xl border-2 border-dashed border-accent/40 bg-white py-4 text-[14px] font-bold text-accent shadow-sm transition hover:bg-accent-light lg:mx-0 lg:mt-0 lg:w-full lg:shadow-md"
              >
                + Add another vehicle
              </button>
            )}

            {!tracking && showAddForm && (
              <div className="mx-4 -mt-3.5 rounded-2xl bg-white p-4 shadow-md lg:mx-0 lg:mt-0 lg:shadow-lg">
                <div className="mb-2.5 flex items-center justify-between">
                  <p className="text-[13px] font-bold uppercase tracking-wide text-slate-500">Add a vehicle</p>
                  {vehicles.length > 0 && (
                    <button
                      onClick={() => setShowAddForm(false)}
                      className="text-[13px] font-semibold text-slate-400 hover:text-slate-600"
                    >
                      Cancel
                    </button>
                  )}
                </div>
                <input
                  type="text"
                  placeholder="Vehicle number (e.g. UP70AB1234)"
                  value={regNumber}
                  onChange={(e) => setRegNumber(e.target.value.toUpperCase())}
                  className="mb-3 w-full rounded-[10px] border border-slate-200 bg-slate-50 p-3.5 text-[15px] text-slate-800 outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/20"
                />
                <div className="mb-3.5 flex flex-wrap gap-2">
                  {VEHICLE_TYPES.map((t) => (
                    <button
                      key={t}
                      onClick={() => setVehicleType(t)}
                      className={`rounded-2xl border px-3 py-1.5 text-[13px] transition ${
                        vehicleType === t
                          ? "border-accent bg-accent font-semibold text-white"
                          : "border-blue-100 bg-accent-light text-accent hover:border-accent/50"
                      }`}
                    >
                      {t}
                    </button>
                  ))}
                </div>

                <button
                  onClick={() => setShowRouteFields((v) => !v)}
                  className="mb-2.5 text-[13px] font-semibold text-accent"
                >
                  {showRouteFields ? "− Hide route details" : "+ Add route (recommended)"}
                </button>

                {showRouteFields && (
                  <div className="mb-1">
                    <p className="mb-2.5 text-xs leading-relaxed text-slate-500">
                      Adding a route lets passengers and family see where this vehicle is headed and when it has arrived — just like a
                      train&apos;s status.
                    </p>
                    <div className="mb-3">
                      <PlaceAutocomplete value={fromPlace} onChange={setFromPlace} placeholder="From (e.g. Civil Lines)" allowNew />
                    </div>
                    <div className="mb-3">
                      <PlaceAutocomplete value={toPlace} onChange={setToPlace} placeholder="To (e.g. Naini)" allowNew />
                    </div>

                    {stops.map((stop, i) => (
                      <div key={stop.key} className="mb-3 flex items-center gap-2">
                        <div className="flex-1">
                          <PlaceAutocomplete
                            value={stop.place}
                            onChange={(place) => updateStopRow(stop.key, place)}
                            placeholder={`Stop ${i + 1}`}
                            allowNew
                          />
                        </div>
                        <button
                          onClick={() => removeStopRow(stop.key)}
                          className="flex h-9 w-9 items-center justify-center rounded-full bg-red-50 font-bold text-red-600 transition hover:bg-red-100"
                        >
                          ✕
                        </button>
                      </div>
                    ))}

                    <button onClick={addStopRow} className="mb-1 text-[13px] font-semibold text-accent">
                      + Add a stop
                    </button>
                  </div>
                )}

                <button
                  onClick={handleAddVehicle}
                  disabled={!regNumber || adding}
                  className="mt-2 flex min-h-[46px] w-full items-center justify-center rounded-[10px] bg-green-600 font-bold text-white transition hover:bg-green-700 disabled:bg-slate-300 disabled:hover:bg-slate-300"
                >
                  {adding ? (
                    <>
                      <Spinner className="h-4 w-4 border-2 border-white border-t-transparent" />
                      <span className="ml-2">Adding…</span>
                    </>
                  ) : (
                    "+ Add Vehicle"
                  )}
                </button>
              </div>
            )}
          </div>

          <div className="lg:order-1">
            <p className="mx-5 mb-2 mt-5 text-[13px] font-bold uppercase tracking-wide text-slate-500 lg:mx-0 lg:mt-0">
              Your vehicles
            </p>

            <div className="mx-4 flex flex-col gap-2.5 lg:mx-0">
              {vehicles.map((item) => {
                const isLive = tracking && activeVehicleId === item.id;
                return (
                  <div
                    key={item.id}
                    className={`flex items-center rounded-2xl bg-white p-3.5 shadow-sm transition hover:shadow-md lg:p-5 ${
                      isLive ? "border-[1.5px] border-green-400" : ""
                    }`}
                  >
                    <div className="mr-3 flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-full bg-accent-light text-xl lg:h-14 lg:w-14 lg:text-2xl">
                      {vehicleEmoji(item.type)}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-base font-bold text-slate-800 lg:text-lg">{item.registrationNumber}</p>
                      <p className="mt-0.5 truncate text-[13px] text-slate-500">
                        {item.type}
                        {item.fromLocation && item.toLocation ? ` · ${item.fromLocation} → ${item.toLocation}` : ""}
                      </p>
                    </div>
                    {isLive ? (
                      <button
                        onClick={stopTracking}
                        disabled={trackingActionBusyId === item.id}
                        className="flex flex-shrink-0 items-center rounded-[10px] bg-red-600 px-4 py-2.5 text-[13px] font-bold text-white transition hover:bg-red-700 disabled:opacity-70"
                      >
                        {trackingActionBusyId === item.id ? <Spinner /> : "■ Stop"}
                      </button>
                    ) : (
                      <div className="flex flex-shrink-0 items-center gap-1.5">
                        {token && (
                          <>
                            <button
                              onClick={() => router.push(`/driver/vehicle/${item.id}/edit`)}
                              disabled={tracking}
                              title="Edit vehicle"
                              className="flex h-9 w-9 items-center justify-center rounded-[10px] bg-slate-100 text-base transition hover:bg-slate-200 disabled:opacity-40"
                            >
                              ✏️
                            </button>
                            <button
                              onClick={() => setDeleteConfirmVehicle(item)}
                              disabled={tracking}
                              title="Delete vehicle"
                              className="flex h-9 w-9 items-center justify-center rounded-[10px] bg-red-50 text-base transition hover:bg-red-100 disabled:opacity-40"
                            >
                              🗑️
                            </button>
                          </>
                        )}
                        <button
                          onClick={() => startTracking(item.id)}
                          disabled={tracking || trackingActionBusyId === item.id}
                          className="flex flex-shrink-0 items-center rounded-[10px] bg-accent px-4 py-2.5 text-[13px] font-bold text-white transition hover:bg-accent-dark disabled:bg-slate-300 disabled:hover:bg-slate-300"
                        >
                          {trackingActionBusyId === item.id ? <Spinner className="h-4 w-4 border-2 border-white border-t-transparent" /> : "▶ Start"}
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}

              {vehicles.length === 0 && (
                <div className="mt-10 flex flex-col items-center px-10 py-6 text-center lg:rounded-2xl lg:border lg:border-dashed lg:border-slate-300">
                  <div className="mb-2.5 text-4xl">🚐</div>
                  <p className="text-base font-semibold text-slate-600">No vehicles yet</p>
                  <p className="mt-1 text-[13px] text-slate-400">Add your vehicle to start sharing your live location.</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {menuOpen && (
        <div className="fixed inset-0 z-50 flex bg-slate-900/50" onClick={() => setMenuOpen(false)}>
          <div
            className="flex h-full w-[82%] max-w-[320px] flex-col bg-white shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-3 bg-gradient-to-br from-accent-dark to-accent px-5 py-6">
              <div className="flex h-16 w-16 flex-shrink-0 items-center justify-center overflow-hidden rounded-full bg-white/15">
                {profilePhotoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={profilePhotoUrl} alt={name ?? "Profile"} className="h-full w-full object-cover" />
                ) : (
                  <span className="text-3xl">👤</span>
                )}
              </div>
              <div className="min-w-0">
                <p className="truncate text-lg font-bold text-white">{name}</p>
                {verificationStatus === "Approved" && <p className="text-[12px] font-medium text-white/80">🪪 Verified driver</p>}
              </div>
            </div>

            <nav className="flex flex-1 flex-col gap-1 p-3">
              <Link
                href="/driver/bookings"
                onClick={() => setMenuOpen(false)}
                className="flex items-center gap-3 rounded-xl px-3 py-3 text-[15px] font-semibold text-slate-700 transition hover:bg-slate-50"
              >
                📋 <span className="flex-1">Ride requests</span>
                {pendingBookingCount > 0 && (
                  <span className="rounded-full bg-accent px-2 py-0.5 text-[11px] font-bold text-white">{pendingBookingCount}</span>
                )}
              </Link>
              <Link
                href="/driver/verification"
                onClick={() => setMenuOpen(false)}
                className="flex items-center gap-3 rounded-xl px-3 py-3 text-[15px] font-semibold text-slate-700 transition hover:bg-slate-50"
              >
                🪪{" "}
                <span className="flex-1">
                  {verificationStatus === "Approved"
                    ? "Verification"
                    : verificationStatus === "Pending"
                      ? "Verification (pending)"
                      : verificationStatus === "Rejected"
                        ? "Verification (rejected)"
                        : "Get verified"}
                </span>
              </Link>

              <div className="mt-auto border-t border-slate-100 pt-2">
                <button
                  onClick={() => {
                    setMenuOpen(false);
                    setLogoutConfirmOpen(true);
                  }}
                  className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-[15px] font-semibold text-red-600 transition hover:bg-red-50"
                >
                  ⏻ <span>Log out</span>
                </button>
              </div>
            </nav>
          </div>
        </div>
      )}

      <LogoutConfirmModal
        visible={logoutConfirmOpen}
        message={
          tracking
            ? "Your vehicle will keep sharing its live location as long as this browser tab stays open, even after you log out. Use the Stop button first if you want to stop sharing location."
            : "You'll need to log in again to continue driving."
        }
        onCancel={() => setLogoutConfirmOpen(false)}
        onConfirm={handleConfirmedSignOut}
      />

      {deleteConfirmVehicle && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 px-8"
          onClick={() => setDeleteConfirmVehicle(null)}
        >
          <div className="w-full max-w-sm rounded-[20px] bg-white p-6 text-center shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <h2 className="mb-1.5 text-lg font-extrabold text-slate-800">Delete {deleteConfirmVehicle.registrationNumber}?</h2>
            <p className="mb-5 text-[13px] leading-[19px] text-slate-500">
              This permanently removes the vehicle along with its trip history and any bookings. This can&apos;t be undone.
            </p>
            <div className="flex gap-2.5">
              <button
                onClick={() => setDeleteConfirmVehicle(null)}
                className="flex-1 rounded-xl bg-slate-100 py-3 text-sm font-bold text-slate-700"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteVehicle}
                disabled={deletingVehicleId === deleteConfirmVehicle.id}
                className="flex flex-1 items-center justify-center rounded-xl bg-red-600 py-3 text-sm font-bold text-white disabled:opacity-60"
              >
                {deletingVehicleId === deleteConfirmVehicle.id ? <Spinner className="h-4 w-4 border-2 border-white border-t-transparent" /> : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
