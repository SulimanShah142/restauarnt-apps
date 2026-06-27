// Simple Sync Utilities - Supabase sync for IndexedDB/SQLite
import { createClient } from '@supabase/supabase-js';
import * as Network from 'expo-network';

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL || '';
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || '';
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

/**
 * Check if device is online
 */
export async function isOnline() {
  try {
    const networkState = await Network.getNetworkStateAsync();
    return networkState.isConnected === true;
  } catch (error) {
    // console.log('isOnline: Error checking network:', error);
    return false;
  }
}

/**
 * Fetch restaurants from Supabase
 */
export async function fetchRestaurantsFromSupabase() {
  try {
    const { data, error } = await supabase
      .from('restaurants')
      .select('*')
      .eq('is_active', true)
      .eq('is_available', true);

    if (error) throw error;
    return data || [];
  } catch (error) {
    // console.error('fetchRestaurantsFromSupabase: Error:', error);
    return [];
  }
}

/**
 * Fetch menu items from Supabase
 */
export async function fetchMenuItemsFromSupabase() {
  try {
    const { data, error } = await supabase
      .from('menu_items')
      .select('*')
      .eq('is_available', true);

    if (error) throw error;
    return data || [];
  } catch (error) {
    // console.error('fetchMenuItemsFromSupabase: Error:', error);
    return [];
  }
}

/**
 * Fetch menu categories from Supabase
 */
export async function fetchMenuCategoriesFromSupabase() {
  try {
    const { data, error } = await supabase
      .from('menu_categories')
      .select('*')
      .eq('is_active', true);

    if (error) throw error;
    return data || [];
  } catch (error) {
    // console.error('fetchMenuCategoriesFromSupabase: Error:', error);
    return [];
  }
}

/**
 * Sync data from Supabase to local database
 * @param {Object} db - Database interface with put methods
 */
export async function syncFromSupabase(db) {
  try {
    // console.log('syncFromSupabase: Starting sync...');

    // Fetch and sync restaurants
    const restaurants = await fetchRestaurantsFromSupabase();
    for (const r of restaurants) {
      await db.putRecord('restaurants', r);
    }
    // console.log(`syncFromSupabase: Synced ${restaurants.length} restaurants`);

    // Fetch and sync menu items
    const menuItems = await fetchMenuItemsFromSupabase();
    for (const item of menuItems) {
      await db.putRecord('menu_items', item);
    }
    // console.log(`syncFromSupabase: Synced ${menuItems.length} menu items`);

    // Fetch and sync menu categories
    const categories = await fetchMenuCategoriesFromSupabase();
    for (const cat of categories) {
      await db.putRecord('menu_categories', cat);
    }
    // console.log(`syncFromSupabase: Synced ${categories.length} menu categories`);

    // console.log('syncFromSupabase: Sync completed successfully');
    return true;
  } catch (error) {
    // console.error('syncFromSupabase: Error:', error);
    return false;
  }
}

/**
 * Smart sync - syncs if online, otherwise uses cached data
 */
export async function smartSync(db) {
  const online = await isOnline();
  
  if (online) {
    // console.log('smartSync: Device online, syncing from Supabase...');
    return await syncFromSupabase(db);
  } else {
    // console.log('smartSync: Device offline, using cached data');
    return false;
  }
}
