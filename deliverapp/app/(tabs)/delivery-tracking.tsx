import React, { useState, useEffect, useRef, useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert, ScrollView, ActivityIndicator, Linking, TextInput, Modal } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import * as Location from 'expo-location';
import { useSession } from '@/lib/auth-client';
import { localDbService } from '@/lib/local-db-service';
import UnifiedMap from '@/components/UnifiedMap';
import { deliveryService } from '@/lib/delivery-service';
import DrawerLayout from '@/components/DrawerLayout';
import { Platform } from 'react-native';
import { supabase } from '@/lib/supabase';

interface OrderItem {
  id: string;
  quantity: number;
  price: number;
  menu_items?: {
    name: string;
  };
}

interface Order {
  id: string;
  orderNumber: string;
  userId: string;
  userName: string;
  userPhone: string;
  userAddress: string;
  restaurantId: string;
  restaurantName: string;
  restaurantAddress: string;
  restaurantLatitude?: number;
  restaurantLongitude?: number;
  deliveryAddress: string;
  deliveryLatitude?: number;
  deliveryLongitude?: number;
  totalAmount: number;
  subtotal: number;
  deliveryCost: number;
  tipAmount?: number;
  status: string;
  deliveryStatus: string;
  paymentMethod?: string;
  paymentStatus?: string;
  createdAt: Date;
  updatedAt: Date;
  deliveryNotes?: string;
  specialInstructions?: string;
  items?: OrderItem[];
  is_completed?: boolean;
  completed_at?: string;
  delivery_otp?: string;
  delivery_otp_verified?: boolean;
  restaurant?: {
    name: string;
    address: string;
    latitude?: number;
    longitude?: number;
  };
}

export default function DeliveryTrackingScreen() {
  const sessionData = useSession();
  const session = sessionData.data?.session as any;
  const router = useRouter();
  const isPending = sessionData.isPending;
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [location, setLocation] = useState<[number, number] | null>(null);
  const [currentDelivery, setCurrentDelivery] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const [updatingStatus, setUpdatingStatus] = useState('');
  const [locationPermissionGranted, setLocationPermissionGranted] = useState(false);
  const [backgroundTracking, setBackgroundTracking] = useState(false);
  const [restaurantLocations, setRestaurantLocations] = useState<{[key: string]: {lat: number, lng: number}}>({});
  const [deliveryPersonImageUrl, setDeliveryPersonImageUrl] = useState<string | null>(null);
  const [deliveryPersonId, setDeliveryPersonId] = useState<string | null>(null);
  const [showOtpModal, setShowOtpModal] = useState(false);
  const [otpInput, setOtpInput] = useState('');
  const [currentOtp, setCurrentOtp] = useState<string | null>(null);
  const locationTaskRef = useRef<Location.LocationSubscription | null>(null);

  // Memoize map coordinates to prevent infinite re-renders
  const mapRestaurantCoords = useMemo(() => {
    const restaurantId = currentDelivery?.restaurantId;
    if (restaurantId && restaurantLocations[restaurantId]) {
      const loc = restaurantLocations[restaurantId];
      return [loc.lat, loc.lng] as [number, number];
    }
    if (currentDelivery?.restaurantLatitude && currentDelivery?.restaurantLongitude) {
      return [currentDelivery.restaurantLatitude, currentDelivery.restaurantLongitude] as [number, number];
    }
    return undefined;
  }, [currentDelivery, restaurantLocations]);

  const mapUserCoords = useMemo(() => location || undefined, [location]);

  const loadDeliveryPersonProfile = async () => {
    try {
      if (!session?.user?.id) {
        console.warn('[DeliveryTracking] ⚠️ No session user ID');
        return;
      }

      const { supabase } = await import('@/lib/supabase');
      
      const { data, error } = await supabase
        .from('delivery_persons')
        .select('id, user_id, name, email, phone, image_url')
        .eq('user_id', session.user.id)
        .single();

      if (error) {
        console.error('[DeliveryTracking] ❌ Error fetching profile:', error.message);
        
        // Try to create delivery person record if it doesn't exist
        const { data: userData } = await supabase
          .from('users')
          .select('name, email')
          .eq('id', session.user.id)
          .single();
        
        if (userData) {
          const { data: newDp, error: insertError } = await supabase
            .from('delivery_persons')
            .insert([{
              id: session.user.id,
              user_id: session.user.id,
              name: userData.name || 'Delivery Person',
              email: userData.email || '',
              is_available: true
            }])
            .select('id, user_id, name, image_url')
            .single();
          
          if (insertError) {
            console.error('[DeliveryTracking] ❌ Failed to create delivery person:', insertError.message);
          } else {
            setDeliveryPersonId(newDp.id || null);
            setDeliveryPersonImageUrl(newDp.image_url || null);
            return;
          }
        }
      }
      
      if (data) {
        setDeliveryPersonImageUrl(data.image_url || null);
        setDeliveryPersonId(data.id || null);
      }
    } catch (error) {
      console.error('[DeliveryTracking] Error loading profile:', error);
    }
  };

  const getCurrentLocation = async () => {
    try {
      let { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setLocationPermissionGranted(false);
        Alert.alert(
          'Location Permission Required',
          'Location permission is required to track deliveries. Please enable location access in your device settings.',
          [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Open Settings', onPress: () => Linking.openSettings() }
          ]
        );
        return;
      }

      setLocationPermissionGranted(true);
      let loc = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      });
      const deliveryPersonLocation: [number, number] = [loc.coords.latitude, loc.coords.longitude];
      setLocation(deliveryPersonLocation);
    } catch (error) {
      console.error('Error getting location:', error);
      setLocationPermissionGranted(false);
      Alert.alert(
        'Location Error',
        'Unable to get your location. Please ensure location services are enabled.',
        [{ text: 'OK' }]
      );
    }
  };

  // Start background location tracking - Simple version: update DB every 30-45 seconds
  const startBackgroundLocationTracking = async () => {
    try {
      // Request background permission (Android only)
      if (Platform.OS === 'android') {
        const { status: bgStatus } = await Location.requestBackgroundPermissionsAsync();
        if (bgStatus !== 'granted') {
          console.warn('[DeliveryTracking] Background location permission not granted');
        }
      }

      // Start watching position
      locationTaskRef.current = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.Balanced,
          timeInterval: 30000,  // 30 seconds
          distanceInterval: 50,  // 50 meters
        },
        async (loc) => {
          const newLocation: [number, number] = [loc.coords.latitude, loc.coords.longitude];

          // Update location in database
          if (deliveryPersonId) {
            try {
              await supabase
                .from('delivery_persons')
                .update({
                  current_latitude: newLocation[0],
                  current_longitude: newLocation[1],
                  updated_at: new Date().toISOString()
                })
                .eq('id', deliveryPersonId);
            } catch (error) {
              console.error('[DeliveryTracking] Error updating location in DB:', error);
            }
          } else {
            console.warn('[DeliveryTracking] No delivery_person_id, skipping update');
          }
        }
      );

      setBackgroundTracking(true);
    } catch (error) {
      console.error('[DeliveryTracking] Error starting background tracking:', error);
    }
  };

  // Stop background location tracking
  const stopBackgroundLocationTracking = () => {
    if (locationTaskRef.current) {
      locationTaskRef.current.remove();
      locationTaskRef.current = null;
      setBackgroundTracking(false);
    }
  };

  const toggleLocationTracking = async () => {
    if (backgroundTracking) {
      stopBackgroundLocationTracking();
      Alert.alert('Location Tracking', 'Background location tracking has been stopped');
    } else {
      // Check permission first
      let { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert(
          'Permission Required',
          'Location permission is required. Please enable it in settings.',
          [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Open Settings', onPress: () => Linking.openSettings() }
          ]
        );
        return;
      }

      await startBackgroundLocationTracking();
      setLocationPermissionGranted(true);
      Alert.alert(
        'Location Tracking Enabled',
        'Your location will be tracked in the background during deliveries.',
        [{ text: 'OK' }]
      );
    }
  };

  const loadOrderFromSupabase = async (orderId: string) => {
    try {
      const { supabase } = await import('@/lib/supabase');
      
      const { data, error } = await supabase
        .from('orders')
        .select(`
          *,
          user:profiles!user_id (
            name,
            phone
          ),
          restaurant:restaurants!restaurant_id (
            name,
            address,
            latitude,
            longitude
          ),
          order_items (
            id,
            quantity,
            price,
            menu_items (
              name
            )
          )
        `)
        .eq('id', orderId)
        .single();

      if (error) {
        console.error('[DeliveryTracking] Error fetching order from Supabase:', error);
        return null;
      }

      // Transform to our Order interface
      const transformedOrder: Order = {
        id: data.id,
        orderNumber: data.order_number || data.id.substring(0, 8),
        userId: data.user_id,
        userName: data.user?.name || 'Unknown Customer',
        userPhone: data.user?.phone || 'N/A',
        userAddress: data.delivery_address || 'No address',
        restaurantId: data.restaurant_id,
        restaurantName: data.restaurant?.name || 'Unknown Restaurant',
        restaurantAddress: data.restaurant?.address || 'No address',
        restaurantLatitude: data.restaurant?.latitude ? parseFloat(data.restaurant.latitude.toString()) : undefined,
        restaurantLongitude: data.restaurant?.longitude ? parseFloat(data.restaurant.longitude.toString()) : undefined,
        deliveryAddress: data.delivery_address || 'No address',
        deliveryLatitude: data.delivery_latitude ? parseFloat(data.delivery_latitude.toString()) : undefined,
        deliveryLongitude: data.delivery_longitude ? parseFloat(data.delivery_longitude.toString()) : undefined,
        totalAmount: parseFloat(String(data.total_amount)) || 0,
        subtotal: parseFloat(String(data.subtotal)) || 0,
        deliveryCost: parseFloat(String(data.delivery_fee)) || 0,
        tipAmount: data.tip_amount ? parseFloat(String(data.tip_amount)) : undefined,
        status: data.status,
        deliveryStatus: data.status,
        paymentMethod: data.payment_method,
        paymentStatus: data.payment_status,
        createdAt: new Date(data.created_at),
        updatedAt: new Date(data.updated_at),
        deliveryNotes: data.delivery_notes,
        specialInstructions: data.special_instructions,
        items: data.order_items?.map((item: any) => ({
          id: item.id,
          quantity: item.quantity,
          price: parseFloat(String(item.price)),
          menu_items: item.menu_items
        })),
        restaurant: data.restaurant ? {
          name: data.restaurant.name,
          address: data.restaurant.address,
          latitude: data.restaurant.latitude ? parseFloat(data.restaurant.latitude.toString()) : undefined,
          longitude: data.restaurant.longitude ? parseFloat(data.restaurant.longitude.toString()) : undefined,
        } : undefined,
        is_completed: data.is_completed || false,
        completed_at: data.completed_at
      };

      return transformedOrder;
    } catch (error) {
      console.error('[DeliveryTracking] Error loading order from Supabase:', error);
      return null;
    }
  };

  const loadCurrentDelivery = async () => {
    try {

      if (!session?.user?.id) {
        Alert.alert('Error', 'User not authenticated');
        return;
      }

      // First try to get from local database
      const allOrders = await localDbService.orders.getAll();

      // Find the current active delivery
      let activeDelivery = allOrders.find((order: any) =>
        order.status !== 'delivered' && order.status !== 'cancelled' &&
        !order.is_completed && // Filter out completed orders
        (order.delivery_person_id === session.user.id || order.driver_id === session.user.id)
      );

      if (activeDelivery) {
        // Transform local DB order to Order interface
        const localOrder: Order = {
          id: activeDelivery.id,
          orderNumber: activeDelivery.orderNumber || activeDelivery.order_number || activeDelivery.id.substring(0, 8),
          userId: activeDelivery.user_id || activeDelivery.userId,
          userName: activeDelivery.userName || 'Unknown Customer',
          userPhone: activeDelivery.userPhone || 'N/A',
          userAddress: activeDelivery.userAddress || activeDelivery.delivery_address || 'No address',
          restaurantId: activeDelivery.restaurant_id || activeDelivery.restaurantId,
          restaurantName: activeDelivery.restaurantName || 'Unknown Restaurant',
          restaurantAddress: activeDelivery.restaurantAddress || 'No address',
          restaurantLatitude: activeDelivery.restaurantLatitude,
          restaurantLongitude: activeDelivery.restaurantLongitude,
          deliveryAddress: activeDelivery.deliveryAddress || activeDelivery.delivery_address || 'No address',
          deliveryLatitude: activeDelivery.deliveryLatitude,
          deliveryLongitude: activeDelivery.deliveryLongitude,
          totalAmount: parseFloat(String(activeDelivery.totalAmount || activeDelivery.total_amount || 0)),
          subtotal: parseFloat(String(activeDelivery.subtotal || 0)),
          deliveryCost: parseFloat(String(activeDelivery.deliveryCost || activeDelivery.delivery_fee || 0)),
          tipAmount: activeDelivery.tipAmount || activeDelivery.tip_amount,
          status: activeDelivery.status,
          deliveryStatus: activeDelivery.deliveryStatus || activeDelivery.status,
          paymentMethod: activeDelivery.paymentMethod || activeDelivery.payment_method,
          paymentStatus: activeDelivery.paymentStatus || activeDelivery.payment_status,
          createdAt: new Date(activeDelivery.createdAt || activeDelivery.created_at),
          updatedAt: new Date(activeDelivery.updatedAt || activeDelivery.updated_at),
          deliveryNotes: activeDelivery.deliveryNotes || activeDelivery.delivery_notes,
          specialInstructions: activeDelivery.specialInstructions || activeDelivery.special_instructions,
          items: activeDelivery.items || activeDelivery.order_items,
          restaurant: activeDelivery.restaurant,
          is_completed: activeDelivery.is_completed || false,
          completed_at: activeDelivery.completed_at
        };
        setCurrentDelivery(localOrder);
      } else {
        // If no active delivery in local DB, check Supabase directly
        try {
          const { supabase } = await import('@/lib/supabase');
          const { data: orders, error } = await supabase
            .from('orders')
            .select(`
              *,
              restaurant:restaurants!restaurant_id (
                name,
                address,
                latitude,
                longitude
              )
            `)
            .eq('delivery_person_id', session.user.id)
            .in('status', ['pending', 'confirmed', 'preparing', 'ready', 'on_the_way', 'picked_up'])
            .eq('is_completed', false)
            .order('created_at', { ascending: false })
            .limit(1);

          if (!error && orders && orders.length > 0) {
            const order = await loadOrderFromSupabase(orders[0].id);
            if (order) {
              setCurrentDelivery(order);
            }
          }
        } catch (error) {
          console.error('[DeliveryTracking] Error fetching orders:', error);
        }
      }

      setLoading(false);
    } catch (error) {
      console.error('[DeliveryTracking] ❌ Error loading current delivery:', error);
      Alert.alert('Error', 'Failed to load current delivery');
      setLoading(false);
    }
  };

  useEffect(() => {
    const loadData = async () => {
      if (!isPending && session) {
        await loadDeliveryPersonProfile();
        await getCurrentLocation();
        await loadCurrentDelivery();
        await startBackgroundLocationTracking();
      } else if (!session) {
        setLoading(false);
      }
    };

    loadData();
  }, [isPending, session]);

  // Clean up on unmount
  useEffect(() => {
    return () => {
      if (locationTaskRef.current) {
        locationTaskRef.current.remove();
        locationTaskRef.current = null;
      }
    };
  }, []);

  if (isPending || loading) {
    return (
      <DrawerLayout drawerOpen={drawerOpen} setDrawerOpen={setDrawerOpen}>
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color="#C41E26" />
          <Text style={styles.loadingText}>Loading delivery information...</Text>
        </View>
      </DrawerLayout>
    );
  }

  if (!session) {
    return (
      <DrawerLayout drawerOpen={drawerOpen} setDrawerOpen={setDrawerOpen}>
        <View style={styles.centerContainer}>
          <Text style={styles.noDeliveryText}>Please log in to track deliveries</Text>
        </View>
      </DrawerLayout>
    );
  }

  const updateDeliveryStatus = async (newStatus: string) => {
    if (!currentDelivery) return;

    setUpdatingStatus(newStatus);

    try {
      // If marking as delivered, generate OTP
      if (newStatus === 'delivered') {
        const generatedOtp = Math.floor(100000 + Math.random() * 900000).toString();
        
        const { error } = await supabase
          .from('orders')
          .update({
            status: 'delivered',
            delivery_otp: generatedOtp,
            delivery_otp_verified: false,
            updated_at: new Date().toISOString()
          })
          .eq('id', currentDelivery.id);

        if (error) throw error;

        // Update local state
        setCurrentDelivery(prev => prev ? { ...prev, status: 'delivered', delivery_otp: generatedOtp, delivery_otp_verified: false } : null);
        setCurrentOtp(generatedOtp);
        
        // Show OTP modal
        setShowOtpModal(true);
      } else {
        const updatedOrder = await deliveryService.updateDeliveryStatus(currentDelivery.id, newStatus);

        // Refresh the order data from Supabase
        const refreshedOrder = await loadOrderFromSupabase(currentDelivery.id);
        if (refreshedOrder) {
          setCurrentDelivery(refreshedOrder);
        }
      }
    } catch (error) {
      console.error('Error updating delivery status:', error);
      Alert.alert('Error', 'Failed to update delivery status');
    } finally {
      setUpdatingStatus('');
    }
  };

  const completeOrder = async () => {
    if (!currentDelivery) return;

    // Check if OTP is already verified
    if (currentDelivery.delivery_otp_verified) {
      // OTP already verified, proceed with completion
      completeOrderWithoutPrompt();
      return;
    }

    // Show OTP verification modal
    setShowOtpModal(true);
  };

  const completeOrderWithoutPrompt = async () => {
    if (!currentDelivery) return;

    Alert.alert(
      'Complete Order',
      'Are you sure you want to mark this order as completed? This will remove it from your delivery list.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Complete',
          style: 'destructive',
          onPress: async () => {
            try {
              const { supabase } = await import('@/lib/supabase');

              // Update order to mark as completed
              const { error } = await supabase
                .from('orders')
                .update({
                  is_completed: true,
                  completed_at: new Date().toISOString(),
                  updated_at: new Date().toISOString()
                })
                .eq('id', currentDelivery.id);

              if (error) throw error;

              // Update local state
              setCurrentDelivery(prev => prev ? { ...prev, is_completed: true, completed_at: new Date().toISOString() } : null);

              Alert.alert('Success', 'Order completed successfully!');
            } catch (error) {
              console.error('[DeliveryTracking] Error completing order:', error);
              Alert.alert('Error', 'Failed to complete order');
            }
          }
        }
      ]
    );
  };

  const verifyOtpAndComplete = async () => {
    if (!currentDelivery || !currentOtp) return;

    if (otpInput !== currentOtp) {
      Alert.alert('Invalid OTP', 'The OTP you entered is incorrect. Please ask the customer for the correct OTP.');
      return;
    }

    try {
      const { supabase } = await import('@/lib/supabase');

      // Verify OTP and mark order as completed
      const { error } = await supabase
        .from('orders')
        .update({
          delivery_otp_verified: true,
          is_completed: true,
          completed_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq('id', currentDelivery.id);

      if (error) throw error;

      // Update local state
      setCurrentDelivery(prev => prev ? { ...prev, is_completed: true, completed_at: new Date().toISOString(), delivery_otp_verified: true } : null);
      setShowOtpModal(false);
      setOtpInput('');

      Alert.alert('Success', 'Order completed successfully!');
    } catch (error) {
      console.error('[DeliveryTracking] Error verifying OTP:', error);
      Alert.alert('Error', 'Failed to verify OTP');
    }
  };

  const updateLocation = async () => {
    try {
      if (!deliveryPersonId || !location) {
        console.warn('[DeliveryTracking] ⚠️ No delivery_person_id or location, skipping update');
        return;
      }

      const [latitude, longitude] = location;

      await deliveryService.updateDeliveryLocation(deliveryPersonId, {
        latitude,
        longitude,
        status: currentDelivery ? 'busy' : 'available'
      });
    } catch (error) {
      console.error('Error updating location:', error);
    }
  };

  // Update location periodically
  useEffect(() => {
    if (location && session?.user?.id) {
      updateLocation();
    }
  }, [location]);

  if (!currentDelivery) {
    return (
      <DrawerLayout drawerOpen={drawerOpen} setDrawerOpen={setDrawerOpen}>
        <View style={styles.centerContainer}>
          <Text style={styles.noDeliveryText}>No active deliveries assigned</Text>
          <Text style={styles.noDeliverySubtext}>Please wait for the admin to assign you a delivery.</Text>
        </View>
      </DrawerLayout>
    );
  }

  // Extract locations
  const restaurantLocation: [number, number] = [
    currentDelivery.restaurantLongitude || 0,
    currentDelivery.restaurantLatitude || 0
  ];

  const customerLocation: [number, number] = [
    currentDelivery.deliveryLongitude || 0,
    currentDelivery.deliveryLatitude || 0
  ];

  return (
    <DrawerLayout drawerOpen={drawerOpen} setDrawerOpen={setDrawerOpen}>
      <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
        <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
          {/* Back Button */}
          <View style={styles.backButtonContainer}>
            <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
              <Text style={styles.backButtonText}>← Back</Text>
            </TouchableOpacity>
          </View>

          {/* Map Section */}
          <View style={styles.mapContainer}>
          <UnifiedMap
            orderId={currentDelivery?.id || undefined}
            restaurantCoords={mapRestaurantCoords}
            userLocation={mapUserCoords}
            role="DELIVER"
          />
        </View>

        {/* Location Tracking Button */}
        <View style={styles.locationButtonContainer}>
          <TouchableOpacity
            style={[
              styles.locationButton,
              backgroundTracking ? styles.locationButtonActive : styles.locationButtonInactive
            ]}
            onPress={toggleLocationTracking}
          >
            <Text style={styles.locationButtonIcon}>📍</Text>
            <Text style={styles.locationButtonText}>
              {backgroundTracking ? 'Location Tracking: ON' : 'Enable Location Tracking'}
            </Text>
          </TouchableOpacity>
          {!locationPermissionGranted && (
            <Text style={styles.locationPermissionWarning}>
              ⚠️ Location permission not granted. Tap to enable.
            </Text>
          )}
          {backgroundTracking && (
            <Text style={styles.locationStatus}>
              ✅ Your location is being tracked in the background
            </Text>
          )}
        </View>

        {/* Delivery Info Section */}
        <View style={styles.infoContainer}>
          <View style={styles.deliveryInfo}>
            <Text style={styles.orderId}>Order #{currentDelivery.orderNumber}</Text>
            
            {/* Customer Info */}
            <View style={styles.infoSection}>
              <Text style={styles.infoSectionTitle}>👤 Customer</Text>
              <Text style={styles.customerName}>{currentDelivery.userName}</Text>
              <Text style={styles.infoDetail}>📞 {currentDelivery.userPhone}</Text>
            </View>

            {/* Restaurant Info */}
            <View style={styles.infoSection}>
              <Text style={styles.infoSectionTitle}>🏪 Restaurant</Text>
              <Text style={styles.infoDetail}>📍 {currentDelivery.restaurantName}</Text>
              <Text style={styles.infoDetail}>🏠 {currentDelivery.restaurantAddress}</Text>
            </View>

            {/* Delivery Address */}
            <View style={styles.infoSection}>
              <Text style={styles.infoSectionTitle}>📍 Delivery Address</Text>
              <Text style={styles.infoDetail}>{currentDelivery.deliveryAddress}</Text>
            </View>

            {/* Order Items */}
            {currentDelivery.items && currentDelivery.items.length > 0 && (
              <View style={styles.infoSection}>
                <Text style={styles.infoSectionTitle}>📦 Order Items</Text>
                {currentDelivery.items.map((item, index) => (
                  <Text key={index} style={styles.infoDetail}>
                    • {item.quantity}x {item.menu_items?.name || 'Item'} - AFG {(item.price * item.quantity).toFixed(2)}
                  </Text>
                ))}
              </View>
            )}

            {/* Payment Summary */}
            <View style={styles.infoSection}>
              <Text style={styles.infoSectionTitle}>💰 Payment Summary</Text>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Subtotal:</Text>
                <Text style={styles.summaryValue}>AFG {currentDelivery.subtotal.toFixed(2)}</Text>
              </View>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Delivery:</Text>
                <Text style={styles.summaryValue}>AFG {currentDelivery.deliveryCost.toFixed(2)}</Text>
              </View>
              {currentDelivery.tipAmount && currentDelivery.tipAmount > 0 && (
                <View style={styles.summaryRow}>
                  <Text style={styles.summaryLabel}>Tip:</Text>
                  <Text style={styles.summaryValue}>AFG {currentDelivery.tipAmount.toFixed(2)}</Text>
                </View>
              )}
              <View style={[styles.summaryRow, styles.totalRow]}>
                <Text style={styles.totalLabel}>Total:</Text>
                <Text style={styles.totalValue}>AFG {currentDelivery.totalAmount.toFixed(2)}</Text>
              </View>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Status:</Text>
                <Text style={styles.statusValue}>{currentDelivery.deliveryStatus?.replace('_', ' ') || currentDelivery.status?.replace('_', ' ')}</Text>
              </View>
            </View>
          </View>

          {/* Action Buttons - Always show all buttons for manual clicking */}
          <View style={styles.actionButtons}>
            <TouchableOpacity
              style={[
                styles.actionButton,
                styles.pickedUpButton,
                currentDelivery.status === 'picked_up' && styles.activeButton,
                updatingStatus === 'picked_up' && styles.updatingButton
              ]}
              onPress={() => updateDeliveryStatus('picked_up')}
              disabled={updatingStatus !== '' || currentDelivery.status === 'delivered' || currentDelivery.is_completed}
            >
              {updatingStatus === 'picked_up' ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.actionButtonText}>
                  📦 Mark Picked Up
                </Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.actionButton,
                styles.onTheWayButton,
                currentDelivery.status === 'on_the_way' && styles.activeButton,
                updatingStatus === 'on_the_way' && styles.updatingButton
              ]}
              onPress={() => updateDeliveryStatus('on_the_way')}
              disabled={updatingStatus !== '' || currentDelivery.status === 'delivered' || currentDelivery.is_completed}
            >
              {updatingStatus === 'on_the_way' ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.actionButtonText}>
                  🚚 Mark On The Way
                </Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.actionButton,
                styles.deliveredButton,
                currentDelivery.status === 'delivered' && styles.activeButton,
                updatingStatus === 'delivered' && styles.updatingButton
              ]}
              onPress={() => updateDeliveryStatus('delivered')}
              disabled={updatingStatus !== '' || currentDelivery.is_completed}
            >
              {updatingStatus === 'delivered' ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.actionButtonText}>
                  ✅ Mark Delivered
                </Text>
              )}
            </TouchableOpacity>
          </View>

          Complete Button - Only show when order is delivered but not completed
          {currentDelivery.status === 'delivered' && !currentDelivery.is_completed && (
            <View style={styles.completeButtonContainer}>
              <TouchableOpacity
                style={[styles.completeButtonFull, styles.completeButton]}
                onPress={completeOrder}
              >
                <Text style={styles.completeButtonText}>✅ Complete Order</Text>
              </TouchableOpacity>
            </View>
          )}

          Completed Status Message
          {currentDelivery.is_completed && (
            <View style={styles.completedContainer}>
              <Text style={styles.completedIcon}>✅</Text>
              <Text style={styles.completedText}>Order Completed!</Text>
              <Text style={styles.completedSubtext}>This order has been removed from your delivery list.</Text>
            </View>
          )}

          {/* OTP Verification Modal */}
          <Modal
            visible={showOtpModal}
            transparent={true}
            animationType="slide"
            onRequestClose={() => {
              if (currentOtp) {
                setShowOtpModal(false);
                setOtpInput('');
              }
            }}
          >
            <View style={styles.modalOverlay}>
              <View style={styles.modalContent}>
                <Text style={styles.modalTitle}>
                  {currentDelivery?.delivery_otp_verified ? 'Complete Order' : '🔐 Delivery Verification'}
                </Text>
                
                {currentDelivery?.delivery_otp_verified ? (
                  // Already verified, show completion confirmation
                  <>
                    <Text style={styles.modalMessage}>
                      OTP has been verified. Confirm order completion?
                    </Text>
                    <View style={styles.modalButtonRow}>
                      <TouchableOpacity
                        style={[styles.modalButton, styles.modalButtonCancel]}
                        onPress={() => {
                          setShowOtpModal(false);
                          setOtpInput('');
                        }}
                      >
                        <Text style={styles.modalButtonText}>Cancel</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[styles.modalButton, styles.modalButtonConfirm]}
                        onPress={completeOrderWithoutPrompt}
                      >
                        <Text style={styles.modalButtonText}>Complete</Text>
                      </TouchableOpacity>
                    </View>
                  </>
                ) : currentOtp ? (
                  // Show OTP and verification input
                  <>
                    <Text style={styles.modalMessage}>
                      Share this OTP with the customer:
                    </Text>
                    <View style={styles.otpDisplayContainer}>
                      <Text style={styles.otpDisplay}>{currentOtp}</Text>
                    </View>
                    <Text style={styles.modalSubMessage}>
                      Ask the customer for the OTP and enter it below:
                    </Text>
                    <TextInput
                      style={styles.otpInput}
                      value={otpInput}
                      onChangeText={setOtpInput}
                      placeholder="Enter 6-digit OTP"
                      keyboardType="number-pad"
                      maxLength={6}
                      selectTextOnFocus
                    />
                    <View style={styles.modalButtonRow}>
                      <TouchableOpacity
                        style={[styles.modalButton, styles.modalButtonCancel]}
                        onPress={() => {
                          setShowOtpModal(false);
                          setOtpInput('');
                        }}
                      >
                        <Text style={styles.modalButtonText}>Cancel</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[styles.modalButton, styles.modalButtonConfirm]}
                        onPress={verifyOtpAndComplete}
                        disabled={otpInput.length !== 6}
                      >
                        <Text style={[
                          styles.modalButtonText,
                          otpInput.length !== 6 && styles.modalButtonTextDisabled
                        ]}>
                          Verify & Complete
                        </Text>
                      </TouchableOpacity>
                    </View>
                  </>
                ) : (
                  // No OTP yet (shouldn't happen, but fallback)
                  <Text style={styles.modalMessage}>No OTP generated yet.</Text>
                )}
              </View>
            </View>
          </Modal>
        </View>
      </ScrollView>
    </SafeAreaView>
  </DrawerLayout>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  scrollView: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  scrollContent: {
    flexGrow: 1,
  },
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  backButtonContainer: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#f5f5f5',
    marginBottom: 10,
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
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
    color: '#666',
  },
  mapContainer: {
    height: 350,
  },
  locationButtonContainer: {
    backgroundColor: 'white',
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginBottom: 1,
    alignItems: 'center',
  },
  locationButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 12,
    width: '100%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  locationButtonActive: {
    backgroundColor: '#4CAF50',
  },
  locationButtonInactive: {
    backgroundColor: '#C41E26',
  },
  locationButtonIcon: {
    fontSize: 20,
    marginRight: 10,
  },
  locationButtonText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: 'white',
  },
  locationStatus: {
    fontSize: 13,
    color: '#4CAF50',
    marginTop: 8,
    fontWeight: '500',
  },
  locationPermissionWarning: {
    fontSize: 13,
    color: '#FF9800',
    marginTop: 8,
    fontWeight: '500',
  },
  infoContainer: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 20,
  },
  deliveryInfo: {
    backgroundColor: 'white',
    borderRadius: 8,
    padding: 16,
    marginBottom: 16,
  },
  orderId: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#C41E26',
    marginBottom: 16,
  },
  infoSection: {
    marginBottom: 16,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  infoSectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
  },
  customerName: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  infoDetail: {
    fontSize: 14,
    color: '#666',
    marginBottom: 4,
    lineHeight: 20,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  summaryLabel: {
    fontSize: 14,
    color: '#666',
  },
  summaryValue: {
    fontSize: 14,
    color: '#333',
    fontWeight: '500',
  },
  totalRow: {
    marginTop: 8,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
  },
  totalLabel: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
  },
  totalValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#C41E26',
  },
  statusValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#4CAF50',
    textTransform: 'capitalize',
  },
  actionButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 8,
  },
  actionButton: {
    flex: 1,
    paddingVertical: 14,
    paddingHorizontal: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  pickedUpButton: {
    backgroundColor: '#FF9800',
  },
  onTheWayButton: {
    backgroundColor: '#C41E26',
  },
  deliveredButton: {
    backgroundColor: '#4CAF50',
  },
  activeButton: {
    opacity: 0.7,
  },
  updatingButton: {
    opacity: 0.6,
  },
  actionButtonText: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 13,
    textAlign: 'center',
  },
  completeButton: {
    backgroundColor: '#2196F3',
  },
  completeButtonFull: {
    width: '100%',
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 8,
  },
  completeButtonContainer: {
    width: '100%',
    alignItems: 'center',
    marginTop: 8,
  },
  completeButtonText: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 16,
    textAlign: 'center',
  },
  completedContainer: {
    alignItems: 'center',
    paddingVertical: 16,
    marginTop: 8,
  },
  completedIcon: {
    fontSize: 32,
    marginBottom: 8,
  },
  completedText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#2196F3',
  },
  completedSubtext: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    marginTop: 4,
  },
  noDeliveryText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#666',
    textAlign: 'center',
    marginBottom: 8,
  },
  noDeliverySubtext: {
    fontSize: 14,
    color: '#999',
    textAlign: 'center',
  },
  // OTP Modal Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 24,
    width: '90%',
    maxWidth: 400,
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 16,
    textAlign: 'center',
  },
  modalMessage: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginBottom: 16,
  },
  modalSubMessage: {
    fontSize: 14,
    color: '#888',
    textAlign: 'center',
    marginBottom: 12,
  },
  otpDisplayContainer: {
    backgroundColor: '#f5f5f5',
    borderRadius: 12,
    padding: 20,
    alignItems: 'center',
    marginBottom: 16,
    borderWidth: 2,
    borderColor: '#C41E26',
  },
  otpDisplay: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#C41E26',
    letterSpacing: 8,
  },
  otpInput: {
    backgroundColor: '#f9f9f9',
    borderWidth: 2,
    borderColor: '#e0e0e0',
    borderRadius: 12,
    padding: 16,
    fontSize: 20,
    textAlign: 'center',
    letterSpacing: 6,
    marginBottom: 16,
    fontWeight: 'bold',
  },
  modalButtonRow: {
    flexDirection: 'row',
    gap: 12,
    justifyContent: 'flex-end',
  },
  modalButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center',
  },
  modalButtonCancel: {
    backgroundColor: '#f0f0f0',
  },
  modalButtonConfirm: {
    backgroundColor: '#4CAF50',
  },
  modalButtonText: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 16,
  },
  modalButtonTextDisabled: {
    color: '#ccc',
  },
});
