// supabase/functions/send-onesignal-notification/index.ts
// This Edge Function is NOT USED - notifications are sent via database triggers
// Keep this file for reference only

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // This function is deprecated - notifications are sent via database triggers
  console.log('[Edge Function] Received request - this function is deprecated');
  console.log('[Edge Function] Notifications are now sent via database triggers (send_onesignal_direct)');
  
  return new Response(JSON.stringify({ 
    message: 'This Edge Function is deprecated. Notifications are sent via database triggers.',
    status: 'deprecated'
  }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    status: 200,
  })
})
