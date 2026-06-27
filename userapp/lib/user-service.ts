// User Service - Supabase-based implementation
import { supabase } from './supabase';

export interface User {
  id: string;
  name?: string;
  email?: string;
  emailVerified?: Date;
  image?: string;
  createdAt: Date;
  updatedAt: Date;
}

export const userService = {
  // Get user by ID
  getUserById: async (id: string): Promise<User | null> => {
    try {
      // Using Supabase to get user info
      const { data: userData, error } = await supabase
        .from('users')
        .select('*')
        .eq('id', id)
        .single() as { data: any; error: any };

      if (error) {
        if (error.code === 'PGRST116') { // Record not found
          return null;
        }
        throw new Error(error.message);
      }

      return {
        id: userData.id,
        name: userData.name,
        email: userData.email,
        emailVerified: userData.email_confirmed_at ? new Date(userData.email_confirmed_at) : undefined,
        image: userData.avatar_url || userData.user_metadata?.avatar_url || userData.user_metadata?.picture,
        createdAt: new Date(userData.created_at),
        updatedAt: new Date(userData.updated_at),
      };
    } catch (error) {
      // console.error('Error fetching user:', error);
      throw error;
    }
  },

  // Get user by email
  getUserByEmail: async (email: string): Promise<User | null> => {
    // This would typically be handled by the auth system
    // For security reasons, we won't expose an endpoint to get user by email
    throw new Error('Getting user by email is not allowed for security reasons');
  },

  // Create a new user
  createUser: async (name: string, email: string, passwordHash: string): Promise<User> => {
    // This would typically be handled by the auth system
    // For now, we'll throw an error since user creation is typically handled by the auth system
    throw new Error('User creation should be handled by the authentication system');
  },

  // Update user
  updateUser: async (id: string, updates: Partial<User>): Promise<User | null> => {
    try {
      // Prepare the update data
      const updateData: any = {};
      
      if (updates.name !== undefined) updateData.name = updates.name;
      if (updates.email !== undefined) updateData.email = updates.email;
      if (updates.image !== undefined) updateData.avatar_url = updates.image; // Store image as avatar_url
      
      // Update the user in the database
      const { data, error } = await ((supabase
        .from('users')
        .update(updateData as any)
        .eq('id', id)
        .select()
        .single()) as { data: any; error: any });

      if (error) {
        // console.error('Supabase error updating user:', error);
        throw new Error(`Supabase error: ${error.message}`);
      }

      return {
        id: data.id,
        name: data.name,
        email: data.email,
        emailVerified: data.email_confirmed_at ? new Date(data.email_confirmed_at) : undefined,
        image: data.avatar_url || data.user_metadata?.avatar_url || data.user_metadata?.picture,
        createdAt: new Date(data.created_at),
        updatedAt: new Date(data.updated_at),
      };
    } catch (error) {
      // console.error('Error updating user:', error);
      throw error;
    }
  },

  // Delete user
  deleteUser: async (id: string): Promise<boolean> => {
    // This method would typically be handled by the auth system
    // For now, we'll throw an error since user deletion is typically handled by the auth system
    throw new Error('User deletion should be handled by the authentication system');
  }
};