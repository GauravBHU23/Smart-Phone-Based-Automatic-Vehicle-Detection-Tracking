import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import React from "react";
import { ActivityIndicator, View } from "react-native";
import { useAuth } from "../context/AuthContext";
import LoginScreen from "../screens/LoginScreen";
import RegisterScreen from "../screens/RegisterScreen";
import DriverScreen from "../screens/DriverScreen";
import PassengerScreen from "../screens/PassengerScreen";

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
    <NavigationContainer>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        {!token ? (
          <>
            <Stack.Screen name="Login" component={LoginScreen} />
            <Stack.Screen name="Register" component={RegisterScreen} />
          </>
        ) : role === "Driver" ? (
          <Stack.Screen name="Driver" component={DriverScreen} />
        ) : (
          <Stack.Screen name="Passenger" component={PassengerScreen} />
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}
