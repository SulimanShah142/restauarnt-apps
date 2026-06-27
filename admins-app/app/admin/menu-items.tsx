import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, Button, FlatList, StyleSheet, Alert, TouchableOpacity, ScrollView, ActivityIndicator, KeyboardAvoidingView, Platform, Image, Modal } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { RequireAuth } from '@/contexts/AuthContext';
import ImageSelector from '@/components/ImageSelector';
import SelectModal from '@/components/SelectModal';
import { imageStorageService } from '@/lib/image-storage';
import { adminApiService } from '@/lib/admin-api-service';
import { deleteRecord } from '@/lib/deleteRecord';
import { checkNetworkStatus, showNetworkErrorAlert } from '@/lib/network-utils';
import { Spacing } from '@/lib/design-system';

// Helper function to generate a simple UUID
function generateUUID(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

// Define TypeScript interfaces
interface FoodItem {
  id: string; // Changed to string to match Prisma schema
  name: string;
  description: string;
  price: number;
  image: string | null; // Changed to match Prisma schema
  restaurant_id: string; // Changed to match database column name
  menu_category_id: string | null; // Changed to match database column name
  is_available: boolean; // Changed to match database column name
  preparation_time: number | null; // Changed to match database column name
  created_at: string; // Changed to match database column name
  updated_at: string; // Changed to match database column name
}

interface Restaurant {
  id: string; // Changed to string to match Prisma schema
  name: string;
}

function ManageMenuItemsContent() {
  const [menuItems, setMenuItems] = useState<FoodItem[]>([]);
  const [restaurants, setRestaurants] = useState<Restaurant[]>([]);
  const [categories, setCategories] = useState<any[]>([]); // Store categories for selected restaurant
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [price, setPrice] = useState('');
  const [imageUri, setImageUri] = useState<string | null>(null); // Changed to store local URI
  const [restaurantId, setRestaurantId] = useState('');
  const [category, setCategory] = useState<string | null>(null); // This will map to categoryId - can be null
  const [isAvailable, setIsAvailable] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null); // Changed to string
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<{[key: string]: boolean}>({}); // Track loading state per action
  const [categoryLoading, setCategoryLoading] = useState(false); // Track category loading
  const { categoryId } = useLocalSearchParams<{ categoryId?: string }>();
  const router = useRouter(); // Add router for navigation
  
  // State for custom selection modals
  const [showRestaurantModal, setShowRestaurantModal] = useState(false);
  const [showCategoryModal, setShowCategoryModal] = useState(false);

  // Load menu items and restaurants from API (online only)
  useEffect(() => {
    loadMenuItemsAndRestaurants();
  }, [categoryId]);

  const loadMenuItemsAndRestaurants = async () => {
    try {

      // Check network status first
      const isOnline = await checkNetworkStatus();
      if (!isOnline) {
        const userIgnored = await showNetworkErrorAlert();
        if (!userIgnored) {
          return; // User didn't ignore, exit
        }
      }

      // Load from Supabase API directly
      const [menuItemsData, restaurantsData] = await Promise.all([
        adminApiService.menuItems.getAll(),
        adminApiService.restaurants.getAll()
      ]);


      // Log each restaurant's ID to verify they exist
      restaurantsData.forEach((r: any, idx: number) => {
      });

      // Filter out any restaurants with invalid IDs
      const validRestaurants = restaurantsData.filter(r => r.id && typeof r.id === 'string' && r.id.length >= 5);

      setMenuItems(menuItemsData as FoodItem[]);
      setRestaurants(validRestaurants as Restaurant[]);
      setLoading(false);
    } catch (error) {
      console.error('[MenuItems] ❌ Error loading menu items and restaurants:', error);
      Alert.alert('Error', 'Failed to load menu items and restaurants. Please check your internet connection.');
      setLoading(false);
    }
  };

  // Load categories for selected restaurant
  const loadCategoriesForRestaurant = async (selectedRestaurantId: string) => {
    if (!selectedRestaurantId) {
      setCategories([]);
      return;
    }

    setCategoryLoading(true);
    try {
      
      // Fetch categories for this restaurant
      const categoriesData = await adminApiService.categories.getAll();
      const restaurantCategories = categoriesData.filter((c: any) => c.restaurant_id === selectedRestaurantId);
      
      setCategories(restaurantCategories);
    } catch (error) {
      console.error('[MenuItems] ❌ Error loading categories:', error);
      setCategories([]);
    } finally {
      setCategoryLoading(false);
    }
  };

  const handleSubmit = async () => {

    // Validate required fields
    if (!name || !name.trim()) {
      Alert.alert('Error', 'Please enter a name');
      return;
    }

    if (!description || !description.trim()) {
      Alert.alert('Error', 'Please enter a description for the dish (required field)');
      return;
    }

    if (!price || !price.trim()) {
      Alert.alert('Error', 'Please enter a price');
      return;
    }

    const priceNum = parseFloat(price);
    if (isNaN(priceNum) || priceNum <= 0) {
      Alert.alert('Error', 'Please enter a valid price (greater than 0)');
      return;
    }

    // CRITICAL: Validate restaurant_id is properly set
    if (!restaurantId || !restaurantId.trim()) {
      console.error('[MenuItems] ❌ ERROR: restaurantId is missing or empty:', restaurantId);
      Alert.alert('Error', 'Please select a restaurant. If no restaurants appear, you need to create one first.');
      return;
    }

    // Additional validation: ensure restaurantId is not a placeholder or invalid value
    if (restaurantId === 'null' || restaurantId === 'undefined' || restaurantId.length < 5) {
      console.error('[MenuItems] ❌ ERROR: restaurantId is invalid:', restaurantId);
      Alert.alert('Error', 'Invalid restaurant selected. Please try selecting the restaurant again.');
      return;
    }


    try {
      let imageUrl: string | null = null;

      // Upload image only if a local URI was selected.
      // If the form already contains a remote URL, preserve it instead of re-uploading it.
      if (imageUri) {
        if (imageUri.startsWith('http')) {
          imageUrl = imageUri;
        } else {
          imageUrl = await imageStorageService.uploadImage(imageUri, 'menu-items');
        }
      } else if (editingId) {
        // Preserve existing image URL when editing without changing the image.
        const existingItem = menuItems.find(item => item.id === editingId) as any;
        imageUrl = existingItem?.image_url || null;
      }

      // Prepare the menu item data
      const menuItemData: any = {
        name: name.trim(),
        description: description.trim(),
        price: priceNum,
        image_url: imageUrl,
        restaurant_id: restaurantId.trim(),
        is_available: isAvailable,
      };

      // Only add menu_category_id if it has a value
      if (category && category.trim()) {
        menuItemData.menu_category_id = category.trim();
      }

      if (editingId) {
        // Update existing menu item
        menuItemData.updated_at = new Date().toISOString();
        const updatedItem = await adminApiService.menuItems.update(editingId, menuItemData);

        setMenuItems(menuItems.map(item =>
          item.id === editingId ? updatedItem as FoodItem : item
        ));

        Alert.alert('Success', 'Menu item updated successfully');
      } else {
        // Create new menu item
        const newItem = await adminApiService.menuItems.create(menuItemData);

        setMenuItems([...menuItems, newItem as FoodItem]);
        Alert.alert('Success', 'Menu item created successfully');
      }

      resetForm();
    } catch (error) {
      console.error('[MenuItems] Error saving menu item:', error);
      const errorMessage = (error as Error).message;
      Alert.alert('Error', 'Failed to save menu item: ' + errorMessage);
    }
  };

  const handleDelete = async (item: FoodItem) => { // Changed to string
    
    const actionKey = `delete-${item.id}`;
    setActionLoading(prev => ({ ...prev, [actionKey]: true }));

    // Direct deletion without confirmation
    const deleteOperation = async () => {
      try {
        const result = await deleteRecord('menu_items', item.id, item.image);

        if (result.success) {
          // Update local state immediately for responsive UI (foreground update)
          setMenuItems(prevItems => prevItems.filter(menuItem => menuItem.id !== item.id));
          
          if (editingId === item.id) { // Changed to string
            resetForm();
          }
          Alert.alert('Success', 'Menu item deleted successfully');
        } else {
          Alert.alert('Error', `Failed to delete menu item: ${result.error}`);
        }
      } catch (error: any) {
        console.error('ERROR IN MENU ITEM DELETION:', error);
        console.error('ERROR MESSAGE:', error.message);
        console.error('ERROR STACK:', error.stack);
        Alert.alert('Error', `Failed to delete menu item: ${error.message || 'Unknown error'}`);
      } finally {
        setActionLoading(prev => ({ ...prev, [actionKey]: false }));
      }
    };

    deleteOperation();
  };

  const handleEdit = (item: FoodItem) => {
    setName(item.name);
    setDescription(item.description);
    setPrice(item.price.toString());
    setImageUri((item as any).image_url || null);
    setRestaurantId(item.restaurant_id);
    setCategory(item.menu_category_id || null); // Use null instead of empty string
    setIsAvailable(item.is_available);
    setEditingId(item.id);
  };

  const toggleAvailability = async (id: string) => {
    const item = menuItems.find(i => i.id === id);
    if (!item) {
      return;
    }

    const newStatus = !item.is_available;
    const actionText = newStatus ? 'activate' : 'deactivate';
    const actionKey = `toggle-${id}`;
    
    setActionLoading(prev => ({ ...prev, [actionKey]: true }));

    // Direct toggle without confirmation
    try {
      // Update local state immediately for responsive UI (foreground update)
      setMenuItems(prevItems => 
        prevItems.map(i => i.id === id ? { ...i, is_available: newStatus } : i)
      );
      
      const updatedItem = await adminApiService.menuItems.update(id, {
        is_available: newStatus
      });

      Alert.alert('Success', `Menu item ${actionText}d successfully`);
    } catch (error) {
      console.error('Error toggling availability:', error);
      // Revert state on error
      setMenuItems(prevItems => 
        prevItems.map(i => i.id === id ? { ...i, is_available: !newStatus } : i)
      );
      Alert.alert('Error', 'Failed to update availability');
    } finally {
      setActionLoading(prev => ({ ...prev, [actionKey]: false }));
    }
  };

  const resetForm = () => {
    setName('');
    setDescription('');
    setPrice('');
    setImageUri(null);
    setRestaurantId('');
    setCategory(null); // Use null instead of empty string
    setIsAvailable(true);
    setEditingId(null);
  };

  const renderItem = ({ item }: { item: FoodItem }) => {
    const deleteActionKey = `delete-${item.id}`;
    const toggleActionKey = `toggle-${item.id}`;
    const isDeleting = actionLoading[deleteActionKey];
    const isToggling = actionLoading[toggleActionKey];

    return (
      <View style={styles.itemContainer}>
        Menu Item Image
        {(item as any).image_url && (
          <Image
            source={{ uri: (item as any).image_url }}
            style={styles.itemImage}
            resizeMode="cover"
          />
        )}
        
        <Text style={styles.itemName}>{item.name}</Text>
        <Text style={styles.itemDescription}>{item.description}</Text>
        <Text style={styles.itemPrice}>AFG {item.price.toFixed(2)}</Text>
        <Text style={styles.itemRestaurant}>
          {restaurants.find(r => r.id === item.restaurant_id)?.name || `Restaurant ID: ${item.restaurant_id}`}
        </Text>
        <View style={styles.itemStatus}>
          <Text style={[styles.statusText, item.is_available ? styles.available : styles.unavailable]}>
            {item.is_available ? 'Available' : 'Unavailable'}
          </Text>
        </View>
        <View style={styles.itemActions}>
          <TouchableOpacity
            style={[styles.actionButton, styles.editButton]}
            onPress={() => handleEdit(item)}
            disabled={isDeleting || isToggling}
          >
            <Text style={styles.actionButtonText}>Edit</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.actionButton, item.is_available ? styles.deactivateButton : styles.activateButton, isToggling && styles.disabledButton]}
            onPress={() => toggleAvailability(item.id)}
            hitSlop={{top: 20, bottom: 20, left: 20, right: 20}}
            disabled={isToggling}
          >
            {isToggling ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Text style={styles.actionButtonText}>
                {item.is_available ? 'Deactivate' : 'Activate'}
              </Text>
            )}
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.actionButton, styles.deleteButton, isDeleting && styles.disabledButton]}
            onPress={() => {
              handleDelete(item);
            }}
            hitSlop={{top: 20, bottom: 20, left: 20, right: 20}}
            disabled={isDeleting}
          >
            {isDeleting ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Text style={styles.actionButtonText}>Delete</Text>
            )}
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <Text>Loading menu items...</Text>
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
          data={menuItems}
          renderItem={renderItem}
          keyExtractor={(item) => item.id}
          style={styles.list}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={true}
          keyboardShouldPersistTaps="handled"
          alwaysBounceVertical={true}
          bounces={true}
          ListHeaderComponent={
            <View>
            <View style={styles.formContainer}>
        <Text style={styles.label}>Name *</Text>
        <TextInput
          style={styles.input}
          value={name}
          onChangeText={setName}
          placeholder="Enter menu item name"
        />

        <Text style={styles.label}>Description *</Text>
        <TextInput
          style={[styles.textArea, styles.requiredInput]}
          value={description}
          onChangeText={setDescription}
          placeholder="Describe the dish (ingredients, taste, etc.) - Required"
          placeholderTextColor="#999"
          multiline
          numberOfLines={4}
        />

        <Text style={styles.label}>Price *</Text>
        <TextInput
          style={styles.input}
          value={price}
          onChangeText={setPrice}
          placeholder="Enter price"
          keyboardType="numeric"
        />

        <ImageSelector
          currentImage={editingId ? (menuItems.find(item => item.id === editingId) as any)?.image_url || null : null}
          onImageSelect={setImageUri}
          size="normal"
          showPortraitWarning={true}
          aspectRatio={[3, 4]} // Portrait aspect ratio for menu items
        />

        <Text style={styles.label}>Restaurant *</Text>
        <View style={styles.pickerContainer}>
          Display selected restaurant ID for debugging
          {restaurantId && (
            <View style={styles.selectedRestaurantBadge}>
              <Text style={styles.selectedRestaurantText}>
                ✅ Selected: {restaurants.find(r => r.id === restaurantId)?.name || 'Unknown'}
              </Text>
              <Text style={styles.selectedRestaurantId}>ID: {restaurantId}</Text>
            </View>
          )}
          
          <TouchableOpacity
            style={[styles.input, styles.restaurantPickerButton]}
            onPress={() => {
              
              if (restaurants.length === 0) {
                Alert.alert(
                  '⚠️ No Restaurants Available',
                  'Please create a restaurant first before adding menu items.\n\nGo to Restaurants → Add Restaurant',
                  [
                    { text: 'OK' },
                    { text: 'Create Restaurant', onPress: () => router.push('/admin/restaurants') }
                  ]
                );
                return;
              }
              
              setShowRestaurantModal(true);
            }}
            activeOpacity={0.7}
          >
            <Text style={styles.pickerLabel}>
              {restaurantId
                ? (restaurants.find(r => r.id === restaurantId)?.name || 'Select restaurant')
                : '👆 Tap to select restaurant'}
            </Text>
          </TouchableOpacity>

          {!restaurantId && (
            <Text style={styles.helperText}>⚠️ You must select a restaurant</Text>
          )}

          Beautiful Restaurant Selection Modal
          <SelectModal
            visible={showRestaurantModal}
            title="Select Restaurant"
            items={restaurants.map(r => ({ id: r.id, name: r.name }))}
            onSelect={(item) => {
              
              if (!item.id || item.id === '' || item.id.length < 5) {
                console.error('[MenuItems] ❌ ERROR: Invalid restaurant ID!');
                Alert.alert('❌ Error', 'This restaurant has an invalid ID. Please delete and recreate it.');
                return;
              }
              
              setRestaurantId(item.id);
              loadCategoriesForRestaurant(item.id);
              setShowRestaurantModal(false);
            }}
            onClose={() => setShowRestaurantModal(false)}
            searchPlaceholder="Search restaurants..."
            showCreateButton={true}
            onCreatePress={() => {
              setShowRestaurantModal(false);
              router.push('/admin/restaurants');
            }}
            createButtonText="Create New Restaurant"
          />

        <Text style={styles.label}>Category</Text>
        <View style={styles.pickerContainer}>
          {categoryLoading ? (
            <View style={styles.loadingCategoryContainer}>
              <ActivityIndicator size="small" color="#C41E26" />
              <Text style={styles.loadingCategoryText}>Loading categories...</Text>
            </View>
          ) : (
            <TouchableOpacity
              style={styles.input}
              onPress={() => {

                if (categories.length === 0) {
                  Alert.alert(
                    'ℹ️ No Categories',
                    'No categories found for this restaurant. You can create categories in the Categories section.',
                    [
                      { text: 'Cancel', style: 'cancel' },
                      { text: 'Create Category', onPress: () => router.push(`/admin/categories?restaurantId=${restaurantId}`) }
                    ]
                  );
                  return;
                }
                
                setShowCategoryModal(true);
              }}
              disabled={categories.length === 0 && !category}
            >
              <Text style={[
                styles.pickerLabel,
                categories.length === 0 && !category && styles.pickerLabelDisabled
              ]}>
                {categoryLoading
                  ? 'Loading...'
                  : category
                    ? (categories.find(c => c.id === category)?.name || 'Category selected')
                    : (categories.length > 0 ? '👆 Tap to select category' : 'No categories (select "Other" below)')
                }
              </Text>
            </TouchableOpacity>
          )}

          Show category count if restaurant is selected
          {restaurantId && categories.length > 0 && (
            <Text style={styles.helperText}>📂 {categories.length} categories available</Text>
          )}

          Beautiful Category Selection Modal
          <SelectModal
            visible={showCategoryModal}
            title="Select Category"
            items={categories.map(c => ({ id: c.id, name: c.name, description: c.description }))}
            onSelect={(item) => {
              setCategory(item.id);
              setShowCategoryModal(false);
            }}
            onClose={() => setShowCategoryModal(false)}
            searchPlaceholder="Search categories..."
            showCreateButton={true}
            onCreatePress={() => {
              setShowCategoryModal(false);
              router.push(`/admin/categories?restaurantId=${restaurantId}`);
            }}
            createButtonText="Create New Category"
          />
        </View>

        <View style={styles.checkboxContainer}>
          <TouchableOpacity
            style={styles.checkbox}
            onPress={() => setIsAvailable(!isAvailable)}
          >
            <Text style={styles.checkboxText}>{isAvailable ? '✓' : ''}</Text>
          </TouchableOpacity>
          <Text style={styles.checkboxLabel}>Available for ordering</Text>
        </View>

        <Button
          title={editingId ? "Update Menu Item" : "Add Menu Item"}
          onPress={handleSubmit}
          color="#C41E26"
        />
        {editingId && (
          <Button
            title="Cancel Edit"
            onPress={resetForm}
            color="#999"
          />
        )}
            </View>
            <Text style={styles.sectionTitle}>Existing Menu Items</Text>
          </View>
          </View>
        }
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
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
    justifyContent: 'center',
    alignItems: 'center',
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
  formContainer: {
    backgroundColor: 'white',
    padding: 15,
    borderRadius: 8,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 5,
    color: '#333',
  },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    padding: 10,
    fontSize: 16,
    borderRadius: 4,
    marginBottom: 15,
    backgroundColor: '#fff',
  },
  textArea: {
    borderWidth: 1,
    borderColor: '#ddd',
    padding: 10,
    fontSize: 16,
    borderRadius: 4,
    height: 80,
    textAlignVertical: 'top',
    marginBottom: 15,
    backgroundColor: '#fff',
  },
  requiredInput: {
    borderColor: '#C41E26',
    borderWidth: 2,
    backgroundColor: '#FFFBFB',
  },
  pickerContainer: {
    marginBottom: 15,
  },
  pickerLabel: {
    padding: 10,
    fontSize: 16,
  },
  restaurantPickerButton: {
    backgroundColor: '#f0f0f0',
    borderWidth: 2,
    borderColor: '#ddd',
  },
  selectedRestaurantBadge: {
    backgroundColor: '#e8f5e9',
    padding: 10,
    borderRadius: 6,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#4CAF50',
  },
  selectedRestaurantText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#2e7d32',
    marginBottom: 4,
  },
  selectedRestaurantId: {
    fontSize: 11,
    color: '#666',
    fontFamily: 'monospace',
  },
  helperText: {
    fontSize: 12,
    color: '#666',
    marginTop: 5,
    fontStyle: 'italic',
  },
  loadingCategoryContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 15,
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    backgroundColor: '#f5f5f5',
  },
  loadingCategoryText: {
    fontSize: 14,
    color: '#666',
    marginLeft: 10,
  },
  pickerLabelDisabled: {
    color: '#999',
    fontStyle: 'italic',
  },
  checkboxContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 15,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 4,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
    backgroundColor: '#fff',
  },
  checkboxText: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  checkboxLabel: {
    fontSize: 16,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 10,
    marginTop: 10,
    color: '#333',
  },
  itemContainer: {
    backgroundColor: 'white',
    padding: 15,
    borderRadius: 8,
    marginBottom: 10,
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
  itemImage: {
    width: '100%',
    height: 200,
    borderRadius: 8,
    marginBottom: 10,
    backgroundColor: '#f0f0f0',
  },
  itemName: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 5,
  },
  itemDescription: {
    fontSize: 14,
    color: '#666',
    marginBottom: 5,
  },
  itemPrice: {
    fontSize: 16,
    fontWeight: '600',
    color: '#007AFF',
    marginBottom: 5,
  },
  itemRestaurant: {
    fontSize: 14,
    color: '#007AFF',
    marginBottom: 5,
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
    backgroundColor: '#E8F5E9',
    color: '#388E3C',
  },
  unavailable: {
    backgroundColor: '#FFEBEE',
    color: '#C41E26',
  },
  itemActions: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#eee',
    zIndex: 10,
  },
  actionButton: {
    padding: 10,
    paddingVertical: 8,
    borderRadius: 6,
    marginLeft: 8,
    minWidth: 80,
    alignItems: 'center',
    zIndex: 10,
    elevation: 2,
  },
  editButton: {
    backgroundColor: '#C41E26',
    zIndex: 10,
    elevation: 2,
  },
  activateButton: {
    backgroundColor: '#4CAF50',
    zIndex: 10,
    elevation: 2,
  },
  deactivateButton: {
    backgroundColor: '#FF9800',
    zIndex: 10,
    elevation: 2,
  },
  deleteButton: {
    backgroundColor: '#C41E26',
    zIndex: 10,
    elevation: 2,
  },
  disabledButton: {
    opacity: 0.6,
  },
  actionButtonText: {
    color: 'white',
    fontWeight: '600',
  },
  // Modal styles for restaurant and category selection
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '80%',
    paddingBottom: Platform.OS === 'ios' ? 30 : 20,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
  },
  modalCloseButton: {
    fontSize: 24,
    color: '#666',
    padding: 4,
  },
  modalSubtitle: {
    fontSize: 14,
    color: '#666',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  restaurantList: {
    maxHeight: 300,
  },
  categoryList: {
    maxHeight: 300,
  },
  restaurantOption: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  categoryOption: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  restaurantOptionText: {
    fontSize: 16,
    color: '#333',
    fontWeight: '500',
    flex: 1,
  },
  categoryOptionText: {
    fontSize: 16,
    color: '#333',
    fontWeight: '500',
    flex: 1,
  },
  categoryOptionDescription: {
    fontSize: 13,
    color: '#666',
    marginTop: 2,
    flex: 1,
  },
  restaurantOptionArrow: {
    fontSize: 18,
    color: '#999',
    marginLeft: 8,
  },
  categoryOptionArrow: {
    fontSize: 18,
    color: '#999',
    marginLeft: 8,
  },
  createRestaurantButton: {
    margin: 16,
    padding: 14,
    backgroundColor: '#C41E26',
    borderRadius: 8,
    alignItems: 'center',
  },
  createCategoryButton: {
    margin: 16,
    padding: 14,
    backgroundColor: '#C41E26',
    borderRadius: 8,
    alignItems: 'center',
  },
  createRestaurantButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  createCategoryButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});

export default function ManageMenuItems() {
  return <RequireAuth><ManageMenuItemsContent /></RequireAuth>;
}