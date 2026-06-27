import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert, ActivityIndicator, Image, Platform, ScrollView } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as ImagePicker from 'expo-image-picker';
import { supabase } from '@/lib/supabase';
import { uploadImage, deleteImage, updateRecordWithImage } from '@/lib/image-storage-utils';
import { router } from 'expo-router';
import { useBadge } from '@/contexts/BadgeContext';
import { useAdminAuth } from '@/contexts/AdminAuthContext';

interface UserSheetProps {
  isVisible?: boolean;
  onClose?: () => void;
}

interface AdminProfile {
  id: string;
  name?: string | null;
  email?: string | null;
  phone?: string | null;
  image_url?: string | null;
  image?: string | null;
}

const UserSheet: React.FC<UserSheetProps> = ({ isVisible = false, onClose }) => {
  const { session } = useAdminAuth(); // Use admin auth instead of user auth
  const { newOrdersCount } = useBadge();

  const [avatarLoading, setAvatarLoading] = useState(false);
  const [userAvatar, setUserAvatar] = useState<string | null>(null);

  useEffect(() => {
    // Use admin session directly
    if (session?.email) {
      // For admin app, we don't have image_url in admin session
      // Image would need to be fetched from profiles table if needed
    }
  }, [session]);

  if (!isVisible) return null;

  const handleSignOut = async () => {
    try {
      await AsyncStorage.removeItem('admin_session');
      onClose?.();
      router.replace('/admin/login');
    } catch (error) {
      console.error('Sign out error:', error);
      Alert.alert('Error', 'Failed to sign out. Please try again.');
    }
  };

  const handleDeleteAccount = async () => {
    Alert.alert(
      'Delete Account',
      'Are you sure you want to permanently delete your admin account and all stored admin profile data? This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete Account',
          style: 'destructive',
          onPress: async () => {
            try {
              const email = session?.email;
              if (email) {
                const errors: string[] = [];

                const { error: adminError } = await supabase
                  .from('admins')
                  .delete()
                  .eq('email', email);
                if (adminError) errors.push(`admins: ${adminError.message}`);

                const { error: profileError } = await supabase
                  .from('profiles')
                  .delete()
                  .eq('email', email);
                if (profileError) errors.push(`profiles: ${profileError.message}`);

                const { error: userError } = await supabase
                  .from('users')
                  .delete()
                  .eq('email', email);
                if (userError) errors.push(`users: ${userError.message}`);

                if (errors.length > 0) {
                  console.warn('[UserSheet] Delete account cleanup warnings:', errors.join(' | '));
                }
              }

              await AsyncStorage.removeItem('admin_session');
              onClose?.();
              router.replace('/admin/login');
              Alert.alert('Account deleted', 'Your admin account session and associated profile data have been removed.');
            } catch (error: any) {
              console.error('[UserSheet] Delete account error:', error);
              Alert.alert('Error', `Failed to delete admin account: ${error?.message || 'Please try again.'}`);
            }
          },
        },
      ]
    );
  };


  const pickImage = async () => {
    if (!session?.id) {
      Alert.alert('Error', 'User not authenticated');
      return;
    }

    try {
      // Request media library permissions
      const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();

      if (permissionResult.granted === false) {
        Alert.alert('Permission required', 'Camera roll permissions are required to select an image.');
        return;
      }

      // Pick an image from the gallery
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });

      if (!result.canceled && result.assets && result.assets[0]) {
        const imageAsset = result.assets[0];
        setAvatarLoading(true);

        try {
          // Create a file-like object from the selected image
          const file = {
            uri: imageAsset.uri,
            type: 'image/jpeg',
            name: `avatar_${session.id}_${Date.now()}.jpg`,
          };

          // Upload the image to the zootzoot bucket
          const imageUrl = await uploadImage(file, 'zootzoot');

          // Update the user's profile with the new avatar URL
          await updateRecordWithImage('users', session.id, imageUrl, 'image_url');

          // Update the local state
          setUserAvatar(imageUrl);

          Alert.alert('Success', 'Avatar updated successfully!');
        } catch (uploadError) {
          console.error('Upload error:', uploadError);
          Alert.alert('Upload failed', 'Failed to upload the image. Please try again.');
        } finally {
          setAvatarLoading(false);
        }
      }
    } catch (error) {
      console.error('Image picker error:', error);
      setAvatarLoading(false);
      Alert.alert('Error', 'An error occurred while selecting the image.');
    }
  };

  const takePhoto = async () => {
    if (!session?.id) {
      Alert.alert('Error', 'User not authenticated');
      return;
    }

    try {
      // Request camera permissions
      const permissionResult = await ImagePicker.requestCameraPermissionsAsync();

      if (permissionResult.granted === false) {
        Alert.alert('Permission required', 'Camera permissions are required to take a photo.');
        return;
      }

      // Take a photo
      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });

      if (!result.canceled && result.assets && result.assets[0]) {
        const imageAsset = result.assets[0];
        setAvatarLoading(true);

        try {
          // Create a file-like object from the captured image
          const file = {
            uri: imageAsset.uri,
            type: 'image/jpeg',
            name: `avatar_${session.id}_${Date.now()}.jpg`,
          };

          // Upload the image to the zootzoot bucket
          const imageUrl = await uploadImage(file, 'zootzoot');

          // Update the user's profile with the new avatar URL
          await updateRecordWithImage('users', session.id, imageUrl, 'image_url');

          // Update the local state
          setUserAvatar(imageUrl);

          Alert.alert('Success', 'Avatar updated successfully!');
        } catch (uploadError) {
          console.error('Upload error:', uploadError);
          Alert.alert('Upload failed', 'Failed to upload the image. Please try again.');
        } finally {
          setAvatarLoading(false);
        }
      }
    } catch (error) {
      console.error('Camera error:', error);
      setAvatarLoading(false);
      Alert.alert('Error', 'An error occurred while taking the photo.');
    }
  };

  return (
    <View style={styles.drawerContent}>
      <View style={styles.header}>
        <Text style={styles.title} accessibilityRole="header">Admin Profile</Text>
        <TouchableOpacity
          onPress={onClose}
          style={styles.closeButton}
          accessibilityLabel="Close admin profile sheet"
          accessibilityHint="Dismiss the admin profile view"
        >
          <Text style={styles.closeButtonText}>×</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.content}>
        {session ? (
          <>
            <View style={styles.avatarContainer}>
              <View style={styles.avatarPlaceholder}>
                <Text style={styles.avatarInitials}>
                  {session.name?.charAt(0)?.toUpperCase() || session.email?.charAt(0)?.toUpperCase() || 'A'}
                </Text>
              </View>

              <View style={styles.avatarActions}>
                <Text style={styles.adminNote}>Admin profile image coming soon</Text>
              </View>
            </View>

            <Text style={styles.userName} accessibilityRole="text">
              {session.name || 'Admin User'}
            </Text>
            <Text style={styles.userEmail} accessibilityRole="text">
              {session.email || ''}
            </Text>


            {/* Navigation Links - Made scrollable */}
            <View style={styles.navLinks}>
              <ScrollView style={styles.navScrollContainer}>
                <TouchableOpacity
                  style={styles.navLink}
                  onPress={() => {
                    router.push('/admin/dashboard');
                    onClose?.();
                  }}
                >
                  <Text style={styles.navLinkText}>Dashboard</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.navLink}
                  onPress={() => {
                    router.push('/admin/orders');
                    onClose?.();
                  }}
                >
                  <Text style={styles.navLinkText}>Orders</Text>
                  {newOrdersCount > 0 && (
                    <View style={styles.badge}>
                      <Text style={styles.badgeText}>
                        {newOrdersCount > 99 ? '99+' : newOrdersCount}
                      </Text>
                    </View>
                  )}
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.navLink}
                  onPress={() => {
                    router.push('/admin/restaurants');
                    onClose?.();
                  }}
                >
                  <Text style={styles.navLinkText}>Restaurants</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.navLink}
                  onPress={() => {
                    router.push('/admin/delivery-personnel');
                    onClose?.();
                  }}
                >
                  <Text style={styles.navLinkText}>Delivery Personnel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.navLink}
                  onPress={() => {
                    router.push('/admin/advertisements');
                    onClose?.();
                  }}
                >
                  <Text style={styles.navLinkText}>Advertisements</Text>
                </TouchableOpacity>
              </ScrollView>
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
              accessibilityHint="Delete your admin account and associated profile data permanently"
            >
              <Text style={[styles.buttonText, styles.deleteButtonText]}>Delete Account</Text>
            </TouchableOpacity>
          </>
        ) : (
          <Text style={styles.notLoggedIn} accessibilityRole="text">Not logged in</Text>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  drawerContent: {
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
  avatarActions: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 10,
  },
  adminNote: {
    fontSize: 12,
    color: '#999',
    textAlign: 'center',
    marginTop: 10,
  },
  avatarButton: {
    backgroundColor: '#C41E26',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 6,
  },
  avatarButtonText: {
    color: 'white',
    fontSize: 12,
    fontWeight: 'bold',
  },
  userName: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 5,
    textAlign: 'center',
  },
  navLinks: {
    marginBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
    paddingBottom: 15,
    flex: 1,
  },
  navScrollContainer: {
    maxHeight: 200, // Limit height to make scrolling visible when needed
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
  userEmail: {
    fontSize: 16,
    color: '#666',
    marginBottom: 20,
    textAlign: 'center',
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