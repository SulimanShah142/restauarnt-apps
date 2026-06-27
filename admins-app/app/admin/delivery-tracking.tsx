import React, { useState, useEffect, useMemo } from 'react';
import { View, Text, StyleSheet, Alert, ScrollView, Image, TouchableOpacity, ActivityIndicator, Platform, Modal } from 'react-native';
import { supabase } from '@/lib/supabase';
import { RequireAuth } from '@/contexts/AuthContext';
import UnifiedMap from '@/components/UnifiedMap';
import { reverseGeocode } from '@/lib/geocoding-service';
import { useAllDeliveryLocationsListener } from '@/hooks/useDeliveryLocationListener';

// Network status check using fetch as fallback
const checkNetworkStatus = async (): Promise<boolean> => {
  try {
    // Try to fetch from Supabase to check connectivity
    const { error } = await supabase.from('delivery_persons').select('id').limit(1).maybeSingle();
    return !error;
  } catch (err) {
    console.warn('[Network] Check failed:', err);
    return false;
  }
};

// Cache for geocoded addresses to avoid repeated API calls
const geocodeCache = new Map<string, string>();

// Define TypeScript interfaces
interface DeliveryPersonLocation {
  id: string;
  name: string;
  email?: string;
  latitude: number;
  longitude: number;
  is_available: boolean;
  profilePictureUrl?: string;
  geocodedAddress?: string; // Human-readable address
  formattedLocation?: string; // Professional location display
}

interface ActiveOrderRoute {
  id: string;
  orderNumber?: string;
  status: string;
  restaurantName: string;
  restaurantLocation?: [number, number];
  customerName?: string;
  customerPhone?: string;
  deliveryAddress?: string;
  userLocation?: [number, number];
  deliveryLocation?: [number, number];
}

function DeliveryTrackingContent() {
  const [refreshing, setRefreshing] = useState(false);
  const [showFullscreenMap, setShowFullscreenMap] = useState(false);
  const [geocodeCache, setGeocodeCache] = useState<Map<string, string>>(new Map());
  const [activeOrders, setActiveOrders] = useState<ActiveOrderRoute[]>([]);
  const [ordersLoading, setOrdersLoading] = useState(false);

  // Use the broadcast listener hook for real-time delivery tracking
  const { deliveryPersons: realtimeDeliveryPersons, isLoading, error, hasLocations } = useAllDeliveryLocationsListener({
    enabled: true
  });

  // Prepare delivery persons with profile pictures for map
  const deliveryPersonsWithPictures = useMemo(() => {
    return realtimeDeliveryPersons.map(dp => ({
      ...dp,
      picture_url: dp.image_url || dp.picture_url,
      image_url: dp.image_url || dp.picture_url
    }));
  }, [realtimeDeliveryPersons]);

  // Geocode addresses for display (memoized)
  const deliveryPersonsWithGeocoded = useMemo(() => {
    return realtimeDeliveryPersons.map((dp) => {
      const cacheKey = `${dp.latitude.toFixed(5)},${dp.longitude.toFixed(5)}`;
      const cachedAddress = geocodeCache.get(cacheKey);
      
      return {
        ...dp,
        geocodedAddress: cachedAddress,
        formattedLocation: cachedAddress || `Near ${dp.latitude.toFixed(3)}°, ${dp.longitude.toFixed(3)}°`
      };
    });
  }, [realtimeDeliveryPersons, geocodeCache]);

  // Format location in a professional way
  const formatLocationProfessional = (geocoded: any): string => {
    const addr = geocoded.address || {};
    const parts: string[] = [];
    
    // Priority: City/Area → Road → Neighbourhood → State/Country
    if (addr.city || addr.town || addr.village) {
      parts.push(addr.city || addr.town || addr.village);
    } else if (addr.neighbourhood || addr.suburb) {
      parts.push(addr.neighbourhood || addr.suburb);
    }
    
    if (addr.road) {
      parts.push(addr.road);
    }
    
    if (addr.state) {
      parts.push(addr.state);
    }
    
    // If we have at least 2 parts, join them
    if (parts.length >= 2) {
      return parts.slice(0, 3).join(', ');
    }
    
    // Fallback to display_name
    return geocoded.display_name || 'Location unknown';
  };

  const fetchActiveOrders = async () => {
    try {
      setOrdersLoading(true);
      const { data: ordersData, error: ordersError } = await supabase
        .from('orders')
        .select(`
          id,
          order_number,
          status,
          delivery_address,
          delivery_lat,
          delivery_lng,
          restaurant_id,
          restaurant_name,
          restaurant_latitude,
          restaurant_longitude,
          customer_name,
          customer_phone,
          restaurants (
            id,
            name,
            latitude,
            longitude,
            address,
            phone
          )
        `)
        .in('status', ['confirmed', 'preparing', 'ready', 'on_the_way'])
        .order('created_at', { ascending: false });

      if (ordersError) {
        console.error('[DeliveryTracking] Error fetching active orders:', ordersError);
        return;
      }

      const allowedStatuses = ['confirmed', 'preparing', 'ready', 'on_the_way'];
      const transformedOrders: ActiveOrderRoute[] = (ordersData || [])
        .map((order: any) => {
          const restaurantLat = order.restaurant_latitude || order.restaurants?.latitude;
          const restaurantLng = order.restaurant_longitude || order.restaurants?.longitude;
          const restaurantLocation = restaurantLat && restaurantLng ? [Number(restaurantLat), Number(restaurantLng)] as [number, number] : undefined;
          const deliveryLocation = order.delivery_lat && order.delivery_lng ? [Number(order.delivery_lat), Number(order.delivery_lng)] as [number, number] : undefined;

          if (!restaurantLocation || !deliveryLocation) return null;

          return {
            id: order.id,
            orderNumber: order.order_number,
            status: order.status,
            createdAt: order.created_at || order.createdAt || '',
            restaurantName: order.restaurants?.name || order.restaurant_name || 'Restaurant',
            restaurantLocation,
            customerName: order.customer_name || 'Customer',
            customerPhone: order.customer_phone,
            deliveryAddress: order.delivery_address,
            userLocation: deliveryLocation,
            deliveryLocation,
          };
        })
        .filter((order) => order && allowedStatuses.includes(order.status))
        .filter(Boolean) as ActiveOrderRoute[];

      setActiveOrders(transformedOrders);
    } catch (err) {
      console.error('[DeliveryTracking] ❌ Failed to load active orders:', err);
    } finally {
      setOrdersLoading(false);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchActiveOrders();
    setTimeout(() => setRefreshing(false), 1000);
  };

  useEffect(() => {
    fetchActiveOrders();
  }, []);

  const fullscreenMapCenterCoords = realtimeDeliveryPersons.length > 0
    ? [realtimeDeliveryPersons[0].latitude, realtimeDeliveryPersons[0].longitude] as [number, number]
    : activeOrders.length > 0
      ? activeOrders[0].deliveryLocation
      : undefined;

  if (isLoading && ordersLoading) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color="#C41E26" />
        <Text style={styles.loadingText}>Loading delivery tracking...</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>🚴 Live Delivery Tracking</Text>
        <View style={styles.headerActions}>
          <TouchableOpacity onPress={() => setShowFullscreenMap(true)} style={styles.fullscreenMapButton}>
            <Text style={styles.fullscreenMapButtonText}>🗺️ Full Map</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={handleRefresh} style={styles.refreshButton}>
            <Text style={styles.refreshButtonText}>🔄 Refresh</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Map Section */}
      <View style={styles.mapContainer}>
        <UnifiedMap
          role="ADMIN"
          allDeliveryPersons={deliveryPersonsWithPictures.map(dp => ({
            id: dp.id,
            name: dp.name,
            location: [dp.latitude, dp.longitude] as [number, number],
            picture_url: dp.picture_url,
            image_url: dp.picture_url
          }))}
          allOrders={activeOrders}
          userCoords={realtimeDeliveryPersons.length > 0
            ? [realtimeDeliveryPersons[0].latitude, realtimeDeliveryPersons[0].longitude]
            : activeOrders.length > 0 && activeOrders[0].deliveryLocation
              ? activeOrders[0].deliveryLocation
              : undefined}
        />
      </View>

      {/* Delivery Personnel Cards */}
      <View style={styles.personsContainer}>
        <Text style={styles.sectionTitle}>Delivery Personnel ({realtimeDeliveryPersons.length})</Text>

        {realtimeDeliveryPersons.length === 0 ? (
          <Text style={styles.emptyText}>No delivery personnel with active locations</Text>
        ) : (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.personsScrollContent}
          >
            {realtimeDeliveryPersons.map((dp) => {
              const profileImage = dp.image_url || dp.picture_url;
              
              return (
                <View key={dp.id} style={styles.deliveryPersonCard}>
                  {profileImage ? (
                    <Image source={{ uri: profileImage }} style={styles.deliveryPersonAvatar} />
                  ) : (
                    <View style={styles.deliveryPersonAvatarPlaceholder}>
                      <Text style={styles.deliveryPersonAvatarText}>
                        {dp.name.charAt(0).toUpperCase()}
                      </Text>
                    </View>
                  )}
                  <Text style={styles.deliveryPersonName} numberOfLines={1}>
                    {dp.name}
                  </Text>
                  <View style={[styles.statusBadge, dp.is_available ? styles.statusAvailable : styles.statusBusy]}>
                    <Text style={styles.statusText}>
                      {dp.is_available ? '🟢 Available' : '🔴 Busy'}
                    </Text>
                  </View>
                  <View style={styles.locationContainer}>
                    <Text style={styles.locationIcon}>📍</Text>
                    <Text style={styles.deliveryPersonLocation} numberOfLines={2}>
                      {dp.formattedLocation || 'Location updating...'}
                    </Text>
                  </View>
                </View>
              );
            })}
          </ScrollView>
        )}
      </View>

      {/* Active Order Route List */}
      <View style={styles.ordersContainer}>
        <Text style={styles.sectionTitle}>Active Orders ({activeOrders.length})</Text>

        {activeOrders.length === 0 ? (
          <Text style={styles.emptyText}>No active orders currently between confirmed and picked up.</Text>
        ) : (
          activeOrders.map((order) => (
            <View key={order.id} style={styles.orderRouteCard}>
              <Text style={styles.orderRouteTitle}>Order #{order.orderNumber?.substring(0, 8) || order.id.substring(0, 8)}</Text>
              <Text style={styles.orderRouteText}>{order.restaurantName} → {order.customerName}</Text>
              <Text style={styles.orderRouteText}>Status: {order.status.replace('_', ' ')}</Text>
              <Text style={styles.orderRouteText}>Customer Address: {order.deliveryAddress || 'N/A'}</Text>
            </View>
          ))
        )}
      </View>

      {/* Info Section */}
      <View style={styles.infoContainer}>
        <Text style={styles.infoText}>
          ℹ️ Locations update automatically via broadcast
        </Text>
        <Text style={styles.infoSubtext}>
          Make sure delivery drivers have location tracking enabled in their app
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
            <Text style={styles.fullscreenMapTitle}>🗺️ Live Delivery Map</Text>
            <TouchableOpacity onPress={() => setShowFullscreenMap(false)} style={styles.closeMapButton}>
              <Text style={styles.closeMapButtonText}>✕ Close</Text>
            </TouchableOpacity>
          </View>
          <UnifiedMap
            role="ADMIN"
            allDeliveryPersons={deliveryPersonsWithPictures.map(dp => ({
              id: dp.id,
              name: dp.name,
              location: [dp.latitude, dp.longitude] as [number, number],
              picture_url: dp.picture_url,
              image_url: dp.picture_url
            }))}
            allOrders={activeOrders}
            userCoords={fullscreenMapCenterCoords}
          />
        </View>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 15,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  headerActions: {
    flexDirection: 'row',
    gap: 8,
  },
  fullscreenMapButton: {
    backgroundColor: '#C41E26',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  fullscreenMapButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
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
  loadingText: {
    marginTop: 10,
    fontSize: 16,
    color: '#666',
  },
  mapContainer: {
    height: 400,
    margin: 15,
    borderRadius: 12,
    overflow: 'hidden',
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    backgroundColor: '#fff',
  },
  noDeliveryContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  noDeliveryText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#666',
    marginBottom: 8,
    textAlign: 'center',
  },
  noDeliverySubtext: {
    fontSize: 13,
    color: '#999',
    textAlign: 'center',
  },
  personsContainer: {
    backgroundColor: '#fff',
    marginHorizontal: 15,
    marginBottom: 15,
    padding: 15,
    borderRadius: 12,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 15,
  },
  personsScrollContent: {
    paddingRight: 15,
  },
  deliveryPersonCard: {
    backgroundColor: '#f5f5f5',
    borderRadius: 12,
    padding: 12,
    marginRight: 12,
    width: 140,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  deliveryPersonAvatar: {
    width: 60,
    height: 60,
    borderRadius: 30,
    marginBottom: 8,
  },
  deliveryPersonAvatarPlaceholder: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#C41E26',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  deliveryPersonAvatarText: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
  },
  deliveryPersonName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    textAlign: 'center',
    marginBottom: 6,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    marginBottom: 6,
  },
  statusAvailable: {
    backgroundColor: '#E8F5E9',
  },
  statusBusy: {
    backgroundColor: '#FFEBEE',
  },
  statusText: {
    fontSize: 11,
    fontWeight: '600',
  },
  deliveryPersonLocation: {
    fontSize: 11,
    color: '#666',
    textAlign: 'center',
    flex: 1,
  },
  locationContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    marginBottom: 6,
    paddingHorizontal: 4,
  },
  locationIcon: {
    fontSize: 12,
    flexShrink: 0,
  },
  emptyText: {
    fontSize: 14,
    color: '#999',
    textAlign: 'center',
    padding: 20,
  },
  ordersContainer: {
    backgroundColor: '#fff',
    marginHorizontal: 15,
    marginBottom: 15,
    padding: 15,
    borderRadius: 12,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
  },
  orderRouteCard: {
    backgroundColor: '#F9F9F9',
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#EEE',
  },
  orderRouteTitle: {
    fontWeight: '700',
    color: '#333',
    marginBottom: 4,
    fontSize: 15,
  },
  orderRouteText: {
    fontSize: 13,
    color: '#555',
    marginBottom: 2,
  },
  infoContainer: {
    backgroundColor: '#fff',
    marginHorizontal: 15,
    marginBottom: 15,
    padding: 15,
    borderRadius: 12,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
  },
  infoText: {
    fontSize: 14,
    color: '#666',
    fontWeight: '500',
  },
  infoSubtext: {
    fontSize: 12,
    color: '#999',
    marginTop: 4,
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
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  closeMapButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
  },
});

export default function DeliveryTracking() {
  return <RequireAuth><DeliveryTrackingContent /></RequireAuth>;
}