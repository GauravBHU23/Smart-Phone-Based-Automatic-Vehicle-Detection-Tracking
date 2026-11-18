"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { ApiError } from "../../lib/api/client";
import { authApi } from "../../lib/api/endpoints";
import { useAuth } from "../../lib/auth/AuthContext";

function roleHome(role: string | null) {
  if (role === "Driver") return "/driver";
  if (role === "Admin") return "/admin";
  if (role === "Passenger") return "/passenger/map";
  return "/";
}

export default function LoginPage() {
  const { signIn, token, role, isLoading } = useAuth();
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
      router.replace(roleHome(auth.role));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Login failed.");
    } finally {
      setLoading(false);
    }
  }

  const canSubmit = !!phone && !!password && !loading;

  return (
    <div className="min-h-screen bg-slate-50 pb-8">
      <div className="rounded-b-[28px] bg-gradient-to-br from-accent-dark to-accent pb-10 pt-12 text-center text-white">
        <div className="mb-2 text-[44px]">🚐</div>
        <h1 className="text-[26px] font-extrabold tracking-wide">Vehicle Tracking</h1>
        <p className="mt-1.5 text-[13px] text-white/85">Live location, real-time status, always on.</p>
      </div>

      <div className="mx-auto -mt-6 max-w-md rounded-[18px] bg-white p-5 shadow-lg">
        <label className="mb-1.5 mt-3 block text-xs font-bold uppercase tracking-wide text-slate-500">
          Phone number
        </label>
        <input
          type="tel"
          placeholder="e.g. 9876543210"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          className="w-full rounded-[10px] border border-slate-200 bg-slate-50 p-3.5 text-base text-slate-800 outline-none focus:border-accent"
        />

        <label className="mb-1.5 mt-3 block text-xs font-bold uppercase tracking-wide text-slate-500">Password</label>
        <input
          type="password"
          placeholder="Enter your password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && canSubmit && handleLogin()}
          className="w-full rounded-[10px] border border-slate-200 bg-slate-50 p-3.5 text-base text-slate-800 outline-none focus:border-accent"
        />

        {error && <p className="mt-3 text-sm text-red-600">{error}</p>}

        <button
          onClick={handleLogin}
          disabled={!canSubmit}
          className="mt-5 flex min-h-[50px] w-full items-center justify-center rounded-[10px] bg-accent text-base font-bold text-white transition disabled:bg-slate-300"
        >
          {loading ? "Logging in…" : "Log In"}
        </button>

        <p className="mt-4 text-center text-sm text-slate-500">
          Don&apos;t have an account?{" "}
          <Link href="/register" className="font-bold text-accent">
            Register
          </Link>
        </p>
      </div>

      <div className="mx-5 my-6 flex items-center gap-2.5">
        <div className="h-px flex-1 bg-slate-200" />
        <span className="text-xs font-semibold text-slate-400">OR</span>
        <div className="h-px flex-1 bg-slate-200" />
      </div>

      <Link
        href="/search"
        className="mx-auto flex max-w-md items-center gap-3 rounded-2xl border border-blue-100 bg-accent-light p-4"
      >
        <span className="text-2xl">🚌</span>
        <span className="flex-1 font-bold text-accent-dark">Track a vehicle</span>
        <span className="text-lg font-bold text-accent">→</span>
      </Link>
    </div>
  );
}
