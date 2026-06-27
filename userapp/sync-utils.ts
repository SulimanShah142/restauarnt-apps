// Sync utilities for User App
// Platform-aware sync that uses Supabase for both web and mobile
// - Web: RxDB syncs directly with Supabase
// - Mobile: SQLite syncs with Supabase via sync-bridge

import { Platform } from 'react-native';
import { getDatabase } from './database';
import type { DatabaseInterface } from './db/types';

// Initialize Supabase client
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL || '';
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || '';
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

/**
 * Check if device is online
 */
export const isOnline = async (): Promise<boolean> => {
  try {
    const { error } = await supabase.from('restaurants').select('id').limit(1);
    return !error;
  } catch (err) {
    // console.warn('Network check failed:', err);
    return false;
  }
};

/**
 * Smart sync function that checks connectivity and syncs accordingly
 * - On web: Uses RxDB's built-in sync with Supabase
 * - On mobile: Uses manual sync via sync-bridge
 */
export const smartSync = async () => {
  const online = await isOnline();

  if (online) {

    const db = await getDatabase();
    if (db) {
      await db.syncWithSupabase();
    }
  } else {
    // console.log('[SyncUtils] ⚠️ Offline - sync skipped');
  }
};

/**
 * Sync restaurants from Supabase
 */
export const syncRestaurants = async () => {
  try {

    const { data, error } = await supabase
      .from('restaurants')
      .select('*')
      .eq('is_active', true);

    if (error) {
      // console.error('Error fetching restaurants from Supabase:', error);
      return;
    }

    if (!data) {
      return;
    }


    // On mobile, save to SQLite
    // On web, RxDB handles this automatically
    if (Platform.OS !== 'web') {
      const db = await getDatabase();
      if (db) {
        // The syncWithSupabase method handles this
        await db.syncWithSupabase();
      }
    }
  } catch (error) {
    // console.error('Error syncing restaurants:', error);
  }
};

/**
 * Sync menu categories from Supabase
 */
export const syncMenuCategories = async () => {
  try {

    const { data, error } = await supabase
      .from('menu_categories')
      .select('*')
      .eq('is_active', true);

    if (error) {
      // console.error('Error fetching menu categories from Supabase:', error);
      return;
    }

    if (!data) {
      return;
    }


    if (Platform.OS !== 'web') {
      const db = await getDatabase();
      if (db) {
        await db.syncWithSupabase();
      }
    }
  } catch (error) {
    // console.error('Error syncing menu categories:', error);
  }
};

/**
 * Sync menu items from Supabase
 */
export const syncMenuItems = async () => {
  try {

    const { data, error } = await supabase
      .from('menu_items')
      .select('*')
      .eq('is_available', true);

    if (error) {
      // console.error('Error fetching menu items from Supabase:', error);
      return;
    }

    if (!data) {
      return;
    }


    if (Platform.OS !== 'web') {
      const db = await getDatabase();
      if (db) {
        await db.syncWithSupabase();
      }
    }
  } catch (error) {
    // console.error('Error syncing menu items:', error);
  }
};

/**
 * Full sync from Supabase - syncs all data types
 */
export const fullSyncFromSupabase = async () => {

  try {
    const db = await getDatabase();
    if (db) {
      await db.syncWithSupabase();
    }
  } catch (error) {
    // console.error('Error during full sync:', error);
  }
};

/**
 * Get restaurants - platform aware
 * - Web: Fetches from RxDB (which syncs with Supabase)
 * - Mobile: Fetches from SQLite
 */
export const getRestaurants = async () => {
  const db = await getDatabase();
  if (!db) return [];
  return await db.getRestaurants();
};

/**
 * Get restaurant by ID - platform aware
 */
export const getRestaurantById = async (id: string) => {
  const db = await getDatabase();
  if (!db) return null;
  return await db.getRestaurantById(id);
};

/**
 * Get menu items by restaurant - platform aware
 */
export const getMenuItemsByRestaurant = async (restaurantId: string) => {
  const db = await getDatabase();
  if (!db) return [];
  return await db.getMenuItemsByRestaurant(restaurantId);
};
