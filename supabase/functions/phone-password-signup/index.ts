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

serve(async request => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (request.method !== 'POST') return json({ error: 'Method not allowed' }, 405);
  try {
    const { phone, password, fullName } = await request.json();
    const normalizedPhone = typeof phone === 'string' ? phone.trim().replace(/[\s()-]/g, '') : '';
    if (!/^\+?\d{7,15}$/.test(normalizedPhone) || typeof password !== 'string' || password.length < 6 || password.length > 256 || typeof fullName !== 'string' || !fullName.trim()) {
      return json({ error: 'Enter a valid phone number, your name, and a password of at least 6 characters.' }, 400);
    }

    const url = Deno.env.get('SUPABASE_URL');
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    if (!url || !serviceKey) {
      console.error('Missing Supabase function environment configuration');
      return json({ error: 'Registration is temporarily unavailable.' }, 500);
    }

    const admin = createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });
    const { data: existingProfiles, error: lookupError } = await admin.from('profiles').select('id').eq('phone', normalizedPhone).limit(25);
    if (lookupError) {
      console.error('Phone registration lookup failed:', lookupError.message);
      return json({ error: 'Registration is temporarily unavailable.' }, 500);
    }
    // Ignore orphan profile rows left by earlier failed registrations. A phone is
    // considered registered only if its profile still points to a real Auth user.
    for (const profile of existingProfiles ?? []) {
      const { data: authUser } = await admin.auth.admin.getUserById(profile.id);
      if (authUser.user) return json({ error: 'An account with this phone number already exists. Sign in instead.' }, 409);
    }

    // Give the Auth account a private, deterministic email identifier because this
    // project has no SMS provider. Users still sign in using the stored phone number.
    const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(normalizedPhone));
    const digestHex = Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('');
    const internalEmail = `phone-${digestHex}@phone-users.invalid`;
    const { data: created, error: createError } = await admin.auth.admin.createUser({
      email: internalEmail,
      password,
      email_confirm: true,
      user_metadata: { full_name: fullName.trim(), phone: normalizedPhone, login_method: 'phone' },
    });
    if (createError || !created.user) {
      console.error('Phone account creation failed:', createError?.message);
      if (createError?.message.toLowerCase().includes('already')) {
        return json({ error: 'An account with this phone number already exists. Sign in instead.' }, 409);
      }
      return json({ error: 'Could not create this account. Please try again.' }, 400);
    }

    const { error: profileError } = await admin.from('profiles').upsert({
      id: created.user.id,
      phone: normalizedPhone,
      full_name: fullName.trim(),
      name: fullName.trim(),
      email: null,
      role: 'customer',
    }, { onConflict: 'id' });
    if (profileError) {
      console.error('Phone account profile creation failed:', profileError.message);
      await admin.auth.admin.deleteUser(created.user.id);
      return json({ error: 'Could not save your account. Please try again.' }, 500);
    }
    return json({ success: true });
  } catch (error) {
    console.error('Phone registration failed:', error);
    return json({ error: 'Could not create this account. Please check your information and try again.' }, 400);
  }
});
