import * as signalR from "@microsoft/signalr";
import { useEffect, useRef } from "react";
import { HUB_URL } from "./config";
import { VehicleLocationUpdate } from "../types";

interface TrackingHubHandlers {
  onLocationUpdate: (update: VehicleLocationUpdate) => void;
  onVehicleStarted?: (vehicleId: string) => void;
  onVehicleStopped?: (vehicleId: string) => void;
  onVehicleReachedDestination?: (vehicleId: string) => void;
}

export function useTrackingHub(handlers: TrackingHubHandlers) {
  const connectionRef = useRef<signalR.HubConnection | null>(null);
  const handlersRef = useRef(handlers);
  handlersRef.current = handlers;

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

    connection
      .start()
      .then(() => connection.invoke("JoinPassengers"))
      .catch((err) => console.warn("SignalR connection failed:", err));

    connectionRef.current = connection;

    return () => {
      connection.stop();
    };
  }, []);

  return connectionRef;
}
