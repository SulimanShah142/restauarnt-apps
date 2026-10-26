import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, FlatList, Alert, ActivityIndicator, Modal, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';

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
  id: string;
  name: string;
  description: string;
  price: number;
  image: string | null;
  restaurant_id: string;
  menu_category_id: string | null;
  is_available: boolean;
  preparation_time: number | null;
  created_at: string;
  updated_at: string;
}

interface Category {
  id: string;
  name: string;
  description: string;
  image: string | null;
  restaurant_id: string;
  restaurantId?: string;
  created_at: string;
  updated_at: string;
}

interface Restaurant {
  id: string;
  name: string;
}

interface MenuItem {
  id: string;
  name: string;
  description: string;
  price: number;
  image_url: string | null;
  image: string | null; // Alias for FoodItem compatibility - required
  restaurant_id: string;
  menu_category_id: string | null;
  category_id?: string | null;
  category?: string | null;
  is_available: boolean;
  preparation_time: number | null;
  created_at: string;
  updated_at: string;
}

import { adminApiService, clearIndexedDBStore } from '@/lib/admin-api-service';
import { RequireAuth } from '@/contexts/AuthContext';
import ImageSelector from '@/components/ImageSelector';
import { imageStorageService } from '@/lib/image-storage';
import { deleteRecord } from '@/lib/deleteRecord';

function CategoryMenuItemsContent() {
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [category, setCategory] = useState<Category | null>(null);
  const [restaurant, setRestaurant] = useState<Restaurant | null>(null);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [price, setPrice] = useState('');
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [isAvailable, setIsAvailable] = useState(true);
  const [loading, setLoading] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const router = useRouter();
  const { id: routeCategoryId } = useLocalSearchParams<{ id?: string | string[] }>();
  const categoryId = Array.isArray(routeCategoryId) ? routeCategoryId[0] : routeCategoryId;

  // Load menu items and category from API
  useEffect(() => {
    if (categoryId) {
      loadMenuItemsAndCategory();
    }
  }, [categoryId]);

  const loadMenuItemsAndCategory = async () => {
    try {

      // Get the category by ID
      const allCategories = await adminApiService.categories.getAll();
      const categoryData = (allCategories as Category[]).find((cat) => String(cat.id) === String(categoryId));

      if (!categoryData) {
        throw new Error('Category not found');
      }

      // Get menu items for this category
      const allMenuItems = await adminApiService.menuItems.getAll() as MenuItem[];
      const menuItemsData = allMenuItems.filter((item) => {
        const itemCategories = [item.menu_category_id, item.category_id, item.category];
        return itemCategories.some((itemCategory) =>
          itemCategory != null &&
          (String(itemCategory) === String(categoryData.id) ||
            String(itemCategory) === String(categoryData.name))
        );
      });

      // Get restaurant data using the category's restaurant_id
      const restaurantData = await adminApiService.restaurants.getById(categoryData.restaurant_id || categoryData.restaurantId || '');


      // Map menu items to include both image_url and image for compatibility
      const mappedMenuItems: MenuItem[] = menuItemsData.map((item: any) => ({
        ...item,
        image: item.image_url ?? null
      }));

      setCategory(categoryData);
      setMenuItems(mappedMenuItems);
      setRestaurant(restaurantData);
    } catch (error) {
      console.error('[CategoryMenuItems] Error loading menu items and category:', error);
      Alert.alert('Error', 'Failed to load menu items and category');
    }
  };

  const handleSubmit = async () => {
    if (!name.trim() || !price.trim()) {
      Alert.alert('Error', 'Name and price are required');
      return;
    }

    const priceNum = parseFloat(price);
    if (isNaN(priceNum) || priceNum <= 0) {
      Alert.alert('Error', 'Please enter a valid price');
      return;
    }

    // CRITICAL: Get restaurant ID and log it
    const restaurantId = category?.restaurant_id || category?.restaurantId || '';
    
    if (!restaurantId || restaurantId === '' || restaurantId.length < 5) {
      console.error('[CategoryMenuItems] ❌ ERROR: Invalid restaurant ID:', restaurantId);
      Alert.alert('Error', 'Restaurant ID is invalid. Please go back and select a valid category.');
      setLoading(false);
      return;
    }

    setLoading(true);

    try {
      let imageUrl: string | null = null;

      // Upload image only if a local URI was selected.
      // Preserve existing remote URLs during edit to avoid re-uploading an already uploaded image.
      if (imageUri) {
        if (imageUri.startsWith('http')) {
          imageUrl = imageUri;
        } else {
          imageUrl = await imageStorageService.uploadImage(imageUri, 'menu-items');
        }
      } else if (editingId) {
        const existingItem = menuItems.find(item => item.id === editingId) as any;
        imageUrl = existingItem?.image_url || null;
      }

      if (editingId) {
        // Update existing menu item
        await adminApiService.menuItems.update(editingId, {
          name,
          description,
          price: priceNum,
          image_url: imageUrl || null,
          restaurant_id: restaurantId,
          menu_category_id: categoryId as string,
          is_available: isAvailable
        });

        // Refresh the list
        loadMenuItemsAndCategory();
      } else {
        // Create new menu item
        await adminApiService.menuItems.create({
          name,
          description,
          price: priceNum,
          image_url: imageUrl || null,
          restaurant_id: restaurantId,
          menu_category_id: categoryId as string,
          is_available: isAvailable
        });

        // Refresh the list
        loadMenuItemsAndCategory();
      }

      // Reset form
      resetForm();
      setLoading(false);
      Alert.alert('Success', editingId ? 'Menu item updated successfully' : 'Menu item created successfully');
    } catch (error) {
      console.error('Error saving menu item:', error);
      Alert.alert('Error', editingId ? 'Failed to update menu item' : 'Failed to create menu item');
      setLoading(false);
    }
  };

  const handleEdit = (item: MenuItem) => {
    setName(item.name);
    setDescription(item.description);
    setPrice(item.price.toString());
    setImageUri(item.image_url || null);
    setIsAvailable(item.is_available);
    setEditingId(item.id);
    setShowForm(true);
  };

  const handleDelete = async (item: MenuItem) => {
    
    // Step 1: Clear local IndexedDB cache (web)
    try {
      await clearIndexedDBStore('menu_items');
    } catch (clearError) {
      console.error('[DeleteMenuItem] Error clearing cache:', clearError);
    }
    
    // Step 2: Delete from Supabase (requires internet)
    try {
      const result = await deleteRecord('menu_items', item.id, item.image);
      
      if (!result.success) {
        console.error('[DeleteMenuItem] Failed to delete from Supabase:', result.error);
        Alert.alert('Error', `Failed to delete menu item: ${result.error}`);
        return;
      }
    } catch (error: any) {
      console.error('[DeleteMenuItem] Error deleting:', error);
      Alert.alert('Error', `Failed to delete menu item: ${error.message || 'Unknown error'}`);
      return;
    }
    
    // Step 3: Wait to ensure Supabase deletion is complete
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Step 4: Reload menu items directly from Supabase
    await loadMenuItemsAndCategory();
    
    // Reset form if editing this item
    if (editingId === item.id) {
      resetForm();
    }
    
    Alert.alert('Success', 'Menu item deleted successfully');
  };

  const toggleAvailability = async (id: string) => {
    const item = menuItems.find(i => i.id === id);
    if (!item) {
      return;
    }

    const newStatus = !item.is_available;
    const actionText = newStatus ? 'activate' : 'deactivate';
    
    // Direct toggle without confirmation
    try {
      const updatedItem = await adminApiService.updateFoodItem(id, {
        is_available: newStatus
      });

      setMenuItems(menuItems.map(i =>
        i.id === id ? (updatedItem as MenuItem) : i
      ));

      Alert.alert('Success', `Menu item ${actionText}d successfully`);
    } catch (error) {
      console.error('Error toggling availability:', error);
      Alert.alert('Error', 'Failed to update menu item availability');
    }
  };

  const resetForm = () => {
    setName('');
    setDescription('');
    setPrice('');
    setImageUri(null);
    setIsAvailable(true);
    setEditingId(null);
    setShowForm(false);
  };

  const goBack = () => {
    // Navigate back to the restaurant's categories page
    if (category?.restaurantId) {
      router.push(`/admin/restaurants/${category.restaurantId}/categories`);
    } else {
      // Fallback to categories page if restaurant ID not available
      router.navigate('/admin/categories');
    }
  };

  const renderItem = ({ item }: { item: MenuItem }) => (
    <View style={styles.itemContainer}>
      <Text style={styles.itemName}>{item.name}</Text>
      <Text style={styles.itemDescription}>{item.description}</Text>
      <Text style={styles.itemPrice}>AFG {item.price.toFixed(2)}</Text>
      <View style={styles.itemStatus}>
        <Text style={[styles.statusText, item.is_available ? styles.available : styles.unavailable]}>
          {item.is_available ? 'Available' : 'Unavailable'}
        </Text>
      </View>
      <View style={styles.itemActions}>
        <TouchableOpacity
          style={[styles.actionButton, styles.editButton]}
          onPress={() => handleEdit(item)}
        >
          <Text style={styles.actionButtonText}>Edit</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.actionButton, item.is_available ? styles.deactivateButton : styles.activateButton]}
          onPress={() => toggleAvailability(item.id)}
          hitSlop={{top: 20, bottom: 20, left: 20, right: 20}}
        >
          <Text style={styles.actionButtonText}>
            {item.is_available ? 'Deactivate' : 'Activate'}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.actionButton, styles.deleteButton]}
          onPress={() => {
            handleDelete(item);
          }}
          hitSlop={{top: 20, bottom: 20, left: 20, right: 20}}
        >
          <Text style={styles.actionButtonText}>Delete</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  if (!category || !restaurant) {
    return (
      <SafeAreaView style={styles.container}>
        <Text>Loading...</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={goBack} style={styles.backButton}>
          <Text style={styles.backButtonText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Items for {category.name}</Text>
      </View>

      <TouchableOpacity
        style={styles.addButton}
        onPress={() => {
          resetForm();
          setShowForm(true);
        }}
      >
        <Text style={styles.addButtonText}>+ Add Menu Item</Text>
      </TouchableOpacity>

      {/* Form Modal */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={showForm}
        onRequestClose={resetForm}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalContent}>
            <ScrollView showsVerticalScrollIndicator={false} style={{ flex: 1 }}>
              <Text style={styles.modalTitle}>
                {editingId ? 'Edit Menu Item' : 'Add Menu Item'}
              </Text>

              <TextInput
                style={styles.input}
                value={name}
                onChangeText={setName}
                placeholder="Menu item name"
              />

              <TextInput
                style={styles.textArea}
                value={description}
                onChangeText={setDescription}
                placeholder="Menu item description"
                multiline
              />

              <TextInput
                style={styles.input}
                value={price}
                onChangeText={setPrice}
                placeholder="0.00"
                keyboardType="decimal-pad"
              />

              <ImageSelector
                currentImage={imageUri || null}
                onImageSelect={setImageUri}
                size="small"
              />

              <View style={styles.checkboxContainer}>
                <TouchableOpacity
                  style={styles.checkbox}
                  onPress={() => setIsAvailable(!isAvailable)}
                >
                  <Text style={styles.checkboxText}>{isAvailable ? '✓' : ''}</Text>
                </TouchableOpacity>
                <Text style={styles.checkboxLabel}>Available for ordering</Text>
              </View>
            </ScrollView>
            
            <View style={styles.formActions}>
              <TouchableOpacity
                style={[styles.submitButton, loading && styles.disabledButton]}
                onPress={handleSubmit}
                disabled={loading}
              >
                {loading ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.submitButtonText}>
                    {editingId ? 'Update Item' : 'Add Item'}
                  </Text>
                )}
              </TouchableOpacity>

              <TouchableOpacity style={styles.cancelButton} onPress={resetForm}>
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <FlatList
        data={menuItems}
        renderItem={renderItem}
        keyExtractor={(item: MenuItem) => item.id}
        style={styles.list}
        contentContainerStyle={styles.listContent}
        extraData={menuItems}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
    padding: 15,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  backButton: {
    marginRight: 10,
    padding: 5,
  },
  backButtonText: {
    fontSize: 18,
    color: '#C41E26',
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    flex: 1,
    textAlign: 'center',
    paddingRight: 30,
  },
  addButton: {
    backgroundColor: '#C41E26',
    padding: 15,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 20,
  },
  addButtonText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 16,
  },
  list: {
    flex: 1,
  },
  listContent: {
    flexGrow: 1,
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 100,
  },
  itemContainer: {
    backgroundColor: '#fff',
    padding: 15,
    borderRadius: 8,
    marginBottom: 10,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
  },
  itemName: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  itemDescription: {
    fontSize: 14,
    color: '#666',
    marginVertical: 5,
  },
  itemPrice: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#C41E26',
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
    backgroundColor: '#dff0d8',
    color: '#3c763d',
  },
  unavailable: {
    backgroundColor: '#f2dede',
    color: '#a94442',
  },
  itemActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
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
    backgroundColor: '#28a745',
    zIndex: 10,
    elevation: 2,
  },
  deactivateButton: {
    backgroundColor: '#ffc107',
    zIndex: 10,
    elevation: 2,
  },
  deleteButton: {
    backgroundColor: '#dc3545',
    zIndex: 10,
    elevation: 2,
  },
  actionButtonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 12,
  },
  checkboxContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 15,
  },
  checkbox: {
    width: 20,
    height: 20,
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 3,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  checkboxText: {
    fontSize: 14,
    fontWeight: 'bold',
  },
  checkboxLabel: {
    fontSize: 16,
  },
  modalContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.5)',
    padding: 20,
  },
  modalContent: {
    backgroundColor: '#fff',
    width: '90%',
    maxWidth: 400,
    maxHeight: '80%',
    borderRadius: 10,
    padding: 20,
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    flex: 1,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 15,
    textAlign: 'center',
  },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    padding: 12,
    fontSize: 16,
    borderRadius: 6,
    marginBottom: 15,
    backgroundColor: '#fafafa',
  },
  textArea: {
    borderWidth: 1,
    borderColor: '#ddd',
    padding: 12,
    fontSize: 16,
    borderRadius: 6,
    height: 80,
    marginBottom: 15,
    backgroundColor: '#fafafa',
  },
  formActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  submitButton: {
    backgroundColor: '#C41E26',
    padding: 12,
    borderRadius: 6,
    flex: 0.6,
    alignItems: 'center',
  },
  disabledButton: {
    opacity: 0.6,
  },
  submitButtonText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 16,
  },
  cancelButton: {
    backgroundColor: '#ccc',
    padding: 12,
    borderRadius: 6,
    flex: 0.3,
    alignItems: 'center',
  },
  cancelButtonText: {
    color: '#333',
    fontWeight: 'bold',
    fontSize: 16,
  },
});

export default function CategoryMenuItems() {
  return <RequireAuth><CategoryMenuItemsContent /></RequireAuth>;
}