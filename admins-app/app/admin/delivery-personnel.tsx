import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, Button, FlatList, StyleSheet, Alert, TouchableOpacity, ScrollView, Image, Pressable, Modal, ActivityIndicator, KeyboardAvoidingView, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Redirect, router, useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { Spacing } from '@/lib/design-system';

// Define TypeScript interfaces
interface DeliveryPerson {
  id: string;
  user_id?: string; // Reference to profiles table
  name: string;
  email: string;
  phone?: string;
  address?: string | null;
  is_available: boolean; // Using is_available instead of status
  current_latitude?: number;
  current_longitude?: number;
  image_url?: string | null;
  vehicle_type?: string;
  license_plate?: string;
  rating?: number;
  total_deliveries?: number;
  created_at: string;
  updated_at: string;
}

import { localDbService } from '@/lib/local-db-service';
import { getDatabase } from '@/db';
import { adminApiService, clearIndexedDBStore } from '@/lib/admin-api-service';
import { RequireAuth, useAuth } from '@/contexts/AuthContext';
import { useAdminAuth } from '@/contexts/AdminAuthContext';
import { supabase } from '@/lib/supabase';

// Helper function to generate UUID v4
const generateUUID = (): string => {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
};

function ManageDeliveryPersonnelContent() {
  const [deliveryPersons, setDeliveryPersons] = useState<DeliveryPerson[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<{[key: string]: boolean}>({}); // Track loading state per action

  // Use admin auth context
  const { isAdmin, isAdminLoading, checkAdminStatus } = useAdminAuth();
  
  // Debug logs

  // State for creating new delivery person
  const [newDeliveryPerson, setNewDeliveryPerson] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    address: '',  // Add address field
    picture: null as string | null,
    vehicle_type: '',
    license_plate: '',
    password: ''  // Add password field
  });
  
  // State for editing delivery person
  const [editingDeliveryPerson, setEditingDeliveryPerson] = useState<DeliveryPerson | null>(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [creating, setCreating] = useState(false);
  const [showPasswordChange, setShowPasswordChange] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  // Load delivery personnel from API
  useEffect(() => {
    if (isAdmin && !isAdminLoading) {
      loadDeliveryPersons();
    }
  }, [isAdmin, isAdminLoading]); // Add both as dependencies

  // Set up Realtime subscription for delivery_persons deletions (optional, non-blocking)
  useEffect(() => {

    const setupRealtimeSubscription = () => {
      try {
        const channel = supabase
          .channel('delivery-persons-sync')
          .on(
            'postgres_changes',
            {
              event: 'DELETE',
              schema: 'public',
              table: 'delivery_persons'
            },
            async (payload) => {
              const deletedId = payload.old.id;

              // Remove from local IndexedDB
              try {
                if (typeof (window as any).indexedDB !== 'undefined') {
                  const dbRequest = (window as any).indexedDB.open('AdminsAppDB');
                  dbRequest.onsuccess = () => {
                    const db = dbRequest.result;
                    if (db.objectStoreNames.contains('delivery_persons')) {
                      const transaction = db.transaction('delivery_persons', 'readwrite');
                      const store = transaction.objectStore('delivery_persons');
                      store.delete(deletedId);
                    }
                    db.close();
                  };
                }
              } catch (error) {
                console.error('[Realtime] ❌ Error removing from local DB:', error);
              }

              // Also remove from state to update UI immediately
              setDeliveryPersons(prev => prev.filter(dp => dp.id !== deletedId));
            }
          )
          .on(
            'postgres_changes',
            {
              event: '*', // Listen to all events (INSERT, UPDATE, DELETE)
              schema: 'public',
              table: 'delivery_persons'
            },
            async (payload) => {
              const oldRecord = payload.old as any;
              const newRecord = payload.new as any;
              // Reload the list to sync any changes (non-blocking)
              if (isAdmin && !isAdminLoading) {
                loadDeliveryPersons().catch(err => {
                  console.error('[Realtime] Error reloading after change:', err);
                });
              }
            }
          )
          .subscribe((status) => {
            if (status === 'SUBSCRIBED') {
              console.warn('[Realtime] ⚠️ Realtime subscription error - continuing without realtime updates');
              console.warn('[Realtime] Manual refresh will still work normally');
            } else if (status === 'TIMED_OUT') {
              console.warn('[Realtime] ⚠️ Realtime subscription timed out - continuing without realtime updates');
            } else if (status === 'CLOSED') {
              console.warn('[Realtime] ⚠️ Realtime connection closed - continuing without realtime updates');
            }
          });

        return channel;
      } catch (error) {
        console.error('[Realtime] ❌ Failed to setup realtime subscription:', error);
        console.warn('[Realtime] Continuing without realtime updates - manual refresh still works');
        return null;
      }
    };

    const channel = setupRealtimeSubscription();

    // Cleanup subscription on unmount
    return () => {
      if (channel) {
        supabase.removeChannel(channel);
      }
    };
  }, []);

  const loadDeliveryPersons = async (forceSync: boolean = false) => {

    try {
      // ALWAYS load directly from Supabase API (not local DB)
      
      const { data, error } = await supabase
        .from('delivery_persons')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        console.error('[LoadDeliveryPersons] ❌ Supabase error:', error);
        throw error;
      }


      // Transform the data to match the expected interface
      const transformedData = data.map((item: any) => {

        const transformed = {
          id: item.id,
          user_id: item.user_id,
          name: item.name || 'Unknown Delivery Person',
          email: item.email || 'No email',
          phone: item.phone || 'No phone',
          is_available: item.is_available ?? true,
          current_latitude: item.current_latitude,
          current_longitude: item.current_longitude,
          image_url: item.image_url,
          vehicle_type: item.vehicle_type,
          license_plate: item.license_plate,
          rating: item.rating,
          total_deliveries: item.total_deliveries,
          created_at: item.created_at,
          updated_at: item.updated_at,
        };

        return transformed;
      });

      setDeliveryPersons(transformedData);
      setLoading(false);
    } catch (error) {
      console.error('[LoadDeliveryPersons] ❌ Error loading delivery persons:', error);
      console.error('[LoadDeliveryPersons] 📋 Error type:', typeof error);
      console.error('[LoadDeliveryPersons] 📋 Error message:', (error as Error)?.message);
      console.error('[LoadDeliveryPersons] ========== END (with error) ==========');
      Alert.alert('Error', 'Failed to load delivery personnel');
      setLoading(false);
    }
  };

  // Function to pick an image for the delivery person
  const pickImage = async () => {
    // Request permission to access media library
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Sorry, we need camera roll permissions to make this work!');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [4, 3],
      quality: 1,
    });

    if (!result.canceled && result.assets && result.assets.length > 0 && result.assets[0]) {
      setNewDeliveryPerson(prev => ({
        ...prev,
        picture: result.assets[0].uri
      }));
    }
  };

  // Function to create a new delivery person
  const createDeliveryPerson = async () => {

    if (!newDeliveryPerson.firstName || !newDeliveryPerson.email || !newDeliveryPerson.password) {
      Alert.alert('Error', 'First name, email, and password are required');
      return;
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(newDeliveryPerson.email)) {
      Alert.alert('Error', 'Please enter a valid email address');
      return;
    }

    // Validate password length
    if (newDeliveryPerson.password.length < 6) {
      Alert.alert('Error', 'Password must be at least 6 characters long');
      return;
    }

    setCreating(true);

    try {
      let imageUrl = null;

      // Upload profile picture if provided
      if (newDeliveryPerson.picture) {
        const { uploadToZootZoot } = await import('@/lib/uploadToZootZoot');
        const uploadResult = await uploadToZootZoot(newDeliveryPerson.picture, 'delivery-persons');

        if (uploadResult.error) {
          throw new Error('Failed to upload profile picture: ' + uploadResult.error);
        }

        imageUrl = uploadResult.publicUrl;
      }

      // Generate UUID for the delivery person
      const deliveryPersonId = generateUUID();

      // Prepare the delivery person data
      const deliveryPersonData = {
        id: deliveryPersonId,
        name: `${newDeliveryPerson.firstName} ${newDeliveryPerson.lastName}`.trim(),
        email: newDeliveryPerson.email,
        phone: newDeliveryPerson.phone,
        address: newDeliveryPerson.address,
        vehicle_type: newDeliveryPerson.vehicle_type,
        license_plate: newDeliveryPerson.license_plate,
        temp_password: newDeliveryPerson.password,
        is_available: true,
        current_latitude: null,
        current_longitude: null,
        image_url: imageUrl,
      };


      // Call the API to create the delivery person record (Supabase)
      const result = await adminApiService.createDeliveryPerson(deliveryPersonData);

      // Note: admin-api-service already handles insertion to local IndexedDB
      // No need to insert again here - it would fail on web anyway (runAsync not supported on IndexedDB)

      // Reset the form
      setNewDeliveryPerson({
        firstName: '',
        lastName: '',
        email: '',
        phone: '',
        address: '',
        picture: null,
        vehicle_type: '',
        license_plate: '',
        password: ''
      });

      // BACKGROUND SYNC: Reload without blocking UI (ONLINE = full sync, OFFLINE = cached data)
      loadDeliveryPersons().catch((err) => {
        console.error('createDeliveryPerson - Background sync failed:', err);
      });

      Alert.alert('Success', 'Delivery person created successfully!');
    } catch (error: any) {
      console.error('Error creating delivery person:', error);
      console.error('Error details:', error instanceof Error ? error.message : error);

      // Check if it's an authentication error
      if (error.message?.includes('Unauthorized') || error.code === 'P0001') {
        Alert.alert('Authentication Error', 'Your session may have expired. Please log in again.', [
          { text: 'OK', onPress: () => router.replace('/admin/login') }
        ]);
      } else {
        Alert.alert('Error', 'Failed to create delivery person: ' + error.message);
      }
    } finally {
      setCreating(false);
    }
  };

  const updateStatus = async (id: string, is_available: boolean) => {

    try {
      await adminApiService.updateDeliveryPersonStatus(id, is_available ? 'available' : 'busy');

      // Refresh the list to get updated availability
      loadDeliveryPersons();
    } catch (error) {
      console.error('Error updating availability:', error);
      console.error('Error details:', error instanceof Error ? error.message : error);
      Alert.alert('Error', 'Failed to update delivery person availability');
    }
  };
  
  // Function to edit a delivery person
  const editDeliveryPerson = (deliveryPerson: DeliveryPerson) => {
    setEditingDeliveryPerson(deliveryPerson);
    setNewDeliveryPerson({
      firstName: deliveryPerson.name?.split(' ')[0] || '',
      lastName: deliveryPerson.name?.split(' ').slice(1).join(' ') || '',
      email: deliveryPerson.email || '',
      phone: deliveryPerson.phone || '',
      address: deliveryPerson.address || '',
      picture: deliveryPerson.image_url || null,
      vehicle_type: deliveryPerson.vehicle_type || '',
      license_plate: deliveryPerson.license_plate || '',
      password: ''
    });
    setNewPassword('');
    setConfirmPassword('');
    setShowPasswordChange(false);
    setShowEditModal(true);
  };
  
  // Function to update a delivery person
  const updateDeliveryPerson = async () => {
    if (!editingDeliveryPerson || !newDeliveryPerson.email) {
      Alert.alert('Error', 'Email is required');
      return;
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(newDeliveryPerson.email)) {
      Alert.alert('Error', 'Please enter a valid email address');
      return;
    }

    // Validate password if changing
    if (showPasswordChange && newPassword) {
      if (newPassword.length < 6) {
        Alert.alert('Error', 'Password must be at least 6 characters long');
        return;
      }
      if (newPassword !== confirmPassword) {
        Alert.alert('Error', 'Passwords do not match');
        return;
      }
    }

    if (!isAdmin) {
      Alert.alert('Error', 'Unauthorized: Only admins can update delivery personnel');
      return;
    }

    setCreating(true);

    try {
      let imageUrl = editingDeliveryPerson.image_url ?? null;

      // Upload profile picture if a new one was selected
      if (newDeliveryPerson.picture && newDeliveryPerson.picture !== (editingDeliveryPerson.image_url ?? null)) {
        const { uploadToZootZoot } = await import('@/lib/uploadToZootZoot');
        const uploadResult = await uploadToZootZoot(newDeliveryPerson.picture!, 'delivery-persons');

        if (uploadResult.error) {
          throw new Error('Failed to upload profile picture: ' + uploadResult.error);
        }

        imageUrl = uploadResult.publicUrl ?? null;
      }

      // Prepare the delivery person data
      const deliveryPersonData = {
        name: `${newDeliveryPerson.firstName} ${newDeliveryPerson.lastName}`.trim(),
        email: newDeliveryPerson.email,
        phone: newDeliveryPerson.phone ?? null,
        address: newDeliveryPerson.address ?? null,
        vehicle_type: newDeliveryPerson.vehicle_type ?? null,
        license_plate: newDeliveryPerson.license_plate ?? null,
        image_url: imageUrl,
        updated_at: new Date().toISOString()
      };

      // Update the delivery person record (Supabase)
      const { error: updateError } = await supabase
        .from('delivery_persons')
        .update(deliveryPersonData)
        .eq('id', editingDeliveryPerson.id);

      if (updateError) {
        console.error('updateDeliveryPerson - ❌ Supabase update failed:', updateError);
        throw updateError;
      }

      // LOCAL DB: Update using IndexedDB API directly (for web compatibility)
      try {
        if (typeof (window as any).indexedDB !== 'undefined') {
          const dbRequest = (window as any).indexedDB.open('AdminsAppDB');
          
          dbRequest.onsuccess = () => {
            const db = dbRequest.result;
            if (db.objectStoreNames.contains('delivery_persons')) {
              const transaction = db.transaction('delivery_persons', 'readwrite');
              const store = transaction.objectStore('delivery_persons');
              
              // Get existing record and merge with updates
              const getRequest = store.get(editingDeliveryPerson.id);
              getRequest.onsuccess = () => {
                const existingRecord = getRequest.result;
                const updatedRecord = {
                  ...existingRecord,
                  ...deliveryPersonData,
                  updated_at: new Date().toISOString()
                };
                
                const putRequest = store.put(updatedRecord);
                putRequest.onsuccess = () => {
                  console.log('updateDeliveryPerson - ✅ IndexedDB updated');
                };
                putRequest.onerror = () => {
                  console.error('updateDeliveryPerson - ❌ IndexedDB update failed:', putRequest.error);
                };
              };
            }
            db.close();
          };

          dbRequest.onerror = () => {
            console.error('updateDeliveryPerson - ❌ Could not open IndexedDB:', dbRequest.error);
          };
        }
      } catch (localDbError) {
        console.error('updateDeliveryPerson - ⚠️ Local DB update error:', localDbError);
        // Don't throw - Supabase update was successful
      }

      // If we have a user_id and image, also update the profiles table
      if (imageUrl && editingDeliveryPerson.user_id) {
        try {
          const { error: profileError } = await supabase
            .from('profiles')
            .update({ image: imageUrl })
            .eq('id', editingDeliveryPerson.user_id);

          if (profileError) {
            console.error('Error updating profile image:', profileError);
          } else {
            console.log('Profile image updated successfully');
          }
        } catch (profileError) {
          console.error('Error updating profile image:', profileError);
        }
      }

      // Update password if changing
      if (showPasswordChange && newPassword && editingDeliveryPerson.user_id) {

        // Use Supabase Admin API to update the user's password
        const { error: passwordError } = await supabase.auth.admin.updateUserById(
          editingDeliveryPerson.user_id,
          { password: newPassword }
        );

        if (passwordError) {
          console.error('Error updating password:', passwordError);
          Alert.alert(
            'Warning',
            'Delivery person updated but password change failed. Please try again.'
          );
        } else {
          console.log('Password updated successfully');
        }
      }

      // Reset the form
      setNewDeliveryPerson({
        firstName: '',
        lastName: '',
        email: '',
        phone: '',
        address: '',
        picture: null,
        vehicle_type: '',
        license_plate: '',
        password: ''
      });
      setNewPassword('');
      setConfirmPassword('');
      setShowPasswordChange(false);

      // Close the modal
      setShowEditModal(false);
      setEditingDeliveryPerson(null);

      // Reload the list (ONLINE = full sync, OFFLINE = cached data)
      await loadDeliveryPersons();

      Alert.alert('Success', 'Delivery person updated successfully!');
    } catch (error) {
      console.error('Error updating delivery person:', error);
      Alert.alert('Error', 'Failed to update delivery person: ' + (error as Error).message);
    } finally {
      setCreating(false);
    }
  };
  
  // Function to delete a delivery person
  const deleteDeliveryPerson = async (id: string, name: string) => {

    const actionKey = `delete-${id}`;
    setActionLoading(prev => ({ ...prev, [actionKey]: true }));

    try {
      // Step 0: Check local DB before deletion
      try {
        const dbCheck = await getDatabase();
        const beforeDelete = await dbCheck.getDeliveryPersonById(id);
        console.log('[DeleteDeliveryPerson] ✅ Local DB check passed');
      } catch (checkError) {
        console.error('[DeleteDeliveryPerson] ⚠️ Could not check local DB:', checkError);
      }

      // Step 1: Delete from Supabase FIRST (requires internet)
      await adminApiService.deliveryPersonnel.delete(id);

      // Update local state immediately for responsive UI (foreground update)
      setDeliveryPersons(prev => {
        const filtered = prev.filter(dp => dp.id !== id);
        return filtered;
      });

      // Note: admin-api-service already handles deletion from local IndexedDB
      // No need to delete again here - it would fail on web anyway (runAsync not supported on IndexedDB)

      // Step 2: Wait for Supabase to propagate
      await new Promise(resolve => setTimeout(resolve, 3000));

      // Step 3: VERIFY deletion by fetching the delivery person
      const { data: verifyData, error: verifyError } = await supabase
        .from('delivery_persons')
        .select('id')
        .eq('id', id)
        .is('deleted_at', null)
        .maybeSingle();

      // If verifyError is 406 (PGRST116), that means record NOT found = SUCCESS!
      const notFoundError = verifyError?.code === 'PGRST116';

      if (notFoundError || !verifyData) {
        console.warn('[DeleteDeliveryPerson] ⚠️ Delivery person still exists in Supabase! Waiting more...');
        await new Promise(resolve => setTimeout(resolve, 5000));
      }

      // Step 4: BACKGROUND SYNC - Reload without affecting UI (ONLINE = full sync, OFFLINE = cached)
      loadDeliveryPersons(true).catch((syncError) => {
        console.error('[DeleteDeliveryPerson] ❌ Background sync failed:', syncError);
      });

      Alert.alert('Success', 'Delivery person and associated data deleted successfully');
    } catch (error: any) {
      console.error('[DeleteDeliveryPerson] ❌ Error during deletion:', error);
      console.error('[DeleteDeliveryPerson] Error type:', typeof error);
      console.error('[DeleteDeliveryPerson] Error message:', error?.message);
      console.error('[DeleteDeliveryPerson] Error stack:', error?.stack);
      console.error('[DeleteDeliveryPerson] ========== END (with error) ==========');
      Alert.alert('Error', `Failed to delete delivery person: ${error.message || 'Unknown error'}`);
    } finally {
      setActionLoading(prev => ({ ...prev, [actionKey]: false }));
    }
  };

  const renderItem = ({ item }: { item: DeliveryPerson }) => {
    const deleteActionKey = `delete-${item.id}`;
    const isDeleting = actionLoading[deleteActionKey];


    return (
      <TouchableOpacity
        style={styles.itemContainer}
        onPress={() => router.push(`/admin/delivery-personnel/${item.id}`)}
      >
        <View style={styles.itemHeader}>
          {item.image_url ? (
            <Image
              source={{ uri: item.image_url }}
              style={styles.profilePhoto}
              onError={(e) => {
                console.log('Image load error:', e);
              }}
              onLoad={() => {
                console.log('Image loaded successfully');
              }}
            />
          ) : (
            <View style={styles.profilePhotoPlaceholder}>
              <Text style={styles.profilePhotoText}>{item.name ? item.name.charAt(0).toUpperCase() : '?'}</Text>
            </View>
          )}
          <View style={styles.itemInfo}>
            <Text style={styles.itemName}>{item.name || 'No name provided'}</Text>
            <Text style={styles.itemEmail}>{item.email || 'No email provided'}</Text>
            <Text style={styles.itemPhone}>{item.phone || 'No phone provided'}</Text>
            {item.vehicle_type && <Text style={styles.itemVehicle}>Vehicle: {item.vehicle_type}</Text>}
            {item.license_plate && <Text style={styles.itemLicensePlate}>License: {item.license_plate}</Text>}
            {item.rating && <Text style={styles.itemRating}>Rating: {item.rating}/5</Text>}
            {item.total_deliveries !== undefined && <Text style={styles.itemDeliveries}>Deliveries: {item.total_deliveries}</Text>}
          </View>
        </View>
        <View style={styles.itemStatus}>
          <Text style={[styles.statusText, getStatusStyle(item.is_available)]}>
            {getAvailabilityLabel(item.is_available)}
          </Text>
        </View>
        {item.current_latitude != null && item.current_longitude != null && (
          <Text style={styles.itemLocation}>
            {`Location: ${item.current_latitude ? item.current_latitude.toFixed(4) : 'N/A'}, ${item.current_longitude ? item.current_longitude.toFixed(4) : 'N/A'}`}
          </Text>
        )}
        <View style={styles.itemActions}>
          <View style={styles.actionRow}>
            <TouchableOpacity
              style={[styles.actionButton, styles.editButton]}
              onPress={(e) => {
                e.stopPropagation(); // Prevent navigation to detail page
                editDeliveryPerson(item);
              }}
              disabled={isDeleting}
            >
              <Text style={styles.actionButtonText}>Edit</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.actionButton, styles.deleteButton, isDeleting && styles.disabledButton]}
              onPress={(e) => {
                e.stopPropagation(); // Prevent navigation to detail page
                deleteDeliveryPerson(item.id, item.name || 'Unknown');
              }}
              activeOpacity={0.7} // Visual feedback for press
              hitSlop={{top: 20, bottom: 20, left: 20, right: 20}} // Larger touch area
              disabled={isDeleting}
            >
              {isDeleting ? (
                <ActivityIndicator size="small" color="#fff"  />
              ) :
                <Text style={styles.actionButtonText}>Delete</Text>
}
            </TouchableOpacity>
          </View>

          <TouchableOpacity
            style={[styles.actionButton, styles.toAvailabilityButton, item.is_available ? styles.toBusyButton : styles.toAvailableButton]}
            onPress={(e) => {
              e.stopPropagation(); // Prevent navigation to detail page
              const newAvailability = toggleAvailability(item.is_available);
              updateStatus(item.id, newAvailability);
            }}
            disabled={isDeleting}
          >
            <Text style={styles.actionButtonText}>
              {item.is_available ? 'Set Inactive' : 'Set Active'}
            </Text>
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    );
  };


  if (isAdminLoading) {
    return (
      <View style={styles.container}>
        <Text>Loading admin status...</Text>
      </View>
    );
  }

  if (!isAdmin && !isAdminLoading) {
    return (
      <View style={styles.container}>
        <Text>You are not authorized to access this page.</Text>
      </View>
    );
  }

  if (loading) {
    return (
      <View style={styles.container}>
        <Text>Loading delivery personnel...</Text>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.keyboardView}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 100 : 20}
    >
      <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
        <FlatList
          data={deliveryPersons}
          renderItem={renderItem}
          keyExtractor={(item) => item.id}
          style={styles.list}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={true}
          keyboardShouldPersistTaps="handled"
          alwaysBounceVertical={true}
          bounces={true}
          ListHeaderComponent={
            <>
            Form for creating new delivery person
            <View style={styles.formContainer}>
                <Text style={styles.formTitle}>Add New Delivery Person</Text>

          <Text style={styles.label}>First Name *</Text>
          <TextInput
            style={styles.input}
            value={newDeliveryPerson.firstName}
            onChangeText={(text) => setNewDeliveryPerson(prev => ({ ...prev, firstName: text }))}
            placeholder="Enter first name"
           />

          <Text style={styles.label}>Last Name</Text>
          <TextInput
            style={styles.input}
            value={newDeliveryPerson.lastName}
            onChangeText={(text) => setNewDeliveryPerson(prev => ({ ...prev, lastName: text }))}
            placeholder="Enter last name"
           />

          <Text style={styles.label}>Email *</Text>
          <TextInput
            style={styles.input}
            value={newDeliveryPerson.email}
            onChangeText={(text) => setNewDeliveryPerson(prev => ({ ...prev, email: text }))}
            placeholder="Enter email"
            keyboardType="email-address"
           />

          <Text style={styles.label}>Phone</Text>
          <TextInput
            style={styles.input}
            value={newDeliveryPerson.phone}
            onChangeText={(text) => setNewDeliveryPerson(prev => ({ ...prev, phone: text }))}
            placeholder="Enter phone number"
            keyboardType="phone-pad"
           />

          <Text style={styles.label}>Vehicle Type</Text>
          <TextInput
            style={styles.input}
            value={newDeliveryPerson.vehicle_type}
            onChangeText={(text) => setNewDeliveryPerson(prev => ({ ...prev, vehicle_type: text }))}
            placeholder="e.g., Bike, Car, Motorcycle"
           />

          <Text style={styles.label}>License Plate</Text>
          <TextInput
            style={styles.input}
            value={newDeliveryPerson.license_plate}
            onChangeText={(text) => setNewDeliveryPerson(prev => ({ ...prev, license_plate: text }))}
            placeholder="Enter license plate"
           />

          <Text style={styles.label}>Address</Text>
          <TextInput
            style={styles.input}
            value={newDeliveryPerson.address}
            onChangeText={(text) => setNewDeliveryPerson(prev => ({ ...prev, address: text }))}
            placeholder="Enter address"
            multiline
           />

          <Text style={styles.label}>Password *</Text>
          <TextInput
            style={styles.input}
            value={newDeliveryPerson.password}
            onChangeText={(text) => setNewDeliveryPerson(prev => ({ ...prev, password: text }))}
            placeholder="Enter password"
            secureTextEntry
           />

          <Text style={styles.label}>Profile Photo</Text>
          <Pressable onPress={pickImage} style={styles.photoButton}>
            <Text style={styles.photoButtonText}>Select Photo</Text>
          </Pressable>

          {newDeliveryPerson.picture && (
            <Image source={{ uri: newDeliveryPerson.picture }} style={styles.previewImage}  />
          )}

          <Text style={styles.noteText}>
            Note: This will create a new delivery person account.
          </Text>

          <Button
            title={creating ? "Creating..." : "Create Delivery Person"}
            onPress={createDeliveryPerson}
            disabled={creating}
           />
        </View>

        <Text style={styles.sectionTitle}>Current Delivery Personnel</Text>
        </>}
     />

      Edit Delivery Person Modal
      <Modal
        animationType="slide"
        transparent={true}
        visible={showEditModal}
        onRequestClose={() => setShowEditModal(false)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalContentWrapper}>
            <ScrollView 
              contentContainerStyle={styles.modalContentScroll}
              keyboardShouldPersistTaps="handled"
            >
              <Text style={styles.modalTitle}>Edit Delivery Person</Text>

              <Text style={styles.label}>First Name *</Text>
              <TextInput
                style={styles.input}
                value={newDeliveryPerson.firstName}
                onChangeText={(text) => setNewDeliveryPerson(prev => ({ ...prev, firstName: text }))}
                placeholder="Enter first name"
               />

              <Text style={styles.label}>Last Name</Text>
              <TextInput
                style={styles.input}
                value={newDeliveryPerson.lastName}
                onChangeText={(text) => setNewDeliveryPerson(prev => ({ ...prev, lastName: text }))}
                placeholder="Enter last name"
               />

              <Text style={styles.label}>Email *</Text>
              <TextInput
                style={styles.input}
                value={newDeliveryPerson.email}
                onChangeText={(text) => setNewDeliveryPerson(prev => ({ ...prev, email: text }))}
                placeholder="Enter email"
                keyboardType="email-address"
               />

              <Text style={styles.label}>Phone</Text>
              <TextInput
                style={styles.input}
                value={newDeliveryPerson.phone}
                onChangeText={(text) => setNewDeliveryPerson(prev => ({ ...prev, phone: text }))}
                placeholder="Enter phone number"
                keyboardType="phone-pad"
               />

              <Text style={styles.label}>Vehicle Type</Text>
              <TextInput
                style={styles.input}
                value={newDeliveryPerson.vehicle_type}
                onChangeText={(text) => setNewDeliveryPerson(prev => ({ ...prev, vehicle_type: text }))}
                placeholder="e.g., Bike, Car, Motorcycle"
               />

              <Text style={styles.label}>License Plate</Text>
              <TextInput
                style={styles.input}
                value={newDeliveryPerson.license_plate}
                onChangeText={(text) => setNewDeliveryPerson(prev => ({ ...prev, license_plate: text }))}
                placeholder="Enter license plate"
               />

              <Text style={styles.label}>Address</Text>
              <TextInput
                style={styles.input}
                value={newDeliveryPerson.address}
                onChangeText={(text) => setNewDeliveryPerson(prev => ({ ...prev, address: text }))}
                placeholder="Enter address"
                multiline
               />

              Profile Photo Section
              <Text style={styles.label}>Profile Photo</Text>
              <View style={styles.photoSection}>
                {newDeliveryPerson.picture ? (
                  <Image source={{ uri: newDeliveryPerson.picture }} style={styles.previewImage}  />
                ) : (
                  <View style={styles.noPhotoPlaceholder}>
                    <Text style={styles.noPhotoText}>No photo selected</Text>
                  </View>
                )}
                <View style={styles.photoButtons}>
                  <TouchableOpacity
                    style={styles.photoButton}
                    onPress={pickImage}
                  >
                    <Text style={styles.photoButtonText}>📷 Select Photo</Text>
                  </TouchableOpacity>
                  {newDeliveryPerson.picture && (
                    <TouchableOpacity
                      style={[styles.photoButton, styles.removePhotoButton]}
                      onPress={() => setNewDeliveryPerson(prev => ({ ...prev, picture: null }))}
                    >
                      <Text style={styles.photoButtonText}>❌ Remove</Text>
                    </TouchableOpacity>
                  )}
                </View>
              </View>

              <View style={styles.passwordSection}>
                <TouchableOpacity
                  style={styles.passwordToggle}
                  onPress={() => setShowPasswordChange(!showPasswordChange)}
                >
                  <Text style={styles.passwordToggleText}>
                    {showPasswordChange ? 'Hide Password Change' : 'Change Password'}
                  </Text>
                  <Text style={styles.passwordToggleIcon}>{showPasswordChange ? '▼' : '▶'}</Text>
                </TouchableOpacity>

                {showPasswordChange && (
                  <>
                    <Text style={styles.label}>New Password</Text>
                    <TextInput
                      style={styles.input}
                      value={newPassword}
                      onChangeText={setNewPassword}
                      placeholder="Enter new password"
                      secureTextEntry
                     />

                    <Text style={styles.label}>Confirm Password</Text>
                    <TextInput
                      style={styles.input}
                      value={confirmPassword}
                      onChangeText={setConfirmPassword}
                      placeholder="Confirm new password"
                      secureTextEntry
                     />
                    {newPassword && newPassword.length < 6 && (
                      <Text style={styles.passwordHint}>Password must be at least 6 characters</Text>
                    )}
                    {confirmPassword && newPassword !== confirmPassword && (
                      <Text style={styles.passwordHint}>Passwords do not match</Text>
                    )}
                    </>
                )}
                </View>
                
            

              <View style={styles.modalActions}>
                <TouchableOpacity
                  style={[styles.actionButton, styles.cancelButton]}
                  onPress={() => {
                    setShowEditModal(false);
                    setEditingDeliveryPerson(null);
                    setNewDeliveryPerson({
                      firstName: '',
                      lastName: '',
                      email: '',
                      phone: '',
                      picture: null,
                      vehicle_type: '',
                      license_plate: '',
                      address: '',
                      password: ''
                    });
                    setNewPassword('');
                    setConfirmPassword('');
                    setShowPasswordChange(false);
                  }}
                >
                  <Text style={styles.actionButtonText}>Cancel</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.actionButton, styles.updateButton]}
                  onPress={updateDeliveryPerson}
                  disabled={creating}
                >
                  <Text style={styles.actionButtonText}>
                    {creating ? "Updating..." : "Update Delivery Person"}
                  </Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  </KeyboardAvoidingView>
  );
}

// Helper functions
const getStatusStyle = (isAvailable: boolean) => {
  return isAvailable ? styles.available : styles.busy;
};

const getStatusButtonStyle = (isAvailable: boolean) => {
  return isAvailable ? styles.toBusyButton : styles.toAvailableButton;
};

const getAvailabilityLabel = (isAvailable: boolean) => {
  return isAvailable ? 'Active' : 'Inactive';
};

const toggleAvailability = (isAvailable: boolean) => {
  return !isAvailable; // Toggle between active/inactive
};

const styles = StyleSheet.create({
  keyboardView: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  topSpacer: {
    height: 50,
    backgroundColor: '#f5f5f5',
  },
  keyboardAvoidingContainer: {
    flex: 1,
  },
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  headerContainer: {
    paddingTop: 30,
    paddingBottom: 30,
    paddingHorizontal: 16,
    backgroundColor: '#C41E26',
    borderBottomWidth: 0,
    borderBottomColor: '#e0e0e0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#FFFFFF',
    textAlign: 'center',
  },
  formTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 15,
    textAlign: 'center',
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginTop: 30,
    marginBottom: 10,
  },
  formContainer: {
    backgroundColor: '#fff',
    padding: 15,
    borderRadius: 8,
    marginBottom: 20,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    marginVertical: 5,
  },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    padding: 10,
    borderRadius: 4,
    marginBottom: 15,
  },
  pickerContainer: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 4,
    marginBottom: 15,
    overflow: 'hidden',
  },
  pickerButton: {
    padding: 10,
    backgroundColor: '#f9f9f9',
  },
  pickerButtonText: {
    fontSize: 16,
  },
  previewImage: {
    width: 100,
    height: 100,
    borderRadius: 8,
    marginBottom: 15,
    alignSelf: 'center',
  },
  photoSection: {
    alignItems: 'center',
    marginBottom: 15,
  },
  noPhotoPlaceholder: {
    width: 100,
    height: 100,
    borderRadius: 8,
    backgroundColor: '#f0f0f0',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 15,
    alignSelf: 'center',
    borderWidth: 2,
    borderColor: '#ddd',
    borderStyle: 'dashed',
  },
  noPhotoText: {
    color: '#999',
    fontSize: 12,
  },
  photoButtons: {
    flexDirection: 'row',
    gap: 10,
  },
  photoButton: {
    backgroundColor: '#C41E26',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 6,
  },
  removePhotoButton: {
    backgroundColor: '#C41E26',
  },
  photoButtonText: {
    color: 'white',
    fontSize: 13,
    fontWeight: '600',
  },
  list: {
    flex: 1,
  },
  listContent: {
    flexGrow: 1,
    paddingHorizontal: 16,
    paddingTop: 0,
    paddingBottom: 200,
  },
  itemContainer: {
    backgroundColor: '#fff',
    padding: 15,
    marginBottom: 10,
    borderRadius: 8,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
      },
      android: {
        elevation: 3,
      },
      web: {
        boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
      },
    }),
  },
  itemHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  profilePhoto: {
    width: 50,
    height: 50,
    borderRadius: 25,
    marginRight: 15,
  },
  profilePhotoPlaceholder: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#ddd',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 15,
  },
  profilePhotoText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#666',
  },
  itemInfo: {
    flex: 1,
  },
  itemName: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  itemEmail: {
    fontSize: 14,
    color: '#666',
    marginVertical: 3,
  },
  itemPhone: {
    fontSize: 14,
    color: '#888',
    marginVertical: 3,
  },
  itemLocation: {
    fontSize: 12,
    color: '#C41E26',
    marginVertical: 3,
  },
  itemVehicle: {
    fontSize: 12,
    color: '#666',
    marginVertical: 2,
  },
  itemLicensePlate: {
    fontSize: 12,
    color: '#666',
    marginVertical: 2,
  },
  itemRating: {
    fontSize: 12,
    color: '#FFD700',
    marginVertical: 2,
  },
  itemDeliveries: {
    fontSize: 12,
    color: '#007AFF',
    marginVertical: 2,
  },
  itemStatus: {
    marginVertical: 5,
  },
  statusText: {
    fontWeight: 'bold',
    padding: 4,
    borderRadius: 4,
    alignSelf: 'flex-start',
  },
  available: {
    backgroundColor: '#d4edda',
    color: '#155724',
  },
  busy: {
    backgroundColor: '#fff3cd',
    color: '#856404',
  },
  inactive: {
    backgroundColor: '#f8d7da',
    color: '#721c24',
  },
  itemActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: 10,
    zIndex: 10, // Ensure buttons appear above other elements
  },
  actionButton: {
    padding: 8,
    borderRadius: 4,
    marginLeft: 5,
    minWidth: 70, // Ensure consistent button size
    alignItems: 'center',
    zIndex: 10, // Ensure buttons appear above other elements
    elevation: 3, // Add shadow for better visibility on Android
    shadowColor: '#000', // Add shadow for better visibility on iOS
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
  },
  editButton: {
    backgroundColor: '#007AFF',
  },
  toAvailabilityButton: {
    backgroundColor: '#6c757d',
  },
  toBusyButton: {
    backgroundColor: '#ffc107',
  },
  toInactiveButton: {
    backgroundColor: '#dc3545',
  },
  toAvailableButton: {
    backgroundColor: '#28a745',
  },
  deleteButton: {
    backgroundColor: '#dc3545', // More prominent red color for delete button
    zIndex: 10, // Ensure delete button appears above other elements
    elevation: 4, // Higher elevation for delete button
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3,
    shadowRadius: 3,
  },
  disabledButton: {
    opacity: 0.6,
  },
  actionButtonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 12,
  },
  noteText: {
    fontSize: 12,
    color: '#C41E26',
    fontStyle: 'italic',
    marginBottom: 10,
    textAlign: 'center',
  },
  modalContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  modalContentWrapper: {
    backgroundColor: 'white',
    width: '90%',
    maxWidth: 400,
    borderRadius: 10,
    maxHeight: '80%',
  },
  modalContentScroll: {
    padding: 20,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 15,
    textAlign: 'center',
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 15,
  },
  cancelButton: {
    backgroundColor: '#ccc',
  },
  updateButton: {
    backgroundColor: '#007AFF',
  },
  actionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  passwordSection: {
    marginTop: 15,
    paddingTop: 15,
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
  },
  passwordToggle: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    marginBottom: 10,
  },
  passwordToggleText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#007AFF',
  },
  passwordToggleIcon: {
    fontSize: 12,
    color: '#007AFF',
  },
  passwordHint: {
    fontSize: 12,
    color: '#C41E26',
    marginTop: 4,
    marginBottom: 8,
  },
});

// Helper functions

// Main component with proper auth
export default function ManageDeliveryPersonnel() {
  // Log when this component renders
  
  return (
    <RequireAuth>
      <ManageDeliveryPersonnelContent  />
    </RequireAuth>
  );
}