import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import React from "react";
import { ActivityIndicator, View } from "react-native";
import { useAuth } from "../context/AuthContext";
import IncomingBookingPopup from "../components/IncomingBookingPopup";
import AdminScreen from "../screens/AdminScreen";
import BookVehicleScreen from "../screens/BookVehicleScreen";
import DriverVerificationScreen from "../screens/DriverVerificationScreen";
import EditVehicleScreen from "../screens/EditVehicleScreen";
import LoginScreen from "../screens/LoginScreen";
import MyBookingsScreen from "../screens/MyBookingsScreen";
import RegisterScreen from "../screens/RegisterScreen";
import DriverScreen from "../screens/DriverScreen";
import SearchScreen from "../screens/SearchScreen";
import VehicleStatusScreen from "../screens/VehicleStatusScreen";
import WaitingForDriverScreen from "../screens/WaitingForDriverScreen";
import PassengerTabs from "./PassengerTabs";
import { navigationRef } from "./navigationRef";

const Stack = createNativeStackNavigator();

export default function RootNavigator() {
  const { token, role, isLoading } = useAuth();

  if (isLoading) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  return (
    <NavigationContainer ref={navigationRef}>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        {!token ? (
          <>
            <Stack.Screen name="Login" component={LoginScreen} />
            <Stack.Screen name="Register" component={RegisterScreen} />
            <Stack.Screen name="PublicSearch" component={SearchScreen} />
            <Stack.Screen name="VehicleStatus" component={VehicleStatusScreen} />
          </>
        ) : role === "Driver" ? (
          <>
            <Stack.Screen name="Driver" component={DriverScreen} />
            <Stack.Screen name="VehicleStatus" component={VehicleStatusScreen} />
            <Stack.Screen name="MyBookings" component={MyBookingsScreen} />
            <Stack.Screen name="EditVehicle" component={EditVehicleScreen} />
            <Stack.Screen name="DriverVerification" component={DriverVerificationScreen} />
          </>
        ) : role === "Admin" ? (
          <Stack.Screen name="Admin" component={AdminScreen} />
        ) : (
          <>
            <Stack.Screen name="PassengerTabs" component={PassengerTabs} />
            <Stack.Screen name="VehicleStatus" component={VehicleStatusScreen} />
            <Stack.Screen name="BookVehicle" component={BookVehicleScreen} />
            <Stack.Screen name="WaitingForDriver" component={WaitingForDriverScreen} />
          </>
        )}
      </Stack.Navigator>
      {/* Overlays every screen in the Driver stack above, regardless of
          which one is currently focused — matches the web app's layout.tsx
          mounting its popup once at the root for the same reason. */}
      {role === "Driver" && <IncomingBookingPopup />}
    </NavigationContainer>
  );
}
