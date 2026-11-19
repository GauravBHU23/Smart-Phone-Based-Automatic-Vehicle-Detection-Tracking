"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import PlaceAutocomplete from "../../components/PlaceAutocomplete";
import Spinner from "../../components/Spinner";
import { ApiError } from "../../lib/api/client";
import { vehicleApi } from "../../lib/api/endpoints";
import { useAuth } from "../../lib/auth/AuthContext";
import { useToast } from "../../lib/toast/ToastContext";
import { Place, RouteSearchResult } from "../../lib/types";

const VEHICLE_ICONS: Record<string, string> = {
  Bus: "🚌",
  Auto: "🛺",
  Taxi: "🚕",
  Bike: "🏍️",
  Truck: "🚚",
  Ambulance: "🚑",
  Other: "🚗",
};

type SearchMode = "number" | "route";

export default function SearchPage() {
  const { token, name, signOut } = useAuth();
  const { showToast } = useToast();
  const router = useRouter();
  const [mode, setMode] = useState<SearchMode>("number");
  const [regNumber, setRegNumber] = useState("");
  const [fromPlace, setFromPlace] = useState<Place | { id: null; name: string } | null>(null);
  const [toPlace, setToPlace] = useState<Place | { id: null; name: string } | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [routeResults, setRouteResults] = useState<RouteSearchResult[] | null>(null);

  function switchMode(next: SearchMode) {
    setMode(next);
    setError(null);
    setRouteResults(null);
  }

  async function handleSearchByNumber() {
    if (!regNumber.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const result = await vehicleApi.searchByRegistrationNumber(regNumber.trim());
      router.push(`/vehicle/${result.id}`);
    } catch (err) {
      if (err instanceof ApiError && err.status === 404) {
        setError(`No vehicle found with number "${regNumber.trim().toUpperCase()}". Check the number and try again.`);
      } else {
        setError("Something went wrong. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  }

  async function handleSearchByRoute() {
    if (!fromPlace?.id || !toPlace?.id) return;
    setLoading(true);
    setError(null);
    setRouteResults(null);
    try {
      const results = await vehicleApi.searchByRoute(fromPlace.id, toPlace.id);
      setRouteResults(results);
      if (results.length === 0) {
        setError("No vehicles found on this route yet. Try different places, or check back later.");
      }
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  const canSearchByNumber = !!regNumber.trim() && !loading;
  const canSearchByRoute = !!fromPlace?.id && !!toPlace?.id && !loading;

  return (
    <div className="flex min-h-screen flex-col bg-slate-50 pb-10 lg:pb-0">
      <div className="relative pt-8 text-center lg:bg-gradient-to-br lg:from-accent-dark lg:to-accent lg:pb-16 lg:pt-10 lg:text-white">
        {token ? (
          <button
            onClick={() => {
              signOut();
              showToast("Logged out", "info");
              router.push("/login");
            }}
            className="absolute right-4 top-4 flex items-center gap-1.5 rounded-full bg-slate-100 px-3 py-2 text-[13px] font-semibold text-red-600 lg:bg-white/15 lg:text-white lg:hover:bg-white/25"
          >
            <span>⏻</span> Logout
          </button>
        ) : (
          <Link
            href="/login"
            className="absolute right-4 top-4 flex items-center gap-1.5 rounded-full bg-slate-100 px-4 py-2 text-[13px] font-semibold text-slate-700 lg:bg-white/15 lg:text-white lg:hover:bg-white/25"
          >
            Log in
          </Link>
        )}
        <div className="mx-auto max-w-sm px-8 lg:max-w-xl">
          <div className="mb-2 text-[40px] lg:text-6xl">🚌</div>
          <h1 className="text-[22px] font-bold text-slate-800 lg:text-[36px] lg:font-extrabold lg:text-white">
            Find any vehicle
          </h1>
          <p className="mt-2 hidden text-white/85 lg:block">
            Search by registration number, or From → To like checking a train&apos;s status.
          </p>
        </div>
      </div>
      {token && <p className="-mt-2 mb-2 text-center text-xs text-slate-400 lg:hidden">Signed in as {name}</p>}
      {!token && (
        <p className="mb-2 text-center text-xs text-slate-400 lg:hidden">
          <Link href="/login" className="font-semibold text-accent">
            Log in
          </Link>{" "}
          to register a vehicle or track your trips
        </p>
      )}

      <div className="mx-auto -mt-0 w-full max-w-md px-5 lg:-mt-10 lg:flex lg:max-w-2xl lg:flex-1 lg:flex-col lg:justify-center lg:pb-16">
        <div className="lg:rounded-[22px] lg:bg-white lg:p-8 lg:shadow-xl">
          <div className="mx-auto mb-4 mt-4 flex max-w-md gap-1 rounded-xl bg-slate-100 p-1 lg:mx-0 lg:mt-0 lg:max-w-xs">
            <button
              onClick={() => switchMode("number")}
              className={`flex-1 rounded-[9px] py-2.5 text-[13px] font-semibold transition ${
                mode === "number" ? "bg-white text-slate-800 shadow-sm" : "text-slate-500 hover:text-slate-700"
              }`}
            >
              By number
            </button>
            <button
              onClick={() => switchMode("route")}
              className={`flex-1 rounded-[9px] py-2.5 text-[13px] font-semibold transition ${
                mode === "route" ? "bg-white text-slate-800 shadow-sm" : "text-slate-500 hover:text-slate-700"
              }`}
            >
              By route
            </button>
          </div>

          {mode === "number" ? (
            <div className="flex flex-col gap-3 lg:flex-row">
              <input
                type="text"
                placeholder="e.g. UP70AB1234"
                value={regNumber}
                onChange={(e) => {
                  setRegNumber(e.target.value.toUpperCase());
                  setError(null);
                }}
                onKeyDown={(e) => e.key === "Enter" && canSearchByNumber && handleSearchByNumber()}
                className="rounded-[14px] border-[1.5px] border-slate-200 bg-white p-4 text-[17px] font-semibold uppercase tracking-wide text-slate-800 outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/20 lg:flex-1"
              />
              <button
                onClick={handleSearchByNumber}
                disabled={!canSearchByNumber}
                className="flex min-h-[52px] items-center justify-center rounded-[14px] bg-accent text-base font-bold text-white transition hover:bg-accent-dark disabled:bg-slate-300 disabled:hover:bg-slate-300 lg:px-8"
              >
                {loading ? (
                  <>
                    <Spinner />
                    <span className="ml-2">Searching…</span>
                  </>
                ) : (
                  "Search"
                )}
              </button>
            </div>
          ) : (
            <div className="flex flex-col gap-3 lg:flex-row">
              <div className="flex flex-1 rounded-[14px] border-[1.5px] border-slate-200 bg-white p-4">
                <div className="flex w-4 flex-col items-center pt-2.5">
                  <div className="h-2.5 w-2.5 rounded-full bg-green-600" />
                  <div className="my-1.5 min-h-[32px] w-0.5 flex-1 bg-slate-300" />
                  <div className="h-2.5 w-2.5 rounded-full bg-red-600" />
                </div>
                <div className="ml-2.5 flex-1">
                  <PlaceAutocomplete
                    value={fromPlace}
                    onChange={(place) => {
                      setFromPlace(place);
                      setError(null);
                    }}
                    placeholder="From (e.g. Civil Lines)"
                    bare
                  />
                  <div className="h-px bg-slate-100" />
                  <PlaceAutocomplete
                    value={toPlace}
                    onChange={(place) => {
                      setToPlace(place);
                      setError(null);
                    }}
                    placeholder="To (e.g. Naini)"
                    bare
                  />
                </div>
              </div>
              <button
                onClick={handleSearchByRoute}
                disabled={!canSearchByRoute}
                className="flex min-h-[52px] items-center justify-center rounded-[14px] bg-accent text-base font-bold text-white transition hover:bg-accent-dark disabled:bg-slate-300 disabled:hover:bg-slate-300 lg:px-8"
              >
                {loading ? (
                  <>
                    <Spinner />
                    <span className="ml-2">Searching…</span>
                  </>
                ) : (
                  "Find vehicles"
                )}
              </button>
            </div>
          )}

          {error && (
            <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3.5">
              <p className="text-[13px] text-red-700">{error}</p>
            </div>
          )}

          {mode === "route" && routeResults && routeResults.length > 0 && (
            <div className="mt-4 grid grid-cols-1 gap-2.5 lg:grid-cols-2 lg:gap-3">
              {routeResults.map((item) => (
                <Link
                  key={item.id}
                  href={`/vehicle/${item.id}`}
                  className="flex items-center rounded-[14px] bg-white p-3.5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md lg:border lg:border-slate-100"
                >
                  <div className="mr-3 flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-full bg-accent-light text-xl">
                    {VEHICLE_ICONS[item.type] ?? "🚗"}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-[15px] font-bold text-slate-800">{item.registrationNumber}</span>
                      {item.isActive && (
                        <span className="flex items-center gap-1 rounded-lg bg-green-100 px-1.5 py-0.5">
                          <span className="h-1.5 w-1.5 rounded-full bg-green-600" />
                          <span className="text-[10px] font-extrabold tracking-wide text-green-600">LIVE</span>
                        </span>
                      )}
                    </div>
                    <p className="mt-0.5 truncate text-[13px] text-slate-600">
                      {item.fromLocation ?? "—"} → {item.toLocation ?? "—"}
                    </p>
                    <p className="mt-0.5 truncate text-xs text-slate-400">Driver: {item.driverName}</p>
                  </div>
                  <span className="text-xl text-slate-300">›</span>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
