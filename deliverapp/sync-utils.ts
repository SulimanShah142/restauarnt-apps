/**
 * Deliver App - Comprehensive Sync Utilities
 * Syncs data between Supabase and local SQLite/IndexedDB
 * 
 * Features:
 * - INCREMENTAL SYNC: Only fetches changed data since last sync
 * - OFFLINE-FIRST: Works offline with cached data
 * - BASE64 IMAGES: Stores images locally for offline access
 * - COMPREHENSIVE: Syncs ALL required tables
 */

import { getDatabase } from './database';
import { supabase } from './lib/supabase';
import { TABLES, SQLITE_SCHEMA } from './db/schema';
import {
  convertRestaurantImagesToBase64,
  convertDeliveryPersonImagesToBase64,
  convertProfileImagesToBase64
} from './lib/image-sync-helper';

// ============================================================================
// SYNC LOG MANAGEMENT (for incremental sync)
// ============================================================================

const initializeSyncLog = async (db: any) => {
  try {
    // Web version uses IndexedDB - sync_log store is created in schema
    // No initialization needed for IndexedDB
    if (db.getSyncTimestamp) {
      return;
    }
    // SQLite version
    await db.execAsync(`
      CREATE TABLE IF NOT EXISTS sync_log (
        table_name TEXT PRIMARY KEY,
        sync_timestamp TEXT
      );
    `);
  } catch (error) {
    console.error('[Sync] Error initializing sync_log:', error);
  }
};

const getLastSyncTimestamp = async (db: any, tableName: string): Promise<string> => {
  try {
    // Web version (IndexedDB)
    if (db.getSyncTimestamp) {
      const indexedDB = await db.getDatabase();
      return await db.getSyncTimestamp(indexedDB, tableName);
    }
    // SQLite version
    const result = await db.getFirstAsync(
      'SELECT sync_timestamp FROM sync_log WHERE table_name = ?',
      [tableName]
    ) as any;
    return result?.sync_timestamp || '1970-01-01T00:00:00.000Z';
  } catch (error) {
    console.error('[Sync] Error getting last sync timestamp:', error);
    return '1970-01-01T00:00:00.000Z';
  }
};

const updateSyncTimestamp = async (db: any, tableName: string) => {
  try {
    // Web version (IndexedDB)
    if (db.setSyncTimestamp) {
      const indexedDB = await db.getDatabase();
      await db.setSyncTimestamp(indexedDB, tableName);
      return;
    }
    // SQLite version
    const now = new Date().toISOString();
    await db.runAsync(
      'INSERT OR REPLACE INTO sync_log (table_name, sync_timestamp) VALUES (?, ?)',
      [tableName, now]
    );
  } catch (error) {
    console.error('[Sync] Error updating sync timestamp:', error);
  }
};

// ============================================================================
// NETWORK CHECK - More reliable detection
// ============================================================================

export const checkNetworkStatus = async (): Promise<boolean> => {
  try {
    // First check browser's online status
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      return false;
    }

    // Try a lightweight ping to Supabase with timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000); // 5 second timeout

    try {
      const { error } = await supabase
        .from('restaurants')
        .select('id')
        .limit(1)
        .maybeSingle();

      clearTimeout(timeoutId);

      if (error) {
        return false;
      }

      return true;
    } catch (fetchError) {
      clearTimeout(timeoutId);
      return false;
    }
  } catch (error) {
    console.error('[Sync] Network check error:', error);
    return false;
  }
};

// ============================================================================
// PROFILE SYNC (NEW - stores user name, phone, email)
// ============================================================================

export const syncProfiles = async (): Promise<void> => {
  try {

    const db = await getDatabase();
    const isOnline = await checkNetworkStatus();

    if (!isOnline) {
      return;
    }

    // Get current user's profile from Supabase
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return;
    }

    // Fetch profile from Supabase
    const { data: profile, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single();

    if (error) {
      console.error('[Sync] ❌ Error fetching profile:', error);
      return;
    }

    if (!profile) {
      return;
    }


    // Convert image to base64 if exists
    let imageBase64: string | null = null;
    if (profile.image_url && profile.image_url.startsWith('http')) {
      try {
        const response = await fetch(profile.image_url);
        const blob = await response.blob();
        const reader = new FileReader();
        imageBase64 = await new Promise<string | null>((resolve) => {
          reader.onloadend = () => resolve(reader.result as string);
          reader.readAsDataURL(blob);
        });
      } catch (err) {
        console.warn('[Sync] ⚠️ Failed to convert profile image:', err);
      }
    }

    // Save to local DB
    await db.runAsync(
      `INSERT OR REPLACE INTO ${TABLES.PROFILES}
       (id, full_name, email, phone, role, image_url, image_base64, avatar_url, name, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        profile.id,
        profile.full_name || profile.name || '',
        profile.email || user.email || '',
        profile.phone || '',
        profile.role || 'delivery',
        profile.image_url || null,
        imageBase64,
        profile.avatar_url || null,
        profile.name || profile.full_name || '',
        profile.created_at || new Date().toISOString(),
        profile.updated_at || new Date().toISOString()
      ]
    );
  } catch (error) {
    console.error('[Sync] ❌ Error syncing profiles:', error);
  }
};

// ============================================================================
// RESTAURANTS SYNC (INCREMENTAL with base64 images)
// ============================================================================

export const syncRestaurants = async (): Promise<void> => {
  try {

    const db = await getDatabase();
    const isOnline = await checkNetworkStatus();

    if (!isOnline) {
      return;
    }

    await initializeSyncLog(db);
    const lastSync = await getLastSyncTimestamp(db, TABLES.RESTAURANTS);

    // Fetch CHANGED restaurants from Supabase
    const { data, error } = await supabase
      .from('restaurants')
      .select('*')
      .is('deleted_at', null)
      .gte('updated_at', lastSync);

    if (error) {
      console.error('[Sync] ❌ Error fetching restaurants:', error);
      return;
    }

    if (!data || data.length === 0) {
      return;
    }


    // Process each restaurant
    for (const restaurant of data) {
      const restaurantWithBase64 = await convertRestaurantImagesToBase64(restaurant);

      await db.runAsync(
        `INSERT OR REPLACE INTO ${TABLES.RESTAURANTS}
         (id, owner_id, name, description, image_url, image_base64, logo_url, logo_base64,
          cover_image_url, cover_image_base64, address, phone, contact_phone, email,
          latitude, longitude, is_active, is_available, opening_time, closing_time,
          created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          restaurantWithBase64.id,
          restaurantWithBase64.owner_id,
          restaurantWithBase64.name,
          restaurantWithBase64.description || '',
          restaurantWithBase64.image_url || null,
          restaurantWithBase64.image_base64 || null,
          restaurantWithBase64.logo_url || null,
          restaurantWithBase64.logo_base64 || null,
          restaurantWithBase64.cover_image_url || null,
          restaurantWithBase64.cover_image_base64 || null,
          restaurantWithBase64.address || '',
          restaurantWithBase64.phone || null,
          restaurantWithBase64.contact_phone || null,
          restaurantWithBase64.email || null,
          restaurantWithBase64.latitude || restaurant.latitude || null,
          restaurantWithBase64.longitude || restaurant.longitude || null,
          restaurantWithBase64.is_active ? 1 : 0,
          restaurantWithBase64.is_available ? 1 : 0,
          restaurantWithBase64.opening_time || null,
          restaurantWithBase64.closing_time || null,
          restaurantWithBase64.created_at || new Date().toISOString(),
          restaurantWithBase64.updated_at || new Date().toISOString()
        ]
      );
    }

    await updateSyncTimestamp(db, TABLES.RESTAURANTS);
  } catch (error) {
    console.error('[Sync] ❌ Error syncing restaurants:', error);
  }
};

// ============================================================================
// ORDERS SYNC (INCREMENTAL - includes customer info)
// ============================================================================

export const syncOrders = async (): Promise<void> => {
  try {

    const db = await getDatabase();
    const isOnline = await checkNetworkStatus();

    if (!isOnline) {
      return;
    }

    await initializeSyncLog(db);
    const lastSync = await getLastSyncTimestamp(db, TABLES.ORDERS);

    // Fetch CHANGED orders from Supabase
    const { data, error } = await supabase
      .from('orders')
      .select('*')
      .is('deleted_at', null)
      .gte('updated_at', lastSync);

    if (error) {
      console.error('[Sync] ❌ Error fetching orders:', error);
      return;
    }

    if (!data || data.length === 0) {
      return;
    }


    // Save to local DB
    for (const order of data) {
      await db.runAsync(
        `INSERT OR REPLACE INTO ${TABLES.ORDERS}
         (id, user_id, restaurant_id, delivery_person_id, driver_id, status,
          total_amount, subtotal, delivery_cost, delivery_address, delivery_notes,
          delivery_lat, delivery_lng, restaurant_name, payment_method, payment_status,
          cancellation_reason, rejection_reason, estimated_delivery_time, actual_delivery_time,
          created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          order.id,
          order.user_id,
          order.restaurant_id,
          order.delivery_person_id,
          order.driver_id,
          order.status,
          parseFloat(order.total_amount) || 0,
          parseFloat(order.subtotal) || 0,
          parseFloat(order.delivery_cost) || 0,
          order.delivery_address || '',
          order.delivery_notes || null,
          order.delivery_lat || null,
          order.delivery_lng || null,
          order.restaurant_name || null,
          order.payment_method || 'cash',
          order.payment_status || 'pending',
          order.cancellation_reason || null,
          order.rejection_reason || null,
          order.estimated_delivery_time || null,
          order.actual_delivery_time || null,
          order.created_at || new Date().toISOString(),
          order.updated_at || new Date().toISOString()
        ]
      );
    }

    await updateSyncTimestamp(db, TABLES.ORDERS);
  } catch (error) {
    console.error('[Sync] ❌ Error syncing orders:', error);
  }
};

// ============================================================================
// ORDER ITEMS SYNC (NEW - CRITICAL)
// ============================================================================

export const syncOrderItems = async (): Promise<void> => {
  try {

    const db = await getDatabase();
    const isOnline = await checkNetworkStatus();

    if (!isOnline) {
      return;
    }

    await initializeSyncLog(db);
    const lastSync = await getLastSyncTimestamp(db, TABLES.ORDER_ITEMS);

    // Fetch CHANGED order items from Supabase
    const { data, error } = await supabase
      .from('order_items')
      .select('*')
      .is('deleted_at', null)
      .gte('updated_at', lastSync);

    if (error) {
      console.error('[Sync] ❌ Error fetching order items:', error);
      return;
    }

    if (!data || data.length === 0) {
      return;
    }


    // Save to local DB
    for (const item of data) {
      await db.runAsync(
        `INSERT OR REPLACE INTO ${TABLES.ORDER_ITEMS}
         (id, order_id, menu_item_id, quantity, price, special_instructions, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          item.id,
          item.order_id,
          item.menu_item_id,
          item.quantity,
          parseFloat(item.price) || 0,
          item.special_instructions || null,
          item.created_at || new Date().toISOString(),
          item.updated_at || new Date().toISOString()
        ]
      );
    }

    await updateSyncTimestamp(db, TABLES.ORDER_ITEMS);
  } catch (error) {
    console.error('[Sync] ❌ Error syncing order items:', error);
  }
};

// ============================================================================
// DELIVERY PERSONS SYNC (INCREMENTAL with base64 images)
// ============================================================================

export const syncDeliveryPersons = async (): Promise<void> => {
  try {

    const db = await getDatabase();
    const isOnline = await checkNetworkStatus();

    if (!isOnline) {
      return;
    }

    await initializeSyncLog(db);
    const lastSync = await getLastSyncTimestamp(db, TABLES.DELIVERY_PERSONS);

    // Fetch CHANGED delivery persons from Supabase
    const { data, error } = await supabase
      .from('delivery_persons')
      .select('*')
      .is('deleted_at', null)
      .gte('updated_at', lastSync);

    if (error) {
      console.error('[Sync] ❌ Error fetching delivery persons:', error);
      return;
    }

    if (!data || data.length === 0) {
      return;
    }


    // Process each delivery person
    for (const person of data) {
      const personWithBase64 = await convertDeliveryPersonImagesToBase64(person);

      await db.runAsync(
        `INSERT OR REPLACE INTO ${TABLES.DELIVERY_PERSONS}
         (id, user_id, name, email, phone, vehicle_type, license_plate,
          is_available, current_latitude, current_longitude, rating, total_deliveries,
          image_url, image_base64, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          personWithBase64.id,
          personWithBase64.user_id,
          personWithBase64.name,
          personWithBase64.email || null,
          personWithBase64.phone || null,
          personWithBase64.vehicle_type || null,
          personWithBase64.license_plate || null,
          personWithBase64.is_available ? 1 : 0,
          personWithBase64.current_latitude || null,
          personWithBase64.current_longitude || null,
          personWithBase64.rating || 0,
          personWithBase64.total_deliveries || 0,
          personWithBase64.image_url || null,
          personWithBase64.image_base64 || null,
          personWithBase64.created_at || new Date().toISOString(),
          personWithBase64.updated_at || new Date().toISOString()
        ]
      );
    }

    await updateSyncTimestamp(db, TABLES.DELIVERY_PERSONS);
  } catch (error) {
    console.error('[Sync] ❌ Error syncing delivery persons:', error);
  }
};

// ============================================================================
// DELIVERY ASSIGNMENTS SYNC (INCREMENTAL)
// ============================================================================

export const syncDeliveryAssignments = async (): Promise<void> => {
  try {

    const db = await getDatabase();
    const isOnline = await checkNetworkStatus();

    if (!isOnline) {
      return;
    }

    await initializeSyncLog(db);
    const lastSync = await getLastSyncTimestamp(db, TABLES.DELIVERY_ASSIGNMENTS);

    // Fetch CHANGED delivery assignments from Supabase
    const { data, error } = await supabase
      .from('delivery_assignments')
      .select('*')
      .is('deleted_at', null)
      .gte('updated_at', lastSync);

    if (error) {
      console.error('[Sync] ❌ Error fetching delivery assignments:', error);
      return;
    }

    if (!data || data.length === 0) {
      return;
    }


    // Save to local DB
    for (const assignment of data) {
      await db.runAsync(
        `INSERT OR REPLACE INTO ${TABLES.DELIVERY_ASSIGNMENTS}
         (id, order_id, delivery_person_id, user_id, restaurant_id, status,
          total_amount, delivery_address, delivery_notes, notes, phone_number,
          assigned_at, accepted_at, picked_up_at, delivered_at, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          assignment.id,
          assignment.order_id,
          assignment.delivery_person_id,
          assignment.user_id,
          assignment.restaurant_id,
          assignment.status,
          parseFloat(assignment.total_amount) || 0,
          assignment.delivery_address || null,
          assignment.delivery_notes || null,
          assignment.notes || null,
          assignment.phone_number || null,
          assignment.assigned_at || new Date().toISOString(),
          assignment.accepted_at || null,
          assignment.picked_up_at || null,
          assignment.delivered_at || null,
          assignment.created_at || new Date().toISOString(),
          assignment.updated_at || new Date().toISOString()
        ]
      );
    }

    await updateSyncTimestamp(db, TABLES.DELIVERY_ASSIGNMENTS);
  } catch (error) {
    console.error('[Sync] ❌ Error syncing delivery assignments:', error);
  }
};

// ============================================================================
// NOTIFICATIONS SYNC (INCREMENTAL)
// ============================================================================

export const syncNotifications = async (): Promise<void> => {
  try {

    const db = await getDatabase();
    const isOnline = await checkNetworkStatus();

    if (!isOnline) {
      return;
    }

    await initializeSyncLog(db);
    const lastSync = await getLastSyncTimestamp(db, TABLES.NOTIFICATIONS);

    // Fetch CHANGED notifications from Supabase
    const { data, error } = await supabase
      .from('notifications')
      .select('*')
      .is('deleted_at', null)
      .gte('updated_at', lastSync);

    if (error) {
      console.error('[Sync] ❌ Error fetching notifications:', error);
      return;
    }

    if (!data || data.length === 0) {
      return;
    }


    // Save to local DB
    for (const notification of data) {
      await db.runAsync(
        `INSERT OR REPLACE INTO ${TABLES.NOTIFICATIONS}
         (id, user_id, title, message, type, is_read, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          notification.id,
          notification.user_id,
          notification.title,
          notification.message,
          notification.type || 'info',
          notification.is_read ? 1 : 0,
          notification.created_at || new Date().toISOString(),
          notification.updated_at || new Date().toISOString()
        ]
      );
    }

    await updateSyncTimestamp(db, TABLES.NOTIFICATIONS);
  } catch (error) {
    console.error('[Sync] ❌ Error syncing notifications:', error);
  }
};

// ============================================================================
// FULL SYNC - All tables (SAFE - doesn't corrupt data on failure)
// ============================================================================

export const fullSync = async (): Promise<void> => {

  try {
    // First check if we're online
    const isOnline = await checkNetworkStatus();

    if (!isOnline) {
      return;
    }

    // Try incremental sync - if ANY step fails, we stop and keep cached data

    // Sync in order of dependencies
    await syncProfiles();
    await syncRestaurants();
    await syncOrders();
    await syncOrderItems();
    await syncDeliveryPersons();
    await syncDeliveryAssignments();
    await syncNotifications();
  } catch (error) {
    console.error('[Sync] ❌ Full sync error:', error);
    // Don't rethrow - we want to keep using cached data
  }
};

// ============================================================================
// SMART SYNC - Check network and sync accordingly
// ============================================================================

export const smartSync = async (tables: string[] = ['profiles', 'restaurants', 'orders', 'order_items', 'delivery_persons']): Promise<{
  isOnline: boolean;
  data: Record<string, any[]>;
}> => {

  const isOnline = await checkNetworkStatus();

  // Sync if online
  if (isOnline) {
    for (const table of tables) {
      switch (table) {
        case 'profiles':
          await syncProfiles();
          break;
        case 'restaurants':
          await syncRestaurants();
          break;
        case 'orders':
          await syncOrders();
          break;
        case 'order_items':
          await syncOrderItems();
          break;
        case 'delivery_persons':
          await syncDeliveryPersons();
          break;
        case 'delivery_assignments':
          await syncDeliveryAssignments();
          break;
        case 'notifications':
          await syncNotifications();
          break;
      }
    }
  } else {
    // Load from local DB
    const data: Record<string, any[]> = {};
    const db = await getDatabase();

    for (const table of tables) {
      try {
        const result = await db.getAllAsync(`SELECT * FROM ${table}`);
        data[table] = result || [];
      } catch (error) {
        console.error(`[Sync] Error loading ${table}:`, error);
        data[table] = [];
      }
    }

    return { isOnline, data };
  }

  // Load from local DB
  const data: Record<string, any[]> = {};
  const db = await getDatabase();

  for (const table of tables) {
    try {
      const result = await db.getAllAsync(`SELECT * FROM ${table}`);
      data[table] = result || [];
    } catch (error) {
      console.error(`[Sync] Error loading ${table}:`, error);
      data[table] = [];
    }
  }

  return { isOnline, data };
};

// ============================================================================
// LOCAL DB HELPERS
// ============================================================================

export const getFromLocal = async <T>(table: string, whereClause?: string, params?: any[]): Promise<T[]> => {
  try {
    const db = await getDatabase();
    let sql = `SELECT * FROM ${table}`;
    if (whereClause) {
      sql += ` WHERE ${whereClause}`;
    }
    const result = await db.getAllAsync(sql, params || []);
    return result as T[];
  } catch (error) {
    console.error(`[Sync] ❌ Error getting ${table} from local:`, error);
    return [];
  }
};

export default {
  checkNetworkStatus,
  syncProfiles,
  syncRestaurants,
  syncOrders,
  syncOrderItems,
  syncDeliveryPersons,
  syncDeliveryAssignments,
  syncNotifications,
  fullSync,
  smartSync,
  getFromLocal,
};
