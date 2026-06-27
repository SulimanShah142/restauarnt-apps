// Enhanced Sync Service - Complete sync for ALL data types
// Syncs: restaurants, menu items, menu categories, orders, user profiles, cart items, addresses, feedback

import { createClient } from '@supabase/supabase-js';
import * as Network from 'expo-network';
import * as SQLite from 'expo-sqlite';
import { TABLES } from '../db/schema';
import { imageUrlToBase64 } from '../utils/image-base64-utils';

// Get environment variables
const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL || '';
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || '';

// Initialize Supabase client
const supabaseClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Sync state management
export interface SyncState {
  isOnline: boolean;
  isSyncing: boolean;
  lastSyncTime: Date | null;
  syncProgress: number;
  syncMessage: string;
  addedRestaurants: number;
  deletedRestaurants: number;
  addedMenuItems: number;
  deletedMenuItems: number;
  addedMenuCategories: number;
  addedOrders: number;
  updatedOrders: number;
  addedFeedback: number;
  addedAddresses: number;
}

export interface SyncStatus {
  type: 'success' | 'error' | 'info' | 'warning';
  message: string;
  timestamp: Date;
}

// Singleton sync state
let syncState: SyncState = {
  isOnline: true,
  isSyncing: false,
  lastSyncTime: null,
  syncProgress: 0,
  syncMessage: '',
  addedRestaurants: 0,
  deletedRestaurants: 0,
  addedMenuItems: 0,
  deletedMenuItems: 0,
  addedMenuCategories: 0,
  addedOrders: 0,
  updatedOrders: 0,
  addedFeedback: 0,
  addedAddresses: 0,
};

// Sync status listeners
type SyncListener = (state: SyncState, status?: SyncStatus) => void;
const syncListeners = new Set<SyncListener>();

/**
 * Subscribe to sync state changes
 */
export const subscribeToSync = (listener: SyncListener): (() => void) => {
  syncListeners.add(listener);
  return () => syncListeners.delete(listener);
};

/**
 * Notify all listeners of sync state changes
 */
const notifyListeners = (status?: SyncStatus) => {
  syncListeners.forEach(listener => listener(syncState, status));
};

/**
 * Update sync state
 */
const updateSyncState = (updates: Partial<SyncState>, status?: SyncStatus) => {
  syncState = { ...syncState, ...updates };
  notifyListeners(status);
};

/**
 * Get current sync state
 */
export const getSyncState = (): SyncState => ({ ...syncState });

/**
 * Check if device is online
 */
export async function checkOnlineStatus(): Promise<boolean> {
  try {
    const networkState = await Network.getNetworkStateAsync();
    const isConnected = networkState.isConnected === true;

    if (isConnected !== syncState.isOnline) {
      updateSyncState({ isOnline: isConnected }, {
        type: isConnected ? 'success' : 'warning',
        message: isConnected ? 'Back online' : 'No internet connection - Using offline mode',
        timestamp: new Date(),
      });
    }

    return isConnected;
  } catch (error) {
    // console.error('[SyncService] Error checking network status:', error);
    return false;
  }
}

/**
 * COMPLETE RESET SYNC - Clears ALL local data first, then fetches from Supabase
 */
export async function performBackgroundSync(db: SQLite.SQLiteDatabase, userId?: string) {

  // Check online status first
  const isOnline = await checkOnlineStatus();

  if (!isOnline) {
    updateSyncState({ isSyncing: false }, {
      type: 'warning',
      message: 'No internet connection - Using cached data',
      timestamp: new Date(),
    });
    return false;
  }

  updateSyncState({
    isSyncing: true,
    syncProgress: 0,
    syncMessage: 'Clearing local data...',
  });

  try {
    // STEP 1: CLEAR ALL LOCAL DATA FIRST
    
    await db.runAsync(`DELETE FROM ${TABLES.RESTAURANTS}`, []);
    
    await db.runAsync(`DELETE FROM ${TABLES.MENU_CATEGORIES}`, []);
    
    await db.runAsync(`DELETE FROM ${TABLES.MENU_ITEMS}`, []);
    
    await db.runAsync(`DELETE FROM ${TABLES.ORDERS}`, []);
    
    await db.runAsync(`DELETE FROM ${TABLES.ORDER_ITEMS}`, []);
    
    await db.runAsync(`DELETE FROM ${TABLES.ADDRESSES}`, []);
    
    await db.runAsync(`DELETE FROM ${TABLES.FEEDBACK}`, []);
    

    updateSyncState({ syncProgress: 10, syncMessage: 'Fetching from Supabase...' });

    // STEP 2: FETCH ALL FROM SUPABASE (Sequential to ensure data integrity)
    await syncRestaurantsCompleteReset(db);
    updateSyncState({ syncProgress: 30, syncMessage: 'Restaurants synced' });

    await syncMenuCategoriesCompleteReset(db);
    updateSyncState({ syncProgress: 50, syncMessage: 'Categories synced' });

    await syncMenuItemsCompleteReset(db);
    updateSyncState({ syncProgress: 70, syncMessage: 'Menu items synced' });

    await syncOrdersForUser(db, userId);
    updateSyncState({ syncProgress: 80, syncMessage: 'Orders synced' });

    await syncUserAddresses(db, userId);
    updateSyncState({ syncProgress: 90, syncMessage: 'Addresses synced' });

    await syncUserFeedback(db, userId);
    updateSyncState({ syncProgress: 95, syncMessage: 'Finalizing...' });

    updateSyncState({ syncProgress: 100, syncMessage: 'Sync complete' });

    const status: SyncStatus = {
      type: 'success',
      message: 'Sync complete - All data refreshed from Supabase',
      timestamp: new Date(),
    };

    updateSyncState({
      isSyncing: false,
      lastSyncTime: new Date(),
      syncMessage: 'Sync completed'
    }, status);

    return true;
  } catch (error) {
    // console.error('[SyncService] ❌ COMPLETE RESET SYNC failed:', error);
    updateSyncState({ isSyncing: false }, {
      type: 'error',
      message: 'Sync failed - Using cached data',
      timestamp: new Date(),
    });
    return false;
  }
}

/**
 * Sync restaurants - COMPLETE RESET version
 */
const syncRestaurantsCompleteReset = async (db: SQLite.SQLiteDatabase) => {

  const { data: remoteRestaurants, error: fetchError } = await supabaseClient
    .from(TABLES.RESTAURANTS)
    .select('*')
    .is('deleted_at', null)
    .order('updated_at', { ascending: false });

  if (fetchError) {
    // console.error('[SyncService] ❌ Error fetching restaurants:', fetchError);
    return;
  }

  const activeRestaurants = remoteRestaurants || [];

  // Convert images to base64 for offline storage
  const imageBase64Map = new Map<string, { image?: string; logo?: string; cover?: string }>();

  for (const restaurant of activeRestaurants) {
    const base64Data: any = {};

    if (restaurant.image_url && restaurant.image_url.startsWith('http')) {
      try {
        base64Data.image = await imageUrlToBase64(restaurant.image_url);
      } catch (err) {
        // console.warn(`[SyncService] ⚠️ Failed to convert image for ${restaurant.name}`);
      }
    }

    if (restaurant.logo_url && restaurant.logo_url.startsWith('http')) {
      try {
        base64Data.logo = await imageUrlToBase64(restaurant.logo_url);
      } catch (err) {
        // console.warn(`[SyncService] ⚠️ Failed to convert logo for ${restaurant.name}`);
      }
    }

    if (restaurant.cover_image_url && restaurant.cover_image_url.startsWith('http')) {
      try {
        base64Data.cover = await imageUrlToBase64(restaurant.cover_image_url);
      } catch (err) {
        // console.warn(`[SyncService] ⚠️ Failed to convert cover for ${restaurant.name}`);
      }
    }

    imageBase64Map.set(restaurant.id, base64Data);
  }

  // Insert all restaurants (45 columns)
  await db.withTransactionAsync(async () => {
    for (const restaurant of activeRestaurants) {
      const base64Data = imageBase64Map.get(restaurant.id) || {};

      await db.runAsync(
        `INSERT OR REPLACE INTO ${TABLES.RESTAURANTS}
         (id, owner_id, name, description, image_url, image_base64, logo_url, logo_base64,
          cover_image_url, cover_image_base64,
          address, phone, contact_phone, email, contact_email, cuisine_type,
          rating, average_rating, total_reviews, delivery_fee, min_order_amount, minimum_order_value,
          estimated_delivery_time, estimated_preparation_time, is_active, is_available, latitude, longitude,
          coordinates_geocoded, opening_time, closing_time, website_url, delivery_radius,
          social_media_links, payment_methods, dietary_options, special_offers,
          seating_capacity, parking_availability, peak_hours_start, peak_hours_end,
          created_at, updated_at, last_updated, deleted_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          restaurant.id, restaurant.owner_id, restaurant.name, restaurant.description,
          restaurant.image_url, base64Data.image || null,
          restaurant.logo_url, base64Data.logo || null,
          restaurant.cover_image_url, base64Data.cover || null,
          restaurant.address, restaurant.phone, restaurant.contact_phone,
          restaurant.email, restaurant.contact_email, restaurant.cuisine_type,
          restaurant.rating, restaurant.average_rating || 0, restaurant.total_reviews || 0,
          restaurant.delivery_fee, restaurant.min_order_amount, restaurant.minimum_order_value || 0,
          restaurant.estimated_delivery_time, restaurant.estimated_preparation_time || null,
          restaurant.is_active, restaurant.is_available, restaurant.latitude, restaurant.longitude,
          restaurant.coordinates_geocoded || 0, restaurant.opening_time, restaurant.closing_time,
          restaurant.website_url, restaurant.delivery_radius,
          restaurant.social_media_links ? JSON.stringify(restaurant.social_media_links) : null,
          restaurant.payment_methods ? JSON.stringify(restaurant.payment_methods) : null,
          restaurant.dietary_options ? JSON.stringify(restaurant.dietary_options) : null,
          restaurant.special_offers ? JSON.stringify(restaurant.special_offers) : null,
          restaurant.seating_capacity || null,
          restaurant.parking_availability ? 1 : 0,
          restaurant.peak_hours_start || null,
          restaurant.peak_hours_end || null,
          restaurant.created_at, restaurant.updated_at, restaurant.last_updated || restaurant.updated_at,
          restaurant.deleted_at || null
        ]
      );
    }
  });

  updateSyncState({ addedRestaurants: activeRestaurants.length });
};

/**
 * Sync menu items - COMPLETE RESET version
 */
const syncMenuItemsCompleteReset = async (db: SQLite.SQLiteDatabase) => {

  const { data: remoteMenuItems, error: fetchError } = await supabaseClient
    .from(TABLES.MENU_ITEMS)
    .select('*')
    .is('deleted_at', null)
    .order('updated_at', { ascending: false });

  if (fetchError) {
    // console.error('[SyncService] ❌ Error fetching menu items:', fetchError);
    return;
  }

  const activeMenuItems = remoteMenuItems || [];

  // Convert images to base64
  const imageBase64Map = new Map<string, string>();
  for (const item of activeMenuItems) {
    if (item.image_url && item.image_url.startsWith('http')) {
      try {
        const base64 = await imageUrlToBase64(item.image_url);
        imageBase64Map.set(item.id, base64);
      } catch (err) {
        // console.warn(`[SyncService] ⚠️ Failed to convert image for ${item.name}`);
      }
    }
  }

  // Insert all menu items
  await db.withTransactionAsync(async () => {
    for (const item of activeMenuItems) {
      await db.runAsync(
        `INSERT OR REPLACE INTO ${TABLES.MENU_ITEMS}
         (id, restaurant_id, menu_category_id, name, description, price, image_url, image_base64,
          is_available, preparation_time, dietary_restrictions, created_at, updated_at, deleted_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          item.id, item.restaurant_id, item.menu_category_id, item.name,
          item.description, item.price, item.image_url, imageBase64Map.get(item.id) || null,
          item.is_available, item.preparation_time || null, 
          item.dietary_restrictions ? JSON.stringify(item.dietary_restrictions) : null,
          item.created_at, item.updated_at, item.deleted_at || null
        ]
      );
    }
  });

  updateSyncState({ addedMenuItems: activeMenuItems.length });
};

/**
 * Sync menu categories - COMPLETE RESET version with base64 images
 */
const syncMenuCategoriesCompleteReset = async (db: SQLite.SQLiteDatabase) => {

  const { data: remoteCategories, error } = await supabaseClient
    .from(TABLES.MENU_CATEGORIES)
    .select('*')
    .is('deleted_at', null)
    .order('updated_at', { ascending: false });

  if (error) {
    // console.error('[SyncService] ❌ Error fetching menu categories:', error);
    return;
  }

  const activeCategories = remoteCategories || [];

  // Convert images to base64 for offline storage
  const imageBase64Map = new Map<string, string>();
  for (const cat of activeCategories) {
    if (cat.image_url && cat.image_url.startsWith('http')) {
      try {
        const base64 = await imageUrlToBase64(cat.image_url);
        imageBase64Map.set(cat.id, base64);
      } catch (err) {
        // console.warn(`⚠️ Failed to convert image for ${cat.name}:`, err);
      }
    }
  }

  // Insert all categories
  await db.withTransactionAsync(async () => {
    for (const cat of activeCategories) {
      await db.runAsync(
        `INSERT OR REPLACE INTO ${TABLES.MENU_CATEGORIES}
         (id, restaurant_id, name, description, image_url, image_base64, sort_order, is_active, created_at, updated_at, deleted_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          cat.id, cat.restaurant_id, cat.name, cat.description,
          cat.image_url, imageBase64Map.get(cat.id) || null, cat.sort_order || 0, cat.is_active || 1,
          cat.created_at, cat.updated_at, cat.deleted_at || null
        ]
      );
    }
  });

  updateSyncState({ addedMenuCategories: activeCategories.length });
};

/**
 * Sync user orders
 */
const syncOrdersForUser = async (db: SQLite.SQLiteDatabase, userId?: string) => {
  if (!userId) {
    return;
  }


  // Fetch user's orders from Supabase with order items
  const { data: remoteOrders, error: fetchError } = await supabaseClient
    .from(TABLES.ORDERS)
    .select(`
      *,
      order_items (
        id,
        menu_item_id,
        quantity,
        price,
        menu_items(name, image_url)
      )
    `)
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  if (fetchError) {
    // console.error('[SyncService] ❌ Error fetching orders:', fetchError);
    return;
  }

  if (!remoteOrders || remoteOrders.length === 0) {
    return;
  }

  let addedCount = 0;

  // Insert/update orders
  await db.withTransactionAsync(async () => {
    for (const order of remoteOrders) {
      addedCount++;

      await db.runAsync(
        `INSERT OR REPLACE INTO ${TABLES.ORDERS}
         (id, user_id, restaurant_id, subtotal, delivery_cost, total_amount,
          delivery_address, delivery_notes, delivery_lat, delivery_lng,
          restaurant_name, payment_method, payment_status, status,
          estimated_delivery_time, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          order.id, order.user_id, order.restaurant_id,
          order.subtotal, order.delivery_cost, order.total_amount,
          order.delivery_address, order.delivery_notes, order.delivery_lat, order.delivery_lng,
          order.restaurant_name, order.payment_method, order.payment_status, order.status,
          order.estimated_delivery_time, order.created_at, order.updated_at
        ]
      );

      // Sync order items
      if (order.order_items) {
        for (const item of order.order_items) {
          await db.runAsync(
            `INSERT OR REPLACE INTO ${TABLES.ORDER_ITEMS}
             (id, order_id, menu_item_id, quantity, price, menu_item_name, menu_item_image_url, created_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            [
              item.id, order.id, item.menu_item_id, item.quantity, item.price,
              item.menu_items?.name || null,
              item.menu_items?.image_url || null,
              item.created_at
            ]
          );
        }
      }
    }
  });

  updateSyncState({ addedOrders: addedCount });
};

/**
 * Sync user addresses
 */
const syncUserAddresses = async (db: SQLite.SQLiteDatabase, userId?: string) => {
  if (!userId) {
    return;
  }


  // Fetch user's addresses from Supabase
  const { data: remoteAddresses, error: fetchError } = await supabaseClient
    .from('addresses')
    .select('*')
    .eq('user_id', userId)
    .is('deleted_at', null);

  if (fetchError) {
    // console.error('[SyncService] ❌ Error fetching addresses:', fetchError);
    return;
  }

  if (!remoteAddresses || remoteAddresses.length === 0) {
    return;
  }

  // Insert/update addresses
  await db.withTransactionAsync(async () => {
    for (const address of remoteAddresses) {
      await db.runAsync(
        `INSERT OR REPLACE INTO ${TABLES.ADDRESSES}
         (id, user_id, label, address_line1, address_line2, city, state, zip_code, country,
          latitude, longitude, is_default, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          address.id, address.user_id, address.label, address.address_line1,
          address.address_line2, address.city, address.state, address.zip_code, address.country,
          address.latitude, address.longitude, address.is_default,
          address.created_at, address.updated_at
        ]
      );
    }
  });

  updateSyncState({ addedAddresses: remoteAddresses.length });
};

/**
 * Sync user feedback
 */
const syncUserFeedback = async (db: SQLite.SQLiteDatabase, userId?: string) => {
  if (!userId) {
    return;
  }


  // Fetch user's feedback from Supabase
  const { data: remoteFeedback, error: fetchError } = await supabaseClient
    .from(TABLES.FEEDBACK)
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  if (fetchError) {
    // console.error('[SyncService] ❌ Error fetching feedback:', fetchError);
    return;
  }

  if (!remoteFeedback || remoteFeedback.length === 0) {
    return;
  }

  let addedCount = 0;

  // Insert/update feedback
  await db.withTransactionAsync(async () => {
    for (const feedback of remoteFeedback) {
      addedCount++;

      await db.runAsync(
        `INSERT OR REPLACE INTO ${TABLES.FEEDBACK}
         (id, user_id, title, comment, rating, is_resolved, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          feedback.id, feedback.user_id, feedback.title, feedback.comment,
          feedback.rating, feedback.is_resolved, feedback.created_at, feedback.updated_at
        ]
      );
    }
  });

  updateSyncState({ addedFeedback: addedCount });
};

/**
 * Smart sync - loads from cache immediately, then syncs in background
 */
export async function smartSync(db: SQLite.SQLiteDatabase, userId?: string) {

  // Step 1: Load from cache immediately (for instant UI)
  const cachedData = await loadFromCache(db);

  // Step 2: Sync in background (non-blocking)
  performBackgroundSync(db, userId).catch(err => {
    // console.error('[SyncService] Background sync failed:', err);
  });

  // Return cached data immediately
  return cachedData;
}

/**
 * Load all data from local cache immediately
 */
export async function loadFromCache(db: SQLite.SQLiteDatabase) {

  try {
    const [restaurants, menuItems, menuCategories, orders, feedback] = await Promise.all([
      db.getAllAsync(`SELECT * FROM ${TABLES.RESTAURANTS} WHERE is_active = 1 AND is_available = 1 ORDER BY name`),
      db.getAllAsync(`SELECT * FROM ${TABLES.MENU_ITEMS} WHERE is_available = 1`),
      db.getAllAsync(`SELECT * FROM ${TABLES.MENU_CATEGORIES} WHERE is_active = 1`),
      db.getAllAsync(`SELECT * FROM ${TABLES.ORDERS} ORDER BY created_at DESC`),
      db.getAllAsync(`SELECT * FROM ${TABLES.FEEDBACK} ORDER BY created_at DESC`),
    ]);


    return {
      restaurants: restaurants as any[],
      menuItems: menuItems as any[],
      menuCategories: menuCategories as any[],
      orders: orders as any[],
      feedback: feedback as any[],
    };
  } catch (error) {
    // console.error('[SyncService] ❌ Error loading from cache:', error);
    return {
      restaurants: [],
      menuItems: [],
      menuCategories: [],
      orders: [],
      feedback: [],
    };
  }
}
