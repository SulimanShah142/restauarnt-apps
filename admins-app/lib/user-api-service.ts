// API Service for User App Communication using Supabase
import { supabase } from './supabase';

export interface Restaurant {
  id: string;
  name: string;
  description: string;
  image_url: string;
  address?: string;
  phone?: string;
  rating: number;
  created_at: Date;
  updated_at: Date;
}

export interface FoodItem {
  id: string;
  name: string;
  description: string;
  price: number;
  image_url: string;
  restaurant_id: string;
  category?: string;
  is_available: boolean;
  created_at: Date;
  updated_at: Date;
}

export interface Order {
  id: string;
  userId: string;
  restaurantId: string;
  orderNumber: string;
  status: string;
  totalAmount: number;
  deliveryAddress?: string;
  deliveryNotes?: string;
  paymentMethod?: string;
  paymentStatus: string;
  createdAt: Date;
  updatedAt: Date;
  adminDecision?: string;
  rejectionReason?: string;
  deliveryPersonId?: string;
  deliveryStatus?: string;
}

export interface OrderItem {
  id: string;
  orderId: string;
  menuItemId: string;
  quantity: number;
  price: number;
  createdAt: Date;
  updatedAt: Date;
}

export class UserAPIService {
  // Get all restaurants
  async getAllRestaurants(): Promise<Restaurant[]> {
    try {
      const { data, error } = await supabase
        .from('restaurants')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        throw new Error(`Supabase error: ${error.message}`);
      }

      // Map the response to match the expected interface
      return data.map((item: any) => ({
        id: item.id,
        name: item.name,
        description: item.description,
        image_url: item.image_url || '',
        address: item.address,
        phone: item.phone,
        rating: item.rating || 0,
        created_at: new Date(item.created_at),
        updated_at: new Date(item.updated_at),
      }));
    } catch (error) {
      console.error('Error fetching restaurants:', error);
      throw error;
    }
  }

  // Get restaurant by ID
  async getRestaurantById(id: string): Promise<Restaurant | null> {
    try {
      const { data, error } = await supabase
        .from('restaurants')
        .select('*')
        .eq('id', id)
        .single();

      if (error) {
        if (error.code === 'PGRST116') { // Record not found
          return null;
        }
        throw new Error(`Supabase error: ${error.message}`);
      }

      return {
        id: data.id,
        name: data.name,
        description: data.description,
        image_url: data.image_url || '',
        address: data.address,
        phone: data.phone,
        rating: data.rating || 0,
        created_at: new Date(data.created_at),
        updated_at: new Date(data.updated_at),
      };
    } catch (error) {
      console.error('Error fetching restaurant:', error);
      throw error;
    }
  }

  // Get food items by restaurant ID
  async getFoodItemsByRestaurantId(restaurantId: string): Promise<FoodItem[]> {
    try {
      const { data, error } = await supabase
        .from('food_items')
        .select('*')
        .eq('restaurant_id', restaurantId)
        .order('created_at', { ascending: false });

      if (error) {
        throw new Error(`Supabase error: ${error.message}`);
      }

      return data.map((item: any) => ({
        id: item.id,
        name: item.name,
        description: item.description,
        price: item.price,
        image_url: item.image_url || '',
        restaurant_id: item.restaurant_id,
        category: item.category || item.category_id || undefined,
        is_available: item.is_available || true,
        created_at: new Date(item.created_at),
        updated_at: new Date(item.updated_at),
      }));
    } catch (error) {
      console.error('Error fetching food items:', error);
      throw error;
    }
  }

  // Get all food items
  async getAllFoodItems(): Promise<FoodItem[]> {
    try {
      const { data, error } = await supabase
        .from('food_items')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        throw new Error(`Supabase error: ${error.message}`);
      }

      return data.map((item: any) => ({
        id: item.id,
        name: item.name,
        description: item.description,
        price: item.price,
        image_url: item.image_url || '',
        restaurant_id: item.restaurant_id,
        category: item.category || item.category_id || undefined,
        is_available: item.is_available || true,
        created_at: new Date(item.created_at),
        updated_at: new Date(item.updated_at),
      }));
    } catch (error) {
      console.error('Error fetching all food items:', error);
      throw error;
    }
  }

  // Get food item by ID
  async getFoodItemById(id: string): Promise<FoodItem | null> {
    try {
      const { data, error } = await supabase
        .from('food_items')
        .select('*')
        .eq('id', id)
        .single();

      if (error) {
        if (error.code === 'PGRST116') { // Record not found
          return null;
        }
        throw new Error(`Supabase error: ${error.message}`);
      }

      return {
        id: data.id,
        name: data.name,
        description: data.description,
        price: data.price,
        image_url: data.image_url || '',
        restaurant_id: data.restaurant_id,
        category: data.category || data.category_id || undefined,
        is_available: data.is_available || true,
        created_at: new Date(data.created_at),
        updated_at: new Date(data.updated_at),
      };
    } catch (error) {
      console.error('Error fetching food item:', error);
      throw error;
    }
  }

  // Create a new order
  async createOrder(userId: string, restaurantId: string, totalAmount: number, orderItems: Array<{menuItemId: string, quantity: number, price: number}>): Promise<Order> {
    try {
      const orderData = {
        user_id: userId,
        restaurant_id: restaurantId,
        total_amount: totalAmount,
        order_number: `ORD-${Date.now()}`,
        status: 'pending',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      const { data, error } = await supabase
        .from('orders')
        .insert([orderData])
        .select()
        .single();

      if (error) {
        throw new Error(`Supabase error: ${error.message}`);
      }

      // Create order items if provided
      if (orderItems.length > 0) {
        const orderItemData = orderItems.map(item => ({
          order_id: data.id,
          menu_item_id: item.menuItemId,
          quantity: item.quantity,
          price: item.price,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        }));

        const { error: itemError } = await supabase
          .from('order_items')
          .insert(orderItemData);

        if (itemError) {
          console.error('Error creating order items:', itemError);
          // Optionally, you might want to rollback the order creation here
        }
      }

      return {
        id: data.id,
        userId: data.user_id,
        restaurantId: data.restaurant_id,
        orderNumber: data.order_number,
        status: data.status,
        totalAmount: data.total_amount,
        deliveryAddress: data.delivery_address,
        deliveryNotes: data.delivery_notes,
        paymentMethod: data.payment_method,
        paymentStatus: data.payment_status,
        createdAt: new Date(data.created_at),
        updatedAt: new Date(data.updated_at),
        adminDecision: data.admin_decision,
        rejectionReason: data.rejection_reason,
        deliveryPersonId: data.delivery_person_id,
        deliveryStatus: data.delivery_status,
      };
    } catch (error) {
      console.error('Error creating order:', error);
      throw error;
    }
  }

  // Get orders by user ID
  async getOrdersByUserId(userId: string): Promise<Order[]> {
    try {
      const { data, error } = await supabase
        .from('orders')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      if (error) {
        throw new Error(`Supabase error: ${error.message}`);
      }

      return data.map((order: any) => ({
        id: order.id,
        userId: order.user_id,
        restaurantId: order.restaurant_id,
        orderNumber: order.order_number,
        status: order.status,
        totalAmount: order.total_amount,
        deliveryAddress: order.delivery_address,
        deliveryNotes: order.delivery_notes,
        paymentMethod: order.payment_method,
        paymentStatus: order.payment_status,
        createdAt: new Date(order.created_at),
        updatedAt: new Date(order.updated_at),
        adminDecision: order.admin_decision,
        rejectionReason: order.rejection_reason,
        deliveryPersonId: order.delivery_person_id,
        deliveryStatus: order.delivery_status,
      }));
    } catch (error) {
      console.error('Error fetching orders by user ID:', error);
      throw error;
    }
  }

  // Get order by ID
  async getOrderById(id: string): Promise<Order | null> {
    try {
      const { data, error } = await supabase
        .from('orders')
        .select('*')
        .eq('id', id)
        .single();

      if (error) {
        if (error.code === 'PGRST116') { // Record not found
          return null;
        }
        throw new Error(`Supabase error: ${error.message}`);
      }

      return {
        id: data.id,
        userId: data.user_id,
        restaurantId: data.restaurant_id,
        orderNumber: data.order_number,
        status: data.status,
        totalAmount: data.total_amount,
        deliveryAddress: data.delivery_address,
        deliveryNotes: data.delivery_notes,
        paymentMethod: data.payment_method,
        paymentStatus: data.payment_status,
        createdAt: new Date(data.created_at),
        updatedAt: new Date(data.updated_at),
        adminDecision: data.admin_decision,
        rejectionReason: data.rejection_reason,
        deliveryPersonId: data.delivery_person_id,
        deliveryStatus: data.delivery_status,
      };
    } catch (error) {
      console.error('Error fetching order by ID:', error);
      throw error;
    }
  }

  // Update order status
  async updateOrderStatus(id: string, status: string): Promise<Order | null> {
    try {
      const { data, error } = await supabase
        .from('orders')
        .update({
          status,
          updated_at: new Date().toISOString()
        })
        .eq('id', id)
        .select()
        .single();

      if (error) {
        throw new Error(`Supabase error: ${error.message}`);
      }

      return {
        id: data.id,
        userId: data.user_id,
        restaurantId: data.restaurant_id,
        orderNumber: data.order_number,
        status: data.status,
        totalAmount: data.total_amount,
        deliveryAddress: data.delivery_address,
        deliveryNotes: data.delivery_notes,
        paymentMethod: data.payment_method,
        paymentStatus: data.payment_status,
        createdAt: new Date(data.created_at),
        updatedAt: new Date(data.updated_at),
        adminDecision: data.admin_decision,
        rejectionReason: data.rejection_reason,
        deliveryPersonId: data.delivery_person_id,
        deliveryStatus: data.delivery_status,
      };
    } catch (error) {
      console.error('Error updating order status:', error);
      throw error;
    }
  }
}