import { useEffect, useState } from 'react';
import { adminAPIService } from '@/lib/admin-api';

/**
 * Custom hook to ensure admin privileges before rendering component content
 * @returns Object containing loading state and admin status
 */
export const useAdminAuth = () => {
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null); // null means loading
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const checkAdminStatus = async () => {
      try {
        setIsAdmin(null); // Set loading state
        const adminStatus = await adminAPIService.checkAdminPrivileges();
        setIsAdmin(adminStatus);
        setError(null);
      } catch (err) {
        console.error('Error checking admin privileges:', err);
        setError(err instanceof Error ? err.message : 'Unknown error occurred');
        setIsAdmin(false);
      }
    };

    checkAdminStatus();
  }, []);

  return {
    isAdmin: isAdmin,
    isLoading: isAdmin === null,
    error,
    checkAdminPrivileges: adminAPIService.checkAdminPrivileges
  };
};