import * as signalR from "@microsoft/signalr";
import { useEffect, useRef } from "react";
import { HUB_URL } from "./config";
import { Booking, VehicleLocationUpdate } from "../types";

interface TrackingHubHandlers {
  onLocationUpdate: (update: VehicleLocationUpdate) => void;
  onVehicleStarted?: (vehicleId: string) => void;
  onVehicleStopped?: (vehicleId: string) => void;
  onVehicleReachedDestination?: (vehicleId: string) => void;
  onBookingRequested?: (booking: Booking) => void;
  onBookingAccepted?: (booking: Booking) => void;
  onBookingRejected?: (booking: Booking) => void;
  onBookingCancelled?: (booking: Booking) => void;
  onBookingCompleted?: (booking: Booking) => void;
}

export function useTrackingHub(handlers: TrackingHubHandlers, watchVehicleIds: string[] = []) {
  const connectionRef = useRef<signalR.HubConnection | null>(null);
  const handlersRef = useRef(handlers);
  handlersRef.current = handlers;
  // The connection effect below has an empty dependency array (one connection
  // per mount), but the vehicle IDs to watch are often only known after an
  // async load (e.g. a driver's own vehicle list) that resolves after mount —
  // a ref lets the join function always see the latest list without
  // recreating the connection.
  const watchVehicleIdsRef = useRef(watchVehicleIds);
  watchVehicleIdsRef.current = watchVehicleIds;

  useEffect(() => {
    const connection = new signalR.HubConnectionBuilder()
      .withUrl(HUB_URL)
      .withAutomaticReconnect()
      .build();

    connection.on("VehicleLocationUpdated", (update: VehicleLocationUpdate) =>
      handlersRef.current.onLocationUpdate(update)
    );
    connection.on("VehicleStarted", (vehicleId: string) => handlersRef.current.onVehicleStarted?.(vehicleId));
    connection.on("VehicleStopped", (vehicleId: string) => handlersRef.current.onVehicleStopped?.(vehicleId));
    connection.on("VehicleReachedDestination", (vehicleId: string) =>
      handlersRef.current.onVehicleReachedDestination?.(vehicleId)
    );
    connection.on("BookingRequested", (booking: Booking) => handlersRef.current.onBookingRequested?.(booking));
    connection.on("BookingAccepted", (booking: Booking) => handlersRef.current.onBookingAccepted?.(booking));
    connection.on("BookingRejected", (booking: Booking) => handlersRef.current.onBookingRejected?.(booking));
    connection.on("BookingCancelled", (booking: Booking) => handlersRef.current.onBookingCancelled?.(booking));
    connection.on("BookingCompleted", (booking: Booking) => handlersRef.current.onBookingCompleted?.(booking));

    function joinGroups() {
      connection.invoke("JoinPassengers").catch((err) => console.warn("Failed to join passengers group:", err));
      watchVehicleIdsRef.current.forEach((id) =>
        connection.invoke("WatchVehicle", id).catch((err) => console.warn("Failed to watch vehicle group:", err))
      );
    }

    connection
      .start()
      .then(joinGroups)
      .catch((err) => console.warn("SignalR connection failed:", err));

    // Automatic reconnect gets a brand new connection ID on the server, so
    // group membership from before the drop is gone — without rejoining
    // here, a transient network blip (WiFi/cellular handoff, brief signal
    // loss) silently stops delivering any further broadcasts even though
    // the connection looks healthy again.
    connection.onreconnected(joinGroups);

    connectionRef.current = connection;

    return () => {
      connection.stop();
    };
  }, []);

  return connectionRef;
}
