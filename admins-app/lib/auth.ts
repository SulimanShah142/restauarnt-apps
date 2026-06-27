// Admin Authentication Service - Custom implementation with hardcoded credentials
import AsyncStorage from '@react-native-async-storage/async-storage';

// Define TypeScript interfaces
interface User {
  id: string;
  name?: string;
  email?: string;
  role?: string;
  createdAt: Date;
  updatedAt: Date;
}

interface Session {
  user: User;
  token: string;
}

// Hardcoded admin credentials
const ADMIN_EMAIL = 'Mohammadseyar885@gmail.com';
const ADMIN_PASSWORD = '@12345678@';

// Utility function to verify tokens (in a real app, you'd validate JWT)
const verifyToken = (token: string): Promise<any> => {
  return new Promise((resolve) => {
    try {
      // Simple validation - check if token exists and follows expected format
      if (token && token.startsWith('mock-admin-token-')) {
        // Return a mock payload indicating the token is valid
        resolve({ exp: Math.floor(Date.now() / 1000) + (7 * 24 * 60 * 60) }); // Token expires in 7 days
      } else {
        resolve(null);
      }
    } catch (error) {
      resolve(null);
    }
  });
};

// API Service for Admin Authentication - using custom implementation
export const adminAuthService = {
  // Login user
  login: async (email: string, password: string): Promise<{ user: User; token: string } | null> => {
    try {
      // Check if credentials match the hardcoded admin credentials
      if (email === ADMIN_EMAIL && password === ADMIN_PASSWORD) {
        // Create a mock session object with a proper UUID for the admin user
        const sessionData: Session = {
          user: {
            id: '00000000-0000-0000-0000-000000000001', // Proper UUID format for admin user
            email: ADMIN_EMAIL,
            name: 'Admin User',
            role: 'ADMIN',
            createdAt: new Date(),
            updatedAt: new Date()
          },
          token: 'mock-admin-token-' + Date.now() // Generate a mock token
        };

        // Store session in local storage
        await AsyncStorage.setItem('admin_session', JSON.stringify(sessionData));

        return sessionData;
      } else {
        throw new Error('Invalid email or password');
      }
    } catch (error) {
      console.error('Login error:', error);
      throw error;
    }
  },

  // Register user (not allowed for admin since we're using hardcoded credentials)
  register: async (email: string, password: string, name?: string): Promise<{ user: User; token: string } | null> => {
    try {
      throw new Error('Admin registration is not allowed');
    } catch (error) {
      console.error('Registration error:', error);
      throw error;
    }
  },

  // Logout user
  logout: async (): Promise<void> => {
    try {
      // Remove session from local storage
      await AsyncStorage.removeItem('admin_session');
    } catch (error) {
      console.error('Logout error:', error);
      // Continue with logout even if storage removal fails
    }
  },

  // Get current session
  getCurrentSession: async (): Promise<Session | null> => {
    try {
      const sessionData = await AsyncStorage.getItem('admin_session');
      if (!sessionData) {
        return null;
      }

      const session = JSON.parse(sessionData);

      // Verify the session is still valid by checking the token
      const tokenPayload = await verifyToken(session.token);
      if (!tokenPayload) {
        // Session is invalid, remove it
        await AsyncStorage.removeItem('admin_session');
        return null;
      }

      return session;
    } catch (error) {
      console.error('Error getting current session:', error);
      return null;
    }
  },

  // Refresh session
  refreshSession: async (): Promise<Session | null> => {
    try {
      const session = await adminAuthService.getCurrentSession();
      if (!session) {
        return null;
      }

      // Create a new token with extended expiration
      const refreshedSession = {
        ...session,
        token: 'mock-admin-token-' + Date.now() // Generate a new mock token
      };

      // Update stored session
      await AsyncStorage.setItem('admin_session', JSON.stringify(refreshedSession));

      return refreshedSession;
    } catch (error) {
      console.error('Error refreshing session:', error);
      return null;
    }
  },

  // Verify token utility function
  verifyToken
};