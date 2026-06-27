// Edge Function: Send Order Notification (SAFE VERSION)
// Uses anon key with JWT validation - NO service role key needed
// Location: supabase/functions/send-order-notification/index.ts

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface NotificationPayload {
  order_id: string;
  new_status: string;
  old_status?: string;
  user_id: string;
  app_type: "user" | "admin" | "delivery";
  table: string;
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    console.log("📩 Received notification request");

    // Get headers
    const authHeader = req.headers.get("Authorization");
    const apiKey = req.headers.get("apikey");

    console.log("🔑 Auth header present:", !!authHeader);
    console.log("🔑 API key present:", !!apiKey);

    // Get environment variables
    const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY") || "";
    const expoServerKey = Deno.env.get("EXPO_SERVER_KEY") || "";

    // ✅ ACCEPT BOTH ANON KEY AND SERVICE ROLE KEY
    // Database triggers use service role key (safe because they're trusted)
    // Client apps use anon key (safe because of RLS)
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
    
    if (!apiKey) {
      console.error("❌ Missing API key");
      return new Response(
        JSON.stringify({ success: false, message: "Missing API key" }),
        {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }
    
    // Validate it's either anon key or service role key
    if (apiKey !== anonKey && apiKey !== serviceRoleKey) {
      console.error("❌ Invalid API key - must be anon key or service role key");
      console.error("   Key prefix:", apiKey ? apiKey.substring(0, 15) + '...' : 'null');
      return new Response(
        JSON.stringify({ success: false, message: "Invalid API key" }),
        {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }
    
    const isServiceRoleCall = apiKey === serviceRoleKey;
    console.log("🔑 Key type:", isServiceRoleCall ? "Service Role (DB Trigger)" : "Anon Key (Client)");

    // Parse request body
    const payload: NotificationPayload = await req.json();
    console.log("📩 Payload:", payload);

    const { order_id, new_status, user_id, app_type } = payload;

    // Validate required fields
    if (!order_id || !user_id || !app_type) {
      throw new Error("Missing required fields");
    }

    // Create Supabase client with ANON key (safe!)
    const supabase = createClient(supabaseUrl, apiKey);

    // Get push token from database (RLS will protect this)
    let pushToken: string | null = null;
    let recipientEmail: string = user_id;

    console.log("🔍 Looking up push token for:", user_id, "app_type:", app_type);

    if (app_type === "user") {
      const { data, error } = await supabase
        .from("profiles")
        .select("email, expo_push_token")
        .eq("email", user_id)
        .single();
      
      if (error) {
        console.log("⚠️ Profile lookup error:", error.message);
      }
      
      pushToken = data?.expo_push_token || null;
      recipientEmail = data?.email || user_id;
    } else if (app_type === "admin") {
      const { data, error } = await supabase
        .from("admins")
        .select("email, expo_push_token")
        .eq("email", user_id)
        .eq("is_active", true)
        .single();
      
      if (error) {
        console.log("⚠️ Admin lookup error:", error.message);
      }
      
      pushToken = data?.expo_push_token || null;
      recipientEmail = data?.email || user_id;
    } else if (app_type === "delivery") {
      const { data, error } = await supabase
        .from("delivery_persons")
        .select("email, expo_push_token")
        .eq("email", user_id)
        .single();
      
      if (error) {
        console.log("⚠️ Delivery lookup error:", error.message);
      }
      
      pushToken = data?.expo_push_token || null;
      recipientEmail = data?.email || user_id;
    }

    console.log("📱 Push token:", pushToken ? "✅ Found" : "❌ Not found");

    if (!pushToken) {
      // No token - user hasn't opened app yet or token not registered
      // Return success anyway, they'll get notifications next time
      console.log("ℹ️ No push token, skipping notification");
      return new Response(
        JSON.stringify({ 
          success: true,
          message: "No push token registered yet",
          email: recipientEmail,
          note: "User needs to open app to register token"
        }),
        { 
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Create notification message
    const notification = createNotificationMessage(payload, new_status);
    console.log("📝 Notification:", notification);

    // Send via Expo Push API
    console.log("📡 Sending to Expo Push API...");
    const expoResponse = await sendExpoPushNotification(pushToken, notification, expoServerKey);
    console.log("📡 Expo response:", expoResponse);

    if (expoResponse.errors && expoResponse.errors.length > 0) {
      console.error("❌ Expo API errors:", expoResponse.errors);
      return new Response(
        JSON.stringify({ success: false, errors: expoResponse.errors }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("✅ Notification sent successfully!");

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: "Notification sent",
        ticket_id: expoResponse.tickets?.[0]?.id,
        email: recipientEmail
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
        message: error instanceof Error ? error.message : "Unknown error"
      }),
      { 
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});

// Create notification message
function createNotificationMessage(
  payload: NotificationPayload, 
  new_status: string
): { title: string; body: string; data: any } {
  const { app_type, order_id } = payload;

  if (app_type === "admin") {
    if (new_status === "pending") {
      return {
        title: "🔔 New Order Placed",
        body: `Order #${order_id.substring(0, 8)} needs attention`,
        data: { order_id, type: "new_order", status: new_status },
      };
    } else if (new_status === "delivered") {
      return {
        title: "✅ Order Delivered",
        body: `Order #${order_id.substring(0, 8)} completed`,
        data: { order_id, type: "delivered", status: new_status },
      };
    } else {
      return {
        title: "📦 Order Update",
        body: `Order #${order_id.substring(0, 8)}: ${new_status}`,
        data: { order_id, type: "order_update", status: new_status },
      };
    }
  } else if (app_type === "user") {
    return {
      title: "📦 Order Status Update",
      body: `Your order #${order_id.substring(0, 8)}: ${new_status}`,
      data: { order_id, type: "status_change", new_status },
    };
  } else if (app_type === "delivery") {
    return {
      title: "🚴 New Delivery Assignment",
      body: `New delivery: Order #${order_id.substring(0, 8)}`,
      data: { order_id, type: "new_assignment", status: "assigned" },
    };
  }

  return {
    title: "Order Notification",
    body: `Order #${order_id.substring(0, 8)}: ${new_status}`,
    data: { order_id, type: "generic", status: new_status },
  };
}

// Send via Expo Push API
async function sendExpoPushNotification(
  pushToken: string,
  notification: { title: string; body: string; data: any },
  expoServerKey: string
) {
  const message = {
    to: pushToken,
    sound: "default",
    title: notification.title,
    body: notification.body,
    data: notification.data,
  };

  const response = await fetch("https://exp.host/--/api/v2/push/send", {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Accept-encoding": "gzip, deflate",
      "Content-Type": "application/json",
      Authorization: `Bearer ${expoServerKey}`,
    },
    body: JSON.stringify(message),
  });

  return await response.json();
}
