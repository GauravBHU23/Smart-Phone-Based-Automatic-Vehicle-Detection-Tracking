import type { Metadata, Viewport } from "next";
import { AuthProvider } from "../lib/auth/AuthContext";
import "./globals.css";

export const metadata: Metadata = {
  title: "VehicleTrack — Live Vehicle Tracking",
  description: "Live vehicle tracking for drivers and passengers — real-time location, route search, and arrival alerts.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
