import React, { createContext, useContext, useEffect, useState } from 'react';
import { Redirect, router } from 'expo-router';
import { View, Text, ActivityIndicator } from 'react-native';
import { isAdminAuthenticated } from '@/lib/admin-auth';

type AuthContextType = {
  isAuthenticated: boolean | null; // null means loading
  loading: boolean;
  session: any; // Current session object
  user: any; // Current user object
  isLoading: boolean; // Alias for loading
  refreshAuth: () => Promise<void>; // Function to manually refresh auth state
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null); // null means loading
  const [session, setSession] = useState<any>(null);
  const [hasInitialized, setHasInitialized] = useState(false);

  const checkAuth = async () => {
    try {
      const authStatus = await isAdminAuthenticated();
      setIsAuthenticated(authStatus);
    } catch (error) {
      console.error('[AuthContext] Error checking auth:', error);
      setIsAuthenticated(false);
    }
  };

  const refreshAuth = async () => {
    setIsAuthenticated(null); // Set loading state
    await checkAuth();
  };

  useEffect(() => {
    // Initial auth check
    const initAuth = async () => {
      await checkAuth();
      setHasInitialized(true);
    };
    initAuth();

    // Set up interval to check authentication status every 30 seconds
    const interval = setInterval(checkAuth, 30000);

    return () => {
      clearInterval(interval);
    };
  }, []);

  const value = {
    isAuthenticated,
    loading: !hasInitialized || isAuthenticated === null,
    session, // We don't use Supabase session for custom auth
    user: null, // No user object in custom auth
    isLoading: !hasInitialized || isAuthenticated === null, // Alias for loading
    refreshAuth,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    // Return default values instead of throwing to prevent crashes
    console.warn('[useAuth] Used outside AuthProvider, returning default values');
    return {
      isAuthenticated: null,
      loading: true,
      session: null,
      user: null,
      isLoading: true,
      refreshAuth: async () => {},
    };
  }
  return context;
}

// Component to protect routes that require authentication
function RequireAuthComponent({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, loading } = useAuth();

  if (loading) {
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
    return <Redirect href="/admin/login" />;
  }

  return <>{children}</>;
}

// Component for routes that should only be accessible when NOT authenticated
export function RedirectIfAuthenticated({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, loading } = useAuth();

  if (loading) {
    // Show a loading indicator while checking authentication status
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color="#C41E26" />
        <Text style={{ color: '#C41E26', marginTop: 12, fontSize: 16, fontWeight: '500' }}>Loading...</Text>
      </View>
    );
  }

  if (isAuthenticated) {
    // Redirect to dashboard if already authenticated
    return <Redirect href="/admin/dashboard" />;
  }

  return <>{children}</>;
}

// Export the components with their proper names
export const RequireAuth = RequireAuthComponent;