import { api } from "./client";
import {
  AuthResponse,
  UserRole,
  Vehicle,
  VehicleType,
  VehicleWithLocation,
} from "../types";

export const authApi = {
  register: (name: string, phone: string, password: string, role: UserRole) =>
    api.post<AuthResponse>("/api/auth/register", { name, phone, password, role }),
  login: (phone: string, password: string) =>
    api.post<AuthResponse>("/api/auth/login", { phone, password }),
};

export const vehicleApi = {
  registerVehicle: (
    token: string,
    registrationNumber: string,
    type: VehicleType,
    routeName?: string
  ) =>
    api.post<Vehicle>(
      "/api/vehicles",
      { registrationNumber, type, routeName },
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
};
