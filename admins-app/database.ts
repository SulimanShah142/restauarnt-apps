// Database entry point for Admins App - Platform Agnostic
// This file delegates to the platform-specific implementation in db/
// Metro automatically resolves the correct implementation based on platform

// Import from db/ - Metro resolves to index.native.ts (mobile) or index.web.ts (web)
import { getDatabase as getPlatformDatabase, recreateDatabase as recreatePlatformDatabase } from './db';
import type { DatabaseInterface } from './db/types';

// Cache the database instance
let cachedDb: DatabaseInterface | null = null;

/**
 * Initialize and get the database instance
 */
export const getDatabase = async (): Promise<DatabaseInterface> => {
  if (cachedDb) {
    return cachedDb;
  }


  cachedDb = await getPlatformDatabase();


  return cachedDb;
};

/**
 * Reset the cached database instance (useful after recreation)
 */
export const resetDatabaseCache = () => {
  cachedDb = null;
};

/**
 * Recreate the database (delete and recreate schema)
 */
export const recreateDatabase = async () => {
  // Reset cache first
  resetDatabaseCache();
  // Recreate the platform database
  await recreatePlatformDatabase();
  // Reinitialize to get fresh database
  await getDatabase();
  // Update the legacy db export
  db = cachedDb;
};

// Re-export types for convenience
export type { DatabaseInterface } from './db/types';
export { TABLES } from './db/schema';

// Legacy compatibility - initDatabase now uses getDatabase internally
export const initDatabase = async (): Promise<DatabaseInterface> => {
  // Reset cache to force reinitialization
  resetDatabaseCache();
  const result = await getDatabase();
  // Update the legacy db export
  db = cachedDb;
  return result;
};

// Legacy compatibility - db export (will be initialized on first access)
export let db: DatabaseInterface | null = null;

// Initialize db on first import (for legacy compatibility)
getDatabase().then(database => {
  db = database;
}).catch((error) => {
  console.error('[AdminsDB-Wrapper] ❌ Failed to initialize legacy db export:', error);
});



//j3kr flh3bf2uo2vof2o4fo2y24tvf4