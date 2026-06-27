import React, { useState, useEffect, useRef, useMemo } from 'react';
import { StyleSheet, View, ActivityIndicator, Text, Platform } from 'react-native';
import { WebView, WebViewMessageEvent } from 'react-native-webview';

interface UnifiedMapProps {
  role: 'USER' | 'DELIVER' | 'ADMIN';
  orderId?: string;
  destinationCoords?: [number, number] | null;
  restaurantCoords?: [number, number] | null;
  restaurantId?: string;  // For web compatibility
  userCoords?: [number, number] | null;
  allDeliveryPersons?: any[];
  allOrders?: any[];
  userLocation?: [number, number] | null;
  restaurantName?: string;
  userName?: string;
  agentName?: string;
  agentImageUrl?: string;
}

// MapTiler API Key - hardcoded for reliability
const MAPTILER_KEY = '5MOQerQLiYgmkWeWHRd7';

// LocationIQ API Key - hardcoded for reliability
const LOCATIONIQ_KEY = 'pk.ac03476010699238dcadcb4f0eb9a998';

// OSRM Routing API (FREE, no API key needed!)
const OSRM_ROUTING_API = 'https://router.project-osrm.org/route/v1/driving/';

// Default Kabul coordinates [lat, lng]
const DEFAULT_KABUL: [number, number] = [34.5281, 69.1761];

/**
 * Normalize coordinates to [lat, lng] format for Leaflet
 * Leaflet expects [latitude, longitude] order
 * DISABLED: No swapping to prevent infinite re-renders
 */
const normalizeCoords = (coords: [number, number] | null | undefined): [number, number] | null => {
  if (!coords || coords.length !== 2) return null;
  // Return coords as-is - no swapping to prevent re-renders
  return coords;
};

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
}: UnifiedMapProps) {
  const [loading, setLoading] = useState(true);
  const [mapError, setMapError] = useState<string | null>(null);
  const webViewRef = useRef<WebView>(null);
  const markersRef = useRef<any[]>([]);
  const hasLoadedRef = useRef(false); // Track if map has ever loaded
  const mapLoadTimeoutRef = useRef<NodeJS.Timeout | null>(null); // Store timeout reference

  const displayUserCoords = userLocation || userCoords;
  const normalizedRestaurantCoords = normalizeCoords(restaurantCoords);
  const normalizedUserCoords = normalizeCoords(displayUserCoords);
  const normalizedDestinationCoords = normalizeCoords(destinationCoords);
  
  // Calculate center based on all available coordinates
  const centerCoords = useMemo(() => {
    const allCoords: [number, number][] = [];
    
    // Add specific coords
    if (normalizedRestaurantCoords) allCoords.push(normalizedRestaurantCoords);
    if (normalizedUserCoords) allCoords.push(normalizedUserCoords);
    if (normalizedDestinationCoords) allCoords.push(normalizedDestinationCoords);
    
    // Add coords from allOrders
    if (allOrders && allOrders.length > 0) {
      allOrders.forEach((order: any) => {
        if (order.restaurant_latitude && order.restaurant_longitude) {
          allCoords.push([Number(order.restaurant_latitude), Number(order.restaurant_longitude)]);
        }
        if (order.delivery_latitude && order.delivery_longitude) {
          allCoords.push([Number(order.delivery_latitude), Number(order.delivery_longitude)]);
        }
      });
    }
    
    // Add coords from allDeliveryPersons
    if (allDeliveryPersons && allDeliveryPersons.length > 0) {
      allDeliveryPersons.forEach((person: any) => {
        if (person.location?.latitude && person.location?.longitude) {
          allCoords.push([Number(person.location.latitude), Number(person.location.longitude)]);
        } else if (person.current_latitude && person.current_longitude) {
          allCoords.push([Number(person.current_latitude), Number(person.current_longitude)]);
        }
      });
    }
    
    if (allCoords.length > 0) {
      // Calculate center of all coordinates
      const avgLat = allCoords.reduce((sum, coord) => sum + coord[0], 0) / allCoords.length;
      const avgLng = allCoords.reduce((sum, coord) => sum + coord[1], 0) / allCoords.length;
      return [avgLat, avgLng] as [number, number];
    }
    
    return DEFAULT_KABUL;
  }, [normalizedRestaurantCoords, normalizedUserCoords, normalizedDestinationCoords, allOrders, allDeliveryPersons]);

  // Only set loading timeout once when component mounts
  useEffect(() => {
    if (!hasLoadedRef.current) {
      // Clear any existing timeout
      if (mapLoadTimeoutRef.current) {
        clearTimeout(mapLoadTimeoutRef.current);
      }
      
      // Set timeout to hide loading after 5 seconds
      mapLoadTimeoutRef.current = setTimeout(() => {
        if (!hasLoadedRef.current) {
          hasLoadedRef.current = true;
          setLoading(false);
        }
      }, 10000); // 10 seconds timeout
      
      return () => {
        if (mapLoadTimeoutRef.current) {
          clearTimeout(mapLoadTimeoutRef.current);
        }
      };
    }
  }, []);

  // Memoize map HTML - only update when center or markers actually change
  const mapHtml = useMemo(() => {
    const markers: any[] = [];
    
    // Add markers for all restaurants from allOrders
    if (allOrders && allOrders.length > 0) {
      allOrders.forEach((order: any) => {
        if (order.restaurant_latitude && order.restaurant_longitude) {
          markers.push({
            lat: Number(order.restaurant_latitude),
            lng: Number(order.restaurant_longitude),
            title: order.restaurant_name || 'Restaurant',
            color: 'red',
            icon: '🍽️',
            type: 'restaurant'
          });
        }
        // Add user/customer markers
        if (order.delivery_latitude && order.delivery_longitude) {
          markers.push({
            lat: Number(order.delivery_latitude),
            lng: Number(order.delivery_longitude),
            title: order.user_name || 'Customer',
            color: 'green',
            icon: '👤',
            type: 'user'
          });
        }
      });
    }

    // Add markers for all delivery persons
    if (allDeliveryPersons && allDeliveryPersons.length > 0) {
      allDeliveryPersons.forEach((person: any) => {
        if (person.location?.latitude && person.location?.longitude) {
          markers.push({
            lat: Number(person.location.latitude),
            lng: Number(person.location.longitude),
            title: person.name || 'Delivery Person',
            color: 'orange',
            icon: '🚴',
            type: 'driver'
          });
        } else if (person.current_latitude && person.current_longitude) {
          markers.push({
            lat: Number(person.current_latitude),
            lng: Number(person.current_longitude),
            title: person.name || 'Delivery Person',
            color: 'orange',
            icon: '🚴',
            type: 'driver'
          });
        }
      });
    }

    // Add specific markers if provided (for individual order view)
    if (normalizedRestaurantCoords) {
      markers.push({
        lat: normalizedRestaurantCoords[0],
        lng: normalizedRestaurantCoords[1],
        title: restaurantName || 'Restaurant',
        color: 'red',
        icon: '🍽️',
        type: 'restaurant'
      });
    }

    if (normalizedUserCoords) {
      markers.push({
        lat: normalizedUserCoords[0],
        lng: normalizedUserCoords[1],
        title: agentName || userName || 'Customer',
        color: agentName ? 'orange' : 'green',
        icon: agentName ? '🚴' : '👤',
        type: agentName ? 'driver' : 'user'
      });
    }

    // Only show destination marker if it's different from user location
    if (normalizedDestinationCoords && role !== 'USER') {
      markers.push({
        lat: normalizedDestinationCoords[0],
        lng: normalizedDestinationCoords[1],
        title: 'Delivery Location',
        color: 'blue',
        icon: '📍',
        type: 'destination'
      });
    }

    // Check if we should draw route (restaurant to destination)
    const showRoute = normalizedRestaurantCoords && normalizedDestinationCoords;
    const routeStart = showRoute ? normalizedRestaurantCoords : null;
    const routeEnd = showRoute ? normalizedDestinationCoords : null;

    const markersJson = JSON.stringify(markers);


    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
        <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"
              integrity="sha256-p4NxAoJBhIIN+hmNHrzRCf9tD/miZyoHS5obTRR9BMY="
              crossorigin=""/>
        <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"
                integrity="sha256-20nQCchB9co0qIjJZRGuk2/Z9VM+kNiyxNV1lvTlZBo="
                crossorigin=""></script>
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body, html {
            width: 100%;
            height: 100%;
            overflow: hidden;
            background: #f0f0f0;
          }
          #map {
            width: 100%;
            height: 100vh;
            position: absolute;
            top: 0;
            left: 0;
            touch-action: none;
            -ms-touch-action: none;
          }
          .custom-marker {
            text-align: center;
            font-size: 24px;
            line-height: 1;
          }
          .marker-label {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
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
            font-size: 11px;
          }
          /* Make street labels and place names MUCH larger and more visible */
          .leaflet-tile-container {
            font-size: 30px !important;
          }
          .leaflet-tile-container .leaflet-layer {
            font-size: 30px !important;
            font-weight: 900 !important;
          }
          /* Enhance label visibility on map tiles */
          .leaflet-tile-container text,
          .leaflet-tile-container tspan {
            font-size: 28px !important;
            font-weight: 900 !important;
            stroke-width: 5 !important;
            text-shadow: 3px 3px 6px rgba(255,255,255,1) !important;
          }
          /* Prevent touch actions from propagating to parent */
          .leaflet-container {
            touch-action: none;
            -ms-touch-action: none;
          }
        </style>
      </head>
      <body>
        <div id="map"></div>
        <script>
          try {
            // Prevent default touch/scroll behavior
            document.addEventListener('touchmove', function(e) {
              e.preventDefault();
            }, { passive: false });
            
            document.addEventListener('touchstart', function(e) {
              if (e.touches.length > 1) {
                e.preventDefault();
              }
            }, { passive: false });
            
            // Prevent scroll on wheel events
            document.addEventListener('wheel', function(e) {
              e.preventDefault();
            }, { passive: false });
            
            // Initialize map with better zoom/pan settings - NO RESTRICTIONS
            var map = L.map('map', {
              zoomControl: true, // Enable zoom controls (+/- buttons)
              attributionControl: true,
              minZoom: 3, // Allow zooming out more
              maxZoom: 19,
              scrollWheelZoom: true, // Enable scroll to zoom
              doubleClickZoom: true, // Enable double click to zoom
              dragging: true, // Enable dragging/panning
              touchZoom: true, // Enable touch zoom on mobile
              boxZoom: false,
              keyboard: false,
              zoomAnimation: true,
              fadeAnimation: true,
              markerZoomAnimation: true,
              zoomSnap: 0.5,
              zoomDelta: 1,
              worldCopyJump: true, // Allow panning across the world
              inertia: true, // Smooth panning
              inertiaDeceleration: 3000,
              inertiaMaxSpeed: 1500
            }).setView([${centerCoords[0]}, ${centerCoords[1]}], 14);

            // Add MapTiler Streets v2 tile layer (Google Maps-like style - detailed, light, minimal)
            // Using correct URL format with API key
            var mapTilerKey = '${MAPTILER_KEY}';
            var tileUrl = mapTilerKey && mapTilerKey.length > 10 
              ? 'https://api.maptiler.com/maps/streets-v2/{z}/{x}/{y}.png?key=' + mapTilerKey
              : 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';
              
            L.tileLayer(tileUrl, {
              maxZoom: 19,
              minZoom: 3,
              attribution: mapTilerKey && mapTilerKey.length > 10 ? '© MapTiler © OpenStreetMap contributors' : '© OpenStreetMap contributors',
              crossOrigin: true,
              detectRetina: true
            }).addTo(map);

            // Make map brighter/whiter and more minimal (Google Maps-like)
            if (document.querySelector('.leaflet-layer')) {
              document.querySelector('.leaflet-layer').style.filter = 'brightness(1.1) contrast(0.92) saturate(0.85)';
            }

            // Force Leaflet redraw in WebView when the map first renders
            setTimeout(function() {
              map.invalidateSize();
            }, 100);
            setTimeout(function() {
              map.invalidateSize();
            }, 500);
            setTimeout(function() {
              map.invalidateSize();
            }, 1000);

            // Add markers FIRST (before route, so route appears on top)
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
            var allMarkerPositions = [];
            Object.keys(locationGroups).forEach(function(key) {
              var group = locationGroups[key];
              var lat = parseFloat(key.split(',')[0]);
              var lng = parseFloat(key.split(',')[1]);

              if (group.length === 1) {
                // Single marker - no offset needed
                var m = group[0];
                var customIcon = L.divIcon({
                  className: 'custom-div-icon',
                  html: '<div style="font-size: 32px; text-shadow: 2px 2px 4px rgba(0,0,0,0.3);">' + m.icon + '</div>',
                  iconSize: [40, 40],
                  iconAnchor: [20, 40],
                  popupAnchor: [0, -40]
                });
                L.marker([lat, lng], { icon: customIcon, zIndexOffset: 1000 })
                  .addTo(map)
                  .bindPopup('<b>' + m.title + '</b>');
                allMarkerPositions.push([lat, lng]);
              } else {
                // Multiple markers at same location - add offsets
                var offset = 0.0003; // ~30 meters
                group.forEach(function(m, i) {
                  var offsetX = (i - (group.length - 1) / 2) * offset;
                  var offsetY = (i % 2) * offset;
                  var customIcon = L.divIcon({
                    className: 'custom-div-icon',
                    html: '<div style="font-size: 32px; text-shadow: 2px 2px 4px rgba(0,0,0,0.3);">' + m.icon + '</div>',
                    iconSize: [40, 40],
                    iconAnchor: [20, 40],
                    popupAnchor: [0, -40]
                  });
                  L.marker([lat + offsetY, lng + offsetX], { icon: customIcon, zIndexOffset: 1000 })
                    .addTo(map)
                    .bindPopup('<b>' + m.title + '</b>');
                  allMarkerPositions.push([lat + offsetY, lng + offsetX]);
                });
              }
            });

            if (allMarkerPositions.length > 0) {
              var bounds = L.latLngBounds(allMarkerPositions);
              setTimeout(function() {
                map.fitBounds(bounds, { padding: [50, 50], maxZoom: 16 });
                map.invalidateSize();
              }, 200);
            }

            // Draw route BEFORE markers (so markers appear on top of route)
            var routeStart = ${routeStart ? `[${routeStart[0]}, ${routeStart[1]}]` : 'null'};
            var routeEnd = ${routeEnd ? `[${routeEnd[0]}, ${routeEnd[1]}]` : 'null'};

            if (routeStart && routeEnd) {

              // Fetch route from OSRM (FREE, no API key needed!)
              // OSRM format: /route/v1/driving/lng,lat;lng,lat?overview=full&geometries=geojson
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
                  
                  // Check for API errors
                  if (data.code !== 'Ok') {
                    // console.error('❌ OSRM Route API error:', data.code, data.message);
                    drawStraightLine();
                    return;
                  }
                  
                  // Check if we have valid route data
                  if (!data.routes || data.routes.length === 0) {
                    // console.warn('⚠️ No routes in OSRM response');
                    drawStraightLine();
                    return;
                  }
                  
                  var route = data.routes[0];
                  
                  if (!route.geometry || !route.geometry.coordinates) {
                    // console.error('❌ No geometry coordinates in route');
                    drawStraightLine();
                    return;
                  }
                  
                  // GeoJSON returns [lng, lat], Leaflet needs [lat, lng]
                  var routeCoords = route.geometry.coordinates.map(function(coord) {
                    return [coord[1], coord[0]];
                  });

                  // Draw route line on map (thinner, follows streets)
                  var routeLine = L.polyline(routeCoords, {
                    color: '#C41E26',
                    weight: 4,
                    opacity: 0.9,
                    lineCap: 'round',
                    lineJoin: 'round'
                  }).addTo(map);

                  // Bring route to back so markers are on top
                  routeLine.bringToBack();

                  // Fit map to show entire route with padding
                  setTimeout(function() {
                    map.fitBounds(routeLine.getBounds(), { padding: [50, 50] });
                    map.invalidateSize();
                    if (window.ReactNativeWebView) {
                      window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'mapLoaded' }));
                    }
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
                    setTimeout(function() {
                      map.invalidateSize();
                      if (window.ReactNativeWebView) {
                        window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'mapLoaded' }));
                      }
                    }, 100);
                  }
                })
                .catch(function(error) {
                  console.error('❌ OSRM route error:', error);
                  drawStraightLine();
                });
            } else {
              // No route to draw - notify map is loaded
              setTimeout(function() {
                if (window.ReactNativeWebView) {
                  window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'mapLoaded' }));
                }
              }, 500);
            }

            // Handle map errors
            map.on('error', function(e) {
              if (window.ReactNativeWebView) {
                window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'mapError', error: e.message }));
              }
            });
          } catch (err) {
            if (window.ReactNativeWebView) {
              window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'mapError', error: err.message }));
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
    allOrders,
    allDeliveryPersons
  ]);

  const handleWebViewMessage = (event: WebViewMessageEvent) => {
    try {
      const data = JSON.parse(event.nativeEvent.data);
      if (data.type === 'mapLoaded') {
        hasLoadedRef.current = true; // Mark as loaded
        setLoading(false);
        // Clear timeout since map loaded successfully
        if (mapLoadTimeoutRef.current) {
          clearTimeout(mapLoadTimeoutRef.current);
          mapLoadTimeoutRef.current = null;
        }
      } else if (data.type === 'mapError') {
        // console.error('🗺️ [LeafletMap] ❌ Error:', data.error);
        setMapError(data.error);
        setLoading(false);
      }
    } catch (err) {
      // console.error('[LeafletMap] Message parse error:', err);
    }
  };

  return (
    <View style={styles.container}>
      {/* WebView always renders first */}
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
        onMessage={handleWebViewMessage}
        onError={(syntheticEvent) => {
          const { nativeEvent } = syntheticEvent;
          // console.error('[LeafletMap] ❌ WebView error:', nativeEvent);
          setMapError('Failed to load map');
          setLoading(false);
        }}
        onLoadStart={() => {
          // console.log('[LeafletMap] Load start');
        }}
        onLoad={() => {
          // Don't set loading false here - wait for mapLoaded message or timeout
        }}
        onLoadEnd={() => {
          // console.log('[LeafletMap] Load end');
        }}
      />

      {/* Loading overlay on top of WebView */}
      {loading && (
        <View style={[styles.loadingOverlay, styles.centerContent]}>
          <ActivityIndicator size="large" color="#C41E26" />
          <Text style={styles.loadingText}>Loading map...</Text>
        </View>
      )}

      {/* Error overlay on top of WebView */}
      {mapError && (
        <View style={[styles.errorOverlay, styles.centerContent]}>
          <Text style={styles.errorText}>❌ {mapError}</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, width: '100%', height: '100%', backgroundColor: '#e0e0e0' },
  map: { flex: 1, width: '100%', height: '100%' },
  centerContent: { justifyContent: 'center', alignItems: 'center' },
  loadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(255,255,255,0.9)',
    zIndex: 1000,
  },
  errorOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(255,255,255,0.9)',
    zIndex: 1001,
  },
  loadingText: { marginTop: 10, fontSize: 16, color: '#666' },
  errorText: { fontSize: 16, fontWeight: 'bold', color: '#C41E26' },
});
