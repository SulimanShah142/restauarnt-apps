// Edge Function: Send Push Notification via Expo Push API
// Location: supabase/functions/send-push-notification/index.ts
// 
// DEPLOY INSTRUCTIONS:
// 1. cd supabase/functions
// 2. supabase functions deploy send-push-notification
// 3. supabase secrets set EXPO_SERVER_KEY=your-expo-key-here
// 4. supabase functions deploy send-push-notification

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface PushRequest {
  push_token: string;
  title: string;
  body: string;
  data?: Record<string, any>;
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const payload: PushRequest = await req.json();
    const { push_token, title, body, data } = payload;

    console.log("📩 Sending push notification:", {
      push_token: push_token.substring(0, 20) + "...",
      title,
      body,
    });

    // Get Expo server key from environment
    const expoServerKey = Deno.env.get("EXPO_SERVER_KEY");

    if (!expoServerKey) {
      console.error("❌ EXPO_SERVER_KEY not configured");
      return new Response(
        JSON.stringify({ error: "Expo server key not configured" }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Send to Expo Push API
    const expoResponse = await fetch("https://exp.host/--/api/v2/push/send", {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Accept-encoding": "gzip, deflate",
        "Content-Type": "application/json",
        Authorization: `Bearer ${expoServerKey}`,
      },
      body: JSON.stringify({
        to: push_token,
        sound: "default",
        title: title,
        body: body,
        data: data,
        priority: "high",
      }),
    });

    const expoResult = await expoResponse.json();
    console.log("📡 Expo Push API response:", expoResult);

    if (expoResult.errors) {
      console.error("❌ Expo API errors:", expoResult.errors);
      return new Response(
        JSON.stringify({ success: false, errors: expoResult.errors }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    console.log("✅ Push notification sent successfully!");

    return new Response(
      JSON.stringify({
        success: true,
        message: "Notification sent",
        ticket_id: expoResult.tickets?.[0]?.id,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("❌ Error:", error);
    return new Response(
      JSON.stringify({
        success: false,
        message: error instanceof Error ? error.message : "Unknown error",
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
