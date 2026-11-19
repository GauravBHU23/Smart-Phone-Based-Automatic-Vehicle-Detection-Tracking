import { useEffect, useRef, useState } from "react";
import { vehicleApi } from "../api/endpoints";

const LOCATION_INTERVAL_MS = 5000;

/**
 * Web equivalent of the mobile app's background location task — except
 * there's no browser equivalent of a background task that survives a
 * closed or backgrounded tab, so this only runs while the page is open.
 * Same ping interval, same m/s-to-km/h speed conversion, same
 * postLocation call shape as mobile's locationTask.ts.
 */
export function useForegroundLocation(token: string | null, vehicleId: string | null, tracking: boolean) {
  const [lastSuccessfulPingAt, setLastSuccessfulPingAt] = useState<number | null>(null);
  const [lastPingError, setLastPingError] = useState<string | null>(null);
  const trackingRef = useRef({ token, vehicleId });
  trackingRef.current = { token, vehicleId };
  // Guards against overlapping pings: on a slow GPS fix or flaky network, a
  // single ping can still be in flight when the next 5s tick fires. Starting
  // another one on top makes things worse, not better - it competes for the
  // same GPS radio and bandwidth, and can turn one slow ping into several
  // slow ones stacking up, which is itself a real contributor to the
  // "location isn't reaching the server" staleness warning firing even
  // though pings are still happening, just arriving late.
  const pingInFlightRef = useRef(false);

  useEffect(() => {
    if (!tracking) {
      setLastSuccessfulPingAt(null);
      setLastPingError(null);
      return;
    }

    function postOnce() {
      if (pingInFlightRef.current) return;

      const { token: currentToken, vehicleId: currentVehicleId } = trackingRef.current;
      if (!currentToken || !currentVehicleId) return;

      if (!("geolocation" in navigator)) {
        setLastPingError("Geolocation is not supported in this browser.");
        return;
      }

      pingInFlightRef.current = true;

      navigator.geolocation.getCurrentPosition(
        async (position) => {
          try {
            await vehicleApi.postLocation(
              currentToken,
              currentVehicleId,
              position.coords.latitude,
              position.coords.longitude,
              position.coords.speed ? position.coords.speed * 3.6 : null,
              position.coords.heading,
              position.coords.accuracy
            );
            setLastSuccessfulPingAt(Date.now());
            setLastPingError(null);
          } catch (err) {
            const message = err instanceof Error ? err.message : String(err);
            console.warn("Failed to post location:", message);
            setLastPingError(message);
          } finally {
            pingInFlightRef.current = false;
          }
        },
        (geoErr) => {
          setLastPingError(geoErr.message);
          pingInFlightRef.current = false;
        },
        { enableHighAccuracy: true, maximumAge: 0, timeout: 10000 }
      );
    }

    postOnce();
    const interval = setInterval(postOnce, LOCATION_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [tracking]);

  return { lastSuccessfulPingAt, lastPingError };
}
