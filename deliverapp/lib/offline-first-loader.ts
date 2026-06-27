/**
 * Offline-First Data Loading Utility
 * Provides smart caching and sync strategies for offline-first apps
 */

import { supabase } from './supabase';
import { networkStatus } from './network-status';
import { localDbService } from './local-db-service';

interface LoadOptions<T> {
  // Unique key for caching
  cacheKey: string;
  
  // Function to fetch from Supabase
  fetchFromRemote: () => Promise<T>;
  
  // Function to fetch from local cache
  fetchFromLocal: () => Promise<T>;
  
  // Function to save to local cache
  saveToLocal: (data: T) => Promise<void>;
  
  // Should we refresh data when online? (default: true)
  shouldRefresh?: boolean;
  
  // Max age of cached data in ms (default: 5 minutes)
  maxAge?: number;
  
  // Show loading state while fetching? (default: true)
  showLoading?: boolean;
}

interface CachedData<T> {
  data: T;
  timestamp: number;
}

/**
 * Smart data loader with offline-first strategy
 * 
 * Strategy:
 * 1. Check network status
 * 2. If offline: Load from cache immediately (no clearing!)
 * 3. If online: Load from cache first, then sync with remote
 * 4. Always preserve cache, never clear unless explicitly requested
 */
export async function loadWithOfflineSupport<T>({
  cacheKey,
  fetchFromRemote,
  fetchFromLocal,
  saveToLocal,
  shouldRefresh = true,
  maxAge = 5 * 60 * 1000, // 5 minutes
  showLoading = true,
}: LoadOptions<T>): Promise<{
  data: T | null;
  isFromCache: boolean;
  isStale: boolean;
  error: Error | null;
}> {
  const result = {
    data: null as T | null,
    isFromCache: false,
    isStale: false,
    error: null as Error | null,
  };

  try {
    // Step 1: Check network status
    const isOnline = networkStatus.isOnline();

    // Step 2: Always try to load from cache first (for instant UI)
    if (true) {
      try {
        const cachedData = await fetchFromLocal();
        if (cachedData) {
          result.data = cachedData;
          result.isFromCache = true;

          // Check if data is stale
          const cacheTimestamp = await getCacheTimestamp(cacheKey);
          if (cacheTimestamp && Date.now() - cacheTimestamp > maxAge) {
            result.isStale = true;
          }
        }
      } catch (cacheError) {
        console.warn(`[Offline-First] ${cacheKey}: Cache load error (non-fatal):`, cacheError);
        // Non-fatal, continue
      }
    }

    // Step 3: If offline, return cached data (don't clear anything!)
    if (!isOnline) {
      if (!result.data) {
        result.error = new Error('No cached data available and device is offline');
      }
      return result;
    }

    // Step 4: If online and should refresh, sync with remote
    if (shouldRefresh) {
      try {
        const remoteData = await fetchFromRemote();
        
        if (remoteData) {
          // Save to cache
          await saveToLocal(remoteData);
          await setCacheTimestamp(cacheKey);
          
          result.data = remoteData;
          result.isFromCache = false;
          result.isStale = false;
        }
      } catch (remoteError) {
        console.error(`[Offline-First] ${cacheKey}: Remote fetch failed:`, remoteError);
        result.error = remoteError as Error;
        // But we still have cached data, so don't fail completely
      }
    }

    return result;
  } catch (error) {
    console.error(`[Offline-First] ${cacheKey}: Unexpected error:`, error);
    result.error = error as Error;
    return result;
  }
}

/**
 * Cache timestamp management
 */
const CACHE_TIMESTAMP_KEY = 'cache_timestamps';

async function getCacheTimestamp(cacheKey: string): Promise<number | null> {
  try {
    const { getDatabase } = await import('@/db');
    const db = await getDatabase();

    const dbWithGet = db as any;
    if (dbWithGet.getAsync) {
      // SQLite/IndexedDB
      const result = await dbWithGet.getAsync(
        `SELECT timestamp FROM cache_timestamps WHERE cache_key = ?`,
        [cacheKey]
      );
      return result?.timestamp || null;
    }
    return null;
  } catch (error) {
    console.warn('[Offline-First] Failed to get cache timestamp:', error);
    return null;
  }
}

async function setCacheTimestamp(cacheKey: string): Promise<void> {
  try {
    const { getDatabase } = await import('@/db');
    const db = await getDatabase();
    const timestamp = Date.now();

    const dbWithRun = db as any;
    if (dbWithRun.runAsync) {
      // SQLite/IndexedDB
      await dbWithRun.runAsync(
        `INSERT OR REPLACE INTO cache_timestamps (cache_key, timestamp) VALUES (?, ?)`,
        [cacheKey, timestamp]
      );
    }
  } catch (error) {
    console.warn('[Offline-First] Failed to set cache timestamp:', error);
  }
}

/**
 * Ensure cache_timestamps table exists
 */
export async function ensureCacheTimestampsTable(): Promise<void> {
  try {
    const { getDatabase } = await import('@/db');
    const db = await getDatabase();

    const dbWithRun = db as any;
    if (dbWithRun.runAsync) {
      await dbWithRun.runAsync(`
        CREATE TABLE IF NOT EXISTS cache_timestamps (
          cache_key TEXT PRIMARY KEY,
          timestamp INTEGER NOT NULL
        )
      `);
    }
  } catch (error) {
    console.error('[Offline-First] Failed to create cache_timestamps table:', error);
  }
}

/**
 * Clear specific cache (only when explicitly requested)
 */
export async function clearCache(cacheKey: string): Promise<void> {
  try {
    const { getDatabase } = await import('@/db');
    const db = await getDatabase();

    const dbWithRun = db as any;
    if (dbWithRun.runAsync) {
      await dbWithRun.runAsync(`DELETE FROM cache_timestamps WHERE cache_key = ?`, [cacheKey]);
    }
  } catch (error) {
    console.error('[Offline-First] Failed to clear cache:', error);
  }
}

/**
 * Clear all caches (only when explicitly requested, e.g., logout)
 */
export async function clearAllCaches(): Promise<void> {
  try {
    const { getDatabase } = await import('@/db');
    const db = await getDatabase();

    const dbWithRun = db as any;
    if (dbWithRun.runAsync) {
      await dbWithRun.runAsync(`DELETE FROM cache_timestamps`);
    }
  } catch (error) {
    console.error('[Offline-First] Failed to clear all caches:', error);
  }
}
