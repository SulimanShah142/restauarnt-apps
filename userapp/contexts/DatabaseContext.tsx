// Database Context for User App
// Provides database access throughout the app with platform-specific handling
// - Web: Uses IndexedDB via db/index.web.ts
// - Mobile: Uses Expo SQLite via db/index.native.ts

import React, { createContext, useContext, useEffect, useState } from 'react';
import { Platform } from 'react-native';
import { getDatabase } from '../database';
import type { DatabaseInterface } from '../db/types';

const DatabaseContext = createContext<DatabaseInterface | null | undefined>(undefined);

interface DatabaseProviderProps {
  children: React.ReactNode;
}

export const DatabaseProvider: React.FC<DatabaseProviderProps> = ({ children }) => {
  const [database, setDatabase] = useState<DatabaseInterface | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  console.log('[UserAppDB-Context] Render - database:', !!database, 'loading:', loading, 'error:', error?.message);

  useEffect(() => {
    const initializeDatabase = async () => {
      try {
        console.log('[UserAppDB-Context] Initializing database...');
        const db = await getDatabase();
        console.log('[UserAppDB-Context] ✅ Database initialized successfully');
        setDatabase(db);
      } catch (err: any) {
        console.error('[UserAppDB-Context] ❌ Failed to initialize database:', err);
        console.error('[UserAppDB-Context] Error stack:', err.stack);
        setError(err instanceof Error ? err : new Error('Unknown error'));
      } finally {
        setLoading(false);
        console.log('[UserAppDB-Context] Initialization complete, loading: false');
      }
    };

    initializeDatabase();
  }, []);

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
      console.warn('[UserAppDB-Context] ⚠️ useSyncDatabase: Database not available');
      return;
    }

    try {
      await database.syncWithSupabase();
    } catch (error) {
      console.error('[UserAppDB-Context] ❌ useSyncDatabase: Sync failed:', error);
    }
  };

  return { sync };
};

// Hook to force reset and complete sync with Supabase
export const useForceResetSync = () => {
  const database = useDatabase();

  const forceResetSync = async () => {
    if (!database) {
      console.warn('[UserAppDB-Context] ⚠️ useForceResetSync: Database not available');
      throw new Error('Database not available');
    }

    try {
      await database.syncWithSupabase();
      return { success: true };
    } catch (error) {
      console.error('[UserAppDB-Context] ❌ useForceResetSync: Force reset failed:', error);
      throw error;
    }
  };

  return { forceResetSync };
};
