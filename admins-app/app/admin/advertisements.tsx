import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, StyleSheet, TouchableOpacity, Alert, ScrollView, Image, ActivityIndicator, KeyboardAvoidingView, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import { supabase } from '@/lib/supabase';
import { compressImage } from '@/lib/image-utils';
import { imageStorageService } from '@/lib/image-storage';

// Generate UUID v4 for PostgreSQL compatibility
const generateUUID = (): string => {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
};

interface Advertisement {
  id: string;
  restaurant_id: string;
  title: string;
  description: string | null;
  image_url: string | null;
  link_url: string | null;
  priority: number;
  is_active: boolean;
  start_date: string;
  end_date: string | null;
  created_at: string;
  updated_at: string;
  restaurants?: { name: string } | null;
}

interface Restaurant {
  id: string;
  name: string;
}

export default function AdvertisementScreen() {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [restaurantId, setRestaurantId] = useState('');
  const [linkUrl, setLinkUrl] = useState('');
  const [priority, setPriority] = useState('5');
  const [isActive, setIsActive] = useState(true);
  const [startDate, setStartDate] = useState(new Date().toISOString().split('T')[0]);
  const [endDate, setEndDate] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [image, setImage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [restaurants, setRestaurants] = useState<Restaurant[]>([]);
  const [advertisements, setAdvertisements] = useState<Advertisement[]>([]);
  const [editingAd, setEditingAd] = useState<Advertisement | null>(null);

  useEffect(() => {
    loadRestaurants();
    loadAdvertisements();
  }, []);

  const loadRestaurants = async () => {
    try {
      const { data, error } = await supabase
        .from('restaurants')
        .select('id, name')
        .eq('is_active', true)
        .order('name');

      if (error) throw error;

      setRestaurants(data || []);
    } catch (error) {
      console.error('Error loading restaurants:', error);
      Alert.alert('Error', 'Failed to load restaurants');
    }
  };

  const loadAdvertisements = async () => {
    try {
      const { data, error } = await supabase
        .from('advertisements')
        .select(`
          *,
          restaurants (
            name
          )
        `)
        .order('priority', { ascending: false })
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Filter out outdated advertisements (end_date has passed)
      const now = new Date().toISOString();
      const activeAds = (data || []).filter(ad => {
        if (!ad.end_date) return true; // No end date = still active
        return ad.end_date >= now; // Only show if end_date is in future
      });

      setAdvertisements(activeAds);
    } catch (error) {
      console.error('Error loading advertisements:', error);
      Alert.alert('Error', 'Failed to load advertisements');
    }
  };

  const handleEdit = (ad: Advertisement) => {
    setEditingAd(ad);
    setTitle(ad.title);
    setDescription(ad.description || '');
    setRestaurantId(ad.restaurant_id);
    setLinkUrl(ad.link_url || '');
    setPriority(ad.priority.toString());
    setIsActive(ad.is_active);
    setStartDate(ad.start_date);
    setEndDate(ad.end_date || '');
    setImageUrl(ad.image_url || '');
    setImage(null);
  };

  const handleDelete = (id: string) => {
    Alert.alert(
      'Delete Advertisement',
      'Are you sure you want to delete this advertisement?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              const { error } = await supabase
                .from('advertisements')
                .delete()
                .eq('id', id);

              if (error) throw error;

              Alert.alert('Success', 'Advertisement deleted successfully!');
              loadAdvertisements();
            } catch (error) {
              console.error('Error deleting advertisement:', error);
              Alert.alert('Error', 'Failed to delete advertisement');
            }
          }
        }
      ]
    );
  };

  const pickImage = async () => {
    const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();

    if (permissionResult.granted === false) {
      Alert.alert('Permission required', 'Permission to access media library is required!');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [16, 9],
      quality: 0.8,
    });

    if (!result.canceled && result.assets && result.assets[0]) {
      setImage(result.assets[0].uri);
    }
  };

  const takePhoto = async () => {
    const permissionResult = await ImagePicker.requestCameraPermissionsAsync();

    if (permissionResult.granted === false) {
      Alert.alert('Permission required', 'Permission to access camera is required!');
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [16, 9],
      quality: 0.8,
    });

    if (!result.canceled && result.assets && result.assets[0]) {
      setImage(result.assets[0].uri);
    }
  };

  const uploadImage = async (): Promise<string | null> => {
    if (!image) return null;

    try {
      
      // Use the image storage service
      const uploadedUrl = await imageStorageService.uploadImage(image, 'advertisements');
      
      if (!uploadedUrl) {
        throw new Error('Image upload returned null');
      }

      return uploadedUrl;
    } catch (error: any) {
      console.error('[Advertisement] Error uploading image:', error);
      
      // Show specific error message
      let errorMessage = 'Failed to upload image';
      if (error?.message?.includes('Network')) {
        errorMessage = 'Network error: Please check your internet connection and try again';
      } else if (error?.message?.includes('bucket')) {
        errorMessage = 'Storage configuration error: Please contact support';
      } else if (error?.message) {
        errorMessage = error.message;
      }
      
      Alert.alert('Upload Error', errorMessage);
      return null;
    }
  };

  const handleSubmit = async () => {
    if (!title.trim()) {
      Alert.alert('Validation Error', 'Please enter a title');
      return;
    }

    if (!restaurantId) {
      Alert.alert('Validation Error', 'Please select a restaurant');
      return;
    }

    setLoading(true);

    try {
      let uploadedImageUrl: string | null = imageUrl;

      // Upload image only if a local URI was selected.
      // Preserve existing remote URLs during edit to avoid re-uploading an already uploaded image.
      if (image && !image.startsWith('http')) {
        const uploadResult = await uploadImage();

        if (uploadResult) {
          uploadedImageUrl = uploadResult;
        } else {
          // Image upload failed, but allow saving without image
          console.warn('[Advertisement] Image upload failed, proceeding without image');
          Alert.alert(
            'Warning',
            'Image upload failed. You can continue without an image or try again.',
            [
              { text: 'Cancel', style: 'cancel' },
              { text: 'Continue Without Image', onPress: () => {} }
            ]
          );
          // Wait for user decision - if they cancel, the promise will be rejected
          uploadedImageUrl = null;
        }
      }

      const advertisementData = {
        restaurant_id: restaurantId,
        title: title.trim(),
        description: description.trim() || null,
        image_url: uploadedImageUrl,
        link_url: linkUrl.trim() || null,
        is_active: isActive,
        priority: parseInt(priority) || 0,
        start_date: startDate,
        end_date: endDate || null,
      };

      if (editingAd) {
        const { error } = await supabase
          .from('advertisements')
          .update({
            ...advertisementData,
            updated_at: new Date().toISOString(),
          })
          .eq('id', editingAd.id);

        if (error) throw error;

        Alert.alert('Success', 'Advertisement updated successfully!');
      } else {
        // Generate proper UUID for PostgreSQL
        const newId = generateUUID();
        
        const { error } = await supabase
          .from('advertisements')
          .insert([{
            ...advertisementData,
            id: newId,
          }]);

        if (error) throw error;

        Alert.alert('Success', 'Advertisement created successfully!');
      }

      resetForm();
      loadAdvertisements();
    } catch (error) {
      console.error('Error saving advertisement:', error);
      Alert.alert('Error', `Failed to save advertisement: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setTitle('');
    setDescription('');
    setRestaurantId('');
    setLinkUrl('');
    setPriority('5');
    setIsActive(true);
    setStartDate(new Date().toISOString().split('T')[0]);
    setEndDate('');
    setImage(null);
    setImageUrl('');
    setEditingAd(null);
  };

  const toggleAdvertisementStatus = async (id: string, currentStatus: boolean) => {
    const newStatus = !currentStatus;
    const actionText = newStatus ? 'activate' : 'deactivate';

    Alert.alert(
      'Confirm Status Change',
      `Are you sure you want to ${actionText} this advertisement?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: newStatus ? 'Activate' : 'Deactivate',
          onPress: async () => {
            try {
              const { error } = await supabase
                .from('advertisements')
                .update({ 
                  is_active: newStatus,
                  updated_at: new Date().toISOString(),
                })
                .eq('id', id);

              if (error) throw error;

              Alert.alert('Success', `Advertisement ${actionText}d successfully!`);
              loadAdvertisements();
            } catch (error) {
              console.error('Error updating advertisement status:', error);
              Alert.alert('Error', 'Failed to update advertisement status');
            }
          }
        }
      ]
    );
  };

  const formatRestaurantName = (restaurantId: string, restaurantData: { name: string } | null | undefined) => {
    if (restaurantData?.name) return restaurantData.name;
    return restaurantId;
  };

  return (
    <KeyboardAvoidingView
      style={styles.keyboardView}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 100 : 20}
    >
      <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
        <ScrollView style={styles.container}>
          <Text style={styles.title}>{editingAd ? 'Edit Advertisement' : 'Create Advertisement'}</Text>

        <View style={styles.form}>
        <Text style={styles.label}>Title *</Text>
        <TextInput
          style={styles.input}
          placeholder="Enter advertisement title"
          value={title}
          onChangeText={setTitle}
        />

        <Text style={styles.label}>Description</Text>
        <TextInput
          style={[styles.input, styles.textArea]}
          placeholder="Enter description (optional)"
          value={description}
          onChangeText={setDescription}
          multiline
          numberOfLines={4}
        />

        <Text style={styles.label}>Link URL (optional)</Text>
        <TextInput
          style={styles.input}
          placeholder="https://example.com"
          value={linkUrl}
          onChangeText={setLinkUrl}
          keyboardType="url"
          autoCapitalize="none"
        />

        <Text style={styles.label}>Restaurant *</Text>
        <View style={styles.selectBox}>
          {restaurants.length > 0 ? (
            <ScrollView style={styles.selectScroll} nestedScrollEnabled={true}>
              {restaurants.map(restaurant => (
                <TouchableOpacity
                  key={restaurant.id}
                  style={[
                    styles.selectOption,
                    restaurantId === restaurant.id && styles.selectedOption
                  ]}
                  onPress={() => setRestaurantId(restaurant.id)}
                >
                  <Text style={restaurantId === restaurant.id ? styles.selectedOptionText : styles.selectOptionText}>
                    {restaurant.name}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          ) : (
            <Text style={styles.noDataText}>No restaurants available</Text>
          )}
        </View>

        <Text style={styles.label}>Priority (higher = shown first)</Text>
        <TextInput
          style={styles.input}
          placeholder="5"
          value={priority}
          onChangeText={setPriority}
          keyboardType="numeric"
        />

        <View style={styles.statusRow}>
          <Text style={styles.label}>Active</Text>
          <TouchableOpacity
            style={[styles.toggleSwitch, isActive && styles.toggleSwitchActive]}
            onPress={() => setIsActive(!isActive)}
          >
            <View style={[styles.toggleCircle, isActive && styles.toggleCircleActive]} />
          </TouchableOpacity>
        </View>

        <View style={styles.datesRow}>
          <View style={styles.dateBox}>
            <Text style={styles.label}>Start Date</Text>
            <TextInput
              style={styles.dateInput}
              value={startDate}
              onChangeText={setStartDate}
              placeholder="YYYY-MM-DD"
            />
          </View>

          <View style={styles.dateBox}>
            <Text style={styles.label}>End Date (optional)</Text>
            <TextInput
              style={styles.dateInput}
              value={endDate}
              onChangeText={setEndDate}
              placeholder="YYYY-MM-DD"
            />
          </View>
        </View>

        <Text style={styles.label}>Advertisement Image</Text>
        {(image || imageUrl) && (
          <Image 
            source={{ uri: image || imageUrl }} 
            style={styles.previewImage} 
            resizeMode="cover"
          />
        )}

        <View style={styles.imageButtons}>
          <TouchableOpacity 
            style={[styles.imageButton, styles.imageButtonPrimary]} 
            onPress={pickImage}
            disabled={loading}
          >
            <Text style={styles.imageButtonText}>Choose from Library</Text>
          </TouchableOpacity>

          <TouchableOpacity 
            style={[styles.imageButton, styles.imageButtonSecondary]} 
            onPress={takePhoto}
            disabled={loading}
          >
            <Text style={styles.imageButtonText}>Take Photo</Text>
          </TouchableOpacity>
        </View>

        <TouchableOpacity
          style={[styles.submitButton, loading && styles.disabledButton]}
          onPress={handleSubmit}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="white" />
          ) : (
            <Text style={styles.submitButtonText}>
              {editingAd ? 'Update Advertisement' : 'Create Advertisement'}
            </Text>
          )}
        </TouchableOpacity>

        {editingAd && (
          <TouchableOpacity
            style={styles.cancelButton}
            onPress={resetForm}
          >
            <Text style={styles.cancelButtonText}>Cancel Edit</Text>
          </TouchableOpacity>
        )}
      </View>

      <Text style={styles.sectionTitle}>Existing Advertisements ({advertisements.length})</Text>
      
      {advertisements.length === 0 ? (
        <View style={styles.noAdvertisements}>
          <Text style={styles.noDataText}>No advertisements created yet</Text>
        </View>
      ) : (
        <View style={styles.advertisementsList}>
          {advertisements.map(ad => (
            <View key={ad.id} style={styles.advertisementCard}>
              {ad.image_url && (
                <Image 
                  source={{ uri: ad.image_url }} 
                  style={styles.adImage} 
                  resizeMode="cover"
                />
              )}
              
              <View style={styles.adContent}>
                <View style={styles.adHeader}>
                  <Text style={styles.adTitle}>{ad.title}</Text>
                  <View style={[
                    styles.statusBadge,
                    ad.is_active ? styles.statusBadgeActive : styles.statusBadgeInactive
                  ]}>
                    <Text style={[
                      styles.statusText,
                      ad.is_active ? styles.statusTextActive : styles.statusTextInactive
                    ]}>
                      {ad.is_active ? 'Active' : 'Inactive'}
                    </Text>
                  </View>
                </View>

                {ad.description ? (
                  <Text style={styles.adDescription} numberOfLines={2}>
                    {ad.description}
                  </Text>
                ) : null}

                <Text style={styles.adRestaurant}>
                  📍 {formatRestaurantName(ad.restaurant_id, ad.restaurants)}
                </Text>

                <View style={styles.adMetaRow}>
                  <Text style={styles.adPriority}>Priority: {ad.priority}</Text>
                  <Text style={styles.adDates}>
                    {ad.start_date} {ad.end_date ? `→ ${ad.end_date}` : ''}
                  </Text>
                </View>

                <View style={styles.adButtons}>
                  <TouchableOpacity
                    style={[styles.adButton, styles.editButton]}
                    onPress={() => handleEdit(ad)}
                  >
                    <Text style={styles.adButtonText}>Edit</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.adButton, styles.toggleButton]}
                    onPress={() => toggleAdvertisementStatus(ad.id, ad.is_active)}
                  >
                    <Text style={styles.adButtonText}>
                      {ad.is_active ? 'Deactivate' : 'Activate'}
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.adButton, styles.deleteButton]}
                    onPress={() => handleDelete(ad.id)}
                  >
                    <Text style={styles.adButtonText}>Delete</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          ))}
        </View>
      )}

      Add Advertisement Button at Bottom
      <TouchableOpacity
        style={styles.addAdButton}
        onPress={() => {
          setEditingAd(null);
          setTitle('');
          setDescription('');
          setRestaurantId('');
          setLinkUrl('');
          setPriority('5');
          setIsActive(true);
          setStartDate(new Date().toISOString().split('T')[0]);
          setEndDate('');
          setImageUrl('');
          setImage(null);
        }}
      >
        <Text style={styles.addAdButtonText}>+ Add New Advertisement</Text>
      </TouchableOpacity>
        </ScrollView>
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
    backgroundColor: '#fff',
  },
  container: {
    flex: 1,
    padding: 16,
    backgroundColor: '#f5f5f5',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 16,
    textAlign: 'center',
    color: '#333',
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 12,
    color: '#333',
  },
  form: {
    backgroundColor: 'white',
    padding: 16,
    borderRadius: 12,
    marginBottom: 16,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#555',
    marginBottom: 8,
    marginTop: 8,
  },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    backgroundColor: '#fff',
  },
  textArea: {
    height: 100,
    textAlignVertical: 'top',
  },
  selectBox: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    backgroundColor: '#fff',
    maxHeight: 150,
  },
  selectScroll: {
    maxHeight: 150,
  },
  selectOption: {
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  selectedOption: {
    backgroundColor: '#FFF5F5',
  },
  selectOptionText: {
    fontSize: 15,
    color: '#333',
  },
  selectedOptionText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#C41E26',
  },
  noDataText: {
    fontSize: 14,
    color: '#999',
    textAlign: 'center',
    padding: 20,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginVertical: 12,
  },
  toggleSwitch: {
    width: 50,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#ccc',
    justifyContent: 'center',
    padding: 2,
  },
  toggleSwitchActive: {
    backgroundColor: '#4CAF50',
  },
  toggleCircle: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: 'white',
  },
  toggleCircleActive: {
    alignSelf: 'flex-end',
  },
  datesRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginVertical: 8,
  },
  dateBox: {
    flex: 1,
    marginRight: 8,
  },
  dateInput: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    fontSize: 15,
    backgroundColor: '#fff',
  },
  previewImage: {
    width: '100%',
    height: 200,
    borderRadius: 8,
    marginBottom: 12,
    backgroundColor: '#f0f0f0',
  },
  imageButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 8,
  },
  imageButton: {
    flex: 0.48,
    padding: 14,
    borderRadius: 8,
    alignItems: 'center',
  },
  imageButtonPrimary: {
    backgroundColor: '#C41E26',
  },
  imageButtonSecondary: {
    backgroundColor: '#333',
  },
  imageButtonText: {
    color: 'white',
    fontWeight: '600',
    fontSize: 14,
  },
  submitButton: {
    backgroundColor: '#4CAF50',
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 16,
  },
  disabledButton: {
    opacity: 0.6,
  },
  submitButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
  cancelButton: {
    backgroundColor: '#9E9E9E',
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 12,
  },
  cancelButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  noAdvertisements: {
    backgroundColor: 'white',
    padding: 32,
    borderRadius: 12,
    alignItems: 'center',
    elevation: 1,
  },
  advertisementsList: {
    gap: 12,
  },
  advertisementCard: {
    backgroundColor: 'white',
    borderRadius: 12,
    overflow: 'hidden',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  adImage: {
    width: '100%',
    height: 180,
    backgroundColor: '#f0f0f0',
  },
  adContent: {
    padding: 16,
  },
  adHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  adTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    flex: 1,
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    marginLeft: 8,
  },
  statusBadgeActive: {
    backgroundColor: '#E8F5E9',
  },
  statusBadgeInactive: {
    backgroundColor: '#FFEBEE',
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
  },
  statusTextActive: {
    color: '#4CAF50',
  },
  statusTextInactive: {
    color: '#C41E26',
  },
  adDescription: {
    fontSize: 14,
    color: '#666',
    marginBottom: 8,
    lineHeight: 20,
  },
  adRestaurant: {
    fontSize: 14,
    color: '#C41E26',
    marginBottom: 8,
    fontWeight: '500',
  },
  adMetaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  adPriority: {
    fontSize: 13,
    color: '#666',
  },
  adDates: {
    fontSize: 12,
    color: '#999',
  },
  adButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  adButton: {
    flex: 1,
    padding: 10,
    borderRadius: 6,
    alignItems: 'center',
  },
  editButton: {
    backgroundColor: '#2196F3',
  },
  toggleButton: {
    backgroundColor: '#FF9800',
  },
  deleteButton: {
    backgroundColor: '#C41E26',
  },
  adButtonText: {
    color: 'white',
    fontWeight: '600',
    fontSize: 13,
  },
  addAdButton: {
    backgroundColor: '#C41E26',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 24,
    marginBottom: 32,
  },
  addAdButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
});
