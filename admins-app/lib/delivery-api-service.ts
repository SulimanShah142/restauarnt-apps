// API Service for Delivery App Communication using Supabase
import { supabase } from './supabase';

export interface DeliveryPerson {
  id: string;
  name: string;
  email: string;
  phone?: string;
  status: 'available' | 'busy' | 'inactive';
  current_latitude: number;
  current_longitude: number;
  picture_url?: string;
  created_at: string;
  updated_at: string;
}

export interface Order {
  id: string;
  userId: string;
  userName: string;
  userPhone: string;
  userAddress: string;
  restaurantId: string;
  restaurantName: string;
  restaurantAddress: string;
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

export class DeliveryAPIService {
  // Get delivery personnel by ID
  async getDeliveryPersonById(id: string): Promise<DeliveryPerson | null> {
    try {
      const { data, error } = await supabase
        .from('delivery_personnel')
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
        email: data.email,
        phone: data.phone,
        status: data.status || 'inactive',
        current_latitude: data.current_latitude || 0,
        current_longitude: data.current_longitude || 0,
        picture_url: data.picture_url,
        created_at: data.created_at,
        updated_at: data.updated_at,
      };
    } catch (error) {
      console.error('Error fetching delivery person:', error);
      throw error;
    }
  }

  // Update delivery person status
  async updateDeliveryPersonStatus(id: string, status: string): Promise<DeliveryPerson> {
    try {
      const { data, error } = await supabase
        .from('delivery_personnel')
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
        name: data.name,
        email: data.email,
        phone: data.phone,
        status: data.status || 'inactive',
        current_latitude: data.current_latitude || 0,
        current_longitude: data.current_longitude || 0,
        picture_url: data.picture_url,
        created_at: data.created_at,
        updated_at: data.updated_at,
      };
    } catch (error) {
      console.error('Error updating delivery person status:', error);
      throw error;
    }
  }

  // Update delivery person location
  async updateLocation(id: string, latitude: number, longitude: number): Promise<void> {
    try {
      const { error } = await supabase
        .from('delivery_personnel')
        .update({
          current_latitude: latitude,
          current_longitude: longitude,
          updated_at: new Date().toISOString()
        })
        .eq('id', id);

      if (error) {
        throw new Error(`Supabase error: ${error.message}`);
      }
    } catch (error) {
      console.error('Error updating location:', error);
      throw error;
    }
  }

  // Get orders assigned to a specific delivery person
  async getAssignedOrders(deliveryPersonId: string): Promise<Order[]> {
    try {
      // Fetch orders without relationships (avoids foreign key requirement)
      const { data: ordersData, error } = await supabase
        .from('orders')
        .select('*')
        .eq('delivery_person_id', deliveryPersonId)
        .order('created_at', { ascending: false });

      if (error) {
        throw new Error(`Supabase error: ${error.message}`);
      }

      // Fetch user and restaurant data separately for each order
      const ordersWithRelations = await Promise.all(ordersData.map(async (order: any) => {
        let userData = null;
        let restaurantData = null;

        if (order.user_id) {
          const { data: user } = await supabase
            .from('profiles')  // Use 'profiles' table instead of 'users'
            .select('id, name, phone')
            .eq('id', order.user_id);
          userData = user?.[0] || null;  // Get first result or null
        }

        if (order.restaurant_id) {
          try {
            const { data: restaurant } = await supabase
              .from('restaurants')
              .select('id, name, address')
              .eq('id', order.restaurant_id)
              .single();
            restaurantData = restaurant;
          } catch {
            restaurantData = null;
          }
        }

        return {
          ...order,
          user: userData,
          restaurant: restaurantData
        };
      }));

      return ordersWithRelations.map((order: any) => ({
        id: order.id,
        userId: order.user_id,
        userName: order.user?.name || 'Unknown User',
        userPhone: order.user?.phone || 'N/A',
        userAddress: order.delivery_address || 'N/A',
        restaurantId: order.restaurant_id,
        restaurantName: order.restaurant?.name || 'Unknown Restaurant',
        restaurantAddress: order.restaurant?.address || 'N/A',
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
        deliveryStatus: order.delivery_status || 'not_assigned',
      }));
    } catch (error) {
      console.error('Error fetching assigned orders:', error);
      throw error;
    }
  }

  // Update delivery status
  async updateDeliveryStatus(orderId: string, deliveryStatus: string): Promise<Order> {
    try {
      // Update without relationships
      const { error } = await supabase
        .from('orders')
        .update({
          delivery_status: deliveryStatus,
          updated_at: new Date().toISOString()
        })
        .eq('id', orderId);

      if (error) {
        throw new Error(`Supabase error: ${error.message}`);
      }

      // Fetch updated order without relationships
      const { data: orderData, error: fetchError } = await supabase
        .from('orders')
        .select('*')
        .eq('id', orderId)
        .single();

      if (fetchError) {
        throw new Error(`Supabase error: ${fetchError.message}`);
      }

      // Fetch user data separately
      let userData = null;
      if (orderData.user_id) {
        try {
          const { data: user } = await supabase
            .from('users')
            .select('id, name, phone')
            .eq('id', orderData.user_id)
            .single();
          userData = user;
        } catch {
          userData = null;
        }
      }

      // Fetch restaurant data separately
      let restaurantData = null;
      if (orderData.restaurant_id) {
        try {
          const { data: restaurant } = await supabase
            .from('restaurants')
            .select('id, name, address')
            .eq('id', orderData.restaurant_id)
            .single();
          restaurantData = restaurant;
        } catch {
          restaurantData = null;
        }
      }

      return {
        id: orderData.id,
        userId: orderData.user_id,
        userName: userData?.name || 'Unknown User',
        userPhone: userData?.phone || 'N/A',
        userAddress: orderData.delivery_address || 'N/A',
        restaurantId: orderData.restaurant_id,
        restaurantName: restaurantData?.name || 'Unknown Restaurant',
        restaurantAddress: restaurantData?.address || 'N/A',
        orderNumber: orderData.order_number,
        status: orderData.status,
        totalAmount: orderData.total_amount,
        deliveryAddress: orderData.delivery_address,
        deliveryNotes: orderData.delivery_notes,
        paymentMethod: orderData.payment_method,
        paymentStatus: orderData.payment_status,
        createdAt: new Date(orderData.created_at),
        updatedAt: new Date(orderData.updated_at),
        adminDecision: orderData.admin_decision,
        rejectionReason: orderData.rejection_reason,
        deliveryPersonId: orderData.delivery_person_id,
        deliveryStatus: orderData.delivery_status || 'not_assigned',
      };
    } catch (error) {
      console.error('Error updating delivery status:', error);
      throw error;
    }
  }

  // Get all delivery personnel
  async getAllDeliveryPersons(): Promise<DeliveryPerson[]> {
    try {
      const { data, error } = await supabase
        .from('delivery_personnel')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        throw new Error(`Supabase error: ${error.message}`);
      }

      return data.map((person: any) => ({
        id: person.id,
        name: person.name,
        email: person.email,
        phone: person.phone,
        status: person.status || 'inactive',
        current_latitude: person.current_latitude || 0,
        current_longitude: person.current_longitude || 0,
        picture_url: person.picture_url,
        created_at: person.created_at,
        updated_at: person.updated_at,
      }));
    } catch (error) {
      console.error('Error fetching delivery personnel:', error);
      throw error;
    }
  }
}