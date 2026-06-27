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
  agentImageUrl?: string;  // Delivery person profile picture URL
  deliveryPersonCoords?: [number, number] | null;  // Real-time driver location for route cutting
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
  agentImageUrl,
  deliveryPersonCoords,
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
  const normalizedDeliveryPersonCoords = normalizeCoords(deliveryPersonCoords);
  const centerCoords = normalizedDeliveryPersonCoords || normalizedRestaurantCoords || normalizedUserCoords || normalizedDestinationCoords || DEFAULT_KABUL;

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
      }, 5000); // 5 seconds timeout
      
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
    // Filter orders to only show today's active orders when possible.
    // If the order objects do not include a date field, fall back to active status only.
    const now = new Date();
    const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    const activeAdminOrders = (role === 'ADMIN' && allOrders)
      ? allOrders.filter((order) => {
          const allowedStatuses = ['confirmed', 'on_the_way'];
          if (!allowedStatuses.includes(order.status)) return false;

          const createdAtValue = (order as any).createdAt || (order as any).created_at || (order as any).order_date || '';
          if (!createdAtValue) {
            return false; // Exclude orders without date metadata
          }

          const orderDate = new Date(createdAtValue);
          if (Number.isNaN(orderDate.getTime())) {
            return false; // Exclude orders with invalid dates
          }

          const now = new Date();
          const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
          return orderDate >= twentyFourHoursAgo && orderDate <= now;
        })
      : [];

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

    // Show user/delivery destination marker only for non-admin views.
    // Admin delivery tracking uses order-specific markers instead of a generic user icon.
    if (normalizedUserCoords && role !== 'ADMIN') {
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

    // Add all delivery persons as driver markers (ADMIN role specific)
    if (role === 'ADMIN' && allDeliveryPersons && allDeliveryPersons.length > 0) {
      allDeliveryPersons.forEach((dp, index) => {
        if (dp.location && Array.isArray(dp.location) && dp.location.length === 2) {
          markers.push({
            lat: dp.location[0],
            lng: dp.location[1],
            title: dp.name || `Driver ${index + 1}`,
            color: 'orange',
            icon: '🚴',
            type: 'driver',
            picture_url: dp.picture_url || dp.image_url || null, // Show profile picture if available
          });
        }
      });
    }

    // Add order markers for ADMIN role
    if (role === 'ADMIN' && activeAdminOrders.length > 0) {
      const uniqueRestaurants = new Map(); // Track unique restaurants by ID or location
      const uniqueCustomerLocations = new Map(); // Track unique customer delivery locations
      
      activeAdminOrders.forEach((order) => {
        // Deduplicate restaurant markers by ID first, otherwise by normalized restaurant name
        const restaurantNameKey = (order.restaurantName || '').trim().toLowerCase();
        const restaurantKey = order.restaurantId || restaurantNameKey || `${order.restaurantLocation?.[0]},${order.restaurantLocation?.[1]}`;
        if (!uniqueRestaurants.has(restaurantKey) && order.restaurantLocation && Array.isArray(order.restaurantLocation) && order.restaurantLocation.length === 2) {
          uniqueRestaurants.set(restaurantKey, true);
          markers.push({
            lat: order.restaurantLocation[0],
            lng: order.restaurantLocation[1],
            title: order.restaurantName || 'Restaurant',
            color: 'red',
            icon: '🍽️',
            type: 'restaurant'
          });
        }

        // Add customer/delivery location only for active orders, but dedupe by name and rounded location
        const customerLoc = order.userLocation || order.deliveryLocation;
        if (customerLoc && Array.isArray(customerLoc) && customerLoc.length === 2) {
          const customerNameKey = (order.customerName || '').trim().toLowerCase();
          const customerKey = customerNameKey
            ? `${customerNameKey}:${customerLoc[0].toFixed(5)}:${customerLoc[1].toFixed(5)}`
            : `${customerLoc[0].toFixed(5)}:${customerLoc[1].toFixed(5)}`;
          if (!uniqueCustomerLocations.has(customerKey)) {
            uniqueCustomerLocations.set(customerKey, true);
            markers.push({
              lat: customerLoc[0],
              lng: customerLoc[1],
              title: order.customerName || `Customer ${order.id.substring(0, 8)}`,
              color: 'blue',
              icon: '📍',
              type: 'destination'
            });
          }
        }
      });
    }

    // Deduplicate all markers by type and rounded location to prevent duplicates at the same spot.
    const dedupedMarkers: any[] = [];
    const markerKeys = new Set<string>();
    const roundCoord = (value: number) => Number(Number(value).toFixed(5));
    markers.forEach((marker) => {
      const key = `${marker.type}:${roundCoord(marker.lat)}:${roundCoord(marker.lng)}`;
      if (!markerKeys.has(key)) {
        markerKeys.add(key);
        dedupedMarkers.push(marker);
      }
    });
    const markersToRender = dedupedMarkers;

    // Build order route segments for ADMIN map views and dedupe exact duplicate paths
    const orderRoutes = (role === 'ADMIN' && activeAdminOrders.length > 0)
      ? (() => {
          const routeKeys = new Set<string>();
          const routes: any[] = [];
          activeAdminOrders.forEach((order) => {
            const restaurantLoc = order.restaurantLocation;
            const customerLoc = order.userLocation || order.deliveryLocation;
            if (restaurantLoc && Array.isArray(restaurantLoc) && restaurantLoc.length === 2 &&
                customerLoc && Array.isArray(customerLoc) && customerLoc.length === 2) {
              const routeKey = `${restaurantLoc[0]},${restaurantLoc[1]}|${customerLoc[0]},${customerLoc[1]}`;
              if (!routeKeys.has(routeKey)) {
                routeKeys.add(routeKey);
                routes.push({
                  coords: [restaurantLoc, customerLoc],
                  status: order.status || 'confirmed',
                  title: order.orderNumber ? `Order #${order.orderNumber}` : `Order ${order.id.substring(0, 8)}`,
                });
              }
            }
          });
          return routes;
        })()
      : [];

    // Check if we should draw route for a single selected order (fallback for other views)
    const showRoute = normalizedRestaurantCoords && normalizedDestinationCoords;
    const routeStart = showRoute ? normalizedRestaurantCoords : null;
    const routeEnd = showRoute ? normalizedDestinationCoords : null;

    const markersJson = JSON.stringify(markersToRender);
    const orderRoutesJson = JSON.stringify(orderRoutes);


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
            font-size: 32px !important;
            transform: scale(1.15);
            transform-origin: center;
          }
          .leaflet-tile-container .leaflet-layer {
            font-size: 32px !important;
            font-weight: 900 !important;
          }
          /* Enhance label visibility on map tiles */
          .leaflet-tile-container text,
          .leaflet-tile-container tspan {
            font-size: 32px !important;
            font-weight: 900 !important;
            stroke-width: 6 !important;
            text-shadow: 4px 4px 8px rgba(255,255,255,1) !important;
          }
          .custom-div-icon {
            display: flex;
            align-items: center;
            justify-content: center;
          }
          .custom-div-icon img {
            display: block;
            width: 100%;
            height: 100%;
            object-fit: cover;
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

            // Add Google Maps tile layer via Leaflet (same as userapp)
            var tileUrl = 'https://mt1.google.com/vt/lyrs=m&x={x}&y={y}&z={z}';

            L.tileLayer(tileUrl, {
              maxZoom: 20,
              minZoom: 3,
              attribution: '© Google Maps',
              crossOrigin: true,
              detectRetina: true
            }).addTo(map);

            // Make map brighter/whiter and more minimal (Google Maps-like)
            if (document.querySelector('.leaflet-layer')) {
              document.querySelector('.leaflet-layer').style.filter = 'brightness(1.1) contrast(0.92) saturate(0.85)';
            }

            // CRITICAL: Force map to recalculate its size multiple times
            // This fixes the gray background issue in WebView
            setTimeout(function() {
              map.invalidateSize();
              console.log('[Map] invalidateSize() called at 100ms');
            }, 100);
            setTimeout(function() {
              map.invalidateSize();
              console.log('[Map] invalidateSize() called at 500ms');
            }, 500);
            setTimeout(function() {
              map.invalidateSize();
              console.log('[Map] invalidateSize() called at 1000ms');

              // Notify map is loaded AFTER tiles have time to render
              if (window.ReactNativeWebView) {
                window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'mapLoaded' }));
              }
            }, 1000);

            // Add markers FIRST (before route, so route appears on top)
            var markers = ${markersJson || '[]'};

            // Group markers by location to handle overlaps
            var locationGroups = {};
            var allMarkerPositions = [];
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
                // Single marker - no offset needed
                var m = group[0];
                
                // Check if this is a driver with a profile picture
                var markerHtml;
                if (m.type === 'driver' && m.picture_url) {
                  // Show profile picture for delivery persons
                  markerHtml = '<div style="width: 40px; height: 40px; border-radius: 50%; overflow: hidden; border: 3px solid orange; box-shadow: 0 2px 6px rgba(0,0,0,0.3);"><img src="' + m.picture_url + '" style="width: 100%; height: 100%; object-fit: cover;" /></div>';
                } else {
                  // Show emoji for other markers
                  markerHtml = '<div style="font-size: 22px; text-shadow: 2px 2px 3px rgba(0,0,0,0.3);">' + m.icon + '</div>';
                }
                
                var customIcon = L.divIcon({
                  className: 'custom-div-icon',
                  html: markerHtml,
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
                  
                  // Check if this is a driver with a profile picture
                  var markerHtml;
                  if (m.type === 'driver' && m.picture_url) {
                    // Show profile picture for delivery persons
                    markerHtml = '<div style="width: 40px; height: 40px; border-radius: 50%; overflow: hidden; border: 3px solid orange; box-shadow: 0 2px 6px rgba(0,0,0,0.3);"><img src="' + m.picture_url + '" style="width: 100%; height: 100%; object-fit: cover;" /></div>';
                  } else {
                    // Show emoji for other markers
                    markerHtml = '<div style="font-size: 32px; text-shadow: 2px 2px 4px rgba(0,0,0,0.3);">' + m.icon + '</div>';
                  }
                  
                  var customIcon = L.divIcon({
                    className: 'custom-div-icon',
                    html: markerHtml,
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

            // Fit map bounds to show all markers if there are any
            if (allMarkerPositions.length > 0) {
              var bounds = L.latLngBounds(allMarkerPositions);
              setTimeout(function() {
                map.fitBounds(bounds, { padding: [50, 50], maxZoom: 16 });
                // Force size recalculation after fitBounds
                setTimeout(function() {
                  map.invalidateSize();
                }, 200);
              }, 200);
            }

            // Draw order route lines for admin view
            var orderRoutes = ${orderRoutesJson || '[]'};
            if (orderRoutes && orderRoutes.length > 0) {
              var osrmBaseUrl = '${OSRM_ROUTING_API}';

              var drawStraightLine = function(coords, color) {
                var fallbackLine = L.polyline(coords, {
                  color: color,
                  weight: 1.5,
                  opacity: 0.78,
                  lineCap: 'round',
                  lineJoin: 'round',
                  dashArray: '8, 8'
                }).addTo(map);
                fallbackLine.bringToBack();
              };

              var drawRouteLine = function(coords, color) {
                if (!coords || coords.length !== 2) return;
                if (coords[0][0] === coords[1][0] && coords[0][1] === coords[1][1]) return;

                var osrmUrl = osrmBaseUrl +
                      coords[0][1] + ',' + coords[0][0] + ';' +
                      coords[1][1] + ',' + coords[1][0] +
                      '?overview=full&geometries=geojson&steps=true';

                fetch(osrmUrl)
                  .then(function(response) {
                    if (!response.ok) {
                      throw new Error('OSRM API error: ' + response.status);
                    }
                    return response.json();
                  })
                  .then(function(data) {
                    if (data.code !== 'Ok' || !data.routes || !data.routes.length || !data.routes[0].geometry) {
                      drawStraightLine(coords, color);
                      return;
                    }

                    var routeCoords = data.routes[0].geometry.coordinates.map(function(coord) {
                      return [coord[1], coord[0]];
                    });

                    if (!routeCoords || routeCoords.length < 2) {
                      drawStraightLine(coords, color);
                      return;
                    }

                    var routeLine = L.polyline(routeCoords, {
                      color: color,
                      weight: 2,
                      opacity: 0.88,
                      lineCap: 'round',
                      lineJoin: 'round'
                    }).addTo(map);
                    routeLine.bringToBack();
                  })
                  .catch(function() {
                    drawStraightLine(coords, color);
                  });
              };

              orderRoutes.forEach(function(routeData, index) {
                var coords = routeData.coords;
                if (!coords || coords.length !== 2) return;

                var color = '#007AFF';
                if (routeData.status === 'confirmed' || routeData.status === 'ready') {
                  color = '#C41E26';
                } else if (routeData.status === 'on_the_way' || routeData.status === 'picked_up') {
                  color = '#FF9500';
                } else if (routeData.status === 'preparing') {
                  color = '#5856D6';
                }

                setTimeout(function() {
                  drawRouteLine(coords, color);
                }, index * 120);
              });
            }

            // Draw route BEFORE markers (so markers appear on top of route)
            var routeStart = ${routeStart ? `[${routeStart[0]}, ${routeStart[1]}]` : 'null'};
            var routeEnd = ${routeEnd ? `[${routeEnd[0]}, ${routeEnd[1]}]` : 'null'};
            var deliveryPerson = ${deliveryPersonCoords ? `[${deliveryPersonCoords[0]}, ${deliveryPersonCoords[1]}]` : 'null'};

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

                  var displayRouteCoords = routeCoords;
                  if (deliveryPerson && deliveryPerson.length === 2) {
                    var minDist = Infinity;
                    var closestIndex = 0;
                    for (var i = 0; i < routeCoords.length; i++) {
                      var dx = routeCoords[i][0] - deliveryPerson[0];
                      var dy = routeCoords[i][1] - deliveryPerson[1];
                      var dist = dx * dx + dy * dy;
                      if (dist < minDist) {
                        minDist = dist;
                        closestIndex = i;
                      }
                    }
                    displayRouteCoords = routeCoords.slice(closestIndex);
                  }

                  if (!displayRouteCoords || displayRouteCoords.length < 2) {
                    drawStraightLine();
                    return;
                  }

                  // Draw route line on map (thinner, follows streets)
                  var routeLine = L.polyline(displayRouteCoords, {
                    color: '#C41E26',
                    weight: 2,
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
                  }, 100);

                  function drawStraightLine() {
                    var straightLine = L.polyline([routeStart, routeEnd], {
                      color: '#C41E26',
                      weight: 2,
                      opacity: 0.8,
                      lineCap: 'round',
                      lineJoin: 'round',
                      dashArray: '8, 8'
                    }).addTo(map);
                    straightLine.bringToBack();
                    setTimeout(function() {
                      map.invalidateSize();
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
              }, 100);
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
    allOrders,
    allDeliveryPersons,
    deliveryPersonCoords
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
