import React, { useState, useEffect, useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Image, ActivityIndicator, Linking, Modal } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { supabase } from '../lib/supabase';
import { Session } from '@supabase/supabase-js';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Spacing, Typography, BorderRadius, Shadow } from '../lib/design-system';
import UnifiedMap from '../components/UnifiedMap';
import { useDeliveryLocationListener } from '../hooks/useDeliveryLocationListener';
import * as Location from 'expo-location';

interface OrderItem {
  id?: string;
  name: string;
  quantity: number;
  price: number;
  image_url?: string;
  imageUrl?: string;
}

interface Order {
  id: string;
  orderNumber?: string;
  restaurantName: string;
  restaurantId?: string;
  restaurantLatitude?: number;
  restaurantLongitude?: number;
  status: string;
  totalAmount: number;
  deliveryAddress: string;
  deliveryPersonId?: string;
  deliveryPersonName?: string;
  items: OrderItem[];
  createdAt: string;
  updatedAt?: string;
  customerName?: string;
  customerPhone?: string;
  notes?: string;
  subtotal?: number;
  deliveryCost?: number;
  userLatitude?: number;
  userLongitude?: number;
  deliveryLatitude?: number;
  deliveryLongitude?: number;
  is_completed?: boolean;
  completed_at?: string;
  rejection_reason?: string;  // Added for rejection reason display
}

export default function OrderDetailsScreen() {
  const router = useRouter();
  const { orderId } = useLocalSearchParams<{ orderId: string }>();
  const [session, setSession] = useState<Session | null>(null);
  const [isReady, setIsReady] = useState(false);

  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deliveryPersonPhone, setDeliveryPersonPhone] = useState<string | null>(null);
  const [deliveryPersonImageUrl, setDeliveryPersonImageUrl] = useState<string | null>(null);
  const [userCurrentLocation, setUserCurrentLocation] = useState<[number, number] | null>(null);
  const [showFullscreenMap, setShowFullscreenMap] = useState(false);

  // Real-time delivery person location tracking
  const {
    deliveryLocation,
    isLoading: isLocationLoading,
    hasLocation,
  } = useDeliveryLocationListener({
    enabled: !!orderId && !!order?.deliveryPersonId && (order?.status === 'on_the_way' || order?.status === 'picked_up'),
    orderId: typeof orderId === 'string' ? orderId : undefined,
    deliveryPersonId: order?.deliveryPersonId || undefined,
  });

  // Memoize delivery person coords for map
  const deliveryPersonCoords = useMemo(() => {
    if (deliveryLocation) {
      return [deliveryLocation.latitude, deliveryLocation.longitude] as [number, number];
    }
    return null;
  }, [deliveryLocation?.latitude, deliveryLocation?.longitude]);

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

  // Fetch user's real-time GPS location
  useEffect(() => {
    const fetchUserLocation = async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();

        if (status !== 'granted') {
          console.warn('[OrderDetails] Location permission denied, using Kabul default');
          return;
        }

        const location = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.High,
        });

        const coords: [number, number] = [location.coords.latitude, location.coords.longitude];
        console.log('[OrderDetails] 📍 User GPS location fetched:', coords);
        console.log('[OrderDetails] 📍 Latitude:', location.coords.latitude, 'Longitude:', location.coords.longitude);
        console.log('[OrderDetails] 📍 GPS Accuracy:', location.coords.accuracy, 'meters');
        setUserCurrentLocation(coords);
      } catch (error) {
        console.error('[OrderDetails] Error fetching user location:', error);
        // Keep default Kabul location
      }
    };

    fetchUserLocation();
  }, []);

  useEffect(() => {
    if (orderId && session?.user?.id && isReady) {
      loadOrderDetails();
    }
  }, [orderId, session?.user?.id, isReady]);

  const loadOrderDetails = async () => {
    if (!orderId) {
      setError('No order ID provided');
      setLoading(false);
      return;
    }

    try {

      // Fetch order from Supabase (without items first)
      const { data: orderData, error: orderError } = await supabase
        .from('orders')
        .select(`
          *,
          restaurants (
            id,
            name,
            latitude,
            longitude
          ),
          delivery_persons (
            id,
            name
          )
        `)
        .eq('id', orderId)
        .single() as { data: any; error: any };

      if (orderError || !orderData) {
        // console.error('[OrderDetails] Error fetching order:', orderError?.message);
        setError('Failed to load order details');
        setLoading(false);
        return;
      }

      // Fetch order items separately
      let orderItems: any[] = [];
      const { data: itemsData, error: itemsError } = await supabase
        .from('order_items')
        .select('*')
        .eq('order_id', orderId);

      if (itemsError) {
        // console.error('[OrderDetails] Error fetching order items:', itemsError.message);
      } else {
        orderItems = itemsData || [];
      }

      // Transform order data to match expected format
      const transformedOrder: any = {
        id: orderData.id,
        orderNumber: orderData.order_number,
        restaurantName: orderData.restaurants?.name || 'Restaurant',
        restaurantId: orderData.restaurant_id,
        // Database coordinates are in correct [latitude, longitude] format
        restaurantLatitude: orderData.restaurants?.latitude,
        restaurantLongitude: orderData.restaurants?.longitude,
        status: orderData.status,
        totalAmount: orderData.total_amount,
        deliveryAddress: orderData.delivery_address || '',
        deliveryPersonId: orderData.delivery_person_id,
        deliveryPersonName: orderData.delivery_persons?.name,
        items: orderItems.map((item: any) => ({
          id: item.id,
          name: item.menu_item_name || item.name || 'Item',
          quantity: item.quantity,
          price: item.price,
          image_url: item.menu_item_image_url || item.image_url || item.imageUrl
        })),
        createdAt: orderData.created_at,
        updatedAt: orderData.updated_at,
        customerName: orderData.customer_name,
        customerPhone: orderData.customer_phone,
        notes: orderData.delivery_notes,
        subtotal: orderData.subtotal,
        deliveryCost: orderData.delivery_cost,
        userLatitude: orderData.user_lat,
        userLongitude: orderData.user_lng,
        deliveryLatitude: orderData.delivery_lat,
        deliveryLongitude: orderData.delivery_lng,
        is_completed: orderData.is_completed,
        completed_at: orderData.completed_at,
        rejection_reason: orderData.rejection_reason  // Added rejection reason
      };

      // DEBUG: Log coordinates to see what's being passed
      console.log('[OrderDetails] Raw DB restaurant coords:', {
        db_latitude: orderData.restaurants?.latitude,
        db_longitude: orderData.restaurants?.longitude
      });
      console.log('[OrderDetails] Transformed order restaurant coords:', {
        restaurantLatitude: transformedOrder.restaurantLatitude,
        restaurantLongitude: transformedOrder.restaurantLongitude
      });

      setOrder(transformedOrder);

      // Load delivery person phone if assigned
      if (orderData.delivery_person_id) {
        loadDeliveryPersonPhone(orderData.delivery_person_id);
      }

      setLoading(false);
    } catch (err: any) {
      // console.error('[OrderDetails] Error:', err.message);
      setError('Failed to load order details');
      setLoading(false);
    }
  };

  const loadDeliveryPersonPhone = async (deliveryPersonId: string) => {
    try {
      const { data, error } = await supabase
        .from('delivery_persons')
        .select('phone, image_url, users:user_id(phone)')
        .eq('id', deliveryPersonId)
        .single();

      if (error) {
        // console.error('[OrderDetails] Error fetching delivery person phone:', error.message);
        return;
      }

      const phone = (data as any)?.phone || (data as any)?.users?.phone;
      const imageUrl = (data as any)?.image_url;
      if (phone) {
        setDeliveryPersonPhone(phone);
      }
      if (imageUrl) {
        setDeliveryPersonImageUrl(imageUrl);
      }
    } catch (error: any) {
      // console.error('[OrderDetails] Error loading delivery person phone:', error.message);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'delivered':
        return '#4CAF50';
      case 'confirmed':
      case 'preparing':
      case 'ready':
        return '#2196F3';
      case 'on_the_way':
        return '#FF9800';
      case 'cancelled':
      case 'rejected':
        return '#C41E26';
      default:
        return '#FF9800';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'delivered':
        return 'checkmark-circle';
      case 'confirmed':
        return 'checkmark';
      case 'preparing':
        return 'flame';
      case 'ready':
        return 'bag-check';
      case 'on_the_way':
        return 'bicycle';
      case 'cancelled':
      case 'rejected':
        return 'close-circle';
      default:
        return 'time';
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      month: 'long',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const handleCallDelivery = () => {
    if (deliveryPersonPhone) {
      Linking.openURL(`tel:${deliveryPersonPhone}`);
    }
  };

  const handleContactSupport = () => {
    Linking.openURL('tel:+93700000000'); // Default support number
  };

  if (!isReady || loading) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={Colors.primary} />
          <Text style={styles.loadingText}>Loading order details...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (error || !order) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => {
              try {
                router.back();
              } catch (error) {
                console.error('[OrderDetails] Navigation error:', error);
              }
            }}
          >
            <Ionicons name="arrow-back" size={24} color={Colors.textPrimary} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Order Details</Text>
          <View style={styles.placeholder} />
        </View>
        <View style={styles.errorContainer}>
          <Ionicons name="alert-circle-outline" size={48} color={Colors.error} />
          <Text style={styles.errorText}>{error || 'Order not found'}</Text>
          <TouchableOpacity
            style={styles.retryButton}
            onPress={() => {
              try {
                router.back();
              } catch (error) {
                console.error('[OrderDetails] Navigation error:', error);
              }
            }}
          >
            <Text style={styles.retryButtonText}>Go Back</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => {
            try {
              router.back();
            } catch (error) {
              console.error('[OrderDetails] Navigation error:', error);
            }
          }}
        >
          <Ionicons name="arrow-back" size={24} color={Colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Order Details</Text>
        <View style={styles.placeholder} />
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Order Status Badge */}
        <View style={[styles.statusBadge, { backgroundColor: getStatusColor(order.status) + '20' }]}>
          <Ionicons
            name={getStatusIcon(order.status) as any}
            size={24}
            color={getStatusColor(order.status)}
          />
          <Text style={[styles.statusText, { color: getStatusColor(order.status) }]}>
            {order.status.charAt(0).toUpperCase() + order.status.slice(1).replace('_', ' ')}
          </Text>
        </View>

        {/* Rejection Reason - Show if order was rejected */}
        {order.status === 'rejected' && order.rejection_reason ? (
          <View style={styles.rejectionReasonCard}>
            <View style={styles.rejectionReasonHeader}>
              <Ionicons name="alert-circle" size={24} color="#C41E26" />
              <Text style={styles.rejectionReasonTitle}>Rejection Reason</Text>
            </View>
            <Text style={styles.rejectionReasonText}>{order.rejection_reason}</Text>
          </View>
        ) : null}

        {/* Order Number & Date */}
        <View style={styles.orderInfoCard}>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Restaurant:</Text>
            <Text style={styles.infoValue}>{order.restaurantName || 'N/A'}</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Placed On:</Text>
            <Text style={styles.infoValue}>{formatDate(order.createdAt)}</Text>
          </View>
          {order.completed_at && (
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Completed:</Text>
              <Text style={styles.infoValue}>{formatDate(order.completed_at)}</Text>
            </View>
          )}
        </View>

        {/* Restaurant Info */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Restaurant</Text>
          <View style={styles.card}>
            <Ionicons name="restaurant" size={24} color={Colors.primary} />
            <Text style={styles.cardText}>{order.restaurantName}</Text>
          </View>
        </View>

        {/* Order Items */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Order Items</Text>
          <View style={styles.card}>
            {order.items && order.items.length > 0 ? (
              order.items.map((item, index) => (
                <View key={index} style={styles.itemRow}>
                  <View style={styles.itemImageContainer}>
                    {item.image_url || item.imageUrl ? (
                      <Image
                        source={{ uri: item.image_url || item.imageUrl }}
                        style={styles.itemImage}
                      />
                    ) : (
                      <View style={styles.itemImagePlaceholder}>
                        <Ionicons name="fast-food" size={24} color={Colors.textSecondary} />
                      </View>
                    )}
                  </View>
                  <View style={styles.itemDetails}>
                    <Text style={styles.itemName}>{item.name}</Text>
                    <View style={styles.itemMeta}>
                      <Text style={styles.itemQuantity}>x{item.quantity}</Text>
                      <Text style={styles.itemPrice}>AFN {Number(item.price * item.quantity || 0).toFixed(2)}</Text>
                    </View>
                  </View>
                </View>
              ))
            ) : (
              <Text style={styles.noItemsText}>No items in this order</Text>
            )}
          </View>
        </View>

        {/* Pricing Breakdown */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Payment Details</Text>
          <View style={styles.card}>
            <View style={styles.pricingRow}>
              <Text style={styles.pricingLabel}>Subtotal:</Text>
              <Text style={styles.pricingValue}>AFN {Number(order.subtotal || 0).toFixed(2)}</Text>
            </View>
            <View style={styles.pricingRow}>
              <Text style={styles.pricingLabel}>Delivery Fee:</Text>
              <Text style={styles.pricingValue}>AFN {Number(order.deliveryCost || 0).toFixed(2)}</Text>
            </View>
            <View style={[styles.pricingRow, styles.totalRow]}>
              <Text style={[styles.pricingLabel, styles.totalLabel]}>Total:</Text>
              <Text style={[styles.pricingValue, styles.totalValue]}>AFN {Number(order.totalAmount || 0).toFixed(2)}</Text>
            </View>
          </View>
        </View>

        {/* Delivery Address */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Delivery Address</Text>
          <View style={styles.card}>
            <Ionicons name="location" size={24} color={Colors.error} />
            <Text style={styles.cardText}>{order.deliveryAddress}</Text>
          </View>
        </View>

        {/* Map View - Show restaurant, user location, and delivery person location */}
        {order && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Order Map</Text>
              <TouchableOpacity
                style={styles.fullscreenMapButton}
                onPress={() => setShowFullscreenMap(true)}
              >
                <Ionicons name="expand" size={18} color="#fff" />
                <Text style={styles.fullscreenMapButtonText}>Full Map</Text>
              </TouchableOpacity>
            </View>
            <View style={styles.mapContainer}>
              <UnifiedMap
                role="USER"
                orderId={order.id}
                // Restaurant location (pickup point)
                restaurantCoords={order.restaurantId ? (() => {
                  const coords: [number, number] = [order.restaurantLatitude || 34.5281, order.restaurantLongitude || 69.1761];
                  console.log('[OrderDetails] Map restaurant coords being passed:', coords);
                  return coords;
                })() : undefined}
                // Delivery destination (customer location) - enables route drawing
                userCoords={order.deliveryLatitude && order.deliveryLongitude
                  ? [order.deliveryLatitude, order.deliveryLongitude]
                  : (userCurrentLocation || [34.5281, 69.1761])}
                // Delivery destination - enables route drawing
                destinationCoords={order.deliveryLatitude && order.deliveryLongitude ? [order.deliveryLatitude, order.deliveryLongitude] : undefined}
                // Delivery person real-time location for driver marker
                deliveryPersonCoords={deliveryPersonCoords}
                // Delivery person info (show profile picture or bike icon)
                agentName={order.deliveryPersonName || undefined}
                agentImageUrl={deliveryPersonImageUrl || undefined}
              />
            </View>
            <View style={styles.mapLegend}>
              <View style={styles.legendItem}>
                <View style={[styles.legendDot, { backgroundColor: '#C41E26' }]} />
                <Text style={styles.legendText}>Restaurant</Text>
              </View>
              <View style={styles.legendItem}>
                <View style={[styles.legendDot, { backgroundColor: '#FF9800' }]} />
                <Text style={styles.legendText}>Delivery Driver</Text>
              </View>
              <View style={styles.legendItem}>
                <View style={[styles.legendDot, { backgroundColor: '#2196F3' }]} />
                <Text style={styles.legendText}>Delivery Location</Text>
              </View>
            </View>
          </View>
        )}

        {/* Delivery Person Info */}
        {order.deliveryPersonName && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Delivery Person</Text>
            <View style={styles.card}>
              <View style={styles.deliveryPersonRow}>
                <View style={styles.deliveryPersonInfo}>
                  <Ionicons name="bicycle" size={24} color={Colors.primary} />
                  <Text style={styles.deliveryPersonName}>{order.deliveryPersonName}</Text>
                </View>
                {deliveryPersonPhone && (
                  <TouchableOpacity style={styles.callButton} onPress={handleCallDelivery}>
                    <Ionicons name="call" size={20} color={Colors.primary} />
                    <Text style={styles.callButtonText}>Call</Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>
          </View>
        )}

        {/* Customer Info (if available) */}
        {order.customerName && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Customer Information</Text>
            <View style={styles.card}>
              <View style={styles.customerRow}>
                <Ionicons name="person" size={20} color={Colors.textSecondary} />
                <Text style={styles.customerName}>{order.customerName}</Text>
              </View>
              {order.customerPhone && (
                <View style={styles.customerRow}>
                  <Ionicons name="call" size={20} color={Colors.textSecondary} />
                  <TouchableOpacity onPress={() => Linking.openURL(`tel:${order.customerPhone}`)}>
                    <Text style={styles.customerPhone}>{order.customerPhone}</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>
          </View>
        )}

        {/* Notes (if any) */}
        {order.notes && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Order Notes</Text>
            <View style={styles.card}>
              <Ionicons name="document-text" size={20} color={Colors.textSecondary} />
              <Text style={styles.notesText}>{order.notes}</Text>
            </View>
          </View>
        )}

        {/* Action Buttons */}
        <View style={styles.actionsSection}>
          <TouchableOpacity
            style={styles.supportButton}
            onPress={handleContactSupport}
          >
            <Ionicons name="help-circle" size={20} color={Colors.white} />
            <Text style={styles.supportButtonText}>Contact Support</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.backButton2}
            onPress={() => {
              try {
                router.back();
              } catch (error) {
                console.error('[OrderDetails] Navigation error:', error);
              }
            }}
          >
            <Text style={styles.backButton2Text}>Back to Orders</Text>
          </TouchableOpacity>
        </View>

        {/* Bottom padding for scroll */}
        <View style={{ height: 40 }} />
      </ScrollView>

      {/* Full-Screen Map Modal */}
      <Modal
        visible={showFullscreenMap}
        animationType="slide"
        presentationStyle="fullScreen"
      >
        {order && (
          <View style={styles.fullscreenMapContainer}>
            <View style={styles.fullscreenMapHeader}>
              <Text style={styles.fullscreenMapTitle}>🗺️ Order Map</Text>
              <TouchableOpacity onPress={() => setShowFullscreenMap(false)} style={styles.closeMapButton}>
                <Ionicons name="close" size={24} color="#fff" />
              </TouchableOpacity>
            </View>
            <UnifiedMap
              role="USER"
              orderId={order.id}
              restaurantCoords={order.restaurantId ? [order.restaurantLatitude || 34.5281, order.restaurantLongitude || 69.1761] : undefined}
              userCoords={order.deliveryLatitude && order.deliveryLongitude
                ? [order.deliveryLatitude, order.deliveryLongitude]
                : (userCurrentLocation || [34.5281, 69.1761])}
              destinationCoords={order.deliveryLatitude && order.deliveryLongitude ? [order.deliveryLatitude, order.deliveryLongitude] : undefined}
              // Delivery person real-time location for route cutting (Uber-like)
              deliveryPersonCoords={deliveryPersonCoords}
              agentName={order.deliveryPersonName || undefined}
              agentImageUrl={deliveryPersonImageUrl || undefined}
            />
          </View>
        )}
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    backgroundColor: Colors.surface,
    ...Shadow.sm,
  },
  backButton: {
    padding: Spacing.sm,
  },
  headerTitle: {
    fontSize: Typography.fontSize.xl,
    fontWeight: Typography.fontWeight.bold,
    color: Colors.textPrimary,
  },
  placeholder: {
    width: 40,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: Spacing.md,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    fontSize: Typography.fontSize.md,
    color: Colors.textSecondary,
    marginTop: Spacing.md,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.xl,
  },
  errorText: {
    fontSize: Typography.fontSize.md,
    color: Colors.error,
    marginTop: Spacing.md,
    textAlign: 'center',
  },
  retryButton: {
    marginTop: Spacing.lg,
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.md,
    backgroundColor: Colors.primary,
    borderRadius: BorderRadius.md,
  },
  retryButtonText: {
    color: Colors.white,
    fontSize: Typography.fontSize.md,
    fontWeight: Typography.fontWeight.semibold,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.lg,
    borderRadius: BorderRadius.lg,
    marginBottom: Spacing.md,
    gap: 8,
  },
  statusText: {
    fontSize: Typography.fontSize.lg,
    fontWeight: Typography.fontWeight.bold,
  },
  rejectionReasonCard: {
    backgroundColor: '#FFEBEE',
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    marginBottom: Spacing.md,
    borderWidth: 2,
    borderColor: '#C41E26',
    borderStyle: 'dashed',
  },
  rejectionReasonHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: Spacing.sm,
  },
  rejectionReasonTitle: {
    fontSize: Typography.fontSize.md,
    fontWeight: Typography.fontWeight.bold,
    color: '#C41E26',
  },
  rejectionReasonText: {
    fontSize: Typography.fontSize.sm,
    color: Colors.textPrimary,
    lineHeight: 20,
  },
  orderInfoCard: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    marginBottom: Spacing.md,
    ...Shadow.sm,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: Spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  infoLabel: {
    fontSize: Typography.fontSize.sm,
    color: Colors.textSecondary,
  },
  infoValue: {
    fontSize: Typography.fontSize.sm,
    color: Colors.textPrimary,
    fontWeight: Typography.fontWeight.medium,
  },
  section: {
    marginBottom: Spacing.md,
  },
  sectionTitle: {
    fontSize: Typography.fontSize.md,
    fontWeight: Typography.fontWeight.bold,
    color: Colors.textPrimary,
    marginBottom: Spacing.sm,
  },
  card: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    ...Shadow.sm,
  },
  cardText: {
    fontSize: Typography.fontSize.md,
    color: Colors.textPrimary,
    marginLeft: Spacing.sm,
    flex: 1,
  },
  itemRow: {
    flexDirection: 'row',
    paddingVertical: Spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  itemImageContainer: {
    marginRight: Spacing.sm,
  },
  itemImage: {
    width: 50,
    height: 50,
    borderRadius: BorderRadius.md,
    backgroundColor: Colors.background,
  },
  itemImagePlaceholder: {
    width: 50,
    height: 50,
    borderRadius: BorderRadius.md,
    backgroundColor: Colors.background,
    justifyContent: 'center',
    alignItems: 'center',
  },
  itemDetails: {
    flex: 1,
  },
  itemName: {
    fontSize: Typography.fontSize.md,
    fontWeight: Typography.fontWeight.medium,
    color: Colors.textPrimary,
  },
  itemMeta: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 4,
  },
  itemQuantity: {
    fontSize: Typography.fontSize.sm,
    color: Colors.textSecondary,
  },
  itemPrice: {
    fontSize: Typography.fontSize.sm,
    color: Colors.primary,
    fontWeight: Typography.fontWeight.semibold,
  },
  noItemsText: {
    fontSize: Typography.fontSize.sm,
    color: Colors.textSecondary,
    textAlign: 'center',
    paddingVertical: Spacing.md,
  },
  pricingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: Spacing.sm,
  },
  pricingLabel: {
    fontSize: Typography.fontSize.sm,
    color: Colors.textSecondary,
  },
  pricingValue: {
    fontSize: Typography.fontSize.sm,
    color: Colors.textPrimary,
    fontWeight: Typography.fontWeight.medium,
  },
  totalRow: {
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    paddingTop: Spacing.sm,
    marginTop: Spacing.sm,
  },
  totalLabel: {
    fontSize: Typography.fontSize.md,
    fontWeight: Typography.fontWeight.bold,
    color: Colors.textPrimary,
  },
  totalValue: {
    fontSize: Typography.fontSize.lg,
    fontWeight: Typography.fontWeight.bold,
    color: Colors.primary,
  },
  deliveryPersonRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  deliveryPersonInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  deliveryPersonName: {
    fontSize: Typography.fontSize.md,
    color: Colors.textPrimary,
    marginLeft: Spacing.sm,
  },
  callButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    backgroundColor: Colors.primary + '20',
    borderRadius: BorderRadius.md,
    gap: 4,
  },
  callButtonText: {
    fontSize: Typography.fontSize.sm,
    color: Colors.primary,
    fontWeight: Typography.fontWeight.semibold,
  },
  customerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.sm,
    gap: Spacing.sm,
  },
  customerName: {
    fontSize: Typography.fontSize.md,
    color: Colors.textPrimary,
  },
  customerPhone: {
    fontSize: Typography.fontSize.md,
    color: Colors.primary,
    textDecorationLine: 'underline',
  },
  notesText: {
    fontSize: Typography.fontSize.sm,
    color: Colors.textSecondary,
    marginLeft: Spacing.sm,
    fontStyle: 'italic',
  },
  mapContainer: {
    width: '100%',
    height: 300,
    borderRadius: BorderRadius.lg,
    overflow: 'hidden',
    backgroundColor: Colors.surface,
    ...Shadow.sm,
  },
  mapLegend: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    backgroundColor: Colors.surface,
    padding: Spacing.md,
    borderRadius: BorderRadius.lg,
    marginTop: Spacing.sm,
    ...Shadow.sm,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  legendDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  legendText: {
    fontSize: Typography.fontSize.sm,
    color: Colors.textSecondary,
  },
  actionsSection: {
    marginTop: Spacing.lg,
    gap: Spacing.md,
  },
  supportButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.primary,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.lg,
    gap: 8,
  },
  supportButtonText: {
    fontSize: Typography.fontSize.md,
    color: Colors.white,
    fontWeight: Typography.fontWeight.semibold,
  },
  backButton2: {
    backgroundColor: Colors.surface,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.lg,
    alignItems: 'center',
    ...Shadow.sm,
  },
  backButton2Text: {
    fontSize: Typography.fontSize.md,
    color: Colors.textPrimary,
    fontWeight: Typography.fontWeight.semibold,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.sm,
  },
  fullscreenMapButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.primary,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    gap: 4,
  },
  fullscreenMapButtonText: {
    color: '#fff',
    fontSize: Typography.fontSize.sm,
    fontWeight: Typography.fontWeight.semibold,
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
    backgroundColor: Colors.primary,
  },
  fullscreenMapTitle: {
    fontSize: Typography.fontSize.lg,
    fontWeight: Typography.fontWeight.bold,
    color: '#fff',
  },
  closeMapButton: {
    padding: 8,
  },
});
