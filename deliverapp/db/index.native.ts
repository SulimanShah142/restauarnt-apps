// Native Database Implementation using Expo SQLite for Deliver App
// This file is only loaded on mobile platforms (iOS/Android)
// Comprehensive debugging console logs included

import * as SQLite from 'expo-sqlite';
import { DatabaseInterface } from './types';
import { SQLITE_SCHEMA, TABLES } from './schema';

// Database schema version - increment this when schema changes
const SCHEMA_VERSION = 4;

// Initialize database
let db: SQLite.SQLiteDatabase | null = null;

export const getDatabase = async (): Promise<DatabaseInterface> => {

  if (!db) {
    db = await SQLite.openDatabaseAsync('deliverapp.db');

    // Check schema version
    let currentVersion = 0;
    try {
      const result = await db.getFirstAsync<{ version: number }>(
        'SELECT version FROM schema_version LIMIT 1'
      );
      currentVersion = result?.version || 0;
    } catch (e) {
      // Table doesn't exist yet
      currentVersion = 0;
    }

    // If schema version changed, drop all tables and recreate
    if (currentVersion !== SCHEMA_VERSION) {
      console.log('[DeliverDB-Native] Schema version changed, recreating tables...');

      // Drop all tables
      await db.execAsync(`
        DROP TABLE IF EXISTS ${TABLES.ORDER_ITEMS};
        DROP TABLE IF EXISTS ${TABLES.ORDERS};
        DROP TABLE IF EXISTS ${TABLES.CART_ITEMS};
        DROP TABLE IF EXISTS ${TABLES.CARTS};
        DROP TABLE IF EXISTS ${TABLES.REVIEWS};
        DROP TABLE IF EXISTS ${TABLES.FEEDBACK};
        DROP TABLE IF EXISTS ${TABLES.ADDRESSES};
        DROP TABLE IF EXISTS ${TABLES.MENU_ITEMS};
        DROP TABLE IF EXISTS ${TABLES.MENU_CATEGORIES};
        DROP TABLE IF EXISTS ${TABLES.RESTAURANTS};
        DROP TABLE IF EXISTS ${TABLES.PROFILES};
        DROP TABLE IF EXISTS ${TABLES.USERS};
        DROP TABLE IF EXISTS sync_log;
        DROP TABLE IF EXISTS schema_version;
      `);
    }

    // Create tables using the shared schema
    await db.execAsync(SQLITE_SCHEMA);

    // Update schema version (id must be 1 due to CHECK constraint)
    await db.runAsync(
      'INSERT OR REPLACE INTO schema_version (id, version) VALUES (1, ?)',
      [SCHEMA_VERSION]
    );
  };

  return {
    // ==================== ORDER OPERATIONS ====================
    getOrders: async (status?: string) => {
      try {
        let sql = `SELECT * FROM ${TABLES.ORDERS}`;
        const params: (string | number | boolean | null)[] = [];

        if (status) {
          sql += ' WHERE status = ?';
          params.push(status);
        }

        sql += ' ORDER BY created_at DESC';

        const result = await db!.getAllAsync(sql, params);
        return result as any[];
      } catch (error) {
        console.error('[DeliverDB-Native] getOrders: Error:', error);
        return [];
      }
    },

    getOrderById: async (orderId: string) => {
      try {
        const result = await db!.getFirstAsync(
          `SELECT * FROM ${TABLES.ORDERS} WHERE id = ?`,
          [orderId]
        ) as any;
        return result;
      } catch (error) {
        console.error('[DeliverDB-Native] getOrderById: Error:', error);
        return null;
      }
    },

    updateOrderStatus: async (orderId: string, status: string, additionalData?: any) => {
      try {
        const updates = additionalData ? Object.keys(additionalData).map(key => `${key} = ?`).join(', ') : '';
        const values: (string | number | boolean | null)[] = additionalData ? Object.values(additionalData) : [];

        if (updates) {
          await db!.runAsync(
            `UPDATE ${TABLES.ORDERS} SET status = ?, ${updates}, updated_at = datetime('now') WHERE id = ?`,
            [...values, status, orderId] as (string | number | boolean | null)[]
          );
        } else {
          await db!.runAsync(
            `UPDATE ${TABLES.ORDERS} SET status = ?, updated_at = datetime('now') WHERE id = ?`,
            [status, orderId] as (string | number | boolean | null)[]
          );
        }

        const updated = await db!.getFirstAsync(
          `SELECT * FROM ${TABLES.ORDERS} WHERE id = ?`,
          [orderId]
        ) as any;

        return updated;
      } catch (error) {
        console.error('[DeliverDB-Native] updateOrderStatus: Error:', error);
        throw error;
      }
    },

    updateOrder: async (orderId: string, orderData: any) => {
      try {
        const updates = Object.keys(orderData)
          .filter(key => key !== 'id' && key !== 'created_at')
          .map(key => `${key} = ?`)
          .join(', ');

        const values: (string | number | boolean | null)[] = Object.values(orderData).filter((_, i) =>
          Object.keys(orderData)[i] !== 'id' && Object.keys(orderData)[i] !== 'created_at'
        ) as (string | number | boolean | null)[];
        values.push(orderId);

        await db!.runAsync(
          `UPDATE ${TABLES.ORDERS} SET ${updates}, updated_at = datetime('now') WHERE id = ?`,
          values
        );

        const updated = await db!.getFirstAsync(
          `SELECT * FROM ${TABLES.ORDERS} WHERE id = ?`,
          [orderId]
        ) as any;

        return updated;
      } catch (error) {
        console.error('[DeliverDB-Native] updateOrder: Error:', error);
        throw error;
      }
    },

    // ==================== DELIVERY ASSIGNMENT OPERATIONS ====================
    getDeliveryAssignments: async (deliveryPersonId?: string) => {
      try {
        let sql = `SELECT * FROM ${TABLES.DELIVERY_ASSIGNMENTS}`;
        const params: (string | number | boolean | null)[] = [];

        if (deliveryPersonId) {
          sql += ' WHERE delivery_person_id = ?';
          params.push(deliveryPersonId);
        }

        sql += ' ORDER BY assigned_at DESC';

        const result = await db!.getAllAsync(sql, params);
        return result as any[];
      } catch (error) {
        console.error('[DeliverDB-Native] getDeliveryAssignments: Error:', error);
        return [];
      }
    },

    getDeliveryAssignmentById: async (assignmentId: string) => {
      try {
        const result = await db!.getFirstAsync(
          `SELECT * FROM ${TABLES.DELIVERY_ASSIGNMENTS} WHERE id = ?`,
          [assignmentId]
        ) as any;
        return result;
      } catch (error) {
        console.error('[DeliverDB-Native] getDeliveryAssignmentById: Error:', error);
        return null;
      }
    },

    createDeliveryAssignment: async (assignmentData: any) => {
      try {
        const {
          id, order_id, delivery_person_id, delivery_address, notes,
          phone_number, status
        } = assignmentData;

        await db!.runAsync(
          `INSERT INTO ${TABLES.DELIVERY_ASSIGNMENTS}
           (id, order_id, delivery_person_id, delivery_address, notes,
            phone_number, status, assigned_at, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'), datetime('now'))`,
          [
            id, order_id, delivery_person_id, delivery_address, notes,
            phone_number, status || 'pending'
          ] as (string | number | boolean | null)[]
        );

        return { id, ...assignmentData };
      } catch (error) {
        console.error('[DeliverDB-Native] createDeliveryAssignment: Error:', error);
        throw error;
      }
    },

    updateDeliveryAssignment: async (assignmentId: string, assignmentData: any) => {
      try {
        const updates = Object.keys(assignmentData)
          .filter(key => key !== 'id' && key !== 'created_at' && key !== 'assigned_at')
          .map(key => `${key} = ?`)
          .join(', ');

        const values: (string | number | boolean | null)[] = Object.values(assignmentData).filter((_, i) =>
          Object.keys(assignmentData)[i] !== 'id' && Object.keys(assignmentData)[i] !== 'created_at' && Object.keys(assignmentData)[i] !== 'assigned_at'
        ) as (string | number | boolean | null)[];
        values.push(assignmentId);

        await db!.runAsync(
          `UPDATE ${TABLES.DELIVERY_ASSIGNMENTS} SET ${updates}, updated_at = datetime('now') WHERE id = ?`,
          values
        );

        const updated = await db!.getFirstAsync(
          `SELECT * FROM ${TABLES.DELIVERY_ASSIGNMENTS} WHERE id = ?`,
          [assignmentId]
        ) as any;

        return updated;
      } catch (error) {
        console.error('[DeliverDB-Native] updateDeliveryAssignment: Error:', error);
        throw error;
      }
    },

    deleteDeliveryAssignment: async (assignmentId: string) => {
      try {
        const result = await db!.runAsync(
          `DELETE FROM ${TABLES.DELIVERY_ASSIGNMENTS} WHERE id = ?`,
          [assignmentId] as (string | number | boolean | null)[]
        );

        return { id: assignmentId, changes: result.changes };
      } catch (error) {
        console.error('[DeliverDB-Native] deleteDeliveryAssignment: Error:', error);
        throw error;
      }
    },

    // ==================== DELIVERY PERSON OPERATIONS ====================
    getDeliveryPersonById: async (personId: string) => {
      try {
        const result = await db!.getFirstAsync(
          `SELECT * FROM ${TABLES.DELIVERY_PERSONS} WHERE id = ?`,
          [personId]
        ) as any;
        return result;
      } catch (error) {
        console.error('[DeliverDB-Native] getDeliveryPersonById: Error:', error);
        return null;
      }
    },

    getDeliveryPersons: async () => {
      try {
        const result = await db!.getAllAsync(
          `SELECT * FROM ${TABLES.DELIVERY_PERSONS} ORDER BY name`
        );
        return result as any[];
      } catch (error) {
        console.error('[DeliverDB-Native] getDeliveryPersons: Error:', error);
        return [];
      }
    },

    updateDeliveryPerson: async (personId: string, data: any) => {
      try {
        const updates = Object.keys(data)
          .filter(key => key !== 'id' && key !== 'created_at')
          .map(key => `${key} = ?`)
          .join(', ');

        const values: (string | number | boolean | null)[] = Object.values(data).filter((_, i) =>
          Object.keys(data)[i] !== 'id' && Object.keys(data)[i] !== 'created_at'
        ) as (string | number | boolean | null)[];
        values.push(personId);

        await db!.runAsync(
          `UPDATE ${TABLES.DELIVERY_PERSONS} SET ${updates}, updated_at = datetime('now') WHERE id = ?`,
          values
        );

        const updated = await db!.getFirstAsync(
          `SELECT * FROM ${TABLES.DELIVERY_PERSONS} WHERE id = ?`,
          [personId]
        ) as any;

        return updated;
      } catch (error) {
        console.error('[DeliverDB-Native] updateDeliveryPerson: Error:', error);
        throw error;
      }
    },

    updateDeliveryPersonLocation: async (personId: string, lat: number, lng: number) => {
      try {
        await db!.runAsync(
          `UPDATE ${TABLES.DELIVERY_PERSONS}
           SET current_latitude = ?, current_longitude = ?, current_location = ?, updated_at = datetime('now')
           WHERE id = ?`,
          [lat, lng, JSON.stringify({ latitude: lat, longitude: lng }), personId] as (string | number | boolean | null)[]
        );

        const updated = await db!.getFirstAsync(
          `SELECT * FROM ${TABLES.DELIVERY_PERSONS} WHERE id = ?`,
          [personId]
        ) as any;

        return updated;
      } catch (error) {
        console.error('[DeliverDB-Native] updateDeliveryPersonLocation: Error:', error);
        throw error;
      }
    },

    createDeliveryPerson: async (data: any) => {
      try {
        const {
          id, user_id, name, email, phone, vehicle_type, license_plate,
          is_available, current_latitude, current_longitude, rating
        } = data;

        await db!.runAsync(
          `INSERT INTO ${TABLES.DELIVERY_PERSONS}
           (id, user_id, name, email, phone, vehicle_type, license_plate,
            is_available, current_latitude, current_longitude, rating,
            created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))`,
          [
            id, user_id, name, email, phone, vehicle_type, license_plate,
            is_available !== false ? 1 : 0, current_latitude, current_longitude, rating
          ] as (string | number | boolean | null)[]
        );

        return { id, ...data };
      } catch (error) {
        console.error('[DeliverDB-Native] createDeliveryPerson: Error:', error);
        throw error;
      }
    },

    // ==================== DELIVERY STATISTICS OPERATIONS ====================
    getDeliveryStatistics: async (deliveryPersonId?: string) => {
      try {
        let sql = `SELECT * FROM ${TABLES.DELIVERY_STATISTICS}`;
        const params: (string | number | boolean | null)[] = [];

        if (deliveryPersonId) {
          sql += ' WHERE delivery_person_id = ?';
          params.push(deliveryPersonId);
        }

        sql += ' ORDER BY created_at DESC';

        const result = await db!.getAllAsync(sql, params);
        return result as any[];
      } catch (error) {
        console.error('[DeliverDB-Native] getDeliveryStatistics: Error:', error);
        return [];
      }
    },

    createDeliveryStatistic: async (data: any) => {
      try {
        const {
          id, delivery_person_id, order_id, order_total_amount, delivery_fee, delivery_status
        } = data;

        await db!.runAsync(
          `INSERT INTO ${TABLES.DELIVERY_STATISTICS}
           (id, delivery_person_id, order_id, order_total_amount, delivery_fee, delivery_status, created_at)
           VALUES (?, ?, ?, ?, ?, ?, datetime('now'))`,
          [id, delivery_person_id, order_id, order_total_amount, delivery_fee, delivery_status || 'delivered'] as (string | number | boolean | null)[]
        );

        return { id, ...data };
      } catch (error) {
        console.error('[DeliverDB-Native] createDeliveryStatistic: Error:', error);
        throw error;
      }
    },

    // ==================== LOCATION TRACKING OPERATIONS ====================
    addLocationTracking: async (trackingData: any) => {
      try {
        const {
          id, delivery_person_id, order_id, latitude, longitude, accuracy
        } = trackingData;

        await db!.runAsync(
          `INSERT INTO ${TABLES.LOCATION_TRACKING}
           (id, delivery_person_id, order_id, latitude, longitude, accuracy, timestamp)
           VALUES (?, ?, ?, ?, ?, ?, datetime('now'))`,
          [id, delivery_person_id, order_id, latitude, longitude, accuracy] as (string | number | boolean | null)[]
        );

        return { id, ...trackingData };
      } catch (error) {
        console.error('[DeliverDB-Native] addLocationTracking: Error:', error);
        throw error;
      }
    },

    getLocationHistory: async (deliveryPersonId: string, orderId: string) => {
      try {
        const result = await db!.getAllAsync(
          `SELECT * FROM ${TABLES.LOCATION_TRACKING}
           WHERE delivery_person_id = ? AND order_id = ?
           ORDER BY timestamp ASC`,
          [deliveryPersonId, orderId]
        );
        return result as any[];
      } catch (error) {
        console.error('[DeliverDB-Native] getLocationHistory: Error:', error);
        return [];
      }
    },

    // ==================== NOTIFICATION OPERATIONS ====================
    getNotifications: async (userId?: string) => {
      try {
        let sql = `SELECT * FROM ${TABLES.NOTIFICATIONS}`;
        const params: any[] = [];

        if (userId) {
          sql += ' WHERE user_id = ?';
          params.push(userId);
        }

        sql += ' ORDER BY created_at DESC';

        const result = await db!.getAllAsync(sql, params);
        return result as any[];
      } catch (error) {
        console.error('[DeliverDB-Native] getNotifications: Error:', error);
        return [];
      }
    },

    createNotification: async (data: any) => {
      try {
        const {
          id, user_id, title, message, type
        } = data;

        await db!.runAsync(
          `INSERT INTO ${TABLES.NOTIFICATIONS}
           (id, user_id, title, message, type, is_read, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, 0, datetime('now'), datetime('now'))`,
          [id, user_id, title, message, type || 'info'] as (string | number | boolean | null)[]
        );

        return { id, ...data };
      } catch (error) {
        console.error('[DeliverDB-Native] createNotification: Error:', error);
        throw error;
      }
    },

    markNotificationAsRead: async (id: string) => {
      try {
        await db!.runAsync(
          `UPDATE ${TABLES.NOTIFICATIONS} SET is_read = 1, updated_at = datetime('now') WHERE id = ?`,
          [id] as (string | number | boolean | null)[]
        );

        const updated = await db!.getFirstAsync(
          `SELECT * FROM ${TABLES.NOTIFICATIONS} WHERE id = ?`,
          [id]
        ) as any;

        return updated;
      } catch (error) {
        console.error('[DeliverDB-Native] markNotificationAsRead: Error:', error);
        throw error;
      }
    },

    deleteNotification: async (id: string) => {
      try {
        const result = await db!.runAsync(
          `DELETE FROM ${TABLES.NOTIFICATIONS} WHERE id = ?`,
          [id] as (string | number | boolean | null)[]
        );

        return { id, changes: result.changes };
      } catch (error) {
        console.error('[DeliverDB-Native] deleteNotification: Error:', error);
        throw error;
      }
    },

    // ==================== RESTAURANT OPERATIONS ====================
    getRestaurants: async () => {
      try {
        const result = await db!.getAllAsync(
          `SELECT * FROM ${TABLES.RESTAURANTS} WHERE is_active != 0 AND is_available != 0 ORDER BY name`
        );
        return result as any[];
      } catch (error) {
        console.error('[DeliverDB-Native] getRestaurants: Error:', error);
        return [];
      }
    },

    getRestaurantById: async (id: string) => {
      try {
        const result = await db!.getFirstAsync(
          `SELECT * FROM ${TABLES.RESTAURANTS} WHERE id = ?`,
          [id]
        ) as any;
        return result;
      } catch (error) {
        console.error('[DeliverDB-Native] getRestaurantById: Error:', error);
        return null;
      }
    },

    // ==================== SYNC WITH SUPABASE ====================
    syncWithSupabase: async () => {
      try {
        // Use fullSync from sync-utils for comprehensive sync
        const { fullSync } = await import('../sync-utils');
        await fullSync();
      } catch (error) {
        console.error('[DeliverDB-Native] syncWithSupabase: Error:', error);
        // Don't throw - allow app to continue with cached data
        console.warn('[DeliverDB-Native] syncWithSupabase: Continuing with cached data');
      }
    },

    // ==================== CLOSE DATABASE ====================
    close: async () => {
      // Expo SQLite doesn't have a close method in the current API
    },

    // ==================== GENERIC DATABASE OPERATIONS ====================
    runAsync: async (sql: string, params?: any[]) => {
      return await db!.runAsync(sql, params || []);
    },

    getAsync: async (sql: string, params?: any[]) => {
      return await db!.getFirstAsync(sql, params || []) as any;
    },

    getAllAsync: async (sql: string, params?: any[]) => {
      return await db!.getAllAsync(sql, params || []) as any[];
    }
  };
};
