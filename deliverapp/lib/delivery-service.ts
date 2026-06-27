// Delivery Service - Supabase-based implementation
import { supabase } from './supabase';

export interface DeliveryPerson {
  id: string;
  name: string;
  email: string;
  phone?: string;
  status: 'available' | 'busy' | 'inactive';
  current_latitude?: number;
  current_longitude?: number;
  picture_url?: string;
  created_at: Date;
  updated_at: Date;
}

export interface DeliveryUpdate {
  latitude: number;
  longitude: number;
  status?: 'available' | 'busy' | 'inactive';
}

export interface OrderItem {
  id: string;
  name: string;
  quantity: number;
  price: number;
  imageUrl?: string;
}

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
  subtotal: number;
  deliveryCost: number;
  status: string;
  deliveryStatus: string;
  createdAt: Date;
  updatedAt: Date;
  adminDecision?: string;
  rejectionReason?: string;
  deliveryPersonId?: string;
  paymentMethod?: string;
  paymentStatus: string;
  deliveryNotes?: string;
  items?: OrderItem[]; // Added order items
}

export const deliveryService = {
  // Get all delivery persons
  getAllDeliveryPersons: async (): Promise<DeliveryPerson[]> => {
    try {
      const { data, error } = await supabase
        .from('delivery_persons')
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
        current_latitude: person.current_latitude,
        current_longitude: person.current_longitude,
        picture_url: person.picture_url,
        created_at: new Date(person.created_at),
        updated_at: new Date(person.updated_at),
      }));
    } catch (error) {
      console.error('Error fetching delivery persons:', error);
      throw error;
    }
  },

  // Get delivery person by ID
  getDeliveryPersonById: async (id: string): Promise<DeliveryPerson | null> => {
    try {
      const { data, error } = await supabase
        .from('delivery_persons')
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
        current_latitude: data.current_latitude,
        current_longitude: data.current_longitude,
        picture_url: data.picture_url,
        created_at: new Date(data.created_at),
        updated_at: new Date(data.updated_at),
      };
    } catch (error) {
      console.error('Error fetching delivery person:', error);
      throw error;
    }
  },

  // Create a new delivery person
  createDeliveryPerson: async (personData: Omit<DeliveryPerson, 'id' | 'created_at' | 'updated_at'>): Promise<DeliveryPerson> => {
    // This method would typically be handled by the admin system
    // For now, we'll throw an error since delivery person creation is typically handled by the admin
    throw new Error('Delivery person creation should be handled by the admin system');
  },

  // Update delivery person
  updateDeliveryPerson: async (id: string, updates: Partial<Omit<DeliveryPerson, 'id' | 'created_at' | 'updated_at'>>): Promise<DeliveryPerson | null> => {
    // This method would typically be handled by the admin system
    // For now, we'll throw an error since delivery person updates are typically handled by the admin
    throw new Error('Delivery person updates should be handled by the admin system');
  },

  // Update delivery person location
  updateDeliveryLocation: async (id: string, location: DeliveryUpdate): Promise<DeliveryPerson | null> => {
    try {
      const { latitude, longitude, status } = location;

      // Update location in Supabase
      const updateData: any = {
        current_latitude: latitude,
        current_longitude: longitude,
        updated_at: new Date().toISOString()
      };

      // If status is also provided, include it in the update
      if (status) {
        updateData.status = status;
      }

      const { data, error } = await supabase
        .from('delivery_persons')
        .update(updateData)
        .eq('id', id)
        .select()
        .single();

      if (error) {
        console.error('Error updating delivery location:', error);
        
        // If the delivery person doesn't exist, create one
        if (error.code === 'PGRST116') { // Record not found
          
          // First, get user info to populate the new record
          const { data: userData, error: userError } = await supabase
            .from('users')
            .select('email, name')
            .eq('id', id)
            .single();

          if (userError) {
            console.error('Error getting user data:', userError);
            throw new Error(`Could not get user data: ${userError.message}`);
          }

          // Create the delivery person record
          const { data: newData, error: newError } = await supabase
            .from('delivery_persons')
            .insert([{
              id: id, // Use the user ID as the delivery person ID to match the schema
              name: userData.name || '',
              email: userData.email || '',
              phone: '',  // Use empty string since we don't have phone from users table
              status: status || 'inactive',
              current_latitude: latitude,
              current_longitude: longitude,
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString()
            }])
            .select()
            .single();

          if (newError) {
            console.error('Error creating delivery person record:', newError);
            throw new Error(`Could not create delivery person record: ${newError.message}`);
          }

          return {
            id: newData.id,
            name: newData.name,
            email: newData.email,
            phone: newData.phone,
            status: newData.status || 'inactive',
            current_latitude: newData.current_latitude,
            current_longitude: newData.current_longitude,
            picture_url: newData.picture_url,
            created_at: new Date(newData.created_at),
            updated_at: new Date(newData.updated_at),
          };
        } else {
          throw new Error(`Supabase error: ${error.message}`);
        }
      }

      return {
        id: data.id,
        name: data.name,
        email: data.email,
        phone: data.phone,
        status: data.status || 'inactive',
        current_latitude: data.current_latitude,
        current_longitude: data.current_longitude,
        picture_url: data.picture_url,
        created_at: new Date(data.created_at),
        updated_at: new Date(data.updated_at),
      };
    } catch (error) {
      console.error('Error updating delivery location:', error);
      throw error;
    }
  },

  // Delete delivery person
  deleteDeliveryPerson: async (id: string): Promise<boolean> => {
    // This method would typically be handled by the admin system
    // For now, we'll throw an error since delivery person deletion is typically handled by the admin
    throw new Error('Delivery person deletion should be handled by the admin system');
  },

  // Get available delivery persons
  getAvailableDeliveryPersons: async (): Promise<DeliveryPerson[]> => {
    try {
      const { data, error } = await supabase
        .from('delivery_persons')
        .select('*')
        .eq('status', 'available')
        .order('created_at', { ascending: false });

      if (error) {
        throw new Error(`Supabase error: ${error.message}`);
      }

      return data.map((person: any) => ({
        id: person.id,
        name: person.name,
        email: person.email,
        phone: person.phone,
        status: person.status || 'available',
        current_latitude: person.current_latitude,
        current_longitude: person.current_longitude,
        picture_url: person.picture_url,
        created_at: new Date(person.created_at),
        updated_at: new Date(person.updated_at),
      }));
    } catch (error) {
      console.error('Error fetching available delivery persons:', error);
      throw error;
    }
  },

  // Assign delivery person to order
  assignDeliveryPersonToOrder: async (orderId: string, deliveryPersonUserId: string): Promise<boolean> => {
    try {
      const { error } = await supabase
        .from('orders')
        .update({
          delivery_person_id: deliveryPersonUserId, // Store the user ID to match the schema
          status: 'on_the_way', // Update status to on_the_way when assigned
          updated_at: new Date().toISOString()
        })
        .eq('id', orderId);

      return !error;
    } catch (error) {
      console.error('Error assigning delivery person to order:', error);
      throw error;
    }
  },

  // Get assigned orders for a delivery person from delivery_assignments table
  getAssignedOrders: async (deliveryPersonId: string): Promise<Order[]> => {
    try {

      // Fetch from delivery_assignments table
      const { data, error } = await supabase
        .from('delivery_assignments')
        .select('*')
        .eq('delivery_person_id', deliveryPersonId)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('[DeliveryService] Error fetching from delivery_assignments:', error);
        throw new Error(`Supabase error: ${error.message}`);
      }


      return (data || []).map((order: any) => ({
        id: order.id,
        orderNumber: order.order_number || order.order_id?.substring(0, 8),
        userId: order.user_id,
        userName: order.user_name || 'Unknown User',
        userPhone: order.phone_number || 'N/A',
        userAddress: order.delivery_address || 'N/A',
        restaurantId: order.restaurant_id,
        restaurantName: order.restaurant_name || 'Unknown Restaurant',
        restaurantAddress: order.restaurant_address || 'N/A',
        deliveryAddress: order.delivery_address,
        totalAmount: order.total_amount,
        subtotal: order.subtotal || 0,
        deliveryCost: order.delivery_fee || 0,
        status: order.status,
        deliveryStatus: order.assignment_status || 'assigned',
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
        items: [], // Items would need to be fetched separately if needed
      }));
    } catch (error) {
      console.error('[DeliveryService] Error fetching assigned orders:', error);
      throw error;
    }
  },

  // Get delivery assignments for a delivery person (using delivery_assignments table)
  getDeliveryAssignments: async (deliveryPersonId: string): Promise<any[]> => {
    try {

      // Fetch from delivery_assignments table
      const { data, error } = await supabase
        .from('delivery_assignments')
        .select('*')
        .eq('delivery_person_id', deliveryPersonId)
        .neq('status', 'delivered') // Only fetch non-delivered orders
        .order('assigned_at', { ascending: false });

      if (error) {
        console.error('[DeliveryService] Error fetching from delivery_assignments:', error);
        throw new Error(`Supabase error: ${error.message}`);
      }


      return data || [];
    } catch (error) {
      console.error('[DeliveryService] Error fetching delivery assignments:', error);
      throw error;
    }
  },

  // Accept an order assignment
  acceptOrderAssignment: async (assignmentId: string): Promise<boolean> => {
    try {
      const { error } = await supabase
        .from('delivery_assignments')
        .update({
          status: 'accepted',
          accepted_at: new Date().toISOString()
        })
        .eq('id', assignmentId);

      if (error) {
        throw new Error(`Supabase error: ${error.message}`);
      }

      return true;
    } catch (error) {
      console.error('Error accepting order assignment:', error);
      throw error;
    }
  },

  // Complete an order (mark as is_completed and remove from delivery app)
  completeOrder: async (orderId: string): Promise<boolean> => {
    try {

      const { error } = await supabase
        .from('orders')
        .update({
          is_completed: true,
          completed_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq('id', orderId);

      if (error) {
        throw new Error(`Supabase error: ${error.message}`);
      }

      return true;
    } catch (error) {
      console.error('[DeliveryService] Error completing order:', error);
      throw error;
    }
  },

  // Update assignment status
  updateAssignmentStatus: async (assignmentId: string, status: string): Promise<any> => {
    try {
      // Map status values to match database constraint
      // Valid values: pending, accepted, in_transit, delivered, failed
      let mappedStatus = status;
      if (status === 'picked_up') {
        mappedStatus = 'in_transit';
      }

      // Prepare the update data based on the status
      const updateData: any = {
        status: mappedStatus,
        updated_at: new Date().toISOString()
      };

      // Set the appropriate timestamp based on the status
      if (mappedStatus === 'in_transit') {
        updateData.picked_up_at = new Date().toISOString();
      } else if (mappedStatus === 'delivered') {
        updateData.delivered_at = new Date().toISOString();
      }

      const { data, error } = await supabase
        .from('delivery_assignments')
        .update(updateData)
        .eq('id', assignmentId)
        .select()
        .single();

      if (error) {
        console.error('[DeliveryService] Update assignment error:', error);
        throw new Error(`Supabase error: ${error.message}`);
      }

      return data;
    } catch (error) {
      console.error('Error updating assignment status:', error);
      throw error;
    }
  },

  // Update delivery status
  updateDeliveryStatus: async (orderId: string, deliveryStatus: string): Promise<Order> => {
    try {
      // Update the order status
      const { data, error } = await supabase
        .from('orders')
        .update({
          status: deliveryStatus, // Update the main status field
          updated_at: new Date().toISOString()
        })
        .eq('id', orderId)
        .select('*')
        .single();

      if (error) {
        throw new Error(`Supabase error: ${error.message}`);
      }

      // Fetch additional data separately if needed
      let userName = 'Unknown User';
      let userPhone = 'N/A';
      let restaurantName = 'Unknown Restaurant';
      let restaurantAddress = 'N/A';

      // Fetch user data if user_id exists
      if (data.user_id) {
        try {
          const { data: userData } = await supabase
            .from('users')
            .select('name, phone')
            .eq('id', data.user_id)
            .single();
          if (userData) {
            userName = userData.name || 'Unknown User';
            userPhone = userData.phone || 'N/A';
          }
        } catch (e) {
          console.error('Error fetching user data:', e);
        }
      }

      // Fetch restaurant data if restaurant_id exists
      if (data.restaurant_id) {
        try {
          const { data: restaurantData } = await supabase
            .from('restaurants')
            .select('name, address')
            .eq('id', data.restaurant_id)
            .single();
          if (restaurantData) {
            restaurantName = restaurantData.name || 'Unknown Restaurant';
            restaurantAddress = restaurantData.address || 'N/A';
          }
        } catch (e) {
          console.error('Error fetching restaurant data:', e);
        }
      }

      return {
        id: data.id,
        orderNumber: data.order_number,
        userId: data.user_id,
        userName: userName,
        userPhone: userPhone,
        userAddress: data.delivery_address || 'N/A',
        restaurantId: data.restaurant_id,
        restaurantName: restaurantName,
        restaurantAddress: restaurantAddress,
        deliveryAddress: data.delivery_address,
        totalAmount: data.total_amount,
        subtotal: data.subtotal || 0,
        deliveryCost: data.delivery_cost || 0,
        status: data.status,
        deliveryStatus: data.status,
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
      console.error('Error updating delivery status:', error);
      throw error;
    }
  },

  // Listen for new assignments for a delivery person
  listenForNewAssignments: async (deliveryPersonId: string, callback: (assignment: any) => void) => {
    // Subscribe to real-time updates for delivery assignments
    const subscription = supabase
      .channel('delivery-assignments-changes')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'delivery_assignments',
          filter: `delivery_person_id=eq.${deliveryPersonId}`,
        },
        (payload) => {
          callback(payload.new);
        }
      )
      .subscribe();

    return subscription;
  },

  // Listen for assignment updates
  listenForAssignmentUpdates: async (deliveryPersonId: string, callback: (assignment: any) => void) => {
    // Subscribe to real-time updates for delivery assignments
    const subscription = supabase
      .channel('delivery-assignments-updates')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'delivery_assignments',
          filter: `delivery_person_id=eq.${deliveryPersonId}`,
        },
        (payload) => {
          callback(payload.new);
        }
      )
      .subscribe();

    return subscription;
  }
};