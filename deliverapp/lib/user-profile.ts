import { useEffect, useState } from 'react';
import { supabase } from './supabase';

export const getCurrentUser = async () => {
  try {
    // 1. Get the basic auth data (id, email)
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return null;
    }

    // 2. Fetch the extra profile data (role, full_name) from your public table
    try {
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .maybeSingle(); // Use maybeSingle() instead of single() to handle cases where no record exists

      if (profileError) {
        console.error("Error fetching profile:", profileError.message);
        // If profiles table doesn't exist or user not found, check auth metadata for role
        if (profileError.code === '42P01' || profileError.code === 'PGRST116') {
          // 42P01 = undefined_table, PGRST116 = row_not_found
          // Check if user has role in auth metadata (from registration)
          const userRole = user.user_metadata?.role || user.app_metadata?.role || 'user';
          return { ...user, role: userRole };
        }
        // For other errors like "Cannot coerce the result to a single JSON object", 
        // it might mean multiple records were returned, so we'll try to get the first one
        if (profileError.message?.includes("Cannot coerce the result to a single JSON object")) {
          // Try to fetch without .single() to see all records
          const { data: profiles, error: multiError } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', user.id);
          
          if (!multiError && profiles && profiles.length > 0) {
            // Return the first profile
            const firstProfile = profiles[0];
            return { ...user, ...firstProfile };
          }
        }
        
        // For other errors, still try to get role from auth metadata
        const userRole = user.user_metadata?.role || user.app_metadata?.role || 'user';
        return { ...user, role: userRole };
      }

      // If profile exists, merge it with user data
      // If profile is null (which maybeSingle() returns when no record is found), use auth metadata
      if (profile) {
        return { ...user, ...profile };
      } else {
        // No profile found, use auth metadata for role
        const userRole = user.user_metadata?.role || user.app_metadata?.role || 'user';
        return { ...user, role: userRole };
      }
    } catch (profileFetchError: any) {
      console.error("Unexpected error fetching profile:", profileFetchError);
      // On any error, fall back to auth metadata for role
      const userRole = user.user_metadata?.role || user.app_metadata?.role || 'user';
      return { ...user, role: userRole };
    }
  } catch (authError: any) {
    console.error("Error getting user session:", authError);
    return null;
  }
};

export function useUserProfile() {
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchProfile();
  }, []);

  async function fetchProfile() {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (user) {
        try {
          const { data, error } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', user.id)
            .maybeSingle(); // Use maybeSingle() to handle cases where no record exists
          
          if (error) {
            console.error("Error fetching profile in hook:", error.message);
            // If profiles table doesn't exist or user not found, use auth metadata
            if (error.code === '42P01' || error.code === 'PGRST116') {
              // 42P01 = undefined_table, PGRST116 = row_not_found
              setProfile({ 
                id: user.id, 
                email: user.email, 
                role: user.user_metadata?.role || user.app_metadata?.role || 'user',
                full_name: user.user_metadata?.full_name || user.user_metadata?.name || user.email?.split('@')[0]
              });
            } else if (error.message?.includes("Cannot coerce the result to a single JSON object")) {
              // Handle case where multiple records were returned
              const { data: profiles, error: multiError } = await supabase
                .from('profiles')
                .select('*')
                .eq('id', user.id);
              
              if (!multiError && profiles && profiles.length > 0) {
                // Use the first profile
                setProfile(profiles[0]);
              } else {
                // Fallback to auth metadata
                setProfile({ 
                  id: user.id, 
                  email: user.email, 
                  role: user.user_metadata?.role || user.app_metadata?.role || 'user',
                  full_name: user.user_metadata?.full_name || user.user_metadata?.name || user.email?.split('@')[0]
                });
              }
            } else {
              setProfile({ 
                id: user.id, 
                email: user.email, 
                role: user.user_metadata?.role || user.app_metadata?.role || 'user',
                full_name: user.user_metadata?.full_name || user.user_metadata?.name || user.email?.split('@')[0]
              });
            }
          } else {
            // If data is null (maybeSingle returns null when no record is found), use auth metadata
            if (data) {
              setProfile(data);
            } else {
              setProfile({ 
                id: user.id, 
                email: user.email, 
                role: user.user_metadata?.role || user.app_metadata?.role || 'user',
                full_name: user.user_metadata?.full_name || user.user_metadata?.name || user.email?.split('@')[0]
              });
            }
          }
        } catch (fetchError: any) {
          console.error("Error in profile fetch:", fetchError);
          // On any error, fall back to auth metadata
          setProfile({ 
            id: user.id, 
            email: user.email, 
            role: user.user_metadata?.role || user.app_metadata?.role || 'user',
            full_name: user.user_metadata?.full_name || user.user_metadata?.name || user.email?.split('@')[0]
          });
        }
      }
    } catch (error: any) {
      console.error("Unexpected error in useUserProfile hook:", error);
      setProfile(null);
    }
    setLoading(false);
  }

  return { profile, loading };
}