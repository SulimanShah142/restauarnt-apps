import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator, Alert, TouchableOpacity, Image, FlatList, RefreshControl, Linking } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { RequireAuth } from '@/contexts/AuthContext';
import { adminApiService } from '@/lib/admin-api-service';
import DrawerLayout from '@/components/DrawerLayout';
import DatePicker from '@/components/DatePicker';
import { getDeliverySettings } from '@/lib/delivery-calculator';  // Added for delivery fee

interface DeliveryPerson {
  id: string;
  user_id?: string;
  name: string;
  email: string;
  phone?: string;
  is_available: boolean;
  vehicle_type?: string;
  license_plate?: string;
  rating?: number;
  total_deliveries?: number;
  image_url?: string;
  current_latitude?: number;
  current_longitude?: number;
  created_at: string;
  updated_at: string;
}

interface Order {
  id: string;
  order_number: string;
  status: string;
  total_amount: number;
  delivery_fee: number;
  tip_amount?: number;
  created_at: string;
  delivery_address: string;
  customer_name?: string;
  customer_phone?: string;
  restaurant_name?: string;
  restaurant_address?: string;
  is_completed?: boolean;
  items?: Array<{
    id: string;
    name: string;
    quantity: number;
    price: number;
    image_url?: string;
  }>;
}

interface OrderStatistics {
  totalOrders: number;
  pendingOrders?: number;
  deliveredOrders?: number;
  completedOrders?: number;
  cancelledOrders?: number;
  totalEarnings: number;
  todayEarnings?: number;  // New: Total earnings for the selected day
  averageRating?: number;
  todayOrders?: number;
  weekOrders?: number;
  monthOrders?: number;
}

function DeliveryPersonDetailContent() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();


  const [deliveryPerson, setDeliveryPerson] = useState<DeliveryPerson | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<'overview' | 'orders'>('overview');
  const [statistics, setStatistics] = useState<OrderStatistics>({
    totalOrders: 0,
    totalEarnings: 0,
  });
  const [deliverySettings, setDeliverySettings] = useState<{
    constant_delivery_fee: number;
    is_delivery_enabled: boolean;
  } | null>(null);

  // Date filtering state
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [allOrders, setAllOrders] = useState<Order[]>([]);

  useEffect(() => {
    
    if (id) {
      loadDeliveryPersonData();
    } else {
      setLoading(false);
    }
  }, [id]);

  const loadDeliveryPersonData = async () => {

    try {

      // Fetch delivery settings from app_settings
      const settings = await getDeliverySettings(supabase);
      setDeliverySettings(settings);

      // Fetch delivery person details with explicit column selection
      const { data: dpData, error: dpError } = await supabase
        .from('delivery_persons')
        .select(`
          id,
          user_id,
          name,
          email,
          phone,
          is_available,
          vehicle_type,
          license_plate,
          rating,
          total_deliveries,
          image_url,
          current_latitude,
          current_longitude,
          created_at,
          updated_at
        `)
        .eq('id', id)
        .maybeSingle();


      if (dpError) {
        console.error('[DeliveryPersonDetail] Error fetching delivery person:', dpError);
        Alert.alert('Error', 'Failed to load delivery person details');
        return;
      }

      if (!dpData) {
        console.error('[DeliveryPersonDetail] Delivery person not found');
        return;
      }

      setDeliveryPerson(dpData);

      // Fetch all orders assigned to this delivery person using delivery_persons.id
      await loadOrdersByDeliveryPersonId(dpData.id);

    } catch (error) {
      console.error('[DeliveryPersonDetail] Error loading data:', error);
      Alert.alert('Error', 'Failed to load delivery person data');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const loadOrders = async (userId?: string) => {
    if (!userId) {
      // Try using the delivery_persons.id directly
      await loadOrdersByDeliveryPersonId(id);
      return;
    }

    try {

      // Fetch orders WITHOUT any joins to avoid relationship ambiguity
      // We'll fetch restaurant names separately if needed
      const { data: ordersData, error: ordersError } = await supabase
        .from('orders')
        .select(`
          id,
          order_number,
          status,
          total_amount,
          delivery_fee,
          tip_amount,
          created_at,
          delivery_address,
          customer_name,
          customer_phone,
          restaurant_id
        `)
        .eq('delivery_person_id', userId)
        .order('created_at', { ascending: false });

      if (ordersError) {
        console.error('[DeliveryPersonDetail] Error fetching orders:', ordersError);
        return;
      }


      // Fetch restaurant names separately to avoid join issues
      const restaurantIds = [...new Set(ordersData.map(o => o.restaurant_id).filter(Boolean))];
      const restaurantMap = new Map<string, string>();
      
      if (restaurantIds.length > 0) {
        const { data: restaurantsData } = await supabase
          .from('restaurants')
          .select('id, name')
          .in('id', restaurantIds);
        
        if (restaurantsData) {
          restaurantsData.forEach(r => restaurantMap.set(r.id, r.name));
        }
      }

      const transformedOrders: Order[] = (ordersData || []).map(order => {
        // Get delivery fee from settings instead of order table
        const deliveryFeeFromSettings = deliverySettings?.constant_delivery_fee || 50.00;
        
        return {
          id: order.id,
          order_number: order.order_number || order.id.substring(0, 8),
          status: order.status,
          total_amount: parseFloat(order.total_amount?.toString() || '0'),
          delivery_fee: deliveryFeeFromSettings,  // Use fee from settings
          tip_amount: order.tip_amount ? parseFloat(order.tip_amount.toString()) : 0,
          created_at: order.created_at,
          delivery_address: order.delivery_address || 'N/A',
          customer_name: order.customer_name || 'Unknown Customer',
          customer_phone: order.customer_phone || 'N/A',
          restaurant_name: restaurantMap.get(order.restaurant_id) || 'Unknown Restaurant'
        };
      });

      
      // Store ALL orders
      setAllOrders(transformedOrders);
      
      // Filter by selected date
      filterOrdersByDate(transformedOrders, selectedDate);
    } catch (error) {
      console.error('[DeliveryPersonDetail] Error loading orders:', error);
    }
  };

  const loadOrdersByDeliveryPersonId = async (deliveryPersonId?: string) => {
    if (!deliveryPersonId) return;

    try {

      // Note: Using !inner hint to prevent auto-expansion of foreign keys
      const { data: ordersData, error: ordersError } = await supabase
        .from('orders')
        .select(`
          id,
          order_number,
          status,
          total_amount,
          delivery_fee,
          tip_amount,
          created_at,
          delivery_address,
          customer_name,
          customer_phone,
          restaurant_id,
          restaurants!inner (
            name
          ),
          order_items (
            id,
            quantity,
            price,
            menu_item_name,
            menu_item_image_url
          )
        `)
        .eq('delivery_person_id', deliveryPersonId)
        .order('created_at', { ascending: false });

      if (ordersError) {
        console.error('[DeliveryPersonDetail] Error fetching orders:', ordersError);
        return;
      }


      const transformedOrders: Order[] = (ordersData || []).map(order => ({
        id: order.id,
        order_number: order.order_number || order.id.substring(0, 8),
        status: order.status,
        total_amount: parseFloat(order.total_amount?.toString() || '0'),
        delivery_fee: parseFloat(order.delivery_fee?.toString() || '0'),
        tip_amount: order.tip_amount ? parseFloat(order.tip_amount.toString()) : 0,
        created_at: order.created_at,
        delivery_address: order.delivery_address || 'N/A',
        customer_name: order.customer_name || 'Unknown Customer',
        customer_phone: order.customer_phone || 'N/A',
        restaurant_name: (order.restaurants as any[])?.[0]?.name || 'Unknown Restaurant',
        items: order.order_items?.map(item => ({
          id: item.id,
          name: item.menu_item_name || 'Unknown Item',
          quantity: item.quantity || 1,
          price: parseFloat(item.price?.toString() || '0'),
          image_url: item.menu_item_image_url
        }))
      }));


      // Store ALL orders
      setAllOrders(transformedOrders);

      // Filter by selected date
      filterOrdersByDate(transformedOrders, selectedDate);
    } catch (error) {
      console.error('[DeliveryPersonDetail] Error loading orders:', error);
    }
  };

  // Filter orders by selected date
  const filterOrdersByDate = (allOrdersData: Order[], date: Date) => {
    // Get the selected date components in local time
    const selectedYear = date.getFullYear();
    const selectedMonth = date.getMonth();
    const selectedDay = date.getDate();


    const filtered = allOrdersData.filter((order, index) => {
      if (!order.created_at) {
        return false;
      }
      
      // Parse the created_at date - it's in UTC, convert to local date components
      const orderDate = new Date(order.created_at);
      const orderYear = orderDate.getFullYear();
      const orderMonth = orderDate.getMonth();
      const orderDay = orderDate.getDate();
      
      // Log the first 3 orders for debugging
      if (index < 3) {
      }
      
      // Compare year, month, and day (all in local timezone)
      const isDateMatch = orderYear === selectedYear && orderMonth === selectedMonth && orderDay === selectedDay;
      return isDateMatch;
    });

    setOrders(filtered);
  };

  // Handle date change from DatePicker
  const handleDateChange = (newDate: Date) => {
    // Ensure we're using the date at midnight local time to avoid timezone issues
    const normalizedDate = new Date(newDate.getFullYear(), newDate.getMonth(), newDate.getDate());

    setSelectedDate(normalizedDate);
    filterOrdersByDate(allOrders, normalizedDate);
    calculateDailyEarnings(normalizedDate);  // Calculate earnings for selected date
    setShowDatePicker(false);
  };

  // Calculate earnings for a specific date
  const calculateDailyEarnings = (date: Date) => {
    if (!allOrders || allOrders.length === 0) return;

    const selectedYear = date.getFullYear();
    const selectedMonth = date.getMonth();
    const selectedDay = date.getDate();

    let dailyEarnings = 0;

    allOrders.forEach(order => {
      if (!order.created_at) return;

      const orderDate = new Date(order.created_at);
      const orderYear = orderDate.getFullYear();
      const orderMonth = orderDate.getMonth();
      const orderDay = orderDate.getDate();

      // Check if order is from the selected date and is delivered
      if (orderYear === selectedYear && orderMonth === selectedMonth && orderDay === selectedDay && order.status === 'delivered') {
        const deliveryFee = parseFloat(order.delivery_fee?.toString() || '0');
        const tip = parseFloat(order.tip_amount?.toString() || '0');
        dailyEarnings += deliveryFee + tip;
      }
    });

    
    // Update statistics with daily earnings
    setStatistics(prev => ({
      ...prev,
      todayEarnings: dailyEarnings
    }));
  };

  const calculateStatistics = async (userId?: string) => {
    if (!userId) {
      await calculateStatisticsByDeliveryPersonId(id);
      return;
    }

    try {

      // Get all orders for this delivery person
      const { data: allOrders } = await supabase
        .from('orders')
        .select('status, total_amount, delivery_fee, tip_amount, created_at')
        .eq('delivery_person_id', userId);

      if (!allOrders) {
        setStatistics({
          totalOrders: 0,
          pendingOrders: 0,
          deliveredOrders: 0,
          totalEarnings: 0
        });
        return;
      }

      let totalEarnings = 0;
      let pendingOrders = 0;
      let deliveredOrders = 0;

      allOrders.forEach(order => {
        const deliveryFee = parseFloat(order.delivery_fee?.toString() || '0');
        const tip = parseFloat(order.tip_amount?.toString() || '0');
        
        if (order.status === 'delivered') {
          deliveredOrders++;
          totalEarnings += deliveryFee + tip;
        } else if (['pending', 'confirmed', 'preparing', 'ready'].includes(order.status)) {
          pendingOrders++;
        }
      });

      const stats: OrderStatistics = {
        totalOrders: allOrders.length,
        pendingOrders,
        deliveredOrders,
        totalEarnings
      };

      setStatistics(stats);
    } catch (error) {
      console.error('[DeliveryPersonDetail] Error calculating statistics:', error);
    }
  };

  const calculateStatisticsByDeliveryPersonId = async (deliveryPersonId?: string) => {
    if (!deliveryPersonId) return;

    try {

      // Get all orders for this delivery person - using explicit column selection
      // Note: Not joining with any tables to avoid relationship ambiguity
      const { data: allOrders } = await supabase
        .from('orders')
        .select('status, total_amount, delivery_fee, tip_amount, created_at')
        .eq('delivery_person_id', deliveryPersonId);

      if (!allOrders) {
        setStatistics({
          totalOrders: 0,
          completedOrders: 0,
          cancelledOrders: 0,
          totalEarnings: 0,
          todayEarnings: 0,
          averageRating: 0,
          todayOrders: 0,
          weekOrders: 0,
          monthOrders: 0
        });
        return;
      }

      const now = new Date();
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const weekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
      const monthAgo = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);

      let totalEarnings = 0;
      let todayEarnings = 0;  // Earnings for today
      let completedOrders = 0;
      let cancelledOrders = 0;
      let todayOrders = 0;
      let weekOrders = 0;
      let monthOrders = 0;

      allOrders.forEach(order => {
        const orderDate = new Date(order.created_at);
        // Calculate earnings as delivery_fee + tip for delivered orders
        const deliveryFee = parseFloat(order.delivery_fee?.toString() || '0');
        const tip = parseFloat(order.tip_amount?.toString() || '0');

        if (order.status === 'delivered') {
          completedOrders++;
          totalEarnings += deliveryFee + tip;
          
          // Add to today's earnings if order was delivered today
          if (orderDate >= today) {
            todayEarnings += deliveryFee + tip;
          }
        } else if (order.status === 'cancelled') {
          cancelledOrders++;
        }

        if (orderDate >= today) {
          todayOrders++;
        }
        if (orderDate >= weekAgo) {
          weekOrders++;
        }
        if (orderDate >= monthAgo) {
          monthOrders++;
        }
      });

      const stats: OrderStatistics = {
        totalOrders: allOrders.length,
        completedOrders,
        cancelledOrders,
        totalEarnings,
        todayEarnings,  // Add today's earnings
        averageRating: 0,
        todayOrders,
        weekOrders,
        monthOrders
      };

      setStatistics(stats);
    } catch (error) {
      console.error('[DeliveryPersonDetail] Error calculating statistics:', error);
    }
  };

  const handleRefresh = () => {
    setRefreshing(true);
    loadDeliveryPersonData();
  };

  const toggleAvailability = async () => {
    if (!deliveryPerson) return;

    try {
      const newAvailability = !deliveryPerson.is_available;
      
      const { error } = await supabase
        .from('delivery_persons')
        .update({ 
          is_available: newAvailability,
          updated_at: new Date().toISOString()
        })
        .eq('id', deliveryPerson.id);

      if (error) throw error;

      setDeliveryPerson({
        ...deliveryPerson,
        is_available: newAvailability
      });

      Alert.alert('Success', `Delivery person is now ${newAvailability ? 'available' : 'unavailable'}`);
    } catch (error) {
      console.error('Error toggling availability:', error);
      Alert.alert('Error', 'Failed to update availability');
    }
  };

  const renderOrderCard = ({ item }: { item: Order }) => {
    const isDelivered = item.status === 'delivered';

    // Shrunk card for delivered orders (matching deliver app style)
    if (isDelivered) {
      return (
        <View style={[styles.orderCard, styles.deliveredOrderCard]}>
          <View style={styles.deliveredHeader}>
            <Text style={styles.deliveredStatus}>✅ Delivered</Text>
            <Text style={styles.deliveredAmount}>AFG {(item.total_amount || 0).toFixed(2)}</Text>
          </View>
          
          {/* Order Items with Images */}
          {item.items && item.items.length > 0 && (
            <View style={styles.deliveredItemsContainer}>
              {item.items.slice(0, 3).map((orderItem, idx) => (
                <View key={orderItem.id || idx} style={styles.menuItemCard}>
                  {orderItem.image_url ? (
                    <Image source={{ uri: orderItem.image_url }} style={styles.menuItemImage} resizeMode="cover" />
                  ) : (
                    <View style={styles.menuItemImagePlaceholder}>
                      <Text style={styles.menuItemImagePlaceholderText}>🍽️</Text>
                    </View>
                  )}
                  <View style={styles.menuItemInfo}>
                    <Text style={styles.menuItemName}>{orderItem.quantity}x {orderItem.name}</Text>
                  </View>
                </View>
              ))}
              {item.items.length > 3 && (
                <Text style={styles.moreItemsText}>+ {item.items.length - 3} more items</Text>
              )}
            </View>
          )}
          
          <View style={styles.deliveredInfo}>
            <Text style={styles.deliveredLabel}>📍 {item.delivery_address}</Text>
            {item.customer_phone && item.customer_phone !== 'N/A' && (
              <View style={styles.deliveredPhoneRow}>
                <Text style={styles.deliveredPhone}>📱 {item.customer_phone}</Text>
                <TouchableOpacity
                  style={styles.deliveredCallButton}
                  onPress={() => Linking.openURL(`tel:${item.customer_phone}`)}
                >
                  <Text style={styles.deliveredCallButtonText}>📞 Call</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
          {item.is_completed && (
            <View style={styles.completedMessage}>
              <Text style={styles.completedMessageText}>✅ Order Completed</Text>
            </View>
          )}
        </View>
      );
    }

    // Full card for active orders (matching deliver app style)
    return (
      <View style={styles.orderCard}>
        <View style={styles.orderHeader}>
          <Text style={styles.orderStatus}>{item.status.replace('_', ' ').toUpperCase()}</Text>
        </View>

        <View style={styles.orderDetails}>
          {/* Restaurant Info */}
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>🏪 Restaurant:</Text>
            <Text style={styles.infoValue}>{item.restaurant_name}</Text>
          </View>

          {/* Order Items with Images */}
          {item.items && item.items.length > 0 ? (
            <View style={styles.itemsContainer}>
              <Text style={styles.itemsLabel}>📋 Order Items:</Text>
              {item.items.map((orderItem, idx) => (
                <View key={orderItem.id || idx} style={styles.menuItemCard}>
                  {orderItem.image_url ? (
                    <Image source={{ uri: orderItem.image_url }} style={styles.menuItemImage} resizeMode="cover" />
                  ) : (
                    <View style={styles.menuItemImagePlaceholder}>
                      <Text style={styles.menuItemImagePlaceholderText}>🍽️</Text>
                    </View>
                  )}
                  <View style={styles.menuItemInfo}>
                    <Text style={styles.menuItemName}>{orderItem.quantity}x {orderItem.name}</Text>
                    <Text style={styles.menuItemQuantity}>Qty: x{orderItem.quantity}</Text>
                    <Text style={styles.menuItemPrice}>AFG {(orderItem.price * orderItem.quantity).toFixed(2)}</Text>
                  </View>
                </View>
              ))}
            </View>
          ) : (
            <Text style={styles.noItemsText}>No items in this order</Text>
          )}

          {/* Customer Info */}
          <View style={styles.customerRow}>
            <View>
              <Text style={styles.customerLabel}>👤 Customer:</Text>
              <Text style={styles.customerName}>{item.customer_name}</Text>
            </View>
            {item.customer_phone && item.customer_phone !== 'N/A' && (
              <TouchableOpacity
                style={styles.callButton}
                onPress={() => Linking.openURL(`tel:${item.customer_phone}`)}
              >
                <Text style={styles.callButtonText}>📞 Call</Text>
              </TouchableOpacity>
            )}
          </View>
          {item.customer_phone && item.customer_phone !== 'N/A' && (
            <Text style={styles.phoneText}>📱 {item.customer_phone}</Text>
          )}

          {/* Delivery Address */}
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>📍 Delivery Address:</Text>
            <Text style={styles.addressValue}>{item.delivery_address}</Text>
          </View>

          {/* Delivery Fee */}
          <View style={styles.feeRow}>
            <Text style={styles.feeLabel}>💰 Delivery Fee:</Text>
            <Text style={[styles.feeValue, styles.amountValue]}>
              AFG {(item.delivery_fee || 0).toFixed(2)}
            </Text>
          </View>

          {/* Order Total */}
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>📦 Order Total:</Text>
            <Text style={[styles.totalValue, styles.amountValue]}>
              AFG {(item.total_amount || 0).toFixed(2)}
            </Text>
          </View>
        </View>
      </View>
    );
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color="#C41E26" />
          <Text style={styles.loadingText}>Loading delivery person details...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!deliveryPerson) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.centerContainer}>
          <Text style={styles.noDataText}>Delivery person not found</Text>
          <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
            <Text style={styles.backButtonText}>← Go Back</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }


  // Check which render path we're taking
  if (loading) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color="#C41E26" />
          <Text style={styles.loadingText}>Loading delivery person details...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!deliveryPerson) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.centerContainer}>
          <Text style={styles.noDataText}>Delivery person not found</Text>
          <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
            <Text style={styles.backButtonText}>← Go Back</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }


  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      {/* Back Button */}
      <View style={styles.backButtonContainer}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Text style={styles.backButtonText}>← Back</Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor="#C41E26"
          />
        }
      >
        {/* Header with Profile Picture */}
        <View style={styles.header}>
          <View style={styles.profileContainer}>
            {deliveryPerson.image_url ? (
              <Image source={{ uri: deliveryPerson.image_url }} style={styles.profileImage} />
            ) : (
              <View style={styles.profileImagePlaceholder}>
                <Text style={styles.profileInitials}>
                  {deliveryPerson.name.charAt(0).toUpperCase()}
                </Text>
              </View>
            )}
            <View style={styles.profileInfo}>
              <Text style={styles.profileName}>{deliveryPerson.name}</Text>
              <Text style={styles.profileEmail}>{deliveryPerson.email}</Text>
              {deliveryPerson.phone && (
                <Text style={styles.profilePhone}>📞 {deliveryPerson.phone}</Text>
              )}
            </View>
          </View>

          <View style={styles.availabilityContainer}>
            <Text style={styles.availabilityLabel}>Status:</Text>
            <View style={[
              styles.statusIndicator,
              deliveryPerson.is_available ? styles.availableIndicator : styles.unavailableIndicator
            ]}>
              <Text style={styles.statusText}>
                {deliveryPerson.is_available ? '🟢 Available' : '🔴 Unavailable'}
              </Text>
            </View>
            <TouchableOpacity style={styles.toggleButton} onPress={toggleAvailability}>
              <Text style={styles.toggleButtonText}>Toggle Status</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Vehicle Info Card */}
        <View style={styles.vehicleCard}>
          <Text style={styles.vehicleCardLabel}>🚗 Vehicle Information</Text>
          <Text style={styles.vehicleCardValue}>{deliveryPerson.vehicle_type || 'Not set'}</Text>
          {deliveryPerson.license_plate && (
            <Text style={styles.vehicleCardSubValue}>🔖 {deliveryPerson.license_plate}</Text>
          )}
        </View>

        {/* Statistics Summary */}
        <View style={styles.statsContainer}>
          {/* Daily Earnings - Highlighted */}
          <View style={styles.dailyEarningsCard}>
            <Text style={styles.dailyEarningsLabel}>💰 Today's Earnings ({selectedDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })})</Text>
            <Text style={styles.dailyEarningsValue}>AFG {(statistics.todayEarnings || 0).toFixed(2)}</Text>
            <Text style={styles.dailyEarningsSubtext}>From {orders.filter(o => o.status === 'delivered').length} delivered order{orders.filter(o => o.status === 'delivered').length !== 1 ? 's' : ''}</Text>
          </View>

          <View style={styles.statRow}>
            <View style={styles.statCard}>
              <Text style={styles.statLabel}>📦 Total Orders</Text>
              <Text style={styles.statValue}>{statistics.totalOrders}</Text>
            </View>
            <View style={styles.statCard}>
              <Text style={styles.statLabel}>✅ Completed</Text>
              <Text style={[styles.statValue, { color: '#4CAF50' }]}>{statistics.completedOrders}</Text>
            </View>
          </View>
          <View style={styles.statRow}>
            <View style={styles.statCard}>
              <Text style={styles.statLabel}>💵 Lifetime Earnings</Text>
              <Text style={[styles.statValue, { color: '#C41E26' }]}>AFG {statistics.totalEarnings.toFixed(2)}</Text>
            </View>
            <View style={styles.statCard}>
              <Text style={styles.statLabel}>❌ Cancelled</Text>
              <Text style={[styles.statValue, { color: '#C41E26' }]}>{statistics.cancelledOrders}</Text>
            </View>
          </View>
        </View>

        {/* Orders Section */}
        <View style={styles.section}>
          <View style={styles.ordersHeader}>
            <Text style={styles.sectionTitle}>📦 All Assigned Orders</Text>
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

          {/* Orders count summary */}
          <View style={styles.summaryContainer}>
            <Text style={styles.summaryText}>
              📅 {selectedDate.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
            </Text>
            <Text style={[styles.summaryText, styles.summarySubtext]}>
              Showing {orders.length} orders
            </Text>
          </View>

          {orders.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyIcon}>📅</Text>
              <Text style={styles.emptyText}>No orders on {selectedDate.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}</Text>
              <TouchableOpacity style={styles.changeDateButtonSmall} onPress={() => setShowDatePicker(true)}>
                <Text style={styles.changeDateButtonTextSmall}>📅 Select Another Date</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <FlatList
              data={orders}
              renderItem={renderOrderCard}
              keyExtractor={(item) => item.id}
              scrollEnabled={false}
              contentContainerStyle={styles.ordersList}
            />
          )}
        </View>

        {/* Date Picker Modal */}
        <DatePicker
          visible={showDatePicker}
          selectedDate={selectedDate}
          onDateChange={handleDateChange}
          onClose={() => setShowDatePicker(false)}
        />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  safeArea: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 100,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
    color: '#666',
  },
  noDataText: {
    fontSize: 18,
    color: '#666',
    marginBottom: 20,
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
    backgroundColor: 'white',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  profileContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  profileImage: {
    width: 80,
    height: 80,
    borderRadius: 40,
    marginRight: 15,
  },
  profileImagePlaceholder: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#C41E26',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 15,
  },
  profileInitials: {
    fontSize: 32,
    color: 'white',
    fontWeight: 'bold',
  },
  profileInfo: {
    flex: 1,
  },
  profileName: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
  },
  profileEmail: {
    fontSize: 14,
    color: '#666',
    marginBottom: 4,
  },
  profilePhone: {
    fontSize: 14,
    color: '#C41E26',
  },
  availabilityContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#f9f9f9',
    padding: 12,
    borderRadius: 8,
  },
  availabilityLabel: {
    fontSize: 14,
    color: '#666',
    fontWeight: '600',
  },
  statusIndicator: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  availableIndicator: {
    backgroundColor: '#E8F5E9',
  },
  unavailableIndicator: {
    backgroundColor: '#FFEBEE',
  },
  statusText: {
    fontSize: 13,
    fontWeight: '600',
  },
  toggleButton: {
    backgroundColor: '#C41E26',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  toggleButtonText: {
    color: 'white',
    fontSize: 12,
    fontWeight: '600',
  },
  infoCards: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    backgroundColor: 'white',
    padding: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  infoCard: {
    alignItems: 'center',
    flex: 1,
  },
  infoCardLabel: {
    fontSize: 12,
    color: '#666',
    marginBottom: 4,
  },
  infoCardValue: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
  },
  infoCardSubValue: {
    fontSize: 11,
    color: '#999',
    marginTop: 2,
  },
  section: {
    backgroundColor: 'white',
    margin: 15,
    marginBottom: 0,
    padding: 15,
    borderRadius: 12,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 15,
  },
  ordersHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
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
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  dateFilterText: {
    fontSize: 16,
    marginRight: 4,
  },
  dateFilterValue: {
    fontSize: 12,
    fontWeight: '600',
    color: '#333',
  },
  summaryContainer: {
    marginBottom: 10,
    paddingVertical: 6,
    paddingHorizontal: 10,
    backgroundColor: '#f0f0f0',
    borderRadius: 6,
  },
  summaryText: {
    fontSize: 12,
    color: '#666',
    fontWeight: '500',
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  simpleStatsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 15,
  },
  simpleStatCard: {
    backgroundColor: '#f9f9f9',
    padding: 15,
    borderRadius: 10,
    alignItems: 'center',
    minWidth: 100,
  },
  simpleStatValue: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#333',
  },
  pendingValue: {
    color: '#FF9800',
  },
  deliveredValue: {
    color: '#4CAF50',
  },
  simpleStatLabel: {
    fontSize: 12,
    color: '#666',
    textAlign: 'center',
    marginTop: 5,
  },
  simpleEarningsCard: {
    backgroundColor: '#E8F5E9',
    padding: 20,
    borderRadius: 10,
    alignItems: 'center',
  },
  simpleEarningsLabel: {
    fontSize: 14,
    color: '#2E7D32',
    marginBottom: 8,
  },
  simpleEarningsValue: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#2E7D32',
  },
  breakdownLabel: {
    fontSize: 13,
    color: '#666',
  },
  breakdownValue: {
    fontSize: 13,
    color: '#333',
    fontWeight: '600',
  },
  tipsValue: {
    fontSize: 13,
    color: '#4CAF50',
    fontWeight: '600',
  },
  tabsContainer: {
    flexDirection: 'row',
    backgroundColor: 'white',
    marginHorizontal: 15,
    marginTop: 15,
    borderRadius: 8,
    overflow: 'hidden',
  },
  tab: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
  },
  activeTab: {
    backgroundColor: '#C41E26',
  },
  tabText: {
    fontSize: 14,
    color: '#666',
    fontWeight: '600',
  },
  activeTabText: {
    color: 'white',
  },
  ordersList: {
    flexGrow: 1,
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 100,
  },
  orderCard: {
    backgroundColor: '#f9f9f9',
    borderRadius: 8,
    padding: 15,
    marginBottom: 10,
  },
  orderHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  orderNumber: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
  },
  orderRestaurant: {
    fontSize: 13,
    color: '#666',
    marginTop: 2,
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  deliveredBadge: {
    backgroundColor: '#E8F5E9',
  },
  cancelledBadge: {
    backgroundColor: '#FFEBEE',
  },
  pendingBadge: {
    backgroundColor: '#FFF3E0',
  },
  orderStatusText: {
    fontSize: 11,
    fontWeight: '600',
  },
  orderDetails: {
    marginBottom: 12,
  },
  detailRow: {
    flexDirection: 'row',
    marginBottom: 6,
  },
  detailLabel: {
    fontSize: 12,
    color: '#666',
    width: 100,
    fontWeight: '500',
  },
  detailValue: {
    fontSize: 12,
    color: '#333',
    flex: 1,
  },
  orderFinancials: {
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
    paddingTop: 10,
  },
  financialRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  financialLabel: {
    fontSize: 12,
    color: '#666',
  },
  financialValue: {
    fontSize: 12,
    color: '#333',
    fontWeight: '600',
  },
  tipValue: {
    fontSize: 12,
    color: '#4CAF50',
    fontWeight: '600',
  },
  totalRow: {
    marginTop: 6,
    paddingTop: 6,
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
  },
  totalLabel: {
    fontSize: 13,
    color: '#333',
    fontWeight: 'bold',
  },
  totalValue: {
    fontSize: 14,
    color: '#C41E26',
    fontWeight: 'bold',
  },
  feeRow: {
    marginTop: 6,
    paddingTop: 6,
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
  },
  feeLabel: {
    fontSize: 13,
    color: '#333',
    fontWeight: '600',
  },
  feeValue: {
    fontSize: 14,
    color: '#4CAF50',
    fontWeight: '600',
  },
  emptyState: {
    padding: 30,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 16,
    color: '#999',
    textAlign: 'center',
  },
  recentOrderCard: {
    backgroundColor: '#f9f9f9',
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
  },
  recentOrderHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  recentOrderNumber: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#333',
  },
  recentOrderStatus: {
    fontSize: 12,
    fontWeight: '600',
  },
  deliveredText: {
    color: '#4CAF50',
  },
  cancelledText: {
    color: '#C41E26',
  },
  recentOrderRestaurant: {
    fontSize: 13,
    color: '#666',
    marginBottom: 4,
  },
  recentOrderEarnings: {
    fontSize: 13,
    color: '#C41E26',
    fontWeight: '600',
  },
  viewAllButton: {
    alignItems: 'center',
    padding: 12,
    marginTop: 8,
  },
  viewAllButtonText: {
    fontSize: 14,
    color: '#C41E26',
    fontWeight: '600',
  },
  // Missing styles for delivered order card
  deliveredOrderCard: {
    backgroundColor: '#f0f0f0',
    padding: 10,
  },
  deliveredHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  deliveredStatus: {
    fontSize: 13,
    color: '#4CAF50',
    fontWeight: '600',
  },
  deliveredAmount: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#333',
  },
  deliveredInfo: {
    marginBottom: 6,
  },
  deliveredLabel: {
    fontSize: 12,
    color: '#666',
    marginBottom: 4,
  },
  deliveredPhoneRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 4,
  },
  deliveredPhone: {
    fontSize: 12,
    color: '#C41E26',
  },
  deliveredCallButton: {
    backgroundColor: '#C41E26',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
  },
  deliveredCallButtonText: {
    color: 'white',
    fontSize: 11,
    fontWeight: '600',
  },
  completedMessage: {
    backgroundColor: '#E8F5E9',
    padding: 8,
    borderRadius: 6,
    alignItems: 'center',
    marginTop: 8,
  },
  completedMessageText: {
    fontSize: 12,
    color: '#2E7D32',
    fontWeight: '600',
  },
  deliveredItemsContainer: {
    marginBottom: 10,
  },
  // Missing styles for order card
  orderStatus: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#C41E26',
  },
  infoRow: {
    flexDirection: 'row',
    marginBottom: 8,
  },
  infoLabel: {
    fontSize: 12,
    color: '#666',
    fontWeight: '500',
    marginRight: 8,
  },
  infoValue: {
    fontSize: 12,
    color: '#333',
    flex: 1,
  },
  customerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  customerLabel: {
    fontSize: 12,
    color: '#666',
    marginBottom: 2,
  },
  customerName: {
    fontSize: 13,
    color: '#333',
    fontWeight: '500',
  },
  callButton: {
    backgroundColor: '#C41E26',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  callButtonText: {
    color: 'white',
    fontSize: 12,
    fontWeight: '600',
  },
  phoneText: {
    fontSize: 12,
    color: '#C41E26',
    marginBottom: 8,
  },
  addressValue: {
    fontSize: 12,
    color: '#333',
    flex: 1,
  },
  amountValue: {
    color: '#4CAF50',
  },
  // Missing styles for vehicle card
  vehicleCard: {
    backgroundColor: 'white',
    margin: 15,
    marginTop: 0,
    padding: 15,
    borderRadius: 12,
  },
  vehicleCardLabel: {
    fontSize: 14,
    color: '#666',
    marginBottom: 6,
  },
  vehicleCardValue: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
  },
  vehicleCardSubValue: {
    fontSize: 13,
    color: '#666',
    marginTop: 4,
  },
  statsContainer: {
    backgroundColor: 'white',
    margin: 15,
    marginTop: 0,
    padding: 15,
    borderRadius: 12,
  },
  dailyEarningsCard: {
    backgroundColor: '#C41E26',
    padding: 20,
    borderRadius: 12,
    marginBottom: 15,
    alignItems: 'center',
  },
  dailyEarningsLabel: {
    fontSize: 14,
    color: '#FFFFFF',
    marginBottom: 8,
    fontWeight: '600',
  },
  dailyEarningsValue: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: 4,
  },
  dailyEarningsSubtext: {
    fontSize: 12,
    color: '#FFEBEE',
  },
  statRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  statCard: {
    flex: 1,
    backgroundColor: '#f9f9f9',
    padding: 12,
    borderRadius: 8,
    marginHorizontal: 4,
    alignItems: 'center',
  },
  statLabel: {
    fontSize: 12,
    color: '#666',
    marginBottom: 6,
    textAlign: 'center',
  },
  statValue: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
  },
  // Order items styles
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
  menuItemCard: {
    backgroundColor: '#fff',
    borderRadius: 8,
    marginBottom: 10,
    padding: 8,
    flexDirection: 'row',
    alignItems: 'center',
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 1,
  },
  menuItemImage: {
    width: 60,
    height: 60,
    borderRadius: 8,
    backgroundColor: '#f0f0f0',
    marginRight: 12,
  },
  menuItemImagePlaceholder: {
    width: 60,
    height: 60,
    borderRadius: 8,
    backgroundColor: '#f0f0f0',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  menuItemImagePlaceholderText: {
    fontSize: 24,
  },
  menuItemInfo: {
    flex: 1,
  },
  menuItemName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  menuItemQuantity: {
    fontSize: 12,
    color: '#666',
    marginBottom: 2,
  },
  menuItemPrice: {
    fontSize: 13,
    fontWeight: 'bold',
    color: '#C41E26',
  },
  noItemsText: {
    fontSize: 14,
    color: '#999',
    fontStyle: 'italic',
  },
  moreItemsText: {
    fontSize: 12,
    color: '#888',
    fontStyle: 'italic',
    marginTop: 4,
  },
  // Missing styles for date filter and summary
  summarySubtext: {
    fontSize: 11,
    color: '#999',
    marginTop: 2,
  },
  // Missing styles for empty state
  emptyIcon: {
    fontSize: 48,
    marginBottom: 10,
  },
  changeDateButtonSmall: {
    backgroundColor: '#C41E26',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    marginTop: 12,
  },
  changeDateButtonTextSmall: {
    color: 'white',
    fontSize: 13,
    fontWeight: '600',
  },
});

export default function DeliveryPersonDetail() {
  return <RequireAuth><DeliveryPersonDetailContent /></RequireAuth>;
}
