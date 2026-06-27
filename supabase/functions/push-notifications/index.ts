// supabase/functions/push-notifications/index.ts
// FIXED: Correct notification text and recipients for each app
// Each app type uses its own REST API key
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// OneSignal App IDs for each app type
const ONESIGNAL_APP_IDS: Record<string, string> = {
  'user': '38e20d47-839b-4944-8455-daf65977aaf9',      // USER app
  'delivery': 'da1609d1-cebc-47a1-9b0c-4d797997344c', // DELIVERY app
  'admin': '2665a069-40cb-4335-8af1-0f4d8b77aeea',    // ADMIN app
}

// OneSignal REST API Keys for each app type
const ONESIGNAL_REST_API_KEYS: Record<string, string> = {
  'user': Deno.env.get('ONESIGNAL_USER_API_KEY') || 'os_v2_app_hdra2r4dtneujbcv3l3fs55k7eourhifo63ufb4en4lfmptextciwwwbedrevmiayzmmufgamouelfuwcuspsav246una3n4wryzl5a',
  'delivery': Deno.env.get('ONESIGNAL_DELIVERY_API_KEY') || 'os_v2_app_3ilatuooxrd2dgymjv4xtfzujr2x2y7v6kfetdffai74pilmpclmsm3leyvnjecoqt3favq4cdztwajy7xa7wlgvnrec42szuelas5i',
  'admin': Deno.env.get('ONESIGNAL_ADMIN_API_KEY') || 'os_v2_app_ezs2a2kaznbtlcxrb5gyw55o5lvxw3weicce4pebmq5jtmyu7fpi56ficmcr7fr23xs7dsz2srzxffx4kmqc7jbw73n6j4hi2xt4nra',
}

interface OrderRecord {
  id: string
  user_id: string
  delivery_person_id?: string
  status: string
  order_number?: string
  total_amount?: number
  customer_name?: string
  customer_phone?: string
  restaurant_name?: string
  created_at: string
  updated_at: string
}

interface NotificationPayload {
  record: OrderRecord
  old_record?: OrderRecord
  type: 'INSERT' | 'UPDATE'
  table: string
}

// Send push notification via OneSignal
async function sendPushNotification(onesignalPlayerId: string, appType: string, title: string, body: string, data: any = {}) {
  try {
    const appId = ONESIGNAL_APP_IDS[appType]
    const restApiKey = ONESIGNAL_REST_API_KEYS[appType]

    if (!appId) {
      console.error(`❌ Invalid app type: ${appType}`)
      return { success: false, reason: 'invalid_app_type' }
    }

    if (!restApiKey) {
      console.error(`❌ No REST API key configured for app type: ${appType}`)
      return { success: false, reason: 'no_api_key' }
    }

    console.log(`📤 Sending to ${appType} app using key: ${restApiKey.substring(0, 20)}...`)

    const message = {
      app_id: appId,
      include_player_id: [onesignalPlayerId],
      headings: { en: title },
      contents: { en: body },
      data: {
        ...data,
        timestamp: new Date().toISOString(),
      },
      android_channel_id: 'order-updates',
      ios_sound: 'default',
      android_sound: 'default',
      priority: 'High',
    }

    const response = await fetch('https://onesignal.com/api/v1/notifications', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Basic ${restApiKey}`,
      },
      body: JSON.stringify(message),
    })

    const result = await response.json()
    console.log('OneSignal API response:', result)

    if (result.errors) {
      console.error('OneSignal API errors:', result.errors)
      return { success: false, errors: result.errors }
    }

    return { success: true, result }
  } catch (error) {
    console.error('Error sending OneSignal notification:', error)
    return { success: false, error: error.message }
  }
}

// Get user's push token from onesignal_players table
async function getUserPushToken(supabase: any, userId: string, appType: string): Promise<string | null> {
  try {
    // Get OneSignal player ID from onesignal_players table
    const { data: oneSignalData, error: oneSignalError } = await supabase
      .from('onesignal_players')
      .select('onesignal_player_id')
      .eq('user_id', userId)
      .eq('app_type', appType)
      .single()

    if (oneSignalData?.onesignal_player_id) {
      console.log(`✅ Found OneSignal token for ${appType}:`, userId)
      return oneSignalData.onesignal_player_id
    }

    console.log(`⚠️ No push token found for ${appType}:`, userId)
    return null
  } catch (error) {
    console.error('Error getting push token:', error)
    return null
  }
}

// Get admin user ID
async function getAdminUserId(supabase: any): Promise<string | null> {
  const { data: adminData } = await supabase
    .from('profiles')
    .select('id')
    .eq('email', Deno.env.get('ADMIN_EMAIL') || 'slliman.sarwary08@gmail.com')
    .single()

  return adminData?.id || null
}

// Main notification handler
async function handleOrderNotification(supabase: any, payload: NotificationPayload) {
  const { record, old_record, type } = payload

  console.log('Processing order notification:', {
    type,
    orderId: record.id,
    status: record.status,
    userId: record.user_id,
    deliveryPersonId: record.delivery_person_id,
  })

  const notifications: Array<{
    userId: string
    appType: 'user' | 'admin' | 'delivery'
    title: string
    body: string
    data: any
  }> = []

  // NEW ORDER - Notify Admin ONLY
  if (type === 'INSERT') {
    console.log('🔔 New order detected - notifying admin')

    // Notify admin about new order
    const adminId = await getAdminUserId(supabase)
    if (adminId) {
      notifications.push({
        userId: adminId,
        appType: 'admin',
        title: '🔔 New Order Received!',
        body: `Order #${record.order_number?.substring(0, 8) || record.id.substring(0, 8)} - AFG ${record.total_amount || 0}`,
        data: {
          orderId: record.id,
          orderNumber: record.order_number,
          type: 'NEW_ORDER',
        },
      })
    }

    // Notify user about their own order placement
    if (record.user_id) {
      notifications.push({
        userId: record.user_id,
        appType: 'user',
        title: '✅ Order Placed!',
        body: `Your order #${record.order_number?.substring(0, 8)} has been placed successfully`,
        data: {
          orderId: record.id,
          orderNumber: record.order_number,
          type: 'ORDER_PLACED',
        },
      })
    }
  }

  // ORDER UPDATE - Check what changed
  if (type === 'UPDATE' && old_record) {
    const oldStatus = old_record.status
    const newStatus = record.status

    console.log(`📝 Order status changed: ${oldStatus} → ${newStatus}`)

    // ============================================
    // ORDER CONFIRMED - Notify USER only
    // ============================================
    if (newStatus === 'confirmed' && oldStatus !== 'confirmed') {
      console.log('✅ Order confirmed - notifying USER')

      if (record.user_id) {
        notifications.push({
          userId: record.user_id,
          appType: 'user',
          title: '✅ Order Confirmed!',
          body: `Your order from ${record.restaurant_name || 'the restaurant'} has been confirmed`,
          data: {
            orderId: record.id,
            orderNumber: record.order_number,
            type: 'ORDER_CONFIRMED',
          },
        })
      }
    }

    // ============================================
    // ORDER PREPARING - Notify USER only
    // ============================================
    if (newStatus === 'preparing' && oldStatus !== 'preparing') {
      console.log('👨‍🍳 Order preparing - notifying USER')

      if (record.user_id) {
        notifications.push({
          userId: record.user_id,
          appType: 'user',
          title: '👨‍🍳 Order Preparing!',
          body: `Your order from ${record.restaurant_name || 'the restaurant'} is being prepared`,
          data: {
            orderId: record.id,
            orderNumber: record.order_number,
            type: 'ORDER_PREPARING',
          },
        })
      }
    }

    // ============================================
    // ORDER READY - Notify USER and DELIVERY
    // ============================================
    if (newStatus === 'ready' && oldStatus !== 'ready') {
      console.log('📦 Order ready - notifying USER and DELIVERY')

      // Notify user
      if (record.user_id) {
        notifications.push({
          userId: record.user_id,
          appType: 'user',
          title: '📦 Order Ready!',
          body: `Your order is ready for pickup`,
          data: {
            orderId: record.id,
            orderNumber: record.order_number,
            type: 'ORDER_READY',
          },
        })
      }

      // Notify delivery person (if assigned)
      if (record.delivery_person_id) {
        notifications.push({
          userId: record.delivery_person_id,
          appType: 'delivery',
          title: '📦 Order Ready for Pickup!',
          body: `Order #${record.order_number?.substring(0, 8)} is ready for pickup`,
          data: {
            orderId: record.id,
            orderNumber: record.order_number,
            type: 'ORDER_READY_FOR_PICKUP',
          },
        })
      }
    }

    // ============================================
    // ORDER ON THE WAY (PICKED UP) - Notify USER only
    // ============================================
    if (newStatus === 'on_the_way' && oldStatus !== 'on_the_way') {
      console.log('🚴 Order on the way - notifying USER')

      if (record.user_id) {
        notifications.push({
          userId: record.user_id,
          appType: 'user',
          title: '🚴 Order On The Way!',
          body: 'Your order has been picked up and is on the way to you',
          data: {
            orderId: record.id,
            orderNumber: record.order_number,
            type: 'ORDER_ON_THE_WAY',
          },
        })
      }
    }

    // ============================================
    // ORDER DELIVERED - Notify USER and ADMIN
    // ============================================
    if (newStatus === 'delivered' && oldStatus !== 'delivered') {
      console.log('🎉 Order delivered - notifying USER and ADMIN')

      // Notify user
      if (record.user_id) {
        notifications.push({
          userId: record.user_id,
          appType: 'user',
          title: '🎉 Order Delivered!',
          body: 'Your order has been delivered successfully. Enjoy your meal!',
          data: {
            orderId: record.id,
            orderNumber: record.order_number,
            type: 'ORDER_DELIVERED',
          },
        })
      }

      // Notify admin
      const adminId = await getAdminUserId(supabase)
      if (adminId) {
        notifications.push({
          userId: adminId,
          appType: 'admin',
          title: '✅ Order Delivered',
          body: `Order #${record.order_number?.substring(0, 8)} has been delivered successfully`,
          data: {
            orderId: record.id,
            orderNumber: record.order_number,
            type: 'ORDER_DELIVERED',
          },
        })
      }
    }

    // ============================================
    // DELIVERY ASSIGNED - Notify DELIVERY PERSON and ADMIN
    // ============================================
    if (record.delivery_person_id && (!old_record.delivery_person_id ||
        record.delivery_person_id !== old_record.delivery_person_id)) {
      console.log('🚴 Delivery assigned - notifying DELIVERY PERSON')

      // Notify delivery person
      notifications.push({
        userId: record.delivery_person_id,
        appType: 'delivery',
        title: '🚴 New Delivery Assignment!',
        body: `Order #${record.order_number?.substring(0, 8)} has been assigned to you`,
        data: {
          orderId: record.id,
          orderNumber: record.order_number,
          deliveryPersonId: record.delivery_person_id,
          type: 'DELIVERY_ASSIGNED',
        },
      })

      // Notify admin
      const adminId = await getAdminUserId(supabase)
      if (adminId) {
        notifications.push({
          userId: adminId,
          appType: 'admin',
          title: '📋 Delivery Assigned',
          body: `Order #${record.order_number?.substring(0, 8)} assigned to delivery person`,
          data: {
            orderId: record.id,
            orderNumber: record.order_number,
            deliveryPersonId: record.delivery_person_id,
            type: 'DELIVERY_ASSIGNED',
          },
        })
      }
    }
  }

  // Send all notifications
  const results = await Promise.all(
    notifications.map(async (notification) => {
      const pushToken = await getUserPushToken(supabase, notification.userId, notification.appType)

      if (pushToken) {
        console.log(`📱 Sending notification to ${notification.appType} ${notification.userId}:`, notification.title)
        return await sendPushNotification(
          pushToken,
          notification.appType,
          notification.title,
          notification.body,
          notification.data
        )
      } else {
        console.log(`⚠️ No push token for ${notification.appType} ${notification.userId}, skipping`)
        return { success: false, reason: 'no_token' }
      }
    })
  )

  return {
    notificationsSent: results.filter(r => r.success).length,
    totalNotifications: notifications.length,
    results,
  }
}

// Main Edge Function
serve(async (req) => {
  try {
    console.log('🔔 Push notifications function called')

    // Create Supabase client
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    )

    // Parse request
    const payload: NotificationPayload = await req.json()
    console.log('Received payload:', {
      type: payload.type,
      table: payload.table,
      orderId: payload.record?.id,
    })

    // Only process orders table
    if (payload.table !== 'orders') {
      console.log('Ignoring non-orders table:', payload.table)
      return new Response(
        JSON.stringify({ ok: true, message: 'Ignoring non-orders table' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Handle order notification
    const result = await handleOrderNotification(supabase, payload)

    console.log('✅ Notification processing complete:', result)

    return new Response(
      JSON.stringify({
        ok: true,
        ...result,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    console.error('❌ Error in push notifications function:', error)
    return new Response(
      JSON.stringify({
        ok: false,
        error: error.message,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    )
  }
})
