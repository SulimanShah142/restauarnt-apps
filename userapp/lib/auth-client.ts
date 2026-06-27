import { supabase } from './supabase';
import { useState, useEffect, useRef } from 'react';

// Hook to manage session state
export const useSession = () => {
  const [session, setSession] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;

    const initializeSession = async () => {
      try {
        // Get initial session
        const { data: { session } } = await supabase.auth.getSession();
        if (mountedRef.current) {
          setSession(session);
        }
      } catch (error) {
        // console.error('Error getting session:', error);
      } finally {
        if (mountedRef.current) {
          setIsLoading(false);
        }
      }
    };

    initializeSession();

    // Subscribe to auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, newSession) => {
        if (mountedRef.current) {
          setSession(newSession);
        }
      }
    );

    // Cleanup function
    return () => {
      mountedRef.current = false;
      subscription?.unsubscribe();
    };
  }, []); // Empty dependency array to ensure this only runs once

  return { data: { session }, isLoading, mutate: () => {} };
};

// Separate function to get session directly without hooks
export const getSessionDirect = async () => {
  try {
    const { data, error } = await supabase.auth.getSession();
    if (error) {
      // console.error('Error getting session:', error);
      return { session: null };
    }
    return { session: data.session };
  } catch (error) {
    // console.error('Error getting session:', error);
    return { session: null };
  }
};

// Sign in function
export const signIn = {
  email: async ({ email, password }: { email: string; password: string }) => {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      throw error;
    }

    // After successful sign in, ensure the user has the user role
    // Update the user's metadata to ensure they have the user role
    if (data?.user) {
      const { error: updateError } = await supabase
        .from('users')
        .upsert({
          id: data.user.id,
          email: data.user.email,
          full_name: data.user.user_metadata?.full_name || data.user.email?.split('@')[0],
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        } as any, { onConflict: 'id' });

      if (updateError) {
        // console.error('Error ensuring user record:', updateError);
      }
    }

    return data;
  }
};

// Sign out function
export const signOut = async () => {
  const { error } = await supabase.auth.signOut();

  if (error) {
    // console.error('Error signing out:', error);
    throw error;
  }
};

// Sign up function
export const signUp = {
  email: async ({ email, password, name }: { email: string; password: string; name: string }) => {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: name,
          role: 'user',
        },
      },
    });

    if (error) {
      throw error;
    }

    // After successful sign up, ensure the user is added to the users table
    if (data?.user) {
      const { error: insertError } = await supabase
        .from('users')
        .insert({
          id: data.user.id,
          email: data.user.email,
          full_name: name,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        } as any);

      if (insertError) {
        // console.error('Error adding user record:', insertError);
      }
    }

    return data;
  }
};

// Get session function
export const getSession = async () => {
  const { data, error } = await supabase.auth.getSession();

  if (error) {
    // console.error('Error getting session:', error);
    throw error;
  }

  return { data: { session: data.session, user: data.session?.user } };
};

// Helper function to get user role from session with network error handling
export const getUserRole = async () => {
  try {
    const session = await getSession();
    return session?.data?.user?.user_metadata?.role || session?.data?.user?.role || null;
  } catch (error) {
    // console.error('Error getting user role:', error);
    // Check if it's a network error
    if (error instanceof Error && (error.message.includes('network') || error.message.includes('connection'))) {
      // console.warn('Network error occurred when getting user role');
      return null;
    }
    return null;
  }
};