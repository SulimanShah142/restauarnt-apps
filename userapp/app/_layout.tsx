// userapp/app/_layout.tsx
// Match deliverapp/admins-app pattern - simple initialization

import { Stack } from 'expo-router';
import { CartProvider } from '../contexts/CartContext';
import { DatabaseProvider } from '../contexts/DatabaseContext';
import { BadgeProvider } from '../contexts/BadgeContext';
import { AuthProvider } from '../contexts/AuthContext';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import React, { useState, useEffect } from 'react';
import { View, StyleSheet, LogBox, Image, ActivityIndicator } from 'react-native';
import { Asset } from 'expo-asset';
import * as SplashScreen from 'expo-splash-screen';
import * as Notifications from 'expo-notifications';
import { initializeOneSignal } from '../utils/onesignal';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../lib/supabase';

LogBox.ignoreLogs(['Unable to activate keep awake', 'expo-keep-awake', 'KeepAwake']);

export default function RootLayout() {
  const [appIsReady, setAppIsReady] = useState(false);
  const [showSplash, setShowSplash] = useState(true);

  console.log('[UserAppLayout] Render - appIsReady:', appIsReady, 'showSplash:', showSplash);

  // Initialize app
  useEffect(() => {
    async function prepare() {
      try {
        console.log('[UserAppLayout] Initializing app...');

        // 0. Preload splash image to prevent 0x0 render
        const splashAsset = Asset.fromModule(require('../assets/images/splash-screen.jpg'));
        await splashAsset.downloadAsync();
        console.log('[UserAppLayout] ✅ Splash image preloaded');

        // 1. Wait for AsyncStorage to be ready
        await AsyncStorage.getItem('app_init_check');
        console.log('[UserAppLayout] ✅ AsyncStorage ready');

        // 2. Initialize Supabase client
        console.log('[UserAppLayout] Initializing Supabase...');
        try {
          const { data: { session } } = await supabase.auth.getSession();
          console.log('[UserAppLayout] ✅ Supabase ready, session:', !!session);
        } catch (supabaseError) {
          console.error('[UserAppLayout] Supabase initialization error:', supabaseError);
        }

        // 3. Initialize OneSignal (SDK only, no permission request)
        await initializeOneSignal();
        console.log('[UserAppLayout] ✅ OneSignal initialized (SDK only)');

        // 4. Notification permissions will be requested during login
        console.log('[UserAppLayout] ℹ️ Notification permissions will be requested during login');

        // 5. Clear badge
        await Notifications.setBadgeCountAsync(0);
        console.log('[UserAppLayout] ✅ Badge cleared');

        console.log('[UserAppLayout] ✅ App initialization complete');
        setAppIsReady(true);
      } catch (e) {
        console.error('[UserAppLayout] ❌ Initialization error:', e);
        console.error('[UserAppLayout] Error stack:', e instanceof Error ? e.stack : 'No stack');
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
          await SplashScreen.hideAsync();
          setShowSplash(false);
        } catch (e) {
          console.error('[UserAppLayout] Splash hide error:', e);
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
          onLoad={() => console.log('[UserAppLayout] ✅ Splash image loaded')}
        />
        <ActivityIndicator size="large" color="#fff" style={{ marginTop: 20 }} />
      </View>
    );
  }

  // Render main app with proper provider hierarchy (matching deliverapp/admins-app)
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <AuthProvider>
        <DatabaseProvider>
          <CartProvider>
            <BadgeProvider>
              <Stack screenOptions={{ headerShown: false }}>
                <Stack.Screen name="index" options={{ headerShown: false }} />
                <Stack.Screen name="auth-check" options={{ headerShown: false }} />
                <Stack.Screen name="(auth)" options={{ headerShown: false }} />
                <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
                <Stack.Screen name="order-details" options={{ headerShown: false }} />
                <Stack.Screen name="modal" options={{ presentation: 'modal' }} />
              </Stack>
            </BadgeProvider>
          </CartProvider>
        </DatabaseProvider>
      </AuthProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  splashContainer: { flex: 1, backgroundColor: '#C41E26', justifyContent: 'center', alignItems: 'center' },
  splashLogo: { width: '100%', height: undefined, aspectRatio: 1, resizeMode: 'contain' },
});
