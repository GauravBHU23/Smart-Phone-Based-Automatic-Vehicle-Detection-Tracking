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

    function joinPassengers() {
      connection.invoke("JoinPassengers").catch((err) => console.warn("Failed to join passengers group:", err));
    }

    connection
      .start()
      .then(joinPassengers)
      .catch((err) => console.warn("SignalR connection failed:", err));

    // Automatic reconnect gets a brand new connection ID on the server, so
    // group membership from before the drop is gone — without rejoining
    // here, a transient network blip (WiFi/cellular handoff, brief signal
    // loss) silently stops delivering any further broadcasts even though
    // the connection looks healthy again.
    connection.onreconnected(joinPassengers);

    connectionRef.current = connection;

    return () => {
      connection.stop();
    };
  }, []);

  return connectionRef;
}
