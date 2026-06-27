// supabase-config.js
// This file exports configured Supabase clients using environment variables
// Import the main supabase client to avoid creating duplicate instances
import { supabase } from './supabase';
import { createClient } from '@supabase/supabase-js';

// Get Supabase configuration from environment variables
const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || process.env.EXPO_PUBLIC_SUPABASE_ANNON_KEY || process.env.SUPABASE_ANON_KEY || process.env.EXPO_PUBLIC_SUPABASE_KEY;

// Service role client for admin operations (higher permissions, should only be used server-side)
let supabaseService;
if (supabaseServiceRoleKey) {
  supabaseService = createClient(supabaseUrl, supabaseServiceRoleKey);
} else {
  // If service role key is not available, use the main client (will have limited permissions)
  console.warn('SUPABASE_SERVICE_ROLE_KEY not found. Admin operations may be limited.');
  supabaseService = supabase;
}

export { supabase as supabaseAnon, supabaseService, supabaseUrl, supabaseAnonKey, supabaseServiceRoleKey };