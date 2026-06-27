import { getDatabase } from '../db';
import { DatabaseInterface } from '../db/types';
// import { unifiedSync, processSyncQueue, isOnline } from '../utils/bidirectional-sync';

// Placeholder functions for bidirectional-sync if not available
const isOnline = async () => true;

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
        case 'orders':
          if (conditions.status) {
            return { source: 'local', data: await this.db.getOrders(conditions.status) };
          }
          return { source: 'local', data: await this.db.getOrders() };
          
        case 'delivery_assignments':
          if (conditions.delivery_person_id) {
            return { source: 'local', data: await this.db.getDeliveryAssignments(conditions.delivery_person_id) };
          }
          return { source: 'local', data: await this.db.getDeliveryAssignments() };
          
        case 'delivery_persons':
          if (conditions.id) {
            return { source: 'local', data: await this.db.getDeliveryPersonById(conditions.id) };
          }
          throw new Error('id is required to get delivery person');
          
        case 'location_tracking':
          if (conditions.delivery_person_id && conditions.order_id) {
            return { source: 'local', data: await this.db.getLocationHistory(conditions.delivery_person_id, conditions.order_id) };
          }
          throw new Error('delivery_person_id and order_id are required to get location history');
          
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
        case 'orders':
          if (id) {
            result.local = { success: true, data: await this.db.updateOrderStatus(id, record.status) };
          } else {
            throw new Error('Orders should be updated, not created in this interface');
          }
          break;
          
        case 'delivery_assignments':
          if (id) {
            result.local = { success: true, data: await this.db.updateDeliveryAssignment(id, record) };
          } else {
            result.local = { success: true, data: await this.db.createDeliveryAssignment(record) };
          }
          break;
          
        case 'delivery_persons':
          if (id) {
            // Update delivery person location
            if (record.current_lat && record.current_lng) {
              result.local = { success: true, data: await this.db.updateDeliveryPersonLocation(id, record.current_lat, record.current_lng) };
            } else {
              throw new Error('current_lat and current_lng are required to update delivery person location');
            }
          } else {
            throw new Error('Delivery person updates only, no creation in this interface');
          }
          break;
          
        case 'location_tracking':
          result.local = { success: true, data: await this.db.addLocationTracking(record) };
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