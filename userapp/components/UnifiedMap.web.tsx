'use client';

import React, { useEffect, useState, useRef } from 'react';
import { StyleSheet, View, Text } from 'react-native';

interface UnifiedMapProps {
  role: 'USER' | 'DELIVER' | 'ADMIN';
  orderId?: string;
  destinationCoords?: [number, number] | null;
  restaurantCoords?: [number, number] | null;
  userCoords?: [number, number] | null;
  allDeliveryPersons?: { id: string; name: string; location: [number, number] | null; picture_url?: string | null }[];
  allOrders?: { id: string; restaurantLocation: [number, number] | null; userLocation: [number, number] | null }[];
  restaurantId?: string;
  userLocation?: [number, number] | null;
  restaurantName?: string;
  userName?: string;
  agentName?: string;
}

/**
 * UnifiedMap Component - Web Version (Deliver App)
 *
 * MapTiler Map Implementation using Leaflet
 * FREE tier: 100,000 requests/month
 * LocationIQ for routing logic
 * NO Google Maps dependency
 */
const UnifiedMap: React.FC<UnifiedMapProps> = ({
  role,
  orderId,
  destinationCoords,
  restaurantCoords,
  userCoords,
  allDeliveryPersons,
  allOrders,
  restaurantId,
  userLocation,
  restaurantName,
  userName,
  agentName
}) => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstance = useRef<any>(null);
  const markersRef = useRef<any[]>([]);

  const displayUserCoords = userLocation || userCoords;

  // Helper to get center coordinates
  const getCenterCoords = () => {
    return displayUserCoords || restaurantCoords || destinationCoords || [34.5281, 69.1761]; // Kabul default
  };

  // Initialize map with Leaflet and MapTiler tiles
  useEffect(() => {
    if (!mapRef.current) return;

    const initMap = async () => {
      try {
        // Dynamically import leaflet (web only)
        const L = await import('leaflet' as any).catch(() => null);
        if (!L) {
          console.error('[UnifiedMap] Leaflet not found');
          return;
        }

        // Check if map already exists
        if (mapInstance.current) {
          mapInstance.current.remove();
          mapInstance.current = null;
        }

        const centerCoords = getCenterCoords();

        // Initialize map
        const map = L.map(mapRef.current).setView(centerCoords, 13);

        // Use ESRI World Imagery Satellite tiles (FREE - No API key required)
        // More reliable than MapTiler for web
        L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
          attribution: '&copy; ESRI | World Imagery',
          maxZoom: 19,
        }).addTo(map);

        mapInstance.current = map;

        // Add markers
        addMarkers(L, map);

        setLoading(false);
      } catch (err: any) {
        console.error('[DeliverWebMap] ❌ Error initializing map:', err);
        setError(err.message || 'Failed to load map');
        setLoading(false);
      }
    };

    initMap();

    // Cleanup on unmount
    return () => {
      if (mapInstance.current) {
        mapInstance.current.remove();
        mapInstance.current = null;
      }
      markersRef.current = [];
    };
  }, []);

  // Add markers to map
  const addMarkers = (L: any, map: any) => {
    // Clear existing markers
    markersRef.current.forEach(marker => marker.remove());
    markersRef.current = [];

    const centerCoords = getCenterCoords();

    // Restaurant marker
    if (restaurantCoords) {
      const marker = L.marker(restaurantCoords).addTo(map);
      marker.bindPopup(`<b>${restaurantName || 'Restaurant'}</b><br>Pickup location`);
      markersRef.current.push(marker);
    }

    // User/Destination marker
    if (displayUserCoords) {
      const marker = L.marker(displayUserCoords).addTo(map);
      marker.bindPopup(`<b>${userName || 'Customer'}</b><br>Delivery location`);
      markersRef.current.push(marker);
    }

    // Delivery persons markers (for ADMIN role)
    if (role === 'ADMIN' && allDeliveryPersons) {
      allDeliveryPersons.forEach((dp) => {
        if (dp.location) {
          const marker = L.marker(dp.location).addTo(map);
          marker.bindPopup(`<b>${dp.name}</b><br>Delivery Person`);
          markersRef.current.push(marker);
        }
      });
    }

    // Orders markers (for ADMIN role)
    if (role === 'ADMIN' && allOrders) {
      allOrders.forEach((order) => {
        if (order.restaurantLocation) {
          const marker = L.marker(order.restaurantLocation).addTo(map);
          marker.bindPopup(`<b>Restaurant</b><br>${(order as any).restaurantName || 'Restaurant'}`);
          markersRef.current.push(marker);
        }
        if (order.userLocation) {
          const marker = L.marker(order.userLocation).addTo(map);
          marker.bindPopup(`<b>Customer</b><br>Delivery location`);
          markersRef.current.push(marker);
        }
      });
    }

    // Fit map to show all markers
    if (markersRef.current.length > 0) {
      const group = L.featureGroup(markersRef.current);
      map.fitBounds(group.getBounds().pad(0.1));
    } else {
      map.setView(centerCoords, 13);
    }
  };

  // Update markers when coords change
  useEffect(() => {
    if (!mapInstance.current || loading) return;

    const L = require('leaflet');
    addMarkers(L, mapInstance.current);
  }, [restaurantCoords, displayUserCoords, allDeliveryPersons, allOrders, loading]);

  // Show error state
  if (error) {
    return (
      <View style={styles.container}>
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>Error: {error}</Text>
        </View>
      </View>
    );
  }

  // Show loading state
  if (loading) {
    return (
      <View style={styles.container}>
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>Loading map...</Text>
        </View>
      </View>
    );
  }

  // Render map container
  return (
    <View style={styles.container}>
      <div
        ref={mapRef}
        style={{
          width: '100%',
          height: '100%',
          minHeight: 300,
        }}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    width: '100%',
    height: '100%',
    backgroundColor: '#e5e5e5',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#e5e5e5',
    minHeight: 300,
  },
  loadingText: {
    fontSize: 16,
    color: '#666',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#e5e5e5',
    minHeight: 300,
  },
  errorText: {
    fontSize: 16,
    color: '#cc0000',
  },
});

export default UnifiedMap;
