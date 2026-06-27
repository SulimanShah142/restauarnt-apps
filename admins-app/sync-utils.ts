/**
 * Admins App - Comprehensive Sync Utilities
 * Syncs data between Supabase and local SQLite/IndexedDB
 * 
 * Features:
 * - INCREMENTAL SYNC: Only fetches changed data since last sync
 * - OFFLINE-FIRST: Works offline with cached data
 * - BASE64 IMAGES: Stores images locally for offline access
 * - COMPREHENSIVE: Syncs ALL required tables including profiles, categories, settings
 */

import { getDatabase } from './database';
import { supabase } from './lib/supabase';
import { TABLES } from './db/schema';
import {
  convertRestaurantImagesToBase64,
  convertMenuItemImagesToBase64,
  convertMenuCategoryImagesToBase64
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
    console.error('[Admin-Sync] Error initializing sync_log:', error);
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
    console.error('[Admin-Sync] Error getting last sync timestamp:', error);
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
    console.error('[Admin-Sync] Error updating sync timestamp:', error);
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
    console.error('[Admin-Sync] Network check error:', error);
    return false;
  }
};

// ============================================================================
// PROFILE SYNC (NEW - stores admin name, phone, email)
// ============================================================================

export const syncProfiles = async (): Promise<void> => {
  try {

    const db = await getDatabase();
    const isOnline = await checkNetworkStatus();

    if (!isOnline) {
      return;
    }

    // Get current admin user's profile from Supabase
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
      console.error('[Admin-Sync] ❌ Error fetching profile:', error);
      return;
    }

    if (!profile) {
      return;
    }


    // Convert image to base64 if exists
    let imageBase64 = null;
    if (profile.image_url && profile.image_url.startsWith('http')) {
      try {
        const response = await fetch(profile.image_url);
        const blob = await response.blob();
        const reader = new FileReader();
        imageBase64 = await new Promise<string>((resolve) => {
          reader.onloadend = () => resolve(reader.result as string);
          reader.readAsDataURL(blob);
        });
      } catch (err) {
        console.warn('[Admin-Sync] ⚠️ Failed to convert profile image:', err);
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
        profile.role || 'admin',
        profile.image_url || null,
        imageBase64,
        profile.avatar_url || null,
        profile.name || profile.full_name || '',
        profile.created_at || new Date().toISOString(),
        profile.updated_at || new Date().toISOString()
      ]
    );
  } catch (error) {
    console.error('[Admin-Sync] ❌ Error syncing profiles:', error);
  }
};

// ============================================================================
// ADMINS SYNC (INCREMENTAL)
// ============================================================================

export const syncAdmins = async (): Promise<void> => {
  try {

    const db = await getDatabase();
    const isOnline = await checkNetworkStatus();

    if (!isOnline) {
      return;
    }

    await initializeSyncLog(db);
    const lastSync = await getLastSyncTimestamp(db, TABLES.ADMINS);

    // Fetch CHANGED admins from Supabase
    const { data, error } = await supabase
      .from('admins')
      .select('*')
      .is('deleted_at', null)
      .gte('updated_at', lastSync);

    if (error) {
      console.error('[Admin-Sync] ❌ Error fetching admins:', error);
      return;
    }

    if (!data || data.length === 0) {
      return;
    }


    // Save to local DB
    for (const admin of data) {
      await db.runAsync(
        `INSERT OR REPLACE INTO ${TABLES.ADMINS}
         (id, user_id, role, session_token, last_login, permissions, is_active, login_attempts, locked_until, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          admin.id,
          admin.user_id,
          admin.role || 'admin',
          admin.session_token || null,
          admin.last_login || null,
          JSON.stringify(admin.permissions || {}),
          admin.is_active ? 1 : 0,
          admin.login_attempts || 0,
          admin.locked_until || null,
          admin.created_at || new Date().toISOString(),
          admin.updated_at || new Date().toISOString()
        ]
      );
    }

    await updateSyncTimestamp(db, TABLES.ADMINS);
  } catch (error) {
    console.error('[Admin-Sync] ❌ Error syncing admins:', error);
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
      console.error('[Admin-Sync] ❌ Error fetching restaurants:', error.message);
      return; // Don't modify local data on error
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
          contact_email, cuisine_type, rating, average_rating, total_reviews, delivery_fee,
          min_order_amount, minimum_order_value, estimated_delivery_time, estimated_preparation_time,
          is_active, is_available, latitude, longitude, coordinates_geocoded,
          opening_time, closing_time, website_url, delivery_radius,
          social_media_links, payment_methods, dietary_options, special_offers,
          seating_capacity, parking_availability, peak_hours_start, peak_hours_end,
          created_at, updated_at, last_updated, deleted_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
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
          restaurantWithBase64.contact_email || null,
          restaurantWithBase64.cuisine_type || null,
          restaurantWithBase64.rating || 0,
          restaurantWithBase64.average_rating || 0,
          restaurantWithBase64.total_reviews || 0,
          restaurantWithBase64.delivery_fee || null,
          restaurantWithBase64.min_order_amount || null,
          restaurantWithBase64.minimum_order_value || null,
          restaurantWithBase64.estimated_delivery_time || null,
          restaurantWithBase64.estimated_preparation_time || null,
          restaurantWithBase64.is_active ? 1 : 0,
          restaurantWithBase64.is_available ? 1 : 0,
          restaurantWithBase64.latitude || restaurant.latitude || null,
          restaurantWithBase64.longitude || restaurant.longitude || null,
          restaurantWithBase64.coordinates_geocoded || 0,
          restaurantWithBase64.opening_time || null,
          restaurantWithBase64.closing_time || null,
          restaurantWithBase64.website_url || null,
          restaurantWithBase64.delivery_radius || null,
          restaurantWithBase64.social_media_links ? JSON.stringify(restaurantWithBase64.social_media_links) : null,
          restaurantWithBase64.payment_methods ? JSON.stringify(restaurantWithBase64.payment_methods) : null,
          restaurantWithBase64.dietary_options ? JSON.stringify(restaurantWithBase64.dietary_options) : null,
          restaurantWithBase64.special_offers ? JSON.stringify(restaurantWithBase64.special_offers) : null,
          restaurantWithBase64.seating_capacity || null,
          restaurantWithBase64.parking_availability ? 1 : 0,
          restaurantWithBase64.peak_hours_start || null,
          restaurantWithBase64.peak_hours_end || null,
          restaurantWithBase64.created_at || new Date().toISOString(),
          restaurantWithBase64.updated_at || new Date().toISOString(),
          restaurantWithBase64.last_updated || restaurantWithBase64.updated_at || new Date().toISOString(),
          restaurantWithBase64.deleted_at || null
        ]
      );
    }

    await updateSyncTimestamp(db, TABLES.RESTAURANTS);
  } catch (error) {
    console.error('[Admin-Sync] ❌ Error syncing restaurants:', error);
  }
};

// ============================================================================
// MENU CATEGORIES SYNC (INCREMENTAL with base64 images) - CRITICAL FIX
// ============================================================================

export const syncMenuCategories = async (): Promise<void> => {
  try {

    const db = await getDatabase();
    const isOnline = await checkNetworkStatus();

    if (!isOnline) {
      return;
    }

    await initializeSyncLog(db);
    const lastSync = await getLastSyncTimestamp(db, TABLES.MENU_CATEGORIES);

    // Fetch CHANGED menu categories from Supabase
    const { data, error } = await supabase
      .from('menu_categories')
      .select('*')
      .is('deleted_at', null)
      .gte('updated_at', lastSync);

    if (error) {
      console.error('[Admin-Sync] ❌ Error fetching menu categories:', error);
      return;
    }

    if (!data || data.length === 0) {
      return;
    }


    // Process each category
    for (const category of data) {
      const categoryWithBase64 = await convertMenuCategoryImagesToBase64(category);

      await db.runAsync(
        `INSERT OR REPLACE INTO ${TABLES.MENU_CATEGORIES}
         (id, restaurant_id, name, description, image_url, image_base64, sort_order, is_active, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          categoryWithBase64.id,
          categoryWithBase64.restaurant_id,
          categoryWithBase64.name,
          categoryWithBase64.description || '',
          categoryWithBase64.image_url || null,
          categoryWithBase64.image_base64 || null,
          categoryWithBase64.sort_order || 0,
          categoryWithBase64.is_active ? 1 : 0,
          categoryWithBase64.created_at || new Date().toISOString(),
          categoryWithBase64.updated_at || new Date().toISOString()
        ]
      );
    }

    await updateSyncTimestamp(db, TABLES.MENU_CATEGORIES);
  } catch (error) {
    console.error('[Admin-Sync] ❌ Error syncing menu categories:', error);
  }
};

// ============================================================================
// MENU ITEMS SYNC (INCREMENTAL with base64 images)
// ============================================================================

export const syncMenuItems = async (): Promise<void> => {
  try {

    const db = await getDatabase();
    const isOnline = await checkNetworkStatus();

    if (!isOnline) {
      return;
    }

    await initializeSyncLog(db);
    const lastSync = await getLastSyncTimestamp(db, TABLES.MENU_ITEMS);

    // Fetch CHANGED menu items from Supabase
    const { data, error } = await supabase
      .from('menu_items')
      .select('*')
      .is('deleted_at', null)
      .gte('updated_at', lastSync);

    if (error) {
      console.error('[Admin-Sync] ❌ Error fetching menu items:', error);
      return;
    }

    if (!data || data.length === 0) {
      return;
    }


    // Process each menu item
    for (const item of data) {
      const itemWithBase64 = await convertMenuItemImagesToBase64(item);

      await db.runAsync(
        `INSERT OR REPLACE INTO ${TABLES.MENU_ITEMS}
         (id, restaurant_id, menu_category_id, name, description, price, image_url, image_base64,
          is_available, preparation_time, dietary_restrictions, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          itemWithBase64.id,
          itemWithBase64.restaurant_id,
          itemWithBase64.menu_category_id,
          itemWithBase64.name,
          itemWithBase64.description || '',
          parseFloat(itemWithBase64.price) || 0,
          itemWithBase64.image_url || null,
          itemWithBase64.image_base64 || null,
          itemWithBase64.is_available ? 1 : 0,
          itemWithBase64.preparation_time || null,
          JSON.stringify(itemWithBase64.dietary_restrictions || []),
          itemWithBase64.created_at || new Date().toISOString(),
          itemWithBase64.updated_at || new Date().toISOString()
        ]
      );
    }

    await updateSyncTimestamp(db, TABLES.MENU_ITEMS);
  } catch (error) {
    console.error('[Admin-Sync] ❌ Error syncing menu items:', error);
  }
};

// ============================================================================
// ORDERS SYNC (INCREMENTAL)
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
      console.error('[Admin-Sync] ❌ Error fetching orders:', error);
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
    console.error('[Admin-Sync] ❌ Error syncing orders:', error);
  }
};

// ============================================================================
// ORDER ITEMS SYNC (INCREMENTAL) - CRITICAL FIX
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
      console.error('[Admin-Sync] ❌ Error fetching order items:', error);
      return;
    }

    if (!data || data.length === 0) {
      return;
    }


    // Save to local DB
    for (const item of data) {
      await db.runAsync(
        `INSERT OR REPLACE INTO ${TABLES.ORDER_ITEMS}
         (id, order_id, menu_item_id, quantity, price, menu_item_name, menu_item_image_url,
          special_instructions, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          item.id,
          item.order_id,
          item.menu_item_id,
          item.quantity,
          parseFloat(item.price) || 0,
          item.menu_item_name || null,
          item.menu_item_image_url || null,
          item.special_instructions || null,
          item.created_at || new Date().toISOString(),
          item.updated_at || new Date().toISOString()
        ]
      );
    }

    await updateSyncTimestamp(db, TABLES.ORDER_ITEMS);
  } catch (error) {
    console.error('[Admin-Sync] ❌ Error syncing order items:', error);
  }
};

// ============================================================================
// FEEDBACK SYNC (INCREMENTAL)
// ============================================================================

export const syncFeedback = async (): Promise<void> => {
  try {

    const db = await getDatabase();
    const isOnline = await checkNetworkStatus();

    if (!isOnline) {
      return;
    }

    await initializeSyncLog(db);
    const lastSync = await getLastSyncTimestamp(db, TABLES.FEEDBACK);

    // Fetch CHANGED feedback from Supabase
    const { data, error } = await supabase
      .from('feedback')
      .select('*')
      .is('deleted_at', null)
      .gte('updated_at', lastSync);

    if (error) {
      console.error('[Admin-Sync] ❌ Error fetching feedback:', error);
      return;
    }

    if (!data || data.length === 0) {
      return;
    }


    // Save to local DB
    for (const feedback of data) {
      await db.runAsync(
        `INSERT OR REPLACE INTO ${TABLES.FEEDBACK}
         (id, user_id, title, comment, rating, is_resolved, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          feedback.id,
          feedback.user_id,
          feedback.title,
          feedback.comment || null,
          feedback.rating || null,
          feedback.is_resolved ? 1 : 0,
          feedback.created_at || new Date().toISOString(),
          feedback.updated_at || new Date().toISOString()
        ]
      );
    }

    await updateSyncTimestamp(db, TABLES.FEEDBACK);
  } catch (error) {
    console.error('[Admin-Sync] ❌ Error syncing feedback:', error);
  }
};

// ============================================================================
// APP SETTINGS SYNC (INCREMENTAL) - CRITICAL FIX
// ============================================================================

export const syncAppSettings = async (): Promise<void> => {
  try {

    const db = await getDatabase();
    const isOnline = await checkNetworkStatus();

    if (!isOnline) {
      return;
    }

    await initializeSyncLog(db);
    const lastSync = await getLastSyncTimestamp(db, TABLES.APP_SETTINGS);

    // Fetch CHANGED app settings from Supabase
    const { data, error } = await supabase
      .from('app_settings')
      .select('*')
      .is('deleted_at', null)
      .gte('updated_at', lastSync);

    if (error) {
      console.error('[Admin-Sync] ❌ Error fetching app settings:', error);
      return;
    }

    if (!data || data.length === 0) {
      // Even if no changes, ensure we have at least one row
      const existingSettings = await db.getFirstAsync(
        `SELECT id FROM ${TABLES.APP_SETTINGS} LIMIT 1`,
        []
      ) as any;

      if (!existingSettings) {
        await db.runAsync(
          `INSERT OR REPLACE INTO ${TABLES.APP_SETTINGS}
           (id, delivery_cost_per_km, minimum_delivery_cost, is_delivery_enabled,
            base_delivery_fee, max_free_delivery_distance, additional_fee_per_km_after_free,
            manager_number, admin_phone, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            'app-settings',
            2.50,
            5.00,
            1,
            3.00,
            2.00,
            1.50,
            null,
            null,
            new Date().toISOString(),
            new Date().toISOString()
          ]
        );
      }
      return;
    }


    // Save to local DB
    for (const setting of data) {
      await db.runAsync(
        `INSERT OR REPLACE INTO ${TABLES.APP_SETTINGS}
         (id, delivery_cost_per_km, minimum_delivery_cost, is_delivery_enabled,
          base_delivery_fee, max_free_delivery_distance, additional_fee_per_km_after_free,
          manager_number, admin_phone, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          setting.id || 'app-settings',
          setting.delivery_cost_per_km || 2.50,
          setting.minimum_delivery_cost || 5.00,
          setting.is_delivery_enabled ? 1 : 0,
          setting.base_delivery_fee || 3.00,
          setting.max_free_delivery_distance || 2.00,
          setting.additional_fee_per_km_after_free || 1.50,
          setting.manager_number || null,
          setting.admin_phone || null,
          setting.created_at || new Date().toISOString(),
          setting.updated_at || new Date().toISOString()
        ]
      );
    }

    await updateSyncTimestamp(db, TABLES.APP_SETTINGS);
  } catch (error) {
    console.error('[Admin-Sync] ❌ Error syncing app settings:', error);
  }
};

// ============================================================================
// DELIVERY PERSONS SYNC (INCREMENTAL)
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
      console.error('[Admin-Sync] ❌ Error fetching delivery persons:', error);
      return;
    }

    if (!data || data.length === 0) {
      return;
    }


    // Save to local DB
    for (const person of data) {
      await db.runAsync(
        `INSERT OR REPLACE INTO ${TABLES.DELIVERY_PERSONS}
         (id, user_id, name, email, phone, vehicle_type, license_plate,
          is_available, current_latitude, current_longitude, rating, total_deliveries,
          image_url, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          person.id,
          person.user_id,
          person.name,
          person.email || null,
          person.phone || null,
          person.vehicle_type || null,
          person.license_plate || null,
          person.is_available ? 1 : 0,
          person.current_latitude || null,
          person.current_longitude || null,
          person.rating || 0,
          person.total_deliveries || 0,
          person.image_url || null,
          person.created_at || new Date().toISOString(),
          person.updated_at || new Date().toISOString()
        ]
      );
    }

    await updateSyncTimestamp(db, TABLES.DELIVERY_PERSONS);
  } catch (error) {
    console.error('[Admin-Sync] ❌ Error syncing delivery persons:', error);
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
      console.error('[Admin-Sync] ❌ Error fetching delivery assignments:', error);
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
    console.error('[Admin-Sync] ❌ Error syncing delivery assignments:', error);
  }
};

// ============================================================================
// FULL SYNC - All tables (SAFE - doesn't corrupt data on failure)
// ============================================================================

export const fullSync = async (force: boolean = false): Promise<void> => {

  try {
    // First check if we're online
    const isOnline = await checkNetworkStatus();

    if (!isOnline) {
      return;
    }

    // FORCE MODE: Clear all local data first to detect deletions
    if (force) {
      const db = await getDatabase();
      
      // Clear all tables
      const tablesToClear = [
        'admins', 'restaurants', 'menu_categories', 'menu_items',
        'orders', 'order_items', 'feedback', 'reviews', 'advertisements',
        'app_settings', 'settings', 'delivery_persons', 'delivery_assignments',
        'notifications', 'payments', 'users', 'profiles'
      ];

      for (const table of tablesToClear) {
        try {
          await db.runAsync(`DELETE FROM ${table}`, []);
        } catch (error) {
          console.error('[Admin-Sync]   ❌ Error clearing', table, error);
        }
      }

      // Clear sync log to force full re-download
      try {
        await db.runAsync('DELETE FROM sync_log', []);
      } catch (error) {
        console.error('[Admin-Sync]   ❌ Error clearing sync_log', error);
      }
    }

    // Try incremental sync - if ANY step fails, we stop and keep cached data

    // Sync in order of dependencies
    await syncProfiles();
    await syncAdmins();
    await syncRestaurants();
    await syncMenuCategories();
    await syncMenuItems();
    await syncOrders();
    await syncOrderItems();
    await syncFeedback();
    await syncAppSettings();
    await syncDeliveryPersons();
    await syncDeliveryAssignments();
  } catch (error) {
    console.error('[Admin-Sync] ❌ Full sync error:', error);
    // Don't rethrow - we want to keep using cached data
  }
};

// ============================================================================
// SYNC WITH SUPABASE - Main entry point for database sync
// ============================================================================

/**
 * Main sync function called by database layer
 * This is the primary entry point for syncing all data from Supabase
 * @param force - If true, clears all local data before syncing (detects deletions)
 */
export const syncWithSupabase = async (force: boolean = false): Promise<void> => {
  if (force) {
    await fullSync(true);
  } else {
    await fullSync();
  }
};

// ============================================================================
// SMART SYNC - Check network and sync accordingly
// ============================================================================

export const smartSync = async (tables: string[] = ['profiles', 'admins', 'restaurants', 'menu_categories', 'menu_items', 'orders', 'order_items']): Promise<{
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
        case 'admins':
          await syncAdmins();
          break;
        case 'restaurants':
          await syncRestaurants();
          break;
        case 'menu_categories':
          await syncMenuCategories();
          break;
        case 'menu_items':
          await syncMenuItems();
          break;
        case 'orders':
          await syncOrders();
          break;
        case 'order_items':
          await syncOrderItems();
          break;
        case 'feedback':
          await syncFeedback();
          break;
        case 'app_settings':
          await syncAppSettings();
          break;
        case 'delivery_persons':
          await syncDeliveryPersons();
          break;
        case 'delivery_assignments':
          await syncDeliveryAssignments();
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
        console.error(`[Admin-Sync] Error loading ${table}:`, error);
        data[table] = [];
      }
    }

    return { isOnline, data };
  }
  
  return { isOnline, data: {} };
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
    console.error(`[Admin-Sync] ❌ Error getting ${table} from local:`, error);
    return [];
  }
};

export default {
  checkNetworkStatus,
  syncProfiles,
  syncAdmins,
  syncRestaurants,
  syncMenuCategories,
  syncMenuItems,
  syncOrders,
  syncOrderItems,
  syncFeedback,
  syncAppSettings,
  syncDeliveryPersons,
  syncDeliveryAssignments,
  fullSync,
  smartSync,
  getFromLocal,
};
