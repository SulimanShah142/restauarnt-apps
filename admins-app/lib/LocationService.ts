import { supabase } from './supabase';

const LOCATION_IQ_TOKEN = process.env.EXPO_PUBLIC_LOCATION_IQ_TOKEN || "";

export const getRestaurantCoords = async (restaurantId: string): Promise<[number, number] | null> => {
  try {
    if (!restaurantId) {
      console.error("No restaurant ID provided to getRestaurantCoords");
      return null;
    }


    // Fetch restaurant data from the database - get the raw address
    const { data: restaurantData, error: dbError } = await supabase
      .from('restaurants')
      .select('address, latitude, longitude, name')  // Include name for better debugging
      .eq('id', restaurantId)
      .single();


    if (dbError) {
      console.error("Error fetching restaurant from database:", dbError);
      return null;
    }

    if (!restaurantData) {
      console.error(`No restaurant found with ID: ${restaurantId}`);
      return null;
    }


    // If the restaurant has stored coordinates in the database, use those
    if (restaurantData.latitude !== null && restaurantData.longitude !== null) {
      return [parseFloat(restaurantData.latitude.toString()), parseFloat(restaurantData.longitude.toString())];
    }

    // If no stored coordinates but we have an address, geocode it using LocationIQ
    if (restaurantData.address && LOCATION_IQ_TOKEN) {

      // Use LocationIQ to geocode the address to coordinates
      const geocodeUrl = `https://eu1.locationiq.com/v1/search.php?key=${LOCATION_IQ_TOKEN}&q=${encodeURIComponent(restaurantData.address)}&format=json&limit=1`;
      
      const response = await fetch(geocodeUrl);

      if (!response.ok) {
        console.error(`LocationIQ geocoding failed with status: ${response.status}`, await response.text());
        return null;
      }

      const result = await response.json();

      if (result && result.length > 0 && result[0].lon && result[0].lat) {
        const coords: [number, number] = [parseFloat(result[0].lat), parseFloat(result[0].lon)];

        // Update the database with the newly geocoded coordinates for future use
        const { error: updateError } = await supabase
          .from('restaurants')
          .update({
            latitude: coords[0],   // latitude
            longitude: coords[1]   // longitude
          })
          .eq('id', restaurantId);

        if (updateError) {
          console.error(`Error updating restaurant ${restaurantId} with geocoded coordinates:`, updateError);
          // Continue with the coordinates even if the update fails
        }

        return coords;
      } else {
        console.warn(`Could not geocode address for restaurant ${restaurantId}:`, restaurantData.address);
        console.warn('LocationIQ response:', result);
        return null;
      }
    } else if (!LOCATION_IQ_TOKEN) {
      console.error("LOCATION_IQ_TOKEN is not set in environment variables");
      // Return a default location if we can't geocode
      return [-0.1276, 51.5072]; // London as default
    } else {
      console.warn(`No address found for restaurant ${restaurantId}. Address value:`, restaurantData.address);
      // Return a default location if no address is available
      return [-0.1276, 51.5072]; // London as default
    }
  } catch (err) {
    console.error("Error getting restaurant coordinates:", err);
    // Return a default location if there's an error
    return [-0.1276, 51.5072]; // London as default
  }
};