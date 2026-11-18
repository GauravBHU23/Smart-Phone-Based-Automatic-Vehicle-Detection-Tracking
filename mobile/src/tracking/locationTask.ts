import * as Location from "expo-location";
import * as SecureStore from "expo-secure-store";
import * as TaskManager from "expo-task-manager";
import { vehicleApi } from "../api/endpoints";

export const LOCATION_TASK_NAME = "vehicle-tracking-location-task";
const TASK_PARAMS_STORAGE_KEY = "locationTaskParams";

interface TaskParams {
  token: string;
  vehicleId: string;
}

let currentParams: TaskParams | null = null;

export function setLocationTaskParams(params: TaskParams | null) {
  currentParams = params;
  // Persisted so a headless re-invocation of this task after the OS kills
  // and restarts the app process (memory pressure, aggressive OEM
  // management) can recover token/vehicleId from disk — the in-memory
  // variable alone would be null in that fresh JS context, causing the
  // task to silently no-op forever with no error anyone would see.
  if (params) {
    SecureStore.setItemAsync(TASK_PARAMS_STORAGE_KEY, JSON.stringify(params)).catch((err) =>
      console.warn("Failed to persist location task params:", err)
    );
  } else {
    SecureStore.deleteItemAsync(TASK_PARAMS_STORAGE_KEY).catch(() => {});
  }
}

async function ensureParamsLoaded(): Promise<TaskParams | null> {
  if (currentParams) return currentParams;
  try {
    const raw = await SecureStore.getItemAsync(TASK_PARAMS_STORAGE_KEY);
    if (raw) currentParams = JSON.parse(raw);
  } catch (err) {
    console.warn("Failed to load persisted location task params:", err);
  }
  return currentParams;
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

  // A headless re-invocation after the OS killed and restarted the app
  // process starts with currentParams == null in this fresh JS context —
  // recover it from disk before giving up, instead of silently dropping
  // every location update until the app happens to be opened manually.
  const params = await ensureParamsLoaded();
  if (!params) return;

  const { locations } = (data as { locations: Location.LocationObject[] }) ?? { locations: [] };
  const latest = locations?.[locations.length - 1];
  if (!latest) return;

  try {
    await vehicleApi.postLocation(
      params.token,
      params.vehicleId,
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
