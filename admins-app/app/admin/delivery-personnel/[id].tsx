import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, ActivityIndicator, FlatList, TextInput, Modal, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { RequireAuth } from '@/contexts/AuthContext';
import DatePicker from '@/components/DatePicker';

interface DeliveryPerson {
  id: string;
  user_id?: string;
  name: string;
  email?: string;
  phone?: string;
  is_available: boolean;
  current_latitude?: number;
  current_longitude?: number;
  image_url?: string;
  vehicle_type?: string;
  license_plate?: string;
  rating?: number;
  total_deliveries?: number;
  created_at: string;
  updated_at: string;
}

interface Order {
  id: string;
  user_id: string;
  restaurant_id: string;
  delivery_person_id?: string;
  order_number: string;
  status: string;
  subtotal: number;
  tax_amount?: number;
  delivery_fee: number;
  tip_amount?: number;
  total_amount: number;
  delivery_address: string;
  delivery_notes?: string;
  special_instructions?: string;
  payment_method?: string;
  payment_status?: string;
  created_at: string;
  updated_at: string;
  restaurant_name?: string;
  user_name?: string;
  user_phone?: string;
  order_items?: Array<{
    id: string;
    menu_item_id: string;
    quantity: number;
    price: number;
    name?: string;
    description?: string;
    image_url?: string;
    menu_item?: {
      name: string;
      description?: string;
      image_url?: string;
    };
  }>;
}

interface DeliveryStats {
  totalDeliveries: number;
  completedDeliveries: number;
  pendingDeliveries: number;
  totalSumOfOrders: number; // Total sum of all orders for the selected day
  successRate: number;
  deliveredItemsCount: number;
}

function DeliveryPersonDetailContent() {
  const [deliveryPerson, setDeliveryPerson] = useState<DeliveryPerson | null>(null);
  const [allOrders, setAllOrders] = useState<Order[]>([]);
  const [filteredOrders, setFilteredOrders] = useState<Order[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<DeliveryStats>({
    totalDeliveries: 0,
    completedDeliveries: 0,
    pendingDeliveries: 0,
    totalSumOfOrders: 0,
    successRate: 0,
    deliveredItemsCount: 0,
  });
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [showOrderModal, setShowOrderModal] = useState(false);

  // Date filtering state
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);

  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();

  // Define loadDeliveryPersonDetails first to avoid "used before declaration" error
  const loadDeliveryPersonDetails = useCallback(async () => {
    try {
      setLoading(true);

      // Get delivery person from Supabase
      const { data: person, error: personError } = await supabase
        .from('delivery_persons')
        .select('*')
        .eq('id', id)
        .single();

      if (personError || !person) {
        console.error('[DeliveryPersonDetail] Delivery person not found:', personError);
        Alert.alert('Error', 'Delivery person not found');
        router.back();
        return;
      }

      setDeliveryPerson(person);

      // Calculate statistics with orders from Supabase
      await calculateStatistics(person.id);
    } catch (error) {
      console.error('[DeliveryPersonDetail] Error:', error);
      Alert.alert('Error', 'Failed to load delivery person details');
      router.back();
    } finally {
      setLoading(false);
    }
  }, [id]);

  // Load delivery person details and orders
  useEffect(() => {
    if (id) {
      loadDeliveryPersonDetails();
    }
  }, [id]);

  // Set up realtime subscription for order updates
  useEffect(() => {
    if (!id) return;


    const channel = supabase
      .channel(`delivery-person-orders-${id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'orders',
          filter: `delivery_person_id=eq.${id}`
        },
        async (payload: any) => {
          // Reload orders when any change happens
          await loadDeliveryPersonDetails();
        }
      )
      .subscribe((status, error) => {
        if (status === 'SUBSCRIBED') {
        } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          console.error('[DeliveryPersonDetail] ❌ Error subscribing to order changes:', error);
          // Retry subscription after 3 seconds
          setTimeout(() => {
            supabase.removeChannel(channel);
            // Re-setup will happen on next render due to dependency on id
          }, 3000);
        } else {
        }
      });

    // Cleanup subscription on unmount
    return () => {
      supabase.removeChannel(channel);
    };
  }, [id]);

  useEffect(() => {
    filterOrders();
  }, [searchQuery, allOrders, selectedDate]);

  const calculateStatistics = async (deliveryPersonId: string) => {
    try {

      // Get all orders assigned to this delivery person from Supabase with full details
      // Note: Not joining with users table to avoid relationship ambiguity errors
      // We use the denormalized customer_name/customer_phone columns from orders table
      const { data: orders, error: ordersError } = await supabase
        .from('orders')
        .select(`
          *,
          restaurants (
            name
          ),
          order_items (
            id,
            menu_item_id,
            quantity,
            price,
            menu_item_name,
            menu_item_image_url,
            menu_items (
              name,
              description,
              image_url
            )
          )
        `)
        .eq('delivery_person_id', deliveryPersonId)
        .order('created_at', { ascending: false });

      if (ordersError) {
        console.error('[DeliveryPersonDetail] Error fetching orders:', ordersError);
        Alert.alert('Error', 'Failed to load orders: ' + ordersError.message);
        return;
      }

      const personOrders = orders || [];
      
      // Log order items for debugging
      personOrders.forEach((order, idx) => {
      });

      const completed = personOrders.filter(o => o.status === 'delivered').length;
      const pending = personOrders.filter(o =>
        !['delivered', 'cancelled'].includes(o.status)
      ).length;
      const cancelled = personOrders.filter(o => o.status === 'cancelled').length;

      // Calculate total sum of ALL orders (for the selected day based on filtered orders)
      // This will be recalculated after filtering by date
      const totalSumOfOrders = personOrders
        .reduce((sum, o) => {
          const total = parseFloat(String(o.total_amount)) || 0;
          return sum + total;
        }, 0);

      // Count total items delivered
      const deliveredItemsCount = personOrders
        .filter(o => o.status === 'delivered')
        .reduce((sum, o : any) => {
          const itemsCount = o.order_items?.reduce((itemSum : any, item: any) =>
            itemSum + (item.quantity || 0), 0) || 0;
          return sum + itemsCount;
        }, 0);

      const stats: DeliveryStats = {
        totalDeliveries: personOrders.length,
        completedDeliveries: completed,
        pendingDeliveries: pending,
        totalSumOfOrders: totalSumOfOrders,
        successRate: personOrders.length > 0 ? (completed / personOrders.length) * 100 : 0,
        deliveredItemsCount: deliveredItemsCount,
      };

      setStats(stats);
      
      // Transform orders to match our interface with all real data
      // Sort by created_at ascending for counter numbering (oldest = #1)
      const sortedOrders = [...personOrders].sort((a, b) => 
        new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
      );
      
      const transformedOrders: Order[] = sortedOrders.map((order, index) => ({
        id: order.id,
        user_id: order.user_id,
        restaurant_id: order.restaurant_id,
        delivery_person_id: order.delivery_person_id,
        order_number: `#${index + 1}`, // Sequential counter instead of actual order number
        status: order.status,
        subtotal: parseFloat(String(order.subtotal)) || 0,
        tax_amount: parseFloat(String(order.tax_amount)) || 0,
        delivery_fee: parseFloat(String(order.delivery_fee)) || 0,
        tip_amount: parseFloat(String(order.tip_amount)) || 0,
        total_amount: parseFloat(String(order.total_amount)) || 0,
        delivery_address: order.delivery_address || 'No address',
        delivery_notes: order.delivery_notes,
        special_instructions: order.special_instructions,
        payment_method: order.payment_method,
        payment_status: order.payment_status,
        created_at: order.created_at,
        updated_at: order.updated_at,
        restaurant_name: order.restaurants?.name || 'Unknown Restaurant',
        user_name: order.customer_name || 'Unknown Customer',
        user_phone: order.customer_phone || 'N/A',
        order_items: order.order_items?.map((item : any) => ({
          id: item.id,
          menu_item_id: item.menu_item_id,
          quantity: item.quantity || 1,
          price: parseFloat(String(item.price)) || 0,
          name: item.menu_items?.name || item.menu_item_name || 'Unknown Item',
          description: item.menu_items?.description || '',
          image_url: item.menu_items?.image_url || item.menu_item_image_url || null,
          menu_item: item.menu_items
        })) || []
      }));
      
      setAllOrders(transformedOrders);
      setFilteredOrders(transformedOrders);
    } catch (error) {
      console.error('[DeliveryPersonDetail] Error calculating statistics:', error);
      Alert.alert('Error', 'Failed to calculate statistics: ' + (error as Error).message);
    }
  };

  // Filter orders by search query and date
  const filterOrders = () => {
    // First filter by search query
    let filtered = allOrders;
    
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(order =>
        (order.order_number || '').toLowerCase().includes(query) ||
        (order.restaurant_name || '').toLowerCase().includes(query) ||
        (order.delivery_address || '').toLowerCase().includes(query) ||
        (order.status || '').toLowerCase().includes(query)
      );
    }
    
    // Then filter by date (same logic as admin orders.tsx)
    const selectedYear = selectedDate.getFullYear();
    const selectedMonth = selectedDate.getMonth();
    const selectedDay = selectedDate.getDate();

    filtered = filtered.filter(order => {
      if (!order.created_at) return false;

      const orderDate = new Date(order.created_at);
      const orderYear = orderDate.getFullYear();
      const orderMonth = orderDate.getMonth();
      const orderDay = orderDate.getDate();

      return orderYear === selectedYear && orderMonth === selectedMonth && orderDay === selectedDay;
    });

    setFilteredOrders(filtered);

    // Recalculate total sum of orders for the selected day
    const dailyTotalSum = filtered.reduce((sum, order) => {
      const total = parseFloat(String(order.total_amount)) || 0;
      return sum + total;
    }, 0);

    // Update stats with daily total
    setStats(prev => ({
      ...prev,
      totalSumOfOrders: dailyTotalSum,
    }));

  };
  
  // Handle date change from DatePicker (same as admin orders.tsx)
  const handleDateChange = (newDate: Date) => {
    setSelectedDate(newDate);
    setShowDatePicker(false);
  };
  
  // Check if today's orders should be shown (auto-refresh on day change)
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
        setSelectedDate(today);
      }
    }, 60000); // Check every minute

    return () => clearInterval(checkDayChange);
  }, [selectedDate, allOrders]);

  const handleOrderPress = (order: Order) => {
    setSelectedOrder(order);
    setShowOrderModal(true);
  };

  const getStatusStyle = (status: string) => {
    switch (status.toLowerCase()) {
      case 'pending':
        return styles.pendingStatus;
      case 'confirmed':
        return styles.confirmedStatus;
      case 'preparing':
        return styles.preparingStatus;
      case 'ready':
        return styles.readyStatus;
      case 'on_the_way':
        return styles.onTheWayStatus;
      case 'delivered':
        return styles.deliveredStatus;
      case 'cancelled':
        return styles.cancelledStatus;
      default:
        return styles.defaultStatus;
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const renderStatCard = (title: string, value: string | number, subtitle?: string) => (
    <View style={styles.statCard}>
      <Text style={styles.statTitle}>{title}</Text>
      <Text style={styles.statValue}>{value}</Text>
      {subtitle && <Text style={styles.statSubtitle}>{subtitle}</Text>}
    </View>
  );

  const renderOrderCard = ({ item }: { item: Order }) => (
    <TouchableOpacity
      style={styles.orderCard}
      onPress={() => handleOrderPress(item)}
      activeOpacity={0.7}
    >
      <View style={styles.orderHeader}>
        <View>
          <View style={styles.orderNumberContainer}>
            <Text style={styles.orderNumberBadge}>{item.order_number}</Text>
            <Text style={styles.orderRestaurant}>{item.restaurant_name || 'Restaurant'}</Text>
          </View>
        </View>
        <Text style={[styles.orderStatus, getStatusStyle(item.status)]}>
          {item.status.replace('_', ' ')}
        </Text>
      </View>

      {/* Order Items Display */}
      {item.order_items && item.order_items.length > 0 && (
        <View style={styles.orderItemsContainer}>
          <Text style={styles.orderItemsLabel}>🍽️ Items:</Text>
          <View style={styles.orderItemsList}>
            {item.order_items.slice(0, 3).map((orderItem, idx) => (
              <Text key={idx} style={styles.orderItemText} numberOfLines={1}>
                • {orderItem.quantity}x {orderItem.menu_item?.name || 'Item'}
              </Text>
            ))}
            {item.order_items.length > 3 && (
              <Text style={styles.orderItemMoreText}>
                +{item.order_items.length - 3} more items
              </Text>
            )}
          </View>
        </View>
      )}

      <View style={styles.orderDetails}>
        <Text style={styles.orderDetailText}>
          📍 {item.delivery_address?.substring(0, 50) || 'No address'}...
        </Text>
        <Text style={styles.orderDetailText}>
          📅 {formatDate(item.created_at)}
        </Text>
      </View>

      <View style={styles.orderFooter}>
        <View>
          <Text style={styles.orderLabel}>Items:</Text>
          <Text style={styles.orderValue}>{item.order_items?.length || 0} dishes</Text>
        </View>
        <View>
          <Text style={styles.orderLabel}>Delivery:</Text>
          <Text style={styles.orderValue}>AFG {Number(item.delivery_fee || 0).toFixed(2)}</Text>
        </View>
        <View>
          <Text style={styles.orderLabel}>Tip:</Text>
          <Text style={styles.orderValue}>AFG {Number(item.tip_amount || 0).toFixed(2)}</Text>
        </View>
        <View>
          <Text style={styles.orderLabel}>Total:</Text>
          <Text style={[styles.orderValue, styles.totalAmount]}>AFG {Number(item.total_amount || 0).toFixed(2)}</Text>
        </View>
      </View>
    </TouchableOpacity>
  );

  const renderOrderModal = () => {
    if (!selectedOrder) return null;

    return (
      <Modal
        visible={showOrderModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowOrderModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Order Details</Text>
              <TouchableOpacity onPress={() => setShowOrderModal(false)}>
                <Text style={styles.modalClose}>✕</Text>
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalScrollView}>
              <View style={styles.modalSection}>
                <Text style={styles.modalSectionTitle}>Order Information</Text>
                <View style={styles.modalRow}>
                  <Text style={styles.modalLabel}>Order Number:</Text>
                  <Text style={styles.modalValue}>#{selectedOrder.order_number}</Text>
                </View>
                <View style={styles.modalRow}>
                  <Text style={styles.modalLabel}>Status:</Text>
                  <Text style={[styles.modalValue, getStatusStyle(selectedOrder.status)]}>
                    {selectedOrder.status.replace('_', ' ')}
                  </Text>
                </View>
                <View style={styles.modalRow}>
                  <Text style={styles.modalLabel}>Date:</Text>
                  <Text style={styles.modalValue}>{formatDate(selectedOrder.created_at)}</Text>
                </View>
                {selectedOrder.payment_method && (
                  <View style={styles.modalRow}>
                    <Text style={styles.modalLabel}>Payment:</Text>
                    <Text style={styles.modalValue}>{selectedOrder.payment_method}</Text>
                  </View>
                )}
              </View>

              <View style={styles.modalSection}>
                <Text style={styles.modalSectionTitle}>Delivery Information</Text>
                <View style={styles.modalRow}>
                  <Text style={styles.modalLabel}>Restaurant:</Text>
                  <Text style={styles.modalValue}>{selectedOrder.restaurant_name || 'N/A'}</Text>
                </View>
                <View style={styles.modalRow}>
                  <Text style={styles.modalLabel}>Address:</Text>
                  <Text style={styles.modalValue}>{selectedOrder.delivery_address || 'N/A'}</Text>
                </View>
                {selectedOrder.delivery_notes && (
                  <View style={styles.modalRow}>
                    <Text style={styles.modalLabel}>Notes:</Text>
                    <Text style={styles.modalValue}>{selectedOrder.delivery_notes}</Text>
                  </View>
                )}
                {selectedOrder.special_instructions && (
                  <View style={styles.modalRow}>
                    <Text style={styles.modalLabel}>Instructions:</Text>
                    <Text style={styles.modalValue}>{selectedOrder.special_instructions}</Text>
                  </View>
                )}
              </View>

              <View style={styles.modalSection}>
                <Text style={styles.modalSectionTitle}>Order Items ({selectedOrder.order_items?.length || 0})</Text>
                {selectedOrder.order_items && selectedOrder.order_items.length > 0 ? (
                  selectedOrder.order_items.map((orderItem, index) => (
                    <View key={index} style={styles.modalItemRow}>
                      {orderItem.image_url ? (
                        <Image source={{ uri: orderItem.image_url }} style={styles.modalItemImage} />
                      ) : (
                        <View style={styles.modalItemImagePlaceholder}>
                          <Text style={styles.modalItemImagePlaceholderText}>No Image</Text>
                        </View>
                      )}
                      <View style={styles.modalItemInfo}>
                        <Text style={styles.modalItemName}>
                          {orderItem.quantity}x {orderItem.menu_item?.name || orderItem.name || 'Item'}
                        </Text>
                        {orderItem.menu_item?.description || orderItem.description ? (
                          <Text style={styles.modalItemDesc}>{orderItem.menu_item?.description || orderItem.description}</Text>
                        ) : null}
                        <Text style={styles.modalItemUnitPrice}>
                          AFG {Number(orderItem.price || 0).toFixed(2)} × {orderItem.quantity}
                        </Text>
                      </View>
                      <Text style={styles.modalItemPrice}>AFG {Number(orderItem.price * orderItem.quantity || 0).toFixed(2)}</Text>
                    </View>
                  ))
                ) : (
                  <Text style={styles.noItemsText}>No items in this order</Text>
                )}
              </View>

              <View style={styles.modalSection}>
                <Text style={styles.modalSectionTitle}>Payment Summary</Text>
                <View style={styles.modalRow}>
                  <Text style={styles.modalLabel}>Subtotal:</Text>
                  <Text style={styles.modalValue}>AFG {Number(selectedOrder.subtotal || 0).toFixed(2)}</Text>
                </View>
                {selectedOrder.tax_amount && selectedOrder.tax_amount > 0 && (
                  <View style={styles.modalRow}>
                    <Text style={styles.modalLabel}>Tax:</Text>
                    <Text style={styles.modalValue}>AFG {Number(selectedOrder.tax_amount || 0).toFixed(2)}</Text>
                  </View>
                )}
                <View style={styles.modalRow}>
                  <Text style={styles.modalLabel}>Delivery Fee:</Text>
                  <Text style={styles.modalValue}>AFG {Number(selectedOrder.delivery_fee || 0).toFixed(2)}</Text>
                </View>
                {selectedOrder.tip_amount && selectedOrder.tip_amount > 0 && (
                  <View style={styles.modalRow}>
                    <Text style={styles.modalLabel}>Tip:</Text>
                    <Text style={styles.modalValue}>AFG {Number(selectedOrder.tip_amount || 0).toFixed(2)}</Text>
                  </View>
                )}
                <View style={[styles.modalRow, styles.modalTotalRow]}>
                  <Text style={styles.modalTotalLabel}>Total:</Text>
                  <Text style={[styles.modalTotalValue, styles.totalAmount]}>
                    AFG {Number(selectedOrder.total_amount || 0).toFixed(2)}
                  </Text>
                </View>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>
    );
  };

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#C41E26" />
        <Text style={styles.loadingText}>Loading delivery person details...</Text>
      </View>
    );
  }

  if (!deliveryPerson) {
    return (
      <View style={styles.centerContainer}>
        <Text>Delivery person not found</Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      {renderOrderModal()}

      <ScrollView 
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
      >
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Text style={styles.backButtonText}>← Back</Text>
          </TouchableOpacity>
          <Text style={styles.title}>Delivery Person Details</Text>
        </View>

        {/* Profile Card - Simplified */}
        <View style={styles.profileCard}>
          <Text style={styles.profileName}>{deliveryPerson.name}</Text>

          <View style={styles.profileInfo}>
            {deliveryPerson.phone && (
              <View style={styles.profileRow}>
                <Text style={styles.profileText}>📞 {deliveryPerson.phone}</Text>
              </View>
            )}
            {deliveryPerson.email && (
              <View style={styles.profileRow}>
                <Text style={styles.profileText}>✉️ {deliveryPerson.email}</Text>
              </View>
            )}
            <View style={styles.profileRow}>
              <Text style={styles.profileText}>
                🚗 {deliveryPerson.vehicle_type || 'N/A'} {deliveryPerson.license_plate ? `• ${deliveryPerson.license_plate}` : null}
              </Text>
            </View>
            <View style={styles.profileRow}>
              <Text style={styles.profileText}>⭐ {deliveryPerson.rating ? `${deliveryPerson.rating}/5` : 'N/A'}</Text>
            </View>
            <View style={styles.profileRow}>
              <Text style={styles.profileText}>
                {deliveryPerson.is_available ? '✅ Available' : '❌ Not Available'}
              </Text>
            </View>
          </View>
        </View>

        {/* Statistics Section - Simplified */}
        <View style={styles.statsContainer}>
          <View style={styles.statsHeader}>
            <Text style={styles.sectionTitle}>Delivery Statistics</Text>
            <TouchableOpacity onPress={loadDeliveryPersonDetails} style={styles.refreshButton}>
              <Text style={styles.refreshButtonText}>🔄 Refresh</Text>
            </TouchableOpacity>
          </View>

          {/* Main Stats Row */}
          <View style={styles.statsGrid}>
            {renderStatCard('Total Orders', stats.totalDeliveries)}
            {renderStatCard('Completed', stats.completedDeliveries)}
            {renderStatCard('In Progress', stats.pendingDeliveries)}
            {renderStatCard('Success Rate', `${stats.successRate.toFixed(1)}%`)}
          </View>

          {/* Daily Total Sum - Prominent Box */}
          <View style={styles.dailyTotalCard}>
            <Text style={styles.dailyTotalTitle}>💰 Total Sum of Orders</Text>
            <Text style={styles.dailyTotalValue}>AFG {stats.totalSumOfOrders.toFixed(2)}</Text>
            <Text style={styles.dailyTotalSubtitle}>for {selectedDate.toLocaleDateString()}</Text>
          </View>

          {/* Additional Stats Row */}
          {stats.completedDeliveries > 0 && (
            <View style={styles.statsGrid}>
              {renderStatCard('Items Delivered', stats.deliveredItemsCount, 'dishes')}
            </View>
          )}

          {stats.totalDeliveries === 0 && (
            <View style={styles.infoBox}>
              <Text style={styles.infoBoxText}>No orders assigned yet.</Text>
            </View>
          )}
        </View>

        {/* Orders Section */}
        <View style={styles.ordersSection}>
          <View style={styles.ordersHeader}>
            <Text style={styles.sectionTitle}>📦 All Orders</Text>
            <Text style={styles.ordersCount}>{filteredOrders.length} orders</Text>
          </View>

          {/* Date Filter and Search */}
          <View style={styles.filterContainer}>
            <TouchableOpacity
              style={styles.dateFilterButton}
              onPress={() => setShowDatePicker(true)}
            >
              <Text style={styles.dateFilterText}>📅 {selectedDate.toLocaleDateString()}</Text>
            </TouchableOpacity>
          </View>

          {/* Search Bar */}
          <View style={styles.searchContainer}>
            <TextInput
              style={styles.searchInput}
              placeholder="Search by order number, restaurant, address, or status..."
              value={searchQuery}
              onChangeText={setSearchQuery}
              clearButtonMode="while-editing"
            />
          </View>

          {/* Orders List */}
          {filteredOrders.length === 0 ? (
            <View style={styles.noOrdersContainer}>
              <Text style={styles.noOrdersIcon}>📦</Text>
              <Text style={styles.noOrdersText}>
                {searchQuery ? 'No orders match your search' : 'No orders assigned to this delivery person'}
              </Text>
            </View>
          ) : (
            <FlatList
              data={filteredOrders}
              renderItem={renderOrderCard}
              keyExtractor={(item) => item.id}
              scrollEnabled={false}
              contentContainerStyle={styles.ordersList}
            />
          )}
        </View>
      </ScrollView>

      {/* DatePicker Modal */}
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
    paddingBottom: 30,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 10,
    color: '#666',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 15,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  backButton: {
    padding: 5,
    marginRight: 10,
  },
  backButtonText: {
    fontSize: 18,
    color: '#666',
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    flex: 1,
  },
  profileCard: {
    backgroundColor: '#fff',
    margin: 15,
    padding: 20,
    borderRadius: 12,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  profileName: {
    fontSize: 22,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 15,
  },
  profileInfo: {
    marginTop: 5,
  },
  profileRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  profileText: {
    fontSize: 15,
    color: '#333',
  },
  statsContainer: {
    backgroundColor: '#fff',
    marginHorizontal: 15,
    marginBottom: 15,
    padding: 15,
    borderRadius: 12,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  statsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 15,
  },
  refreshButton: {
    backgroundColor: '#f0f0f0',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  refreshButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
  },
  infoBox: {
    backgroundColor: '#f8f9fa',
    padding: 12,
    borderRadius: 8,
    marginTop: 10,
    alignItems: 'center',
  },
  infoBoxText: {
    fontSize: 13,
    color: '#666',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 15,
    color: '#333',
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  statCard: {
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
    padding: 12,
    width: '48%',
    marginBottom: 10,
    alignItems: 'center',
  },
  statTitle: {
    fontSize: 11,
    color: '#666',
    marginBottom: 5,
    textAlign: 'center',
  },
  statValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  statSubtitle: {
    fontSize: 10,
    color: '#999',
    marginTop: 3,
  },
  dailyTotalCard: {
    backgroundColor: '#C41E26',
    borderRadius: 12,
    padding: 20,
    marginHorizontal: 15,
    marginVertical: 15,
    alignItems: 'center',
    elevation: 4,
    shadowColor: '#C41E26',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
  },
  dailyTotalTitle: {
    fontSize: 14,
    color: '#ffffff',
    marginBottom: 8,
    fontWeight: '500',
  },
  dailyTotalValue: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#ffffff',
  },
  dailyTotalSubtitle: {
    fontSize: 12,
    color: '#ffebee',
    marginTop: 5,
  },
  ordersSection: {
    backgroundColor: '#fff',
    marginHorizontal: 15,
    marginBottom: 30,
    padding: 15,
    borderRadius: 12,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  ordersHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  ordersCount: {
    fontSize: 14,
    color: '#666',
  },
  filterContainer: {
    marginBottom: 10,
  },
  dateFilterButton: {
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
    padding: 12,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    alignItems: 'center',
  },
  dateFilterText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#333',
  },
  searchContainer: {
    marginBottom: 15,
  },
  searchInput: {
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
    padding: 12,
    fontSize: 15,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  ordersList: {
    flexGrow: 1,
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 100,
  },
  orderCard: {
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 12,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  orderHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  orderItemsContainer: {
    marginBottom: 8,
    backgroundColor: '#f8f9fa',
    padding: 8,
    borderRadius: 6,
  },
  orderItemsLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#666',
    marginBottom: 4,
  },
  orderItemsList: {
    marginLeft: 5,
  },
  orderItemText: {
    fontSize: 12,
    color: '#666',
    marginBottom: 2,
  },
  orderItemMoreText: {
    fontSize: 11,
    color: '#888',
    fontStyle: 'italic',
    marginTop: 2,
  },
  orderNumberContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  orderNumberBadge: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    backgroundColor: '#f0f0f0',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  orderRestaurant: {
    fontSize: 12,
    color: '#666',
    marginTop: 2,
  },
  orderStatus: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    fontSize: 10,
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  pendingStatus: {
    backgroundColor: '#f0f0f0',
    color: '#666',
  },
  confirmedStatus: {
    backgroundColor: '#e3f2fd',
    color: '#1565c0',
  },
  preparingStatus: {
    backgroundColor: '#e0f7fa',
    color: '#00838f',
  },
  readyStatus: {
    backgroundColor: '#e8f5e9',
    color: '#2e7d32',
  },
  onTheWayStatus: {
    backgroundColor: '#fff8e1',
    color: '#f57f17',
  },
  deliveredStatus: {
    backgroundColor: '#e8f5e9',
    color: '#2e7d32',
  },
  cancelledStatus: {
    backgroundColor: '#ffebee',
    color: '#c62828',
  },
  defaultStatus: {
    backgroundColor: '#f5f5f5',
    color: '#666',
  },
  orderDetails: {
    marginBottom: 10,
  },
  orderDetailText: {
    fontSize: 13,
    color: '#666',
    marginBottom: 3,
  },
  orderFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
  },
  orderLabel: {
    fontSize: 11,
    color: '#999',
    marginBottom: 2,
  },
  orderValue: {
    fontSize: 13,
    fontWeight: '600',
    color: '#333',
  },
  totalAmount: {
    color: '#C41E26',
    fontSize: 14,
  },
  noOrdersContainer: {
    alignItems: 'center',
    padding: 30,
  },
  noOrdersIcon: {
    fontSize: 48,
    marginBottom: 10,
  },
  noOrdersText: {
    textAlign: 'center',
    color: '#999',
    fontSize: 15,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '85%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  modalClose: {
    fontSize: 24,
    color: '#666',
    padding: 5,
  },
  modalScrollView: {
    padding: 20,
  },
  modalSection: {
    marginBottom: 20,
  },
  modalSectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 10,
    color: '#333',
  },
  modalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  modalLabel: {
    fontSize: 14,
    color: '#666',
    flex: 1,
  },
  modalValue: {
    fontSize: 14,
    color: '#333',
    flex: 1.5,
    textAlign: 'right',
  },
  modalTotalRow: {
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
  },
  modalTotalLabel: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
  },
  modalTotalValue: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  modalItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  modalItemInfo: {
    flex: 1,
  },
  modalItemName: {
    fontSize: 14,
    fontWeight: '500',
    color: '#333',
  },
  modalItemDesc: {
    fontSize: 12,
    color: '#999',
    marginTop: 2,
  },
  modalItemUnitPrice: {
    fontSize: 12,
    color: '#666',
    marginTop: 2,
  },
  modalItemPrice: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    flex: 1,
    textAlign: 'right',
  },
  modalItemImage: {
    width: 60,
    height: 60,
    borderRadius: 8,
    marginRight: 12,
    resizeMode: 'cover',
  },
  modalItemImagePlaceholder: {
    width: 60,
    height: 60,
    borderRadius: 8,
    marginRight: 12,
    backgroundColor: '#f0f0f0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalItemImagePlaceholderText: {
    fontSize: 10,
    color: '#999',
    textAlign: 'center',
  },
  noItemsText: {
    textAlign: 'center',
    color: '#999',
    padding: 10,
  },
});

export default function DeliveryPersonDetail() {
  return (
    <RequireAuth>
      <DeliveryPersonDetailContent />
    </RequireAuth>
  );
}
