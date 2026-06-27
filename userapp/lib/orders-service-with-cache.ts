// Orders Service with Local Cache Support
// Provides instant loading from cache with background sync

import { supabase } from './supabase';
import { isOnline } from './sync-utils';
import { getDatabase } from '../db';
import { Platform } from 'react-native';

export interface OrderItem {
  id: string;
  orderId: string;
  foodItemId: string;
  quantity: number;
  priceAtOrder: number;
  name?: string;
  imageUrl?: string;
  createdAt: Date;
}

export interface Order {
  id: string;
  userId: string;
  totalAmount: number;
  subtotal: number;
  deliveryCost: number;
  status: 'pending' | 'confirmed' | 'preparing' | 'ready' | 'delivered' | 'cancelled' | 'rejected';
  createdAt: Date;
  updatedAt: Date;
  deliveryPersonId?: string;
  deliveryAddress?: string;
  deliveryLocation?: {
    latitude: number;
    longitude: number;
  };
  restaurantLocation?: {
    latitude: number;
    longitude: number;
  };
  restaurantId?: string;
  restaurantName?: string;
  items?: OrderItem[];
}

export const ordersServiceWithCache = {
  /**
   * Get user orders - INSTANT CACHE FIRST, then background sync
   */
  getUserOrders: async (userId: string): Promise<Order[]> => {

    try {
      const db = await getDatabase();

      // STEP 1: Load from cache immediately for instant UI
      const cachedOrders = await db.getOrders(userId);

      // Transform cached orders to include items
      const ordersWithItems = await Promise.all(
        cachedOrders.map(async (order: any) => {
          // Try to get order items from local DB
          let items: OrderItem[] = [];
          try {
            if ('getAllAsync' in db) {
              const orderItems = await (db as any).getAllAsync(
                `SELECT oi.*, mi.name as menu_item_name, mi.image_url as menu_item_image
                 FROM order_items oi
                 LEFT JOIN menu_items mi ON oi.menu_item_id = mi.id
                 WHERE oi.order_id = ?`,
                [order.id]
              );
              items = orderItems.map((item: any) => ({
                id: item.id,
                orderId: item.order_id,
                foodItemId: item.menu_item_id,
                quantity: item.quantity,
                priceAtOrder: item.price,
                name: item.menu_item_name || 'Item',
                imageUrl: item.menu_item_image || null,
                createdAt: new Date(item.created_at),
              }));
            }
          } catch (err) {
            // console.error('[OrdersService] Error loading order items from cache:', err);
          }

          return {
            id: order.id,
            userId: order.user_id,
            totalAmount: order.total_amount,
            subtotal: order.subtotal || 0,
            deliveryCost: order.delivery_cost || 0,
            status: order.status || 'pending',
            createdAt: new Date(order.created_at),
            updatedAt: new Date(order.updated_at),
            deliveryAddress: order.delivery_address,
            deliveryLocation: order.delivery_lat && order.delivery_lng ? {
              latitude: order.delivery_lat,
              longitude: order.delivery_lng
            } : undefined,
            restaurantLocation: undefined,
            restaurantId: order.restaurant_id,
            restaurantName: order.restaurant_name,
            items,
          } as Order;
        })
      );

      // STEP 2: If no cache, fetch from Supabase SYNCHRONOUSLY
      if (cachedOrders.length === 0) {
        try {
          // Fetch directly from Supabase
          const { data: supabaseOrders, error } = await supabase
            .from('orders')
            .select(`
              *,
              restaurants (
                name
              ),
              order_items (
                id,
                menu_item_id,
                quantity,
                price,
                created_at,
                menu_items (
                  name,
                  image_url
                )
              )
            `)
            .eq('user_id', userId)
            .order('created_at', { ascending: false });

          if (error || !supabaseOrders) {
            console.error('[OrdersService] Supabase fetch error:', error);
            return [];
          }


          // Transform Supabase orders with items FIRST (before any async operations)
          const supabaseOrdersWithItems = supabaseOrders.map((order: any) => ({
            id: order.id,
            userId: order.user_id,
            totalAmount: order.total_amount,
            subtotal: order.subtotal || 0,
            deliveryCost: order.delivery_cost || 0,
            status: order.status || 'pending',
            createdAt: new Date(order.created_at),
            updatedAt: new Date(order.updated_at),
            deliveryAddress: order.delivery_address,
            deliveryLocation: order.delivery_lat && order.delivery_lng ? {
              latitude: order.delivery_lat,
              longitude: order.delivery_lng
            } : undefined,
            restaurantLocation: undefined,
            restaurantId: order.restaurant_id,
            restaurantName: order.restaurants?.name || order.restaurant_name || 'Restaurant',
            items: order.order_items?.map((item: any) => ({
              id: item.id,
              orderId: item.order_id || order.id,
              foodItemId: item.menu_item_id,
              quantity: item.quantity,
              priceAtOrder: item.price,
              name: item.menu_items?.name || 'Item',
              imageUrl: item.menu_items?.image_url || null,
              createdAt: new Date(item.created_at),
            })) || [],
          })) as Order[];


          // Save to local DB for next time (non-blocking, don't wait)
          performBackgroundOrdersSync(userId).catch((syncErr) => {
            // console.error('[OrdersService] Error in background sync:', syncErr);
          });

          return supabaseOrdersWithItems;
        } catch (syncError) {
          console.error('[OrdersService] Error syncing from Supabase:', syncError);
          return [];
        }
      } else {
        // STEP 3: Has cache - trigger background sync (non-blocking)
        if (Platform.OS !== 'web') {
          const online = await isOnline();
          if (online) {
            performBackgroundOrdersSync(userId).catch((err) => {
              // console.error('[OrdersService] Background sync failed:', err);
            });
          }
        }
      }

      return ordersWithItems;
    } catch (error) {
      // console.error('[OrdersService] Error fetching orders:', error);
      return [];
    }
  },

  /**
   * Get single order by ID - tries cache first, then Supabase
   */
  getOrderById: async (orderId: string): Promise<Order | null> => {

    try {
      const db = await getDatabase();

      // Try cache first
      if ('getOrderById' in db) {
        const cachedOrder = await (db as any).getOrderById(orderId);
        if (cachedOrder) {
          // Load items for this order
          let items: OrderItem[] = [];
          try {
            if ('getAllAsync' in db) {
              const orderItems = await (db as any).getAllAsync(
                `SELECT * FROM order_items WHERE order_id = ?`,
                [orderId]
              );
              items = orderItems.map((item: any) => ({
                id: item.id,
                orderId: item.order_id,
                foodItemId: item.menu_item_id,
                quantity: item.quantity,
                priceAtOrder: item.price,
                createdAt: new Date(item.created_at),
              }));
            }
          } catch (err) {
            // console.error('[OrdersService] Error loading order items:', err);
          }

          return {
            ...cachedOrder,
            items,
          } as Order;
        }
      }

      // Not in cache, fetch from Supabase
      const { data, error } = await supabase
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
        .eq('id', orderId)
        .single() as { data: any; error: any };

      if (error || !data) {
        // console.error('[OrdersService] Error fetching order from Supabase:', error);
        return null;
      }

      return {
        id: data.id,
        userId: data.user_id,
        totalAmount: data.total_amount,
        subtotal: data.subtotal || 0,
        deliveryCost: data.delivery_cost || 0,
        status: data.status || 'pending',
        createdAt: new Date(data.created_at),
        updatedAt: new Date(data.updated_at),
        deliveryAddress: data.delivery_address,
        restaurantId: data.restaurant_id,
        restaurantName: data.restaurant_name,
        items: (data.order_items || []).map((item: any) => ({
          id: item.id,
          orderId: item.order_id,
          foodItemId: item.menu_item_id,
          quantity: item.quantity,
          priceAtOrder: item.price,
          name: item.menu_items?.name || 'Item',
          imageUrl: item.menu_items?.image_url || null,
          createdAt: new Date(item.created_at),
        })),
      } as Order;
    } catch (error) {
      // console.error('[OrdersService] Error fetching order:', error);
      return null;
    }
  },
};

/**
 * Background sync for orders
 */
async function performBackgroundOrdersSync(userId: string) {
  try {
    const db = await getDatabase();
    const lastSyncTime = await getLastOrdersSyncTime(db, userId);


    // Fetch ALL orders for user (don't filter by time - we want all orders)
    const { data: orders, error } = await supabase
      .from('orders')
      .select(`
        *,
        restaurants (
          name
        ),
        order_items (
          id,
          menu_item_id,
          quantity,
          price,
          created_at
        )
      `)
      .eq('user_id', userId)
      .order('created_at', { ascending: false }) as { data: any[]; error: any };

    if (error || !orders) {
      // console.error('[OrdersService] Background sync error:', error);
      return;
    }


    // Import web helpers if needed
    let putRecord: any = null;
    let clearStore: any = null;
    
    if (Platform.OS === 'web') {
      // On web, import the IndexedDB helpers
      const dbModule = await import('@/db/index.web');
      putRecord = dbModule.putRecord;
      clearStore = dbModule.clearStore;
    }

    // Insert/update orders in local DB
    // Check if web (IndexedDB) or native (SQLite)
    if (Platform.OS !== 'web' && 'runAsync' in db) {
      // Native SQLite - insert directly
      for (const order of orders) {
        try {
          const result = await db.runAsync(
            `INSERT OR REPLACE INTO orders
             (id, user_id, restaurant_id, subtotal, delivery_cost, total_amount,
              delivery_address, delivery_notes, delivery_lat, delivery_lng,
              restaurant_name, payment_method, payment_status, status,
              estimated_delivery_time, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
              order.id, order.user_id, order.restaurant_id,
              order.subtotal, order.delivery_cost, order.total_amount,
              order.delivery_address, order.delivery_notes, order.delivery_lat, order.delivery_lng,
              order.restaurants?.name || order.restaurant_name, order.payment_method, order.payment_status, order.status,
              order.estimated_delivery_time, order.created_at, order.updated_at
            ]
          );
        } catch (insertError) {
          // console.error('[OrdersService] Error inserting order:', insertError);
        }

        // Sync order items
        if (order.order_items) {
          for (const item of order.order_items) {
            try {
              await db.runAsync(
                `INSERT OR REPLACE INTO order_items
                 (id, order_id, menu_item_id, quantity, price, created_at)
                 VALUES (?, ?, ?, ?, ?, ?)`,
                [item.id, order.id, item.menu_item_id, item.quantity, item.price, item.created_at]
              );
            } catch (itemError) {
              // console.error('[OrdersService] Error inserting order item:', itemError);
            }
          }
        }
      }
      
      // Verify insertion by querying back
      const verifyOrders = await db.getAllAsync('SELECT id, user_id FROM orders WHERE user_id = ?', [userId]);
      // Web (IndexedDB) - use putRecord for each order
      const webDb = await import('@/db/index.web');
      const indexedDb = await webDb.ensureDbInitialized();
      
      for (const order of orders) {
        // Insert order
        const orderRecord = {
          id: order.id,
          user_id: order.user_id,
          restaurant_id: order.restaurant_id,
          subtotal: order.subtotal,
          delivery_cost: order.delivery_cost,
          total_amount: order.total_amount,
          delivery_address: order.delivery_address,
          delivery_notes: order.delivery_notes,
          delivery_lat: order.delivery_lat,
          delivery_lng: order.delivery_lng,
          restaurant_name: order.restaurants?.name || order.restaurant_name,
          payment_method: order.payment_method,
          payment_status: order.payment_status,
          status: order.status,
          estimated_delivery_time: order.estimated_delivery_time,
          created_at: order.created_at,
          updated_at: order.updated_at,
        };
        await putRecord(indexedDb, 'orders', orderRecord);

        // Sync order items
        if (order.order_items) {
          for (const item of order.order_items) {
            const itemRecord = {
              id: item.id,
              order_id: order.id,
              menu_item_id: item.menu_item_id,
              quantity: item.quantity,
              price: item.price,
              created_at: item.created_at,
            };
            await putRecord(indexedDb, 'order_items', itemRecord);
          }
        }
      }
    }

    // Update sync time
    await updateOrdersSyncTime(db, userId);
  } catch (error) {
    // console.error('[OrdersService] Background sync failed:', error);
  }
}

/**
 * Get last sync time for orders
 */
async function getLastOrdersSyncTime(db: any, userId: string): Promise<string> {
  try {
    // Check if web (IndexedDB) or native (SQLite)
    if (Platform.OS === 'web') {
      // Web (IndexedDB) - get sync_log from IndexedDB
      const webDb = await import('@/db/index.web');
      const indexedDb = await webDb.ensureDbInitialized();
      const result = await webDb.getById<{ sync_timestamp: string }>(indexedDb, 'sync_log', `orders_${userId}`);
      return result?.sync_timestamp || '1970-01-01T00:00:00.000Z';
    } else if ('getFirstAsync' in db) {
      // Native SQLite
      const result = await db.getFirstAsync(
        'SELECT sync_timestamp FROM sync_log WHERE table_name = ?',
        [`orders_${userId}`]
      );
      return result?.sync_timestamp || '1970-01-01T00:00:00.000Z';
    }
    return '1970-01-01T00:00:00.000Z';
  } catch (err) {
    // console.error('[OrdersService] Error getting sync time:', err);
    return '1970-01-01T00:00:00.000Z';
  }
}

/**
 * Update sync time for orders
 */
async function updateOrdersSyncTime(db: any, userId: string) {
  try {
    const now = new Date().toISOString();
    
    // Check if web (IndexedDB) or native (SQLite)
    if (Platform.OS === 'web') {
      // Web (IndexedDB)
      const webDb = await import('@/db/index.web');
      const indexedDb = await webDb.ensureDbInitialized();
      await webDb.putRecord(indexedDb, 'sync_log', {
        table_name: `orders_${userId}`,
        sync_timestamp: now,
      });
    } else if ('runAsync' in db) {
      // Native SQLite
      await db.runAsync(
        'INSERT OR REPLACE INTO sync_log (table_name, sync_timestamp) VALUES (?, ?)',
        [`orders_${userId}`, now]
      );
    }
  } catch (err) {
    // console.error('[OrdersService] Error updating sync time:', err);
  }
}
