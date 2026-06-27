/**
 * Geocoding Service with Caching - LocationIQ Only
 *
 * Features:
 * - In-memory caching to reduce API calls
 * - Rate limiting handling with exponential backoff
 * - LocationIQ provider only
 * - Fallback to default coordinates for known cities
 *
 * LocationIQ Geocoding Only
 * NO Google Maps dependency
 */

import { supabase } from './supabase';

const LOCATION_IQ_TOKEN = process.env.EXPO_PUBLIC_LOCATION_IQ_TOKEN || '';

// In-memory cache for geocoded addresses
const geocodeCache = new Map<string, { latitude: number; longitude: number; timestamp: number }>();
const CACHE_DURATION = 24 * 60 * 60 * 1000; // 24 hours

// Rate limiting state
let lastRequestTime = 0;
const MIN_REQUEST_INTERVAL = 1500; // 1.5 seconds between requests to avoid rate limiting
let consecutiveFailures = 0;
const MAX_FAILURES = 3;

// Default coordinates for major cities (fallback)
const CITY_COORDINATES: { [key: string]: { latitude: number; longitude: number } } = {
  'kabul': { latitude: 34.5553, longitude: 69.2075 },
  'herat': { latitude: 34.3482, longitude: 62.1997 },
  'kandahar': { latitude: 31.6289, longitude: 65.7372 },
  'mazar-i-sharif': { latitude: 36.7081, longitude: 67.1109 },
  'jalalabad': { latitude: 34.4415, longitude: 70.4361 },
  'kunduz': { latitude: 36.7286, longitude: 68.8571 },
};

/**
 * Normalize address for consistent caching
 */
const normalizeAddress = (address: string): string => {
  return address.toLowerCase().trim().replace(/\s+/g, ' ');
};

/**
 * Check if coordinates are in cache and not expired
 */
const getCachedCoordinates = (address: string): { latitude: number; longitude: number } | null => {
  const normalizedAddress = normalizeAddress(address);
  const cached = geocodeCache.get(normalizedAddress);

  if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
    return cached;
  }

  if (cached) {
    geocodeCache.delete(normalizedAddress);
  }

  return null;
};

/**
 * Store coordinates in cache
 */
const cacheCoordinates = (address: string, coords: { latitude: number; longitude: number }) => {
  const normalizedAddress = normalizeAddress(address);
  geocodeCache.set(normalizedAddress, {
    ...coords,
    timestamp: Date.now()
  });
};

/**
 * Delay execution for rate limiting
 */
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Enforce rate limiting between requests
 */
const enforceRateLimit = async () => {
  const now = Date.now();
  const timeSinceLastRequest = now - lastRequestTime;

  if (timeSinceLastRequest < MIN_REQUEST_INTERVAL) {
    const waitTime = MIN_REQUEST_INTERVAL - timeSinceLastRequest;
    await delay(waitTime);
  }

  lastRequestTime = Date.now();
};

/**
 * Try to get coordinates from LocationIQ
 */
const geocodeWithLocationIQ = async (address: string): Promise<{ latitude: number; longitude: number } | null> => {
  try {

    // Try standard endpoint first
    let geocodeUrl = `https://locationiq.com/v1/search.php?key=${LOCATION_IQ_TOKEN}&q=${encodeURIComponent(address)}&format=json&limit=1`;

    let response = await fetch(geocodeUrl);

    // If the standard endpoint fails, try the EU endpoint
    if (!response.ok && response.status !== 429) {
      geocodeUrl = `https://eu1.locationiq.com/v1/search.php?key=${LOCATION_IQ_TOKEN}&q=${encodeURIComponent(address)}&format=json&limit=1`;
      response = await fetch(geocodeUrl);
    }

    if (!response.ok) {
      if (response.status === 429) {
        // console.warn('[Geocoding] LocationIQ rate limited (429)');
      } else {
        // console.error(`[Geocoding] LocationIQ failed with status: ${response.status}`);
      }
      return null;
    }

    const result = await response.json();

    if (result && Array.isArray(result) && result.length > 0 && result[0].lon && result[0].lat) {
      const coords = {
        latitude: parseFloat(result[0].lat),
        longitude: parseFloat(result[0].lon)
      };
      return coords;
    } else if (result && typeof result === 'object' && result.lon && result.lat) {
      const coords = {
        latitude: parseFloat(result.lat),
        longitude: parseFloat(result.lon)
      };
      return coords;
    } else {
      // console.warn('[Geocoding] LocationIQ: No valid results');
      return null;
    }
  } catch (error) {
    // console.error('[Geocoding] LocationIQ error:', error);
    return null;
  }
};

/**
 * Get fallback coordinates based on city name in address
 */
const getFallbackCoordinates = (address: string): { latitude: number; longitude: number } | null => {
  const normalizedAddress = normalizeAddress(address);

  for (const [city, coords] of Object.entries(CITY_COORDINATES)) {
    if (normalizedAddress.includes(city)) {
      return coords;
    }
  }

  // Default to Kabul if no city match
  return CITY_COORDINATES['kabul'];
};

/**
 * Main geocoding function with caching
 * Uses LocationIQ only - NO Google Maps
 * 
 * @param address - The address to geocode
 * @param useCache - Whether to use cache (default: true)
 * @returns Object with latitude and longitude, or null if failed
 */
export const geocodeAddress = async (
  address: string,
  useCache: boolean = true
): Promise<{ latitude: number; longitude: number } | null> => {
  if (!address || typeof address !== 'string') {
    // console.warn('[Geocoding] Invalid address:', address);
    return null;
  }

  // Check cache first
  if (useCache) {
    const cached = getCachedCoordinates(address);
    if (cached) {
      return cached;
    }
  }

  // Check if we've had too many consecutive failures
  if (consecutiveFailures >= MAX_FAILURES) {
    // console.warn('[Geocoding] Too many consecutive failures, using fallback');
    const fallback = getFallbackCoordinates(address);
    consecutiveFailures = 0;
    return fallback;
  }

  try {
    // Enforce rate limiting
    await enforceRateLimit();


    // Use LocationIQ (free tier)
    let coords = await geocodeWithLocationIQ(address);

    // If LocationIQ fails, use fallback coordinates
    if (!coords) {
      consecutiveFailures++;
      // console.warn(`[Geocoding] LocationIQ failed (failure ${consecutiveFailures}/${MAX_FAILURES})`);
      coords = getFallbackCoordinates(address);
    } else {
      // Success - reset failure counter and cache result
      consecutiveFailures = 0;
      cacheCoordinates(address, coords);
    }

    return coords;
  } catch (error) {
    // console.error('[Geocoding] Unexpected error:', error);
    consecutiveFailures++;
    return getFallbackCoordinates(address);
  }
};

/**
 * Geocodes a restaurant address and stores the coordinates in the database
 */
export const geocodeAndStoreRestaurantCoordinates = async (
  restaurantId: string,
  address: string
): Promise<{ latitude: number; longitude: number } | null> => {
  if (!restaurantId || !address) {
    // console.warn('[Geocoding] Missing parameters:', { restaurantId, address });
    return null;
  }

  try {

    const coords = await geocodeAddress(address);

    if (!coords) {
      // console.warn(`[Geocoding] Could not geocode restaurant ${restaurantId}`);
      return null;
    }

    // Update the database with the coordinates
    const { error: updateError } = await (supabase
      .from('restaurants')
      .update({
        latitude: coords.latitude,
        longitude: coords.longitude,
        coordinates_geocoded: true,
        updated_at: new Date().toISOString()
      } as any)
      .eq('id', restaurantId) as any) as any;

    if (updateError) {
      // console.error(`[Geocoding] Error updating restaurant ${restaurantId}:`, updateError);
      return null;
    }

    return coords;
  } catch (error) {
    // console.error('[Geocoding] Error in geocodeAndStoreRestaurantCoordinates:', error);
    return null;
  }
};

/**
 * Updates a restaurant and automatically geocodes the address if it has changed
 */
export const updateRestaurantWithAutoGeocoding = async (
  restaurantId: string,
  updates: { [key: string]: any }
) => {
  // Check if address is being updated
  if (updates.address !== undefined) {
    // Update the restaurant record first
    const { data: restaurantData, error: updateError } = await (supabase
      .from('restaurants')
      .update(updates as any)
      .eq('id', restaurantId)
      .select('id, address')
      .single() as { data: any; error: any });

    if (updateError) {
      // console.error('[Geocoding] Error updating restaurant:', updateError);
      throw updateError;
    }

    // Now geocode the address and store coordinates
    if (restaurantData.address) {
      await geocodeAndStoreRestaurantCoordinates(restaurantId, restaurantData.address);
    }

    return restaurantData;
  } else {
    // If address is not being updated, just update other fields
    const { data, error } = await (supabase
      .from('restaurants')
      .update(updates as any)
      .eq('id', restaurantId)
      .select()
      .single() as { data: any; error: any });

    if (error) {
      // console.error('[Geocoding] Error updating restaurant:', error);
      throw error;
    }

    return data;
  }
};

/**
 * Creates a new restaurant and automatically geocodes the address
 */
export const createRestaurantWithAutoGeocoding = async (restaurantData: { [key: string]: any }) => {
  // Insert the restaurant record first
  const { data: restaurant, error: insertError } = await supabase
    .from('restaurants')
    .insert(restaurantData as any)
    .select()
    .single() as { data: any; error: any };

  if (insertError) {
    // console.error('[Geocoding] Error creating restaurant:', insertError);
    throw insertError;
  }

  // If an address was provided, geocode it and store coordinates
  if (restaurant?.address) {
    await geocodeAndStoreRestaurantCoordinates(restaurant.id, restaurant.address);
  }

  return restaurant;
};

/**
 * Batch geocoding with delays to avoid rate limiting
 */
export const batchGeocode = async (
  addresses: string[]
): Promise<Map<string, { latitude: number; longitude: number }>> => {
  const results = new Map<string, { latitude: number; longitude: number }>();


  for (let i = 0; i < addresses.length; i++) {
    const address = addresses[i];

    const coords = await geocodeAddress(address);

    if (coords) {
      results.set(address, coords);
    }

    // Add extra delay between batch requests
    if (i < addresses.length - 1) {
      await delay(2000);
    }
  }

  return results;
};

/**
 * Clear the geocoding cache
 */
export const clearGeocodeCache = () => {
  geocodeCache.clear();
};

/**
 * Get cache statistics
 */
export const getCacheStats = () => {
  return {
    size: geocodeCache.size,
    entries: Array.from(geocodeCache.entries()).map(([key, value]) => ({
      address: key,
      age: Math.round((Date.now() - value.timestamp) / 1000 / 60), // minutes
    }))
  };
};
