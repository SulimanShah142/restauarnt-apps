import React, { useState, useEffect, useRef, useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert, ScrollView, FlatList, ActivityIndicator, Modal, Linking, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useFocusEffect } from 'expo-router';
import * as Location from 'expo-location';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { deliveryService } from '@/lib/delivery-service';
import { supabase } from '@/lib/supabase';
import { getStoredDeliverySession, isDeliveryPersonAuthenticated } from '@/lib/delivery-auth';
import { useAuth } from '@/contexts/AuthContext';
import { useForceResetSync } from '@/contexts/DatabaseContext';
import {
  startBackgroundTracking,
  stopBackgroundTracking,
  isBackgroundTrackingEnabled
} from '@/lib/background-location';
import UnifiedMap from '@/components/UnifiedMap';
import DrawerLayout from '@/components/DrawerLayout';
import NotificationBanner from '@/components/NotificationBanner';
import UserSheet from '@/components/sheet/UserSheet';
import DatePicker from '@/components/DatePicker';
import { Ionicons } from '@expo/vector-icons';
import { getDeliverySettings } from '@/lib/delivery-calculator';

// Get delivery fee from app_settings using the same method as checkout.tsx
const getDeliveryFee = async (): Promise<number> => {
  try {
    
    const settings = await getDeliverySettings(supabase);
    
    
    return settings.constant_delivery_fee;
  } catch (error) {
    console.error('[Orders] ❌ Error fetching delivery fee:', error);
    return 50.0; // Default fallback
  }
};

export default function OrdersScreen() {
  const router = useRouter();
  const { session: authSession } = useAuth();
  const { forceResetSync } = useForceResetSync();

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [notification, setNotification] = useState<{
    visible: boolean;
    title: string;
    message: string;
    type: 'success' | 'error' | 'info' | 'warning' | 'assignment' | 'order';
  }>({ visible: false, title: '', message: '', type: 'info' });

  // Use custom delivery session (not Supabase auth)
  const [deliverySession, setDeliverySession] = useState<any>(null);
  const [isLoadingSession, setIsLoadingSession] = useState(true);
  const [showLocationDialog, setShowLocationDialog] = useState(false);
  const [locationEnabled, setLocationEnabled] = useState(true);
  const [driverLocation, setDriverLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const [locationPermissionDenied, setLocationPermissionDenied] = useState(false);
  const [deliveryFee, setDeliveryFee] = useState<number>(50);
  const [isResetting, setIsResetting] = useState(false);
  const [lastResetTime, setLastResetTime] = useState<string | null>(null);

  // Track seen orders for NEW badge
  const [seenOrderIds, setSeenOrderIds] = useState<Set<string>>(new Set());

  // Mark order as seen
  const markOrderAsSeen = (orderId: string) => {
    setSeenOrderIds(prev => new Set(prev).add(orderId));
  };

  // Check if order is new (not seen yet)
  const isNewOrder = (orderId: string, createdAt: string) => {
    if (seenOrderIds.has(orderId)) return false;
    // Consider order new if created within last 10 minutes
    const createdAtDate = new Date(createdAt);
    const now = new Date();
    const diffMinutes = (now.getTime() - createdAtDate.getTime()) / (1000 * 60);
    return diffMinutes < 10;
  };

  // Handle force reset
  const handleForceReset = async () => {
    Alert.alert(
      '⚠️ Force Reset & Sync',
      'This will:\n\n1. Delete ALL local data\n2. Clear sync history\n3. Re-download EVERYTHING from Supabase\n\nContinue?',
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: '✅ Yes, Reset',
          style: 'destructive',
          onPress: async () => {
            try {
              setIsResetting(true);

              await forceResetSync();

              setLastResetTime(new Date().toLocaleString());
              Alert.alert('✅ Success', 'Database refreshed!');
            } catch (error: any) {
              console.error('[Orders] ❌ Force reset failed:', error);
              Alert.alert('❌ Error', `Reset failed: ${error.message}`);
            } finally {
              setIsResetting(false);
            }
          },
        },
      ]
    );
  };

  // Check authentication on screen focus
  useFocusEffect(
    React.useCallback(() => {
      checkAuth();
    }, [])
  );

  const checkAuth = async () => {
    try {
      // First check if we have a stored session (fast, no network)
      const storedSession = await getStoredDeliverySession();

      if (!storedSession) {
        router.replace('/login');
        return;
      }

      // CRITICAL: Filter out the string "null" from session values
      const userId = (storedSession.user_id && storedSession.user_id !== 'null')
        ? storedSession.user_id
        : (storedSession.delivery_person_id && storedSession.delivery_person_id !== 'null')
        ? storedSession.delivery_person_id
        : null;

      if (!userId) {
        console.warn('[Orders] ⚠️ Invalid session with null user ID, clearing and redirecting to login');
        await AsyncStorage.removeItem('delivery_session');
        router.replace('/login');
        return;
      }

      // We have a valid session, set it immediately with sanitized values
      setDeliverySession({
        ...storedSession,
        user: {
          id: userId,
          email: storedSession.email,
          name: storedSession.name
        },
        user_id: userId,
        delivery_person_id: storedSession.delivery_person_id !== 'null' ? storedSession.delivery_person_id : null,
      });
      setIsLoadingSession(false);

      // Verify auth in background (non-blocking, fire-and-forget)
      isDeliveryPersonAuthenticated()
        .then((authenticated) => {
          if (!authenticated) {
            router.replace('/login');
          }
        })
        .catch((err) => {
          console.warn('[Orders] Auth verification failed:', err.message);
          // Don't redirect on network error, allow offline mode
        });
    } catch (error) {
      console.error('[Orders] Auth check error:', error);
      // On error, if we have a session, still allow access (offline mode)
      const storedSession = await getStoredDeliverySession();
      if (storedSession) {
        setDeliverySession(storedSession);
        setIsLoadingSession(false);
      } else {
        router.replace('/login');
      }
    }
  };

  // Fetch delivery fee from app_settings on mount
  useEffect(() => {
    const loadDeliveryFee = async () => {
      const fee = await getDeliveryFee();
      setDeliveryFee(fee);
    };
    loadDeliveryFee();
  }, []);

  // Load delivery session from local storage
  useEffect(() => {
    const loadSession = async () => {
      try {
        const storedSession = await getStoredDeliverySession();

        if (storedSession) {
          // Ensure user_id is set - fallback to delivery_person_id if missing
          // CRITICAL: filter out the string "null" and actual null values
          const userId = (storedSession.user_id && storedSession.user_id !== 'null')
            ? storedSession.user_id
            : (storedSession.delivery_person_id && storedSession.delivery_person_id !== 'null')
            ? storedSession.delivery_person_id
            : null;

          if (!userId) {
            console.warn('[Orders] ⚠️ No valid user ID in stored session, clearing session');
            // Clear invalid session
            await AsyncStorage.removeItem('delivery_session');
            setDeliverySession(null);
            setIsLoadingSession(false);
            return;
          }

          setDeliverySession({
            ...storedSession,
            user: {
              id: userId,
              email: storedSession.email,
              name: storedSession.name
            },
            user_id: userId,
            delivery_person_id: storedSession.delivery_person_id !== 'null' ? storedSession.delivery_person_id : null,
          });
        }
      } catch (error) {
        console.error('[Orders] Error loading session:', error);
      } finally {
        setIsLoadingSession(false);
      }
    };

    loadSession();
  }, []);

  const [orders, setOrders] = useState<any[]>([]);
  const [allOrders, setAllOrders] = useState<any[]>([]); // Store all orders for filtering
  const allOrdersRef = useRef<any[]>([]); // Ref to access latest allOrders in callbacks
  const [loading, setLoading] = useState(true);
  const [updatingStatus, setUpdatingStatus] = useState<{[key: string]: string}>({});
  const [selectedOrder, setSelectedOrder] = useState<any>(null);
  const [showMapModal, setShowMapModal] = useState(false);
  const [showUserSheet, setShowUserSheet] = useState(false);
  const [showOrderDetails, setShowOrderDetails] = useState(false);
  const [deliveryPersonImageUrl, setDeliveryPersonImageUrl] = useState<string | undefined>(undefined);
  const [deliveryPersonName, setDeliveryPersonName] = useState<string | undefined>(undefined);
  const [deliveryPersonPhone, setDeliveryPersonPhone] = useState<string | undefined>(undefined);
  const [deliveryPersons, setDeliveryPersons] = useState<any[]>([]);
  const [allOrdersForMap, setAllOrdersForMap] = useState<any[]>([]);

  // Memoize map coordinates to prevent infinite re-renders
  const mapRestaurantCoords = useMemo(() => {
    if (!selectedOrder?.restaurant_latitude || !selectedOrder?.restaurant_longitude) return undefined;
    return [Number(selectedOrder.restaurant_latitude), Number(selectedOrder.restaurant_longitude)] as [number, number];
  }, [selectedOrder?.restaurant_latitude, selectedOrder?.restaurant_longitude]);

  const mapDeliveryCoords = useMemo(() => {
    if (!selectedOrder?.delivery_latitude || !selectedOrder?.delivery_longitude) return undefined;
    const coords = [Number(selectedOrder.delivery_latitude), Number(selectedOrder.delivery_longitude)] as [number, number];
    return coords;
  }, [selectedOrder?.delivery_latitude, selectedOrder?.delivery_longitude]);

  const mapDriverCoords = useMemo(() => {
    if (!driverLocation?.latitude || !driverLocation?.longitude) return undefined;
    return [Number(driverLocation.latitude), Number(driverLocation.longitude)] as [number, number];
  }, [driverLocation?.latitude, driverLocation?.longitude]);

  // Memoize names with proper defaults to prevent undefined spreading
  const mapRestaurantName = useMemo(() => {
    return selectedOrder?.restaurant_name || 'Restaurant';
  }, [selectedOrder?.restaurant_name]);

  const mapUserName = useMemo(() => {
    return selectedOrder?.user_name || 'Customer';
  }, [selectedOrder?.user_name]);

  const mapAgentName = useMemo(() => {
    return selectedOrder?.agent_name || undefined;
  }, [selectedOrder?.agent_name]);
  
  // Date filtering state
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);

  // Check location permissions when component mounts and keep checking
  useEffect(() => {
    checkLocationPermission();

    // Keep checking location status every 3 seconds if not enabled
    const checkInterval = setInterval(() => {
      if (!locationEnabled) {
        checkLocationPermission();
      }
    }, 3000);

    return () => clearInterval(checkInterval);
  }, [locationEnabled]);

  // Track driver's current location and update to Supabase (foreground + background)
  useEffect(() => {
    let locationSubscription: any = null;
    let updateInterval: ReturnType<typeof setInterval> | null = null;
    let isMounted = true;

    const startLocationTracking = async () => {
      const deliveryPersonId = deliverySession?.delivery_person_id || deliverySession?.user?.id;

      if (!locationEnabled || !isMounted) {
        return;
      }

      if (!deliveryPersonId) {
        console.warn('[Location useEffect] ⚠️ No delivery_person_id, waiting...');
        return;
      }

      try {
        // Start BACKGROUND tracking - continues even when app is closed
        const backgroundStarted = await startBackgroundTracking();

        if (backgroundStarted) {
          console.warn('[Location] ⚠️ Background tracking failed, using foreground only');
        }

        // Get initial location with BEST accuracy (for immediate UI update)
        const currentLocation = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.BestForNavigation,
        });

        if (isMounted) {
          setDriverLocation({
            latitude: currentLocation.coords.latitude,
            longitude: currentLocation.coords.longitude,
          });

          // Update location to Supabase immediately
          await updateLocationToSupabase(currentLocation.coords.latitude, currentLocation.coords.longitude);
        }

        // Watch for location updates (foreground only, for UI updates)
        // Only update every 50 meters to avoid excessive re-renders
        locationSubscription = await Location.watchPositionAsync(
          {
            accuracy: Location.Accuracy.BestForNavigation,
            timeInterval: 5000, // Check every 5 seconds
            distanceInterval: 50, // Only update every 50 meters
          },
          async (location) => {
            if (isMounted) {
              setDriverLocation({
                latitude: location.coords.latitude,
                longitude: location.coords.longitude,
              });
              
              // ALSO update to Supabase database
              await updateLocationToSupabase(location.coords.latitude, location.coords.longitude);
            }
          }
        );

      } catch (error: any) {
        // Gracefully handle location errors
        if (error.message?.includes('location services are not enabled') || 
            error.message?.includes('location services are disabled') ||
            error.message?.includes('Current location is unavailable')) {
          console.warn('[Location] ⚠️ Location services disabled - enable location for delivery tracking');
          // Don't spam console, just warn once
        } else if (error.message?.includes('permission')) {
          console.warn('[Location] ⚠️ Location permission denied - please enable permissions');
        } else {
          console.error('[Location] ❌ Location error:', error.message);
        }
      }
    };

    startLocationTracking();

    // Cleanup on unmount - DON'T stop background tracking
    return () => {
      isMounted = false;

      // Clean up foreground subscription only
      // Background tracking continues even after component unmounts
      if (locationSubscription) {
        try {
          if (typeof locationSubscription.remove === 'function') {
            locationSubscription.remove();
          } else if (typeof locationSubscription.unsubscribe === 'function') {
            locationSubscription.unsubscribe();
          }
        } catch (error) {
          console.warn('[Location] Error cleaning up subscription:', error);
        }
        locationSubscription = null;
      }

      if (updateInterval) {
        clearInterval(updateInterval);
        updateInterval = null;
      }
    };
  }, [locationEnabled, deliverySession]);

  const checkLocationPermission = async () => {
    try {
      const { status } = await Location.getForegroundPermissionsAsync();

      if (status !== 'granted') {
        setShowLocationDialog(true);
        setLocationEnabled(false);
        setLocationPermissionDenied(true);
      } else {
        setLocationEnabled(true);
        setShowLocationDialog(false);
        setLocationPermissionDenied(false);
      }
    } catch (error) {
      console.error('[Location] Error checking permission:', error);
      setShowLocationDialog(true);
      setLocationEnabled(false);
      setLocationPermissionDenied(true);
    }
  };

  // Update delivery person's location to Supabase
  const updateLocationToSupabase = async (latitude: number, longitude: number) => {
    // Get delivery_person_id from session
    const deliveryPersonId = deliverySession?.delivery_person_id || deliverySession?.user?.id;
    
    if (!deliveryPersonId) {
      console.warn('[Location] ⚠️ No delivery_person_id, skipping update');
      return;
    }

    try {

      // Update location directly using delivery_person_id
      const { error } = await supabase
        .from('delivery_persons')
        .update({
          current_latitude: latitude,
          current_longitude: longitude,
          updated_at: new Date().toISOString()
        })
        .eq('id', deliveryPersonId);

      if (error) {
        console.error('[Location] ❌ Update error:', error);
      } else {
      }
    } catch (error) {
      console.error('[Location] ❌ Error updating location:', error);
    }
  };

  const enableLocation = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();

      if (status === 'granted') {
        setLocationEnabled(true);
        setShowLocationDialog(false);
        setLocationPermissionDenied(false);

        // Start background tracking
        const backgroundStarted = await startBackgroundTracking();
        if (backgroundStarted) {
          console.warn('[Location] ⚠️ Background tracking failed, using foreground only');
        }

        // Get and update location immediately with BEST accuracy
        const currentLocation = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.BestForNavigation, // Highest accuracy
          timeInterval: 1000,
          distanceInterval: 5,
        });
        setDriverLocation({
          latitude: currentLocation.coords.latitude,
          longitude: currentLocation.coords.longitude,
        });
        await updateLocationToSupabase(currentLocation.coords.latitude, currentLocation.coords.longitude);

        Alert.alert(
          '✅ Location Enabled',
          'Location tracking is now active in the background. Your location will be updated every 5 seconds even when the app is closed.',
          [{ text: 'OK' }]
        );
      } else {
        // User denied - keep showing the dialog and banner
        setShowLocationDialog(true);
        setLocationEnabled(false);
        setLocationPermissionDenied(true);
        Alert.alert(
          '⚠️ Location Required',
          'You CANNOT deliver without location access. Please enable location to continue.',
          [
            { text: 'Try Again', onPress: () => enableLocation() },
            { text: 'Open Settings', onPress: () => Linking.openSettings() }
          ]
        );
      }
    } catch (error) {
      console.error('[Location] Error enabling location:', error);
      setShowLocationDialog(true);
      setLocationEnabled(false);
      setLocationPermissionDenied(true);
    }
  };

  // STEP 1: Fetch delivery person from Supabase
  // STEP 2: Fetch assigned orders from Supabase with order_items
  const loadAssignedOrders = async (forceRefresh: boolean = false) => {

    try {
      // Get user ID from session with multiple fallbacks
      let userId = deliverySession?.user?.id || deliverySession?.user_id || deliverySession?.delivery_person_id || deliverySession?.id;

      // CRITICAL: Filter out the string "null" - causes "invalid input syntax for type uuid" error
      if (!userId || userId === 'null' || userId === 'undefined' || typeof userId !== 'string' || userId.trim() === '') {
        console.error('[Orders] ❌ ERROR: No valid user ID in session!');
        console.error('[Orders] userId value:', JSON.stringify(userId));
        console.error('[Orders] Session data:', JSON.stringify(deliverySession, null, 2));
        await AsyncStorage.removeItem('delivery_session');
        Alert.alert('Error', 'Not authenticated. Please login again.');
        router.replace('/login');
        return;
      }

      // Validate UUID format (basic check)
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      if (!uuidRegex.test(userId)) {
        console.error('[Orders] ❌ ERROR: userId is not a valid UUID:', userId);
        await AsyncStorage.removeItem('delivery_session');
        Alert.alert('Error', 'Invalid session. Please login again.');
        router.replace('/login');
        return;
      }

      // STEP 1: Get delivery person from Supabase with ALL fields including image

      const { data: byUserId, error: userIdError } = await supabase
        .from('delivery_persons')
        .select('id, user_id, name, email, phone, image_url, is_available')
        .eq('user_id', userId)
        .maybeSingle();

      let deliveryPersonFromSupabase = byUserId;

      if (!deliveryPersonFromSupabase) {
        const { data: byDpId, error: dpIdError } = await supabase
          .from('delivery_persons')
          .select('id, user_id, name, email, phone, image_url, is_available')
          .eq('id', userId)
          .maybeSingle();

        deliveryPersonFromSupabase = byDpId;
      }


      if (!deliveryPersonFromSupabase) {
        console.error('[Orders] ❌ ERROR: Delivery person not found!');
        Alert.alert('Error', 'Delivery person not found. Contact admin.');
        setLoading(false);
        return;
      }

      const deliveryPersonId = deliveryPersonFromSupabase.id;
      const deliveryPersonImageUrl = deliveryPersonFromSupabase.image_url || undefined;
      const deliveryPersonName = deliveryPersonFromSupabase.name || undefined;
      const deliveryPersonPhone = deliveryPersonFromSupabase.phone || undefined;
      setDeliveryPersonImageUrl(deliveryPersonImageUrl);
      setDeliveryPersonName(deliveryPersonName);
      setDeliveryPersonPhone(deliveryPersonPhone);

      // STEP 2: Fetch assigned orders from delivery_assignments with denormalized data
      console.log('[Orders] 🔍 Fetching assignments for delivery_person_id:', deliveryPersonId);
      const assignmentsResult = await supabase
        .from('delivery_assignments')
        .select('*')
        .eq('delivery_person_id', deliveryPersonId);

      console.log('[Orders] 📦 Assignments result:', JSON.stringify({
        hasError: !!assignmentsResult.error,
        error: assignmentsResult.error,
        count: assignmentsResult.data?.length || 0,
        data: assignmentsResult.data
      }, null, 2));

      if (assignmentsResult.error) {
        console.error('[Orders] Error fetching assignments:', assignmentsResult.error);
        throw assignmentsResult.error;
      }

      const assignments = assignmentsResult.data || [];

      // Log cancelled assignments specifically
      const cancelledAssignments = assignments.filter(a => a.status === 'cancelled');
      if (cancelledAssignments.length > 0) {
        console.log('[Orders] 🔴 CANCELLED assignments detected:', JSON.stringify(cancelledAssignments, null, 2));
      }

      if (assignments.length === 0) {
        console.warn('[Orders] ⚠️ No assignments found for this delivery person');
        setOrders([]);
        setAllOrders([]);
        allOrdersRef.current = [];
        setLoading(false);
        return;
      }

      // Get order IDs from assignments
      const assignmentOrderIds = assignments
        .map(a => a.order_id)
        .filter(id => id && id !== 'null' && id !== 'undefined' && typeof id === 'string' && id.length > 0);

      console.log('[Orders] 🔑 Assignment order IDs:', assignmentOrderIds);

      if (assignmentOrderIds.length === 0) {
        console.warn('[Orders] ⚠️ No valid order IDs in assignments');
        setOrders([]);
        setAllOrders([]);
        allOrdersRef.current = [];
        setLoading(false);
        return;
      }

      // Fetch orders WITHOUT joining restaurants table
      console.log('[Orders] 🔍 Fetching orders with IDs:', assignmentOrderIds);
      const result = await supabase
        .from('orders')
        .select(`
          id,
          order_number,
          status,
          total_amount,
          subtotal,
          delivery_cost,
          delivery_address,
          delivery_notes,
          delivery_lat,
          delivery_lng,
          restaurant_id,
          restaurant_name,
          restaurant_address,
          restaurant_phone,
          restaurant_latitude,
          restaurant_longitude,
          customer_name,
          customer_phone,
          user_id,
          is_completed,
          completed_at,
          created_at,
          updated_at,
          profiles (
            id,
            name,
            phone,
            email
          )
        `)
        .in('id', assignmentOrderIds)
        .order('created_at', { ascending: false });

      console.log('[Orders] 📦 Orders result:', JSON.stringify({
        hasError: !!result.error,
        error: result.error,
        count: result.data?.length || 0,
        data: result.data?.map(o => ({ id: o.id, order_number: o.order_number, status: o.status }))
      }, null, 2));

      // Build a map of assignment data for quick lookup
      const assignmentMap = new Map();
      assignments.forEach(a => assignmentMap.set(a.order_id, a));

      const viewData = (result.data || []).map((order: any) => {
        const assignment = assignmentMap.get(order.id);
        return {
          id: order.id,
          order_number: order.order_number || order.id,
          status: order.status,
          assignment_status: assignment?.status || 'assigned',
          customer_name: order.customer_name,
          customer_phone: order.customer_phone,
          user_name: order.customer_name || order.profiles?.name,
          user_phone: order.customer_phone || order.profiles?.phone,
          user_email: order.profiles?.email,
          delivery_address: order.delivery_address,
          delivery_lat: order.delivery_lat,
          delivery_lng: order.delivery_lng,
          delivery_notes: order.delivery_notes,
          total_amount: order.total_amount,
          subtotal: order.subtotal,
          delivery_cost: order.delivery_cost,
          delivery_fee: order.delivery_fee || order.delivery_cost || 0,
          restaurant_id: order.restaurant_id,
          restaurant_name: order.restaurant_name || assignment?.restaurant_id || 'Unknown Restaurant',
          restaurant_address: order.restaurant_address || 'No address',
          restaurant_phone: order.restaurant_phone || 'N/A',
          restaurant_lat: order.restaurant_latitude,
          restaurant_lng: order.restaurant_longitude,
          delivery_person_id: order.delivery_person_id,
          is_completed: order.is_completed,
          completed_at: order.completed_at,
          created_at: order.created_at,
          updated_at: order.updated_at
        };
      });


      if (result.error) {
        console.error('[Orders] ❌ Supabase error:', result.error);
        console.error('[Orders] Error details:', JSON.stringify(result.error, null, 2));
        throw result.error;
      }

      if (!viewData || viewData.length === 0) {
        setOrders([]);
        setAllOrders([]);
        allOrdersRef.current = [];
        setLoading(false);
        return;
      }

      // STEP 3: Fetch order items for each assigned order

      const orderIds = viewData.map((v: any) => v.id);

      const orderItemsResult = await supabase
        .from('order_items')
        .select('*')
        .in('order_id', orderIds)
        .order('created_at', { ascending: true });

      const orderItemsData = orderItemsResult.data;


      if (orderItemsResult.error) {
        console.error('[Orders] Order items error:', orderItemsResult.error);
      }

      // STEP 4: Transform orders data from delivery_assignments

      const transformedOrders = viewData.map((order: any) => {

        // Get items for this order - match order_id with order.id
        const orderItems = (orderItemsData || []).filter(item => {
          const match = String(item.order_id) === String(order.id);
          return match;
        });


        return {
          id: order.id,
          order_number: order.order_number || order.id.substring(0, 8),
          status: order.status || 'pending',
          delivery_person_id: deliveryPersonId,
          user_id: order.user_id || '',
          restaurant_id: order.restaurant_id || '',
          total_amount: parseFloat(String(order.total_amount)) || 0,
          subtotal: parseFloat(String(order.subtotal)) || parseFloat(String(order.total_amount)) || 0,
          delivery_cost: parseFloat(String(order.delivery_cost)) || 0,
          delivery_fee: parseFloat(String(order.delivery_fee || order.delivery_cost)) || 0, // Use actual fee from order
          delivery_address: order.delivery_address || 'No address provided',
          delivery_notes: order.delivery_notes || '',
          special_instructions: '',
          payment_method: 'Cash',
          payment_status: 'pending',
          is_completed: order.is_completed || false, // Include completion status
          completed_at: order.completed_at,
          // User info - use profiles.name as priority (from joined profiles table)
          user_name: order.profiles?.name || order.customer_name || order.user_name || 'Unknown Customer',
          user_phone: order.profiles?.phone || order.customer_phone || order.user_phone || 'N/A',
          user_email: order.profiles?.email || order.user_email || 'N/A',
          // Restaurant info - use restaurant_name/address/phone from view
          restaurant_name: order.restaurant_name || 'Unknown Restaurant',
          restaurant_address: order.restaurant_address || 'No address',
          restaurant_phone: order.restaurant_phone || 'N/A',
          // Restaurant coordinates - properly handle from view
          restaurant_latitude: order.restaurant_lat || order.restaurant_latitude || null,
          restaurant_longitude: order.restaurant_lng || order.restaurant_longitude || null,
          // Delivery coordinates
          delivery_latitude: order.delivery_lat || null,
          delivery_longitude: order.delivery_lng || null,
          deliveryStatus: order.status || 'pending',
          assignment_status: order.assignment_status || 'assigned',
          // Order items - display in UI
          items: orderItems.map((item: any) => ({
            id: item.id,
            name: item.menu_item_name || 'Unknown Item',
            description: item.menu_item_description || '',
            quantity: item.quantity || 1,
            price: parseFloat(String(item.price)) || 0,
            imageUrl: item.menu_item_image_url || item.image_url || null
          })),
          createdAt: order.created_at || new Date().toISOString(),
          created_at: order.created_at || new Date().toISOString(),
          updated_at: order.updated_at || new Date().toISOString()
        };
      });


      // Keep only active orders and drop any that are already delivered
      const activeOrders = transformedOrders.filter((order: any) => order.status !== 'delivered' && order.assignment_status !== 'cancelled');
      console.log('[Orders] 📊 Transformed orders:', transformedOrders.length, 'Total active:', activeOrders.length);
      console.log('[Orders] 📋 Active orders:', activeOrders.map(o => ({ id: o.id, order_number: o.order_number, status: o.status, assignment_status: o.assignment_status })));

      // Store only active orders in allOrders state and ref
      setAllOrders(activeOrders);
      allOrdersRef.current = activeOrders;

      // Filter active orders by selected date
      console.log('[Orders] 📅 Filtering by selected date:', selectedDate.toISOString());
      filterOrdersByDate(activeOrders, selectedDate);

      setLoading(false);
      console.log('[Orders] ✅ Loading complete. Orders state:', orders.length, 'items');

      // STEP 5: Set up real-time subscriptions

      const assignmentSubscription = await deliveryService.listenForNewAssignments(
        deliveryPersonId,
        (newAssignment) => {
          loadAssignedOrders();
        }
      );

      const updateSubscription = await deliveryService.listenForAssignmentUpdates(
        deliveryPersonId,
        (updatedAssignment) => {
          loadAssignedOrders();
        }
      );
    } catch (error: any) {
      console.error('========================================');
      console.error('[Orders] ❌ ERROR in loadAssignedOrders:', error);
      console.error('[Orders] Error message:', error.message);
      console.error('========================================');

      if (!error.message.includes('does not exist')) {
        Alert.alert('Error', 'Failed to load assigned orders: ' + error.message);
      }
      setOrders([]);
      setLoading(false);
    }
  };

  // Fetch all delivery persons for map display
  const fetchDeliveryPersons = async () => {
    try {
      const { data: deliveryPersonsData, error: deliveryPersonsError } = await supabase
        .from('delivery_persons')
        .select('*');

      if (deliveryPersonsError) {
        console.error('[Orders] ❌ Error fetching delivery persons:', deliveryPersonsError);
        setDeliveryPersons([]);
        return;
      }

      const transformedDeliveryPersons = (deliveryPersonsData || []).map((person: any) => ({
        id: person.id,
        name: person.name || 'Unknown',
        current_latitude: person.current_latitude,
        current_longitude: person.current_longitude,
        is_available: person.is_available,
        location: person.current_latitude && person.current_longitude ? {
          latitude: person.current_latitude,
          longitude: person.current_longitude
        } : undefined
      }));

      setDeliveryPersons(transformedDeliveryPersons);
    } catch (error) {
      console.error('[Orders] ❌ Error fetching delivery persons:', error);
      setDeliveryPersons([]);
    }
  };

  // Fetch all orders for map display (not just assigned ones)
  const fetchAllOrders = async () => {
    try {
      const { data: ordersData, error: ordersError } = await supabase
        .from('orders')
        .select(`
          id,
          order_number,
          status,
          total_amount,
          delivery_lat,
          delivery_lng,
          restaurant_latitude,
          restaurant_longitude,
          restaurant_name,
          customer_name,
          created_at,
          profiles (
            name
          )
        `)
        .order('created_at', { ascending: false });

      if (ordersError) {
        console.error('[Orders] ❌ Error fetching all orders:', ordersError);
        setAllOrdersForMap([]);
        return;
      }

      const today = new Date();
      const todayYear = today.getFullYear();
      const todayMonth = today.getMonth();
      const todayDay = today.getDate();

      const transformedAllOrders = (ordersData || [])
        .filter((order: any) => {
          if (!order.created_at) return false;
          const created = new Date(order.created_at);
          return order.status !== 'delivered' && order.status !== 'cancelled' &&
            created.getFullYear() === todayYear &&
            created.getMonth() === todayMonth &&
            created.getDate() === todayDay;
        })
        .map((order: any) => ({
          id: order.id,
          restaurant_latitude: order.restaurant_latitude,
          restaurant_longitude: order.restaurant_longitude,
          restaurant_name: order.restaurant_name,
          delivery_latitude: order.delivery_lat,
          delivery_longitude: order.delivery_lng,
          user_name: order.profiles?.name || order.customer_name || 'Customer'
        }));

      setAllOrdersForMap(transformedAllOrders);
    } catch (error) {
      console.error('[Orders] ❌ Error fetching all orders:', error);
      setAllOrdersForMap([]);
    }
  };

  useEffect(() => {

    // Don't run if still loading session
    if (isLoadingSession) {
      return;
    }

    // Don't run if no session
    if (!deliverySession) {
      setLoading(false);
      return;
    }

    const sessionUserId = deliverySession.user?.id || deliverySession.delivery_person_id;
    const deliveryPersonId = deliverySession.delivery_person_id;

    if (!sessionUserId) {
      setLoading(false);
      return;
    }

    // Load orders ONCE when session is ready
    // Note: Real-time updates now handled by OneSignal notifications
    loadAssignedOrders();
    fetchDeliveryPersons();
    fetchAllOrders();

    // No Supabase Realtime listeners - OneSignal handles notifications
  }, [deliverySession?.delivery_person_id]);

  // Filter orders by selected date (EXACTLY like admin orders.tsx)
  const filterOrdersByDate = (orders: any[], date: Date) => {
    // Get the selected date components in local time
    const selectedYear = date.getFullYear();
    const selectedMonth = date.getMonth();
    const selectedDay = date.getDate();


    const filtered = orders.filter((order, index) => {
      // Use created_at field (same as admin app uses createdAt)
      const orderCreatedAt = order.created_at;

      if (!orderCreatedAt) {
        return false;
      }

      // Parse the created_at date and get its components in local time
      const orderDate = new Date(orderCreatedAt);
      const orderYear = orderDate.getFullYear();
      const orderMonth = orderDate.getMonth();
      const orderDay = orderDate.getDate();

      // Log the first 3 orders for debugging
      if (index < 3) {
        console.log(`[Orders] 📅 Order ${index}: ${order.order_number}, created_at: ${orderCreatedAt}, parsed: orderDate=${orderYear}-${orderMonth}-${orderDay}, selected: ${selectedYear}-${selectedMonth}-${selectedDay}`);
      }

      // Compare year, month, and day (all in local timezone) - EXACTLY like admin app
      return orderYear === selectedYear && orderMonth === selectedMonth && orderDay === selectedDay;
    });

    console.log('[Orders] 📅 Date filter result: Input', orders.length, '-> Filtered:', filtered.length);
    setOrders(filtered);
  };

  // Handle date change from DatePicker (EXACTLY like admin orders.tsx)
  const handleDateChange = (newDate: Date) => {
    setSelectedDate(newDate);
    filterOrdersByDate(allOrders, newDate);
    setShowDatePicker(false);
  };

  // Check if today's orders should be shown (auto-refresh on day change - EXACTLY like admin orders.tsx)
  useEffect(() => {
    const checkDayChange = setInterval(() => {
      const today = new Date();
      const selectedYear = selectedDate.getFullYear();
      const selectedMonth = selectedDate.getMonth();
      const selectedDay = selectedDate.getDate();
      const todayYear = today.getFullYear();
      const todayMonth = today.getMonth();
      const todayDay = today.getDate();

      // If it's a new day and we're showing old data, switch to today
      if (todayYear !== selectedYear || todayMonth !== selectedMonth || todayDay !== selectedDay) {
        handleDateChange(today);
      }
    }, 60000); // Check every minute

    return () => clearInterval(checkDayChange);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedDate]);

  const updateOrderStatus = async (orderId: string, newStatus: string) => {

    // Verify order exists
    const orderExists = orders.some(o => o.id === orderId);
    if (!orderExists) {
      console.error('[Orders] Order not found in orders state!');
      Alert.alert('Error', 'Order not found. Please refresh the page.');
      return;
    }

    setUpdatingStatus(prev => ({ ...prev, [orderId]: newStatus }));

    try {
      // Get order details FIRST (synchronous, before any async operations)
      const orderDetails = orders.find(order => order.id === orderId);

      // OPTIMIZATION: Run independent operations in parallel
      const updatePromises: Promise<any>[] = [];

      // Step 1: Update delivery assignment status (if exists)
      const updateAssignment = async () => {
        try {
          const { data: assignmentData } = await supabase
            .from('delivery_assignments')
            .select('id')
            .eq('order_id', orderId)
            .single();

          if (assignmentData?.id) {
            await deliveryService.updateAssignmentStatus(assignmentData.id, newStatus);
          }
        } catch (assignmentError) {
          console.error('[Orders] Assignment update error:', assignmentError);
        }
      };
      updatePromises.push(updateAssignment());

      // Step 2: Update order status
      const updateOrder = deliveryService.updateDeliveryStatus(orderId, newStatus);
      updatePromises.push(updateOrder);

      // Step 3: Send notifications (in parallel, non-blocking)
      const sendNotifications = async () => {
        try {
          const { sendLocalNotification } = await import('@/lib/notification-service');

          if (newStatus === 'on_the_way' && orderDetails) {
            // Send via notifications table
            await supabase
              .from('notifications')
              .insert({
                user_id: orderDetails.user_id,
                title: 'Order Picked Up! 🚴',
                message: `Your order is on the way! The delivery person has picked up your order from ${orderDetails.restaurant_name || 'the restaurant'}.`,
                type: 'order_picked_up',
                order_id: orderId,
                is_read: false,
                created_at: new Date().toISOString()
              });

            // Send local notification (non-blocking)
            sendLocalNotification({
              title: '🚴 Order Picked Up!',
              body: 'Your order has been picked up and is on the way!',
              type: 'order',
              sound: true,
              badge: 1,
            }).catch(err => console.error('[Orders] Notification send error:', err));


            // Show banner to delivery person
            setNotification({
              visible: true,
              title: '✅ Order Picked Up!',
              message: 'Order is now on the way to customer',
              type: 'success',
            });

            // Notify admin (non-blocking)
            supabase
              .from('notifications')
              .insert({
                user_id: 'admin' as any,
                title: 'Order Picked Up',
                message: `Order #${orderId.substring(0, 8)} picked up by delivery`,
                type: 'order_update',
                order_id: orderId,
                is_read: false
              });
            
            // Ignore errors silently for admin notification
          }
        } catch (notifError) {
          console.error('[Orders] Notification error:', notifError);
        }
      };
      updatePromises.push(sendNotifications());

      // Wait for all updates to complete (with timeout)
      await Promise.allSettled(updatePromises);

      // Update local state directly instead of refreshing entire list
      setOrders(prevOrders =>
        prevOrders.map(order =>
          order.id === orderId
            ? { ...order, status: newStatus }
            : order
        )
      );
      
    } catch (error) {
      console.error('[Orders] ❌ ERROR in updateOrderStatus:', error);
      Alert.alert('Error', 'Failed to update order status: ' + (error instanceof Error ? error.message : String(error)));
    } finally {
      setUpdatingStatus(prev => {
        const newState = { ...prev };
        delete newState[orderId];
        return newState;
      });
    }
  };

  // Record delivery completion for stats
  const recordDeliveryCompletion = async (orderId: string, orderDetails: any) => {
    try {
      if (orderDetails && deliverySession?.user?.id) {
        const { deliveryStatsService } = await import('@/lib/delivery-stats-service');
        await deliveryStatsService.recordDeliveryCompletion({
          delivery_person_id: deliverySession.user.id,
          order_id: orderId,
          order_total_amount: orderDetails.total_amount || 0,
          delivery_fee: orderDetails.delivery_cost || 0,
          delivery_date: new Date().toISOString(),
          delivery_status: 'delivered',
          delivery_address: orderDetails.delivery_address || '',
          delivery_notes: orderDetails.delivery_notes || ''
        });
      } else {
        console.warn('[Orders] Order not found or delivery session missing, skipping stats recording:', orderId);
      }
    } catch (statsError: any) {
      console.error('[Orders] Error recording stats:', statsError);
      // Don't fail the entire operation if stats recording fails
    }
  };

  const showOrderMap = (order: any) => {
    // Fetch latest user location when viewing order map
    if (order.user_id && order.id) {
      fetchUserLocationForOrder(order.id, order.user_id);
    }
    setSelectedOrder(order);
    setShowMapModal(true);
  };

  // Fetch and save user location for an order
  const fetchUserLocationForOrder = async (orderId: string, userId: string) => {
    try {
      // Get user's last known location from profiles table
      const { data: userData, error: userError } = await supabase
        .from('profiles')
        .select('last_latitude, last_longitude')
        .eq('id', userId)
        .single();

      if (!userError && userData?.last_latitude && userData?.last_longitude) {
        // Update order with user location if not already set
        const { error: updateError } = await supabase
          .from('orders')
          .update({
            delivery_lat: userData.last_latitude,
            delivery_lng: userData.last_longitude
          })
          .eq('id', orderId);

        if (!updateError) {
          // Refresh the selected order with new location
          setSelectedOrder((prev: any) => prev ? {
            ...prev,
            delivery_latitude: userData.last_latitude,
            delivery_longitude: userData.last_longitude
          } : null);
        }
      }
    } catch (error) {
      console.error('[Orders] Error fetching user location:', error);
    }
  };

  const callCustomer = (phone: string) => {
    if (phone && phone !== 'N/A') {
      Linking.openURL(`tel:${phone}`);
    } else {
      Alert.alert('Phone Not Available', 'Customer phone number is not available');
    }
  };

  const completeOrder = async (orderId: string) => {
    try {
      // Update order to mark as completed
      const { data, error } = await supabase
        .from('orders')
        .update({
          is_completed: true,
          completed_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq('id', orderId)
        .select();

      if (error) throw error;

      // Update local state - mark order as completed instead of removing it
      setOrders(prevOrders =>
        prevOrders.map(order =>
          order.id === orderId
            ? { ...order, is_completed: true, completed_at: new Date().toISOString() }
            : order
        )
      );

      // Show success notification
      setNotification({
        visible: true,
        title: '✅ Order Completed!',
        message: 'Order has been marked as complete',
        type: 'success',
      });
    } catch (error) {
      console.error('[Orders] Error completing order:', error);
      Alert.alert('Error', 'Failed to complete order: ' + (error instanceof Error ? error.message : String(error)));
    }
  };

  const showOrderDetailsModal = (order: any) => {
    setSelectedOrder(order);
    setShowOrderDetails(true);
  };

  const getStatusColor = (status: string) => {
    switch(status) {
      case 'pending': return '#FFCC00'; // Yellow
      case 'confirmed': return '#C41E26'; // Red
      case 'preparing': return '#5856D6'; // Purple
      case 'ready': return '#FF9500'; // Orange
      case 'on_the_way': return '#FF9500'; // Orange
      case 'delivered': return '#4CD964'; // Green
      case 'cancelled': return '#C41E26'; // Red
      case 'rejected': return '#C41E26'; // Red
      default: return '#8E8E93'; // Gray
    }
  };

  const renderOrder = ({ item }: { item: any }) => {

    const isDelivered = item.status === 'delivered';
    const isCancelled = item.assignment_status === 'cancelled';
    const isNew = isNewOrder(item.id, item.created_at);

    // Debug log for cancelled detection
    console.log('[Orders renderOrder] Order:', item.id, 'Status:', item.status, 'Assignment Status:', item.assignment_status, 'Is Cancelled:', isCancelled);

    // Cancelled delivery orders - show with CANCELLED label
    if (isCancelled) {
      return (
        <TouchableOpacity
          style={[styles.orderCard, styles.cancelledOrderCard]}
          onPress={() => {
            showOrderDetailsModal(item);
          }}
        >
          <View style={styles.cancelledBadge}>
            <Text style={styles.cancelledBadgeText}>❌ DELIVERY CANCELLED</Text>
          </View>
          <View style={styles.deliveredOrderHeader}>
            <View style={styles.deliveredOrderLeft}>
              <Text style={styles.cancelledRestaurantName}>{item.restaurant_name || 'Restaurant'}</Text>
            </View>
          </View>
          <Text style={styles.cancelledMessage}>
            Admin has cancelled this delivery assignment
          </Text>
        </TouchableOpacity>
      );
    }

    // Minimized card for delivered orders (not yet completed)
    if (isDelivered && !item.is_completed) {
      return (
        <TouchableOpacity
          style={[styles.orderCard, styles.deliveredOrderCard]}
          onPress={() => {
            showOrderDetailsModal(item);
          }}
        >
          <View style={styles.deliveredOrderHeader}>
            <View style={styles.deliveredOrderLeft}>
              <View style={[styles.statusBadge, styles.deliveredStatusBadge]}>
                <Text style={styles.statusText}>✅ Delivered</Text>
              </View>
              <Text style={styles.deliveredRestaurantName}>{item.restaurant_name || 'Restaurant'}</Text>
            </View>
            <TouchableOpacity
              style={styles.completeButtonSmall}
              onPress={() => {
                completeOrder(item.id);
              }}
            >
              <Text style={styles.completeButtonTextSmall}>✅ Complete</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      );
    }

    // Completed orders - don't show (filtered out by loadAssignedOrders)
    if (isDelivered && item.is_completed) {
      return null;
    }

    // Full card for active orders (pending, confirmed, preparing, ready, on_the_way)
    return (
      <TouchableOpacity
        style={styles.orderCard}
        onPress={() => {
          showOrderDetailsModal(item);
        }}
      >
        {/* NEW Badge */}
        {isNew && (
          <View style={styles.newBadge}>
            <Text style={styles.newBadgeText}>NEW</Text>
          </View>
        )}

        <View style={styles.orderHeader}>
          <View style={[styles.statusBadge, { backgroundColor: getStatusColor(item.status) }]}>
            <Text style={styles.statusText}>
              {item.status?.replace('_', ' ').toUpperCase() || 'UNKNOWN'}
            </Text>
          </View>
        </View>

        <Text style={styles.restaurantName}>{item.restaurant_name || 'Unknown Restaurant'}</Text>

        {/* Order Items - Text Only on Card */}
        {item.items && item.items.length > 0 ? (
          <View style={styles.itemsContainer}>
            {item.items.slice(0, 3).map((orderItem: any, index: number) => (
              <View key={orderItem.id || index} style={styles.orderItemRow}>
                <Text style={styles.orderItemText}>{orderItem.quantity}x {orderItem.name}</Text>
              </View>
            ))}
            {item.items.length > 3 && (
              <Text style={styles.moreItemsText}>+ {item.items.length - 3} more items</Text>
            )}
          </View>
        ) : (
          <Text style={styles.noItemsText}>No items</Text>
        )}

        <Text style={styles.totalAmount}>Total: AFG {(item.total_amount || 0).toFixed(2)}</Text>
        <Text style={styles.deliveryAddress}>📍 {item.delivery_address}</Text>

        {/* Delivery Notes */}
        {item.delivery_notes && item.delivery_notes !== '' && (
          <View style={styles.deliveryNotesCard}>
            <Text style={styles.deliveryNotesLabel}>📝 Delivery Notes:</Text>
            <Text style={styles.deliveryNotesText}>{item.delivery_notes}</Text>
          </View>
        )}

        {/* Delivery Person Contact Info */}
        {deliveryPersonPhone && deliveryPersonPhone !== 'N/A' && (
          <View style={styles.customerPhoneRow}>
            <Ionicons name="call" size={20} color="#C41E26" />
            <Text style={styles.customerPhoneText}>🚴 {deliveryPersonName || 'Driver'}: {deliveryPersonPhone}</Text>
          </View>
        )}

        {/* Action Buttons - Delivery Person Flow */}
        <View style={styles.actionButtons}>
          {/* Map Button - Always show */}
          <TouchableOpacity
            style={[styles.actionButton, styles.mapButton]}
            onPress={() => {
              showOrderMap(item);
            }}
          >
            <Text style={styles.actionButtonText}>🗺️ Map</Text>
          </TouchableOpacity>

          {/* Pick Up Button - Always visible, enabled for pending/confirmed/preparing/ready orders */}
          {(item.status === 'pending' || item.status === 'confirmed' || item.status === 'preparing' || item.status === 'ready') ? (
            <TouchableOpacity
              style={[
                styles.actionButton,
                styles.pickupButton,
                (updatingStatus[item.id] === 'on_the_way') && styles.updatingButton
              ]}
              onPress={() => {
                updateOrderStatus(item.id, 'on_the_way');
              }}
              disabled={updatingStatus[item.id] === 'on_the_way'}
            >
              {updatingStatus[item.id] === 'on_the_way' ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Text style={styles.actionButtonText}>📦 Pick Up</Text>
              )}
            </TouchableOpacity>
          ) : item.status === 'on_the_way' || item.status === 'delivered' ? (
            <View style={[styles.actionButton, styles.pickedUpButton]}>
              <Text style={styles.actionButtonText}>✓ Picked</Text>
            </View>
          ) : (
            <View style={[styles.actionButton, styles.disabledButton]}>
              <Text style={[styles.actionButtonText, { color: '#ccc' }]}>📦 Pick Up</Text>
            </View>
          )}

          {/* Arrived Button - Always visible, enabled for on_the_way orders */}
          {item.status === 'on_the_way' ? (
            <TouchableOpacity
              style={[
                styles.actionButton,
                styles.deliverButton,
                (updatingStatus[item.id] === 'delivered') && styles.updatingButton
              ]}
              onPress={() => {
                updateOrderStatus(item.id, 'delivered');
              }}
              disabled={updatingStatus[item.id] === 'delivered'}
            >
              {updatingStatus[item.id] === 'delivered' ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Text style={styles.actionButtonText}>📍 Arrived</Text>
              )}
            </TouchableOpacity>
          ) : item.status === 'delivered' ? (
            <View style={[styles.actionButton, styles.deliveredButton]}>
              <Text style={styles.actionButtonText}>✅ Done</Text>
            </View>
          ) : (
            <View style={[styles.actionButton, styles.disabledButton]}>
              <Text style={[styles.actionButtonText, { color: '#ccc' }]}>📍 Arrived</Text>
            </View>
          )}

          {/* Complete Button - Only show when order is delivered and not completed */}
          {item.status === 'delivered' && !item.is_completed ? (
            <TouchableOpacity
              style={[styles.actionButton, styles.completeButton]}
              onPress={() => {
                completeOrder(item.id);
              }}
            >
              <Text style={styles.actionButtonText}>✅ Complete</Text>
            </TouchableOpacity>
          ) : item.status === 'delivered' && item.is_completed ? (
            <View style={[styles.actionButton, styles.completedButton]}>
              <Text style={styles.actionButtonText}>✓ Done</Text>
            </View>
          ) : null}
        </View>
      </TouchableOpacity>
    );
  };

  if (isLoadingSession || loading) {
    return (
      <DrawerLayout drawerOpen={drawerOpen} setDrawerOpen={setDrawerOpen}>
        <View style={styles.container}>
          <ActivityIndicator size="large" color="#C41E26" />
          <Text style={styles.loadingText}>Loading assigned orders...</Text>
        </View>
      </DrawerLayout>
    );
  }

  // Redirect to login if no session
  if (!deliverySession) {
    return (
      <DrawerLayout drawerOpen={drawerOpen} setDrawerOpen={setDrawerOpen}>
        <View style={styles.container}>
          <Text style={styles.loadingText}>Please login to view orders</Text>
          <TouchableOpacity
            style={styles.loginButton}
            onPress={() => router.push('/login' as any)}
          >
            <Text style={styles.loginButtonText}>Go to Login</Text>
          </TouchableOpacity>
        </View>
      </DrawerLayout>
    );
  }


  if (orders.length === 0) {
    return (
      <DrawerLayout drawerOpen={drawerOpen} setDrawerOpen={setDrawerOpen}>
        <View style={styles.container}>
          {/* Header with Date Picker */}
          <View style={styles.header}>
            <Text style={styles.headerTitle}>📦 My Orders</Text>
            <View style={styles.headerActions}>
              {/* Date Filter Button */}
              <TouchableOpacity
                style={styles.dateFilterButton}
                onPress={() => setShowDatePicker(true)}
              >
                <Text style={styles.dateFilterText}>📅 </Text>
                <Text style={styles.dateFilterValue}>
                  {selectedDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity onPress={() => loadAssignedOrders()} style={styles.refreshButton}>
                <Text style={styles.refreshButtonText}>🔄 Refresh</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Date Picker Modal */}
          <DatePicker
            visible={showDatePicker}
            selectedDate={selectedDate}
            onDateChange={handleDateChange}
            onClose={() => setShowDatePicker(false)}
          />

          {/* No Orders Message */}
          <View style={styles.noOrdersContainer}>
            <Text style={styles.noOrdersIcon}>📦</Text>
            <Text style={styles.noOrdersText}>No orders</Text>
            <Text style={styles.noOrdersSubtext}>
              {allOrdersRef.current.length === 0
                ? 'Please wait for the admin to assign you a delivery.'
                : 'No orders for the selected date.'
              }
            </Text>
          </View>
        </View>
      </DrawerLayout>
    );
  }

  return (
    <DrawerLayout drawerOpen={drawerOpen} setDrawerOpen={setDrawerOpen}>
      <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
        {/* Notification Banner */}
        <NotificationBanner
          visible={notification.visible}
          title={notification.title}
          message={notification.message}
          type={notification.type}
          onHide={() => setNotification({ ...notification, visible: false })}
        />

        <View style={styles.container}>
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerLeft}>
              <Text style={styles.headerTitle}>📦 My Orders</Text>
              {lastResetTime && (
                <Text style={styles.lastResetInfo}>Last reset: {lastResetTime}</Text>
              )}
            </View>
            <View style={styles.headerActions}>
              {/* Date Filter Button */}
              <TouchableOpacity
                style={styles.dateFilterButton}
                onPress={() => setShowDatePicker(true)}
              >
                <Text style={styles.dateFilterText}>📅 </Text>
                <Text style={styles.dateFilterValue}>
                {selectedDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity onPress={() => loadAssignedOrders()} style={styles.refreshButton}>
              <Text style={styles.refreshButtonText}>🔄 Refresh</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Orders count summary */}
        <View style={styles.summaryContainer}>
          <Text style={styles.summaryText}>
            📅 {selectedDate.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
          </Text>
          <Text style={[styles.summaryText, styles.summarySubtext]}>
            Showing {orders.length} orders
          </Text>
        </View>

        {/* Date Picker Modal */}
        <DatePicker
          visible={showDatePicker}
          selectedDate={selectedDate}
          onDateChange={handleDateChange}
          onClose={() => setShowDatePicker(false)}
        />

        {/* Persistent Location Warning Banner */}
        {!locationEnabled && (
          <View style={styles.locationWarningBanner}>
            <View style={styles.locationWarningContent}>
              <Text style={styles.locationWarningIcon}>⚠️</Text>
              <View style={styles.locationWarningTextContainer}>
                <Text style={styles.locationWarningTitle}>Location Required</Text>
                <Text style={styles.locationWarningMessage}>
                  Please enable location services to receive and complete deliveries.
                </Text>
              </View>
              <TouchableOpacity style={styles.locationWarningButton} onPress={enableLocation}>
                <Text style={styles.locationWarningButtonText}>Enable</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* Orders List */}
        <FlatList
          data={orders}
          renderItem={renderOrder}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.ordersList}
          showsVerticalScrollIndicator={false}
        />
        </View>

        {/* Location Dialog */}
        {showLocationDialog && (
          <Modal
            visible={true}
            transparent={true}
            animationType="fade"
            onRequestClose={() => {
              // Don't allow closing until location is enabled
              if (locationEnabled) {
                setShowLocationDialog(false);
              }
            }}
          >
            <View style={styles.modalOverlay}>
              <View style={styles.modalContent}>
                <Text style={styles.modalTitle}>⚠️ Location Required</Text>
                <Text style={styles.modalMessage}>
                  Location access is REQUIRED for delivery tracking. You cannot receive or complete deliveries without enabling location services.
                </Text>
                <View style={styles.warningBox}>
                  <Text style={styles.warningText}>
                    📍 Please enable location to continue
                  </Text>
                </View>
                <View style={styles.modalButtons}>
                  <TouchableOpacity
                    style={[styles.modalButton, styles.enableButton]}
                    onPress={enableLocation}
                  >
                    <Text style={styles.enableButtonText}>Enable Location</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          </Modal>
        )}

        {/* Map Modal */}
        {showMapModal && selectedOrder && (
          <Modal
            visible={true}
            animationType="slide"
            onRequestClose={() => setShowMapModal(false)}
          >
            <View style={styles.mapModalContainer}>
              <View style={styles.mapModalHeader}>
                <Text style={styles.mapModalTitle}>
                  {selectedOrder.restaurant_name} → {selectedOrder.user_name}
                </Text>
                <TouchableOpacity onPress={() => setShowMapModal(false)}>
                  <Text style={styles.mapModalClose}>✕</Text>
                </TouchableOpacity>
              </View>
              <UnifiedMap
                orderId={selectedOrder.id}
                role="DELIVER"
                restaurantName={mapRestaurantName}
                userName={mapUserName}
                agentName={deliveryPersonName}
                agentImageUrl={deliveryPersonImageUrl}
                restaurantCoords={mapRestaurantCoords}
                destinationCoords={mapDeliveryCoords}
                userCoords={mapDriverCoords}
                allOrders={allOrders}
                allDeliveryPersons={deliveryPersons}
              />
            </View>
          </Modal>
        )}

        {/* Order Details Modal (for all orders) */}
        {showOrderDetails && selectedOrder && (
          <Modal
            visible={true}
            animationType="slide"
            onRequestClose={() => setShowOrderDetails(false)}
          >
            <SafeAreaView style={styles.orderDetailsModalContainer}>
              {/* Header */}
              <View style={styles.orderDetailsHeader}>
                <View>
                  <Text style={styles.orderDetailsTitle}>Order Details</Text>
                  <Text style={styles.orderDetailsSubtitle}>
                    🍽️ {selectedOrder.restaurant_name || 'Restaurant'}
                  </Text>
                </View>
                <TouchableOpacity onPress={() => setShowOrderDetails(false)}>
                  <Text style={styles.orderDetailsClose}>✕</Text>
                </TouchableOpacity>
              </View>

              <ScrollView style={styles.orderDetailsContent}>
                {/* Status Badge */}
                <View style={styles.statusBadgeContainer}>
                  <View style={[styles.statusBadge, { backgroundColor: getStatusColor(selectedOrder.status) }]}>
                    <Text style={styles.statusBadgeText}>{selectedOrder.status?.replace('_', ' ').toUpperCase()}</Text>
                  </View>
                </View>

                {/* Map Section */}
                <View style={styles.mapSection}>
                  <Text style={styles.mapSectionTitle}>📍 Order Route</Text>
                  <View style={styles.mapContainer}>
                    <UnifiedMap
                      role="DELIVER"
                      orderId={selectedOrder.id}
                      restaurantName={mapRestaurantName}
                      userName={mapUserName}
                      agentName={deliveryPersonName}
                      agentImageUrl={deliveryPersonImageUrl}
                      restaurantCoords={mapRestaurantCoords}
                      destinationCoords={mapDeliveryCoords}
                      userCoords={mapDriverCoords}
                      allOrders={allOrders}
                      allDeliveryPersons={deliveryPersons}
                    />
                  </View>
                </View>

                {/* Restaurant Info */}
                <View style={styles.detailsSection}>
                  <Text style={styles.detailsSectionTitle}>🏪 Restaurant</Text>
                  <Text style={styles.detailsSectionValue}>{selectedOrder.restaurant_name}</Text>
                  {selectedOrder.restaurant_address && selectedOrder.restaurant_address !== 'No address' && (
                    <Text style={styles.detailsSectionAddress}>📍 {selectedOrder.restaurant_address}</Text>
                  )}
                </View>

                {/* Order Items with Images */}
                {selectedOrder.items && selectedOrder.items.length > 0 && (
                  <View style={styles.detailsSection}>
                    <Text style={styles.detailsSectionTitle}>📦 Order Items ({selectedOrder.items.length})</Text>
                    {selectedOrder.items.map((orderItem: any, idx: number) => (
                      <View key={orderItem.id || idx} style={styles.menuItemCard}>
                        {orderItem.imageUrl ? (
                          <Image source={{ uri: orderItem.imageUrl }} style={styles.menuItemImage} resizeMode="cover" />
                        ) : (
                          <View style={styles.menuItemImagePlaceholder}>
                            <Text style={styles.menuItemImagePlaceholderText}>🍽️</Text>
                          </View>
                        )}
                        <View style={styles.menuItemInfo}>
                          <Text style={styles.menuItemName}>{orderItem.name}</Text>
                          <Text style={styles.menuItemQuantity}>Qty: {orderItem.quantity}x</Text>
                          <Text style={styles.menuItemPrice}>
                            AFG {(orderItem.price * orderItem.quantity).toFixed(2)}
                          </Text>
                        </View>
                      </View>
                    ))}
                  </View>
                )}

                {/* Delivery Person Contact */}
                {deliveryPersonPhone && deliveryPersonPhone !== 'N/A' && (
                  <View style={styles.detailsSection}>
                    <Text style={styles.detailsSectionTitle}>🚴 Delivery Contact</Text>
                    <Text style={styles.detailsSectionValue}>{deliveryPersonName || 'Driver'}</Text>
                    <TouchableOpacity
                      style={styles.callButtonSmall}
                      onPress={() => Linking.openURL(`tel:${deliveryPersonPhone}`)}
                    >
                      <Text style={styles.callButtonTextSmall}>📞 {deliveryPersonPhone}</Text>
                    </TouchableOpacity>
                  </View>
                )}

                <View style={styles.detailsSection}>
                  <Text style={styles.detailsSectionTitle}>👤 Customer</Text>
                  <Text style={styles.detailsSectionValue}>{selectedOrder.user_name}</Text>
                  {selectedOrder.user_phone && selectedOrder.user_phone !== 'N/A' && (
                    <TouchableOpacity
                      style={styles.callButtonSmall}
                      onPress={() => callCustomer(selectedOrder.user_phone)}
                    >
                      <Text style={styles.callButtonTextSmall}>📞 {selectedOrder.user_phone}</Text>
                    </TouchableOpacity>
                  )}
                </View>

                <View style={styles.detailsSection}>
                  <Text style={styles.detailsSectionTitle}>📍 Delivery Address</Text>
                  <Text style={styles.detailsSectionAddress}>{selectedOrder.delivery_address}</Text>
                </View>

                {selectedOrder.delivery_notes ? (
                  <View style={styles.detailsSection}>
                    <Text style={styles.detailsSectionTitle}>📝 Delivery Notes</Text>
                    <Text style={styles.deliveryNotesText}>{selectedOrder.delivery_notes}</Text>
                  </View>
                ) : null}

                <View style={styles.financialSection}>
                  <Text style={styles.financialSectionTitle}>📊 Financial Summary</Text>

                  <View style={styles.financialRow}>
                    <Text style={styles.financialLabel}>Order Total:</Text>
                    <Text style={[styles.financialValue, styles.orderTotalValue]}>
                      AFG {(selectedOrder.total_amount || 0).toFixed(2)}
                    </Text>
                  </View>

                  <View style={styles.financialRow}>
                    <Text style={styles.financialLabel}>Delivery Fee:</Text>
                    <Text style={[styles.financialValue, styles.earningsValueSmall]}>
                      AFG {(selectedOrder.delivery_fee || 0).toFixed(2)}
                    </Text>
                  </View>

                  {selectedOrder.tip_amount && selectedOrder.tip_amount > 0 && (
                    <View style={styles.financialRow}>
                      <Text style={styles.financialLabel}>💰 Tip:</Text>
                      <Text style={[styles.financialValue, styles.tipValue]}>
                        AFG {selectedOrder.tip_amount.toFixed(2)}
                      </Text>
                    </View>
                  )}

                  <View style={[styles.financialRow, styles.totalEarningsRow]}>
                    <Text style={styles.totalEarningsLabel}>⭐ Total Earnings:</Text>
                    <Text style={[styles.financialValue, styles.totalEarningsValue]}>
                      AFG {((selectedOrder.delivery_fee || 0) + (selectedOrder.tip_amount || 0)).toFixed(2)}
                    </Text>
                  </View>
                </View>

                <View style={styles.detailsSection}>
                  <Text style={styles.detailsSectionTitle}>📅 Order Date</Text>
                  <Text style={styles.detailsSectionValue}>
                    {new Date(selectedOrder.created_at).toLocaleDateString()}{' '}
                    {new Date(selectedOrder.created_at).toLocaleTimeString()}
                  </Text>
                </View>
              </ScrollView>
            </SafeAreaView>
          </Modal>
        )}

        <UserSheet
          isVisible={showUserSheet}
          onClose={() => setShowUserSheet(false)}
        />
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
  loadingText: {
    marginTop: 10,
    fontSize: 16,
    color: '#666',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  headerLeft: {
    flex: 1,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  resetButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#C41E26',
    justifyContent: 'center',
    alignItems: 'center',
  },
  resetButtonDisabled: {
    backgroundColor: '#E57373',
  },
  lastResetInfo: {
    fontSize: 11,
    color: '#666',
    marginTop: 4,
  },
  dateFilterButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  dateFilterText: {
    fontSize: 16,
    marginRight: 4,
  },
  dateFilterValue: {
    fontSize: 13,
    fontWeight: '600',
    color: '#333',
  },
  summaryContainer: {
    marginHorizontal: 16,
    marginBottom: 10,
    paddingVertical: 6,
    paddingHorizontal: 10,
    backgroundColor: '#f0f0f0',
    borderRadius: 6,
  },
  summaryText: {
    fontSize: 13,
    color: '#666',
    fontWeight: '500',
  },
  summarySubtext: {
    fontSize: 12,
    marginTop: 4,
    opacity: 0.8,
  },
  refreshButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: '#f0f0f0',
    borderRadius: 6,
  },
  refreshButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#333',
  },
  locationWarningBanner: {
    backgroundColor: '#FFF3CD',
    borderBottomWidth: 1,
    borderBottomColor: '#FFC107',
    padding: 12,
  },
  locationWarningContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  locationWarningIcon: {
    fontSize: 24,
  },
  locationWarningTextContainer: {
    flex: 1,
  },
  locationWarningTitle: {
    fontSize: 15,
    fontWeight: 'bold',
    color: '#856404',
  },
  locationWarningMessage: {
    fontSize: 13,
    color: '#856404',
    marginTop: 2,
  },
  locationWarningButton: {
    backgroundColor: '#FFC107',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 6,
  },
  locationWarningButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#856404',
  },
  ordersList: {
    padding: 16,
  },
  orderCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    position: 'relative',
  },
  newBadge: {
    position: 'absolute',
    top: 10,
    right: 10,
    backgroundColor: '#FF3B30',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    zIndex: 10,
  },
  newBadgeText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  orderHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
    paddingRight: 50, // Make room for NEW badge on the right
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  statusText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
  },
  restaurantName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 12,
  },
  deliveredOrderCard: {
    backgroundColor: '#E8F5E9',  // Light green background
    padding: 12,
    paddingBottom: 12,
    marginBottom: 12,
    borderWidth: 2,
    borderColor: '#4CD964',  // Green border
    borderStyle: 'solid',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  deliveredOrderHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  deliveredOrderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 12,
  },
  deliveredStatusBadge: {
    backgroundColor: '#4CD964',  // Green
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  deliveredRestaurantName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
  },
  completeButtonSmall: {
    backgroundColor: '#4CAF50',  // Green
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    marginLeft: 12,
  },
  completeButtonTextSmall: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '600',
  },
  removeButtonSmall: {
    alignSelf: 'flex-end',
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: '#f5f5f5',
    borderRadius: 6,
  },
  removeButtonText: {
    color: '#666',
    fontSize: 12,
    fontWeight: '600',
  },
  orderStatus: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FF9800',
    backgroundColor: '#FFF3E0',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    alignSelf: 'flex-start',
    textTransform: 'capitalize',
  },
  orderDetails: {
    marginBottom: 12,
  },
  infoRow: {
    marginBottom: 8,
  },
  infoLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#888',
    marginBottom: 4,
  },
  infoValue: {
    fontSize: 15,
    fontWeight: '600',
    color: '#333',
  },
  restaurantAddress: {
    fontSize: 14,
    color: '#666',
    marginBottom: 12,
    marginLeft: 4,
  },
  itemsContainer: {
    backgroundColor: '#f8f9fa',
    padding: 12,
    borderRadius: 8,
    marginBottom: 12,
  },
  itemsLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#666',
    marginBottom: 8,
  },
  itemText: {
    fontSize: 14,
    color: '#333',
    marginBottom: 4,
    lineHeight: 20,
  },
  moreItemsText: {
    fontSize: 12,
    color: '#888',
    fontStyle: 'italic',
    marginTop: 4,
  },
  noItemsText: {
    fontSize: 14,
    color: '#999',
    fontStyle: 'italic',
    marginBottom: 12,
  },
  orderItemText: {
    fontSize: 14,
    color: '#333',
    fontWeight: '500',
  },
  customerPhoneRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8f8f8',
    padding: 10,
    borderRadius: 8,
    gap: 8,
  },
  customerPhoneText: {
    fontSize: 13,
    color: '#333',
    flex: 1,
  },
  totalAmount: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginTop: 8,
    marginBottom: 4,
  },
  deliveryAddress: {
    fontSize: 13,
    color: '#666',
    marginBottom: 12,
  },
  deliveryNotesCard: {
    backgroundColor: '#FFF9E6',
    padding: 12,
    borderRadius: 8,
    marginBottom: 12,
    borderLeftWidth: 3,
    borderLeftColor: '#FF9500',
  },
  deliveryNotesLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  detailsButton: {
    backgroundColor: '#5856D6',
  },
  customerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  customerInfoContainer: {
    backgroundColor: '#f8f8f8',
    padding: 12,
    borderRadius: 8,
    marginBottom: 12,
  },
  customerBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 10,
  },
  customerDetails: {
    flex: 1,
  },
  customerLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#888',
  },
  customerName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 2,
  },
  customerPhone: {
    fontSize: 13,
    color: '#666',
  },
  phoneText: {
    fontSize: 14,
    color: '#666',
    marginBottom: 12,
    marginLeft: 4,
  },
  callButton: {
    backgroundColor: '#4CAF50',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
  },
  callButtonDisabled: {
    backgroundColor: '#ccc',
  },
  callButtonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 13,
  },
  addressValue: {
    fontSize: 14,
    color: '#333',
    lineHeight: 20,
  },
  paymentRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  paymentLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#888',
  },
  paymentValue: {
    fontSize: 14,
    color: '#333',
    fontWeight: '500',
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  totalLabel: {
    fontSize: 14,
    color: '#666',
  },
  totalValue: {
    fontSize: 14,
    color: '#333',
    fontWeight: '500',
  },
  amountValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#C41E26',
  },
  earningsLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#2e7d32',
  },
  earningsValue: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#2e7d32',
  },
  actionButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 8,
  },
  actionButton: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 10,
    borderRadius: 8,
    alignItems: 'center',
  },
  mapButton: {
    backgroundColor: '#C41E26',
  },
  pickupButton: {
    backgroundColor: '#FF9800',
  },
  pickedUpButton: {
    backgroundColor: '#9E9E9E',
  },
  deliverButton: {
    backgroundColor: '#4CAF50',
  },
  deliveredButton: {
    backgroundColor: '#2E7D32',
  },
  completeButton: {
    backgroundColor: '#2196F3',
  },
  completedButton: {
    backgroundColor: '#9E9E9E',
  },
  disabledButton: {
    opacity: 0.5,
    backgroundColor: '#ccc',
  },
  updatingButton: {
    opacity: 0.7,
  },
  actionButtonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 13,
  },
  noOrdersContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  noOrdersIcon: {
    fontSize: 64,
    marginBottom: 16,
  },
  noOrdersText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#666',
    textAlign: 'center',
    marginBottom: 8,
  },
  noOrdersSubtext: {
    fontSize: 14,
    color: '#999',
    textAlign: 'center',
  },
  changeDateButton: {
    marginTop: 16,
    backgroundColor: '#C41E26',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  changeDateButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 20,
    width: '100%',
    maxWidth: 340,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 12,
    textAlign: 'center',
  },
  modalMessage: {
    fontSize: 15,
    color: '#666',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 20,
  },
  warningBox: {
    backgroundColor: '#fff3cd',
    borderLeftWidth: 4,
    borderLeftColor: '#ffc107',
    padding: 12,
    marginBottom: 20,
    borderRadius: 4,
  },
  warningText: {
    fontSize: 14,
    color: '#856404',
    textAlign: 'center',
    fontWeight: '600',
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 12,
  },
  modalButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  cancelButton: {
    backgroundColor: '#f0f0f0',
  },
  cancelButtonText: {
    color: '#666',
    fontWeight: '600',
    fontSize: 14,
  },
  enableButton: {
    backgroundColor: '#4CAF50',
  },
  enableButtonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 14,
  },
  mapModalContainer: {
    flex: 1,
    backgroundColor: '#fff',
  },
  mapModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  mapModalTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    flex: 1,
  },
  mapModalClose: {
    fontSize: 24,
    color: '#666',
    padding: 4,
  },
  // Order Details Modal Styles
  orderDetailsModalContainer: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  orderDetailsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  orderDetailsTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
  },
  orderDetailsSubtitle: {
    fontSize: 14,
    color: '#666',
    marginTop: 4,
  },
  orderDetailsClose: {
    fontSize: 24,
    color: '#666',
    padding: 4,
  },
  orderDetailsContent: {
    flex: 1,
    padding: 16,
  },
  statusBadgeContainer: {
    alignItems: 'center',
    marginBottom: 16,
  },
  deliveredBadge: {
    backgroundColor: '#4CAF50',
  },
  statusBadgeText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 14,
  },
  mapSection: {
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 8,
    marginBottom: 16,
  },
  mapSectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 12,
    textAlign: 'center',
  },
  mapContainer: {
    height: 250,
    borderRadius: 8,
    overflow: 'hidden',
  },
  detailsSection: {
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 8,
    marginBottom: 16,
  },
  detailsSectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#888',
    marginBottom: 8,
  },
  detailsSectionValue: {
    fontSize: 16,
    color: '#333',
    fontWeight: '500',
    marginBottom: 4,
  },
  detailsSectionAddress: {
    fontSize: 14,
    color: '#666',
    lineHeight: 20,
  },
  deliveryNotesText: {
    fontSize: 14,
    color: '#333',
    lineHeight: 20,
    fontStyle: 'italic',
  },
  orderItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  orderItemRowWithImage: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
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
    gap: 2,
  },
  orderItemQuantity: {
    fontSize: 14,
    fontWeight: '600',
    color: '#C41E26',
    width: 40,
  },
  orderItemName: {
    flex: 1,
    fontSize: 14,
    color: '#333',
  },
  orderItemPrice: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
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
  menuItemQuantity: {
    fontSize: 14,
    color: '#666',
    marginBottom: 4,
  },
  menuItemPrice: {
    fontSize: 15,
    fontWeight: 'bold',
    color: '#C41E26',
  },
  callButtonSmall: {
    backgroundColor: '#4CAF50',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 6,
    alignSelf: 'flex-start',
    marginTop: 8,
  },
  callButtonTextSmall: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 13,
  },
  financialSection: {
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 8,
    marginBottom: 16,
  },
  financialSectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 12,
  },
  financialRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
  },
  financialLabel: {
    fontSize: 14,
    color: '#666',
  },
  financialValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
  },
  orderTotalValue: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#C41E26',
  },
  earningsValueSmall: {
    fontSize: 14,
    fontWeight: '600',
    color: '#2e7d32',
  },
  tipValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FF9800',
  },
  totalEarningsRow: {
    marginTop: 8,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
  },
  totalEarningsLabel: {
    fontSize: 15,
    fontWeight: 'bold',
    color: '#1b5e20',
  },
  totalEarningsValue: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#2e7d32',
  },
  viewDetailsHint: {
    fontSize: 11,
    color: '#4CAF50',
    fontWeight: '500',
    marginTop: 4,
  },
  loginButton: {
    backgroundColor: '#C41E26',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
    marginTop: 20,
  },
  loginButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  // Cancelled delivery order styles
  cancelledOrderCard: {
    backgroundColor: '#FFF3E0',
    borderColor: '#FF5722',
    borderWidth: 2,
  },
  cancelledBadge: {
    backgroundColor: '#FF5722',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    alignSelf: 'flex-start',
    marginBottom: 8,
  },
  cancelledBadgeText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
  },
  cancelledRestaurantName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
  },
  cancelledMessage: {
    fontSize: 12,
    color: '#FF5722',
    fontStyle: 'italic',
    marginTop: 8,
    textAlign: 'center',
  },
});
