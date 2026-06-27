/**
 * UnifiedMap Component - iOS Specific (Delivery App)
 * 
 * This component is automatically used on iOS devices instead of UnifiedMap.tsx
 * React Native's platform-specific file extensions (.ios.tsx) handle this automatically.
 * 
 * Features:
 * - Leaflet maps with MapTiler tiles
 * - LocationIQ for geocoding (optional)
 * - OSRM for routing (FREE, no API key needed)
 * - Optimized for iOS WebView and touch interactions
 * - Delivery-specific marker handling (driver, destination, restaurant)
 * - Real-time route drawing between restaurant and delivery location
 */

import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { StyleSheet, View, ActivityIndicator, Text, Platform, Dimensions } from 'react-native';
import { WebView, WebViewMessageEvent } from 'react-native-webview';

interface UnifiedMapProps {
  role: 'USER' | 'DELIVER' | 'ADMIN';
  orderId?: string;
  destinationCoords?: [number, number] | null;
  restaurantCoords?: [number, number] | null;
  restaurantId?: string;
  userCoords?: [number, number] | null;
  allDeliveryPersons?: any[];
  allOrders?: any[];
  userLocation?: [number, number] | null;
  restaurantName?: string;
  userName?: string;
  agentName?: string;
  onRegionChange?: (region: { latitude: number; longitude: number; latitudeDelta: number; longitudeDelta: number }) => void;
  onMarkerPress?: (markerId: string) => void;
}

// ======================================
// API Keys - Hardcoded for reliability
// ======================================
const MAPTILER_KEY = '5MOQerQLiYgmkWeWHRd7'; // MapTiler for map tiles
const LOCATIONIQ_KEY = 'pk.ac03476010699238dcadcb4f0eb9a998'; // LocationIQ for geocoding
const OSRM_ROUTING_API = 'https://router.project-osrm.org/route/v1/driving/'; // FREE routing

// Default Kabul coordinates [lat, lng]
const DEFAULT_KABUL: [number, number] = [34.5281, 69.1761];

/**
 * Normalize coordinates to [lat, lng] format for Leaflet
 */
const normalizeCoords = (coords: [number, number] | null | undefined): [number, number] | null => {
  if (!coords || coords.length !== 2) return null;
  return coords;
};

/**
 * Generate unique marker ID
 */
const getMarkerId = (type: string, index: number): string => `${type}-${index}`;

export default function UnifiedMap({
  role,
  orderId,
  destinationCoords,
  restaurantCoords,
  userCoords,
  allDeliveryPersons,
  allOrders,
  userLocation,
  restaurantName,
  userName,
  agentName,
  onRegionChange,
  onMarkerPress,
}: UnifiedMapProps) {
  const [loading, setLoading] = useState(true);
  const [mapError, setMapError] = useState<string | null>(null);
  const [mapReady, setMapReady] = useState(false);
  const webViewRef = useRef<WebView>(null);
  const hasLoadedRef = useRef(false);
  const reRenderRef = useRef(0);

  const displayUserCoords = userLocation || userCoords;
  const normalizedRestaurantCoords = normalizeCoords(restaurantCoords);
  const normalizedUserCoords = normalizeCoords(displayUserCoords);
  const normalizedDestinationCoords = normalizeCoords(destinationCoords);
  const centerCoords = normalizedRestaurantCoords || normalizedUserCoords || normalizedDestinationCoords || DEFAULT_KABUL;

  // Log coordinates for debugging
  useEffect(() => {
  }, [centerCoords, normalizedRestaurantCoords, normalizedUserCoords, normalizedDestinationCoords, role]);

  // Loading timeout
  useEffect(() => {
    if (!hasLoadedRef.current) {
      const timer = setTimeout(() => {
        if (!hasLoadedRef.current) {
          hasLoadedRef.current = true;
          setLoading(false);
        }
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, []);

  // Handle messages from WebView
  const handleWebViewMessage = useCallback((event: WebViewMessageEvent) => {
    try {
      const data = JSON.parse(event.nativeEvent.data);
      
      if (data.type === 'mapLoaded') {
        hasLoadedRef.current = true;
        setMapReady(true);
        setLoading(false);
      } else if (data.type === 'mapError') {
        console.error('🗺️ [iOS Deliver Map] ❌ Error:', data.error);
        setMapError(data.error);
      } else if (data.type === 'regionChanged') {
        onRegionChange?.(data.region);
      } else if (data.type === 'markerPress') {
        onMarkerPress?.(data.markerId);
      }
    } catch (err) {
      console.error('[iOS Deliver Map] Message parse error:', err);
    }
  }, [onRegionChange, onMarkerPress]);

  // Memoize map HTML - only regenerate when dependencies change
  const mapHtml = useMemo(() => {
    reRenderRef.current += 1;
    
    const markers: any[] = [];

    // Restaurant marker (pickup location)
    if (normalizedRestaurantCoords) {
      markers.push({
        id: getMarkerId('restaurant', 0),
        lat: normalizedRestaurantCoords[0],
        lng: normalizedRestaurantCoords[1],
        title: restaurantName || 'Restaurant',
        color: 'red',
        icon: '🍽️',
        type: 'restaurant'
      });
    }

    // DELIVER role specific markers
    if (role === 'DELIVER') {
      // Destination (customer location) - PRIMARY marker for delivery
      if (normalizedDestinationCoords) {
        markers.push({
          id: getMarkerId('destination', 0),
          lat: normalizedDestinationCoords[0],
          lng: normalizedDestinationCoords[1],
          title: userName || 'Delivery Location',
          color: 'blue',
          icon: '📍',
          type: 'destination'
        });
      }
      
      // Driver's current location (real-time)
      if (normalizedUserCoords) {
        markers.push({
          id: getMarkerId('driver', 0),
          lat: normalizedUserCoords[0],
          lng: normalizedUserCoords[1],
          title: agentName || 'You (Driver)',
          color: 'orange',
          icon: '🚴',
          type: 'driver'
        });
      }
    } else if (role === 'ADMIN') {
      // Admin sees all orders and delivery persons
      if (normalizedDestinationCoords) {
        markers.push({
          id: getMarkerId('destination', 0),
          lat: normalizedDestinationCoords[0],
          lng: normalizedDestinationCoords[1],
          title: userName || 'Delivery Location',
          color: 'blue',
          icon: '📍',
          type: 'destination'
        });
      }
      
      // All active orders
      allOrders?.forEach((order, idx) => {
        if (order.restaurantLocation) {
          const coords = normalizeCoords(order.restaurantLocation);
          if (coords) {
            markers.push({
              id: getMarkerId('restaurant', idx + 1),
              lat: coords[0],
              lng: coords[1],
              title: order.restaurantName || 'Restaurant',
              color: 'red',
              icon: '🍽️',
              type: 'restaurant'
            });
          }
        }
        if (order.userLocation || order.deliveryLocation) {
          const coords = normalizeCoords(order.userLocation || order.deliveryLocation);
          if (coords) {
            markers.push({
              id: getMarkerId('destination', idx + 1),
              lat: coords[0],
              lng: coords[1],
              title: order.customerName || 'Delivery Location',
              color: 'blue',
              icon: '📍',
              type: 'destination'
            });
          }
        }
      });

      // All delivery persons
      allDeliveryPersons?.forEach((dp, idx) => {
        if (dp.location) {
          const coords = normalizeCoords(dp.location);
          if (coords) {
            markers.push({
              id: getMarkerId('driver', idx + 1),
              lat: coords[0],
              lng: coords[1],
              title: dp.name || 'Driver',
              color: 'orange',
              icon: '🚴',
              type: 'driver'
            });
          }
        }
      });
    } else {
      // USER role - sees restaurant and their location
      if (normalizedUserCoords) {
        markers.push({
          id: getMarkerId('user', 0),
          lat: normalizedUserCoords[0],
          lng: normalizedUserCoords[1],
          title: userName || 'Your Location',
          color: 'green',
          icon: '👤',
          type: 'user'
        });
      }
    }

    // Route configuration (restaurant to destination)
    const showRoute = normalizedRestaurantCoords && normalizedDestinationCoords;
    const routeStart = showRoute ? normalizedRestaurantCoords : null;
    const routeEnd = showRoute ? normalizedDestinationCoords : null;

    const markersJson = JSON.stringify(markers);


    // iOS-optimized HTML with enhanced touch handling
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"
              integrity="sha256-p4NxAoJBhIIN+hmNHrzRCf9tD/miZyoHS5obTRR9BMY="
              crossorigin=""/>
        <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"
                integrity="sha256-20nQCchB9co0qIjJZRGuk2/Z9VM+kNiyxNV1lvTlZBo="
                crossorigin=""></script>
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; -webkit-tap-highlight-color: transparent; }
          body, html {
            width: 100%;
            height: 100%;
            overflow: hidden;
            background: #f0f0f0;
            -webkit-overflow-scrolling: touch;
          }
          #map {
            width: 100%;
            height: 100vh;
            position: absolute;
            top: 0;
            left: 0;
            touch-action: none;
            -ms-touch-action: none;
            -webkit-tap-highlight-color: transparent;
          }
          .custom-marker {
            text-align: center;
            font-size: 24px;
            line-height: 1;
            cursor: pointer;
          }
          .marker-label {
            font-family: -apple-system, BlinkMacSystemFont, 'SF Pro Display', 'Segoe UI', Roboto, sans-serif;
            font-size: 14px;
            font-weight: 700;
            color: #333;
            background: rgba(255,255,255,0.95);
            padding: 4px 10px;
            border-radius: 4px;
            margin-top: 2px;
            white-space: nowrap;
            box-shadow: 0 2px 6px rgba(0,0,0,0.3);
            border: 2px solid rgba(0,0,0,0.1);
          }
          .leaflet-control-attribution {
            font-size: 10px;
            background: rgba(255,255,255,0.7) !important;
          }
          .leaflet-control-zoom {
            border: none !important;
          }
          .leaflet-control-zoom-in, .leaflet-control-zoom-out {
            background: rgba(255,255,255,0.9) !important;
            color: #333 !important;
            border: 1px solid rgba(0,0,0,0.1) !important;
            font-size: 16px !important;
            font-weight: bold !important;
          }
          /* Enhanced street label visibility */
          .leaflet-tile-container {
            font-size: 30px !important;
          }
          .leaflet-tile-container text,
          .leaflet-tile-container tspan {
            font-size: 28px !important;
            font-weight: 900 !important;
            stroke-width: 5 !important;
            text-shadow: 3px 3px 6px rgba(255,255,255,1) !important;
          }
          /* iOS-specific touch optimizations */
          .leaflet-container {
            touch-action: none;
            -ms-touch-action: none;
            -webkit-touch-callout: none;
            -webkit-user-select: none;
            user-select: none;
          }
          /* Smooth animations */
          .leaflet-marker-pane, .leaflet-shadow-pane, .leaflet-tile-pane {
            will-change: transform;
          }
        </style>
      </head>
      <body>
        <div id="map"></div>
        <script>
          
          try {
            // iOS touch event handling
            document.addEventListener('touchmove', function(e) {
              e.preventDefault();
            }, { passive: false });

            document.addEventListener('touchstart', function(e) {
              if (e.touches.length > 1) {
                e.preventDefault();
              }
            }, { passive: false });

            document.addEventListener('wheel', function(e) {
              e.preventDefault();
            }, { passive: false });

            // Initialize map with iOS-optimized settings
            var map = L.map('map', {
              zoomControl: true,
              attributionControl: true,
              minZoom: 3,
              maxZoom: 19,
              scrollWheelZoom: true,
              doubleClickZoom: true,
              dragging: true,
              touchZoom: true,
              boxZoom: false,
              keyboard: false,
              zoomAnimation: true,
              fadeAnimation: true,
              markerZoomAnimation: true,
              zoomSnap: 0.5,
              zoomDelta: 1,
              worldCopyJump: true,
              inertia: true,
              inertiaDeceleration: 3000,
              inertiaMaxSpeed: 1500,
              preferCanvas: true // Use Canvas for better iOS performance
            }).setView([${centerCoords[0]}, ${centerCoords[1]}], 14);


            // Add MapTiler Streets v2 tile layer with OpenStreetMap fallback
            var mapTilerKey = '${MAPTILER_KEY}';
            var tileUrl = mapTilerKey && mapTilerKey.length > 10 
              ? 'https://api.maptiler.com/maps/streets-v2/{z}/{x}/{y}.png?key=' + mapTilerKey
              : 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';
              
            L.tileLayer(tileUrl, {
              maxZoom: 19,
              minZoom: 3,
              attribution: mapTilerKey && mapTilerKey.length > 10 ? '' : '© OpenStreetMap contributors',
              subdomains: ['a', 'b', 'c', 'd'],
              crossOrigin: true
            }).addTo(map);

            // Enhance map appearance
            var tileLayer = document.querySelector('.leaflet-layer');
            if (tileLayer) {
              tileLayer.style.filter = 'brightness(1.1) contrast(0.92) saturate(0.85)';
            }

            // Add markers
            var markers = ${markersJson || '[]'};

            // Group markers by location to handle overlaps
            var locationGroups = {};
            markers.forEach(function(m, idx) {
              var key = m.lat.toFixed(4) + ',' + m.lng.toFixed(4);
              if (!locationGroups[key]) {
                locationGroups[key] = [];
              }
              locationGroups[key].push({ ...m, index: idx });
            });

            // Add markers with offsets for overlapping locations
            Object.keys(locationGroups).forEach(function(key) {
              var group = locationGroups[key];
              var lat = parseFloat(key.split(',')[0]);
              var lng = parseFloat(key.split(',')[1]);

              if (group.length === 1) {
                var m = group[0];
                var customIcon = L.divIcon({
                  className: 'custom-div-icon',
                  html: '<div style="font-size: 32px; text-shadow: 2px 2px 4px rgba(0,0,0,0.3); cursor: pointer;">' + m.icon + '</div>',
                  iconSize: [40, 40],
                  iconAnchor: [20, 40],
                  popupAnchor: [0, -40]
                });
                var marker = L.marker([lat, lng], { icon: customIcon })
                  .addTo(map)
                  .bindPopup('<b>' + m.title + '</b>');
                
                marker.on('click', function() {
                  if (window.ReactNativeWebView) {
                    window.ReactNativeWebView.postMessage(JSON.stringify({ 
                      type: 'markerPress', 
                      markerId: m.id 
                    }));
                  }
                });
              } else {
                var offset = 0.0003;
                group.forEach(function(m, i) {
                  var offsetX = (i - (group.length - 1) / 2) * offset;
                  var offsetY = (i % 2) * offset;
                  var customIcon = L.divIcon({
                    className: 'custom-div-icon',
                    html: '<div style="font-size: 32px; text-shadow: 2px 2px 4px rgba(0,0,0,0.3); cursor: pointer;">' + m.icon + '</div>',
                    iconSize: [40, 40],
                    iconAnchor: [20, 40],
                    popupAnchor: [0, -40]
                  });
                  var marker = L.marker([lat + offsetY, lng + offsetX], { icon: customIcon })
                    .addTo(map)
                    .bindPopup('<b>' + m.title + '</b>');
                  
                  marker.on('click', function() {
                    if (window.ReactNativeWebView) {
                      window.ReactNativeWebView.postMessage(JSON.stringify({ 
                        type: 'markerPress', 
                        markerId: m.id 
                      }));
                    }
                  });
                });
              }
            });

            // Draw route (restaurant to destination)
            var routeStart = ${routeStart ? `[${routeStart[0]}, ${routeStart[1]}]` : 'null'};
            var routeEnd = ${routeEnd ? `[${routeEnd[0]}, ${routeEnd[1]}]` : 'null'};

            if (routeStart && routeEnd) {

              fetch('${OSRM_ROUTING_API}' +
                    routeStart[1] + ',' + routeStart[0] + ';' +
                    routeEnd[1] + ',' + routeEnd[0] +
                    '?overview=full&geometries=geojson&steps=true')
                .then(response => {
                  if (!response.ok) {
                    throw new Error('OSRM API error: ' + response.status);
                  }
                  return response.json();
                })
                .then(data => {

                  if (data.code !== 'Ok') {
                    console.error('❌ OSRM Route API error:', data.code, data.message);
                    drawStraightLine();
                    return;
                  }

                  if (!data.routes || data.routes.length === 0) {
                    console.warn('⚠️ No routes in OSRM response');
                    drawStraightLine();
                    return;
                  }

                  var route = data.routes[0];

                  if (!route.geometry || !route.geometry.coordinates) {
                    console.error('❌ No geometry coordinates in route');
                    drawStraightLine();
                    return;
                  }

                  var routeCoords = route.geometry.coordinates.map(function(coord) {
                    return [coord[1], coord[0]];
                  });

                  // Draw route line on map
                  var routeLine = L.polyline(routeCoords, {
                    color: '#C41E26',
                    weight: 4,
                    opacity: 0.9,
                    lineCap: 'round',
                    lineJoin: 'round'
                  }).addTo(map);

                  routeLine.bringToBack();

                  // Fit map to show entire route
                  setTimeout(function() {
                    map.fitBounds(routeLine.getBounds(), { padding: [50, 50] });
                  }, 100);

                  function drawStraightLine() {
                    var straightLine = L.polyline([routeStart, routeEnd], {
                      color: '#C41E26',
                      weight: 4,
                      opacity: 0.8,
                      lineCap: 'round',
                      lineJoin: 'round',
                      dashArray: '10, 10'
                    }).addTo(map);
                    straightLine.bringToBack();
                  }
                })
                .catch(function(error) {
                  console.error('❌ OSRM route error:', error);
                  drawStraightLine();
                });
            } else {
              // No route to draw
              setTimeout(function() {
                if (window.ReactNativeWebView) {
                  window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'mapLoaded' }));
                }
              }, 500);
            }

            // Handle map move events
            map.on('moveend', function() {
              var center = map.getCenter();
              var bounds = map.getBounds();
              var northEast = bounds.getNorthEast();
              var southWest = bounds.getSouthWest();
              
              if (window.ReactNativeWebView) {
                window.ReactNativeWebView.postMessage(JSON.stringify({
                  type: 'regionChanged',
                  region: {
                    latitude: center.lat,
                    longitude: center.lng,
                    latitudeDelta: northEast.lat - southWest.lat,
                    longitudeDelta: northEast.lng - southWest.lng
                  }
                }));
              }
            });

            // Handle map errors
            map.on('error', function(e) {
              console.error('Map error:', e);
              if (window.ReactNativeWebView) {
                window.ReactNativeWebView.postMessage(JSON.stringify({ 
                  type: 'mapError', 
                  error: e.message 
                }));
              }
            });

            // Notify React Native that map is loaded
            setTimeout(function() {
              if (window.ReactNativeWebView) {
                window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'mapLoaded' }));
              }
            }, 500);

          } catch (err) {
            console.error('Map initialization error:', err);
            if (window.ReactNativeWebView) {
              window.ReactNativeWebView.postMessage(JSON.stringify({ 
                type: 'mapError', 
                error: err.message 
              }));
            }
          }
        </script>
      </body>
      </html>
    `;
  }, [
    centerCoords[0], centerCoords[1],
    normalizedRestaurantCoords?.[0], normalizedRestaurantCoords?.[1],
    normalizedUserCoords?.[0], normalizedUserCoords?.[1],
    normalizedDestinationCoords?.[0], normalizedDestinationCoords?.[1],
    role,
    restaurantName,
    userName,
    agentName,
    allOrders?.length,
    allDeliveryPersons?.length
  ]);

  return (
    <View style={styles.container}>
      {/* WebView for rendering Leaflet map */}
      <WebView
        ref={webViewRef}
        originWhitelist={['*']}
        source={{ html: mapHtml }}
        style={styles.map}
        javaScriptEnabled={true}
        domStorageEnabled={true}
        scrollEnabled={false}
        overScrollMode="never"
        showsVerticalScrollIndicator={false}
        showsHorizontalScrollIndicator={false}
        bounces={false}
        mixedContentMode="always"
        allowsInlineMediaPlayback={true}
        mediaPlaybackRequiresUserAction={false}
        onMessage={handleWebViewMessage}
        onError={(syntheticEvent) => {
          const { nativeEvent } = syntheticEvent;
          console.error('[iOS Deliver Map] ❌ WebView error:', nativeEvent);
          setMapError('Failed to load map');
        }}
        onShouldStartLoadWithRequest={(request) => {
          // Allow all requests
          return true;
        }}
        onLoadStart={() => {
          console.log('[iOS Deliver Map] Map loading started');
        }}
        onLoad={() => {
          console.log('[iOS Deliver Map] Map loaded');
        }}
        onLoadEnd={() => {
          console.log('[iOS Deliver Map] Map load finished');
        }}
      />

      {/* Loading overlay */}
      {loading && (
        <View style={[styles.loadingOverlay, styles.centerContent]}>
          <ActivityIndicator size="large" color="#C41E26" />
          <Text style={styles.loadingText}>Loading map...</Text>
        </View>
      )}

      {/* Error overlay */}
      {mapError && (
        <View style={[styles.errorOverlay, styles.centerContent]}>
          <Text style={styles.errorText}>❌ {mapError}</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { 
    flex: 1.5, 
    backgroundColor: '#e0e0e0',
    overflow: 'hidden',
  },
  map: { 
    flex: 1,
    backgroundColor: 'transparent',
  },
  centerContent: { 
    justifyContent: 'center', 
    alignItems: 'center',
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  loadingOverlay: {
    backgroundColor: 'rgba(255,255,255,0.9)',
    zIndex: 1000,
  },
  errorOverlay: {
    backgroundColor: 'rgba(255,255,255,0.9)',
    zIndex: 1001,
  },
  loadingText: { 
    marginTop: 10, 
    fontSize: 16, 
    color: '#666',
    fontFamily: Platform.OS === 'ios' ? 'SF Pro Text' : undefined,
  },
  errorText: { 
    fontSize: 16, 
    fontWeight: 'bold', 
    color: '#C41E26',
    fontFamily: Platform.OS === 'ios' ? 'SF Pro Text' : undefined,
  },
});
