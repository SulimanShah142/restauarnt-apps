import { supabase } from './supabase';
import * as Crypto from 'expo-crypto';
// NOTE: Removed clearExternalUserId import - we no longer call it on logout

// Session duration: 90 days in milliseconds (extended from 30 days)
const SESSION_DURATION = 90 * 24 * 60 * 60 * 1000; // 90 days

// Function to verify password against stored hash
export const verifyPassword = async (inputPassword: string, storedHash: string): Promise<boolean> => {
  try {
    const inputHash = await Crypto.digestStringAsync(
      Crypto.CryptoDigestAlgorithm.SHA256,
      inputPassword
    );
    return inputHash === storedHash;
  } catch (error) {
    console.error('[DeliveryAuth] Error hashing password:', error);
    throw new Error('Failed to verify password');
  }
};

// Custom authentication function for delivery personnel
export const authenticateDeliveryPerson = async (email: string, password: string) => {
  try {

    // Query the delivery_persons table for the provided email
    const { data, error } = await supabase
      .from('delivery_persons')
      .select('id, user_id, email, name, phone, vehicle_type, license_plate, is_available, password_hash')
      .eq('email', email)
      .maybeSingle(); // Use maybeSingle instead of single to avoid PGRST116 error

    if (error) {
      console.error('[DeliveryAuth] Database error:', error);
      throw new Error(`Database error: ${error.message}`);
    }

    if (!data) {
      console.error('[DeliveryAuth] No delivery person found with email:', email);
      throw new Error('No delivery person account found with this email. Please sign up first.');
    }

    // Verify the password against the stored hash
    const isValidPassword = await verifyPassword(password, data.password_hash);

    if (!isValidPassword) {
      console.error('[DeliveryAuth] Invalid password for:', email);
      throw new Error('Invalid email or password');
    }


    // Return the delivery person data (without the password hash)
    const { password_hash, ...deliveryPersonData } = data;
    return deliveryPersonData;
  } catch (error: any) {
    console.error('[DeliveryAuth] Authentication error:', error);
    throw error;
  }
};

// Store delivery person session with 90-day expiration
export const storeDeliverySession = async (deliveryPerson: any) => {
  try {
    const AsyncStorage = (await import('@react-native-async-storage/async-storage')).default;
    
    // Ensure user_id is always set - use delivery_person id if user_id is null
    const userId = deliveryPerson.user_id || deliveryPerson.id;
    
    const sessionData = {
      delivery_person_id: deliveryPerson.id,
      user_id: userId, // Always ensure this is set
      email: deliveryPerson.email,
      name: deliveryPerson.name,
      phone: deliveryPerson.phone,
      vehicle_type: deliveryPerson.vehicle_type,
      license_plate: deliveryPerson.license_plate,
      is_available: deliveryPerson.is_available,
      created_at: Date.now(),
      expires_at: Date.now() + SESSION_DURATION // 90 days from now
    };


    // Store session
    await AsyncStorage.setItem('delivery_person_session', JSON.stringify(sessionData));
    
    // Verify it was stored correctly
    const stored = await AsyncStorage.getItem('delivery_person_session');
    if (!stored) {
      throw new Error('Failed to store session');
    }
    
    const parsed = JSON.parse(stored);
    
    
    return sessionData;
  } catch (error: any) {
    console.error('[DeliveryAuth] Error storing delivery session:', error);
    throw new Error('Failed to store session: ' + error.message);
  }
};

// Get stored delivery session and validate expiration
export const getStoredDeliverySession = async () => {
  try {
    const AsyncStorage = (await import('@react-native-async-storage/async-storage')).default;
    const sessionData = await AsyncStorage.getItem('delivery_person_session');

    if (!sessionData) {
      return null;
    }

    const session = JSON.parse(sessionData);

    // Check if session has expired
    if (session.expires_at && Date.now() > session.expires_at) {
      await clearDeliverySession();
      return null;
    }

    // Ensure user_id is set
    if (!session.user_id) {
      session.user_id = session.delivery_person_id;
    }

    // Optionally extend the session if it's within the last 7 days of expiration
    const sevenDays = 7 * 24 * 60 * 60 * 1000;
    if (session.expires_at && Date.now() > session.expires_at - sevenDays) {
      session.expires_at = Date.now() + SESSION_DURATION;
      await AsyncStorage.setItem('delivery_person_session', JSON.stringify(session));
    }

    return session;
  } catch (error) {
    console.error('[DeliveryAuth] Error getting stored delivery session:', error);
    return null;
  }
};

// Check if delivery person is authenticated
export const isDeliveryPersonAuthenticated = async (): Promise<boolean> => {
  try {
    const storedSession = await getStoredDeliverySession();
    if (!storedSession) {
      return false;
    }


    // First check if session is valid locally (not expired)
    if (!storedSession.delivery_person_id || !storedSession.email) {
      await clearDeliverySession();
      return false;
    }

    // Check if session is expired
    if (storedSession.expires_at && Date.now() > storedSession.expires_at) {
      await clearDeliverySession();
      return false;
    }

    // Session is valid locally - trust it for offline access
    // Only verify with Supabase if we have network connectivity (with timeout)
    try {
      // Add timeout to prevent hanging
      const verificationPromise = supabase
        .from('delivery_persons')
        .select('id')
        .eq('id', storedSession.delivery_person_id)
        .maybeSingle();
      
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Verification timeout')), 3000)
      );
      
      const { data, error } = await Promise.race([
        verificationPromise,
        timeoutPromise
      ]) as any;

      if (error) {
        // For network errors, trust the local session
        return true;
      }

      if (!data) {
        await clearDeliverySession();
        return false;
      }

      return true;
    } catch (supabaseError: any) {
      // Network error or timeout - trust local session if it's valid
      return true;
    }
  } catch (error: any) {
    console.error('[DeliveryAuth] Error checking authentication:', error);
    return false;
  }
};

// Clear delivery session
export const clearDeliverySession = async () => {
  try {
    const AsyncStorage = (await import('@react-native-async-storage/async-storage')).default;
    await AsyncStorage.removeItem('delivery_person_session');

    // NOTE: We DO NOT clear OneSignal external user ID on logout
    // Removing the alias can cause the device to unsubscribe from OneSignal
    // The external ID will be overwritten when a new user logs in
    // clearExternalUserId(); // REMOVED
  } catch (error) {
    console.error('[DeliveryAuth] Error clearing delivery session:', error);
  }
};

// Get current session data
export const getCurrentSession = async () => {
  return await getStoredDeliverySession();
};

// Logout delivery person
export const logoutDeliveryPerson = async () => {
  await clearDeliverySession();
};
