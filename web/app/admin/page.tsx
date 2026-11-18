"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import LogoutConfirmModal from "../../components/LogoutConfirmModal";
import { adminApi } from "../../lib/api/endpoints";
import { useAuth } from "../../lib/auth/AuthContext";
import { AdminDriver, AdminStats, AdminVehicle } from "../../lib/types";

type Tab = "overview" | "drivers" | "vehicles";

type ConfirmState =
  | { kind: "driver"; item: AdminDriver }
  | { kind: "vehicle"; item: AdminVehicle }
  | null;

export default function AdminPage() {
  const { token, role, isLoading, signOut } = useAuth();
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("overview");
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [drivers, setDrivers] = useState<AdminDriver[]>([]);
  const [vehicles, setVehicles] = useState<AdminVehicle[]>([]);
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
      const [statsRes, driversRes, vehiclesRes] = await Promise.all([
        adminApi.getStats(token),
        adminApi.getDrivers(token),
        adminApi.getVehicles(token),
      ]);
      setStats(statsRes);
      setDrivers(driversRes);
      setVehicles(vehiclesRes);
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
    } catch (err) {
      setError(String(err));
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

  if (isLoading || loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-accent border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 pb-10">
      <div className="rounded-b-3xl bg-gradient-to-br from-slate-800 to-slate-600 px-5 pb-4 pt-4">
        <div className="mb-4 flex items-start justify-between">
          <div>
            <p className="text-[13px] text-white/75">Admin Panel</p>
            <p className="mt-0.5 text-[22px] font-bold text-white">Fleet Overview</p>
          </div>
          <button
            onClick={() => setLogoutConfirmOpen(true)}
            className="rounded-full bg-white/15 px-3 py-2 text-[13px] font-semibold text-white"
          >
            Log out
          </button>
        </div>
        <div className="flex gap-2">
          {(["overview", "drivers", "vehicles"] as Tab[]).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`flex-1 rounded-[10px] py-2 text-[13px] font-semibold ${
                tab === t ? "bg-white text-slate-800" : "bg-white/10 text-white/80"
              }`}
            >
              {t === "overview" ? "Overview" : t === "drivers" ? "Drivers" : "Vehicles"}
            </button>
          ))}
        </div>
      </div>

      {error && (
        <div className="mx-4 mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-[13px] text-red-700">{error}</div>
      )}

      {tab === "overview" && stats && (
        <div className="grid grid-cols-2 gap-3 p-4">
          <StatCard label="Active now" value={stats.activeVehiclesNow} color="text-green-600" />
          <StatCard label="Total vehicles" value={stats.totalVehicles} color="text-accent" />
          <StatCard label="Total drivers" value={stats.totalDrivers} color="text-accent" />
          <StatCard label="Total passengers" value={stats.totalPassengers} color="text-accent" />
          <StatCard label="Trips today" value={stats.tripsToday} color="text-purple-600" />
          <StatCard label="Trips all-time" value={stats.tripsAllTime} color="text-purple-600" />
          <StatCard label="Suspended drivers" value={stats.suspendedDrivers} color="text-red-600" />
          <StatCard label="Suspended vehicles" value={stats.suspendedVehicles} color="text-red-600" />
        </div>
      )}

      {(tab === "drivers" || tab === "vehicles") && (
        <>
          <div className="px-4 pb-2 pt-3.5">
            <input
              type="text"
              placeholder={tab === "drivers" ? "Search by name or phone" : "Search by number or driver"}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full rounded-[10px] border border-slate-200 bg-white p-3 text-sm text-slate-800 outline-none focus:border-accent"
            />
          </div>

          <div className="flex flex-col gap-2.5 px-4">
            {tab === "drivers"
              ? filteredDrivers.map((item) => (
                  <div
                    key={item.id}
                    className={`flex items-center rounded-xl p-3.5 shadow-sm ${
                      item.isSuspended ? "border-[1.5px] border-red-300 bg-red-50" : "bg-white"
                    }`}
                  >
                    <div className="flex-1">
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
                      className={`min-w-[90px] rounded-lg px-3.5 py-2 text-xs font-bold text-white ${
                        item.isSuspended ? "bg-green-600" : "bg-red-600"
                      } disabled:opacity-60`}
                    >
                      {busyId === item.id ? "…" : item.isSuspended ? "Unsuspend" : "Suspend"}
                    </button>
                  </div>
                ))
              : filteredVehicles.map((item) => (
                  <div
                    key={item.id}
                    className={`flex items-center rounded-xl p-3.5 shadow-sm ${
                      item.isSuspended ? "border-[1.5px] border-red-300 bg-red-50" : "bg-white"
                    }`}
                  >
                    <div className="flex-1">
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
                      className={`min-w-[90px] rounded-lg px-3.5 py-2 text-xs font-bold text-white ${
                        item.isSuspended ? "bg-green-600" : "bg-red-600"
                      } disabled:opacity-60`}
                    >
                      {busyId === item.id ? "…" : item.isSuspended ? "Unsuspend" : "Suspend"}
                    </button>
                  </div>
                ))}

            {tab === "drivers" && filteredDrivers.length === 0 && (
              <p className="mt-10 text-center text-slate-400">No drivers found.</p>
            )}
            {tab === "vehicles" && filteredVehicles.length === 0 && (
              <p className="mt-10 text-center text-slate-400">No vehicles found.</p>
            )}
          </div>
        </>
      )}

      <LogoutConfirmModal
        visible={logoutConfirmOpen}
        onCancel={() => setLogoutConfirmOpen(false)}
        onConfirm={() => {
          setLogoutConfirmOpen(false);
          signOut();
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
    <div className="rounded-[14px] bg-white p-4 shadow-sm">
      <p className={`text-[28px] font-extrabold ${color}`}>{value}</p>
      <p className="mt-1 text-[13px] text-slate-500">{label}</p>
    </div>
  );
}
