import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert, ActivityIndicator, Image, Modal, Animated, TextInput, ScrollView } from 'react-native';
import { getStoredDeliverySession, logoutDeliveryPerson } from '@/lib/delivery-auth';
import { supabase } from '@/lib/supabase';
import { router } from 'expo-router';
import { useAuth } from '@/contexts/AuthContext';
import { useBadge } from '@/contexts/BadgeContext';

interface UserSheetProps {
  isVisible?: boolean;
  onClose?: () => void;
}

const UserSheet: React.FC<UserSheetProps> = ({ isVisible = false, onClose }) => {
  const { session, user, isLoading, isAuthenticated, hasDeliveryRole } = useAuth();
  const { newDeliveriesCount } = useBadge();
  const [editingField, setEditingField] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');
  const [deliveryPersonData, setDeliveryPersonData] = useState<any>(null);
  const slideAnimation = useRef(new Animated.Value(-350)).current; // Start off-screen to the left

  useEffect(() => {
    // Load delivery person data
    if (user?.id) {
      loadDeliveryPersonData(user.id);
    } else {
      // Reset delivery person data if no user
      setDeliveryPersonData(null);
    }
  }, [user, session, isLoading, isAuthenticated, hasDeliveryRole]);

  // Get delivery person's profile picture from session metadata or loaded data
  const getDeliveryPersonAvatar = () => {
    // First check if we have the avatar in the delivery person data (image_url is the correct column name)
    if (deliveryPersonData?.image_url) {
      return deliveryPersonData.image_url;
    } else if (deliveryPersonData?.image) {
      return deliveryPersonData.image;
    }

    // Then check session metadata
    if (user?.user_metadata?.picture_url) {
      return user.user_metadata.picture_url;
    } else if (user?.user_metadata?.image) {
      return user.user_metadata.image;
    } else if (user?.user_metadata?.avatar) {
      return user.user_metadata.avatar;
    }

    return null;
  };

  // Load delivery person data from the database
  const loadDeliveryPersonData = async (userId: string) => {
    try {
      
      const { data, error } = await supabase
        .from('delivery_persons')
        .select('*')
        .eq('user_id', userId)
        .maybeSingle();

      if (error) {
        console.error('[UserSheet] Error fetching delivery person:', error);
        // Don't try to create - just use null data
        setDeliveryPersonData(null);
        return;
      }

      if (data) {
        setDeliveryPersonData(data);
        return;
      }

      // No record found - DON'T try to create automatically
      // The delivery person record should be created during signup/login
      setDeliveryPersonData(null);
      
    } catch (error) {
      console.error('[UserSheet] Error in loadDeliveryPersonData:', error);
      setDeliveryPersonData(null);
    }
  };

  // Animate the drawer when visibility changes
  useEffect(() => {
    Animated.timing(slideAnimation, {
      toValue: isVisible ? 0 : -350, // Slide in from left (0) or slide out to left (-350)
      duration: 300,
      useNativeDriver: true,
    }).start();
  }, [isVisible, slideAnimation]);

  if (!isVisible) return null;

  const handleSignOut = async () => {
    try {
      // Use custom delivery auth logout
      await logoutDeliveryPerson();
      onClose?.();
      // Navigate to login screen
      router.replace('/login');
    } catch (error) {
      console.error('Logout error:', error);
      Alert.alert('Error', 'Failed to logout. Please try again.');
    }
  };

const handleDeleteAccount = async () => {
  Alert.alert(
    'Delete Account',
    'Are you sure you want to permanently delete your account and all associated delivery data? This cannot be undone.',
    [
      {
        text: 'Cancel',
        style: 'cancel',
      },
      {
        text: 'Delete Account',
        style: 'destructive',
        onPress: async () => {
          try {
            // 💡 FIX: Fetch the actual session from your local delivery-auth storage
            const session = await getStoredDeliverySession();
            
            // Extract the user_id or delivery_person_id from your custom payload
            const targetUserId = session?.user_id || session?.delivery_person_id;

            if (!targetUserId) {
              Alert.alert('Error', 'No active session found. Please sign in again.');
              return;
            }

            console.log('[DeleteAccount] Found active custom session id:', targetUserId);

            // Execute the Postgres RPC function using the correct user ID
            const { error } = await supabase.rpc('delete_user_account', {
              user_id_to_delete: targetUserId,
            } as any) as any;

            if (error) {
              throw error;
            }

            // Clear your local tokens and storage records safely
            await logoutDeliveryPerson();
            onClose?.();
            router.replace('/login');
            Alert.alert('Account deleted', 'Your account and associated delivery data have been deleted.');
          } catch (error: any) {
            console.error('[UserSheet] Delete account error:', error);
            Alert.alert('Error', `Failed to delete account: ${error.message || 'Please try again.'}`);
          }
        },
      },
    ]
  );
};

  const startEditing = (field: string, currentValue: string) => {
    setEditingField(field);
    setEditValue(currentValue || '');
  };

  const saveField = async (field: string) => {
    if (!user?.id || !editValue.trim()) {
      Alert.alert('Error', 'Please enter a valid value');
      return;
    }

    try {
      // Prepare the update data
      const updateData: any = {};
      updateData[field] = editValue.trim();
      updateData.updated_at = new Date().toISOString();

      // First, check if the delivery person record exists
      const { data: existingRecord, error: fetchError } = await supabase
        .from('delivery_persons')
        .select('user_id')
        .eq('user_id', user.id)
        .single();

      if (fetchError && fetchError.code === 'PGRST116') { // Record not found

        // Create the delivery person record
        let insertError: any = null;
        try {
          const result = await supabase
            .from('delivery_persons')
            .insert({
              user_id: user.id,
              [field]: editValue.trim(),
              vehicle_type: deliveryPersonData?.vehicle_type || null,
              is_available: deliveryPersonData?.is_available ?? false,
              current_location: deliveryPersonData?.current_location || null,
              current_latitude: deliveryPersonData?.current_latitude || null,
              current_longitude: deliveryPersonData?.current_longitude || null,
              rating: deliveryPersonData?.rating || 0.0,
              total_deliveries: deliveryPersonData?.total_deliveries || 0,
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString()
            });

          insertError = result.error;
        } catch (error: any) {
          insertError = error;
        }

        if (insertError) {
          // If insert failed due to unique violation, try updating instead
          if (insertError.code === '23505') {
            const { error: updateError } = await supabase
              .from('delivery_persons')
              .update(updateData)
              .eq('user_id', user.id);

            if (updateError) {
              throw updateError;
            }
          } else {
            throw insertError;
          }
        }
      } else if (fetchError) {
        throw fetchError; // Throw other errors
      } else {
        // Record exists, so update it
        const { error } = await supabase
          .from('delivery_persons')
          .update(updateData)
          .eq('user_id', user.id);

        if (error) {
          throw error;
        }
      }

      // Update local state
      setDeliveryPersonData((prev: any) => ({ ...prev, [field]: editValue.trim() }));
      setEditingField(null);
      setEditValue('');

      Alert.alert('Success', `${field.replace('_', ' ')} updated successfully!`);
    } catch (error: any) {
      console.error(`Error updating ${field}:`, error);
      Alert.alert('Error', `Failed to update ${field}: ${error.message}`);
    }
  };

  return (
    <ScrollView style={styles.sheet}>
      <View style={styles.header}>
        <Text style={styles.title} accessibilityRole="header">Delivery Profile</Text>
        <TouchableOpacity
          onPress={onClose}
          style={styles.closeButton}
          accessibilityLabel="Close user profile sheet"
          accessibilityHint="Dismiss the user profile view"
        >
          <Text style={styles.closeButtonText}>×</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.content}>
        {isLoading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#C41E26" />
            <Text style={styles.loadingText}>Loading profile...</Text>
          </View>
        ) : user ? (
          <View>
            <View style={styles.avatarContainer}>
              {getDeliveryPersonAvatar() ? (
                <Image source={{ uri: getDeliveryPersonAvatar() }} style={styles.avatar} />
              ) : (
                <View style={styles.avatarPlaceholder}>
                  <Text style={styles.avatarInitials}>
                    {user.user_metadata?.full_name?.charAt(0)?.toUpperCase() ||
                     user.user_metadata?.name?.charAt(0)?.toUpperCase() ||
                     user.user_metadata?.first_name?.charAt(0)?.toUpperCase() ||
                     user.email?.charAt(0)?.toUpperCase() || 'D'}
                  </Text>
                </View>
              )}
            </View>

            <Text style={styles.userName} accessibilityRole="text">
              {deliveryPersonData?.name ||
               user.user_metadata?.full_name ||
               user.user_metadata?.name ||
               user.user_metadata?.first_name ||
               user.email?.split('@')[0] || 'Delivery Person'}
            </Text>
            <Text style={styles.userEmail} accessibilityRole="text">
              {deliveryPersonData?.email || user.email || ''}
            </Text>

            {/* Navigation Links */}
            <View style={styles.navLinks}>
              <TouchableOpacity
                style={styles.navLink}
                onPress={() => {
                  router.push('/(tabs)/orders');
                  onClose?.();
                }}
              >
                <Text style={styles.navLinkText}>Orders</Text>
                {newDeliveriesCount > 0 && (
                  <View style={styles.badge}>
                    <Text style={styles.badgeText}>
                      {newDeliveriesCount > 99 ? '99+' : newDeliveriesCount}
                    </Text>
                  </View>
                )}
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.navLink}
                onPress={() => {
                  router.push('/(tabs)/profile');
                  onClose?.();
                }}
              >
                <Text style={styles.navLinkText}>Profile</Text>
              </TouchableOpacity>
            </View>

            {/* Delivery Person Specific Fields */}
            <View style={styles.fieldContainer}>
              <Text style={styles.fieldLabel}>Vehicle Type:</Text>
              {editingField === 'vehicle_type' ? (
                <View>
                  <TextInput
                    style={styles.editInput}
                    value={editValue}
                    onChangeText={setEditValue}
                    placeholder="Enter vehicle type"
                  />
                  <View style={styles.editButtons}>
                    <TouchableOpacity
                      style={[styles.button, { flex: 1, marginRight: 5 }]}
                      onPress={() => saveField('vehicle_type')}
                    >
                      <Text style={styles.buttonText}>Save</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.button, styles.cancelButton, { flex: 1, marginLeft: 5 }]}
                      onPress={() => setEditingField(null)}
                    >
                      <Text style={styles.buttonText}>Cancel</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ) : (
                <View style={styles.fieldValueContainer}>
                  <Text style={styles.fieldValue}>
                    {deliveryPersonData?.vehicle_type || 'Not set'}
                  </Text>
                  <TouchableOpacity
                    style={[styles.button, { alignSelf: 'flex-start', padding: 8 }]}
                    onPress={() => startEditing('vehicle_type', deliveryPersonData?.vehicle_type)}
                  >
                    <Text style={styles.buttonText}>Edit</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>

            <View style={styles.fieldContainer}>
              <Text style={styles.fieldLabel}>License Plate:</Text>
              {editingField === 'license_plate' ? (
                <View>
                  <TextInput
                    style={styles.editInput}
                    value={editValue}
                    onChangeText={setEditValue}
                    placeholder="Enter license plate"
                  />
                  <View style={styles.editButtons}>
                    <TouchableOpacity
                      style={[styles.button, { flex: 1, marginRight: 5 }]}
                      onPress={() => saveField('license_plate')}
                    >
                      <Text style={styles.buttonText}>Save</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.button, styles.cancelButton, { flex: 1, marginLeft: 5 }]}
                      onPress={() => setEditingField(null)}
                    >
                      <Text style={styles.buttonText}>Cancel</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ) : (
                <View style={styles.fieldValueContainer}>
                  <Text style={styles.fieldValue}>
                    {deliveryPersonData?.license_plate || 'Not set'}
                  </Text>
                  <TouchableOpacity
                    style={[styles.button, { alignSelf: 'flex-start', padding: 8 }]}
                    onPress={() => startEditing('license_plate', deliveryPersonData?.license_plate)}
                  >
                    <Text style={styles.buttonText}>Edit</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>

            <View style={styles.fieldContainer}>
              <Text style={styles.fieldLabel}>Status:</Text>
              <Text style={styles.fieldValue}>
                {deliveryPersonData?.is_available ? 'Available' : 'Not Available'}
              </Text>
            </View>

            <TouchableOpacity
              style={[styles.button, styles.logoutButton]}
              onPress={handleSignOut}
              accessibilityLabel="Logout"
              accessibilityHint="Sign out of the application"
            >
              <Text style={styles.buttonText}>Logout</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.button, styles.deleteButton]}
              onPress={handleDeleteAccount}
              accessibilityLabel="Delete account"
              accessibilityHint="Delete your account and all associated delivery data permanently"
            >
              <Text style={[styles.buttonText, styles.deleteButtonText]}>Delete Account</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View>
            <Text style={styles.notLoggedIn} accessibilityRole="text">Not logged in</Text>
          </View>
        )}
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  modalContainer: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)', // Semi-transparent background
  },
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 1,
  },
  drawer: {
    position: 'absolute',
    top: 0,
    left: 0,
    bottom: 0,
    width: '80%', // Adjust width as needed
    maxWidth: 350, // Maximum width for larger screens
    backgroundColor: 'white',
    shadowColor: '#000',
    shadowOffset: {
      width: -12,
      height: 0,
    },
    shadowOpacity: 0.58,
    shadowRadius: 16.0,
    elevation: 24,
    zIndex: 2,
  },
  container: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    zIndex: 1000,
  },
  sheet: {
    flex: 1,
    backgroundColor: 'white',
    padding: 20,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
    paddingBottom: 10,
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  closeButton: {
    padding: 5,
  },
  closeButtonText: {
    fontSize: 24,
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
  },
  avatarContainer: {
    alignItems: 'center',
    marginBottom: 20,
  },
  avatar: {
    width: 100,
    height: 100,
    borderRadius: 50,
    marginBottom: 10,
  },
  avatarPlaceholder: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: '#C41E26',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 10,
  },
  avatarInitials: {
    fontSize: 30,
    color: 'white',
    fontWeight: 'bold',
  },
  userName: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 5,
    textAlign: 'center',
  },
  userEmail: {
    fontSize: 16,
    color: '#666',
    marginBottom: 20,
    textAlign: 'center',
  },
  navLinks: {
    marginBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
    paddingBottom: 15,
  },
  activeDeliveriesSection: {
    marginBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
    paddingBottom: 15,
  },
  activeDeliveriesTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 10,
    color: '#333',
  },
  activeDeliveryItem: {
    paddingVertical: 8,
    paddingHorizontal: 10,
    backgroundColor: '#f0f8ff',
    borderRadius: 5,
    marginBottom: 5,
  },
  activeDeliveryText: {
    fontSize: 14,
    color: '#333',
    fontWeight: '500',
  },
  activeDeliveryAddress: {
    fontSize: 12,
    color: '#666',
    marginTop: 2,
  },
  navLink: {
    paddingVertical: 12,
    paddingHorizontal: 10,
    position: 'relative',
  },
  navLinkText: {
    fontSize: 16,
    color: '#333',
  },
  badge: {
    position: 'absolute',
    right: 10,
    top: 8,
    backgroundColor: '#FF3B30',
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 6,
  },
  badgeText: {
    color: 'white',
    fontSize: 12,
    fontWeight: 'bold',
  },
  fieldContainer: {
    marginBottom: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
    paddingBottom: 10,
  },
  fieldLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 5,
  },
  fieldValueContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  fieldValue: {
    fontSize: 16,
    color: '#666',
    flex: 1,
  },
  editInput: {
    borderWidth: 1,
    borderColor: '#ddd',
    padding: 10,
    borderRadius: 5,
    fontSize: 16,
    marginBottom: 10,
    backgroundColor: '#f9f9f9',
  },
  editButtons: {
    flexDirection: 'row',
    marginBottom: 15,
  },
  button: {
    backgroundColor: '#C41E26',
    padding: 15,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 10,
  },
  buttonText: {
    color: 'white',
    fontWeight: 'bold',
  },
  cancelButton: {
    backgroundColor: '#999',
  },
  logoutButton: {
    backgroundColor: '#C41E26',
  },
  deleteButton: {
    backgroundColor: '#E53E3E',
  },
  deleteButtonText: {
    color: '#FFFFFF',
  },
  notLoggedIn: {
    textAlign: 'center',
    paddingVertical: 20,
    fontSize: 16,
    color: '#666',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
    color: '#666',
  },
});

export default UserSheet;