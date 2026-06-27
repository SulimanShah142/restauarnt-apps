// Local Database Service for Admins App
// Reads data from IndexedDB (web) or SQLite (native) instead of API
import { getDatabase } from '../db';
import { supabase } from './supabase';

// Sync feedback from Supabase to local DB
async function syncFeedbackToLocalDB(db: any, feedback: any[]) {
  try {

    // Clear existing feedback first
    const existingFeedback = await db.getFeedback();
    for (const item of existingFeedback) {
      await db.deleteFeedback(item.id);
    }

    // Insert all feedback - only include columns that exist in the schema
    for (const item of feedback) {
      await db.createFeedback({
        id: item.id,
        user_id: item.user_id,
        title: item.title,
        comment: item.comment,
        rating: item.rating,
        is_resolved: item.is_resolved,
        created_at: item.created_at,
        updated_at: item.updated_at,
      });
    }
  } catch (error) {
    console.error('[LocalDbService] Error syncing feedback:', error);
  }
}

export const localDbService = {
  // ==================== RESTAURANTS ====================
  restaurants: {
    getAll: async () => {
      try {
        const db = await getDatabase();
        const restaurants = await db.getRestaurants();
        return restaurants;
      } catch (error) {
        console.error('[LocalDbService] ❌ Error getting restaurants:', error);
        return [];
      }
    },

    getById: async (id: string) => {
      try {
        const db = await getDatabase();
        const restaurant = await db.getRestaurantById(id);
        return restaurant;
      } catch (error) {
        console.error('[LocalDbService] ❌ Error getting restaurant:', error);
        return null;
      }
    },
  },

  // ==================== MENU ITEMS ====================
  menuItems: {
    getAll: async () => {
      try {
        const db = await getDatabase();
        // Get all restaurants first, then get menu items for each
        const restaurants = await db.getRestaurants();
        let allMenuItems: any[] = [];
        
        for (const restaurant of restaurants) {
          const items = await db.getMenuItemsByRestaurant(restaurant.id);
          allMenuItems = [...allMenuItems, ...items];
        }
        
        return allMenuItems;
      } catch (error) {
        console.error('[LocalDbService] ❌ Error getting menu items:', error);
        return [];
      }
    },

    getByRestaurant: async (restaurantId: string) => {
      try {
        const db = await getDatabase();
        const items = await db.getMenuItemsByRestaurant(restaurantId);
        return items;
      } catch (error) {
        console.error('[LocalDbService] ❌ Error getting menu items:', error);
        return [];
      }
    },
  },

  // ==================== MENU CATEGORIES ====================
  menuCategories: {
    getByRestaurant: async (restaurantId: string) => {
      try {
        const db = await getDatabase();
        const categories = await db.getMenuCategoriesByRestaurant(restaurantId);
        return categories;
      } catch (error) {
        console.error('[LocalDbService] ❌ Error getting categories:', error);
        return [];
      }
    },
  },

  // ==================== ORDERS ====================
  orders: {
    getAll: async () => {
      try {
        const db = await getDatabase();
        const orders = await db.getOrders();

        // Load order items for each order
        const ordersWithItems = await Promise.all(orders.map(async (order: any) => {
          try {
            // Select order items with menu_item_name and menu_item_image_url columns directly
            // These columns are populated by the trigger when order is created
            let orderItems = await db.getAllAsync(
              `SELECT oi.id, oi.order_id, oi.menu_item_id, oi.quantity, oi.price, 
                      oi.menu_item_name, oi.menu_item_image_url, 
                      oi.special_instructions, oi.created_at, oi.updated_at
               FROM order_items oi
               WHERE oi.order_id = ?`,
              [order.id]
            );

            // Log what we found for debugging
            if (orderItems && orderItems.length > 0) {
              // Items found
            }

            // Fallback if no items found
            if (!orderItems || orderItems.length === 0) {
              console.warn('[LocalDbService] ⚠️ No order items found for order:', order.id);
              orderItems = [];
            }

            return {
              ...order,
              order_items: orderItems || []
            };
          } catch (error) {
            console.error('[LocalDbService] Error loading items for order:', order.id, error);
            return {
              ...order,
              order_items: []
            };
          }
        }));

        return ordersWithItems;
      } catch (error) {
        console.error('[LocalDbService] ❌ Error getting orders:', error);
        return [];
      }
    },

    getById: async (id: string) => {
      try {
        const db = await getDatabase();
        const order = await db.getOrderById(id);

        if (order) {
          // Load order items - select menu_item_name and menu_item_image_url directly
          let orderItems = await db.getAllAsync(
            `SELECT oi.id, oi.order_id, oi.menu_item_id, oi.quantity, oi.price, 
                    oi.menu_item_name, oi.menu_item_image_url, 
                    oi.special_instructions, oi.created_at, oi.updated_at
             FROM order_items oi
             WHERE oi.order_id = ?`,
            [id]
          );

          // Log for debugging
          if (orderItems && orderItems.length > 0) {
            // Items found
          }

          // Fallback if no items found
          if (!orderItems || orderItems.length === 0) {
            console.warn('[LocalDbService] ⚠️ No order items found for order:', id);
            orderItems = [];
          }

          return {
            ...order,
            order_items: orderItems
          };
        }

        return order;
      } catch (error) {
        console.error('[LocalDbService] ❌ Error getting order:', error);
        return null;
      }
    },

    getByRestaurant: async (restaurantId: string) => {
      try {
        const db = await getDatabase();
        const orders = await db.getOrders(restaurantId);
        return orders;
      } catch (error) {
        console.error('[LocalDbService] ❌ Error getting orders:', error);
        return [];
      }
    },
  },

  // ==================== DELIVERY PERSONS ====================
  deliveryPersonnel: {
    getAll: async () => {
      try {
        const db = await getDatabase();
        const persons = await db.getDeliveryPersons();
        return persons;
      } catch (error) {
        console.error('[LocalDbService] ❌ Error getting delivery persons:', error);
        return [];
      }
    },

    getById: async (id: string) => {
      try {
        const db = await getDatabase();
        const person = await db.getDeliveryPersonById(id);
        return person;
      } catch (error) {
        console.error('[LocalDbService] ❌ Error getting delivery person:', error);
        return null;
      }
    },
  },

  // ==================== DELIVERY ASSIGNMENTS ====================
  deliveryAssignments: {
    getAll: async () => {
      try {
        const db = await getDatabase();
        const assignments = await db.getDeliveryAssignments();
        return assignments;
      } catch (error) {
        console.error('[LocalDbService] ❌ Error getting assignments:', error);
        return [];
      }
    },

    getByOrderId: async (orderId: string) => {
      try {
        const db = await getDatabase();
        const assignments = await db.getDeliveryAssignments(orderId);
        return assignments;
      } catch (error) {
        console.error('[LocalDbService] ❌ Error getting assignments:', error);
        return [];
      }
    },
  },

  // ==================== FEEDBACK ====================
  feedback: {
    getAll: async () => {
      try {
        const db = await getDatabase();
        
        // First, sync from Supabase if online
        try {
          const { data, error } = await supabase
            .from('feedback')
            .select(`
              *,
              profiles:user_id (
                email,
                full_name
              )
            `)
            .order('created_at', { ascending: false });
          
          if (error) {
            console.error('[LocalDbService] ⚠️ Error fetching feedback from Supabase:', error);
          } else if (data && data.length > 0) {

            // Sync to local DB
            try {
              await syncFeedbackToLocalDB(db, data);
            } catch (syncError) {
              console.error('[LocalDbService] ⚠️ Sync failed, using local cache:', syncError);
            }
          }
        } catch (innerError) {
          // Inner try-catch for Supabase fetch
          console.error('[LocalDbService] ⚠️ Error in Supabase sync:', innerError);
        }

        // Get from local DB (now synced)
        const feedback = await db.getFeedback();
        return feedback;
      } catch (error) {
        console.error('[LocalDbService] ❌ Error getting feedback:', error);
        return [];
      }
    },

    getByRestaurant: async (restaurantId: string) => {
      try {
        const db = await getDatabase();
        const feedback = await db.getFeedback(restaurantId);
        return feedback;
      } catch (error) {
        console.error('[LocalDbService] ❌ Error getting feedback:', error);
        return [];
      }
    },
  },

  // ==================== ADMINS ====================
  admins: {
    getAll: async () => {
      try {
        const db = await getDatabase();
        const admins = await db.getAdmins();
        return admins;
      } catch (error) {
        console.error('[LocalDbService] ❌ Error getting admins:', error);
        return [];
      }
    },

    getById: async (id: string) => {
      try {
        const db = await getDatabase();
        const admin = await db.getAdminById(id);
        return admin;
      } catch (error) {
        console.error('[LocalDbService] ❌ Error getting admin:', error);
        return null;
      }
    },
  },

  // ==================== NOTIFICATIONS ====================
  notifications: {
    getAll: async () => {
      try {
        const db = await getDatabase();
        const notifications = await db.getNotifications();
        return notifications;
      } catch (error) {
        console.error('[LocalDbService] ❌ Error getting notifications:', error);
        return [];
      }
    },
  },

  // ==================== APP SETTINGS ====================
  appSettings: {
    get: async () => {
      try {
        const db = await getDatabase();
        const settings = await db.getAppSettings();
        return settings;
      } catch (error) {
        console.error('[LocalDbService] ❌ Error getting settings:', error);
        return null;
      }
    },
  },
};
