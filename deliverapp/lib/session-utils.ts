import { supabase } from './supabase';

/**
 * Get the current session with enhanced error handling using Supabase
 */
export async function getCurrentSession() {
  try {
    const { data, error } = await supabase.auth.getSession();

    if (error) {
      throw error;
    }


    if (data?.session) {
      return {
        data: {
          session: data.session,
          user: data.session.user
        },
        error: null
      };
    } else {
      return { data: null, error: null };
    }
  } catch (error) {
    console.error('Error getting session:', error);
    console.error('Error details:', error instanceof Error ? error.message : error);
    return { data: null, error };
  }
}

/**
 * Revoke a specific session by token
 */
export async function revokeSession(token: string): Promise<void> {
  try {
    // Validate input
    if (!token || typeof token !== 'string') {
      throw new Error('Invalid session token provided');
    }

    // Supabase doesn't allow revoking a specific session by token
    // Instead, we'll sign out the current session
    console.warn('Supabase does not support revoking a specific session by token. Signing out current session.');
    await supabase.auth.signOut();
  } catch (error) {
    console.error('Error revoking session:', error);
    throw error;
  }
}

/**
 * Revoke all other sessions except the current one
 */
export async function revokeOtherSessions(): Promise<void> {
  try {
    const { error } = await supabase.auth.signOut({ scope: 'others' });
    
    if (error) {
      throw error;
    }
  } catch (error) {
    console.error('Error revoking other sessions:', error);
    throw error;
  }
}

/**
 * Revoke all sessions for the current user
 */
export async function revokeAllSessions(): Promise<void> {
  try {
    const { error } = await supabase.auth.signOut();
    
    if (error) {
      throw error;
    }
  } catch (error) {
    console.error('Error revoking all sessions:', error);
    throw error;
  }
}

/**
 * Check if the current session is fresh (created within the freshAge window)
 */
export async function isSessionFresh(): Promise<boolean> {
  try {
    const sessionData = await getCurrentSession();

    if (!sessionData?.data?.session) {
      return false;
    }

    // For Supabase, we'll check if the session is close to expiration
    // A "fresh" session is one that's far from expiring (meaning it was recently refreshed)
    const now = new Date();
    const expiresAtTimestamp = sessionData.data.session.expires_at;
    if (!expiresAtTimestamp) {
      return false; // No expiration time, consider not fresh
    }
    const expiresAt = new Date(expiresAtTimestamp * 1000);
    const fiveMinutes = 5 * 60 * 1000; // 5 minutes in milliseconds

    // A session is "fresh" if it has more than 5 minutes before expiration
    return (expiresAt.getTime() - now.getTime()) > fiveMinutes;
  } catch (error) {
    console.error('Error checking session freshness:', error);
    return false;
  }
}

/**
 * List all active sessions for the current user
 */
export async function listUserSessions(): Promise<any[]> {
  try {
    // Supabase doesn't have a direct way to list all sessions for a user
    // We'll return the current session info as a single-item array
    const sessionData = await getCurrentSession();
    return sessionData?.data?.session ? [sessionData.data.session] : [];
  } catch (error) {
    console.error('Error getting session:', error);
    return [];
  }
}

/**
 * Enhanced sign out that also revokes the session
 */
export async function enhancedSignOut(): Promise<void> {
  try {
    const { error } = await supabase.auth.signOut();
    
    if (error) {
      throw error;
    }
  } catch (error) {
    console.error('Error during sign out:', error);
    // Even if signOut fails, we should still try to clear local session data
    throw error;
  }
}