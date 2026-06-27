import { supabase } from './supabase';

// Function to register a user with a specific role
export const registerUserWithRole = async (email: string, password: string, name: string, role: 'user' | 'delivery_person' | 'admin') => {
  try {
    // Sign up the user with Supabase
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        // These go into 'raw_user_meta_data' for our SQL trigger
        data: {
          full_name: name,
          role: role,
        },
      },
    });

    if (authError) {
      throw authError;
    }

    if (!authData.user) {
      throw new Error('Authentication failed - no user returned');
    }

    // Note: The users table should be populated via database triggers
    // when a new auth user is created, assuming proper RLS policies are in place.
    // If the database is configured correctly, these records will be created automatically.

    return authData;
  } catch (error) {
    // console.error('Error registering user with role:', error);
    throw error;
  }
};

// Specific functions for each app
export const registerUserAppUser = async (email: string, password: string, name: string) => {
  return registerUserWithRole(email, password, name, 'user');
};

export const registerDeliveryAppUser = async (email: string, password: string, name: string) => {
  return registerUserWithRole(email, password, name, 'delivery_person');
};

export const registerAdminAppUser = async (email: string, password: string, name: string) => {
  return registerUserWithRole(email, password, name, 'admin');
};