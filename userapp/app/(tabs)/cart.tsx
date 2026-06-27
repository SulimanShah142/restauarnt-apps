import React, { useState, useEffect } from 'react';
import { View, Text, FlatList, StyleSheet, TouchableOpacity, Image, Alert, Dimensions } from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { useCart } from '../../contexts/CartContext';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Location from 'expo-location';
import LocationPermissionPrompt from '../../components/LocationPermissionPrompt';

// Define types
type Restaurant = {
  id: string; // Changed to string for MySQL
  name: string;
  description: string;
  image: string;
};

type FoodItem = {
  id: string; // Changed to string for MySQL
  name: string;
  description: string;
  price: number;
  image: string;
  restaurantId: string; // Changed to string for MySQL
};

type CartItem = {
  foodItem: FoodItem;
  quantity: number;
};

export default function CartScreen() {
  const router = useRouter();
  const [showUserSheet, setShowUserSheet] = useState(false);
  const { state: cartState, dispatch } = useCart();
  const [showLocationPrompt, setShowLocationPrompt] = useState(false);
  const [locationPermissionGranted, setLocationPermissionGranted] = useState(false);
  const [locationCheckComplete, setLocationCheckComplete] = useState(false);

  // Check location permission EVERY time the screen comes into focus
  useFocusEffect(
    React.useCallback(() => {
      let timer: NodeJS.Timeout;

      const checkAndRequestLocation = async () => {
        try {
          console.log('[Cart] 📍 Checking location permission on focus...');
          const { status } = await Location.getForegroundPermissionsAsync();
          console.log('[Cart] 📍 Location permission status:', status);

          if (status === 'granted') {
            setLocationPermissionGranted(true);
            setShowLocationPrompt(false);
            console.log('[Cart] 📍 Location already granted');
          } else {
            // Permission not granted - show our custom prompt
            setLocationPermissionGranted(false);
            console.log('[Cart] 📍 Location not granted, showing prompt');
            timer = setTimeout(() => {
              setShowLocationPrompt(true);
            }, 300);
          }
        } catch (error) {
          console.error('[Cart] Error checking location:', error);
        } finally {
          setLocationCheckComplete(true);
        }
      };

      checkAndRequestLocation();

      return () => {
        if (timer) clearTimeout(timer);
      };
    }, [])
  );

  const handleLocationPermissionGranted = () => {
    setLocationPermissionGranted(true);
    setShowLocationPrompt(false);
  };

  const handleLocationPermissionDenied = () => {
    setLocationPermissionGranted(false);
    setShowLocationPrompt(false);
  };

  // Wait for cart context to be ready
  if (!cartState) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.loadingContainer}>
          <Text>Loading cart...</Text>
        </View>
      </SafeAreaView>
    );
  }

  // Function to increment quantity
  const incrementQuantity = (foodItemId: string) => { // Changed to string
    const item = cartState.items.find(item => item.foodItem.id === foodItemId);
    if (item) {
      dispatch({
        type: 'UPDATE_QUANTITY',
        payload: {
          id: foodItemId, // Already a string for MySQL
          quantity: item.quantity + 1
        }
      });
    }
  };

  // Function to decrement quantity
  const decrementQuantity = (foodItemId: string) => { // Changed to string
    const item = cartState.items.find(item => item.foodItem.id === foodItemId);
    if (item && item.quantity > 1) {
      dispatch({
        type: 'UPDATE_QUANTITY',
        payload: {
          id: foodItemId, // Already a string for MySQL
          quantity: item.quantity - 1
        }
      });
    } else if (item && item.quantity === 1) {
      // Remove item if quantity is 1
      dispatch({ type: 'REMOVE_ITEM', payload: { id: foodItemId } }); // Already a string for MySQL
    }
  };

  // Calculate total price
  const calculateTotal = () => {
    return cartState.items.reduce((total, item) => total + (item.foodItem.price * item.quantity), 0);
  };

  // Navigate to checkout screen
  const goToCheckout = async () => {
    if (cartState.items.length === 0) {
      Alert.alert('Cart is Empty', 'Please add items to your cart before proceeding to checkout.');
      return;
    }

    // Ensure location permission is granted before checkout
    if (!locationPermissionGranted) {
      setShowLocationPrompt(true);
      return;
    }

    try {
      router.push('/(tabs)/checkout');
    } catch (error) {
      console.error('[Cart] Navigation error:', error);
    }
  };

  // Render cart item
  const renderCartItem = ({ item }: { item: CartItem }) => {
    return (
      <View style={styles.cartItem}>
        <Image source={{ uri: item.foodItem.image || 'https://placehold.co/60?text=No+Image' }} style={styles.cartItemImage} />
        <View style={styles.cartItemInfo}>
          <Text style={styles.cartItemName}>{item.foodItem.name || 'Unnamed Item'}</Text>
          {item.foodItem.description ? <Text style={styles.cartItemDescription}>{item.foodItem.description}</Text> : null}
          <Text style={styles.cartItemPrice}>AFG {item.foodItem.price.toFixed(2)} each</Text>

          <View style={styles.quantityContainer}>
            <TouchableOpacity
              style={styles.quantityButton}
              onPress={() => decrementQuantity(item.foodItem.id)}
            >
              <Text style={styles.quantityButtonText}>-</Text>
            </TouchableOpacity>
            <Text style={styles.quantityText}>{item.quantity}</Text>
            <TouchableOpacity
              style={styles.quantityButton}
              onPress={() => incrementQuantity(item.foodItem.id)}
            >
              <Text style={styles.quantityButtonText}>+</Text>
            </TouchableOpacity>
          </View>
        </View>
        <Text style={styles.cartItemTotal}>AFG {(item.foodItem.price * item.quantity).toFixed(2)}</Text>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>Your Cart</Text>
        </View>

        {cartState.items.length === 0 ? (
          <View style={styles.emptyCart}>
            <Text style={styles.emptyCartText}>Your cart is empty</Text>
            <TouchableOpacity
              style={styles.browseButton}
              onPress={() => {
                try {
                  router.push('/(tabs)/menu');
                } catch (error) {
                  console.error('[Cart] Navigation error:', error);
                }
              }}
            >
              <Text style={styles.browseButtonText}>Browse Menu</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.listContainer}>
            <FlatList<CartItem>
              data={cartState.items}
              keyExtractor={(item: CartItem) => item.foodItem.id?.toString() || Math.random().toString()}
              renderItem={renderCartItem}
              showsVerticalScrollIndicator={false}
              contentContainerStyle={styles.flatListContent}
            />

            <View style={styles.totalContainer}>
              <Text style={styles.totalLabel}>Total:</Text>
              <Text style={styles.totalPrice}>AFG {calculateTotal().toFixed(2)}</Text>
            </View>

            <TouchableOpacity style={styles.checkoutButton} onPress={goToCheckout}>
              <Text style={styles.checkoutButtonText}>Proceed to Checkout</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>

      {/* Location Permission Prompt - ALWAYS rendered, not just when cart has items */}
      <LocationPermissionPrompt
        visible={showLocationPrompt}
        onPermissionGranted={handleLocationPermissionGranted}
        onPermissionDenied={handleLocationPermissionDenied}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#f5f5f5', // Match the container background
  },
  container: {
    flex: 1,
    padding: 16,
    backgroundColor: '#f5f5f5',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
  },
  emptyCart: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyCartText: {
    fontSize: 18,
    color: '#666',
    marginBottom: 20,
  },
  browseButton: {
    backgroundColor: '#C41E26',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
  },
  browseButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
  cartItem: {
    flexDirection: 'row',
    backgroundColor: 'white',
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
    boxShadow: '0px 1px 2px rgba(0, 0, 0, 0.1)',
  },
  cartItemImage: {
    width: 60,
    height: 60,
    borderRadius: 8,
    marginRight: 12,
  },
  cartItemInfo: {
    flex: 1,
    justifyContent: 'center',
  },
  cartItemName: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  cartItemDescription: {
    fontSize: 14,
    color: '#666',
    marginBottom: 4,
  },
  cartItemPrice: {
    fontSize: 14,
    color: '#C41E26',
    marginBottom: 8,
  },
  quantityContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  quantityButton: {
    backgroundColor: '#C41E26',
    width: 30,
    height: 30,
    borderRadius: 15,
    justifyContent: 'center',
    alignItems: 'center',
  },
  quantityButtonText: {
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
  },
  quantityText: {
    marginHorizontal: 12,
    fontSize: 16,
    fontWeight: 'bold',
  },
  cartItemTotal: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#C41E26',
    alignSelf: 'center',
  },
  totalContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    backgroundColor: 'white',
    borderRadius: 8,
    marginTop: 16,
    boxShadow: '0px 1px 2px rgba(0, 0, 0, 0.1)',
  },
  totalLabel: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  totalPrice: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#C41E26',
  },
  checkoutButton: {
    backgroundColor: '#C41E26',
    padding: 16,
    paddingBottom: 24,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 16,
    marginBottom: 60, // Increased from 40 to move button higher from bottom
  },
  checkoutButtonText: {
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
  },
  flatListContent: {
    paddingBottom: 20, // Add padding to ensure content isn't hidden behind buttons
  },
  listContainer: {
    flex: 1,
    minHeight: 100, // Minimum height to ensure proper layout
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
});