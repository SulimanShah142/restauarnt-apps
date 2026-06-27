// UserApp/screens/TrackOrder.tsx
import React, { useEffect, useState } from 'react';
import { View, StyleSheet, Text, Alert, ActivityIndicator, TouchableOpacity, Modal } from 'react-native';
import { supabase } from '../lib/supabase';
import UnifiedMap from '../components/UnifiedMap';
import { useDeliveryLocationListener } from '../hooks/useDeliveryLocationListener';
import { Ionicons } from '@expo/vector-icons';

interface TrackOrderProps {
  orderId: string;
  restaurantPos?: [number, number];
  homePos?: [number, number];
  restaurantId?: string;
  deliveryPersonId?: string;
}

export default function TrackOrder({ orderId, restaurantPos, homePos, restaurantId, deliveryPersonId }: TrackOrderProps) {
  // Use delivery location listener hook
  const { deliveryLocation, isLoading: isListening, error, hasLocation, isReady } = useDeliveryLocationListener({
    enabled: true,
    orderId,
    deliveryPersonId
  });

  const [mapReady, setMapReady] = useState(false);
  const [driverPos, setDriverPos] = useState<[number, number] | null>(null);
  const [showFullscreenMap, setShowFullscreenMap] = useState(false);
  const [deliveryPersonName, setDeliveryPersonName] = useState<string | null>(null);
  const [deliveryPersonImageUrl, setDeliveryPersonImageUrl] = useState<string | null>(null);

  // Update driver position when location changes
  useEffect(() => {
    if (deliveryLocation) {
      setDriverPos([deliveryLocation.latitude, deliveryLocation.longitude]);
      setMapReady(true);
    }
  }, [deliveryLocation]);

  // Fetch delivery person information
  useEffect(() => {
    if (deliveryPersonId) {
      const fetchDeliveryPerson = async () => {
        try {
          const { data, error } = await supabase
            .from('delivery_persons')
            .select('name, profile_image_url')
            .eq('id', deliveryPersonId)
            .single();

          if (error) {
            console.error('Error fetching delivery person:', error);
          } else if (data) {
            setDeliveryPersonName(data.name);
            setDeliveryPersonImageUrl(data.profile_image_url);
          }
        } catch (err) {
          console.error('Error fetching delivery person:', err);
        }
      };

      fetchDeliveryPerson();
    }
  }, [deliveryPersonId]);

  // Set map ready after timeout if no location received
  useEffect(() => {
    const timer = setTimeout(() => {
      setMapReady(true);
    }, 2000);
    return () => clearTimeout(timer);
  }, []);

  // Wait for hook to be ready
  if (!isReady || isListening) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#C41E26" />
        <Text style={styles.loadingText}>Loading tracking information...</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.centerContainer}>
        <Text style={styles.errorText}>⚠️ {error}</Text>
        <Text style={styles.subText}>Map will show without live tracking</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.mapContainer}>
        <View style={styles.mapHeader}>
          <Text style={styles.mapTitle}>Order Map</Text>
          <TouchableOpacity
            style={styles.fullscreenMapButton}
            onPress={() => setShowFullscreenMap(true)}
          >
            <Ionicons name="expand" size={18} color="#fff" />
            <Text style={styles.fullscreenMapButtonText}>Full Map</Text>
          </TouchableOpacity>
        </View>
        <View style={styles.mapContent}>
          <UnifiedMap
            orderId={orderId ?? undefined}
            // Restaurant location (pickup point)
            restaurantCoords={restaurantPos ?? undefined}
            // User location (delivery destination)
            userCoords={homePos ?? undefined}
            // Customer/Destination location (delivery point)
            destinationCoords={homePos ?? undefined}
            // Driver's current location (from real-time updates)
            deliveryPersonCoords={driverPos ?? undefined}
            // Delivery person info (show profile picture or bike icon)
            agentName={deliveryPersonName || undefined}
            agentImageUrl={deliveryPersonImageUrl || undefined}
            role="USER"
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
      <View style={styles.infoPanel}>
        <Text style={styles.orderId}>🍽️ Tracking Your Order</Text>
        {hasLocation ? (
          <>
            <Text style={styles.statusText}>🚗 Driver is on the way!</Text>
            <Text style={styles.positionText}>
              Driver position: {deliveryLocation!.longitude.toFixed(6)}, {deliveryLocation!.latitude.toFixed(6)}
            </Text>
            <Text style={styles.updateTime}>
              Last updated: {new Date(deliveryLocation!.timestamp).toLocaleTimeString()}
            </Text>
          </>
        ) : (
          <Text style={styles.statusText}>⏳ Driver location not yet available</Text>
        )}
        <Text style={styles.instructionText}>
          You can track your order in real-time. The driver's location updates every 50 meters.
        </Text>
      </View>

      {/* Full-Screen Map Modal */}
      <Modal
        visible={showFullscreenMap}
        animationType="slide"
        presentationStyle="fullScreen"
      >
        <View style={styles.fullscreenMapContainer}>
          <View style={styles.fullscreenMapHeader}>
            <Text style={styles.fullscreenMapTitle}>🗺️ Order Map</Text>
            <TouchableOpacity onPress={() => setShowFullscreenMap(false)} style={styles.closeMapButton}>
              <Ionicons name="close" size={24} color="#fff" />
            </TouchableOpacity>
          </View>
          <UnifiedMap
            orderId={orderId ?? undefined}
            restaurantCoords={restaurantPos ?? undefined}
            userCoords={homePos ?? undefined}
            destinationCoords={homePos ?? undefined}
            deliveryPersonCoords={driverPos ?? undefined}
            agentName={deliveryPersonName || undefined}
            agentImageUrl={deliveryPersonImageUrl || undefined}
            role="USER"
          />
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#666',
  },
  errorText: {
    fontSize: 16,
    color: '#cc0000',
    fontWeight: '600',
    textAlign: 'center',
  },
  subText: {
    fontSize: 14,
    color: '#666',
    marginTop: 8,
    textAlign: 'center',
  },
  mapContainer: {
    flex: 1,
  },
  mapContent: {
    flex: 1,
  },
  infoPanel: {
    padding: 16,
    backgroundColor: 'white',
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
  },
  orderId: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  statusText: {
    fontSize: 16,
    color: '#666',
    marginBottom: 4,
  },
  positionText: {
    fontSize: 14,
    color: '#999',
    marginBottom: 8,
  },
  updateTime: {
    fontSize: 12,
    color: '#666',
    marginBottom: 8,
    fontStyle: 'italic',
  },
  instructionText: {
    fontSize: 14,
    color: '#666',
    marginTop: 8,
    textAlign: 'center',
  },
  mapHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  mapTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
  },
  fullscreenMapButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#C41E26',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  fullscreenMapButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 4,
  },
  mapLegend: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingVertical: 8,
    backgroundColor: 'white',
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  legendDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: 6,
  },
  legendText: {
    fontSize: 12,
    color: '#666',
  },
  fullscreenMapContainer: {
    flex: 1,
    backgroundColor: '#000',
  },
  fullscreenMapHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 15,
    paddingTop: 50, // Account for status bar
    backgroundColor: 'rgba(0,0,0,0.8)',
  },
  fullscreenMapTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
  },
  closeMapButton: {
    padding: 8,
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 20,
  },
});