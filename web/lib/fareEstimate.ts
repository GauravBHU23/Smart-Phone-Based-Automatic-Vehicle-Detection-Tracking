// Client-side port of the exact same Haversine formula already used
// server-side (VehiclesController.cs's HaversineKm) — used here only to
// show the driver a real distance-from-you on an incoming ride request,
// never to charge anything. The fare is a plainly-labeled cash estimate,
// not a payment — there is no payment collection anywhere in this app.
export const FARE_PER_KM = 10;

export function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const earthRadiusKm = 6371;
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return earthRadiusKm * c;
}

export function estimateFare(distanceKm: number): number {
  return Math.round(distanceKm * FARE_PER_KM);
}

export function formatDistance(km: number): string {
  return `${km.toFixed(1)} km`;
}
