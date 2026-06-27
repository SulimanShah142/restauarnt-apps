// Web Database Implementation using raw IndexedDB for Deliver App
// Simple, lightweight database layer without RxDB overhead
// Comprehensive debugging console logs included

import { DatabaseInterface } from './types';
import { TABLES } from './schema';
import { imageUrlToBase64 } from '@/utils/image-base64-utils';

// IndexedDB database name and version
const DB_NAME = 'deliverapp_db';
const DB_VERSION = 1;

// Open/create IndexedDB database
const openDB = (): Promise<IDBDatabase> => {
  
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => {
      console.error('[DeliverDB] ❌ IndexedDB error:', request.error);
      reject(request.error);
    };

    request.onsuccess = () => {
      resolve(request.result);
    };

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;

      // Create object stores for delivery-focused tables
      const stores = [
        'orders', 'order_items', 'delivery_persons', 'delivery_assignments',
        'delivery_statistics', 'restaurants', 'notifications',
        'users', 'profiles', 'location_tracking', 'sync_log'
      ];

      for (const storeName of stores) {
        if (!db.objectStoreNames.contains(storeName)) {
          const store = db.createObjectStore(storeName, { keyPath: 'id' });
          store.createIndex('updated_at', 'updated_at', { unique: false });
          store.createIndex('created_at', 'created_at', { unique: false });

          // Add specific indexes based on table
          if (storeName === 'orders') {
            store.createIndex('status', 'status', { unique: false });
            store.createIndex('delivery_person_id', 'delivery_person_id', { unique: false });
            store.createIndex('restaurant_id', 'restaurant_id', { unique: false });
            store.createIndex('user_id', 'user_id', { unique: false });
          } else if (storeName === 'delivery_assignments') {
            store.createIndex('delivery_person_id', 'delivery_person_id', { unique: false });
            store.createIndex('order_id', 'order_id', { unique: false });
            store.createIndex('status', 'status', { unique: false });
          } else if (storeName === 'delivery_persons') {
            store.createIndex('is_available', 'is_available', { unique: false });
            store.createIndex('user_id', 'user_id', { unique: false });
          } else if (storeName === 'delivery_statistics') {
            store.createIndex('delivery_person_id', 'delivery_person_id', { unique: false });
            store.createIndex('order_id', 'order_id', { unique: false });
          } else if (storeName === 'notifications') {
            store.createIndex('user_id', 'user_id', { unique: false });
            store.createIndex('is_read', 'is_read', { unique: false });
          } else if (storeName === 'location_tracking') {
            store.createIndex('delivery_person_id', 'delivery_person_id', { unique: false });
            store.createIndex('order_id', 'order_id', { unique: false });
          }
        }
      };

      db.onerror = () => {
        reject(new Error('Failed to open database'));
      };
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
      console.error('[DeliverDB] ❌ Error getting all from store:', storeName, request.error);
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
      resolve(request.result as T || null);
    };
    request.onerror = () => {
      console.error('[DeliverDB] ❌ Error getting record by ID:', id, request.error);
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
      console.error('[DeliverDB] ❌ Error putting record:', record.id, request.error);
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
            console.warn('[DeliverDB] ⚠️ putRecords completed with', errors, 'errors');
          }
          resolve();
        }
      };
      request.onerror = () => {
        errors++;
        console.error('[DeliverDB] ❌ Error putting record:', record.id, request.error);
        if (completed + errors === records.length) {
          console.warn('[DeliverDB] ⚠️ putRecords completed with', errors, 'errors');
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
      console.error('[DeliverDB] ❌ Error clearing store:', storeName, request.error);
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
      console.error('[DeliverDB] ❌ Error deleting record:', id, request.error);
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
        console.warn('[DeliverDB] ⚠️ Error getting sync timestamp:', request.error);
        resolve('1970-01-01T00:00:00.000Z');
      };
    } catch (error) {
      console.warn('[DeliverDB] ⚠️ getSyncTimestamp error:', error);
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
      const request = store.put({ table_name: tableName, sync_timestamp: now });

      request.onsuccess = () => {
        resolve();
      };
      request.onerror = () => {
        console.warn('[DeliverDB] ⚠️ Error setting sync timestamp:', request.error);
        resolve(); // Don't reject, sync should continue
      };
    } catch (error) {
      console.warn('[DeliverDB] ⚠️ setSyncTimestamp error:', error);
      resolve(); // Don't reject, sync should continue
    }
  });
};

// ==================== SYNC LOG HELPERS (for incremental sync) ====================

// Initialize sync_log table for tracking incremental sync timestamps
const initSyncLog = async (db: IDBDatabase): Promise<void> => {
  if (!db.objectStoreNames.contains('sync_log')) {
    console.warn('[DeliverDB] sync_log store not available');
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
  if (!db.objectStoreNames.contains('sync_log')) {
    console.warn('[DeliverDB] 🕐 sync_log store not available, skipping timestamp update');
    return;
  }

  return new Promise((resolve, reject) => {
    const tx = db.transaction('sync_log', 'readwrite');
    const store = tx.objectStore('sync_log');
    const request = store.put({
      table_name: tableName,
      sync_timestamp: new Date().toISOString()
    });

    request.onsuccess = () => resolve();
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
// Note: Also check for typo variant (ANNON instead of ANON)
const SUPABASE_ANON_KEY = getEnvVar('EXPO_PUBLIC_SUPABASE_ANON_KEY') || getEnvVar('EXPO_PUBLIC_SUPABASE_ANNON_KEY') || getEnvVar('EXPO_PUBLIC_SUPABASE_KEY') || '';


// Only create Supabase client if we have both URL and key
let supabaseClient: ReturnType<typeof createClient> | null = null;
if (SUPABASE_URL && SUPABASE_ANON_KEY) {
  supabaseClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  console.warn('[DeliverDB] ⚠️ Supabase client NOT created - missing configuration');
  console.warn('[DeliverDB] URL present:', !!SUPABASE_URL, '| Key present:', !!SUPABASE_ANON_KEY);
}

export const getDatabase = async (): Promise<DatabaseInterface> => {
  const db = await ensureDbInitialized();

  return {
    // ==================== ORDER OPERATIONS ====================
    getOrders: async (status?: string) => {
      try {
        const all = await getAllFromStore(db, 'orders');
        let filtered = all;
        if (status) {
          filtered = all.filter((o: any) => o.status === status);
        }
        // Sort by created_at descending (newest first)
        filtered.sort((a: any, b: any) => 
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        );
        return filtered;
      } catch (error) {
        console.error('[DeliverDB] getOrders: Error:', error);
        return [];
      }
    },

    getOrderById: async (orderId: string) => {
      try {
        const result = await getById(db, 'orders', orderId);
        return result;
      } catch (error) {
        console.error('[DeliverDB] getOrderById: Error:', error);
        return null;
      }
    },

    updateOrderStatus: async (orderId: string, status: string, additionalData?: any) => {
      try {
        const order = await getById(db, 'orders', orderId);
        if (!order) {
          console.error('[DeliverDB] updateOrderStatus: Order not found:', orderId);
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
        console.error('[DeliverDB] updateOrderStatus: Error:', error);
        throw error;
      }
    },

    updateOrder: async (orderId: string, data: any) => {
      try {
        const existing = await getById(db, 'orders', orderId);
        if (!existing) {
          console.error('[DeliverDB] updateOrder: Order not found:', orderId);
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
        console.error('[DeliverDB] updateOrder: Error:', error);
        throw error;
      }
    },

    // ==================== DELIVERY ASSIGNMENT OPERATIONS ====================
    getDeliveryAssignments: async (deliveryPersonId?: string) => {
      try {
        const all = await getAllFromStore(db, 'delivery_assignments');
        let filtered = all;
        if (deliveryPersonId) {
          filtered = all.filter((a: any) => a.delivery_person_id === deliveryPersonId);
        }
        // Sort by assigned_at descending
        filtered.sort((a: any, b: any) => 
          new Date(b.assigned_at || b.created_at).getTime() - new Date(a.assigned_at || a.created_at).getTime()
        );
        return filtered;
      } catch (error) {
        console.error('[DeliverDB] getDeliveryAssignments: Error:', error);
        return [];
      }
    },

    getDeliveryAssignmentById: async (assignmentId: string) => {
      try {
        const result = await getById(db, 'delivery_assignments', assignmentId);
        return result;
      } catch (error) {
        console.error('[DeliverDB] getDeliveryAssignmentById: Error:', error);
        return null;
      }
    },

    createDeliveryAssignment: async (assignmentData: any) => {
      try {
        const assignment = {
          ...assignmentData,
          assigned_at: new Date().toISOString(),
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        };
        await putRecord(db, 'delivery_assignments', assignment);
        return assignment;
      } catch (error) {
        console.error('[DeliverDB] createDeliveryAssignment: Error:', error);
        throw error;
      }
    },

    updateDeliveryAssignment: async (assignmentId: string, assignmentData: any) => {
      try {
        const existing = await getById(db, 'delivery_assignments', assignmentId);
        if (!existing) {
          console.error('[DeliverDB] updateDeliveryAssignment: Assignment not found:', assignmentId);
          throw new Error(`Delivery assignment ${assignmentId} not found`);
        }
        const updated = { 
          ...existing, 
          ...assignmentData, 
          id: assignmentId,
          updated_at: new Date().toISOString() 
        };
        await putRecord(db, 'delivery_assignments', updated);
        return updated;
      } catch (error) {
        console.error('[DeliverDB] updateDeliveryAssignment: Error:', error);
        throw error;
      }
    },

    deleteDeliveryAssignment: async (assignmentId: string) => {
      try {
        await deleteRecord(db, 'delivery_assignments', assignmentId);
        return { id: assignmentId, deleted: true };
      } catch (error) {
        console.error('[DeliverDB] deleteDeliveryAssignment: Error:', error);
        throw error;
      }
    },

    // ==================== DELIVERY PERSON OPERATIONS ====================
    getDeliveryPersonById: async (personId: string) => {
      try {
        const result = await getById(db, 'delivery_persons', personId);
        return result;
      } catch (error) {
        console.error('[DeliverDB] getDeliveryPersonById: Error:', error);
        return null;
      }
    },

    getDeliveryPersons: async () => {
      try {
        const all = await getAllFromStore(db, 'delivery_persons');
        return all;
      } catch (error) {
        console.error('[DeliverDB] getDeliveryPersons: Error:', error);
        return [];
      }
    },

    updateDeliveryPerson: async (personId: string, data: any) => {
      try {
        const existing = await getById(db, 'delivery_persons', personId);
        if (!existing) {
          console.error('[DeliverDB] updateDeliveryPerson: Delivery person not found:', personId);
          throw new Error(`Delivery person ${personId} not found`);
        }
        const updated = { 
          ...existing, 
          ...data, 
          id: personId,
          updated_at: new Date().toISOString() 
        };
        await putRecord(db, 'delivery_persons', updated);
        return updated;
      } catch (error) {
        console.error('[DeliverDB] updateDeliveryPerson: Error:', error);
        throw error;
      }
    },

    updateDeliveryPersonLocation: async (personId: string, lat: number, lng: number) => {
      try {
        const person = await getById(db, 'delivery_persons', personId);
        if (!person) {
          console.error('[DeliverDB] updateDeliveryPersonLocation: Delivery person not found:', personId);
          throw new Error(`Delivery person ${personId} not found`);
        }
        const updated = { 
          ...person, 
          current_latitude: lat, 
          current_longitude: lng,
          current_location: { latitude: lat, longitude: lng },
          updated_at: new Date().toISOString() 
        };
        await putRecord(db, 'delivery_persons', updated);
        return updated;
      } catch (error) {
        console.error('[DeliverDB] updateDeliveryPersonLocation: Error:', error);
        throw error;
      }
    },

    createDeliveryPerson: async (data: any) => {
      try {
        const deliveryPerson = {
          ...data,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        };
        await putRecord(db, 'delivery_persons', deliveryPerson);
        return deliveryPerson;
      } catch (error) {
        console.error('[DeliverDB] createDeliveryPerson: Error:', error);
        throw error;
      }
    },

    // ==================== DELIVERY STATISTICS OPERATIONS ====================
    getDeliveryStatistics: async (deliveryPersonId?: string) => {
      try {
        const all = await getAllFromStore(db, 'delivery_statistics');
        let filtered = all;
        if (deliveryPersonId) {
          filtered = all.filter((s: any) => s.delivery_person_id === deliveryPersonId);
        }
        // Sort by created_at descending
        filtered.sort((a: any, b: any) => 
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        );
        return filtered;
      } catch (error) {
        console.error('[DeliverDB] getDeliveryStatistics: Error:', error);
        return [];
      }
    },

    createDeliveryStatistic: async (data: any) => {
      try {
        const statistic = {
          ...data,
          created_at: new Date().toISOString()
        };
        await putRecord(db, 'delivery_statistics', statistic);
        return statistic;
      } catch (error) {
        console.error('[DeliverDB] createDeliveryStatistic: Error:', error);
        throw error;
      }
    },

    // ==================== LOCATION TRACKING OPERATIONS ====================
    addLocationTracking: async (trackingData: any) => {
      try {
        const tracking = {
          ...trackingData,
          timestamp: new Date().toISOString()
        };
        await putRecord(db, 'location_tracking', tracking);
        return tracking;
      } catch (error) {
        console.error('[DeliverDB] addLocationTracking: Error:', error);
        throw error;
      }
    },

    getLocationHistory: async (deliveryPersonId: string, orderId: string) => {
      try {
        const all = await getAllFromStore(db, 'location_tracking');
        const filtered = all.filter((t: any) => 
          t.delivery_person_id === deliveryPersonId && t.order_id === orderId
        );
        // Sort by timestamp ascending
        filtered.sort((a: any, b: any) => 
          new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
        );
        return filtered;
      } catch (error) {
        console.error('[DeliverDB] getLocationHistory: Error:', error);
        return [];
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
        console.error('[DeliverDB] getNotifications: Error:', error);
        return [];
      }
    },

    createNotification: async (data: any) => {
      try {
        const notification = {
          ...data,
          is_read: false,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        };
        await putRecord(db, 'notifications', notification);
        return notification;
      } catch (error) {
        console.error('[DeliverDB] createNotification: Error:', error);
        throw error;
      }
    },

    markNotificationAsRead: async (id: string) => {
      try {
        const existing = await getById(db, 'notifications', id);
        if (!existing) {
          console.error('[DeliverDB] markNotificationAsRead: Notification not found:', id);
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
        console.error('[DeliverDB] markNotificationAsRead: Error:', error);
        throw error;
      }
    },

    deleteNotification: async (id: string) => {
      try {
        await deleteRecord(db, 'notifications', id);
        return { id, deleted: true };
      } catch (error) {
        console.error('[DeliverDB] deleteNotification: Error:', error);
        throw error;
      }
    },

    // ==================== RESTAURANT OPERATIONS ====================
    getRestaurants: async () => {
      try {
        const all = await getAllFromStore(db, 'restaurants');
        const active = all.filter((r: any) => r.is_active !== false && r.is_available !== false);
        return active;
      } catch (error) {
        console.error('[DeliverDB] getRestaurants: Error:', error);
        return [];
      }
    },

    getRestaurantById: async (id: string) => {
      try {
        const result = await getById(db, 'restaurants', id);
        return result;
      } catch (error) {
        console.error('[DeliverDB] getRestaurantById: Error:', error);
        return null;
      }
    },

    // ==================== SYNC WITH SUPABASE (INCREMENTAL with BASE64) ====================
    syncWithSupabase: async () => {

      // Check if supabaseClient is available
      if (!supabaseClient) {
        console.warn('[DeliverDB] ⚠️ syncWithSupabase: Supabase client not configured');
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

        // ===== SYNC RESTAURANTS (INCREMENTAL with BASE64) =====
        const lastSyncRestaurants = await getLastSyncTimestamp(db, 'restaurants');

        const { data: restaurants, error: restaurantsError } = await supabaseClient
          .from('restaurants')
          .select('*')
          .is('deleted_at', null)
          .gte('updated_at', lastSyncRestaurants);

        if (restaurantsError) {
          console.error('[DeliverDB] ❌ Restaurants error:', restaurantsError);
        } else if (restaurants && restaurants.length > 0) {
          const activeCount = restaurants.filter((r: any) => r.is_active !== false && r.is_available !== false).length;

          // Convert images to base64
          for (const r of restaurants as any[]) {
            const base64Data: any = {};

            if (r.image_url && r.image_url.startsWith('http')) {
              try {
                base64Data.image_base64 = await imageUrlToBase64(r.image_url);
              } catch (err) {
                console.warn('[DeliverDB] ⚠️ Failed to convert image for:', r.name, err);
              }
            }

            await putRecord(db, 'restaurants', { ...r, ...base64Data });
          }
          await updateSyncTimestamp(db, 'restaurants');
        }

        // ===== SYNC ORDERS (INCREMENTAL, no images) =====
        const lastSyncOrders = await getLastSyncTimestamp(db, 'orders');

        const { data: orders, error: ordersError } = await supabaseClient
          .from('orders')
          .select('*')
          .is('deleted_at', null)
          .gte('updated_at', lastSyncOrders);

        if (ordersError) {
          console.error('[DeliverDB] ❌ Orders error:', ordersError);
        } else if (orders && orders.length > 0) {
          await putRecords(db, 'orders', orders);
        }
        await updateSyncTimestamp(db, 'orders');

        // ===== SYNC DELIVERY ASSIGNMENTS (INCREMENTAL, no images) =====
        const lastSyncAssignments = await getLastSyncTimestamp(db, 'delivery_assignments');

        const { data: deliveryAssignments, error: assignmentsError } = await supabaseClient
          .from('delivery_assignments')
          .select('*')
          .is('deleted_at', null)
          .gte('updated_at', lastSyncAssignments);

        if (assignmentsError) {
          console.error('[DeliverDB] ❌ Delivery assignments error:', assignmentsError);
        } else if (deliveryAssignments && deliveryAssignments.length > 0) {
          await putRecords(db, 'delivery_assignments', deliveryAssignments);
        }
        await updateSyncTimestamp(db, 'delivery_assignments');

        // ===== SYNC DELIVERY PERSONS (INCREMENTAL with BASE64) =====
        const lastSyncDeliveryPersons = await getLastSyncTimestamp(db, 'delivery_persons');

        const { data: deliveryPersons, error: deliveryPersonsError } = await supabaseClient
          .from('delivery_persons')
          .select('*')
          .is('deleted_at', null)
          .gte('updated_at', lastSyncDeliveryPersons);

        if (deliveryPersonsError) {
          console.error('[DeliverDB] ❌ Delivery persons error:', deliveryPersonsError);
        } else if (deliveryPersons && deliveryPersons.length > 0) {
          // Convert images to base64
          for (const person of deliveryPersons as any[]) {
            if (person.image_url && person.image_url.startsWith('http')) {
              try {
                const image_base64 = await imageUrlToBase64(person.image_url);
                person.image_base64 = image_base64;
              } catch (err) {
                console.warn('[DeliverDB] ⚠️ Failed to convert image for:', person.name, err);
              }
            }
            await putRecord(db, 'delivery_persons', person);
          }
        }
        await updateSyncTimestamp(db, 'delivery_persons');
      } catch (error) {
        console.error('[DeliverDB] ========================================');
        console.error('[DeliverDB] ❌❌❌ syncWithSupabase ERROR:', error);
        console.error('[DeliverDB] ========================================');
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

    // ==================== GENERIC DATABASE OPERATIONS ====================
    runAsync: async (sql: string, params?: any[]) => {
      // IndexedDB doesn't support SQL, this is a placeholder for compatibility
      // For web, we use the specific methods instead
      throw new Error('runAsync not supported on IndexedDB. Use specific database methods instead.');
    },

    getAsync: async (sql: string, params?: any[]) => {
      // IndexedDB doesn't support SQL, this is a placeholder for compatibility
      // For web, we use the specific methods instead
      throw new Error('getAsync not supported on IndexedDB. Use specific database methods instead.');
    },

    getAllAsync: async (sql: string, params?: any[]) => {
      // IndexedDB doesn't support SQL, this is a placeholder for compatibility
      // For web, we use the specific methods instead
      throw new Error('getAllAsync not supported on IndexedDB. Use specific database methods instead.');
    }
  };
};
