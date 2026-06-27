// Database Context for Deliver App
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
      } catch (err: any) {
        console.error('[DeliverDB-Context] ❌ Failed to initialize database:', err);
        setError(err instanceof Error ? err : new Error('Unknown error'));
      } finally {
        setLoading(false);
      }
    };

    initializeDatabase();
  }, []);

  if (loading) {
    return (
      <React.Fragment>
        {children}
      </React.Fragment>
    );
  }

  if (error) {
    console.error('[DeliverDB-Context] ❌ DatabaseProvider: Error state:', error.message);
    return (
      <React.Fragment>
        {children}
      </React.Fragment>
    );
  }

  return (
    <DatabaseContext.Provider value={database}>
      {children}
    </DatabaseContext.Provider>
  );
};

export const useDatabase = (): DatabaseInterface | null => {
  const context = useContext(DatabaseContext);
  if (context === undefined) {
    throw new Error('useDatabase must be used within a DatabaseProvider');
  }
  return context;
};

// Hook to sync database with Supabase (FORCE MODE - detects deletions)
export const useSyncDatabase = () => {
  const database = useDatabase();

  const sync = async () => {
    if (!database) {
      console.warn('[DeliverDB-Context] ⚠️ useSyncDatabase: Database not available');
      return;
    }

    try {
      await database.syncWithSupabase({ force: true });
    } catch (error) {
      console.error('[DeliverDB-Context] ❌ useSyncDatabase: Sync failed:', error);
    }
  };

  return { sync };
};

// Hook to force reset and complete sync with Supabase
export const useForceResetSync = () => {
  const database = useDatabase();

  const forceResetSync = async () => {
    if (!database) {
      console.warn('[DeliverDB-Context] ⚠️ useForceResetSync: Database not available');
      throw new Error('Database not available');
    }

    try {
      
      // Step 1: Clear all local data
      // if (database.clearAllData) {
      //   await database.clearAllData();
      // } else {
      // }

      // Step 2: Clear sync timestamps (force full re-sync)
      // if (database.clearSyncTimestamps) {
      //   await database.clearSyncTimestamps();
      // } else {
      // }

      // Step 3: Force complete sync from Supabase
      
      if (database.syncWithSupabase) {
        await database.syncWithSupabase({ force: true });
        throw new Error('syncWithSupabase not available');
      }

      
      return { success: true };
    } catch (error) {
      console.error('[DeliverDB-Context] ========================================');
      console.error('[DeliverDB-Context] ❌ FORCE RESET & SYNC FAILED!');
      console.error('[DeliverDB-Context] Error:', error);
      console.error('[DeliverDB-Context] Error details:', JSON.stringify(error, null, 2));
      console.error('[DeliverDB-Context] ========================================');
      throw error;
    }
  };

  return { forceResetSync };
};
