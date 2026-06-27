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
  allOrders?: { id: string; status: string; restaurantLocation: [number, number] | null; userLocation: [number, number] | null; restaurantName?: string; customerName?: string; orderNumber?: string }[];
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

        // Initialize map with ESRI World Imagery Satellite tiles (FREE - No API key required)
        const map = L.map(mapRef.current).setView(centerCoords, 13);

        // Use Google Maps tiles (same as main component)
        L.tileLayer('https://mt1.google.com/vt/lyrs=m&x={x}&y={y}&z={z}', {
          attribution: '© Google Maps',
          maxZoom: 20,
          minZoom: 3,
          crossOrigin: true,
          detectRetina: true
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
    const activeAdminOrders = (role === 'ADMIN' && allOrders)
      ? allOrders.filter((order) => ['confirmed', 'preparing', 'ready', 'on_the_way'].includes(order.status))
      : [];

    const createMarkerIcon = (emoji: string, pictureUrl?: string, type?: string) => {
      if (type === 'driver' && pictureUrl) {
        // Show profile picture for delivery persons
        return L.divIcon({
          className: 'custom-div-icon',
          html: `<div style="width: 40px; height: 40px; border-radius: 50%; overflow: hidden; border: 3px solid orange; box-shadow: 0 2px 6px rgba(0,0,0,0.3);"><img src="${pictureUrl}" style="width: 100%; height: 100%; object-fit: cover;" /></div>`,
          iconSize: [40, 40],
          iconAnchor: [20, 40],
          popupAnchor: [0, -40],
        });
      } else {
        // Show emoji for other markers
        return L.divIcon({
          className: 'custom-div-icon',
          html: `<div style="font-size: 20px; line-height: 1;">${emoji}</div>`,
          iconSize: [24, 24],
          iconAnchor: [12, 24],
          popupAnchor: [0, -30],
        });
      }
    };

    // Restaurant marker
    if (restaurantCoords) {
      const marker = L.marker(restaurantCoords, { icon: createMarkerIcon('🍽️') }).addTo(map);
      marker.bindPopup(`<b>${restaurantName || 'Restaurant'}</b><br>Pickup location`);
      markersRef.current.push(marker);
    }

    // User/Destination marker
    if (displayUserCoords) {
      const marker = L.marker(displayUserCoords, { icon: createMarkerIcon('📍') }).addTo(map);
      marker.bindPopup(`<b>${userName || 'Customer'}</b><br>Delivery location`);
      markersRef.current.push(marker);
    }

    // Delivery persons markers (for ADMIN role)
    if (role === 'ADMIN' && allDeliveryPersons) {
      allDeliveryPersons.forEach((dp) => {
        if (dp.location) {
          const marker = L.marker(dp.location, { icon: createMarkerIcon('🚴', dp.picture_url || undefined, 'driver') }).addTo(map);
          marker.bindPopup(`<b>${dp.name}</b><br>Delivery Person`);
          markersRef.current.push(marker);
        }
      });
    }

    // Orders markers (for ADMIN role)
    if (role === 'ADMIN' && activeAdminOrders.length > 0) {
      activeAdminOrders.forEach((order) => {
        if (order.restaurantLocation) {
          const marker = L.marker(order.restaurantLocation, { icon: createMarkerIcon('🍽️') }).addTo(map);
          marker.bindPopup(`<b>Restaurant</b><br>${(order as any).restaurantName || 'Restaurant'}`);
          markersRef.current.push(marker);
        }
        if (order.userLocation) {
          const marker = L.marker(order.userLocation, { icon: createMarkerIcon('📍') }).addTo(map);
          marker.bindPopup(`<b>Customer</b><br>Delivery location`);
          markersRef.current.push(marker);
        }
      });
    }

    // Draw order routes for ADMIN role
    if (role === 'ADMIN' && activeAdminOrders.length > 0) {
      const osrmBaseUrl = 'https://router.project-osrm.org/route/v1/driving/';
      const drawStraightLine = (coords: [number, number][], color: string) => {
        const fallbackLine = L.polyline(coords, {
          color,
          weight: 1.5,
          opacity: 0.78,
          lineCap: 'round',
          lineJoin: 'round',
          dashArray: '8, 8',
        }).addTo(map);
        fallbackLine.bringToBack();
      };

      const drawRouteLine = (coords: [number, number][], color: string) => {
        fetch(`${osrmBaseUrl}${coords[0][1]},${coords[0][0]};${coords[1][1]},${coords[1][0]}?overview=full&geometries=geojson&steps=true`)
          .then((response) => {
            if (!response.ok) throw new Error('OSRM error ' + response.status);
            return response.json();
          })
          .then((data) => {
            if (!data.routes || !data.routes.length || !data.routes[0].geometry) {
              drawStraightLine(coords, color);
              return;
            }

            const routeCoords = data.routes[0].geometry.coordinates.map((coord: any) => [coord[1], coord[0]]);
            const routeLine = L.polyline(routeCoords, {
              color,
              weight: 2,
              opacity: 0.88,
              lineCap: 'round',
              lineJoin: 'round',
            }).addTo(map);
            routeLine.bringToBack();
          })
          .catch(() => {
            drawStraightLine(coords, color);
          });
      };

      activeAdminOrders.forEach((order) => {
        if (!order.restaurantLocation || !order.userLocation) return;
        const color = order.status === 'on_the_way' ? '#FF9500' : order.status === 'preparing' ? '#5856D6' : '#C41E26';
        drawRouteLine([order.restaurantLocation, order.userLocation], color);
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
