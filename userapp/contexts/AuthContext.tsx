import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { Redirect } from 'expo-router';
import { supabase } from '../lib/supabase';
import { View, Text, AppState, AppStateStatus, ActivityIndicator } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Session, User } from '@supabase/supabase-js';

type AuthContextType = {
  session: Session | null;
  user: User | null;
  isAuthenticated: boolean | null; // null means loading
  isLoading: boolean;
  refreshAuth: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);
  const appStateRef = React.useRef<AppStateStatus>(AppState.currentState);

  console.log('[AuthContext] Render - session:', !!session, 'isLoading:', isLoading, 'isAuthenticated:', isAuthenticated);

  const checkAuth = useCallback(async () => {
    try {
      console.log('[AuthContext] checkAuth: Starting auth check...');

      // Get session from Supabase
      const { data: { session: currentSession }, error } = await supabase.auth.getSession();

      if (error) {
        console.error('[AuthContext] checkAuth: Session error:', error);
        setSession(null);
        setIsAuthenticated(false);
        setIsLoading(false);
        return;
      }

      if (!currentSession) {
        console.log('[AuthContext] checkAuth: No session found');
        setSession(null);
        setIsAuthenticated(false);
        setIsLoading(false);
        return;
      }

      // Check if session is expired
      const now = Math.floor(Date.now() / 1000);
      const expiresAt = (currentSession as any).expires_at || 0;

      console.log('[AuthContext] checkAuth: Session found, expires_at:', expiresAt, 'now:', now, 'expired:', now > expiresAt);

      if (expiresAt && now > expiresAt) {
        console.log('[AuthContext] checkAuth: Session expired, refreshing...');
        const { data: { session: refreshedSession }, error: refreshError } = await supabase.auth.refreshSession();

        if (refreshError) {
          console.error('[AuthContext] checkAuth: Refresh error:', refreshError);
          setSession(null);
          setIsAuthenticated(false);
        } else if (refreshedSession) {
          console.log('[AuthContext] checkAuth: Session refreshed successfully');
          setSession(refreshedSession);
          setIsAuthenticated(true);
        } else {
          console.log('[AuthContext] checkAuth: No session after refresh');
          setSession(null);
          setIsAuthenticated(false);
        }
      } else {
        // Session is valid
        console.log('[AuthContext] checkAuth: Session is valid, user:', currentSession.user?.id);
        setSession(currentSession);
        setIsAuthenticated(true);
      }
    } catch (error) {
      console.error('[AuthContext] checkAuth: Error checking authentication:', error);
      setSession(null);
      setIsAuthenticated(false);
    } finally {
      setIsLoading(false);
      console.log('[AuthContext] checkAuth: Complete, isLoading: false');
    }
  }, []);

  // Initial auth check
  useEffect(() => {
    console.log('[AuthContext] useEffect: Initial auth check...');
    checkAuth();
  }, [checkAuth]);

  // Listen to auth state changes
  useEffect(() => {
    console.log('[AuthContext] useEffect: Setting up auth listener...');

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, _session) => {
      console.log('[AuthContext] onAuthStateChange: Event:', event, 'session:', !!_session);

      // CRITICAL: Update auth state IMMEDIATELY when any auth event occurs
      // This prevents race conditions where navigation happens before state updates
      setSession(_session);
      setIsAuthenticated(!!_session?.user);
      setIsLoading(false);

      // If user signed in, ensure profile exists (non-blocking, runs after state update)
      if (event === 'SIGNED_IN' && _session?.user) {
        console.log('[AuthContext] onAuthStateChange: User signed in, ensuring profile exists...');

        // Run profile check in background without blocking auth state
        (async () => {
          try {
            const { data: existingProfile } = await supabase
              .from('profiles')
              .select('id')
              .eq('id', _session.user.id)
              .single();

            if (!existingProfile) {
              console.log('[AuthContext] No profile found, creating one...');
              const { error: insertError } = await supabase
                .from('profiles')
                .insert({
                  id: _session.user.id,
                  email: _session.user.email,
                  name: _session.user.user_metadata?.full_name || _session.user.email?.split('@')[0] || 'User',
                  created_at: new Date().toISOString()
                });

              if (insertError) {
                console.error('[AuthContext] Error creating profile:', insertError);
              } else {
                console.log('[AuthContext] ✅ Profile created successfully');
              }
            } else {
              console.log('[AuthContext] ✅ Profile already exists');
            }
          } catch (error) {
            console.error('[AuthContext] Error checking/creating profile:', error);
          }
        })();

        // OneSignal tokens sync automatically via initializeOneSignal()
        console.log('[AuthContext] OneSignal will sync tokens automatically');
      }
    });

    return () => {
      console.log('[AuthContext] useEffect: Cleaning up auth listener');
      subscription.unsubscribe();
    };
  }, []);

  // Re-check auth when app comes to foreground
  useEffect(() => {
    const handleAppStateChange = (nextAppState: AppStateStatus) => {
      if (
        appStateRef.current.match(/inactive|background/) &&
        nextAppState === 'active'
      ) {
        console.log('[AuthContext] onAppStateChange: App came to foreground, re-checking auth');
        checkAuth();
      }
      appStateRef.current = nextAppState;
    };

    const subscription = AppState.addEventListener('change', handleAppStateChange);

    return () => {
      console.log('[AuthContext] useEffect: Cleaning up app state listener');
      subscription.remove();
    };
  }, [checkAuth]);

  // REMOVED: Polling interval - not needed, Supabase handles session refresh automatically
  // The onAuthStateChange listener handles all session changes

  return (
    <AuthContext.Provider value={{
      session,
      user: session?.user ?? null,
      isAuthenticated,
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
    console.warn('[useAuth] Used outside AuthProvider, returning defaults');
    return {
      session: null,
      user: null,
      isAuthenticated: null,
      isLoading: true,
      refreshAuth: async () => {}
    };
  }

  return context;
}

export function RequireAuth({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color="#C41E26" />
        <Text style={{ color: '#C41E26', marginTop: 12, fontSize: 16, fontWeight: '500' }}>Loading...</Text>
      </View>
    );
  }

  if (!isAuthenticated) {
    return <Redirect href="/(auth)/sign-in" />;
  }

  return <>{children}</>;
}

export function RedirectIfAuthenticated({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color="#C41E26" />
        <Text style={{ color: '#C41E26', marginTop: 12, fontSize: 16, fontWeight: '500' }}>Loading...</Text>
      </View>
    );
  }

  if (isAuthenticated) {
    // Navigation is handled by auth-check.tsx, not here
    return <>{children}</>;
  }

  return <>{children}</>;
}
