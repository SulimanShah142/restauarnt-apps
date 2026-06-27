import React, { useState, useEffect, useCallback, useRef } from 'react';
import { View, Text, FlatList, StyleSheet, TouchableOpacity, Image, TextInput, Dimensions, Alert, ActivityIndicator, Modal, ScrollView } from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { useCart } from '../../contexts/CartContext';
import { useAuth } from '../../contexts/AuthContext';
import { SafeAreaView } from 'react-native-safe-area-context';
import { restaurantService, Restaurant as RestaurantType, FoodItem as FoodItemType, Category as CategoryType } from '../../lib/restaurant-service';
import { supabase } from '../../lib/supabase';
import CategorySelector from '../../components/CategorySelector';
import ErrorDialog from '../../components/ErrorDialog';
import { OfflineIndicator } from '../../components/OfflineIndicator';
import { useCachedImages } from '../../hooks/useCachedImage';
import { checkRestaurantStatus } from '../../lib/restaurant-utils';
import { Colors, BorderRadius, Shadow, Spacing, Typography } from '../../lib/design-system';
import { getDatabase } from '../../db';
import AdvertisementModal from '../../components/AdvertisementModal';

interface CollapsibleRestaurantCardProps {
  restaurant: RestaurantType;
  onPress: () => void;
  getCached: (url: string) => string;
}

function CollapsibleRestaurantCard({ restaurant, onPress, getCached }: CollapsibleRestaurantCardProps) {
  const { isOpen } = checkRestaurantStatus(
    restaurant.opening_time ?? null,
    restaurant.closing_time ?? null
  );

  const handlePress = () => {
    onPress();
  };

  return (
    <TouchableOpacity
      style={[styles.restaurantCard, !isOpen && styles.closedRestaurantCard]}
      onPress={handlePress}
      activeOpacity={0.7}
    >
      {restaurant.cuisine_type && (
        <View style={styles.cuisineBadge}>
          <Text style={styles.cuisineBadgeText}>{restaurant.cuisine_type}</Text>
        </View>
      )}

      {!isOpen && (
        <View style={styles.closedBadgeOverlay}>
          <View style={styles.closedBadge}>
            <Text style={styles.closedBadgeText}>Closed</Text>
          </View>
        </View>
      )}

      <Image
        source={{
          uri: restaurant.image_base64
            ? `data:image/jpeg;base64,${restaurant.image_base64}`
            : restaurant.image_url && restaurant.image_url.trim() !== ''
            ? getCached(restaurant.image_url)
            : 'https://placehold.co/400x200?text=No+Image'
        }}
        style={[styles.restaurantImageWide, !isOpen && styles.closedImage]}
        resizeMode="cover"
      />

      <View style={styles.restaurantInfoBelow}>
        <View style={styles.restaurantNameRow}>
          <Text style={[styles.restaurantNameBelow, !isOpen && styles.closedText]}>
            {restaurant.name || 'Unnamed Restaurant'}
          </Text>
          {!isOpen && (
            <View style={styles.closedStatusBadge}>
              <Text style={styles.closedStatusText}>Closed</Text>
            </View>
          )}
        </View>

        {restaurant.cuisine_type && (
          <Text style={styles.cuisineTypeText}>
            {restaurant.cuisine_type}
          </Text>
        )}
      </View>
    </TouchableOpacity>
  );
}

export default function MenuScreen() {
  const router = useRouter();
  const { state: cartState, dispatch } = useCart();

  const [selectedRestaurant, setSelectedRestaurant] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [foodSearchQuery, setFoodSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [restaurants, setRestaurants] = useState<RestaurantType[]>([]);
  const [foodItems, setFoodItems] = useState<FoodItemType[]>([]);
  const [categories, setCategories] = useState<CategoryType[]>([]);
  const [loading, setLoading] = useState(true); // Start true - always show loading first
  const [errorVisible, setErrorVisible] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [isLoadingFoodItems, setIsLoadingFoodItems] = useState(false);
  const [showAdvertisement, setShowAdvertisement] = useState(false);
  const [selectedFoodItemDetails, setSelectedFoodItemDetails] = useState<FoodItemType | null>(null);

  // Use AuthContext (which uses Supabase auth) - matches admins-app/deliverapp pattern
  const { session, isAuthenticated, isLoading: isAuthLoading } = useAuth();

  // Show loading while auth is initializing
  const isInitializing = isAuthLoading || isAuthenticated === null;

  // Collect all image URLs for caching
  const restaurantImageUrls = restaurants
    .map(r => r.image_url)
    .filter((url): url is string => !!url && url.startsWith('http'));
  const foodImageUrls = foodItems
    .map(f => f.image_url)
    .filter((url): url is string => !!url && url.startsWith('http'));
  const allImageUrls = [...restaurantImageUrls, ...foodImageUrls];

  const { getCached } = useCachedImages(allImageUrls, true);
  const dataLoadedRef = useRef(false);
  const hasEverSelectedRestaurantRef = useRef(false);
  const initialLoadDoneRef = useRef(false);

  const loadMenuData = useCallback(async () => {
    // Prevent duplicate concurrent calls
    if (initialLoadDoneRef.current) {
      console.log('[Menu] loadMenuData already done, skipping duplicate call');
      return;
    }

    console.log('[Menu] loadMenuData called - setting loading to true');
    setLoading(true);
    initialLoadDoneRef.current = true;

    try {
      const loadedRestaurants = await restaurantService.getAllRestaurants({
        userId: session?.user?.id,
        forceSync: true
      });

      console.log('[Menu] Loaded restaurants:', loadedRestaurants.length);
      setRestaurants(loadedRestaurants);
      dataLoadedRef.current = true;
    } catch (error) {
      console.error('[Menu] Error loading restaurants:', error);
      setRestaurants([]);
      setErrorVisible(true);
      setErrorMessage(error instanceof Error ? error.message : 'An unknown error occurred while loading restaurants');
    } finally {
      setLoading(false);
      console.log('[Menu] loadMenuData complete, loading set to false');
    }
  }, [session?.user?.id]);

  // Manual refresh function - forces sync and reloads data
  const handleRefresh = useCallback(async () => {
    setLoading(true);

    try {
      const refreshedRestaurants = await restaurantService.getAllRestaurants({
        userId: session?.user?.id,
        forceSync: true
      });
      setRestaurants(refreshedRestaurants);
      dataLoadedRef.current = true;
    } catch (error) {
      console.error('[Menu] Refresh error:', error);
    } finally {
      setLoading(false);
    }
  }, [session?.user?.id]);

  // Load food items callback - fetches from Supabase when online
  const loadFoodItems = useCallback(async (restaurantId: string) => {

    if (!restaurantId || restaurantId === 'null' || restaurantId === 'undefined') {
      // console.error('loadFoodItems: Invalid restaurant ID:', restaurantId);
      setFoodItems([]);
      setIsLoadingFoodItems(false);
      return;
    }

    // Set loading state
    setIsLoadingFoodItems(true);

    try {
      // Service fetches from Supabase when online, fallback to local DB
      // console.log('[Menu] Loading food items for restaurant:', restaurantId);
      const foodItems = await restaurantService.getMenuItemsByRestaurant(restaurantId);
      // console.log('[Menu] Loaded food items:', foodItems.length);
      setFoodItems(foodItems);

      // Trigger background sync for menu items (non-blocking)
      setTimeout(async () => {
        try {
          const { performBackgroundSync } = await import('../../lib/enhanced-sync-service');
          const { getDatabase } = await import('../../db');
          const db = await getDatabase();
          const dbAny = db as any;
          if (dbAny && dbAny.getDatabase) {
            const sqliteDb = dbAny.getDatabase();
            if (sqliteDb) {
              await performBackgroundSync(sqliteDb, session?.user?.id);
              // console.log('[Menu] Menu items background sync completed');
            }
          }
        } catch (syncError) {
          // console.error('[Menu] Menu items background sync error:', syncError);
          // Silently fail - data is already displayed
        }
      }, 0);

      // Stop loading once food items are loaded (regardless of whether there are items)
      setIsLoadingFoodItems(false);
    } catch (error) {
      // console.error('loadFoodItems: Error loading food items:', error);
      setFoodItems([]);
      setErrorVisible(true);
      setErrorMessage(error instanceof Error ? error.message : 'An unknown error occurred while loading food items');
      setIsLoadingFoodItems(false);
    }
  }, [session?.user?.id]);

  const loadCategories = useCallback(async (restaurantId: string) => {

    if (!restaurantId || restaurantId === 'null' || restaurantId === 'undefined') {
      // console.error('loadCategories: Invalid restaurant ID:', restaurantId);
      setCategories([]);
      return;
    }

    try {
      // Service fetches from Supabase when online, fallback to local DB
      // console.log('[Menu] Loading categories for restaurant:', restaurantId);
      const categories = await restaurantService.getMenuCategoriesByRestaurant(restaurantId);
      // console.log('[Menu] Loaded categories:', categories.length);
      setCategories(categories);
    } catch (error) {
      // console.error('loadCategories: Error loading categories:', error);
      setCategories([]);
      setErrorVisible(true);
      setErrorMessage(error instanceof Error ? error.message : 'An unknown error occurred while loading categories');
    }
  }, []);

  // Load food items and categories when a restaurant is selected
  useEffect(() => {
    if (selectedRestaurant) {
      if (!selectedRestaurant || selectedRestaurant === 'null' || selectedRestaurant === 'undefined') {
        // console.error('useEffect: Invalid restaurant ID:', selectedRestaurant);
        setFoodItems([]);
        setCategories([]);
        setIsLoadingFoodItems(false);
        return;
      }
      loadFoodItems(selectedRestaurant);
      loadCategories(selectedRestaurant);
    }
  }, [selectedRestaurant, loadFoodItems, loadCategories]);

  // Initial load effect - runs only ONCE on mount
  useEffect(() => {
    console.log('[Menu] Component mounted - initial load');
    loadMenuData();

    // Show advertisement 5 seconds after entering menu
    const adTimer = setTimeout(() => {
      setShowAdvertisement(true);
    }, 5000);

    return () => clearTimeout(adTimer);
  }, []); // Empty deps - only runs once on mount

  // Show loading only while auth is still initializing (before it has a definitive answer)
  // Skip this if we're already loading restaurants ourselves
  if (isInitializing && restaurants.length === 0) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#C41E26" />
          <Text style={styles.loadingText}>Loading menu...</Text>
        </View>
      </SafeAreaView>
    );
  }

  // Show loading for food items when restaurant selected
  const showFoodLoading = selectedRestaurant && isLoadingFoodItems;

  // Filter food items based on selected restaurant, category, and search query
  const filteredFoodItems = selectedRestaurant
    ? foodItems.filter((item) => {
        if (!item.restaurant_id || !selectedRestaurant) {
          return false;
        }
        const matchesRestaurant = item.restaurant_id === selectedRestaurant;

        let matchesCategory = true;
        if (selectedCategory) {
          const selectedCategoryObj = categories.find(cat => cat.id === selectedCategory);

          if (selectedCategoryObj) {
            const itemMenuCategoryId = (item as any).menu_category_id;
            const itemCategoryId = (item as any).category_id;
            const itemCategoryName = item.category;

            matchesCategory = (
              itemMenuCategoryId === selectedCategoryObj.id ||
              itemCategoryId === selectedCategoryObj.id ||
              itemCategoryName === selectedCategoryObj.id ||
              itemCategoryName === selectedCategoryObj.name
            );
          } else {
            matchesCategory = false;
          }
        }

        const itemName = item.name || '';
        const itemDescription = item.description || '';
        const matchesSearch =
          itemName.toLowerCase().includes(foodSearchQuery.toLowerCase()) ||
          itemDescription.toLowerCase().includes(foodSearchQuery.toLowerCase());

        return matchesRestaurant && matchesCategory && matchesSearch;
      })
    : [];

  // Filter restaurants based on search query
  const filteredRestaurants = restaurants.filter(restaurant => {
    const name = restaurant.name || '';
    const description = restaurant.description || '';
    return name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      description.toLowerCase().includes(searchQuery.toLowerCase());
  });

  // Function to toggle item in cart
  const toggleCartItem = (foodItem: FoodItemType) => {

    if (!foodItem || !foodItem.id) {
      // console.error('toggleCartItem: Invalid food item:', foodItem);
      Alert.alert('Error', 'Invalid food item');
      return;
    }

    if (!foodItem.restaurant_id) {
      // console.error('toggleCartItem: Missing restaurant_id for item:', foodItem.id);
      Alert.alert('Error', 'This item is missing restaurant information. Please try again.');
      return;
    }

    const restaurant = restaurants.find(r => r.id === foodItem.restaurant_id);
    if (restaurant) {
      const { isOpen } = checkRestaurantStatus(
        restaurant.opening_time ?? null,
        restaurant.closing_time ?? null
      );
      if (!isOpen) {
        Alert.alert(
          '🚫 Restaurant Closed',
          `${restaurant.name} is currently closed.\n\nOpening hours: ${restaurant.opening_time || 'N/A'} - ${restaurant.closing_time || 'N/A'}\n\nPlease try again when the restaurant is open.`,
          [{ text: 'OK' }]
        );
        return;
      }
    }

    const existingItemIndex = cartState.items.findIndex(cartItem => cartItem.foodItem.id === foodItem.id);

    if (existingItemIndex >= 0) {
      dispatch({ type: 'REMOVE_ITEM', payload: { id: foodItem.id } });
    } else {
      // Check if cart already has items from a different restaurant
      const cartRestaurantId = cartState.items.length > 0 ? cartState.items[0]?.restaurantId : null;

      if (cartRestaurantId && cartRestaurantId !== foodItem.restaurant_id) {
        // Get the name of the restaurant already in cart if possible
        const existingItem = cartState.items[0];
        Alert.alert(
          '🚫 One Restaurant at a Time',
          `Your cart has items from a different restaurant.\n\nYou can only order from one restaurant at a time. Please complete or clear your current order before adding items from ${restaurant.name}.`,
          [{ text: 'OK' }]
        );
        return;
      }

      const cartItem = {
        id: foodItem.id,
        foodItem: {
          id: foodItem.id,
          name: foodItem.name,
          description: foodItem.description,
          price: foodItem.price,
          image: foodItem.image_url,
          restaurantId: foodItem.restaurant_id
        },
        quantity: 1,
        restaurantId: foodItem.restaurant_id
      };

      dispatch({ type: 'ADD_ITEM', payload: cartItem });
    }
  };

  const goToCart = () => {
    try {
      router.push('/(tabs)/cart');
    } catch (error) {
      console.error('[Menu] Navigation error:', error);
    }
  };

  // Track when user selects a restaurant
  useEffect(() => {
    if (selectedRestaurant) {
      hasEverSelectedRestaurantRef.current = true;
    }
  }, [selectedRestaurant]);

  // Reset state when going back to restaurant list (only AFTER user has selected a restaurant)
  useEffect(() => {
    // Skip on initial mount - only run after user has navigated
    if (!hasEverSelectedRestaurantRef.current) {
      return;
    }

    if (!selectedRestaurant) {
      console.log('[Menu] Returned to restaurant list - resetting and reloading');
      // Clear food items and categories when returning to list
      setFoodItems([]);
      setCategories([]);
      setSelectedCategory(null);
      setFoodSearchQuery('');
      // Reload restaurants - reset the initial load flag
      dataLoadedRef.current = false;
      initialLoadDoneRef.current = false;
      setLoading(true);
      loadMenuData();
    }
  }, [selectedRestaurant, loadMenuData]);

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        <OfflineIndicator />

        <ErrorDialog
          visible={errorVisible}
          title="Error"
          message={errorMessage}
          onClose={() => setErrorVisible(false)}
        />

        {!selectedRestaurant && (
          <TextInput
            style={styles.searchBar}
            placeholder="Search restaurants..."
            placeholderTextColor="#999"
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
        )}

        {!selectedRestaurant && (
          <View style={styles.listContainer}>
            {loading && restaurants.length === 0 ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color="#C41E26" />
                <Text style={styles.loadingText}>Loading restaurants...</Text>
              </View>
            ) : (
              <FlatList
                data={filteredRestaurants}
                keyExtractor={(item : any) => item.id?.toString() || Math.random().toString()}
                renderItem={({ item }: any) => (
                  <CollapsibleRestaurantCard
                    restaurant={item}
                    onPress={() => setSelectedRestaurant(item.id)}
                    getCached={getCached}
                  />
                )}
                showsVerticalScrollIndicator={false}
                contentContainerStyle={styles.flatListContent}
                scrollEnabled={filteredRestaurants.length > 0}
                refreshing={loading}
                onRefresh={handleRefresh}
                ListEmptyComponent={
                  !loading && filteredRestaurants.length === 0 ? (
                    <View style={styles.emptyContainer}>
                      <Text style={styles.emptyText}>No restaurants available</Text>
                    </View>
                  ) : null
                }
              />
            )}
          </View>
        )}

        {selectedRestaurant && (
          <View style={styles.foodListContainer}>
            {(() => {
              const restaurant = restaurants.find(r => r.id === selectedRestaurant);
              const { isOpen } = restaurant ? checkRestaurantStatus(
                restaurant.opening_time ?? null,
                restaurant.closing_time ?? null
              ) : { isOpen: true };

              if (!isOpen) {
                return (
                  <View style={styles.closedBanner}>
                    <Text style={styles.closedBannerIcon}>🚫</Text>
                    <View style={styles.closedBannerContent}>
                      <Text style={styles.closedBannerTitle}>Restaurant Closed</Text>
                      <Text style={styles.closedBannerText}>
                        {restaurant?.name} is currently closed.
                      </Text>
                      <Text style={styles.closedBannerHours}>
                        🕒 {restaurant?.opening_time || 'N/A'} - {restaurant?.closing_time || 'N/A'}
                      </Text>
                      <Text style={styles.closedBannerNote}>
                        You can browse the menu, but ordering is unavailable.
                      </Text>
                    </View>
                  </View>
                );
              }
              return null;
            })()}

            <View style={styles.foodListHeader}>
              <TouchableOpacity
                style={styles.backButton}
                onPress={() => setSelectedRestaurant(null)}
              >
                <Text style={styles.backButtonText}>← Back to Restaurants</Text>
              </TouchableOpacity>
            </View>

            <Text style={styles.sectionTitle}>
              {restaurants.find(r => r.id === selectedRestaurant)?.name || 'Menu'}
            </Text>

            <CategorySelector
              categories={categories}
              selectedCategory={selectedCategory}
              onSelectCategory={setSelectedCategory}
            />

            <TextInput
              style={styles.searchBar}
              placeholder="Search items..."
              placeholderTextColor="#999"
              value={foodSearchQuery}
              onChangeText={setFoodSearchQuery}
            />

            {/* Show loading indicator when fetching food items */}
            {isLoadingFoodItems && selectedRestaurant && (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color="#C41E26" />
              </View>
            )}

            {/* Show message if no food items found (only when NOT loading and truly empty) */}
            {!isLoadingFoodItems && selectedRestaurant && foodItems.length === 0 && categories.length === 0 && (
              <View style={styles.emptyContainer}>
                <Text style={styles.emptyText}>No menu items available</Text>
              </View>
            )}

            <View style={styles.listContainer}>
              <FlatList
                data={filteredFoodItems}
                numColumns={2}
                keyExtractor={(item : any) => item.id?.toString() || Math.random().toString()}
                renderItem={({ item }: any) => {
                  const restaurant = restaurants.find(r => r.id === selectedRestaurant);
                  const isRestaurantOpen = restaurant
                    ? checkRestaurantStatus(
                        restaurant.opening_time ?? null,
                        restaurant.closing_time ?? null
                      ).isOpen
                    : true;

                  const isInCart = cartState.items.some((cartItem) => cartItem.foodItem.id === item.id);

                  return (
                    <View
                      style={[
                        styles.foodItemGrid,
                        !isRestaurantOpen && styles.disabledFoodItem
                      ]}
                    >
                      {!isRestaurantOpen && (
                        <View style={styles.closedFoodItemOverlay}>
                          <View style={styles.closedFoodBadge}>
                            <Text style={styles.closedFoodBadgeText}>Closed</Text>
                          </View>
                        </View>
                      )}

                      <TouchableOpacity
                        style={styles.foodImageContainer}
                        onPress={() => {
                          if (isRestaurantOpen) {
                            toggleCartItem(item);
                          } else {
                            Alert.alert(
                              '🚫 Restaurant Closed',
                              `${restaurant?.name || 'This restaurant'} is currently closed.\n\nOpening hours: ${restaurant?.opening_time || 'N/A'} - ${restaurant?.closing_time || 'N/A'}\n\nYou can browse the menu, but ordering is unavailable.`,
                              [{ text: 'OK' }]
                            );
                          }
                        }}
                        disabled={!isRestaurantOpen}
                        activeOpacity={isRestaurantOpen ? 0.7 : 1}
                      >
                        <Image
                          source={{
                            uri: item.image_base64
                              ? `data:image/jpeg;base64,${item.image_base64}`
                              : item.image_url && item.image_url.trim() !== ''
                              ? getCached(item.image_url)
                              : 'https://placehold.co/150x150?text=No+Image'
                          }}
                          style={[styles.foodImageGrid, !isRestaurantOpen && styles.disabledFoodImage]}
                          resizeMode="cover"
                        />
                        {isInCart && (
                          <View style={styles.cartTickOverlay}>
                            <View style={styles.cartTickCircle}>
                              <Text style={styles.cartTickIcon}>✓</Text>
                            </View>
                          </View>
                        )}
                      </TouchableOpacity>

                      <View style={styles.foodInfoGrid}>
                        <Text style={[styles.foodNameGrid, !isRestaurantOpen && styles.disabledFoodText]}>
                          {item.name || 'Item'}
                        </Text>
                        <Text style={[styles.foodPriceGrid, !isRestaurantOpen && styles.disabledFoodText]}>
                          AFG {item.price?.toFixed(2) || '0.00'}
                        </Text>
                        {item.description && item.description.trim() !== '' && (
                          <TouchableOpacity
                            onPress={() => setSelectedFoodItemDetails(item)}
                            activeOpacity={0.7}
                            style={styles.detailsButton}
                          >
                            <Text style={[styles.viewDetailsText, !isRestaurantOpen && styles.disabledFoodText]}>
                              📖 Show Details
                            </Text>
                          </TouchableOpacity>
                        )}
                      </View>
                    </View>
                  );
                }}
                showsVerticalScrollIndicator={false}
                contentContainerStyle={styles.flatListContent}
                scrollEnabled={filteredFoodItems.length > 0}
              />
            </View>
          </View>
        )}
      </View>
      {cartState.items.length > 0 && (
        <TouchableOpacity
          style={styles.floatingOrderButton}
          onPress={goToCart}
        >
          <Text style={styles.floatingOrderButtonText}>PLACE ORDER</Text>
        </TouchableOpacity>
      )}

      {/* Advertisement Modal */}
      <AdvertisementModal
        visible={showAdvertisement}
        onClose={() => setShowAdvertisement(false)}
        onContinue={() => setShowAdvertisement(false)}
      />

      {selectedFoodItemDetails && (
        <Modal
          visible={true}
          transparent
          animationType="slide"
          onRequestClose={() => setSelectedFoodItemDetails(null)}
        >
          <View style={styles.foodDetailsModalOverlay}>
            <View style={styles.foodDetailsModal}>
              <TouchableOpacity
                style={styles.foodDetailsCloseButton}
                onPress={() => setSelectedFoodItemDetails(null)}
                activeOpacity={0.7}
              >
                <Text style={styles.foodDetailsCloseText}>Close</Text>
              </TouchableOpacity>
              <ScrollView contentContainerStyle={styles.foodDetailsContainer}>
                <Image
                  source={{
                    uri: selectedFoodItemDetails.image_base64
                      ? `data:image/jpeg;base64,${selectedFoodItemDetails.image_base64}`
                      : selectedFoodItemDetails.image_url && selectedFoodItemDetails.image_url.trim() !== ''
                      ? getCached(selectedFoodItemDetails.image_url)
                      : 'https://placehold.co/400x300?text=No+Image'
                  }}
                  style={styles.foodDetailsImage}
                  resizeMode="cover"
                />
                <Text style={styles.foodDetailsName}>{selectedFoodItemDetails.name || 'Menu Item'}</Text>
                <Text style={styles.foodDetailsPrice}>AFG {selectedFoodItemDetails.price?.toFixed(2) || '0.00'}</Text>
                {selectedFoodItemDetails.description ? (
                  <Text style={styles.foodDetailsDescription}>{selectedFoodItemDetails.description}</Text>
                ) : (
                  <Text style={styles.foodDetailsDescription}>No description available.</Text>
                )}
              </ScrollView>
            </View>
          </View>
        </Modal>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Colors.background,
  },
  loadingText: {
    marginTop: Spacing.lg,
    fontSize: Typography.fontSize.md,
    color: Colors.textSecondary,
    fontWeight: Typography.fontWeight.medium,
  },
  loadingSubtext: {
    marginTop: Spacing.sm,
    fontSize: Typography.fontSize.sm,
    color: Colors.textTertiary,
    fontWeight: Typography.fontWeight.regular,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: Spacing['2xl'],
  },
  emptyText: {
    fontSize: Typography.fontSize.md,
    color: Colors.textSecondary,
    fontWeight: Typography.fontWeight.medium,
  },
  searchBar: {
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: BorderRadius.lg,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    fontSize: Typography.fontSize.md,
    marginHorizontal: Spacing.lg,
    marginVertical: Spacing.md,
    ...Shadow.sm,
  },
  listContainer: {
    flex: 1,
    paddingHorizontal: Spacing.sm,
    paddingTop: Spacing.sm,
  },
  flatListContent: {
    paddingBottom: Spacing.xl,
    paddingHorizontal: Spacing.sm,
  },
  restaurantCard: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.lg,
    marginBottom: Spacing.lg,
    overflow: 'hidden',
    ...Shadow.md,
  },
  closedRestaurantCard: {
    opacity: 0.7,
    backgroundColor: Colors.surface,
  },
  closedBadgeOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: Colors.overlay,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 20,
  },
  closedBadge: {
    backgroundColor: Colors.primary,
    paddingHorizontal: Spacing['2xl'],
    paddingVertical: Spacing.lg,
    borderRadius: BorderRadius.md,
    borderWidth: 3,
    borderColor: Colors.white,
  },
  closedBadgeText: {
    color: Colors.white,
    fontSize: Typography.fontSize.lg,
    fontWeight: Typography.fontWeight.black,
    textTransform: 'uppercase',
    letterSpacing: Typography.letterSpacing.wide,
  },
  closedStatusBadge: {
    backgroundColor: Colors.primary,
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.sm,
    marginLeft: Spacing.sm,
  },
  closedStatusText: {
    color: Colors.white,
    fontSize: Typography.fontSize.xs,
    fontWeight: Typography.fontWeight.bold,
  },
  closedImage: {
    opacity: 0.5,
  },
  closedText: {
    opacity: 0.5,
  },
  restaurantNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.sm,
  },
  restaurantImageWide: {
    width: '100%',
    height: 200,
    backgroundColor: Colors.border,
  },
  restaurantInfoBelow: {
    padding: Spacing.lg,
  },
  restaurantNameBelow: {
    fontSize: Typography.fontSize.xl,
    fontWeight: Typography.fontWeight.bold,
    color: Colors.textPrimary,
    marginBottom: Spacing.xs,
  },
  cuisineTypeText: {
    fontSize: Typography.fontSize.sm,
    color: Colors.textSecondary,
    fontWeight: Typography.fontWeight.medium,
  },
  cuisineBadge: {
    position: 'absolute',
    top: Spacing.md,
    right: Spacing.md,
    backgroundColor: Colors.overlay,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.full,
    zIndex: 10,
  },
  cuisineBadgeText: {
    color: Colors.white,
    fontSize: Typography.fontSize.sm,
    fontWeight: Typography.fontWeight.semibold,
  },
  foodListContainer: {
    flex: 1,
    paddingHorizontal: Spacing.sm,
    paddingTop: Spacing.md,
  },
  foodListHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.lg,
    paddingHorizontal: Spacing.sm,
  },
  backButton: {
    paddingVertical: Spacing.sm,
  },
  backButtonText: {
    fontSize: Typography.fontSize.md,
    color: Colors.textSecondary,
    fontWeight: Typography.fontWeight.semibold,
  },
  sectionTitle: {
    fontSize: Typography.fontSize.xl,
    fontWeight: Typography.fontWeight.bold,
    color: Colors.textPrimary,
    marginBottom: Spacing.lg,
  },
  closedBanner: {
    backgroundColor: '#FFF3CD',
    borderLeftWidth: 4,
    borderLeftColor: Colors.warning,
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    marginBottom: Spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    ...Shadow.sm,
  },
  closedBannerIcon: {
    fontSize: 32,
    marginRight: Spacing.md,
  },
  closedBannerContent: {
    flex: 1,
  },
  closedBannerTitle: {
    fontSize: Typography.fontSize.md,
    fontWeight: Typography.fontWeight.bold,
    color: '#856404',
    marginBottom: Spacing.xs,
  },
  closedBannerText: {
    fontSize: Typography.fontSize.sm,
    color: '#856404',
    marginBottom: Spacing.xs,
  },
  closedBannerHours: {
    fontSize: Typography.fontSize.sm,
    color: '#856404',
    fontWeight: Typography.fontWeight.semibold,
  },
  closedBannerNote: {
    fontSize: Typography.fontSize.xs,
    color: '#856404',
    fontStyle: 'italic',
  },
  foodItemGrid: {
    flex: 1,
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.lg,
    padding: 0,
    margin: Spacing.xs,
    maxWidth: '48.5%',
    overflow: 'hidden',
    ...Shadow.sm,
  },
  foodImageGrid: {
    width: '100%',
    height: 220,
    borderRadius: 0,
    marginBottom: 0,
    backgroundColor: Colors.border,
  },
  foodImageContainer: {
    flex: 1,
    position: 'relative',
    width: '100%',
    height: 220,
  },
  cartTickOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.85)',
    zIndex: 10,
    borderRadius: BorderRadius.md,
  },
  cartTickCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: Colors.white,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: Colors.primary,
    ...Shadow.lg,
  },
  cartTickIcon: {
    color: Colors.primary,
    fontSize: 28,
    fontWeight: 'bold',
  },
  foodInfoGrid: {
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.sm,
    paddingBottom: Spacing.xs,
  },
  foodNameGrid: {
    fontSize: Typography.fontSize.sm,
    fontWeight: Typography.fontWeight.bold,
    color: Colors.textPrimary,
    marginBottom: 2,
    textAlign: 'center',
    lineHeight: 18,
  },
  foodPriceGrid: {
    fontSize: Typography.fontSize.sm,
    fontWeight: Typography.fontWeight.bold,
    color: Colors.primary,
    textAlign: 'center',
  },
  disabledFoodItem: {
    opacity: 0.5,
    backgroundColor: Colors.surface,
  },
  disabledFoodImage: {
    opacity: 0.6,
  },
  disabledFoodText: {
    color: Colors.textTertiary,
  },
  closedFoodItemOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: Colors.overlayLight,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
    borderRadius: BorderRadius.lg,
  },
  closedFoodBadge: {
    backgroundColor: Colors.primary,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.full,
    borderWidth: 2,
    borderColor: Colors.white,
  },
  closedFoodBadgeText: {
    color: Colors.white,
    fontSize: Typography.fontSize.sm,
    fontWeight: Typography.fontWeight.bold,
  },
  selectedOverlayGrid: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(255, 255, 255, 0.8)',
    borderRadius: BorderRadius.lg,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1,
  },
  tickIconGrid: {
    color: Colors.success,
    fontSize: 32,
    fontWeight: 'bold',
  },
  floatingOrderButton: {
    position: 'absolute',
    bottom: Spacing.xl,
    right: Spacing.xl,
    backgroundColor: Colors.surface,
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.lg,
    borderRadius: BorderRadius.full,
    ...Shadow.lg,
    borderWidth: 2,
    borderColor: Colors.primary,
    zIndex: 10,
  },
  floatingOrderButtonText: {
    color: Colors.primary,
    fontSize: Typography.fontSize.md,
    fontWeight: Typography.fontWeight.bold,
  },
  viewDetailsText: {
    fontSize: Typography.fontSize.xs,
    color: Colors.textSecondary,
    marginTop: Spacing.xs,
    fontWeight: Typography.fontWeight.medium,
  },
  detailsButton: {
    marginTop: Spacing.xs,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    borderRadius: BorderRadius.full,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  foodDetailsModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.lg,
  },
  foodDetailsModal: {
    width: '100%',
    maxWidth: 540,
    maxHeight: '90%',
    backgroundColor: Colors.background,
    borderRadius: BorderRadius.xl,
    overflow: 'hidden',
  },
  foodDetailsCloseButton: {
    alignSelf: 'flex-end',
    padding: Spacing.sm,
    backgroundColor: Colors.surface,
  },
  foodDetailsCloseText: {
    fontSize: Typography.fontSize.sm,
    color: Colors.primary,
    fontWeight: Typography.fontWeight.bold,
  },
  foodDetailsContainer: {
    padding: Spacing.lg,
  },
  foodDetailsImage: {
    width: '100%',
    height: 240,
    borderRadius: BorderRadius.lg,
    marginBottom: Spacing.lg,
    backgroundColor: Colors.border,
  },
  foodDetailsName: {
    fontSize: Typography.fontSize.lg,
    fontWeight: Typography.fontWeight.bold,
    color: Colors.textPrimary,
    marginBottom: Spacing.sm,
  },
  foodDetailsPrice: {
    fontSize: Typography.fontSize.md,
    fontWeight: Typography.fontWeight.bold,
    color: Colors.primary,
    marginBottom: Spacing.md,
  },
  foodDetailsDescription: {
    fontSize: Typography.fontSize.sm,
    color: Colors.textSecondary,
    lineHeight: 22,
  },
});
