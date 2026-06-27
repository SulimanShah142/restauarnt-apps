/**
 * Geocoding Service using LocationIQ
 * Converts coordinates to addresses (reverse geocoding)
 * and addresses to coordinates (forward geocoding)
 * Optimized for Afghanistan addresses
 */

const LOCATIONIQ_API_KEY = process.env.EXPO_PUBLIC_LOCATION_IQ_TOKEN || '';
const BASE_URL = 'https://us1.locationiq.com/v1';

// Afghanistan bounding box for better geocoding accuracy
const AFGHANISTAN_BOUNDS = {
  north: 38.5,
  south: 29.0,
  east: 75.0,
  west: 60.0
};

export interface GeocodingResult {
  latitude: string;
  longitude: string;
  display_name: string;
  address: {
    house_number?: string;
    road?: string;
    neighbourhood?: string;
    suburb?: string;
    city?: string;
    town?: string;
    village?: string;
    state?: string;
    postcode?: string;
    country?: string;
    country_code?: string;
  };
}

export interface AddressResult {
  lat: number;
  lon: number;
  display_name: string;
  address: string;
  city?: string;
  state?: string;
  country?: string;
}

/**
 * Reverse Geocoding - Convert coordinates to address
 * @param latitude - Latitude coordinate
 * @param longitude - Longitude coordinate
 * @returns Human-readable address and structured address data
 */
export const reverseGeocode = async (
  latitude: number,
  longitude: number
): Promise<AddressResult | null> => {
  if (!LOCATIONIQ_API_KEY) {
    console.error('[Geocoding] ❌ LocationIQ API key not configured');
    return null;
  }

  try {

    const url = `${BASE_URL}/reverse.php?key=${LOCATIONIQ_API_KEY}&lat=${latitude}&lon=${longitude}&format=json`;

    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data: any = await response.json();

    // Format the address nicely
    const address = data.address;
    const formattedAddress = formatAddress(address);

    const result: AddressResult = {
      lat: parseFloat(data.latitude),
      lon: parseFloat(data.longitude),
      display_name: formattedAddress,
      address: formattedAddress,
      city: address.city || address.town || address.village || address.suburb,
      state: address.state,
      country: address.country,
    };

    return result;
  } catch (error) {
    console.error('[Geocoding] ❌ Reverse geocoding error:', error);
    return null;
  }
};

/**
 * Forward Geocoding - Convert address to coordinates
 * Optimized for Afghanistan addresses with viewbox bias
 * @param address - Address string to geocode
 * @returns Coordinates and formatted address
 */
export const forwardGeocode = async (
  address: string
): Promise<{ lat: number; lon: number; display_name: string } | null> => {
  if (!LOCATIONIQ_API_KEY) {
    console.error('[Geocoding] ❌ LocationIQ API key not configured');
    return null;
  }

  try {

    // Add Afghanistan bias to the search
    const viewbox = `${AFGHANISTAN_BOUNDS.west},${AFGHANISTAN_BOUNDS.south},${AFGHANISTAN_BOUNDS.east},${AFGHANISTAN_BOUNDS.north}`;
    
    // Try with Afghanistan bias first
    const url = `${BASE_URL}/search.php?key=${LOCATIONIQ_API_KEY}&q=${encodeURIComponent(address)}&format=json&limit=5&viewbox=${viewbox}&bounded=1`;

    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data: any[] = await response.json();

    if (!data || data.length === 0) {
      // Try without bounded search as fallback
      return await forwardGeocodeUnbounded(address);
    }

    // Find the first result that's actually in Afghanistan
    const afghanistanResult = data.find(result => {
      const lat = parseFloat(result.lat);
      const lon = parseFloat(result.lon);
      const isInBounds = lat > AFGHANISTAN_BOUNDS.south && lat < AFGHANISTAN_BOUNDS.north &&
                         lon > AFGHANISTAN_BOUNDS.west && lon < AFGHANISTAN_BOUNDS.east;
      return isInBounds;
    });

    const result = afghanistanResult || data[0];
    
    if (afghanistanResult) {
      console.warn('[Geocoding] ⚠️ No Afghanistan results, using first result:', result.display_name);
    }


    return {
      lat: parseFloat(result.lat),
      lon: parseFloat(result.lon),
      display_name: result.display_name,
    };
  } catch (error) {
    console.error('[Geocoding] ❌ Forward geocoding error:', error);
    console.error('[Geocoding] Error details:', JSON.stringify(error, null, 2));
    return null;
  }
};

/**
 * Fallback forward geocoding without Afghanistan bounds
 */
const forwardGeocodeUnbounded = async (address: string): Promise<{ lat: number; lon: number; display_name: string } | null> => {
  try {
    
    const url = `${BASE_URL}/search.php?key=${LOCATIONIQ_API_KEY}&q=${encodeURIComponent(address)}&format=json&limit=1`;
    const response = await fetch(url);
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const data: any[] = await response.json();
    
    if (!data || data.length === 0) {
      return null;
    }
    
    const result = data[0];
    
    return {
      lat: parseFloat(result.lat),
      lon: parseFloat(result.lon),
      display_name: result.display_name,
    };
  } catch (error) {
    console.error('[Geocoding] ❌ Unbounded geocoding error:', error);
    return null;
  }
};

/**
 * Format address object into readable string
 */
const formatAddress = (address: GeocodingResult['address']): string => {
  const parts: string[] = [];

  // Build address from most specific to most general
  if (address.house_number && address.road) {
    parts.push(`${address.house_number} ${address.road}`);
  } else if (address.road) {
    parts.push(address.road);
  }

  if (address.neighbourhood) {
    parts.push(address.neighbourhood);
  }

  if (address.suburb) {
    parts.push(address.suburb);
  }

  if (address.city) {
    parts.push(address.city);
  }

  if (address.state) {
    parts.push(address.state);
  }

  if (address.postcode) {
    parts.push(address.postcode);
  }

  if (address.country) {
    parts.push(address.country);
  }

  // If no parts, return "Unknown Location"
  if (parts.length === 0) {
    return 'Unknown Location';
  }

  return parts.join(', ');
};

/**
 * Batch reverse geocoding - Convert multiple coordinates to addresses
 * Rate limits to avoid API limits (LocationIQ allows 10 requests/second on free plan)
 */
export const batchReverseGeocode = async (
  coordinates: Array<{ latitude: number; longitude: number; id?: string }>
): Promise<Map<string, AddressResult>> => {
  if (!LOCATIONIQ_API_KEY) {
    console.error('[Geocoding] ❌ LocationIQ API key not configured');
    return new Map();
  }

  const results = new Map<string, AddressResult>();


  // Process in batches of 10 to respect rate limits
  const batchSize = 10;
  for (let i = 0; i < coordinates.length; i += batchSize) {
    const batch = coordinates.slice(i, i + batchSize);
    const promises = batch.map(async (coord) => {
      const key = coord.id || `${coord.latitude},${coord.longitude}`;
      const result = await reverseGeocode(coord.latitude, coord.longitude);
      if (result) {
        results.set(key, result);
      }
      // Add small delay to respect rate limits
      await new Promise(resolve => setTimeout(resolve, 100));
    });

    await Promise.all(promises);
  }

  return results;
};

/**
 * Get distance between two coordinates (Haversine formula)
 * @returns Distance in kilometers
 */
export const calculateDistance = (
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number => {
  const R = 6371; // Earth's radius in km
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
};

const toRad = (deg: number): number => {
  return deg * (Math.PI / 180);
};

/**
 * Format distance for display
 */
export const formatDistance = (distanceKm: number): string => {
  if (distanceKm < 1) {
    return `${(distanceKm * 1000).toFixed(0)}m`;
  }
  return `${distanceKm.toFixed(1)}km`;
};

export default {
  reverseGeocode,
  forwardGeocode,
  batchReverseGeocode,
  calculateDistance,
  formatDistance,
};
