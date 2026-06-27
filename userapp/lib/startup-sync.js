// App startup sync handler
// This file can be imported in your main layout or app entry point
import { restaurantService } from './restaurant-service';

/**
 * Perform initial sync when the app starts
 * This ensures the user has the most recent data available
 */
export async function performAppStartupSync() {
  try {
    // console.log('Starting app startup sync...');
    
    // Attempt to sync all restaurant data
    await restaurantService.forceSync();
    
    // console.log('App startup sync completed successfully');
  } catch (error) {
    // console.error('App startup sync failed:', error);
    // Don't throw the error as this is just a background sync
    // The app can still function with cached data
  }
}

/**
 * Background sync that can be called periodically
 * This keeps the cache reasonably up-to-date
 */
export async function performBackgroundSync() {
  try {
    // console.log('Starting background sync...');
    
    // For background sync, we might only sync certain data
    // depending on what's most important to keep fresh
    
    // Example: Just sync restaurants
    await restaurantService.forceSync();
    
    // console.log('Background sync completed');
  } catch (error) {
    // console.error('Background sync failed:', error);
    // Again, don't throw as this is background processing
  }
}