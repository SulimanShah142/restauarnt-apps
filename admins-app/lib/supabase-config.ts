// supabase-config.ts
// This file exports configured Supabase clients using environment variables
import { supabase } from './supabase';

// Get Supabase configuration from environment variables
export const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
export const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANNON_KEY || process.env.SUPABASE_ANON_KEY;
export const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

// Re-export Supabase client
export { supabase as supabaseAnon };
