"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import Spinner from "../../components/Spinner";
import { ApiError } from "../../lib/api/client";
import { authApi } from "../../lib/api/endpoints";
import { useAuth } from "../../lib/auth/AuthContext";
import { useToast } from "../../lib/toast/ToastContext";

const ADMIN_PHONE = "9999999000";

export default function AdminLoginPage() {
  const { signIn, token, role, isLoading } = useAuth();
  const { showToast } = useToast();
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isLoading && token && role === "Admin") router.replace("/admin");
  }, [isLoading, token, role, router]);

  async function handleLogin() {
    if (!password) {
      setError("Password is required.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const auth = await authApi.login(ADMIN_PHONE, password);
      if (auth.role !== "Admin") {
        setError("This account is not an admin.");
        return;
      }
      signIn(auth);
      showToast("Welcome back, Admin", "success");
      router.replace("/admin");
    } catch (err) {
      const message = err instanceof ApiError ? err.message : "Login failed.";
      setError(message);
      showToast(message, "error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-slate-900 px-6">
      <div className="w-full max-w-sm rounded-[18px] bg-slate-800 p-6 shadow-xl">
        <div className="mb-5 text-center">
          <div className="mb-2 text-4xl">🛡️</div>
          <h1 className="text-xl font-extrabold text-white">Admin Login</h1>
          <p className="mt-1 text-[13px] text-slate-400">Restricted access</p>
        </div>

        <label className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-slate-400">Password</label>
        <input
          type="password"
          autoFocus
          placeholder="Enter admin password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && !loading && password && handleLogin()}
          className="w-full rounded-[10px] border border-slate-600 bg-slate-900 p-3.5 text-base text-white outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/30"
        />

        {error && <p className="mt-3 text-sm text-red-400">{error}</p>}

        <button
          onClick={handleLogin}
          disabled={!password || loading}
          className="mt-5 flex min-h-[50px] w-full items-center justify-center rounded-[10px] bg-accent text-base font-bold text-white transition hover:bg-accent-dark disabled:bg-slate-600 disabled:hover:bg-slate-600"
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

        <p className="mt-5 text-center">
          <Link href="/login" className="text-xs font-semibold text-slate-500 hover:text-slate-300">
            ← Back to regular login
          </Link>
        </p>
      </div>
    </div>
  );
}
