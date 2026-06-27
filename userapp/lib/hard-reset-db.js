// Database reset utility to completely clear and recreate the SQLite database
import * as SQLite from 'expo-sqlite';
import { Platform } from 'react-native';
import * as FileSystem from 'expo-file-system';

// Function to completely reset the database
export async function hardResetDatabase() {
  // console.log('Performing hard reset of the database...');
  
  try {
    // For web platform, we need to handle IndexedDB differently
    if (Platform.OS === 'web') {
      // Close any existing connections
      // Clear the IndexedDB database
      if (window.indexedDB) {
        const dbName = 'local_cache.db';
        const databases = await indexedDB.databases ? indexedDB.databases() : Promise.resolve([]);
        
        // Delete the database
        const deleteReq = window.indexedDB.deleteDatabase(dbName);
        deleteReq.onsuccess = function() {
          // console.log('Web database deleted successfully');
        };
        deleteReq.onerror = function(event) {
          // console.error('Error deleting web database:', event);
        };
      }
    } else {
      // For native platforms, delete the database file
      const dbPath = `${FileSystem.documentDirectory}SQLite/local_cache.db`;
      
      try {
        const fileInfo = await FileSystem.getInfoAsync(dbPath);
        if (fileInfo.exists) {
          await FileSystem.deleteAsync(dbPath);
          // console.log('Native database file deleted successfully');
        } else {
          // console.log('Database file does not exist, continuing...');
        }
      } catch (fsError) {
        // console.warn('Could not delete database file (may not exist yet):', fsError.message);
      }
      
      // Also try to delete the journal file if it exists
      const journalPath = `${FileSystem.documentDirectory}SQLite/local_cache.db-journal`;
      try {
        const journalFileInfo = await FileSystem.getInfoAsync(journalPath);
        if (journalFileInfo.exists) {
          await FileSystem.deleteAsync(journalPath);
          // console.log('Journal file deleted successfully');
        }
      } catch (journalError) {
        // console.warn('Could not delete journal file:', journalError.message);
      }
    }
    
    // console.log('Database reset completed. The app will recreate the database with the correct schema on next use.');
    return true;
  } catch (error) {
    // console.error('Error during hard database reset:', error);
    return false;
  }
}

// Alternative method: Create a fresh database connection
export async function createFreshDatabaseConnection() {
  try {
    // console.log('Creating fresh database connection...');
    
    // Close any existing database connection if possible
    let db;
    if (Platform.OS === 'web') {
      // For web, just create a new connection which will use the updated schema
      db = await SQLite.openDatabaseAsync('local_cache.db');
    } else {
      // For native, create a new connection
      db = SQLite.openDatabaseSync('local_cache.db', { useNewConnection: true });
    }
    
    // Execute the complete schema creation with error handling
    try {
      const schemaSQL = `
        PRAGMA foreign_keys = ON;
        PRAGMA journal_mode = WAL;

        -- App Settings table
        CREATE TABLE IF NOT EXISTS app_settings (
          id TEXT PRIMARY KEY NOT NULL,
          setting_key TEXT UNIQUE NOT NULL,
          setting_value TEXT NOT NULL,
          description TEXT,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );

        -- Users table
        CREATE TABLE IF NOT EXISTS users (
          id TEXT PRIMARY KEY NOT NULL,
          email TEXT UNIQUE NOT NULL,
          name TEXT,
          phone TEXT,
          image_url TEXT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );

        -- Restaurants table
        CREATE TABLE IF NOT EXISTS restaurants (
          id TEXT PRIMARY KEY NOT NULL,
          name TEXT NOT NULL,
          address TEXT,
          rating REAL,
          image_url TEXT,
          delivery_fee REAL,
          min_order_amount REAL,
          estimated_delivery_time INTEGER, -- in minutes
          is_active INTEGER DEFAULT 1, -- Using INTEGER (0=False, 1=True) for SQLite compatibility
          created_at TEXT DEFAULT (datetime('now')),
          updated_at TEXT DEFAULT (datetime('now')),
          description TEXT,
          phone TEXT,
          email TEXT,
          delivery_time INTEGER,
          minimum_order REAL,
          is_available BOOLEAN DEFAULT 1,
          latitude REAL,
          longitude REAL,
          owner_id TEXT
        );

        -- Menu Categories table
        CREATE TABLE IF NOT EXISTS menu_categories (
          id TEXT PRIMARY KEY NOT NULL,
          restaurant_id TEXT NOT NULL,
          name TEXT NOT NULL,
          description TEXT,
          sort_order INTEGER DEFAULT 0,
          is_active INTEGER DEFAULT 1, -- Using INTEGER (0=False, 1=True) for SQLite compatibility
          created_at TEXT DEFAULT (datetime('now')),
          updated_at TEXT DEFAULT (datetime('now')),
          image_url TEXT,
          FOREIGN KEY (restaurant_id) REFERENCES restaurants(id)
        );

        -- Menu Items table
        CREATE TABLE IF NOT EXISTS menu_items (
          id TEXT PRIMARY KEY NOT NULL,
          category_id TEXT NOT NULL,
          name TEXT NOT NULL,
          description TEXT,
          price REAL NOT NULL,
          image_url TEXT,
          is_available INTEGER DEFAULT 1, -- Using INTEGER (0=False, 1=True) for SQLite compatibility
          is_vegetarian INTEGER DEFAULT 0, -- Using INTEGER (0=False, 1=True) for SQLite compatibility
          is_spicy INTEGER DEFAULT 0, -- Using INTEGER (0=False, 1=True) for SQLite compatibility
          calories INTEGER,
          created_at TEXT DEFAULT (datetime('now')),
          updated_at TEXT DEFAULT (datetime('now')),
          category TEXT,
          preparation_time INTEGER,
          restaurant_id TEXT,
          FOREIGN KEY (category_id) REFERENCES menu_categories(id)
        );

        -- Addresses table
        CREATE TABLE IF NOT EXISTS addresses (
          id TEXT PRIMARY KEY NOT NULL,
          user_id TEXT NOT NULL,
          street_address TEXT NOT NULL,
          city TEXT NOT NULL,
          state TEXT NOT NULL,
          zip_code TEXT NOT NULL,
          country TEXT NOT NULL,
          is_default INTEGER DEFAULT 0, -- Using INTEGER (0=False, 1=True) for SQLite compatibility
          latitude REAL,
          longitude REAL,
          created_at TEXT DEFAULT (datetime('now')),
          updated_at TEXT DEFAULT (datetime('now')),
          FOREIGN KEY (user_id) REFERENCES users(id)
        );

        -- Orders table
        CREATE TABLE IF NOT EXISTS orders (
          id TEXT PRIMARY KEY NOT NULL,
          user_id TEXT NOT NULL,
          restaurant_id TEXT NOT NULL,
          delivery_address_id TEXT,
          order_number TEXT UNIQUE NOT NULL,
          status TEXT NOT NULL DEFAULT 'pending', -- pending, confirmed, preparing, ready_for_pickup, picked_up, delivered, cancelled
          subtotal REAL NOT NULL,
          tax_amount REAL,
          delivery_fee REAL,
          tip_amount REAL DEFAULT 0,
          total_amount REAL NOT NULL,
          special_instructions TEXT,
          estimated_delivery_time TEXT, -- Store as TEXT for SQLite compatibility
          created_at TEXT DEFAULT (datetime('now')),
          updated_at TEXT DEFAULT (datetime('now')),
          FOREIGN KEY (user_id) REFERENCES users(id),
          FOREIGN KEY (restaurant_id) REFERENCES restaurants(id),
          FOREIGN KEY (delivery_address_id) REFERENCES addresses(id)
        );

        -- Order Items table
        CREATE TABLE IF NOT EXISTS order_items (
          id TEXT PRIMARY KEY NOT NULL,
          order_id TEXT NOT NULL,
          menu_item_id TEXT NOT NULL,
          quantity INTEGER NOT NULL,
          unit_price REAL NOT NULL,
          total_price REAL NOT NULL,
          special_instructions TEXT,
          created_at TEXT DEFAULT (datetime('now')),
          FOREIGN KEY (order_id) REFERENCES orders(id),
          FOREIGN KEY (menu_item_id) REFERENCES menu_items(id)
        );

        -- Delivery Persons table
        CREATE TABLE IF NOT EXISTS delivery_persons (
          id TEXT PRIMARY KEY NOT NULL,
          user_id TEXT UNIQUE,
          name TEXT NOT NULL,
          phone TEXT NOT NULL,
          vehicle_type TEXT, -- bike, car, motorcycle
          license_plate TEXT,
          is_available INTEGER DEFAULT 1, -- Using INTEGER (0=False, 1=True) for SQLite compatibility
          current_location TEXT, -- JSON string for coordinates
          rating REAL,
          total_deliveries INTEGER DEFAULT 0,
          created_at TEXT DEFAULT (datetime('now')),
          updated_at TEXT DEFAULT (datetime('now')),
          FOREIGN KEY (user_id) REFERENCES users(id)
        );

        -- Delivery Assignments table
        CREATE TABLE IF NOT EXISTS delivery_assignments (
          id TEXT PRIMARY KEY NOT NULL,
          order_id TEXT UNIQUE NOT NULL,
          delivery_person_id TEXT NOT NULL,
          assigned_at TEXT DEFAULT (datetime('now')),
          picked_up_at TEXT,
          delivered_at TEXT,
          status TEXT NOT NULL DEFAULT 'assigned', -- assigned, picked_up, delivered, cancelled
          created_at TEXT DEFAULT (datetime('now')),
          updated_at TEXT DEFAULT (datetime('now')),
          FOREIGN KEY (order_id) REFERENCES orders(id),
          FOREIGN KEY (delivery_person_id) REFERENCES delivery_persons(id)
        );

        -- Delivery Statistics table (for offline access)
        CREATE TABLE IF NOT EXISTS delivery_statistics (
          id TEXT PRIMARY KEY,
          created_at TEXT DEFAULT (datetime('now')),
          updated_at TEXT DEFAULT (datetime('now')),
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
        CREATE INDEX IF NOT EXISTS idx_restaurants_rating ON restaurants(rating DESC);
        CREATE INDEX IF NOT EXISTS idx_restaurants_is_active ON restaurants(is_active);
        CREATE INDEX IF NOT EXISTS idx_menu_items_category ON menu_items(category_id);
        CREATE INDEX IF NOT EXISTS idx_menu_items_is_available ON menu_items(is_available);
        CREATE INDEX IF NOT EXISTS idx_orders_user_id ON orders(user_id);
        CREATE INDEX IF NOT EXISTS idx_orders_restaurant_id ON orders(restaurant_id);
        CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
        CREATE INDEX IF NOT EXISTS idx_orders_created_at ON orders(created_at DESC);
        CREATE INDEX IF NOT EXISTS idx_addresses_user_id ON addresses(user_id);
        CREATE INDEX IF NOT EXISTS idx_delivery_persons_is_available ON delivery_persons(is_available);
        CREATE INDEX IF NOT EXISTS idx_delivery_assignments_status ON delivery_assignments(status);
        CREATE INDEX IF NOT EXISTS idx_delivery_statistics_delivery_person_id ON delivery_statistics(delivery_person_id);
        CREATE INDEX IF NOT EXISTS idx_delivery_statistics_order_id ON delivery_statistics(order_id);
      `;

      await db.execAsync(schemaSQL);
    } catch (schemaError) {
      // console.error('Error executing schema SQL, trying minimal schema:', schemaError);
      
      // If full schema fails, try a minimal schema
      const minimalSchemaSQL = `
        PRAGMA foreign_keys = ON;
        PRAGMA journal_mode = WAL;

        -- Minimal Restaurants table
        CREATE TABLE IF NOT EXISTS restaurants (
          id TEXT PRIMARY KEY NOT NULL,
          name TEXT NOT NULL,
          address TEXT,
          rating REAL,
          image_url TEXT,
          delivery_fee REAL,
          min_order_amount REAL,
          estimated_delivery_time INTEGER,
          is_active INTEGER DEFAULT 1, -- Using INTEGER (0=False, 1=True) for SQLite compatibility
          created_at TEXT DEFAULT (datetime('now')),
          updated_at TEXT DEFAULT (datetime('now'))
        );

        -- Minimal Menu Categories table
        CREATE TABLE IF NOT EXISTS menu_categories (
          id TEXT PRIMARY KEY NOT NULL,
          restaurant_id TEXT NOT NULL,
          name TEXT NOT NULL,
          description TEXT,
          sort_order INTEGER DEFAULT 0,
          is_active INTEGER DEFAULT 1, -- Using INTEGER (0=False, 1=True) for SQLite compatibility
          created_at TEXT DEFAULT (datetime('now')),
          updated_at TEXT DEFAULT (datetime('now')),
          FOREIGN KEY (restaurant_id) REFERENCES restaurants(id)
        );

        -- Minimal Menu Items table
        CREATE TABLE IF NOT EXISTS menu_items (
          id TEXT PRIMARY KEY NOT NULL,
          category_id TEXT NOT NULL,
          name TEXT NOT NULL,
          description TEXT,
          price REAL NOT NULL,
          image_url TEXT,
          is_available INTEGER DEFAULT 1, -- Using INTEGER (0=False, 1=True) for SQLite compatibility
          is_vegetarian INTEGER DEFAULT 0, -- Using INTEGER (0=False, 1=True) for SQLite compatibility
          is_spicy INTEGER DEFAULT 0, -- Using INTEGER (0=False, 1=True) for SQLite compatibility
          calories INTEGER,
          created_at TEXT DEFAULT (datetime('now')),
          updated_at TEXT DEFAULT (datetime('now')),
          FOREIGN KEY (category_id) REFERENCES menu_categories(id)
        );

        -- Minimal App Settings table
        CREATE TABLE IF NOT EXISTS app_settings (
          id TEXT PRIMARY KEY NOT NULL,
          setting_key TEXT UNIQUE NOT NULL,
          setting_value TEXT NOT NULL,
          description TEXT,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );
      `;

      await db.execAsync(minimalSchemaSQL);
    }

    // Insert default settings if not exists
    try {
      await db.execAsync(`
        INSERT OR REPLACE INTO app_settings (id, setting_key, setting_value, description)
        VALUES ('global_settings', 'default', 'settings', 'Default app settings')
        ON CONFLICT (id) DO NOTHING;
      `);
    } catch (settingsError) {
      // console.error('Error inserting default settings:', settingsError);
    }

    // console.log('Fresh database connection created with updated schema');
    return db;
  } catch (error) {
    // console.error('Error creating fresh database connection:', error);
    throw error;
  }
}