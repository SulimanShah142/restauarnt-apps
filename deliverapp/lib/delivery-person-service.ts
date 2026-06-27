import { supabase } from './supabase';
import { getDatabase } from '../db';

// Delivery Person Service - restricted functionality
// Updates Supabase first, then updates local DB with raw SQL
export const deliveryPersonService = {
  // Get delivery person profile (read only)
  getProfile: async (userId: string) => {
    try {
      // Get delivery person record
      const { data: deliveryPersonData, error: deliveryPersonError } = await supabase
        .from('delivery_persons')
        .select(`
          *,
          users:user_id (
            id,
            email,
            name,
            phone,
            image_url
          )
        `)
        .eq('user_id', userId)
        .single();

      if (deliveryPersonError) {
        throw new Error(`Error fetching delivery person data: ${deliveryPersonError.message}`);
      }

      return deliveryPersonData;
    } catch (error) {
      console.error('Error in deliveryPersonService.getProfile:', error);
      throw error;
    }
  },

  // Update availability status only
  updateAvailability: async (userId: string, isAvailable: boolean) => {
    try {
      // Update Supabase first
      const { data, error } = await supabase
        .from('delivery_persons')
        .update({
          is_available: isAvailable,
          updated_at: new Date().toISOString()
        })
        .eq('user_id', userId)
        .select()
        .single();

      if (error) {
        throw new Error(`Error updating availability: ${error.message}`);
      }

      // LOCAL DB: Update directly using raw SQL (matching admins-app pattern)
      try {
        const db = await getDatabase();
        if ('runAsync' in db) {
          await db.runAsync(
            `UPDATE delivery_persons SET is_available = ?, updated_at = datetime('now') WHERE user_id = ?`,
            [isAvailable ? 1 : 0, userId]
          );
        }
      } catch (localDbError) {
        console.error('updateAvailability - ⚠️ Local DB update failed:', localDbError);
        // Don't throw - Supabase update was successful
      }

      return data;
    } catch (error) {
      console.error('Error in deliveryPersonService.updateAvailability:', error);
      throw error;
    }
  },

  // Update location only
  updateLocation: async (userId: string, latitude: number, longitude: number) => {
    try {
      // Update Supabase first
      const { data, error } = await supabase
        .from('delivery_persons')
        .update({
          current_latitude: latitude,
          current_longitude: longitude,
          current_location: { type: 'Point', coordinates: [longitude, latitude] },
          updated_at: new Date().toISOString()
        })
        .eq('user_id', userId)
        .select()
        .single();

      if (error) {
        throw new Error(`Error updating location: ${error.message}`);
      }

      // LOCAL DB: Update directly using raw SQL (matching admins-app pattern)
      try {
        const db = await getDatabase();
        if ('runAsync' in db) {
          await db.runAsync(
            `UPDATE delivery_persons SET current_latitude = ?, current_longitude = ?, current_location = ?, updated_at = datetime('now') WHERE user_id = ?`,
            [latitude, longitude, JSON.stringify({ type: 'Point', coordinates: [longitude, latitude] }), userId]
          );
        }
      } catch (localDbError) {
        console.error('updateLocation - ⚠️ Local DB update failed:', localDbError);
        // Don't throw - Supabase update was successful
      }

      return data;
    } catch (error) {
      console.error('Error in deliveryPersonService.updateLocation:', error);
      throw error;
    }
  },

  // Update vehicle info only
  updateVehicleInfo: async (userId: string, vehicleType: string, licensePlate: string) => {
    try {
      // Update Supabase first
      const { data, error } = await supabase
        .from('delivery_persons')
        .update({
          vehicle_type: vehicleType,
          license_plate: licensePlate,
          updated_at: new Date().toISOString()
        })
        .eq('user_id', userId)
        .select()
        .single();

      if (error) {
        throw new Error(`Error updating vehicle info: ${error.message}`);
      }

      // LOCAL DB: Update directly using raw SQL (matching admins-app pattern)
      try {
        const db = await getDatabase();
        if ('runAsync' in db) {
          await db.runAsync(
            `UPDATE delivery_persons SET vehicle_type = ?, license_plate = ?, updated_at = datetime('now') WHERE user_id = ?`,
            [vehicleType, licensePlate, userId]
          );
        }
      } catch (localDbError) {
        console.error('updateVehicleInfo - ⚠️ Local DB update failed:', localDbError);
        // Don't throw - Supabase update was successful
      }

      return data;
    } catch (error) {
      console.error('Error in deliveryPersonService.updateVehicleInfo:', error);
      throw error;
    }
  },

  // Get assigned orders for this delivery person
  getAssignedOrders: async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from('orders')
        .select(`
          *,
          users:user_id (
            name,
            phone,
            email
          ),
          restaurants (
            name,
            address,
            latitude,
            longitude
          )
        `)
        .eq('delivery_person_id', userId)
        .in('status', ['on_the_way', 'delivered']) // Only active or recently delivered orders
        .order('created_at', { ascending: false });

      if (error) {
        throw new Error(`Error fetching assigned orders: ${error.message}`);
      }

      return data;
    } catch (error) {
      console.error('Error in deliveryPersonService.getAssignedOrders:', error);
      throw error;
    }
  },

  // Update order status (when delivering)
  updateOrderStatus: async (orderId: string, status: string) => {
    try {
      // Update Supabase first
      const { data, error } = await supabase
        .from('orders')
        .update({
          status: status,
          updated_at: new Date().toISOString()
        })
        .eq('id', orderId)
        .select()
        .single();

      if (error) {
        throw new Error(`Error updating order status: ${error.message}`);
      }

      // LOCAL DB: Update directly using raw SQL (matching admins-app pattern)
      try {
        const db = await getDatabase();
        if ('runAsync' in db) {
          await db.runAsync(
            `UPDATE orders SET status = ?, updated_at = datetime('now') WHERE id = ?`,
            [status, orderId]
          );
        }
      } catch (localDbError) {
        console.error('updateOrderStatus - ⚠️ Local DB update failed:', localDbError);
        // Don't throw - Supabase update was successful
      }

      return data;
    } catch (error) {
      console.error('Error in deliveryPersonService.updateOrderStatus:', error);
      throw error;
    }
  }
};