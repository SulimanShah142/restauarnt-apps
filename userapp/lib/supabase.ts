import 'react-native-url-polyfill/auto';
import { createClient } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';

const FALLBACK_SUPABASE_URL = 'https://gjyipzhhgxgumgbnpikg.supabase.co';
const FALLBACK_SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdqeWlwemhoZ3hndW1nYm5waWtnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzAzOTY3MjksImV4cCI6MjA4NTk3MjcyOX0.0K6bROYWE_EXwNFioSmN-xSDZ3Lm0Cx6m0wwl6YtYhc';

const getSupabaseConfig = () => {
  const extra = ((Constants.expoConfig as any)?.extra ?? (Constants.manifest as any)?.extra ?? {}) as {
    supabaseUrl?: string;
    supabaseAnonKey?: string;
  };

  const supabaseUrl =
    process.env.EXPO_PUBLIC_SUPABASE_URL ||
    process.env.SUPABASE_URL ||
    extra.supabaseUrl ||
    FALLBACK_SUPABASE_URL;

  const supabaseAnonKey =
    process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ||
    process.env.EXPO_PUBLIC_SUPABASE_KEY ||
    process.env.SUPABASE_ANON_KEY ||
    extra.supabaseAnonKey ||
    FALLBACK_SUPABASE_ANON_KEY;

  return { url: supabaseUrl, anonKey: supabaseAnonKey };
};

const config = getSupabaseConfig();

console.log('[Supabase] Initializing client...');
console.log('[Supabase] URL:', config.url);

let supabaseClient: ReturnType<typeof createClient>;

try {
  supabaseClient = createClient(config.url, config.anonKey, {
    auth: {
      storage: AsyncStorage,
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false,
    },
  });
  console.log('[Supabase] ✅ Client created successfully');
} catch (error) {
  console.error('[Supabase] ❌ Failed to create client:', error);
  throw new Error(`Supabase client initialization failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
}

export const supabase = supabaseClient;
