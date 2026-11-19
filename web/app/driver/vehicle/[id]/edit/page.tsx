"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import PlaceAutocomplete from "../../../../../components/PlaceAutocomplete";
import Spinner from "../../../../../components/Spinner";
import { ApiError } from "../../../../../lib/api/client";
import { vehicleApi } from "../../../../../lib/api/endpoints";
import { useAuth } from "../../../../../lib/auth/AuthContext";
import { GOOGLE_MAPS_API_KEY } from "../../../../../lib/mapsConfig";
import { useToast } from "../../../../../lib/toast/ToastContext";
import { PlaceSelection, Vehicle, VehicleType } from "../../../../../lib/types";

const VEHICLE_TYPES: VehicleType[] = ["Bus", "Auto", "Taxi", "Bike", "Truck", "Ambulance", "Other"];

let nextStopKey = 0;

async function resolveCoordinates(place: PlaceSelection | null): Promise<{ latitude?: number; longitude?: number }> {
  if (!place) return {};
  if (place.id !== null) return {};
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

export default function EditVehiclePage() {
  const { id: vehicleId } = useParams<{ id: string }>();
  const router = useRouter();
  const { token, role, isLoading } = useAuth();
  const { showToast } = useToast();
  const [vehicle, setVehicle] = useState<Vehicle | null>(null);
  const [loadingVehicle, setLoadingVehicle] = useState(true);
  const [regNumber, setRegNumber] = useState("");
  const [vehicleType, setVehicleType] = useState<VehicleType>("Bus");
  const [fromPlace, setFromPlace] = useState<PlaceSelection | null>(null);
  const [toPlace, setToPlace] = useState<PlaceSelection | null>(null);
  const [stops, setStops] = useState<{ key: number; place: PlaceSelection | null }[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!isLoading && (!token || role !== "Driver")) router.replace("/login");
  }, [isLoading, token, role, router]);

  useEffect(() => {
    if (!token) return;
    vehicleApi
      .myVehicles(token)
      .then((list) => {
        const found = list.find((v) => v.id === vehicleId);
        if (found) {
          setVehicle(found);
          setRegNumber(found.registrationNumber);
          setVehicleType(found.type);
          if (found.fromLocation) setFromPlace({ id: null, name: found.fromLocation });
          if (found.toLocation) setToPlace({ id: null, name: found.toLocation });
          setStops(found.stops.map((s) => ({ key: nextStopKey++, place: { id: null, name: s.name } })));
        }
      })
      .catch((err) => console.warn(err))
      .finally(() => setLoadingVehicle(false));
  }, [token, vehicleId]);

  function addStopRow() {
    setStops((prev) => [...prev, { key: nextStopKey++, place: null }]);
  }

  function removeStopRow(key: number) {
    setStops((prev) => prev.filter((s) => s.key !== key));
  }

  function updateStopRow(key: number, place: PlaceSelection) {
    setStops((prev) => prev.map((s) => (s.key === key ? { ...s, place } : s)));
  }

  async function handleSave() {
    if (!token || !regNumber) return;
    setSaving(true);
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

      await vehicleApi.updateVehicle(token, vehicleId, regNumber, vehicleType, {
        fromLocation: fromPlace?.name.trim() || undefined,
        toLocation: toPlace?.name.trim() || undefined,
        fromPlaceId: fromPlace?.id ?? undefined,
        toPlaceId: toPlace?.id ?? undefined,
        destinationLatitude: toCoords.latitude,
        destinationLongitude: toCoords.longitude,
        stops: stopInputs.length > 0 ? stopInputs : undefined,
      });

      showToast("Vehicle updated", "success");
      router.push("/driver");
    } catch (err) {
      showToast(err instanceof ApiError ? err.message : String(err), "error");
    } finally {
      setSaving(false);
    }
  }

  if (isLoading || loadingVehicle) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-accent border-t-transparent" />
      </div>
    );
  }

  if (!vehicle) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-slate-50 p-6 text-center">
        <div className="text-4xl">🔍</div>
        <p className="text-base font-semibold text-slate-600">Vehicle not found</p>
        <Link href="/driver" className="rounded-[10px] bg-accent px-5 py-2.5 font-semibold text-white">
          Go back
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 pb-10">
      <div className="flex items-center gap-3 border-b border-slate-200 bg-white px-4 py-3">
        <Link href="/driver" className="p-1.5 text-2xl text-slate-800 transition hover:text-accent">
          ←
        </Link>
        <div>
          <p className="text-lg font-bold text-slate-800">Edit vehicle</p>
          <p className="text-[13px] text-slate-500">{vehicle.registrationNumber}</p>
        </div>
      </div>

      <div className="mx-auto max-w-md p-5">
        <label className="mb-1.5 mt-3 block text-xs font-bold uppercase tracking-wide text-slate-500">
          Vehicle number
        </label>
        <input
          type="text"
          value={regNumber}
          onChange={(e) => setRegNumber(e.target.value.toUpperCase())}
          className="w-full rounded-[10px] border border-slate-200 bg-white p-3.5 text-[15px] text-slate-800 outline-none focus:border-accent"
        />

        <label className="mb-1.5 mt-3 block text-xs font-bold uppercase tracking-wide text-slate-500">Type</label>
        <div className="flex flex-wrap gap-2">
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

        <label className="mb-1.5 mt-5 block text-xs font-bold uppercase tracking-wide text-slate-500">From</label>
        <PlaceAutocomplete value={fromPlace} onChange={setFromPlace} placeholder="From (e.g. Civil Lines)" allowNew />

        <label className="mb-1.5 mt-3 block text-xs font-bold uppercase tracking-wide text-slate-500">To</label>
        <PlaceAutocomplete value={toPlace} onChange={setToPlace} placeholder="To (e.g. Naini)" allowNew />

        {stops.map((stop, i) => (
          <div key={stop.key} className="mt-3 flex items-center gap-2">
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
              className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-red-50 font-bold text-red-600 transition hover:bg-red-100"
            >
              ✕
            </button>
          </div>
        ))}

        <button onClick={addStopRow} className="mt-3 text-[13px] font-semibold text-accent">
          + Add a stop
        </button>

        <button
          onClick={handleSave}
          disabled={!regNumber || saving}
          className="mt-8 flex min-h-[50px] w-full items-center justify-center rounded-[10px] bg-accent text-base font-bold text-white transition hover:bg-accent-dark disabled:bg-slate-300"
        >
          {saving ? (
            <>
              <Spinner />
              <span className="ml-2">Saving…</span>
            </>
          ) : (
            "Save changes"
          )}
        </button>
      </div>
    </div>
  );
}
