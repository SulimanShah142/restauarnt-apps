import { supabase } from './supabase';
import { customAuthWrapper } from './custom-auth-wrapper';
import { getDatabase } from '../db';

// Helper function to delete from IndexedDB (web only)
const deleteFromIndexedDB = async (storeName: string, id: string): Promise<void> => {
  try {
    
    return new Promise((resolve, reject) => {
      const request = indexedDB.open('AdminsAppDB');
      
      request.onerror = () => {
        console.error('[IndexedDB Delete] Error opening database:', request.error);
        reject(request.error);
      };
      
      request.onsuccess = () => {
        const db = request.result;
        
        // Check if store exists
        if (!db.objectStoreNames.contains(storeName)) {
          console.warn('[IndexedDB Delete] Store not found:', storeName);
          db.close();
          resolve(); // Resolve anyway since store doesn't exist
          return;
        }
        
        const transaction = db.transaction(storeName, 'readwrite');
        const store = transaction.objectStore(storeName);
        const deleteRequest = store.delete(id);
        
        deleteRequest.onsuccess = () => {
          db.close();
          resolve();
        };
        
        deleteRequest.onerror = () => {
          console.error('[IndexedDB Delete] Error deleting:', deleteRequest.error);
          db.close();
          reject(deleteRequest.error);
        };
      };
    });
  } catch (error) {
    console.error('[IndexedDB Delete] Error:', error);
    throw error;
  }
};

// Helper function to clear entire IndexedDB store (web only)
export const clearIndexedDBStore = async (storeName: string): Promise<void> => {
  try {

    return new Promise((resolve, reject) => {
      const request = indexedDB.open('AdminsAppDB');

      request.onerror = () => {
        console.error('[IndexedDB Clear] Error opening database:', request.error);
        reject(request.error);
      };

      request.onsuccess = () => {
        const db = request.result;

        // Check if store exists
        if (!db.objectStoreNames.contains(storeName)) {
          console.warn('[IndexedDB Clear] Store not found:', storeName);
          db.close();
          resolve(); // Resolve anyway since store doesn't exist
          return;
        }

        const transaction = db.transaction(storeName, 'readwrite');
        const store = transaction.objectStore(storeName);
        const clearRequest = store.clear();

        clearRequest.onsuccess = () => {
          db.close();
          resolve();
        };

        clearRequest.onerror = () => {
          console.error('[IndexedDB Clear] Error clearing store:', clearRequest.error);
          db.close();
          reject(clearRequest.error);
        };
      };
    });
  } catch (error) {
    console.error('[IndexedDB Clear] Error:', error);
    throw error;
  }
};

// Helper function to completely delete and recreate IndexedDB (web only)
export const recreateIndexedDB = async (): Promise<void> => {
  try {
    
    return new Promise((resolve, reject) => {
      const deleteRequest = indexedDB.deleteDatabase('AdminsAppDB');
      
      deleteRequest.onsuccess = () => {
        resolve();
      };
      
      deleteRequest.onerror = () => {
        console.error('[IndexedDB Recreate] Error deleting database:', deleteRequest.error);
        reject(deleteRequest.error);
      };
    });
  } catch (error) {
    console.error('[IndexedDB Recreate] Error:', error);
    throw error;
  }
};

// Validate if the user is authenticated via custom auth
const validateCustomAuth = async (): Promise<boolean> => {
  return await customAuthWrapper.isAuthenticated();
};

// Get the authenticated admin user from custom auth session
const getAuthenticatedUser = async () => {
  return await customAuthWrapper.getAuthenticatedUser();
};

// Helper to sync Supabase data with local database
const syncWithLocalDb = async (tableName: string, data: any[]) => {
  try {
    const db = await getDatabase();
    if (!db) return;
    
    // Map table names to database store names
    const storeMap: Record<string, string> = {
      'restaurants': 'restaurants',
      'menu_items': 'menu_items',
      'menu_categories': 'menu_categories',
      'orders': 'orders',
      'delivery_persons': 'delivery_persons',
      'delivery_assignments': 'delivery_assignments',
      'admins': 'admins',
      'feedback': 'feedback',
      'reviews': 'reviews',
      'advertisements': 'advertisements',
      'app_settings': 'app_settings',
      'notifications': 'notifications',
    };
    
    const storeName = storeMap[tableName];
    if (!storeName) return;
    
    
    // Save each record to local database
    for (const record of data) {
      switch (tableName) {
        case 'restaurants':
          await db.getRestaurantById(record.id); // This will save via putRecord internally if needed
          break;
        default:
          // For other tables, we'd need specific methods
          break;
      }
    }
  } catch (error) {
    console.warn('[AdminApiService] ⚠️ Failed to sync to local database:', error);
    // Don't throw - this is a cache, not critical
  }
};

// API Service for Admin Communication with custom auth validation
export const adminApiService = {
  // Restaurants API
  restaurants: {
    getAll: async () => {
      if (!(await validateCustomAuth())) {
        throw new Error('Unauthorized: Invalid or expired session');
      }

      const { data, error } = await supabase
        .from('restaurants')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        throw new Error(`Database error: ${error.message}`);
      }

      return data;
    },

    getById: async (id: string) => {
      if (!(await validateCustomAuth())) {
        throw new Error('Unauthorized: Invalid or expired session');
      }

      const { data, error } = await supabase
        .from('restaurants')
        .select('*')
        .eq('id', id);

      if (error) {
        throw new Error(`Database error: ${error.message}`);
      }

      if (!data || data.length === 0) {
        throw new Error(`Restaurant not found: ${id}`);
      }

      // Return first item from array
      return data[0];
    },

    create: async (restaurantData: any) => {
      return await customAuthWrapper.insertWithAuth(
        'restaurants',
        restaurantData,
        '*',
        'Unauthorized: Invalid or expired session'
      );
    },

    update: async (id: string, restaurantData: any) => {

      // Don't allow updating the owner_id field for security reasons
      // (owner_id should only be set during creation)
      delete restaurantData.owner_id;

      try {
        const result = await customAuthWrapper.updateWithAuth<Record<string, any>>(
          'restaurants',
          id,
          restaurantData,
          '*',
          'id',
          'Unauthorized: Invalid or expired session'
        );

        if (!result) {
          console.error('[AdminApiService] ❌ Update returned no result');
          throw new Error('No restaurant found with the specified ID');
        }


        // Sync to local database
        try {
          const { getDatabase } = await import('../db');
          const db = await getDatabase();
          await db.updateRestaurant(id, restaurantData);
        } catch (syncError) {
          console.warn('[AdminApiService] ⚠️ Failed to sync to local database:', syncError);
        }

        return result;
      } catch (error) {
        console.error('[AdminApiService] ❌ Update failed:', error);
        throw error;
      }
    },

    delete: async (id: string) => {
      // First delete related menu items and categories to avoid foreign key constraints
      try {

        // Use the service role client if available for admin operations
        const { supabaseService }: any  = await import('./supabase-config.js');
        const client = supabaseService || supabase as any;

        // 1. FETCH ALL MENU ITEMS TO DELETE THEIR IMAGES FIRST
        const { data: menuItems } = await client
          .from('menu_items')
          .select('image_url')
          .eq('restaurant_id', id);

        if (menuItems && menuItems.length > 0) {
          // Extract image paths and delete from storage
          const imagePaths = menuItems
            .map((item : any) => item.image_url?.split('zootzoot/')[1])
            .filter((path: any) => path && path.length > 0) as string[];

          if (imagePaths.length > 0) {
            const { error: storageError } = await client.storage
              .from('zootzoot')
              .remove(imagePaths);

            if (storageError) {
              console.error('Error deleting menu item images from storage:', storageError.message);
            } else {
              console.log('Menu item images deleted from storage');
            }
          }
        }

        // 2. FETCH ALL CATEGORIES TO DELETE THEIR IMAGES FIRST
        const { data: categories } = await client
          .from('menu_categories')
          .select('image_url')
          .eq('restaurant_id', id);

        if (categories && categories.length > 0) {
          // Extract image paths and delete from storage
          const imagePaths = categories
            .map((cat: any) => cat.image_url?.split('zootzoot/')[1])
            .filter((path: any) => path && path.length > 0) as string[];

          if (imagePaths.length > 0) {
            const { error: storageError } = await client.storage
              .from('zootzoot')
              .remove(imagePaths);

            if (storageError) {
              console.error('Error deleting category images from storage:', storageError.message);
            } else {
              console.log('Category images deleted from storage');
            }
          }
        }

        // 3. DELETE MENU ITEMS ASSOCIATED WITH THIS RESTAURANT
        const { error: menuItemsError, count: menuItemsCount } = await client
          .from('menu_items')
          .delete()
          .eq('restaurant_id', id);

        if (menuItemsError) {
          console.error('Error deleting menu items:', menuItemsError);
          // Continue with restaurant deletion even if menu items deletion fails
        } else {
          console.log(`Deleted ${menuItemsCount} menu items`);
        }

        // 4. DELETE CATEGORIES ASSOCIATED WITH THIS RESTAURANT
        const { error: categoriesError, count: categoriesCount } = await client
          .from('menu_categories')
          .delete()
          .eq('restaurant_id', id);

        if (categoriesError) {
          console.error('Error deleting categories:', categoriesError);
          // Continue with restaurant deletion even if categories deletion fails
        } else {
          console.log(`Deleted ${categoriesCount} categories`);
        }

        // 5. NOW DELETE THE RESTAURANT
        const result = await customAuthWrapper.deleteWithAuth(
          'restaurants',
          id,
          'id',
          'Unauthorized: Invalid or expired session'
        );

        return result;
      } catch (error) {
        console.error('Error in restaurant deletion:', error);
        throw error;
      }
    }
  },

  // Menu Items API
  menuItems: {
    getAll: async () => {
      return await customAuthWrapper.selectWithAuth(
        supabase
          .from('menu_items')
          .select('*')
          .order('created_at', { ascending: false }),
        'Unauthorized: Invalid or expired session'
      );
    },

    getByRestaurantId: async (restaurantId: string) => {
      return await customAuthWrapper.selectWithAuth(
        supabase
          .from('menu_items')
          .select('*')
          .eq('restaurant_id', restaurantId)
          .order('name', { ascending: true }),
        'Unauthorized: Invalid or expired session'
      );
    },

    create: async (menuItemData: any) => {
      // Validate restaurant_id is present and valid
      if (!menuItemData.restaurant_id || menuItemData.restaurant_id === '' || menuItemData.restaurant_id === 'null' || menuItemData.restaurant_id === 'undefined') {
        console.error('[AdminAPI] ❌ ERROR: menu item creation missing restaurant_id:', menuItemData);
        throw new Error('restaurant_id is required for menu item creation');
      }

      // Filter out empty strings and convert them to null for UUID fields
      const cleanedData: any = {};
      for (const [key, value] of Object.entries(menuItemData)) {
        if (value === '' || value === null || value === undefined) {
          // Convert empty strings to null for UUID fields (but NOT restaurant_id)
          if (['menu_category_id', 'id'].includes(key)) {
            cleanedData[key] = null;
          } else if (key !== 'restaurant_id') {
            // Keep other empty values as null
            cleanedData[key] = null;
          } else {
            // Keep restaurant_id as-is (already validated above)
            cleanedData[key] = value;
          }
        } else {
          cleanedData[key] = value;
        }
      }


      return await customAuthWrapper.insertWithAuth(
        'menu_items',
        cleanedData,
        '*',
        'Unauthorized: Invalid or expired session'
      );
    },

    update: async (id: string, menuItemData: any) => {
      // Filter out empty strings and convert them to null for UUID fields
      const cleanedData: any = {};
      for (const [key, value] of Object.entries(menuItemData)) {
        if (value === '' || value === null || value === undefined) {
          // Convert empty strings to null for UUID fields
          if (['restaurant_id', 'menu_category_id'].includes(key)) {
            cleanedData[key] = null;
          }
        } else {
          cleanedData[key] = value;
        }
      }
      
      
      return await customAuthWrapper.updateWithAuth(
        'menu_items',
        id,
        cleanedData,
        '*',
        'id',
        'Unauthorized: Invalid or expired session'
      );
    },

    delete: async (id: string) => {

      // First, get the menu item to get its image URL
      const { data: menuItem } = await supabase
        .from('menu_items')
        .select('image_url')
        .eq('id', id)
        .single();

      // If there's an image, delete it from storage first
      if (menuItem && menuItem.image_url && menuItem.image_url.includes('zootzoot/')) {
        const filePath = menuItem.image_url.split('zootzoot/')[1];

        if (filePath) {
          const { error: storageError } = await supabase.storage
            .from('zootzoot')
            .remove([filePath]);

          if (storageError) {
            console.error('Error deleting menu item image from storage:', storageError.message);
          } else {
            console.log('Menu item image deleted from storage');
          }
        }
      }

      const result = await customAuthWrapper.deleteWithAuth(
        'menu_items',
        id,
        'id',
        'Unauthorized: Invalid or expired session'
      );
      return result;
    }
  },

  // Categories API
  categories: {
    getAll: async () => {
      return await customAuthWrapper.selectWithAuth(
        supabase
          .from('menu_categories')
          .select(`
          *,
          restaurants (
            id,
            name
          )
        `)
          .order('name', { ascending: true }),
        'Unauthorized: Invalid or expired session'
      );
    },

    getByRestaurantId: async (restaurantId: string) => {
      return await customAuthWrapper.selectWithAuth(
        supabase
          .from('menu_categories')
          .select(`
          *,
          restaurants (
            id,
            name
          )
        `)
          .eq('restaurant_id', restaurantId)
          .order('name', { ascending: true }),
        'Unauthorized: Invalid or expired session'
      );
    },

    create: async (categoryData: any) => {
      return await customAuthWrapper.insertWithAuth(
        'menu_categories',
        categoryData,
        '*',
        'Unauthorized: Invalid or expired session'
      );
    },

    update: async (id: string, categoryData: any) => {
      return await customAuthWrapper.updateWithAuth(
        'menu_categories',
        id,
        categoryData,
        '*',
        'id',
        'Unauthorized: Invalid or expired session'
      );
    },

    delete: async (id: string) => {
      // First delete related menu items to avoid foreign key constraints
      try {

        // Use the service role client if available for admin operations
        const { supabaseService } : any = await import('./supabase-config.js');
        const client = supabaseService || supabase;

        // 1. FETCH ALL MENU ITEMS TO DELETE THEIR IMAGES FIRST
        const { data: menuItems } = await client
          .from('menu_items')
          .select('image_url')
          .eq('menu_category_id', id);

        if (menuItems && menuItems.length > 0) {
          // Extract image paths and delete from storage
          const imagePaths = menuItems
            .map((item : any) => item.image_url?.split('zootzoot/')[1])
            .filter((path: any) => path && path.length > 0) as string[];

          if (imagePaths.length > 0) {
            const { error: storageError } = await client.storage
              .from('zootzoot')
              .remove(imagePaths);

            if (storageError) {
              console.error('Error deleting menu item images from storage:', storageError.message);
            } else {
              console.log('Menu item images deleted from storage');
            }
          }
        }

        // 2. DELETE MENU ITEMS ASSOCIATED WITH THIS CATEGORY
        const { error: menuItemsError, count: menuItemsCount } = await client
          .from('menu_items')
          .delete()
          .eq('menu_category_id', id);

        if (menuItemsError) {
          console.error('Error deleting menu items in category:', menuItemsError);
          // Continue with category deletion even if menu items deletion fails
        } else {
          console.log(`Deleted ${menuItemsCount} menu items in category`);
        }

        // 3. NOW DELETE THE CATEGORY
        const result = await customAuthWrapper.deleteWithAuth(
          'menu_categories',
          id,
          'id',
          'Unauthorized: Invalid or expired session'
        );

        return result;
      } catch (error) {
        console.error('Error in category deletion:', error);
        throw error;
      }
    }
  },


  // Delivery Personnel API
  deliveryPersonnel: {
    getAll: async () => {
      return await customAuthWrapper.selectWithAuth(
        supabase
          .from('delivery_persons')
          .select(`
            *,
            users:user_id (
              name,
              email,
              phone
            )
          `)
          .order('created_at', { ascending: false }),
        'Unauthorized: Invalid or expired session'
      );
    },

    // Check if current user is an admin using custom auth
    isAdmin: async (): Promise<boolean> => {
      // Use the custom admin authentication check
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      
      // If we have a Supabase session, check if user exists in admins table
      if (!sessionError && session) {
        const { data, error } = await supabase
          .from('admins')
          .select('id')
          .eq('user_id', session.user.id)
          .single();

        return !!data && !error;
      }
      
      // If no Supabase session, check custom admin session
      try {
        const authModule = await import('@/lib/admin-auth');
        const isAuthenticated = await authModule.isAdminAuthenticated();
        return isAuthenticated;
      } catch (error) {
        console.error('Error checking custom admin authentication:', error);
        return false;
      }
    },

    create: async (deliveryPersonData: any, imageUrl?: string) => {
      
      // Generate a UUID for the new user if not provided
      const userId = deliveryPersonData.id || `user-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      
      
      // Use the custom auth wrapper to perform the insertion with proper authentication
      const result = await customAuthWrapper.insertWithAuth<Record<string, any>>(
        'delivery_persons',
        {
          // Map the delivery person data to the delivery_persons table schema
          user_id: userId, // Set the generated user_id
          name: deliveryPersonData.name,
          email: deliveryPersonData.email,
          phone: deliveryPersonData.phone || null,
          address: deliveryPersonData.address || null,
          vehicle_type: deliveryPersonData.vehicle_type || null,
          license_plate: deliveryPersonData.license_plate || null,
          is_available: deliveryPersonData.is_available !== undefined ? deliveryPersonData.is_available : true,
          current_latitude: deliveryPersonData.current_latitude || null,
          current_longitude: deliveryPersonData.current_longitude || null,
          image_url: imageUrl || null,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        },
        '*',
        'Unauthorized: Only admins can create delivery personnel'
      );

      
      // The trigger auto_create_profile_for_delivery_person will create the profile automatically

      // If a temporary password was provided, hash it and update the record
      if (deliveryPersonData.temp_password) {
        try {
          // Import expo-crypto for password hashing
          const crypto = await import('expo-crypto');
          const hashedPassword = await crypto.digestStringAsync(
            crypto.CryptoDigestAlgorithm.SHA256,
            deliveryPersonData.temp_password
          );

          // Update the delivery person record with the hashed password
          const { error: updateError } = await supabase
            .from('delivery_persons')
            .update({ password_hash: hashedPassword })
            .eq('id', result.id);

          if (updateError) {
            console.error('Error updating delivery person with password:', updateError);
          } else {
            console.log('Delivery person password updated successfully');
          }
        } catch (hashError) {
          console.error('Error hashing password:', hashError);
        }
      }

      return result;
    },

    updateStatus: async (id: string, is_available: boolean) => {
      return await customAuthWrapper.updateWithAuth(
        'delivery_persons',
        id,
        { is_available },
        `
          *
        `,
        'id',
        'Unauthorized: Invalid or expired session'
      );
    },

    delete: async (id: string) => {
      // First, check if the user is authenticated as an admin
      if (!(await validateCustomAuth())) {
        throw new Error('Unauthorized: Invalid or expired session');
      }

      // Check if there are any active orders assigned to this delivery person
      const { data: activeOrders, error: ordersError } = await supabase
        .from('orders')
        .select('id, status')
        .eq('delivery_person_id', id)
        .in('status', ['confirmed', 'preparing', 'ready', 'on_the_way']);

      if (ordersError) {
        console.error('Error checking active orders:', ordersError);
        throw new Error(`Database error: ${ordersError.message}`);
      }

      // If there are active orders, prevent deletion
      if (activeOrders && activeOrders.length > 0) {
        throw new Error('Cannot delete delivery person with active orders. Please reassign active orders first.');
      }

      // Proceed with deletion from Supabase
      const { error } = await supabase
        .from('delivery_persons')
        .delete()
        .eq('id', id);

      if (error) {
        console.error('Error deleting delivery person from Supabase:', error);
        throw new Error(`Database error: ${error.message}`);
      }

      // Wait for Supabase to propagate the deletion
      await new Promise(resolve => setTimeout(resolve, 3000));

      // Also delete from local database (different implementations for SQLite vs IndexedDB)
      try {
        const { getDatabase } = await import('@/db');
        const db = await getDatabase();


        // Check if this is SQLite (has runAsync with SQL) or IndexedDB
        if ('runAsync' in db) {
          // Try to detect if this is SQLite (mobile) or IndexedDB (web)
          // IndexedDB will throw an error when trying to use SQL
          try {
            await db.runAsync(
              `DELETE FROM delivery_persons WHERE id = ?`,
              [id]
            );
          } catch (sqliteError: any) {
            // If SQL fails, this is likely IndexedDB - use direct IndexedDB deletion
            if (sqliteError.name === 'NotFoundError' || sqliteError.message?.includes('object store')) {
              await deleteFromIndexedDB('delivery_persons', id);
            } else {
              throw sqliteError;
            }
          }
        }
      } catch (localError) {
        console.error('[DeleteDeliveryPerson] Error deleting from local database:', localError);
        // Don't throw - Supabase deletion was successful
      }

      return { success: true };
    }
  },

  // Orders API - Extended
  orders: {
    getAll: async () => {
      return await customAuthWrapper.selectWithAuth(
        supabase
          .from('orders')
          .select(`
          *,
          restaurants (
            id,
            name
          ),
          order_items (
            id,
            menu_item_id,
            quantity,
            price,
            menu_items (
              name,
              image_url
            )
          ),
          delivery_persons (
            id,
            license_plate,
            vehicle_type,
            is_available,
            user_id
          )
        `)
          .order('created_at', { ascending: false }),
        'Unauthorized: Invalid or expired session'
      );
    },

    getById: async (id: string) => {
      return await customAuthWrapper.selectWithAuth(
        supabase
          .from('orders')
          .select(`
          *,
          restaurants (
            id,
            name
          ),
          order_items (
            id,
            menu_item_id,
            quantity,
            price,
            menu_items (
              name,
              image_url
            )
          ),
          delivery_persons (
            id,
            license_plate,
            vehicle_type,
            is_available,
            user_id
          )
        `)
          .eq('id', id)
          .single(),
        'Unauthorized: Invalid or expired session'
      );
    },

    updateStatus: async (orderId: string, status: string) => {

      // Validate auth first
      if (!(await validateCustomAuth())) {
        console.error('[Orders API] ❌ Unauthorized');
        throw new Error('Unauthorized: Invalid or expired session');
      }

      // Get the old status before updating
      const { data: oldOrder } = await supabase
        .from('orders')
        .select('status, user_id')
        .eq('id', orderId)
        .single();

      // If marking as delivered, generate OTP
      const updateData: any = {
        status,
        updated_at: new Date().toISOString()
      };

      if (status === 'delivered') {
        // Generate 6-digit OTP
        const generatedOtp = Math.floor(100000 + Math.random() * 900000).toString();
        updateData.delivery_otp = generatedOtp;
        updateData.delivery_otp_verified = false;
      }

      // Direct UPDATE
      const { data, error } = await supabase
        .from('orders')
        .update(updateData)
        .eq('id', orderId)
        .select()
        .single();

      if (error) {
        console.error('[Orders API] ❌ Error updating status:', error);
        throw new Error(`Database error: ${error.message}`);
      }

      // ============================================================
      // 📬 NOTIFICATIONS ARE NOW SENT VIA DATABASE TRIGGERS
      // No need to send from app - triggers handle it automatically
      // ============================================================
      if (oldOrder && oldOrder.status !== status) {
        console.log('[Orders API] Status changed - database triggers will send notifications');
        // Notifications are now handled by database triggers (notify_users_order_status_change)
      }

      return data;
    },

    cancelOrder: async (orderId: string, reason?: string) => {
      return await customAuthWrapper.updateWithAuth(
        'orders',
        orderId,
        {
          status: 'cancelled',
          cancellation_reason: reason || 'Cancelled by admin'
        },
        '*',
        'id',
        'Unauthorized: Invalid or expired session'
      );
    },

    rejectOrder: async (orderId: string, reason?: string) => {
      return await customAuthWrapper.updateWithAuth(
        'orders',
        orderId,
        {
          status: 'rejected',
          rejection_reason: reason || 'Rejected by admin'
        },
        '*',
        'id',
        'Unauthorized: Invalid or expired session'
      );
    },
    
    // NEW: Assign order to delivery person
    assignToDeliveryPerson: async (orderId: string, deliveryPersonId: string) => {

      if (!(await validateCustomAuth())) {
        console.error('❌ Authentication failed: Invalid or expired session');
        throw new Error('Unauthorized: Invalid or expired session');
      }

      // Step 1: Get delivery person's details from delivery_persons table
      // Note: deliveryPersonId is now the delivery_persons.id directly (not user_id)

      const { data: allDeliveryPersons, error: checkError } = await supabase
        .from('delivery_persons')
        .select('id, user_id, name');

      if (checkError) {
        console.error('⚠️  Could not check delivery_persons table:', checkError.message);
      } else {
        console.log('Available delivery persons:', allDeliveryPersons);
      }

      const { data: deliveryPersonData, error: deliveryPersonError } = await supabase
        .from('delivery_persons')
        .select('id, user_id, name, phone')
        .eq('id', deliveryPersonId)  // Search by delivery_persons.id directly
        .maybeSingle();

      if (deliveryPersonError) {
        console.error('❌ STEP 1 FAILED: Error fetching delivery person');
        console.error('   Error:', deliveryPersonError);
        throw new Error(`Database error: ${deliveryPersonError.message}`);
      }

      if (!deliveryPersonData) {
        console.error('❌ STEP 1 FAILED: No delivery person record found');
        console.error('   Searched delivery_persons.id:', deliveryPersonId);
        throw new Error(`Delivery person not found: ${deliveryPersonId}`);
      }

      const deliveryPersonIdFinal = deliveryPersonData.id;
      const deliveryPersonUserId = deliveryPersonData.user_id; // May be null
      const deliveryPersonName = deliveryPersonData.name || 'Unknown';
      
      console.log('[AssignDelivery] Delivery person found:', {
        id: deliveryPersonIdFinal,
        user_id: deliveryPersonUserId || 'NULL (no linked user account)',
        name: deliveryPersonName
      });


      // Step 2: Get order details with all related data

      // Fetch order data first
      const { data: orderData, error: orderFetchError } = await supabase
        .from('orders')
        .select('*')
        .eq('id', orderId)
        .single();

      if (orderFetchError) {
        console.error('❌ STEP 2 FAILED: Error fetching order details');
        console.error('   Error:', orderFetchError);
        console.error('   Code:', orderFetchError.code);
        console.error('   Message:', orderFetchError.message);
        throw new Error(`Database error: ${orderFetchError.message}`);
      }

      // Fetch user data separately (avoids relationship requirement)
      let userData = null;
      if (orderData.user_id) {
        const { data: fetchedUser, error: userError } = await supabase
          .from('profiles')  // Use 'profiles' table instead of 'users'
          .select('id, name, phone')
          .eq('id', orderData.user_id);

        if (userError) {
          console.error('⚠️  Warning: Could not fetch user data:', userError.message);
        }
        userData = fetchedUser?.[0] || null;  // Get first result or null
      }

      // Fetch restaurant data separately (avoids relationship requirement)
      let restaurantData = null;
      if (orderData.restaurant_id) {
        const { data: fetchedRestaurant, error: restaurantError } = await supabase
          .from('restaurants')
          .select('id, name, address, latitude, longitude')
          .eq('id', orderData.restaurant_id)
          .single();
        
        if (restaurantError && restaurantError.code !== 'PGRST116') {
          console.error('⚠️  Warning: Could not fetch restaurant data:', restaurantError.message);
        }
        restaurantData = fetchedRestaurant;
      }

      // Combine the data to match the expected structure
      const orderDataWithRelations = {
        ...orderData,
        user: userData,
        restaurant: restaurantData
      };


      // Step 3: Update orders table

      // Update orders table with the delivery_persons.id (NOT the auth user ID)
      const { error: updateError } = await supabase
        .from('orders')
        .update({
          delivery_person_id: deliveryPersonId, // Store the delivery_persons.id (foreign key)
          status: 'confirmed', // Keep status as confirmed (delivery person will change to on_the_way when they pick up)
          updated_at: new Date().toISOString()
        })
        .eq('id', orderId);

      if (updateError) {
        console.error('❌ STEP 3 FAILED: Error updating order');
        console.error('   Error:', updateError);
        console.error('   Code:', updateError.code);
        console.error('   Message:', updateError.message);
        console.error('   Hint: Make sure deliveryPersonId is from delivery_persons.id, not auth.users.id');
        console.error('   deliveryPersonId (delivery_persons.id):', deliveryPersonId);
        console.error('   deliveryPersonUserId (auth.users.id):', deliveryPersonUserId);
        throw new Error(`Database error: ${updateError.message}`);
      }

      // Fetch the updated order separately (without relationships)
      const { data: updatedOrder, error: fetchUpdateError } = await supabase
        .from('orders')
        .select('*')
        .eq('id', orderId)
        .single();

      if (fetchUpdateError) {
        console.error('⚠️  Warning: Could not fetch updated order:', fetchUpdateError.message);
      }


      // Step 4: Insert into delivery_assignments table

      // Insert into delivery_assignments table (let database generate UUID)
      // Note: Use 'pending' status as it's in the CHECK constraint
      // Note: Set user_id to NULL to avoid foreign key violation (users table vs profiles table)
      // Note: order_number column doesn't exist in delivery_assignments table
      const { data: assignmentData, error: assignmentError } = await supabase
        .from('delivery_assignments')
        .insert({
          order_id: orderId,
          delivery_person_id: deliveryPersonId, // Use the delivery_persons.id
          user_id: null,  // Set to NULL (foreign key to users table which may not have this user)
          restaurant_id: orderData.restaurant_id, // Get from the fetched order data
          status: 'pending',  // Valid status from constraint
          total_amount: orderData.total_amount, // Get from the fetched order data
          delivery_address: orderData.delivery_address, // Get from the fetched order data
          delivery_notes: orderData.delivery_notes || '', // Get from the fetched order data
          phone_number: orderData.user?.phone || '', // Get user's phone from joined data
          assigned_at: new Date().toISOString(),
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .select('id')
        .single();

      const assignmentId = assignmentData?.id;

      if (assignmentError) {
        console.error('========================================');
        console.error('❌ STEP 4 FAILED: Error creating delivery assignment');
        console.error('   Error:', assignmentError);
        console.error('   Code:', assignmentError.code);
        console.error('   Message:', assignmentError.message);
        console.error('   Details:', assignmentError.details);
        console.error('   Hint:', assignmentError.hint);
        console.error('========================================');
        console.error('💡 TROUBLESHOOTING:');
        console.error('   1. Run FIX_DELIVERY_ASSIGNMENTS_INSERT.sql in Supabase SQL Editor');
        console.error('   2. Check if delivery_assignments table has all required columns');
        console.error('   3. Check RLS policies allow INSERT');
        console.error('   4. Check realtime is enabled for delivery_assignments');
        console.error('========================================');
        // Throw error so admin knows assignment failed
        throw new Error(`Failed to create delivery assignment: ${assignmentError.message}`);
      } else {
        console.log('Delivery assignment created successfully with ID:', assignmentId);
      }

      // Final summary
      console.log('✅ Order assigned to delivery person successfully');

      return updatedOrder;
    }
  },

  // Delivery Tracking API
  deliveryTracking: {
    getAllActiveOrders: async () => {
      return await customAuthWrapper.selectWithAuth(
        supabase
          .from('orders')
          .select(`
          *,
          restaurants (
            id,
            name
          ),
          order_items (
            id,
            menu_item_id,
            quantity,
            price,
            menu_items (
              name,
              image_url
            )
          ),
          delivery_persons (
            id,
            license_plate,
            vehicle_type,
            is_available,
            user_id
          )
        `)
          .in('status', ['confirmed', 'preparing', 'ready', 'on_the_way', 'delivered'])
          .order('created_at', { ascending: false }),
        'Unauthorized: Invalid or expired session'
      );
    },

    updateOrderLocation: async (orderId: string, latitude: number, longitude: number) => {
      return await customAuthWrapper.updateWithAuth(
        'orders',
        orderId,
        {
          delivery_latitude: latitude,
          delivery_longitude: longitude
        },
        '*',
        'id',
        'Unauthorized: Invalid or expired session'
      );
    },

    assignDeliveryPerson: async (orderId: string, deliveryPersonUserId: string) => {
      return await adminApiService.orders.assignToDeliveryPerson(orderId, deliveryPersonUserId);
    }
  },

  // Settings API
  settings: {
    get: async () => {
      if (!(await validateCustomAuth())) {
        throw new Error('Unauthorized: Invalid or expired session');
      }

      const { data, error } = await supabase
        .from('app_settings')
        .select('*')
        .single();

      if (error && error.code !== 'PGRST116') { // PGRST116 means no rows returned
        throw new Error(`Database error: ${error.message}`);
      }

      // If no settings exist, return default values
      if (!data) {
        return {
          id: 'app-settings',
          constant_delivery_fee: 50.00,
          is_delivery_enabled: true,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        };
      }

      return data;
    },

    update: async (settingsData: any) => {
      if (!(await validateCustomAuth())) {
        throw new Error('Unauthorized: Invalid or expired session');
      }

      // Filter to only include columns that exist in the database
      // If you get an error about missing columns, run the SQL migration in add_app_settings_columns.sql
      const allowedColumns = [
        'id',
        'constant_delivery_fee',
        'base_delivery_fee',
        'per_km_fee',
        'minimum_order',
        'free_delivery_threshold',
        'delivery_fee_description',
        'admin_phone'
      ];

      const cleanedData: any = { id: 'app-settings' };
      for (const [key, value] of Object.entries(settingsData)) {
        if (allowedColumns.includes(key) && value !== undefined && value !== null) {
          cleanedData[key] = value;
        }
      }


      try {
        const { data, error } = await supabase
          .from('app_settings')
          .upsert(cleanedData)
          .select()
          .single();

        if (error) {
          // If the error is about missing columns, provide helpful message
          if (error.message.includes('constant_delivery_fee')) {
            throw new Error(
              'Missing database columns. Please run the SQL migration in add_app_settings_columns.sql in Supabase SQL Editor.'
            );
          }
          throw new Error(`Database error: ${error.message}`);
        }

        return data;
      } catch (error: any) {
        console.error('[AdminAPI] Error updating app_settings:', error);
        throw error;
      }
    }
  },

  // Feedback API
  feedback: {
    getAll: async () => {
      if (!(await validateCustomAuth())) {
        throw new Error('Unauthorized: Invalid or expired session');
      }

      const { data, error } = await supabase
        .from('feedback')
        .select(`
          *,
          profiles:user_id (email, full_name)
        `)
        .order('created_at', { ascending: false });

      if (error) {
        throw new Error(`Database error: ${error.message}`);
      }

      return data;
    },

    update: async (id: string, updates: any) => {
      if (!(await validateCustomAuth())) {
        throw new Error('Unauthorized: Invalid or expired session');
      }

      const { data, error } = await supabase
        .from('feedback')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) {
        throw new Error(`Database error: ${error.message}`);
      }

      return data;
    },

    delete: async (id: string) => {
      if (!(await validateCustomAuth())) {
        throw new Error('Unauthorized: Invalid or expired session');
      }

      const { error } = await supabase
        .from('feedback')
        .delete()
        .eq('id', id);

      if (error) {
        throw new Error(`Database error: ${error.message}`);
      }

      return { success: true };
    }
  },

  // Advertisements API
  advertisements: {
    getAll: async () => {
      return await customAuthWrapper.selectWithAuth(
        supabase
          .from('advertisements')
          .select('*')
          .order('priority', { ascending: false }),
        'Unauthorized: Invalid or expired session'
      );
    },

    create: async (adData: any) => {
      return await customAuthWrapper.insertWithAuth(
        'advertisements',
        adData,
        '*',
        'Unauthorized: Invalid or expired session'
      );
    },

    update: async (id: string, adData: any) => {
      return await customAuthWrapper.updateWithAuth(
        'advertisements',
        id,
        adData,
        '*',
        'id',
        'Unauthorized: Invalid or expired session'
      );
    },

    delete: async (id: string) => {
      return await customAuthWrapper.deleteWithAuth(
        'advertisements',
        id,
        'id',
        'Unauthorized: Invalid or expired session'
      );
    }
  },

  // Convenience methods to maintain backward compatibility
  getAllRestaurants: async () => {
    return await adminApiService.restaurants.getAll();
  },

  getAllMenuItems: async () => {
    return await adminApiService.menuItems.getAll();
  },

  getAllOrders: async () => {
    return await adminApiService.orders.getAll();
  },

  getAllDeliveryPersons: async () => {
    return await adminApiService.deliveryPersonnel.getAll();
  },

  getAllCategories: async (restaurantId?: string) => {
    if (restaurantId) {
      return await adminApiService.categories.getByRestaurantId(restaurantId);
    }
    return await adminApiService.categories.getAll();
  },

  getRestaurantById: async (id: string) => {
    return await adminApiService.restaurants.getById(id);
  },

  getCategoryById: async (id: string) => {
    // Since we don't have a direct method for getting a single category,
    // we'll get all categories and filter by ID
    const allCategories = await adminApiService.categories.getAll();
    return allCategories.find((cat: any) => cat.id === id);
  },

  getActiveOrders: async () => {
    return await adminApiService.deliveryTracking.getAllActiveOrders();
  },

  updateDeliveryPersonStatus: async (id: string, status: string) => {
    return await adminApiService.deliveryPersonnel.updateStatus(id, true);
  },

  updateOrderStatus: async (orderId: string, status: string) => {
    return await adminApiService.orders.updateStatus(orderId, status);
  },

  getAllFoodItems: async (categoryId?: string) => {
    // Get all menu items, potentially filtered by category if needed
    let items = await adminApiService.menuItems.getAll();

    if (categoryId) {
      items = items.filter((item: any) => item.menu_category_id === categoryId);
    }

    return items;
  },

  getFoodItemById: async (id: string) => {
    // Since we don't have a direct method for getting a single menu item,
    // we'll get all items and filter by ID
    const allItems = await adminApiService.menuItems.getAll();
    return allItems.find((item: any) => item.id === id);
  },

  updateFoodItem: async (id: string, updates: any) => {
    return await adminApiService.menuItems.update(id, updates);
  },

  createFoodItem: async (itemData: any) => {
    return await adminApiService.menuItems.create(itemData);
  },

  deleteFoodItem: async (id: string) => {
    return await adminApiService.menuItems.delete(id);
  },
  
  // NEW: Assign order to delivery person
  assignOrderToDeliveryPerson: async (orderId: string, deliveryPersonUserId: string) => {
    return await adminApiService.orders.assignToDeliveryPerson(orderId, deliveryPersonUserId);
  },

  // NEW: Create delivery person
  createDeliveryPerson: async (deliveryPersonData: any) => {
    return await adminApiService.deliveryPersonnel.create(deliveryPersonData);
  },

  // NEW: Get all deliveries
  getAllDeliveries: async () => {
    return await customAuthWrapper.selectWithAuth(
      supabase
        .from('orders')
        .select(`
          *,
          restaurants (
            id,
            name,
            address
          ),
          delivery_persons:delivery_person_id (
            id,
            license_plate,
            vehicle_type,
            is_available,
            users:user_id (
              name,
              email,
              phone
            )
          )
        `)
        .order('created_at', { ascending: false }),
      'Unauthorized: Invalid or expired session'
    );
  },

  // NEW: Get available delivery persons
  getAvailableDeliveryPersons: async () => {
    
    // Fetch delivery persons with user details
    // Note: Using explicit column list to avoid auto-expansion issues
    const result = await customAuthWrapper.selectWithAuth(
      supabase
        .from('delivery_persons')
        .select(`
          id,
          user_id,
          name,
          email,
          phone,
          is_available,
          vehicle_type,
          license_plate,
          rating,
          total_deliveries,
          image_url,
          current_latitude,
          current_longitude,
          current_location,
          created_at,
          updated_at,
          users:user_id (
            id,
            name,
            email,
            phone,
            image_url
          )
        `)
        .eq('is_available', true),
      'Unauthorized: Invalid or expired session'
    );

    if (result && result.length > 0) {
      result.forEach((dp: any) => {
        console.log('Available delivery person:', dp.name);
      });
    }

    return result;
  },

  // NEW: Delivery Statistics API
  deliveryStatistics: {
    getStatsByPersonId: async (deliveryPersonId: string) => {
      const { supabaseService }: any = await import('./supabase-config.js');
      const client = supabaseService || supabase;

      const { data, error } = await client
        .from('delivery_statistics')
        .select(`
          *,
          orders (
            id,
            total_amount,
            status,
            created_at
          ),
          users:user_id (
            name,
            email
          )
        `)
        .eq('delivery_person_id', deliveryPersonId)
        .order('delivery_date', { ascending: false });

      if (error) {
        throw new Error(`Database error: ${error.message}`);
      }

      return data;
    },

    getSummaryStats: async (deliveryPersonId: string) => {
      const { supabaseService } : any = await import('./supabase-config.js');
      const client = supabaseService || supabase;

      // Get count of successful deliveries
      const { count: successfulDeliveries, error: successError } = await client
        .from('delivery_statistics')
        .select('*', { count: 'exact', head: true })
        .eq('delivery_person_id', deliveryPersonId)
        .eq('delivery_status', 'delivered');

      if (successError) {
        throw new Error(`Database error: ${successError.message}`);
      }

      // Get count of cancelled deliveries
      const { count: cancelledDeliveries, error: cancelError } = await client
        .from('delivery_statistics')
        .select('*', { count: 'exact', head: true })
        .eq('delivery_person_id', deliveryPersonId)
        .eq('delivery_status', 'cancelled');

      if (cancelError) {
        throw new Error(`Database error: ${cancelError.message}`);
      }

      // Get total earnings
      const { data: earningsData, error: earningsError } = await client
        .from('delivery_statistics')
        .select('delivery_fee, delivery_tips')
        .eq('delivery_person_id', deliveryPersonId);

      if (earningsError) {
        throw new Error(`Database error: ${earningsError.message}`);
      }

      const totalEarnings = earningsData.reduce((sum : any, record : any) => {
        return sum + (record.delivery_fee || 0) + (record.delivery_tips || 0);
      }, 0);

      // Get average rating
      const { data: ratingsData, error: ratingsError } = await client
        .from('delivery_statistics')
        .select('delivery_rating')
        .eq('delivery_person_id', deliveryPersonId)
        .not('delivery_rating', 'is', null);

      if (ratingsError) {
        throw new Error(`Database error: ${ratingsError.message}`);
      }

      const avgRating = ratingsData.length > 0 
        ? ratingsData.reduce((sum : any, record : any) => sum + (record.delivery_rating || 0), 0) / ratingsData.length
        : 0;

      return {
        successfulDeliveries: successfulDeliveries || 0,
        cancelledDeliveries: cancelledDeliveries || 0,
        totalEarnings,
        avgRating: parseFloat(avgRating.toFixed(2)),
        totalDeliveries: (successfulDeliveries || 0) + (cancelledDeliveries || 0)
      };
    }
  }
};