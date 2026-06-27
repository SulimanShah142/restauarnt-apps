import { supabase } from './supabase';

const LOCATION_IQ_TOKEN = process.env.EXPO_PUBLIC_LOCATION_ID_KEY || "";

export const getRestaurantCoords = async (restaurantId: string): Promise<[number, number] | null> => {
  try {
    if (!restaurantId || !LOCATION_IQ_TOKEN) return null;

    const { data, error } = await supabase
      .from('restaurants').select('address, latitude, longitude').eq('id', restaurantId).single();

    if (error) {
      console.error("Error fetching restaurant:", error);
      return null;
    }

    // If the restaurant has stored coordinates, use those
    if (data && (data as any).latitude && (data as any).longitude) {
      return [parseFloat((data as any).longitude.toString()), parseFloat((data as any).latitude.toString())];
    }

    // If no stored coordinates, try to geocode the address
    if (data?.address) {
      const res = await fetch(`https://us1.locationiq.com/v1/search.php?key=${LOCATION_IQ_TOKEN}&q=${encodeURIComponent(data.address)}&format=json&limit=1`);
      const result: any = await res.json();

      if (result && Array.isArray(result) && result.length > 0 && result[0].lon && result[0].lat) {
        return [parseFloat(result[0].lon), parseFloat(result[0].lat)]; // [lng, lat]
      }
    }

    return null;
  } catch (err) {
    console.error("Geocoding failed", err);
    return null;
  }
};