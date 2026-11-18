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
    <div className="min-h-screen bg-slate-50 pb-8">
      <div className="relative rounded-b-[28px] bg-gradient-to-br from-accent-dark to-accent pb-10 pt-12 text-center text-white">
        <Link href="/login" className="absolute left-4 top-4 p-2 text-2xl leading-none text-white">
          ←
        </Link>
        <div className="mb-2 mt-5 text-[40px]">✨</div>
        <h1 className="text-2xl font-extrabold tracking-wide">Create Account</h1>
        <p className="mt-1.5 text-[13px] text-white/85">Join to track or share vehicle locations</p>
      </div>

      <div className="mx-auto -mt-6 max-w-md rounded-[18px] bg-white p-5 shadow-lg">
        <label className="mb-1.5 mt-3 block text-xs font-bold uppercase tracking-wide text-slate-500">I am a</label>
        <div className="flex gap-2.5">
          {ROLE_OPTIONS.map((r) => (
            <button
              key={r.value}
              type="button"
              onClick={() => setRole(r.value)}
              className={`flex flex-1 items-center justify-center gap-2 rounded-xl border-[1.5px] py-3.5 font-semibold ${
                role === r.value
                  ? "border-accent bg-accent text-white"
                  : "border-blue-100 bg-accent-light text-accent"
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
          className="w-full rounded-[10px] border border-slate-200 bg-slate-50 p-3.5 text-base text-slate-800 outline-none focus:border-accent"
        />

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
          placeholder="Choose a password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && canSubmit && handleRegister()}
          className="w-full rounded-[10px] border border-slate-200 bg-slate-50 p-3.5 text-base text-slate-800 outline-none focus:border-accent"
        />

        {error && <p className="mt-3 text-sm text-red-600">{error}</p>}

        <button
          onClick={handleRegister}
          disabled={!canSubmit}
          className="mt-5 flex min-h-[50px] w-full items-center justify-center rounded-[10px] bg-accent text-base font-bold text-white transition disabled:bg-slate-300"
        >
          {loading ? "Creating account…" : "Create Account"}
        </button>

        <p className="mt-4 text-center text-sm text-slate-500">
          Already have an account?{" "}
          <Link href="/login" className="font-bold text-accent">
            Log in
          </Link>
        </p>
      </div>
    </div>
  );
}
