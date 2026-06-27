import AsyncStorage from '@react-native-async-storage/async-storage';
// NOTE: Removed clearExternalUserId import - we no longer call it on logout

// =====================================================
// HARDCODED ADMIN CREDENTIALS
// These credentials are hardcoded and not stored in env files
// =====================================================
const ADMIN_EMAIL = 'Mohammadseyar885@gmail.com';
const ADMIN_PASSWORD = '@12345678@';

// Admin session management
const ADMIN_SESSION_KEY = 'admin_session';

export interface AdminSession {
  id: string;
  email: string;
  name: string;
  role: string;
  expiresAt: number; // Unix timestamp
}

// Calculate 30 days in seconds (extended from 1 day)
const ONE_DAY_SECONDS = 30 * 24 * 60 * 60; // 30 days

// Check if admin is currently logged in
export const isAdminAuthenticated = async (): Promise<boolean> => {
  return await checkAdminSession();
};

// Function to verify admin credentials (hardcoded)
export const verifyAdminCredentials = async (email: string, password: string): Promise<boolean> => {
  try {
    // Check if the provided email and password match the hardcoded credentials
    if (email === ADMIN_EMAIL && password === ADMIN_PASSWORD) {
      return true;
    } else {
      return false;
    }
  } catch (error) {
    console.error('Error verifying admin credentials:', error);
    return false;
  }
};

// Login admin user
export const loginAdmin = async (email: string, password: string): Promise<boolean> => {
  try {
    // Verify admin credentials against hardcoded values
    const isValidAdmin = await verifyAdminCredentials(email, password);

    if (isValidAdmin) {

      // Create a session object with expiration
      const currentTime = Math.floor(Date.now() / 1000); // Current time in seconds
      const expiresAt = currentTime + ONE_DAY_SECONDS; // Expires in 30 days

      // Generate a temporary token for local session management
      const tempToken = 'temp-session-token-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9);

      const sessionData = {
        user: {
          id: 'local-admin-user', // Local identifier since we're not using Supabase auth
          email: ADMIN_EMAIL, // Use hardcoded email
          name: 'Admin User',
          role: 'ADMIN'
        },
        token: tempToken, // Use a temporary token for local session management
        expiresAt: expiresAt // Set expiration time
      };

      // Store session in AsyncStorage
      await AsyncStorage.setItem(ADMIN_SESSION_KEY, JSON.stringify(sessionData));

      return true;
    }
    return false;
  } catch (error) {
    console.error('Error logging in admin:', error);
    return false;
  }
};

// Function to check if admin is authenticated without trying to sign in
export const checkAdminSession = async (): Promise<boolean> => {
  try {
    // Check our local admin session
    const sessionJson = await AsyncStorage.getItem(ADMIN_SESSION_KEY);
    if (!sessionJson) {
      return false;
    }

    const session = JSON.parse(sessionJson);

    // Check if session has expired
    const currentTime = Math.floor(Date.now() / 1000); // Current time in seconds
    if (!session.expiresAt || currentTime >= session.expiresAt) {
      // Session has expired, clear it
      await logoutAdmin();
      return false;
    }

    // Check if session has valid token and user
    const hasValidToken = !!session?.token;
    const hasValidUser = !!session?.user?.email;
    
    const isValid = hasValidToken && hasValidUser;

    return isValid;
  } catch (error) {
    console.error('[AdminAuth] Error checking admin session:', error);
    return false;
  }
};

// Logout admin user
export const logoutAdmin = async (): Promise<void> => {
  try {
    // Clear local session
    await AsyncStorage.removeItem(ADMIN_SESSION_KEY);

    // NOTE: We DO NOT clear OneSignal external user ID on logout
    // Removing the alias can cause the device to unsubscribe from OneSignal
    // The external ID will be overwritten when a new user logs in
    // clearExternalUserId(); // REMOVED
  } catch (error) {
    console.error('Error logging out admin:', error);
  }
};

// Get current admin session
export const getAdminSession = async (): Promise<AdminSession | null> => {
  try {
    const sessionJson = await AsyncStorage.getItem(ADMIN_SESSION_KEY);
    if (!sessionJson) {
      return null;
    }

    const storedSession = JSON.parse(sessionJson);

    // Check if session has expired
    const currentTime = Math.floor(Date.now() / 1000); // Current time in seconds
    if (currentTime >= storedSession.expiresAt) {
      // Session has expired, clear it
      await logoutAdmin();
      return null;
    }

    // Convert stored session to AdminSession format
    // Stored: { user: { id, email, name, role }, token, expiresAt }
    // AdminSession: { id, email, name, role, expiresAt }
    const adminSession: AdminSession = {
      id: storedSession.user?.id || 'admin-user',
      email: storedSession.user?.email || '',
      name: storedSession.user?.name || 'Admin User',
      role: storedSession.user?.role || 'ADMIN',
      expiresAt: storedSession.expiresAt
    };

    return adminSession;
  } catch (error) {
    console.error('Error getting admin session:', error);
    return null;
  }
};

// Extend session (called on activity to keep admin logged in)
export const extendAdminSession = async (): Promise<void> => {
  try {
    const sessionJson = await AsyncStorage.getItem(ADMIN_SESSION_KEY);
    if (!sessionJson) {
      return;
    }

    const session = JSON.parse(sessionJson);

    // Check if session has valid user
    if (session.user) {
      // Update the expiration time to 30 days from now
      const currentTime = Math.floor(Date.now() / 1000); // Current time in seconds
      session.expiresAt = currentTime + ONE_DAY_SECONDS; // Extend to 30 days from now
      session.user.email = ADMIN_EMAIL; // Ensure hardcoded email is used

      await AsyncStorage.setItem(ADMIN_SESSION_KEY, JSON.stringify(session));
    }
  } catch (error) {
    console.error('Error extending admin session:', error);
  }
};