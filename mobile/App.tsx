import * as Notifications from "expo-notifications";
import { StatusBar } from "expo-status-bar";
import React, { useEffect } from "react";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { AuthProvider } from "./src/context/AuthContext";
import { navigateToVehicleStatus } from "./src/navigation/navigationRef";
import RootNavigator from "./src/navigation/RootNavigator";
import "./src/tracking/locationTask";

export default function App() {
  useEffect(() => {
    const subscription = Notifications.addNotificationResponseReceivedListener((response) => {
      const vehicleId = response.notification.request.content.data?.vehicleId as string | undefined;
      if (vehicleId) navigateToVehicleStatus(vehicleId);
    });
    return () => subscription.remove();
  }, []);

  return (
    <SafeAreaProvider>
      <AuthProvider>
        <RootNavigator />
        <StatusBar style="auto" />
      </AuthProvider>
    </SafeAreaProvider>
  );
}
