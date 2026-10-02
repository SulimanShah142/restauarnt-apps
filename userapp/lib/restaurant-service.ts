// Restaurant Service - Supabase FIRST, then local database sync
// FRESH DATA FIRST: Always fetches from Supabase first, then saves to local DB

import { getDatabase } from '../db';
import * as Network from 'expo-network';
import { supabase as supabaseClient } from './supabase';

// Track sync state
let isSyncing = false;
const SYNC_COOLDOWN_MS = 2 * 60 * 1000; // 2 minutes cooldown
let lastSyncTime = 0;

export interface Restaurant {
  id: string;
  name: string;
  description: string;
  image_url: string;
  image_base64?: string;
  address?: string;
  phone?: string;
  email?: string;
  rating: number;
  delivery_time?: number;
  delivery_fee?: number;
  minimum_order?: number;
  estimated_delivery_time?: number;
  is_active: boolean;
  is_available: boolean;
  created_at: string;
  updated_at: string;
  latitude?: number;
  longitude?: number;
  owner_id?: string;
  opening_time?: string;
  closing_time?: string;
  cuisine_type?: string;
}

export interface FoodItem {
  id: string;
  name: string;
  description: string;
  price: number;
  image_url: string;
  image_base64?: string;
  restaurant_id: string;
  category?: string;
  is_available: boolean;
  preparation_time?: number;
  created_at: string;
  updated_at: string;
}

export interface Category {
  id: string;
  name: string;
  description: string;
  image_url: string;
  restaurant_id: string;
  created_at: string;
  updated_at: string;
}

/**
 * Check if device is online using Network API
 */
const checkOnlineStatus = async (): Promise<boolean> => {
  try {
    const networkState = await Network.getNetworkStateAsync();
    const isConnected = networkState.isConnected === true;
    return isConnected;
  } catch (error) {
    // console.warn('[RestaurantService] Error checking network:', error);
    return false;
  }
};

/**
 * Sync menu items and categories for multiple restaurants from Supabase
 */
const syncMenuDataForRestaurants = async (restaurantIds: string[]): Promise<void> => {
  try {

    for (const restaurantId of restaurantIds) {
      // Sync menu items
      const { data: menuItems, error: itemsError } = await supabaseClient
        .from('menu_items')
        .select('*')
        .eq('restaurant_id', restaurantId)
        .is('deleted_at', null);

      if (itemsError) {
        // console.error('[RestaurantService] Error fetching menu items for restaurant', restaurantId, ':', itemsError);
        continue;
      }

      if (menuItems && menuItems.length > 0) {
        const db = await getDatabase();
        
        // Clear existing items for this restaurant
        await db.runAsync?.('DELETE FROM menu_items WHERE restaurant_id = ?', [restaurantId]);
        
        // Insert fresh data
        for (const item of menuItems) {
          await db.runAsync?.(
            `INSERT INTO menu_items (id, name, description, price, image_url, image_base64, restaurant_id, category, is_available, preparation_time, created_at, updated_at) 
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
              item.id,
              item.name,
              item.description,
              item.price,
              item.image_url,
              item.image_base64 || null,
              item.restaurant_id,
              item.category || null,
              item.is_available ? 1 : 0,
              item.preparation_time || null,
              item.created_at,
              item.updated_at
            ]
          );
        }
      }

      // Sync menu categories
      const { data: categories, error: categoriesError } = await supabaseClient
        .from('menu_categories')
        .select('*')
        .eq('restaurant_id', restaurantId)
        .is('deleted_at', null);

      if (categoriesError) {
        // console.error('[RestaurantService] Error fetching categories for restaurant', restaurantId, ':', categoriesError);
        continue;
      }

      if (categories && categories.length > 0) {
        const db = await getDatabase();
        
        // Clear existing categories for this restaurant
        await db.runAsync?.('DELETE FROM menu_categories WHERE restaurant_id = ?', [restaurantId]);
        
        // Insert fresh data
        for (const category of categories) {
          await db.runAsync?.(
            `INSERT INTO menu_categories (id, name, description, image_url, restaurant_id, created_at, updated_at) 
             VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [
              category.id,
              category.name,
              category.description,
              category.image_url || null,
              category.restaurant_id,
              category.created_at,
              category.updated_at
            ]
          );
        }
      }
    }
  } catch (error) {
      // console.error('[RestaurantService] syncMenuDataForRestaurants: Error:', error);
  }
};

export const restaurantService = {
  // Get all restaurants - Fetches from Supabase FIRST when online, fallback to local DB when offline
  getAllRestaurants: async (options?: { forceSync?: boolean; userId?: string }): Promise<Restaurant[]> => {

    try {
      const db = await getDatabase();
      const online = await checkOnlineStatus();


      // STEP 1: If online, fetch from Supabase FIRST
      if (online) {

        const now = Date.now();
        // When forceSync is true, ALWAYS fetch regardless of cooldown or sync state
        const shouldFetch = options?.forceSync 
          ? true 
          : ((now - lastSyncTime > SYNC_COOLDOWN_MS) || !isSyncing);


        if (shouldFetch) {
          // If already syncing and not forceSync, fall back to cache
          if (isSyncing && !options?.forceSync) {
            console.log('[RestaurantService] 📱 Using local cache (sync in progress)');
            const restaurants = await db.getRestaurants();
            const activeRestaurants = restaurants.filter(r => r.is_active !== false && r.is_available !== false);
            console.log('[RestaurantService] 📦 Local cache has', activeRestaurants.length, 'restaurants');
            return activeRestaurants;
          }
          
          isSyncing = true;
          lastSyncTime = now;

          try {
            console.log('[RestaurantService] 🌐 Fetching from Supabase (forceSync:', options?.forceSync, ')');

            // Fetch ALL restaurants from Supabase
            const { data: restaurants, error } = await supabaseClient
              .from('restaurants')
              .select('*')
              .is('deleted_at', null)
              .eq('is_active', true)
              .eq('is_available', true)
              .order('updated_at', { ascending: false });

            if (error) {
              console.error('[RestaurantService] ❌ Supabase error:', error);
              throw error;
            }


            if (restaurants && restaurants.length > 0) {
              console.log('[RestaurantService] ✅ Fetched', restaurants.length, 'restaurants from Supabase');

              // Clear existing restaurants first (complete reset)
              await db.runAsync?.('DELETE FROM restaurants');

              // Insert fresh data
              let insertCount = 0;
              for (const restaurant of restaurants) {
                await db.runAsync?.(
                  `INSERT INTO restaurants (id, name, description, image_url, image_base64, is_active, is_available, created_at, updated_at, latitude, longitude, owner_id, opening_time, closing_time, cuisine_type, address, phone, email, rating, delivery_time, delivery_fee, minimum_order, estimated_delivery_time)
                   VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                  [
                    restaurant.id,
                    restaurant.name,
                    restaurant.description,
                    restaurant.image_url,
                    restaurant.image_base64 || null,
                    restaurant.is_active ? 1 : 0,
                    restaurant.is_available ? 1 : 0,
                    restaurant.created_at,
                    restaurant.updated_at,
                    restaurant.latitude || null,
                    restaurant.longitude || null,
                    restaurant.owner_id || null,
                    restaurant.opening_time || null,
                    restaurant.closing_time || null,
                    restaurant.cuisine_type || null,
                    restaurant.address || null,
                    restaurant.phone || null,
                    restaurant.email || null,
                    restaurant.rating || 0,
                    restaurant.delivery_time || null,
                    restaurant.delivery_fee || null,
                    restaurant.minimum_order || null,
                    restaurant.estimated_delivery_time || null
                  ]
                );
                insertCount++;
              }
              console.log('[RestaurantService] 💾 Saved', insertCount, 'restaurants to local DB');

              isSyncing = false;

              // Also sync menu items and categories for all restaurants
              await syncMenuDataForRestaurants(restaurants.map(r => r.id));


              // Return fresh data from Supabase
              return restaurants as Restaurant[];
            } else {
              console.log('[RestaurantService] ⚠️ Supabase returned 0 restaurants, falling back to local cache');
              isSyncing = false;
              // Fall through to local cache instead of returning empty
            }
          } catch (syncError) {
            console.error('[RestaurantService] ❌ Sync failed:', syncError);
            // console.error('[RestaurantService] Error details:', JSON.stringify(syncError, null, 2));
            isSyncing = false;
            console.log('[RestaurantService] ⚠️ Sync error, falling back to local cache');
            // Fall through to local cache
          }
        } else {
          console.log('[RestaurantService] 📱 Using local cache (cooldown or sync in progress)');
          // STEP 2: Fallback to local cache if offline or sync failed
          const restaurants = await db.getRestaurants();
          const activeRestaurants = restaurants.filter(r => r.is_active !== false && r.is_available !== false);
          console.log('[RestaurantService] 📦 Local cache has', activeRestaurants.length, 'restaurants');
          return activeRestaurants;
        }
      }

      // Fallback to local cache if offline
      console.log('[RestaurantService] 📴 Offline, using local cache');
      const restaurants = await db.getRestaurants();
      const activeRestaurants = restaurants.filter(r => r.is_active !== false && r.is_available !== false);
      console.log('[RestaurantService] 📦 Local cache has', activeRestaurants.length, 'restaurants');
      return activeRestaurants;
    } catch (error) {
      // console.error('[RestaurantService] getAllRestaurants: Error:', error);
      // console.error('[RestaurantService] Error details:', JSON.stringify(error, null, 2));
      return [];
    }
  },

  // Force sync - Fetch from Supabase and update local DB
  forceSync: async (): Promise<void> => {

    const db = await getDatabase();
    const online = await checkOnlineStatus();

    if (online) {
      try {
        // Fetch from Supabase
        const { data: restaurants, error } = await supabaseClient
          .from('restaurants')
          .select('*')
          .is('deleted_at', null)
          .eq('is_active', true);

        if (error) throw error;

        // Clear and save
        // if (db.clearAllData) {
        //   await db.clearAllData();
        // }

        // Save to local DB
        // for (const r of restaurants || []) {
        //   await db.runAsync?.(
        //     `INSERT OR REPLACE INTO restaurants (id, name, description, image_url, is_active, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)`,
        //     [r.id, r.name, r.description, r.image_url, r.is_active ? 1 : 0, r.created_at, r.updated_at]
        //   );
        // }

        // console.error('forceSync: ❌ Sync failed:', error);
        throw error;
      } catch (error) {
        // console.error('forceSync: ❌ Sync failed:', error);
        throw error;
      }
    } else {
      throw new Error('No internet connection');
    }
  },

  // Reset sync flag
  resetSyncFlag: (): void => {
    isSyncing = false;
    lastSyncTime = 0;
  },

  // Get restaurant by ID
  getRestaurantById: async (id: string): Promise<Restaurant | null> => {
    try {
      const db = await getDatabase();
      return await db.getRestaurantById(id);
    } catch (error) {
      // console.error('getRestaurantById: Error:', error);
      return null;
    }
  },

  // Get menu items by restaurant - Fetches from Supabase when online, fallback to local DB
  getMenuItemsByRestaurant: async (restaurantId: string): Promise<FoodItem[]> => {

    try {
      const db = await getDatabase();
      const online = await checkOnlineStatus();

      if (online) {
        
        try {
          const { data: menuItems, error } = await supabaseClient
            .from('menu_items')
            .select('*')
            .eq('restaurant_id', restaurantId)
            .is('deleted_at', null)
            .eq('is_available', true)
            .order('created_at', { ascending: false });

          if (error) {
            // console.error('[RestaurantService] ❌ Supabase error:', error);
            throw error;
          }

          if (menuItems && menuItems.length > 0) {

            // Clear existing items for this restaurant
            await db.runAsync?.('DELETE FROM menu_items WHERE restaurant_id = ?', [restaurantId]);

            // Insert fresh data
            for (const item of menuItems) {
              await db.runAsync?.(
                `INSERT INTO menu_items (id, name, description, price, image_url, image_base64, restaurant_id, category, is_available, preparation_time, created_at, updated_at) 
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [
                  item.id,
                  item.name,
                  item.description,
                  item.price,
                  item.image_url,
                  item.image_base64 || null,
                  item.restaurant_id,
                  item.category || null,
                  item.is_available ? 1 : 0,
                  item.preparation_time || null,
                  item.created_at,
                  item.updated_at
                ]
              );
            }

            return menuItems as FoodItem[];
          }
        } catch (syncError) {
          // console.error('[RestaurantService] ❌ Sync failed:', syncError);
          // Fall through to local cache
        }
      }

      // Fallback to local cache
      const result = await db.getMenuItemsByRestaurant(restaurantId);
      return result;
    } catch (error) {
      // console.error('[RestaurantService] getMenuItemsByRestaurant: Error:', error);
      return [];
    }
  },

  // Alias for getMenuItemsByRestaurant
  getFoodItemsByRestaurantId: async (restaurantId: string): Promise<FoodItem[]> => {
    return restaurantService.getMenuItemsByRestaurant(restaurantId);
  },

  // Get menu categories by restaurant - Fetches from Supabase when online, fallback to local DB
  getMenuCategoriesByRestaurant: async (restaurantId: string): Promise<Category[]> => {

    try {
      const db = await getDatabase();
      const online = await checkOnlineStatus();

      if (online) {
        
        try {
          const { data: categories, error } = await supabaseClient
            .from('menu_categories')
            .select('*')
            .eq('restaurant_id', restaurantId)
            .is('deleted_at', null)
            .order('created_at', { ascending: false });

          if (error) {
            // console.error('[RestaurantService] ❌ Supabase error:', error);
            throw error;
          }

          if (categories && categories.length > 0) {

            // Clear existing categories for this restaurant
            await db.runAsync?.('DELETE FROM menu_categories WHERE restaurant_id = ?', [restaurantId]);

            // Insert fresh data
            for (const category of categories) {
              await db.runAsync?.(
                `INSERT INTO menu_categories (id, name, description, image_url, restaurant_id, created_at, updated_at) 
                 VALUES (?, ?, ?, ?, ?, ?, ?)`,
                [
                  category.id,
                  category.name,
                  category.description,
                  category.image_url || null,
                  category.restaurant_id,
                  category.created_at,
                  category.updated_at
                ]
              );
            }

            return categories as Category[];
          }
        } catch (syncError) {
          // console.error('[RestaurantService] ❌ Sync failed:', syncError);
          // Fall through to local cache
        }
      }

      // Fallback to local cache
      const result = await db.getMenuCategoriesByRestaurant(restaurantId);
      return result;
    } catch (error) {
      // console.error('[RestaurantService] getMenuCategoriesByRestaurant: Error:', error);
      return [];
    }
  },

  // Alias for getMenuCategoriesByRestaurant
  getCategoriesByRestaurantId: async (restaurantId: string): Promise<Category[]> => {
    return restaurantService.getMenuCategoriesByRestaurant(restaurantId);
  },

  // Get restaurants by category
  getRestaurantsByCategory: async (category: string): Promise<Restaurant[]> => {
    try {
      const db = await getDatabase();
      return await db.getRestaurantsByCategory(category);
    } catch (error) {
      // console.error('getRestaurantsByCategory: Error:', error);
      return [];
    }
  }
};
