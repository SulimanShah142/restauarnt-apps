// supabase-config.js
// This file exports configured Supabase clients using runtime-safe env values.
import Constants from 'expo-constants';
import { createClient } from '@supabase/supabase-js';

const FALLBACK_SUPABASE_URL = 'https://gjyipzhhgxgumgbnpikg.supabase.co';
const FALLBACK_SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdqeWlwemhoZ3hndW1nYm5waWtnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzAzOTY3MjksImV4cCI6MjA4NTk3MjcyOX0.0K6bROYWE_EXwNFioSmN-xSDZ3Lm0Cx6m0wwl6YtYhc';

const extra = (Constants.expoConfig && Constants.expoConfig.extra) || (Constants.manifest && Constants.manifest.extra) || {};

let supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || extra.supabaseUrl || FALLBACK_SUPABASE_URL;
let supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || process.env.EXPO_PUBLIC_SUPABASE_ANNON_KEY || process.env.SUPABASE_ANON_KEY || process.env.EXPO_PUBLIC_SUPABASE_KEY || extra.supabaseAnonKey || FALLBACK_SUPABASE_ANON_KEY;
let supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

// Create and export the configured Supabase clients
// Anon client for general use (frontend, limited permissions)
const supabaseAnon = createClient(supabaseUrl, supabaseAnonKey);

// Service role client for admin operations (higher permissions, should only be used server-side)
let supabaseService;
if (supabaseServiceRoleKey) {
  supabaseService = createClient(supabaseUrl, supabaseServiceRoleKey);
} else {
  // If service role key is not available, use anon client (will have limited permissions)
  supabaseService = supabaseAnon;
}

export default supabaseAnon;
export { supabaseAnon, supabaseService, supabaseUrl, supabaseAnonKey, supabaseServiceRoleKey };