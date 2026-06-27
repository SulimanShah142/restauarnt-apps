import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, Button, FlatList, StyleSheet, Alert, TouchableOpacity, Image, Pressable, Modal, ActivityIndicator, Platform, KeyboardAvoidingView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { RequireAuth } from '@/contexts/AuthContext';
import { deleteRecord } from '@/lib/deleteRecord';
import { geocodeAddress } from '@/lib/GeocodingService';
import ImageSelector from '@/components/ImageSelector';
import { imageStorageService } from '@/lib/image-storage';
import { supabase } from '@/lib/supabase';
import { adminApiService } from '@/lib/admin-api-service';
import { checkNetworkStatus, showNetworkErrorAlert } from '@/lib/network-utils';
import { CustomAlert } from '@/components/CustomAlert';

// Define TypeScript interfaces
interface Restaurant {
  id: string;
  name: string;
  description: string;
  image: string | null;
  address?: string | null;
  phone?: string | null;
  email?: string | null;
  rating: number;
  deliveryTime?: number | null;
  deliveryFee: number;
  minimumOrder: number;
  isActive: boolean;
  isAvailable: boolean;
  ownerId: string;
  createdAt: string;
  updatedAt: string;
  opening_time?: string | null;
  closing_time?: string | null;
  cuisine_type?: string | null;
  estimated_preparation_time?: number;
  estimated_delivery_time?: number | null;
  delivery_fee?: number | null;
  min_order_amount?: number | null;
}

const generateUUID = (): string => {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
};

function ManageRestaurantsContent() {
  const [restaurants, setRestaurants] = useState<Restaurant[]>([]);
  const [refreshKey, setRefreshKey] = useState(0);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [address, setAddress] = useState('');
  const [phone, setPhone] = useState('');
  const [latitude, setLatitude] = useState<string>('');
  const [longitude, setLongitude] = useState<string>('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<{[key: string]: boolean}>({});
  const [openingTime, setOpeningTime] = useState<string>('09:00');
  const [closingTime, setClosingTime] = useState<string>('21:00');
  const [cuisineType, setCuisineType] = useState<string>('');
  const [estimatedPrepTime, setEstimatedPrepTime] = useState<string>('30');
  const [email, setEmail] = useState<string>('');
  const router = useRouter();
  
  // Custom alert state
  const [customAlert, setCustomAlert] = useState<{
    visible: boolean;
    title: string;
    message: string;
    buttons: any[];
    icon?: 'success' | 'error' | 'warning' | 'info' | 'question';
  }>({
    visible: false,
    title: '',
    message: '',
    buttons: [],
    icon: 'info',
  });

  // Helper function to show custom alerts
  const showAlert = (
    title: string,
    message: string,
    buttons?: Array<{ text: string; onPress?: () => void; style?: 'default' | 'cancel' | 'destructive' }>,
    icon?: 'success' | 'error' | 'warning' | 'info' | 'question'
  ) => {
    setCustomAlert({
      visible: true,
      title,
      message,
      buttons: buttons || [{ text: 'OK' }],
      icon,
    });
  };

  useEffect(() => {
    loadRestaurants();
  }, []);

  const loadRestaurants = async (forceSync: boolean = false) => {
    try {
      const isOnline = await checkNetworkStatus();
      if (!isOnline && !forceSync) {
        const userIgnored = await showNetworkErrorAlert();
        if (!userIgnored) return;
      }

      const data = await adminApiService.restaurants.getAll();

      const transformedData = data.map((item: any) => ({
        id: item.id,
        name: item.name,
        description: item.description || '',
        image: item.image_url,
        address: item.address || null,
        phone: item.phone || null,
        email: item.email || null,
        rating: item.rating || 0,
        estimated_delivery_time: item.estimated_delivery_time || null,
        delivery_fee: item.delivery_fee || 0,
        min_order_amount: item.min_order_amount || 0,
        isActive: item.is_active !== false,
        isAvailable: item.is_available !== false,
        ownerId: item.owner_id || '',
        createdAt: item.created_at,
        updatedAt: item.updated_at,
        opening_time: item.opening_time || null,
        closing_time: item.closing_time || null,
        cuisine_type: item.cuisine_type || null,
        estimated_preparation_time: item.estimated_preparation_time || null,
        deliveryFee: item.delivery_fee || 0,
        minimumOrder: item.min_order_amount || 0,
        deliveryTime: item.estimated_delivery_time || null,
      }));

      setRestaurants(transformedData);
      setLoading(false);
    } catch (error) {
      console.error('[Restaurants] ❌ Error loading restaurants:', error);
      Alert.alert('Error', 'Failed to load restaurants');
      showAlert('❌ Error', 'Failed to load restaurants. Please try again.', [{ text: 'OK' }], 'error');
      setLoading(false);
    }
  };

  const handleSubmit = async () => {
    if (!name.trim()) {
      Alert.alert('Error', 'Name is required');
      return;
    }

    setActionLoading({ submit: true });

    try {
      let imageUrl = imageUri;
      if (imageUri && !imageUri.startsWith('http')) {
        const imageId = editingId || generateUUID();
        const url = await imageStorageService.uploadImage(imageUri, 'restaurants');
        if (url) imageUrl = url;
      }

      let coords = { lat: String(latitude), lng: String(longitude) };
      if (address && (!latitude || !longitude)) {
        const geocoded = await geocodeAddress(address);
        if (geocoded) coords = { lat: String(geocoded.latitude), lng: String(geocoded.longitude) };
      }

      // Get admin user from session to use as owner_id
      // Note: admin custom auth doesn't have a valid UUID in users table, so we set to null
      const restaurantData: any = {
        name: name.trim(),
        description: description.trim(),
        image_url: imageUrl,
        address: address.trim(),
        phone: phone.trim(),
        email: email?.trim(),
        rating: 0,
        estimated_delivery_time: parseInt(estimatedPrepTime) || 30,
        delivery_fee: 0,
        min_order_amount: 0,
        is_active: true,
        is_available: true,
        // Set to null since admin custom auth doesn't have a valid user UUID
        owner_id: null,
        opening_time: openingTime,
        closing_time: closingTime,
        cuisine_type: cuisineType,
        estimated_preparation_time: parseInt(estimatedPrepTime) || 30,
        latitude: coords.lat ? parseFloat(coords.lat) : null,
        longitude: coords.lng ? parseFloat(coords.lng) : null,
      };

      if (editingId) {
        await adminApiService.restaurants.update(editingId, restaurantData);
        Alert.alert('Success', 'Restaurant updated successfully!');
      } else {
        await adminApiService.restaurants.create(restaurantData);
        Alert.alert('Success', 'Restaurant created successfully!');
      }

      resetForm();
      await loadRestaurants(true);
    } catch (error: any) {
      console.error('[Restaurants] Error saving:', error);
      Alert.alert('Error', 'Failed to save restaurant: ' + error.message);
    } finally {
      setActionLoading({ submit: false });
    }
  };

  const resetForm = () => {
    setName('');
    setDescription('');
    setImageUri(null);
    setAddress('');
    setPhone('');
    setEmail('');
    setLatitude('');
    setLongitude('');
    setEditingId(null);
    setOpeningTime('09:00');
    setClosingTime('21:00');
    setCuisineType('');
    setEstimatedPrepTime('30');
  };

  const handleEdit = (item: Restaurant) => {
    setEditingId(item.id);
    setName(item.name);
    setDescription(item.description);
    setImageUri(item.image);
    setAddress(item.address || '');
    setPhone(item.phone || '');
    setEmail(item.email || '');
    setOpeningTime(item.opening_time || '09:00');
    setClosingTime(item.closing_time || '21:00');
    setCuisineType(item.cuisine_type || '');
    setEstimatedPrepTime(item.estimated_preparation_time?.toString() || '30');
  };

  const handleDelete = async (id: string, name: string) => {
    Alert.alert(
      'Delete Restaurant',
      `Are you sure you want to delete "${name}"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteRecord('restaurants', id);
              Alert.alert('Success', 'Restaurant deleted successfully!');
              await loadRestaurants(true);
            } catch (error) {
              Alert.alert('Error', 'Failed to delete restaurant');
            }
          }
        }
      ]
    );
  };

  const toggleAvailability = async (id: string, currentStatus: boolean) => {
    try {
      await adminApiService.restaurants.update(id, { is_available: !currentStatus });
      await loadRestaurants(true);
    } catch (error) {
      Alert.alert('Error', 'Failed to update availability');
    }
  };

  const toggleActive = async (id: string, currentStatus: boolean) => {
    try {
      await adminApiService.restaurants.update(id, { is_active: !currentStatus });
      await loadRestaurants(true);
    } catch (error) {
      Alert.alert('Error', 'Failed to update status');
    }
  };

  const renderItem = ({ item }: { item: Restaurant }) => (
    <View style={styles.itemContainer}>
      <View style={styles.itemHeader}>
        <Text style={styles.itemName}>{item.name}</Text>
        <View style={styles.badgeRow}>
          <View style={[styles.statusBadge, item.isActive ? styles.activeBadge : styles.inactiveBadge]}>
            <Text style={styles.badgeText}>{item.isActive ? 'Active' : 'Inactive'}</Text>
          </View>
          <View style={[styles.statusBadge, item.isAvailable ? styles.availableBadge : styles.unavailableBadge]}>
            <Text style={styles.badgeText}>{item.isAvailable ? 'Available' : 'Unavailable'}</Text>
          </View>
        </View>
      </View>

      {item.description ? <Text style={styles.itemDescription}>{item.description}</Text> : null}
      
      {item.cuisine_type && (
        <View style={styles.cuisineBadge}>
          <Text style={styles.cuisineBadgeText}>🍽️ {item.cuisine_type}</Text>
        </View>
      )}

      <View style={styles.itemRow}>
        <Text style={styles.itemLabel}>⏰ Prep Time:</Text>
        <Text style={styles.itemValue}>{item.estimated_preparation_time || 30} min</Text>
      </View>

      <View style={styles.itemRow}>
        <Text style={styles.itemLabel}>🕐 Hours:</Text>
        <Text style={styles.itemValue}>{item.opening_time || '09:00'} - {item.closing_time || '21:00'}</Text>
      </View>

      {item.image ? (
        <Image source={{ uri: item.image }} style={styles.itemImage} resizeMode="cover" />
      ) : null}

      <View style={styles.itemActions}>
        <TouchableOpacity 
          style={styles.viewCategoriesButton} 
          onPress={() => router.push(`/admin/restaurants/${item.id}/categories`)}
        >
          <Text style={styles.viewCategoriesButtonText}>📋 View Categories</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.editButton} onPress={() => handleEdit(item)}>
          <Text style={styles.editButtonText}>✏️ Edit</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.toggleButton, item.isAvailable ? styles.makeUnavailableButton : styles.makeAvailableButton]}
          onPress={() => toggleAvailability(item.id, item.isAvailable)}
        >
          <Text style={styles.toggleButtonText}>{item.isAvailable ? 'Make Unavailable' : 'Make Available'}</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.toggleButton, item.isActive ? styles.deactivateButton : styles.activateButton]}
          onPress={() => toggleActive(item.id, item.isActive)}
        >
          <Text style={styles.toggleButtonText}>{item.isActive ? 'Deactivate' : 'Activate'}</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.deleteButton} onPress={() => handleDelete(item.id, item.name)}>
          <Text style={styles.deleteButtonText}>🗑️ Delete</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  if (loading) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#C41E26" />
          <Text style={styles.loadingText}>Loading restaurants...</Text>
        </View>
      </SafeAreaView>
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
        data={restaurants}
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
            <View style={styles.formContainer}>
              <Text style={styles.formTitle}>Add New Restaurant</Text>

              <View style={styles.landscapeWarningBanner}>
                <Text style={styles.landscapeWarningIcon}>⚠️</Text>
                <Text style={styles.landscapeWarningText}>Please use a landscape (horizontal) image for best results. Portrait images may not display properly.</Text>
              </View>

              <Text style={styles.label}>Name *</Text>
              <TextInput style={styles.input} value={name} onChangeText={setName} placeholder="Restaurant name" />

              <Text style={styles.label}>Description</Text>
              <TextInput style={styles.textArea} value={description} onChangeText={setDescription} placeholder="Restaurant description" multiline />

              <ImageSelector
                label="Restaurant Image"
                currentImage={editingId ? restaurants.find(r => r.id === editingId)?.image || null : null}
                onImageSelect={setImageUri}
                size="normal"
                showLandscapeWarning={true}
              />

              <View style={styles.formGroup}>
                <Text style={styles.label}>Restaurant Address</Text>
                <TextInput style={styles.input} value={address} onChangeText={setAddress} placeholder="Enter restaurant address" />
              </View>

              <Text style={styles.label}>Phone</Text>
              <TextInput style={styles.input} value={phone} onChangeText={setPhone} placeholder="Phone number" keyboardType="phone-pad" />

              <Text style={styles.label}>Email</Text>
              <TextInput style={styles.input} value={email} onChangeText={setEmail} placeholder="Email address" keyboardType="email-address" />

              <Text style={styles.label}>Opening Time</Text>
              <TextInput style={styles.input} value={openingTime} onChangeText={setOpeningTime} placeholder="HH:MM (e.g., 09:00)" />

              <Text style={styles.label}>Closing Time</Text>
              <TextInput style={styles.input} value={closingTime} onChangeText={setClosingTime} placeholder="HH:MM (e.g., 21:00)" />

              <Text style={styles.label}>Cuisine Type</Text>
              <TextInput style={styles.input} value={cuisineType} onChangeText={setCuisineType} placeholder="Italian, Mexican, etc." />

              <Text style={styles.label}>Estimated Preparation Time (minutes)</Text>
              <TextInput style={styles.input} value={estimatedPrepTime} onChangeText={setEstimatedPrepTime} placeholder="30" keyboardType="numeric" />

              <Button
                title={editingId ? "Update Restaurant" : "Add Restaurant"}
                onPress={handleSubmit}
                disabled={!!actionLoading.submit}
              />

              {editingId && (
                <TouchableOpacity style={styles.cancelButton} onPress={resetForm}>
                  <Text style={styles.cancelButtonText}>Cancel Editing</Text>
                </TouchableOpacity>
              )}

              <Text style={styles.noteText}>Note: This will create/update a restaurant account.</Text>
            </View>

            <Text style={styles.sectionTitle}>Existing Restaurants</Text>
          </>
        }
      />
      
      Custom Alert Component
      <CustomAlert
        visible={customAlert.visible}
        title={customAlert.title}
        message={customAlert.message}
        buttons={customAlert.buttons}
        icon={customAlert.icon}
        onClose={() => setCustomAlert(prev => ({ ...prev, visible: false }))}
      />
        </SafeAreaView>
    </KeyboardAvoidingView>
  );
}

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
  headerContainer: {
    paddingTop: 30,
    paddingBottom: 30,
    paddingHorizontal: 16,
    backgroundColor: '#C41E26',
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
  list: {
    flex: 1,
  },
  listContent: {
    flexGrow: 1,
    paddingBottom: 200,
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
    paddingHorizontal: 16,
  },
  formContainer: {
    backgroundColor: '#fff',
    padding: 15,
    borderRadius: 8,
    marginHorizontal: 16,
    marginBottom: 20,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
  },
  landscapeWarningBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF3CD',
    borderLeftWidth: 4,
    borderLeftColor: '#F59E0B',
    borderRadius: 8,
    padding: 12,
    marginBottom: 15,
    gap: 8,
  },
  landscapeWarningIcon: {
    fontSize: 20,
    lineHeight: 24,
  },
  landscapeWarningText: {
    flex: 1,
    fontSize: 13,
    color: '#856404',
    lineHeight: 18,
  },
  formGroup: {
    marginBottom: 10,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 5,
  },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 4,
    padding: 10,
    fontSize: 14,
    marginBottom: 10,
    backgroundColor: '#f9f9f9',
  },
  textArea: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 4,
    padding: 10,
    fontSize: 14,
    marginBottom: 10,
    backgroundColor: '#f9f9f9',
    minHeight: 80,
  },
  noteText: {
    fontSize: 12,
    color: '#666',
    textAlign: 'center',
    marginTop: 10,
    fontStyle: 'italic',
  },
  cancelButton: {
    marginTop: 10,
    padding: 12,
    backgroundColor: '#f0f0f0',
    borderRadius: 4,
    alignItems: 'center',
  },
  cancelButtonText: {
    color: '#666',
    fontSize: 14,
    fontWeight: '600',
  },
  itemContainer: {
    backgroundColor: '#fff',
    padding: 15,
    marginHorizontal: 16,
    marginBottom: 10,
    borderRadius: 8,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
  },
  itemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  itemName: {
    fontSize: 18,
    fontWeight: 'bold',
    flex: 1,
  },
  badgeRow: {
    flexDirection: 'row',
    gap: 5,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  activeBadge: {
    backgroundColor: '#4CAF50',
  },
  inactiveBadge: {
    backgroundColor: '#9E9E9E',
  },
  availableBadge: {
    backgroundColor: '#2196F3',
  },
  unavailableBadge: {
    backgroundColor: '#FF9800',
  },
  badgeText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '600',
  },
  itemDescription: {
    fontSize: 14,
    color: '#666',
    marginBottom: 8,
  },
  cuisineBadge: {
    backgroundColor: '#f0f0f0',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    alignSelf: 'flex-start',
    marginBottom: 8,
  },
  cuisineBadgeText: {
    fontSize: 12,
    color: '#666',
  },
  itemRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  itemLabel: {
    fontSize: 13,
    color: '#666',
  },
  itemValue: {
    fontSize: 13,
    color: '#333',
    fontWeight: '500',
  },
  itemImage: {
    width: '100%',
    height: 220,
    borderRadius: 8,
    marginTop: 8,
    marginBottom: 12,
  },
  itemActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  viewCategoriesButton: {
    flex: 1,
    minWidth: 100,
    padding: 10,
    backgroundColor: '#9C27B0',
    borderRadius: 4,
    alignItems: 'center',
    marginBottom: 8,
  },
  viewCategoriesButtonText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '600',
  },
  editButton: {
    flex: 1,
    minWidth: 100,
    padding: 10,
    backgroundColor: '#2196F3',
    borderRadius: 4,
    alignItems: 'center',
  },
  editButtonText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '600',
  },
  toggleButton: {
    flex: 1,
    minWidth: 100,
    padding: 10,
    borderRadius: 4,
    alignItems: 'center',
  },
  makeAvailableButton: {
    backgroundColor: '#4CAF50',
  },
  makeUnavailableButton: {
    backgroundColor: '#FF9800',
  },
  activateButton: {
    backgroundColor: '#4CAF50',
  },
  deactivateButton: {
    backgroundColor: '#9E9E9E',
  },
  toggleButtonText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  deleteButton: {
    flex: 1,
    minWidth: 100,
    padding: 10,
    backgroundColor: '#C41E26',
    borderRadius: 4,
    alignItems: 'center',
  },
  deleteButtonText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '600',
  },
});

export default function ManageRestaurants() {
  return (
    <RequireAuth>
      <ManageRestaurantsContent />
    </RequireAuth>
  );
}
