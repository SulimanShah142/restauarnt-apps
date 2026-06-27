// Shared Database Schema for Deliver App
// This file defines table constants and RxDB schemas used by both web and native platforms
// Schema is synchronized with Supabase database structure

// Table names - keep these in sync with Supabase
export const TABLES = {
  USERS: 'users',
  PROFILES: 'profiles',
  ORDERS: 'orders',
  ORDER_ITEMS: 'order_items',
  DELIVERY_PERSONS: 'delivery_persons',
  DELIVERY_ASSIGNMENTS: 'delivery_assignments',
  DELIVERY_STATISTICS: 'delivery_statistics',
  RESTAURANTS: 'restaurants',
  NOTIFICATIONS: 'notifications',
  LOCATION_TRACKING: 'location_tracking',
  CARTS: 'carts',
  CART_ITEMS: 'cart_items',
  REVIEWS: 'reviews',
  FEEDBACK: 'feedback',
  ADDRESSES: 'addresses',
  MENU_ITEMS: 'menu_items',
  MENU_CATEGORIES: 'menu_categories',
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

// RxDB JSON Schema for Delivery Statistics
export const DeliveryStatisticSchema = {
  version: 0,
  primaryKey: 'id',
  type: 'object',
  properties: {
    id: { type: 'string', maxLength: 100 },
    delivery_person_id: { type: 'string' },
    order_id: { type: 'string' },
    order_total_amount: { type: 'number' },
    delivery_fee: { type: 'number' },
    delivery_status: { type: 'string' },
    created_at: { type: 'string' }
  },
  required: ['id', 'delivery_person_id', 'order_id', 'order_total_amount', 'delivery_fee']
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
    address: { type: 'string' },
    phone: { type: 'string' },
    email: { type: 'string' },
    latitude: { type: 'number' },
    longitude: { type: 'number' },
    is_active: { type: 'boolean' },
    is_available: { type: 'boolean' },
    created_at: { type: 'string' },
    updated_at: { type: 'string' },
    deleted_at: { type: 'string' }
  },
  required: ['id', 'name']
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

// RxDB JSON Schema for Location Tracking
export const LocationTrackingSchema = {
  version: 0,
  primaryKey: 'id',
  type: 'object',
  properties: {
    id: { type: 'string', maxLength: 100 },
    delivery_person_id: { type: 'string' },
    order_id: { type: 'string' },
    latitude: { type: 'number' },
    longitude: { type: 'number' },
    accuracy: { type: 'number' },
    timestamp: { type: 'string' },
    created_at: { type: 'string' }
  },
  required: ['id', 'delivery_person_id', 'order_id', 'latitude', 'longitude']
};

// SQLite table creation SQL (for native platform) - matches Supabase schema
export const SQLITE_SCHEMA = `
  PRAGMA journal_mode = WAL;

  -- Users table
  CREATE TABLE IF NOT EXISTS ${TABLES.USERS} (
    id TEXT PRIMARY KEY NOT NULL,
    email TEXT NOT NULL UNIQUE,
    email_verified INTEGER DEFAULT 0,
    name TEXT,
    image_url TEXT,
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
    special_instructions TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    deleted_at TEXT
  );

  -- Delivery Persons table (with base64 image storage)
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
    image_url TEXT,
    image_base64 TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
    deleted_at TEXT
  );

  -- Delivery Assignments table
  CREATE TABLE IF NOT EXISTS ${TABLES.DELIVERY_ASSIGNMENTS} (
    id TEXT PRIMARY KEY NOT NULL,
    order_id TEXT,
    delivery_person_id TEXT,
    user_id TEXT,
    restaurant_id TEXT,
    status TEXT DEFAULT 'assigned',
    total_amount REAL DEFAULT 0,
    delivery_address TEXT,
    delivery_notes TEXT,
    notes TEXT,
    phone_number TEXT,
    assigned_at TEXT DEFAULT CURRENT_TIMESTAMP,
    accepted_at TEXT,
    picked_up_at TEXT,
    delivered_at TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
    deleted_at TEXT
  );

  -- Delivery Statistics table
  CREATE TABLE IF NOT EXISTS ${TABLES.DELIVERY_STATISTICS} (
    id TEXT PRIMARY KEY NOT NULL,
    delivery_person_id TEXT NOT NULL,
    order_id TEXT NOT NULL,
    order_total_amount REAL NOT NULL,
    delivery_fee REAL NOT NULL,
    delivery_status TEXT DEFAULT 'delivered',
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
  );

  -- Restaurants table (with base64 image storage)
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

  -- Location Tracking table
  CREATE TABLE IF NOT EXISTS ${TABLES.LOCATION_TRACKING} (
    id TEXT PRIMARY KEY NOT NULL,
    delivery_person_id TEXT NOT NULL,
    order_id TEXT NOT NULL,
    latitude REAL NOT NULL,
    longitude REAL NOT NULL,
    accuracy REAL,
    timestamp TEXT DEFAULT CURRENT_TIMESTAMP,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
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
  CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
  CREATE INDEX IF NOT EXISTS idx_orders_delivery_person ON orders(delivery_person_id);
  CREATE INDEX IF NOT EXISTS idx_delivery_assignments_status ON delivery_assignments(status);
  CREATE INDEX IF NOT EXISTS idx_delivery_assignments_order ON delivery_assignments(order_id);
  CREATE INDEX IF NOT EXISTS idx_delivery_persons_available ON delivery_persons(is_available);
  CREATE INDEX IF NOT EXISTS idx_location_tracking_delivery_person ON location_tracking(delivery_person_id);
  CREATE INDEX IF NOT EXISTS idx_location_tracking_order ON location_tracking(order_id);
`;
