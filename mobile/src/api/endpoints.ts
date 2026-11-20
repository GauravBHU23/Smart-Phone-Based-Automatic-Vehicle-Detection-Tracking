import { api } from "./client";
import {
  AdminDriver,
  AdminStats,
  AdminVehicle,
  AuthResponse,
  Booking,
  DirectionsResult,
  LatLng,
  Place,
  PlaceSearchResponse,
  RouteSearchResult,
  UserRole,
  Vehicle,
  VehicleStatus,
  VehicleType,
  VehicleWithLocation,
  VerificationStatusInfo,
} from "../types";

type PickedPhoto = { uri: string; name: string; type: string };

export const authApi = {
  register: (name: string, phone: string, password: string, role: UserRole) =>
    api.post<AuthResponse>("/api/auth/register", { name, phone, password, role }),
  login: (phone: string, password: string) =>
    api.post<AuthResponse>("/api/auth/login", { phone, password }),
  updateProfile: (
    token: string,
    data: { name?: string; phone?: string; currentPassword?: string; newPassword?: string }
  ) => api.put<AuthResponse>("/api/auth/profile", data, token),
  uploadProfilePhoto: (token: string, photo: PickedPhoto) => {
    const formData = new FormData();
    formData.append("photo", { uri: photo.uri, name: photo.name, type: photo.type } as unknown as Blob);
    return api.postMultipart<AuthResponse>("/api/auth/profile/photo", formData, token);
  },
};

export const placeApi = {
  search: (query: string) => api.get<PlaceSearchResponse>(`/api/places/search?q=${encodeURIComponent(query)}`),
  resolve: (name: string, latitude?: number, longitude?: number) =>
    api.post<Place>("/api/places/resolve", { name, latitude, longitude }),
};

export interface RegisterVehicleOptions {
  fromLocation?: string;
  toLocation?: string;
  fromPlaceId?: string;
  toPlaceId?: string;
  destinationLatitude?: number;
  destinationLongitude?: number;
  stops?: { name: string; latitude?: number; longitude?: number; placeId?: string }[];
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
        fromPlaceId: options.fromPlaceId,
        toPlaceId: options.toPlaceId,
        destinationLatitude: options.destinationLatitude,
        destinationLongitude: options.destinationLongitude,
        stops: options.stops,
      },
      token
    ),
  myVehicles: (token: string) => api.get<Vehicle[]>("/api/vehicles/mine", token),
  updateVehicle: (
    token: string,
    vehicleId: string,
    registrationNumber: string,
    type: VehicleType,
    options: RegisterVehicleOptions = {}
  ) =>
    api.put<Vehicle>(
      `/api/vehicles/${vehicleId}`,
      {
        registrationNumber,
        type,
        fromLocation: options.fromLocation,
        toLocation: options.toLocation,
        fromPlaceId: options.fromPlaceId,
        toPlaceId: options.toPlaceId,
        destinationLatitude: options.destinationLatitude,
        destinationLongitude: options.destinationLongitude,
        stops: options.stops,
      },
      token
    ),
  deleteVehicle: (token: string, vehicleId: string) => api.delete<void>(`/api/vehicles/${vehicleId}`, token),
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
  searchByRoute: (fromPlaceId: string, toPlaceId: string) =>
    api.get<RouteSearchResult[]>(
      `/api/vehicles/search-by-route?fromPlaceId=${encodeURIComponent(fromPlaceId)}&toPlaceId=${encodeURIComponent(toPlaceId)}`
    ),
  getStatus: (vehicleId: string) => api.get<VehicleStatus>(`/api/vehicles/${vehicleId}/status`),
  watch: (token: string, vehicleId: string) =>
    api.post<void>(`/api/vehicles/${vehicleId}/watch`, undefined, token),
  unwatch: (token: string, vehicleId: string) =>
    api.post<void>(`/api/vehicles/${vehicleId}/unwatch`, undefined, token),
  registerPushToken: (token: string, pushToken: string) =>
    api.put<void>("/api/vehicles/push-token", { pushToken }, token),
  createBooking: (
    token: string,
    vehicleId: string,
    options: {
      fromLocation?: string;
      toLocation?: string;
      fromLatitude?: number;
      fromLongitude?: number;
      toLatitude?: number;
      toLongitude?: number;
      note?: string;
    } = {}
  ) =>
    api.post<Booking>(
      `/api/vehicles/${vehicleId}/bookings`,
      {
        fromLocation: options.fromLocation,
        toLocation: options.toLocation,
        fromLatitude: options.fromLatitude,
        fromLongitude: options.fromLongitude,
        toLatitude: options.toLatitude,
        toLongitude: options.toLongitude,
        note: options.note,
      },
      token
    ),
};

export const bookingApi = {
  mine: (token: string) => api.get<Booking[]>("/api/bookings/mine", token),
  driverList: (token: string) => api.get<Booking[]>("/api/bookings/driver", token),
  cancel: (token: string, bookingId: string) =>
    api.post<void>(`/api/bookings/${bookingId}/cancel`, undefined, token),
  accept: (token: string, bookingId: string) =>
    api.post<Booking>(`/api/bookings/${bookingId}/accept`, undefined, token),
  reject: (token: string, bookingId: string) =>
    api.post<Booking>(`/api/bookings/${bookingId}/reject`, undefined, token),
  verifyOtp: (token: string, bookingId: string, otp: string) =>
    api.post<Booking>(`/api/bookings/${bookingId}/verify-otp`, { otp }, token),
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
  getBookings: (token: string, search?: string) =>
    api.get<Booking[]>(`/api/admin/bookings${search ? `?search=${encodeURIComponent(search)}` : ""}`, token),
  approveVerification: (token: string, driverId: string) =>
    api.post<void>(`/api/admin/drivers/${driverId}/verification/approve`, undefined, token),
  rejectVerification: (token: string, driverId: string, reason: string) =>
    api.post<void>(`/api/admin/drivers/${driverId}/verification/reject`, { reason }, token),
};

export const verificationApi = {
  getStatus: (token: string) => api.get<VerificationStatusInfo>("/api/driver/verification/status", token),
  submitDocuments: (
    token: string,
    data: {
      dateOfBirth?: string;
      profilePhoto?: PickedPhoto;
      dlPhoto?: PickedPhoto;
      aadhaarPhoto?: PickedPhoto;
      rcPhoto?: PickedPhoto;
    }
  ) => {
    const formData = new FormData();
    if (data.dateOfBirth) formData.append("dateOfBirth", data.dateOfBirth);
    const appendPhoto = (field: string, photo?: PickedPhoto) => {
      if (!photo) return;
      // React Native's FormData accepts this { uri, name, type } shape
      // directly - it isn't a real File/Blob, but fetch's polyfill on RN
      // knows how to read it.
      formData.append(field, { uri: photo.uri, name: photo.name, type: photo.type } as unknown as Blob);
    };
    appendPhoto("profilePhoto", data.profilePhoto);
    appendPhoto("dlPhoto", data.dlPhoto);
    appendPhoto("aadhaarPhoto", data.aadhaarPhoto);
    appendPhoto("rcPhoto", data.rcPhoto);
    return api.postMultipart<VerificationStatusInfo>("/api/driver/verification/documents", formData, token);
  },
};

export const directionsApi = {
  getRoute: (token: string, origin: LatLng, destination: LatLng) =>
    api.get<DirectionsResult>(
      `/api/directions?originLat=${origin.lat}&originLng=${origin.lng}&destLat=${destination.lat}&destLng=${destination.lng}`,
      token
    ),
};
