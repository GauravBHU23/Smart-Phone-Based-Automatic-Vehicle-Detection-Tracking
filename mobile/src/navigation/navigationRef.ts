import { createNavigationContainerRef } from "@react-navigation/native";

type RootStackParamList = {
  VehicleStatus: { vehicleId: string };
  [key: string]: object | undefined;
};

export const navigationRef = createNavigationContainerRef<RootStackParamList>();

export function navigateToVehicleStatus(vehicleId: string) {
  if (navigationRef.isReady()) {
    navigationRef.navigate("VehicleStatus", { vehicleId });
  }
}
