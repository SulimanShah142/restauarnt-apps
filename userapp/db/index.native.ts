// Native Database Implementation using Expo SQLite for User App
// This file is only loaded on mobile platforms (iOS/Android)
import * as SQLite from 'expo-sqlite';
import { DatabaseInterface } from './types';
import { SQLITE_SCHEMA, TABLES } from './schema';

// Database schema version - increment this when schema changes
const SCHEMA_VERSION = 4;

// Initialize database
let db: SQLite.SQLiteDatabase | null = null;

export const getDatabase = async (): Promise<DatabaseInterface> => {
  if (!db) {
    db = await SQLite.openDatabaseAsync('userapp.db');

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
    // Orders operations
    getOrders: async (userId?: string) => {
      let sql = `SELECT * FROM ${TABLES.ORDERS}`;
      const params: any[] = [];

      if (userId) {
        sql += ' WHERE user_id = ? ORDER BY created_at DESC';
        params.push(userId);
      } else {
        sql += ' ORDER BY created_at DESC';
      }

      const result = await db!.getAllAsync(sql, params);
      return result as any[];
    },

    getOrderById: async (orderId: string) => {
      const result = await db!.getFirstAsync(
        `SELECT * FROM ${TABLES.ORDERS} WHERE id = ?`,
        [orderId]
      ) as any;
      return result;
    },

    createOrder: async (orderData: any) => {
      const {
        id, user_id, restaurant_id, subtotal, delivery_cost, total_amount,
        delivery_address, delivery_notes, delivery_lat, delivery_lng,
        restaurant_name, payment_method, payment_status, status,
        estimated_delivery_time
      } = orderData;

      const result = await db!.runAsync(
        `INSERT INTO ${TABLES.ORDERS}
         (id, user_id, restaurant_id, subtotal, delivery_cost, total_amount,
          delivery_address, delivery_notes, delivery_lat, delivery_lng,
          restaurant_name, payment_method, payment_status, status,
          estimated_delivery_time)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          id, user_id, restaurant_id, subtotal, delivery_cost, total_amount,
          delivery_address, delivery_notes, delivery_lat, delivery_lng,
          restaurant_name, payment_method, payment_status, status,
          estimated_delivery_time
        ]
      );

      return { id: result.lastInsertRowId?.toString() || id, ...orderData };
    },

    updateOrder: async (orderId: string, orderData: any) => {
      const updates = Object.keys(orderData)
        .filter(key => key !== 'id')
        .map(key => `${key} = ?`)
        .join(', ');

      const values = Object.values(orderData) as (string | number | boolean | null)[];
      values.push(orderId); // Add ID for WHERE clause

      await db!.runAsync(
        `UPDATE ${TABLES.ORDERS} SET ${updates}, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
        values
      );

      return await db!.getFirstAsync(
        `SELECT * FROM ${TABLES.ORDERS} WHERE id = ?`,
        [orderId]
      ) as any;
    },

    // Restaurants operations
    getRestaurants: async () => {
      const result = await db!.getAllAsync(
        `SELECT * FROM ${TABLES.RESTAURANTS} WHERE is_active = 1 ORDER BY name`
      );
      return result as any[];
    },

    getRestaurantById: async (restaurantId: string) => {
      const result = await db!.getFirstAsync(
        `SELECT * FROM ${TABLES.RESTAURANTS} WHERE id = ?`,
        [restaurantId]
      ) as any;
      return result;
    },

    getRestaurantsByCategory: async (category: string) => {
      const result = await db!.getAllAsync(
        `SELECT * FROM ${TABLES.RESTAURANTS} WHERE category = ? AND is_active = 1 ORDER BY name`,
        [category]
      );
      return result as any[];
    },

    // Menu operations
    getMenuItemsByRestaurant: async (restaurantId: string) => {
      const result = await db!.getAllAsync(
        `SELECT mi.*, mc.name as category_name, mi.menu_category_id
         FROM ${TABLES.MENU_ITEMS} mi
         LEFT JOIN ${TABLES.MENU_CATEGORIES} mc ON mi.menu_category_id = mc.id
         WHERE mi.restaurant_id = ? AND mi.is_available = 1
         ORDER BY mc.sort_order`,
        [restaurantId]
      );
      return result as any[];
    },

    getMenuCategoriesByRestaurant: async (restaurantId: string) => {
      const result = await db!.getAllAsync(
        `SELECT * FROM ${TABLES.MENU_CATEGORIES} WHERE restaurant_id = ? AND is_active = 1 ORDER BY sort_order`,
        [restaurantId]
      );
      return result as any[];
    },

    getMenuItemById: async (menuId: string) => {
      const result = await db!.getFirstAsync(
        `SELECT * FROM ${TABLES.MENU_ITEMS} WHERE id = ?`,
        [menuId]
      ) as any;
      return result;
    },

    // User/profile operations
    getUserProfile: async (userId: string) => {
      const result = await db!.getFirstAsync(
        `SELECT * FROM ${TABLES.PROFILES} WHERE id = ?`,
        [userId]
      ) as any;
      return result;
    },

    createUserProfile: async (profileData: any) => {
      const { id, email, full_name, phone_number, address, role } = profileData;

      await db!.runAsync(
        `INSERT INTO ${TABLES.PROFILES} (id, email, full_name, phone_number, address, role)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [id, email, full_name, phone_number, address, role || 'customer']
      );

      return { id };
    },

    // Cart operations
    addToCart: async (cartItem: any) => {
      const { user_id, restaurant_id, menu_item_id, quantity, special_instructions } = cartItem;

      // Check if item already exists in cart
      const existingItem = await db!.getFirstAsync(
        `SELECT * FROM ${TABLES.CART_ITEMS} WHERE user_id = ? AND menu_item_id = ?`,
        [user_id, menu_item_id]
      ) as any;

      if (existingItem) {
        // Update quantity if item exists
        await db!.runAsync(
          `UPDATE ${TABLES.CART_ITEMS} SET quantity = quantity + ?, special_instructions = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
          [quantity, special_instructions, existingItem.id]
        );

        return { id: existingItem.id };
      } else {
        // Insert new cart item
        const id = `${user_id}_${menu_item_id}_${Date.now()}`;
        await db!.runAsync(
          `INSERT INTO ${TABLES.CART_ITEMS}
           (id, user_id, restaurant_id, menu_item_id, quantity, special_instructions)
           VALUES (?, ?, ?, ?, ?, ?)`,
          [id, user_id, restaurant_id, menu_item_id, quantity, special_instructions]
        );

        return { id };
      }
    },

    getUserCart: async (userId: string) => {
      const result = await db!.getAllAsync(
        `SELECT c.*, mi.name as item_name, mi.price, mi.image_url, r.name as restaurant_name
         FROM ${TABLES.CART_ITEMS} c
         JOIN ${TABLES.MENU_ITEMS} mi ON c.menu_item_id = mi.id
         JOIN ${TABLES.RESTAURANTS} r ON c.restaurant_id = r.id
         WHERE c.user_id = ?`,
        [userId]
      );
      return result as any[];
    },

    removeFromCart: async (cartItemId: string) => {
      const result = await db!.runAsync(
        `DELETE FROM ${TABLES.CART_ITEMS} WHERE id = ?`,
        [cartItemId]
      );

      return { id: cartItemId, changes: result.changes };
    },

    clearUserCart: async (userId: string) => {
      const result = await db!.runAsync(
        `DELETE FROM ${TABLES.CART_ITEMS} WHERE user_id = ?`,
        [userId]
      );

      return { userId, changes: result.changes };
    },

    // Favorites operations - Note: FAVORITES table not in schema, using placeholder
    addToFavorites: async (userId: string, restaurantId: string) => {
      const id = `${userId}_${restaurantId}`;

      // Placeholder - favorites not implemented in local DB
      return { id };
    },

    removeFavorite: async (userId: string, restaurantId: string) => {
      const id = `${userId}_${restaurantId}`;
      // Placeholder - favorites not implemented in local DB
      return { id, changes: 0 };
    },

    getUserFavorites: async (userId: string) => {
      // Placeholder - favorites not implemented in local DB
      return [];
    },

    // Reviews operations
    addReview: async (reviewData: any) => {
      const { user_id, restaurant_id, order_id, rating, title, comment } = reviewData;

      const id = `review_${Date.now()}`;
      await db!.runAsync(
        `INSERT INTO ${TABLES.REVIEWS}
         (id, user_id, restaurant_id, order_id, rating, title, comment)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [id, user_id, restaurant_id, order_id, rating, title, comment]
      );

      // Update restaurant rating
      await updateRestaurantRating(restaurant_id);

      return { id };
    },

    getRestaurantReviews: async (restaurantId: string) => {
      const result = await db!.getAllAsync(
        `SELECT rev.*, p.full_name as customer_name
         FROM ${TABLES.REVIEWS} rev
         JOIN ${TABLES.PROFILES} p ON rev.user_id = p.id
         WHERE rev.restaurant_id = ?
         ORDER BY rev.created_at DESC`,
        [restaurantId]
      );
      return result as any[];
    },

    // Feedback operations
    getFeedbackByUserId: async (userId: string) => {
      const result = await db!.getAllAsync(
        `SELECT * FROM ${TABLES.FEEDBACK}
         WHERE user_id = ?
         ORDER BY created_at DESC`,
        [userId]
      );
      return result as any[];
    },

    getFeedbackById: async (feedbackId: string) => {
      const result = await db!.getFirstAsync(
        `SELECT * FROM ${TABLES.FEEDBACK}
         WHERE id = ?`,
        [feedbackId]
      );
      return result as any;
    },

    saveFeedback: async (feedbackData: any) => {
      const { id, user_id, title, comment, rating, is_resolved, created_at, updated_at } = feedbackData;
      
      await db!.runAsync(
        `INSERT OR REPLACE INTO ${TABLES.FEEDBACK}
         (id, user_id, title, comment, rating, is_resolved, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [id, user_id, title, comment, rating, is_resolved ? 1 : 0, created_at, updated_at]
      );
      return { id };
    },

    // Sync operations - fetches data from Supabase and syncs to local SQLite
    syncWithSupabase: async (userId?: string) => {
      // Use enhanced sync service for complete reset sync
      try {
        const { performBackgroundSync } = await import('../lib/enhanced-sync-service');
        const success = await performBackgroundSync(db!, userId);
        
        
        // Dispatch event to notify UI to refresh (using EventEmitter for native)
        try {
          const { NativeModules, Platform } = require('react-native');
          if (Platform.OS === 'android' || Platform.OS === 'ios') {
            // For native, we'll use a simple console log that can be picked up
          }
          // Ignore if react-native not available
        } catch (err) {
          // Ignore errors in event dispatch
        }

        return success;
      } catch (error) {
        // console.error('[UserApp-DB-Native] Enhanced sync failed, trying fallback:', error);
        // Fallback to original sync-bridge
        try {
          const { syncWithSupabase: performSync } = await import('../utils/sync-bridge');
          await performSync(db!);
          return true;
        } catch (fallbackError) {
          // console.error('[UserApp-DB-Native] Fallback sync also failed:', fallbackError);
          throw fallbackError;
        }
      }
    },

    // Close database connection
    close: async () => {
      // Expo SQLite doesn't have a close method in the current API
    },
  };
}

// Helper function to update restaurant rating
const updateRestaurantRating = async (restaurantId: string) => {
  const result = await db!.getFirstAsync(
    `SELECT AVG(rating) as avg_rating, COUNT(*) as total_reviews
     FROM ${TABLES.REVIEWS}
     WHERE restaurant_id = ?`,
    [restaurantId]
  ) as any;

  const avgRating = result.avg_rating ? parseFloat(result.avg_rating).toFixed(1) : 0;
  const totalReviews = result.total_reviews || 0;

  await db!.runAsync(
    `UPDATE ${TABLES.RESTAURANTS} SET rating = ?, total_reviews = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
    [avgRating, totalReviews, restaurantId]
  );
};
