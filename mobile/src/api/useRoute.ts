import { useEffect, useRef, useState } from "react";
import { directionsApi } from "./endpoints";
import { DirectionsResult, LatLng } from "../types";

function roughlyEqual(a: LatLng | null, b: LatLng | null): boolean {
  if (a === b) return true;
  if (!a || !b) return false;
  // ~50m at mid-latitudes - close enough that re-fetching the route for a
  // driver's gradual movement during a single trip isn't worth it.
  const THRESHOLD = 0.0005;
  return Math.abs(a.lat - b.lat) < THRESHOLD && Math.abs(a.lng - b.lng) < THRESHOLD;
}

/**
 * Fetches a real road route between two points whenever they change by more
 * than ~50m. Never fabricates a result - returns null on any failure or
 * while either point is unknown, so callers simply omit the route line
 * rather than showing a guessed one.
 */
export function useRoute(token: string | null, origin: LatLng | null, destination: LatLng | null) {
  const [route, setRoute] = useState<DirectionsResult | null>(null);
  const [loading, setLoading] = useState(false);
  const lastFetchedRef = useRef<{ origin: LatLng | null; destination: LatLng | null }>({ origin: null, destination: null });

  useEffect(() => {
    if (!token || !origin || !destination) {
      setRoute(null);
      return;
    }

    if (roughlyEqual(lastFetchedRef.current.origin, origin) && roughlyEqual(lastFetchedRef.current.destination, destination)) {
      return;
    }

    let cancelled = false;
    setLoading(true);
    directionsApi
      .getRoute(token, origin, destination)
      .then((result) => {
        if (cancelled) return;
        lastFetchedRef.current = { origin, destination };
        setRoute(result);
      })
      .catch((err) => {
        console.warn("Failed to fetch route:", err);
        if (!cancelled) setRoute(null);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, origin?.lat, origin?.lng, destination?.lat, destination?.lng]);

  return { route, loading };
}
