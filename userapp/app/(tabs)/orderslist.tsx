import React, { useState } from 'react';
import { View, Text, FlatList, StyleSheet, TouchableOpacity, Image, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { useCart } from '../../contexts/CartContext';
import { SafeAreaView } from 'react-native-safe-area-context';

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

export default function OrdersListScreen() {
  const router = useRouter();
  const { state: cartState, dispatch } = useCart();

  // Wait for cart context to be ready
  if (!cartState) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.loadingContainer}>
          <Text>Loading orders...</Text>
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
  const goToCheckout = () => {
    if (cartState.items.length === 0) {
      Alert.alert('Cart is Empty', 'Please add items to your cart before proceeding to checkout.');
      return;
    }
    try {
      router.push('/(tabs)/checkout');
    } catch (error) {
      console.error('[OrdersList] Navigation error:', error);
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
      {/* Back Button */}
      <View style={styles.backButtonContainer}>
        <TouchableOpacity style={styles.backButton} onPress={() => {
          try {
            router.back();
          } catch (error) {
            console.error('[OrdersList] Navigation error:', error);
          }
        }}>
          <Text style={styles.backButtonText}>← Back</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>Your Order</Text>
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
                  console.error('[OrdersList] Navigation error:', error);
                }
              }}
            >
              <Text style={styles.browseButtonText}>Browse Menu</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.listContainer}>
            <FlatList
              data={cartState.items}
              keyExtractor={(item) => item.foodItem.id?.toString() || Math.random().toString()} // Changed from toString() to direct string usage
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
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
    backgroundColor: '#f5f5f5',
  },
  safeArea: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  backButtonContainer: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#f5f5f5',
  },
  backButton: {
    padding: 10,
    backgroundColor: '#C41E26',
    borderRadius: 8,
    alignSelf: 'flex-start',
  },
  backButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
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
    width: 80,
    height: 80,
    borderRadius: 12,
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
    backgroundColor: '#4CAF50',
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 16,
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