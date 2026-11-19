// A GPS-tracking session's auth token lives here, deliberately separate from
// the main "auth" session in AuthContext. Logging out clears the main auth
// session but must never stop an in-progress tracking session — matching
// the mobile app's locationTask.ts, which persists its own token to
// SecureStore for exactly this reason. Web has no background task that
// survives a closed tab, but it does need to survive the *current* tab's
// driver logging out while GPS pings keep going until Stop is pressed.
const TRACKING_TOKEN_KEY = "trackingToken";

export function saveTrackingToken(token: string): void {
  try {
    localStorage.setItem(TRACKING_TOKEN_KEY, token);
  } catch (err) {
    console.warn("Failed to save tracking token:", err);
  }
}

export function loadTrackingToken(): string | null {
  try {
    return localStorage.getItem(TRACKING_TOKEN_KEY);
  } catch (err) {
    console.warn("Failed to load tracking token:", err);
    return null;
  }
}

export function clearTrackingToken(): void {
  try {
    localStorage.removeItem(TRACKING_TOKEN_KEY);
  } catch (err) {
    console.warn("Failed to clear tracking token:", err);
  }
}
