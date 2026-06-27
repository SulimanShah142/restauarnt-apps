import { getDatabase, initializeDatabase } from './db-init';
import { supabase } from './supabase';
import * as Network from 'expo-network';

// Database instance - will be initialized when needed
let db = null;

// Initialize the database when the module loads
async function initDb() {
  await initializeDatabase();
  db = getDatabase();
}

// Initialize the database
initDb();

/**
 * Check if the device is online
 * @returns {Promise<boolean>} True if online, false otherwise
 */
export async function isOnline() {
  try {
    const networkState = await Network.getNetworkStateAsync();
    return networkState.isConnected === true;
  } catch (error) {
    console.log('Error checking network state:', error.message);
    return false;
  }
}

/**
 * Sync delivery persons from Supabase to SQLite
 */
export async function syncDeliveryPersons() {
  // Ensure database is initialized
  if (!db) {
    await initDb();
  }

  try {
    console.log("Starting delivery persons sync...");

    const online = await isOnline();
    if (!online) {
      console.log("Device is offline. Skipping sync.");
      return { success: false, message: "Device is offline" };
    }

    const { data, error } = await supabase
      .from('delivery_persons')
      .select(`
        *,
        users:user_id (
          name,
          email,
          phone,
          image_url
        )
      `);

    if (error) {
      console.error('Error fetching delivery persons from Supabase:', error);
      return { success: false, error };
    }

    if (data) {
      // Clear old data to prevent duplicates
      await db.execAsync('DELETE FROM delivery_persons');

      // Insert new data
      for (const person of data) {
        await db.runAsync(
          `INSERT INTO delivery_persons
           (id, created_at, updated_at, user_id, license_plate, vehicle_type,
            is_available, current_location, rating, total_deliveries, total_earnings,
            successful_deliveries, cancelled_deliveries, avg_rating)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            person.id, // UUID as string
            person.created_at,
            person.updated_at,
            person.user_id, // UUID as string
            person.license_plate,
            person.vehicle_type,
            person.is_available ? 1 : 0, // Convert boolean to integer for SQLite
            person.current_location ? JSON.stringify(person.current_location) : '{}',
            parseFloat(person.rating || 0),
            person.total_deliveries || 0,
            parseFloat(person.total_earnings || 0),
            person.successful_deliveries || 0,
            person.cancelled_deliveries || 0,
            parseFloat(person.avg_rating || 0)
          ]
        );
      }

      console.log(`Successfully synced ${data.length} delivery persons to local storage!`);
      return { success: true, count: data.length };
    }

    return { success: true, count: 0 };
  } catch (error) {
    console.error('Error syncing delivery persons:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Sync delivery statistics from Supabase to SQLite
 */
export async function syncDeliveryStatistics() {
  // Ensure database is initialized
  if (!db) {
    await initDb();
  }

  try {
    console.log("Starting delivery statistics sync...");

    const online = await isOnline();
    if (!online) {
      console.log("Device is offline. Skipping sync.");
      return { success: false, message: "Device is offline" };
    }

    const { data, error } = await supabase
      .from('delivery_statistics')
      .select('*');

    if (error) {
      console.error('Error fetching delivery statistics from Supabase:', error);
      return { success: false, error };
    }

    if (data) {
      // Clear old data to prevent duplicates
      await db.execAsync('DELETE FROM delivery_statistics');

      // Insert new data
      for (const stat of data) {
        await db.runAsync(
          `INSERT INTO delivery_statistics
           (id, created_at, updated_at, delivery_person_id, order_id, order_total_amount,
            delivery_fee, delivery_date, delivery_rating, delivery_tips,
            delivery_status, delivery_address, delivery_notes)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            stat.id, // UUID as string
            stat.created_at,
            stat.updated_at,
            stat.delivery_person_id, // UUID as string
            stat.order_id, // UUID as string
            parseFloat(stat.order_total_amount || 0),
            parseFloat(stat.delivery_fee || 0),
            stat.delivery_date,
            stat.delivery_rating || null,
            parseFloat(stat.delivery_tips || 0),
            stat.delivery_status || 'delivered',
            stat.delivery_address,
            stat.delivery_notes
          ]
        );
      }

      console.log(`Successfully synced ${data.length} delivery statistics to local storage!`);
      return { success: true, count: data.length };
    }

    return { success: true, count: 0 };
  } catch (error) {
    console.error('Error syncing delivery statistics:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Get delivery persons from SQLite cache
 */
export async function getDeliveryPersonsFromCache() {
  // Ensure database is initialized
  if (!db) {
    await initDb();
  }

  try {
    const rows = await db.getAllAsync('SELECT * FROM delivery_persons ORDER BY created_at DESC');
    return rows;
  } catch (error) {
    console.error('Error getting delivery persons from cache:', error);
    return [];
  }
}

/**
 * Get delivery statistics for a specific delivery person from SQLite cache
 */
export async function getDeliveryStatisticsByPersonId(personId) {
  // Ensure database is initialized
  if (!db) {
    await initDb();
  }

  try {
    const rows = await db.getAllAsync(
      'SELECT * FROM delivery_statistics WHERE delivery_person_id = ? ORDER BY delivery_date DESC',
      [personId]
    );
    return rows;
  } catch (error) {
    console.error('Error getting delivery statistics from cache:', error);
    return [];
  }
}

/**
 * Get delivery statistics from SQLite cache
 */
export async function getDeliveryStatisticsFromCache() {
  // Ensure database is initialized
  if (!db) {
    await initDb();
  }

  try {
    const rows = await db.getAllAsync('SELECT * FROM delivery_statistics ORDER BY delivery_date DESC');
    return rows;
  } catch (error) {
    console.error('Error getting delivery statistics from cache:', error);
    return [];
  }
}

/**
 * Full sync of delivery-related data
 */
export async function fullSync() {
  console.log("Starting full sync for delivery app...");

  const results = {
    deliveryPersons: await syncDeliveryPersons(),
    deliveryStatistics: await syncDeliveryStatistics()
  };

  console.log("Full sync completed:", results);
  return results;
}

// Export all functions
export default {
  isOnline,
  syncDeliveryPersons,
  syncDeliveryStatistics,
  getDeliveryPersonsFromCache,
  getDeliveryStatisticsByPersonId,
  getDeliveryStatisticsFromCache,
  fullSync
};