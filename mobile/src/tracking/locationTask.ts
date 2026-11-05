import * as Location from "expo-location";
import * as TaskManager from "expo-task-manager";
import { vehicleApi } from "../api/endpoints";

export const LOCATION_TASK_NAME = "vehicle-tracking-location-task";

interface TaskParams {
  token: string;
  vehicleId: string;
}

let currentParams: TaskParams | null = null;

export function setLocationTaskParams(params: TaskParams | null) {
  currentParams = params;
}

// Tracked so the Driver screen can warn "location isn't reaching the server"
// instead of silently looking fine while postLocation keeps failing (e.g. a
// network drop) — without this, the only trace of a failed send was a
// console.warn no one but a developer would ever see.
let lastSuccessfulPingAt: number | null = null;
let lastPingError: string | null = null;

export function getLocationTaskHealth() {
  return { lastSuccessfulPingAt, lastPingError };
}

TaskManager.defineTask(LOCATION_TASK_NAME, async ({ data, error }) => {
  if (error) {
    console.warn("Location task error:", error);
    return;
  }
  if (!currentParams) return;

  const { locations } = (data as { locations: Location.LocationObject[] }) ?? { locations: [] };
  const latest = locations?.[locations.length - 1];
  if (!latest) return;

  try {
    await vehicleApi.postLocation(
      currentParams.token,
      currentParams.vehicleId,
      latest.coords.latitude,
      latest.coords.longitude,
      latest.coords.speed ? latest.coords.speed * 3.6 : null,
      latest.coords.heading,
      latest.coords.accuracy
    );
    lastSuccessfulPingAt = Date.now();
    lastPingError = null;
  } catch (err) {
    console.warn("Failed to post background location:", err);
    lastPingError = err instanceof Error ? err.message : String(err);
  }
});

export async function startBackgroundTracking(token: string, vehicleId: string, intervalMs: number) {
  setLocationTaskParams({ token, vehicleId });
  lastSuccessfulPingAt = null;
  lastPingError = null;

  const alreadyStarted = await Location.hasStartedLocationUpdatesAsync(LOCATION_TASK_NAME);
  if (alreadyStarted) {
    await Location.stopLocationUpdatesAsync(LOCATION_TASK_NAME);
  }

  await Location.startLocationUpdatesAsync(LOCATION_TASK_NAME, {
    accuracy: Location.Accuracy.High,
    timeInterval: intervalMs,
    distanceInterval: 10,
    foregroundService: {
      notificationTitle: "Sharing your location",
      notificationBody: "Passengers can see this vehicle live while tracking is on.",
    },
    pausesUpdatesAutomatically: false,
    showsBackgroundLocationIndicator: true,
  });
}

export async function stopBackgroundTracking() {
  setLocationTaskParams(null);
  const alreadyStarted = await Location.hasStartedLocationUpdatesAsync(LOCATION_TASK_NAME);
  if (alreadyStarted) {
    await Location.stopLocationUpdatesAsync(LOCATION_TASK_NAME);
  }
}
