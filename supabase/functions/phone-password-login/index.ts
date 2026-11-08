import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const json = (body: Record<string, unknown>, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { ...corsHeaders, 'Content-Type': 'application/json' },
});

serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (request.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  try {
    const { phone, password } = await request.json();
    const normalizedPhone = typeof phone === 'string' ? phone.trim().replace(/[\s()-]/g, '') : '';
    if (!normalizedPhone || typeof password !== 'string' || password.length < 1 || password.length > 256) {
      return json({ error: 'Phone or password is incorrect.' }, 400);
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    if (!supabaseUrl || !anonKey || !serviceRoleKey) {
      console.error('Missing Supabase function environment configuration');
      return json({ error: 'Sign in is temporarily unavailable.' }, 500);
    }

    const admin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const { data: profiles, error: lookupError } = await admin
      .from('profiles')
      .select('id')
      .eq('phone', normalizedPhone)
      .limit(25);

    if (lookupError) {
      console.error('Phone profile lookup failed:', lookupError.message);
      return json({ error: 'Sign in is temporarily unavailable.' }, 500);
    }
    if (!profiles?.length) return json({ error: 'Phone or password is incorrect.' }, 401);

    const auth = createClient(supabaseUrl, anonKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    // Some existing profiles share a contact number. The password identifies which
    // of those accounts should receive the session; no profile emails are returned.
    for (const profile of profiles) {
      const { data: authUser, error: userError } = await admin.auth.admin.getUserById(profile.id);
      if (userError || !authUser.user?.email) continue;

      const { data: signInData, error: signInError } = await auth.auth.signInWithPassword({
        email: authUser.user.email,
        password,
      });
      if (!signInError && signInData.session) {
        return json({ session: signInData.session });
      }
    }
    return json({ error: 'Phone or password is incorrect.' }, 401);
  } catch (error) {
    console.error('Phone/password sign-in failed:', error);
    return json({ error: 'Phone or password is incorrect.' }, 400);
  }
});
