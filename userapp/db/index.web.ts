// Web Database Implementation using raw IndexedDB for User App
// Complete sync for ALL data types: restaurants, menu items, menu categories, orders, addresses, feedback

import { DatabaseInterface } from './types';
import { TABLES, SQLITE_SCHEMA } from './schema';
import { imageUrlToBase64 } from '../utils/image-base64-utils';
import { supabase as supabaseClient } from '../lib/supabase';

// Type declarations for web globals
declare const window: any;
declare const IDBDatabase: any;
declare const IDBOpenDBRequest: any;
declare const indexedDB: any;
declare const navigator: any;

// IndexedDB database name and version
const DB_NAME = 'userapp_db';
const DB_VERSION = 1;

// Open/create IndexedDB database
const openDB = (): Promise<any> => {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => {
      // console.error('IndexedDB error:', request.error);
      reject(request.error);
    };

    request.onsuccess = () => {
      resolve(request.result);
    };

    request.onupgradeneeded = (event) => {
      const db = (event.target as any).result;

      const stores = [
        'users', 'profiles', 'restaurants', 'menu_categories', 'menu_items',
        'orders', 'order_items', 'carts', 'cart_items', 'addresses',
        'reviews', 'feedback', 'delivery_persons', 'delivery_assignments',
        'notifications', 'advertisements', 'app_settings', 'settings', 'payments', 'admins'
      ];

      for (const storeName of stores) {
        if (!db.objectStoreNames.contains(storeName)) {
          const store = db.createObjectStore(storeName, { keyPath: 'id' });
          store.createIndex('updated_at', 'updated_at', { unique: false });
          store.createIndex('created_at', 'created_at', { unique: false });

          if (storeName === 'restaurants') {
            store.createIndex('is_active', 'is_active', { unique: false });
            store.createIndex('owner_id', 'owner_id', { unique: false });
          } else if (storeName === 'menu_items') {
            store.createIndex('restaurant_id', 'restaurant_id', { unique: false });
            store.createIndex('menu_category_id', 'menu_category_id', { unique: false });
            store.createIndex('is_available', 'is_available', { unique: false });
          } else if (storeName === 'orders') {
            store.createIndex('user_id', 'user_id', { unique: false });
            store.createIndex('restaurant_id', 'restaurant_id', { unique: false });
            store.createIndex('status', 'status', { unique: false });
          } else if (storeName === 'cart_items') {
            store.createIndex('cart_id', 'cart_id', { unique: false });
          } else if (storeName === 'addresses') {
            store.createIndex('user_id', 'user_id', { unique: false });
          }
        }
      }

      if (!db.objectStoreNames.contains('sync_log')) {
        const syncLogStore = db.createObjectStore('sync_log', { keyPath: 'table_name' });
        syncLogStore.createIndex('sync_timestamp', 'sync_timestamp', { unique: false });
      }
    };
  });
};

// Helper: Get all records from a store
export const getAllFromStore = async <T>(db: any, storeName: string): Promise<T[]> => {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readonly');
    const store = tx.objectStore(storeName);
    const request = store.getAll();

    request.onsuccess = () => resolve(request.result as T[]);
    request.onerror = () => reject(request.error);
  });
};

// Helper: Get record by ID
export const getById = async <T>(db: any, storeName: string, id: string): Promise<T | null> => {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readonly');
    const store = tx.objectStore(storeName);
    const request = store.get(id);

    request.onsuccess = () => resolve(request.result as T || null);
    request.onerror = () => reject(request.error);
  });
};

// Helper: Insert or update record
export const putRecord = async (db: any, storeName: string, record: any): Promise<void> => {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readwrite');
    const store = tx.objectStore(storeName);
    const request = store.put(record);

    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
};

// Helper: Check if online using Network API
const checkOnline = async (): Promise<boolean> => {
  if (typeof navigator !== 'undefined' && navigator.onLine !== undefined) {
    return navigator.onLine;
  }
  return true;
};

// Helper: Clear all records from a store
export const clearStore = async (db: any, storeName: string): Promise<void> => {

  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readwrite');
    const store = tx.objectStore(storeName);
    const request = store.clear();

    request.onsuccess = () => {
      resolve();
    };
    request.onerror = () => {
      // console.error('[UserApp-DB] ❌ Error clearing store:', storeName, request.error);
      reject(request.error);
    };
  });
};

// Initialize database
let dbInstance: any | null = null;
let initPromise: Promise<any> | null = null;

export const ensureDbInitialized = async (): Promise<any> => {
  if (dbInstance) {
    return dbInstance;
  }

  if (initPromise) {
    return initPromise;
  }

  initPromise = openDB();
  dbInstance = await initPromise;
  return dbInstance;
};

export const getDatabase = async (): Promise<DatabaseInterface> => {
  const db = await ensureDbInitialized();

  return {
    // Restaurants operations
    getRestaurants: async () => {
      const all = await getAllFromStore(db, 'restaurants');

      const active = all.filter((r: any) => {
        const isActive = r.is_active !== false;
        return isActive;
      });

      return active;
    },

    getRestaurantById: async (id: string) => {
      return await getById(db, 'restaurants', id);
    },

    getRestaurantsByCategory: async (category: string) => {
      const all = await getAllFromStore(db, 'restaurants');
      return all.filter((r: any) => r.cuisine_type === category && r.is_active !== false);
    },

    // Menu operations
    getMenuItemsByRestaurant: async (restaurantId: string) => {
      const all = await getAllFromStore(db, 'menu_items');
      const filtered = all.filter((item: any) => {
        const matches = item.restaurant_id === restaurantId && item.is_available !== false;
        return matches;
      });
      return filtered;
    },

    getMenuCategoriesByRestaurant: async (restaurantId: string) => {
      const all = await getAllFromStore(db, 'menu_categories');
      const filtered = all.filter((cat: any) => {
        const matches = cat.restaurant_id === restaurantId && cat.is_active !== false;
        return matches;
      });
      return filtered;
    },

    getMenuItemById: async (id: string) => {
      return await getById(db, 'menu_items', id);
    },

    // User/profile operations
    getUserProfile: async (userId: string) => {
      return await getById(db, 'profiles', userId);
    },

    createUserProfile: async (profileData: any) => {
      await putRecord(db, 'profiles', profileData);
      return { id: profileData.id };
    },

    // Cart operations
    addToCart: async (cartItem: any) => {
      const id = `${cartItem.user_id}_${cartItem.menu_item_id}_${Date.now()}`;
      cartItem.id = id;
      await putRecord(db, 'cart_items', cartItem);
      return { id };
    },

    getUserCart: async (userId: string) => {
      const all = await getAllFromStore(db, 'cart_items');
      return all.filter((item: any) => item.user_id === userId);
    },

    removeFromCart: async (cartItemId: string) => {
      await deleteRecord(db, 'cart_items', cartItemId);
      return { id: cartItemId, deleted: true };
    },

    clearUserCart: async (userId: string) => {
      return { userId, cleared: true, count: 0 };
    },

    // Favorites operations
    addToFavorites: async (userId: string, restaurantId: string) => {
      const id = `${userId}_${restaurantId}`;
      const fav = { id, user_id: userId, restaurant_id: restaurantId, created_at: new Date().toISOString() };
      await putRecord(db, 'favorites', fav);
      return { id };
    },

    removeFavorite: async (userId: string, restaurantId: string) => {
      const id = `${userId}_${restaurantId}`;
      await deleteRecord(db, 'favorites', id);
      return { id, deleted: true };
    },

    getUserFavorites: async (userId: string) => {
      const all = await getAllFromStore(db, 'favorites');
      return all.filter((f: any) => f.user_id === userId);
    },

    // Reviews operations
    addReview: async (reviewData: any) => {
      const id = `review_${Date.now()}`;
      reviewData.id = id;
      await putRecord(db, 'reviews', reviewData);
      return { id };
    },

    getRestaurantReviews: async (restaurantId: string) => {
      const all = await getAllFromStore(db, 'reviews');
      return all.filter((r: any) => r.restaurant_id === restaurantId);
    },

    // Feedback operations
    getFeedbackByUserId: async (userId: string) => {
      const all = await getAllFromStore(db, 'feedback');
      const result = all.filter((f: any) => f.user_id === userId);
      return result;
    },

    getFeedbackById: async (feedbackId: string) => {
      const result = await getById(db, 'feedback', feedbackId);
      return result;
    },

    saveFeedback: async (feedbackData: any) => {
      await putRecord(db, 'feedback', feedbackData);
      return { id: feedbackData.id };
    },

    // Orders operations
    getOrders: async (userId?: string) => {
      const all = await getAllFromStore(db, 'orders');
      if (userId) {
        return all.filter((o: any) => o.user_id === userId);
      }
      return all;
    },

    getOrderById: async (orderId: string) => {
      return await getById(db, 'orders', orderId);
    },

    createOrder: async (orderData: any) => {
      await putRecord(db, 'orders', orderData);
      return orderData;
    },

    updateOrder: async (orderId: string, orderData: any) => {
      const existing = await getById(db, 'orders', orderId);
      if (!existing) throw new Error(`Order ${orderId} not found`);
      const updated = { ...(existing as object), ...orderData, updated_at: new Date().toISOString() };
      await putRecord(db, 'orders', updated);
      return updated;
    },

    // Sync with Supabase - COMPLETE RESET SYNC (clears all data first)
    syncWithSupabase: async (userId?: string): Promise<boolean> => {

      const isOnline = await checkOnline();

      if (!isOnline) {
        return false;
      }

      try {
        // STEP 1: CLEAR ALL LOCAL DATA FIRST
        
        await clearStore(db, 'restaurants');
        
        await clearStore(db, 'menu_items');
        
        await clearStore(db, 'menu_categories');
        
        await clearStore(db, 'orders');
        
        await clearStore(db, 'order_items');
        
        await clearStore(db, 'addresses');
        
        await clearStore(db, 'feedback');
        

        // ===== FETCH ALL RESTAURANTS =====
        const { data: restaurants, error: restaurantsError } = await supabaseClient
          .from('restaurants')
          .select('*')
          .is('deleted_at', null)
          .order('updated_at', { ascending: false });

        if (restaurantsError) {
          // console.error('[UserApp-DB] ❌ Restaurants error:', restaurantsError);
        } else {
          const activeRestaurants = restaurants || [];

          for (const r of activeRestaurants) {
            const base64Data: any = {};

            if (r.image_url && r.image_url.startsWith('http')) {
              try {
                base64Data.image_base64 = await imageUrlToBase64(r.image_url);
              } catch (err) {
                // console.warn('[UserApp-DB] ⚠️ Failed to convert image for:', r.name);
              }
            }

            if (r.logo_url && r.logo_url.startsWith('http')) {
              try {
                base64Data.logo_base64 = await imageUrlToBase64(r.logo_url);
              } catch (err) {
                // console.warn('[UserApp-DB] ⚠️ Failed to convert logo for:', r.name);
              }
            }

            if (r.cover_image_url && r.cover_image_url.startsWith('http')) {
              try {
                base64Data.cover_image_base64 = await imageUrlToBase64(r.cover_image_url);
              } catch (err) {
                // console.warn('[UserApp-DB] ⚠️ Failed to convert cover image for:', r.name);
              }
            }

            const restaurantWithBase64 = { ...r, ...base64Data };
            await putRecord(db, 'restaurants', restaurantWithBase64);
          }
        }

        // ===== FETCH ALL MENU ITEMS =====
        const { data: menuItems, error: menuItemsError } = await supabaseClient
          .from('menu_items')
          .select('*')
          .is('deleted_at', null)
          .order('updated_at', { ascending: false });

        if (menuItemsError) {
          // console.error('[UserApp-DB] ❌ Menu items error:', menuItemsError);
        } else {
          const activeMenuItems = menuItems || [];

          for (const item of activeMenuItems as any[]) {
            const itemData: any = { ...item };

            // Convert image to base64 if URL is available
            if (item.image_url && item.image_url.startsWith('http')) {
              try {
                const image_base64 = await imageUrlToBase64(item.image_url);
                itemData.image_base64 = image_base64;
              } catch (err) {
                // console.warn('[UserApp-DB] ⚠️ Failed to convert image for:', item.name, err);
              }
            }

            await putRecord(db, 'menu_items', itemData);
          }
        }

        // ===== FETCH ALL MENU CATEGORIES =====
        const { data: menuCategories, error: menuCategoriesError } = await supabaseClient
          .from('menu_categories')
          .select('*')
          .is('deleted_at', null)
          .order('updated_at', { ascending: false });

        if (menuCategoriesError) {
          // console.error('[UserApp-DB] ❌ Menu categories error:', menuCategoriesError);
        } else {
          const activeCategories = menuCategories || [];

          for (const cat of activeCategories) {
            if (cat.image_url && cat.image_url.startsWith('http')) {
              try {
                const image_base64 = await imageUrlToBase64(cat.image_url);
                cat.image_base64 = image_base64;
              } catch (err) {
                // console.warn('[UserApp-DB] ⚠️ Failed to convert image for:', cat.name);
              }
            }
            await putRecord(db, 'menu_categories', cat);
          }
        }

        // ===== FETCH USER ORDERS =====
        if (userId) {
          const { data: orders, error: ordersError } = await supabaseClient
            .from('orders')
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

          if (ordersError) {
            // console.error('[UserApp-DB] ❌ Orders error:', ordersError);
          } else {
            const userOrders = orders || [];

            for (const order of userOrders) {
              await putRecord(db, 'orders', order);

              // Sync order items
              if (order.order_items) {
                for (const item of order.order_items) {
                  await putRecord(db, 'order_items', {
                    ...item,
                    order_id: order.id,
                    menu_item_name: item.menu_items?.name || null,
                    menu_item_image_url: item.menu_items?.image_url || null
                  });
                }
              }
            }
          }
        }

        // ===== FETCH USER ADDRESSES =====
        if (userId) {
          const { data: addresses, error: addressesError } = await supabaseClient
            .from('addresses')
            .select('*')
            .eq('user_id', userId)
            .is('deleted_at', null);

          if (addressesError) {
            // console.error('[UserApp-DB] ❌ Addresses error:', addressesError);
          } else {
            const userAddresses = addresses || [];

            for (const address of userAddresses) {
              await putRecord(db, 'addresses', address);
            }
          }
        }

        // ===== FETCH USER FEEDBACK =====
        if (userId) {
          const { data: feedback, error: feedbackError } = await supabaseClient
            .from('feedback')
            .select('*')
            .eq('user_id', userId)
            .order('created_at', { ascending: false });

          if (feedbackError) {
            // console.error('[UserApp-DB] ❌ Feedback error:', feedbackError);
          } else {
            const userFeedback = feedback || [];

            for (const f of userFeedback) {
              await putRecord(db, 'feedback', f);
            }
          }
        }

        
        // Dispatch event for UI refresh (web)
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('syncComplete'));
        }
        
        return true;
      } catch (error) {
        // console.error('[UserApp-DB] ❌❌❌ syncWithSupabase ERROR:', error);
        throw error;
      }
    },

    // Close database
    close: async () => {
      if (dbInstance) {
        dbInstance.close();
        dbInstance = null;
        initPromise = null;
      }
    }
  };
};

// Helper: Delete record
const deleteRecord = async (db: any, storeName: string, id: string): Promise<void> => {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readwrite');
    const store = tx.objectStore(storeName);
    const request = store.delete(id);

    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
};
