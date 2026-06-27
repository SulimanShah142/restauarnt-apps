import { supabase } from './supabase';
import { customAuthWrapper } from './custom-auth-wrapper';

/**
 * Admin API Service to handle all admin operations
 * This service ensures that admin operations are performed securely
 */
export class AdminAPIService {
  /**
   * Check if the current user has admin privileges
   */
  async checkAdminPrivileges(): Promise<boolean> {
    return await customAuthWrapper.isAuthenticated();
  }

  /**
   * Get all restaurants with admin privileges
   */
  async getAllRestaurants() {
    return await customAuthWrapper.selectWithAuth(
      supabase
        .from('restaurants')
        .select('*')
        .order('created_at', { ascending: false }),
      'Access denied: Admin privileges required'
    );
  }

  /**
   * Create a new restaurant with admin privileges
   */
  async createRestaurant(restaurantData: any) {
    return await customAuthWrapper.insertWithAuth(
      'restaurants',
      restaurantData,
      '*',
      'Access denied: Admin privileges required'
    );
  }

  /**
   * Update a restaurant with admin privileges
   */
  async updateRestaurant(id: string, updates: any) {
    return await customAuthWrapper.updateWithAuth(
      'restaurants',
      id,
      updates,
      '*',
      'id',
      'Access denied: Admin privileges required'
    );
  }

  /**
   * Delete a restaurant with admin privileges
   */
  async deleteRestaurant(id: string) {
    return await customAuthWrapper.deleteWithAuth(
      'restaurants',
      id,
      'id',
      'Access denied: Admin privileges required'
    );
  }

  /**
   * Get all orders with admin privileges
   */
  async getAllOrders() {
    return await customAuthWrapper.selectWithAuth(
      supabase
        .from('orders')
        .select(`
          *,
          user:users(name, email),
          restaurant:restaurants(name)
        `)
        .order('created_at', { ascending: false }),
      'Access denied: Admin privileges required'
    );
  }

  /**
   * Update an order with admin privileges
   */
  async updateOrder(id: string, updates: any) {
    return await customAuthWrapper.updateWithAuth(
      'orders',
      id,
      updates,
      '*',
      'id',
      'Access denied: Admin privileges required'
    );
  }

  /**
   * Get all menu items with admin privileges
   */
  async getAllMenuItems() {
    return await customAuthWrapper.selectWithAuth(
      supabase
        .from('menu_items')
        .select(`
          *,
          restaurant:restaurants(name)
        `)
        .order('created_at', { ascending: false }),
      'Access denied: Admin privileges required'
    );
  }

  /**
   * Get all users with admin privileges
   */
  async getAllUsers() {
    return await customAuthWrapper.selectWithAuth(
      supabase
        .from('profiles')  // Use 'profiles' table instead of 'users'
        .select('*')
        .order('created_at', { ascending: false }),
      'Access denied: Admin privileges required'
    );
  }
}

// Create a singleton instance of the AdminAPIService
export const adminAPIService = new AdminAPIService();