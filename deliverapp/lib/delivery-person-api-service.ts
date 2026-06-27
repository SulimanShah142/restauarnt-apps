// Delivery Person Service - Supabase-based implementation
import { supabase } from './supabase';

// Define TypeScript interfaces
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

// Utility function to generate a UUID
function generateUUID(): string {
  // Generate a simple UUID-like string
  return 'dp_' + Date.now().toString(36) + Math.random().toString(36).substr(2, 5);
}

export interface OrderItem {
  id: string;
  name: string;
  description: string;
  price: number;
  quantity: number;
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
}

// Delivery Person Service for communication with Supabase backend
export class DeliveryPersonAPIService {
  // Get delivery person by ID
  async getDeliveryPersonById(id: string): Promise<DeliveryPerson | null> {
    try {
      
      // Get the delivery person info from delivery_persons table
      const { data: deliveryData, error: deliveryError } = await supabase
        .from('delivery_persons')
        .select('*')
        .eq('id', id)  // Use 'id' instead of 'user_id' based on actual database schema
        .single();


      // If delivery person doesn't exist yet, create a default profile
      if (deliveryError && deliveryError.code === 'PGRST116') {

        // First, get the user info from the application users table
        const { data: userData, error: userError } = await supabase
          .from('users')
          .select('email, name, phone')  // Added phone to the selection
          .eq('id', id)
          .single();


        if (userError) {
          console.error('Error getting user data:', userError);
        }

        // Use the data from the application users table if available
        const email = userData?.email || 'Not set';
        const name = userData?.name || 'New Delivery Person';
        const phone = userData?.phone || 'Not set'; // Get phone from users table

        return {
          id: id,
          name: name,
          email: email,
          phone: phone,  // Phone will be retrieved from users table when delivery_person doesn't exist
          status: 'inactive',
          current_latitude: undefined,
          current_longitude: undefined,
          picture_url: undefined,
          created_at: new Date(),
          updated_at: new Date(),
        };
      }

      if (deliveryError) {
        console.error('Error fetching delivery person:', deliveryError);
        throw new Error(deliveryError.message);
      }

      // Get the user info from the application users table
      const { data: userData, error: userError } = await supabase
        .from('users')
        .select('email, name, phone')  // Added phone to the selection
        .eq('id', id)
        .single();


      if (userError) {
        console.error('Error getting user data:', userError);
      }

      // Combine data from both tables, prioritizing delivery_persons data
      const result = {
        id: deliveryData.id,
        name: deliveryData.name || userData?.name || 'Delivery Person',
        email: deliveryData.email || userData?.email || 'Not set',
        phone: deliveryData.phone || userData?.phone || 'Not set',  // Get phone from delivery_persons first, then users
        status: deliveryData.status as 'available' | 'busy' | 'inactive',
        current_latitude: deliveryData.current_latitude,
        current_longitude: deliveryData.current_longitude,
        picture_url: deliveryData.picture_url,
        created_at: new Date(deliveryData.created_at),
        updated_at: new Date(deliveryData.updated_at),
      };
      
      return result;
    } catch (error) {
      console.error('Error fetching delivery person:', error);
      // Return a default object if there's an error
      return {
        id: id,
        name: 'Error loading profile',
        email: 'Error loading email',
        phone: 'Error loading phone',
        status: 'inactive',
        current_latitude: undefined,
        current_longitude: undefined,
        picture_url: undefined,
        created_at: new Date(),
        updated_at: new Date(),
      };
    }
  }

  // Get all delivery persons
  async getAllDeliveryPersons(): Promise<DeliveryPerson[]> {
    try {
      // Get data primarily from delivery_persons table
      const { data, error } = await supabase
        .from('delivery_persons')
        .select('*')
        .order('name', { ascending: true });

      if (error) {
        throw new Error(error.message);
      }

      return data.map((person: any) => ({
        id: person.id,
        name: person.name || 'Unknown Delivery Person',
        email: person.email || '', // Email from delivery_persons table (not encoded)
        phone: person.phone || '', // Phone from delivery_persons table
        status: person.status as 'available' | 'busy' | 'inactive',
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
  }

  // Get orders assigned to a specific delivery person
  async getAssignedOrders(deliveryPersonId: string): Promise<Order[]> {
    try {
      const { data, error } = await supabase
        .from('orders')
        .select(`
          *,
          user:users!user_id (name, email, phone),
          restaurant:restaurants!restaurant_id (name, address)
        `)
        .eq('delivery_person_id', deliveryPersonId)
        .in('status', ['confirmed', 'preparing', 'ready', 'on_the_way']) // Only active orders
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching assigned orders:', error);
        // Return empty array if there's an error
        return [];
      }

      if (!data) {
        // Return empty array if no data
        return [];
      }

      return data.map((order: any) => ({
        id: order.id,
        orderNumber: order.order_number,
        userId: order.user_id,
        userName: order.user?.name || 'Unknown User',
        userPhone: order.user?.phone || 'N/A', // Using phone from users table if available
        userAddress: order.delivery_address || 'N/A',
        restaurantId: order.restaurant_id,
        restaurantName: order.restaurant?.name || 'Unknown Restaurant',
        restaurantAddress: order.restaurant?.address || 'N/A',
        deliveryAddress: order.delivery_address,
        totalAmount: order.total_amount,
        status: order.status,
        deliveryStatus: order.delivery_status || 'not_assigned',
        createdAt: new Date(order.created_at),
        updatedAt: new Date(order.updated_at),
        adminDecision: order.admin_decision,
        rejectionReason: order.rejection_reason,
        deliveryPersonId: order.delivery_person_id,
        paymentMethod: order.payment_method,
        paymentStatus: order.payment_status || 'pending',
        deliveryNotes: order.delivery_notes,
      }));
    } catch (error) {
      console.error('Error fetching assigned orders:', error);
      // Return empty array if there's an error
      return [];
    }
  }

  // Update delivery status
  async updateDeliveryStatus(orderId: string, deliveryStatus: string): Promise<Order> {
    try {
      // Update the order status
      const { data, error } = await supabase
        .from('orders')
        .update({ 
          status: deliveryStatus,
          updated_at: new Date().toISOString()
        })
        .eq('id', orderId)
        .select('*')
        .single();

      if (error) {
        throw new Error(error.message);
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
        status: data.status,
        deliveryStatus: data.status || 'pending',
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
  }

  // Update delivery person status
  async updateDeliveryPersonStatus(deliveryPersonId: string, status: string): Promise<DeliveryPerson> {
    try {
      
      // Update the status in the delivery_persons table
      const { data: deliveryData, error: deliveryError } = await supabase
        .from('delivery_persons')
        .update({ status: status, updated_at: new Date().toISOString() })
        .eq('id', deliveryPersonId)  // Use 'id' to match the schema (id in delivery_persons table references auth.users.id)
        .select('*')
        .single();


      if (deliveryError) {
        console.error('Error updating delivery_persons table:', deliveryError);

        // If the delivery person doesn't exist, create one with the new status
        if (deliveryError.code === 'PGRST116') { // Record not found

          // First, get user info to populate the new record
          let { data: userData, error: userError } = await supabase
            .from('users')
            .select('email, name, phone')  // Added phone to the selection
            .eq('id', deliveryPersonId)
            .single();


          if (userError) {
            console.error('Error getting user data:', userError);
            // Create a minimal user record if it doesn't exist
            const { error: createUserError } = await supabase
              .from('users')
              .upsert({
                id: deliveryPersonId,
                updated_at: new Date().toISOString()
              }, { onConflict: 'id' });

            if (createUserError) {
              console.error('Error creating user record:', createUserError);
              throw new Error(`Could not create user record: ${createUserError.message}`);
            }

            // Try to get the user data again with minimal info
            const { data: userDataRetry, error: userErrorRetry } = await supabase
              .from('users')
              .select('email, name, phone')  // Added phone to the selection
              .eq('id', deliveryPersonId)
              .single();

            if (userErrorRetry) {
              console.error('Error getting user data after creation:', userErrorRetry);
              throw new Error(`Could not get user data: ${userErrorRetry.message}`);
            }

            userData = userDataRetry;
          }

          // Create the delivery person record
          const { data: newData, error: newError } = await supabase
            .from('delivery_persons')
            .insert({
              id: deliveryPersonId, // Use the user ID as the delivery person ID to match the schema
              name: userData?.name || '',
              email: userData?.email || '',
              phone: userData?.phone || '',  // Use phone from users table if available
              status: status,
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString()
            })
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
            status: status as 'available' | 'busy' | 'inactive',
            current_latitude: newData.current_latitude,
            current_longitude: newData.current_longitude,
            picture_url: newData.picture_url,
            created_at: new Date(newData.created_at),
            updated_at: new Date(newData.updated_at),
          };
        } else {
          throw new Error(deliveryError.message);
        }
      } else {
        // Successfully updated the delivery person record
        return {
          id: deliveryData.id,
          name: deliveryData.name,
          email: deliveryData.email,
          phone: deliveryData.phone,
          status: status as 'available' | 'busy' | 'inactive',
          current_latitude: deliveryData.current_latitude,
          current_longitude: deliveryData.current_longitude,
          picture_url: deliveryData.picture_url,
          created_at: new Date(deliveryData.created_at),
          updated_at: new Date(deliveryData.updated_at),
        };
      }
    } catch (error) {
      console.error('Error updating delivery person status:', error);
      throw error;
    }
  }

  // Update delivery person location
  async updateLocation(deliveryPersonId: string, latitude: number, longitude: number): Promise<void> {
    try {
      // Update the driver location in the tracking table
      const { error } = await supabase
        .from('driver_locations')
        .upsert({
          driver_id: deliveryPersonId, // This should be the user_id from the session
          coords: `POINT(${longitude} ${latitude})`, // PostGIS format for geography
          updated_at: new Date().toISOString()
        });

      if (error) {
        throw new Error(error.message);
      }
    } catch (error) {
      console.error('Error updating location:', error);
      throw error;
    }
  }

  // Update delivery person phone number
  async updateDeliveryPersonPhone(deliveryPersonId: string, phone: string): Promise<DeliveryPerson> {
    try {
      
      // Update the phone in the delivery_persons table
      const { data: deliveryData, error: deliveryError } = await supabase
        .from('delivery_persons')
        .update({ phone: phone, updated_at: new Date().toISOString() })
        .eq('id', deliveryPersonId)  // Use 'id' to match the schema (id in delivery_persons table references auth.users.id)
        .select('*')
        .single();


      if (deliveryError) {
        console.error('Error updating delivery_persons table:', deliveryError);

        // If the delivery person doesn't exist, create one
        if (deliveryError.code === 'PGRST116') { // Record not found

          // First, get user info to populate the new record
          let { data: userData, error: userError } = await supabase
            .from('users')
            .select('email, name, phone')  // Added phone to the selection
            .eq('id', deliveryPersonId)
            .single();


          if (userError) {
            console.error('Error getting user data:', userError);
            // Create a minimal user record if it doesn't exist
            const { error: createUserError } = await supabase
              .from('users')
              .upsert({
                id: deliveryPersonId,
                phone: phone,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
              }, { onConflict: 'id' });

            if (createUserError) {
              console.error('Error creating user record:', createUserError);
              throw new Error(`Could not create user record: ${createUserError.message}`);
            }

            // Try to get the user data again
            const { data: userDataRetry, error: userErrorRetry } = await supabase
              .from('users')
              .select('email, name, phone')  // Added phone to the selection
              .eq('id', deliveryPersonId)
              .single();


            if (userErrorRetry) {
              console.error('Error getting user data after creation:', userErrorRetry);
              throw new Error(`Could not get user data: ${userErrorRetry.message}`);
            }

            userData = userDataRetry;
          }

          // Create the delivery person record
          const { data: newData, error: newError } = await supabase
            .from('delivery_persons')
            .insert({
              id: deliveryPersonId, // Use the user ID as the delivery person ID to match the schema
              name: userData?.name || '',
              email: userData?.email || '',
              phone: phone,
              status: 'inactive',
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString()
            })
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
            status: newData.status as 'available' | 'busy' | 'inactive',
            current_latitude: newData.current_latitude,
            current_longitude: newData.current_longitude,
            picture_url: newData.picture_url,
            created_at: new Date(newData.created_at),
            updated_at: new Date(newData.updated_at),
          };
        } else {
          throw new Error(deliveryError.message);
        }
      } else {
        // Successfully updated the delivery person record
        return {
          id: deliveryData.id,
          name: deliveryData.name,
          email: deliveryData.email,
          phone: deliveryData.phone,
          status: deliveryData.status as 'available' | 'busy' | 'inactive',
          current_latitude: deliveryData.current_latitude,
          current_longitude: deliveryData.current_longitude,
          picture_url: deliveryData.picture_url,
          created_at: new Date(deliveryData.created_at),
          updated_at: new Date(deliveryData.updated_at),
        };
      }
    } catch (error) {
      console.error('Error updating delivery person phone:', error);
      throw error;
    }
  }

}