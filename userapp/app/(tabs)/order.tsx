import React, { useState, useEffect, useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Platform, FlatList, Image, Dimensions, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { orderService, Order as OrderType, OrderItem as OrderItemType } from '../../lib/order-service';
import { supabase } from '../../lib/supabase';
import { Session } from '@supabase/supabase-js';
import UnifiedMap from '../../components/UnifiedMap';
import { useDeliveryLocationListener } from '../../hooks/useDeliveryLocationListener';
import * as Location from 'expo-location';

// Define types
type CoordinateLocation = {
  latitude: number;
  longitude: number;
} | null;

type OrderItem = {
  id: string; // Changed to string for MySQL
  name: string;
  price: number;
  quantity: number;
  imageUrl?: string;
};

type Order = {
  id: string; // Changed to string for MySQL
  orderDate: string;
  status: 'pending' | 'confirmed' | 'preparing' | 'ready' | 'delivered' | 'cancelled' | 'rejected';
  deliveryAddress: string;
  deliveryLocation: CoordinateLocation;
  restaurantLocation: CoordinateLocation;
  restaurantId?: string; // Added restaurant ID for map tracking
  restaurantName?: string; // Restaurant name
  items: OrderItem[];
  totalPrice: number;
  subtotal: number;
  deliveryCost: number;
  userId: string;
  createdAt: Date;
  updatedAt: Date;
};

export default function OrderScreen() {
  const router = useRouter();
  const [session, setSession] = useState<Session | null>(null);
  const [isReady, setIsReady] = useState(false);
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [deliveryLocations, setDeliveryLocations] = useState<{[key: string]: CoordinateLocation}>({}); // Changed key to string
  const [expandedOrderMaps, setExpandedOrderMaps] = useState<{[key: string]: boolean}>({}); // Track which order maps are expanded
  const [notification, setNotification] = useState<{ title: string; message: string; visible: boolean }>({
    title: '',
    message: '',
    visible: false
  });
  // User's actual device location (for accurate map display)
  const [userDeviceLocation, setUserDeviceLocation] = useState<[number, number] | null>(null);

  // Load session on mount
  useEffect(() => {
    const loadSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      setSession(session);
      setIsReady(true);
    };
    loadSession();

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, _session) => {
      setSession(_session);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    // Wait for session to be loaded
    if (!isReady) {
      return;
    }
    if (session) {
      loadOrdersData();
    } else {
      setOrders([]);
      setLoading(false);
    }
  }, [session, isReady]);

  // Fetch user's actual device location (like checkout.tsx)
  useEffect(() => {
    const fetchUserLocation = async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();

        if (status !== 'granted') {
          // console.warn('[OrderPage] ⚠️ Location permission denied, using default (Kabul)');
          setUserDeviceLocation([34.5281, 69.1761]); // Kabul as fallback [lat, lng]
          return;
        }

        const location = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        });

        // IMPORTANT: Leaflet expects [latitude, longitude] format
        const userCoords: [number, number] = [location.coords.latitude, location.coords.longitude];
        setUserDeviceLocation(userCoords);
      } catch (error) {
        // console.error('[OrderPage] ❌ Error fetching location:', error);
        setUserDeviceLocation([34.5281, 69.1761]); // Kabul as fallback [lat, lng]
      }
    };

    fetchUserLocation();
  }, []);

  // Real-time subscription for order status changes
  useEffect(() => {
    if (!session?.user?.id) return;

    
    // Subscribe to order status changes
    const orderChannel = supabase
      .channel('order-status-changes')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'orders',
          filter: `user_id=eq.${session.user.id}`
        },
        (payload) => {
          const updatedOrder = payload.new;
          
          // Update the order in local state
          setOrders(prevOrders => 
            prevOrders.map(order => 
              order.id === updatedOrder.id
                ? {
                    ...order,
                    status: updatedOrder.status,
                    updatedAt: new Date(updatedOrder.updated_at)
                  }
                : order
            )
          );

          // Show notification if order was delivered
          if (updatedOrder.status === 'delivered') {
            showNotification('Order Delivered! 🎉', `Your order has been delivered successfully. Enjoy your meal!`);
          }
        }
      )
      .subscribe();

    // Subscribe to notifications
    const notificationChannel = supabase
      .channel('user-notifications')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${session.user.id}`
        },
        (payload) => {
          const notification = payload.new;
          showNotification(notification.title, notification.message);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(orderChannel);
      supabase.removeChannel(notificationChannel);
    };
  }, [session?.user?.id]);

  // Show notification at top of screen
  const showNotification = (title: string, message: string) => {
    setNotification({ title, message, visible: true });
    // Auto-hide after 5 seconds
    setTimeout(() => {
      setNotification(prev => ({ ...prev, visible: false }));
    }, 5000);
  };

  // Effect to track delivery locations for active orders using real-time Supabase broadcasts
  useEffect(() => {
    const activeOrderIds = orders
      .filter((order) => order.status !== 'delivered' && order.status !== 'cancelled')
      .map((order) => order.id);

    // Create channels for each active order to listen for real-time location updates
    const channels = activeOrderIds.map(orderId => {
      const channel = supabase.channel(`tracking:${orderId}`)
        .on('broadcast', { event: 'location' }, (payload) => {
          setDeliveryLocations(prev => ({
            ...prev,
            [orderId]: {
              latitude: payload.payload.lat,
              longitude: payload.payload.lng
            }
          }));
        })
        .subscribe();

      return { orderId, channel };
    });

    // Clean up channels when component unmounts or orders change
    return () => {
      channels.forEach(({ channel }) => {
        supabase.removeChannel(channel);
      });
    };
  }, [orders]);

  const loadOrdersData = async () => {
    try {

      // More flexible user ID extraction
      const userId = session?.user?.id || (session?.user as any)?.id;

      if (!userId) {
        // console.error('[OrderPage] User not authenticated or invalid user object');
        // console.error('[OrderPage] Session object:', JSON.stringify(session, null, 2));
        setOrders([]);
        setLoading(false);
        return;
      }


      // STEP 1: Fetch orders and show immediately
      const userOrders = await orderService.getOrdersByUserId(userId);

      // Transform the data to match the expected format - MATCH order-status.tsx pattern
      const transformedOrders: Order[] = userOrders.map((order) => {
        // Match order-status: get coords from order.restaurant (nested object), just like order-status does
        const rawRestaurant = (order as any).restaurant;
        const restaurantLat = rawRestaurant?.latitude;
        const restaurantLng = rawRestaurant?.longitude;

        console.log('[Orders Transform] rawRestaurant:', JSON.stringify(rawRestaurant));
        console.log('[Orders Transform] lat:', restaurantLat, 'lng:', restaurantLng);

        return {
          id: order.id,
          orderDate: order.createdAt.toISOString().split('T')[0],
          status: order.status,
          deliveryAddress: order.deliveryAddress || 'Delivery Address Unknown',
          deliveryLocation: order.deliveryLocation ? {
            latitude: order.deliveryLocation.latitude,
            longitude: order.deliveryLocation.longitude,
          } : null,
          // Match order-status: pass coords directly as [lat, lng] from restaurant object
          restaurantLocation: restaurantLat && restaurantLng ? {
            latitude: Number(restaurantLat),
            longitude: Number(restaurantLng),
          } : null,
          restaurantId: order.restaurantId,
          restaurantName: rawRestaurant?.name || 'Restaurant',
          items: order.items.map((item) => ({
            id: item.id,
            name: item.name || `Item ${item.foodItemId}`,
            price: item.priceAtOrder,
            quantity: item.quantity,
            imageUrl: item.imageUrl
          })),
          totalPrice: order.totalAmount,
          subtotal: order.subtotal,
          deliveryCost: order.deliveryCost,
          userId: order.userId,
          createdAt: order.createdAt,
          updatedAt: order.updatedAt
        };
      });

      
      // Show data immediately
      setOrders(transformedOrders);
      setLoading(false); // Stop loading - show data now!

      // STEP 2: Background sync continues here (non-blocking)
      // Track delivery locations for active orders
      const activeOrders = transformedOrders.filter(
        (order) => order.status !== 'delivered' && order.status !== 'cancelled'
      );
      
      for (const order of activeOrders) {
        if ((order as any).deliveryPersonId) {
          const { data: deliveryData } = await supabase
            .from('delivery_persons')
            .select('current_latitude, current_longitude')
            .eq('id', (order as any).deliveryPersonId)
            .single() as { data: any; error: any };

          if (deliveryData?.current_latitude && deliveryData?.current_longitude) {
            setDeliveryLocations(prev => ({
              ...prev,
              [order.id]: {
                latitude: deliveryData.current_latitude,
                longitude: deliveryData.current_longitude
              }
            }));
          }
        }
      }
    } catch (error) {
      // console.error('[OrderPage] Error loading orders:', error);
      // Fallback to empty array if there's an error
      setOrders([]);
      setLoading(false);
    }
  };

  // Separate orders by status - using 'ready' as the equivalent of 'on_the_way'
  const onTheWayOrders = orders.filter((order) => order.status === 'ready');
  const currentOrders = orders.filter((order) => order.status !== 'delivered' && order.status !== 'cancelled' && order.status !== 'ready');
  const previousOrders = orders.filter((order) => order.status === 'delivered' || order.status === 'cancelled');

  // Render individual order item
  const renderOrderItem = ({ item }: { item: OrderItem }) => (
    <View style={styles.menuItemCard}>
      Big image on top
      {item.imageUrl ? (
        <Image source={{ uri: item.imageUrl }} style={styles.menuItemImage} resizeMode="cover" />
      ) : (
        <View style={styles.menuItemImagePlaceholder}>
          <Text style={styles.menuItemImagePlaceholderText}>🍽️</Text>
        </View>
      )}
      Name and details beneath image
      <View style={styles.menuItemInfo}>
        <Text style={styles.menuItemName}>{item.name || 'Unnamed Item'}</Text>
        <Text style={styles.menuItemDetails}>{item.quantity} x AFG {item.price.toFixed(2)}</Text>
      </View>
    </View>
  );

  // Render order card
  const renderOrder = ({ item }: { item: Order }) => {
    const deliveryLocation = deliveryLocations[item.id] || null;
    // Only show full-screen map for confirmed and later statuses
    const showFullScreenMap = item.status === 'confirmed' || item.status === 'preparing' || item.status === 'ready';
    const showOrderMap = expandedOrderMaps[item.id] || false;

    // Pass coordinates as [latitude, longitude] for Leaflet
    const restaurantCoords = item.restaurantLocation
      ? [item.restaurantLocation.latitude, item.restaurantLocation.longitude] as [number, number]
      : undefined;

    const deliveryCoords = item.deliveryLocation
      ? [item.deliveryLocation.latitude, item.deliveryLocation.longitude] as [number, number]
      : undefined;

    // Delivery person real-time location for route cutting (Uber-like)
    const orderDeliveryPersonCoords = deliveryLocation
      ? [deliveryLocation.latitude, deliveryLocation.longitude] as [number, number]
      : null;

    return (
      <View style={styles.orderCard}>
        Full-screen map for confirmed orders - at the top
        {showFullScreenMap && item.status !== 'cancelled' && (
          <View style={styles.fullScreenMapContainer}>
            <UnifiedMap
              orderId={item.id || undefined}
              // Restaurant location (pickup point) - enables route drawing
              restaurantCoords={restaurantCoords}
              // User location (current position)
              userCoords={userDeviceLocation ?? undefined}
              // Delivery location (destination) - enables route drawing
              destinationCoords={deliveryCoords}
              // Delivery person real-time location for route cutting (Uber-like)
              deliveryPersonCoords={orderDeliveryPersonCoords}
              role="USER"
              restaurantName={item.restaurantName}
            />
            {deliveryLocation && (
              <View style={styles.deliveryTrackingInfo}>
                <Text style={styles.deliveryTrackingText}>🚴 Driver is at: {deliveryLocation.latitude.toFixed(4)}, {deliveryLocation.longitude.toFixed(4)}</Text>
                <Text style={styles.deliveryTrackingText}>Status: {item.status}</Text>
              </View>
            )}
          </View>
        )}

        <View style={styles.orderHeader}>
          <View>
            {/* Show restaurant name */}
            <Text style={styles.restaurantName}>📍 {item.restaurantName || 'Restaurant'}</Text>

            {/* Show ordered items */}
            <View style={styles.itemsList}>
              {item.items && item.items.length > 0 ? (
                <>
                  {item.items.map((orderItem, index) => (
                    <Text key={index} style={styles.itemText}>
                      {orderItem.quantity}x {orderItem.name || 'Item'}
                    </Text>
                  ))}
            </>
              ) : (
                <Text style={styles.itemText}>No items</Text>
              )}
            </View>
          </View>
          <Text style={[
            styles.orderStatus,
            item.status === 'pending' && styles.pendingOrder,
            item.status === 'confirmed' && styles.confirmedOrder,
            item.status === 'preparing' && styles.preparingOrder,
            item.status === 'ready' && styles.readyOrder,
            item.status === 'delivered' && styles.deliveredOrder,
            item.status === 'cancelled' && styles.cancelledOrder
          ]}>
            {item.status ? (item.status.charAt(0).toUpperCase() + item.status.slice(1)) : 'Unknown'}
          </Text>
        </View>

        <Text style={styles.orderDate}>Date: {item.orderDate}</Text>

        <Text style={styles.deliveryAddress}>Delivery to: {item.deliveryAddress}</Text>

        Show Map Button - only for non-confirmed orders (pending)
        {!showFullScreenMap && (item.status !== 'cancelled') && (
          <TouchableOpacity
            style={styles.viewMapButton}
            onPress={() => setExpandedOrderMaps(prev => ({
              ...prev,
              [item.id]: !prev[item.id]
            }))}
          >
            <Text style={styles.viewMapButtonText}>
              {showOrderMap ? '🔼 Hide Map' : '🗺️ View Map'}
            </Text>
          </TouchableOpacity>
        )}

        Show small map when button is pressed for pending orders
        {showOrderMap && !showFullScreenMap && (item.status !== 'cancelled' && item.status !== 'delivered') && (
          <View style={styles.mapContainer}>
            <Text style={styles.mapTitle}>Order Tracking</Text>
            <UnifiedMap
              orderId={item.id || undefined}
              // Restaurant location (pickup point) - enables route drawing
              restaurantCoords={restaurantCoords}
              // User location (current position)
              userCoords={userDeviceLocation ?? undefined}
              // Delivery location (destination) - enables route drawing
              destinationCoords={deliveryCoords}
              // Delivery person real-time location for route cutting (Uber-like)
              deliveryPersonCoords={orderDeliveryPersonCoords}
              role="USER"
              restaurantName={item.restaurantName}
            />
          </View>
        )}

        <View style={styles.itemsContainer}>
          <Text style={styles.itemsTitle}>Order Items:</Text>
          <FlatList
            data={item.items}
            renderItem={renderOrderItem}
            keyExtractor={(item : any) => item.id?.toString() || Math.random().toString()} // Changed from toString() to direct string usage
            scrollEnabled={false}
          />
        </View>

        <View style={styles.totalContainer}>
          <View style={styles.row}>
            <Text style={styles.totalLabel}>Subtotal:</Text>
            <Text style={styles.totalPrice}>AFG {item.subtotal?.toFixed(2) || '0.00'}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.totalLabel}>Delivery Cost:</Text>
            <Text style={styles.totalPrice}>AFG {item.deliveryCost?.toFixed(2) || '0.00'}</Text>
          </View>
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>Total:</Text>
            <Text style={styles.totalPrice}>AFG {item.totalPrice.toFixed(2)}</Text>
          </View>
        </View>
      </View>
    );
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color="#C41E26" />
        <Text style={styles.loadingText}>Loading orders...</Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView style={styles.container}>
        Notification Banner
        {notification.visible && (
          <View style={styles.notificationBanner}>
            <View style={styles.notificationContent}>
              <Text style={styles.notificationTitle}>{notification.title}</Text>
              <Text style={styles.notificationMessage}>{notification.message}</Text>
            </View>
            <TouchableOpacity
              style={styles.notificationCloseButton}
              onPress={() => setNotification(prev => ({ ...prev, visible: false }))}
            >
              <Text style={styles.notificationCloseButtonText}>✕</Text>
            </TouchableOpacity>
          </View>
        )}

        <View style={styles.header}>
          <Text style={styles.title}>My Orders</Text>
        </View>

        {onTheWayOrders.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>On The Way</Text>
            <FlatList
              data={onTheWayOrders}
              renderItem={renderOrder}
              keyExtractor={(item : any) => item.id?.toString() || Math.random().toString()}
              scrollEnabled={false}
              contentContainerStyle={styles.flatListContent}
            />
          </View>
        )}

        {currentOrders.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Current Orders</Text>
            <FlatList
              data={currentOrders}
              renderItem={renderOrder}
              keyExtractor={(item : any) => item.id?.toString() || Math.random().toString()}
              scrollEnabled={false}
              contentContainerStyle={styles.flatListContent}
            />
          </View>
        )}

        {previousOrders.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Previous Orders</Text>
            <FlatList
              data={previousOrders}
              renderItem={renderOrder}
              keyExtractor={(item: any) => item.id?.toString() || Math.random().toString()}
              scrollEnabled={false}
              contentContainerStyle={styles.flatListContent}
            />
          </View>
        )}

        {orders.length === 0 && (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>No orders yet</Text>
            <TouchableOpacity
              style={styles.browseButton}
              onPress={() => {
                try {
                  router.push('/(tabs)/menu');
                } catch (error) {
                  console.error('[Order] Navigation error:', error);
                }
              }}
            >
              <Text style={styles.browseButtonText}>Browse Menu</Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
    padding: 16,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#666',
    fontWeight: '500',
  },
  notificationBanner: {
    backgroundColor: '#4CAF50',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  notificationContent: {
    flex: 1,
    marginRight: 12,
  },
  notificationTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 4,
  },
  notificationMessage: {
    fontSize: 14,
    color: '#fff',
    opacity: 0.9,
  },
  notificationCloseButton: {
    padding: 4,
    paddingLeft: 8,
  },
  notificationCloseButtonText: {
    color: '#fff',
    fontSize: 20,
    fontWeight: 'bold',
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
  section: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 12,
    color: '#333',
  },
  orderCard: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    boxShadow: '0px 2px 4px rgba(0, 0, 0, 0.1)',
  },
  orderHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  restaurantName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
  },
  itemsList: {
    marginTop: 4,
  },
  itemText: {
    fontSize: 13,
    color: '#666',
    marginBottom: 2,
  },
  orderStatus: {
    fontSize: 14,
    fontWeight: 'bold',
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 12,
  },
  pendingOrder: {
    backgroundColor: '#FFF3E0',
    color: '#F57C00',
  },
  confirmedOrder: {
    backgroundColor: '#FFEBEE',
    color: '#C41E26',
  },
  preparingOrder: {
    backgroundColor: '#FFF8E1',
    color: '#F57F17',
  },
  readyOrder: {
    backgroundColor: '#E8F5E9',
    color: '#388E3C',
  },
  onTheWayOrder: {
    backgroundColor: '#FFEBEE',
    color: '#C41E26',
  },
  deliveredOrder: {
    backgroundColor: '#E8F5E9',
    color: '#388E3C',
  },
  cancelledOrder: {
    backgroundColor: '#FFEBEE',
    color: '#C41E26',
  },
  orderDate: {
    fontSize: 14,
    color: '#666',
    marginBottom: 8,
  },
  deliveryAddress: {
    fontSize: 14,
    color: '#333',
    marginBottom: 12,
  },
  viewMapButton: {
    backgroundColor: '#4CAF50',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 12,
  },
  viewMapButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  mapContainer: {
    height: 200,
    borderRadius: 8,
    overflow: 'hidden',
    marginBottom: 12,
    zIndex: 1, // Ensure map doesn't interfere with scrolling
  },
  fullScreenMapContainer: {
    height: 350,
    borderRadius: 8,
    overflow: 'hidden',
    marginBottom: 12,
    zIndex: 1,
  },
  mapTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 8,
    color: '#333',
    textAlign: 'center',
  },
  map: {
    flex: 1,
  },
  mapPlaceholder: {
    flex: 1,
    backgroundColor: '#f0f0f0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  mapPlaceholderText: {
    fontSize: 16,
    color: '#666',
  },
  deliveryTrackingInfo: {
    backgroundColor: '#f0f8ff',
    padding: 8,
    borderRadius: 8,
    marginTop: 8,
  },
  deliveryTrackingText: {
    fontSize: 12,
    color: '#333',
    marginBottom: 2,
  },
  itemsContainer: {
    marginBottom: 12,
  },
  itemsTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 8,
    color: '#333',
  },
  orderItemRow: {
    flexDirection: 'row',
    paddingVertical: 8,
    alignItems: 'center',
  },
  orderItemImageContainer: {
    marginRight: 12,
  },
  orderItemImage: {
    width: 80,
    height: 80,
    borderRadius: 12,
  },
  orderItemImagePlaceholder: {
    width: 80,
    height: 80,
    borderRadius: 12,
    backgroundColor: '#f0f0f0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  orderItemImagePlaceholderText: {
    fontSize: 10,
    color: '#999',
  },
  orderItemDetailsContainer: {
    flex: 1,
  },
  orderItemName: {
    fontSize: 14,
    color: '#333',
  },
  orderItemDetails: {
    fontSize: 14,
    color: '#666',
  },
  menuItemCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    marginBottom: 16,
    overflow: 'hidden',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  menuItemImage: {
    width: '100%',
    height: 200,
    backgroundColor: '#f0f0f0',
  },
  menuItemImagePlaceholder: {
    width: '100%',
    height: 200,
    backgroundColor: '#f0f0f0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  menuItemImagePlaceholderText: {
    fontSize: 48,
  },
  menuItemInfo: {
    padding: 12,
  },
  menuItemName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  menuItemDetails: {
    fontSize: 14,
    color: '#666',
  },
  totalContainer: {
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#eee',
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#eee',
  },
  totalLabel: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
  },
  totalPrice: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#C41E26',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 50,
  },
  emptyText: {
    fontSize: 18,
    color: '#666',
    marginBottom: 20,
  },
  browseButton: {
    backgroundColor: '#C41E26',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
  },
  browseButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
  safeArea: {
    flex: 1,
    backgroundColor: '#f5f5f5', // Match the container background
  },
  flatListContent: {
    paddingBottom: 20, // Add padding to ensure content isn't hidden behind buttons
  },
});