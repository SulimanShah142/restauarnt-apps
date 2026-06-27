import React, { useState, useEffect, useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, RefreshControl, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '@/lib/supabase';
import UnifiedMap from '@/components/UnifiedMap';
import { useAuth } from '@/contexts/AuthContext';
import { useDeliveryLocationListener } from '@/hooks/useDeliveryLocationListener';

export default function AdminTrackingScreen() {
  const { session, user, isLoading } = useAuth();
  const [orders, setOrders] = useState<any[]>([]);
  const [deliveryPersons, setDeliveryPersons] = useState<any[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  
  // REAL-TIME DELIVERY LOCATION TRACKING
  // Track all active delivery persons (updates every 50 meters)
  const [deliveryLocations, setDeliveryLocations] = useState<{[key: string]: {latitude: number, longitude: number}}>({});

  useEffect(() => {
    loadTrackingData();
  }, []);

  // Subscribe to real-time location updates for all delivery persons
  useEffect(() => {
    if (deliveryPersons.length === 0) return;

    // Create channels for each delivery person
    const channels = deliveryPersons.map(person => {
      const channelName = `delivery_person:${person.id}:location`;
      const channel = supabase.channel(channelName);

      channel.on('broadcast', { event: 'location_update' }, (payload: any) => {
        if (payload.payload && payload.payload.latitude && payload.payload.longitude) {
          setDeliveryLocations(prev => ({
            ...prev,
            [person.id]: {
              latitude: payload.payload.latitude,
              longitude: payload.payload.longitude
            }
          }));
        }
      });

      channel.subscribe();
      
      return channel;
    });

    // Cleanup function
    return () => {
      channels.forEach(channel => {
        channel.unsubscribe();
      });
    };
  }, [deliveryPersons]);

  const loadTrackingData = async () => {
    try {
      setLoading(true);
      
      // Fetch all orders that are not delivered or cancelled
      const { data: ordersData, error: ordersError } = await supabase
        .from('orders')
        .select(`
          id,
          status,
          delivery_address,
          delivery_lat,
          delivery_lng,
          delivery_person_id,
          total_amount,
          subtotal,
          delivery_cost,
          created_at,
          restaurants(name, latitude, longitude)
        `)
        .neq('status', 'delivered')
        .neq('status', 'cancelled')
        .order('created_at', { ascending: false });

      if (ordersError) throw ordersError;

      // Fetch all delivery persons with their current locations
      const { data: deliveryPersonsData, error: deliveryPersonsError } = await supabase
        .from('delivery_persons')
        .select(`
          id,
          user_id,
          is_available,
          current_latitude,
          current_longitude,
          profiles(full_name)
        `);

      if (deliveryPersonsError) throw deliveryPersonsError;

      setOrders(ordersData || []);
      setDeliveryPersons(deliveryPersonsData || []);
    } catch (error) {
      console.error('Error loading tracking data:', error);
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadTrackingData();
    setRefreshing(false);
  };

  // Prepare data for map with route information
  const mapOrders = useMemo(() => {
    return orders.map(order => {
      // Get restaurant coordinates
      const restaurantCoords = order.restaurants?.latitude && order.restaurants?.longitude
        ? [Number(order.restaurants.latitude), Number(order.restaurants.longitude)] as [number, number]
        : null;
      
      // Get delivery destination coordinates (customer location)
      const deliveryCoords = order.delivery_lat && order.delivery_lng
        ? [Number(order.delivery_lat), Number(order.delivery_lng)] as [number, number]
        : null;
      
      
      return {
        id: order.id,
        order_number: order.order_number,
        restaurantLocation: restaurantCoords,
        userLocation: deliveryCoords,  // Customer location for route
        deliveryLocation: deliveryCoords,  // Alias for compatibility
        status: order.status,
        delivery_person_id: order.delivery_person_id
      };
    }).filter(order => order.restaurantLocation && order.deliveryLocation);  // Only show orders with complete route data
  }, [orders]);
  
  // Prepare delivery persons with real-time locations and profile pictures
  const mapDeliveryPersons = useMemo(() => {
    return deliveryPersons.map(person => {
      // Use real-time location if available, otherwise use last known DB location
      const realtimeLocation = deliveryLocations[person.id];
      const location = realtimeLocation || {
        latitude: person.current_latitude,
        longitude: person.current_longitude
      };

      return {
        id: person.id,
        name: person.profiles?.full_name || person.name || `Delivery Person ${person.id}`,
        location: location.latitude && location.longitude
          ? [Number(location.latitude), Number(location.longitude)] as [number, number]
          : null,
        is_available: person.is_available,
        picture_url: person.image_url || person.picture_url,
        image_url: person.image_url || person.picture_url
      };
    });
  }, [deliveryPersons, deliveryLocations]);

  if (loading) {
    return (
      <View style={styles.container}>
        <Text>Loading tracking data...</Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        style={styles.scrollView}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        <Text style={styles.title}>Live Delivery Tracking</Text>

        {/* Map showing all active orders and delivery persons - always show even if no orders */}
        <View style={styles.mapContainer}>
          <Text style={styles.mapTitle}>Active Deliveries Map</Text>
          <UnifiedMap
            allDeliveryPersons={mapDeliveryPersons}
            allOrders={mapOrders}
            role="ADMIN"
          />
          {mapOrders.length > 0 && (
            <View style={styles.routeLegend}>
              <Text style={styles.legendText}>🍽️ Restaurant → 📍 Customer = Route Line</Text>
              <Text style={styles.legendText}>🚴 Driver = Real-time Location</Text>
            </View>
          )}
        </View>

        {/* Stats Summary */}
        <View style={styles.statsContainer}>
          <View style={styles.statCard}>
            <Text style={styles.statNumber}>{orders.length}</Text>
            <Text style={styles.statLabel}>Active Orders</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statNumber}>{deliveryPersons.length}</Text>
            <Text style={styles.statLabel}>Delivery Persons</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statNumber}>{deliveryPersons.filter(dp => dp.is_available).length}</Text>
            <Text style={styles.statLabel}>Available</Text>
          </View>
        </View>

        {/* Active Orders List */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Active Orders</Text>
          {orders.length === 0 ? (
            <Text style={styles.emptyText}>No active orders</Text>
          ) : (
            orders.map((order) => (
              <View key={order.id} style={styles.orderCard}>
                <Text style={styles.orderId}>Order #{order.id.substring(0, 8)}</Text>
                <Text style={styles.orderStatus}>Status: {order.status}</Text>
                <Text style={styles.orderRestaurant}>Restaurant: {order.restaurants?.name}</Text>
                <Text style={styles.orderAddress}>To: {order.delivery_address}</Text>
                <Text style={styles.orderTotal}>Total: AFG {order.total_amount?.toFixed(2)}</Text>
                <Text style={styles.deliveryCost}>Delivery Cost: AFG {order.delivery_cost?.toFixed(2)}</Text>
                {order.delivery_person_id && (
                  <Text style={styles.deliveryPerson}>Assigned to: {order.delivery_person_id}</Text>
                )}
              </View>
            ))
          )}
        </View>

        {/* Delivery Persons List */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Delivery Personnel</Text>
          {deliveryPersons.length === 0 ? (
            <Text style={styles.emptyText}>No delivery persons registered</Text>
          ) : (
            deliveryPersons.map((person) => (
              <View key={person.id} style={styles.personCard}>
                <Text style={styles.personName}>{person.profiles?.full_name || `Delivery Person ${person.id}`}</Text>
                <Text style={styles.personStatus}>
                  Status: {person.is_available ? 'Available' : 'Busy'}
                </Text>
                {person.current_latitude && person.current_longitude ? (
                  <Text style={styles.personLocation}>
                    Location: {person.current_latitude.toFixed(4)}, {person.current_longitude.toFixed(4)}
                  </Text>
                ) : (
                  <Text style={styles.personLocation}>Location: Unknown</Text>
                )}
              </View>
            ))
          )}
        </View>
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
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    textAlign: 'center',
    marginVertical: 16,
    color: '#333',
  },
  mapContainer: {
    marginHorizontal: 16,
    marginBottom: 16,
    borderRadius: 8,
    overflow: 'hidden',
    height: 300,
    backgroundColor: '#e0e0e0',
    zIndex: 1, // Ensure map doesn't interfere with scrolling
  },
  mapTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 8,
    color: '#333',
  },
  routeLegend: {
    backgroundColor: 'rgba(255,255,255,0.95)',
    padding: 8,
    marginHorizontal: 8,
    marginBottom: 8,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  legendText: {
    fontSize: 12,
    color: '#666',
    marginVertical: 2,
  },
  statsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginHorizontal: 16,
    marginBottom: 16,
  },
  statCard: {
    backgroundColor: 'white',
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
    flex: 1,
    marginHorizontal: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  statNumber: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#C41E26',
  },
  statLabel: {
    fontSize: 14,
    color: '#666',
    marginTop: 4,
    textAlign: 'center',
  },
  section: {
    backgroundColor: 'white',
    marginHorizontal: 16,
    marginBottom: 16,
    padding: 16,
    borderRadius: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 12,
    color: '#333',
  },
  emptyText: {
    textAlign: 'center',
    color: '#999',
    fontStyle: 'italic',
    paddingVertical: 20,
  },
  orderCard: {
    backgroundColor: '#f9f9f9',
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
  },
  orderId: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
  },
  orderStatus: {
    fontSize: 14,
    color: '#666',
    marginTop: 4,
  },
  orderRestaurant: {
    fontSize: 14,
    color: '#666',
    marginTop: 2,
  },
  orderAddress: {
    fontSize: 14,
    color: '#666',
    marginTop: 2,
  },
  orderTotal: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#333',
    marginTop: 2,
  },
  deliveryCost: {
    fontSize: 14,
    color: '#666',
    marginTop: 2,
  },
  deliveryPerson: {
    fontSize: 14,
    color: '#666',
    marginTop: 2,
  },
  personCard: {
    backgroundColor: '#f9f9f9',
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
  },
  personName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
  },
  personStatus: {
    fontSize: 14,
    color: '#666',
    marginTop: 4,
  },
  personLocation: {
    fontSize: 14,
    color: '#666',
    marginTop: 2,
  },
});