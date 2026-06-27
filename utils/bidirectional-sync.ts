import { createClient } from '@supabase/supabase-js';
import { Platform } from 'react-native';

// Initialize Supabase client
const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseAnonKey);

/**
 * Check if device is online
 */
export const isOnline = async (): Promise<boolean> => {
  try {
    // Try to make a simple request to Supabase to check connectivity
    const { error } = await supabase.from('restaurants').select('id').limit(1);
    return !error;
  } catch (err) {
    console.warn('Network check failed:', err);
    return false;
  }
};

/**
 * Generic function to fetch data from Supabase
 */
export const fetchFromSupabase = async (table: string, conditions: Record<string, any> = {}) => {
  try {
    let query = supabase.from(table).select('*');
    
    // Apply conditions
    Object.entries(conditions).forEach(([key, value]) => {
      if (typeof value === 'object' && value.operator && value.value) {
        // Handle operators like { operator: 'eq', value: 'active' }
        switch(value.operator) {
          case 'eq':
            query = query.eq(key, value.value);
            break;
          case 'neq':
            query = query.neq(key, value.value);
            break;
          case 'lt':
            query = query.lt(key, value.value);
            break;
          case 'lte':
            query = query.lte(key, value.value);
            break;
          case 'gt':
            query = query.gt(key, value.value);
            break;
          case 'gte':
            query = query.gte(key, value.value);
            break;
          case 'in':
            query = query.in(key, value.value);
            break;
          default:
            query = query.eq(key, value);
        }
      } else {
        query = query.eq(key, value);
      }
    });

    const { data, error } = await query;
    
    if (error) {
      console.error(`Error fetching ${table} from Supabase:`, error);
      return null;
    }

    return data;
  } catch (error) {
    console.error(`Error in fetchFromSupabase for ${table}:`, error);
    return null;
  }
};

/**
 * Generic function to fetch data from SQLite
 */
export const fetchFromSQLite = async (db: any, query: string, params: any[] = []) => {
  try {
    if (!db) {
      console.error('Database not initialized');
      return null;
    }
    
    const result = await db.getAllAsync(query, params);
    return result;
  } catch (error) {
    console.error('Error fetching from SQLite:', error);
    return null;
  }
};

/**
 * Generic function to insert/update data to Supabase
 */
export const saveToSupabase = async (table: string, record: any, id?: string) => {
  try {
    let result;
    
    if (id) {
      // Update existing record
      result = await supabase.from(table).update(record).eq('id', id);
    } else {
      // Insert new record
      result = await supabase.from(table).insert([record]);
    }
    
    if (result.error) {
      console.error(`Error saving to ${table} in Supabase:`, result.error);
      return null;
    }
    
    return result.data;
  } catch (error) {
    console.error(`Error in saveToSupabase for ${table}:`, error);
    return null;
  }
};

/**
 * Generic function to insert/update data to SQLite
 */
export const saveToSQLite = async (db: any, table: string, record: any) => {
  try {
    if (!db) {
      console.error('Database not initialized');
      return null;
    }
    
    // Prepare the INSERT OR REPLACE query based on the table
    let query = '';
    let params: any[] = [];
    
    switch (table) {
      case 'restaurants':
        query = `INSERT OR REPLACE INTO restaurants 
                 (id, name, address, rating, image_url, delivery_fee, min_order_amount, 
                  estimated_delivery_time, is_active, created_at, updated_at) 
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;
        params = [
          record.id,
          record.name,
          record.address,
          record.rating,
          record.image_url,
          record.delivery_fee,
          record.min_order_amount,
          record.estimated_delivery_time,
          record.is_active ? 1 : 0,
          record.created_at || new Date().toISOString(),
          record.updated_at || new Date().toISOString()
        ];
        break;
        
      case 'menu_categories':
        query = `INSERT OR REPLACE INTO menu_categories 
                 (id, restaurant_id, name, description, sort_order, is_active, created_at, updated_at) 
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?)`;
        params = [
          record.id,
          record.restaurant_id,
          record.name,
          record.description || '',
          record.sort_order || 0,
          record.is_active ? 1 : 0,
          record.created_at || new Date().toISOString(),
          record.updated_at || new Date().toISOString()
        ];
        break;
        
      case 'menu_items':
        query = `INSERT OR REPLACE INTO menu_items 
                 (id, category_id, name, description, price, image_url, is_available, 
                  is_vegetarian, is_spicy, calories, created_at, updated_at) 
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;
        params = [
          record.id,
          record.category_id,
          record.name,
          record.description || '',
          parseFloat(record.price) || 0,
          record.image_url,
          record.is_available ? 1 : 0,
          record.is_vegetarian ? 1 : 0,
          record.is_spicy ? 1 : 0,
          record.calories || null,
          record.created_at || new Date().toISOString(),
          record.updated_at || new Date().toISOString()
        ];
        break;
        
      case 'users':
        query = `INSERT OR REPLACE INTO users 
                 (id, email, name, phone, image_url, created_at, updated_at) 
                 VALUES (?, ?, ?, ?, ?, ?, ?)`;
        params = [
          record.id,
          record.email,
          record.name || null,
          record.phone || null,
          record.image_url || null,
          record.created_at || new Date().toISOString(),
          record.updated_at || new Date().toISOString()
        ];
        break;
        
      case 'addresses':
        query = `INSERT OR REPLACE INTO addresses 
                 (id, user_id, street_address, city, state, zip_code, country, is_default, 
                  latitude, longitude, created_at, updated_at) 
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;
        params = [
          record.id,
          record.user_id,
          record.street_address,
          record.city,
          record.state,
          record.zip_code,
          record.country,
          record.is_default ? 1 : 0,
          record.latitude || null,
          record.longitude || null,
          record.created_at || new Date().toISOString(),
          record.updated_at || new Date().toISOString()
        ];
        break;
        
      case 'orders':
        query = `INSERT OR REPLACE INTO orders 
                 (id, user_id, restaurant_id, delivery_address_id, order_number, status, 
                  subtotal, tax_amount, delivery_fee, tip_amount, total_amount, 
                  special_instructions, estimated_delivery_time, created_at, updated_at) 
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;
        params = [
          record.id,
          record.user_id,
          record.restaurant_id,
          record.delivery_address_id || null,
          record.order_number,
          record.status,
          record.subtotal,
          record.tax_amount || null,
          record.delivery_fee || null,
          record.tip_amount || 0,
          record.total_amount,
          record.special_instructions || null,
          record.estimated_delivery_time || null,
          record.created_at || new Date().toISOString(),
          record.updated_at || new Date().toISOString()
        ];
        break;
        
      case 'order_items':
        query = `INSERT OR REPLACE INTO order_items 
                 (id, order_id, menu_item_id, quantity, unit_price, total_price, 
                  special_instructions, created_at) 
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?)`;
        params = [
          record.id,
          record.order_id,
          record.menu_item_id,
          record.quantity,
          record.unit_price,
          record.total_price,
          record.special_instructions || null,
          record.created_at || new Date().toISOString()
        ];
        break;
        
      case 'delivery_persons':
        query = `INSERT OR REPLACE INTO delivery_persons 
                 (id, user_id, name, phone, vehicle_type, license_plate, is_available, 
                  current_location, rating, total_deliveries, created_at, updated_at) 
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;
        params = [
          record.id,
          record.user_id || null,
          record.name,
          record.phone,
          record.vehicle_type || null,
          record.license_plate || null,
          record.is_available ? 1 : 0,
          record.current_location || null,
          record.rating || null,
          record.total_deliveries || 0,
          record.created_at || new Date().toISOString(),
          record.updated_at || new Date().toISOString()
        ];
        break;
        
      case 'delivery_assignments':
        query = `INSERT OR REPLACE INTO delivery_assignments 
                 (id, order_id, delivery_person_id, assigned_at, picked_up_at, delivered_at, 
                  status, created_at, updated_at) 
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`;
        params = [
          record.id,
          record.order_id,
          record.delivery_person_id,
          record.assigned_at || new Date().toISOString(),
          record.picked_up_at || null,
          record.delivered_at || null,
          record.status,
          record.created_at || new Date().toISOString(),
          record.updated_at || new Date().toISOString()
        ];
        break;
        
      case 'app_settings':
        query = `INSERT OR REPLACE INTO app_settings 
                 (id, setting_key, setting_value, description, updated_at) 
                 VALUES (?, ?, ?, ?, ?)`;
        params = [
          record.id,
          record.setting_key,
          record.setting_value,
          record.description || null,
          record.updated_at || new Date().toISOString()
        ];
        break;
        
      default:
        console.error(`Save to SQLite not implemented for table: ${table}`);
        return null;
    }
    
    const result = await db.runAsync(query, params);
    return result;
  } catch (error) {
    console.error(`Error in saveToSQLite for ${table}:`, error);
    return null;
  }
};

/**
 * Bidirectional sync function that ensures data consistency between Supabase and SQLite
 */
export const bidirectionalSync = async (db: any, table: string, record: any, operation: 'insert' | 'update' | 'delete' = 'insert') => {
  const online = await isOnline();
  
  if (online) {
    // If online, save to Supabase first, then sync to SQLite
    let supabaseResult;
    
    if (operation === 'delete') {
      supabaseResult = await supabase.from(table).delete().eq('id', record.id);
    } else {
      // For insert/update operations
      if (operation === 'update' && record.id) {
        supabaseResult = await supabase.from(table).update(record).eq('id', record.id);
      } else {
        supabaseResult = await supabase.from(table).insert([record]);
      }
    }
    
    if (supabaseResult.error) {
      console.error(`Error saving to ${table} in Supabase:`, supabaseResult.error);
      // If Supabase fails, save to SQLite as fallback
      const sqliteResult = await saveToSQLite(db, table, record);
      return { success: !!sqliteResult, source: 'sqlite', data: sqliteResult };
    }
    
    // Sync to SQLite after successful Supabase save
    if (db) {
      // Update the record with any values that Supabase might have set (like ID)
      const finalRecord = { ...record, ...supabaseResult.data?.[0] };
      const sqliteResult = await saveToSQLite(db, table, finalRecord);
      
      return { 
        success: true, 
        source: 'both', 
        supabaseData: supabaseResult.data, 
        sqliteData: sqliteResult 
      };
    }
    
    return { success: true, source: 'supabase', data: supabaseResult.data };
  } else {
    // If offline, save to SQLite and queue for later sync to Supabase
    const sqliteResult = await saveToSQLite(db, table, record);
    
    // Mark record as needing sync when online
    if (db) {
      // Create a sync queue table if it doesn't exist
      await db.execAsync(`
        CREATE TABLE IF NOT EXISTS sync_queue (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          table_name TEXT NOT NULL,
          operation TEXT NOT NULL, -- 'insert', 'update', 'delete'
          record_data TEXT NOT NULL, -- JSON string of the record
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `);
      
      // Add the record to the sync queue
      await db.runAsync(
        'INSERT INTO sync_queue (table_name, operation, record_data) VALUES (?, ?, ?)',
        [table, operation, JSON.stringify(record)]
      );
    }
    
    return { success: !!sqliteResult, source: 'sqlite', data: sqliteResult };
  }
};

/**
 * Process the sync queue when coming back online
 */
export const processSyncQueue = async (db: any) => {
  if (!db) {
    console.error('Database not initialized');
    return;
  }
  
  const online = await isOnline();
  
  if (!online) {
    console.log('Still offline, skipping sync queue processing');
    return;
  }
  
  try {
    // Get all queued items
    const queuedItems = await db.getAllAsync('SELECT * FROM sync_queue ORDER BY created_at ASC');
    
    if (!queuedItems || queuedItems.length === 0) {
      console.log('Sync queue is empty');
      return;
    }
    
    console.log(`Processing ${queuedItems.length} items from sync queue`);
    
    for (const item of queuedItems) {
      const { table_name, operation, record_data, id } = item;
      const record = JSON.parse(record_data);
      
      try {
        let result;
        
        if (operation === 'delete') {
          result = await supabase.from(table_name).delete().eq('id', record.id);
        } else {
          if (operation === 'update' && record.id) {
            result = await supabase.from(table_name).update(record).eq('id', record.id);
          } else {
            result = await supabase.from(table_name).insert([record]);
          }
        }
        
        if (result.error) {
          console.error(`Error syncing queued ${operation} for ${table_name}:`, result.error);
          continue; // Skip to next item if this one fails
        }
        
        // Remove successfully synced item from queue
        await db.runAsync('DELETE FROM sync_queue WHERE id = ?', [id]);
        
        console.log(`Successfully synced ${operation} for ${table_name} with id: ${record.id}`);
      } catch (error) {
        console.error(`Error processing sync queue item:`, error);
      }
    }
    
    console.log('Sync queue processing completed');
  } catch (error) {
    console.error('Error processing sync queue:', error);
  }
};

/**
 * Unified sync function that handles both online and offline scenarios
 */
export const unifiedSync = async (db: any, tables: string[] = ['restaurants', 'menu_categories', 'menu_items']) => {
  const online = await isOnline();
  
  if (online) {
    console.log('Device is online, syncing from Supabase to SQLite...');
    
    // Process any pending sync queue items first
    await processSyncQueue(db);
    
    // Initialize database if not already done
    if (!db) {
      console.error('Database not provided to unifiedSync');
      return { from: 'error', data: {} };
    }
    
    const syncResults: Record<string, any[]> = {};
    
    for (const table of tables) {
      let conditions = {};
      
      // Set default conditions based on table
      switch (table) {
        case 'restaurants':
          conditions = { is_active: { operator: 'eq', value: true } };
          break;
        case 'menu_categories':
          conditions = { is_active: { operator: 'eq', value: true } };
          break;
        case 'menu_items':
          conditions = { is_available: { operator: 'eq', value: true } };
          break;
        default:
          break;
      }
      
      const data = await fetchFromSupabase(table, conditions);
      
      if (data) {
        syncResults[table] = data;
        
        // Sync data to SQLite based on table
        for (const record of data) {
          await saveToSQLite(db, table, record);
        }
      }
    }
    
    return { from: 'supabase', data: syncResults };
  } else {
    console.log('Device is offline, fetching from SQLite...');
    
    // Return data from SQLite
    const sqliteResults: Record<string, any[]> = {};
    
    for (const table of tables) {
      let query = `SELECT * FROM ${table}`;
      let params: any[] = [];
      
      // Add conditions based on table
      switch (table) {
        case 'restaurants':
          query += ' WHERE is_active = 1';
          break;
        case 'menu_categories':
          query += ' WHERE is_active = 1';
          break;
        case 'menu_items':
          query += ' WHERE is_available = 1';
          break;
        default:
          break;
      }
      
      query += ' ORDER BY created_at DESC'; // Add ordering
      
      const data = await fetchFromSQLite(db, query, params);
      sqliteResults[table] = data || [];
    }
    
    return { from: 'sqlite', data: sqliteResults };
  }
};

/**
 * Offline-first data retrieval function
 * Tries to get fresh data from Supabase if online, otherwise uses SQLite cache
 */
export const getOfflineFirstData = async (db: any, table: string, conditions: Record<string, any> = {}) => {
  const online = await isOnline();
  
  if (online) {
    // Fetch fresh data from Supabase
    const supabaseData = await fetchFromSupabase(table, conditions);
    
    if (supabaseData) {
      // Update local SQLite cache
      if (db) {
        // Sync the fresh data to SQLite
        for (const record of supabaseData) {
          await saveToSQLite(db, table, record);
        }
      }
      
      return { source: 'supabase', data: supabaseData };
    }
  }
  
  // If offline or Supabase fetch failed, get from SQLite
  if (db) {
    let query = `SELECT * FROM ${table}`;
    let params: any[] = [];
    
    // Add conditions to query
    const whereConditions = [];
    Object.entries(conditions).forEach(([key, value]) => {
      if (typeof value === 'object' && value.operator && value.value) {
        switch(value.operator) {
          case 'eq':
            whereConditions.push(`${key} = ?`);
            params.push(value.value);
            break;
          case 'neq':
            whereConditions.push(`${key} != ?`);
            params.push(value.value);
            break;
          case 'lt':
            whereConditions.push(`${key} < ?`);
            params.push(value.value);
            break;
          case 'lte':
            whereConditions.push(`${key} <= ?`);
            params.push(value.value);
            break;
          case 'gt':
            whereConditions.push(`${key} > ?`);
            params.push(value.value);
            break;
          case 'gte':
            whereConditions.push(`${key} >= ?`);
            params.push(value.value);
            break;
          case 'in':
            const placeholders = value.value.map(() => '?').join(',');
            whereConditions.push(`${key} IN (${placeholders})`);
            params = params.concat(value.value);
            break;
          default:
            whereConditions.push(`${key} = ?`);
            params.push(value);
        }
      } else {
        whereConditions.push(`${key} = ?`);
        params.push(value);
      }
    });
    
    if (whereConditions.length > 0) {
      query += ` WHERE ${whereConditions.join(' AND ')}`;
    }
    
    query += ' ORDER BY created_at DESC';
    
    const sqliteData = await fetchFromSQLite(db, query, params);
    return { source: 'sqlite', data: sqliteData || [] };
  }
  
  return { source: 'none', data: [] };
};

/**
 * Background sync function that runs periodically to keep SQLite in sync with Supabase
 */
export const backgroundSync = async (db: any) => {
  try {
    const online = await isOnline();
    
    if (online && db) {
      console.log('Running background sync...');
      
      // Process sync queue first
      await processSyncQueue(db);
      
      // Sync all tables
      const tables = ['restaurants', 'menu_categories', 'menu_items', 'users', 'addresses', 'orders'];
      
      for (const table of tables) {
        let conditions = {};
        
        switch (table) {
          case 'restaurants':
            conditions = { is_active: { operator: 'eq', value: true } };
            break;
          case 'menu_categories':
            conditions = { is_active: { operator: 'eq', value: true } };
            break;
          case 'menu_items':
            conditions = { is_available: { operator: 'eq', value: true } };
            break;
          default:
            break;
        }
        
        const data = await fetchFromSupabase(table, conditions);
        
        if (data) {
          // Update SQLite with fresh data
          for (const record of data) {
            await saveToSQLite(db, table, record);
          }
        }
      }
      
      console.log('Background sync completed');
    }
  } catch (error) {
    console.error('Error in background sync:', error);
  }
};

/**
 * Save data to both Supabase and SQLite with bidirectional sync
 */
export const saveData = async (db: any, table: string, record: any, id?: string) => {
  return await bidirectionalSync(db, table, { ...record, id }, id ? 'update' : 'insert');
};

/**
 * Delete data from both Supabase and SQLite with bidirectional sync
 */
export const deleteData = async (db: any, table: string, id: string) => {
  const record = { id };
  return await bidirectionalSync(db, table, record, 'delete');
};