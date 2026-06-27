// Native Database Implementation using Expo SQLite for Admins App
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
    db = await SQLite.openDatabaseAsync('adminsapp.db');

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
  }

  return {
    // ==================== RESTAURANT OPERATIONS ====================
    getRestaurants: async () => {
      try {
        // Admin app shows ALL restaurants (both active and inactive)
        const result = await db!.getAllAsync(
          `SELECT * FROM ${TABLES.RESTAURANTS} ORDER BY name`
        );
        return result as any[];
      } catch (error) {
        console.error('[AdminsDB-Native] getRestaurants: Error:', error);
        return [];
      }
    },

    getRestaurantById: async (restaurantId: string) => {
      try {
        const result = await db!.getFirstAsync(
          `SELECT * FROM ${TABLES.RESTAURANTS} WHERE id = ?`,
          [restaurantId]
        ) as any;
        return result;
      } catch (error) {
        console.error('[AdminsDB-Native] getRestaurantById: Error:', error);
        return null;
      }
    },

    createRestaurant: async (restaurantData: any) => {
      try {
        const {
          id, name, description, image_url, address, phone, email,
          latitude, longitude, delivery_fee, minimum_order, rating,
          is_active, is_available, owner_id, cuisine_type
        } = restaurantData;

        await db!.runAsync(
          `INSERT INTO ${TABLES.RESTAURANTS}
           (id, name, description, image_url, address, phone, email,
            latitude, longitude, delivery_fee, minimum_order, rating,
            is_active, is_available, owner_id, cuisine_type, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))`,
          [
            id, name, description, image_url, address, phone, email,
            latitude, longitude, delivery_fee, minimum_order, rating,
            is_active !== false ? 1 : 0, is_available !== false ? 1 : 0, owner_id, cuisine_type
          ]
        );

        return { id, ...restaurantData };
      } catch (error) {
        console.error('[AdminsDB-Native] createRestaurant: Error:', error);
        throw error;
      }
    },

    updateRestaurant: async (restaurantId: string, restaurantData: any) => {
      try {
        const updates = Object.keys(restaurantData)
          .filter(key => key !== 'id' && key !== 'created_at')
          .map(key => `${key} = ?`)
          .join(', ');

        const values = Object.values(restaurantData).filter((_, i) =>
          Object.keys(restaurantData)[i] !== 'id' && Object.keys(restaurantData)[i] !== 'created_at'
        ) as any[];
        values.push(restaurantId);

        await db!.runAsync(
          `UPDATE ${TABLES.RESTAURANTS} SET ${updates}, updated_at = datetime('now') WHERE id = ?`,
          values
        );

        const updated = await db!.getFirstAsync(
          `SELECT * FROM ${TABLES.RESTAURANTS} WHERE id = ?`,
          [restaurantId]
        ) as any;

        return updated;
      } catch (error) {
        console.error('[AdminsDB-Native] updateRestaurant: Error:', error);
        throw error;
      }
    },

    deleteRestaurant: async (restaurantId: string) => {
      try {
        const result = await db!.runAsync(
          `DELETE FROM ${TABLES.RESTAURANTS} WHERE id = ?`,
          [restaurantId]
        );

        return { id: restaurantId, changes: result.changes };
      } catch (error) {
        console.error('[AdminsDB-Native] deleteRestaurant: Error:', error);
        throw error;
      }
    },

    // ==================== MENU OPERATIONS ====================
    getMenuItemsByRestaurant: async (restaurantId: string) => {
      try {
        const result = await db!.getAllAsync(
          `SELECT mi.*, mc.name as category_name
           FROM ${TABLES.MENU_ITEMS} mi
           LEFT JOIN ${TABLES.MENU_CATEGORIES} mc ON mi.menu_category_id = mc.id
           WHERE mi.restaurant_id = ?
           ORDER BY mc.sort_order, mi.sort_order`,
          [restaurantId]
        );
        return result as any[];
      } catch (error) {
        console.error('[AdminsDB-Native] getMenuItemsByRestaurant: Error:', error);
        return [];
      }
    },

    getMenuCategoriesByRestaurant: async (restaurantId: string) => {
      try {
        const result = await db!.getAllAsync(
          `SELECT * FROM ${TABLES.MENU_CATEGORIES} WHERE restaurant_id = ? AND is_active != 0 ORDER BY sort_order`,
          [restaurantId]
        );
        return result as any[];
      } catch (error) {
        console.error('[AdminsDB-Native] getMenuCategoriesByRestaurant: Error:', error);
        return [];
      }
    },

    createMenuItem: async (menuItemData: any) => {
      try {
        const {
          id, restaurant_id, name, description, price, image_url, 
          menu_category_id, is_available, preparation_time, dietary_restrictions
        } = menuItemData;

        await db!.runAsync(
          `INSERT INTO ${TABLES.MENU_ITEMS}
           (id, restaurant_id, name, description, price, image_url, 
            menu_category_id, is_available, preparation_time, dietary_restrictions,
            created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))`,
          [
            id, restaurant_id, name, description, price, image_url,
            menu_category_id, is_available !== false ? 1 : 0, preparation_time, 
            dietary_restrictions ? JSON.stringify(dietary_restrictions) : null
          ]
        );

        return { id, ...menuItemData };
      } catch (error) {
        console.error('[AdminsDB-Native] createMenuItem: Error:', error);
        throw error;
      }
    },

    updateMenuItem: async (menuId: string, menuItemData: any) => {
      try {
        const updates = Object.keys(menuItemData)
          .filter(key => key !== 'id' && key !== 'created_at')
          .map(key => `${key} = ?`)
          .join(', ');

        const values = Object.values(menuItemData).filter((_, i) =>
          Object.keys(menuItemData)[i] !== 'id' && Object.keys(menuItemData)[i] !== 'created_at'
        ) as any[];
        values.push(menuId);

        await db!.runAsync(
          `UPDATE ${TABLES.MENU_ITEMS} SET ${updates}, updated_at = datetime('now') WHERE id = ?`,
          values
        );

        const updated = await db!.getFirstAsync(
          `SELECT * FROM ${TABLES.MENU_ITEMS} WHERE id = ?`,
          [menuId]
        ) as any;

        return updated;
      } catch (error) {
        console.error('[AdminsDB-Native] updateMenuItem: Error:', error);
        throw error;
      }
    },

    deleteMenuItem: async (menuId: string) => {
      try {
        const result = await db!.runAsync(
          `DELETE FROM ${TABLES.MENU_ITEMS} WHERE id = ?`,
          [menuId]
        );

        return { id: menuId, changes: result.changes };
      } catch (error) {
        console.error('[AdminsDB-Native] deleteMenuItem: Error:', error);
        throw error;
      }
    },

    createMenuCategory: async (categoryData: any) => {
      try {
        const {
          id, restaurant_id, name, description, image_url, sort_order, is_active
        } = categoryData;

        await db!.runAsync(
          `INSERT INTO ${TABLES.MENU_CATEGORIES}
           (id, restaurant_id, name, description, image_url, sort_order, is_active,
            created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))`,
          [
            id, restaurant_id, name, description, image_url, sort_order || 0,
            is_active !== false ? 1 : 0
          ]
        );

        return { id, ...categoryData };
      } catch (error) {
        console.error('[AdminsDB-Native] createMenuCategory: Error:', error);
        throw error;
      }
    },

    updateMenuCategory: async (categoryId: string, categoryData: any) => {
      try {
        const updates = Object.keys(categoryData)
          .filter(key => key !== 'id' && key !== 'created_at')
          .map(key => `${key} = ?`)
          .join(', ');

        const values = Object.values(categoryData).filter((_, i) =>
          Object.keys(categoryData)[i] !== 'id' && Object.keys(categoryData)[i] !== 'created_at'
        ) as any[];
        values.push(categoryId);

        await db!.runAsync(
          `UPDATE ${TABLES.MENU_CATEGORIES} SET ${updates}, updated_at = datetime('now') WHERE id = ?`,
          values
        );

        const updated = await db!.getFirstAsync(
          `SELECT * FROM ${TABLES.MENU_CATEGORIES} WHERE id = ?`,
          [categoryId]
        ) as any;

        return updated;
      } catch (error) {
        console.error('[AdminsDB-Native] updateMenuCategory: Error:', error);
        throw error;
      }
    },

    deleteMenuCategory: async (categoryId: string) => {
      try {
        const result = await db!.runAsync(
          `DELETE FROM ${TABLES.MENU_CATEGORIES} WHERE id = ?`,
          [categoryId]
        );

        return { id: categoryId, changes: result.changes };
      } catch (error) {
        console.error('[AdminsDB-Native] deleteMenuCategory: Error:', error);
        throw error;
      }
    },

    // ==================== ORDER OPERATIONS ====================
    getOrders: async (restaurantId?: string) => {
      try {
        let sql = `SELECT * FROM ${TABLES.ORDERS}`;
        const params: any[] = [];

        if (restaurantId) {
          sql += ' WHERE restaurant_id = ?';
          params.push(restaurantId);
        }

        sql += ' ORDER BY created_at DESC';

        const result = await db!.getAllAsync(sql, params);
        return result as any[];
      } catch (error) {
        console.error('[AdminsDB-Native] getOrders: Error:', error);
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
        console.error('[AdminsDB-Native] getOrderById: Error:', error);
        return null;
      }
    },

    updateOrderStatus: async (orderId: string, status: string, additionalData?: any) => {
      try {
        const updates = additionalData ? Object.keys(additionalData).map(key => `${key} = ?`).join(', ') : '';
        const values = additionalData ? Object.values(additionalData).map(v => v as string | number | boolean | null) : [];

        if (updates) {
          await db!.runAsync(
            `UPDATE ${TABLES.ORDERS} SET status = ?, ${updates}, updated_at = datetime('now') WHERE id = ?`,
            [...values, status, orderId] as any[]
          );
        } else {
          await db!.runAsync(
            `UPDATE ${TABLES.ORDERS} SET status = ?, updated_at = datetime('now') WHERE id = ?`,
            [status, orderId]
          );
        }

        const updated = await db!.getFirstAsync(
          `SELECT * FROM ${TABLES.ORDERS} WHERE id = ?`,
          [orderId]
        ) as any;

        return updated;
      } catch (error) {
        console.error('[AdminsDB-Native] updateOrderStatus: Error:', error);
        throw error;
      }
    },

    updateOrder: async (orderId: string, orderData: any) => {
      try {
        const updates = Object.keys(orderData)
          .filter(key => key !== 'id' && key !== 'created_at')
          .map(key => `${key} = ?`)
          .join(', ');

        const values = Object.values(orderData).filter((_, i) =>
          Object.keys(orderData)[i] !== 'id' && Object.keys(orderData)[i] !== 'created_at'
        ) as any[];
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
        console.error('[AdminsDB-Native] updateOrder: Error:', error);
        throw error;
      }
    },

    // ==================== ADMIN OPERATIONS ====================
    getAdmins: async () => {
      try {
        const result = await db!.getAllAsync(
          `SELECT * FROM ${TABLES.ADMINS} WHERE is_active != 0`
        );
        return result as any[];
      } catch (error) {
        console.error('[AdminsDB-Native] getAdmins: Error:', error);
        return [];
      }
    },

    getAdminById: async (adminId: string) => {
      try {
        const result = await db!.getFirstAsync(
          `SELECT * FROM ${TABLES.ADMINS} WHERE id = ?`,
          [adminId]
        ) as any;
        return result;
      } catch (error) {
        console.error('[AdminsDB-Native] getAdminById: Error:', error);
        return null;
      }
    },

    getAdminByUserId: async (userId: string) => {
      try {
        const result = await db!.getFirstAsync(
          `SELECT * FROM ${TABLES.ADMINS} WHERE user_id = ?`,
          [userId]
        ) as any;
        return result;
      } catch (error) {
        console.error('[AdminsDB-Native] getAdminByUserId: Error:', error);
        return null;
      }
    },

    createAdmin: async (adminData: any) => {
      try {
        const {
          id, user_id, role, permissions, is_active, session_token
        } = adminData;

        await db!.runAsync(
          `INSERT INTO ${TABLES.ADMINS}
           (id, user_id, role, permissions, is_active, session_token, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))`,
          [
            id, user_id, role || 'admin', 
            permissions ? JSON.stringify(permissions) : null,
            is_active !== false ? 1 : 0, session_token
          ]
        );

        return { id, ...adminData };
      } catch (error) {
        console.error('[AdminsDB-Native] createAdmin: Error:', error);
        throw error;
      }
    },

    updateAdmin: async (adminId: string, adminData: any) => {
      try {
        const updates = Object.keys(adminData)
          .filter(key => key !== 'id' && key !== 'created_at')
          .map(key => `${key} = ?`)
          .join(', ');

        const values = Object.values(adminData).filter((_, i) =>
          Object.keys(adminData)[i] !== 'id' && Object.keys(adminData)[i] !== 'created_at'
        ) as any[];
        values.push(adminId);

        await db!.runAsync(
          `UPDATE ${TABLES.ADMINS} SET ${updates}, updated_at = datetime('now') WHERE id = ?`,
          values
        );

        const updated = await db!.getFirstAsync(
          `SELECT * FROM ${TABLES.ADMINS} WHERE id = ?`,
          [adminId]
        ) as any;

        return updated;
      } catch (error) {
        console.error('[AdminsDB-Native] updateAdmin: Error:', error);
        throw error;
      }
    },

    deleteAdmin: async (adminId: string) => {
      try {
        const result = await db!.runAsync(
          `DELETE FROM ${TABLES.ADMINS} WHERE id = ?`,
          [adminId]
        );

        return { id: adminId, changes: result.changes };
      } catch (error) {
        console.error('[AdminsDB-Native] deleteAdmin: Error:', error);
        throw error;
      }
    },

    // ==================== FEEDBACK OPERATIONS ====================
    getFeedback: async (restaurantId?: string) => {
      try {
        let sql = `SELECT * FROM ${TABLES.FEEDBACK}`;
        const params: any[] = [];

        if (restaurantId) {
          sql += ' WHERE restaurant_id = ?';
          params.push(restaurantId);
        }

        sql += ' ORDER BY created_at DESC';

        const result = await db!.getAllAsync(sql, params);
        return result as any[];
      } catch (error) {
        console.error('[AdminsDB-Native] getFeedback: Error:', error);
        return [];
      }
    },

    createFeedback: async (feedbackData: any) => {
      try {
        const {
          id, user_id, title, comment, rating, is_resolved
        } = feedbackData;

        await db!.runAsync(
          `INSERT INTO ${TABLES.FEEDBACK}
           (id, user_id, title, comment, rating, is_resolved,
            created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))`,
          [
            id, user_id, title, comment, rating,
            is_resolved !== false ? 1 : 0
          ]
        );

        return { id, ...feedbackData };
      } catch (error) {
        console.error('[AdminsDB-Native] createFeedback: Error:', error);
        throw error;
      }
    },

    updateFeedback: async (feedbackId: string, feedbackData: any) => {
      try {
        const updates = Object.keys(feedbackData)
          .filter(key => key !== 'id' && key !== 'created_at')
          .map(key => `${key} = ?`)
          .join(', ');

        const values = Object.values(feedbackData).filter((_, i) =>
          Object.keys(feedbackData)[i] !== 'id' && Object.keys(feedbackData)[i] !== 'created_at'
        ) as any[];
        values.push(feedbackId);

        await db!.runAsync(
          `UPDATE ${TABLES.FEEDBACK} SET ${updates}, updated_at = datetime('now') WHERE id = ?`,
          values
        );

        const updated = await db!.getFirstAsync(
          `SELECT * FROM ${TABLES.FEEDBACK} WHERE id = ?`,
          [feedbackId]
        ) as any;

        return updated;
      } catch (error) {
        console.error('[AdminsDB-Native] updateFeedback: Error:', error);
        throw error;
      }
    },

    deleteFeedback: async (feedbackId: string) => {
      try {
        const result = await db!.runAsync(
          `DELETE FROM ${TABLES.FEEDBACK} WHERE id = ?`,
          [feedbackId]
        );

        return { id: feedbackId, changes: result.changes };
      } catch (error) {
        console.error('[AdminsDB-Native] deleteFeedback: Error:', error);
        throw error;
      }
    },

    // ==================== DELIVERY PERSON OPERATIONS ====================
    getDeliveryPersons: async () => {
      try {
        const result = await db!.getAllAsync(
          `SELECT * FROM ${TABLES.DELIVERY_PERSONS} ORDER BY name`
        );
        return result as any[];
      } catch (error) {
        console.error('[AdminsDB-Native] getDeliveryPersons: Error:', error);
        return [];
      }
    },

    getDeliveryPersonById: async (id: string) => {
      try {
        const result = await db!.getFirstAsync(
          `SELECT * FROM ${TABLES.DELIVERY_PERSONS} WHERE id = ?`,
          [id]
        ) as any;
        return result;
      } catch (error) {
        console.error('[AdminsDB-Native] getDeliveryPersonById: Error:', error);
        return null;
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
          ]
        );

        return { id, ...data };
      } catch (error) {
        console.error('[AdminsDB-Native] createDeliveryPerson: Error:', error);
        throw error;
      }
    },

    updateDeliveryPerson: async (id: string, data: any) => {
      try {
        const updates = Object.keys(data)
          .filter(key => key !== 'id' && key !== 'created_at')
          .map(key => `${key} = ?`)
          .join(', ');

        const values = Object.values(data).filter((_, i) =>
          Object.keys(data)[i] !== 'id' && Object.keys(data)[i] !== 'created_at'
        ) as any[];
        values.push(id);

        await db!.runAsync(
          `UPDATE ${TABLES.DELIVERY_PERSONS} SET ${updates}, updated_at = datetime('now') WHERE id = ?`,
          values
        );

        const updated = await db!.getFirstAsync(
          `SELECT * FROM ${TABLES.DELIVERY_PERSONS} WHERE id = ?`,
          [id]
        ) as any;

        return updated;
      } catch (error) {
        console.error('[AdminsDB-Native] updateDeliveryPerson: Error:', error);
        throw error;
      }
    },

    deleteDeliveryPerson: async (id: string) => {
      try {
        const result = await db!.runAsync(
          `DELETE FROM ${TABLES.DELIVERY_PERSONS} WHERE id = ?`,
          [id]
        );

        return { id, changes: result.changes };
      } catch (error) {
        console.error('[AdminsDB-Native] deleteDeliveryPerson: Error:', error);
        throw error;
      }
    },

    // ==================== DELIVERY ASSIGNMENT OPERATIONS ====================
    getDeliveryAssignments: async (orderId?: string) => {
      try {
        let sql = `SELECT * FROM ${TABLES.DELIVERY_ASSIGNMENTS}`;
        const params: any[] = [];

        if (orderId) {
          sql += ' WHERE order_id = ?';
          params.push(orderId);
        }

        sql += ' ORDER BY assigned_at DESC';

        const result = await db!.getAllAsync(sql, params);
        return result as any[];
      } catch (error) {
        console.error('[AdminsDB-Native] getDeliveryAssignments: Error:', error);
        return [];
      }
    },

    createDeliveryAssignment: async (data: any) => {
      try {
        const {
          id, order_id, delivery_person_id, delivery_address, notes,
          phone_number, status
        } = data;

        await db!.runAsync(
          `INSERT INTO ${TABLES.DELIVERY_ASSIGNMENTS}
           (id, order_id, delivery_person_id, delivery_address, notes,
            phone_number, status, assigned_at, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'), datetime('now'))`,
          [
            id, order_id, delivery_person_id, delivery_address, notes,
            phone_number, status || 'pending'
          ]
        );

        return { id, ...data };
      } catch (error) {
        console.error('[AdminsDB-Native] createDeliveryAssignment: Error:', error);
        throw error;
      }
    },

    updateDeliveryAssignment: async (id: string, data: any) => {
      try {
        const updates = Object.keys(data)
          .filter(key => key !== 'id' && key !== 'created_at' && key !== 'assigned_at')
          .map(key => `${key} = ?`)
          .join(', ');

        const values = Object.values(data).filter((_, i) =>
          Object.keys(data)[i] !== 'id' && Object.keys(data)[i] !== 'created_at' && Object.keys(data)[i] !== 'assigned_at'
        ) as any[];
        values.push(id);

        await db!.runAsync(
          `UPDATE ${TABLES.DELIVERY_ASSIGNMENTS} SET ${updates}, updated_at = datetime('now') WHERE id = ?`,
          values
        );

        const updated = await db!.getFirstAsync(
          `SELECT * FROM ${TABLES.DELIVERY_ASSIGNMENTS} WHERE id = ?`,
          [id]
        ) as any;

        return updated;
      } catch (error) {
        console.error('[AdminsDB-Native] updateDeliveryAssignment: Error:', error);
        throw error;
      }
    },

    deleteDeliveryAssignment: async (id: string) => {
      try {
        const result = await db!.runAsync(
          `DELETE FROM ${TABLES.DELIVERY_ASSIGNMENTS} WHERE id = ?`,
          [id]
        );

        return { id, changes: result.changes };
      } catch (error) {
        console.error('[AdminsDB-Native] deleteDeliveryAssignment: Error:', error);
        throw error;
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
        console.error('[AdminsDB-Native] getNotifications: Error:', error);
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
          [id, user_id, title, message, type || 'info']
        );

        return { id, ...data };
      } catch (error) {
        console.error('[AdminsDB-Native] createNotification: Error:', error);
        throw error;
      }
    },

    markNotificationAsRead: async (id: string) => {
      try {
        await db!.runAsync(
          `UPDATE ${TABLES.NOTIFICATIONS} SET is_read = 1, updated_at = datetime('now') WHERE id = ?`,
          [id]
        );

        const updated = await db!.getFirstAsync(
          `SELECT * FROM ${TABLES.NOTIFICATIONS} WHERE id = ?`,
          [id]
        ) as any;

        return updated;
      } catch (error) {
        console.error('[AdminsDB-Native] markNotificationAsRead: Error:', error);
        throw error;
      }
    },

    deleteNotification: async (id: string) => {
      try {
        const result = await db!.runAsync(
          `DELETE FROM ${TABLES.NOTIFICATIONS} WHERE id = ?`,
          [id]
        );

        return { id, changes: result.changes };
      } catch (error) {
        console.error('[AdminsDB-Native] deleteNotification: Error:', error);
        throw error;
      }
    },

    // ==================== APP SETTINGS OPERATIONS ====================
    getAppSettings: async () => {
      try {
        const result = await db!.getFirstAsync(
          `SELECT * FROM ${TABLES.APP_SETTINGS} WHERE id = 'app-settings'`
        ) as any;
        return result;
      } catch (error) {
        console.error('[AdminsDB-Native] getAppSettings: Error:', error);
        return null;
      }
    },

    updateAppSettings: async (data: any) => {
      try {
        const existing = await db!.getFirstAsync(
          `SELECT * FROM ${TABLES.APP_SETTINGS} WHERE id = 'app-settings'`
        ) as any;

        if (existing) {
          const updates = Object.keys(data)
            .filter(key => key !== 'id' && key !== 'created_at')
            .map(key => `${key} = ?`)
            .join(', ');

          const values = Object.values(data).filter((_, i) =>
            Object.keys(data)[i] !== 'id' && Object.keys(data)[i] !== 'created_at'
          ) as any[];
          values.push('app-settings');

          await db!.runAsync(
            `UPDATE ${TABLES.APP_SETTINGS} SET ${updates}, updated_at = datetime('now') WHERE id = 'app-settings'`,
            values
          );
        } else {
          const keys = ['id', ...Object.keys(data)];
          const values = ['app-settings', ...Object.values(data)] as any[];

          await db!.runAsync(
            `INSERT INTO ${TABLES.APP_SETTINGS} (${keys.join(', ')}, created_at, updated_at)
             VALUES (${keys.map(() => '?').join(', ')}, datetime('now'), datetime('now'))`,
            values
          );
        }

        const updated = await db!.getFirstAsync(
          `SELECT * FROM ${TABLES.APP_SETTINGS} WHERE id = 'app-settings'`
        ) as any;

        return updated;
      } catch (error) {
        console.error('[AdminsDB-Native] updateAppSettings: Error:', error);
        throw error;
      }
    },

    // ==================== SYNC WITH SUPABASE ====================
    syncWithSupabase: async (options?: { force?: boolean }) => {
      const forceSync = options?.force || false;

      try {
        const { syncWithSupabase: performSync } = await import('../utils/sync-bridge');
        await performSync(forceSync);
      } catch (error) {
        console.error('[AdminsDB-Native] syncWithSupabase: Error:', error);
        throw error;
      }
    },

    // ==================== RESET & CLEAR OPERATIONS ====================
    clearAllData: async () => {

      const tables = [
        'admins', 'restaurants', 'menu_categories', 'menu_items',
        'orders', 'order_items', 'feedback', 'reviews', 'advertisements',
        'app_settings', 'settings', 'delivery_persons', 'delivery_assignments',
        'notifications', 'payments', 'users', 'profiles'
      ];

      for (const table of tables) {
        try {
          await db!.runAsync(`DELETE FROM ${table}`, []);
        } catch (error) {
          console.error('[AdminsDB-Native] Error clearing', table, error);
        }
      }
    },

    clearSyncTimestamps: async () => {

      try {
        await db!.runAsync('DELETE FROM sync_log', []);
      } catch (error) {
        console.error('[AdminsDB-Native] Error clearing sync_log:', error);
      }
    },

    // ==================== CLOSE DATABASE ====================
    close: async () => {
      // Expo SQLite doesn't have a close method in the current API
    },

    // ==================== RAW DATABASE OPERATIONS ====================
    getAllAsync: async (sql: string, params?: any[]) => {
      try {
        const result = await db!.getAllAsync(sql, params || []);
        return result as any[];
      } catch (error) {
        console.error('[AdminsDB-Native] getAllAsync: Error:', error);
        throw error;
      }
    },

    getFirstAsync: async (sql: string, params?: any[]) => {
      try {
        const result = await db!.getFirstAsync(sql, params || []);
        return result as any;
      } catch (error) {
        console.error('[AdminsDB-Native] getFirstAsync: Error:', error);
        throw error;
      }
    },

    runAsync: async (sql: string, params: any[]) => {
      try {
        const result = await db!.runAsync(sql, params);
        return result;
      } catch (error) {
        console.error('[AdminsDB-Native] runAsync: Error:', error);
        throw error;
      }
    }
  };
};
