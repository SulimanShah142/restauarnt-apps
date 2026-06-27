import { supabase } from './supabase';
import { getDatabase } from '../db';

// Delivery Statistics Service for Delivery App
// Note: This service only works with local SQLite database for offline stats
// Supabase doesn't have a delivery_statistics table
export const deliveryStatsService = {
  // Record a delivery completion in local database only
  recordDeliveryCompletion: async (deliveryData: {
    delivery_person_id: string;
    order_id: string;
    order_total_amount: number;
    delivery_fee: number;
    delivery_date: string;
    delivery_rating?: number;
    delivery_tips?: number;
    delivery_status?: string;
    delivery_address?: string;
    delivery_notes?: string;
  }) => {
    try {
      const db = await getDatabase();
      
      // Generate a simple ID using timestamp
      const id = `delivery_${Date.now()}`;
      
      await db.runAsync(
        `INSERT INTO delivery_statistics (
          id, delivery_person_id, order_id, order_total_amount, 
          delivery_fee, delivery_date, delivery_rating, delivery_tips,
          delivery_status, delivery_address, delivery_notes
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          id,
          deliveryData.delivery_person_id,
          deliveryData.order_id,
          deliveryData.order_total_amount,
          deliveryData.delivery_fee,
          deliveryData.delivery_date,
          deliveryData.delivery_rating || null,
          deliveryData.delivery_tips || 0,
          deliveryData.delivery_status || 'delivered',
          deliveryData.delivery_address || '',
          deliveryData.delivery_notes || ''
        ]
      );
      
      return { id, ...deliveryData };
    } catch (error) {
      console.error('Error in deliveryStatsService.recordDeliveryCompletion:', error);
      // Don't throw - this is just for local stats, shouldn't block the main flow
      return null;
    }
  },

  // Get delivery statistics for the current delivery person (from local DB)
  getMyDeliveryStats: async (userId: string) => {
    try {
      const db = await getDatabase();
      
      // Get all deliveries for this user
      const result = await db.getAllAsync(
        'SELECT * FROM delivery_statistics WHERE delivery_person_id = ? ORDER BY delivery_date DESC',
        [userId]
      );
      
      const successfulDeliveries = result.filter((r: any) => r.delivery_status === 'delivered').length;
      const cancelledDeliveries = result.filter((r: any) => r.delivery_status === 'cancelled').length;
      const totalEarnings = result.reduce((sum: number, r: any) => sum + (r.delivery_fee || 0) + (r.delivery_tips || 0), 0);
      
      const ratings = result.filter((r: any) => r.delivery_rating !== null && r.delivery_rating !== undefined);
      const avgRating = ratings.length > 0 
        ? ratings.reduce((sum: number, r: any) => sum + (r.delivery_rating || 0), 0) / ratings.length 
        : 0;
      
      return {
        successfulDeliveries,
        cancelledDeliveries,
        totalEarnings,
        avgRating: parseFloat(avgRating.toFixed(2)),
        totalDeliveries: successfulDeliveries + cancelledDeliveries
      };
    } catch (error) {
      console.error('Error in deliveryStatsService.getMyDeliveryStats:', error);
      return {
        successfulDeliveries: 0,
        cancelledDeliveries: 0,
        totalEarnings: 0,
        avgRating: 0,
        totalDeliveries: 0
      };
    }
  },

  // Get detailed delivery history (from local DB)
  getDeliveryHistory: async (userId: string) => {
    try {
      const db = await getDatabase();
      
      const result = await db.getAllAsync(
        'SELECT * FROM delivery_statistics WHERE delivery_person_id = ? ORDER BY delivery_date DESC',
        [userId]
      );
      
      return result;
    } catch (error) {
      console.error('Error in deliveryStatsService.getDeliveryHistory:', error);
      return [];
    }
  }
};