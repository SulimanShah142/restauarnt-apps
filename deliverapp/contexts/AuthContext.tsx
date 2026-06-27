import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { Redirect } from 'expo-router';
import { isDeliveryPersonAuthenticated, getCurrentSession, clearDeliverySession } from '@/lib/delivery-auth';
import { View, Text, AppState, AppStateStatus, ActivityIndicator } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Delivery person session type
type DeliverySession = {
  delivery_person_id: string;
  user_id: string;
  email: string;
  name: string;
  phone?: string;
  vehicle_type?: string;
  license_plate?: string;
  is_available?: boolean;
  created_at: number;
  expires_at: number;
};

type AuthContextType = {
  session: DeliverySession | null;
  user: any | null;
  isAuthenticated: boolean | null; // null means loading
  hasDeliveryRole: boolean | null; // null means loading
  isLoading: boolean;
  refreshAuth: () => Promise<void>; // Add refresh function
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<DeliverySession | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);
  const [hasDeliveryRole, setHasDeliveryRole] = useState<boolean | null>(null);
  const appStateRef = React.useRef<AppStateStatus>(AppState.currentState);

  const checkAuth = useCallback(async () => {
    try {
      
      // First check local session (fast, no network)
      const deliverySession = await getCurrentSession();

      if (!deliverySession) {
        setSession(null);
        setIsAuthenticated(false);
        setHasDeliveryRole(false);
        setIsLoading(false);
        return;
      }

      // Check if session is expired
      if (deliverySession.expires_at && Date.now() > deliverySession.expires_at) {
        await clearDeliverySession();
        setSession(null);
        setIsAuthenticated(false);
        setHasDeliveryRole(false);
        setIsLoading(false);
        return;
      }

      // Session is valid locally - use it
      setSession(deliverySession);
      setIsAuthenticated(true);
      setHasDeliveryRole(true);
      
      // Background verification (non-blocking)
      const authenticated = await isDeliveryPersonAuthenticated();
      
      if (!authenticated) {
        setSession(null);
        setIsAuthenticated(false);
        setHasDeliveryRole(false);
      }
    } catch (error) {
      console.error('[AuthContext] Error checking authentication:', error);
      // On error, check if we have a local session and use it
      try {
        const deliverySession = await getCurrentSession();
        if (deliverySession) {
          setSession(deliverySession);
          setIsAuthenticated(true);
          setHasDeliveryRole(true);
        } else {
          setIsAuthenticated(false);
          setHasDeliveryRole(false);
        }
      } catch {
        setIsAuthenticated(false);
        setHasDeliveryRole(false);
      }
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Initial auth check
  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  // Re-check auth when app comes to foreground
  useEffect(() => {
    const handleAppStateChange = (nextAppState: AppStateStatus) => {
      // If app is coming to foreground from background/inactive, re-check auth
      if (
        appStateRef.current.match(/inactive|background/) && 
        nextAppState === 'active'
      ) {
        checkAuth();
      }
      appStateRef.current = nextAppState;
    };

    const subscription = AppState.addEventListener('change', handleAppStateChange);

    return () => {
      subscription.remove();
    };
  }, [checkAuth]);

  // Listen for AsyncStorage changes (session storage)
  useEffect(() => {
    const unsubscribe = AsyncStorage.mergeItem; // This won't work, we need a different approach
    
    // Set up a polling interval to check for session changes
    const interval = setInterval(() => {
      checkAuth();
    }, 2000); // Check every 2 seconds

    return () => {
      clearInterval(interval);
    };
  }, [checkAuth]);

  return (
    <AuthContext.Provider value={{
      session,
      user: session ? {
        id: session.user_id,
        email: session.email,
        name: session.name,
        phone: session.phone,
        user_metadata: {
          role: 'delivery',
          delivery_person_id: session.delivery_person_id,
          vehicle_type: session.vehicle_type,
          license_plate: session.license_plate
        }
      } : null,
      isAuthenticated,
      hasDeliveryRole,
      isLoading,
      refreshAuth: checkAuth
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

// Component to protect routes that require authentication
export function RequireAuth({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, hasDeliveryRole, isLoading, refreshAuth } = useAuth();

  if (isLoading) {
    // Show a loading indicator while checking authentication status
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color="#C41E26" />
        <Text style={{ color: '#C41E26', marginTop: 12, fontSize: 16, fontWeight: '500' }}>Loading...</Text>
      </View>
    );
  }

  if (!isAuthenticated) {
    // Redirect to login if not authenticated
    return <Redirect href="/login" />;
  }

  // Check if user has delivery role
  if (hasDeliveryRole === null || hasDeliveryRole === false) {
    // Redirect to login if user doesn't have delivery role
    return <Redirect href="/login" />;
  }

  return <>{children}</>;
}

// Component for routes that should only be accessible when NOT authenticated
export function RedirectIfAuthenticated({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, hasDeliveryRole, isLoading } = useAuth();

  if (isLoading) {
    // Show a loading indicator while checking authentication status
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color="#C41E26" />
        <Text style={{ color: '#C41E26', marginTop: 12, fontSize: 16, fontWeight: '500' }}>Loading...</Text>
      </View>
    );
  }

  if (isAuthenticated && hasDeliveryRole) {
    // Redirect to orders page if already authenticated with delivery role
    return <Redirect href="/(tabs)/orders" />;
  }

  return <>{children}</>;
}