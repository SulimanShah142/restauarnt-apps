/**
 * Service to handle route calculation between two points
 * This is a placeholder that can be expanded to use a proper routing service
 */

interface RoutePoint {
  latitude: number;
  longitude: number;
}

/**
 * Calculate a route between two points
 * This is a simple straight-line implementation
 * In production, this should use a routing service like OpenRouteService or Mapbox
 */
export const calculateRoute = async (
  startPoint: [number, number],
  endPoint: [number, number]
): Promise<RoutePoint[] | null> => {
  try {
    // For now, return a straight line between the two points
    // In a real implementation, this would call a routing service
    return [
      { latitude: startPoint[0], longitude: startPoint[1] },
      { latitude: endPoint[0], longitude: endPoint[1] }
    ];
  } catch (error) {
    // console.error('Error calculating route:', error);
    return null;
  }
};

/**
 * Calculate a route using OpenRouteService (requires API key)
 */
export const calculateRouteWithORS = async (
  startPoint: [number, number], 
  endPoint: [number, number]
): Promise<RoutePoint[] | null> => {
  const ORS_API_KEY = process.env.EXPO_PUBLIC_OPENROUTE_SERVICE_KEY;
  
  if (!ORS_API_KEY) {
    // console.warn('OpenRouteService API key not configured, falling back to straight line');
    return calculateRoute(startPoint, endPoint);
  }

  try {
    const response = await fetch('https://api.openrouteservice.org/v2/directions/driving-car', {
      method: 'POST',
      headers: {
        'Authorization': ORS_API_KEY,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        coordinates: [
          [startPoint[0], startPoint[1]], // [longitude, latitude]
          [endPoint[0], endPoint[1]]      // [longitude, latitude]
        ],
        format: 'geojson',
        instructions: false
      })
    });

    if (!response.ok) {
      throw new Error(`OpenRouteService request failed: ${response.statusText}`);
    }

    const data = await response.json();
    
    if (data.features && data.features.length > 0) {
      const coordinates = data.features[0].geometry.coordinates;
      return coordinates.map((coord: [number, number]) => ({
        latitude: coord[1],
        longitude: coord[0]
      }));
    }

    return null;
  } catch (error) {
    // console.error('Error calculating route with OpenRouteService:', error);
    return null;
  }
};

/**
 * Calculate a route using Mapbox Directions API (requires API key)
 */
export const calculateRouteWithMapbox = async (
  startPoint: [number, number], 
  endPoint: [number, number]
): Promise<RoutePoint[] | null> => {
  const MAPBOX_ACCESS_TOKEN = process.env.EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN;
  
  if (!MAPBOX_ACCESS_TOKEN) {
    // console.warn('Mapbox API key not configured, falling back to straight line');
    return calculateRoute(startPoint, endPoint);
  }

  try {
    const response = await fetch(
      `https://api.mapbox.com/directions/v5/mapbox/driving/${startPoint[0]},${startPoint[1]};${endPoint[0]},${endPoint[1]}?access_token=${MAPBOX_ACCESS_TOKEN}&geometries=geojson`,
      {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json'
        }
      }
    );

    if (!response.ok) {
      throw new Error(`Mapbox Directions request failed: ${response.statusText}`);
    }

    const data = await response.json();
    
    if (data.routes && data.routes.length > 0) {
      const coordinates = data.routes[0].geometry.coordinates;
      return coordinates.map((coord: [number, number]) => ({
        latitude: coord[1],
        longitude: coord[0]
      }));
    }

    return null;
  } catch (error) {
    // console.error('Error calculating route with Mapbox:', error);
    return null;
  }
};