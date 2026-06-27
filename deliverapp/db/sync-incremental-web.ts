/**
 * Deliver App Web - Incremental Sync with Base64 Images
 * Drop-in replacement for syncWithSupabase in deliverapp/db/index.web.ts
 *
 * Usage: Replace the existing syncWithSupabase function with this one
 * 
 * NOTE: This file is not currently in use. It's a template for future implementation.
 */

// Imports commented out - file not in use
// import { imageUrlToBase64 } from '@/utils/image-base64-utils';
// import { supabase, SUPABASE_URL } from '@/lib/supabase';
// import { checkOnlineStatus } from '@/lib/network-utils';
// import { putRecord, putRecords } from './index.web';

// Helper functions
const initSyncLog = async (db: IDBDatabase): Promise<void> => {
  if (!db.objectStoreNames.contains('sync_log')) {
    console.warn('[DeliverDB] sync_log store not available');
    return;
  }
};

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

const updateSyncTimestamp = async (db: IDBDatabase, tableName: string): Promise<void> => {
  if (!db.objectStoreNames.contains('sync_log')) {
    console.warn('[DeliverDB] sync_log store not available, skipping timestamp update');
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

// Main sync function - INCREMENTAL with BASE64 IMAGES
// NOTE: This function is not currently in use due to missing dependencies
/*
const syncWithSupabaseIncremental = async () => {

  // Check if supabase is available
  if (!supabase) {
    console.warn('[DeliverDB] ⚠️ syncWithSupabase: Supabase client not configured');
    return;
  }

  // Check if online
  const isOnline = await checkOnlineStatus();

  if (!isOnline) {
    return;
  }

  try {
    // Get database
    const { getDatabase: getDb } = await import('./index.web');
    const db = await getDb();
    
    // Initialize sync_log table
    await initSyncLog(db as any);

    // ===== SYNC RESTAURANTS (INCREMENTAL with BASE64) =====
    const lastSyncRestaurants = await getLastSyncTimestamp(db as any, 'restaurants');

    const { data: restaurants, error: restaurantsError } = await supabase
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
            console.warn('[DeliverDB] ⚠️ Failed to convert image for:', r.name, err);
          }
        }

        await putRecord(db as any, 'restaurants', { ...r, ...base64Data });
      }
    await updateSyncTimestamp(db as any, 'restaurants');

    // ===== SYNC ORDERS (INCREMENTAL, no images) =====
    const lastSyncOrders = await getLastSyncTimestamp(db as any, 'orders');

    const { data: orders, error: ordersError } = await supabase
      .from('orders')
      .select('*')
      .is('deleted_at', null)
      .gte('updated_at', lastSyncOrders);

    if (ordersError) {
      console.error('[DeliverDB] ❌ Orders error:', ordersError);
    } else if (orders && orders.length > 0) {
      await putRecords(db as any, 'orders', orders as any[]);
    await updateSyncTimestamp(db as any, 'orders');

    // ===== SYNC DELIVERY ASSIGNMENTS (INCREMENTAL, no images) =====
    const lastSyncAssignments = await getLastSyncTimestamp(db as any, 'delivery_assignments');

    const { data: deliveryAssignments, error: assignmentsError } = await supabase
      .from('delivery_assignments')
      .select('*')
      .is('deleted_at', null)
      .gte('updated_at', lastSyncAssignments);

    if (assignmentsError) {
      console.error('[DeliverDB] ❌ Delivery assignments error:', assignmentsError);
    } else if (deliveryAssignments && deliveryAssignments.length > 0) {
      await putRecords(db as any, 'delivery_assignments', deliveryAssignments as any[]);
    await updateSyncTimestamp(db as any, 'delivery_assignments');

    // ===== SYNC DELIVERY PERSONS (INCREMENTAL with BASE64) =====
    const lastSyncDeliveryPersons = await getLastSyncTimestamp(db as any, 'delivery_persons');

    const { data: deliveryPersons, error: deliveryPersonsError } = await supabase
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
            console.warn('[DeliverDB] ⚠️ Failed to convert image for:', person.name, err);
          }
        }
        await putRecord(db as any, 'delivery_persons', person);
      }
    await updateSyncTimestamp(db as any, 'delivery_persons');

    console.error('[DeliverDB] ========================================');
    console.error('[DeliverDB] ❌❌❌ syncWithSupabase ERROR:', error);
    console.error('[DeliverDB] ========================================');
    throw error;
  }
};
*/

// Helper: Check if online
// const checkOnline = async (): Promise<boolean> => {
//   try {
//     const response = await fetch(SUPABASE_URL, { method: 'HEAD', mode: 'no-cors' });
//     return true;
//   } catch {
//     return false;
//   }
// };

// export { syncWithSupabaseIncremental };
