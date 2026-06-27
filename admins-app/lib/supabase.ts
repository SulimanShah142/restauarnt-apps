import 'react-native-url-polyfill/auto';
import { createClient } from '@supabase/supabase-js';
import { Platform } from 'react-native';
import Constants from 'expo-constants';

// Get Supabase credentials from environment variables or embedded config
const getSupabaseConfig = () => {
  let supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
  let supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || process.env.EXPO_PUBLIC_SUPABASE_KEY;

  // Fallback to embedded config in standalone builds
  if (!supabaseUrl || !supabaseAnonKey) {
    try {
      const extra = Constants?.expoConfig?.extra;
      if (extra) {
        supabaseUrl = supabaseUrl || extra.supabaseUrl;
        supabaseAnonKey = supabaseAnonKey || extra.supabaseAnonKey;
      }
    } catch (error) {
      console.warn('[Supabase] Failed to get config from expoConfig:', error);
    }
  }

  // Final hardcoded fallback (ensures app never crashes due to missing config)
  if (!supabaseUrl || !supabaseAnonKey) {
    console.warn('[Supabase] Using hardcoded fallback credentials');
    supabaseUrl = 'https://gjyipzhhgxgumgbnpikg.supabase.co';
    supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdqeWlwemhoZ3hndW1nYm5waWtnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzAzOTY3MjksImV4cCI6MjA4NTk3MjcyOX0.0K6bROYWE_EXwNFioSmN-xSDZ3Lm0Cx6m0wwl6YtYhc';
  }


  return { url: supabaseUrl, anonKey: supabaseAnonKey, isValid: true };
};

const config = getSupabaseConfig();

// Storage adapter that works for both native and web environments
const storageAdapter = {
  async getItem(key: string): Promise<string | null> {
    try {
      // Web: use localStorage
      if (Platform.OS === 'web') {
        return typeof window !== 'undefined' ? window.localStorage.getItem(key) : null;
      }

      // Native: use expo-secure-store with proper import
      try {
        const expoSecureStore = await import('expo-secure-store');
        return await expoSecureStore.getItemAsync(key);
      } catch (secureStoreError) {
        // Fallback to AsyncStorage if expo-secure-store is not available
        console.warn('expo-secure-store not available, using fallback:', secureStoreError);
        try {
          const asyncStorage = await import('@react-native-async-storage/async-storage');
          return await asyncStorage.default.getItem(key);
        } catch (asyncStorageError) {
          console.warn('AsyncStorage also not available:', asyncStorageError);
          return null;
        }
      }
    } catch (error) {
      console.error('Storage getItem error:', error);
      return null;
    }
  },

  async setItem(key: string, value: string): Promise<void> {
    try {
      // Web: use localStorage
      if (Platform.OS === 'web') {
        if (typeof window !== 'undefined') {
          window.localStorage.setItem(key, value);
        }
        return;
      }

      // Native: use expo-secure-store with fallback
      try {
        const expoSecureStore = await import('expo-secure-store');
        await expoSecureStore.setItemAsync(key, value);
      } catch (secureStoreError) {
        // Fallback to AsyncStorage
        console.warn('expo-secure-store not available, using fallback:', secureStoreError);
        try {
          const asyncStorage = await import('@react-native-async-storage/async-storage');
          await asyncStorage.default.setItem(key, value);
        } catch (asyncStorageError) {
          console.warn('AsyncStorage also not available:', asyncStorageError);
        }
      }
    } catch (error) {
      console.error('Storage setItem error:', error);
    }
  },

  async removeItem(key: string): Promise<void> {
    try {
      // Web: use localStorage
      if (Platform.OS === 'web') {
        if (typeof window !== 'undefined') {
          window.localStorage.removeItem(key);
        }
        return;
      }

      // Native: use expo-secure-store with fallback
      try {
        const expoSecureStore = await import('expo-secure-store');
        await expoSecureStore.deleteItemAsync(key);
      } catch (secureStoreError) {
        // Fallback to AsyncStorage
        console.warn('expo-secure-store not available, using fallback:', secureStoreError);
        try {
          const asyncStorage = await import('@react-native-async-storage/async-storage');
          await asyncStorage.default.removeItem(key);
        } catch (asyncStorageError) {
          console.warn('AsyncStorage also not available:', asyncStorageError);
        }
      }
    } catch (error) {
      console.error('Storage removeItem error:', error);
    }
  },
};

if (!config.isValid) {
  console.warn('[Supabase] Creating client with invalid config - app may not function properly');
}

export const supabase = createClient(config.url, config.anonKey, {
  auth: {
    storage: storageAdapter,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});
