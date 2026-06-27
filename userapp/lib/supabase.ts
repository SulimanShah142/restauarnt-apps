import 'react-native-url-polyfill/auto';
import { createClient } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Supabase configuration with fallback
const getSupabaseConfig = () => {
  let supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
  let supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || process.env.EXPO_PUBLIC_SUPABASE_KEY;

  // Final hardcoded fallback (ensures app never crashes due to missing config)
  if (!supabaseUrl || !supabaseAnonKey) {
    console.warn('[Supabase] Using fallback credentials');
    supabaseUrl = 'https://gjyipzhhgxgumgbnpikg.supabase.co';
    supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdqeWlwemhoZ3hndW1nYm5waWtnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzAzOTY3MjksImV4cCI6MjA4NTk3MjcyOX0.0K6bROYWE_EXwNFioSmN-xSDZ3Lm0Cx6m0wwl6YtYhc';
  }

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
