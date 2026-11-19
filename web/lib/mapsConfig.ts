// Web-only key, restricted by HTTP referrer (the Vercel domain + localhost) —
// deliberately separate from the mobile app's Android-restricted key, since a
// single Google Maps key can only carry one application-restriction type.
export const GOOGLE_MAPS_API_KEY =
  process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ?? "AIzaSyAuuiQ_f1bY3jpe8pll7tEn2BPkV0Bi96s";
