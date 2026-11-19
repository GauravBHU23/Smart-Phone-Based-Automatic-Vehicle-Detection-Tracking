"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import LiveMap, { MapMarkerSpec } from "../../../components/LiveMap";
import { vehicleApi } from "../../../lib/api/endpoints";
import { useTrackingHub } from "../../../lib/api/useTrackingHub";
import { useAuth } from "../../../lib/auth/AuthContext";
import { GOOGLE_MAPS_API_KEY } from "../../../lib/mapsConfig";
import { RouteStop, VehicleStatus } from "../../../lib/types";

const VEHICLE_ICONS: Record<string, string> = {
  Bus: "🚌",
  Auto: "🛺",
  Taxi: "🚕",
  Bike: "🏍️",
  Truck: "🚚",
  Ambulance: "🚑",
  Other: "🚗",
};

function timeAgo(iso: string | null): string {
  if (!iso) return "—";
  const diffMs = Date.now() - new Date(iso).getTime();
  const sec = Math.floor(diffMs / 1000);
  if (sec < 10) return "just now";
  if (sec < 60) return `${sec}s ago`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  return `${hr}h ago`;
}

export default function VehicleStatusPage() {
  const { id: vehicleId } = useParams<{ id: string }>();
  const { token } = useAuth();
  const [status, setStatus] = useState<VehicleStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [watching, setWatching] = useState(false);
  const [togglingWatch, setTogglingWatch] = useState(false);
  const [watchMessage, setWatchMessage] = useState<string | null>(null);
  const [, setRefreshedAt] = useState(Date.now());

  async function load() {
    try {
      const data = await vehicleApi.getStatus(vehicleId);
      setStatus(data);
    } catch (err) {
      console.warn(err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vehicleId]);

  useEffect(() => {
    const interval = setInterval(() => setRefreshedAt(Date.now()), 15000);
    return () => clearInterval(interval);
  }, []);

  // Fallback polling alongside SignalR — a throttled/backgrounded browser
  // tab can silently drop a WebSocket without the connection looking unhealthy.
  useEffect(() => {
    const interval = setInterval(load, 15000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vehicleId]);

  useTrackingHub({
    onLocationUpdate: (update) => {
      if (update.vehicleId !== vehicleId) return;
      setStatus((prev) =>
        prev
          ? {
              ...prev,
              latitude: update.latitude,
              longitude: update.longitude,
              speedKmh: update.speedKmh,
              lastUpdatedAt: update.recordedAt,
              isActive: true,
            }
          : prev
      );
    },
    onVehicleStarted: (id) => {
      if (id === vehicleId) load();
    },
    onVehicleStopped: (id) => {
      if (id !== vehicleId) return;
      setStatus((prev) => (prev ? { ...prev, isActive: false } : prev));
    },
    onVehicleReachedDestination: (id) => {
      if (id === vehicleId) load();
    },
  });

  async function toggleWatch() {
    if (!token) {
      setWatchMessage("Create a free passenger account to get notified when this vehicle starts, stops, or arrives.");
      return;
    }
    setTogglingWatch(true);
    setWatchMessage(null);
    try {
      if (watching) {
        await vehicleApi.unwatch(token, vehicleId);
        setWatching(false);
      } else {
        await vehicleApi.watch(token, vehicleId);
        setWatching(true);
        setWatchMessage("You're set — we'll show this vehicle's status live while you're watching.");
      }
    } catch (err) {
      setWatchMessage("Could not update alert. " + String(err));
    } finally {
      setTogglingWatch(false);
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-accent border-t-transparent" />
      </div>
    );
  }

  if (!status) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-slate-50 p-6">
        <div className="text-4xl">🔍</div>
        <p className="text-base font-semibold text-slate-600">Vehicle not found</p>
        <Link href="/search" className="rounded-[10px] bg-accent px-5 py-2.5 font-semibold text-white">
          Go back
        </Link>
      </div>
    );
  }

  const stops: RouteStop[] =
    status.stops.length > 0
      ? status.stops
      : ([
          status.fromLocation ? { name: status.fromLocation, latitude: null, longitude: null, reached: false } : null,
          status.toLocation ? { name: status.toLocation, latitude: null, longitude: null, reached: false } : null,
        ].filter(Boolean) as RouteStop[]);

  const lastReachedIndex = stops.reduce((acc, s, i) => (s.reached ? i : acc), -1);

  const routeCoordinates = stops
    .filter((s) => s.latitude != null && s.longitude != null)
    .map((s) => ({ lat: s.latitude!, lng: s.longitude! }));

  const mapCenter = (() => {
    const points = [...routeCoordinates];
    if (status.latitude != null && status.longitude != null) {
      points.push({ lat: status.latitude, lng: status.longitude });
    }
    if (points.length === 0) return null;
    const lats = points.map((p) => p.lat);
    const lngs = points.map((p) => p.lng);
    return {
      lat: (Math.min(...lats) + Math.max(...lats)) / 2,
      lng: (Math.min(...lngs) + Math.max(...lngs)) / 2,
    };
  })();

  const markers: MapMarkerSpec[] = [
    ...stops
      .filter((s) => s.latitude != null && s.longitude != null)
      .map((s, i) => ({
        id: `${s.name}-${i}`,
        lat: s.latitude!,
        lng: s.longitude!,
        label: s.name,
        pinColor: i === 0 ? "green" : i === stops.length - 1 ? "red" : "blue",
      })),
    ...(status.latitude != null && status.longitude != null
      ? [
          {
            id: "vehicle",
            lat: status.latitude,
            lng: status.longitude,
            label: `${VEHICLE_ICONS[status.type] ?? "🚗"} ${status.registrationNumber}`,
          },
        ]
      : []),
  ];

  return (
    <div className="min-h-screen bg-slate-50 pb-10">
      <div className="flex items-center gap-3 border-b border-slate-200 bg-white px-4 py-3 lg:px-8 lg:py-4">
        <Link href="/search" className="p-1.5 text-2xl text-slate-800 transition hover:text-accent">
          ←
        </Link>
        <div className="flex-1">
          <p className="text-lg font-bold text-slate-800 lg:text-xl">{status.registrationNumber}</p>
          <p className="text-[13px] text-slate-500">
            {VEHICLE_ICONS[status.type] ?? "🚗"} {status.type}
          </p>
        </div>
        <button
          onClick={toggleWatch}
          disabled={togglingWatch}
          className={`min-h-[32px] flex-shrink-0 rounded-2xl border px-3 py-2 text-xs font-bold transition lg:px-4 lg:py-2.5 lg:text-sm ${
            watching ? "border-accent bg-accent text-white hover:bg-accent-dark" : "border-accent text-accent hover:bg-accent-light"
          }`}
        >
          {togglingWatch ? "…" : watching ? "🔔 Alerts on" : "🔔 Get alerts"}
        </button>
      </div>

      <div className="mx-auto max-w-2xl p-4 lg:max-w-6xl lg:p-8">
        {watchMessage && (
          <div className="mb-3.5 rounded-xl border border-blue-100 bg-accent-light p-3.5 text-[13px] text-accent-dark lg:mb-6">
            {watchMessage}
          </div>
        )}

        <div className="lg:grid lg:grid-cols-[1.3fr_1fr] lg:items-start lg:gap-6">
          <div className="lg:sticky lg:top-6 lg:flex lg:flex-col lg:gap-6">
            <div
              className={`mb-3.5 flex items-center gap-3 rounded-[14px] p-4 lg:mb-0 ${status.isActive ? "bg-green-100" : "bg-slate-100"}`}
            >
              <div className={`h-2.5 w-2.5 rounded-full ${status.isActive ? "animate-pulse bg-green-600" : "bg-slate-400"}`} />
              <div>
                <p className="text-[15px] font-bold text-slate-800">
                  {status.isActive ? "Live — on the move" : "Not currently tracking"}
                </p>
                {status.isActive && (
                  <p className="mt-0.5 text-[13px] text-slate-600">
                    Last update {timeAgo(status.lastUpdatedAt)}
                    {status.speedKmh != null ? ` · ${Math.round(status.speedKmh)} km/h` : ""}
                  </p>
                )}
              </div>
            </div>

            {mapCenter && (
              <div className="mb-3.5 h-[280px] overflow-hidden rounded-[14px] bg-white shadow-sm lg:mb-0 lg:h-[440px] lg:shadow-md">
                <LiveMap
                  apiKey={GOOGLE_MAPS_API_KEY}
                  center={mapCenter}
                  markers={markers}
                  path={routeCoordinates.length > 1 ? routeCoordinates : undefined}
                />
              </div>
            )}

            {(status.fromLocation || status.toLocation) && (
              <div className="mb-3.5 rounded-[14px] bg-white p-4 shadow-sm lg:mb-0">
                <p className="mb-2.5 text-xs font-bold uppercase tracking-wide text-slate-400">Route</p>
                <div className="flex items-center gap-2.5">
                  <span className="flex-1 text-[15px] font-semibold text-slate-800">{status.fromLocation ?? "—"}</span>
                  <span className="text-accent">→</span>
                  <span className="flex-1 text-[15px] font-semibold text-slate-800">{status.toLocation ?? "—"}</span>
                </div>
              </div>
            )}
          </div>

          <div className="lg:flex lg:flex-col lg:gap-6">
            <div className="mb-3.5 rounded-[14px] bg-white p-4 shadow-sm lg:mb-0">
              <p className="mb-2.5 text-xs font-bold uppercase tracking-wide text-slate-400">Driver</p>
              <p className="text-[17px] font-bold text-slate-800">{status.driverName}</p>
            </div>

            {stops.length > 0 && (
              <div className="mb-3.5 rounded-[14px] bg-white p-4 shadow-sm lg:mb-0">
                <p className="mb-2.5 text-xs font-bold uppercase tracking-wide text-slate-400">Stops</p>
                {stops.map((stop, i) => {
                  const isPast = stop.reached && i < lastReachedIndex;
                  const isCurrent = stop.reached && i === lastReachedIndex;
                  return (
                    <div key={`${stop.name}-${i}`} className="flex">
                      <div className="flex w-6 flex-col items-center">
                        <div
                          className={`h-3 w-3 rounded-full border-2 ${
                            isCurrent
                              ? "border-green-600 bg-green-600"
                              : isPast
                              ? "border-accent bg-accent"
                              : "border-slate-300 bg-slate-200"
                          }`}
                        />
                        {i < stops.length - 1 && (
                          <div className={`min-h-[24px] w-0.5 flex-1 ${isPast ? "bg-accent" : "bg-slate-200"}`} />
                        )}
                      </div>
                      <div className="flex-1 pb-4 pl-2.5">
                        <p className={`text-[15px] ${isCurrent ? "font-bold text-green-600" : "font-medium text-slate-800"}`}>
                          {stop.name}
                        </p>
                        {isCurrent && <p className="mt-0.5 text-xs text-green-600">Vehicle is near here</p>}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            <div className="mb-3.5 rounded-[14px] bg-white p-4 shadow-sm lg:mb-0">
              <p className="mb-2.5 text-xs font-bold uppercase tracking-wide text-slate-400">Trip details</p>
              <div className="flex justify-between py-1.5">
                <span className="text-sm text-slate-500">Started</span>
                <span className="text-sm font-semibold text-slate-800">
                  {status.tripStartedAt ? new Date(status.tripStartedAt).toLocaleTimeString() : "—"}
                </span>
              </div>
              <div className="flex justify-between py-1.5">
                <span className="text-sm text-slate-500">Distance covered</span>
                <span className="text-sm font-semibold text-slate-800">
                  {status.distanceCoveredKm != null ? `${status.distanceCoveredKm} km` : "—"}
                </span>
              </div>
              <div className="flex justify-between py-1.5">
                <span className="text-sm text-slate-500">Current speed</span>
                <span className="text-sm font-semibold text-slate-800">
                  {status.speedKmh != null ? `${Math.round(status.speedKmh)} km/h` : "—"}
                </span>
              </div>
            </div>

            <p className="text-center text-xs text-slate-400 lg:text-left">
              For driver safety, contact details aren&apos;t shown here.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
