// api-client.ts - API client for frontend to communicate with Supabase
import { supabase } from './supabase';

export interface User {
  id: string;
  name?: string;
  email?: string;
  emailVerified?: Date;
  image?: string;
}

export interface Order {
  id: string;
  userId: string;
  totalAmount: number;
  status: 'pending' | 'confirmed' | 'preparing' | 'ready' | 'delivered' | 'cancelled';
  createdAt: Date;
  updatedAt: Date;
}

export interface OrderItem {
  id: string;
  orderId: string;
  foodItemId: string; // Changed to string for MySQL
  quantity: number;
  priceAtOrder: number;
  createdAt: Date;
}

class ApiClient {
  // User API methods
  async getCurrentUser(): Promise<User | null> {
    try {
      const { data: { session }, error } = await supabase.auth.getSession();

      if (error || !session) {
        return null; // Not authenticated
      }

      return {
        id: session.user.id,
        name: session.user.user_metadata?.name || session.user.email?.split('@')[0],
        email: session.user.email,
        emailVerified: session.user.email_confirmed_at ? new Date(session.user.email_confirmed_at) : undefined,
        image: session.user.user_metadata?.avatar_url || session.user.user_metadata?.picture,
      };
    } catch (error) {
      // console.error('Error fetching user:', error);
      return null;
    }
  }

  // Order API methods
  async createOrder(userId: string, totalAmount: number, orderItems: {foodItemId: string, quantity: number, price: number}[]): Promise<Order> { // Changed foodItemId to string
    try {
      // Create the order
      const { data: orderData, error: orderError } = await supabase
        .from('orders')
        .insert([{
          user_id: userId,
          total_amount: totalAmount,
          status: 'pending',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        }] as any)
        .select()
        .single() as { data: any; error: any };

      if (orderError) {
        throw new Error(`Supabase error creating order: ${orderError.message}`);
      }

      // Create order items
      if (orderItems.length > 0) {
        const orderItemData = orderItems.map(item => ({
          order_id: orderData.id,
          menu_item_id: item.foodItemId,
          quantity: item.quantity,
          price: item.price,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        }));

        const { error: itemError } = await (supabase
          .from('order_items')
          .insert(orderItemData as any) as any);

        if (itemError) {
          // console.error('Error creating order items:', itemError);
          // Optionally, you might want to rollback the order creation here
        }
      }

      return {
        id: orderData.id,
        userId: orderData.user_id,
        totalAmount: orderData.total_amount,
        status: orderData.status as Order['status'],
        createdAt: new Date(orderData.created_at),
        updatedAt: new Date(orderData.updated_at)
      };
    } catch (error) {
      // console.error('Error creating order:', error);
      throw error;
    }
  }

  async getOrderById(id: string): Promise<(Order & { items: OrderItem[] }) | null> {
    try {
      // Get the order with its items
      const { data: orderData, error: orderError } = await supabase
        .from('orders')
        .select(`
          *,
          order_items (
            *
          )
        `)
        .eq('id', id)
        .single() as { data: any; error: any };

      if (orderError) {
        if (orderError.code === 'PGRST116') { // Record not found
          return null;
        }
        throw new Error(`Supabase error: ${orderError.message}`);
      }

      return {
        id: orderData.id,
        userId: orderData.user_id,
        totalAmount: orderData.total_amount,
        status: orderData.status as Order['status'],
        createdAt: new Date(orderData.created_at),
        updatedAt: new Date(orderData.updated_at),
        items: orderData.order_items.map((item: any) => ({
          id: item.id,
          orderId: item.order_id,
          foodItemId: item.menu_item_id,
          quantity: item.quantity,
          priceAtOrder: item.price,
          createdAt: new Date(item.created_at)
        })) || []
      };
    } catch (error) {
      // console.error('Error fetching order:', error);
      return null;
    }
  }

  async getOrdersByUserId(userId: string): Promise<(Order & { items: OrderItem[] })[]> {
    try {
      // Get orders for the user with their items
      const { data: ordersData, error: ordersError } = await supabase
        .from('orders')
        .select(`
          *,
          order_items (
            *
          )
        `)
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      if (ordersError) {
        throw new Error(`Supabase error: ${ordersError.message}`);
      }

      return ordersData.map((order: any) => ({
        id: order.id,
        userId: order.user_id,
        totalAmount: order.total_amount,
        status: order.status as Order['status'],
        createdAt: new Date(order.created_at),
        updatedAt: new Date(order.updated_at),
        items: order.order_items.map((item: any) => ({
          id: item.id,
          orderId: item.order_id,
          foodItemId: item.menu_item_id,
          quantity: item.quantity,
          priceAtOrder: item.price,
          createdAt: new Date(item.created_at)
        })) || []
      }));
    } catch (error) {
      // console.error('Error fetching orders:', error);
      return [];
    }
  }

  async updateOrderStatus(id: string, status: Order['status']): Promise<Order | null> {
    try {
      const { data: updatedOrder, error } = await (supabase
        .from('orders')
        .update({
          status,
          updated_at: new Date().toISOString()
        } as any)
        .eq('id', id)
        .select()
        .single() as { data: any; error: any });

      if (error) {
        if (error.code === 'PGRST116') { // Record not found
          return null;
        }
        throw new Error(`Supabase error: ${error.message}`);
      }

      return {
        id: updatedOrder.id,
        userId: updatedOrder.user_id,
        totalAmount: updatedOrder.total_amount,
        status: updatedOrder.status as Order['status'],
        createdAt: new Date(updatedOrder.created_at),
        updatedAt: new Date(updatedOrder.updated_at)
      };
    } catch (error) {
      // console.error('Error updating order status:', error);
      return null;
    }
  }

  async cancelOrder(id: string): Promise<boolean> {
    try {
      const { error } = await (supabase
        .from('orders')
        .update({
          status: 'cancelled',
          updated_at: new Date().toISOString()
        } as any)
        .eq('id', id) as any);

      if (error) {
        // console.error('Error canceling order:', error);
        return false;
      }

      return true;
    } catch (error) {
      // console.error('Error canceling order:', error);
      return false;
    }
  }
}

export const apiClient = new ApiClient();