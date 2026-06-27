// Database entry point for Deliver App - Platform Agnostic
// This file delegates to the platform-specific implementation in db/
// Metro automatically resolves the correct implementation based on platform

// Import from db/ - Metro resolves to index.native.ts (mobile) or index.web.ts (web)
import { getDatabase as getPlatformDatabase } from './db';
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


  const db = await getPlatformDatabase();
  if (db) {
    cachedDb = db;
    return cachedDb;
  }
  
  throw new Error('Failed to initialize database');
};

// Re-export types for convenience
export type { DatabaseInterface } from './db/types';
export { TABLES } from './db/schema';
