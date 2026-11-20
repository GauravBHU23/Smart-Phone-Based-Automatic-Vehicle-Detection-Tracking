"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import Spinner from "../../components/Spinner";
import { ApiError } from "../../lib/api/client";
import { authApi } from "../../lib/api/endpoints";
import { useAuth } from "../../lib/auth/AuthContext";
import { useToast } from "../../lib/toast/ToastContext";

function roleHome(role: string | null) {
  if (role === "Driver") return "/driver";
  if (role === "Admin") return "/admin";
  if (role === "Passenger") return "/passenger/map";
  return "/";
}

export default function LoginPage() {
  const { signIn, token, role, isLoading } = useAuth();
  const { showToast } = useToast();
  const router = useRouter();
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isLoading && token) router.replace(roleHome(role));
  }, [isLoading, token, role, router]);

  async function handleLogin() {
    if (!phone || !password) {
      setError("Phone and password are required.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const auth = await authApi.login(phone, password);
      signIn(auth);
      showToast("Login successful!", "success");
      router.replace(roleHome(auth.role));
    } catch (err) {
      const message = err instanceof ApiError ? err.message : "Login failed.";
      setError(message);
      showToast(message, "error");
    } finally {
      setLoading(false);
    }
  }

  const canSubmit = !!phone && !!password && !loading;

  return (
    <div className="min-h-screen bg-slate-50 pb-8 lg:flex lg:min-h-screen lg:items-stretch lg:pb-0">
      <div className="relative overflow-hidden rounded-b-[28px] bg-gradient-to-br from-accent-dark to-accent pb-10 pt-12 text-center text-white lg:flex lg:w-1/2 lg:flex-col lg:items-start lg:justify-center lg:rounded-none lg:px-16 lg:pb-12 lg:pt-12 lg:text-left">
        <div
          className="pointer-events-none absolute -right-20 -top-20 hidden h-80 w-80 rounded-full bg-white/10 blur-3xl lg:block"
          aria-hidden
        />
        <div className="relative lg:max-w-md">
          <div className="mb-2 text-[44px] lg:text-6xl">🚐</div>
          <h1 className="text-[26px] font-extrabold tracking-wide lg:text-4xl">Vehicle Tracking</h1>
          <p className="mt-1.5 text-[13px] text-white/85 lg:mt-4 lg:text-base">
            Live location, real-time status, always on.
          </p>
          <ul className="mt-8 hidden space-y-3 lg:block">
            {["See any vehicle update its position live on a map", "Search by route or registration number", "Get notified the moment your ride arrives"].map((t) => (
              <li key={t} className="flex items-center gap-2.5 text-sm text-white/90">
                <span className="flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full bg-white/20 text-xs">
                  ✓
                </span>
                {t}
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="lg:flex lg:w-1/2 lg:items-center lg:justify-center lg:px-10">
        <div className="mx-auto -mt-6 max-w-md rounded-[18px] bg-white p-5 shadow-lg lg:mt-0 lg:w-full lg:max-w-sm lg:p-8 lg:shadow-none">
          <h2 className="mb-5 hidden text-xl font-extrabold text-slate-800 lg:block">Welcome back</h2>
          <label className="mb-1.5 mt-3 block text-xs font-bold uppercase tracking-wide text-slate-500 lg:mt-0">
            Phone number
          </label>
          <input
            type="tel"
            placeholder="e.g. 9876543210"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            className="w-full rounded-[10px] border border-slate-200 bg-slate-50 p-3.5 text-base text-slate-800 outline-none transition focus:border-accent focus:bg-white focus:ring-2 focus:ring-accent/20"
          />

          <label className="mb-1.5 mt-3 block text-xs font-bold uppercase tracking-wide text-slate-500">Password</label>
          <input
            type="password"
            placeholder="Enter your password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && canSubmit && handleLogin()}
            className="w-full rounded-[10px] border border-slate-200 bg-slate-50 p-3.5 text-base text-slate-800 outline-none transition focus:border-accent focus:bg-white focus:ring-2 focus:ring-accent/20"
          />

          {error && <p className="mt-3 text-sm text-red-600">{error}</p>}

          <button
            onClick={handleLogin}
            disabled={!canSubmit}
            className="mt-5 flex min-h-[50px] w-full items-center justify-center rounded-[10px] bg-accent text-base font-bold text-white transition hover:bg-accent-dark disabled:bg-slate-300 disabled:hover:bg-slate-300"
          >
            {loading ? (
              <>
                <Spinner />
                <span className="ml-2">Logging in…</span>
              </>
            ) : (
              "Log In"
            )}
          </button>

          <p className="mt-4 text-center text-sm text-slate-500">
            Don&apos;t have an account?{" "}
            <Link href="/register" className="font-bold text-accent hover:underline">
              Register
            </Link>
          </p>

          <div className="mx-0 my-6 flex items-center gap-2.5">
            <div className="h-px flex-1 bg-slate-200" />
            <span className="text-xs font-semibold text-slate-400">OR</span>
            <div className="h-px flex-1 bg-slate-200" />
          </div>

          <Link
            href="/search"
            className="flex items-center gap-3 rounded-2xl border border-blue-100 bg-accent-light p-4 transition hover:border-accent/40 hover:bg-accent-light/70"
          >
            <span className="text-2xl">🚌</span>
            <span className="flex-1 font-bold text-accent-dark">Track a vehicle</span>
            <span className="text-lg font-bold text-accent">→</span>
          </Link>

          <p className="mt-6 text-center">
            <Link href="/admin-login" className="text-xs font-semibold text-slate-400 hover:text-slate-600">
              Admin login
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
