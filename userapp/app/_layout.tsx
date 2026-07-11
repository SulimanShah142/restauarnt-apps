// userapp/app/_layout.tsx

import { Stack } from "expo-router";

import { CartProvider } from "../contexts/CartContext";
import { DatabaseProvider } from "../contexts/DatabaseContext";
import { BadgeProvider } from "../contexts/BadgeContext";
import { AuthProvider } from "../contexts/AuthContext";

import { GestureHandlerRootView } from "react-native-gesture-handler";

import React, { useEffect, useState } from "react";

import {
  View,
  StyleSheet,
  LogBox,
  Image,
  ActivityIndicator,
} from "react-native";

import * as SplashScreen from "expo-splash-screen";
import * as Notifications from "expo-notifications";

import AsyncStorage from "@react-native-async-storage/async-storage";

import { Asset } from "expo-asset";

import { supabase } from "../lib/supabase";
import { initializeOneSignal } from "../utils/onesignal";

LogBox.ignoreLogs([
  "Unable to activate keep awake",
  "expo-keep-awake",
  "KeepAwake",
]);

// IMPORTANT
SplashScreen.preventAutoHideAsync().catch(() => {});

// Safety wrapper
async function safeTask(
  name: string,
  task: () => Promise<any>,
  timeout = 8000,
) {
  try {
    console.log(`[BOOT] Starting ${name}`);

    await Promise.race([
      task(),

      new Promise((_, reject) =>
        setTimeout(() => reject(new Error(`${name} timeout`)), timeout),
      ),
    ]);

    console.log(`[BOOT] ✅ ${name} completed`);
  } catch (error) {
    console.error(`[BOOT] ❌ ${name} failed`, error);
  }
}

export default function RootLayout() {
  const [appReady, setAppReady] = useState(false);
  const [showSplash, setShowSplash] = useState(true);

  useEffect(() => {
    async function boot() {
      console.log("[BOOT] AYAR startup beginning");

      await safeTask("Splash Asset", async () => {
        const asset = Asset.fromModule(
          require("../assets/images/splash-screen.jpg"),
        );

        await asset.downloadAsync();
      });

      await safeTask("AsyncStorage", async () => {
        await AsyncStorage.getItem("app_init_check");
      });

      await safeTask("Supabase", async () => {
        const { data } = await supabase.auth.getSession();

        console.log("[BOOT] Supabase session", !!data.session);
      });

      await safeTask("OneSignal", async () => {
        await initializeOneSignal();
      });

      await safeTask("Badge Reset", async () => {
        await Notifications.setBadgeCountAsync(0);
      });

      console.log("[BOOT] ALL SERVICES FINISHED");

      // NEVER BLOCK APP
      setAppReady(true);
    }

    // absolute emergency escape
    const emergency = setTimeout(() => {
      console.error("[BOOT] Emergency startup unlock");

      setAppReady(true);
    }, 12000);

    boot().finally(() => {
      clearTimeout(emergency);
    });
  }, []);

  useEffect(() => {
    if (!appReady) return;

    const hide = async () => {
      try {
        await SplashScreen.hideAsync();
      } catch (e) {
        console.log("[BOOT] Splash hide failed", e);
      }

      setShowSplash(false);
    };

    const timer = setTimeout(hide, 500);

    return () => clearTimeout(timer);
  }, [appReady]);

  if (showSplash) {
    return (
      <View style={styles.splashContainer}>
        <Image
          source={require("../assets/images/splash-screen.jpg")}
          style={styles.splashLogo}
          resizeMode="contain"
        />

        <ActivityIndicator
          size="large"
          color="#fff"
          style={{
            marginTop: 20,
          }}
        />
      </View>
    );
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <AuthProvider>
        <DatabaseProvider>
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
        </DatabaseProvider>
      </AuthProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  splashContainer: {
    flex: 1,

    backgroundColor: "#C41E26",

    justifyContent: "center",

    alignItems: "center",
  },

  splashLogo: {
    width: "100%",

    aspectRatio: 1,

    resizeMode: "contain",
  },
});
