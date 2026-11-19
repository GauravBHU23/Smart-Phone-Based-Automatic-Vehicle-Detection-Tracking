"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "../lib/auth/AuthContext";

function roleHome(role: string | null) {
  if (role === "Driver") return "/driver";
  if (role === "Admin") return "/admin";
  if (role === "Passenger") return "/passenger/map";
  return "/";
}

/**
 * A thin, always-present strip above every page's own header so there's
 * always a way back to "home" — the landing page for a logged-out visitor,
 * or the signed-in role's main screen for a logged-in one. Omitted on the
 * landing page itself (it already has its own nav) and kept visually
 * minimal so it doesn't compete with each page's existing hero/header.
 */
export default function SiteHeader() {
  const pathname = usePathname();
  const { token, role } = useAuth();

  if (pathname === "/") return null;

  const homeHref = token ? roleHome(role) : "/";

  return (
    <div className="sticky top-0 z-30 flex h-10 items-center border-b border-slate-200 bg-white/90 px-4 backdrop-blur">
      <Link href={homeHref} className="flex items-center gap-1.5 text-[13px] font-bold text-slate-700 hover:text-accent">
        <span aria-hidden>🚌</span>
        VehicleTrack
      </Link>
    </div>
  );
}
