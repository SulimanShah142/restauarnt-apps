// Utility to reset the database when needed
import { getDatabase, initializeDatabase } from './db-init';

// Function to reset the database by deleting and recreating it
export async function resetDatabaseOnStartup() {
  // console.log('Checking if database reset is needed...');
  
  // Initialize the database first
  await initializeDatabase();
  
  const db = getDatabase();
  
  try {
    // Check if we need to reset by looking for missing columns
    const restaurantColumns = await db.getAllAsync(`
      SELECT name FROM pragma_table_info('restaurants')
    `);
    
    const columnNames = restaurantColumns.map(col => col.name);
    
    // Check if any of the new columns are missing
    const requiredColumns = ['description', 'phone', 'email', 'delivery_time', 'minimum_order', 'is_available', 'latitude', 'longitude', 'owner_id'];
    const missingColumns = requiredColumns.filter(col => !columnNames.includes(col));
    
    if (missingColumns.length > 0) {
      // console.log('Missing columns detected, resetting database:', missingColumns);
      
      // Drop and recreate tables with updated schema
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
      
      // console.log('Database tables dropped, will be recreated on next initialization');
      return true;
    } else {
      // console.log('Database schema is up to date');
      return false;
    }
  } catch (error) {
    // console.error('Error checking database schema:', error);
    // If there's an error checking the schema, assume we need to reset
    return true;
  }
}