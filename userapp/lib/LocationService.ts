import { supabase } from './supabase';

const LOCATION_IQ_TOKEN = process.env.EXPO_PUBLIC_LOCATION_IQ_TOKEN || "";

// Default coordinates for Kabul, Afghanistan (fallback when geocoding fails)
// Leaflet expects [latitude, longitude] format
const DEFAULT_KABUL_COORDS: [number, number] = [34.5553, 69.1761];

/**
 * Simplifies an address for better geocoding results
 * Removes extra details that confuse geocoding services
 */
function simplifyAddress(address: string): string {
  if (!address) return '';
  
  // Remove common noise words and phrases
  let simplified = address
    .replace(/Next to/gi, '')
    .replace(/Opposite to/gi, '')
    .replace(/Opposite/gi, '')
    .replace(/Near/gi, '')
    .replace(/Building/gi, '')
    .replace(/Floor/gi, '')
    .replace(/Suite/gi, '')
    .replace(/Unit/gi, '')
    .replace(/Shop/gi, '')
    .replace(/Store/gi, '')
    .replace(/Restaurant/gi, '')
    .replace(/Cafe/gi, '')
    .replace(/Hotel/gi, '')
    .replace(/,+/g, ',') // Remove multiple commas
    .trim();
  
  // Extract key location identifiers (landmarks, streets, areas)
  const keywords = ['Qasre', 'Bakhtawar', 'Shahre', 'Naw', 'Sulh', 'Rd', 'Road', 'Street', 'Avenue', 'Kabul'];
  const parts = simplified.split(/[, ]+/);
  const importantParts = parts.filter(part => 
    keywords.some(keyword => part.toLowerCase().includes(keyword.toLowerCase()))
  );
  
  // If we found important parts, use them + Kabul
  if (importantParts.length > 0) {
    return importantParts.join(' ') + ', Kabul, Afghanistan';
  }
  
  // Otherwise, just use the first part + Kabul
  const firstPart = address.split(',')[0].trim();
  return firstPart + ', Kabul, Afghanistan';
}

/**
 * Extracts coordinates from an address string if they exist
 * Looks for patterns like "lat:34.5553,lng:69.1761" or "34.5553,69.1761"
 */
function extractCoordsFromAddress(address: string): [number, number] | null {
  if (!address) return null;

  // Pattern 1: lat:34.5553,lng:69.1761 or latitude:34.5553,longitude:69.1761
  const latLngPattern = /(?:lat(?:itude)?[:\s]*([\-+]?\d*\.?\d+))[,;\s]+(?:lng(?:itude)?[:\s]*([\-+]?\d*\.?\d+))/i;
  const match1 = address.match(latLngPattern);
  if (match1 && match1[1] && match1[2]) {
    return [parseFloat(match1[1]), parseFloat(match1[2])];
  }

  // Pattern 2: Just two numbers that look like coordinates (34.xxx,69.xxx for Kabul area)
  const coordsPattern = /\b([\-+]?\d{1,2}\.\d{3,6})[,;\s]+([\-+]?\d{2,3}\.\d{3,6})\b/;
  const match2 = address.match(coordsPattern);
  if (match2 && match2[1] && match2[2]) {
    const lat = parseFloat(match2[1]);
    const lng = parseFloat(match2[2]);
    // Validate these look like Kabul coordinates (roughly 34.5, 69.1)
    if (lat >= 34.0 && lat <= 35.0 && lng >= 68.5 && lng <= 70.0) {
      return [lat, lng];
    }
  }

  return null;
}

export const getRestaurantCoords = async (restaurantId: string): Promise<[number, number] | null> => {
  try {
    if (!restaurantId) {
      // console.error("No restaurant ID provided to getRestaurantCoords");
      return null;
    }


    // Fetch restaurant data from the database - get the raw address
    const { data: restaurantData, error: dbError } = await supabase
      .from('restaurants')
      .select('address, latitude, longitude, name, coordinates_geocoded')  // Include name and geocoding status for better debugging
      .eq('id', restaurantId)
      .single() as { data: any; error: any };


    if (dbError) {
      // console.error("Error fetching restaurant from database:", dbError);
      return null;
    }

    if (!restaurantData) {
      // console.error(`No restaurant found with ID: ${restaurantId}`);
      return null;
    }


    // Check if the restaurant has stored coordinates in the database
    const hasStoredCoordinates = restaurantData.latitude !== null &&
                               restaurantData.longitude !== null &&
                               restaurantData.latitude !== undefined &&
                               restaurantData.longitude !== undefined;

    if (hasStoredCoordinates) {
      return [parseFloat(restaurantData.latitude.toString()), parseFloat(restaurantData.longitude.toString())];
    }


    // Try to extract coordinates from address string first (if stored in address)
    if (restaurantData.address) {
      const extractedCoords = extractCoordsFromAddress(restaurantData.address);
      if (extractedCoords) {
        // Save these coordinates for future use
        try {
          await (supabase
            .from('restaurants')
            .update({
              latitude: extractedCoords[0],
              longitude: extractedCoords[1],
              coordinates_geocoded: true
            } as any)
            .eq('id', restaurantId) as any) as any;
        } catch (e) {
          // console.warn('Could not save extracted coordinates:', e);
        }
        return extractedCoords;
      }
    }

    // If no stored coordinates but we have an address, geocode it using LocationIQ
    if (restaurantData.address && restaurantData.address.trim() !== '' && LOCATION_IQ_TOKEN) {
      // Simplify the address for better geocoding
      const simplifiedAddress = simplifyAddress(restaurantData.address);

      // Use LocationIQ to geocode the simplified address
      let geocodeUrl = `https://locationiq.com/v1/search.php?key=${LOCATION_IQ_TOKEN}&q=${encodeURIComponent(simplifiedAddress)}&format=json&limit=1`;

      let response = await fetch(geocodeUrl);

      // If the standard endpoint fails, try the EU endpoint
      if (!response.ok) {
        geocodeUrl = `https://eu1.locationiq.com/v1/search.php?key=${LOCATION_IQ_TOKEN}&q=${encodeURIComponent(simplifiedAddress)}&format=json&limit=1`;
        response = await fetch(geocodeUrl);
      }

      if (!response.ok) {
        // console.error(`LocationIQ geocoding failed with status: ${response.status}`, await response.text());
        // Return default Kabul coordinates as fallback
        return DEFAULT_KABUL_COORDS;
      }

      const result = await response.json();

      if (result && Array.isArray(result) && result.length > 0 && result[0].lon && result[0].lat) {
        const coords: [number, number] = [parseFloat(result[0].lat), parseFloat(result[0].lon)];

        // Attempt to update the database with the newly geocoded coordinates for future use
        try {
          const { error: updateError } = await (supabase
            .from('restaurants')
            .update({
              latitude: coords[0],   // latitude
              longitude: coords[1],  // longitude
              coordinates_geocoded: true,
              address: restaurantData.address // Store the address that was used for geocoding
            } as any)
            .eq('id', restaurantId) as any) as any;

          if (updateError) {
            // console.warn(`Warning: Could not update restaurant ${restaurantId} with geocoded coordinates:`, updateError);
          }
        } catch (updateErr) {
          // console.warn(`Warning: Failed to update restaurant ${restaurantId} with coordinates:`, updateErr);
        }

        return coords;
      } else if (result && typeof result === 'object' && result.lon && result.lat) {
        // Some LocationIQ responses might be a single object instead of an array
        const coords: [number, number] = [parseFloat(result.lat), parseFloat(result.lon)];

        try {
          await (supabase
            .from('restaurants')
            .update({
              latitude: coords[0],
              longitude: coords[1],
              coordinates_geocoded: true,
              address: restaurantData.address
            } as any)
            .eq('id', restaurantId) as any) as any;
        } catch (updateErr) {
          // console.warn(`Warning: Failed to update restaurant ${restaurantId} with coordinates:`, updateErr);
        }

        return coords;
      } else {
        // console.warn(`Could not geocode address for restaurant ${restaurantId}:`, restaurantData.address);
        // console.warn('LocationIQ response:', result);
        // Return default Kabul coordinates as fallback
        return DEFAULT_KABUL_COORDS;
      }
    } else if (!LOCATION_IQ_TOKEN) {
      // console.error("LOCATION_IQ_TOKEN is not set in environment variables");
      // console.warn("LOCATION_IQ_TOKEN not set, returning default Kabul coordinates");
      return DEFAULT_KABUL_COORDS;
    } else {
      // console.warn(`No address found for restaurant ${restaurantId}. Address value:`, restaurantData.address);
      // Return default Kabul coordinates as fallback
      return DEFAULT_KABUL_COORDS;
    }
  } catch (err) {
    // console.error("Error getting restaurant coordinates:", err);
    // Return default Kabul coordinates if there's an error
    return DEFAULT_KABUL_COORDS;
  }
};