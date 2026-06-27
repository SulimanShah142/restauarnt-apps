// deliverapp/app/_layout.tsx
// OneSignal-only notification flow (foreground, background, closed app)

import { router, Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { AuthProvider } from '@/contexts/AuthContext';
import { DatabaseProvider } from '@/contexts/DatabaseContext';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import React, { useState, useEffect } from 'react';
import { View, StyleSheet, Platform, Image, LogBox } from 'react-native';
import * as SplashScreen from 'expo-splash-screen';
import * as Notifications from 'expo-notifications';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { initializeNotificationService } from '@/lib/notification-service';
import NotificationPermissionPrompt from '@/components/NotificationPermissionPrompt';
import { getStoredDeliverySession } from '@/lib/delivery-auth';
import { initializeOneSignal } from '@/utils/onesignal';
import { OneSignal } from 'react-native-onesignal';

// =====================================================
// PUSH TOKEN REGISTRATION (for OneSignal notifications)
// =====================================================
function RegisterPushToken() {
  useEffect(() => {
    const linkUserWithOneSignal = async () => {
      try {
        console.log('[RegisterPushToken] Checking session...');
        const session = await getStoredDeliverySession();
        
        if (session?.delivery_person_id) {
          console.log('[RegisterPushToken] Active session found. Linking OneSignal External ID:', session.delivery_person_id);
          // 💡 CRITICAL: Tell OneSignal who this user is inside the system
          OneSignal.login(session.delivery_person_id);
        }
      } catch (error) {
        console.error('[RegisterPushToken] Error linking user:', error);
      }
    };
    linkUserWithOneSignal();
  }, []);

  return null;
}

// =====================================================
// NATIVE ONESIGNAL CLICK HANDLER (Replaces Expo Listeners)
// =====================================================
function OneSignalNotificationHandler() {
  useEffect(() => {
    // OneSignal v5 Click Listener API
    OneSignal.Notifications.addEventListener('click', (event) => {
      console.log('[OneSignal] Notification clicked:', event.notification);
      const data: any = event.notification.additionalData;

      if (data?.orderId || data?.order_id) {
        const orderId = data.orderId || data.order_id;
        router.push(`/delivery-task?orderId=${orderId}`);
      } else if (data?.type === 'new_assignment') {
        router.push('../(tabs)/deliveries');
      }
    });

    return () => {
      // Clean up listener on unmount
      OneSignal.Notifications.removeEventListener('click', () => {});
    };
  }, []);

  return null;
}

// =====================================================
// APP INITIALIZATION
// =====================================================
LogBox.ignoreLogs(['Unable to activate keep awake', 'expo-keep-awake', 'KeepAwake']);
try { SplashScreen.preventAutoHideAsync().catch(() => {}); } catch (e) {}

export default function RootLayout() {
  const [appIsReady, setAppIsReady] = useState(false);
  const [showSplash, setShowSplash] = useState(true);
  const [showNotificationPrompt, setShowNotificationPrompt] = useState(false);

  // Initialize app
  useEffect(() => {
    async function prepare() {
      try {
        // Initialize OneSignal (SDK only, no permission request)
        await initializeOneSignal();
        console.log('[DeliveryAppLayout] ✅ OneSignal initialized (SDK only)');

        // Initialize notification service
        await initializeNotificationService();

        // 4. Notification permissions will be requested during login (in syncOneSignalTokens)
        console.log('[DeliveryAppLayout] ℹ️ Notification permissions will be requested during login');

        // Clear badge
        await Notifications.setBadgeCountAsync(0);

        setAppIsReady(true);
      } catch (e) {
        console.error('[DeliverLayout] Initialization error:', e);
        setAppIsReady(true);
      }
    }
    prepare();
  }, []);

  // Hide splash screen
  useEffect(() => {
    if (appIsReady) {
      const t = setTimeout(async () => {
        try {
          // Wait a bit more to ensure image is loaded
          await new Promise(r => setTimeout(r, 1500));
          await SplashScreen.hideAsync();
          setShowSplash(false);

          // Show notification permission prompt
          setTimeout(() => setShowNotificationPrompt(true), 500);
        } catch (e) {
          console.error('[DeliverLayout] Splash hide error:', e);
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
        <Image source={require('../assets/images/splash-screen.jpg')} style={styles.splashLogo} />
      </View>
    );
  }

  // Render main app
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <NotificationPermissionPrompt visible={showNotificationPrompt} onClose={() => setShowNotificationPrompt(false)} />
      <AuthProvider>
        <DatabaseProvider>
          {/* Push token registration for OneSignal notifications */}
          <RegisterPushToken />

          {/* Notification response handler (tap handling) */}
       
       

          <Stack screenOptions={{ headerShown: false }}>
            <Stack.Screen name="index" options={{ headerShown: false }} />
            <Stack.Screen name="auth-check" options={{ headerShown: false }} />
            <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
            <Stack.Screen name="delivery-task" options={{ headerShown: false }} />
          </Stack>
        </DatabaseProvider>
      </AuthProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  splashContainer: { flex: 1, width: '100%', height: '100%', backgroundColor: '#C41E26', justifyContent: 'center', alignItems: 'center' },
  splashLogo: { width: '100%', height: undefined, aspectRatio: 1, resizeMode: 'contain' },
});
