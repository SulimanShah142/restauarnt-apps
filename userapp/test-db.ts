// Test file to verify the new database implementation
import { getDatabase } from './db';

const testDatabase = async () => {
  try {

    // Get the database instance
    const db = await getDatabase();

    // Test basic operations
    const restaurants = await db.getRestaurants();

    // Test sync
    await db.syncWithSupabase();

    // Close the database
    if (db.close) {
      await db.close();
    }

    // console.log('Database test completed successfully');
  } catch (error) {
    // console.error('Test failed:', error);
  }
};

// Run the test
testDatabase();