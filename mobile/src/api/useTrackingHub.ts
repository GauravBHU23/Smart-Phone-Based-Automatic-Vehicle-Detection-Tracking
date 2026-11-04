import * as signalR from "@microsoft/signalr";
import { useEffect, useRef } from "react";
import { HUB_URL } from "./config";
import { VehicleLocationUpdate } from "../types";

export function useTrackingHub(onLocationUpdate: (update: VehicleLocationUpdate) => void) {
  const connectionRef = useRef<signalR.HubConnection | null>(null);

  useEffect(() => {
    const connection = new signalR.HubConnectionBuilder()
      .withUrl(HUB_URL)
      .withAutomaticReconnect()
      .build();

    connection.on("VehicleLocationUpdated", onLocationUpdate);

    connection
      .start()
      .then(() => connection.invoke("JoinPassengers"))
      .catch((err) => console.warn("SignalR connection failed:", err));

    connectionRef.current = connection;

    return () => {
      connection.stop();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return connectionRef;
}
