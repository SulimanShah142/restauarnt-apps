// Delivery API Service for communication with Supabase
import { supabase } from './supabase';

// Order type definition
export interface Order {
  id: string;
  orderNumber: string;
  userId: string;
  userName: string;
  userPhone: string;
  userAddress: string;
  restaurantId: string;
  restaurantName: string;
  restaurantAddress: string;
  deliveryAddress: string;
  totalAmount: number;
  status: string;
  deliveryStatus: string;
  createdAt: Date;
  updatedAt: Date;
  adminDecision?: string;
  rejectionReason?: string;
  deliveryPersonId?: string;
  paymentMethod: string;
  paymentStatus: string;
  deliveryNotes?: string;
  assignedAt?: Date;
  pickedUpAt?: Date;
  deliveredAt?: Date;
}

export class DeliveryAPIService {
  // Get assigned orders for a delivery person from delivery_assignments table
  async getAssignedOrders(deliveryPersonId: string): Promise<Order[]> {
    try {

      // Fetch from delivery_assignments table
      const { data, error } = await supabase
        .from('delivery_assignments')
        .select('*')
        .eq('delivery_person_id', deliveryPersonId)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('[DeliveryAPIService] Error fetching from delivery_assignments:', error);
        throw new Error(`Supabase error: ${error.message}`);
      }


      // Map the data to Order interface
      return (data || []).map((order: any) => ({
        id: order.id,
        orderNumber: order.order_number,
        userId: order.user_id,
        userName: order.user_name || 'Unknown User',
        userPhone: order.user_phone || 'N/A',
        userAddress: order.delivery_address || 'N/A',
        restaurantId: order.restaurant_id,
        restaurantName: order.restaurant_name || 'Unknown Restaurant',
        restaurantAddress: order.restaurant_address || 'N/A',
        deliveryAddress: order.delivery_address,
        totalAmount: order.total_amount,
        status: order.status,
        deliveryStatus: order.assignment_status || 'not_assigned',
        createdAt: new Date(order.created_at),
        updatedAt: new Date(order.updated_at),
        adminDecision: order.admin_decision,
        rejectionReason: order.rejection_reason,
        deliveryPersonId: order.delivery_person_id,
        paymentMethod: order.payment_method,
        paymentStatus: order.payment_status || 'pending',
        deliveryNotes: order.delivery_notes,
        assignedAt: order.assigned_at ? new Date(order.assigned_at) : undefined,
        pickedUpAt: order.picked_up_at ? new Date(order.picked_up_at) : undefined,
        deliveredAt: order.delivered_at ? new Date(order.delivered_at) : undefined,
      }));
    } catch (error) {
      console.error('[DeliveryAPIService] Error fetching assigned orders:', error);
      throw error;
    }
  }

  // Update order status
  async updateOrderStatus(orderId: string, status: string): Promise<Order> {
    try {
      const { data, error } = await supabase
        .from('orders')
        .update({
          status,
          updated_at: new Date().toISOString()
        })
        .eq('id', orderId)
        .select(`
          *,
          user:users!user_id (name, phone),
          restaurant:restaurants!restaurant_id (name, address)
        `)
        .single();

      if (error) {
        throw new Error(`Supabase error: ${error.message}`);
      }

      return {
        id: data.id,
        orderNumber: data.order_number,
        userId: data.user_id,
        userName: data.user?.name || 'Unknown User',
        userPhone: data.user?.phone || 'N/A',
        userAddress: data.delivery_address || 'N/A',
        restaurantId: data.restaurant_id,
        restaurantName: data.restaurant?.name || 'Unknown Restaurant',
        restaurantAddress: data.restaurant?.address || 'N/A',
        deliveryAddress: data.delivery_address,
        totalAmount: data.total_amount,
        status: data.status,
        deliveryStatus: data.delivery_status || 'not_assigned',
        createdAt: new Date(data.created_at),
        updatedAt: new Date(data.updated_at),
        adminDecision: data.admin_decision,
        rejectionReason: data.rejection_reason,
        deliveryPersonId: data.delivery_person_id,
        paymentMethod: data.payment_method,
        paymentStatus: data.payment_status || 'pending',
        deliveryNotes: data.delivery_notes,
      };
    } catch (error) {
      console.error('Error updating order status:', error);
      throw error;
    }
  }

  // Update delivery person location
  async updateLocation(deliveryPersonId: string, latitude: number, longitude: number): Promise<void> {
    try {
      const { error } = await supabase
        .from('delivery_persons')
        .update({
          current_latitude: latitude,
          current_longitude: longitude,
          updated_at: new Date().toISOString()
        })
        .eq('id', deliveryPersonId);

      if (error) {
        throw new Error(`Supabase error: ${error.message}`);
      }
    } catch (error) {
      console.error('Error updating location:', error);
      throw error;
    }
  }
}