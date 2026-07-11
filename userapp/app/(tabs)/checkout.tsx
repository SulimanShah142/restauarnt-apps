import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert, ScrollView, TextInput, Image, Dimensions, Platform, KeyboardAvoidingView, Modal } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useCart , CartItem } from '../../contexts/CartContext';
import { supabase } from '../../lib/supabase';
import { Session } from '@supabase/supabase-js';
import { calculateDistance, calculateDeliveryTime, calculateDeliveryCost, getDeliverySettings } from '../../lib/delivery-calculator';
import { geocodeAddress } from '../../lib/GeocodingService';
import UnifiedMap from '../../components/UnifiedMap';
import NotificationBanner from '../../components/NotificationBanner';
import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';

// Type declarations for web globals
declare const window: any;
declare const navigator: any;

export default function CheckoutScreen() {
  const router = useRouter();
  const { cart, clearCart, getTotalPrice } = useCart();
  
  // Wait for cart context to be ready
  if (!cart) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.loadingContainer}>
          <Text>Loading checkout...</Text>
        </View>
      </SafeAreaView>
    );
  }
  
  const [session, setSession] = useState<Session | null>(null);
  const [isReady, setIsReady] = useState(false);
  const [userLocation, setUserLocation] = useState<[number, number] | null>(null);
  const [loading, setLoading] = useState(false);
  const [deliveryEstimates, setDeliveryEstimates] = useState<{
    distance: number;
    cost: number;
    minTime: number;
    maxTime: number;
  } | null>(null);
  const [deliverySettings, setDeliverySettings] = useState<{
    constant_delivery_fee: number;
    is_delivery_enabled: boolean;
    base_delivery_fee?: number;
    max_free_delivery_distance?: number;
    additional_fee_per_km_after_free?: number;
  } | null>(null);
const [savedAddresses, setSavedAddresses] = useState<any[]>([]);
const [loadingAddresses, setLoadingAddresses] = useState(false);
const [selectedAddressId, setSelectedAddressId] = useState<string | null>(null);
  // Notification state
  const [notification, setNotification] = useState<{
    visible: boolean;
    title: string;
    message: string;
    type: 'success' | 'error' | 'info' | 'warning' | 'order';
  }>({ visible: false, title: '', message: '', type: 'info' });

  const [showFullscreenMap, setShowFullscreenMap] = useState(false);

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

  // Form fields
  const [name, setName] = useState('');
  const [address, setAddress] = useState('');
  const [phone, setPhone] = useState('');
  const [notes, setNotes] = useState('');
  const [saveAddress, setSaveAddress] = useState(false);
  const [restaurantNames, setRestaurantNames] = useState<Record<string, string>>({});
  const [restaurantLocations, setRestaurantLocations] = useState<Record<string, { lat: number; lng: number }>>({});
  const [restaurantPrepTimes, setRestaurantPrepTimes] = useState<Record<string, number>>({});

  // Function to get restaurant name by ID
  const getRestaurantName = (cartItem: CartItem) => {
    const restaurantId = cartItem?.restaurantId ||
                        cartItem?.foodItem?.restaurantId;
    return restaurantNames[restaurantId] || restaurantId || 'Unknown Restaurant';
  };

  // Memoize map coordinates to prevent infinite re-renders
  const mapRestaurantCoords = useMemo(() => {
    if (!cart || !Array.isArray(cart) || cart.length === 0) {
      return undefined;
    }
    const restaurantId = cart[0]?.restaurantId || cart[0]?.foodItem?.restaurantId;
    if (!restaurantId) {
      return undefined;
    }
    if (!restaurantLocations[restaurantId]) {
      return undefined;
    }
    const loc = restaurantLocations[restaurantId];
    return [loc.lat, loc.lng] as [number, number];
  }, [cart?.[0]?.restaurantId, cart?.[0]?.foodItem?.restaurantId, restaurantLocations]);

  const mapUserCoords = useMemo(() => {
    return userLocation ?? undefined;
  }, [userLocation?.[0], userLocation?.[1]]);

  // Memoize restaurant name to prevent re-calculation on every keystroke
  const mapRestaurantName = useMemo(() => {
    if (!cart || !Array.isArray(cart) || cart.length === 0) return undefined;
    const restaurantId = cart[0]?.restaurantId || cart[0]?.foodItem?.restaurantId;
    if (!restaurantId) return undefined;
    return restaurantNames[restaurantId] ?? undefined;
  }, [cart?.[0]?.restaurantId, cart?.[0]?.foodItem?.restaurantId]);

  // Memoize user name to prevent re-calculation on every keystroke
  // DO NOT depend on form `name` state - only use session name to avoid map re-renders
  const mapUserName = useMemo(() => {
    return session?.user?.user_metadata?.name || session?.user?.user_metadata?.full_name || 'Customer';
  }, [session?.user?.user_metadata?.name, session?.user?.user_metadata?.full_name]);

  // Initialize user's location - fetch real location from device
  useEffect(() => {
    // Pre-populate form with user data if available
    if (session?.user) {
      const user = session.user;
      setName(user.user_metadata?.name || user.email?.split('@')[0] || '');
      setAddress(user.user_metadata?.address || '');
      setPhone(user.user_metadata?.phone || '');
    }

    // Fetch user's actual location from device
    const fetchUserLocation = async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        
        if (status !== 'granted') {
          // console.warn('[Checkout] Location permission denied, using default');
          setUserLocation([34.5281, 69.1761]); // Kabul as fallback [lat, lng]
          return;
        }

        const location = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        });

        // IMPORTANT: Leaflet expects [latitude, longitude] format
        const userCoords: [number, number] = [location.coords.latitude, location.coords.longitude];
        setUserLocation(userCoords);
      } catch (error) {
        // console.error('[Checkout] Error fetching location:', error);
        setUserLocation([34.5281, 69.1761]); // Kabul as fallback [lat, lng]
      }
    };

    fetchUserLocation();
  }, [session]);

  // Load delivery settings with connection check
  useEffect(() => {
    const loadSettings = async () => {
      try {
        // First check if we have cached settings
        const cachedSettings = await getDeliverySettings(supabase);
        if (cachedSettings && cachedSettings.constant_delivery_fee) {
          setDeliverySettings(cachedSettings);
          return;
        }

        // No cached data, check connection and fetch
        
        const { data: pingData, error: pingError } = await supabase
          .from('restaurants')
          .select('id')
          .limit(1)
          .maybeSingle();

        const isOnline = !pingError && pingData !== null;

        if (!isOnline) {
          // console.warn('[Checkout] ⚠️ Offline, using default settings');
          setDeliverySettings({
            constant_delivery_fee: 50.00,
            is_delivery_enabled: true
          });
          return;
        }

        // Online, fetch fresh settings
        const settings = await getDeliverySettings(supabase);
        setDeliverySettings(settings);

      } catch (error: any) {
        // console.error('[Checkout] ❌ Error loading delivery settings:', error.message);
        setDeliverySettings({
          constant_delivery_fee: 50.00,
          is_delivery_enabled: true
        });
      }
    };

    loadSettings();
  }, []);

  // Load restaurant names and locations when cart changes - CRITICAL for map
  useEffect(() => {

    if (!cart || !Array.isArray(cart) || cart.length === 0) {
      return;
    }

    const restaurantIds = [...new Set(cart.map(item => {
      const id = item?.restaurantId || item?.foodItem?.restaurantId;
      return id;
    }))].filter(Boolean) as string[];


    const fetchRestaurantData = async () => {
      const newNames: Record<string, string> = {};
      const newLocations: Record<string, { lat: number; lng: number }> = {};
      const newPrepTimes: Record<string, number> = {};

      // Check which restaurants we already have data for
      const missingIds = restaurantIds.filter(id => {
        const hasData = id && restaurantLocations[id] && restaurantNames[id];
        if (hasData) {
          return false;
        }
        return !hasData;
      });


      // If we have all data, skip fetching
      if (missingIds.length === 0) {
        return;
      }

      // Check network connectivity before attempting fetch
      const checkConnectionAndFetch = async () => {
        try {
          // Try a lightweight connectivity check
          const { data: pingData, error: pingError } = await supabase
            .from('restaurants')
            .select('id, name, address, latitude, longitude')
            .in('id', missingIds)
            .returns<any[]>();

          const isOnline = !pingError && pingData && pingData.length > 0;

          if (!isOnline) {
            // console.warn('[Checkout] ⚠️ No network connection, using cached data only');
            // Use whatever cached data we have
            return;
          }

          // We're online, process the fetched data

          if (pingData && pingData.length > 0) {
            for (const data of pingData) {
              newNames[data.id] = data.name || `Restaurant ${data.id}`;

              if (data.latitude && data.longitude) {
                // FIX: Database has latitude/longitude swapped - correct it here
                const lat = Number(data.longitude);  // Actually longitude in DB
                const lng = Number(data.latitude);   // Actually latitude in DB
                newLocations[data.id] = { lat, lng };
                // Get preparation time (default 30 min if not set)
                newPrepTimes[data.id] = data.estimated_preparation_time || 30;
                // Restaurant has address but no coordinates - geocode it
                try {
                  const geocoded = await geocodeAddress(data.address);
                  if (geocoded) {
                    newLocations[data.id] = { lat: geocoded.latitude, lng: geocoded.longitude };

                    // Update database with correct coordinates
                    await (supabase as any)
                      .from('restaurants')
                      .update({
                        latitude: geocoded.latitude,
                        longitude: geocoded.longitude
                      })
                      .eq('id', data.id);
                  }
                } catch (geoError) {
                  // console.warn(`[Checkout] ⚠️ Geocoding failed for restaurant ${data.id}:`, geoError);
                }
              } else {
                // console.warn('[Checkout] ⚠️ Restaurant missing coordinates and address:', data.id);
              }
            }
          }

          // Update state with fetched data
          if (Object.keys(newNames).length > 0) {
            setRestaurantNames(prev => {
              const updated = { ...prev, ...newNames };
              return updated;
            });
          }

          if (Object.keys(newLocations).length > 0) {
            setRestaurantLocations(prev => {
              const updated = { ...prev, ...newLocations };
              return updated;
            });
          }

          if (Object.keys(newPrepTimes).length > 0) {
            setRestaurantPrepTimes(prev => {
              const updated = { ...prev, ...newPrepTimes };
              return updated;
            });
          }

        } catch (checkError: any) {
          // console.error('[Checkout] ❌ Connection check failed:', checkError.message);
          // console.warn('[Checkout] ⚠️ Assuming offline, using cached data');
        }
      };

      await checkConnectionAndFetch();
    };

    fetchRestaurantData();
  }, [cart?.length]); // Only depend on length to avoid infinite loops

const loadSavedAddresses = async () => {
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) return;

    const { data, error } = await supabase
      .from("addresses")
      .select("*")
      .eq("user_id", user.id)
      .is("deleted_at", null)
      .order("is_default", { ascending: false })
      .order("created_at", { ascending: false });

    if (error) {
      console.log(error);
      return;
    }

    console.log("Loaded:", data);

    setSavedAddresses(data ?? []);

    const defaultAddress = data?.find(a => a.is_default);

    if (defaultAddress) {
      setSelectedAddressId(defaultAddress.id);
      setAddress(defaultAddress.street_address ?? "");
    }
  } catch (e) {
    console.log(e);
  }
};

useEffect(() => {
    loadSavedAddresses();
}, []);

  // Calculate delivery estimates when user location or restaurant location changes
  useEffect(() => {
    if (userLocation && cart && Array.isArray(cart) && cart.length > 0) {
      const restaurantId = cart[0]?.restaurantId ||
                          cart[0]?.foodItem?.restaurantId ||
                          null;

      if (restaurantId && restaurantLocations[restaurantId]) {
        const restaurantLoc = restaurantLocations[restaurantId];
        // userLocation is stored as [latitude, longitude] format
        const [userLat, userLng] = userLocation;

        const distance = calculateDistance(userLat, userLng, restaurantLoc.lat, restaurantLoc.lng);

        // Get restaurant preparation time (default 30 min if not available)
        const prepTime = restaurantPrepTimes[restaurantId] || 30;

        if (deliverySettings) {
          const deliveryCost = calculateDeliveryCost(
            distance,
            deliverySettings?.constant_delivery_fee || 0,
            deliverySettings?.base_delivery_fee || 0,
            deliverySettings?.max_free_delivery_distance || 0,
            deliverySettings?.additional_fee_per_km_after_free || 0
          );
          // Calculate delivery time including preparation time (20 km/h average speed)
          const deliveryTime = calculateDeliveryTime(distance, 20, 25, prepTime);

          setDeliveryEstimates({
            distance: parseFloat(distance.toFixed(2)),
            cost: parseFloat(deliveryCost.toFixed(2)),
            minTime: deliveryTime.minTime,
            maxTime: deliveryTime.maxTime
          });
        }
      }
    }
  }, [userLocation, restaurantLocations, cart, deliverySettings, restaurantPrepTimes]);

  // Function to request user's location when they interact with the map
  const getUserLocation = async () => {
    try {
      // Check if we're in a native environment where expo-location is available
      if (typeof window !== 'undefined' && window.navigator && window.navigator.product === 'ReactNative') {
        // Native environment - use expo-location
        const locationModule = await import('expo-location');

        // Request permission to access location
        const { status } = await locationModule.requestForegroundPermissionsAsync();

        if (status !== 'granted') {
          // console.error('Permission to access location was denied');
          // Fallback to a default location if permission is denied
          setUserLocation([-0.1276, 51.5072]); // London as default
          return;
        }

        // Get current position
        const location = await locationModule.getCurrentPositionAsync({
          accuracy: locationModule.LocationAccuracy.High,
        });

        // Set the user location as [latitude, longitude] (correct format for maps)
        setUserLocation([location.coords.latitude, location.coords.longitude]);
      } else {
        // Web environment - use browser geolocation API
        if (navigator.geolocation) {
          navigator.geolocation.getCurrentPosition(
            (position) => {
              // Success callback - set user location
              setUserLocation([position.coords.latitude, position.coords.longitude]);
            },
            (error) => {
              // Error callback - use default location
              // console.error('Error getting location from browser:', error.message);
              setUserLocation([-0.1276, 51.5072]); // London as default
            },
            {
              enableHighAccuracy: true,
              timeout: 60000, // 10 seconds
              maximumAge: 0 // 1 minute
            }
          );
        } else {
          // Geolocation not supported - use default location
          setUserLocation([-0.1276, 51.5072]); // London as default
        }
      }
    } catch (error) {
      // console.error('Error getting location:', error);
      // Fallback to a default location if geolocation fails
      setUserLocation([-0.1276, 51.5072]); // London as default
    }
  };

  const handlePlaceOrder = async () => {

    // 1. Explicitly fetch the session directly from Supabase to be sure
    const { data: { session: currentSession }, error: sessionError } = await supabase.auth.getSession();

    if (sessionError || !currentSession?.user) {
      // console.error('No session user found:', sessionError);
      Alert.alert('Error', 'You must be logged in to place an order');
      router.replace('/(auth)/sign-in');
      router.refresh()
      return;
    }

    const userId = currentSession.user.id;

    if (!cart || cart.length === 0) {
      Alert.alert('Error', 'Your cart is empty');
      return;
    }

    if (!name.trim() || !address.trim() || !phone.trim()) {
      Alert.alert('Error', 'Please fill in all required fields (name, address, phone)');
      return;
    }

    setLoading(true);

    try {
      let restaurantId: string | undefined = undefined;

      if (cart && Array.isArray(cart) && cart.length > 0) {
        // Get the first cart item to determine restaurant
        const firstItem = cart[0];
        restaurantId = firstItem?.restaurantId ||
                       firstItem?.foodItem?.restaurantId ||
                       undefined;
      }

      // Calculate total amount including delivery cost
      const subtotal = getTotalPrice();
      const deliveryCost = deliveryEstimates && deliverySettings?.is_delivery_enabled ? deliveryEstimates.cost : 0;
      const totalAmount = subtotal + deliveryCost;


      // Get restaurant name for the order
      let restaurantName = '';
      if (restaurantId) {
        try {
          const { data: restaurantData, error: restaurantError } = await supabase
            .from('restaurants')
            .select('name')
            .eq('id', restaurantId)
            .single() as any;

          if (restaurantData) {
            restaurantName = restaurantData.name || '';
          }
        } catch (error) {
          // console.error('Error fetching restaurant name:', error);
          // Use the name from cart as fallback
          if (cart && Array.isArray(cart) && cart.length > 0) {
            restaurantName = getRestaurantName(cart[0]) || '';
          }
        }
      }

      // Create order in database using the exact schema from final_unified_schema.sql
      const { error: orderError } = await supabase
        .from('orders')
        .insert([{
          user_id: userId,
          restaurant_id: restaurantId,
          restaurant_name: restaurantName,
          restaurant_latitude: restaurantLocations[restaurantId!]?.lat || null,
          restaurant_longitude: restaurantLocations[restaurantId!]?.lng || null,
          customer_name: name.trim(), // Add customer name
          customer_phone: phone.trim(), // Add customer phone
          subtotal: subtotal,
          delivery_cost: deliveryCost,
          total_amount: totalAmount,
          status: 'pending',
          delivery_address: address,
          delivery_notes: notes,
          delivery_lat: userLocation ? userLocation[0] : null, // latitude (index 0)
          delivery_lng: userLocation ? userLocation[1] : null, // longitude (index 1)
          estimated_delivery_time: deliveryEstimates ?
            new Date(Date.now() + Math.floor((deliveryEstimates.minTime + deliveryEstimates.maxTime) / 2) * 60000).toISOString()
            : null,
          payment_method: 'card', // default payment method
          payment_status: 'pending',
        }] as any);

      if (orderError) {
        // console.error('Order insertion error:', orderError);
        throw orderError;
      }

      // Fetch the created order separately to avoid .select() on insert
      const { data: orderData, error: fetchError } = await supabase
        .from('orders')
        .select()
        .eq('user_id', userId)
        .eq('status', 'pending')
        .order('created_at', { ascending: false })
        .limit(1)
        .single() as any;

      if (fetchError) {
        // console.error('Error fetching created order:', fetchError);
        throw fetchError;
      }

      // ============================================================
      // 📬 NOTIFICATIONS ARE NOW SENT VIA DATABASE TRIGGERS
      // No need to send from app - triggers handle it automatically
      // The notify_admins_new_order trigger will notify admin + user
      // ============================================================
      console.log('[Checkout] Order created - database triggers will send notifications');

      // If user wants to save the address for future use
      if (saveAddress) {
        try {
          // Check if an address with this street_address already exists
          const { data: existingAddress, error: existingError } = await supabase
            .from('addresses')
            .select('*')
            .eq('user_id', userId)
            .eq('street_address', address)
            .single() as any;

          if (existingError && existingError.code === 'PGRST116') { // Record not found
            // Create new address record - matching the actual addresses table schema
          const { data: existingAddress } = await supabase
  .from("addresses")
  .select("id")
  .eq("user_id", userId)
  .eq("street_address", address)
  .is("deleted_at", null)
  .maybeSingle();


if(!existingAddress){

  const { error: insertError } = await supabase
    .from("addresses")
    .insert([{
      user_id:userId,
      street_address:address.trim(),
      city:"Kabul",
      is_default:true
    }]);


  if(insertError){
    console.log(
      "[ADDRESS] Save error:",
      insertError
    );
  }

}

          } else if (existingError) {
            // console.error('Error checking/saving address:', existingError);
          }
        } catch (addrError: any) {
          // console.error('Error checking/saving address:', addrError);
        }
      }


      // ============================================================
      // 📦 ORDER ITEMS PROCESSING - DETAILED LOGGING
      // ============================================================

      // Log complete cart structure for debugging

      // Create order items after the order is created
      if (cart && Array.isArray(cart) && cart.length > 0) {

        // First, log a summary of what the user ordered
        cart.forEach((cartItem: CartItem, idx: number) => {
          const name = cartItem.foodItem?.name ?? (cartItem as any).name ?? (cartItem as any).item_name ?? 'Unknown';
          const itemId = cartItem.foodItem?.id ?? cartItem.id ?? 'MISSING!';
          const price = cartItem.foodItem?.price ?? (cartItem as any).price ?? 0;
          const quantity = cartItem.quantity ?? 1;
          const restaurantId = cartItem.foodItem?.restaurantId ?? cartItem.restaurantId ?? 'Unknown';
        });

        // Helper function to generate a proper UUID
        const generateUUID = () => {
          // Generate a proper UUID v4 format
          return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
            const r = Math.random() * 16 | 0;
            const v = c === 'x' ? r : (r & 0x3 | 0x8);
            return v.toString(16);
          });
        };

        const orderItemsToInsert = cart.map((cartItem: CartItem, index: number) => {
          // Handle different possible cart item structures

          // Properly extract values with fallbacks for flat structure from database
          const itemId = cartItem.foodItem?.id ?? cartItem.id ?? (cartItem as any).menu_item_id;
          const itemQuantity = cartItem.quantity ?? 1;
          const itemPrice = cartItem.foodItem?.price ?? (cartItem as any).price ?? 0;
          const itemName = cartItem.foodItem?.name ?? (cartItem as any).name ?? (cartItem as any).item_name ?? 'Unknown';
          const itemImage = cartItem.foodItem?.image ?? (cartItem as any).image ?? (cartItem as any).image_url ?? null;


          // Generate a proper UUID for each order item
          const orderItemId = generateUUID();


          // Validate required fields
          if (!itemId) {
            // console.error(`  ❌ Item ${index + 1} missing menu_item_id!`);
          }
          if (!itemPrice) {
            // console.warn(`  ⚠️  Item ${index + 1} has price 0!`);
          }

          return {
            id: orderItemId, // Generate proper UUID for order item
            order_id: orderData.id, // Link to the created order
            menu_item_id: itemId, // Use the food item ID
            quantity: itemQuantity, // Use the quantity from cart
            price: itemPrice, // Use the price from the item
            menu_item_name: itemName, // Store item name at time of order
            menu_item_image_url: itemImage, // Store item image at time of order
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          };
        });


        // Insert order items into the order_items table
        if (orderItemsToInsert.length > 0) {

          const { error: orderItemsError, data: orderItemsData, count } = await supabase
            .from('order_items')
            .insert(orderItemsToInsert as any)
            .select() as any;

          if (orderItemsError) {
            // console.error('❌ Error creating order items:', orderItemsError);
            // console.error('Order items error details:', {
            //   message: orderItemsError.message,
            //   details: orderItemsError.details,
            //   hint: orderItemsError.hint,
            //   code: orderItemsError.code
            // });

            // Log which items failed
            // console.error('Failed items:', orderItemsToInsert);

            // FALLBACK: Try inserting one item at a time
            const successfulInserts = [];
            for (const item of orderItemsToInsert) {
              try {
                const { data, error } = await supabase
                  .from('order_items')
                  .insert(item as any)
                  .select() as any;
                
                if (error) {
                  // console.error('Failed to insert item:', item, error);
                } else {
                  successfulInserts.push(data);
                }
              } catch (itemError) {
                // console.error('Exception inserting item:', item, itemError);
              }
            }
            

            // Log the error but don't fail the entire order
            Alert.alert(
              'Warning',
              `Order created. ${successfulInserts.length > 0 ? 'Items saved.' : 'Some items may not have been saved.'}`,
              [{ text: 'OK' }]
            );
          } else {
            // ============================================================
            // ✅ ORDER ITEMS SUCCESSFULLY INSERTED - DETAILED LOGGING
            // ============================================================


            orderItemsData?.forEach((insertedItem: any, idx: number) => {
              // console.log(`  Item ${idx + 1}: ${insertedItem.menu_item_name} x${insertedItem.quantity}`);
            });

            // Verify all items were inserted
            if (orderItemsData?.length !== orderItemsToInsert.length) {
              // console.warn(`⚠️  MISMATCH: Expected ${orderItemsToInsert.length} items, but got ${orderItemsData?.length}`);
            } else {
              // console.log('✅ All order items inserted successfully');
            }
          }
        }

        // Get unique restaurant IDs from all cart items
        const uniqueRestaurantIds = [...new Set(cart.map((item: any) =>
          item?.restaurantId ||
          item?.foodItem?.restaurantId ||
          (item?.item && item.item?.foodItem?.restaurantId)
        ).filter(Boolean))];


        // Clear cart for the first unique restaurant ID
        clearCart(uniqueRestaurantIds[0] || '');
      }

      // Navigate immediately to order status tracker (vendor response page)
      router.replace(`../order-status?orderId=${orderData.id}`); // Navigate to order status tracker immediately

      // Show in-app notification banner
      setNotification({
        visible: true,
        title: '✅ Order Placed Successfully!',
        message: `Your order from ${restaurantName} has been placed. Total: AFG ${totalAmount.toFixed(2)}`,
        type: 'success',
      });

      // NOTE: No local notification needed - database triggers will send OneSignal notifications
      // Admin app receives notifications via database triggers to OneSignal
      // This is more efficient and doesn't require local notification handling

      // Show success message without blocking navigation
      Alert.alert(
        'Success',
        `Order placed successfully!\nDelivery: ${deliveryEstimates?.distance}km, Est. time: ${deliveryEstimates?.minTime}-${deliveryEstimates?.maxTime} mins`,
        [
          {
            text: 'OK',
            onPress: () => {
              // Already navigated, nothing more needed
            },
          },
        ]
      );
    } catch (error: any) {
      // console.error('Error placing order:', error);
      // console.error('Error details:', {
      //   message: error.message,
      //   name: error.name,
      //   stack: error.stack
      // });
      Alert.alert('Error', `Failed to place order. Error: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.keyboardView}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 100 : 20}
    >
      <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
        {/* Back Button */}
        <View style={styles.backButtonContainer}>
          <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
            <Text style={styles.backButtonText}>← Back</Text>
          </TouchableOpacity>
        </View>

        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
        {/* Notification Banner */}
        <NotificationBanner
          visible={notification.visible}
          title={notification.title}
          message={notification.message}
          type={notification.type}
          onHide={() => setNotification({ ...notification, visible: false })}
        />

        {/* Show content - cart check */}
        {(!cart || !Array.isArray(cart) || cart.length === 0) ? (
          <View style={styles.emptyCartContainer}>
            <Text style={styles.emptyCartTitle}>🛒 Your Cart is Empty</Text>
            <Text style={styles.emptyCartMessage}>Add some delicious items to your cart before checking out!</Text>
            <TouchableOpacity style={styles.backToMenuButton} onPress={() => router.push('/(tabs)/menu')}>
              <Text style={styles.backToMenuButtonText}>← Back to Menu</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <>
            {/* Map Section */}
            <View style={styles.mapSectionTop}>
                {!userLocation && (
                  <TouchableOpacity
                    style={styles.enableLocationButtonTop}
                    onPress={getUserLocation}
                  >
                    <Text style={styles.enableLocationButtonText}>📍 Enable My Location to See Map</Text>
                  </TouchableOpacity>
                )}

                {userLocation && (
                  <>
                    <View style={styles.mapHeader}>
                      <Text style={styles.mapTitle}>🗺️ Delivery Locations</Text>
                      <TouchableOpacity
                        style={styles.reloadLocationButton}
                        onPress={getUserLocation}
                      >
                        <Text style={styles.reloadLocationButtonText}>🔄 Refresh</Text>
                      </TouchableOpacity>
                    </View>
                    <View style={styles.mapLegendContainer}>
                      <View style={styles.mapLegend}>
                        <View style={styles.legendItem}>
                          <View style={[styles.legendDot, styles.restaurantDot]} />
                          <Text style={styles.legendText}>
                            {(() => {
                              if (cart && Array.isArray(cart) && cart.length > 0) {
                                const restaurantId = cart[0]?.restaurantId || cart[0]?.foodItem?.restaurantId;
                                const restaurantName = restaurantId ? restaurantNames[restaurantId] : null;
                                if (restaurantName) {
                                  return `🏪 ${restaurantName}`;
                                }
                              }
                              return '🏪 Restaurant';
                            })()}
                          </Text>
                        </View>
                      </View>
                    </View>

                    <View style={styles.mapContainerBig}>
                      <View style={styles.mapHeader}>
                        <Text style={styles.mapHeaderTitle}>🗺️ Delivery Route</Text>
                        <TouchableOpacity onPress={() => setShowFullscreenMap(true)} style={styles.fullscreenMapBtn}>
                          <Ionicons name="expand" size={18} color="#fff" />
                          <Text style={styles.fullscreenMapBtnText}>Full Map</Text>
                        </TouchableOpacity>
                      </View>
                      <UnifiedMap
                        orderId={cart?.[0]?.id}
                        restaurantName={mapRestaurantName}
                        userName={mapUserName}
                        restaurantCoords={mapRestaurantCoords}
                        userCoords={mapUserCoords}
                        destinationCoords={mapUserCoords}
                        role="USER"
                      />
                    </View>
                  </>
                )}
              </View>

              Form Section
              <View style={styles.formContainer}>
          <Text style={styles.sectionTitle}>Delivery Information</Text>

          <View style={[styles.inputGroup, { zIndex: 10 }]}>
            <Text style={styles.label}>Full Name *</Text>
            <TextInput
              style={[styles.input, { zIndex: 5 }]}
              value={name}
              onChangeText={setName}
              placeholder="Enter your full name"
              placeholderTextColor="#999"
            />
          </View>

          <View style={[styles.inputGroup, { zIndex: 9 }]}>
            <Text style={styles.label}>Delivery Address *</Text>
            {savedAddresses.length > 0 && (
<View style={{marginBottom:12}}>

<Text style={styles.label}>
Saved Addresses
</Text>


{savedAddresses.map((item)=>(
<TouchableOpacity
key={item.id}
style={{
 padding:12,
 borderRadius:10,
 borderWidth:1,
 marginBottom:8,
 backgroundColor:
 selectedAddressId === item.id
 ? "#eee"
 : "#fff"
}}
onPress={()=>{

 setSelectedAddressId(item.id);

 setAddress(
   item.street_address || ""
 );

}}
>

<Text>
{item.street_address}
</Text>

<Text>
{item.city}
</Text>


</TouchableOpacity>
))}

</View>
)}
            <TextInput
              style={[styles.input, { zIndex: 5 }]}
              value={address}
              onChangeText={setAddress}
              placeholder="Enter delivery address"
              placeholderTextColor="#999"
            />
          </View>

          Save address for future use checkbox
          <View style={styles.checkboxContainer}>
            <TouchableOpacity
              style={styles.checkbox}
              onPress={() => setSaveAddress(!saveAddress)}
            >
              {saveAddress && <Text style={styles.checkboxIcon}>✓</Text>}
            </TouchableOpacity>
            <Text style={styles.checkboxLabel}>Save this address for future orders</Text>
          </View>

          <View style={[styles.inputGroup, { zIndex: 8 }]}>
            <Text style={styles.label}>Phone Number *</Text>
            <TextInput
              style={[styles.input, { zIndex: 5 }]}
              value={phone}
              onChangeText={setPhone}
              placeholder="Enter phone number"
              placeholderTextColor="#999"
              keyboardType="phone-pad"
            />
          </View>

          <View style={[styles.inputGroup, { zIndex: 7 }]}>
            <Text style={styles.label}>Delivery Notes</Text>
            <TextInput
              style={[styles.input, styles.textArea, { zIndex: 5 }]}
              value={notes}
              onChangeText={setNotes}
              placeholder="Any special instructions for delivery..."
              placeholderTextColor="#999"
              multiline
              numberOfLines={3}
            />
          </View>
        </View>

        Delivery Estimate
        {deliveryEstimates && deliverySettings?.is_delivery_enabled && (
          <View style={styles.deliveryEstimateContainer}>
            <Text style={styles.deliveryEstimateTitle}>Delivery Information</Text>
            <View style={styles.deliveryInfoRow}>
              <Text style={styles.deliveryInfoLabel}>Delivery Cost:</Text>
              <Text style={styles.deliveryInfoValue}>AFG {deliveryEstimates.cost.toFixed(2)}</Text>
            </View>
          </View>
        )}

      Order Summary with Delivery Cost
      <View style={styles.summaryContainer}>
        <Text style={styles.sectionTitle}>Order Summary</Text>

        {cart && Array.isArray(cart) && cart.length > 0 ? (
          <>
            Display restaurant information
            {cart[0] && (
              <View style={styles.restaurantInfoContainer}>
                <Text style={styles.restaurantInfoText}>
                  Order from: {getRestaurantName(cart[0])}
                </Text>
              </View>
            )}

            {cart.map((cartItem: CartItem, index) => {
              // Handle different possible cart item structures
              // Properly access nested foodItem properties with fallbacks
              const name = cartItem.foodItem?.name ?? (cartItem as any).name ?? (cartItem as any).item_name ?? 'Unnamed Item';
              const image = cartItem.foodItem?.image ?? (cartItem as any).image ?? (cartItem as any).image_url ?? '';
              const price = typeof (cartItem.foodItem?.price ?? (cartItem as any).price) === 'number'
                ? (cartItem.foodItem?.price ?? (cartItem as any).price)
                : 0;
              const quantity = typeof cartItem.quantity === 'number' ? cartItem.quantity : 1;
              const totalPrice = price * quantity;

              return (
                <View key={index} style={styles.menuItemCard}>
                  {/* Small thumbnail image on left */}
                  <Image
                    source={{
                      uri: image || 'https://placehold.co/60x60?text=No+Image'
                    }}
                    style={styles.menuItemThumbnail}
                    resizeMode="cover"
                  />
                  {/* Name and details next to image */}
                  <View style={styles.menuItemInfo}>
                    <Text style={styles.menuItemName}>{name}</Text>
                    <Text style={styles.menuItemDetails}>Qty: {quantity} × AFG {price.toFixed(2)} each</Text>
                    <Text style={styles.menuItemTotal}>Total: AFG {!isNaN(totalPrice) ? totalPrice.toFixed(2) : '0.00'}</Text>
                  </View>
                </View>
              );
            })}

            Delivery Cost
            {deliveryEstimates && deliverySettings?.is_delivery_enabled && (
              <View style={styles.itemRow}>
                <View style={styles.itemInfo}>
                  <Text style={styles.itemName}>Delivery Fee</Text>
                  <Text style={styles.itemDetails}>Fixed delivery fee</Text>
                </View>
                <Text style={styles.itemPrice}>AFG {deliveryEstimates.cost.toFixed(2)}</Text>
              </View>
            )}
          </>
        ) : (
          <View style={styles.emptyCartContainer}>
            <Text>No items in cart</Text>
          </View>
        )}

        <View style={styles.totalRow}>
          <Text style={styles.totalLabel}>Total:</Text>
          <Text style={styles.totalAmount}>
            AFG
            {(
              (cart && Array.isArray(cart) ?
                cart.reduce((sum, cartItem: CartItem) => {
                  const price = typeof (cartItem.foodItem?.price ?? (cartItem as any).price) === 'number'
                    ? (cartItem.foodItem?.price ?? (cartItem as any).price)
                    : 0;
                  const quantity = typeof cartItem.quantity === 'number' ? cartItem.quantity : 1;
                  return sum + (price * quantity);
                }, 0) : 0) +
              (deliveryEstimates && deliverySettings?.is_delivery_enabled ? deliveryEstimates.cost : 0)
            ).toFixed(2)}
          </Text>
        </View>
        </View>

      {/* Place Order Button */}
      <TouchableOpacity
        style={[styles.placeOrderButton, loading && styles.disabledButton]}
        onPress={handlePlaceOrder}
        disabled={loading}
        activeOpacity={0.7}
      >
        <Text style={styles.buttonText}>
          {loading ? 'Processing...' : `Place Order (AFG ${(
            (cart && Array.isArray(cart) ?
              cart.reduce((sum, cartItem: CartItem) => {
                const price = typeof (cartItem.foodItem?.price ?? (cartItem as any).price) === 'number'
                  ? (cartItem.foodItem?.price ?? (cartItem as any).price)
                  : 0;
                const quantity = typeof cartItem.quantity === 'number' ? cartItem.quantity : 1;
                return sum + (price * quantity);
              }, 0) : 0) +
            (deliveryEstimates && deliverySettings?.is_delivery_enabled ? deliveryEstimates.cost : 0)
          ).toFixed(2)})`}
        </Text>
      </TouchableOpacity>
    </>
  )}
        </ScrollView>

      {/* Full-Screen Map Modal */}
      <Modal
        visible={showFullscreenMap}
        animationType="slide"
        presentationStyle="fullScreen"
      >
        <View style={styles.fullscreenMapContainer}>
          <View style={styles.fullscreenMapHeader}>
            <Text style={styles.fullscreenMapTitle}>🗺️ Delivery Route</Text>
            <TouchableOpacity onPress={() => setShowFullscreenMap(false)} style={styles.closeMapButton}>
              <Ionicons name="close" size={24} color="#fff" />
            </TouchableOpacity>
          </View>
          <UnifiedMap
            orderId={cart?.[0]?.id}
            restaurantName={mapRestaurantName}
            userName={mapUserName}
            restaurantCoords={mapRestaurantCoords}
            userCoords={mapUserCoords}
            destinationCoords={mapUserCoords}
            role="USER"
          />
        </View>
      </Modal>
      </SafeAreaView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  keyboardView: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
    backgroundColor: '#F8F9FA', // Soft off-white with subtle gray shade
  },
  backButtonContainer: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: '#FFFFFF',
  },
  backButton: {
    width: 100,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  backButtonText: {
    color: '#C41E26', // AYAR Red - darker red
    fontSize: 16,
    fontWeight: 'bold',
  },
  scrollView: {
    flex: 1,
    backgroundColor: '#F8F9FA', // Soft off-white with subtle gray shade
  },
  scrollContent: {
    flexGrow: 1,  // Changed to 1 for proper keyboard behavior
    paddingBottom: 80,  // Increased from 40 to move button higher
  },
  emptyCartContainer: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 80,
    paddingHorizontal: 30,
    minHeight: 400,
  },
  mapSectionTop: {
    backgroundColor: '#fff',
    paddingBottom: 16,
    minHeight: 450,
    borderWidth: 2,
    borderColor: '#ccc',
  },
  mapContainerBig: {
    height: 380, // BIG map like admin orders details (fills upper portion)
    marginHorizontal: 12,
    marginTop: 12,
    marginBottom: 8,
    borderRadius: 10,
    overflow: 'hidden',
    backgroundColor: '#e0e0e0',
    zIndex: 1,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
  },
  mapHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 10,
    backgroundColor: '#C41E26',
  },
  mapHeaderTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#fff',
  },
  fullscreenMapBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
    gap: 4,
  },
  fullscreenMapBtnText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  fullscreenMapContainer: {
    flex: 1,
    backgroundColor: '#fff',
  },
  fullscreenMapHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 15,
    backgroundColor: '#C41E26',
  },
  fullscreenMapTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
  },
  closeMapButton: {
    padding: 8,
  },
  enableLocationButtonTop: {
    backgroundColor: '#C41E26', // AYAR Red - darker red
    marginHorizontal: 16,
    marginTop: 16,
    marginBottom: 12,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  enableLocationButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  mapHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 8,
  },
  mapLegendContainer: {
    paddingHorizontal: 16,
    paddingBottom: 8,
  },
  mapTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#333',
  },
  mapLegend: {
    flexDirection: 'column',
    alignItems: 'flex-start',
    gap: 8,
    paddingLeft: 0,
    width: '100%',
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  legendItemStack: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    alignSelf: 'flex-start',
  },
  legendDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    alignSelf: 'flex-start',
  },
  legendText: {
    fontSize: 12,
    color: '#f54242',
  },
  legendTextStack: {
    fontSize: 12,
    color: '#333',
    fontWeight: '500',
  },
  restaurantDot: {
    backgroundColor: '#663838',
  },
  userDot: {
    backgroundColor: '#4CAF50',
  },
  reloadLocationButton: {
    backgroundColor: '#C41E26',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 6,
  },
  reloadLocationButtonText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '600',
  },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 6,
    padding: 12,
    fontSize: 16,
    backgroundColor: '#f9f9f9',
  },
  textArea: {
    height: 80,
    textAlignVertical: 'top',
  },
  summaryContainer: {
    backgroundColor: 'white',
    marginHorizontal: 16,
    marginBottom: 12,
    padding: 16,
    borderRadius: 8,
  },
  itemRow: {
    flexDirection: 'row',
    justifyContent: 'flex-start',
    alignItems: 'center',
    marginBottom: 12,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  itemInfo: {
    flex: 1,
  },
  itemName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  itemDetails: {
    fontSize: 14,
    color: '#666',
    marginTop: 2,
  },
  itemPrice: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#C41E26',
    alignSelf: 'flex-start',
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#eee',
  },
  totalLabel: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  totalAmount: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#C41E26',
  },
  placeOrderButton: {
    backgroundColor: '#C41E26',
    marginHorizontal: 16,
    padding: 16,
    paddingBottom: 24,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 100, // Increased to 100px to avoid phone navigation overlap
  },
  disabledButton: {
    backgroundColor: '#ccc',
  },
  buttonText: {
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
  },
  emptyCartText: {
    textAlign: 'center',
    color: '#999',
    fontStyle: 'italic',
    paddingVertical: 20,
  },
  restaurantInfoContainer: {
    backgroundColor: '#f0f0f0',
    padding: 10,
    borderRadius: 6,
    marginBottom: 12,
  },
  restaurantInfoText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  deliveryEstimateContainer: {
    backgroundColor: 'white',
    marginHorizontal: 16,
    marginBottom: 20,
    padding: 16,
    borderRadius: 8,
  },
  deliveryEstimateTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 12,
    color: '#333',
    textAlign: 'center',
  },
  deliveryInfoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  deliveryInfoLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#555',
  },
  deliveryInfoValue: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#C41E26',
  },
  totalTimeRow: {
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
  },
  totalTimeLabel: {
    fontSize: 17,
    fontWeight: '700',
    color: '#333',
  },
  totalTimeValue: {
    fontSize: 17,
    fontWeight: '700',
    color: '#4CAF50',
  },
  itemImage: {
    width: 80,
    height: 80,
    borderRadius: 12,
    marginRight: 12,
  },
  emptyCartTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 16,
    textAlign: 'center',
  },
  emptyCartMessage: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginBottom: 30,
    lineHeight: 24,
  },
  backToMenuButton: {
    backgroundColor: '#C41E26',
    paddingHorizontal: 30,
    paddingVertical: 14,
    borderRadius: 8,
    marginTop: 20,
  },
  backToMenuButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
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
  menuItemInfo: {
    flex: 1,
  },
  menuItemName: {
    fontSize: 18,
    fontWeight: '700',
    color: '#333',
    marginBottom: 4,
  },
  menuItemDetails: {
    fontSize: 14,
    color: '#666',
    marginBottom: 6,
  },
  menuItemTotal: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#C41E26',
  },
  checkboxContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  checkbox: {
    width: 20,
    height: 20,
    borderWidth: 2,
    borderColor: '#C41E26',
    borderRadius: 3,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
    backgroundColor: '#fff',
  },
  checkboxIcon: {
    fontSize: 14,
    color: '#C41E26',
    fontWeight: 'bold',
  },
  checkboxLabel: {
    fontSize: 14,
    color: '#333',
  },
  formContainer: {
    backgroundColor: 'white',
    marginHorizontal: 16,
    marginTop: 16,
    marginBottom: 16,
    padding: 16,
    borderRadius: 8,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 12,
    color: '#333',
  },
  inputGroup: {
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 6,
    color: '#333',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
});