import { supabase } from './supabase';
import { customAuthWrapper } from './custom-auth-wrapper';

// Validate if the user is authenticated via custom auth
const validateCustomAuth = async (): Promise<boolean> => {
  return await customAuthWrapper.isAuthenticated();
};

// Get the authenticated admin user from custom auth session
const getAuthenticatedUser = async () => {
  return await customAuthWrapper.getAuthenticatedUser();
};

// API Service for Delivery Statistics
export const deliveryStatisticsService = {
  // Get delivery statistics for a specific delivery person
  getDeliveryStatsByPersonId: async (deliveryPersonId: string) => {
    if (!(await validateCustomAuth())) {
      throw new Error('Unauthorized: Invalid or expired session');
    }

    const { data, error } = await supabase
      .from('delivery_statistics')
      .select(`
        *,
        orders (
          id,
          total_amount,
          status,
          created_at
        ),
        users:user_id (
          name,
          email
        )
      `)
      .eq('delivery_person_id', deliveryPersonId)
      .order('delivery_date', { ascending: false });

    if (error) {
      throw new Error(`Database error: ${error.message}`);
    }

    return data;
  },

  // Get all delivery statistics
  getAllDeliveryStats: async () => {
    if (!(await validateCustomAuth())) {
      throw new Error('Unauthorized: Invalid or expired session');
    }

    const { data, error } = await supabase
      .from('delivery_statistics')
      .select(`
        *,
        orders (
          id,
          total_amount,
          status,
          created_at
        ),
        users:user_id (
          name,
          email
        )
      `)
      .order('delivery_date', { ascending: false });

    if (error) {
      throw new Error(`Database error: ${error.message}`);
    }

    return data;
  },

  // Get summary statistics for a delivery person
  getDeliverySummaryStats: async (deliveryPersonId: string) => {
    if (!(await validateCustomAuth())) {
      throw new Error('Unauthorized: Invalid or expired session');
    }

    // Get count of successful deliveries
    const { count: successfulDeliveries, error: successError } = await supabase
      .from('delivery_statistics')
      .select('*', { count: 'exact', head: true })
      .eq('delivery_person_id', deliveryPersonId)
      .eq('delivery_status', 'delivered');

    if (successError) {
      throw new Error(`Database error: ${successError.message}`);
    }

    // Get count of cancelled deliveries
    const { count: cancelledDeliveries, error: cancelError } = await supabase
      .from('delivery_statistics')
      .select('*', { count: 'exact', head: true })
      .eq('delivery_person_id', deliveryPersonId)
      .eq('delivery_status', 'cancelled');

    if (cancelError) {
      throw new Error(`Database error: ${cancelError.message}`);
    }

    // Get total earnings
    const { data: earningsData, error: earningsError } = await supabase
      .from('delivery_statistics')
      .select('delivery_fee, delivery_tips')
      .eq('delivery_person_id', deliveryPersonId);

    if (earningsError) {
      throw new Error(`Database error: ${earningsError.message}`);
    }

    const totalEarnings = earningsData.reduce((sum, record) => {
      return sum + (record.delivery_fee || 0) + (record.delivery_tips || 0);
    }, 0);

    // Get average rating
    const { data: ratingsData, error: ratingsError } = await supabase
      .from('delivery_statistics')
      .select('delivery_rating')
      .eq('delivery_person_id', deliveryPersonId)
      .not('delivery_rating', 'is', null);

    if (ratingsError) {
      throw new Error(`Database error: ${ratingsError.message}`);
    }

    const avgRating = ratingsData.length > 0 
      ? ratingsData.reduce((sum, record) => sum + (record.delivery_rating || 0), 0) / ratingsData.length
      : 0;

    return {
      successfulDeliveries: successfulDeliveries || 0,
      cancelledDeliveries: cancelledDeliveries || 0,
      totalEarnings,
      avgRating: parseFloat(avgRating.toFixed(2)),
      totalDeliveries: (successfulDeliveries || 0) + (cancelledDeliveries || 0)
    };
  },

  // Create a new delivery statistic record
  createDeliveryStat: async (statData: {
    delivery_person_id: string;
    order_id: string;
    order_total_amount: number;
    delivery_fee: number;
    delivery_date: string;
    delivery_rating?: number;
    delivery_tips?: number;
    delivery_status?: string;
  }) => {
    if (!(await validateCustomAuth())) {
      throw new Error('Unauthorized: Invalid or expired session');
    }

    const { data, error } = await supabase
      .from('delivery_statistics')
      .insert([statData])
      .select()
      .single();

    if (error) {
      throw new Error(`Database error: ${error.message}`);
    }

    return data;
  },

  // Update delivery statistics
  updateDeliveryStat: async (id: string, updates: any) => {
    if (!(await validateCustomAuth())) {
      throw new Error('Unauthorized: Invalid or expired session');
    }

    const { data, error } = await supabase
      .from('delivery_statistics')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      throw new Error(`Database error: ${error.message}`);
    }

    return data;
  },

  // Delete delivery statistic record
  deleteDeliveryStat: async (id: string) => {
    if (!(await validateCustomAuth())) {
      throw new Error('Unauthorized: Invalid or expired session');
    }

    const { error } = await supabase
      .from('delivery_statistics')
      .delete()
      .eq('id', id);

    if (error) {
      throw new Error(`Database error: ${error.message}`);
    }

    return { success: true };
  }
};