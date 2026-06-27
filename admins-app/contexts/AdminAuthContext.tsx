// contexts/AdminAuthContext.tsx
import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { getAdminSession, type AdminSession } from '@/lib/admin-auth';

interface AdminAuthContextType {
  isAdmin: boolean;
  isAdminLoading: boolean;
  session: AdminSession | null;
  checkAdminStatus: () => Promise<void>;
  refreshAuth: () => void;
}

const AdminAuthContext = createContext<AdminAuthContextType | undefined>(undefined);

export const AdminAuthProvider = ({ children }: { children: ReactNode }) => {
  const [isAdmin, setIsAdmin] = useState<boolean>(false);
  const [isAdminLoading, setIsAdminLoading] = useState<boolean>(true);
  const [session, setSession] = useState<AdminSession | null>(null);
  const [refreshTrigger, setRefreshTrigger] = useState<number>(0);
  const hasSyncedOneSignal = React.useRef(false); // Prevent infinite OneSignal sync loops

  const checkAdminStatus = async () => {
    try {
      // Get admin session first
      const adminSession = await getAdminSession();
      setSession(adminSession);

      // Check custom admin authentication
      const { isAdminAuthenticated } = await import('@/lib/admin-auth');
      const isAuthenticated = await isAdminAuthenticated();
      setIsAdmin(isAuthenticated);

      // If admin is authenticated, sync OneSignal tokens ONCE (handles app restart/reinstall)
      if (isAuthenticated && adminSession && !hasSyncedOneSignal.current) {
        hasSyncedOneSignal.current = true;
        console.log('[AdminAuthContext] Admin authenticated, syncing OneSignal tokens...');
        try {
          const { syncOneSignalTokens } = await import('@/utils/onesignal');
          await syncOneSignalTokens();
          console.log('[AdminAuthContext] ✅ OneSignal tokens synced');
        } catch (error) {
          console.error('[AdminAuthContext] Error syncing OneSignal tokens:', error);
        }
      }
    } catch (error) {
      console.error('Error checking admin authentication:', error);
      setIsAdmin(false);
      setSession(null);
    } finally {
      setIsAdminLoading(false);
    }
  };

  // Check auth on mount and when refreshTrigger changes
  useEffect(() => {
    checkAdminStatus();
  }, [refreshTrigger]);

  // Method to trigger auth refresh
  const refreshAuth = () => {
    setRefreshTrigger(prev => prev + 1);
  };

  const value = {
    isAdmin,
    isAdminLoading,
    session,
    checkAdminStatus,
    refreshAuth
  };

  return (
    <AdminAuthContext.Provider value={value}>
      {children}
    </AdminAuthContext.Provider>
  );
};

export const useAdminAuth = () => {
  const context = useContext(AdminAuthContext);
  if (context === undefined) {
    // Return default values instead of throwing to prevent crashes
    console.warn('[useAdminAuth] Used outside AdminAuthProvider, returning default values');
    return {
      isAdmin: false,
      isAdminLoading: true,
      session: null,
      checkAdminStatus: async () => {},
      refreshAuth: () => {},
    };
  }
  return context;
};