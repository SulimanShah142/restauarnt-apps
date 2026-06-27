import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, FlatList, Alert, ActivityIndicator, Modal, ScrollView, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';

// Define TypeScript interfaces
interface Category {
  id: string;
  name: string;
  description: string;
  image: string | null;
  restaurantId: string;
  createdAt: string;
  updatedAt: string;
}

interface Restaurant {
  id: string;
  name: string;
}

import { adminApiService, clearIndexedDBStore } from '@/lib/admin-api-service';
import { RequireAuth } from '@/contexts/AuthContext';
import { deleteRecord } from '@/lib/deleteRecord';

function CategoriesScreenContent() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [filteredCategories, setFilteredCategories] = useState<Category[]>([]);
  const [restaurants, setRestaurants] = useState<Restaurant[]>([]);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [restaurantId, setRestaurantId] = useState('');
  const [selectedRestaurantFilter, setSelectedRestaurantFilter] = useState<string>('all'); // Filter by restaurant
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState<{[key: string]: boolean}>({}); // Track loading state per action
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [showFilterDropdown, setShowFilterDropdown] = useState(false); // For filter dropdown
  const [showRestaurantDropdown, setShowRestaurantDropdown] = useState(false); // For form restaurant selection
  const router = useRouter();

  // Load categories and restaurants from API
  useEffect(() => {
    loadCategoriesAndRestaurants();
  }, []);

  // Filter categories when selectedRestaurantFilter changes
  useEffect(() => {
    if (selectedRestaurantFilter === 'all') {
      setFilteredCategories(categories);
    } else {
      setFilteredCategories(categories.filter(cat => cat.restaurantId === selectedRestaurantFilter));
    }
  }, [categories, selectedRestaurantFilter]);

  const loadCategoriesAndRestaurants = async () => {
    try {
      const [categoriesData, restaurantsData] = await Promise.all([
        adminApiService.categories.getAll(),
        adminApiService.restaurants.getAll()
      ]);

      // Transform categories data to match the expected interface
      const transformedCategories = categoriesData.map((item : any) => ({
        id: item.id,
        name: item.name,
        description: item.description || '',
        image: item.image || null,
        restaurantId: item.restaurant_id || item.restaurantId,
        createdAt: item.created_at || item.createdAt || new Date().toISOString(),
        updatedAt: item.updated_at || item.updatedAt || new Date().toISOString()
      }));

      // Transform restaurants data to match the expected interface
      const transformedRestaurants = restaurantsData.map(item => ({
        id: item.id,
        name: item.name
      }));

      setCategories(transformedCategories);
      setFilteredCategories(transformedCategories);
      setRestaurants(transformedRestaurants);
    } catch (error) {
      console.error('Error loading categories and restaurants:', error);
      Alert.alert('Error', 'Failed to load categories and restaurants');
    }
  };

  const handleSubmit = async () => {
    if (!name.trim() || !restaurantId) {
      Alert.alert('Error', 'Please enter category name and select a restaurant');
      return;
    }

    setLoading(true);

    try {
      if (editingId) {
        // Update existing category
        await adminApiService.categories.update(editingId, {
          name,
          description,
          restaurant_id: restaurantId
        });

        // Refresh the list
        loadCategoriesAndRestaurants();
        setEditingId(null);
      } else {
        // Add new category
        await adminApiService.categories.create({
          name,
          description,
          restaurant_id: restaurantId,
          image_url: null
        });

        // Refresh the list
        loadCategoriesAndRestaurants();
      }

      // Reset form
      resetForm();
      setLoading(false);
      Alert.alert('Success', editingId ? 'Category updated successfully' : 'Category created successfully');
    } catch (error) {
      console.error('Error saving category:', error);
      Alert.alert('Error', editingId ? 'Failed to update category' : 'Failed to create category');
      setLoading(false);
    }
  };

  const handleEdit = (category: Category) => {
    setName(category.name);
    setDescription(category.description || '');
    setRestaurantId(category.restaurantId);
    setEditingId(category.id);
    setShowForm(true);
  };

  const handleDelete = async (item: any) => {
    
    const actionKey = `delete-${item.id}`;
    setActionLoading(prev => ({ ...prev, [actionKey]: true }));

    try {
      // Step 1: Clear local IndexedDB cache (web)
      try {
        await clearIndexedDBStore('menu_categories');
      } catch (clearError) {
        console.error('[DeleteCategory] Error clearing cache:', clearError);
      }

      // Step 2: Delete from Supabase (requires internet)
      const result = await deleteRecord('menu_categories', item.id, item.image) as any;

      if (!result.success) {
        console.error('[DeleteCategory] Failed to delete from Supabase:', result.error);
        Alert.alert('Error', `Failed to delete category: ${result.error}`);
        return;
      }

      // Update local state immediately for responsive UI (foreground update)
      setCategories(prevCategories => prevCategories.filter(cat => cat.id !== item.id));
      setFilteredCategories(prevFiltered => prevFiltered.filter(cat => cat.id !== item.id));
      
      // Reset form if editing this item
      if (editingId === item.id) {
        resetForm();
      }

      // Step 3: BACKGROUND SYNC - Wait and reload without affecting UI
      await new Promise(resolve => setTimeout(resolve, 2000));

      loadCategoriesAndRestaurants().catch((syncError) => {
        console.error('[DeleteCategory] Background sync failed:', syncError);
      });

      Alert.alert('Success', 'Category and associated menu items deleted successfully');
    } catch (error: any) {
      console.error('[DeleteCategory] Error deleting:', error);
      Alert.alert('Error', `Failed to delete category: ${error.message || 'Unknown error'}`);
    } finally {
      setActionLoading(prev => ({ ...prev, [actionKey]: false }));
    }
  };

  const resetForm = () => {
    setName('');
    setDescription('');
    setRestaurantId('');
    setEditingId(null);
    setShowForm(false);
  };

  const getRestaurantName = (id: string) => {
    const restaurant = restaurants.find(r => r.id === id);
    return restaurant ? restaurant.name : 'Unknown';
  };

  const viewCategoryItems = (categoryId: string) => {
    // Navigate to menu items for this specific category
    router.push(`/admin/categories/${categoryId}/menu-items`);
  };

  const renderItem = ({ item }: { item: Category }) => {
    const deleteActionKey = `delete-${item.id}`;
    const isDeleting = actionLoading[deleteActionKey];
    
    return (
      <View style={styles.categoryCard}>
        <Text style={styles.categoryName}>{item.name}</Text>
        <Text style={styles.categoryDescription}>{item.description}</Text>
        <Text style={styles.categoryRestaurant}>{getRestaurantName(item.restaurantId)}</Text>
        <View style={styles.cardActions}>
          <TouchableOpacity
            style={[styles.actionButton, styles.viewButton]}
            onPress={() => viewCategoryItems(item.id)}
            disabled={isDeleting}
          >
            <Text style={styles.actionButtonText}>View Items</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.actionButton, styles.editButton]}
            onPress={() => handleEdit(item)}
            disabled={isDeleting}
          >
            <Text style={styles.actionButtonText}>Edit</Text>
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

  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.title}>Manage Categories</Text>

      Restaurant Filter
      <View style={styles.filterContainer}>
        <Text style={styles.filterLabel}>Filter by Restaurant:</Text>
        <TouchableOpacity
          style={styles.filterDropdown}
          onPress={() => setShowFilterDropdown(!showFilterDropdown)}
        >
          <Text style={styles.filterDropdownText}>
            {selectedRestaurantFilter === 'all' 
              ? 'All Restaurants' 
              : getRestaurantName(selectedRestaurantFilter)}
          </Text>
        </TouchableOpacity>
        
        {showFilterDropdown && (
          <View style={styles.dropdownOptions}>
            <TouchableOpacity
              style={styles.dropdownOption}
              onPress={() => {
                setSelectedRestaurantFilter('all');
                setShowFilterDropdown(false);
              }}
            >
              <Text style={styles.dropdownOptionText}>All Restaurants</Text>
            </TouchableOpacity>
            {restaurants.map(restaurant => (
              <TouchableOpacity
                key={restaurant.id}
                style={styles.dropdownOption}
                onPress={() => {
                  setSelectedRestaurantFilter(restaurant.id);
                  setShowFilterDropdown(false);
                }}
              >
                <Text style={styles.dropdownOptionText}>{restaurant.name}</Text>
              </TouchableOpacity>
            ))}
          </View>
        )}
      </View>

      <TouchableOpacity
        style={styles.addButton}
        onPress={() => {
          resetForm();
          setShowForm(true);
        }}
      >
        <Text style={styles.addButtonText}>+ Add Category</Text>
      </TouchableOpacity>

      Form Modal - separate dropdown state for form
      <Modal
        animationType="slide"
        transparent={true}
        visible={showForm}
        onRequestClose={resetForm}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalContentWrapper}>
            <ScrollView
              contentContainerStyle={styles.modalContentScroll}
              keyboardShouldPersistTaps="handled"
            >
              <Text style={styles.modalTitle}>
                {editingId ? 'Edit Category' : 'Add Category'}
              </Text>

              <TextInput
                style={styles.input}
                placeholder="Category Name *"
                value={name}
                onChangeText={setName}
              />

              <TextInput
                style={styles.input}
                placeholder="Description"
                value={description}
                onChangeText={setDescription}
                multiline
              />

              <Text style={styles.label}>Select Restaurant *</Text>
              <TouchableOpacity
                style={styles.dropdownContainer}
                onPress={() => setShowRestaurantDropdown(!showRestaurantDropdown)}
              >
                <Text style={styles.dropdownText}>
                  {restaurantId ? getRestaurantName(restaurantId) : 'Select Restaurant'}
                </Text>
              </TouchableOpacity>

              {showRestaurantDropdown && (
                <View style={styles.dropdownOptions}>
                  {restaurants.map(restaurant => (
                    <TouchableOpacity
                      key={restaurant.id}
                      style={styles.dropdownOption}
                      onPress={() => {
                        setRestaurantId(restaurant.id);
                        setShowRestaurantDropdown(false);
                      }}
                    >
                      <Text style={styles.dropdownOptionText}>{restaurant.name}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}

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
                      {editingId ? 'Update Category' : 'Add Category'}
                    </Text>
                  )}
                </TouchableOpacity>

                <TouchableOpacity style={styles.cancelButton} onPress={resetForm}>
                  <Text style={styles.cancelButtonText}>Cancel</Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>

      <FlatList
        data={filteredCategories}
        renderItem={renderItem}
        keyExtractor={(item) => item.id}
        style={styles.list}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>
              {selectedRestaurantFilter === 'all' 
                ? 'No categories found' 
                : `No categories for ${getRestaurantName(selectedRestaurantFilter)}`}
            </Text>
          </View>
        }
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
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 20,
    textAlign: 'center',
  },
  filterContainer: {
    marginBottom: 15,
    position: 'relative',
  },
  filterLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
    marginBottom: 8,
  },
  filterDropdown: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
  },
  filterDropdownText: {
    fontSize: 16,
    color: '#333',
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
  emptyContainer: {
    padding: 40,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 16,
    color: '#999',
    textAlign: 'center',
  },
  categoryCard: {
    backgroundColor: '#fff',
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
  categoryName: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 5,
  },
  categoryDescription: {
    fontSize: 14,
    color: '#666',
    marginBottom: 5,
  },
  categoryRestaurant: {
    fontSize: 14,
    color: '#888',
    marginBottom: 10,
  },
  cardActions: {
    flexDirection: 'row',
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
    marginRight: 8,
    minWidth: 80,
    alignItems: 'center',
    zIndex: 10,
    elevation: 2,
  },
  viewButton: {
    backgroundColor: '#28a745',
    zIndex: 10,
    elevation: 2,
  },
  editButton: {
    backgroundColor: '#C41E26',
    zIndex: 10,
    elevation: 2,
  },
  deleteButton: {
    backgroundColor: '#C41E26',
    zIndex: 10,
    elevation: 2,
  },
  actionButtonText: {
    color: '#fff',
    textAlign: 'center',
    fontWeight: 'bold',
    fontSize: 12,
  },
  modalContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  modalContentWrapper: {
    backgroundColor: '#fff',
    width: '90%',
    maxWidth: 400,
    maxHeight: '80%',
    borderRadius: 10,
  },
  modalContentScroll: {
    padding: 20,
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
  label: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 5,
  },
  pickerContainer: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 6,
    marginBottom: 15,
    backgroundColor: '#fafafa',
  },
  picker: {
    height: 50,
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
  dropdownContainer: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 6,
    marginBottom: 15,
    backgroundColor: '#fafafa',
    padding: 12,
  },
  dropdownText: {
    fontSize: 16,
    color: '#333',
  },
  dropdownOptions: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 6,
    maxHeight: 150,
    zIndex: 1000,
    elevation: 5,
    marginTop: 5,
  },
  dropdownOption: {
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  dropdownOptionText: {
    fontSize: 16,
    color: '#333',
  },
});

export default function CategoryScreen() {
  return <RequireAuth><CategoriesScreenContent /></RequireAuth>;
}