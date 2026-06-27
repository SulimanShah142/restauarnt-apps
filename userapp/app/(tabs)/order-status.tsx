import React, { useState, useEffect, useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Linking, Alert, ScrollView, Dimensions, ActivityIndicator, Image, Modal } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { orderService } from '../../lib/order-service';
import { supabase } from '../../lib/supabase';
import { Session } from '@supabase/supabase-js';
import { Ionicons } from '@expo/vector-icons';
import UnifiedMap from '../../components/UnifiedMap';
import FullscreenMap from '../../components/FullscreenMap';
import * as Location from 'expo-location';
import { geocodeAddress } from '../../lib/GeocodingService';
import NotificationBanner from '../../components/NotificationBanner';
import { useDeliveryLocationListener } from '../../hooks/useDeliveryLocationListener';

// Type declarations for web globals
declare const window: any;

export default function OrderStatusTracker() {
  const router = useRouter();
  const { orderId } = useLocalSearchParams();
  const [session, setSession] = useState<Session | null>(null);
  const [isReady, setIsReady] = useState(false);
  const [order, setOrder] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [orderStatus, setOrderStatus] = useState('pending'); // Default status
  const [showMap, setShowMap] = useState(false);
  const [showFullscreenMap, setShowFullscreenMap] = useState(false);
  const [restaurantCoords, setRestaurantCoords] = useState<[number, number] | undefined>(undefined);
  const [userLocation, setUserLocation] = useState<[number, number]>([34.5281, 69.1761]); // Kabul as default
  const [deliveryPersonCoords, setDeliveryPersonCoords] = useState<[number, number] | undefined>(undefined);
  const [deliveryDestinationCoords, setDeliveryDestinationCoords] = useState<[number, number] | undefined>(undefined); // Customer location for route

  // Notification state for delivery updates
  const [deliveryNotification, setDeliveryNotification] = useState<{
    visible: boolean;
    title: string;
    message: string;
    type: 'success' | 'error' | 'info' | 'warning' | 'order';
  }>({ visible: false, title: '', message: '', type: 'info' });

  // Phone numbers state
  const [adminPhone, setAdminPhone] = useState<string | null>(null);
  const [deliveryPersonPhone, setDeliveryPersonPhone] = useState<string | null>(null);
  const [deliveryPersonName, setDeliveryPersonName] = useState<string | null>(null);
  const [deliveryPersonImageUrl, setDeliveryPersonImageUrl] = useState<string | null>(null);

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

  // REAL-TIME DELIVERY LOCATION TRACKING (polls delivery_persons table every 45 seconds)
  const {
    deliveryLocation,
    isLoading: isLocationLoading,
    error: locationError,
    hasLocation,
    isReady: locationHookReady
  } = useDeliveryLocationListener({
    enabled: !!orderId && !!order?.delivery_person_id && (orderStatus === 'on_the_way' || orderStatus === 'picked_up' || orderStatus === 'ready'),
    orderId: typeof orderId === 'string' ? orderId : undefined,
    deliveryPersonId: order?.delivery_person_id || order?.deliveryPerson?.id
  });

  // Update delivery person coords when realtime location changes
  useEffect(() => {
    if (deliveryLocation) {
      console.log('[OrderStatus] 🚴 Real-time delivery location received:', deliveryLocation.latitude, deliveryLocation.longitude);
      setDeliveryPersonCoords([deliveryLocation.latitude, deliveryLocation.longitude]);
    } else {
      // Clear coords when no location available (e.g., driver not assigned yet)
      setDeliveryPersonCoords(undefined);
    }
  }, [deliveryLocation]);

  // Memoize map coordinates to prevent infinite re-renders - MATCHES checkout.tsx pattern
  const mapRestaurantCoords = useMemo(() => {
    return restaurantCoords ?? undefined;
  }, [restaurantCoords?.[0], restaurantCoords?.[1]]);

  const mapUserCoords = useMemo(() => {
    return userLocation ?? undefined;
  }, [userLocation?.[0], userLocation?.[1]]);

  // For route line: use delivery destination (customer location) - MATCHES checkout.tsx
  const mapDeliveryCoords = useMemo(() => {
    return deliveryDestinationCoords ?? userLocation ?? undefined;
  }, [deliveryDestinationCoords?.[0], deliveryDestinationCoords?.[1], userLocation?.[0], userLocation?.[1]]);

  // Memoize names with proper defaults - MATCHES checkout.tsx pattern
  const mapRestaurantName = useMemo(() => {
    return order?.restaurant?.name || order?.restaurant_name || 'Restaurant';
  }, [order?.restaurant?.name, order?.restaurant_name]);

  const mapUserName = useMemo(() => {
    return order?.customer_name || 'Customer';
  }, [order?.customer_name]);

  useEffect(() => {
    if (orderId && session?.user?.id && isReady) {
      loadOrderData();
    }
    // Load admin phone number from app_settings
    loadAdminPhone();
    // Load delivery person phone if assigned
    if (order?.delivery_person_id) {
      loadDeliveryPersonPhone(order.delivery_person_id);
    }
  }, [orderId, session, isReady]);
  
  // Reload delivery person phone when order changes
  useEffect(() => {
    if (order?.delivery_person_id) {
      loadDeliveryPersonPhone(order.delivery_person_id);
    }
  }, [order?.delivery_person_id, order?.deliveryPerson?.phone]);

  // Poll delivery person location for real-time tracking (every 30 seconds)
  useEffect(() => {
    const deliveryPersonId = order?.delivery_person_id;
    if (!deliveryPersonId) return;

    const isTrackingEnabled = orderStatus === 'on_the_way' || orderStatus === 'picked_up' || orderStatus === 'ready';
    if (!isTrackingEnabled) return;

    console.log('[OrderStatus] 🚴 Starting delivery location polling for:', deliveryPersonId);

    // Initial fetch
    const fetchDeliveryLocation = async () => {
      try {
        const { data, error } = await supabase
          .from('delivery_persons')
          .select('current_latitude, current_longitude, updated_at')
          .eq('id', deliveryPersonId)
          .maybeSingle() as { data: any; error: any };

        if (error) {
          console.warn('[OrderStatus] ⚠️ Error fetching delivery location:', error.message);
          return;
        }

        if (data && data.current_latitude && data.current_longitude) {
          console.log('[OrderStatus] 🚴 Delivery location updated:', data.current_latitude, data.current_longitude);
          setDeliveryPersonCoords([data.current_latitude, data.current_longitude]);
        }
      } catch (err: any) {
        console.error('[OrderStatus] Error polling delivery location:', err.message);
      }
    };

    fetchDeliveryLocation();

    // Poll every 30 seconds
    const interval = setInterval(fetchDeliveryLocation, 30000);

    return () => {
      console.log('[OrderStatus] 🚴 Stopping delivery location polling');
      clearInterval(interval);
    };
  }, [order?.delivery_person_id, orderStatus]);

  // Set delivery destination coordinates when order data is available
  // This ensures route line shows from restaurant to customer - MATCHES checkout.tsx pattern
  useEffect(() => {
    if (order) {
      const deliveryLat = order.delivery_lat || order.deliveryLatitude;
      const deliveryLng = order.delivery_lng || order.deliveryLongitude;

      if (deliveryLat && deliveryLng) {
        const coords: [number, number] = [Number(deliveryLat), Number(deliveryLng)];
        setDeliveryDestinationCoords(coords);
      }
    }
  }, [order]);

  const loadAdminPhone = async () => {
    try {
      const { data, error } = await supabase
        .from('app_settings')
        .select('admin_phone')
        .single() as { data: any; error: any };

      if (error) {
        // console.error('[OrderStatus] Error fetching admin phone:', error.message);
        return;
      }

      if (data?.admin_phone) {
        setAdminPhone(data.admin_phone);
      } else {
        // console.warn('[OrderStatus] ⚠️ No admin phone in app_settings');
      }
    } catch (error: any) {
      // console.error('[OrderStatus] Error loading admin phone:', error.message);
    }
  };

  const loadDeliveryPersonPhone = async (deliveryPersonId: string) => {
    try {
      console.log('[OrderStatus] 📞 Loading delivery person phone for ID:', deliveryPersonId);

      // First try to get from already-loaded order data
      const dpPhone = order?.deliveryPerson?.phone
        || order?.deliveryPerson?.users?.phone;
      if (dpPhone) {
        console.log('[OrderStatus] 📞 Found phone in order data:', dpPhone);
        setDeliveryPersonPhone(dpPhone);
        return;
      }

      console.log('[OrderStatus] 📞 Phone not in order data, fetching from delivery_persons table...');

      // Fetch from delivery_persons table directly
      const { data, error } = await supabase
        .from('delivery_persons')
        .select('phone, image_url, users:user_id(phone)')
        .eq('id', deliveryPersonId)
        .maybeSingle() as { data: any; error: any };

      if (error) {
        console.warn('[OrderStatus] ⚠️ Error fetching delivery person phone:', error.message);
        return;
      }

      if (!data) {
        console.warn('[OrderStatus] ⚠️ No delivery person found for ID:', deliveryPersonId);
        return;
      }

      console.log('[OrderStatus] 📞 Delivery person data:', JSON.stringify(data));

      // Try to get phone from delivery_persons table first, then from users table
      const phone = data?.phone || data?.users?.phone;
      const imageUrl = data?.image_url;

      if (phone) {
        console.log('[OrderStatus] 📞 Found phone from delivery_persons:', phone);
        setDeliveryPersonPhone(phone);
      } else {
        console.warn('[OrderStatus] ⚠️ No phone number for delivery person');
      }

      if (imageUrl) {
        console.log('[OrderStatus] 🖼️ Found image URL from delivery_persons:', imageUrl);
        setDeliveryPersonImageUrl(imageUrl);
      }
    } catch (error: any) {
      console.error('[OrderStatus] Error loading delivery person phone:', error.message);
    }
  };

  const callUser = () => {
    const phoneNumber = order?.user?.phone || order?.phone;
    if (phoneNumber) {
      const telUrl = `tel:${phoneNumber.replace(/[^0-9+]/g, '')}`;
      Linking.openURL(telUrl);
    } else {
      Alert.alert('Phone Number Not Available', 'The user\'s phone number is not available at the moment.');
    }
  };

  const callCustomerService = async () => {
    const phoneNumber = adminPhone;
    if (!phoneNumber) {
      Alert.alert('Phone Number Not Available', 'Customer service phone number is not available.');
      return;
    }

    const telUrl = `tel:${phoneNumber.replace(/[^0-9+]/g, '')}`;
    Linking.openURL(telUrl);
  };

  const callDeliveryPerson = async () => {
    // Try multiple sources for delivery person phone
    const phoneNumber = deliveryPersonPhone
      || order?.deliveryPerson?.phone
      || order?.deliveryPerson?.users?.phone;

    if (!phoneNumber) {
      Alert.alert('Phone Number Not Available', 'Delivery person\'s phone number is not available.');
      return;
    }

    const telUrl = `tel:${phoneNumber.replace(/[^0-9+]/g, '')}`;
    const canOpen = await Linking.canOpenURL(telUrl);
    if (canOpen) {
      Linking.openURL(telUrl);
    } else {
      Alert.alert('Call Failed', 'Unable to place phone call on this device.');
    }
  };

  const loadOrderData = async () => {
    try {
      if (!orderId || typeof orderId !== 'string') {
        // console.error('loadOrderData: Invalid order ID:', orderId);
        setLoading(false);
        return;
      }

      // STEP 1: Fetch order data and show it immediately
      const orderData = await orderService.getOrderById(orderId);
      
      // Show data immediately
      setOrder(orderData);
      setOrderStatus(orderData?.status || 'pending');

      // Extract delivery person name from order data
      const dpName = orderData?.deliveryPerson?.users?.name ||
                     orderData?.deliveryPerson?.name ||
                     null;
      setDeliveryPersonName(dpName);

      setLoading(false); // Stop loading spinner - show data now!

      // STEP 2: Continue syncing in background (non-blocking)
      // Fetch user's actual location
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();

        if (status === 'granted') {
          const location = await Location.getCurrentPositionAsync({
            accuracy: Location.Accuracy.Balanced,
          });

          const userCoords: [number, number] = [location.coords.latitude, location.coords.longitude];
          setUserLocation(userCoords);
        } else {
          // console.warn('[OrderStatus] Location permission denied, using Kabul default');
        }
      } catch (error) {
        // console.error('[OrderStatus] Error fetching location:', error);
        // Keep Kabul default
      }

      // Fetch restaurant coordinates from order data (restaurants is nested in order)

      // Try to get restaurant coordinates from nested restaurant object
      const restaurantLat = orderData?.restaurant?.latitude;
      const restaurantLng = orderData?.restaurant?.longitude;
      const restaurantId = orderData?.restaurant?.id;
      const restaurantAddress = orderData?.restaurant?.address;
      
      if (restaurantLat && restaurantLng) {
        const coords: [number, number] = [
          Number(restaurantLat),
          Number(restaurantLng)
        ];
        setRestaurantCoords(coords);
      } else if (restaurantAddress) {
        // Restaurant has address but no coordinates - geocode it!
        try {
          const geocodedCoords = await geocodeAddress(restaurantAddress);

          if (geocodedCoords) {
            const coords: [number, number] = [
              geocodedCoords.latitude,
              geocodedCoords.longitude
            ];
            setRestaurantCoords(coords);

            // Optionally update the database with the new coordinates
            await (supabase as any)
              .from('restaurants')
              .update({
                latitude: geocodedCoords.latitude,
                longitude: geocodedCoords.longitude
              })
              .eq('id', restaurantId);
          } else {
            // console.warn('[OrderStatus] ⚠️ Geocoding failed for address:', restaurantAddress);
          }
        } catch (err) {
          // console.error('[OrderStatus] ❌ Error geocoding restaurant address:', err);
        }
      } else if (restaurantId) {
        // Fallback: fetch restaurant coordinates separately
        try {
          const { data: restaurantData, error: restaurantError } = await supabase
            .from('restaurants')
            .select('id, name, latitude, longitude, address')
            .eq('id', restaurantId)
            .single() as { data: any; error: any };

          if (!restaurantError && restaurantData) {
            if (restaurantData.latitude && restaurantData.longitude) {
              // FIXED: Database has latitude/longitude swapped - correct it here
              const coords: [number, number] = [Number(restaurantData.longitude), Number(restaurantData.latitude)];
              setRestaurantCoords(coords);
            } else if (restaurantData.address) {
              // Has address but no coordinates - geocode it!
              const geocodedCoords = await geocodeAddress(restaurantData.address);

              if (geocodedCoords) {
                // FIXED: Leaflet expects [latitude, longitude] format
                const coords: [number, number] = [
                  geocodedCoords.latitude,
                  geocodedCoords.longitude
                ];
                setRestaurantCoords(coords);

                // Update the database
                await (supabase as any)
                  .from('restaurants')
                  .update({
                    latitude: geocodedCoords.latitude,
                    longitude: geocodedCoords.longitude
                  })
                  .eq('id', restaurantId);
              }
            } else {
              // console.warn('[OrderStatus] ⚠️ Restaurant exists but missing coordinates and address:', restaurantData);
            }
          } else {
            // console.error('[OrderStatus] ❌ Restaurant fetch error:', restaurantError);
          }
        } catch (err) {
          // console.error('[OrderStatus] ❌ Exception fetching restaurant:', err);
        }
      } else {
        // console.warn('[OrderStatus] ⚠️ No restaurant coordinates available');
        // console.warn('[OrderStatus] ⚠️ orderData.restaurant:', orderData?.restaurant);
        // console.warn('[OrderStatus] ⚠️ orderData.restaurant?.id:', restaurantId);
      }

      // Fetch delivery person coordinates as soon as delivery person is assigned
      // Use deliveryPersonId from orders table (the FK column)
      const deliveryPersonId = orderData?.deliveryPersonId || orderData?.deliveryPerson?.id;

      if (deliveryPersonId) {
        console.log('[OrderStatus] 🚴 Fetching delivery person coordinates for:', deliveryPersonId);
        const { data: deliveryData, error: deliveryError } = await supabase
          .from('delivery_persons')
          .select('current_latitude, current_longitude, phone, users:user_id(phone)')
          .eq('id', deliveryPersonId)
          .maybeSingle() as { data: any; error: any };

        if (!deliveryError && deliveryData) {
          if (deliveryData.current_latitude && deliveryData.current_longitude) {
            const coords: [number, number] = [
              Number(deliveryData.current_latitude),
              Number(deliveryData.current_longitude)
            ];
            setDeliveryPersonCoords(coords);
            console.log('[OrderStatus] 🚴 Delivery person coords set:', coords);
          }

          // Also load delivery person phone from the same query
          const phone = deliveryData?.phone || deliveryData?.users?.phone;
          if (phone) {
            console.log('[OrderStatus] 📞 Delivery person phone loaded:', phone);
            setDeliveryPersonPhone(phone);
          }
        } else {
          console.warn('[OrderStatus] ⚠️ Delivery person coordinates not available:', deliveryError);
        }
      } else {
        console.warn('[OrderStatus] ⚠️ No delivery person ID available yet');
      }
      
      // IMPORTANT: Set delivery destination coordinates (customer location) for route line
      const deliveryLat = orderData?.delivery_lat;
      const deliveryLng = orderData?.delivery_lng;

      if (deliveryLat && deliveryLng) {
        const coords: [number, number] = [Number(deliveryLat), Number(deliveryLng)];
        setDeliveryDestinationCoords(coords);
      }
    } catch (error) {
      // console.error('loadOrderData: Error loading order:', error);
      Alert.alert('Error', 'Failed to load order details');
      setLoading(false);
    }
  };

  // Poll for order status updates until order is delivered or cancelled
  useEffect(() => {
    let interval: number | null = null;

    // Continue polling until order is in a final state (delivered, cancelled, rejected)
    const isFinalState = ['delivered', 'cancelled', 'rejected'].includes(orderStatus);

    if (!isFinalState) {
      interval = window.setInterval(async () => {
        if (orderId && typeof orderId === 'string') {
          try {
            const updatedOrder = await orderService.getOrderById(orderId);
            if (updatedOrder && updatedOrder.status !== orderStatus) {
              setOrder(updatedOrder);
              setOrderStatus(updatedOrder.status);

              // Send local notification with sound for status changes
              try {
                const { sendLocalNotification } = await import('@/lib/notification-service');
                
                const statusMessages: Record<string, { title: string; body: string }> = {
                  confirmed: {
                    title: '✅ Order Confirmed!',
                    body: 'The restaurant has confirmed your order.',
                  },
                  preparing: {
                    title: '👨‍🍳 Order Preparing!',
                    body: 'Your order is being prepared by the restaurant.',
                  },
                  ready: {
                    title: '📦 Order Ready!',
                    body: 'Your order is ready and waiting for delivery pickup.',
                  },
                  on_the_way: {
                    title: '🚗 Order On The Way!',
                    body: 'The delivery person has picked up your order and is on the way!',
                  },
                  delivered: {
                    title: '🎉 Order Delivered!',
                    body: 'Your order has been delivered successfully. Enjoy your meal!',
                  },
                };

                const message = statusMessages[updatedOrder.status];
                if (message) {
                  // Send system notification
                  await sendLocalNotification({
                    title: message.title,
                    body: message.body,
                    type: 'order',
                    sound: true,
                    badge: 1,
                  });

                  // Show in-app banner notification
                  setDeliveryNotification({
                    visible: true,
                    title: message.title,
                    message: message.body,
                    type: 'order',
                  });
                }
              } catch (notifError) {
                // console.error('[OrderStatus] Error sending notification:', notifError);
              }

              // Stop polling if order reached a final state
              if (['delivered', 'cancelled', 'rejected'].includes(updatedOrder.status)) {
                if (interval) clearInterval(interval);
              }
            }
          } catch (error) {
            // console.error('Polling: Error polling order status:', error);
          }
        }
      }, 5000); // Poll every 5 seconds
    }

    // Cleanup function
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [orderStatus, orderId]);

  // Function to call the agent (admin/customer service)
  const callAgent = async () => {
    try {
      // Fetch the admin phone number from app settings
      const { data, error } = await supabase
        .from('app_settings')
        .select('admin_phone')
        .single() as { data: any; error: any };

      if (error) {
        // console.error('callAgent: Error fetching admin phone:', error);
        Alert.alert('Error', 'Failed to retrieve admin phone number');
        return;
      }

      const phoneNumber = data?.admin_phone;
      if (phoneNumber) {
        Linking.openURL(`tel:${phoneNumber}`).catch((err : any) => {
          // console.error('callAgent: Error opening phone call:', err);
          Alert.alert('Error', 'Unable to initiate phone call. Please try again.');
        });
      } else {
        Alert.alert('Phone Number Not Available', 'The admin phone number is not available at the moment.');
      }
    } catch (error) {
      // console.error('callAgent: Error:', error);
      Alert.alert('Error', 'Failed to retrieve admin phone number');
    }
  };

  if (loading || !isReady) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#C41E26" />
          <Text style={styles.loadingText}>Loading order status...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* Delivery Status Notification Banner */}
      <NotificationBanner
        visible={deliveryNotification.visible}
        title={deliveryNotification.title}
        message={deliveryNotification.message}
        type={deliveryNotification.type}
        onHide={() => setDeliveryNotification({ ...deliveryNotification, visible: false })}
      />

      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={true}>
        {/* Back button */}
        <TouchableOpacity style={styles.backButton} onPress={() => {
          try {
            router.back();
          } catch (error) {
            console.error('[OrderStatus] Navigation error:', error);
          }
        }}>
            <Ionicons name="arrow-back" size={24} color="#C41E26" />
          </TouchableOpacity>

          {/* Status indicator */}
          <View style={styles.statusContainer}>
            {orderStatus === 'pending' ? (
              <>
                <Ionicons name="time-outline" size={64} color="#FFA500" style={styles.statusIcon} />
                <Text style={styles.statusText}>Waiting for Vendor Response</Text>
                <Text style={styles.statusDescription}>
                  Your order has been placed. Please wait while the vendor reviews and confirms your order.
                </Text>

                {/* Show map for real-time tracking - fills upper half like admin orders details */}
                {order && (
                  <View style={styles.mapSectionBig}>
                    <View style={styles.mapHeader}>
                      <TouchableOpacity
                        style={styles.fullscreenMapButton}
                        onPress={() => setShowFullscreenMap(true)}
                      >
                        <Ionicons name="expand" size={18} color="#fff" />
                        <Text style={styles.fullscreenMapButtonText}>Full Map</Text>
                      </TouchableOpacity>
                    </View>
                    <View style={styles.mapContainerBig}>
                      <UnifiedMap
                        role="USER"
                        orderId={order.id ?? undefined}
                        restaurantName={mapRestaurantName}
                        userName={mapUserName}
                        restaurantCoords={mapRestaurantCoords}
                        userCoords={mapUserCoords}
                        destinationCoords={mapDeliveryCoords}
                        // Driver location when available
                        deliveryPersonCoords={order?.delivery_person_id && deliveryPersonCoords ? deliveryPersonCoords : undefined}
                        agentName={order?.delivery_person_id ? (deliveryPersonName || 'Delivery Driver') : undefined}
                        agentImageUrl={order?.delivery_person_id ? deliveryPersonImageUrl || undefined : undefined}
                      />
                    </View>
                  </View>
                )}
              </>
            ) : orderStatus === 'confirmed' ? (
              <>
                <Ionicons name="checkmark-circle-outline" size={64} color="#4CAF50" style={styles.statusIcon} />
                <Text style={styles.statusText}>Order Confirmed</Text>
                <Text style={styles.statusDescription}>
                  The restaurant has confirmed your order and will start preparing it soon.
                </Text>

                {/* Show map for real-time tracking - fills upper half like admin orders details */}
                {order && (
                  <View style={styles.mapSectionBig}>
                    <View style={styles.mapHeader}>
                      <TouchableOpacity
                        style={styles.fullscreenMapButton}
                        onPress={() => setShowFullscreenMap(true)}
                      >
                        <Ionicons name="expand" size={18} color="#fff" />
                        <Text style={styles.fullscreenMapButtonText}>Full Map</Text>
                      </TouchableOpacity>
                    </View>
                    <View style={styles.mapContainerBig}>
                      <UnifiedMap
                        role="USER"
                        orderId={order.id}
                        restaurantName={mapRestaurantName}
                        userName={mapUserName}
                        restaurantCoords={mapRestaurantCoords}
                        userCoords={mapUserCoords}
                        destinationCoords={mapDeliveryCoords}
                      />
                    </View>
                  </View>
                )}
          </>
            ) : orderStatus === 'preparing' ? (
              <>
                <Ionicons name="restaurant-outline" size={64} color="#FF9800" style={styles.statusIcon} />
                <Text style={styles.statusText}>Preparing Your Food</Text>
                <Text style={styles.statusDescription}>
                  The restaurant is currently preparing your order.
                </Text>

                {/* Show map for real-time tracking - fills upper half like admin orders details */}
                {order && (
                  <View style={styles.mapSectionBig}>
                    <View style={styles.mapHeader}>
                      <TouchableOpacity
                        style={styles.fullscreenMapButton}
                        onPress={() => setShowFullscreenMap(true)}
                      >
                        <Ionicons name="expand" size={18} color="#fff" />
                        <Text style={styles.fullscreenMapButtonText}>Full Map</Text>
                      </TouchableOpacity>
                    </View>
                    <View style={styles.mapContainerBig}>
                      <UnifiedMap
                        role="USER"
                        orderId={order.id}
                        restaurantName={mapRestaurantName}
                        userName={mapUserName}
                        restaurantCoords={mapRestaurantCoords}
                        userCoords={mapUserCoords}
                        destinationCoords={mapDeliveryCoords}
                      />
                    </View>
                  </View>
                )}
              </>
            ) : orderStatus === 'ready' ? (
              <>
                <Ionicons
                  name={order?.delivery_person_id ? "refresh-outline" : "time-outline"}
                  size={64}
                  color="#FFA500"
                  style={styles.statusIcon}
                />
                <Text style={styles.statusText}>
                  {order?.delivery_person_id ? 'Ready for Pickup' : 'Waiting for Delivery Person'}
                </Text>
                <Text style={styles.statusDescription}>
                  {order?.delivery_person_id
                    ? 'Your order is ready and waiting for delivery pickup.'
                    : 'Your order is ready but waiting for a new delivery person. The previous delivery had a problem, and we are assigning a new one.'}
                </Text>

                {/* Show map for real-time tracking - fills upper half like admin orders details */}
                {order && (
                  <View style={styles.mapSectionBig}>
                    <View style={styles.mapHeader}>
                      <TouchableOpacity
                        style={styles.fullscreenMapButton}
                        onPress={() => setShowFullscreenMap(true)}
                      >
                        <Ionicons name="expand" size={18} color="#fff" />
                        <Text style={styles.fullscreenMapButtonText}>Full Map</Text>
                      </TouchableOpacity>
                    </View>
                    <View style={styles.mapContainerBig}>
                      <UnifiedMap
                        role="USER"
                        orderId={order.id}
                        restaurantName={mapRestaurantName}
                        userName={mapUserName}
                        restaurantCoords={mapRestaurantCoords}
                        // Driver location when available
                        userCoords={order?.delivery_person_id && deliveryPersonCoords ? deliveryPersonCoords : mapUserCoords}
                        destinationCoords={mapDeliveryCoords}
                        // Pass delivery person coords for driver marker
                        deliveryPersonCoords={order?.delivery_person_id && deliveryPersonCoords ? deliveryPersonCoords : undefined}
                        agentName={order?.delivery_person_id ? (deliveryPersonName || 'Delivery Driver') : undefined}
                        agentImageUrl={order?.delivery_person_id ? deliveryPersonImageUrl || undefined : undefined}
                      />
                    </View>
                  </View>
                )}
              </>
            ) : orderStatus === 'on_the_way' ? (
              <>
                <Ionicons name="car-outline" size={64} color="#C41E26" style={styles.statusIcon} />
                <Text style={styles.statusText}>On The Way</Text>
                <Text style={styles.statusDescription}>
                  The delivery person has picked up your order and is on the way to your location!
                </Text>

                {/* Show map for real-time tracking - fills upper half like admin orders details */}
                {order && (
                  <View style={styles.mapSectionBig}>
                    <View style={styles.mapHeader}>
                      <TouchableOpacity
                        style={styles.fullscreenMapButton}
                        onPress={() => setShowFullscreenMap(true)}
                      >
                        <Ionicons name="expand" size={18} color="#fff" />
                        <Text style={styles.fullscreenMapButtonText}>Full Map</Text>
                      </TouchableOpacity>
                    </View>
                    <View style={styles.mapContainerBig}>
                      <UnifiedMap
                        role="USER"
                        orderId={order.id}
                        restaurantCoords={mapRestaurantCoords}
                        // Driver's real-time location
                        userCoords={deliveryPersonCoords || mapUserCoords}
                        destinationCoords={mapDeliveryCoords}
                        restaurantName={mapRestaurantName}
                        userName={mapUserName}
                        // Pass delivery person coords for driver marker (critical for showing driver on map)
                        deliveryPersonCoords={deliveryPersonCoords || undefined}
                        agentName={deliveryPersonName || 'Delivery Driver'}
                        agentImageUrl={deliveryPersonImageUrl || undefined}
                      />
                    </View>
                  </View>
                )}

                Show delivery person information when order is assigned
                {(order?.deliveryPerson || deliveryPersonName) && (
                  <View style={styles.deliveryLocationContainer}>
                    <Text style={styles.deliveryLocationTitle}>Delivery Person Assigned</Text>
                    <Text style={styles.deliveryLocationText}>
                      Name: {deliveryPersonName || order.deliveryPerson?.users?.name ||
                            order.deliveryPerson?.name ||
                            'Not specified'}
                    </Text>
                    {(order.deliveryPerson?.vehicle_type || order.delivery_person_vehicle) && (
                      <Text style={styles.deliveryLocationText}>
                        Vehicle: {order.deliveryPerson?.vehicle_type || order.delivery_person_vehicle || 'Not specified'}
                      </Text>
                    )}
                    {(order.deliveryPerson?.license_plate || order.delivery_person_license) && (
                      <Text style={styles.deliveryLocationText}>
                        License: {order.deliveryPerson?.license_plate || order.delivery_person_license || 'Not specified'}
                      </Text>
                    )}
                    <Text style={styles.deliveryLocationText}>
                      Status: {(order.deliveryPerson?.is_available !== undefined ? order.deliveryPerson.is_available :
                               order.delivery_person_available !== undefined ? order.delivery_person_available :
                               false) ? 'Available' : 'Unavailable'}
                    </Text>
                  </View>
                )}
          </>
            ) : orderStatus === 'delivered' ? (
              <>
                <Ionicons name="checkmark-done-outline" size={64} color="#4CAF50" style={styles.statusIcon} />
                <Text style={styles.statusText}>Delivered</Text>
                <Text style={styles.statusDescription}>
                  Your order has been delivered. Enjoy your meal!
                </Text>

                {/* Show map for real-time tracking - fills upper half like admin orders details */}
                {order && (
                  <View style={styles.mapSectionBig}>
                    <View style={styles.mapHeader}>
                      <TouchableOpacity
                        style={styles.fullscreenMapButton}
                        onPress={() => setShowFullscreenMap(true)}
                      >
                        <Ionicons name="expand" size={18} color="#fff" />
                        <Text style={styles.fullscreenMapButtonText}>Full Map</Text>
                      </TouchableOpacity>
                    </View>
                    <View style={styles.mapContainerBig}>
                      <UnifiedMap
                        role="USER"
                        orderId={order.id}
                        restaurantName={mapRestaurantName}
                        userName={mapUserName}
                        restaurantCoords={mapRestaurantCoords}
                        userCoords={mapUserCoords}
                        destinationCoords={mapDeliveryCoords}
                      />
                    </View>
                  </View>
                )}

                Show delivery person information when order is assigned
                {(order?.deliveryPerson || deliveryPersonName) && (
                  <View style={styles.deliveryLocationContainer}>
                    <Text style={styles.deliveryLocationTitle}>Delivery Person Assigned</Text>
                    <Text style={styles.deliveryLocationText}>
                      Name: {deliveryPersonName || order.deliveryPerson?.users?.name ||
                            order.deliveryPerson?.name ||
                            'Not specified'}
                    </Text>
                    {(order.deliveryPerson?.vehicle_type || order.delivery_person_vehicle) && (
                      <Text style={styles.deliveryLocationText}>
                        Vehicle: {order.deliveryPerson?.vehicle_type || order.delivery_person_vehicle || 'Not specified'}
                      </Text>
                    )}
                    {(order.deliveryPerson?.license_plate || order.delivery_person_license) && (
                      <Text style={styles.deliveryLocationText}>
                        License: {order.deliveryPerson?.license_plate || order.delivery_person_license || 'Not specified'}
                      </Text>
                    )}
                    <Text style={styles.deliveryLocationText}>
                      Status: {(order.deliveryPerson?.is_available !== undefined ? order.deliveryPerson.is_available :
                               order.delivery_person_available !== undefined ? order.delivery_person_available :
                               false) ? 'Available' : 'Unavailable'}
                    </Text>
                  </View>
                )}
          </>
            ) : (
              <>
                <Ionicons name="alert-circle-outline" size={64} color="#C41E26" style={styles.statusIcon} />
                <Text style={styles.statusText}>Order Status: {orderStatus}</Text>
                <Text style={styles.statusDescription}>
                  Current status of your order.
                </Text>

                {/* Show map for real-time tracking - fills upper half like admin orders details */}
                {order && (
                  <View style={styles.mapSectionBig}>
                    <View style={styles.mapHeader}>
                      <TouchableOpacity
                        style={styles.viewMapButton}
                        onPress={() => setShowMap(!showMap)}
                      >
                        <Text style={styles.viewMapButtonText}>
                          {showMap ? '🔼 Hide Map' : '🗺️ Show Map'}
                        </Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={styles.fullscreenMapButton}
                        onPress={() => setShowFullscreenMap(true)}
                      >
                        <Ionicons name="expand" size={18} color="#fff" />
                        <Text style={styles.fullscreenMapButtonText}>Full Map</Text>
                      </TouchableOpacity>
                    </View>
                    {showMap && (
                      <View style={styles.mapContainerBig}>
                        <UnifiedMap
                          role="USER"
                          orderId={order.id}
                          restaurantCoords={mapRestaurantCoords}
                          // Driver location when available, otherwise user location
                          userCoords={
                            (orderStatus === 'picked_up' || orderStatus === 'on_the_way') && deliveryPersonCoords
                              ? deliveryPersonCoords
                              : mapUserCoords
                          }
                          destinationCoords={mapDeliveryCoords}
                          restaurantName={mapRestaurantName}
                          userName={mapUserName}
                          // Pass delivery person coords for driver marker
                          deliveryPersonCoords={
                            (orderStatus === 'picked_up' || orderStatus === 'on_the_way') && deliveryPersonCoords
                              ? deliveryPersonCoords
                              : undefined
                          }
                          agentName={orderStatus === 'picked_up' || orderStatus === 'on_the_way' ? (deliveryPersonName || 'Delivery Driver') : undefined}
                          agentImageUrl={orderStatus === 'picked_up' || orderStatus === 'on_the_way' ? deliveryPersonImageUrl || undefined : undefined}
                        />
                      </View>
                    )}
                  </View>
                )}
          </>
            )}
          </View>

          {/* Fullscreen map modal */}
          <FullscreenMap
            role="USER"
            orderId={order?.id}
            restaurantCoords={mapRestaurantCoords}
            userCoords={mapUserCoords}
            destinationCoords={mapDeliveryCoords}
            // Show driver location when order is picked up or on the way
            userLocation={
              (orderStatus === 'picked_up' || orderStatus === 'on_the_way') && deliveryPersonCoords
                ? deliveryPersonCoords
                : mapUserCoords
            }
            // Pass delivery person coords for driver marker
            deliveryPersonCoords={
              (orderStatus === 'picked_up' || orderStatus === 'on_the_way') && deliveryPersonCoords
                ? deliveryPersonCoords
                : undefined
            }
            restaurantName={mapRestaurantName}
            userName={mapUserName}
            agentName={orderStatus === 'picked_up' || orderStatus === 'on_the_way' ? (deliveryPersonName || 'Delivery Driver') : undefined}
            agentImageUrl={orderStatus === 'picked_up' || orderStatus === 'on_the_way' ? deliveryPersonImageUrl || undefined : undefined}
            isVisible={showFullscreenMap}
            onClose={() => setShowFullscreenMap(false)}
          />

          Contact buttons - show different options based on order status
          <View style={styles.contactContainer}>
            <Text style={styles.contactTitle}>Need Assistance?</Text>

            {/* Call Delivery Person - shows when a driver is assigned */}
            {(orderStatus === 'picked_up' || orderStatus === 'on_the_way' || order?.delivery_person_id || order?.deliveryPerson) && (
              <TouchableOpacity style={styles.contactButton} onPress={callDeliveryPerson}>
                <Ionicons name="call" size={20} color="#C41E26" />
                <View style={styles.buttonTextContainer}>
                  <Text style={styles.contactButtonText}>📞 Call Delivery Person</Text>
                  {deliveryPersonPhone && (
                    <Text style={styles.phoneNumber}>{deliveryPersonPhone}</Text>
                  )}
                </View>
              </TouchableOpacity>
            )}

            {/* Call Customer Service - always visible */}
            <TouchableOpacity style={styles.contactButton} onPress={callCustomerService}>
              <Ionicons name="call" size={20} color="#C41E26" />
              <View style={styles.buttonTextContainer}>
                <Text style={styles.contactButtonText}>📞 Call Customer Service</Text>
                {adminPhone && (
                  <Text style={styles.phoneNumber}>{adminPhone}</Text>
                )}
              </View>
            </TouchableOpacity>
          </View>

          Order details
          {order && (
            <View style={styles.orderDetailsContainer}>
              <Text style={styles.orderDetailTitle}>Order Details</Text>
              <Text style={styles.orderDetail}>Restaurant: {order.restaurant?.name || order.restaurant_name || 'N/A'}</Text>
              <Text style={styles.orderDetail}>
                Total Amount: AFG {
                  (() => {
                    const total = parseFloat(order.totalAmount?.toString() || 
                                            order.total_amount?.toString() || 
                                            order.total?.toString() || 
                                            '0');
                    return isNaN(total) ? '0.00' : total.toFixed(2);
                  })()
                }
              </Text>
              <Text style={styles.orderDetail}>Delivery Address: {order.deliveryAddress || order.delivery_address || 'N/A'}</Text>

              Order Items Section
              {order.items && order.items.length > 0 && (
                <View style={styles.orderItemsContainer}>
                  <Text style={styles.orderItemsTitle}>Ordered Items:</Text>
                  {order.items.map((item: any, index: number) => {
                    // Try multiple price field names to ensure we get the price
                    const price = parseFloat(
                      item.price?.toString() ||
                      item.priceAtOrder?.toString() ||
                      item.item_price?.toString() ||
                      item.price_at_order?.toString() ||
                      '0'
                    ) || 0;

                    const quantity = parseInt(
                      item.quantity?.toString() ||
                      item.item_quantity?.toString() ||
                      '1'
                    ) || 1;

                    const total = price * quantity;
                    const imageUrl = item.image_url || item.imageUrl || item.menu_item_image_url || null;


                    return (
                      <View key={index} style={styles.menuItemCard}>
                        Small thumbnail image on left
                        {imageUrl ? (
                          <Image source={{ uri: imageUrl }} style={styles.menuItemThumbnail} resizeMode="cover" />
                        ) : (
                          <View style={styles.menuItemThumbnailPlaceholder}>
                            <Text style={styles.menuItemThumbnailPlaceholderText}>🍽️</Text>
                          </View>
                        )}
                        Name and details beneath image
                        <View style={styles.menuItemInfo}>
                          <Text style={styles.menuItemName}>{quantity}x {item.name || item.item_name || 'Item'}</Text>
                          <Text style={styles.menuItemPrice}>AFG {total.toFixed(2)}</Text>
                        </View>
                      </View>
                    );
                  })}
                </View>
              )}
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
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 40,
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
  backButton: {
    alignSelf: 'flex-start',
    padding: 8,
    marginBottom: 16,
  },
  statusContainer: {
    alignItems: 'center',
    marginBottom: 20,
    padding: 20,
    backgroundColor: 'white',
    borderRadius: 8,
  },
  statusIcon: {
    marginBottom: 12,
  },
  statusText: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
    textAlign: 'center',
  },
  statusDescription: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    lineHeight: 18,
  },
  contactContainer: {
    marginBottom: 20,
    padding: 16,
    backgroundColor: 'white',
    borderRadius: 8,
  },
  contactTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 12,
    textAlign: 'center',
  },
  contactButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f9f9f9',
    padding: 12,
    borderRadius: 6,
    marginBottom: 8,
  },
  contactButtonText: {
    marginLeft: 8,
    fontSize: 14,
    color: '#333',
    fontWeight: '500',
  },
  buttonTextContainer: {
    marginLeft: 8,
    flex: 1,
  },
  phoneNumber: {
    marginLeft: 8,
    fontSize: 12,
    color: '#666',
    fontWeight: '400',
    marginTop: 2,
  },
  orderDetailsContainer: {
    backgroundColor: 'white',
    padding: 16,
    borderRadius: 8,
  },
  orderDetailTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 12,
  },
  orderDetail: {
    fontSize: 14,
    color: '#666',
    marginBottom: 6,
  },
  deliveryLocationContainer: {
    marginTop: 12,
    padding: 12,
    backgroundColor: '#f0f8ff',
    borderRadius: 6,
  },
  deliveryLocationTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#C41E26',
    marginBottom: 4,
  },
  deliveryLocationText: {
    fontSize: 12,
    color: '#555',
  },
  mapSection: {
    marginTop: 12,
    width: '100%',
  },
  mapSectionBig: {
    marginTop: 0,
    width: '100%',
    backgroundColor: '#fff',
    paddingBottom: 0,
  },
  mapHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  viewMapButton: {
    backgroundColor: '#C41E26',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 12,
    flex: 1,
    marginRight: 8,
  },
  fullscreenMapButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#C41E26',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 6,
    gap: 4,
  },
  fullscreenMapButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  fullscreenButton: {
    backgroundColor: '#fff',
    padding: 10,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: '#C41E26',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  viewMapButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  mapContainer: {
    marginTop: 0,
    height: 200,
    width: '100%',
    borderRadius: 8,
    overflow: 'hidden',
  },
  mapContainerBig: {
    height: Dimensions.get('window').height * 0.5, // Fill upper half of page like admin/deliver orders details
    marginHorizontal: 0,
    borderRadius: 0,
    overflow: 'hidden',
    backgroundColor: '#e0e0e0',
    width: '100%',
  },
  deliveryContactContainer: {
    marginTop: 8,
  },
  orderItemsContainer: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#eee',
  },
  orderItemsTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
  },
  orderItemRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 4,
  },
  orderItemRowWithImage: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    gap: 10,
  },
  orderItemImage: {
    width: 80,
    height: 80,
    borderRadius: 12,
    backgroundColor: '#f5f5f5',
  },
  orderItemImagePlaceholder: {
    width: 80,
    height: 80,
    borderRadius: 12,
    backgroundColor: '#f5f5f5',
    justifyContent: 'center',
    alignItems: 'center',
  },
  orderItemImagePlaceholderText: {
    fontSize: 24,
  },
  orderItemInfo: {
    flex: 1,
    gap: 4,
  },
  orderItemText: {
    fontSize: 14,
    color: '#666',
    fontWeight: '500',
  },
  orderItemPrice: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#C41E26',
  },
  menuItemCard: {
    backgroundColor: '#fff',
    borderRadius: 8,
    marginBottom: 12,
    padding: 8,
    flexDirection: 'row',
    alignItems: 'center',
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 1,
  },
  menuItemThumbnail: {
    width: 60,
    height: 60,
    borderRadius: 8,
    backgroundColor: '#f0f0f0',
    marginRight: 12,
  },
  menuItemThumbnailPlaceholder: {
    width: 60,
    height: 60,
    borderRadius: 8,
    backgroundColor: '#f0f0f0',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  menuItemThumbnailPlaceholderText: {
    fontSize: 24,
  },
  menuItemInfo: {
    flex: 1,
  },
  menuItemName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  menuItemPrice: {
    fontSize: 15,
    fontWeight: 'bold',
    color: '#C41E26',
  },
});