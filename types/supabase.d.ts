// lib/supabase.d.ts
declare module '@lib/supabase' {
  import { SupabaseClient } from '@supabase/supabase-js';
  
  const supabase: SupabaseClient;
  export default supabase;
  export * from './lib/supabase/client';
}