// Live backend on Render — reachable from any network, not just the
// developer's own WiFi. Switch back to a LAN IP (http://192.168.x.x:5041)
// only for local-only debugging against a backend run on this machine.
export const API_BASE_URL = "https://smart-phone-based-automatic-vehicle.onrender.com";
export const HUB_URL = `${API_BASE_URL}/hubs/tracking`;
