import { getDatabase } from '../db';
import { DatabaseInterface } from '../db/types';
import { isOnline } from '../sync-utils';

/**
 * Database manager that coordinates between local and remote databases
 */
class DatabaseManager {
  private static instance: DatabaseManager;
  private db: DatabaseInterface | null = null;
  private isInitialized = false;

  private constructor() {}

  public static getInstance(): DatabaseManager {
    if (!DatabaseManager.instance) {
      DatabaseManager.instance = new DatabaseManager();
    }
    return DatabaseManager.instance;
  }

  /**
   * Initialize the database
   */
  public async initialize() {
    if (this.isInitialized) {
      return;
    }


    try {
      // Initialize the database using the new wrapper
      this.db = await getDatabase();

      // Process any pending sync queue items
      if (this.db) {
        await this.db.syncWithSupabase();
      }

      this.isInitialized = true;
    } catch (error) {
      // console.error('Error initializing database manager:', error);
      throw error;
    }
  }

  /**
   * Sync data with Supabase
   */
  public async syncWithSupabase() {
    // Placeholder - sync functionality moved to dedicated sync services
    if (!this.db) return;
    await this.db.syncWithSupabase();
  }

  /**
   * Get data from the database
   */
  public async getData(table: string, conditions: Record<string, any> = {}) {
    if (!this.db) {
      throw new Error('Database not initialized');
    }

    try {
      switch (table.toLowerCase()) {
        case 'orders':
          if (conditions.user_id) {
            return { source: 'local', data: await this.db.getOrders(conditions.user_id) };
          }
          return { source: 'local', data: await this.db.getOrders() };
          
        case 'restaurants':
          if (conditions.category) {
            return { source: 'local', data: await this.db.getRestaurantsByCategory(conditions.category) };
          }
          return { source: 'local', data: await this.db.getRestaurants() };
          
        case 'menu_items':
          if (conditions.restaurant_id) {
            return { source: 'local', data: await this.db.getMenuItemsByRestaurant(conditions.restaurant_id) };
          }
          throw new Error('restaurant_id is required to get menu items');
          
        case 'profiles':
          if (conditions.id) {
            return { source: 'local', data: await this.db.getUserProfile(conditions.id) };
          }
          throw new Error('id is required to get user profile');
          
        case 'cart':
          if (conditions.user_id) {
            return { source: 'local', data: await this.db.getUserCart(conditions.user_id) };
          }
          throw new Error('user_id is required to get cart items');
          
        case 'favorites':
          if (conditions.user_id) {
            return { source: 'local', data: await this.db.getUserFavorites(conditions.user_id) };
          }
          throw new Error('user_id is required to get favorites');
          
        case 'reviews':
          if (conditions.restaurant_id) {
            return { source: 'local', data: await this.db.getRestaurantReviews(conditions.restaurant_id) };
          }
          throw new Error('restaurant_id is required to get reviews');
          
        default:
          throw new Error(`Table ${table} not supported in new database wrapper`);
      }
    } catch (error) {
      // console.error(`Error getting data from database for table ${table}:`, error);
      return { source: 'none', data: [] };
    }
  }

  /**
   * Save data to the database
   */
  public async saveData(table: string, record: any, id?: string) {
    if (!this.db) {
      throw new Error('Database not initialized');
    }

    const online = await isOnline();
    let result: any = { success: false };

    try {
      switch (table.toLowerCase()) {
        case 'orders':
          if (id) {
            result.local = { success: true, data: await this.db.updateOrder(id, record) };
          } else {
            result.local = { success: true, data: await this.db.createOrder(record) };
          }
          break;
          
        case 'profiles':
          if (id) {
            // Note: updateUserProfile method doesn't exist in our interface, so we'll skip for now
            throw new Error('Update profile not implemented in this interface');
          } else {
            result.local = { success: true, data: await this.db.createUserProfile(record) };
          }
          break;
          
        case 'cart':
          if (id) {
            // For cart, we use the addToCart method which handles updates
            result.local = { success: true, data: await this.db.addToCart(record) };
          } else {
            result.local = { success: true, data: await this.db.addToCart(record) };
          }
          break;
          
        case 'favorites':
          if (record.user_id && record.restaurant_id) {
            if (id) {
              result.local = { success: true, data: await this.db.removeFavorite(record.user_id, record.restaurant_id) };
            } else {
              result.local = { success: true, data: await this.db.addToFavorites(record.user_id, record.restaurant_id) };
            }
          } else {
            throw new Error('user_id and restaurant_id are required for favorites');
          }
          break;
          
        case 'reviews':
          result.local = { success: true, data: await this.db.addReview(record) };
          break;
          
        default:
          throw new Error(`Table ${table} not supported in new database wrapper`);
      }

      result.success = true;

      // If online, sync with Supabase
      if (online) {
        await this.syncWithSupabase();
      }
    } catch (error) {
      // console.error(`Error saving to database for table ${table}:`, error);
      result.error = error instanceof Error ? error.message : 'Unknown error';
    }

    return result;
  }

  /**
   * Get the database instance
   */
  public getDatabase() {
    return this.db;
  }

  /**
   * Check if the database manager is initialized
   */
  public isDatabaseReady() {
    return this.isInitialized;
  }
}

export default DatabaseManager.getInstance();