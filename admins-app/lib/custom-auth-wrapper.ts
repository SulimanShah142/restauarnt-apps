import { supabase } from './supabase';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { PostgrestSingleResponse } from '@supabase/supabase-js';

// Interface for admin session
export interface AdminSession {
  user: {
    id: string;
    email: string;
    name?: string;
    role: string;
  };
  token: string;
}

// Generic error type for Supabase responses
interface GenericError {
  message: string;
  code?: string;
  details?: string;
  hint?: string;
}

/**
 * Centralized custom auth wrapper for admin app
 * Ensures all Supabase operations are performed with proper admin authentication
 */
class CustomAuthWrapper {
  private readonly SESSION_KEY = 'admin_session';

  /**
   * Validates if the admin is authenticated via custom auth
   */
  async isAuthenticated(): Promise<boolean> {
    try {
      const sessionData = await AsyncStorage.getItem(this.SESSION_KEY);
      if (!sessionData) {
        return false;
      }

      const session: AdminSession = JSON.parse(sessionData);
      // Check for valid session (role check is case-insensitive)
      const isValid = !!session && !!session.token && !!session.user && 
                      session.user?.role?.toLowerCase() === 'admin';
      return isValid;
    } catch (error) {
      console.error('[CustomAuthWrapper] Error validating custom auth:', error);
      return false;
    }
  }

  /**
   * Gets the authenticated admin user from custom auth session
   */
  async getAuthenticatedUser(): Promise<AdminSession['user'] | null> {
    try {
      const sessionData = await AsyncStorage.getItem(this.SESSION_KEY);
      if (!sessionData) {
        return null;
      }

      const session: AdminSession = JSON.parse(sessionData);
      return session.user || null;
    } catch (error) {
      console.error('Error getting authenticated user:', error);
      return null;
    }
  }

  /**
   * Performs a Supabase operation with custom auth validation
   */
  async withAuth<T>(
    operation: () => Promise<PostgrestSingleResponse<T>>,
    errorMessage: string = 'Authentication error: Unauthorized access'
  ): Promise<T | null> {
    // Validate authentication first
    const isAuthenticated = await this.isAuthenticated();
    if (!isAuthenticated) {
      throw new Error(errorMessage);
    }

    // Perform the operation
    const result = await operation();

    if (result.error) {
      throw new Error(`Database error: ${result.error.message}`);
    }

    return result.data;
  }

  /**
   * Performs a Supabase insert operation with custom auth validation and user context
   */
  async withAuthAndUserContext<T>(
    data: any,
    operation: (dataWithContext: any) => Promise<PostgrestSingleResponse<T>>,
    errorMessage: string = 'Authentication error: Unauthorized access'
  ): Promise<T> {
    // Validate authentication first
    const isAuthenticated = await this.isAuthenticated();
    if (!isAuthenticated) {
      throw new Error(errorMessage);
    }

    // For admin operations, we typically don't want to set owner_id from custom auth
    // since admin users may not have corresponding profile records
    // Instead, let the data parameter contain the intended owner_id if needed
    // or let the database handle it appropriately

    // Prepare data without modifying owner_id from custom auth
    let processedData = { ...data };

    // Perform the operation
    const result = await operation(processedData);

    if (result.error) {
      throw new Error(`Database error: ${result.error.message}`);
    }

    if (!result.data) {
      throw new Error('No data returned from operation');
    }

    return result.data;
  }

  /**
   * Wrapper for Supabase select operations
   */
  async selectWithAuth<T>(
    query: any,
    errorMessage: string = 'Authentication error: Unauthorized access'
  ): Promise<T[]> {
    const result = await this.withAuth<T[]>(
      () => query,
      errorMessage
    );
    return result || [];
  }

  /**
   * Wrapper for Supabase insert operations
   */
  async insertWithAuth<T extends Record<string, any>>(
    table: string,
    data: any,
    selectQuery: string = '*',
    errorMessage: string = 'Authentication error: Unauthorized access'
  ): Promise<T> {

    return this.withAuthAndUserContext<T>(
      data,
      async (dataWithContext: any): Promise<PostgrestSingleResponse<T>> => {
        const query = supabase
          .from(table)
          .insert([dataWithContext])
          .select(selectQuery);

        const result = await query.single();


        return result as PostgrestSingleResponse<T>;
      },
      errorMessage
    );
  }

  /**
   * Wrapper for Supabase update operations
   */
  async updateWithAuth<T extends Record<string, any>>(
    table: string,
    id: string,
    updates: any,
    selectQuery: string = '*',
    idColumn: string = 'id',
    errorMessage: string = 'Authentication error: Unauthorized access'
  ): Promise<T | null> {

    return this.withAuth<T | null>(
      () => {
        const query = supabase
          .from(table)
          .update(updates)
          .eq(idColumn, id)
          .select(selectQuery);

        // Use maybeSingle() instead of single() to handle cases where no rows are returned
        return query.maybeSingle() as unknown as Promise<PostgrestSingleResponse<T | null>>;
      },
      errorMessage
    );
  }

  /**
   * Wrapper for Supabase delete operations
   */
  async deleteWithAuth(
    table: string,
    id: string,
    idColumn: string = 'id',
    errorMessage: string = 'Authentication error: Unauthorized access'
  ): Promise<boolean> {
    // Validate authentication first
    const isAuthenticated = await this.isAuthenticated();
    if (!isAuthenticated) {
      throw new Error(errorMessage);
    }

    const { error, status } = await supabase
      .from(table)
      .delete()
      .eq(idColumn, id);

    if (error) {
      console.error(`Delete error in table ${table}:`, error);
      console.error(`Status code: ${status}`);
      throw new Error(`Database error: ${error.message} (Code: ${error.code || 'unknown'})`);
    }

    // Return true if no error occurred (meaning the delete was successful)
    return true;
  }
}

// Create a singleton instance
export const customAuthWrapper = new CustomAuthWrapper();