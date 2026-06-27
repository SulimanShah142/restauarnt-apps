import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, FlatList, Alert, ActivityIndicator, Modal } from 'react-native';
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

import { adminApiService } from '@/lib/admin-api-service';
import { RequireAuth } from '@/contexts/AuthContext';
import { deleteRecord } from '@/lib/deleteRecord';
import { ScrollView } from 'react-native';

function RestaurantCategoriesContent() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [restaurant, setRestaurant] = useState<Restaurant | null>(null);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const router = useRouter();
  const { id: restaurantId } = useLocalSearchParams<{ id: string }>();

  // Load categories and restaurant from API
  useEffect(() => {
    if (restaurantId) {
      loadCategoriesAndRestaurant();
    }
  }, [restaurantId]);

  const loadCategoriesAndRestaurant = async () => {
    try {
      const restaurantData = await adminApiService.getRestaurantById(restaurantId as string);
      const categoriesData = await adminApiService.getAllCategories(restaurantId as string);

      setRestaurant(restaurantData);
      setCategories(categoriesData as Category[]);
    } catch (error) {
      console.error('Error loading categories and restaurant:', error);
      Alert.alert('Error', 'Failed to load categories and restaurant');
    }
  };

  const handleSubmit = async () => {
    if (!name.trim() || !restaurantId) {
      Alert.alert('Error', 'Please enter category name');
      return;
    }

    setLoading(true);

    try {
      if (editingId) {
        // Update existing category
        await adminApiService.categories.update(editingId, {
          name,
          description,
          restaurant_id: restaurantId as string
        });

        // Refresh the list
        loadCategoriesAndRestaurant();
        setEditingId(null);
      } else {
        // Add new category
        await adminApiService.categories.create({
          name,
          description,
          restaurant_id: restaurantId as string,
          image_url: null
        });

        // Refresh the list
        loadCategoriesAndRestaurant();
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
    setEditingId(category.id);
    setShowForm(true);
  };

  const handleDelete = (item: any) => {
 // LOGGING ADDED
    
    // Direct deletion without confirmation
    const deleteOperation = async () => {
      try {
        const result = await deleteRecord('menu_categories', item.id, item.image);
        
        if (result.success) {
          // Refresh the list
          loadCategoriesAndRestaurant();
          if (editingId === item.id) {
            resetForm();
          }
          Alert.alert('Success', 'Category and associated menu items deleted successfully');
        } else {
          Alert.alert('Error', `Failed to delete category: ${result.error}`);
        }
      } catch (error: any) {
        console.error('ERROR IN RESTAURANT CATEGORY DELETION:', error);
        console.error('ERROR MESSAGE:', error.message);
        console.error('ERROR STACK:', error.stack);
        Alert.alert('Error', `Failed to delete category: ${error.message || 'Unknown error'}`);
      }
    };
    
    deleteOperation();
  };

  const resetForm = () => {
    setName('');
    setDescription('');
    setEditingId(null);
    setShowForm(false);
  };

  const viewCategoryItems = (categoryId: string) => {
    // Navigate to menu items filtered by this category
    router.push(`/admin/categories/${categoryId}/menu-items`);
  };

  const goBack = () => {
    router.navigate('/admin/restaurants');
  };

  const renderItem = ({ item }: { item: Category }) => (
    <View style={styles.categoryCard}>
      <Text style={styles.categoryName}>{item.name}</Text>
      <Text style={styles.categoryDescription}>{item.description}</Text>
      <View style={styles.cardActions}>
        <TouchableOpacity
          style={[styles.actionButton, styles.viewButton]}
          onPress={() => viewCategoryItems(item.id)}
        >
          <Text style={styles.actionButtonText}>View Items</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.actionButton, styles.editButton]}
          onPress={() => handleEdit(item)}
        >
          <Text style={styles.actionButtonText}>Edit</Text>
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

  if (!restaurant) {
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
        <Text style={styles.title}>Categories for {restaurant.name}</Text>
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

      {/* Form Modal */}
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
        data={categories}
        renderItem={renderItem}
        keyExtractor={(item) => item.id}
        style={styles.list}
        contentContainerStyle={styles.listContent}
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
  categoryCard: {
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
  categoryName: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 5,
  },
  categoryDescription: {
    fontSize: 14,
    color: '#666',
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

export default function RestaurantCategories() {
  return <RequireAuth><RestaurantCategoriesContent /></RequireAuth>;
}