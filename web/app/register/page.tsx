"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { ApiError } from "../../lib/api/client";
import { authApi } from "../../lib/api/endpoints";
import { useAuth } from "../../lib/auth/AuthContext";
import { UserRole } from "../../lib/types";

const ROLE_OPTIONS: { value: UserRole; label: string; icon: string }[] = [
  { value: "Passenger", label: "Passenger", icon: "🧑" },
  { value: "Driver", label: "Driver", icon: "🚐" },
];

function roleHome(role: string | null) {
  if (role === "Driver") return "/driver";
  if (role === "Admin") return "/admin";
  if (role === "Passenger") return "/passenger/map";
  return "/";
}

export default function RegisterPage() {
  const { signIn, token, role: authRole, isLoading } = useAuth();
  const router = useRouter();
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<UserRole>("Passenger");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isLoading && token) router.replace(roleHome(authRole));
  }, [isLoading, token, authRole, router]);

  async function handleRegister() {
    if (!name || !phone || !password) {
      setError("All fields are required.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const auth = await authApi.register(name, phone, password, role);
      signIn(auth);
      router.replace(roleHome(auth.role));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Registration failed.");
    } finally {
      setLoading(false);
    }
  }

  const canSubmit = !!name && !!phone && !!password && !loading;

  return (
    <div className="min-h-screen bg-slate-50 pb-8 lg:flex lg:min-h-screen lg:items-stretch lg:pb-0">
      <div className="relative overflow-hidden rounded-b-[28px] bg-gradient-to-br from-accent-dark to-accent pb-10 pt-12 text-center text-white lg:flex lg:w-1/2 lg:flex-col lg:items-start lg:justify-center lg:rounded-none lg:px-16 lg:pb-12 lg:pt-12 lg:text-left">
        <Link href="/login" className="absolute left-4 top-4 p-2 text-2xl leading-none text-white lg:left-10 lg:top-10">
          ←
        </Link>
        <div
          className="pointer-events-none absolute -right-20 -top-20 hidden h-80 w-80 rounded-full bg-white/10 blur-3xl lg:block"
          aria-hidden
        />
        <div className="relative lg:max-w-md">
          <div className="mb-2 mt-5 text-[40px] lg:mt-0 lg:text-6xl">✨</div>
          <h1 className="text-2xl font-extrabold tracking-wide lg:text-4xl">Create Account</h1>
          <p className="mt-1.5 text-[13px] text-white/85 lg:mt-4 lg:text-base">
            Join to track or share vehicle locations
          </p>
          <ul className="mt-8 hidden space-y-3 lg:block">
            {["Register as a driver to share your vehicle's live location", "Register as a passenger to watch vehicles and get alerts", "Free, and takes less than a minute"].map((t) => (
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
          <label className="mb-1.5 mt-3 block text-xs font-bold uppercase tracking-wide text-slate-500 lg:mt-0">
            I am a
          </label>
          <div className="flex gap-2.5">
            {ROLE_OPTIONS.map((r) => (
              <button
                key={r.value}
                type="button"
                onClick={() => setRole(r.value)}
                className={`flex flex-1 items-center justify-center gap-2 rounded-xl border-[1.5px] py-3.5 font-semibold transition ${
                  role === r.value
                    ? "border-accent bg-accent text-white"
                    : "border-blue-100 bg-accent-light text-accent hover:border-accent/50"
                }`}
              >
                <span className="text-lg">{r.icon}</span>
                <span className="text-sm">{r.label}</span>
              </button>
            ))}
          </div>

          <label className="mb-1.5 mt-3 block text-xs font-bold uppercase tracking-wide text-slate-500">
            Full name
          </label>
          <input
            type="text"
            placeholder="Your name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full rounded-[10px] border border-slate-200 bg-slate-50 p-3.5 text-base text-slate-800 outline-none transition focus:border-accent focus:bg-white focus:ring-2 focus:ring-accent/20"
          />

          <label className="mb-1.5 mt-3 block text-xs font-bold uppercase tracking-wide text-slate-500">
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
            placeholder="Choose a password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && canSubmit && handleRegister()}
            className="w-full rounded-[10px] border border-slate-200 bg-slate-50 p-3.5 text-base text-slate-800 outline-none transition focus:border-accent focus:bg-white focus:ring-2 focus:ring-accent/20"
          />

          {error && <p className="mt-3 text-sm text-red-600">{error}</p>}

          <button
            onClick={handleRegister}
            disabled={!canSubmit}
            className="mt-5 flex min-h-[50px] w-full items-center justify-center rounded-[10px] bg-accent text-base font-bold text-white transition hover:bg-accent-dark disabled:bg-slate-300 disabled:hover:bg-slate-300"
          >
            {loading ? "Creating account…" : "Create Account"}
          </button>

          <p className="mt-4 text-center text-sm text-slate-500">
            Already have an account?{" "}
            <Link href="/login" className="font-bold text-accent hover:underline">
              Log in
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
