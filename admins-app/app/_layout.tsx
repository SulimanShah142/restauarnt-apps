// admins-app/app/_layout.tsx
// Match userapp/deliverapp pattern - simple initialization

import { Stack } from 'expo-router';
import { AuthProvider } from '@/contexts/AuthContext';
import { AdminAuthProvider } from '@/contexts/AdminAuthContext';
import { BadgeProvider } from '@/contexts/BadgeContext';
import { DatabaseProvider } from '@/contexts/DatabaseContext';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import React, { useState, useEffect } from 'react';
import { View, StyleSheet, LogBox, Image, ActivityIndicator } from 'react-native';
import * as SplashScreen from 'expo-splash-screen';
import { OneSignal } from 'react-native-onesignal'; // 📌 Replaced expo-notifications with OneSignal namespace
import { initializeOneSignal } from '@/utils/onesignal';
import AsyncStorage from '@react-native-async-storage/async-storage';

LogBox.ignoreLogs(['Unable to activate keep awake', 'expo-keep-awake', 'KeepAwake']);

// Keep the native splash screen visible until we hide it manually
try { SplashScreen.preventAutoHideAsync().catch(() => {}); } catch (e) {}

export default function RootLayout() {
  const [appIsReady, setAppIsReady] = useState(false);
  const [showSplash, setShowSplash] = useState(true);

  console.log('[AdminAppLayout] Render - appIsReady:', appIsReady, 'showSplash:', showSplash);

  // Initialize app
  useEffect(() => {
    async function prepare() {
      try {
        console.log('[AdminAppLayout] Initializing app...');

        // 1. Wait for AsyncStorage to be ready
        await AsyncStorage.getItem('app_init_check');
        console.log('[AdminAppLayout] ✅ AsyncStorage ready');

        // 2. Initialize OneSignal (SDK only, no permission request)
        await initializeOneSignal();
        console.log('[AdminAppLayout] ✅ OneSignal initialized (SDK only)');

        // 3. Load existing admin session
        try {
          const sessionJson = await AsyncStorage.getItem('admin_session');
          if (sessionJson) {
            const session = JSON.parse(sessionJson);
            const currentTime = Math.floor(Date.now() / 1000);
            if (session.expiresAt && currentTime < session.expiresAt) {
              const email = session.user?.email || null;
              if (email) {
                console.log('[AdminAppLayout] Admin session restored:', email);
              }
            }
          }
        } catch (error) {
          console.error('[AdminAppLayout] Error loading session:', error);
        }

        // 4. Clear badge via OneSignal to stop native channel conflicts on Android 14+
        try {
              OneSignal.Notifications.clearAll();
          console.log('[AdminAppLayout] ✅ Badge cleared via OneSignal');
        } catch (badgeError) {
          console.error('[AdminAppLayout] ⚠️ OneSignal badge clearing failed:', badgeError);
        }

        console.log('[AdminAppLayout] ✅ App initialization complete');
        setAppIsReady(true);
      } catch (e) {
        console.error('[AdminAppLayout] ❌ Initialization error:', e);
        console.error('[AdminAppLayout] Error stack:', e instanceof Error ? e.stack : 'No stack');
        setAppIsReady(true); // Continue anyway to prevent app crash
      }
    }
    prepare();
  }, []);

  // Hide splash screen when app is ready
  useEffect(() => {
    if (appIsReady) {
      const t = setTimeout(async () => {
        try {
          // Wait a bit more to ensure image is loaded
          await new Promise(r => setTimeout(r, 1500));
          console.log('[AdminAppLayout] Attempting to hide splash screen...');
          await SplashScreen.hideAsync();
          console.log('[AdminAppLayout] ✅ Splash screen hidden');
          setShowSplash(false);
        } catch (e) {
          console.error('[AdminAppLayout] Splash hide error:', e);
          setShowSplash(false);
        }
      }, 2500);
      return () => clearTimeout(t);
    }
  }, [appIsReady]);

  // Show splash screen
  if (showSplash) {
    return (
      <View style={styles.splashContainer}>
        <Image
          source={require('../assets/images/splash-screen.jpg')}
          style={styles.splashLogo}
          resizeMode="contain"
        />
        <ActivityIndicator size="large" color="#fff" style={styles.loader} />
      </View>
    );
  }

  // Render main app with proper provider hierarchy (matching userapp/deliverapp)
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <AuthProvider>
        <AdminAuthProvider>
          <DatabaseProvider>
            <BadgeProvider>
              <Stack screenOptions={{ headerShown: false }}>
                <Stack.Screen name="index" options={{ headerShown: false }} />
                <Stack.Screen name="auth-check" options={{ headerShown: false }} />
                <Stack.Screen name="admin" options={{ headerShown: false }} />
                <Stack.Screen name="modal" options={{ presentation: 'modal' }} />
              </Stack>
            </BadgeProvider>
          </DatabaseProvider>
        </AdminAuthProvider>
      </AuthProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  splashContainer: {
    flex: 1,
    width: '100%',
    height: '100%',
    backgroundColor: '#C41E26',
    justifyContent: 'center',
    alignItems: 'center'
  },
  splashLogo: {
    width: '100%',
    height: '100%',
    resizeMode: 'contain'
  },
  loader: {
    marginTop: 20
  }
});
