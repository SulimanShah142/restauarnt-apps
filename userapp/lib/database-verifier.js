// Database verification and repair script
import { getDatabase, initializeDatabase } from './db-init';
import { supabaseAnon } from './supabase-config';

let db = null;

// Initialize the database when the module loads
async function initDb() {
  await initializeDatabase();
  db = getDatabase();
}

// Initialize the database
initDb();

/**
 * Verify that the database schema matches what's expected
 */
export async function verifyDatabaseSchema() {
  // console.log('Verifying database schema...');
  
  if (!db) {
    await initDb();
  }

  try {
    // Check if all required tables exist
    const tablesResult = await db.getAllAsync(`
      SELECT name FROM sqlite_master WHERE type='table'
    `);
    
    const tableNames = tablesResult.map(row => row.name);
    const requiredTables = ['restaurants', 'menu_items', 'menu_categories', 'app_settings'];
    
    for (const tableName of requiredTables) {
      if (!tableNames.includes(tableName)) {
        // console.error(`Missing required table: ${tableName}`);
        return false;
      }
    }
    
    // Check if restaurants table has all required columns
    const restaurantColumns = await db.getAllAsync(`
      PRAGMA table_info(restaurants)
    `);

    const restaurantColumnNames = restaurantColumns.map(col => col.name);
    const requiredRestaurantColumns = [
      'id', 'name', 'address', 'rating', 'image_url', 'delivery_fee',
      'min_order_amount', 'estimated_delivery_time', 'is_active', 'is_available',
      'description', 'phone', 'email', 'cuisine_type', 'logo_url', 'cover_image_url',
      'created_at', 'updated_at', 'latitude', 'longitude', 'coordinates_geocoded',
      'opening_time', 'closing_time', 'average_rating', 'total_reviews', 'contact_phone',
      'contact_email', 'website_url', 'seating_capacity', 'parking_availability',
      'delivery_radius', 'minimum_order_value', 'estimated_preparation_time', 'last_updated',
      'owner_id'
    ];

    for (const colName of requiredRestaurantColumns) {
      if (!restaurantColumnNames.includes(colName)) {
        // console.error(`Missing column in restaurants table: ${colName}`);
        return false;
      }
    }
    
    // Check if menu_items table has all required columns
    const menuItemColumns = await db.getAllAsync(`
      PRAGMA table_info(menu_items)
    `);

    const menuItemColumnNames = menuItemColumns.map(col => col.name);
    const requiredMenuItemColumns = [
      'id', 'restaurant_id', 'menu_category_id', 'name', 'description', 'price', 'image_url',
      'is_available', 'preparation_time', 'dietary_restrictions', 'created_at',
      'updated_at'
    ];

    for (const colName of requiredMenuItemColumns) {
      if (!menuItemColumnNames.includes(colName)) {
        // console.error(`Missing column in menu_items table: ${colName}`);
        return false;
      }
    }
    
    // Check if menu_categories table has all required columns
    const categoryColumns = await db.getAllAsync(`
      PRAGMA table_info(menu_categories)
    `);

    const categoryColumnNames = categoryColumns.map(col => col.name);
    const requiredCategoryColumns = [
      'id', 'restaurant_id', 'name', 'description', 'image_url', 'sort_order',
      'is_active', 'created_at', 'updated_at'
    ];

    for (const colName of requiredCategoryColumns) {
      if (!categoryColumnNames.includes(colName)) {
        // console.error(`Missing column in menu_categories table: ${colName}`);
        return false;
      }
    }
    
    // console.log('Database schema verification passed');
    return true;
  } catch (error) {
    // console.error('Error verifying database schema:', error);
    return false;
  }
}

/**
 * Repair the database schema by dropping and recreating tables
 */
export async function repairDatabaseSchema() {
  // console.log('Repairing database schema...');
  
  if (!db) {
    await initDb();
  }

  try {
    // Drop all existing tables
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
    
    // Create tables with the exact schema needed
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
        owner_id TEXT, -- References profiles.id
        name TEXT NOT NULL,
        description TEXT,
        image_url TEXT,
        address TEXT,
        phone TEXT,
        email TEXT,
        cuisine_type TEXT,
        rating REAL DEFAULT 0.0,
        delivery_fee REAL DEFAULT 0.0,
        min_order_amount REAL DEFAULT 0.0,
        estimated_delivery_time INTEGER, -- in minutes
        is_active INTEGER DEFAULT 1, -- Use INTEGER (0/1) for SQLite compatibility
        is_available INTEGER DEFAULT 1, -- Use INTEGER (0/1) for SQLite compatibility
        logo_url TEXT,
        cover_image_url TEXT,
        created_at TEXT DEFAULT (datetime('now')),
        updated_at TEXT DEFAULT (datetime('now')),
        latitude REAL,
        longitude REAL,
        coordinates_geocoded INTEGER DEFAULT 0, -- Use INTEGER (0/1) for SQLite compatibility
        opening_time TEXT DEFAULT '09:00:00', -- Use TEXT for SQLite compatibility
        closing_time TEXT DEFAULT '21:00:00', -- Use TEXT for SQLite compatibility
        average_rating REAL DEFAULT 0.0,
        total_reviews INTEGER DEFAULT 0,
        contact_phone TEXT,
        contact_email TEXT,
        website_url TEXT,
        seating_capacity INTEGER,
        parking_availability INTEGER DEFAULT 0, -- Use INTEGER (0/1) for SQLite compatibility
        delivery_radius REAL,
        minimum_order_value REAL DEFAULT 0.0,
        estimated_preparation_time INTEGER,
        last_updated TEXT DEFAULT (datetime('now'))
      );

      -- Menu Categories table
      CREATE TABLE IF NOT EXISTS menu_categories (
        id TEXT PRIMARY KEY, -- Use TEXT to support both UUID (PostgreSQL) and custom IDs (SQLite)
        restaurant_id TEXT NOT NULL, -- References restaurants.id
        name TEXT NOT NULL,
        description TEXT,
        image_url TEXT,
        sort_order INTEGER DEFAULT 0,
        is_active INTEGER DEFAULT 1, -- Use INTEGER (0/1) for SQLite compatibility
        created_at TEXT DEFAULT (datetime('now')),
        updated_at TEXT DEFAULT (datetime('now'))
      );

      -- Menu Items table
      CREATE TABLE IF NOT EXISTS menu_items (
        id TEXT PRIMARY KEY, -- Use TEXT to support both UUID (PostgreSQL) and custom IDs (SQLite)
        restaurant_id TEXT, -- References restaurants.id
        menu_category_id TEXT, -- References menu_categories.id
        name TEXT NOT NULL,
        description TEXT,
        price REAL NOT NULL,
        image_url TEXT,
        is_available INTEGER DEFAULT 1, -- Use INTEGER (0/1) for SQLite compatibility
        preparation_time INTEGER, -- in minutes
        dietary_restrictions TEXT, -- Store as JSON string for SQLite compatibility
        created_at TEXT DEFAULT (datetime('now')),
        updated_at TEXT DEFAULT (datetime('now'))
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
      CREATE INDEX IF NOT EXISTS idx_restaurants_owner_id ON restaurants(owner_id);
      CREATE INDEX IF NOT EXISTS idx_restaurants_active ON restaurants(is_active);
      CREATE INDEX IF NOT EXISTS idx_restaurants_available ON restaurants(is_available);
      CREATE INDEX IF NOT EXISTS idx_restaurants_rating ON restaurants(rating DESC);
      CREATE INDEX IF NOT EXISTS idx_menu_categories_restaurant_id ON menu_categories(restaurant_id);
      CREATE INDEX IF NOT EXISTS idx_menu_items_restaurant_id ON menu_items(restaurant_id);
      CREATE INDEX IF NOT EXISTS idx_menu_items_category_id ON menu_items(menu_category_id);
      CREATE INDEX IF NOT EXISTS idx_menu_items_available ON menu_items(is_available);
      CREATE INDEX IF NOT EXISTS idx_orders_user_id ON orders(user_id);
      CREATE INDEX IF NOT EXISTS idx_orders_restaurant_id ON orders(restaurant_id);
      CREATE INDEX IF NOT EXISTS idx_orders_delivery_person_id ON orders(delivery_person_id);
      CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
      CREATE INDEX IF NOT EXISTS idx_orders_created_at ON orders(created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_order_items_order_id ON order_items(order_id);
      CREATE INDEX IF NOT EXISTS idx_order_items_menu_item_id ON order_items(menu_item_id);
      CREATE INDEX IF NOT EXISTS idx_addresses_user_id ON addresses(user_id);
      CREATE INDEX IF NOT EXISTS idx_delivery_persons_user_id ON delivery_persons(user_id);
      CREATE INDEX IF NOT EXISTS idx_delivery_persons_available ON delivery_persons(is_available);
      CREATE INDEX IF NOT EXISTS idx_delivery_assignments_order_id ON delivery_assignments(order_id);
      CREATE INDEX IF NOT EXISTS idx_delivery_assignments_delivery_person_id ON delivery_assignments(delivery_person_id);
      CREATE INDEX IF NOT EXISTS idx_delivery_assignments_status ON delivery_assignments(status);
      CREATE INDEX IF NOT EXISTS idx_reviews_user_id ON reviews(user_id);
      CREATE INDEX IF NOT EXISTS idx_reviews_restaurant_id ON reviews(restaurant_id);
      CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id);
      CREATE INDEX IF NOT EXISTS idx_notifications_read_status ON notifications(is_read);
      CREATE INDEX IF NOT EXISTS idx_feedback_user_id ON feedback(user_id);
    `;

    await db.execAsync(schemaSQL);

    // Insert default settings if not exists
    await db.execAsync(`
      INSERT OR REPLACE INTO app_settings (id, setting_key, setting_value, description)
      VALUES ('global_settings', 'default', 'settings', 'Default app settings')
      ON CONFLICT (id) DO NOTHING;
    `);

    // console.log('Database schema repaired successfully');
    return true;
  } catch (error) {
    // console.error('Error repairing database schema:', error);
    return false;
  }
}

/**
 * Verify and repair the database schema if needed
 */
export async function verifyAndRepairDatabase() {
  // console.log('Verifying and repairing database...');
  
  const isSchemaValid = await verifyDatabaseSchema();
  
  if (!isSchemaValid) {
    // console.log('Database schema is invalid, repairing...');
    return await repairDatabaseSchema();
  }
  
  // console.log('Database schema is valid');
  return true;
}