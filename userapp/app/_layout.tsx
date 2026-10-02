// userapp/app/_layout.tsx

import { Stack } from "expo-router";

import { CartProvider } from "../contexts/CartContext";
import { BadgeProvider } from "../contexts/BadgeContext";
import { AuthProvider } from "../contexts/AuthContext";

import { GestureHandlerRootView } from "react-native-gesture-handler";

import { StyleSheet, LogBox } from "react-native";

import * as SplashScreen from "expo-splash-screen";

LogBox.ignoreLogs([
  "Unable to activate keep awake",
  "expo-keep-awake",
  "KeepAwake",
]);

SplashScreen.preventAutoHideAsync().catch(() => {});

export default function RootLayout() {
  return (
    <GestureHandlerRootView
      style={styles.root}
      onLayout={() => {
        void SplashScreen.hideAsync().catch((error) => {
          console.warn("[BOOT] Could not hide native splash screen", error);
        });
      }}
    >
      <AuthProvider>
        <CartProvider>
          <BadgeProvider>
            <Stack
              screenOptions={{
                headerShown: false,
              }}
            >
              <Stack.Screen name="index" />

              <Stack.Screen name="auth-check" />

              <Stack.Screen name="(auth)" />

              <Stack.Screen name="(tabs)" />

              <Stack.Screen name="order-details" />

              <Stack.Screen
                name="modal"
                options={{
                  presentation: "modal",
                }}
              />
            </Stack>
          </BadgeProvider>
        </CartProvider>
      </AuthProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
});
