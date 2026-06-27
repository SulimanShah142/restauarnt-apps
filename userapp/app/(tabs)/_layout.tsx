import { Stack, useRouter } from 'expo-router';
import React, { useState, useEffect } from 'react';
import DrawerLayout from '../../components/DrawerLayout';
import { View, StyleSheet, Text, TouchableOpacity, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useCart } from '../../contexts/CartContext';

export default function TabLayout() {
  const router = useRouter();
  const [drawerOpen, setDrawerOpen] = React.useState(false);
  const { getItemCount } = useCart();
  const [cartCount, setCartCount] = useState(0);

  // Keep cart count updated
  useEffect(() => {
    const updateCartCount = () => {
      setCartCount(getItemCount());
    };
    updateCartCount();
    // Poll for cart changes
    const interval = setInterval(updateCartCount, 500);
    return () => clearInterval(interval);
  }, [getItemCount]);

  const goToCart = () => {
    router.push('/(tabs)/cart');
  };

  return (
    <DrawerLayout drawerOpen={drawerOpen} setDrawerOpen={setDrawerOpen}>
      <View style={styles.container}>
        {/* Top Bar with AYAR Branding */}
        <View style={styles.topBar}>
          {/* Left: Hamburger Menu */}
          <View style={styles.leftContainer}>
            <TouchableOpacity
              style={styles.iconButton}
              onPress={() => setDrawerOpen(true)}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Ionicons name="menu" size={24} color="#1A1A1A" />
            </TouchableOpacity>
          </View>

          {/* Center: AYAR Logo */}
          <View style={styles.centerContainer}>
            <Text style={styles.brandingText}>AYAR</Text>
          </View>

          {/* Right: Cart Icon with Badge */}
          <View style={styles.rightContainer}>
            <TouchableOpacity style={styles.cartButton} onPress={goToCart}>
              <Ionicons name="cart" size={20} color="#FFFFFF" />
              {cartCount > 0 && (
                <View style={styles.cartBadge}>
                  <Text style={styles.cartBadgeText}>{cartCount}</Text>
                </View>
              )}
            </TouchableOpacity>
          </View>
        </View>

        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Screen name="menu" options={{ headerShown: false }} />
          <Stack.Screen name="cart" options={{ headerShown: false }} />
          <Stack.Screen name="orderslist" options={{ headerShown: false }} />
          <Stack.Screen name="order" options={{ headerShown: false }} />
          <Stack.Screen name="feedback" options={{ headerShown: false }} />
          <Stack.Screen name="checkout" options={{ headerShown: false }} />
          <Stack.Screen name="order-status" options={{ headerShown: false }} />
          <Stack.Screen name="user-orders" options={{ headerShown: false }} />
        </Stack>
      </View>
    </DrawerLayout>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
    paddingTop: Platform.OS === 'android' ? 30 : 0,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 8,
    backgroundColor: '#FFFFFF',
    zIndex: 1000,
    position: 'relative',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
      },
      android: {
        elevation: 4,
      },
    }),
  },
  leftContainer: {
    width: 40,
    alignItems: 'flex-start',
    justifyContent: 'center',
  },
  centerContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  brandingText: {
    fontSize: 24,
    fontWeight: '900',
    color: '#C41E26',
    letterSpacing: 2,
  },
  rightContainer: {
    width: 40,
    alignItems: 'flex-end',
    justifyContent: 'center',
  },
  iconButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#f5f5f5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cartButton: {
    backgroundColor: '#C41E26',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    flexDirection: 'row',
    alignItems: 'center',
  },
  cartBadge: {
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 4,
  },
  cartBadgeText: {
    color: '#C41E26',
    fontSize: 12,
    fontWeight: 'bold',
    paddingHorizontal: 4,
  },
});
