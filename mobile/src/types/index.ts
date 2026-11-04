export type UserRole = "Passenger" | "Driver" | "Admin";

export type VehicleType = "Bus" | "Auto" | "Taxi" | "Bike" | "Truck" | "Ambulance" | "Other";

export interface AuthResponse {
  token: string;
  userId: string;
  name: string;
  role: UserRole;
}

export interface Vehicle {
  id: string;
  registrationNumber: string;
  type: VehicleType;
  routeName: string | null;
  isActive: boolean;
}

export interface VehicleWithLocation {
  id: string;
  registrationNumber: string;
  type: VehicleType;
  routeName: string | null;
  latitude: number | null;
  longitude: number | null;
  speedKmh: number | null;
  lastUpdatedAt: string | null;
}

export interface VehicleLocationUpdate {
  vehicleId: string;
  latitude: number;
  longitude: number;
  speedKmh: number | null;
  headingDegrees: number | null;
  recordedAt: string;
}
