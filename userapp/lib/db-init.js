import * as SQLite from 'expo-sqlite';
import { Platform } from 'react-native';
import * as FileSystem from 'expo-file-system';

let db = null;


// Initialize SQLite database with platform-aware approach
async function initializeDatabaseAsync() {
  try {
    // Only perform a hard reset if there are schema issues
    // This prevents clearing data on every app start

    if (Platform.OS === 'web') {
      // On web, use async to allow WASM to load properly
      // But wrap in try-catch to handle web failures gracefully
      try {
        db = await SQLite.openDatabaseAsync('local_cache.db');
      } catch (webError) {
        // console.error('Web database initialization failed:', webError.message);
        // console.log('Falling back to alternative web database initialization...');

        // Try alternative approach for web
        try {
          // Create database with more explicit options for web
          db = await SQLite.openDatabaseAsync('local_cache.db', {
            // Additional options for web compatibility
          });
        } catch (altWebError) {
          // console.error('Alternative web database initialization also failed:', altWebError.message);
          // console.warn('Using in-memory mock database for web environment');
          // Create a mock database object for web when SQLite fails completely
          db = createMockDatabase();
        }
      }
    } else {
      // On native, we can use sync
      db = SQLite.openDatabaseSync('local_cache.db', { useNewConnection: true });
    }

    // Execute schema creation with error handling
    try {
      const schemaSQL = `
        PRAGMA foreign_keys = ON;
        PRAGMA journal_mode = WAL;

        -- Universal Restaurant App Schema
        -- App Settings table
        CREATE TABLE IF NOT EXISTS app_settings (
          id TEXT PRIMARY KEY DEFAULT 'app-settings',
          delivery_cost_per_km REAL DEFAULT 2.50,
          minimum_delivery_cost REAL DEFAULT 5.00,
          is_delivery_enabled INTEGER DEFAULT 1, -- Use INTEGER (0/1) for SQLite compatibility
          base_delivery_fee REAL DEFAULT 3.00,
          max_free_delivery_distance REAL DEFAULT 2.00,
          additional_fee_per_km_after_free REAL DEFAULT 1.50,
          created_at TEXT DEFAULT (datetime('now')),
          updated_at TEXT DEFAULT (datetime('now')),
          manager_number TEXT
        );

        -- Settings table (for dynamic settings)
        CREATE TABLE IF NOT EXISTS settings (
          id TEXT PRIMARY KEY, -- Use TEXT to support both UUID (PostgreSQL) and custom IDs (SQLite)
          setting_key TEXT NOT NULL UNIQUE,
          setting_value TEXT,
          setting_type TEXT DEFAULT 'string',
          description TEXT,
          is_public INTEGER DEFAULT 0, -- Use INTEGER (0/1) for SQLite compatibility
          created_at TEXT DEFAULT (datetime('now')),
          updated_at TEXT DEFAULT (datetime('now'))
        );

        -- Users table (for application-specific user data)
        CREATE TABLE IF NOT EXISTS users (
          id TEXT PRIMARY KEY, -- Use TEXT to support both UUID (PostgreSQL) and custom IDs (SQLite)
          created_at TEXT DEFAULT (datetime('now')),
          updated_at TEXT DEFAULT (datetime('now')),
          email TEXT NOT NULL UNIQUE,
          email_verified INTEGER DEFAULT 0, -- Use INTEGER (0/1) for SQLite compatibility, BOOLEAN for PostgreSQL
          name TEXT,
          image_url TEXT,
          role TEXT DEFAULT 'customer',
          is_active INTEGER DEFAULT 1, -- Use INTEGER (0/1) for SQLite compatibility, BOOLEAN for PostgreSQL
          phone TEXT
        );

        -- Profiles table (links to auth.users in Supabase)
        CREATE TABLE IF NOT EXISTS profiles (
          id TEXT PRIMARY KEY, -- UUID in PostgreSQL, TEXT in SQLite
          full_name TEXT,
          email TEXT,
          phone TEXT,
          role TEXT DEFAULT 'customer',
          created_at TEXT DEFAULT (datetime('now')),
          updated_at TEXT DEFAULT (datetime('now')),
          image_url TEXT,
          avatar_url TEXT,
          name TEXT
        );

        -- Restaurants table
        CREATE TABLE IF NOT EXISTS restaurants (
          id TEXT PRIMARY KEY, -- Use TEXT to support both UUID (PostgreSQL) and custom IDs (SQLite)
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
          id TEXT PRIMARY KEY, -- Use TEXT to support both UUID (PostgreSQL) and custom IDs (SQLite)
          user_id TEXT NOT NULL, -- References users.id
          street_address TEXT,
          city TEXT,
          state TEXT,
          zip_code TEXT,
          country TEXT,
          phone TEXT,
          is_default INTEGER DEFAULT 0, -- Use INTEGER (0/1) for SQLite compatibility
          latitude REAL,
          longitude REAL,
          created_at TEXT DEFAULT (datetime('now'))
        );

        -- Carts table
        CREATE TABLE IF NOT EXISTS carts (
          id TEXT PRIMARY KEY, -- Use TEXT to support both UUID (PostgreSQL) and custom IDs (SQLite)
          user_id TEXT NOT NULL, -- References users.id
          restaurant_id TEXT, -- References restaurants.id
          quantity INTEGER DEFAULT 1
        );

        -- Cart Items table
        CREATE TABLE IF NOT EXISTS cart_items (
          id TEXT PRIMARY KEY, -- Use TEXT to support both UUID (PostgreSQL) and custom IDs (SQLite)
          created_at TEXT DEFAULT (datetime('now')),
          updated_at TEXT DEFAULT (datetime('now')),
          cart_id TEXT NOT NULL, -- References carts.id
          menu_item_id TEXT NOT NULL, -- References menu_items.id
          quantity INTEGER DEFAULT 1,
          price REAL NOT NULL -- Price at the time of adding to cart
        );

        -- Orders table
        CREATE TABLE IF NOT EXISTS orders (
          id TEXT PRIMARY KEY, -- Use TEXT to support both UUID (PostgreSQL) and custom IDs (SQLite)
          user_id TEXT, -- References users.id
          restaurant_id TEXT, -- References restaurants.id
          delivery_person_id TEXT, -- References delivery_persons.id
          status TEXT DEFAULT 'pending', -- pending, confirmed, preparing, ready, on_the_way, delivered, cancelled, rejected
          total_amount REAL NOT NULL,
          delivery_address TEXT NOT NULL,
          delivery_notes TEXT,
          payment_method TEXT, -- cash, card, digital_wallet
          payment_status TEXT DEFAULT 'pending', -- pending, paid, failed, refunded
          cancellation_reason TEXT,
          rejection_reason TEXT,
          estimated_delivery_time TEXT, -- Store as TEXT for SQLite compatibility
          actual_delivery_time TEXT, -- Store as TEXT for SQLite compatibility
          created_at TEXT DEFAULT (datetime('now')),
          updated_at TEXT DEFAULT (datetime('now')),
          driver_id TEXT, -- References profiles.id
          delivery_cost REAL DEFAULT 0.00,
          delivery_lat REAL,
          delivery_lng REAL,
          subtotal REAL,
          restaurant_name TEXT
        );

        -- Order Items table
        CREATE TABLE IF NOT EXISTS order_items (
          id TEXT PRIMARY KEY, -- Use TEXT to support both UUID (PostgreSQL) and custom IDs (SQLite)
          order_id TEXT, -- References orders.id
          menu_item_id TEXT, -- References menu_items.id
          quantity INTEGER NOT NULL DEFAULT 1,
          price REAL NOT NULL, -- Price at time of order
          special_instructions TEXT,
          created_at TEXT DEFAULT (datetime('now'))
        );

        -- Payments table
        CREATE TABLE IF NOT EXISTS payments (
          id TEXT PRIMARY KEY, -- Use TEXT to support both UUID (PostgreSQL) and custom IDs (SQLite)
          created_at TEXT DEFAULT (datetime('now')),
          updated_at TEXT DEFAULT (datetime('now')),
          order_id TEXT NOT NULL, -- References orders.id
          amount REAL NOT NULL,
          method TEXT NOT NULL, -- cash, card, digital_wallet
          status TEXT DEFAULT 'pending', -- pending, paid, failed, refunded
          transaction_id TEXT,
          gateway_response TEXT -- Store as JSON string for SQLite compatibility
        );

        -- Delivery Persons table
        CREATE TABLE IF NOT EXISTS delivery_persons (
          id TEXT PRIMARY KEY, -- Use TEXT to support both UUID (PostgreSQL) and custom IDs (SQLite)
          user_id TEXT UNIQUE, -- References users.id, UNIQUE constraint
          name TEXT NOT NULL,
          email TEXT,
          phone TEXT,
          vehicle_type TEXT, -- bike, car, motorcycle
          license_plate TEXT,
          is_available INTEGER DEFAULT 1, -- Use INTEGER (0/1) for SQLite compatibility
          current_location TEXT, -- Store as JSON string for SQLite compatibility
          current_latitude REAL,
          current_longitude REAL,
          rating REAL DEFAULT 0.0,
          total_deliveries INTEGER DEFAULT 0,
          created_at TEXT DEFAULT (datetime('now')),
          updated_at TEXT DEFAULT (datetime('now')),
          password_hash TEXT,
          temp_password TEXT,
          address TEXT
        );

        -- Delivery Assignments table
        CREATE TABLE IF NOT EXISTS delivery_assignments (
          id TEXT PRIMARY KEY, -- Use TEXT to support both UUID (PostgreSQL) and custom IDs (SQLite)
          order_id TEXT UNIQUE, -- References orders.id, UNIQUE constraint
          delivery_person_id TEXT NOT NULL, -- References delivery_persons.id
          delivery_address TEXT,
          notes TEXT,
          phone_number TEXT,
          status TEXT DEFAULT 'pending', -- pending, accepted, in_transit, delivered, failed
          assigned_at TEXT DEFAULT (datetime('now')),
          accepted_at TEXT,
          delivered_at TEXT
        );

        -- Delivery Statistics table
        CREATE TABLE IF NOT EXISTS delivery_statistics (
          id TEXT PRIMARY KEY, -- Use TEXT to support both UUID (PostgreSQL) and custom IDs (SQLite)
          delivery_person_id TEXT NOT NULL, -- References delivery_persons.id
          order_id TEXT NOT NULL, -- References orders.id
          order_total_amount REAL NOT NULL,
          delivery_fee REAL NOT NULL,
          delivery_status TEXT DEFAULT 'delivered', -- delivered, cancelled, returned
          created_at TEXT DEFAULT (datetime('now'))
        );

        -- Reviews table
        CREATE TABLE IF NOT EXISTS reviews (
          id TEXT PRIMARY KEY, -- Use TEXT to support both UUID (PostgreSQL) and custom IDs (SQLite)
          user_id TEXT NOT NULL, -- References users.id
          restaurant_id TEXT, -- References restaurants.id
          rating INTEGER CHECK (rating >= 1 AND rating <= 5), -- Rating from 1 to 5
          comment TEXT,
          created_at TEXT DEFAULT (datetime('now'))
        );

        -- Notifications table
        CREATE TABLE IF NOT EXISTS notifications (
          id TEXT PRIMARY KEY, -- Use TEXT to support both UUID (PostgreSQL) and custom IDs (SQLite)
          user_id TEXT, -- References users.id
          title TEXT NOT NULL,
          message TEXT NOT NULL,
          type TEXT DEFAULT 'info', -- info, warning, success, error
          is_read INTEGER DEFAULT 0, -- Use INTEGER (0/1) for SQLite compatibility
          data TEXT, -- Store as JSON string for SQLite compatibility
          created_at TEXT DEFAULT (datetime('now'))
        );

        -- Feedback table
        CREATE TABLE IF NOT EXISTS feedback (
          id TEXT PRIMARY KEY, -- Use TEXT to support both UUID (PostgreSQL) and custom IDs (SQLite)
          user_id TEXT, -- References profiles.id
          title TEXT NOT NULL,
          comment TEXT,
          rating INTEGER CHECK (rating >= 1 AND rating <= 5), -- Rating from 1 to 5
          is_resolved INTEGER DEFAULT 0, -- Use INTEGER (0/1) for SQLite compatibility
          created_at TEXT DEFAULT (datetime('now')),
          updated_at TEXT DEFAULT (datetime('now'))
        );

        -- Admins table
        CREATE TABLE IF NOT EXISTS admins (
          id TEXT PRIMARY KEY, -- Use TEXT to support both UUID (PostgreSQL) and custom IDs (SQLite)
          user_id TEXT UNIQUE NOT NULL, -- References users.id, UNIQUE constraint
          role TEXT DEFAULT 'admin', -- admin, super_admin, manager
          session_token TEXT,
          last_login TEXT, -- Store as TEXT for SQLite compatibility
          permissions TEXT, -- Store as JSON string for SQLite compatibility
          is_active INTEGER DEFAULT 1, -- Use INTEGER (0/1) for SQLite compatibility
          login_attempts INTEGER DEFAULT 0,
          locked_until TEXT, -- Store as TEXT for SQLite compatibility
          created_at TEXT DEFAULT (datetime('now')),
          updated_at TEXT DEFAULT (datetime('now'))
        );

        -- Advertisements table
        CREATE TABLE IF NOT EXISTS advertisements (
          id TEXT PRIMARY KEY, -- Use TEXT to support both UUID (PostgreSQL) and custom IDs (SQLite)
          restaurant_id TEXT, -- References restaurants.id
          title TEXT NOT NULL,
          description TEXT,
          image_url TEXT,
          link_url TEXT,
          priority INTEGER DEFAULT 0,
          is_active INTEGER DEFAULT 1, -- Use INTEGER (0/1) for SQLite compatibility
          start_date TEXT, -- Store as TEXT for SQLite compatibility
          end_date TEXT, -- Store as TEXT for SQLite compatibility
          created_at TEXT DEFAULT (datetime('now')),
          updated_at TEXT DEFAULT (datetime('now'))
        );

        -- Indexes for better performance
        -- Users indexes
        CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
        CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);

        -- Restaurants indexes
        CREATE INDEX IF NOT EXISTS idx_restaurants_owner_id ON restaurants(owner_id);
        CREATE INDEX IF NOT EXISTS idx_restaurants_active ON restaurants(is_active);
        CREATE INDEX IF NOT EXISTS idx_restaurants_available ON restaurants(is_available);
        CREATE INDEX IF NOT EXISTS idx_restaurants_rating ON restaurants(rating DESC);

        -- Menu categories indexes
        CREATE INDEX IF NOT EXISTS idx_menu_categories_restaurant_id ON menu_categories(restaurant_id);

        -- Menu items indexes
        CREATE INDEX IF NOT EXISTS idx_menu_items_restaurant_id ON menu_items(restaurant_id);
        CREATE INDEX IF NOT EXISTS idx_menu_items_category_id ON menu_items(menu_category_id);
        CREATE INDEX IF NOT EXISTS idx_menu_items_available ON menu_items(is_available);

        -- Orders indexes
        CREATE INDEX IF NOT EXISTS idx_orders_user_id ON orders(user_id);
        CREATE INDEX IF NOT EXISTS idx_orders_restaurant_id ON orders(restaurant_id);
        CREATE INDEX IF NOT EXISTS idx_orders_delivery_person_id ON orders(delivery_person_id);
        CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
        CREATE INDEX IF NOT EXISTS idx_orders_created_at ON orders(created_at DESC);

        -- Order items indexes
        CREATE INDEX IF NOT EXISTS idx_order_items_order_id ON order_items(order_id);
        CREATE INDEX IF NOT EXISTS idx_order_items_menu_item_id ON order_items(menu_item_id);

        -- Addresses indexes
        CREATE INDEX IF NOT EXISTS idx_addresses_user_id ON addresses(user_id);

        -- Delivery persons indexes
        CREATE INDEX IF NOT EXISTS idx_delivery_persons_user_id ON delivery_persons(user_id);
        CREATE INDEX IF NOT EXISTS idx_delivery_persons_available ON delivery_persons(is_available);

        -- Delivery assignments indexes
        CREATE INDEX IF NOT EXISTS idx_delivery_assignments_order_id ON delivery_assignments(order_id);
        CREATE INDEX IF NOT EXISTS idx_delivery_assignments_delivery_person_id ON delivery_assignments(delivery_person_id);
        CREATE INDEX IF NOT EXISTS idx_delivery_assignments_status ON delivery_assignments(status);

        -- Reviews indexes
        CREATE INDEX IF NOT EXISTS idx_reviews_user_id ON reviews(user_id);
        CREATE INDEX IF NOT EXISTS idx_reviews_restaurant_id ON reviews(restaurant_id);

        -- Notifications indexes
        CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id);
        CREATE INDEX IF NOT EXISTS idx_notifications_read_status ON notifications(is_read);

        -- Feedback indexes
        CREATE INDEX IF NOT EXISTS idx_feedback_user_id ON feedback(user_id);

        -- Triggers to update updated_at column
        CREATE TRIGGER IF NOT EXISTS update_users_updated_at 
            AFTER UPDATE ON users 
            BEGIN 
                UPDATE users SET updated_at = datetime('now') WHERE id = NEW.id; 
            END;

        CREATE TRIGGER IF NOT EXISTS update_restaurants_updated_at 
            AFTER UPDATE ON restaurants 
            BEGIN 
                UPDATE restaurants SET updated_at = datetime('now') WHERE id = NEW.id; 
            END;

        CREATE TRIGGER IF NOT EXISTS update_menu_categories_updated_at 
            AFTER UPDATE ON menu_categories 
            BEGIN 
                UPDATE menu_categories SET updated_at = datetime('now') WHERE id = NEW.id; 
            END;

        CREATE TRIGGER IF NOT EXISTS update_menu_items_updated_at 
            AFTER UPDATE ON menu_items 
            BEGIN 
                UPDATE menu_items SET updated_at = datetime('now') WHERE id = NEW.id; 
            END;

        CREATE TRIGGER IF NOT EXISTS update_orders_updated_at 
            AFTER UPDATE ON orders 
            BEGIN 
                UPDATE orders SET updated_at = datetime('now') WHERE id = NEW.id; 
            END;

        CREATE TRIGGER IF NOT EXISTS update_order_items_updated_at 
            AFTER UPDATE ON order_items 
            BEGIN 
                UPDATE order_items SET updated_at = datetime('now') WHERE id = NEW.id; 
            END;

        CREATE TRIGGER IF NOT EXISTS update_delivery_persons_updated_at 
            AFTER UPDATE ON delivery_persons 
            BEGIN 
                UPDATE delivery_persons SET updated_at = datetime('now') WHERE id = NEW.id; 
            END;

        CREATE TRIGGER IF NOT EXISTS update_delivery_assignments_updated_at 
            AFTER UPDATE ON delivery_assignments 
            BEGIN 
                UPDATE delivery_assignments SET updated_at = datetime('now') WHERE id = NEW.id; 
            END;

        CREATE TRIGGER IF NOT EXISTS update_reviews_updated_at 
            AFTER UPDATE ON reviews 
            BEGIN 
                UPDATE reviews SET updated_at = datetime('now') WHERE id = NEW.id; 
            END;

        CREATE TRIGGER IF NOT EXISTS update_notifications_updated_at 
            AFTER UPDATE ON notifications 
            BEGIN 
                UPDATE notifications SET updated_at = datetime('now') WHERE id = NEW.id; 
            END;

        CREATE TRIGGER IF NOT EXISTS update_feedback_updated_at 
            AFTER UPDATE ON feedback 
            BEGIN 
                UPDATE feedback SET updated_at = datetime('now') WHERE id = NEW.id; 
            END;

        CREATE TRIGGER IF NOT EXISTS update_admins_updated_at 
            AFTER UPDATE ON admins 
            BEGIN 
                UPDATE admins SET updated_at = datetime('now') WHERE id = NEW.id; 
            END;

        CREATE TRIGGER IF NOT EXISTS update_advertisements_updated_at 
            AFTER UPDATE ON advertisements 
            BEGIN 
                UPDATE advertisements SET updated_at = datetime('now') WHERE id = NEW.id; 
            END;

        CREATE TRIGGER IF NOT EXISTS update_settings_updated_at 
            AFTER UPDATE ON settings 
            BEGIN 
                UPDATE settings SET updated_at = datetime('now') WHERE id = NEW.id; 
            END;

        CREATE TRIGGER IF NOT EXISTS update_app_settings_updated_at 
            AFTER UPDATE ON app_settings 
            BEGIN 
                UPDATE app_settings SET updated_at = datetime('now') WHERE id = id; 
            END;
      `;

      await db.execAsync(schemaSQL);
    } catch (schemaError) {
      // console.error('Error executing schema SQL:', schemaError);
      // If schema creation fails, try a minimal schema
      await createMinimalSchema(db);
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

    // console.log('Local cache database initialized successfully with fresh schema');
    
    // Seed the database with sample data if it's empty
    try {
      // We'll call a function to seed data if needed after initialization
      // This will be handled by sync utilities when needed
    } catch (seedError) {
      // console.error('Error during database seeding:', seedError);
    }
  } catch (error) {
    // console.error('Error during database initialization:', error);
    throw error;
  }
}

// Function to create a minimal schema as fallback
async function createMinimalSchema(database) {
  // console.log('Creating minimal schema as fallback...');

  const minimalSchemaSQL = `
    PRAGMA foreign_keys = ON;
    PRAGMA journal_mode = WAL;

    -- Minimal Users table
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY, -- Use TEXT to support both UUID (PostgreSQL) and custom IDs (SQLite)
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now')),
      email TEXT NOT NULL UNIQUE,
      email_verified INTEGER DEFAULT 0, -- Use INTEGER (0/1) for SQLite compatibility, BOOLEAN for PostgreSQL
      name TEXT,
      image_url TEXT,
      role TEXT DEFAULT 'customer',
      is_active INTEGER DEFAULT 1, -- Use INTEGER (0/1) for SQLite compatibility, BOOLEAN for PostgreSQL
      phone TEXT
    );

    -- Minimal Restaurants table
    CREATE TABLE IF NOT EXISTS restaurants (
      id TEXT PRIMARY KEY, -- Use TEXT to support both UUID (PostgreSQL) and custom IDs (SQLite)
      owner_id TEXT, -- References profiles.id
      name TEXT NOT NULL,
      description TEXT,
      image_url TEXT,
      address TEXT,
      phone TEXT,
      email TEXT,
      rating REAL DEFAULT 0.0,
      delivery_fee REAL DEFAULT 0.0,
      min_order_amount REAL DEFAULT 0.0,
      estimated_delivery_time INTEGER, -- in minutes
      is_active INTEGER DEFAULT 1, -- Use INTEGER (0/1) for SQLite compatibility
      is_available INTEGER DEFAULT 1, -- Use INTEGER (0/1) for SQLite compatibility
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    -- Minimal Menu Categories table
    CREATE TABLE IF NOT EXISTS menu_categories (
      id TEXT PRIMARY KEY, -- Use TEXT to support both UUID (PostgreSQL) and custom IDs (SQLite)
      restaurant_id TEXT NOT NULL, -- References restaurants.id
      name TEXT NOT NULL,
      description TEXT,
      sort_order INTEGER DEFAULT 0,
      is_active INTEGER DEFAULT 1, -- Use INTEGER (0/1) for SQLite compatibility
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    -- Minimal Menu Items table
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
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    -- App Settings table
    CREATE TABLE IF NOT EXISTS app_settings (
      id TEXT PRIMARY KEY DEFAULT 'app-settings',
      delivery_cost_per_km REAL DEFAULT 2.50,
      minimum_delivery_cost REAL DEFAULT 5.00,
      is_delivery_enabled INTEGER DEFAULT 1, -- Use INTEGER (0/1) for SQLite compatibility
      base_delivery_fee REAL DEFAULT 3.00,
      max_free_delivery_distance REAL DEFAULT 2.00,
      additional_fee_per_km_after_free REAL DEFAULT 1.50,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now')),
      manager_number TEXT
    );

    -- Indexes for better performance
    CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
    CREATE INDEX IF NOT EXISTS idx_restaurants_owner_id ON restaurants(owner_id);
    CREATE INDEX IF NOT EXISTS idx_restaurants_active ON restaurants(is_active);
    CREATE INDEX IF NOT EXISTS idx_menu_items_restaurant_id ON menu_items(restaurant_id);
    CREATE INDEX IF NOT EXISTS idx_menu_items_category_id ON menu_items(menu_category_id);
    CREATE INDEX IF NOT EXISTS idx_menu_items_available ON menu_items(is_available);

    -- Triggers to update updated_at column
    CREATE TRIGGER IF NOT EXISTS update_users_updated_at 
        AFTER UPDATE ON users 
        BEGIN 
            UPDATE users SET updated_at = datetime('now') WHERE id = NEW.id; 
        END;

    CREATE TRIGGER IF NOT EXISTS update_restaurants_updated_at 
        AFTER UPDATE ON restaurants 
        BEGIN 
            UPDATE restaurants SET updated_at = datetime('now') WHERE id = NEW.id; 
        END;

    CREATE TRIGGER IF NOT EXISTS update_menu_categories_updated_at 
        AFTER UPDATE ON menu_categories 
        BEGIN 
            UPDATE menu_categories SET updated_at = datetime('now') WHERE id = NEW.id; 
        END;

    CREATE TRIGGER IF NOT EXISTS update_menu_items_updated_at 
        AFTER UPDATE ON menu_items 
        BEGIN 
            UPDATE menu_items SET updated_at = datetime('now') WHERE id = NEW.id; 
        END;

    CREATE TRIGGER IF NOT EXISTS update_orders_updated_at 
        AFTER UPDATE ON orders 
        BEGIN 
            UPDATE orders SET updated_at = datetime('now') WHERE id = NEW.id; 
        END;

    CREATE TRIGGER IF NOT EXISTS update_order_items_updated_at 
        AFTER UPDATE ON order_items 
        BEGIN 
            UPDATE order_items SET updated_at = datetime('now') WHERE id = NEW.id; 
        END;

    CREATE TRIGGER IF NOT EXISTS update_delivery_persons_updated_at 
        AFTER UPDATE ON delivery_persons 
        BEGIN 
            UPDATE delivery_persons SET updated_at = datetime('now') WHERE id = NEW.id; 
        END;

    CREATE TRIGGER IF NOT EXISTS update_delivery_assignments_updated_at 
        AFTER UPDATE ON delivery_assignments 
        BEGIN 
            UPDATE delivery_assignments SET updated_at = datetime('now') WHERE id = NEW.id; 
        END;

    CREATE TRIGGER IF NOT EXISTS update_reviews_updated_at 
        AFTER UPDATE ON reviews 
        BEGIN 
            UPDATE reviews SET updated_at = datetime('now') WHERE id = NEW.id; 
        END;

    CREATE TRIGGER IF NOT EXISTS update_notifications_updated_at 
        AFTER UPDATE ON notifications 
        BEGIN 
            UPDATE notifications SET updated_at = datetime('now') WHERE id = NEW.id; 
        END;

    CREATE TRIGGER IF NOT EXISTS update_feedback_updated_at 
        AFTER UPDATE ON feedback 
        BEGIN 
            UPDATE feedback SET updated_at = datetime('now') WHERE id = NEW.id; 
        END;

    CREATE TRIGGER IF NOT EXISTS update_admins_updated_at 
        AFTER UPDATE ON admins 
        BEGIN 
            UPDATE admins SET updated_at = datetime('now') WHERE id = NEW.id; 
        END;

    CREATE TRIGGER IF NOT EXISTS update_advertisements_updated_at 
        AFTER UPDATE ON advertisements 
        BEGIN 
            UPDATE advertisements SET updated_at = datetime('now') WHERE id = NEW.id; 
        END;

    CREATE TRIGGER IF NOT EXISTS update_settings_updated_at 
        AFTER UPDATE ON settings 
        BEGIN 
            UPDATE settings SET updated_at = datetime('now') WHERE id = NEW.id; 
        END;
  `;

  await database.execAsync(minimalSchemaSQL);
  // console.log('Minimal schema created successfully');
}

// Function to perform a hard reset of the database
async function performHardReset() {
  try {
    // console.log('Performing hard reset of database before initialization...');
    
    // For web platform
    if (Platform.OS === 'web') {
      if (window.indexedDB) {
        const deleteReq = window.indexedDB.deleteDatabase('local_cache.db');
        await new Promise((resolve, reject) => {
          deleteReq.onsuccess = () => resolve();
          deleteReq.onerror = (event) => reject(event.target.error);
        });
        // console.log('Web database cleared');
      }
    } else {
      // For native platforms, delete the database file
      const dbPath = `${FileSystem.documentDirectory}SQLite/local_cache.db`;
      const journalPath = `${FileSystem.documentDirectory}SQLite/local_cache.db-journal`;
      
      try {
        const fileInfo = await FileSystem.getInfoAsync(dbPath);
        if (fileInfo.exists) {
          await FileSystem.deleteAsync(dbPath);
          // console.log('Native database file deleted');
        }
      } catch (err) {
        // console.warn('Could not delete database file:', err.message);
      }
      
      try {
        const journalFileInfo = await FileSystem.getInfoAsync(journalPath);
        if (journalFileInfo.exists) {
          await FileSystem.deleteAsync(journalPath);
          // console.log('Journal file deleted');
        }
      } catch (err) {
        // console.warn('Could not delete journal file:', err.message);
      }
    }
    
    // console.log('Database hard reset completed');
  } catch (error) {
    // console.error('Error during hard reset:', error);
    // Continue anyway as the database will be recreated
  }
}

// Create a mock database for web environments where SQLite doesn't work properly
function createMockDatabase() {
  // console.log('Creating mock database for web environment');
  
  // Simple in-memory mock that mimics SQLite behavior
  const mockData = {
    restaurants: [],
    menu_items: [],
    orders: [],
    order_items: [],
    users: [],
    addresses: [],
    delivery_persons: [],
    delivery_settings: [],
    cart_items: [],
    reviews: [],
    categories: [],
    promotions: [],
    coupons: [],
    payments: [],
    notifications: [],
    delivery_assignments: [],
    delivery_locations: [],
    app_settings: [],
    settings: [],
    profiles: [],
    feedback: [],
    admins: [],
    advertisements: []
  };
  
  return {
    execAsync: async (sql) => {
      // Mock schema execution - just acknowledge it
      // console.log('Mock database execAsync:', sql.substring(0, 50) + '...');
      return Promise.resolve();
    },
    runAsync: async (sql, params) => {
      // Mock run operation
      // console.log('Mock database runAsync:', sql, params);
      return Promise.resolve({ changes: 1, lastInsertRowId: Date.now() });
    },
    getFirstAsync: async (sql, params) => {
      // Mock get first operation
      // console.log('Mock database getFirstAsync:', sql, params);
      return Promise.resolve(null);
    },
    getAllAsync: async (sql, params) => {
      // Mock get all operation
      // console.log('Mock database getAllAsync:', sql);

      // Handle PRAGMA table_info queries for schema verification
      if (sql.toUpperCase().includes('PRAGMA TABLE_INFO')) {
        const tableNameMatch = sql.match(/table_info\(([^)]+)\)/i);
        if (tableNameMatch) {
          const tableName = tableNameMatch[1].replace(/['"]/g, '');
          
          // Define the expected columns for each table
          switch(tableName.toLowerCase()) {
            case 'restaurants':
              return Promise.resolve([
                { cid: 0, name: 'id', type: 'TEXT', notnull: 1, dflt_value: null, pk: 1 },
                { cid: 1, name: 'name', type: 'TEXT', notnull: 1, dflt_value: null, pk: 0 },
                { cid: 2, name: 'address', type: 'TEXT', notnull: 0, dflt_value: null, pk: 0 },
                { cid: 3, name: 'rating', type: 'REAL', notnull: 0, dflt_value: null, pk: 0 },
                { cid: 4, name: 'image_url', type: 'TEXT', notnull: 0, dflt_value: null, pk: 0 },
                { cid: 5, name: 'delivery_fee', type: 'REAL', notnull: 0, dflt_value: null, pk: 0 },
                { cid: 6, name: 'min_order_amount', type: 'REAL', notnull: 0, dflt_value: null, pk: 0 },
                { cid: 7, name: 'estimated_delivery_time', type: 'INTEGER', notnull: 0, dflt_value: null, pk: 0 },
                { cid: 8, name: 'is_active', type: 'INTEGER', notnull: 0, dflt_value: '1', pk: 0 },
                { cid: 9, name: 'is_available', type: 'INTEGER', notnull: 0, dflt_value: '1', pk: 0 },
                { cid: 10, name: 'description', type: 'TEXT', notnull: 0, dflt_value: null, pk: 0 },
                { cid: 11, name: 'phone', type: 'TEXT', notnull: 0, dflt_value: null, pk: 0 },
                { cid: 12, name: 'email', type: 'TEXT', notnull: 0, dflt_value: null, pk: 0 },
                { cid: 13, name: 'cuisine_type', type: 'TEXT', notnull: 0, dflt_value: null, pk: 0 },
                { cid: 14, name: 'logo_url', type: 'TEXT', notnull: 0, dflt_value: null, pk: 0 },
                { cid: 15, name: 'cover_image_url', type: 'TEXT', notnull: 0, dflt_value: null, pk: 0 },
                { cid: 16, name: 'created_at', type: 'TEXT', notnull: 0, dflt_value: "(datetime('now'))", pk: 0 },
                { cid: 17, name: 'updated_at', type: 'TEXT', notnull: 0, dflt_value: "(datetime('now'))", pk: 0 },
                { cid: 18, name: 'latitude', type: 'REAL', notnull: 0, dflt_value: null, pk: 0 },
                { cid: 19, name: 'longitude', type: 'REAL', notnull: 0, dflt_value: null, pk: 0 },
                { cid: 20, name: 'coordinates_geocoded', type: 'INTEGER', notnull: 0, dflt_value: '0', pk: 0 },
                { cid: 21, name: 'opening_time', type: 'TEXT', notnull: 0, dflt_value: '09:00:00', pk: 0 },
                { cid: 22, name: 'closing_time', type: 'TEXT', notnull: 0, dflt_value: '21:00:00', pk: 0 },
                { cid: 23, name: 'average_rating', type: 'REAL', notnull: 0, dflt_value: '0.0', pk: 0 },
                { cid: 24, name: 'total_reviews', type: 'INTEGER', notnull: 0, dflt_value: '0', pk: 0 },
                { cid: 25, name: 'contact_phone', type: 'TEXT', notnull: 0, dflt_value: null, pk: 0 },
                { cid: 26, name: 'contact_email', type: 'TEXT', notnull: 0, dflt_value: null, pk: 0 },
                { cid: 27, name: 'website_url', type: 'TEXT', notnull: 0, dflt_value: null, pk: 0 },
                { cid: 28, name: 'seating_capacity', type: 'INTEGER', notnull: 0, dflt_value: null, pk: 0 },
                { cid: 29, name: 'parking_availability', type: 'INTEGER', notnull: 0, dflt_value: '0', pk: 0 },
                { cid: 30, name: 'delivery_radius', type: 'REAL', notnull: 0, dflt_value: null, pk: 0 },
                { cid: 31, name: 'minimum_order_value', type: 'REAL', notnull: 0, dflt_value: '0.0', pk: 0 },
                { cid: 32, name: 'estimated_preparation_time', type: 'INTEGER', notnull: 0, dflt_value: null, pk: 0 },
                { cid: 33, name: 'last_updated', type: 'TEXT', notnull: 0, dflt_value: "(datetime('now'))", pk: 0 },
                { cid: 34, name: 'owner_id', type: 'TEXT', notnull: 0, dflt_value: null, pk: 0 }
              ]);
            case 'menu_items':
              return Promise.resolve([
                { cid: 0, name: 'id', type: 'TEXT', notnull: 1, dflt_value: null, pk: 1 },
                { cid: 1, name: 'restaurant_id', type: 'TEXT', notnull: 0, dflt_value: null, pk: 0 },
                { cid: 2, name: 'menu_category_id', type: 'TEXT', notnull: 0, dflt_value: null, pk: 0 },
                { cid: 3, name: 'name', type: 'TEXT', notnull: 1, dflt_value: null, pk: 0 },
                { cid: 4, name: 'description', type: 'TEXT', notnull: 0, dflt_value: null, pk: 0 },
                { cid: 5, name: 'price', type: 'REAL', notnull: 1, dflt_value: null, pk: 0 },
                { cid: 6, name: 'image_url', type: 'TEXT', notnull: 0, dflt_value: null, pk: 0 },
                { cid: 7, name: 'is_available', type: 'INTEGER', notnull: 0, dflt_value: '1', pk: 0 },
                { cid: 8, name: 'preparation_time', type: 'INTEGER', notnull: 0, dflt_value: null, pk: 0 },
                { cid: 9, name: 'dietary_restrictions', type: 'TEXT', notnull: 0, dflt_value: null, pk: 0 },
                { cid: 10, name: 'created_at', type: 'TEXT', notnull: 0, dflt_value: "(datetime('now'))", pk: 0 },
                { cid: 11, name: 'updated_at', type: 'TEXT', notnull: 0, dflt_value: "(datetime('now'))", pk: 0 }
              ]);
            case 'menu_categories':
              return Promise.resolve([
                { cid: 0, name: 'id', type: 'TEXT', notnull: 1, dflt_value: null, pk: 1 },
                { cid: 1, name: 'restaurant_id', type: 'TEXT', notnull: 1, dflt_value: null, pk: 0 },
                { cid: 2, name: 'name', type: 'TEXT', notnull: 1, dflt_value: null, pk: 0 },
                { cid: 3, name: 'description', type: 'TEXT', notnull: 0, dflt_value: null, pk: 0 },
                { cid: 4, name: 'image_url', type: 'TEXT', notnull: 0, dflt_value: null, pk: 0 },
                { cid: 5, name: 'sort_order', type: 'INTEGER', notnull: 0, dflt_value: '0', pk: 0 },
                { cid: 6, name: 'is_active', type: 'INTEGER', notnull: 0, dflt_value: '1', pk: 0 },
                { cid: 7, name: 'created_at', type: 'TEXT', notnull: 0, dflt_value: "(datetime('now'))", pk: 0 },
                { cid: 8, name: 'updated_at', type: 'TEXT', notnull: 0, dflt_value: "(datetime('now'))", pk: 0 }
              ]);
            case 'app_settings':
              return Promise.resolve([
                { cid: 0, name: 'id', type: 'TEXT', notnull: 1, dflt_value: "'app-settings'", pk: 1 },
                { cid: 1, name: 'delivery_cost_per_km', type: 'REAL', notnull: 0, dflt_value: '2.50', pk: 0 },
                { cid: 2, name: 'minimum_delivery_cost', type: 'REAL', notnull: 0, dflt_value: '5.00', pk: 0 },
                { cid: 3, name: 'is_delivery_enabled', type: 'INTEGER', notnull: 0, dflt_value: '1', pk: 0 },
                { cid: 4, name: 'base_delivery_fee', type: 'REAL', notnull: 0, dflt_value: '3.00', pk: 0 },
                { cid: 5, name: 'max_free_delivery_distance', type: 'REAL', notnull: 0, dflt_value: '2.00', pk: 0 },
                { cid: 6, name: 'additional_fee_per_km_after_free', type: 'REAL', notnull: 0, dflt_value: '1.50', pk: 0 },
                { cid: 7, name: 'created_at', type: 'TEXT', notnull: 0, dflt_value: "(datetime('now'))", pk: 0 },
                { cid: 8, name: 'updated_at', type: 'TEXT', notnull: 0, dflt_value: "(datetime('now'))", pk: 0 },
                { cid: 9, name: 'manager_number', type: 'TEXT', notnull: 0, dflt_value: null, pk: 0 }
              ]);
            default:
              return Promise.resolve([]);
          }
        }
      }
      
      // Handle PRAGMA table list query for schema verification
      if (sql.toUpperCase().includes("SELECT NAME FROM SQLITE_MASTER WHERE TYPE='TABLE'")) {
        return Promise.resolve([
          { name: 'restaurants' },
          { name: 'menu_items' },
          { name: 'menu_categories' },
          { name: 'app_settings' },
          { name: 'users' },
          { name: 'addresses' },
          { name: 'orders' },
          { name: 'order_items' },
          { name: 'delivery_persons' },
          { name: 'delivery_assignments' },
          { name: 'delivery_statistics' },
          { name: 'reviews' },
          { name: 'notifications' },
          { name: 'feedback' },
          { name: 'admins' },
          { name: 'advertisements' },
          { name: 'settings' },
          { name: 'profiles' },
          { name: 'payments' },
          { name: 'cart_items' },
          { name: 'carts' }
        ]);
      }

      // Determine which table to query based on the SQL
      if (sql.toUpperCase().includes('FROM RESTAURANTS') || sql.toUpperCase().includes('FROM RESTAURANTS')) {
        return Promise.resolve(mockData.restaurants);
      } else if (sql.toUpperCase().includes('FROM MENU_ITEMS') || sql.toUpperCase().includes('FROM MENU_ITEMS')) {
        return Promise.resolve(mockData.menu_items);
      } else if (sql.toUpperCase().includes('FROM ORDERS') || sql.toUpperCase().includes('FROM ORDERS')) {
        return Promise.resolve(mockData.orders);
      } else if (sql.toUpperCase().includes('FROM ORDER_ITEMS') || sql.toUpperCase().includes('FROM ORDER_ITEMS')) {
        return Promise.resolve(mockData.order_items);
      } else if (sql.toUpperCase().includes('FROM USERS') || sql.toUpperCase().includes('FROM USERS')) {
        return Promise.resolve(mockData.users);
      } else if (sql.toUpperCase().includes('FROM ADDRESSES') || sql.toUpperCase().includes('FROM ADDRESSES')) {
        return Promise.resolve(mockData.addresses);
      } else if (sql.toUpperCase().includes('FROM DELIVERY_PERSONS') || sql.toUpperCase().includes('FROM DELIVERY_PERSONS')) {
        return Promise.resolve(mockData.delivery_persons);
      } else if (sql.toUpperCase().includes('FROM DELIVERY_SETTINGS') || sql.toUpperCase().includes('FROM DELIVERY_SETTINGS')) {
        return Promise.resolve(mockData.delivery_settings);
      } else if (sql.toUpperCase().includes('FROM CART_ITEMS') || sql.toUpperCase().includes('FROM CART_ITEMS')) {
        return Promise.resolve(mockData.cart_items);
      } else if (sql.toUpperCase().includes('FROM REVIEWS') || sql.toUpperCase().includes('FROM REVIEWS')) {
        return Promise.resolve(mockData.reviews);
      } else if (sql.toUpperCase().includes('FROM CATEGORIES') || sql.toUpperCase().includes('FROM CATEGORIES')) {
        return Promise.resolve(mockData.categories);
      } else if (sql.toUpperCase().includes('FROM PROMOTIONS') || sql.toUpperCase().includes('FROM PROMOTIONS')) {
        return Promise.resolve(mockData.promotions);
      } else if (sql.toUpperCase().includes('FROM COUPONS') || sql.toUpperCase().includes('FROM COUPONS')) {
        return Promise.resolve(mockData.coupons);
      } else if (sql.toUpperCase().includes('FROM PAYMENTS') || sql.toUpperCase().includes('FROM PAYMENTS')) {
        return Promise.resolve(mockData.payments);
      } else if (sql.toUpperCase().includes('FROM NOTIFICATIONS') || sql.toUpperCase().includes('FROM NOTIFICATIONS')) {
        return Promise.resolve(mockData.notifications);
      } else if (sql.toUpperCase().includes('FROM DELIVERY_ASSIGNMENTS') || sql.toUpperCase().includes('FROM DELIVERY_ASSIGNMENTS')) {
        return Promise.resolve(mockData.delivery_assignments);
      } else if (sql.toUpperCase().includes('FROM DELIVERY_LOCATIONS') || sql.toUpperCase().includes('FROM DELIVERY_LOCATIONS')) {
        return Promise.resolve(mockData.delivery_locations);
      } else if (sql.toUpperCase().includes('FROM APP_SETTINGS') || sql.toUpperCase().includes('FROM APP_SETTINGS')) {
        return Promise.resolve(mockData.app_settings);
      } else if (sql.toUpperCase().includes('FROM SETTINGS') || sql.toUpperCase().includes('FROM SETTINGS')) {
        return Promise.resolve(mockData.settings);
      } else if (sql.toUpperCase().includes('FROM PROFILES') || sql.toUpperCase().includes('FROM PROFILES')) {
        return Promise.resolve(mockData.profiles);
      } else if (sql.toUpperCase().includes('FROM FEEDBACK') || sql.toUpperCase().includes('FROM FEEDBACK')) {
        return Promise.resolve(mockData.feedback);
      } else if (sql.toUpperCase().includes('FROM ADMINS') || sql.toUpperCase().includes('FROM ADMINS')) {
        return Promise.resolve(mockData.admins);
      } else if (sql.toUpperCase().includes('FROM ADVERTISEMENTS') || sql.toUpperCase().includes('FROM ADVERTISEMENTS')) {
        return Promise.resolve(mockData.advertisements);
      } else {
        // For other queries, return empty array
        return Promise.resolve([]);
      }
    },
    withTransactionAsync: async (callback) => {
      // Mock transaction - just call the callback
      return await callback();
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
              // Handle PRAGMA table_info queries for schema verification
              if (sql.toUpperCase().includes('PRAGMA TABLE_INFO')) {
                const tableNameMatch = sql.match(/table_info\(([^)]+)\)/i);
                if (tableNameMatch) {
                  const tableName = tableNameMatch[1].replace(/['"]/g, '');
                  
                  // Define the expected columns for each table
                  let results = [];
                  switch(tableName.toLowerCase()) {
                    case 'restaurants':
                      results = [
                        { cid: 0, name: 'id', type: 'TEXT', notnull: 1, dflt_value: null, pk: 1 },
                        { cid: 1, name: 'name', type: 'TEXT', notnull: 1, dflt_value: null, pk: 0 },
                        { cid: 2, name: 'address', type: 'TEXT', notnull: 0, dflt_value: null, pk: 0 },
                        { cid: 3, name: 'rating', type: 'REAL', notnull: 0, dflt_value: null, pk: 0 },
                        { cid: 4, name: 'image_url', type: 'TEXT', notnull: 0, dflt_value: null, pk: 0 },
                        { cid: 5, name: 'delivery_fee', type: 'REAL', notnull: 0, dflt_value: null, pk: 0 },
                        { cid: 6, name: 'min_order_amount', type: 'REAL', notnull: 0, dflt_value: null, pk: 0 },
                        { cid: 7, name: 'estimated_delivery_time', type: 'INTEGER', notnull: 0, dflt_value: null, pk: 0 },
                        { cid: 8, name: 'is_active', type: 'INTEGER', notnull: 0, dflt_value: '1', pk: 0 },
                        { cid: 9, name: 'is_available', type: 'INTEGER', notnull: 0, dflt_value: '1', pk: 0 },
                        { cid: 10, name: 'description', type: 'TEXT', notnull: 0, dflt_value: null, pk: 0 },
                        { cid: 11, name: 'phone', type: 'TEXT', notnull: 0, dflt_value: null, pk: 0 },
                        { cid: 12, name: 'email', type: 'TEXT', notnull: 0, dflt_value: null, pk: 0 },
                        { cid: 13, name: 'cuisine_type', type: 'TEXT', notnull: 0, dflt_value: null, pk: 0 },
                        { cid: 14, name: 'logo_url', type: 'TEXT', notnull: 0, dflt_value: null, pk: 0 },
                        { cid: 15, name: 'cover_image_url', type: 'TEXT', notnull: 0, dflt_value: null, pk: 0 },
                        { cid: 16, name: 'created_at', type: 'TEXT', notnull: 0, dflt_value: "(datetime('now'))", pk: 0 },
                        { cid: 17, name: 'updated_at', type: 'TEXT', notnull: 0, dflt_value: "(datetime('now'))", pk: 0 },
                        { cid: 18, name: 'latitude', type: 'REAL', notnull: 0, dflt_value: null, pk: 0 },
                        { cid: 19, name: 'longitude', type: 'REAL', notnull: 0, dflt_value: null, pk: 0 },
                        { cid: 20, name: 'coordinates_geocoded', type: 'INTEGER', notnull: 0, dflt_value: '0', pk: 0 },
                        { cid: 21, name: 'opening_time', type: 'TEXT', notnull: 0, dflt_value: '09:00:00', pk: 0 },
                        { cid: 22, name: 'closing_time', type: 'TEXT', notnull: 0, dflt_value: '21:00:00', pk: 0 },
                        { cid: 23, name: 'average_rating', type: 'REAL', notnull: 0, dflt_value: '0.0', pk: 0 },
                        { cid: 24, name: 'total_reviews', type: 'INTEGER', notnull: 0, dflt_value: '0', pk: 0 },
                        { cid: 25, name: 'contact_phone', type: 'TEXT', notnull: 0, dflt_value: null, pk: 0 },
                        { cid: 26, name: 'contact_email', type: 'TEXT', notnull: 0, dflt_value: null, pk: 0 },
                        { cid: 27, name: 'website_url', type: 'TEXT', notnull: 0, dflt_value: null, pk: 0 },
                        { cid: 28, name: 'seating_capacity', type: 'INTEGER', notnull: 0, dflt_value: null, pk: 0 },
                        { cid: 29, name: 'parking_availability', type: 'INTEGER', notnull: 0, dflt_value: '0', pk: 0 },
                        { cid: 30, name: 'delivery_radius', type: 'REAL', notnull: 0, dflt_value: null, pk: 0 },
                        { cid: 31, name: 'minimum_order_value', type: 'REAL', notnull: 0, dflt_value: '0.0', pk: 0 },
                        { cid: 32, name: 'estimated_preparation_time', type: 'INTEGER', notnull: 0, dflt_value: null, pk: 0 },
                        { cid: 33, name: 'last_updated', type: 'TEXT', notnull: 0, dflt_value: "(datetime('now'))", pk: 0 },
                        { cid: 34, name: 'owner_id', type: 'TEXT', notnull: 0, dflt_value: null, pk: 0 }
                      ];
                      break;
                    case 'menu_items':
                      results = [
                        { cid: 0, name: 'id', type: 'TEXT', notnull: 1, dflt_value: null, pk: 1 },
                        { cid: 1, name: 'restaurant_id', type: 'TEXT', notnull: 0, dflt_value: null, pk: 0 },
                        { cid: 2, name: 'menu_category_id', type: 'TEXT', notnull: 0, dflt_value: null, pk: 0 },
                        { cid: 3, name: 'name', type: 'TEXT', notnull: 1, dflt_value: null, pk: 0 },
                        { cid: 4, name: 'description', type: 'TEXT', notnull: 0, dflt_value: null, pk: 0 },
                        { cid: 5, name: 'price', type: 'REAL', notnull: 1, dflt_value: null, pk: 0 },
                        { cid: 6, name: 'image_url', type: 'TEXT', notnull: 0, dflt_value: null, pk: 0 },
                        { cid: 7, name: 'is_available', type: 'INTEGER', notnull: 0, dflt_value: '1', pk: 0 },
                        { cid: 8, name: 'preparation_time', type: 'INTEGER', notnull: 0, dflt_value: null, pk: 0 },
                        { cid: 9, name: 'dietary_restrictions', type: 'TEXT', notnull: 0, dflt_value: null, pk: 0 },
                        { cid: 10, name: 'created_at', type: 'TEXT', notnull: 0, dflt_value: "(datetime('now'))", pk: 0 },
                        { cid: 11, name: 'updated_at', type: 'TEXT', notnull: 0, dflt_value: "(datetime('now'))", pk: 0 }
                      ];
                      break;
                    case 'menu_categories':
                      results = [
                        { cid: 0, name: 'id', type: 'TEXT', notnull: 1, dflt_value: null, pk: 1 },
                        { cid: 1, name: 'restaurant_id', type: 'TEXT', notnull: 1, dflt_value: null, pk: 0 },
                        { cid: 2, name: 'name', type: 'TEXT', notnull: 1, dflt_value: null, pk: 0 },
                        { cid: 3, name: 'description', type: 'TEXT', notnull: 0, dflt_value: null, pk: 0 },
                        { cid: 4, name: 'image_url', type: 'TEXT', notnull: 0, dflt_value: null, pk: 0 },
                        { cid: 5, name: 'sort_order', type: 'INTEGER', notnull: 0, dflt_value: '0', pk: 0 },
                        { cid: 6, name: 'is_active', type: 'INTEGER', notnull: 0, dflt_value: '1', pk: 0 },
                        { cid: 7, name: 'created_at', type: 'TEXT', notnull: 0, dflt_value: "(datetime('now'))", pk: 0 },
                        { cid: 8, name: 'updated_at', type: 'TEXT', notnull: 0, dflt_value: "(datetime('now'))", pk: 0 }
                      ];
                      break;
                    case 'app_settings':
                      results = [
                        { cid: 0, name: 'id', type: 'TEXT', notnull: 1, dflt_value: "'app-settings'", pk: 1 },
                        { cid: 1, name: 'delivery_cost_per_km', type: 'REAL', notnull: 0, dflt_value: '2.50', pk: 0 },
                        { cid: 2, name: 'minimum_delivery_cost', type: 'REAL', notnull: 0, dflt_value: '5.00', pk: 0 },
                        { cid: 3, name: 'is_delivery_enabled', type: 'INTEGER', notnull: 0, dflt_value: '1', pk: 0 },
                        { cid: 4, name: 'base_delivery_fee', type: 'REAL', notnull: 0, dflt_value: '3.00', pk: 0 },
                        { cid: 5, name: 'max_free_delivery_distance', type: 'REAL', notnull: 0, dflt_value: '2.00', pk: 0 },
                        { cid: 6, name: 'additional_fee_per_km_after_free', type: 'REAL', notnull: 0, dflt_value: '1.50', pk: 0 },
                        { cid: 7, name: 'created_at', type: 'TEXT', notnull: 0, dflt_value: "(datetime('now'))", pk: 0 },
                        { cid: 8, name: 'updated_at', type: 'TEXT', notnull: 0, dflt_value: "(datetime('now'))", pk: 0 },
                        { cid: 9, name: 'manager_number', type: 'TEXT', notnull: 0, dflt_value: null, pk: 0 }
                      ];
                      break;
                    default:
                      results = [];
                  }

                  if (successCallback) {
                    successCallback({ rows: { _array: results, length: results.length } });
                  }
                  return;
                }
              }
              
              // Handle PRAGMA table list query for schema verification
              if (sql.toUpperCase().includes("SELECT NAME FROM SQLITE_MASTER WHERE TYPE='TABLE'")) {
                const results = [
                  { name: 'restaurants' },
                  { name: 'menu_items' },
                  { name: 'menu_categories' },
                  { name: 'app_settings' },
                  { name: 'users' },
                  { name: 'addresses' },
                  { name: 'orders' },
                  { name: 'order_items' },
                  { name: 'delivery_persons' },
                  { name: 'delivery_assignments' },
                  { name: 'delivery_statistics' },
                  { name: 'reviews' },
                  { name: 'notifications' },
                  { name: 'feedback' },
                  { name: 'admins' },
                  { name: 'advertisements' },
                  { name: 'settings' },
                  { name: 'profiles' },
                  { name: 'payments' },
                  { name: 'cart_items' },
                  { name: 'carts' }
                ];

                if (successCallback) {
                  successCallback({ rows: { _array: results, length: results.length } });
                }
                return;
              }

              // Mock select operation - delegate to getAllAsync logic
              let results = [];

              // Determine which table to query based on the SQL
              if (sql.toUpperCase().includes('FROM RESTAURANTS') || sql.toUpperCase().includes('FROM RESTAURANTS')) {
                results = mockData.restaurants;
              } else if (sql.toUpperCase().includes('FROM MENU_ITEMS') || sql.toUpperCase().includes('FROM MENU_ITEMS')) {
                results = mockData.menu_items;
              } else if (sql.toUpperCase().includes('FROM ORDERS') || sql.toUpperCase().includes('FROM ORDERS')) {
                results = mockData.orders;
              } else if (sql.toUpperCase().includes('FROM ORDER_ITEMS') || sql.toUpperCase().includes('FROM ORDER_ITEMS')) {
                results = mockData.order_items;
              } else if (sql.toUpperCase().includes('FROM USERS') || sql.toUpperCase().includes('FROM USERS')) {
                results = mockData.users;
              } else if (sql.toUpperCase().includes('FROM ADDRESSES') || sql.toUpperCase().includes('FROM ADDRESSES')) {
                results = mockData.addresses;
              } else if (sql.toUpperCase().includes('FROM DELIVERY_PERSONS') || sql.toUpperCase().includes('FROM DELIVERY_PERSONS')) {
                results = mockData.delivery_persons;
              } else if (sql.toUpperCase().includes('FROM DELIVERY_SETTINGS') || sql.toUpperCase().includes('FROM DELIVERY_SETTINGS')) {
                results = mockData.delivery_settings;
              } else if (sql.toUpperCase().includes('FROM CART_ITEMS') || sql.toUpperCase().includes('FROM CART_ITEMS')) {
                results = mockData.cart_items;
              } else if (sql.toUpperCase().includes('FROM REVIEWS') || sql.toUpperCase().includes('FROM REVIEWS')) {
                results = mockData.reviews;
              } else if (sql.toUpperCase().includes('FROM CATEGORIES') || sql.toUpperCase().includes('FROM CATEGORIES')) {
                results = mockData.categories;
              } else if (sql.toUpperCase().includes('FROM PROMOTIONS') || sql.toUpperCase().includes('FROM PROMOTIONS')) {
                results = mockData.promotions;
              } else if (sql.toUpperCase().includes('FROM COUPONS') || sql.toUpperCase().includes('FROM COUPONS')) {
                results = mockData.coupons;
              } else if (sql.toUpperCase().includes('FROM PAYMENTS') || sql.toUpperCase().includes('FROM PAYMENTS')) {
                results = mockData.payments;
              } else if (sql.toUpperCase().includes('FROM NOTIFICATIONS') || sql.toUpperCase().includes('FROM NOTIFICATIONS')) {
                results = mockData.notifications;
              } else if (sql.toUpperCase().includes('FROM DELIVERY_ASSIGNMENTS') || sql.toUpperCase().includes('FROM DELIVERY_ASSIGNMENTS')) {
                results = mockData.delivery_assignments;
              } else if (sql.toUpperCase().includes('FROM DELIVERY_LOCATIONS') || sql.toUpperCase().includes('FROM DELIVERY_LOCATIONS')) {
                results = mockData.delivery_locations;
              } else if (sql.toUpperCase().includes('FROM APP_SETTINGS') || sql.toUpperCase().includes('FROM APP_SETTINGS')) {
                results = mockData.app_settings;
              } else if (sql.toUpperCase().includes('FROM SETTINGS') || sql.toUpperCase().includes('FROM SETTINGS')) {
                results = mockData.settings;
              } else if (sql.toUpperCase().includes('FROM PROFILES') || sql.toUpperCase().includes('FROM PROFILES')) {
                results = mockData.profiles;
              } else if (sql.toUpperCase().includes('FROM FEEDBACK') || sql.toUpperCase().includes('FROM FEEDBACK')) {
                results = mockData.feedback;
              } else if (sql.toUpperCase().includes('FROM ADMINS') || sql.toUpperCase().includes('FROM ADMINS')) {
                results = mockData.admins;
              } else if (sql.toUpperCase().includes('FROM ADVERTISEMENTS') || sql.toUpperCase().includes('FROM ADVERTISEMENTS')) {
                results = mockData.advertisements;
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
            // console.error('Mock database executeSql error:', executeError);
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