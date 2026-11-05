import { api } from "./client";
import {
  AdminDriver,
  AdminStats,
  AdminVehicle,
  AuthResponse,
  RouteSearchResult,
  UserRole,
  Vehicle,
  VehicleStatus,
  VehicleType,
  VehicleWithLocation,
} from "../types";

export const authApi = {
  register: (name: string, phone: string, password: string, role: UserRole) =>
    api.post<AuthResponse>("/api/auth/register", { name, phone, password, role }),
  login: (phone: string, password: string) =>
    api.post<AuthResponse>("/api/auth/login", { phone, password }),
};

export interface RegisterVehicleOptions {
  fromLocation?: string;
  toLocation?: string;
  destinationLatitude?: number;
  destinationLongitude?: number;
  stops?: { name: string; latitude?: number; longitude?: number }[];
}

export const vehicleApi = {
  registerVehicle: (
    token: string,
    registrationNumber: string,
    type: VehicleType,
    options: RegisterVehicleOptions = {}
  ) =>
    api.post<Vehicle>(
      "/api/vehicles",
      {
        registrationNumber,
        type,
        fromLocation: options.fromLocation,
        toLocation: options.toLocation,
        destinationLatitude: options.destinationLatitude,
        destinationLongitude: options.destinationLongitude,
        stops: options.stops,
      },
      token
    ),
  myVehicles: (token: string) => api.get<Vehicle[]>("/api/vehicles/mine", token),
  startTracking: (token: string, vehicleId: string) =>
    api.post<void>(`/api/vehicles/${vehicleId}/start`, undefined, token),
  stopTracking: (token: string, vehicleId: string) =>
    api.post<void>(`/api/vehicles/${vehicleId}/stop`, undefined, token),
  postLocation: (
    token: string,
    vehicleId: string,
    latitude: number,
    longitude: number,
    speedKmh?: number | null,
    headingDegrees?: number | null,
    accuracyMeters?: number | null
  ) =>
    api.post<void>(
      `/api/vehicles/${vehicleId}/location`,
      { latitude, longitude, speedKmh, headingDegrees, accuracyMeters },
      token
    ),
  activeVehicles: (type?: VehicleType) =>
    api.get<VehicleWithLocation[]>(
      `/api/vehicles/active${type ? `?type=${type}` : ""}`
    ),
  searchByRegistrationNumber: (regNumber: string) =>
    api.get<VehicleStatus>(`/api/vehicles/search?regNumber=${encodeURIComponent(regNumber)}`),
  searchByRoute: (from: string, to: string) =>
    api.get<RouteSearchResult[]>(
      `/api/vehicles/search-by-route?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`
    ),
  getStatus: (vehicleId: string) => api.get<VehicleStatus>(`/api/vehicles/${vehicleId}/status`),
  watch: (token: string, vehicleId: string) =>
    api.post<void>(`/api/vehicles/${vehicleId}/watch`, undefined, token),
  unwatch: (token: string, vehicleId: string) =>
    api.post<void>(`/api/vehicles/${vehicleId}/unwatch`, undefined, token),
  registerPushToken: (token: string, pushToken: string) =>
    api.put<void>("/api/vehicles/push-token", { pushToken }, token),
};

export const adminApi = {
  getDrivers: (token: string, search?: string) =>
    api.get<AdminDriver[]>(`/api/admin/drivers${search ? `?search=${encodeURIComponent(search)}` : ""}`, token),
  getVehicles: (token: string, search?: string) =>
    api.get<AdminVehicle[]>(`/api/admin/vehicles${search ? `?search=${encodeURIComponent(search)}` : ""}`, token),
  getStats: (token: string) => api.get<AdminStats>("/api/admin/stats", token),
  suspendDriver: (token: string, driverId: string) =>
    api.post<void>(`/api/admin/drivers/${driverId}/suspend`, undefined, token),
  unsuspendDriver: (token: string, driverId: string) =>
    api.post<void>(`/api/admin/drivers/${driverId}/unsuspend`, undefined, token),
  suspendVehicle: (token: string, vehicleId: string) =>
    api.post<void>(`/api/admin/vehicles/${vehicleId}/suspend`, undefined, token),
  unsuspendVehicle: (token: string, vehicleId: string) =>
    api.post<void>(`/api/admin/vehicles/${vehicleId}/unsuspend`, undefined, token),
};
