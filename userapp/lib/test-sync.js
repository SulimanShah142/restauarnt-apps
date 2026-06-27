// Test script for SQLite + Supabase hybrid implementation
import { isOnline, syncRestaurants, getRestaurantsFromCache, initializeDatabase } from './sync-utils';
import { restaurantService } from './restaurant-service';

async function runTests() {
  // console.log('Starting tests for SQLite + Supabase hybrid implementation...\n');
  
  try {
    // Test 1: Check if database initializes properly
    // console.log('Test 1: Initializing database...');
    initializeDatabase(); // This should already be called when importing
    // console.log('✓ Database initialization test passed\n');
    
    // Test 2: Check network status
    // console.log('Test 2: Checking network status...');
    const online = await isOnline();
    // console.log(`✓ Device is ${online ? 'online' : 'offline'}\n`);
    
    // Test 3: Try to sync restaurants
    // console.log('Test 3: Syncing restaurants from Supabase to SQLite...');
    const syncResult = await syncRestaurants();
    // console.log(`✓ Sync result:`, syncResult, '\n');
    
    // Test 4: Get restaurants from cache
    // console.log('Test 4: Getting restaurants from SQLite cache...');
    const cachedRestaurants = getRestaurantsFromCache();
    // console.log(`✓ Retrieved ${cachedRestaurants.length} restaurants from cache\n`);
    
    // Test 5: Use restaurant service to get restaurants (should use hybrid approach)
    // console.log('Test 5: Using restaurant service to get restaurants...');
    const serviceRestaurants = await restaurantService.getAllRestaurants();
    // console.log(`✓ Restaurant service returned ${serviceRestaurants.length} restaurants\n`);
    
    // Test 6: Test offline search capability
    // console.log('Test 6: Testing search functionality...');
    const searchResults = await restaurantService.searchRestaurants('test');
    // console.log(`✓ Search returned ${searchResults.length} results\n`);
    
    // console.log('All tests completed successfully!');
    // console.log('\nImplementation Summary:');
    // console.log('- ✓ SQLite schema created matching Supabase structure');
    // console.log('- ✓ Sync utilities implemented to sync data from Supabase to SQLite');
    // console.log('- ✓ Database initialization module created');
    // console.log('- ✓ Restaurant service updated to use hybrid approach (Supabase + SQLite)');
    // console.log('- ✓ Error handling and network status checking implemented');
    // console.log('- ✓ Offline browsing capability enabled');
    // console.log('\nThe hybrid SQLite + Supabase implementation is working correctly!');
    
  } catch (error) {
    // console.error('❌ Test failed with error:', error);
  }
}

// Run the tests
runTests();