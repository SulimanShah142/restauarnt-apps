// Web Database Implementation using raw IndexedDB for Admins App
// Simple, lightweight database layer without RxDB overhead
// Comprehensive debugging console logs included

import { DatabaseInterface } from './types';
import { TABLES, SQLITE_SCHEMA } from './schema';
import { imageUrlToBase64 } from '@/utils/image-base64-utils';

// IndexedDB database name and version
const DB_NAME = 'adminsapp_db';
const DB_VERSION = 3; // Incremented to add sync_log store

// Open/create IndexedDB database
const openDB = (): Promise<IDBDatabase> => {

  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => {
      console.error('[AdminsDB] ❌ IndexedDB error:', request.error);
      reject(request.error);
    };

    request.onsuccess = () => {
      resolve(request.result);
    };

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;

      // Create object stores for each table (admin-focused)
      const stores = [
        'admins', 'restaurants', 'menu_categories', 'menu_items',
        'orders', 'order_items', 'feedback', 'reviews', 'advertisements',
        'app_settings', 'settings', 'delivery_persons', 'delivery_assignments',
        'notifications', 'payments', 'users', 'profiles', 'sync_log'
      ];

      for (const storeName of stores) {
        if (!db.objectStoreNames.contains(storeName)) {
          const store = db.createObjectStore(storeName, { keyPath: 'id' });
          store.createIndex('updated_at', 'updated_at', { unique: false });
          store.createIndex('created_at', 'created_at', { unique: false });

          // Add specific indexes based on table
          if (storeName === 'restaurants') {
            store.createIndex('is_active', 'is_active', { unique: false });
            store.createIndex('owner_id', 'owner_id', { unique: false });
            store.createIndex('is_available', 'is_available', { unique: false });
          } else if (storeName === 'menu_items') {
            store.createIndex('restaurant_id', 'restaurant_id', { unique: false });
            store.createIndex('menu_category_id', 'menu_category_id', { unique: false });
            store.createIndex('is_available', 'is_available', { unique: false });
          } else if (storeName === 'orders') {
            store.createIndex('restaurant_id', 'restaurant_id', { unique: false });
            store.createIndex('user_id', 'user_id', { unique: false });
            store.createIndex('status', 'status', { unique: false });
            store.createIndex('delivery_person_id', 'delivery_person_id', { unique: false });
          } else if (storeName === 'order_items') {
            store.createIndex('order_id', 'order_id', { unique: false });
            store.createIndex('menu_item_id', 'menu_item_id', { unique: false });
          } else if (storeName === 'delivery_persons') {
            store.createIndex('is_available', 'is_available', { unique: false });
            store.createIndex('user_id', 'user_id', { unique: false });
          } else if (storeName === 'delivery_assignments') {
            store.createIndex('order_id', 'order_id', { unique: false });
            store.createIndex('delivery_person_id', 'delivery_person_id', { unique: false });
            store.createIndex('status', 'status', { unique: false });
          } else if (storeName === 'feedback') {
            store.createIndex('restaurant_id', 'restaurant_id', { unique: false });
            store.createIndex('user_id', 'user_id', { unique: false });
            store.createIndex('is_resolved', 'is_resolved', { unique: false });
          } else if (storeName === 'admins') {
            store.createIndex('user_id', 'user_id', { unique: false });
            store.createIndex('is_active', 'is_active', { unique: false });
          } else if (storeName === 'notifications') {
            store.createIndex('user_id', 'user_id', { unique: false });
            store.createIndex('is_read', 'is_read', { unique: false });
          }
        }
      }
    };

    request.onsuccess = () => {
      resolve(request.result);
    };
  });
};

// Helper: Get all records from a store
export const getAllFromStore = async <T>(db: IDBDatabase, storeName: string): Promise<T[]> => {
  
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readonly');
    const store = tx.objectStore(storeName);
    const request = store.getAll();

    request.onsuccess = () => {
      resolve(request.result as T[]);
    };
    request.onerror = () => {
      console.error('[AdminsDB] ❌ Error getting all from store:', storeName, request.error);
      reject(request.error);
    };
  });
};

// Helper: Get record by ID
const getById = async <T>(db: IDBDatabase, storeName: string, id: string): Promise<T | null> => {
  
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readonly');
    const store = tx.objectStore(storeName);
    const request = store.get(id);

    request.onsuccess = () => {
      if (request.result) {
        resolve(request.result as T);
      } else {
        resolve(null);
      }
    };
    request.onerror = () => {
      console.error('[AdminsDB] ❌ Error getting record by ID:', id, request.error);
      reject(request.error);
    };
  });
};

// Helper: Insert or update record
export const putRecord = async (db: IDBDatabase, storeName: string, record: any): Promise<void> => {
  
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readwrite');
    const store = tx.objectStore(storeName);
    const request = store.put(record);

    request.onsuccess = () => {
      resolve();
    };
    request.onerror = () => {
      console.error('[AdminsDB] ❌ Error putting record:', record.id, request.error);
      reject(request.error);
    };
  });
};

// Helper: Save multiple records at once (for bulk sync)
export const putRecords = async (db: IDBDatabase, storeName: string, records: any[]): Promise<void> => {

  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readwrite');
    const store = tx.objectStore(storeName);

    let completed = 0;
    let errors = 0;

    records.forEach((record) => {
      const request = store.put(record);
      request.onsuccess = () => {
        completed++;
        if (completed + errors === records.length) {
          if (errors > 0) {
            console.warn('[AdminsDB] ⚠️ putRecords completed with', errors, 'errors');
          } else {
            resolve();
          }
        }
      };
      request.onerror = () => {
        errors++;
        console.error('[AdminsDB] ❌ Error putting record:', record.id, request.error);
        if (completed + errors === records.length) {
          console.warn('[AdminsDB] ⚠️ putRecords completed with', errors, 'errors');
          resolve(); // Still resolve even with errors
        }
      };
    });
  });
};

// Helper: Clear all records from a store (for sync)
export const clearStore = async (db: IDBDatabase, storeName: string): Promise<void> => {

  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readwrite');
    const store = tx.objectStore(storeName);
    const request = store.clear();

    request.onsuccess = () => {
      resolve();
    };
    request.onerror = () => {
      console.error('[AdminsDB] ❌ Error clearing store:', storeName, request.error);
      reject(request.error);
    };
  });
};

// Helper: Delete record
const deleteRecord = async (db: IDBDatabase, storeName: string, id: string): Promise<void> => {

  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readwrite');
    const store = tx.objectStore(storeName);
    const request = store.delete(id);

    request.onsuccess = () => {
      resolve();
    };
    request.onerror = () => {
      console.error('[AdminsDB] ❌ Error deleting record:', id, request.error);
      reject(request.error);
    };
  });
};

// ============================================================================
// SYNC LOG HELPERS (for incremental sync on web)
// ============================================================================

export const getSyncTimestamp = async (db: IDBDatabase, tableName: string): Promise<string> => {
  return new Promise((resolve) => {
    try {
      const tx = db.transaction('sync_log', 'readonly');
      const store = tx.objectStore('sync_log');
      const request = store.get(tableName);

      request.onsuccess = () => {
        const result = request.result?.sync_timestamp || '1970-01-01T00:00:00.000Z';
        resolve(result);
      };
      request.onerror = () => {
        console.warn('[AdminsDB] ⚠️ Error getting sync timestamp:', request.error);
        resolve('1970-01-01T00:00:00.000Z');
      };
    } catch (error) {
      console.warn('[AdminsDB] ⚠️ getSyncTimestamp error:', error);
      resolve('1970-01-01T00:00:00.000Z');
    }
  });
};

export const setSyncTimestamp = async (db: IDBDatabase, tableName: string): Promise<void> => {
  return new Promise((resolve, reject) => {
    try {
      const now = new Date().toISOString();
      const tx = db.transaction('sync_log', 'readwrite');
      const store = tx.objectStore('sync_log');
      const request = store.put({ 
        id: tableName,  // Use 'id' as keyPath since store was created with keyPath: 'id'
        table_name: tableName, 
        sync_timestamp: now 
      });

      request.onsuccess = () => {
        resolve();
      };
      request.onerror = () => {
        console.warn('[AdminsDB] ⚠️ Error setting sync timestamp:', request.error);
        resolve(); // Don't reject, sync should continue
      };
    } catch (error) {
      console.warn('[AdminsDB] ⚠️ setSyncTimestamp error:', error);
      resolve(); // Don't reject, sync should continue
    }
  });
};

// Helper: Query by index
const getByIndex = async <T>(
  db: IDBDatabase,
  storeName: string,
  indexName: string,
  value: any
): Promise<T[]> => {

  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readonly');
    const store = tx.objectStore(storeName);
    const index = store.index(indexName);
    const request = index.getAll(value);

    request.onsuccess = () => {
      resolve(request.result as T[]);
    };
    request.onerror = () => {
      console.error('[AdminsDB] Error getting by index:', indexName, value, request.error);
      reject(request.error);
    };
  });
};

// ==================== SYNC LOG HELPERS (for incremental sync) ====================

// Initialize sync_log table for tracking incremental sync timestamps
const initSyncLog = async (db: IDBDatabase): Promise<void> => {
  if (!db.objectStoreNames.contains('sync_log')) {
    return;
  }
};

// Get last sync timestamp for a table
const getLastSyncTimestamp = async (db: IDBDatabase, tableName: string): Promise<string> => {
  if (!db.objectStoreNames.contains('sync_log')) {
    return '1970-01-01T00:00:00.000Z';
  }

  return new Promise((resolve, reject) => {
    const tx = db.transaction('sync_log', 'readonly');
    const store = tx.objectStore('sync_log');
    const request = store.get(tableName);

    request.onsuccess = () => {
      const result = request.result;
      resolve(result?.sync_timestamp || '1970-01-01T00:00:00.000Z');
    };
    request.onerror = () => reject(request.error);
  });
};

// Update sync timestamp for a table
const updateSyncTimestamp = async (db: IDBDatabase, tableName: string): Promise<void> => {
  // Use the exported setSyncTimestamp function which handles the keyPath correctly
  await setSyncTimestamp(db, tableName);
};

// Clear all sync timestamps (for force reset)
const clearSyncTimestamps = async (db: IDBDatabase): Promise<void> => {
  if (!db.objectStoreNames.contains('sync_log')) {
    return;
  }

  return new Promise((resolve, reject) => {
    const tx = db.transaction('sync_log', 'readwrite');
    const store = tx.objectStore('sync_log');
    const request = store.clear();

    request.onsuccess = () => {
      resolve();
    };
    request.onerror = () => reject(request.error);
  });
};

// Helper: Check if online
const checkOnline = async (): Promise<boolean> => {
  try {
    const response = await fetch(SUPABASE_URL, { method: 'HEAD', mode: 'no-cors' });
    return true;
  } catch {
    return false;
  }
};

// Initialize database
let dbInstance: IDBDatabase | null = null;
let initPromise: Promise<IDBDatabase> | null = null;

// Export for use by other modules
export const ensureDbInitialized = async (): Promise<IDBDatabase> => {

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

// Import Supabase client for sync
import { createClient } from '@supabase/supabase-js';
import Constants from 'expo-constants';

// Get environment variables - works on both web and native
const getEnvVar = (name: string): string => {
  // Try multiple sources for environment variables
  return (
    (Constants.expoConfig?.extra?.[name] as string) ||
    (process.env?.[name] as string) ||
    (globalThis as any)?.process?.env?.[name] ||
    ''
  );
};

const SUPABASE_URL = getEnvVar('EXPO_PUBLIC_SUPABASE_URL') || '';
// Note: The .env file has EXPO_PUBLIC_SUPABASE_ANNON_KEY (with typo), also check for correct spelling
const SUPABASE_ANON_KEY = getEnvVar('EXPO_PUBLIC_SUPABASE_ANON_KEY') || getEnvVar('EXPO_PUBLIC_SUPABASE_ANNON_KEY') || getEnvVar('EXPO_PUBLIC_SUPABASE_KEY') || '';


// Only create Supabase client if we have both URL and key
let supabaseClient: ReturnType<typeof createClient> | null = null;
if (SUPABASE_URL && SUPABASE_ANON_KEY) {
  supabaseClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  console.warn('[AdminsDB] ⚠️ Supabase client NOT created - missing configuration');
  console.warn('[AdminsDB] URL present:', !!SUPABASE_URL, '| Key present:', !!SUPABASE_ANON_KEY);
}

export const getDatabase = async (): Promise<DatabaseInterface> => {
  const db = await ensureDbInitialized();

  return {
    // ==================== RESTAURANT OPERATIONS ====================
    getRestaurants: async () => {
      try {
        const all = await getAllFromStore(db, 'restaurants');
        // Admin app shows ALL restaurants (both active and inactive)
        return all;
      } catch (error) {
        console.error('[AdminsDB] getRestaurants: Error:', error);
        return [];
      }
    },

    getRestaurantById: async (id: string) => {
      try {
        const result = await getById(db, 'restaurants', id);
        return result;
      } catch (error) {
        console.error('[AdminsDB] getRestaurantById: Error:', error);
        return null;
      }
    },

    createRestaurant: async (data: any) => {
      try {
        const restaurantData = {
          ...data,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        };
        await putRecord(db, 'restaurants', restaurantData);
        return restaurantData;
      } catch (error) {
        console.error('[AdminsDB] createRestaurant: Error:', error);
        throw error;
      }
    },

    updateRestaurant: async (id: string, data: any) => {
      try {
        const existing = await getById(db, 'restaurants', id);
        if (!existing) {
          console.error('[AdminsDB] updateRestaurant: Restaurant not found:', id);
          throw new Error(`Restaurant ${id} not found`);
        }
        const updated = { 
          ...existing, 
          ...data, 
          id, // Ensure ID is not overwritten
          updated_at: new Date().toISOString() 
        };
        await putRecord(db, 'restaurants', updated);
        return updated;
      } catch (error) {
        console.error('[AdminsDB] updateRestaurant: Error:', error);
        throw error;
      }
    },

    deleteRestaurant: async (id: string) => {
      try {
        await deleteRecord(db, 'restaurants', id);
        return { id, deleted: true };
      } catch (error) {
        console.error('[AdminsDB] deleteRestaurant: Error:', error);
        throw error;
      }
    },

    // ==================== MENU OPERATIONS ====================
    getMenuItemsByRestaurant: async (restaurantId: string) => {
      try {
        const all = await getAllFromStore(db, 'menu_items');
        const filtered = all.filter((item: any) => item.restaurant_id === restaurantId);
        return filtered;
      } catch (error) {
        console.error('[AdminsDB] getMenuItemsByRestaurant: Error:', error);
        return [];
      }
    },

    getMenuCategoriesByRestaurant: async (restaurantId: string) => {
      try {
        const all = await getAllFromStore(db, 'menu_categories');
        const filtered = all.filter((cat: any) => 
          cat.restaurant_id === restaurantId && cat.is_active !== false
        );
        return filtered;
      } catch (error) {
        console.error('[AdminsDB] getMenuCategoriesByRestaurant: Error:', error);
        return [];
      }
    },

    createMenuItem: async (data: any) => {
      try {
        const menuItemData = {
          ...data,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        };
        await putRecord(db, 'menu_items', menuItemData);
        return menuItemData;
      } catch (error) {
        console.error('[AdminsDB] createMenuItem: Error:', error);
        throw error;
      }
    },

    updateMenuItem: async (id: string, data: any) => {
      try {
        const existing = await getById(db, 'menu_items', id);
        if (!existing) {
          console.error('[AdminsDB] updateMenuItem: Menu item not found:', id);
          throw new Error(`Menu item ${id} not found`);
        }
        const updated = { 
          ...existing, 
          ...data, 
          id,
          updated_at: new Date().toISOString() 
        };
        await putRecord(db, 'menu_items', updated);
        return updated;
      } catch (error) {
        console.error('[AdminsDB] updateMenuItem: Error:', error);
        throw error;
      }
    },

    deleteMenuItem: async (id: string) => {
      try {
        await deleteRecord(db, 'menu_items', id);
        return { id, deleted: true };
      } catch (error) {
        console.error('[AdminsDB] deleteMenuItem: Error:', error);
        throw error;
      }
    },

    createMenuCategory: async (data: any) => {
      try {
        const categoryData = {
          ...data,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        };
        await putRecord(db, 'menu_categories', categoryData);
        return categoryData;
      } catch (error) {
        console.error('[AdminsDB] createMenuCategory: Error:', error);
        throw error;
      }
    },

    updateMenuCategory: async (id: string, data: any) => {
      try {
        const existing = await getById(db, 'menu_categories', id);
        if (!existing) {
          console.error('[AdminsDB] updateMenuCategory: Category not found:', id);
          throw new Error(`Menu category ${id} not found`);
        }
        const updated = { 
          ...existing, 
          ...data, 
          id,
          updated_at: new Date().toISOString() 
        };
        await putRecord(db, 'menu_categories', updated);
        return updated;
      } catch (error) {
        console.error('[AdminsDB] updateMenuCategory: Error:', error);
        throw error;
      }
    },

    deleteMenuCategory: async (id: string) => {
      try {
        await deleteRecord(db, 'menu_categories', id);
        return { id, deleted: true };
      } catch (error) {
        console.error('[AdminsDB] deleteMenuCategory: Error:', error);
        throw error;
      }
    },

    // ==================== ORDER OPERATIONS ====================
    getOrders: async (restaurantId?: string) => {
      try {
        const all = await getAllFromStore(db, 'orders');
        let filtered = all;
        if (restaurantId) {
          filtered = all.filter((o: any) => o.restaurant_id === restaurantId);
        }
        // Sort by created_at descending (newest first)
        filtered.sort((a: any, b: any) => 
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        );
        return filtered;
      } catch (error) {
        console.error('[AdminsDB] getOrders: Error:', error);
        return [];
      }
    },

    getOrderById: async (orderId: string) => {
      try {
        const result = await getById(db, 'orders', orderId);
        return result;
      } catch (error) {
        console.error('[AdminsDB] getOrderById: Error:', error);
        return null;
      }
    },

    updateOrderStatus: async (orderId: string, status: string, additionalData?: any) => {
      try {
        const order = await getById(db, 'orders', orderId);
        if (!order) {
          console.error('[AdminsDB] updateOrderStatus: Order not found:', orderId);
          throw new Error(`Order ${orderId} not found`);
        }
        const updated = { 
          ...order, 
          status,
          ...(additionalData || {}),
          updated_at: new Date().toISOString() 
        };
        await putRecord(db, 'orders', updated);
        return updated;
      } catch (error) {
        console.error('[AdminsDB] updateOrderStatus: Error:', error);
        throw error;
      }
    },

    updateOrder: async (orderId: string, data: any) => {
      try {
        const existing = await getById(db, 'orders', orderId);
        if (!existing) {
          console.error('[AdminsDB] updateOrder: Order not found:', orderId);
          throw new Error(`Order ${orderId} not found`);
        }
        const updated = {
          ...existing,
          ...data,
          id: orderId,
          updated_at: new Date().toISOString()
        };
        await putRecord(db, 'orders', updated);
        return updated;
      } catch (error) {
        console.error('[AdminsDB] updateOrder: Error:', error);
        throw error;
      }
    },

    // ==================== ADMIN OPERATIONS ====================
    getAdmins: async () => {
      try {
        const all = await getAllFromStore(db, 'admins');
        const active = all.filter((a: any) => a.is_active !== false);
        return active;
      } catch (error) {
        console.error('[AdminsDB] getAdmins: Error:', error);
        return [];
      }
    },

    getAdminById: async (id: string) => {
      try {
        const result = await getById(db, 'admins', id);
        return result;
      } catch (error) {
        console.error('[AdminsDB] getAdminById: Error:', error);
        return null;
      }
    },

    getAdminByUserId: async (userId: string) => {
      try {
        const all = await getAllFromStore(db, 'admins');
        const result = all.find((a: any) => a.user_id === userId);
        return result || null;
      } catch (error) {
        console.error('[AdminsDB] getAdminByUserId: Error:', error);
        return null;
      }
    },

    createAdmin: async (data: any) => {
      try {
        const adminData = {
          ...data,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        };
        await putRecord(db, 'admins', adminData);
        return adminData;
      } catch (error) {
        console.error('[AdminsDB] createAdmin: Error:', error);
        throw error;
      }
    },

    updateAdmin: async (id: string, data: any) => {
      try {
        const existing = await getById(db, 'admins', id);
        if (!existing) {
          console.error('[AdminsDB] updateAdmin: Admin not found:', id);
          throw new Error(`Admin ${id} not found`);
        }
        const updated = { 
          ...existing, 
          ...data, 
          id,
          updated_at: new Date().toISOString() 
        };
        await putRecord(db, 'admins', updated);
        return updated;
      } catch (error) {
        console.error('[AdminsDB] updateAdmin: Error:', error);
        throw error;
      }
    },

    deleteAdmin: async (id: string) => {
      try {
        await deleteRecord(db, 'admins', id);
        return { id, deleted: true };
      } catch (error) {
        console.error('[AdminsDB] deleteAdmin: Error:', error);
        throw error;
      }
    },

    // ==================== FEEDBACK OPERATIONS ====================
    getFeedback: async (restaurantId?: string) => {
      try {
        const all = await getAllFromStore(db, 'feedback');
        let filtered = all;
        if (restaurantId) {
          filtered = all.filter((f: any) => f.restaurant_id === restaurantId);
        }
        // Sort by created_at descending
        filtered.sort((a: any, b: any) => 
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        );
        return filtered;
      } catch (error) {
        console.error('[AdminsDB] getFeedback: Error:', error);
        return [];
      }
    },

    createFeedback: async (data: any) => {
      try {
        // Only include fields that exist in the feedback table schema
        const feedbackData = {
          id: data.id,
          user_id: data.user_id,
          title: data.title,
          comment: data.comment,
          rating: data.rating,
          is_resolved: data.is_resolved,
          created_at: data.created_at || new Date().toISOString(),
          updated_at: data.updated_at || new Date().toISOString(),
        };
        await putRecord(db, 'feedback', feedbackData);
        return feedbackData;
      } catch (error) {
        console.error('[AdminsDB] createFeedback: Error:', error);
        throw error;
      }
    },

    updateFeedback: async (id: string, data: any) => {
      try {
        const existing = await getById(db, 'feedback', id);
        if (!existing) {
          console.error('[AdminsDB] updateFeedback: Feedback not found:', id);
          throw new Error(`Feedback ${id} not found`);
        }
        const updated = { 
          ...existing, 
          ...data, 
          id,
          updated_at: new Date().toISOString() 
        };
        await putRecord(db, 'feedback', updated);
        return updated;
      } catch (error) {
        console.error('[AdminsDB] updateFeedback: Error:', error);
        throw error;
      }
    },

    deleteFeedback: async (id: string) => {
      try {
        await deleteRecord(db, 'feedback', id);
        return { id, deleted: true };
      } catch (error) {
        console.error('[AdminsDB] deleteFeedback: Error:', error);
        throw error;
      }
    },

    // ==================== DELIVERY PERSON OPERATIONS ====================
    getDeliveryPersons: async () => {
      try {
        const all = await getAllFromStore(db, 'delivery_persons');
        return all;
      } catch (error) {
        console.error('[AdminsDB] getDeliveryPersons: Error:', error);
        return [];
      }
    },

    getDeliveryPersonById: async (id: string) => {
      try {
        const result = await getById(db, 'delivery_persons', id);
        return result;
      } catch (error) {
        console.error('[AdminsDB] getDeliveryPersonById: Error:', error);
        return null;
      }
    },

    createDeliveryPerson: async (data: any) => {
      try {
        const deliveryPersonData = {
          ...data,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        };
        await putRecord(db, 'delivery_persons', deliveryPersonData);
        return deliveryPersonData;
      } catch (error) {
        console.error('[AdminsDB] createDeliveryPerson: Error:', error);
        throw error;
      }
    },

    updateDeliveryPerson: async (id: string, data: any) => {
      try {
        const existing = await getById(db, 'delivery_persons', id);
        if (!existing) {
          console.error('[AdminsDB] updateDeliveryPerson: Delivery person not found:', id);
          throw new Error(`Delivery person ${id} not found`);
        }
        const updated = { 
          ...existing, 
          ...data, 
          id,
          updated_at: new Date().toISOString() 
        };
        await putRecord(db, 'delivery_persons', updated);
        return updated;
      } catch (error) {
        console.error('[AdminsDB] updateDeliveryPerson: Error:', error);
        throw error;
      }
    },

    deleteDeliveryPerson: async (id: string) => {
      try {
        await deleteRecord(db, 'delivery_persons', id);
        return { id, deleted: true };
      } catch (error) {
        console.error('[AdminsDB] deleteDeliveryPerson: Error:', error);
        throw error;
      }
    },

    // ==================== DELIVERY ASSIGNMENT OPERATIONS ====================
    getDeliveryAssignments: async (orderId?: string) => {
      try {
        const all = await getAllFromStore(db, 'delivery_assignments');
        let filtered = all;
        if (orderId) {
          filtered = all.filter((a: any) => a.order_id === orderId);
        }
        // Sort by assigned_at descending
        filtered.sort((a: any, b: any) => 
          new Date(b.assigned_at || b.created_at).getTime() - new Date(a.assigned_at || a.created_at).getTime()
        );
        return filtered;
      } catch (error) {
        console.error('[AdminsDB] getDeliveryAssignments: Error:', error);
        return [];
      }
    },

    createDeliveryAssignment: async (data: any) => {
      try {
        const assignmentData = {
          ...data,
          assigned_at: new Date().toISOString(),
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        };
        await putRecord(db, 'delivery_assignments', assignmentData);
        return assignmentData;
      } catch (error) {
        console.error('[AdminsDB] createDeliveryAssignment: Error:', error);
        throw error;
      }
    },

    updateDeliveryAssignment: async (id: string, data: any) => {
      try {
        const existing = await getById(db, 'delivery_assignments', id);
        if (!existing) {
          console.error('[AdminsDB] updateDeliveryAssignment: Assignment not found:', id);
          throw new Error(`Delivery assignment ${id} not found`);
        }
        const updated = { 
          ...existing, 
          ...data, 
          id,
          updated_at: new Date().toISOString() 
        };
        await putRecord(db, 'delivery_assignments', updated);
        return updated;
      } catch (error) {
        console.error('[AdminsDB] updateDeliveryAssignment: Error:', error);
        throw error;
      }
    },

    deleteDeliveryAssignment: async (id: string) => {
      try {
        await deleteRecord(db, 'delivery_assignments', id);
        return { id, deleted: true };
      } catch (error) {
        console.error('[AdminsDB] deleteDeliveryAssignment: Error:', error);
        throw error;
      }
    },

    // ==================== NOTIFICATION OPERATIONS ====================
    getNotifications: async (userId?: string) => {
      try {
        const all = await getAllFromStore(db, 'notifications');
        let filtered = all;
        if (userId) {
          filtered = all.filter((n: any) => n.user_id === userId);
        }
        // Sort by created_at descending
        filtered.sort((a: any, b: any) => 
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        );
        return filtered;
      } catch (error) {
        console.error('[AdminsDB] getNotifications: Error:', error);
        return [];
      }
    },

    createNotification: async (data: any) => {
      try {
        const notificationData = {
          ...data,
          is_read: false,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        };
        await putRecord(db, 'notifications', notificationData);
        return notificationData;
      } catch (error) {
        console.error('[AdminsDB] createNotification: Error:', error);
        throw error;
      }
    },

    markNotificationAsRead: async (id: string) => {
      try {
        const existing = await getById(db, 'notifications', id);
        if (!existing) {
          console.error('[AdminsDB] markNotificationAsRead: Notification not found:', id);
          throw new Error(`Notification ${id} not found`);
        }
        const updated = { 
          ...existing, 
          is_read: true,
          updated_at: new Date().toISOString() 
        };
        await putRecord(db, 'notifications', updated);
        return updated;
      } catch (error) {
        console.error('[AdminsDB] markNotificationAsRead: Error:', error);
        throw error;
      }
    },

    deleteNotification: async (id: string) => {
      try {
        await deleteRecord(db, 'notifications', id);
        return { id, deleted: true };
      } catch (error) {
        console.error('[AdminsDB] deleteNotification: Error:', error);
        throw error;
      }
    },

    // ==================== APP SETTINGS OPERATIONS ====================
    getAppSettings: async () => {
      try {
        const all = await getAllFromStore(db, 'app_settings');
        const settings = all.length > 0 ? all[0] : null;
        return settings;
      } catch (error) {
        console.error('[AdminsDB] getAppSettings: Error:', error);
        return null;
      }
    },

    updateAppSettings: async (data: any) => {
      try {
        const settingsData = {
          id: 'app-settings',
          ...data,
          updated_at: new Date().toISOString()
        };
        await putRecord(db, 'app_settings', settingsData);
        return settingsData;
      } catch (error) {
        console.error('[AdminsDB] updateAppSettings: Error:', error);
        throw error;
      }
    },

    // ==================== SYNC WITH SUPABASE (INCREMENTAL with BASE64) ====================
    syncWithSupabase: async (options?: { force?: boolean }) => {
      const forceSync = options?.force || false;
      

      // Check if supabaseClient is available
      if (!supabaseClient) {
        console.warn('[AdminsDB] ⚠️ syncWithSupabase: Supabase client not configured');
        return;
      }

      // Check if online
      const isOnline = await checkOnline();

      if (!isOnline) {
        return;
      }

      try {
        // Initialize sync_log table
        await initSyncLog(db);

        // If force sync, CLEAR ALL DATA first, then clear timestamps
        if (forceSync) {
          await clearStore(db, 'restaurants');
          
          await clearStore(db, 'menu_items');
          
          await clearStore(db, 'menu_categories');
          
          await clearStore(db, 'orders');
          
          await clearStore(db, 'order_items');
          
          await clearStore(db, 'admins');
          
          await clearStore(db, 'delivery_persons');
          
          await clearStore(db, 'delivery_assignments');
          
          await clearStore(db, 'feedback');
          
          await clearStore(db, 'reviews');
          
          await clearStore(db, 'advertisements');
          
          await clearStore(db, 'app_settings');
          
          await clearStore(db, 'notifications');
          
          await clearStore(db, 'payments');
          
          await clearStore(db, 'users');

          await clearStore(db, 'profiles');


          await clearSyncTimestamps(db);
        }

        // ===== SYNC RESTAURANTS (COMPLETE RESET with BASE64) =====
        const lastSyncRestaurants = await getLastSyncTimestamp(db, 'restaurants');

        const { data: restaurants, error: restaurantsError } = await supabaseClient
          .from('restaurants')
          .select('*')
          .is('deleted_at', null)
          .gte('updated_at', lastSyncRestaurants);

        if (restaurantsError) {
          console.error('[AdminsDB] ❌ Restaurants error:', restaurantsError);
        } else if (restaurants && restaurants.length > 0) {
          const activeCount = restaurants.filter((r: any) => r.is_active !== false).length;

          // Convert images to base64
          for (const r of restaurants as any[]) {
            const base64Data: any = {};

            if (r.image_url && r.image_url.startsWith('http')) {
              try {
                base64Data.image_base64 = await imageUrlToBase64(r.image_url);
              } catch (err) {
                console.warn('[AdminsDB] ⚠️ Failed to convert image for:', r.name, err);
              }
            }

            if (r.logo_url && r.logo_url.startsWith('http')) {
              try {
                base64Data.logo_base64 = await imageUrlToBase64(r.logo_url);
              } catch (err) {
                console.warn('[AdminsDB] ⚠️ Failed to convert logo for:', r.name, err);
              }
            }

            if (r.cover_image_url && r.cover_image_url.startsWith('http')) {
              try {
                base64Data.cover_image_base64 = await imageUrlToBase64(r.cover_image_url);
              } catch (err) {
                console.warn('[AdminsDB] ⚠️ Failed to convert cover image for:', r.name, err);
              }
            }

            await putRecord(db, 'restaurants', { ...r, ...base64Data });
          }
        }
        await updateSyncTimestamp(db, 'restaurants');

        // ===== SYNC MENU ITEMS (COMPLETE RESET with BASE64) =====
        const lastSyncMenuItems = await getLastSyncTimestamp(db, 'menu_items');

        const { data: menuItems, error: menuItemsError } = await supabaseClient
          .from('menu_items')
          .select('*')
          .is('deleted_at', null)
          .gte('updated_at', lastSyncMenuItems);

        if (menuItemsError) {
          console.error('[AdminsDB] ❌ Menu items error:', menuItemsError);
        } else if (menuItems && menuItems.length > 0) {

          // Convert images to base64
          for (const item of menuItems as any[]) {
            if (item.image_url && item.image_url.startsWith('http')) {
              try {
                const image_base64 = await imageUrlToBase64(item.image_url);
                item.image_base64 = image_base64;
              } catch (err) {
                console.warn('[AdminsDB] ⚠️ Failed to convert image for:', item.name, err);
              }
            }
            await putRecord(db, 'menu_items', item);
          }
        }
        await updateSyncTimestamp(db, 'menu_items');

        // ===== SYNC MENU CATEGORIES (COMPLETE RESET with BASE64) =====
        const lastSyncMenuCategories = await getLastSyncTimestamp(db, 'menu_categories');

        const { data: menuCategories, error: menuCategoriesError } = await supabaseClient
          .from('menu_categories')
          .select('*')
          .is('deleted_at', null)
          .gte('updated_at', lastSyncMenuCategories);

        if (menuCategoriesError) {
          console.error('[AdminsDB] ❌ Menu categories error:', menuCategoriesError);
        } else if (menuCategories && menuCategories.length > 0) {

          // Convert images to base64
          for (const cat of menuCategories as any[]) {
            if (cat.image_url && cat.image_url.startsWith('http')) {
              try {
                const image_base64 = await imageUrlToBase64(cat.image_url);
                cat.image_base64 = image_base64;
              } catch (err) {
                console.warn('[AdminsDB] ⚠️ Failed to convert image for:', cat.name, err);
              }
            }
            await putRecord(db, 'menu_categories', cat);
          }
        }
        await updateSyncTimestamp(db, 'menu_categories');

        // ===== SYNC ORDERS (COMPLETE RESET) =====
        const lastSyncOrders = await getLastSyncTimestamp(db, 'orders');

        const { data: orders, error: ordersError } = await supabaseClient
          .from('orders')
          .select('*')
          .is('deleted_at', null)
          .gte('updated_at', lastSyncOrders);

        if (ordersError) {
          console.error('[AdminsDB] ❌ Orders error:', ordersError);
        } else if (orders && orders.length > 0) {
          await putRecords(db, 'orders', orders);
        }
        await updateSyncTimestamp(db, 'orders');

        // ===== SYNC DELIVERY PERSONS (INCREMENTAL with BASE64) =====
        const lastSyncDeliveryPersons = await getLastSyncTimestamp(db, 'delivery_persons');

        const { data: deliveryPersons, error: deliveryPersonsError } = await supabaseClient
          .from('delivery_persons')
          .select('*')
          .is('deleted_at', null)
          .gte('updated_at', lastSyncDeliveryPersons);

        if (deliveryPersonsError) {
          console.error('[AdminsDB] ❌ Delivery persons error:', deliveryPersonsError);
        } else if (deliveryPersons && deliveryPersons.length > 0) {

          // Convert images to base64
          for (const person of deliveryPersons as any[]) {
            if (person.image_url && person.image_url.startsWith('http')) {
              try {
                const image_base64 = await imageUrlToBase64(person.image_url);
                person.image_base64 = image_base64;
              } catch (err) {
                console.warn('[AdminsDB] ⚠️ Failed to convert image for:', person.name, err);
              }
            }
            await putRecord(db, 'delivery_persons', person);
          }
        }
        await updateSyncTimestamp(db, 'delivery_persons');

        // ===== SYNC DELIVERY ASSIGNMENTS (INCREMENTAL, no images) =====
        const lastSyncAssignments = await getLastSyncTimestamp(db, 'delivery_assignments');

        const { data: deliveryAssignments, error: assignmentsError } = await supabaseClient
          .from('delivery_assignments')
          .select('*')
          .is('deleted_at', null)
          .gte('updated_at', lastSyncAssignments);

        if (assignmentsError) {
          console.error('[AdminsDB] ❌ Delivery assignments error:', assignmentsError);
        } else if (deliveryAssignments && deliveryAssignments.length > 0) {
          await putRecords(db, 'delivery_assignments', deliveryAssignments);
        }
        await updateSyncTimestamp(db, 'delivery_assignments');

      } catch (error) {
        console.error('[AdminsDB] ========================================');
        console.error('[AdminsDB] ❌❌❌ syncWithSupabase ERROR:', error);
        console.error('[AdminsDB] ========================================');
        throw error;
      }
    },

    // ==================== CLOSE DATABASE ====================
    close: async () => {
      if (dbInstance) {
        dbInstance.close();
        dbInstance = null;
        initPromise = null;
      }
    },

    // ==================== RAW DATABASE OPERATIONS ====================
    // Note: IndexedDB doesn't support SQL, these are stub implementations for compatibility
    getAllAsync: async (_sql: string, _params?: any[]) => {
      console.warn('[AdminsDB] getAllAsync: SQL operations not supported on IndexedDB');
      return [];
    },

    getFirstAsync: async (_sql: string, _params?: any[]) => {
      console.warn('[AdminsDB] getFirstAsync: SQL operations not supported on IndexedDB');
      return null;
    },

    runAsync: async (_sql: string, _params: any[]) => {
      console.warn('[AdminsDB] runAsync: SQL operations not supported on IndexedDB');
      return { insertId: null, rowsAffected: 0 };
    },

    // ==================== SYNC HELPERS (for sync-utils.ts) ====================
    // Expose raw IndexedDB and helper functions for sync operations
    getSyncTimestamp: (tableName: string) => getSyncTimestamp(db, tableName),
    setSyncTimestamp: (tableName: string) => setSyncTimestamp(db, tableName),
    getDatabase: () => Promise.resolve(db),

    // ==================== RESET & CLEAR OPERATIONS ====================
    clearAllData: async () => {

      const storesToClear = [
        'admins', 'restaurants', 'menu_categories', 'menu_items',
        'orders', 'order_items', 'feedback', 'reviews', 'advertisements',
        'app_settings', 'settings', 'delivery_persons', 'delivery_assignments',
        'notifications', 'payments', 'users', 'profiles'
      ];

      for (const storeName of storesToClear) {
        if (db.objectStoreNames.contains(storeName)) {
          const tx = db.transaction(storeName, 'readwrite');
          tx.objectStore(storeName).clear();
          await new Promise((resolve) => {
            tx.oncomplete = resolve;
            tx.onerror = () => {
              console.error('[AdminsDB] Error clearing', storeName, tx.error);
              resolve(true);
            };
          });
        }
      }
    },

    clearSyncTimestamps: async () => {

      if (db.objectStoreNames.contains('sync_log')) {
        const tx = db.transaction('sync_log', 'readwrite');
        tx.objectStore('sync_log').clear();
        await new Promise((resolve) => {
          tx.oncomplete = resolve;
          tx.onerror = () => {
            console.error('[AdminsDB] Error clearing sync_log', tx.error);
            resolve(true);
          };
        });
      }
    },
  };
};
export const recreateDatabase = async () => {
  
  return new Promise<void>((resolve, reject) => {
    // Close existing connection
    if (dbInstance) {
      dbInstance.close();
      dbInstance = null;
    }
    
    // Delete the database
    const deleteRequest = indexedDB.deleteDatabase(DB_NAME);
    
    deleteRequest.onsuccess = () => {
      // Reset init promise so it will recreate on next use
      initPromise = null;
      resolve();
    };
    
    deleteRequest.onerror = (err) => {
      console.error('[AdminsDB] ❌ Error deleting database:', err);
      reject(err);
    };
  });
};
