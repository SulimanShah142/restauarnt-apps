import React, { useState, useEffect, useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, FlatList, Alert, ActivityIndicator, Modal, TextInput, Image, ScrollView, Linking, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAdminAuth } from '@/contexts/AdminAuthContext';
import { supabase } from '@/lib/supabase';
import { adminApiService } from '@/lib/admin-api-service';
import NotificationPermissionPrompt from '@/components/NotificationPermissionPrompt';
import DatePicker from '@/components/DatePicker';
import UnifiedMap from '@/components/UnifiedMap';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useDeliveryLocationListener } from '@/hooks/useDeliveryLocationListener';

// Prevent auto-hiding of splash screen
SplashScreen.preventAutoHideAsync().catch(() => {});

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
  deliveryPersonStatus?: string;
  items: Array<{
    id?: string;
    name: string;
    quantity: number;
    price: number;
    image_url?: string;
  }>;
  createdAt: string;
  updatedAt?: string;
  customerName?: string;
  customerPhone?: string;
  notes?: string;
  subtotal?: number;
  deliveryCost?: number;
  deliveryLatitude?: number;
  deliveryLongitude?: number;
  userLocation?: {
    latitude: number;
    longitude: number;
  };
  is_completed?: boolean;
  completed_at?: string;
}

interface DeliveryPerson {
  id: string;
  deliveryPersonTableId?: string;
  name: string;
  status: 'busy' | 'free';
  location?: {
    latitude: number;
    longitude: number;
  };
  profilePictureUrl?: string;
}

function OrdersScreenContent() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [deliveryPersons, setDeliveryPersons] = useState<DeliveryPerson[]>([]);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [showDeliveryAssignModal, setShowDeliveryAssignModal] = useState(false);
  const [selectedOrderForDelivery, setSelectedOrderForDelivery] = useState<Order | null>(null);
  const [selectedDeliveryPerson, setSelectedDeliveryPerson] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [allOrders, setAllOrders] = useState<Order[]>([]);
  const [notification, setNotification] = useState<{
    visible: boolean;
    title: string;
    message: string;
    type: 'success' | 'error' | 'info' | 'warning' | 'order';
  }>({ visible: false, title: '', message: '', type: 'info' });

  // Memoize map coordinates to prevent infinite re-renders - ALWAYS [lat, lng] format
  const mapRestaurantCoords = useMemo(() => {
    if (!selectedOrder?.restaurantId) return undefined;
    
    // Try to get restaurant coordinates from order data first
    // This is the MOST accurate - comes from restaurant table
    const restaurantLat = selectedOrder?.restaurantLatitude || (selectedOrder as any)?.restaurants?.latitude;
    const restaurantLng = selectedOrder?.restaurantLongitude || (selectedOrder as any)?.restaurants?.longitude;
    
    if (restaurantLat && restaurantLng) {
      const coords: [number, number] = [Number(restaurantLat), Number(restaurantLng)];
      return coords;
    }

    // Fallback: Fetch restaurant coordinates if not in order data
    // This happens when order doesn't include restaurant relation
    if (selectedOrder?.restaurantId) {
      // We'll fetch this in a useEffect and store in order data
    }

    // Last resort: Use default Kabul coordinates
    return [34.5281, 69.1761] as [number, number];
  }, [selectedOrder?.restaurantId, selectedOrder?.restaurantLatitude, selectedOrder?.restaurantLongitude]);

  const mapDeliveryCoords = useMemo(() => {
    // IMPORTANT: Must be [latitude, longitude] format for Leaflet
    const lat = selectedOrder?.deliveryLatitude;
    const lng = selectedOrder?.deliveryLongitude;
    if (!lat || !lng) return undefined;
    return [Number(lat), Number(lng)] as [number, number];
  }, [selectedOrder?.deliveryLatitude, selectedOrder?.deliveryLongitude]);

  // REAL-TIME DELIVERY PERSON LOCATION TRACKING (updates every 50 meters)
  const { 
    deliveryLocation: realTimeDeliveryLocation,
    isLoading: isLocationLoading, 
    error: locationError,
    hasLocation: hasRealTimeLocation
  } = useDeliveryLocationListener({
    enabled: !!selectedOrder?.deliveryPersonId && 
             (selectedOrder?.status === 'on_the_way' || selectedOrder?.status === 'picked_up'),
    orderId: selectedOrder?.id,
    deliveryPersonId: selectedOrder?.deliveryPersonId
  });

  // Use real-time location if available, otherwise use stored coords
  const mapDriverCoords = useMemo(() => {
    if (realTimeDeliveryLocation) {
      return [realTimeDeliveryLocation.latitude, realTimeDeliveryLocation.longitude] as [number, number];
    }
    return mapDeliveryCoords;
  }, [realTimeDeliveryLocation, mapDeliveryCoords]);

  // Memoize names with proper defaults
  const mapRestaurantName = useMemo(() => {
    return selectedOrder?.restaurantName || 'Restaurant';
  }, [selectedOrder?.restaurantName]);

  const mapUserName = useMemo(() => {
    return selectedOrder?.customerName || 'Customer';
  }, [selectedOrder?.customerName]);

  // New state for order confirmation dialog
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [orderToConfirm, setOrderToConfirm] = useState<Order | null>(null);

  // State for cancellation reason dialog
  const [showCancellationDialog, setShowCancellationDialog] = useState(false);
  const [orderToCancel, setOrderToCancel] = useState<Order | null>(null);
  const [cancellationReason, setCancellationReason] = useState('');

  const router = useRouter();

  // Show notification at top of screen
  const showNotification = (title: string, message: string, type: 'success' | 'error' | 'info' | 'warning' | 'order' = 'order') => {
    setNotification({ title, message, visible: true, type });
    setTimeout(() => {
      setNotification(prev => ({ ...prev, visible: false }));
    }, 5000);
  };

  // Filter orders by date (copied from delivery-personnel-[id].tsx)
  const filterOrdersByDate = (allOrdersData: Order[], date: Date) => {

    const selectedYear = date.getFullYear();
    const selectedMonth = date.getMonth();
    const selectedDay = date.getDate();


    const filtered = allOrdersData.filter(order => {
      if (!order.createdAt) return false;

      const orderDate = new Date(order.createdAt);
      const orderYear = orderDate.getFullYear();
      const orderMonth = orderDate.getMonth();
      const orderDay = orderDate.getDate();


      // Compare year, month, and day (all in local timezone)
      const isDateMatch = orderYear === selectedYear && orderMonth === selectedMonth && orderDay === selectedDay;
      return isDateMatch;
    });

    return filtered;
  };

  // Handle date change from DatePicker
  const handleDateChange = (newDate: Date) => {
    // Ensure we're using the date at midnight local time to avoid timezone issues
    const normalizedDate = new Date(newDate.getFullYear(), newDate.getMonth(), newDate.getDate());


    setSelectedDate(normalizedDate);
    
    // Filter all orders by selected date
    const filtered = filterOrdersByDate(allOrders, normalizedDate);
    setOrders(filtered);
    
    setShowDatePicker(false);
  };

  // Handle cancel order with reason
  const handleCancelOrder = (order: Order) => {
    setOrderToCancel(order);
    setCancellationReason('');
    setShowCancellationDialog(true);
  };

  const confirmCancelOrder = async () => {
    if (!orderToCancel) return;

    try {
      setLoading(true);

      // Use the cancelOrder API function which handles cancellation reason
      await adminApiService.orders.cancelOrder(orderToCancel.id, cancellationReason || 'Cancelled by admin');
      
      showNotification('Order Cancelled', `Order #${orderToCancel.orderNumber?.substring(0, 8) || 'N/A'} has been cancelled`, 'error');
      
      // Refresh orders
      await fetchOrders();
      
      setShowCancellationDialog(false);
      setOrderToCancel(null);
      setCancellationReason('');
    } catch (error) {
      console.error('[Orders] Error cancelling order:', error);
      Alert.alert('Error', 'Failed to cancel order');
    } finally {
      setLoading(false);
    }
  };

  // Fetch orders with order items
  const fetchOrders = async () => {
    try {
      setLoading(true);

      // First, get all orders with ALL location fields needed for map
      const { data: ordersData, error: ordersError } = await supabase
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
          restaurant_latitude,
          restaurant_longitude,
          customer_name,
          customer_phone,
          user_id,
          created_at,
          updated_at,
          restaurants (
            id,
            name,
            latitude,
            longitude,
            address,
            phone
          ),
          profiles (
            id,
            name,
            phone,
            email
          ),
          delivery_persons (
            id,
            name,
            is_available
          )
        `)
        .order('created_at', { ascending: false });

      if (ordersError) {
        console.error('[Orders] ❌ Error fetching orders:', ordersError);
        throw ordersError;
      }

      if (ordersData && ordersData.length > 0) {
      }

      // Then, fetch order items for all orders
      const orderIds = ordersData?.map(o => o.id) || [];
      let orderItemsMap: Record<string, any[]> = {};

      if (orderIds.length > 0) {
        
        const { data: itemsData, error: itemsError } = await supabase
          .from('order_items')
          .select('*')
          .in('order_id', orderIds);

        if (itemsError) {
          console.error('[Orders] ❌ Error fetching order items:', itemsError);
        } else {
          
          if (itemsData && itemsData.length > 0) {
            
            orderItemsMap = itemsData.reduce((acc, item) => {
              if (!acc[item.order_id]) {
                acc[item.order_id] = [];
              }
              acc[item.order_id].push(item);
              return acc;
            }, {} as Record<string, any[]>);
            
            Object.keys(orderItemsMap).forEach(orderId => {
              // Process order items if needed
            });
          }
        }
      }

      const transformedOrders: Order[] = (ordersData || []).map((order: any) => {
        const orderItems = orderItemsMap[order.id] || order.order_items || [];

        // Use profiles.name as customer name (from joined profiles table)
        const customerName = order.profiles?.name || order.customer_name || 'Unknown Customer';
        const customerPhone = order.profiles?.phone || order.customer_phone || 'N/A';


        return {
          id: order.id,
          orderNumber: order.order_number,
          restaurantName: order.restaurants?.name || 'Unknown Restaurant',
          restaurantId: order.restaurant_id,
          restaurantLatitude: order.restaurant_latitude || order.restaurants?.latitude,
          restaurantLongitude: order.restaurant_longitude || order.restaurants?.longitude,
          status: order.status,
          totalAmount: order.total_amount || 0,
          deliveryAddress: order.delivery_address || '',
          deliveryPersonId: order.delivery_person_id,
          deliveryPersonName: order.delivery_persons?.name,
          items: orderItems.map((item: any) => ({
            id: item.id,
            name: item.menu_item_name || item.name || 'Unknown Item',
            quantity: item.quantity,
            price: item.price,
            image_url: item.menu_item_image_url || item.image_url
          })),
          createdAt: order.created_at,
          updatedAt: order.updated_at,
          customerName: customerName,
          customerPhone: customerPhone,
          notes: order.delivery_notes,
          subtotal: order.subtotal,
          deliveryCost: order.delivery_cost,
          deliveryLatitude: order.delivery_lat,
          deliveryLongitude: order.delivery_lng,
          // User location for map - use delivery coords directly
          userLocation: order.delivery_lat && order.delivery_lng ? {
            latitude: order.delivery_lat,
            longitude: order.delivery_lng
          } : undefined,
          is_completed: order.is_completed,
          completed_at: order.completed_at
        };
      });

      // DEBUG: Log coordinate values
      const firstOrder = transformedOrders[0];
      const deliveryLat = firstOrder?.deliveryLatitude || 0;
      const deliveryLng = firstOrder?.deliveryLongitude || 0;

      // Store ALL orders
      setAllOrders(transformedOrders);
      
      // Filter by selected date BEFORE setting orders (FIX: filter on initial load)
      const filteredByDate = filterOrdersByDate(transformedOrders, selectedDate);
      setOrders(filteredByDate);

      setLoading(false);
    } catch (error) {
      console.error('[Orders] ❌ ERROR fetching orders:', error);
      console.error('[Orders] Error details:', JSON.stringify(error, null, 2));
      setLoading(false);
      Alert.alert('Error', 'Failed to load orders');
    }
  };

  // Fetch delivery persons
  const fetchDeliveryPersons = async () => {
    try {
      const { data: deliveryPersonsData, error: deliveryPersonsError } = await supabase
        .from('delivery_persons')
        .select('*')
        .eq('is_available', true);

      if (deliveryPersonsError) throw deliveryPersonsError;

      const transformedDeliveryPersons: DeliveryPerson[] = (deliveryPersonsData || []).map((person: any) => ({
        id: person.user_id || person.id,
        deliveryPersonTableId: person.id,
        name: person.name || 'Unknown',
        status: person.is_available ? 'free' : 'busy',
        location: person.current_location || (person.current_latitude && person.current_longitude ? {
          latitude: person.current_latitude,
          longitude: person.current_longitude,
        } : undefined),
        profilePictureUrl: person.image_url,
      }));

      setDeliveryPersons(transformedDeliveryPersons);
    } catch (error) {
      console.error('[Orders] ❌ Error fetching delivery persons:', error);
      setDeliveryPersons([]);
    }
  };

  // Load orders and delivery persons when component mounts
  useEffect(() => {
    fetchOrders();
    fetchDeliveryPersons();
  }, []);

  // Set up Realtime subscription for orders changes
  useEffect(() => {

    // Subscribe to orders changes
    const ordersChannel = supabase
      .channel('orders-sync')
      .on(
        'postgres_changes',
        {
          event: '*', // Listen to all events
          schema: 'public',
          table: 'orders'
        },
        async (payload: any) => {

          // NEW ORDER - Show notification with alarm sound
          if (payload.eventType === 'INSERT' && payload.new) {
            const orderNumber = payload.new?.order_number?.substring(0, 8) || payload.new?.id?.substring(0, 8);
            const customerName = payload.new?.customer_name || payload.new?.user_name || 'Customer';
            const totalAmount = payload.new?.total_amount || 0;


            // Show in-app notification banner
            setNotification(prev => {
              return {
                ...prev,
                visible: true,
                title: '🔔 New Order Received!',
                message: `${customerName} ordered AFG ${totalAmount} (Order #${orderNumber})`,
                type: 'order',
              };
            });

            // Auto-hide after 5 seconds
            setTimeout(() => {
              setNotification(prev => ({ ...prev, visible: false }));
            }, 5000);

            // Send BACKGROUND PUSH notification (works even when app is closed!)
            try {
              const { sendNewOrderPushNotification } = await import('@/lib/push-notification-service');
              
              const result = await sendNewOrderPushNotification({
                adminEmail: 'Mohammadseyar885@gmail.com',
                orderId: payload.new?.id,
                orderNumber: orderNumber,
                customerName: customerName,
                totalAmount: totalAmount
              });
              
              if (result.success) {
                console.warn('[Orders Realtime] ⚠️ Push notification failed:', result.error);
              }
            } catch (error) {
              console.error('[Orders Realtime] ❌ Error sending push notification:', error);
              console.error('[Orders Realtime] Error details:', JSON.stringify(error, null, 2));
            }
            
            // Also send local notification for foreground (backup)
            try {
              const { sendLocalNotification } = await import('@/lib/notification-service');
              await sendLocalNotification({
                title: '🔔 New Order Received!',
                body: `${customerName} ordered AFG ${totalAmount}. Please confirm the order.`,
                type: 'order',
                sound: true,
                badge: 1,
                data: {
                  orderId: payload.new?.id,
                  orderNumber: orderNumber,
                  type: 'new-order',
                  customerName: customerName,
                  totalAmount: totalAmount
                }
              });
            } catch (error) {
              console.error('[Orders Realtime] ❌ Error sending local notification:', error);
            }
          }

          // Show notification if order was delivered
          if (payload.eventType === 'UPDATE' && payload.new?.status === 'delivered' && payload.old?.status !== 'delivered') {
            const orderNumber = payload.new?.order_number?.substring(0, 8) || payload.new?.id?.substring(0, 8);


            // Show in-app notification banner
            setNotification(prev => ({
              ...prev,
              visible: true,
              title: '✅ Order Delivered',
              message: `Order #${orderNumber} has been delivered successfully!`,
              type: 'success',
            }));

            // Auto-hide after 5 seconds
            setTimeout(() => {
              setNotification(prev => ({ ...prev, visible: false }));
            }, 5000);

            try {
              const { sendLocalNotification } = await import('@/lib/notification-service');
              await sendLocalNotification({
                title: '✅ Order Delivered',
                body: `Order #${orderNumber} has been delivered successfully!`,
                type: 'success',
                sound: true,
                badge: 0,
              });
            } catch (error) {
              console.error('[Orders] Error sending system notification:', error);
            }
          }

          // Reload orders to sync changes
          await fetchOrders();
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'order_items'
        },
        async (payload: any) => {
          await fetchOrders();
        }
      )
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          console.error('[Orders Realtime] ❌ CHANNEL_ERROR - Realtime connection issue');
          console.error('[Orders Realtime] 💡 This usually means:');
          console.error('[Orders Realtime]    1. Realtime is not enabled in Supabase Dashboard');
          console.error('[Orders Realtime]    2. Network connection issue');
          console.error('[Orders Realtime]    3. Supabase project is paused');
          console.error('[Orders Realtime] 📝 Run ENABLE_REALTIME_FOR_ORDERS.sql in Supabase SQL Editor');
          console.error('[Orders Realtime] 🔄 Will retry connection in 5 seconds...');
          
          // Auto-retry connection after 5 seconds
          setTimeout(() => {
            // Channel will automatically attempt to reconnect
          }, 5000);
        } else if (status === 'TIMED_OUT') {
          console.error('[Orders Realtime] ❌ TIMED_OUT - Connection timed out');
          console.error('[Orders Realtime] 📶 Check your internet connection');
          console.error('[Orders Realtime] 🔄 Will retry connection...');
        } else if (status === 'CLOSED') {
          console.warn('[Orders Realtime] ⚠️ CLOSED - Connection closed');
          console.warn('[Orders Realtime] 🔄 Attempting to reconnect...');
        }
      });

    // Cleanup subscription on unmount
    return () => {
      supabase.removeChannel(ordersChannel);
    };
  }, []);

  // Update order status
  const updateOrderStatus = async (orderId: string, newStatus: string) => {
    setLoading(true);

    try {
      await adminApiService.orders.updateStatus(orderId, newStatus);
      showNotification('Success', `Order status updated to ${newStatus}`, 'success');
      // Refresh orders to get latest data
      await fetchOrders();
    } catch (error) {
      console.error('[Orders] Error updating order status:', error);
      Alert.alert('Error', 'Failed to update order status');
    } finally {
      setLoading(false);
    }
  };

  // Assign delivery person
  const assignDeliveryPerson = async (orderId: string, deliveryPersonId: string) => {
    setLoading(true);

    try {
      // deliveryPersonId is now the delivery_persons.id directly
      await adminApiService.orders.assignToDeliveryPerson(orderId, deliveryPersonId);
      showNotification('Success', 'Delivery person assigned', 'success');
      await fetchOrders();
      Alert.alert('Success', 'Delivery person assigned to order');
    } catch (error) {
      console.error('[Orders] Error assigning delivery person:', error);
      Alert.alert('Error', 'Failed to assign delivery person');
    } finally {
      setLoading(false);
    }
  };

  const showDeliveryAssignmentModal = (order: Order) => {
    setSelectedOrderForDelivery(order);
    setSelectedDeliveryPerson(null);
    setShowDeliveryAssignModal(true);
  };

  const confirmDeliveryAssignment = async () => {
    if (!selectedOrderForDelivery || selectedDeliveryPerson === null) {
      Alert.alert('Error', 'Please select a delivery person');
      return;
    }

    try {
      await assignDeliveryPerson(selectedOrderForDelivery.id, selectedDeliveryPerson);
      setShowDeliveryAssignModal(false);
      setSelectedOrderForDelivery(null);
      setSelectedDeliveryPerson(null);
    } catch (error) {
      console.error('Error confirming delivery assignment:', error);
      Alert.alert('Error', 'Failed to assign delivery person');
    }
  };

  // Show order confirmation dialog FIRST before updating status
  const handleConfirmOrder = (order: Order) => {
    setOrderToConfirm(order);
    setShowConfirmDialog(true);
  };

  // Confirm order after viewing details - THEN show delivery assignment modal
  const confirmOrderUpdate = async () => {
    if (!orderToConfirm) return;


    try {
      setShowConfirmDialog(false);
      
      // Step 1: Update order status to confirmed
      await updateOrderStatus(orderToConfirm.id, 'confirmed');
      
      // Step 2: IMMEDIATELY show delivery assignment modal
      showDeliveryAssignmentModal(orderToConfirm);
      
      setOrderToConfirm(null);
    } catch (error) {
      console.error('[Orders] ❌ Error confirming order:', error);
      Alert.alert('Error', 'Failed to confirm order');
      setOrderToConfirm(null);
    }
  };

  const showOrderDetails = (order: Order) => {
    setSelectedOrder(order);
    setModalVisible(true);
  };

  const getStatusColor = (status: string) => {
    switch(status) {
      case 'pending': return '#FFCC00';
      case 'confirmed': return '#C41E26';
      case 'preparing': return '#5856D6';
      case 'ready': return '#C41E26';
      case 'on_the_way': return '#FF9500';
      case 'delivered': return '#4CD964';
      case 'cancelled': return '#C41E26';
      case 'rejected': return '#C41E26';
      default: return '#8E8E93';
    }
  };

  const renderItem = ({ item }: { item: Order }) => {
    return (
      <View style={styles.orderCard}>
        <View style={styles.orderHeader}>
          <Text style={[styles.status, { backgroundColor: getStatusColor(item.status) }]}>
            {item.status.charAt(0).toUpperCase() + item.status.slice(1).replace('_', ' ')}
          </Text>
        </View>

        <Text style={styles.restaurantName}>{item.restaurantName}</Text>

        <View style={styles.itemsContainer}>
          {item.items && item.items.length > 0 ? (
            <>
              {item.items.slice(0, 3).map((orderItem, index) => {
                return (
                  <View key={index} style={styles.orderItemRow}>
                    <Text style={styles.orderItemText}>{orderItem.quantity}x {orderItem.name}</Text>
                  </View>
                );
              })}
              {item.items.length > 3 && (
                <Text style={styles.itemText}>+ {item.items.length - 3} more items</Text>
              )}
            </>
          ) : (
            <Text style={styles.itemText}>No items</Text>
          )}
        </View>

        <Text style={styles.totalAmount}>Total: AFG {item.totalAmount.toFixed(2)}</Text>
        <Text style={styles.deliveryAddress}>Delivery: {item.deliveryAddress}</Text>

        <View style={styles.orderActions}>
{item.status !== 'delivered' && (
  <View>
    <View style={styles.actionRow}>
      <TouchableOpacity
        style={[styles.actionButton, styles.successButton]}
        onPress={() => handleConfirmOrder(item)}
        disabled={loading}
      >
        <Text style={styles.actionButtonText}>✅ Confirm</Text>
      </TouchableOpacity>
      <TouchableOpacity
        style={[styles.actionButton, styles.rejectButton]}
        onPress={() => handleRejectOrder(item)}
        disabled={loading}
      >
        <Text style={styles.actionButtonText}>❌ Reject</Text>
      </TouchableOpacity>
    </View>
  </View>
)}

          {item.status === 'confirmed' || item.status === 'on_the_way'  && (
            <View>
              <View style={styles.actionRow}>
                {!item.deliveryPersonId ? (
                  <TouchableOpacity
                    style={[styles.actionButton, styles.assignButton]}
                    onPress={() => showDeliveryAssignmentModal(item)}
                    disabled={loading}
                  >
                    <Text style={styles.actionButtonText}>🚚 Assign Order</Text>
                  </TouchableOpacity>
                ) : (
                  <TouchableOpacity
                    style={[styles.actionButton, styles.reassignButton]}
                    onPress={() => showDeliveryAssignmentModal(item)}
                    disabled={loading}
                  >
                    <Text style={styles.actionButtonText}>🔄 Reassign</Text>
                  </TouchableOpacity>
                )}
                <TouchableOpacity
                  style={[styles.actionButton, styles.cancelOrderButton]}
                  onPress={() => handleCancelOrder(item)}
                  disabled={loading}
                >
                  <Text style={styles.actionButtonText}>❌ Cancel Order</Text>
                </TouchableOpacity>
              </View>
              {item.deliveryPersonName && (
                <Text style={styles.deliveryPersonText}>Delivery: {item.deliveryPersonName}</Text>
              )}
            </View>
          )}

          <TouchableOpacity
            style={[styles.actionButton, styles.viewDetailsButton]}
            onPress={() => showOrderDetails(item)}
          >
            <Text style={styles.viewDetailsButtonText}>📋 View Details</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  // Order Confirmation Dialog - shows order items BEFORE confirming
  const renderOrderConfirmDialog = () => (
    <Modal
      animationType="slide"
      transparent={true}
      visible={showConfirmDialog}
      onRequestClose={() => {
        setShowConfirmDialog(false);
        setOrderToConfirm(null);
      }}
    >
      <View style={styles.modalContainer}>
        <View style={[styles.modalContent, { maxHeight: '85%' }]}>
          <ScrollView
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={true}
            keyboardShouldPersistTaps="handled"
          >
            <Text style={styles.modalTitle}>Confirm Order</Text>

            {orderToConfirm && (
              <>
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Order Number:</Text>
                  <Text style={styles.detailValue}>{orderToConfirm.orderNumber || orderToConfirm.id.substring(0, 8)}</Text>
                </View>

                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Restaurant:</Text>
                  <Text style={styles.detailValue}>{orderToConfirm.restaurantName}</Text>
                </View>

                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Customer:</Text>
                  <Text style={styles.detailValue}>{orderToConfirm.customerName || 'N/A'}</Text>
                </View>

                {orderToConfirm.customerPhone && (
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Phone:</Text>
                    <Text style={styles.detailValue}>{orderToConfirm.customerPhone}</Text>
                  </View>
                )}

                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Delivery Address:</Text>
                  <Text style={styles.detailValue}>{orderToConfirm.deliveryAddress}</Text>
                </View>

                <Text style={styles.itemsTitle}>Order Items:</Text>
                {orderToConfirm.items && orderToConfirm.items.length > 0 ? (
                  <View style={styles.itemsContainer}>
                    {orderToConfirm.items.map((item, index) => (
                      <View key={index} style={styles.itemRow}>
                        <View style={styles.itemImageContainer}>
                          {item.image_url ? (
                            <Image source={{ uri: item.image_url }} style={styles.itemImage} />
                          ) : (
                            <View style={styles.itemImagePlaceholder}>
                              <Text style={styles.itemImagePlaceholderText}>No Image</Text>
                            </View>
                          )}
                        </View>
                        <View style={styles.itemDetailsContainer}>
                          <Text style={styles.itemText}>{item.quantity}x {item.name}</Text>
                          <Text style={styles.itemPrice}>AFG {(item.price * item.quantity).toFixed(2)}</Text>
                        </View>
                      </View>
                    ))}
                  </View>
                ) : (
                  <Text style={styles.itemText}>No items</Text>
                )}

                <Text style={styles.itemsTitle}>Pricing Breakdown:</Text>
                <View style={styles.pricingSection}>
                  <View style={styles.pricingRow}>
                    <Text style={styles.pricingLabel}>Subtotal:</Text>
                    <Text style={styles.pricingValue}>AFG {orderToConfirm.subtotal?.toFixed(2) || '0.00'}</Text>
                  </View>

                  <View style={styles.pricingRow}>
                    <Text style={styles.pricingLabel}>Delivery Fee:</Text>
                    <Text style={styles.pricingValue}>AFG {orderToConfirm.deliveryCost?.toFixed(2) || '0.00'}</Text>
                  </View>

                  <View style={[styles.pricingRow, styles.totalPricingRow]}>
                    <Text style={[styles.pricingLabel, styles.totalPricingLabel]}>Total:</Text>
                    <Text style={[styles.pricingValue, styles.totalPricingValue]}>AFG {orderToConfirm.totalAmount.toFixed(2)}</Text>
                  </View>
                </View>

                <View style={styles.modalActions}>
                  <TouchableOpacity
                    style={[styles.actionButton, styles.cancelButton]}
                    onPress={() => {
                      setShowConfirmDialog(false);
                      setOrderToConfirm(null);
                    }}
                  >
                    <Text style={styles.actionButtonText}>Cancel</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.actionButton, styles.confirmButton]}
                    onPress={confirmOrderUpdate}
                  >
                    <Text style={styles.actionButtonText}>✅ Confirm Order</Text>
                  </TouchableOpacity>
                </View>
              </>
            )}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );

  const renderDeliveryAssignmentModal = () => (
    <Modal
      animationType="slide"
      transparent={true}
      visible={showDeliveryAssignModal}
      onRequestClose={() => {
        setShowDeliveryAssignModal(false);
        setSelectedOrderForDelivery(null);
        setSelectedDeliveryPerson(null);
      }}
    >
      <View style={styles.modalContainer}>
        <View style={[styles.modalContent, { maxHeight: '85%' }]}>
          <ScrollView
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={true}
            keyboardShouldPersistTaps="handled"
          >
            <Text style={styles.modalTitle}>Assign Delivery Person</Text>

            {selectedOrderForDelivery && (
              <View>
                <Text style={styles.modalSubtitle}>
                  {selectedOrderForDelivery.restaurantName}
                </Text>
              </View>
            )}

            <Text style={styles.assignLabel}>Select Delivery Person:</Text>

            <View style={styles.deliveryPersonsList}>
              {deliveryPersons.map((person) => (
                <TouchableOpacity
                  key={person.id}
                  style={[
                    styles.deliveryPersonOption,
                    selectedDeliveryPerson === person.id && styles.selectedDeliveryPerson,
                  ]}
                  onPress={() => setSelectedDeliveryPerson(person.id)}
                >
                  <View style={styles.deliveryPersonRow}>
                    {person.profilePictureUrl ? (
                      <Image source={{ uri: person.profilePictureUrl }} style={styles.deliveryPersonAvatar} />
                    ) : (
                      <View style={styles.deliveryPersonAvatarPlaceholder}>
                        <Text style={styles.deliveryPersonAvatarText}>
                          {person.name?.charAt(0).toUpperCase() || '?'}
                        </Text>
                      </View>
                    )}
                    <View style={styles.deliveryPersonInfo}>
                      <Text style={[
                        styles.deliveryPersonName,
                        selectedDeliveryPerson === person.id && styles.deliveryPersonNameSelected
                      ]}>
                        {person.name || 'Unknown'}
                      </Text>
                      <Text style={[
                        styles.deliveryPersonStatus,
                        person.status === 'busy' ? styles.statusBusy : styles.statusFree,
                      ]}>
                        {person.status === 'busy' ? '● BUSY' : '● AVAILABLE'}
                      </Text>
                    </View>
                  </View>
                </TouchableOpacity>
              ))}
            </View>

            {deliveryPersons.length === 0 && (
              <Text style={styles.noDeliveryPersonsText}>No delivery persons available</Text>
            )}

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[styles.actionButton, styles.cancelButton]}
                onPress={() => {
                  setShowDeliveryAssignModal(false);
                  setSelectedOrderForDelivery(null);
                  setSelectedDeliveryPerson(null);
                }}
              >
                <Text style={styles.actionButtonText}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.actionButton, styles.confirmButton]}
                onPress={confirmDeliveryAssignment}
              >
                <Text style={styles.actionButtonText}>Assign Delivery</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );

  const renderOrderDetailsModal = () => (
    <Modal
      animationType="slide"
      transparent={true}
      visible={modalVisible}
      onRequestClose={() => setModalVisible(false)}
    >
      <View style={styles.modalContainer}>
        <View style={[styles.modalContent, { maxHeight: '95%' }]}>
          <ScrollView
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={true}
            keyboardShouldPersistTaps="handled"
          >
            {/* MAP ON TOP */}
            {selectedOrder && (
              <View style={styles.mapContainer}>
                <UnifiedMap
                  role="ADMIN"
                  orderId={selectedOrder.id}
                  restaurantName={mapRestaurantName}
                  userName={mapUserName}
                  agentName={selectedOrder.deliveryPersonName}
                  // Restaurant location (pickup point) - enables route drawing
                  restaurantCoords={mapRestaurantCoords}
                  // Driver location (real-time, updates every 50 meters)
                  userCoords={mapDriverCoords}
                  // Delivery location (destination) - enables route drawing
                  destinationCoords={mapDeliveryCoords}
                />
                {hasRealTimeLocation && (
                  <View style={styles.realtimeIndicator}>
                    <Text style={styles.realtimeText}>📡 Live Tracking</Text>
                  </View>
                )}
              </View>
            )}

            {/* INFO BENEATH MAP */}
            <Text style={styles.modalTitle}>Order Details</Text>

            {selectedOrder && (
              <>
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Order Number:</Text>
                  <Text style={styles.detailValue}>{selectedOrder.orderNumber || selectedOrder.id.substring(0, 8)}</Text>
                </View>

                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Restaurant:</Text>
                  <Text style={styles.detailValue}>{selectedOrder.restaurantName}</Text>
                </View>

                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Status:</Text>
                  <Text style={[styles.detailValue, { color: getStatusColor(selectedOrder.status) }]}>
                    {selectedOrder.status.toUpperCase()}
                  </Text>
                </View>

                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Customer:</Text>
                  <Text style={styles.detailValue}>{selectedOrder.customerName || 'N/A'}</Text>
                </View>

                {selectedOrder.customerPhone && (
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Phone:</Text>
                    <TouchableOpacity onPress={() => Linking.openURL(`tel:${selectedOrder.customerPhone}`)}>
                      <Text style={[styles.detailValue, { color: '#007AFF', textDecorationLine: 'underline' }]}>
                        {selectedOrder.customerPhone}
                      </Text>
                    </TouchableOpacity>
                  </View>
                )}

                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Delivery Address:</Text>
                  <Text style={styles.detailValue}>{selectedOrder.deliveryAddress}</Text>
                </View>

                {/* Order Items */}
                <Text style={styles.itemsTitle}>Order Items:</Text>
                {selectedOrder.items && selectedOrder.items.length > 0 ? (
                  <View style={styles.itemsContainer}>
                    {selectedOrder.items.map((item, index) => (
                      <View key={index} style={styles.itemRow}>
                        <View style={styles.itemImageContainer}>
                          {item.image_url ? (
                            <Image source={{ uri: item.image_url }} style={styles.itemImage} />
                          ) : (
                            <View style={styles.itemImagePlaceholder}>
                              <Text style={styles.itemImagePlaceholderText}>No Image</Text>
                            </View>
                          )}
                        </View>
                        <View style={styles.itemDetailsContainer}>
                          <Text style={styles.itemText}>{item.quantity}x {item.name}</Text>
                          <Text style={styles.itemPrice}>AFG {(item.price * item.quantity).toFixed(2)}</Text>
                        </View>
                      </View>
                    ))}
                  </View>
                ) : (
                  <Text style={styles.itemText}>No items</Text>
                )}

                {/* Pricing Breakdown */}
                <View style={styles.pricingSection}>
                  <View style={styles.pricingRow}>
                    <Text style={styles.pricingLabel}>Subtotal:</Text>
                    <Text style={styles.pricingValue}>AFG {selectedOrder.subtotal?.toFixed(2) || '0.00'}</Text>
                  </View>

                  <View style={styles.pricingRow}>
                    <Text style={styles.pricingLabel}>Delivery Fee:</Text>
                    <Text style={styles.pricingValue}>AFG {selectedOrder.deliveryCost?.toFixed(2) || '0.00'}</Text>
                  </View>

                  <View style={[styles.pricingRow, styles.totalPricingRow]}>
                    <Text style={[styles.pricingLabel, styles.totalPricingLabel]}>Total:</Text>
                    <Text style={[styles.pricingValue, styles.totalPricingValue]}>AFG {selectedOrder.totalAmount.toFixed(2)}</Text>
                  </View>
                </View>

                <TouchableOpacity
                  style={styles.closeButton}
                  onPress={() => setModalVisible(false)}
                >
                  <Text style={styles.closeButtonText}>Close</Text>
                </TouchableOpacity>
              </>
            )}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );

  return (
    <SafeAreaView style={styles.container}>
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

      <View style={styles.headerContainer}>
        <Text style={styles.title}>Manage Orders</Text>

        <TouchableOpacity
          style={styles.dateFilterButton}
          onPress={() => setShowDatePicker(true)}
        >
          <Text style={styles.dateFilterText}>📅 </Text>
          <Text style={styles.dateFilterValue}>
            {selectedDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
          </Text>
        </TouchableOpacity>
      </View>

      <View style={styles.summaryContainer}>
        <Text style={styles.summaryText}>
          Showing {orders.length} orders
        </Text>
      </View>

      <DatePicker
        visible={showDatePicker}
        selectedDate={selectedDate}
        onDateChange={setSelectedDate}
        onClose={() => setShowDatePicker(false)}
      />

      {loading && orders.length === 0 ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#C41E26" />
          <Text style={styles.loadingText}>Loading orders...</Text>
        </View>
      ) : orders.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Ionicons name="clipboard-outline" size={80} color="#999" />
          <Text style={styles.emptyTitle}>No Orders Yet</Text>
          <Text style={styles.emptySubtitle}>
            There are no orders placed{selectedDate ? ' for this date' : ''}.{'\n'}
            {'Check back later or select a different date.'}
          </Text>
          <TouchableOpacity
            style={styles.refreshButton}
            onPress={() => {
              setRefreshing(true);
              fetchOrders().then(() => setRefreshing(false));
            }}
          >
            <Ionicons name="refresh" size={20} color="#FFFFFF" />
            <Text style={styles.refreshButtonText}>Refresh</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={orders}
          renderItem={renderItem}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          onRefresh={() => {
            setRefreshing(true);
            fetchOrders().then(() => setRefreshing(false));
          }}
          refreshing={refreshing}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Ionicons name="clipboard-outline" size={80} color="#999" />
              <Text style={styles.emptyTitle}>No Orders Found</Text>
              <Text style={styles.emptySubtitle}>
                No orders match your current filter.
              </Text>
            </View>
          }
        />
      )}

      {renderOrderDetailsModal()}
      {renderDeliveryAssignmentModal()}
      {renderOrderConfirmDialog()}

      {/* Cancellation Reason Dialog */}
      <Modal
        visible={showCancellationDialog}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowCancellationDialog(false)}
      >
        <View style={styles.rejectionModalOverlay}>
          <View style={styles.rejectionModalContent}>
            <Text style={styles.rejectionModalTitle}>❌ Cancel Order</Text>
            <Text style={styles.rejectionModalSubtitle}>
              Order #{orderToCancel?.orderNumber?.substring(0, 8) || 'N/A'}
            </Text>

            <Text style={styles.rejectionReasonLabel}>Cancellation Reason:</Text>
            <TextInput
              style={styles.rejectionReasonInput}
              placeholder="Enter reason for cancellation..."
              value={cancellationReason}
              onChangeText={setCancellationReason}
              multiline
              numberOfLines={4}
              textAlignVertical="top"
            />

            <View style={styles.rejectionModalActions}>
              <TouchableOpacity
                style={[styles.actionButton, styles.rejectionCancelButton]}
                onPress={() => {
                  setShowCancellationDialog(false);
                  setOrderToCancel(null);
                  setCancellationReason('');
                }}
              >
                <Text style={styles.actionButtonText}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.actionButton, styles.cancelOrderButton]}
                onPress={confirmCancelOrder}
                disabled={!cancellationReason.trim()}
              >
                <Text style={[styles.actionButtonText, !cancellationReason.trim() && styles.disabledText]}>
                  ❌ Cancel Order
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      DatePicker Modal
      <DatePicker
        visible={showDatePicker}
        selectedDate={selectedDate}
        onDateChange={handleDateChange}
        onClose={() => setShowDatePicker(false)}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
    padding: 15,
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
  headerContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
  },
  dateFilterButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  dateFilterText: {
    fontSize: 16,
  },
  dateFilterValue: {
    fontSize: 14,
    color: '#333',
    marginLeft: 4,
  },
  summaryContainer: {
    backgroundColor: '#fff',
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
  },
  summaryText: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#666',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 80,
    paddingHorizontal: 40,
  },
  emptyTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    marginTop: 24,
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginTop: 8,
    marginBottom: 24,
    lineHeight: 22,
  },
  refreshButton: {
    flexDirection: 'row',
    backgroundColor: '#C41E26',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
    gap: 8,
  },
  refreshButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  listContent: {
    paddingBottom: 100,
  },
  orderCard: {
    backgroundColor: '#fff',
    padding: 15,
    borderRadius: 8,
    marginBottom: 15,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  orderHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  status: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
  },
  restaurantName: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 5,
  },
  itemsContainer: {
    marginVertical: 8,
  },
  orderItemRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 4,
  },
  orderItemText: {
    fontSize: 14,
    color: '#666',
  },
  itemText: {
    fontSize: 14,
    color: '#999',
    fontStyle: 'italic',
  },
  totalAmount: {
    fontSize: 16,
    color: '#333',
    fontWeight: 'bold',
    marginTop: 8,
  },
  deliveryAddress: {
    fontSize: 14,
    color: '#666',
    marginTop: 4,
  },
  orderActions: {
    marginTop: 12,
    gap: 8,
  },
  actionRow: {
    flexDirection: 'row',
    gap: 8,
  },
  actionButton: {
    backgroundColor: '#C41E26',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  actionButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  successButton: {
    backgroundColor: '#4CAF50',
    flex: 1,
  },
  rejectButton: {
    backgroundColor: '#F44336',
    flex: 1,
  },
  updateButton: {
    backgroundColor: '#2196F3',
  },
  viewDetailsButton: {
    backgroundColor: '#9E9E9E',
  },
  viewDetailsButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  modalContainer: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    padding: 20,
  },
  modalContent: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 20,
  },
  scrollContent: {
    flexGrow: 1,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 16,
    textAlign: 'center',
  },
  modalSubtitle: {
    fontSize: 16,
    color: '#666',
    marginBottom: 16,
    textAlign: 'center',
  },
  deliveryPersonsList: {
    marginVertical: 10,
  },
  assignLabel: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
    color: '#333',
  },
  deliveryPersonOption: {
    backgroundColor: '#f0f0f0',
    padding: 12,
    marginVertical: 4,
    borderRadius: 8,
  },
  selectedDeliveryPerson: {
    backgroundColor: '#4CAF50',
  },
  deliveryPersonRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  deliveryPersonAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginRight: 10,
  },
  deliveryPersonAvatarPlaceholder: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#C41E26',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  deliveryPersonAvatarText: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 16,
  },
  deliveryPersonInfo: {
    flex: 1,
  },
  deliveryPersonName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  deliveryPersonNameSelected: {
    color: '#fff',
  },
  deliveryPersonStatus: {
    fontSize: 14,
    marginTop: 4,
  },
  statusBusy: {
    color: '#F44336',
  },
  statusFree: {
    color: '#4CAF50',
  },
  noDeliveryPersonsText: {
    textAlign: 'center',
    color: '#999',
    padding: 20,
  },
  modalActions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 16,
  },
  cancelButton: {
    backgroundColor: '#9E9E9E',
    flex: 1,
  },
  confirmButton: {
    backgroundColor: '#4CAF50',
    flex: 1,
  },
  confirmButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  detailLabel: {
    fontSize: 14,
    color: '#666',
    fontWeight: '500',
  },
  detailValue: {
    fontSize: 14,
    color: '#333',
    flex: 1,
    marginLeft: 10,
  },
  itemsTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginTop: 16,
    marginBottom: 8,
  },
  itemRow: {
    flexDirection: 'row',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  itemImageContainer: {
    width: 60,
    height: 60,
    borderRadius: 8,
    backgroundColor: '#f0f0f0',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  itemImage: {
    width: '100%',
    height: '100%',
    borderRadius: 8,
  },
  itemImagePlaceholder: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  itemImagePlaceholderText: {
    fontSize: 10,
    color: '#999',
    textAlign: 'center',
  },
  itemDetailsContainer: {
    flex: 1,
    justifyContent: 'center',
  },
  itemPrice: {
    fontSize: 14,
    color: '#4CAF50',
    fontWeight: '600',
    marginTop: 4,
  },
  pricingSection: {
    backgroundColor: '#f8f8f8',
    padding: 16,
    borderRadius: 8,
    marginTop: 16,
  },
  pricingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
  },
  pricingLabel: {
    fontSize: 14,
    color: '#666',
  },
  pricingValue: {
    fontSize: 14,
    color: '#333',
    fontWeight: '600',
  },
  totalPricingRow: {
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
    paddingTop: 12,
    marginTop: 4,
  },
  totalPricingLabel: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
  },
  totalPricingValue: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#C41E26',
  },
  closeButton: {
    backgroundColor: '#C41E26',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 20,
  },
  closeButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  mapContainer: {
    width: '100%',
    height: 300,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: '#f0f0f0',
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  realtimeIndicator: {
    position: 'absolute',
    top: 10,
    right: 10,
    backgroundColor: 'rgba(76, 175, 80, 0.9)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    zIndex: 1000,
  },
  realtimeText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  // Rejection dialog styles
  rejectionModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  rejectionModalContent: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 24,
    width: '90%',
    maxWidth: 400,
  },
  rejectionModalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1A1A1A',
    marginBottom: 8,
  },
  rejectionModalSubtitle: {
    fontSize: 14,
    color: '#666',
    marginBottom: 20,
  },
  rejectionReasonLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1A1A1A',
    marginBottom: 8,
  },
  rejectionReasonInput: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    fontSize: 14,
    minHeight: 100,
    backgroundColor: '#fff',
    marginBottom: 20,
  },
  rejectionModalActions: {
    flexDirection: 'row',
    gap: 12,
  },
  rejectionCancelButton: {
    backgroundColor: '#9E9E9E',
    flex: 1,
  },
  disabledText: {
    opacity: 0.5,
  },
  // New styles for confirmed order buttons
  assignButton: {
    backgroundColor: '#2196F3',
    flex: 1,
  },
  reassignButton: {
    backgroundColor: '#FF9800',
    flex: 1,
  },
  cancelOrderButton: {
    backgroundColor: '#F44336',
    flex: 1,
  },
  deliveryPersonText: {
    fontSize: 12,
    color: '#666',
    marginTop: 8,
    fontStyle: 'italic',
  },
});

export default function OrdersScreen() {
  return <OrdersScreenContent />;
}