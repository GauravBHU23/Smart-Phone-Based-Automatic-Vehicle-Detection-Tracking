"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import LogoutConfirmModal from "../../components/LogoutConfirmModal";
import PlaceAutocomplete from "../../components/PlaceAutocomplete";
import { ApiError } from "../../lib/api/client";
import { vehicleApi } from "../../lib/api/endpoints";
import { useAuth } from "../../lib/auth/AuthContext";
import { GOOGLE_MAPS_API_KEY } from "../../lib/mapsConfig";
import { useForegroundLocation } from "../../lib/tracking/useForegroundLocation";
import { Place, Vehicle, VehicleType } from "../../lib/types";

const VEHICLE_TYPES: VehicleType[] = ["Bus", "Auto", "Taxi", "Bike", "Truck", "Ambulance", "Other"];

type PlaceSelection = Place | { id: null; name: string };
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
  if (!place || place.id !== null || !place.name.trim()) return {};
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
  const [logoutConfirmOpen, setLogoutConfirmOpen] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const { lastSuccessfulPingAt } = useForegroundLocation(token, activeVehicleId, tracking);
  const [locationStale, setLocationStale] = useState(false);

  useEffect(() => {
    if (!isLoading && (!token || role !== "Driver")) router.replace("/login");
  }, [isLoading, token, role, router]);

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
      await loadVehicles();

      if (destinationUnresolved) {
        setNotice(
          "Vehicle added. We couldn't pinpoint your destination on the map, so arrival alerts won't trigger automatically for this trip. You can still track it live."
        );
      }
    } catch (err) {
      setNotice(err instanceof ApiError ? err.message : String(err));
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
    router.push("/login");
  }

  async function startTracking(vehicleId: string) {
    if (!token) return;
    if (!("geolocation" in navigator)) {
      setNotice("This browser does not support location sharing.");
      return;
    }
    try {
      await vehicleApi.startTracking(token, vehicleId);
      setActiveVehicleId(vehicleId);
      setTracking(true);
    } catch (err) {
      setNotice(err instanceof ApiError ? err.message : String(err));
      setTracking(false);
      setActiveVehicleId(null);
    }
  }

  async function stopTracking() {
    if (!token || !activeVehicleId) return;
    try {
      await vehicleApi.stopTracking(token, activeVehicleId);
    } catch (err) {
      setNotice(err instanceof ApiError ? err.message : String(err));
    } finally {
      setTracking(false);
      setActiveVehicleId(null);
      loadVehicles();
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
      <div className="rounded-b-3xl bg-gradient-to-br from-accent-dark to-accent px-5 pb-5 pt-4">
        <div className="mb-4 flex items-start justify-between">
          <div>
            <p className="text-[13px] text-white/75">Welcome back</p>
            <p className="mt-0.5 text-2xl font-bold text-white">{name}</p>
          </div>
          <button
            onClick={() => setLogoutConfirmOpen(true)}
            className="flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-2 text-[13px] font-semibold text-white"
          >
            <span>⏻</span> Log out
          </button>
        </div>
        <div className="inline-flex items-center gap-2 rounded-2xl bg-white/10 px-3 py-1.5">
          <span className={`h-2 w-2 rounded-full ${tracking ? "bg-green-400" : "bg-white/40"}`} />
          <span className="text-[13px] font-medium text-white">
            {tracking ? `Live — sharing ${activeVehicle?.registrationNumber ?? "vehicle"} location` : "Not sharing location"}
          </span>
        </div>
      </div>

      {tracking && (
        <div className="mx-4 mt-3 rounded-xl border border-blue-100 bg-accent-light p-3 text-[12px] text-accent-dark">
          Keep this browser tab open while sharing your location — tracking stops if you close the tab.
        </div>
      )}

      {tracking && locationStale && (
        <div className="mx-4 mt-3 flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-100 p-3">
          <span>⚠️</span>
          <p className="flex-1 text-xs font-medium text-amber-800">
            Location isn&apos;t reaching the server — passengers may not see you moving. Check your internet connection.
          </p>
        </div>
      )}

      {notice && (
        <div className="mx-4 mt-3 rounded-xl border border-slate-200 bg-white p-3 text-[13px] text-slate-600">{notice}</div>
      )}

      {!tracking && (
        <div className="mx-4 -mt-3.5 rounded-2xl bg-white p-4 shadow-md">
          <p className="mb-2.5 text-[13px] font-bold uppercase tracking-wide text-slate-500">Add a vehicle</p>
          <input
            type="text"
            placeholder="Vehicle number (e.g. UP70AB1234)"
            value={regNumber}
            onChange={(e) => setRegNumber(e.target.value.toUpperCase())}
            className="mb-3 w-full rounded-[10px] border border-slate-200 bg-slate-50 p-3.5 text-[15px] text-slate-800 outline-none focus:border-accent"
          />
          <div className="mb-3.5 flex flex-wrap gap-2">
            {VEHICLE_TYPES.map((t) => (
              <button
                key={t}
                onClick={() => setVehicleType(t)}
                className={`rounded-2xl border px-3 py-1.5 text-[13px] ${
                  vehicleType === t ? "border-accent bg-accent font-semibold text-white" : "border-blue-100 bg-accent-light text-accent"
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
                    className="flex h-9 w-9 items-center justify-center rounded-full bg-red-50 font-bold text-red-600"
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
            className="mt-2 flex min-h-[46px] w-full items-center justify-center rounded-[10px] bg-green-600 font-bold text-white disabled:bg-slate-300"
          >
            {adding ? "Adding…" : "+ Add Vehicle"}
          </button>
        </div>
      )}

      <p className="mx-5 mb-2 mt-5 text-[13px] font-bold uppercase tracking-wide text-slate-500">Your vehicles</p>

      <div className="mx-4 flex flex-col gap-2.5">
        {vehicles.map((item) => {
          const isLive = tracking && activeVehicleId === item.id;
          return (
            <div
              key={item.id}
              className={`flex items-center rounded-2xl bg-white p-3.5 shadow-sm ${isLive ? "border-[1.5px] border-green-400" : ""}`}
            >
              <div className="mr-3 flex h-11 w-11 items-center justify-center rounded-full bg-accent-light text-xl">
                {vehicleEmoji(item.type)}
              </div>
              <div className="flex-1">
                <p className="text-base font-bold text-slate-800">{item.registrationNumber}</p>
                <p className="mt-0.5 text-[13px] text-slate-500">
                  {item.type}
                  {item.fromLocation && item.toLocation ? ` · ${item.fromLocation} → ${item.toLocation}` : ""}
                </p>
              </div>
              {isLive ? (
                <button onClick={stopTracking} className="rounded-[10px] bg-red-600 px-4 py-2.5 text-[13px] font-bold text-white">
                  ■ Stop
                </button>
              ) : (
                <button
                  onClick={() => startTracking(item.id)}
                  disabled={tracking}
                  className="rounded-[10px] bg-accent px-4 py-2.5 text-[13px] font-bold text-white disabled:bg-slate-300"
                >
                  ▶ Start
                </button>
              )}
            </div>
          );
        })}

        {vehicles.length === 0 && (
          <div className="mt-10 flex flex-col items-center px-10 text-center">
            <div className="mb-2.5 text-4xl">🚐</div>
            <p className="text-base font-semibold text-slate-600">No vehicles yet</p>
            <p className="mt-1 text-[13px] text-slate-400">Add your vehicle above to start sharing your live location.</p>
          </div>
        )}
      </div>

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
    </div>
  );
}
