import * as SQLite from 'expo-sqlite';
import { Platform } from 'react-native';
import * as FileSystem from 'expo-file-system';

let db = null;

// Perform a hard reset of the database to clear any corruption
async function performHardReset() {
  if (Platform.OS === 'web') {
    // On web, we can't really reset the database, so we'll just log
    console.log('Performing soft reset on web platform');
    return;
  }

  try {
    // Attempt to delete the database file directly
    const dbFile = `${FileSystem.documentDirectory}SQLite/delivery_local_cache.db`;
    const exists = await FileSystem.getInfoAsync(dbFile);
    
    if (exists.exists) {
      await FileSystem.deleteAsync(dbFile);
      console.log('Database file deleted successfully');
    }
  } catch (error) {
    console.warn('Could not delete database file (this is usually fine):', error.message);
  }
}

// Initialize SQLite database with platform-aware approach
async function initializeDatabaseAsync() {
  try {
    // First, perform a hard reset to clear any existing problematic database
    await performHardReset();

    if (Platform.OS === 'web') {
      // On web, use async to allow WASM to load properly
      // But wrap in try-catch to handle web failures gracefully
      try {
        db = await SQLite.openDatabaseAsync('delivery_local_cache.db');
      } catch (webError) {
        console.error('Web database initialization failed:', webError.message);
        console.log('Falling back to alternative web database initialization...');

        // Try alternative approach for web
        try {
          // Create database with more explicit options for web
          db = await SQLite.openDatabaseAsync('delivery_local_cache.db', {
            // Additional options for web compatibility
          });
        } catch (altWebError) {
          console.error('Alternative web database initialization also failed:', altWebError.message);
          console.warn('Using in-memory mock database for web environment');
          // Create a mock database object for web when SQLite fails completely
          db = createMockDatabase();
        }
      }
    } else {
      // On native, we can use sync
      db = SQLite.openDatabaseSync('delivery_local_cache.db', { useNewConnection: true });
    }

    const schemaSQL = `
      PRAGMA foreign_keys = ON;

      -- App Settings table - stores global settings including constant delivery fee
      CREATE TABLE IF NOT EXISTS app_settings (
        id TEXT PRIMARY KEY DEFAULT 'global_settings',
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
        delivery_fee REAL DEFAULT 5.0,
        minimum_order_amount REAL DEFAULT 10.0,
        default_preparation_time INTEGER DEFAULT 30,
        currency TEXT DEFAULT 'USD'
      );

      -- Users table (application users, not for authentication)
      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
        email TEXT UNIQUE NOT NULL,
        email_verified INTEGER DEFAULT 0,
        name TEXT,
        phone TEXT,
        image_url TEXT,
        role TEXT DEFAULT 'USER'
      );

      -- Restaurants table
      CREATE TABLE IF NOT EXISTS restaurants (
        id TEXT PRIMARY KEY,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
        name TEXT NOT NULL,
        description TEXT,
        image_url TEXT,
        owner_id TEXT NOT NULL,
        location TEXT,
        address TEXT,
        phone TEXT,
        email TEXT,
        rating REAL DEFAULT 0.0,
        delivery_time INTEGER,
        delivery_fee REAL DEFAULT 0.0,
        minimum_order REAL DEFAULT 0.0,
        is_active INTEGER DEFAULT 1,
        is_available INTEGER DEFAULT 1,
        FOREIGN KEY (owner_id) REFERENCES users(id) ON DELETE CASCADE
      );

      -- Menu Categories table
      CREATE TABLE IF NOT EXISTS menu_categories (
        id TEXT PRIMARY KEY,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
        name TEXT NOT NULL,
        description TEXT,
        image_url TEXT,
        restaurant_id TEXT NOT NULL,
        FOREIGN KEY (restaurant_id) REFERENCES restaurants(id) ON DELETE CASCADE
      );

      -- Menu Items table
      CREATE TABLE IF NOT EXISTS menu_items (
        id TEXT PRIMARY KEY,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
        name TEXT NOT NULL,
        description TEXT,
        price REAL NOT NULL,
        image_url TEXT,
        category TEXT,
        is_available INTEGER DEFAULT 1,
        preparation_time INTEGER,
        restaurant_id TEXT NOT NULL,
        category_id TEXT,
        FOREIGN KEY (restaurant_id) REFERENCES restaurants(id) ON DELETE CASCADE,
        FOREIGN KEY (category_id) REFERENCES menu_categories(id) ON DELETE SET NULL
      );

      -- Orders table
      CREATE TABLE IF NOT EXISTS orders (
        id TEXT PRIMARY KEY,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
        user_id TEXT NOT NULL,
        restaurant_id TEXT NOT NULL,
        order_number TEXT UNIQUE NOT NULL,
        status TEXT DEFAULT 'pending', -- pending, confirmed, preparing, ready, on_the_way, delivered, cancelled
        total_amount REAL NOT NULL,
        delivery_address TEXT,
        delivery_notes TEXT,
        payment_method TEXT, -- cash, card, digital_wallet
        payment_status TEXT DEFAULT 'pending', -- pending, paid, failed, refunded
        delivery_person_id TEXT,
        estimated_delivery TEXT,
        actual_delivery TEXT,
        review_id TEXT UNIQUE, -- Unique reference to review
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (restaurant_id) REFERENCES restaurants(id) ON DELETE CASCADE,
        FOREIGN KEY (delivery_person_id) REFERENCES users(id)
      );

      -- Order Items table
      CREATE TABLE IF NOT EXISTS order_items (
        id TEXT PRIMARY KEY,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
        order_id TEXT NOT NULL,
        menu_item_id TEXT NOT NULL,
        quantity INTEGER DEFAULT 1,
        price REAL NOT NULL, -- Price at the time of ordering
        FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
        FOREIGN KEY (menu_item_id) REFERENCES menu_items(id) ON DELETE CASCADE
      );

      -- Addresses table
      CREATE TABLE IF NOT EXISTS addresses (
        id TEXT PRIMARY KEY,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
        user_id TEXT NOT NULL,
        name TEXT NOT NULL,
        street TEXT NOT NULL,
        city TEXT NOT NULL,
        state TEXT NOT NULL,
        zip_code TEXT NOT NULL,
        country TEXT NOT NULL,
        phone TEXT NOT NULL,
        is_default INTEGER DEFAULT 0,
        latitude REAL,
        longitude REAL,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      );

      -- Delivery Persons table (for offline access)
      CREATE TABLE IF NOT EXISTS delivery_persons (
        id TEXT PRIMARY KEY,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
        user_id TEXT UNIQUE NOT NULL, -- Reference to User - must be unique for one-to-one relation
        license_plate TEXT,
        vehicle_type TEXT, -- bike, car, motorcycle
        is_available INTEGER DEFAULT 1, -- Using INTEGER (0=False, 1=True) for SQLite compatibility
        current_location TEXT, -- JSONB equivalent in SQLite
        rating REAL DEFAULT 0.0,
        total_deliveries INTEGER DEFAULT 0,
        total_earnings REAL DEFAULT 0.0,
        successful_deliveries INTEGER DEFAULT 0,
        cancelled_deliveries INTEGER DEFAULT 0,
        avg_rating REAL DEFAULT 0.0,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      );

      -- Delivery Statistics table (for offline access)
      CREATE TABLE IF NOT EXISTS delivery_statistics (
        id TEXT PRIMARY KEY,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
        delivery_person_id TEXT NOT NULL,
        order_id TEXT NOT NULL,
        order_total_amount REAL NOT NULL,
        delivery_fee REAL NOT NULL,
        delivery_date TEXT NOT NULL,
        delivery_rating INTEGER, -- Rating given by customer (1-5)
        delivery_tips REAL DEFAULT 0.0,
        delivery_status TEXT DEFAULT 'delivered', -- delivered, cancelled, returned
        delivery_address TEXT,
        delivery_notes TEXT
      );

      -- Indexes for better performance
      CREATE INDEX IF NOT EXISTS idx_restaurants_owner_id ON restaurants(owner_id);
      CREATE INDEX IF NOT EXISTS idx_menu_items_restaurant_id ON menu_items(restaurant_id);
      CREATE INDEX IF NOT EXISTS idx_orders_user_id ON orders(user_id);
      CREATE INDEX IF NOT EXISTS idx_orders_restaurant_id ON orders(restaurant_id);
      CREATE INDEX IF NOT EXISTS idx_addresses_user_id ON addresses(user_id);
      CREATE INDEX IF NOT EXISTS idx_delivery_statistics_delivery_person_id ON delivery_statistics(delivery_person_id);
      CREATE INDEX IF NOT EXISTS idx_delivery_statistics_order_id ON delivery_statistics(order_id);
      CREATE INDEX IF NOT EXISTS idx_delivery_persons_user_id ON delivery_persons(user_id);
    `;

    await db.execAsync(schemaSQL);

    // Insert default settings if not exists
    await db.execAsync(`
      INSERT INTO app_settings (id, delivery_fee, minimum_order_amount, default_preparation_time, currency)
      VALUES ('global_settings', 5.0, 10.0, 30, 'USD')
      ON CONFLICT (id) DO NOTHING;
    `);

    console.log('Delivery app database initialized successfully');
  } catch (error) {
    console.error('Error during database initialization:', error);
    throw error;
  }
}

// Create a mock database for web environments where SQLite doesn't work properly
function createMockDatabase() {
  console.log('Creating mock database for web environment');

  // Simple in-memory mock that mimics SQLite behavior
  const mockData = {
    app_settings: [{ id: 'global_settings', delivery_fee: 5.0, minimum_order_amount: 10.0, default_preparation_time: 30, currency: 'USD' }],
    users: [],
    restaurants: [],
    menu_categories: [],
    menu_items: [],
    orders: [],
    order_items: [],
    addresses: [],
    delivery_persons: [],
    delivery_statistics: []
  };

  return {
    execAsync: async (sql) => {
      // Mock schema execution - just acknowledge it
      console.log('Mock database execAsync:', sql.substring(0, 50) + '...');
      return Promise.resolve();
    },
    runAsync: async (sql, params) => {
      // Mock run operation
      console.log('Mock database runAsync:', sql, params);
      return Promise.resolve({ changes: 1, lastInsertRowId: Date.now() });
    },
    getFirstAsync: async (sql, params) => {
      // Mock get first operation
      console.log('Mock database getFirstAsync:', sql, params);
      return Promise.resolve(null);
    },
    getAllAsync: async (sql, params) => {
      // Mock get all operation
      console.log('Mock database getAllAsync:', sql);

      // Determine which table to query based on the SQL
      if (sql.toUpperCase().includes('FROM APP_SETTINGS')) {
        return Promise.resolve(mockData.app_settings);
      } else if (sql.toUpperCase().includes('FROM USERS')) {
        return Promise.resolve(mockData.users);
      } else if (sql.toUpperCase().includes('FROM RESTAURANTS')) {
        return Promise.resolve(mockData.restaurants);
      } else if (sql.toUpperCase().includes('FROM MENU_CATEGORIES')) {
        return Promise.resolve(mockData.menu_categories);
      } else if (sql.toUpperCase().includes('FROM MENU_ITEMS')) {
        return Promise.resolve(mockData.menu_items);
      } else if (sql.toUpperCase().includes('FROM ORDERS')) {
        return Promise.resolve(mockData.orders);
      } else if (sql.toUpperCase().includes('FROM ORDER_ITEMS')) {
        return Promise.resolve(mockData.order_items);
      } else if (sql.toUpperCase().includes('FROM ADDRESSES')) {
        return Promise.resolve(mockData.addresses);
      } else if (sql.toUpperCase().includes('FROM DELIVERY_PERSONS')) {
        return Promise.resolve(mockData.delivery_persons);
      } else if (sql.toUpperCase().includes('FROM DELIVERY_STATISTICS')) {
        return Promise.resolve(mockData.delivery_statistics);
      } else {
        // For other queries, return empty array
        return Promise.resolve([]);
      }
    },
    transaction: (callback) => {
      // Mock transaction - just call the callback with a mock transaction object
      callback({
        executeSql: (sql, params, successCallback, errorCallback) => {
          try {
            // Parse the SQL to determine the operation
            if (sql.toUpperCase().includes('CREATE TABLE')) {
              // Mock table creation - just acknowledge it
              if (successCallback) {
                successCallback({ rows: { _array: [] } });
              }
            } else if (sql.toUpperCase().includes('INSERT INTO')) {
              // Mock insert operation
              if (successCallback) {
                successCallback({ insertId: Date.now(), rowsAffected: 1 });
              }
            } else if (sql.toUpperCase().includes('SELECT')) {
              // Mock select operation - delegate to getAllAsync logic
              let results = [];

              // Determine which table to query based on the SQL
              if (sql.toUpperCase().includes('FROM APP_SETTINGS')) {
                results = mockData.app_settings;
              } else if (sql.toUpperCase().includes('FROM USERS')) {
                results = mockData.users;
              } else if (sql.toUpperCase().includes('FROM RESTAURANTS')) {
                results = mockData.restaurants;
              } else if (sql.toUpperCase().includes('FROM MENU_CATEGORIES')) {
                results = mockData.menu_categories;
              } else if (sql.toUpperCase().includes('FROM MENU_ITEMS')) {
                results = mockData.menu_items;
              } else if (sql.toUpperCase().includes('FROM ORDERS')) {
                results = mockData.orders;
              } else if (sql.toUpperCase().includes('FROM ORDER_ITEMS')) {
                results = mockData.order_items;
              } else if (sql.toUpperCase().includes('FROM ADDRESSES')) {
                results = mockData.addresses;
              } else if (sql.toUpperCase().includes('FROM DELIVERY_PERSONS')) {
                results = mockData.delivery_persons;
              } else if (sql.toUpperCase().includes('FROM DELIVERY_STATISTICS')) {
                results = mockData.delivery_statistics;
              } else {
                // For other queries, return empty array
                results = [];
              }

              if (successCallback) {
                successCallback({ rows: { _array: results, length: results.length } });
              }
            } else if (sql.toUpperCase().includes('UPDATE')) {
              // Mock update operation
              if (successCallback) {
                successCallback({ rowsAffected: 1 });
              }
            } else if (sql.toUpperCase().includes('DELETE')) {
              // Mock delete operation
              if (successCallback) {
                successCallback({ rowsAffected: 1 });
              }
            } else {
              // For other operations, return empty result
              if (successCallback) {
                successCallback({ rows: { _array: [], length: 0 } });
              }
            }
          } catch (executeError) {
            console.error('Mock database executeSql error:', executeError);
            if (errorCallback) {
              errorCallback({}, executeError);
            }
          }
        }
      });
    }
  };
}

/**
 * Initialize the SQLite database with the required tables
 */
export async function initializeDatabase() {
  await initializeDatabaseAsync();
}

/**
 * Get the database instance
 */
export function getDatabase() {
  return db;
}

export default db;