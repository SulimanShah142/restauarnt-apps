import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Linking, Alert, ActivityIndicator, ScrollView, TextInput, Modal } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams } from 'expo-router';
import UnifiedMap from '../components/UnifiedMap';
import { supabase } from '../lib/supabase';
import { useSession } from '../lib/auth-client';
import {
  startBackgroundLocationTracking,
  stopBackgroundLocationTracking
} from '../utils/background-location-task';
import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import { useDeliveryLocationBroadcast } from '../hooks/useDeliveryLocationBroadcast';
import { useDeliveryLocationListener } from '../hooks/useDeliveryLocationListener';

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
  status: string;
  subtotal: number;
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
  restaurant_id?: string;
  delivery_longitude?: string | number;
  delivery_latitude?: string | number;
  is_completed?: boolean;
  completed_at?: string;
  user?: {
    name: string;
    phone?: string;
    email?: string;
  };
  restaurant?: {
    name: string;
    address: string;
    latitude: number;
    longitude: number;
    phone?: string;
  };
  order_items?: OrderItem[];
}

export default function DeliveryTask() {
  const sessionData = useSession();
  const session = sessionData.data?.session as any;
  const { orderId } = useLocalSearchParams();
  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const [deliveryStatus, setDeliveryStatus] = useState<'pending' | 'picked_up' | 'delivered'>('pending');
  const [isTrackingActive, setIsTrackingActive] = useState(false);
  const [locationPermissionGranted, setLocationPermissionGranted] = useState(false);
  const [showOtpModal, setShowOtpModal] = useState(false);
  const [otpInput, setOtpInput] = useState('');
  const [currentOtp, setCurrentOtp] = useState<string | null>(null);
  const [driverLocation, setDriverLocation] = useState<[number, number] | null>(null);

  // Get delivery person ID from session
  const deliveryPersonId = session?.user?.id;

  // REAL-TIME LOCATION BROADCAST (updates every 50 meters)
  // Only broadcasts when order is picked up or on the way
  const {
    isBroadcasting,
    shouldBroadcast,
    lastBroadcastLocation
  } = useDeliveryLocationBroadcast({
    enabled: true,
    deliveryPersonId: deliveryPersonId,
    activeOrderId: typeof orderId === 'string' ? orderId : undefined,
    orderStatus: deliveryStatus
  });

  // Listen to our own location broadcasts for display on map
  const {
    deliveryLocation: currentDriverLocation,
    hasLocation: hasDriverLocation
  } = useDeliveryLocationListener({
    enabled: true,
    orderId: typeof orderId === 'string' ? orderId : undefined,
    deliveryPersonId: deliveryPersonId
  });

  useEffect(() => {
    if (orderId && session?.user?.id) {
      loadOrderData();
    }

    // Clean up background location tracking when component unmounts
    return () => {
      if (isTrackingActive) {
        stopBackgroundLocationTracking();
        setIsTrackingActive(false);
      }
    };
  }, [orderId, session]);

  const loadOrderData = async () => {
    try {
      if (!orderId || typeof orderId !== 'string') {
        console.error('Invalid order ID:', orderId);
        Alert.alert('Error', 'Invalid order ID');
        return;
      }


      // Fetch the specific order with all related data
      const { data, error } = await supabase
        .from('orders')
        .select(`
          *,
          user:profiles!user_id (
            name,
            phone,
            email
          ),
          restaurant:restaurants!restaurant_id (
            name,
            address,
            latitude,
            longitude,
            phone
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
        .eq('id', orderId)
        .single();

      if (error) {
        console.error('[DeliveryTask] Error fetching order:', error);
        throw error;
      }

      setOrder(data);

      // Set delivery status based on order status
      if (data.status === 'delivered') {
        setDeliveryStatus('delivered');
      } else if (data.status === 'picked_up' || data.status === 'on_the_way') {
        setDeliveryStatus('picked_up');
      } else {
        setDeliveryStatus('pending');
      }
    } catch (error) {
      console.error('[DeliveryTask] Error loading order:', error);
      Alert.alert('Error', 'Failed to load order details: ' + (error as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const handlePickUpOrder = async () => {
    if (!order) return;

    try {

      // Update order status to picked_up
      const { error } = await supabase
        .from('orders')
        .update({
          status: 'picked_up',
          updated_at: new Date().toISOString()
        })
        .eq('id', order.id);

      if (error) throw error;

      // Update local state
      setOrder(prev => prev ? { ...prev, status: 'picked_up' } : null);
      setDeliveryStatus('picked_up');

      // Start background location tracking
      (global as any).orderId = orderId;
      const success = await startBackgroundLocationTracking(session.user.id);
      if (success) {
        setIsTrackingActive(true);
      }

      Alert.alert('Success', 'Order marked as picked up!');
    } catch (error) {
      console.error('[DeliveryTask] Error updating order status:', error);
      Alert.alert('Error', 'Failed to update order status');
    }
  };

  const handleDeliverOrder = async () => {
    if (!order) return;

    try {

      // Generate OTP and update order status to delivered
      const generatedOtp = Math.floor(100000 + Math.random() * 900000).toString(); // 6-digit OTP
      
      const { error } = await supabase
        .from('orders')
        .update({
          status: 'delivered',
          delivery_otp: generatedOtp,
          delivery_otp_verified: false,
          updated_at: new Date().toISOString()
        })
        .eq('id', order.id);

      if (error) throw error;

      // Update local state
      setOrder(prev => prev ? { ...prev, status: 'delivered', delivery_otp: generatedOtp, delivery_otp_verified: false } : null);
      setDeliveryStatus('delivered');
      setCurrentOtp(generatedOtp);

      // Stop background location tracking
      if (isTrackingActive) {
        await stopBackgroundLocationTracking();
        setIsTrackingActive(false);
      }

      // Show OTP modal instead of alert
      setShowOtpModal(true);
    } catch (error) {
      console.error('[DeliveryTask] Error updating order status:', error);
      Alert.alert('Error', 'Failed to update order status');
    }
  };

  const handleCompleteOrder = async () => {
    if (!order) return;

    // First check if OTP is already verified
    if (order.delivery_otp_verified) {
      // OTP already verified, proceed with completion
      completeOrderWithoutPrompt();
      return;
    }

    // Show OTP verification modal
    setShowOtpModal(true);
  };

  const completeOrderWithoutPrompt = async () => {
    if (!order) return;

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
              // Update order to mark as completed
              const { error } = await supabase
                .from('orders')
                .update({
                  is_completed: true,
                  completed_at: new Date().toISOString(),
                  updated_at: new Date().toISOString()
                })
                .eq('id', order.id);

              if (error) throw error;

              // Update local state
              setOrder(prev => prev ? { ...prev, is_completed: true, completed_at: new Date().toISOString() } : null);

              Alert.alert('Success', 'Order completed successfully!');
            } catch (error) {
              console.error('[DeliveryTask] Error completing order:', error);
              Alert.alert('Error', 'Failed to complete order');
            }
          }
        }
      ]
    );
  };

  const verifyOtpAndComplete = async () => {
    if (!order || !currentOtp) return;

    if (otpInput !== currentOtp) {
      Alert.alert('Invalid OTP', 'The OTP you entered is incorrect. Please ask the customer for the correct OTP.');
      return;
    }

    try {
      // Verify OTP and mark order as completed
      const { error } = await supabase
        .from('orders')
        .update({
          delivery_otp_verified: true,
          is_completed: true,
          completed_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq('id', order.id);

      if (error) throw error;

      // Update local state
      setOrder(prev => prev ? { ...prev, is_completed: true, completed_at: new Date().toISOString(), delivery_otp_verified: true } : null);
      setShowOtpModal(false);
      setOtpInput('');

      Alert.alert('Success', 'Order completed successfully!');
    } catch (error) {
      console.error('[DeliveryTask] Error verifying OTP:', error);
      Alert.alert('Error', 'Failed to verify OTP');
    }
  };

  const callCustomer = () => {
    if (order?.user?.phone) {
      Linking.openURL(`tel:${order.user.phone}`);
    } else {
      Alert.alert('Phone Number Not Available', 'The customer\'s phone number is not available.');
    }
  };

  const checkLocationPermission = async () => {
    try {
      let { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setLocationPermissionGranted(false);
        Alert.alert(
          'Location Permission Required',
          'Please enable location access to see the delivery route and track your location. Go to Settings to enable location permissions.',
          [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Open Settings', onPress: () => Linking.openSettings() }
          ]
        );
        return false;
      }
      setLocationPermissionGranted(true);
      return true;
    } catch (error) {
      console.error('Error checking location permission:', error);
      return false;
    }
  };

  useEffect(() => {
    checkLocationPermission();
  }, []);

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#C41E26" />
        <Text style={styles.loadingText}>Loading order details...</Text>
      </View>
    );
  }

  if (!order) {
    return (
      <View style={styles.centerContainer}>
        <Text style={styles.errorText}>Order not found</Text>
        <Text style={styles.errorSubtext}>This order may have been removed or is no longer assigned to you.</Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        <View style={styles.container}>
          <View style={styles.header}>
            <View>
              <Text style={styles.orderId}>🍽️ {order.restaurant?.name || 'Restaurant'}</Text>
              <Text style={styles.status}>{order.status.replace('_', ' ').toUpperCase()}</Text>
            </View>
          </View>

          <View style={styles.mapContainer}>
            <UnifiedMap
              orderId={order.id}
              restaurantCoords={
                order.restaurant?.longitude && order.restaurant?.latitude
                  ? [parseFloat(order.restaurant.longitude.toString()), parseFloat(order.restaurant.latitude.toString())]
                  : undefined
              }
              // Driver's current location (real-time)
              userCoords={
                hasDriverLocation && currentDriverLocation
                  ? [currentDriverLocation.latitude, currentDriverLocation.longitude]
                  : undefined
              }
              // Customer delivery location
              destinationCoords={
                order.delivery_longitude && order.delivery_latitude
                  ? [parseFloat(order.delivery_longitude.toString()), parseFloat(order.delivery_latitude.toString())]
                  : undefined
              }
              role="DELIVER"
            />
          </View>

          <View style={styles.infoContainer}>
        {/* Customer Information */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>👤 Customer Information</Text>
          <View style={styles.customerRow}>
            <Text style={styles.customerName}>{order.user?.name || 'Customer Name'}</Text>
            <TouchableOpacity 
              style={[styles.callButton, !order.user?.phone && styles.callButtonDisabled]} 
              onPress={callCustomer}
              disabled={!order.user?.phone}
            >
              <Text style={styles.callButtonText}>📞 Call</Text>
            </TouchableOpacity>
          </View>
          {order.user?.phone ? (
            <Text style={styles.customerDetail}>Phone: {order.user.phone}</Text>
          ) : (
            <Text style={styles.customerDetailWarning}>⚠️ No phone number available</Text>
          )}
          {order.user?.email && (
            <Text style={styles.customerDetail}>Email: {order.user.email}</Text>
          )}
        </View>

        {/* Restaurant Information */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>🏪 Restaurant Information</Text>
          <Text style={styles.infoLabel}>Restaurant:</Text>
          <Text style={styles.infoValue}>{order.restaurant?.name || 'Unknown Restaurant'}</Text>
          <Text style={styles.infoLabel}>Pickup Address:</Text>
          <Text style={styles.infoValue}>{order.restaurant?.address || 'No address available'}</Text>
          {order.restaurant?.phone && (
            <>
              <Text style={styles.infoLabel}>Restaurant Phone:</Text>
              <Text style={styles.infoValue}>{order.restaurant.phone}</Text>
            </>
          )}
        </View>

        {/* Delivery Address */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>📍 Delivery Address</Text>
          {order.delivery_address ? (
            <Text style={styles.infoValue}>{order.delivery_address}</Text>
          ) : (
            <Text style={styles.warningText}>⚠️ No delivery address provided</Text>
          )}
          {order.delivery_notes && (
            <>
              <Text style={styles.infoLabel}>Delivery Notes:</Text>
              <Text style={styles.infoValue}>{order.delivery_notes}</Text>
            </>
          )}
          {order.special_instructions && (
            <>
              <Text style={styles.infoLabel}>Special Instructions:</Text>
              <Text style={styles.infoValue}>{order.special_instructions}</Text>
            </>
          )}
        </View>

        {/* Order Items */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>📦 Order Items</Text>
          {order.order_items && order.order_items.length > 0 ? (
            order.order_items.map((item, index) => (
              <View key={index} style={styles.orderItem}>
                <Text style={styles.orderItemText}>
                  • {item.quantity}x {item.menu_items?.name || 'Item'}
                </Text>
                <Text style={styles.orderItemPrice}>
                  AFG {Number(item.price * item.quantity || 0).toFixed(2)}
                </Text>
              </View>
            ))
          ) : (
            <Text style={styles.warningText}>⚠️ No order items available</Text>
          )}
        </View>

        Payment Summary
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>💰 Payment Summary</Text>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Subtotal:</Text>
            <Text style={styles.summaryValue}>AFG {Number(order.subtotal || 0).toFixed(2)}</Text>
          </View>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Delivery Fee:</Text>
            <Text style={styles.summaryValue}>AFG {Number(order.delivery_fee || 0).toFixed(2)}</Text>
          </View>
          {order.tip_amount && order.tip_amount > 0 && (
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Tip:</Text>
              <Text style={styles.summaryValue}>AFG {Number(order.tip_amount || 0).toFixed(2)}</Text>
            </View>
          )}
          <View style={[styles.summaryRow, styles.totalRow]}>
            <Text style={styles.totalLabel}>Total:</Text>
            <Text style={[styles.totalValue, styles.amountValue]}>
              AFG {Number(order.total_amount || 0).toFixed(2)}
            </Text>
          </View>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Payment Method:</Text>
            <Text style={styles.summaryValue}>{order.payment_method || 'Cash'}</Text>
          </View>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Payment Status:</Text>
            <Text style={[
              styles.summaryValue,
              order.payment_status === 'paid' ? styles.paidStatus : styles.pendingStatus
            ]}>
              {order.payment_status || 'Pending'}
            </Text>
          </View>
        </View>
        </View>

        {/* Action Buttons */}
        {deliveryStatus === 'pending' && (
          <View style={styles.actionButtonsContainer}>
            <TouchableOpacity
              style={styles.actionButton}
              onPress={handlePickUpOrder}
            >
              <Text style={styles.actionButtonText}>📦 Mark as Picked Up</Text>
            </TouchableOpacity>
          </View>
        )}

        {deliveryStatus === 'picked_up' && (
          <View style={styles.actionButtonsContainer}>
            <TouchableOpacity
              style={[styles.actionButton, styles.deliverButton]}
              onPress={handleDeliverOrder}
            >
              <Text style={styles.actionButtonText}>✅ Mark as Delivered</Text>
            </TouchableOpacity>
          </View>
        )}

        {deliveryStatus === 'delivered' && !order.is_completed && (
          <View style={styles.actionButtonsContainer}>
            <TouchableOpacity
              style={[styles.actionButton, styles.completeButton]}
              onPress={handleCompleteOrder}
            >
              <Text style={styles.actionButtonText}>✅ Complete Order</Text>
            </TouchableOpacity>
          </View>
        )}

        {order.is_completed && (
          <View style={styles.actionButtonsContainer}>
            <View style={styles.completedContainer}>
              <Text style={styles.completedIcon}>✅</Text>
              <Text style={styles.completedText}>Order Completed!</Text>
              <Text style={styles.completedSubtext}>This order has been removed from your delivery list.</Text>
            </View>
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
                {order.delivery_otp_verified ? 'Complete Order' : '🔐 Delivery Verification'}
              </Text>
              
              {order.delivery_otp_verified ? (
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
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    backgroundColor: '#f5f5f5',
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
    color: '#666',
  },
  errorText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#C41E26',
    marginBottom: 8,
  },
  errorSubtext: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  orderId: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
  },
  status: {
    fontSize: 12,
    fontWeight: '600',
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 12,
    backgroundColor: '#FFEBEE',
    color: '#C41E26',
    marginTop: 4,
  },
  mapContainer: {
    flex: 1,
    margin: 16,
    borderRadius: 8,
    overflow: 'hidden',
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
  },
  infoContainer: {
    backgroundColor: 'white',
    margin: 16,
    padding: 16,
    borderRadius: 8,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
  },
  section: {
    marginBottom: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 12,
  },
  customerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  customerName: {
    fontSize: 18,
    fontWeight: 'bold',
    flex: 1,
    color: '#333',
  },
  callButton: {
    backgroundColor: '#4CAF50',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  callButtonDisabled: {
    backgroundColor: '#ccc',
  },
  callButtonText: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 14,
  },
  customerDetail: {
    fontSize: 14,
    color: '#666',
    marginBottom: 4,
  },
  customerDetailWarning: {
    fontSize: 14,
    color: '#FF9800',
    fontStyle: 'italic',
    marginBottom: 4,
  },
  infoLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#888',
    marginTop: 8,
    marginBottom: 4,
  },
  infoValue: {
    fontSize: 15,
    color: '#333',
    lineHeight: 22,
  },
  warningText: {
    fontSize: 14,
    color: '#FF9800',
    fontStyle: 'italic',
    marginBottom: 8,
  },
  orderItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 6,
    paddingHorizontal: 8,
    backgroundColor: '#f9f9f9',
    borderRadius: 6,
    marginBottom: 4,
  },
  orderItemText: {
    fontSize: 14,
    color: '#333',
    flex: 1,
  },
  orderItemPrice: {
    fontSize: 14,
    fontWeight: '600',
    color: '#4CAF50',
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
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
  },
  amountValue: {
    fontSize: 18,
    color: '#C41E26',
  },
  paidStatus: {
    color: '#4CAF50',
    fontWeight: '600',
  },
  pendingStatus: {
    color: '#FF9800',
    fontWeight: '600',
  },
  actionButtonsContainer: {
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
  },
  actionButton: {
    backgroundColor: '#FF9800',
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 8,
    alignItems: 'center',
  },
  deliverButton: {
    backgroundColor: '#4CAF50',
  },
  completeButton: {
    backgroundColor: '#2196F3',
  },
  actionButtonText: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 16,
  },
  deliveredContainer: {
    alignItems: 'center',
    paddingVertical: 10,
  },
  deliveredIcon: {
    fontSize: 32,
    marginBottom: 8,
  },
  deliveredText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#4CAF50',
  },
  completedContainer: {
    alignItems: 'center',
    paddingVertical: 10,
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
