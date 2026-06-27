// Test script to verify the database fix
import { initializeDatabase, getDatabase } from './lib/db-init.js';

async function testDatabaseInitialization() {
  // console.log('Testing database initialization...');
  
  try {
    // Initialize the database
    await initializeDatabase();
    // console.log('Database initialized successfully');
    
    const db = getDatabase();
    if (!db) {
      // console.error('Failed to get database instance');
      return;
    }
    
    // console.log('Database instance retrieved successfully');
    
    // Test basic operations
    // console.log('Testing basic database operations...');
    
    // Test getting all tables
    const tablesResult = await db.getAllAsync(`
      SELECT name FROM sqlite_master WHERE type='table'
    `);
    
    // console.log('Tables found:', tablesResult.map(t => t.name));
    
    // Test getting restaurants table info
    const restaurantColumns = await db.getAllAsync(`
      PRAGMA table_info(restaurants)
    `);
    
    // console.log('Restaurants table columns:', restaurantColumns.map(c => c.name));
    
    // console.log('All tests passed successfully!');
  } catch (error) {
    // console.error('Error during database test:', error);
  }
}

// Run the test
testDatabaseInitialization();