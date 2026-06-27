// Database Context for Admins App
// Provides database access throughout the app with platform-specific handling
// - Web: Uses IndexedDB via db/index.web.ts
// - Mobile: Uses Expo SQLite via db/index.native.ts

import React, { createContext, useContext, useEffect, useState } from 'react';
import { Platform } from 'react-native';
import { getDatabase } from '../database';
import type { DatabaseInterface } from '../db/types';

const DatabaseContext = createContext<DatabaseInterface | null>(null);

interface DatabaseProviderProps {
  children: React.ReactNode;
}

export const DatabaseProvider: React.FC<DatabaseProviderProps> = ({ children }) => {
  const [database, setDatabase] = useState<DatabaseInterface | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    const initializeDatabase = async () => {
      try {
        const db = await getDatabase();
        setDatabase(db);
      } catch (err) {
        console.error('[AdminsDB-Context] ❌ Failed to initialize database:', err);
        setError(err instanceof Error ? err : new Error('Unknown error'));
      } finally {
        setLoading(false);
      }
    };

    initializeDatabase();
  }, []);

  // Don't block rendering during loading - just provide null database
  // Children components should handle null database from useDatabase()
  return (
    <DatabaseContext.Provider value={database}>
      {children}
    </DatabaseContext.Provider>
  );
};

export const useDatabase = (): DatabaseInterface | null => {
  const context = useContext(DatabaseContext);
  if (context === undefined) {
    // Return null instead of throwing to prevent crashes
    console.warn('[useDatabase] Used outside DatabaseProvider, returning null');
    return null;
  }
  return context;
};

// Hook to sync database with Supabase (FORCE MODE - detects deletions)
export const useSyncDatabase = () => {
  const database = useDatabase();

  const sync = async () => {
    if (!database) {
      console.warn('[AdminsDB-Context] ⚠️ useSyncDatabase: Database not available');
      return;
    }

    try {
      await database.syncWithSupabase({ force: true });
    } catch (error) {
      console.error('[AdminsDB-Context] ❌ useSyncDatabase: Sync failed:', error);
    }
  };

  return { sync };
};

// Hook to force reset and complete sync with Supabase
export const useForceResetSync = () => {
  const database = useDatabase();

  const forceResetSync = async () => {
    if (!database) {
      console.warn('[AdminsDB-Context] ⚠️ useForceResetSync: Database not available');
      throw new Error('Database not available');
    }

    try {
      if (database.syncWithSupabase) {
        await database.syncWithSupabase({ force: true });
        return { success: true };
      }

      throw new Error('syncWithSupabase not available');
    } catch (error) {
      console.error('[AdminsDB-Context] ========================================');
      console.error('[AdminsDB-Context] ❌ FORCE RESET & SYNC FAILED!');
      console.error('[AdminsDB-Context] Error:', error);
      console.error('[AdminsDB-Context] Error details:', JSON.stringify(error, null, 2));
      console.error('[AdminsDB-Context] ========================================');
      throw error;
    }
  };

  return { forceResetSync };
};
