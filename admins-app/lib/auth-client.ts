import AsyncStorage from '@react-native-async-storage/async-storage';
import * as React from 'react';

// Define types
interface User {
  id: string;
  email: string;
  name?: string;
  role?: string;
}

interface Session {
  user: User;
  token: string;
}

// Custom auth client implementation for admin app with hardcoded credentials
class CustomAuthClient {
  // Hardcoded admin credentials
  private readonly ADMIN_EMAIL = 'Mohammadseyar885@gmail.com';
  private readonly ADMIN_PASSWORD = '@12345678@';

  async signIn(credentials: { email: string; password: string }): Promise<{ data?: { session: Session }; error?: any }> {
    // Check if credentials match the hardcoded admin credentials
    if (credentials.email === this.ADMIN_EMAIL && credentials.password === this.ADMIN_PASSWORD) {
      // Create a mock session object with a proper UUID for the admin user
      const sessionData: Session = {
        user: {
          id: '00000000-0000-0000-0000-000000000001', // Proper UUID format for admin user
          email: this.ADMIN_EMAIL,
          name: 'Admin User',
          role: 'ADMIN'
        },
        token: 'mock-admin-token-' + Date.now() // Generate a mock token
      };

      // Store session in AsyncStorage
      await AsyncStorage.setItem('admin_session', JSON.stringify(sessionData));

      return { data: { session: sessionData } };
    } else {
      return { error: 'Invalid email or password' };
    }
  }

  async signOut(): Promise<void> {
    // Remove session from AsyncStorage
    await AsyncStorage.removeItem('admin_session');
  }

  async getSession(): Promise<{ data?: { session: Session | null }; error?: any }> {
    try {
      const sessionData = await AsyncStorage.getItem('admin_session');

      if (!sessionData) {
        return { data: { session: null } };
      }

      const session = JSON.parse(sessionData);
      
      // Verify the session is still valid (in a real app, you might check token expiration)
      // For now, just return the stored session
      return { data: { session } };
    } catch (error) {
      return { error: error instanceof Error ? error.message : 'Failed to get session' };
    }
  }

  // Admin registration is not needed since we're using hardcoded credentials
  async signUp(userData: { email: string; password: string; name?: string }): Promise<{ data?: { session: Session }; error?: any }> {
    return { error: 'Admin registration is not allowed' };
  }
}

// Create a singleton instance
const authClient = new CustomAuthClient();

// Create a useSession hook
export const useSession = () => {
  const [session, setSession] = React.useState<Session | null>(null);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    const loadSession = async () => {
      try {
        const result = await authClient.getSession();
        setSession(result.data?.session || null);
      } catch (error) {
        console.error('Error loading session:', error);
      } finally {
        setLoading(false);
      }
    };

    loadSession();
  }, []);

  return { data: session, isLoading: loading };
};

// Export everything
export const signIn = async (credentials: { email: string; password: string }) => {
  return await authClient.signIn(credentials);
};
export const signOut = async () => {
  await authClient.signOut();
};
export const signUp = async (userData: { email: string; password: string; name?: string }) => {
  return await authClient.signUp(userData);
};
export const getSession = async () => {
  return await authClient.getSession();
};
export { authClient };