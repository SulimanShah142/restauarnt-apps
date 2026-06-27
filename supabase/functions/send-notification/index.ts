// supabase/functions/send-notification/index.ts
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  try {
    // Get request data
    const { record, type, userId } = await req.json()
    
    console.log('Notification request:', { type, userId, recordId: record.id })

    // Create Supabase client
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
    )

    // Get user's push token from profiles table
    const { data: profile, error: profileError } = await supabaseClient
      .from('profiles')
      .select('push_token')
      .eq('id', userId)
      .single()

    if (profileError || !profile?.push_token) {
      console.log('No push token found for user:', userId)
      return new Response(
        JSON.stringify({ error: 'No push token' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      )
    }

    // Prepare notification message based on type
    let title = ''
    let body = ''
    
    switch (type) {
      case 'NEW_ORDER':
        title = '🔔 New Order Received!'
        body = `Order #${record.order_number?.substring(0, 8) || record.id.substring(0, 8)} - AFG ${record.total_amount}`
        break
      case 'ORDER_DELIVERED':
        title = '✅ Order Delivered'
        body = `Order #${record.order_number?.substring(0, 8)} has been delivered successfully`
        break
      case 'DELIVERY_ASSIGNED':
        title = '🚴 New Delivery Assignment!'
        body = `Order #${record.order_number?.substring(0, 8)} assigned to you`
        break
      case 'ORDER_STATUS_UPDATE':
        title = '📝 Order Update'
        body = `Order #${record.order_number?.substring(0, 8)} status: ${record.status}`
        break
      case 'NEW_FEEDBACK':
        title = '💬 New Feedback Received!'
        body = `You received new feedback`
        break
      default:
        title = 'New Notification'
        body = 'You have a new notification'
    }

    // Send to Expo Push API
    const message = {
      to: profile.push_token,
      sound: 'default',
      title,
      body,
      data: { 
        orderId: record.id,
        type,
        ...record 
      },
      ios: {
        priority: 'high',
        badge: 1,
      },
      android: {
        priority: 'high',
        sound: 'default',
      },
    }

    const response = await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${Deno.env.get('EXPO_ACCESS_TOKEN')}`,
      },
      body: JSON.stringify(message),
    })

    const result = await response.json()
    console.log('Expo Push API response:', result)

    if (result.errors) {
      console.error('Expo API errors:', result.errors)
    }

    return new Response(
      JSON.stringify({ success: true, result }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    console.error('Error sending notification:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    )
  }
})
