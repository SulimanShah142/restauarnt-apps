import { supabase } from './supabase';
import { useState, useEffect, useRef } from 'react';

// Custom hook for session management using Supabase
export const useSession = () => {
  const [session, setSession] = useState<any>(null);
  const [isPending, setIsPending] = useState(true);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;

    const initializeSession = async () => {
      try {
        // Get initial session
        const { data: { session } } = await supabase.auth.getSession();
        if (mountedRef.current) {
          setSession(session);
        }
      } catch (error) {
        console.error('Error getting session:', error);
      } finally {
        if (mountedRef.current) {
          setIsPending(false);
        }
      }
    };

    initializeSession();

    // Subscribe to auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, newSession) => {
        if (mountedRef.current) {
          setSession(newSession);
        }
      }
    );

    // Cleanup function
    return () => {
      mountedRef.current = false;
      subscription?.unsubscribe();
    };
  }, []); // Empty dependency array to ensure this only runs once

  return { data: { session }, isPending, mutate: () => {} };
};

// Sign in function
export const signIn = {
  email: async ({ email, password }: { email: string; password: string }) => {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      throw error;
    }

    // Ensure delivery person record exists for the user
    if (data?.user) {
      // Check if delivery person record exists
      const { data: existingDeliveryPerson, error: fetchError } = await supabase
        .from('delivery_persons')
        .select('user_id')
        .eq('user_id', data.user.id)
        .single();

      if (fetchError && fetchError.code === 'PGRST116') { // Record not found
        // Create delivery person record if it doesn't exist
        let createError: any = null;
        try {
          const result = await supabase
            .from('delivery_persons')
            .insert({
              user_id: data.user.id,
              vehicle_type: null,
              license_plate: null,
              is_available: false,
              current_location: null,
              current_latitude: null,
              current_longitude: null,
              rating: 0.0,
              total_deliveries: 0,
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString()
            });

          createError = result.error;
        } catch (error: any) {
          createError = error;
        }

        if (createError) {
          console.error('Error creating delivery person record:', createError);
          // If insert failed due to unique violation, the record might have been created by another process
          if (createError.code === '23505') {
            // Record was created by another process, ignore error
          } else {
            throw createError;
          }
        }
      } else if (fetchError) {
        console.error('Error checking for delivery person record:', fetchError);
      }
    }

    return data;
  }
};

// Sign out function
export const signOut = async () => {
  const { error } = await supabase.auth.signOut();

  if (error) {
    console.error('Error signing out:', error);
    throw error;
  }
};

// Function to create/update profile and delivery person records in the background
const createDeliveryProfileAsync = async (userId: string, fullName: string, email: string, phone?: string) => {
  try {
    // Create the profile in the profiles table (try insert first)
    const { error: profileError } = await supabase
      .from('profiles')
      .insert({
        id: userId,
        full_name: fullName,
        email: email,
        phone: phone || null,
        role: 'driver',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .select()
      .single();

    if (profileError) {
      // If insert failed because of unique violation, try updating instead
      if (profileError.code === '23505') { // Unique violation
        const { error: updateError } = await supabase
          .from('profiles')
          .update({
            full_name: fullName,
            email: email,
            phone: phone || null,
            role: 'driver',
            updated_at: new Date().toISOString()
          })
          .eq('id', userId);

        if (updateError) {
          console.error('Error updating profile:', updateError);
          // If update also fails due to RLS, try updating user metadata as fallback
          const { error: metadataUpdateError } = await supabase.auth.updateUser({
            data: {
              full_name: fullName,
              phone: phone,
              role: 'driver'
            }
          });

          if (metadataUpdateError) {
            console.error('Error updating user metadata as fallback:', metadataUpdateError);
            throw metadataUpdateError;
          }
        }
      } else {
        console.error('Error creating profile:', profileError);
        // If insert fails for other reasons, try updating user metadata as fallback
        const { error: metadataUpdateError } = await supabase.auth.updateUser({
          data: {
            full_name: fullName,
            phone: phone,
            role: 'driver'
          }
        });

        if (metadataUpdateError) {
          console.error('Error updating user metadata as fallback:', metadataUpdateError);
          throw metadataUpdateError;
        }
      }
    }

    // Create the delivery person record (try insert first)
    let deliveryPersonError: any = null;
    try {
      const { error } = await supabase
        .from('delivery_persons')
        .insert({
          user_id: userId, // Reference to the profile (this field exists in the schema)
          vehicle_type: null, // Will be set later by the user
          license_plate: null, // Will be set later by the user
          is_available: true, // Default to available initially
          current_location: null, // No location initially
          current_latitude: null, // No coordinates initially
          current_longitude: null, // No coordinates initially
          rating: 0.0, // Default rating
          total_deliveries: 0, // No deliveries yet
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .select()
        .single();

      deliveryPersonError = error;

      // If insert succeeded, we're done
      if (!deliveryPersonError) {
        return;
      }
    } catch (insertError: any) {
      deliveryPersonError = insertError;
    }

    // If insert failed because record already exists, try updating
    if (deliveryPersonError && deliveryPersonError.code === '23505') { // Unique violation means record exists
      const { error: updateError } = await supabase
        .from('delivery_persons')
        .update({
          updated_at: new Date().toISOString()
        })
        .eq('user_id', userId);

      if (updateError) {
        console.error('Error updating delivery person record:', updateError);
        throw updateError;
      }
    } else if (deliveryPersonError) {
      console.error('Error creating delivery person record:', deliveryPersonError);
      throw deliveryPersonError;
    }
  } catch (error) {
    console.error('Error in createDeliveryProfileAsync:', error);
    throw error;
  }
};

// Sign up function
export const signUp = {
  email: async ({ email, password, name, phone }: { email: string; password: string; name: string; phone?: string }) => {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: name,
          phone: phone,
          role: 'driver',
        },
      },
    });

    if (error) {
      throw error;
    }

    // Return immediately after successful signup
    const result = { ...data }; // Copy the data to return immediately

    // Create the profile and delivery person records in the background (after returning)
    if (data?.user) {
      createDeliveryProfileAsync(data.user.id, name, data.user.email!, phone)
        .catch(err => console.error('Error creating profile/delivery person:', err));
    }

    return result;
  }
};

// Get session function
export const getSession = async () => {
  const { data, error } = await supabase.auth.getSession();

  if (error) {
    console.error('Error getting session:', error);
    throw error;
  }

  return { data: { session: data.session, user: data.session?.user } };
};

// Helper function to get user role from session with network error handling
export const getUserRole = async () => {
  try {
    const session = await getSession();
    return session?.data?.user?.user_metadata?.role || session?.data?.user?.role || null;
  } catch (error) {
    console.error('Error getting user role:', error);
    // Check if it's a network error
    if (error instanceof Error && (error.message.includes('network') || error.message.includes('connection'))) {
      console.warn('Network error occurred when getting user role');
      return null;
    }
    return null;
  }
};
