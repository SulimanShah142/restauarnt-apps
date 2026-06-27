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
 * Unified sync function that handles both online and offline scenarios
 */
export const unifiedSync = async (db: any, tables: string[] = ['restaurants', 'menu_categories', 'menu_items']) => {
  const online = await isOnline();
  
  if (online) {
    console.log('Device is online, syncing from Supabase to SQLite...');
    
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
        switch (table) {
          case 'restaurants':
            for (const record of data) {
              await db.runAsync(
                'INSERT OR REPLACE INTO restaurants (id, name, address, rating, image_url, delivery_fee, min_order_amount, estimated_delivery_time, is_active, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
                [
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
                ]
              );
            }
            break;
            
          case 'menu_categories':
            for (const record of data) {
              await db.runAsync(
                'INSERT OR REPLACE INTO menu_categories (id, restaurant_id, name, description, sort_order, is_active, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
                [
                  record.id,
                  record.restaurant_id,
                  record.name,
                  record.description || '',
                  record.sort_order || 0,
                  record.is_active ? 1 : 0,
                  record.created_at || new Date().toISOString(),
                  record.updated_at || new Date().toISOString()
                ]
              );
            }
            break;
            
          case 'menu_items':
            for (const record of data) {
              await db.runAsync(
                'INSERT OR REPLACE INTO menu_items (id, category_id, name, description, price, image_url, is_available, is_vegetarian, is_spicy, calories, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
                [
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
                ]
              );
            }
            break;
            
          default:
            // For other tables, try to insert generically
            console.log(`Table ${table} sync not implemented yet`);
            break;
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
        switch (table) {
          case 'restaurants':
            for (const record of supabaseData) {
              await db.runAsync(
                'INSERT OR REPLACE INTO restaurants (id, name, address, rating, image_url, delivery_fee, min_order_amount, estimated_delivery_time, is_active, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
                [
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
                ]
              );
            }
            break;
            
          case 'menu_categories':
            for (const record of supabaseData) {
              await db.runAsync(
                'INSERT OR REPLACE INTO menu_categories (id, restaurant_id, name, description, sort_order, is_active, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
                [
                  record.id,
                  record.restaurant_id,
                  record.name,
                  record.description || '',
                  record.sort_order || 0,
                  record.is_active ? 1 : 0,
                  record.created_at || new Date().toISOString(),
                  record.updated_at || new Date().toISOString()
                ]
              );
            }
            break;
            
          case 'menu_items':
            for (const record of supabaseData) {
              await db.runAsync(
                'INSERT OR REPLACE INTO menu_items (id, category_id, name, description, price, image_url, is_available, is_vegetarian, is_spicy, calories, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
                [
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
                ]
              );
            }
            break;
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
          switch (table) {
            case 'restaurants':
              for (const record of data) {
                await db.runAsync(
                  'INSERT OR REPLACE INTO restaurants (id, name, address, rating, image_url, delivery_fee, min_order_amount, estimated_delivery_time, is_active, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
                  [
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
                  ]
                );
              }
              break;
              
            case 'menu_categories':
              for (const record of data) {
                await db.runAsync(
                  'INSERT OR REPLACE INTO menu_categories (id, restaurant_id, name, description, sort_order, is_active, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
                  [
                    record.id,
                    record.restaurant_id,
                    record.name,
                    record.description || '',
                    record.sort_order || 0,
                    record.is_active ? 1 : 0,
                    record.created_at || new Date().toISOString(),
                    record.updated_at || new Date().toISOString()
                  ]
                );
              }
              break;
              
            case 'menu_items':
              for (const record of data) {
                await db.runAsync(
                  'INSERT OR REPLACE INTO menu_items (id, category_id, name, description, price, image_url, is_available, is_vegetarian, is_spicy, calories, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
                  [
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
                  ]
                );
              }
              break;
          }
        }
      }
      
      console.log('Background sync completed');
    }
  } catch (error) {
    console.error('Error in background sync:', error);
  }
};