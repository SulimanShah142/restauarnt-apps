// AdminApp/screens/FleetOverview.tsx
import React, { useEffect, useState } from 'react';
import { View, StyleSheet, Text, FlatList, TouchableOpacity } from 'react-native';
import { supabase } from '@/lib/supabase';
import UnifiedMap from '@/components/UnifiedMap';

interface DeliveryPerson {
  id: string;
  name: string;
  position: [number, number] | null;
  status: 'available' | 'busy';
  orderId: string | null;
}

export default function FleetOverview() {
  const [fleet, setFleet] = useState<DeliveryPerson[]>([]);
  const [activeOrders, setActiveOrders] = useState<{[orderId: string]: [number, number]}>({});
  const [selectedDriver, setSelectedDriver] = useState<string | null>(null);

  useEffect(() => {
    let fleetChannel: any;
    let ordersChannel: any;

    const setupListeners = async () => {
      try {
        // Listen to fleet-wide location updates
        fleetChannel = supabase.channel('fleet_broadcast')
          .on('broadcast', { event: 'location_update' }, (payload) => {
            const { orderId, lat, lng } = payload.payload;
            
            setActiveOrders(prev => ({
              ...prev,
              [orderId]: [lng, lat]
            }));
            
            // Update fleet positions
            setFleet(prev => prev.map(driver => 
              driver.orderId === orderId 
                ? { ...driver, position: [lng, lat] } 
                : driver
            ));
          })
          .subscribe();

        // Listen for active orders to track
        ordersChannel = supabase.channel('orders_broadcast')
          .on('broadcast', { event: 'order_assignment' }, (payload) => {
            const { orderId, deliveryPersonId } = payload.payload;
            
            // Update driver status when an order is assigned
            setFleet(prev => prev.map(driver => 
              driver.id === deliveryPersonId
                ? { ...driver, orderId, status: 'busy' }
                : driver
            ));
          })
          .on('broadcast', { event: 'order_completed' }, (payload) => {
            const { deliveryPersonId } = payload.payload;
            
            // Update driver status when an order is completed
            setFleet(prev => prev.map(driver => 
              driver.id === deliveryPersonId
                ? { ...driver, orderId: null, status: 'available' }
                : driver
            ));
          })
          .subscribe();
          
        // Load initial fleet data
        loadInitialFleetData();
      } catch (err) {
        console.error('Error setting up listeners:', err);
      }
    };

    setupListeners();

    return () => {
      if (fleetChannel) {
        supabase.removeChannel(fleetChannel);
      }
      if (ordersChannel) {
        supabase.removeChannel(ordersChannel);
      }
    };
  }, []);

  const loadInitialFleetData = async () => {
    try {
      // Get all delivery persons
      const { data: deliveryPersons, error: deliveryError } = await supabase
        .from('delivery_persons')
        .select('*');

      if (deliveryError) throw deliveryError;

      // Get currently assigned orders
      const { data: assignedOrders, error: ordersError } = await supabase
        .from('orders')
        .select('id, delivery_person_id')
        .in('status', ['on_the_way', 'delivered']);

      if (ordersError) throw ordersError;

      // Combine the data
      const fleetData: DeliveryPerson[] = deliveryPersons.map((dp: any) => {
        const assignedOrder = assignedOrders.find((order: any) =>
          order.delivery_person_id === dp.user_id
        );

        return {
          id: dp.id,
          name: dp.profile_full_name || dp.name || `Driver ${dp.id.substring(0, 8)}`,
          position: null,
          status: (assignedOrder ? 'busy' : 'available') as 'available' | 'busy',
          orderId: assignedOrder ? assignedOrder.id : null
        };
      });

      setFleet(fleetData);
    } catch (error) {
      console.error('Error loading fleet data:', error);
    }
  };

  // Prepare points for the map (unused but kept for reference)
  const points: Array<{ id: string; pos: [number, number]; type: 'bike' | 'driver' }> = Object.entries(activeOrders).map(([orderId, pos]) => ({
    id: `order_${orderId}`,
    pos,
    type: 'bike' as const
  }));

  // Add driver positions to the map
  fleet.forEach(driver => {
    if (driver.position) {
      points.push({
        id: `driver_${driver.id}`,
        pos: driver.position,
        type: 'driver' as const
      });
    }
  });

  // Center the map on the selected driver or the first active driver
  const center = selectedDriver 
    ? fleet.find(d => d.id === selectedDriver)?.position 
    : fleet.find(d => d.status === 'busy' && d.position)?.position;

  const renderDriverItem = ({ item }: { item: DeliveryPerson }) => (
    <TouchableOpacity
      style={[
        styles.driverItem,
        selectedDriver === item.id && styles.selectedDriverItem
      ]}
      onPress={() => setSelectedDriver(item.id === selectedDriver ? null : item.id)}
    >
      <View style={styles.driverInfo}>
        <Text style={styles.driverName}>{item.name}</Text>
        <Text style={styles.driverStatus}>
          Status: {item.status} {item.orderId ? `(Order: ${item.orderId})` : ''}
        </Text>
      </View>
      <View style={[
        styles.statusIndicator,
        { backgroundColor: item.status === 'busy' ? '#FF5722' : '#4CAF50' }
      ]} />
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <View style={styles.mapContainer}>
        <UnifiedMap
          role="ADMIN"
          userLocation={center || undefined}
        />
      </View>
      
      <View style={styles.driverListContainer}>
        <Text style={styles.listTitle}>Delivery Personnel</Text>
        <FlatList
          data={fleet}
          renderItem={renderDriverItem}
          keyExtractor={item => item.id}
          style={styles.driverList}
          contentContainerStyle={styles.driverListContent}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  mapContainer: {
    flex: 1,
  },
  driverListContainer: {
    height: 200,
    backgroundColor: 'white',
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
  },
  listTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    padding: 12,
    backgroundColor: '#f5f5f5',
  },
  driverList: {
    flex: 1,
  },
  driverListContent: {
    flexGrow: 1,
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 50,
  },
  driverItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  selectedDriverItem: {
    backgroundColor: '#FFEBEE',
  },
  driverInfo: {
    flex: 1,
  },
  driverName: {
    fontSize: 16,
    fontWeight: '600',
  },
  driverStatus: {
    fontSize: 14,
    color: '#666',
  },
  statusIndicator: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
});