// Shared Database Schema for User App
// This file defines table constants and RxDB schemas used by both web and native platforms
// Schema is synchronized with Supabase database structure

// Table names - keep these in sync with Supabase
export const TABLES = {
  USERS: 'users',
  PROFILES: 'profiles',
  RESTAURANTS: 'restaurants',
  MENU_CATEGORIES: 'menu_categories',
  MENU_ITEMS: 'menu_items',
  ORDERS: 'orders',
  ORDER_ITEMS: 'order_items',
  CARTS: 'carts',
  CART_ITEMS: 'cart_items',
  ADDRESSES: 'addresses',
  REVIEWS: 'reviews',
  FEEDBACK: 'feedback',
  DELIVERY_PERSONS: 'delivery_persons',
  DELIVERY_ASSIGNMENTS: 'delivery_assignments',
  NOTIFICATIONS: 'notifications',
  ADVERTISEMENTS: 'advertisements',
  APP_SETTINGS: 'app_settings',
  PAYMENTS: 'payments',
  SETTINGS: 'settings',
  ADMINS: 'admins',
} as const;

// RxDB JSON Schema for Users
export const UserSchema = {
  version: 0,
  primaryKey: 'id',
  type: 'object',
  properties: {
    id: { type: 'string', maxLength: 100 },
    email: { type: 'string' },
    email_verified: { type: 'boolean' },
    name: { type: 'string' },
    image_url: { type: 'string' },
    role: { type: 'string' },
    is_active: { type: 'boolean' },
    phone: { type: 'string' },
    created_at: { type: 'string' },
    updated_at: { type: 'string' },
    deleted_at: { type: 'string' }
  },
  required: ['id', 'email']
};

// RxDB JSON Schema for Profiles
export const ProfileSchema = {
  version: 0,
  primaryKey: 'id',
  type: 'object',
  properties: {
    id: { type: 'string', maxLength: 100 },
    full_name: { type: 'string' },
    email: { type: 'string' },
    phone: { type: 'string' },
    role: { type: 'string' },
    image_url: { type: 'string' },
    avatar_url: { type: 'string' },
    name: { type: 'string' },
    created_at: { type: 'string' },
    updated_at: { type: 'string' },
    deleted_at: { type: 'string' }
  },
  required: ['id']
};

// RxDB JSON Schema for Restaurants
export const RestaurantSchema = {
  version: 0,
  primaryKey: 'id',
  type: 'object',
  properties: {
    id: { type: 'string', maxLength: 100 },
    owner_id: { type: 'string' },
    name: { type: 'string' },
    description: { type: 'string' },
    image_url: { type: 'string' },
    logo_url: { type: 'string' },
    cover_image_url: { type: 'string' },
    address: { type: 'string' },
    phone: { type: 'string' },
    contact_phone: { type: 'string' },
    email: { type: 'string' },
    contact_email: { type: 'string' },
    cuisine_type: { type: 'string' },
    rating: { type: 'number' },
    average_rating: { type: 'number' },
    total_reviews: { type: 'number' },
    delivery_fee: { type: 'number' },
    min_order_amount: { type: 'number' },
    minimum_order_value: { type: 'number' },
    estimated_delivery_time: { type: 'number' },
    estimated_preparation_time: { type: 'number' },
    is_active: { type: 'boolean' },
    is_available: { type: 'boolean' },
    latitude: { type: 'number' },
    longitude: { type: 'number' },
    coordinates_geocoded: { type: 'boolean' },
    opening_time: { type: 'string' },
    closing_time: { type: 'string' },
    website_url: { type: 'string' },
    delivery_radius: { type: 'number' },
    social_media_links: { type: 'object' },
    payment_methods: { type: 'object' },
    dietary_options: { type: 'object' },
    special_offers: { type: 'object' },
    created_at: { type: 'string' },
    updated_at: { type: 'string' },
    last_updated: { type: 'string' },
    deleted_at: { type: 'string' }
  },
  required: ['id', 'name']
};

// RxDB JSON Schema for Menu Categories
export const MenuCategorySchema = {
  version: 0,
  primaryKey: 'id',
  type: 'object',
  properties: {
    id: { type: 'string', maxLength: 100 },
    restaurant_id: { type: 'string' },
    name: { type: 'string' },
    description: { type: 'string' },
    image_url: { type: 'string' },
    sort_order: { type: 'number' },
    is_active: { type: 'boolean' },
    created_at: { type: 'string' },
    updated_at: { type: 'string' },
    deleted_at: { type: 'string' }
  },
  required: ['id', 'name']
};

// RxDB JSON Schema for Menu Items
export const MenuItemSchema = {
  version: 0,
  primaryKey: 'id',
  type: 'object',
  properties: {
    id: { type: 'string', maxLength: 100 },
    restaurant_id: { type: 'string' },
    menu_category_id: { type: 'string' },
    name: { type: 'string' },
    description: { type: 'string' },
    price: { type: 'number' },
    image_url: { type: 'string' },
    is_available: { type: 'boolean' },
    preparation_time: { type: 'number' },
    dietary_restrictions: { type: 'array', items: { type: 'string' } },
    created_at: { type: 'string' },
    updated_at: { type: 'string' },
    deleted_at: { type: 'string' }
  },
  required: ['id', 'name', 'price']
};

// RxDB JSON Schema for Orders
export const OrderSchema = {
  version: 0,
  primaryKey: 'id',
  type: 'object',
  properties: {
    id: { type: 'string', maxLength: 100 },
    user_id: { type: 'string' },
    restaurant_id: { type: 'string' },
    delivery_person_id: { type: 'string' },
    driver_id: { type: 'string' },
    status: { type: 'string' },
    total_amount: { type: 'number' },
    subtotal: { type: 'number' },
    delivery_cost: { type: 'number' },
    delivery_address: { type: 'string' },
    delivery_notes: { type: 'string' },
    delivery_lat: { type: 'number' },
    delivery_lng: { type: 'number' },
    restaurant_name: { type: 'string' },
    payment_method: { type: 'string' },
    payment_status: { type: 'string' },
    cancellation_reason: { type: 'string' },
    rejection_reason: { type: 'string' },
    estimated_delivery_time: { type: 'string' },
    actual_delivery_time: { type: 'string' },
    is_completed: { type: 'boolean' },
    completed_at: { type: 'string' },
    delivery_otp: { type: 'string' },
    delivery_otp_verified: { type: 'boolean' },
    created_at: { type: 'string' },
    updated_at: { type: 'string' },
    deleted_at: { type: 'string' }
  },
  required: ['id', 'total_amount', 'delivery_address']
};

// RxDB JSON Schema for Order Items
export const OrderItemSchema = {
  version: 0,
  primaryKey: 'id',
  type: 'object',
  properties: {
    id: { type: 'string', maxLength: 100 },
    order_id: { type: 'string' },
    menu_item_id: { type: 'string' },
    quantity: { type: 'number' },
    price: { type: 'number' },
    special_instructions: { type: 'string' },
    created_at: { type: 'string' },
    deleted_at: { type: 'string' }
  },
  required: ['id', 'order_id', 'menu_item_id', 'quantity', 'price']
};

// RxDB JSON Schema for Carts
export const CartSchema = {
  version: 0,
  primaryKey: 'id',
  type: 'object',
  properties: {
    id: { type: 'string', maxLength: 100 },
    user_id: { type: 'string' },
    restaurant_id: { type: 'string' },
    quantity: { type: 'number' },
    deleted_at: { type: 'string' }
  },
  required: ['id', 'user_id']
};

// RxDB JSON Schema for Cart Items
export const CartItemSchema = {
  version: 0,
  primaryKey: 'id',
  type: 'object',
  properties: {
    id: { type: 'string', maxLength: 100 },
    cart_id: { type: 'string' },
    menu_item_id: { type: 'string' },
    quantity: { type: 'number' },
    price: { type: 'number' },
    created_at: { type: 'string' },
    updated_at: { type: 'string' },
    deleted_at: { type: 'string' }
  },
  required: ['id', 'cart_id', 'menu_item_id', 'price']
};

// RxDB JSON Schema for Addresses
export const AddressSchema = {
  version: 0,
  primaryKey: 'id',
  type: 'object',
  properties: {
    id: { type: 'string', maxLength: 100 },
    user_id: { type: 'string' },
    street_address: { type: 'string' },
    city: { type: 'string' },
    is_default: { type: 'boolean' },
    created_at: { type: 'string' },
    deleted_at: { type: 'string' }
  },
  required: ['id', 'user_id']
};

// RxDB JSON Schema for Reviews
export const ReviewSchema = {
  version: 0,
  primaryKey: 'id',
  type: 'object',
  properties: {
    id: { type: 'string', maxLength: 100 },
    user_id: { type: 'string' },
    restaurant_id: { type: 'string' },
    rating: { type: 'number' },
    comment: { type: 'string' },
    deleted_at: { type: 'string' }
  },
  required: ['id', 'user_id', 'rating']
};

// RxDB JSON Schema for Feedback
export const FeedbackSchema = {
  version: 0,
  primaryKey: 'id',
  type: 'object',
  properties: {
    id: { type: 'string', maxLength: 100 },
    user_id: { type: 'string' },
    title: { type: 'string' },
    comment: { type: 'string' },
    rating: { type: 'number' },
    is_resolved: { type: 'boolean' },
    created_at: { type: 'string' },
    updated_at: { type: 'string' },
    deleted_at: { type: 'string' }
  },
  required: ['id', 'title']
};

// RxDB JSON Schema for Delivery Persons
export const DeliveryPersonSchema = {
  version: 0,
  primaryKey: 'id',
  type: 'object',
  properties: {
    id: { type: 'string', maxLength: 100 },
    user_id: { type: 'string' },
    name: { type: 'string' },
    email: { type: 'string' },
    phone: { type: 'string' },
    vehicle_type: { type: 'string' },
    license_plate: { type: 'string' },
    is_available: { type: 'boolean' },
    current_location: { type: 'object' },
    current_latitude: { type: 'number' },
    current_longitude: { type: 'number' },
    rating: { type: 'number' },
    total_deliveries: { type: 'number' },
    address: { type: 'string' },
    created_at: { type: 'string' },
    updated_at: { type: 'string' },
    deleted_at: { type: 'string' }
  },
  required: ['id']
};

// RxDB JSON Schema for Delivery Assignments
export const DeliveryAssignmentSchema = {
  version: 0,
  primaryKey: 'id',
  type: 'object',
  properties: {
    id: { type: 'string', maxLength: 100 },
    order_id: { type: 'string' },
    delivery_person_id: { type: 'string' },
    delivery_address: { type: 'string' },
    notes: { type: 'string' },
    phone_number: { type: 'string' },
    status: { type: 'string' },
    assigned_at: { type: 'string' },
    accepted_at: { type: 'string' },
    picked_up_at: { type: 'string' },
    delivered_at: { type: 'string' },
    deleted_at: { type: 'string' }
  },
  required: ['id', 'status']
};

// RxDB JSON Schema for Notifications
export const NotificationSchema = {
  version: 0,
  primaryKey: 'id',
  type: 'object',
  properties: {
    id: { type: 'string', maxLength: 100 },
    user_id: { type: 'string' },
    title: { type: 'string' },
    message: { type: 'string' },
    type: { type: 'string' },
    is_read: { type: 'boolean' },
    created_at: { type: 'string' },
    deleted_at: { type: 'string' }
  },
  required: ['id', 'title', 'message']
};

// RxDB JSON Schema for App Settings
export const AppSettingSchema = {
  version: 0,
  primaryKey: 'id',
  type: 'object',
  properties: {
    id: { type: 'string', maxLength: 100 },
    delivery_cost_per_km: { type: 'number' },
    minimum_delivery_cost: { type: 'number' },
    is_delivery_enabled: { type: 'boolean' },
    base_delivery_fee: { type: 'number' },
    max_free_delivery_distance: { type: 'number' },
    additional_fee_per_km_after_free: { type: 'number' },
    manager_number: { type: 'string' },
    admin_phone: { type: 'string' },
    created_at: { type: 'string' },
    updated_at: { type: 'string' },
    deleted_at: { type: 'string' }
  },
  required: ['id']
};

// SQLite table creation SQL (for native platform) - matches Supabase schema with base64 image storage
export const SQLITE_SCHEMA = `
  PRAGMA journal_mode = WAL;

  -- Users table
  CREATE TABLE IF NOT EXISTS ${TABLES.USERS} (
    id TEXT PRIMARY KEY NOT NULL,
    email TEXT NOT NULL UNIQUE,
    email_verified INTEGER DEFAULT 0,
    name TEXT,
    image_url TEXT,
    image_base64 TEXT,
    role TEXT DEFAULT 'USER',
    is_active INTEGER DEFAULT 1,
    phone TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
    deleted_at TEXT
  );

  -- Profiles table
  CREATE TABLE IF NOT EXISTS ${TABLES.PROFILES} (
    id TEXT PRIMARY KEY NOT NULL,
    full_name TEXT,
    email TEXT,
    phone TEXT,
    role TEXT DEFAULT 'customer',
    image_url TEXT,
    image_base64 TEXT,
    avatar_url TEXT,
    name TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
    deleted_at TEXT
  );

  -- Restaurants table (with base64 image storage for offline support)
  CREATE TABLE IF NOT EXISTS ${TABLES.RESTAURANTS} (
    id TEXT PRIMARY KEY NOT NULL,
    owner_id TEXT,
    name TEXT NOT NULL,
    description TEXT,
    image_url TEXT,
    image_base64 TEXT,
    logo_url TEXT,
    logo_base64 TEXT,
    cover_image_url TEXT,
    cover_image_base64 TEXT,
    address TEXT,
    phone TEXT,
    contact_phone TEXT,
    email TEXT,
    contact_email TEXT,
    cuisine_type TEXT,
    rating REAL,
    average_rating REAL DEFAULT 0.0,
    total_reviews INTEGER DEFAULT 0,
    delivery_fee REAL,
    min_order_amount REAL,
    minimum_order_value REAL DEFAULT 0.0,
    estimated_delivery_time INTEGER,
    estimated_preparation_time INTEGER,
    is_active INTEGER DEFAULT 1,
    is_available INTEGER DEFAULT 1,
    latitude REAL,
    longitude REAL,
    coordinates_geocoded INTEGER DEFAULT 0,
    opening_time TEXT DEFAULT '09:00:00',
    closing_time TEXT DEFAULT '21:00:00',
    website_url TEXT,
    delivery_radius REAL,
    social_media_links TEXT,
    payment_methods TEXT,
    dietary_options TEXT,
    special_offers TEXT,
    seating_capacity INTEGER,
    parking_availability INTEGER DEFAULT 0,
    peak_hours_start TEXT,
    peak_hours_end TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
    last_updated TEXT DEFAULT CURRENT_TIMESTAMP,
    deleted_at TEXT
  );

  -- Menu Categories table (with base64 image storage)
  CREATE TABLE IF NOT EXISTS ${TABLES.MENU_CATEGORIES} (
    id TEXT PRIMARY KEY NOT NULL,
    restaurant_id TEXT,
    name TEXT NOT NULL,
    description TEXT,
    image_url TEXT,
    image_base64 TEXT,
    sort_order INTEGER DEFAULT 0,
    is_active INTEGER DEFAULT 1,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
    deleted_at TEXT
  );

  -- Menu Items table (with base64 image storage)
  CREATE TABLE IF NOT EXISTS ${TABLES.MENU_ITEMS} (
    id TEXT PRIMARY KEY NOT NULL,
    restaurant_id TEXT,
    menu_category_id TEXT,
    name TEXT NOT NULL,
    description TEXT,
    price REAL NOT NULL,
    image_url TEXT,
    image_base64 TEXT,
    is_available INTEGER DEFAULT 1,
    preparation_time INTEGER,
    dietary_restrictions TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
    deleted_at TEXT
  );

  -- Orders table
  CREATE TABLE IF NOT EXISTS ${TABLES.ORDERS} (
    id TEXT PRIMARY KEY NOT NULL,
    user_id TEXT,
    restaurant_id TEXT,
    delivery_person_id TEXT,
    driver_id TEXT,
    status TEXT DEFAULT 'pending',
    total_amount REAL NOT NULL,
    subtotal REAL,
    delivery_cost REAL DEFAULT 0.00,
    delivery_address TEXT NOT NULL,
    delivery_notes TEXT,
    delivery_lat REAL,
    delivery_lng REAL,
    restaurant_name TEXT,
    payment_method TEXT,
    payment_status TEXT DEFAULT 'pending',
    cancellation_reason TEXT,
    rejection_reason TEXT,
    estimated_delivery_time TEXT,
    actual_delivery_time TEXT,
    is_completed INTEGER DEFAULT 0,
    completed_at TEXT,
    delivery_otp TEXT,
    delivery_otp_verified INTEGER DEFAULT 0,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
    deleted_at TEXT
  );

  -- Order Items table
  CREATE TABLE IF NOT EXISTS ${TABLES.ORDER_ITEMS} (
    id TEXT PRIMARY KEY NOT NULL,
    order_id TEXT,
    menu_item_id TEXT,
    quantity INTEGER NOT NULL DEFAULT 1,
    price REAL NOT NULL,
    menu_item_name TEXT,
    menu_item_image_url TEXT,
    special_instructions TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
    deleted_at TEXT
  );

  -- Carts table
  CREATE TABLE IF NOT EXISTS ${TABLES.CARTS} (
    id TEXT PRIMARY KEY NOT NULL,
    user_id TEXT NOT NULL,
    restaurant_id TEXT,
    quantity INTEGER DEFAULT 1,
    deleted_at TEXT
  );

  -- Cart Items table
  CREATE TABLE IF NOT EXISTS ${TABLES.CART_ITEMS} (
    id TEXT PRIMARY KEY NOT NULL,
    cart_id TEXT NOT NULL,
    menu_item_id TEXT NOT NULL,
    quantity INTEGER DEFAULT 1,
    price REAL NOT NULL,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
    deleted_at TEXT
  );

  -- Addresses table
  CREATE TABLE IF NOT EXISTS ${TABLES.ADDRESSES} (
    id TEXT PRIMARY KEY NOT NULL,
    user_id TEXT NOT NULL,
    street_address TEXT,
    city TEXT,
    is_default INTEGER DEFAULT 0,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    deleted_at TEXT
  );

  -- Reviews table
  CREATE TABLE IF NOT EXISTS ${TABLES.REVIEWS} (
    id TEXT PRIMARY KEY NOT NULL,
    user_id TEXT NOT NULL,
    restaurant_id TEXT,
    rating INTEGER CHECK (rating >= 1 AND rating <= 5),
    comment TEXT,
    deleted_at TEXT
  );

  -- Feedback table
  CREATE TABLE IF NOT EXISTS ${TABLES.FEEDBACK} (
    id TEXT PRIMARY KEY NOT NULL,
    user_id TEXT,
    title TEXT NOT NULL,
    comment TEXT,
    rating INTEGER CHECK (rating >= 1 AND rating <= 5),
    is_resolved INTEGER DEFAULT 0,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
    deleted_at TEXT
  );

  -- Delivery Persons table
  CREATE TABLE IF NOT EXISTS ${TABLES.DELIVERY_PERSONS} (
    id TEXT PRIMARY KEY NOT NULL,
    user_id TEXT,
    name TEXT,
    email TEXT,
    phone TEXT,
    vehicle_type TEXT,
    license_plate TEXT,
    is_available INTEGER DEFAULT 1,
    current_location TEXT,
    current_latitude REAL,
    current_longitude REAL,
    rating REAL,
    total_deliveries INTEGER DEFAULT 0,
    address TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
    deleted_at TEXT
  );

  -- Delivery Assignments table
  CREATE TABLE IF NOT EXISTS ${TABLES.DELIVERY_ASSIGNMENTS} (
    id TEXT PRIMARY KEY NOT NULL,
    order_id TEXT,
    delivery_person_id TEXT,
    delivery_address TEXT,
    notes TEXT,
    phone_number TEXT,
    status TEXT DEFAULT 'pending',
    assigned_at TEXT DEFAULT CURRENT_TIMESTAMP,
    accepted_at TEXT,
    picked_up_at TEXT,
    delivered_at TEXT,
    deleted_at TEXT
  );

  -- Notifications table
  CREATE TABLE IF NOT EXISTS ${TABLES.NOTIFICATIONS} (
    id TEXT PRIMARY KEY NOT NULL,
    user_id TEXT,
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    type TEXT DEFAULT 'info',
    is_read INTEGER DEFAULT 0,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    deleted_at TEXT
  );

  -- App Settings table
  CREATE TABLE IF NOT EXISTS ${TABLES.APP_SETTINGS} (
    id TEXT PRIMARY KEY NOT NULL DEFAULT 'app-settings',
    delivery_cost_per_km REAL DEFAULT 2.50,
    minimum_delivery_cost REAL DEFAULT 5.00,
    is_delivery_enabled INTEGER DEFAULT 1,
    base_delivery_fee REAL DEFAULT 3.00,
    max_free_delivery_distance REAL DEFAULT 2.00,
    additional_fee_per_km_after_free REAL DEFAULT 1.50,
    manager_number TEXT,
    admin_phone TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
    deleted_at TEXT
  );

  -- Sync log table for tracking sync timestamps
  CREATE TABLE IF NOT EXISTS sync_log (
    table_name TEXT PRIMARY KEY,
    sync_timestamp TEXT
  );

  -- Schema version table for tracking database migrations
  CREATE TABLE IF NOT EXISTS schema_version (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    version INTEGER NOT NULL
  );

  -- Indexes for better performance
  CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
  CREATE INDEX IF NOT EXISTS idx_restaurants_owner ON restaurants(owner_id);
  CREATE INDEX IF NOT EXISTS idx_restaurants_active ON restaurants(is_active);
  CREATE INDEX IF NOT EXISTS idx_restaurants_rating ON restaurants(rating DESC);
  CREATE INDEX IF NOT EXISTS idx_menu_items_restaurant ON menu_items(restaurant_id);
  CREATE INDEX IF NOT EXISTS idx_menu_items_category ON menu_items(menu_category_id);
  CREATE INDEX IF NOT EXISTS idx_orders_user ON orders(user_id);
  CREATE INDEX IF NOT EXISTS idx_orders_restaurant ON orders(restaurant_id);
  CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
  CREATE INDEX IF NOT EXISTS idx_order_items_order ON order_items(order_id);
  CREATE INDEX IF NOT EXISTS idx_cart_items_cart ON cart_items(cart_id);
  CREATE INDEX IF NOT EXISTS idx_addresses_user ON addresses(user_id);
  CREATE INDEX IF NOT EXISTS idx_reviews_restaurant ON reviews(restaurant_id);
  CREATE INDEX IF NOT EXISTS idx_delivery_assignments_order ON delivery_assignments(order_id);
  CREATE INDEX IF NOT EXISTS idx_delivery_assignments_person ON delivery_assignments(delivery_person_id);
`;
