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

  useEffect(() => {
    if (!tracking) {
      setLastSuccessfulPingAt(null);
      setLastPingError(null);
      return;
    }

    function postOnce() {
      const { token: currentToken, vehicleId: currentVehicleId } = trackingRef.current;
      if (!currentToken || !currentVehicleId) return;

      if (!("geolocation" in navigator)) {
        setLastPingError("Geolocation is not supported in this browser.");
        return;
      }

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
          }
        },
        (geoErr) => {
          setLastPingError(geoErr.message);
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
