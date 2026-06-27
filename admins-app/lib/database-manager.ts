import { getDatabase } from '../db';
import { DatabaseInterface } from '../db/types';
import { unifiedSync, processSyncQueue, isOnline } from '../utils/bidirectional-sync';

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
      console.error('Error initializing database manager:', error);
      throw error;
    }
  }

  /**
   * Sync data with Supabase
   */
  public async syncWithSupabase() {
    const online = await isOnline();

    if (online && this.db) {
      await this.db.syncWithSupabase();
    } else {
      console.log('[DatabaseManager] Offline mode - skipping sync');
    }
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
        case 'restaurants':
          if (conditions.id) {
            return { source: 'local', data: await this.db.getRestaurantById(conditions.id) };
          }
          return { source: 'local', data: await this.db.getRestaurants() };
          
        case 'menu_items':
          if (conditions.restaurant_id) {
            return { source: 'local', data: await this.db.getMenuItemsByRestaurant(conditions.restaurant_id) };
          }
          throw new Error('restaurant_id is required to get menu items');
          
        case 'orders':
          if (conditions.restaurant_id) {
            return { source: 'local', data: await this.db.getOrders(conditions.restaurant_id) };
          }
          return { source: 'local', data: await this.db.getOrders() };
          
        case 'admins':
          if (conditions.id) {
            return { source: 'local', data: await this.db.getAdminById(conditions.id) };
          }
          return { source: 'local', data: await this.db.getAdmins() };
          
        case 'feedback':
          if (conditions.restaurant_id) {
            return { source: 'local', data: await this.db.getFeedback(conditions.restaurant_id) };
          }
          return { source: 'local', data: await this.db.getFeedback() };
          
        default:
          throw new Error(`Table ${table} not supported in new database wrapper`);
      }
    } catch (error) {
      console.error(`Error getting data from database for table ${table}:`, error);
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
        case 'restaurants':
          if (id) {
            result.local = { success: true, data: await this.db.updateRestaurant(id, record) };
          } else {
            result.local = { success: true, data: await this.db.createRestaurant(record) };
          }
          break;
          
        case 'menu_items':
          if (id) {
            result.local = { success: true, data: await this.db.updateMenuItem(id, record) };
          } else {
            result.local = { success: true, data: await this.db.createMenuItem(record) };
          }
          break;
          
        case 'orders':
          if (id && record.status) {
            result.local = { success: true, data: await this.db.updateOrderStatus(id, record.status) };
          } else {
            throw new Error('Order ID and status are required to update order status');
          }
          break;
          
        case 'admins':
          if (id) {
            result.local = { success: true, data: await this.db.updateAdmin(id, record) };
          } else {
            result.local = { success: true, data: await this.db.createAdmin(record) };
          }
          break;
          
        case 'feedback':
          result.local = { success: true, data: await this.db.createFeedback(record) };
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
      console.error(`Error saving to database for table ${table}:`, error);
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