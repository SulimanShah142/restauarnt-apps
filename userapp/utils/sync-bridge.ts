// Sync Bridge for User App - Mobile Sync with Supabase
// This file handles manual sync between Expo SQLite and Supabase on mobile platforms
import { createClient } from '@supabase/supabase-js';
import * as SQLite from 'expo-sqlite';
import { TABLES } from '../db/schema';
import { cacheImage } from './image-cache';
import { imageUrlToBase64, base64ToDataUrl } from './image-base64-utils';

// Get environment variables
const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL || '';
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || '';

// Initialize Supabase client
const supabaseClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);


// Helper: Check if online
const checkOnline = async (): Promise<boolean> => {
  try {
    const startTime = Date.now();
    const response = await fetch(SUPABASE_URL, { method: 'HEAD', mode: 'no-cors' });
    const duration = Date.now() - startTime;
    return true;
  } catch (error) {
    return false;
  }
};

/**
 * Sync function for mobile - COMPLETE RESET SYNC with BASE64 IMAGE STORAGE
 * Always clears all local data first, then fetches ALL data from Supabase
 * IMAGES: All images are converted to base64 and stored locally for offline access
 */
export const syncWithSupabase = async (db: SQLite.SQLiteDatabase) => {

  // Check if online first
  const isOnline = await checkOnline();

  if (!isOnline) {
    return; // Don't sync when offline - keep existing cache
  }


  try {
    const startTime = Date.now();

    // STEP 1: CLEAR ALL LOCAL DATA FIRST

    await clearTable(db, TABLES.RESTAURANTS);

    await clearTable(db, TABLES.MENU_CATEGORIES);

    await clearTable(db, TABLES.MENU_ITEMS);

    await clearTable(db, TABLES.ORDERS);

    await clearTable(db, TABLES.ORDER_ITEMS);

    await clearTable(db, TABLES.ADDRESSES);

    await clearTable(db, TABLES.FEEDBACK);


    // STEP 2: FETCH ALL DATA FROM SUPABASE
    await syncRestaurantsComplete(db);
    await syncMenuCategoriesComplete(db);
    await syncMenuItemsComplete(db);

    const duration = Date.now() - startTime;
    // console.log('[UserApp-Sync] Sync completed in', duration, 'ms');
  } catch (error) {
    // console.error('='.repeat(80));
    // console.error('[UserApp-Sync] ❌ Error during sync:', error);
    // console.error('[UserApp-Sync] Stack trace:', (error as Error).stack);
    // console.error('='.repeat(80));
    throw error;
  }
};

/**
 * Clear all records from a table
 */
const clearTable = async (db: SQLite.SQLiteDatabase, tableName: string): Promise<void> => {
  await db.runAsync(`DELETE FROM ${tableName}`, []);
};

// Initialize sync log table to track sync timestamps
const initializeSyncLog = async (db: SQLite.SQLiteDatabase) => {
  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS sync_log (
      table_name TEXT PRIMARY KEY,
      sync_timestamp TEXT
    );
  `);
};

// Get last sync timestamp for a table
const getLastSyncTimestamp = async (db: SQLite.SQLiteDatabase, tableName: string): Promise<string> => {
  const result = await db.getFirstAsync(
    'SELECT sync_timestamp FROM sync_log WHERE table_name = ?',
    [tableName]
  ) as any;

  const timestamp = result?.sync_timestamp || '1970-01-01T00:00:00.000Z';
  return timestamp;
};

// Update sync timestamp for a table
const updateSyncTimestamp = async (db: SQLite.SQLiteDatabase, tableName: string) => {
  const now = new Date().toISOString();
  await db.runAsync(
    'INSERT OR REPLACE INTO sync_log (table_name, sync_timestamp) VALUES (?, ?)',
    [tableName, now]
  );
};

// Sync restaurants table - COMPLETE RESET version with BASE64 IMAGE STORAGE
const syncRestaurantsComplete = async (db: SQLite.SQLiteDatabase) => {

  // PULL: Download ALL restaurants from Supabase
  const fetchStartTime = Date.now();
  const { data: remoteRestaurants, error: fetchError } = await supabaseClient
    .from(TABLES.RESTAURANTS)
    .select('*')
    .is('deleted_at', null)
    .order('updated_at', { ascending: false });
  const fetchDuration = Date.now() - fetchStartTime;

  if (fetchError) {
    // console.error('❌ Error fetching restaurants from Supabase:', fetchError);
  } else if (remoteRestaurants && remoteRestaurants.length > 0) {
    const activeCount = remoteRestaurants.filter((r: any) => r.is_active !== false).length;

    // Convert images to base64 for offline storage
    const convertStartTime = Date.now();

    for (const restaurant of remoteRestaurants) {
      const base64Data: { image?: string; logo?: string; cover?: string } = {};

      // Convert main image
      if (restaurant.image_url && restaurant.image_url.startsWith('http')) {
        try {
          base64Data.image = await imageUrlToBase64(restaurant.image_url);
        } catch (err) {
          // console.warn(`⚠️ Failed to convert image for ${restaurant.name}:`, err);
        }
      }

      // Convert logo
      if (restaurant.logo_url && restaurant.logo_url.startsWith('http')) {
        try {
          base64Data.logo = await imageUrlToBase64(restaurant.logo_url);
        } catch (err) {
          // console.warn(`⚠️ Failed to convert logo for ${restaurant.name}:`, err);
        }
      }

      // Convert cover image
      if (restaurant.cover_image_url && restaurant.cover_image_url.startsWith('http')) {
        try {
          base64Data.cover = await imageUrlToBase64(restaurant.cover_image_url);
        } catch (err) {
          // console.warn(`⚠️ Failed to convert cover image for ${restaurant.name}:`, err);
        }
      }

      // Insert into database
      await db.runAsync(
        `INSERT OR REPLACE INTO ${TABLES.RESTAURANTS}
         (id, owner_id, name, description, image_url, image_base64, logo_url, logo_base64,
          cover_image_url, cover_image_base64, address, phone, contact_phone, email,
          contact_email, cuisine_type, rating, average_rating, total_reviews, delivery_fee,
          min_order_amount, minimum_order_value, estimated_delivery_time, estimated_preparation_time,
          is_active, is_available, latitude, longitude, coordinates_geocoded, opening_time,
          closing_time, website_url, delivery_radius, social_media_links, payment_methods,
          dietary_options, special_offers, seating_capacity, parking_availability,
          peak_hours_start, peak_hours_end, created_at, updated_at, last_updated, deleted_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          restaurant.id,
          restaurant.owner_id,
          restaurant.name,
          restaurant.description || null,
          restaurant.image_url || null,
          base64Data.image || null,
          restaurant.logo_url || null,
          base64Data.logo || null,
          restaurant.cover_image_url || null,
          base64Data.cover || null,
          restaurant.address || null,
          restaurant.phone || null,
          restaurant.contact_phone || null,
          restaurant.email || null,
          restaurant.contact_email || null,
          restaurant.cuisine_type || null,
          restaurant.rating || 0,
          restaurant.average_rating || 0,
          restaurant.total_reviews || 0,
          restaurant.delivery_fee || 0,
          restaurant.min_order_amount || 0,
          restaurant.minimum_order_value || 0,
          restaurant.estimated_delivery_time || null,
          restaurant.estimated_preparation_time || null,
          restaurant.is_active !== false ? 1 : 0,
          restaurant.is_available !== false ? 1 : 0,
          restaurant.latitude || null,
          restaurant.longitude || null,
          restaurant.coordinates_geocoded || 0,
          restaurant.opening_time || null,
          restaurant.closing_time || null,
          restaurant.website_url || null,
          restaurant.delivery_radius || null,
          restaurant.social_media_links ? JSON.stringify(restaurant.social_media_links) : null,
          restaurant.payment_methods ? JSON.stringify(restaurant.payment_methods) : null,
          restaurant.dietary_options ? JSON.stringify(restaurant.dietary_options) : null,
          restaurant.special_offers ? JSON.stringify(restaurant.special_offers) : null,
          restaurant.seating_capacity || null,
          restaurant.parking_availability ? 1 : 0,
          restaurant.peak_hours_start || null,
          restaurant.peak_hours_end || null,
          restaurant.created_at || new Date().toISOString(),
          restaurant.updated_at || new Date().toISOString(),
          restaurant.last_updated || restaurant.updated_at || new Date().toISOString(),
          restaurant.deleted_at || null
        ]
      );
    }
    const convertDuration = Date.now() - convertStartTime;
  }
};

// Sync menu categories table - COMPLETE RESET version with BASE64 IMAGE STORAGE
const syncMenuCategoriesComplete = async (db: SQLite.SQLiteDatabase) => {

  const fetchStartTime = Date.now();
  const { data: remoteCategories, error: fetchError } = await supabaseClient
    .from(TABLES.MENU_CATEGORIES)
    .select('*')
    .is('deleted_at', null)
    .order('updated_at', { ascending: false });
  const fetchDuration = Date.now() - fetchStartTime;

  if (fetchError) {
    // console.error('❌ Error fetching menu categories from Supabase:', fetchError);
  } else if (remoteCategories && remoteCategories.length > 0) {

    // Convert images to base64
    const convertStartTime = Date.now();

    for (const category of remoteCategories) {
      let image_base64 = null;

      if (category.image_url && category.image_url.startsWith('http')) {
        try {
          image_base64 = await imageUrlToBase64(category.image_url);
        } catch (err) {
          // console.warn(`⚠️ Failed to convert image for ${category.name}:`, err);
        }
      }

      await db.runAsync(
        `INSERT OR REPLACE INTO ${TABLES.MENU_CATEGORIES}
         (id, restaurant_id, name, description, image_url, image_base64, sort_order, is_active, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          category.id,
          category.restaurant_id,
          category.name,
          category.description || null,
          category.image_url || null,
          image_base64 || null,
          category.sort_order || 0,
          category.is_active !== false ? 1 : 0,
          category.created_at || new Date().toISOString(),
          category.updated_at || new Date().toISOString()
        ]
      );
    }
    const convertDuration = Date.now() - convertStartTime;
  }
};

// Sync menu items table - COMPLETE RESET version with BASE64 IMAGE STORAGE
const syncMenuItemsComplete = async (db: SQLite.SQLiteDatabase) => {

  const fetchStartTime = Date.now();
  const { data: remoteMenuItems, error: fetchError } = await supabaseClient
    .from(TABLES.MENU_ITEMS)
    .select('*')
    .is('deleted_at', null)
    .order('updated_at', { ascending: false });
  const fetchDuration = Date.now() - fetchStartTime;

  if (fetchError) {
    // console.error('❌ Error fetching menu items from Supabase:', fetchError);
  } else if (remoteMenuItems && remoteMenuItems.length > 0) {

    // Convert images to base64
    const convertStartTime = Date.now();

    for (const item of remoteMenuItems) {
      let image_base64 = null;

      if (item.image_url && item.image_url.startsWith('http')) {
        try {
          image_base64 = await imageUrlToBase64(item.image_url);
        } catch (err) {
          // console.warn(`⚠️ Failed to convert image for ${item.name}:`, err);
        }
      }

      await db.runAsync(
        `INSERT OR REPLACE INTO ${TABLES.MENU_ITEMS}
         (id, restaurant_id, menu_category_id, name, description, price, image_url, image_base64,
          is_available, preparation_time, dietary_restrictions, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          item.id,
          item.restaurant_id,
          item.menu_category_id,
          item.name,
          item.description || null,
          parseFloat(item.price) || 0,
          item.image_url || null,
          image_base64 || null,
          item.is_available !== false ? 1 : 0,
          item.preparation_time || null,
          item.dietary_restrictions ? JSON.stringify(item.dietary_restrictions) : null,
          item.created_at || new Date().toISOString(),
          item.updated_at || new Date().toISOString()
        ]
      );
    }
    const convertDuration = Date.now() - convertStartTime;
  }
};

// Sync restaurants table - INCREMENTAL version with BASE64 IMAGE STORAGE
const syncRestaurantsIncremental = async (db: SQLite.SQLiteDatabase) => {

  const lastSync = await getLastSyncTimestamp(db, TABLES.RESTAURANTS);

  // PULL: Download changed restaurants from Supabase since last sync
  const fetchStartTime = Date.now();
  const { data: remoteRestaurants, error: fetchError } = await supabaseClient
    .from(TABLES.RESTAURANTS)
    .select('*')
    .or(`deleted_at.not.is.null,updated_at.gte.${lastSync}`) // Fetch changed OR deleted records
    .order('updated_at', { ascending: false });
  const fetchDuration = Date.now() - fetchStartTime;

  if (fetchError) {
    // console.error('❌ Error fetching restaurants from Supabase:', fetchError);
    // console.error('[UserApp-Sync] Error details:', JSON.stringify(fetchError, null, 2));
  } else if (remoteRestaurants && remoteRestaurants.length > 0) {

    // Separate active and deleted records
    const activeRestaurants = remoteRestaurants.filter((r: any) => !r.deleted_at);
    const deletedRestaurants = remoteRestaurants.filter((r: any) => r.deleted_at);


    // DELETE: Remove deleted records from local DB
    if (deletedRestaurants.length > 0) {
      const deletedIds = deletedRestaurants.map((r: any) => r.id);
      const deleteStartTime = Date.now();

      for (const id of deletedIds) {
        const result = await db.runAsync(`DELETE FROM ${TABLES.RESTAURANTS} WHERE id = ?`, [id]);
      }
      const deleteDuration = Date.now() - deleteStartTime;
    }

    const activeCount = activeRestaurants.filter((r: any) => r.is_active !== false).length;
    const inactiveCount = activeRestaurants.length - activeCount;

    // Convert images to base64 for offline storage
    const imageBase64Map = new Map<string, { image?: string; logo?: string; cover?: string }>();
    const convertStartTime = Date.now();

    for (const restaurant of remoteRestaurants) {
      const base64Data: { image?: string; logo?: string; cover?: string } = {};

      // Convert main image
      if (restaurant.image_url && restaurant.image_url.startsWith('http')) {
        try {
          base64Data.image = await imageUrlToBase64(restaurant.image_url);
        } catch (err) {
          // console.warn(`⚠️ Failed to convert image for ${restaurant.name}:`, err);
        }
      }

      // Convert logo
      if (restaurant.logo_url && restaurant.logo_url.startsWith('http')) {
        try {
          base64Data.logo = await imageUrlToBase64(restaurant.logo_url);
        } catch (err) {
          // console.warn(`⚠️ Failed to convert logo for ${restaurant.name}:`, err);
        }
      }

      // Convert cover image
      if (restaurant.cover_image_url && restaurant.cover_image_url.startsWith('http')) {
        try {
          base64Data.cover = await imageUrlToBase64(restaurant.cover_image_url);
        } catch (err) {
          // console.warn(`⚠️ Failed to convert cover image for ${restaurant.name}:`, err);
        }
      }

      imageBase64Map.set(restaurant.id, base64Data);
    }
    const convertDuration = Date.now() - convertStartTime;

    const insertStartTime = Date.now();
    await db.withTransactionAsync(async () => {
      let insertCount = 0;
      for (const restaurant of remoteRestaurants) {
        const base64Data = imageBase64Map.get(restaurant.id) || {};

        // Build dynamic INSERT based on actual schema columns (45 columns)
        // This matches the web implementation exactly
        await db.runAsync(
          `INSERT OR REPLACE INTO ${TABLES.RESTAURANTS}
           (id, owner_id, name, description, image_url, image_base64, logo_url, logo_base64,
            cover_image_url, cover_image_base64, address, phone, contact_phone, email,
            contact_email, cuisine_type, rating, average_rating, total_reviews, delivery_fee,
            min_order_amount, minimum_order_value, estimated_delivery_time, estimated_preparation_time,
            is_active, is_available, latitude, longitude, coordinates_geocoded, opening_time,
            closing_time, website_url, delivery_radius, social_media_links, payment_methods,
            dietary_options, special_offers, seating_capacity, parking_availability,
            peak_hours_start, peak_hours_end, created_at, updated_at, last_updated, deleted_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            restaurant.id,
            restaurant.owner_id,
            restaurant.name,
            restaurant.description || null,
            restaurant.image_url || null,
            base64Data.image || null,
            restaurant.logo_url || null,
            base64Data.logo || null,
            restaurant.cover_image_url || null,
            base64Data.cover || null,
            restaurant.address || null,
            restaurant.phone || null,
            restaurant.contact_phone || null,
            restaurant.email || null,
            restaurant.contact_email || null,
            restaurant.cuisine_type || null,
            restaurant.rating || 0,
            restaurant.average_rating || 0,
            restaurant.total_reviews || 0,
            restaurant.delivery_fee || 0,
            restaurant.min_order_amount || 0,
            restaurant.minimum_order_value || 0,
            restaurant.estimated_delivery_time || null,
            restaurant.estimated_preparation_time || null,
            restaurant.is_active !== false ? 1 : 0,
            restaurant.is_available !== false ? 1 : 0,
            restaurant.latitude || null,
            restaurant.longitude || null,
            restaurant.coordinates_geocoded || 0,
            restaurant.opening_time || null,
            restaurant.closing_time || null,
            restaurant.website_url || null,
            restaurant.delivery_radius || null,
            typeof restaurant.social_media_links === 'object' ? JSON.stringify(restaurant.social_media_links) : null,
            typeof restaurant.payment_methods === 'object' ? JSON.stringify(restaurant.payment_methods) : null,
            typeof restaurant.dietary_options === 'object' ? JSON.stringify(restaurant.dietary_options) : null,
            typeof restaurant.special_offers === 'object' ? JSON.stringify(restaurant.special_offers) : null,
            restaurant.seating_capacity || null,
            restaurant.parking_availability ? 1 : 0,
            restaurant.peak_hours_start || null,
            restaurant.peak_hours_end || null,
            restaurant.created_at || new Date().toISOString(),
            restaurant.updated_at || new Date().toISOString(),
            restaurant.last_updated || restaurant.updated_at || new Date().toISOString(),
            restaurant.deleted_at || null
          ]
        );
        insertCount++;
      }
    });
    const insertDuration = Date.now() - insertStartTime;
  }

  await updateSyncTimestamp(db, TABLES.RESTAURANTS);
};

// Sync menu categories table - INCREMENTAL version with BASE64 IMAGE STORAGE
const syncMenuCategoriesIncremental = async (db: SQLite.SQLiteDatabase) => {

  const lastSync = await getLastSyncTimestamp(db, TABLES.MENU_CATEGORIES);

  // PULL: Download changed OR deleted categories from Supabase since last sync
  const fetchStartTime = Date.now();
  const { data: remoteCategories, error: fetchError } = await supabaseClient
    .from(TABLES.MENU_CATEGORIES)
    .select('*')
    .or(`deleted_at.not.is.null,updated_at.gte.${lastSync}`) // Fetch changed OR deleted records
    .order('updated_at', { ascending: false });
  const fetchDuration = Date.now() - fetchStartTime;

  if (fetchError) {
    // console.error('❌ Error fetching menu categories from Supabase:', fetchError);
    // console.error('[UserApp-Sync] Error details:', JSON.stringify(fetchError, null, 2));
  } else if (remoteCategories && remoteCategories.length > 0) {

    // Separate active and deleted records
    const activeCategories = remoteCategories.filter((c: any) => !c.deleted_at);
    const deletedCategories = remoteCategories.filter((c: any) => c.deleted_at);


    // DELETE: Remove deleted records from local DB
    if (deletedCategories.length > 0) {
      const deletedIds = deletedCategories.map((c: any) => c.id);
      const deleteStartTime = Date.now();

      for (const id of deletedIds) {
        const result = await db.runAsync(`DELETE FROM ${TABLES.MENU_CATEGORIES} WHERE id = ?`, [id]);
      }
      const deleteDuration = Date.now() - deleteStartTime;
    }

    // Convert images to base64
    const imageBase64Map = new Map<string, string>();
    const convertStartTime = Date.now();

    for (const category of activeCategories) {
      if (category.image_url && category.image_url.startsWith('http')) {
        try {
          const base64 = await imageUrlToBase64(category.image_url);
          imageBase64Map.set(category.id, base64);
        } catch (err) {
          // console.warn(`⚠️ Failed to convert image for ${category.name}:`, err);
        }
      }
    }
    const convertDuration = Date.now() - convertStartTime;

    // Insert all categories
    const insertStartTime = Date.now();
    await db.withTransactionAsync(async () => {
      let insertCount = 0;
      for (const category of activeCategories) {
        await db.runAsync(
          `INSERT OR REPLACE INTO ${TABLES.MENU_CATEGORIES}
           (id, restaurant_id, name, description, image_url, image_base64, sort_order, is_active, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            category.id, category.restaurant_id, category.name, category.description,
            category.image_url, imageBase64Map.get(category.id) || null,
            category.sort_order, category.is_active,
            category.created_at, category.updated_at
          ]
        );
        insertCount++;
      }
    });
    const insertDuration = Date.now() - insertStartTime;
  }

  await updateSyncTimestamp(db, TABLES.MENU_CATEGORIES);
};

// Sync menu items table - INCREMENTAL version with BASE64 IMAGE STORAGE
const syncMenuItemsIncremental = async (db: SQLite.SQLiteDatabase) => {

  const lastSync = await getLastSyncTimestamp(db, TABLES.MENU_ITEMS);

  // PULL: Download changed OR deleted menu items from Supabase since last sync
  const fetchStartTime = Date.now();
  const { data: remoteMenuItems, error: fetchError } = await supabaseClient
    .from(TABLES.MENU_ITEMS)
    .select('*')
    .or(`deleted_at.not.is.null,updated_at.gte.${lastSync}`) // Fetch changed OR deleted records
    .order('updated_at', { ascending: false });
  const fetchDuration = Date.now() - fetchStartTime;

  if (fetchError) {
    // console.error('❌ Error fetching menu items from Supabase:', fetchError);
    // console.error('[UserApp-Sync] Error details:', JSON.stringify(fetchError, null, 2));
  } else if (remoteMenuItems && remoteMenuItems.length > 0) {

    // Separate active and deleted records
    const activeMenuItems = remoteMenuItems.filter((item: any) => !item.deleted_at);
    const deletedMenuItems = remoteMenuItems.filter((item: any) => item.deleted_at);


    // DELETE: Remove deleted records from local DB
    if (deletedMenuItems.length > 0) {
      const deletedIds = deletedMenuItems.map((item: any) => item.id);
      const deleteStartTime = Date.now();

      for (const id of deletedIds) {
        const result = await db.runAsync(`DELETE FROM ${TABLES.MENU_ITEMS} WHERE id = ?`, [id]);
      }
      const deleteDuration = Date.now() - deleteStartTime;
    }

    // Convert images to base64
    const imageBase64Map = new Map<string, string>();
    const convertStartTime = Date.now();

    for (const item of activeMenuItems) {
      if (item.image_url && item.image_url.startsWith('http')) {
        try {
          const base64 = await imageUrlToBase64(item.image_url);
          imageBase64Map.set(item.id, base64);
        } catch (err) {
          // console.warn(`⚠️ Failed to convert image for ${item.name}:`, err);
        }
      }
    }
    const convertDuration = Date.now() - convertStartTime;

    // Insert all menu items
    const insertStartTime = Date.now();
    await db.withTransactionAsync(async () => {
      let insertCount = 0;
      for (const item of activeMenuItems) {
        await db.runAsync(
          `INSERT OR REPLACE INTO ${TABLES.MENU_ITEMS}
           (id, restaurant_id, menu_category_id, name, description, price, image_url, image_base64,
            is_available, preparation_time, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            item.id, item.restaurant_id, item.menu_category_id, item.name,
            item.description, item.price, item.image_url, imageBase64Map.get(item.id) || null,
            item.is_available, item.preparation_time, item.created_at, item.updated_at
          ]
        );
        insertCount++;
      }
    });
    const insertDuration = Date.now() - insertStartTime;
  }

  await updateSyncTimestamp(db, TABLES.MENU_ITEMS);
};
