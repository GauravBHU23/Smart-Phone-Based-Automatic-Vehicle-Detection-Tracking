export type UserRole = "Passenger" | "Driver" | "Admin";

export type VehicleType = "Bus" | "Auto" | "Taxi" | "Bike" | "Truck" | "Ambulance" | "Other";

export interface AuthResponse {
  token: string;
  userId: string;
  name: string;
  role: UserRole;
}

export interface RouteStop {
  name: string;
  latitude: number | null;
  longitude: number | null;
  reached: boolean;
}

export interface Vehicle {
  id: string;
  registrationNumber: string;
  type: VehicleType;
  fromLocation: string | null;
  toLocation: string | null;
  destinationLatitude: number | null;
  destinationLongitude: number | null;
  stops: RouteStop[];
  isActive: boolean;
}

export interface VehicleWithLocation {
  id: string;
  registrationNumber: string;
  type: VehicleType;
  fromLocation: string | null;
  toLocation: string | null;
  latitude: number | null;
  longitude: number | null;
  speedKmh: number | null;
  lastUpdatedAt: string | null;
}

export interface RouteSearchResult {
  id: string;
  registrationNumber: string;
  type: VehicleType;
  driverName: string;
  fromLocation: string | null;
  toLocation: string | null;
  stops: RouteStop[];
  isActive: boolean;
  latitude: number | null;
  longitude: number | null;
  speedKmh: number | null;
  lastUpdatedAt: string | null;
}

export interface VehicleStatus {
  id: string;
  registrationNumber: string;
  type: VehicleType;
  driverName: string;
  fromLocation: string | null;
  toLocation: string | null;
  destinationLatitude: number | null;
  destinationLongitude: number | null;
  stops: RouteStop[];
  isActive: boolean;
  latitude: number | null;
  longitude: number | null;
  speedKmh: number | null;
  lastUpdatedAt: string | null;
  tripStartedAt: string | null;
  distanceCoveredKm: number | null;
}

export interface VehicleLocationUpdate {
  vehicleId: string;
  latitude: number;
  longitude: number;
  speedKmh: number | null;
  headingDegrees: number | null;
  recordedAt: string;
}

export interface AdminDriver {
  id: string;
  name: string;
  phone: string;
  isSuspended: boolean;
  createdAt: string;
  vehicleCount: number;
}

export interface AdminVehicle {
  id: string;
  registrationNumber: string;
  type: VehicleType;
  driverName: string;
  driverId: string;
  isActive: boolean;
  isSuspended: boolean;
  fromLocation: string | null;
  toLocation: string | null;
  createdAt: string;
}

export interface AdminStats {
  totalDrivers: number;
  totalPassengers: number;
  totalVehicles: number;
  activeVehiclesNow: number;
  suspendedDrivers: number;
  suspendedVehicles: number;
  tripsToday: number;
  tripsAllTime: number;
}
