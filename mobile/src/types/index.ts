export type UserRole = "Passenger" | "Driver" | "Admin";

export type VehicleType = "Bus" | "Auto" | "Taxi" | "Bike" | "Truck" | "Ambulance" | "Other";

export interface AuthResponse {
  token: string;
  userId: string;
  name: string;
  phone: string;
  role: UserRole;
  profilePhotoUrl: string | null;
}

export interface RouteStop {
  name: string;
  latitude: number | null;
  longitude: number | null;
  reached: boolean;
}

export interface Place {
  id: string;
  code: string;
  name: string;
  latitude: number | null;
  longitude: number | null;
}

/** A real-world place found via geocoding, not yet in our own Place directory. */
export interface ExternalPlace {
  name: string;
  latitude: number;
  longitude: number;
}

export interface PlaceSearchResponse {
  knownPlaces: Place[];
  suggestedPlaces: ExternalPlace[];
}

/**
 * What a PlaceAutocomplete field actually holds: either a place already in
 * our directory, or one not yet saved — a free-typed name, or a real-world
 * place picked from the geocoder (which carries known coordinates, unlike a
 * free-typed name where coordinates are unknown until resolved separately).
 */
export type PlaceSelection = Place | { id: null; name: string; latitude?: number; longitude?: number };

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

export type DriverVerificationStatus = "NotSubmitted" | "Pending" | "Approved" | "Rejected";

export interface AdminDriver {
  id: string;
  name: string;
  phone: string;
  isSuspended: boolean;
  createdAt: string;
  vehicleCount: number;
  verificationStatus: DriverVerificationStatus;
  dateOfBirth: string | null;
  profilePhotoUrl: string | null;
  dlPhotoUrl: string | null;
  aadhaarPhotoUrl: string | null;
  rcPhotoUrl: string | null;
  verificationRejectionReason: string | null;
}

export interface VerificationStatusInfo {
  status: DriverVerificationStatus;
  dateOfBirth: string | null;
  profilePhotoUrl: string | null;
  dlPhotoUrl: string | null;
  aadhaarPhotoUrl: string | null;
  rcPhotoUrl: string | null;
  rejectionReason: string | null;
  submittedAt: string | null;
  reviewedAt: string | null;
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
  totalBookings: number;
  pendingBookings: number;
  completedRides: number;
}

export type BookingStatus = "Pending" | "Accepted" | "Rejected" | "Cancelled" | "Completed";

export interface Booking {
  id: string;
  vehicleId: string;
  vehicleRegistrationNumber: string;
  vehicleType: VehicleType;
  passengerId: string;
  passengerName: string;
  passengerPhone: string | null;
  driverPhone: string | null;
  status: BookingStatus;
  fromLocation: string | null;
  toLocation: string | null;
  fromLatitude: number | null;
  fromLongitude: number | null;
  toLatitude: number | null;
  toLongitude: number | null;
  note: string | null;
  otpCode: string | null;
  otpVerified: boolean;
  createdAt: string;
  respondedAt: string | null;
}

export interface LatLng {
  lat: number;
  lng: number;
}

export interface DirectionsResult {
  polyline: LatLng[];
  distanceKm: number;
  etaMinutes: number;
}
