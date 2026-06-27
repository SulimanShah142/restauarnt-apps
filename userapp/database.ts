// Database entry point for User App - Platform Agnostic
// This file delegates to the platform-specific implementation in db/
// Metro automatically resolves the correct implementation based on platform

// Import from db/ - Metro resolves to index.native.ts (mobile) or index.web.ts (web)
import { getDatabase as getPlatformDatabase } from './db';
import type { DatabaseInterface } from './db/types';

// Cache the database instance
let cachedDb: DatabaseInterface | null = null;

console.log('[Database] Module loaded');

/**
 * Initialize and get the database instance
 */
export const getDatabase = async (): Promise<DatabaseInterface> => {
  console.log('[Database] getDatabase called, cached:', !!cachedDb);
  
  if (cachedDb) {
    console.log('[Database] Returning cached database instance');
    return cachedDb;
  }

  try {
    console.log('[Database] Initializing platform database...');
    const db = await getPlatformDatabase();
    
    if (db) {
      console.log('[Database] ✅ Platform database initialized');
      cachedDb = db;
      return db;
    } else {
      console.error('[Database] ❌ Platform database returned null');
      throw new Error('Platform database returned null');
    }
  } catch (error) {
    console.error('[Database] ❌ Failed to get platform database:', error);
    console.error('[Database] Error stack:', error instanceof Error ? error.stack : 'No stack');
    throw new Error(`Database initialization failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
};

// Re-export types for convenience
export type { DatabaseInterface } from './db/types';
export { TABLES } from './db/schema';

// Legacy compatibility - initDatabase now uses getDatabase internally
export const initDatabase = async (): Promise<DatabaseInterface> => {
  console.log('[Database] initDatabase called (legacy)');
  return getDatabase();
};

// Legacy compatibility - db export (will be initialized on first access)
export let db: DatabaseInterface | null = null;

// Initialize db on first import (for legacy compatibility)
// Commented out to prevent auto-initialization - call getDatabase() explicitly instead
// getDatabase().then(database => {
//   db = database;
// }).catch(error => {
//   console.error('Failed to initialize database:', error);
// });
