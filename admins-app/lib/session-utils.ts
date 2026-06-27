import AsyncStorage from '@react-native-async-storage/async-storage';
import { adminAuthService } from './auth';

/**
 * Get the current session with enhanced error handling using the new auth system
 */
export async function getCurrentSession() {
  try {
    // Get session from AsyncStorage
    const sessionData = await AsyncStorage.getItem('admin_session');

    if (!sessionData) {
      return { data: null, error: null };
    }

    const session = JSON.parse(sessionData);

    // Verify the token is still valid
    const tokenPayload = await adminAuthService.verifyToken(session.token);
    if (!tokenPayload) {
      // Token is invalid or expired, remove from storage
      await AsyncStorage.removeItem('admin_session');
      return { data: null, error: null };
    }

    return {
      data: {
        session: session.session || { user: session.user, token: session.token },
        user: session.user
      },
      error: null
    };
  } catch (error) {
    console.error('Error getting session:', error);
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

    // In our simple system, revoking a session means removing it from storage if it matches
    const currentSession = await AsyncStorage.getItem('admin_session');
    if (currentSession) {
      const session = JSON.parse(currentSession);
      if (session.token === token) {
        await AsyncStorage.removeItem('admin_session');
      }
    }
  } catch (error) {
    console.error('Error revoking session:', error);
    throw error;
  }
}

/**
 * Revoke all other sessions except the current one
 */
export async function revokeOtherSessions(): Promise<void> {
  // In our simple local storage system, we only have one session per device
  // So this function essentially does the same as revokeSession
  console.warn('revokeOtherSessions: Only one session per device in this implementation');
}

/**
 * Revoke all sessions for the current user
 */
export async function revokeAllSessions(): Promise<void> {
  try {
    // Remove session from AsyncStorage
    await AsyncStorage.removeItem('admin_session');
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
    const sessionResult = await getCurrentSession();

    if (!sessionResult.data || !sessionResult.data.session) {
      return false;
    }

    // In our simple system, we don't store creation time in the token
    // But we can check if the token was created recently by looking at expiration
    const token = sessionResult.data.session.token;
    const tokenPayload = await adminAuthService.verifyToken(token);

    if (!tokenPayload || !tokenPayload.exp) {
      return false;
    }

    // Calculate if the token is "fresh" (created within last 5 minutes)
    const now = Math.floor(Date.now() / 1000);
    const tokenAge = tokenPayload.exp - (7 * 24 * 60 * 60); // Subtract 7 days to get creation time
    const freshAgeThreshold = now - (5 * 60); // 5 minutes ago
    
    return tokenAge >= freshAgeThreshold;
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
    // In our simple local storage system, we only have one session per device
    const session = await getCurrentSession();
    if (session.data && session.data.session) {
      return [session.data.session];
    }
    return [];
  } catch (error) {
    console.error('Error listing sessions:', error);
    return [];
  }
}

/**
 * Enhanced sign out that also revokes the session
 */
export async function enhancedSignOut(): Promise<void> {
  try {
    // Remove session from AsyncStorage
    await AsyncStorage.removeItem('admin_session');
  } catch (error) {
    console.error('Error during sign out:', error);
    // Even if signOut fails, we should still try to clear local session data
    throw error;
  }
}

/**
 * Get user session and data combined
 */
export async function getUserSessionAndData() {
  try {
    const session = await getCurrentSession();
    
    if (session.data) {
      return {
        isAuthenticated: true,
        session: session.data.session,
        user: session.data.user,
        error: null
      };
    } else {
      return {
        isAuthenticated: false,
        session: null,
        user: null,
        error: null
      };
    }
  } catch (error) {
    console.error('Error getting user session and data:', error);
    return {
      isAuthenticated: false,
      session: null,
      user: null,
      error: error
    };
  }
}