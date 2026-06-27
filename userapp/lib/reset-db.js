// Script to reset the SQLite database to apply schema changes
import * as FileSystem from 'expo-file-system';
import * as SQLite from 'expo-sqlite';
import { Platform } from 'react-native';

export async function resetDatabase() {
  try {
    // console.log('Resetting database...');
    
    // Close any existing database connections
    // Delete the database file to force recreation with new schema
    if (Platform.OS === 'web') {
      // For web, we need to clear IndexedDB storage
      if (window.indexedDB) {
        window.indexedDB.deleteDatabase('local_cache.db');
        // console.log('IndexedDB database cleared for web platform');
      }
    } else {
      // For native platforms, delete the database file
      const dbFile = `${FileSystem.documentDirectory}SQLite/local_cache.db`;
      const fileInfo = await FileSystem.getInfoAsync(dbFile);
      
      if (fileInfo.exists) {
        await FileSystem.deleteAsync(dbFile);
        // console.log('Database file deleted successfully');
      } else {
        // console.log('Database file does not exist');
      }
    }
    
    // console.log('Database reset completed. The app will recreate the database with the new schema on next startup.');
    return true;
  } catch (error) {
    // console.error('Error resetting database:', error);
    return false;
  }
}

// Alternative function to drop and recreate tables
export async function recreateTables() {
  try {
    // console.log('Recreating tables with updated schema...');
    
    let db;
    if (Platform.OS === 'web') {
      db = await SQLite.openDatabaseAsync('local_cache.db');
    } else {
      db = SQLite.openDatabaseSync('local_cache.db', { useNewConnection: true });
    }
    
    // Drop existing tables
    await db.execAsync(`
      DROP TABLE IF EXISTS app_settings;
      DROP TABLE IF EXISTS users;
      DROP TABLE IF EXISTS restaurants;
      DROP TABLE IF EXISTS menu_categories;
      DROP TABLE IF EXISTS menu_items;
      DROP TABLE IF EXISTS addresses;
      DROP TABLE IF EXISTS orders;
      DROP TABLE IF EXISTS order_items;
      DROP TABLE IF EXISTS delivery_persons;
      DROP TABLE IF EXISTS delivery_assignments;
      DROP TABLE IF EXISTS delivery_statistics;
    `);
    
    // Recreate tables with updated schema
    const schemaSQL = `
      PRAGMA foreign_keys = ON;
      PRAGMA journal_mode = WAL;

      -- App Settings table
      CREATE TABLE IF NOT EXISTS app_settings (
        id TEXT PRIMARY KEY NOT NULL,
        setting_key TEXT UNIQUE NOT NULL,
        setting_value TEXT NOT NULL,
        description TEXT,
        updated_at TEXT DEFAULT (datetime('now'))
      );

      -- Users table
      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY NOT NULL,
        email TEXT UNIQUE NOT NULL,
        name TEXT,
        phone TEXT,
        image_url TEXT,
        created_at TEXT DEFAULT (datetime('now')),
        updated_at TEXT DEFAULT (datetime('now'))
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
        is_available INTEGER DEFAULT 1, -- Using INTEGER (0=False, 1=True) for SQLite compatibility
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

    // Insert default settings if not exists
    await db.execAsync(`
      INSERT OR REPLACE INTO app_settings (id, setting_key, setting_value, description)
      VALUES ('global_settings', 'default', 'settings', 'Default app settings')
      ON CONFLICT (id) DO NOTHING;
    `);

    // console.log('Tables recreated with updated schema successfully');
    return true;
  } catch (error) {
    // console.error('Error recreating tables:', error);
    return false;
  }
}