"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import LiveMap, { MapTheme } from "../../../components/LiveMap";
import LogoutConfirmModal from "../../../components/LogoutConfirmModal";
import { vehicleApi } from "../../../lib/api/endpoints";
import { useTrackingHub } from "../../../lib/api/useTrackingHub";
import { useAuth } from "../../../lib/auth/AuthContext";
import { GOOGLE_MAPS_API_KEY } from "../../../lib/mapsConfig";
import { useToast } from "../../../lib/toast/ToastContext";
import { VehicleType, VehicleWithLocation } from "../../../lib/types";

const VEHICLE_TYPES: (VehicleType | "All")[] = ["All", "Bus", "Auto", "Taxi", "Bike", "Truck", "Ambulance", "Other"];

const VEHICLE_MARKER_ICON: Record<string, string> = {
  Bus: "🚌",
  Auto: "🛺",
  Taxi: "🚕",
  Bike: "🏍️",
  Truck: "🚚",
  Ambulance: "🚑",
  Other: "🚗",
};

const MAP_THEMES: { value: MapTheme; label: string; icon: string }[] = [
  { value: "light", label: "Light", icon: "☀️" },
  { value: "dark", label: "Dark", icon: "🌙" },
  { value: "standard", label: "Standard", icon: "🗺️" },
  { value: "satellite", label: "Satellite", icon: "🛰️" },
  { value: "hybrid", label: "Hybrid", icon: "🌐" },
];

const DEFAULT_CENTER = { lat: 25.4358, lng: 81.8463 };

export default function PassengerMapPage() {
  const { token, name, role, isLoading, signOut } = useAuth();
  const { showToast } = useToast();
  const router = useRouter();
  const [vehicles, setVehicles] = useState<Record<string, VehicleWithLocation>>({});
  const [filter, setFilter] = useState<VehicleType | "All">("All");
  const [center, setCenter] = useState(DEFAULT_CENTER);
  const [mapTheme, setMapTheme] = useState<MapTheme>("light");
  const [menuOpen, setMenuOpen] = useState(false);
  const [logoutConfirmOpen, setLogoutConfirmOpen] = useState(false);
  const [listOpen, setListOpen] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isLoading && (!token || role !== "Passenger")) router.replace("/login");
  }, [isLoading, token, role, router]);

  useEffect(() => {
    if (!("geolocation" in navigator)) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => setCenter({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => {}
    );
  }, []);

  async function loadActiveVehicles() {
    setLoading(true);
    try {
      const list = await vehicleApi.activeVehicles(filter === "All" ? undefined : filter);
      const map: Record<string, VehicleWithLocation> = {};
      list.forEach((v) => (map[v.id] = v));
      setVehicles(map);
    } catch (err) {
      console.warn("Failed to load active vehicles:", err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadActiveVehicles();
    const interval = setInterval(loadActiveVehicles, 15000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter]);

  useTrackingHub({
    onLocationUpdate: (update) => {
      setVehicles((prev) => {
        const existing = prev[update.vehicleId];
        if (!existing) {
          loadActiveVehicles();
          return prev;
        }
        return {
          ...prev,
          [update.vehicleId]: {
            ...existing,
            latitude: update.latitude,
            longitude: update.longitude,
            speedKmh: update.speedKmh,
            lastUpdatedAt: update.recordedAt,
          },
        };
      });
    },
    onVehicleStarted: () => loadActiveVehicles(),
    onVehicleStopped: (vehicleId) => {
      setVehicles((prev) => {
        const { [vehicleId]: _removed, ...rest } = prev;
        return rest;
      });
    },
  });

  const markers = Object.values(vehicles).filter((v) => v.latitude != null && v.longitude != null);

  function openVehicle(vehicleId: string) {
    setListOpen(false);
    router.push(`/vehicle/${vehicleId}`);
  }

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-white">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-accent border-t-transparent" />
      </div>
    );
  }

  const vehicleListContent = (
    <>
      <div className="mb-2.5 hidden items-center justify-between px-1 lg:flex">
        <p className="text-sm font-bold text-slate-800">
          {markers.length} vehicle{markers.length === 1 ? "" : "s"} nearby
        </p>
      </div>
      {markers.map((item) => (
        <button
          key={item.id}
          onClick={() => openVehicle(item.id)}
          className="flex w-full items-center border-b border-slate-100 py-3 text-left transition hover:bg-slate-50 lg:rounded-xl lg:border-b-0 lg:px-2 lg:py-3"
        >
          <div className="mr-3 flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-accent-light text-lg">
            {VEHICLE_MARKER_ICON[item.type] ?? "🚗"}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[15px] font-bold text-slate-800">{item.registrationNumber}</p>
            <p className="mt-0.5 truncate text-xs text-slate-500">
              {item.type}
              {item.fromLocation && item.toLocation ? ` · ${item.fromLocation} → ${item.toLocation}` : ""}
            </p>
          </div>
          {item.speedKmh != null && (
            <span className="mr-1.5 flex-shrink-0 text-xs font-bold text-green-600">{Math.round(item.speedKmh)} km/h</span>
          )}
          <span className="text-xl text-slate-300">›</span>
        </button>
      ))}
      {markers.length === 0 && !loading && (
        <p className="hidden px-1 py-6 text-center text-sm text-slate-400 lg:block">
          No vehicles are sharing their location right now.
        </p>
      )}
    </>
  );

  return (
    <div className="flex h-[calc(100vh-2.5rem)] flex-col bg-white lg:flex-row-reverse">
      <div className="hidden w-[360px] flex-shrink-0 flex-col border-l border-slate-200 bg-white lg:flex">
        <div className="border-b border-slate-100 px-5 pb-4 pt-6">
          <div className="mb-3 flex items-center justify-between">
            <div>
              <p className="text-xl font-extrabold text-slate-800">Live Map</p>
              <div className="mt-0.5 flex items-center gap-1.5">
                <span className="h-[7px] w-[7px] animate-pulse rounded-full bg-green-600" />
                <span className="text-xs font-medium text-slate-500">
                  {loading ? "Updating…" : `${markers.length} vehicle${markers.length === 1 ? "" : "s"} live`}
                </span>
              </div>
            </div>
            <button
              onClick={() => setMenuOpen((v) => !v)}
              className="flex h-[38px] w-[38px] items-center justify-center rounded-full bg-slate-100 text-xl font-bold text-slate-700 transition hover:bg-slate-200"
            >
              ⋮
            </button>
          </div>
          <div className="mb-3 flex gap-2">
            <Link
              href="/search"
              className="flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-blue-100 bg-accent-light py-2 text-[13px] font-bold text-accent transition hover:bg-accent-light/70"
            >
              🔍 Search
            </Link>
            <Link
              href="/passenger/bookings"
              className="flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-blue-100 bg-accent-light py-2 text-[13px] font-bold text-accent transition hover:bg-accent-light/70"
            >
              📋 My Bookings
            </Link>
          </div>
          <div className="flex flex-wrap gap-2">
            {VEHICLE_TYPES.map((t) => (
              <button
                key={t}
                onClick={() => setFilter(t)}
                className={`flex-shrink-0 rounded-2xl border px-3.5 py-1.5 text-[13px] transition ${
                  filter === t ? "border-accent bg-accent font-bold text-white" : "border-blue-100 bg-accent-light text-accent hover:border-accent/50"
                }`}
              >
                {t}
              </button>
            ))}
          </div>
        </div>
        <div className="flex-1 overflow-y-auto px-3 py-3">{vehicleListContent}</div>
      </div>

      <div className="flex flex-1 flex-col lg:hidden">
        <div className="border-b border-slate-100 bg-white pb-2 pt-3">
          <div className="mb-2.5 flex items-center justify-between px-4">
            <div>
              <p className="text-xl font-extrabold text-slate-800">Live Map</p>
              <div className="mt-0.5 flex items-center gap-1.5">
                <span className="h-[7px] w-[7px] rounded-full bg-green-600" />
                <span className="text-xs font-medium text-slate-500">
                  {loading ? "Updating…" : `${markers.length} vehicle${markers.length === 1 ? "" : "s"} live`}
                </span>
              </div>
            </div>
            <button
              onClick={() => setMenuOpen((v) => !v)}
              className="flex h-[38px] w-[38px] items-center justify-center rounded-full bg-slate-100 text-xl font-bold text-slate-700"
            >
              ⋮
            </button>
          </div>

          <div className="mb-2 flex gap-2 px-4">
            <Link
              href="/search"
              className="flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-blue-100 bg-accent-light py-2 text-[13px] font-bold text-accent"
            >
              🔍 Search
            </Link>
            <Link
              href="/passenger/bookings"
              className="flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-blue-100 bg-accent-light py-2 text-[13px] font-bold text-accent"
            >
              📋 My Bookings
            </Link>
          </div>

          <div className="flex gap-2 overflow-x-auto px-4 pb-1">
            {VEHICLE_TYPES.map((t) => (
              <button
                key={t}
                onClick={() => setFilter(t)}
                className={`flex-shrink-0 rounded-2xl border px-3.5 py-1.5 text-[13px] ${
                  filter === t ? "border-accent bg-accent font-bold text-white" : "border-blue-100 bg-accent-light text-accent"
                }`}
              >
                {t}
              </button>
            ))}
          </div>
        </div>

        <div className="relative flex-1">
          <LiveMap
            apiKey={GOOGLE_MAPS_API_KEY}
            center={center}
            theme={mapTheme}
            markers={markers.map((v) => ({
              id: v.id,
              lat: v.latitude!,
              lng: v.longitude!,
              label: `${VEHICLE_MARKER_ICON[v.type] ?? ""} ${v.registrationNumber}`,
              onClick: () => openVehicle(v.id),
            }))}
          />

          {loading && (
            <div className="absolute left-0 right-0 top-3 flex justify-center">
              <div className="flex items-center gap-2 rounded-full bg-white px-4 py-2.5 shadow-lg">
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-accent border-t-transparent" />
                <span className="text-[13px] font-semibold text-slate-700">Finding nearby vehicles…</span>
              </div>
            </div>
          )}
        </div>

        <button
          onClick={() => setListOpen(true)}
          disabled={markers.length === 0 || loading}
          className="flex min-h-[48px] items-center justify-center gap-2 border-t border-slate-200 bg-white p-3.5"
        >
          {!loading && (
            <>
              <span className="text-center font-semibold text-slate-700">
                {markers.length > 0
                  ? `${markers.length} active vehicle${markers.length === 1 ? "" : "s"} nearby`
                  : "No vehicles are sharing their location right now"}
              </span>
              {markers.length > 0 && <span className="text-[11px] text-slate-400">▲</span>}
            </>
          )}
        </button>
      </div>

      <div className="relative hidden flex-1 lg:block">
        <LiveMap
          apiKey={GOOGLE_MAPS_API_KEY}
          center={center}
          theme={mapTheme}
          markers={markers.map((v) => ({
            id: v.id,
            lat: v.latitude!,
            lng: v.longitude!,
            label: `${VEHICLE_MARKER_ICON[v.type] ?? ""} ${v.registrationNumber}`,
            onClick: () => openVehicle(v.id),
          }))}
        />
        {loading && (
          <div className="absolute left-0 right-0 top-3 flex justify-center">
            <div className="flex items-center gap-2 rounded-full bg-white px-4 py-2.5 shadow-lg">
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-accent border-t-transparent" />
              <span className="text-[13px] font-semibold text-slate-700">Finding nearby vehicles…</span>
            </div>
          </div>
        )}
      </div>

      {menuOpen && (
        <div className="fixed inset-0 z-40" onClick={() => setMenuOpen(false)}>
          <div
            className="absolute right-2.5 top-[60px] min-w-[200px] rounded-2xl bg-white py-2 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <p className="px-4 py-2 text-xs font-bold uppercase tracking-wide text-slate-400">Map type</p>
            {MAP_THEMES.map((m) => (
              <button
                key={m.value}
                onClick={() => {
                  setMapTheme(m.value);
                  setMenuOpen(false);
                }}
                className="flex w-full items-center justify-between px-4 py-2.5 transition hover:bg-slate-50"
              >
                <span className="flex items-center gap-2.5">
                  <span className="w-5 text-center text-base">{m.icon}</span>
                  <span className={`text-[15px] ${mapTheme === m.value ? "font-bold text-accent" : "text-slate-700"}`}>
                    {m.label}
                  </span>
                </span>
                {mapTheme === m.value && <span className="font-bold text-accent">✓</span>}
              </button>
            ))}

            <div className="my-1 h-px bg-slate-100" />
            <p className="px-4 py-2 text-xs font-bold uppercase tracking-wide text-slate-400">Signed in as {name}</p>
            <button
              onClick={() => {
                setMenuOpen(false);
                setLogoutConfirmOpen(true);
              }}
              className="flex w-full items-center gap-2.5 px-4 py-2.5 transition hover:bg-slate-50"
            >
              <span className="w-5 text-center text-base">⏻</span>
              <span className="text-[15px] font-semibold text-red-600">Log out</span>
            </button>
          </div>
        </div>
      )}

      <LogoutConfirmModal
        visible={logoutConfirmOpen}
        message="You'll need to log in again to see live vehicles and alerts."
        onCancel={() => setLogoutConfirmOpen(false)}
        onConfirm={() => {
          setLogoutConfirmOpen(false);
          signOut();
          showToast("Logged out", "info");
          router.push("/login");
        }}
      />

      {listOpen && (
        <div className="fixed inset-0 z-50 flex items-end bg-slate-900/40 lg:hidden" onClick={() => setListOpen(false)}>
          <div
            className="max-h-[65%] w-full overflow-y-auto rounded-t-3xl bg-white px-4 pt-2.5 pb-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mx-auto mb-3.5 h-1 w-10 rounded-full bg-slate-200" />
            <p className="mb-2.5 px-1 text-[15px] font-extrabold text-slate-800">
              {markers.length} vehicle{markers.length === 1 ? "" : "s"} nearby
            </p>
            {markers.map((item) => (
              <button
                key={item.id}
                onClick={() => openVehicle(item.id)}
                className="flex w-full items-center border-b border-slate-100 py-3 text-left"
              >
                <div className="mr-3 flex h-10 w-10 items-center justify-center rounded-full bg-accent-light text-lg">
                  {VEHICLE_MARKER_ICON[item.type] ?? "🚗"}
                </div>
                <div className="flex-1">
                  <p className="text-[15px] font-bold text-slate-800">{item.registrationNumber}</p>
                  <p className="mt-0.5 text-xs text-slate-500">
                    {item.type}
                    {item.fromLocation && item.toLocation ? ` · ${item.fromLocation} → ${item.toLocation}` : ""}
                  </p>
                </div>
                {item.speedKmh != null && (
                  <span className="mr-1.5 text-xs font-bold text-green-600">{Math.round(item.speedKmh)} km/h</span>
                )}
                <span className="text-xl text-slate-300">›</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
