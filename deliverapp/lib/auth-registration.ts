import { supabase } from '@/lib/supabase';

// Function to create/update profile and delivery person records in the background
const createDeliveryProfileAsync = async (userId: string, fullName: string, email: string, phone?: string) => {
  try {
    // Create/update the profile in the profiles table
    const { error: profileError } = await supabase
      .from('profiles')
      .upsert({
        id: userId,
        full_name: fullName,
        email: email,
        phone: phone || null,
        role: 'driver',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }, { onConflict: 'id' });

    if (profileError) {
      console.error('Error creating/updating profile:', profileError);

      // If profile creation failed, try to update the user metadata directly as a backup
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

    // Create/update the delivery person record
    const { error: deliveryPersonError } = await supabase
      .from('delivery_persons')
      .upsert({
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
      }, { onConflict: 'user_id' }); // Use upsert to handle cases where the delivery person record already exists

    if (deliveryPersonError) {
      console.error('Error creating/updating delivery person record:', deliveryPersonError);
      throw deliveryPersonError;
    }
  } catch (error) {
    console.error('Error in createDeliveryProfileAsync:', error);
    throw error;
  }
};

// Function to register a delivery person
export const registerDeliveryPerson = async (email: string, password: string, fullName: string, phone?: string) => {
  // Try to sign up the user with the required metadata to ensure the trigger creates the correct profile
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        // Include the role and other metadata during signup to ensure the trigger creates the correct profile
        full_name: fullName,
        phone: phone,
        role: 'driver'
      }
    }
  });

  if (error) {
    console.error('Supabase auth sign up error:', error);
    throw error;
  }

  // Return immediately after successful signup
  const result = { ...data }; // Copy the data to return immediately

  // Create/update the profile and delivery person records in the background (after returning)
  if (data?.user) {
    // Create/update the profile and delivery person records in the background
    createDeliveryProfileAsync(data.user.id, fullName, data.user.email || '', phone)
      .catch(err => console.error('Error creating profile/delivery person:', err));
  }

  return result;
};
