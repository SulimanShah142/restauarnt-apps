import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, RefreshControl, Alert, TouchableOpacity, Modal, ActivityIndicator } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { RequireAuth } from '@/contexts/AuthContext';
import { adminApiService } from '@/lib/admin-api-service';
import { formatCurrency } from '@/utils/currency';
import { supabase } from '@/lib/supabase';

interface DeliveryPerson {
  id: string;
  name: string;
  email: string;
  phone?: string;
  vehicle_type?: string;
  license_plate?: string;
  is_available: boolean;
  rating: number;
  created_at: string;
  updated_at: string;
}

interface Restaurant {
  id: string;
  name: string;
  address: string;
  phone: string;
  email: string;
  latitude?: number;
  longitude?: number;
}

interface OrderItem {
  id: string;
  quantity: number;
  price: number;
  menu_items?: {
    name: string;
    description?: string;
  };
}

interface Order {
  id: string;
  order_number: string;
  user_id: string;
  restaurant_id: string;
  total_amount: number;
  subtotal: number;
  delivery_fee: number;
  tip_amount?: number;
  tax_amount?: number;
  status: 'pending' | 'confirmed' | 'preparing' | 'ready' | 'on_the_way' | 'delivered' | 'cancelled';
  delivery_person_id?: string;
  delivery_address: string;
  delivery_notes?: string;
  special_instructions?: string;
  payment_method?: string;
  payment_status?: string;
  created_at: string;
  updated_at: string;
  restaurant?: Restaurant;
  delivery_person?: DeliveryPerson;
  user?: {
    name: string;
    phone: string;
    email?: string;
  };
  order_items?: OrderItem[];
}

function DeliveriesContent() {
  const [deliveries, setDeliveries] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [showOrderModal, setShowOrderModal] = useState(false);

  // Load deliveries from API
  useEffect(() => {
    loadDeliveries();
  }, []);

  // Set up realtime subscription for order updates
  useEffect(() => {

    const channel = supabase
      .channel('deliveries-orders-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'orders'
        },
        async (payload) => {
          const newRecord = payload.new as any;
          // Reload deliveries when any change happens
          await loadDeliveries();
        }
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          console.error('[Deliveries] ❌ Error subscribing to order changes');
        }
      });

    // Cleanup subscription on unmount
    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const loadDeliveries = async () => {
    try {
      
      // Fetch deliveries with order items directly from Supabase
      const { data, error } = await supabase
        .from('orders')
        .select(`
          *,
          restaurants (
            id,
            name,
            address,
            phone,
            latitude,
            longitude
          ),
          delivery_persons:delivery_person_id (
            id,
            name,
            email,
            phone,
            vehicle_type,
            license_plate,
            is_available
          ),
          profiles:user_id (
            id,
            name,
            phone,
            email
          ),
          order_items (
            id,
            quantity,
            price,
            menu_items (
              name,
              description
            )
          )
        `)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('[Deliveries] Error fetching deliveries:', error);
        throw error;
      }

      // Transform deliveries data to match the expected interface
      const transformedDeliveries: Order[] = (data || []).map((delivery: any) => ({
        id: delivery.id,
        order_number: delivery.order_number || delivery.id.substring(0, 8),
        user_id: delivery.user_id,
        restaurant_id: delivery.restaurant_id,
        total_amount: parseFloat(String(delivery.total_amount)) || 0,
        subtotal: parseFloat(String(delivery.subtotal)) || 0,
        delivery_fee: parseFloat(String(delivery.delivery_fee)) || 0,
        tip_amount: delivery.tip_amount ? parseFloat(String(delivery.tip_amount)) : undefined,
        tax_amount: delivery.tax_amount ? parseFloat(String(delivery.tax_amount)) : undefined,
        status: delivery.status as 'pending' | 'confirmed' | 'preparing' | 'ready' | 'on_the_way' | 'delivered' | 'cancelled',
        delivery_person_id: delivery.delivery_person_id,
        delivery_address: delivery.delivery_address || 'No address',
        delivery_notes: delivery.delivery_notes,
        special_instructions: delivery.special_instructions,
        payment_method: delivery.payment_method,
        payment_status: delivery.payment_status,
        created_at: delivery.created_at,
        updated_at: delivery.updated_at,
        restaurant: delivery.restaurants ? {
          id: delivery.restaurants.id,
          name: delivery.restaurants.name || 'Unknown Restaurant',
          address: delivery.restaurants.address || 'No address',
          phone: delivery.restaurants.phone || 'N/A',
          email: delivery.restaurants.email,
          latitude: delivery.restaurants.latitude,
          longitude: delivery.restaurants.longitude,
        } : undefined,
        delivery_person: delivery.delivery_persons ? {
          id: delivery.delivery_persons.id,
          name: delivery.delivery_persons.name || 'Unassigned',
          email: delivery.delivery_persons.email || 'N/A',
          phone: delivery.delivery_persons.phone || 'N/A',
          vehicle_type: delivery.delivery_persons.vehicle_type || 'N/A',
          license_plate: delivery.delivery_persons.license_plate || 'N/A',
          is_available: delivery.delivery_persons.is_available,
          rating: delivery.delivery_persons.rating,
          created_at: delivery.delivery_persons.created_at,
          updated_at: delivery.delivery_persons.updated_at,
        } : undefined,
        user: delivery.profiles ? {
          name: delivery.profiles.name || 'Unknown Customer',
          phone: delivery.profiles.phone || 'N/A',
          email: delivery.profiles.email,
        } : undefined,
        order_items: delivery.order_items?.map((item: any) => ({
          id: item.id,
          quantity: item.quantity || 1,
          price: parseFloat(String(item.price)) || 0,
          menu_items: item.menu_items
        })) || []
      }));

      setDeliveries(transformedDeliveries);
      setLoading(false);
    } catch (error) {
      console.error('[Deliveries] Error loading deliveries:', error);
      Alert.alert('Error', 'Failed to load deliveries: ' + (error as Error).message);
      setLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadDeliveries();
    setRefreshing(false);
  };

  const handleOrderPress = (order: Order) => {
    setSelectedOrder(order);
    setShowOrderModal(true);
  };

  const getStatusStyle = (status: string) => {
    const statusStr = (status || '').toLowerCase();
    switch (statusStr) {
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
                <Text style={styles.modalSectionTitle}>Customer Information</Text>
                <View style={styles.modalRow}>
                  <Text style={styles.modalLabel}>Name:</Text>
                  <Text style={styles.modalValue}>{selectedOrder.user?.name || 'N/A'}</Text>
                </View>
                {selectedOrder.user?.phone && (
                  <View style={styles.modalRow}>
                    <Text style={styles.modalLabel}>Phone:</Text>
                    <Text style={styles.modalValue}>{selectedOrder.user.phone}</Text>
                  </View>
                )}
                {selectedOrder.user?.email && (
                  <View style={styles.modalRow}>
                    <Text style={styles.modalLabel}>Email:</Text>
                    <Text style={styles.modalValue}>{selectedOrder.user.email}</Text>
                  </View>
                )}
              </View>

              <View style={styles.modalSection}>
                <Text style={styles.modalSectionTitle}>Delivery Information</Text>
                <View style={styles.modalRow}>
                  <Text style={styles.modalLabel}>Restaurant:</Text>
                  <Text style={styles.modalValue}>{selectedOrder.restaurant?.name || 'N/A'}</Text>
                </View>
                <View style={styles.modalRow}>
                  <Text style={styles.modalLabel}>Pickup Address:</Text>
                  <Text style={styles.modalValue}>{selectedOrder.restaurant?.address || 'N/A'}</Text>
                </View>
                <View style={styles.modalRow}>
                  <Text style={styles.modalLabel}>Delivery Address:</Text>
                  <Text style={styles.modalValue}>{selectedOrder.delivery_address || 'N/A'}</Text>
                </View>
                <View style={styles.modalRow}>
                  <Text style={styles.modalLabel}>Delivery Person:</Text>
                  <Text style={styles.modalValue}>{selectedOrder.delivery_person?.name || 'Unassigned'}</Text>
                </View>
                {selectedOrder.delivery_person?.vehicle_type && (
                  <View style={styles.modalRow}>
                    <Text style={styles.modalLabel}>Vehicle:</Text>
                    <Text style={styles.modalValue}>
                      {selectedOrder.delivery_person.vehicle_type} - {selectedOrder.delivery_person.license_plate || 'N/A'}
                    </Text>
                  </View>
                )}
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
                      <View style={styles.modalItemInfo}>
                        <Text style={styles.modalItemName}>
                          {orderItem.quantity}x {orderItem.menu_items?.name || 'Item'}
                        </Text>
                        {orderItem.menu_items?.description && (
                          <Text style={styles.modalItemDesc}>{orderItem.menu_items.description}</Text>
                        )}
                        <Text style={styles.modalItemUnitPrice}>
                          AFG {(orderItem.price).toFixed(2)} × {orderItem.quantity}
                        </Text>
                      </View>
                      <Text style={styles.modalItemPrice}>AFG {(orderItem.price * orderItem.quantity).toFixed(2)}</Text>
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
                  <Text style={styles.modalValue}>AFG {(selectedOrder.subtotal || 0).toFixed(2)}</Text>
                </View>
                {selectedOrder.tax_amount && selectedOrder.tax_amount > 0 && (
                  <View style={styles.modalRow}>
                    <Text style={styles.modalLabel}>Tax:</Text>
                    <Text style={styles.modalValue}>AFG {(selectedOrder.tax_amount).toFixed(2)}</Text>
                  </View>
                )}
                <View style={styles.modalRow}>
                  <Text style={styles.modalLabel}>Delivery Fee:</Text>
                  <Text style={styles.modalValue}>AFG {(selectedOrder.delivery_fee || 0).toFixed(2)}</Text>
                </View>
                {selectedOrder.tip_amount && selectedOrder.tip_amount > 0 && (
                  <View style={styles.modalRow}>
                    <Text style={styles.modalLabel}>Tip:</Text>
                    <Text style={styles.modalValue}>AFG {(selectedOrder.tip_amount).toFixed(2)}</Text>
                  </View>
                )}
                <View style={[styles.modalRow, styles.modalTotalRow]}>
                  <Text style={styles.modalTotalLabel}>Total:</Text>
                  <Text style={[styles.modalTotalValue, styles.totalAmount]}>
                    AFG {(selectedOrder.total_amount || 0).toFixed(2)}
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
        <Text style={styles.loadingText}>Loading deliveries...</Text>
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
      }
    >
      {renderOrderModal()}
      
      <Text style={styles.title}>All Deliveries</Text>

      {deliveries.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Text>No deliveries found</Text>
        </View>
      ) : (
        deliveries.map(delivery => (
          <TouchableOpacity
            key={delivery.id}
            style={styles.deliveryCard}
            onPress={() => handleOrderPress(delivery)}
            activeOpacity={0.7}
          >
            <View style={styles.header}>
              <View>
                <Text style={styles.orderNumber}>#{delivery.order_number}</Text>
                <Text style={styles.restaurantName}>
                  {delivery.restaurant?.name || 'Unknown Restaurant'}
                </Text>
              </View>
              <Text style={[styles.status, getStatusStyle(delivery.status)]}>
                {delivery.status.replace('_', ' ')}
              </Text>
            </View>

            Order Items Preview
            {delivery.order_items && delivery.order_items.length > 0 && (
              <View style={styles.itemsPreview}>
                <Text style={styles.itemsLabel}>📦 Items:</Text>
                <Text style={styles.itemsText}>
                  {delivery.order_items.slice(0, 2).map(item => 
                    `${item.quantity}x ${item.menu_items?.name || 'Item'}`
                  ).join(', ')}
                  {delivery.order_items.length > 2 && ` +${delivery.order_items.length - 2} more`}
                </Text>
              </View>
            )}

            <View style={styles.details}>
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>👤 Customer:</Text>
                <Text style={styles.detailValue}>
                  {delivery.user?.name || 'Unknown'}
                </Text>
              </View>

              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>📍 Delivery:</Text>
                <Text style={styles.detailValue} numberOfLines={1}>
                  {delivery.delivery_address?.substring(0, 50) || 'No address'}
                  {delivery.delivery_address?.length > 50 && '...'}
                </Text>
              </View>

              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>🚴 Driver:</Text>
                <Text style={styles.detailValue}>
                  {delivery.delivery_person?.name || 'Unassigned'}
                </Text>
              </View>

              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>💰 Total:</Text>
                <Text style={[styles.detailValue, styles.totalAmount]}>
                  {formatCurrency(delivery.total_amount)}
                </Text>
              </View>

              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>📅 Date:</Text>
                <Text style={styles.detailValue}>
                  {formatDate(delivery.created_at)}
                </Text>
              </View>
            </View>

            <View style={styles.tapHint}>
              <Text style={styles.tapHintText}>👆 Tap to view full details</Text>
            </View>
          </TouchableOpacity>
        ))
      )}
    </ScrollView>
  );
}

// Helper function to get status color
const getStatusColor = (status: string) => {
  switch (status) {
    case 'pending':
      return styles.statusPending;
    case 'confirmed':
      return styles.statusConfirmed;
    case 'preparing':
      return styles.statusPreparing;
    case 'ready':
      return styles.statusReady;
    case 'on_the_way':
      return styles.statusOnTheWay;
    case 'delivered':
      return styles.statusDelivered;
    case 'cancelled':
      return styles.statusCancelled;
    default:
      return styles.statusDefault;
  }
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
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
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    textAlign: 'center',
    padding: 15,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  deliveryCard: {
    backgroundColor: '#fff',
    margin: 10,
    padding: 15,
    borderRadius: 8,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  orderNumber: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  restaurantName: {
    fontSize: 14,
    color: '#666',
    marginTop: 2,
  },
  status: {
    fontSize: 12,
    fontWeight: 'bold',
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 12,
    color: '#fff',
  },
  statusPending: { backgroundColor: '#FFA500' },
  statusConfirmed: { backgroundColor: '#4CAF50' },
  statusPreparing: { backgroundColor: '#C41E26' },
  statusReady: { backgroundColor: '#FF9800' },
  statusOnTheWay: { backgroundColor: '#9C27B0' },
  statusDelivered: { backgroundColor: '#4CAF50' },
  statusCancelled: { backgroundColor: '#C41E26' },
  statusDefault: { backgroundColor: '#9E9E9E' },
  // Add alias styles for getStatusStyle function
  pendingStatus: { backgroundColor: '#FFA500' },
  confirmedStatus: { backgroundColor: '#4CAF50' },
  preparingStatus: { backgroundColor: '#C41E26' },
  readyStatus: { backgroundColor: '#FF9800' },
  onTheWayStatus: { backgroundColor: '#9C27B0' },
  deliveredStatus: { backgroundColor: '#4CAF50' },
  cancelledStatus: { backgroundColor: '#C41E26' },
  defaultStatus: { backgroundColor: '#9E9E9E' },
  itemsPreview: {
    backgroundColor: '#f8f9fa',
    padding: 10,
    borderRadius: 6,
    marginBottom: 10,
  },
  itemsLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#666',
    marginBottom: 4,
  },
  itemsText: {
    fontSize: 13,
    color: '#333',
    lineHeight: 18,
  },
  details: {
    marginBottom: 10,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  detailLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#666',
    width: 80,
  },
  detailValue: {
    fontSize: 14,
    color: '#333',
    flex: 1,
  },
  totalAmount: {
    fontWeight: 'bold',
    color: '#C41E26',
    fontSize: 15,
  },
  timestamp: {
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#eee',
  },
  timestampText: {
    fontSize: 12,
    color: '#888',
  },
  tapHint: {
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
    alignItems: 'center',
  },
  tapHintText: {
    fontSize: 12,
    color: '#999',
    fontStyle: 'italic',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: 'white',
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
    borderBottomColor: '#eee',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
  },
  modalClose: {
    fontSize: 24,
    color: '#666',
    padding: 4,
  },
  modalScrollView: {
    padding: 20,
  },
  modalSection: {
    marginBottom: 20,
    paddingBottom: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  modalSectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 12,
  },
  modalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  modalLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#666',
    width: '40%',
  },
  modalValue: {
    fontSize: 14,
    color: '#333',
    flex: 1,
    textAlign: 'right',
  },
  modalItemRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingVertical: 8,
    paddingHorizontal: 10,
    backgroundColor: '#f8f9fa',
    borderRadius: 6,
    marginBottom: 6,
  },
  modalItemInfo: {
    flex: 1,
    marginRight: 10,
  },
  modalItemName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 2,
  },
  modalItemDesc: {
    fontSize: 12,
    color: '#666',
    marginBottom: 4,
  },
  modalItemUnitPrice: {
    fontSize: 12,
    color: '#888',
  },
  modalItemPrice: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#4CAF50',
  },
  modalTotalRow: {
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 2,
    borderTopColor: '#e0e0e0',
  },
  modalTotalLabel: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
  },
  modalTotalValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#C41E26',
  },
  noItemsText: {
    fontSize: 14,
    color: '#999',
    fontStyle: 'italic',
    textAlign: 'center',
    paddingVertical: 10,
  },
});

export default function Deliveries() {
  return <RequireAuth><DeliveriesContent /></RequireAuth>;
}
