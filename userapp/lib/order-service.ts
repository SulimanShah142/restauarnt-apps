// Order Service - Supabase-based implementation
// Updates Supabase first, then updates local DB with raw SQL
import { supabase } from './supabase';
import { getDatabase } from '../db';

// Helper function to generate a simple UUID (since we can't import uuid in React Native web easily)
function generateUUID(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

export interface OrderItem {
  id: string;
  orderId: string;
  foodItemId: string; // Changed to string for MySQL
  quantity: number;
  priceAtOrder: number;
  createdAt: Date;
  name?: string;
  imageUrl?: string;
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
  delivery_lat?: number | null;
  delivery_lng?: number | null;
  deliveryLocation?: {
    latitude: number;
    longitude: number;
  };
  restaurantLocation?: {
    latitude: number;
    longitude: number;
  };
  restaurantId?: string;
}

export const orderService = {
  // Create a new order with optimized storage
  createOrder: async (userId: string, totalAmount: number, orderItems: {foodItemId: string, quantity: number, price: number}[], deliveryAddress?: string, phone?: string, deliveryNotes?: string, restaurantId?: string, restaurantName?: string, customerName?: string, deliveryLat?: number | null, deliveryLng?: number | null): Promise<Order> => { // Changed foodItemId to string

    try {
      // First, ensure the user exists in the application's users table
      // This is needed because Better Auth and the application maintain separate user records
      const { data: existingUser, error: userCheckError } = await supabase
        .from('users')
        .select('id, email, name')
        .eq('id', userId)
        .single();

      if (userCheckError && userCheckError.code !== 'PGRST116') { // PGRST116 means record not found
        // console.error('Error checking user existence:', userCheckError);
        throw new Error(`Supabase error checking user: ${userCheckError.message}`);
      }

      // If user doesn't exist in the application's users table, we need to create them
      // But first, we need to get the user's email and name from the session or another source
      if (!existingUser) {

        // In a real implementation, you'd get the user details from the session or another source
        // For now, we'll create a minimal user record with just the ID
        // This is a simplified approach - in a real app you'd want to get the user's email/name from the session

        // Try to get user details from the session or Supabase auth
        // Since we don't have direct access to email/name here, we'll create a minimal record
        // This is a workaround - ideally, user creation should happen during authentication
        const { error: insertUserError } = await supabase
          .from('users')
          .insert({
            id: userId,
            email: `${userId}@placeholder.com`, // Placeholder email
            name: customerName || `User ${userId.substring(0, 8)}`, // Use provided name or placeholder
            role: 'user',
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          } as any);

        if (insertUserError && insertUserError.code !== '23505') { // 23505 is unique violation error
          // console.error('Error creating user in application table:', insertUserError);
          throw new Error(`Supabase error creating user: ${insertUserError.message}`);
        } else if (insertUserError && insertUserError.code === '23505') {
          // If the user exists but the name is different, update it
          const { error: updateUserError } = await (supabase
            .from('users')
            .update({
              name: customerName,
              updated_at: new Date().toISOString()
            } as any)
            .eq('id', userId) as any) as any;

          if (updateUserError) {
            // console.error('Error updating user name:', updateUserError);
            // Don't throw error, just log it - order can still be created
          }
        }
      }

      // Generate a UUID for the order ID
      const orderId = 'ord_' + Date.now().toString() + '_' + Math.random().toString(36).substr(2, 9);

      // Create the order record with normalized references (optimized storage)
      const insertData: any = {
        id: orderId, // Explicitly provide an ID
        user_id: userId,
        restaurant_id: restaurantId || 'default_restaurant', // Use normalized restaurant ID instead of storing full name
        order_number: `ORD-${Date.now()}-${Math.floor(Math.random() * 1000)}`, // Generate unique order number
        status: 'pending', // Initially pending until admin confirms
        total_amount: totalAmount,
        delivery_address: deliveryAddress || 'User address', // Use provided address or default
        delivery_notes: deliveryNotes || '', // Use provided notes or default
        phone: phone || '', // Include phone number if provided
        delivery_lat: deliveryLat || null, // Include delivery latitude if provided
        delivery_lng: deliveryLng || null, // Include delivery longitude if provided
        payment_status: 'pending'
      };

      // Only add phone field if it exists in the schema
      if (phone !== undefined) {
        insertData.phone = phone;
      }

      const { data: order_data, error: orderError } = await supabase
        .from('orders')
        .insert([insertData] as any)
        .select()
        .single() as { data: any; error: any };

      if (orderError) {
        // console.error('Supabase error creating order:', orderError);
        throw new Error(`Supabase error: ${orderError.message}`);
      }

      // Create order items
      if (orderItems && orderItems.length > 0) {
        for (const item of orderItems) {
          const orderItemId = generateUUID(); // Generate UUID for the order item
          const { error } = await supabase
            .from('order_items')
            .insert([{
              id: orderItemId, // Use the generated UUID
              order_id: order_data.id,
              menu_item_id: item.foodItemId,
              quantity: item.quantity,
              price: item.price
            }] as any)
            .select('id'); // Only select the ID to confirm successful insert

          if (error) {
            // console.error('Error creating order item:', error);
            throw new Error(`Supabase error creating order item: ${error.message}`);
          }
        }
      }


      // LOCAL DB: Insert directly using raw SQL (matching admins-app pattern)
      try {
        const db = await getDatabase();
        if ('runAsync' in db) {
          (db as any).runAsync(
            `INSERT INTO orders (id, user_id, restaurant_id, subtotal, delivery_cost, total_amount, delivery_address, delivery_notes, delivery_lat, delivery_lng, restaurant_name, payment_method, payment_status, status, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))`,
            [
              orderId,
              userId,
              restaurantId || 'default_restaurant',
              totalAmount - (order_data.delivery_cost || 0), // subtotal
              order_data.delivery_cost || 0,
              totalAmount,
              deliveryAddress || 'User address',
              deliveryNotes || '',
              deliveryLat || null,
              deliveryLng || null,
              restaurantName || null,
              'pending',
              'pending',
              'pending'
            ]
          );
        }
      } catch (localDbError) {
        // console.error('createOrder - ⚠️ Local DB insert failed:', localDbError);
        // Don't throw - Supabase creation was successful
      }

      return {
        id: order_data.id,
        userId: order_data.user_id,
        totalAmount: order_data.total_amount,
        subtotal: order_data.subtotal || 0,
        deliveryCost: order_data.delivery_cost || 0,
        status: order_data.status || 'pending',
        createdAt: new Date(order_data.created_at),
        updatedAt: new Date(order_data.updated_at),
        deliveryPersonId: order_data.delivery_person_id
      };
    } catch (error) {
      // console.error('Error creating order:', error);
      throw error;
    }
  },

  // Get order by ID
  getOrderById: async (id: string): Promise<(Order & { items: OrderItem[], restaurant: any, deliveryPerson: any }) | null> => {
    try {
      // Get the order with associated data
      const { data: orderData, error: orderError } = await supabase
        .from('orders')
        .select(`
          id,
          user_id,
          restaurant_id,
          total_amount,
          subtotal,
          delivery_cost,
          status,
          created_at,
          updated_at,
          delivery_person_id,
          delivery_address,
          delivery_lat,
          delivery_lng,
          restaurants (
            id,
            name,
            phone,
            address,
            latitude,
            longitude
          ),
          delivery_persons (
            id,
            phone,
            license_plate,
            vehicle_type,
            is_available,
            users:user_id (
              name,
              email,
              phone
            )
          )
        `)
        .eq('id', id)
        .single() as { data: any; error: any };

      if (orderError) {
        // console.error('getOrderById: Error fetching order from database:', orderError);
        // console.error('getOrderById: Error details:', JSON.stringify(orderError, null, 2));
        if (orderError.code === 'PGRST116') { // Record not found
          return null;
        }
        throw new Error(orderError.message);
      }


      // Get the order items for this order with dish pictures
      const { data: orderItemsData, error: itemsError } = await supabase
        .from('order_items')
        .select(`
          *,
          menu_items(name, image_url)
        `)
        .eq('order_id', id);

      if (itemsError) {
        // console.error('getOrderById: Error fetching order items:', itemsError);
        // Continue with empty items array
      }


      return {
        id: orderData.id,
        userId: orderData.user_id,
        totalAmount: orderData.total_amount,
        subtotal: orderData.subtotal || 0,
        deliveryCost: orderData.delivery_cost || 0,
        status: orderData.status || 'pending',
        createdAt: new Date(orderData.created_at),
        updatedAt: new Date(orderData.updated_at),
        deliveryPersonId: orderData.delivery_person_id,
        deliveryAddress: orderData.delivery_address,
        delivery_lat: orderData.delivery_lat || null, // Include delivery latitude for map routing
        delivery_lng: orderData.delivery_lng || null, // Include delivery longitude for map routing
        items: (orderItemsData || []).map((item: any) => ({
          id: item.id,
          orderId: item.order_id,
          foodItemId: item.menu_item_id,
          quantity: item.quantity,
          price: item.price, // Direct price from database
          priceAtOrder: item.price, // Alias for compatibility
          createdAt: new Date(item.created_at),
          // Use stored columns first, then fallback to JOIN data
          name: item.menu_item_name || item.menu_items?.name || 'Unknown Item',
          imageUrl: item.menu_item_image_url || item.menu_items?.image_url || null
        })),
        restaurant: orderData.restaurants || null,
        deliveryPerson: orderData.delivery_persons || null
      };
    } catch (error) {
      // console.error('getOrderById: Error fetching order:', error);
      throw error;
    }
  },

  // Get orders by user ID
  getOrdersByUserId: async (userId: string): Promise<(Order & { items: OrderItem[] })[]> => {
    try {

      // Get orders for the user with restaurant and location data
      const { data: ordersData, error: ordersError } = await supabase
        .from('orders')
        .select(`
          id,
          user_id,
          restaurant_id,
          total_amount,
          subtotal,
          delivery_cost,
          delivery_address,
          delivery_lat,
          delivery_lng,
          status,
          created_at,
          updated_at,
          delivery_person_id,
          restaurants (
            id,
            name,
            address,
            latitude,
            longitude
          )
        `)
        .eq('user_id', userId)
        .order('created_at', { ascending: false }) as { data: any; error: any };

      if (ordersError) {
        // console.error('[OrderService] Error fetching orders:', ordersError);
        // console.error('[OrderService] Error details:', JSON.stringify(ordersError, null, 2));
        throw new Error(ordersError.message);
      }


      // For each order, get its items
      const ordersWithItems = await Promise.all(
        ordersData.map(async (order: any) => {

          // First check if order_items exist for this order
          const { data: orderItemsData, error: itemsError } = await supabase
            .from('order_items')
            .select(`
              id,
              order_id,
              menu_item_id,
              quantity,
              price,
              created_at,
              menu_items(name, image_url)
            `)
            .eq('order_id', order.id) as { data: any; error: any };

          if (itemsError) {
            // console.error('[OrderService] Error fetching order items:', itemsError);
          }

          
          // Debug: Log raw order items data
          if (orderItemsData && orderItemsData.length > 0) {
            // console.warn('[OrderService] ⚠️ NO ITEMS FOUND for order:', order.id, '- This order has no items in the database');
          }

          // Calculate subtotal from order items if not available
          const calculatedSubtotal = (orderItemsData || []).reduce((sum, item) => {
            return sum + (item.price * item.quantity);
          }, 0);

          // Use DB values if available, otherwise calculate from items
          const subtotal = order.subtotal !== null && order.subtotal !== undefined 
            ? order.subtotal 
            : calculatedSubtotal;
          
          const deliveryCost = order.delivery_cost !== null && order.delivery_cost !== undefined 
            ? order.delivery_cost 
            : 0;
          
          const totalAmount = order.total_amount !== null && order.total_amount !== undefined
            ? order.total_amount
            : subtotal + deliveryCost;

          return {
            id: order.id,
            userId: order.user_id,
            totalAmount: totalAmount,
            subtotal: subtotal,
            deliveryCost: deliveryCost,
            status: order.status || 'pending',
            createdAt: new Date(order.created_at),
            updatedAt: new Date(order.updated_at),
            deliveryPersonId: order.delivery_person_id,
            deliveryAddress: order.delivery_address,
            deliveryLocation: order.delivery_lat && order.delivery_lng ? {
              latitude: order.delivery_lat,
              longitude: order.delivery_lng
            } : undefined,
            // Restaurant coordinates - use directly from DB (columns are correct, NOT swapped)
            restaurantLocation: order.restaurants?.latitude && order.restaurants?.longitude ? {
              latitude: order.restaurants.latitude,
              longitude: order.restaurants.longitude
            } : undefined,
            restaurantId: order.restaurant_id,
            restaurant: order.restaurants || null, // Include restaurant data
            items: (orderItemsData || []).map((item: any) => {
              return {
                id: item.id,
                orderId: item.order_id,
                foodItemId: item.menu_item_id,
                quantity: item.quantity,
                price: item.price || 0, // Include price field
                priceAtOrder: item.price || 0,
                createdAt: new Date(item.created_at),
                name: item.menu_items?.name || item.menu_item_name || 'Item',
                imageUrl: item.menu_items?.image_url || item.menu_item_image_url
              };
            })
          };
        })
      );

      return ordersWithItems;
    } catch (error) {
      // console.error('[OrderService] Error fetching orders:', error);
      throw error;
    }
  },

  // Update order status
  updateOrderStatus: async (id: string, status: Order['status']): Promise<Order | null> => {
    try {
      const { data, error } = await ((supabase
        .from('orders')
        .update({ status } as any)
        .eq('id', id)
        .select()
        .single()) as { data: any; error: any });

      if (error) {
        throw new Error(error.message);
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
        deliveryPersonId: data.delivery_person_id
      };
    } catch (error) {
      // console.error('Error updating order status:', error);
      throw error;
    }
  },

  // Cancel order
  cancelOrder: async (id: string): Promise<boolean> => {
    try {
      const { error } = await ((supabase
        .from('orders')
        .update({ status: 'cancelled' } as any)
        .eq('id', id)) as any);

      if (error) {
        // console.error('Error cancelling order:', error);
        return false;
      }

      return true;
    } catch (error) {
      // console.error('Error cancelling order:', error);
      return false;
    }
  }
};