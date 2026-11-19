"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import LogoutConfirmModal from "../../components/LogoutConfirmModal";
import Spinner from "../../components/Spinner";
import { adminApi } from "../../lib/api/endpoints";
import { useAuth } from "../../lib/auth/AuthContext";
import { useToast } from "../../lib/toast/ToastContext";
import { AdminDriver, AdminStats, AdminVehicle, Booking, BookingStatus } from "../../lib/types";

type Tab = "overview" | "drivers" | "vehicles" | "bookings";

const STATUS_STYLES: Record<BookingStatus, string> = {
  Pending: "bg-amber-100 text-amber-800",
  Accepted: "bg-green-100 text-green-700",
  Rejected: "bg-red-100 text-red-700",
  Cancelled: "bg-slate-100 text-slate-500",
  Completed: "bg-blue-100 text-blue-700",
};

type ConfirmState =
  | { kind: "driver"; item: AdminDriver }
  | { kind: "vehicle"; item: AdminVehicle }
  | null;

export default function AdminPage() {
  const { token, role, isLoading, signOut } = useAuth();
  const { showToast } = useToast();
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("overview");
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [drivers, setDrivers] = useState<AdminDriver[]>([]);
  const [vehicles, setVehicles] = useState<AdminVehicle[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [logoutConfirmOpen, setLogoutConfirmOpen] = useState(false);
  const [confirmState, setConfirmState] = useState<ConfirmState>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isLoading && (!token || role !== "Admin")) router.replace("/login");
  }, [isLoading, token, role, router]);

  const loadAll = useCallback(async () => {
    if (!token) return;
    try {
      const [statsRes, driversRes, vehiclesRes, bookingsRes] = await Promise.all([
        adminApi.getStats(token),
        adminApi.getDrivers(token),
        adminApi.getVehicles(token),
        adminApi.getBookings(token),
      ]);
      setStats(statsRes);
      setDrivers(driversRes);
      setVehicles(vehiclesRes);
      setBookings(bookingsRes);
    } catch (err) {
      console.warn("Failed to load admin data:", err);
    }
  }, [token]);

  useEffect(() => {
    if (!token) return;
    (async () => {
      setLoading(true);
      await loadAll();
      setLoading(false);
    })();
  }, [token, loadAll]);

  async function runConfirmedAction() {
    if (!token || !confirmState) return;
    const { kind, item } = confirmState;
    setConfirmState(null);
    setBusyId(item.id);
    setError(null);
    try {
      if (kind === "driver") {
        if (item.isSuspended) await adminApi.unsuspendDriver(token, item.id);
        else await adminApi.suspendDriver(token, item.id);
      } else {
        if (item.isSuspended) await adminApi.unsuspendVehicle(token, item.id);
        else await adminApi.suspendVehicle(token, item.id);
      }
      await loadAll();
      showToast(item.isSuspended ? `${kind === "driver" ? "Driver" : "Vehicle"} unsuspended` : `${kind === "driver" ? "Driver" : "Vehicle"} suspended`, "success");
    } catch (err) {
      const message = String(err);
      setError(message);
      showToast(message, "error");
    } finally {
      setBusyId(null);
    }
  }

  const filteredDrivers = drivers.filter(
    (d) => !search.trim() || d.name.toLowerCase().includes(search.toLowerCase()) || d.phone.includes(search)
  );
  const filteredVehicles = vehicles.filter(
    (v) =>
      !search.trim() ||
      v.registrationNumber.toLowerCase().includes(search.toLowerCase()) ||
      v.driverName.toLowerCase().includes(search.toLowerCase())
  );
  const filteredBookings = bookings.filter(
    (b) =>
      !search.trim() ||
      b.vehicleRegistrationNumber.toLowerCase().includes(search.toLowerCase()) ||
      b.passengerName.toLowerCase().includes(search.toLowerCase())
  );

  if (isLoading || loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-accent border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 pb-10">
      <div className="rounded-b-3xl bg-gradient-to-br from-slate-800 to-slate-600 px-5 pb-4 pt-4 lg:rounded-none lg:px-10 lg:pb-6 lg:pt-6">
        <div className="mx-auto max-w-6xl">
          <div className="mb-4 flex items-start justify-between">
            <div>
              <p className="text-[13px] text-white/75">Admin Panel</p>
              <p className="mt-0.5 text-[22px] font-bold text-white lg:text-3xl">Fleet Overview</p>
            </div>
            <button
              onClick={() => setLogoutConfirmOpen(true)}
              className="rounded-full bg-white/15 px-3 py-2 text-[13px] font-semibold text-white transition hover:bg-white/25"
            >
              Log out
            </button>
          </div>
          <div className="flex gap-2 lg:inline-flex lg:w-auto">
            {(["overview", "drivers", "vehicles", "bookings"] as Tab[]).map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`flex-1 rounded-[10px] py-2 text-[13px] font-semibold transition lg:flex-none lg:px-6 ${
                  tab === t ? "bg-white text-slate-800" : "bg-white/10 text-white/80 hover:bg-white/20"
                }`}
              >
                {t === "overview" ? "Overview" : t === "drivers" ? "Drivers" : t === "vehicles" ? "Vehicles" : "Bookings"}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-6xl lg:px-10">
        {error && (
          <div className="mx-4 mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-[13px] text-red-700 lg:mx-0">
            {error}
          </div>
        )}

        {tab === "overview" && stats && (
          <div className="grid grid-cols-2 gap-3 p-4 lg:grid-cols-4 lg:gap-5 lg:px-0 lg:py-8">
            <StatCard label="Active now" value={stats.activeVehiclesNow} color="text-green-600" />
            <StatCard label="Total vehicles" value={stats.totalVehicles} color="text-accent" />
            <StatCard label="Total drivers" value={stats.totalDrivers} color="text-accent" />
            <StatCard label="Total passengers" value={stats.totalPassengers} color="text-accent" />
            <StatCard label="Trips today" value={stats.tripsToday} color="text-purple-600" />
            <StatCard label="Trips all-time" value={stats.tripsAllTime} color="text-purple-600" />
            <StatCard label="Suspended drivers" value={stats.suspendedDrivers} color="text-red-600" />
            <StatCard label="Suspended vehicles" value={stats.suspendedVehicles} color="text-red-600" />
            <StatCard label="Total bookings" value={stats.totalBookings} color="text-indigo-600" />
            <StatCard label="Pending bookings" value={stats.pendingBookings} color="text-amber-600" />
            <StatCard label="Completed rides" value={stats.completedRides} color="text-blue-600" />
          </div>
        )}

        {(tab === "drivers" || tab === "vehicles" || tab === "bookings") && (
          <>
            <div className="px-4 pb-2 pt-3.5 lg:px-0 lg:pt-6">
              <input
                type="text"
                placeholder={
                  tab === "drivers" ? "Search by name or phone" : tab === "vehicles" ? "Search by number or driver" : "Search by number or passenger"
                }
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full rounded-[10px] border border-slate-200 bg-white p-3 text-sm text-slate-800 outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/20 lg:max-w-md"
              />
            </div>

            <div className="grid grid-cols-1 gap-2.5 px-4 lg:grid-cols-2 lg:gap-3 lg:px-0 lg:pb-8">
              {tab === "bookings"
                ? filteredBookings.map((item) => (
                    <div key={item.id} className="rounded-xl bg-white p-3.5 shadow-sm transition hover:shadow-md">
                      <div className="flex items-center justify-between">
                        <p className="text-[15px] font-bold text-slate-800">{item.vehicleRegistrationNumber}</p>
                        <span className={`rounded-lg px-2.5 py-1 text-[11px] font-extrabold tracking-wide ${STATUS_STYLES[item.status]}`}>
                          {item.status}
                        </span>
                      </div>
                      <p className="mt-1.5 text-[13px] text-slate-600">
                        {item.passengerName} · {item.passengerPhone}
                      </p>
                      {item.driverPhone && <p className="mt-0.5 text-[13px] text-slate-500">Driver: {item.driverPhone}</p>}
                      {(item.fromLocation || item.toLocation) && (
                        <p className="mt-1 text-[13px] text-slate-500">
                          {item.fromLocation ?? "—"} → {item.toLocation ?? "—"}
                        </p>
                      )}
                      <p className="mt-1 text-[11px] text-slate-400">{new Date(item.createdAt).toLocaleString()}</p>
                    </div>
                  ))
                : tab === "drivers"
                ? filteredDrivers.map((item) => (
                    <div
                      key={item.id}
                      className={`flex items-center rounded-xl p-3.5 shadow-sm transition hover:shadow-md ${
                        item.isSuspended ? "border-[1.5px] border-red-300 bg-red-50" : "bg-white"
                      }`}
                    >
                      <div className="min-w-0 flex-1">
                        <p className="text-[15px] font-bold text-slate-800">{item.name}</p>
                        <p className="mt-0.5 text-[13px] text-slate-500">
                          {item.phone} · {item.vehicleCount} vehicle{item.vehicleCount === 1 ? "" : "s"}
                        </p>
                        {item.isSuspended && (
                          <p className="mt-1 text-[11px] font-bold tracking-wide text-red-600">SUSPENDED</p>
                        )}
                      </div>
                      <button
                        onClick={() => setConfirmState({ kind: "driver", item })}
                        disabled={busyId === item.id}
                        className={`flex min-w-[90px] flex-shrink-0 items-center justify-center rounded-lg px-3.5 py-2 text-xs font-bold text-white transition ${
                          item.isSuspended ? "bg-green-600 hover:bg-green-700" : "bg-red-600 hover:bg-red-700"
                        } disabled:opacity-60`}
                      >
                        {busyId === item.id ? <Spinner className="h-3.5 w-3.5 border-2 border-white border-t-transparent" /> : item.isSuspended ? "Unsuspend" : "Suspend"}
                      </button>
                    </div>
                  ))
                : filteredVehicles.map((item) => (
                    <div
                      key={item.id}
                      className={`flex items-center rounded-xl p-3.5 shadow-sm transition hover:shadow-md ${
                        item.isSuspended ? "border-[1.5px] border-red-300 bg-red-50" : "bg-white"
                      }`}
                    >
                      <div className="min-w-0 flex-1">
                        <p className="text-[15px] font-bold text-slate-800">{item.registrationNumber}</p>
                        <p className="mt-0.5 text-[13px] text-slate-500">
                          {item.type} · {item.driverName}
                          {item.isActive ? " · live" : ""}
                        </p>
                        {item.isSuspended && (
                          <p className="mt-1 text-[11px] font-bold tracking-wide text-red-600">SUSPENDED</p>
                        )}
                      </div>
                      <button
                        onClick={() => setConfirmState({ kind: "vehicle", item })}
                        disabled={busyId === item.id}
                        className={`flex min-w-[90px] flex-shrink-0 items-center justify-center rounded-lg px-3.5 py-2 text-xs font-bold text-white transition ${
                          item.isSuspended ? "bg-green-600 hover:bg-green-700" : "bg-red-600 hover:bg-red-700"
                        } disabled:opacity-60`}
                      >
                        {busyId === item.id ? <Spinner className="h-3.5 w-3.5 border-2 border-white border-t-transparent" /> : item.isSuspended ? "Unsuspend" : "Suspend"}
                      </button>
                    </div>
                  ))}

              {tab === "drivers" && filteredDrivers.length === 0 && (
                <p className="col-span-full mt-10 text-center text-slate-400">No drivers found.</p>
              )}
              {tab === "vehicles" && filteredVehicles.length === 0 && (
                <p className="col-span-full mt-10 text-center text-slate-400">No vehicles found.</p>
              )}
              {tab === "bookings" && filteredBookings.length === 0 && (
                <p className="col-span-full mt-10 text-center text-slate-400">No bookings found.</p>
              )}
            </div>
          </>
        )}
      </div>

      <LogoutConfirmModal
        visible={logoutConfirmOpen}
        onCancel={() => setLogoutConfirmOpen(false)}
        onConfirm={() => {
          setLogoutConfirmOpen(false);
          signOut();
          showToast("Logged out", "info");
          router.push("/login");
        }}
      />

      {confirmState && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 px-8"
          onClick={() => setConfirmState(null)}
        >
          <div className="w-full max-w-sm rounded-[20px] bg-white p-6 text-center shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <h2 className="mb-1.5 text-lg font-extrabold text-slate-800">
              {confirmState.item.isSuspended
                ? `Unsuspend ${confirmState.kind}?`
                : `Suspend ${confirmState.kind}?`}
            </h2>
            <p className="mb-5 text-[13px] leading-[19px] text-slate-500">
              {confirmState.kind === "driver"
                ? confirmState.item.isSuspended
                  ? `${confirmState.item.name} will be able to log in and drive again.`
                  : `${confirmState.item.name} will be logged out immediately and can't log in or drive until unsuspended.`
                : confirmState.item.isSuspended
                ? `${confirmState.item.registrationNumber} will be trackable again.`
                : `${confirmState.item.registrationNumber} will stop sharing its location immediately and can't be started again until unsuspended.`}
            </p>
            <div className="flex gap-2.5">
              <button
                onClick={() => setConfirmState(null)}
                className="flex-1 rounded-xl bg-slate-100 py-3 text-sm font-bold text-slate-700"
              >
                Cancel
              </button>
              <button
                onClick={runConfirmedAction}
                className={`flex-1 rounded-xl py-3 text-sm font-bold text-white ${
                  confirmState.item.isSuspended ? "bg-green-600" : "bg-red-600"
                }`}
              >
                {confirmState.item.isSuspended ? "Unsuspend" : "Suspend"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function StatCard({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="rounded-[14px] bg-white p-4 shadow-sm transition hover:shadow-md lg:p-6">
      <p className={`text-[28px] font-extrabold lg:text-4xl ${color}`}>{value}</p>
      <p className="mt-1 text-[13px] text-slate-500 lg:text-sm">{label}</p>
    </div>
  );
}
