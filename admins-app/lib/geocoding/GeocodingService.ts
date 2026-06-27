// lib/geocoding/GeocodingService.ts
import { supabase } from '../supabase';

interface GeocodingResult {
  lat: number;
  lng: number;
}

class GeocodingService {
  /**
   * Geocodes an address using a backend proxy to avoid CORS issues
   */
  async geocodeAddress(address: string): Promise<GeocodingResult | null> {
    try {
      // Using our backend proxy to avoid CORS issues with the geocoding API
      const encodedAddress = encodeURIComponent(address);
      
      // Use the full URL for the fetch request to ensure it works in all contexts
      const response = await fetch(`${typeof window !== 'undefined' ? window.location.origin : 'http://localhost:8081'}/api/geocode?address=${encodedAddress}`);

      if (!response.ok) {
        throw new Error(`Geocoding proxy error! status: ${response.status}`);
      }

      const data = await response.json();

      if (data.success && data.coordinates) {
        const [lng, lat] = data.coordinates;
        
        // Validate the coordinates
        if (!isNaN(lat) && !isNaN(lng)) {
          return { lat, lng }; // Return in standard lat/lng format
        }
      }

      return null;
    } catch (error) {
      console.error("Geocoding failed:", error);
      return null;
    }
  }

  /**
   * Updates restaurant coordinates in the database based on address
   */
  async updateRestaurantCoordinates(restaurantId: string, address: string): Promise<boolean> {
    try {
      const coordinates = await this.geocodeAddress(address);
      
      if (coordinates) {
        const { error } = await supabase
          .from('restaurants')
          .update({
            latitude: coordinates.lat,
            longitude: coordinates.lng
          })
          .eq('id', restaurantId);

        if (error) {
          console.error('Error updating restaurant coordinates:', error);
          return false;
        }

        return true;
      } else {
        console.warn(`Could not geocode address for restaurant ${restaurantId}: ${address}`);
        return false;
      }
    } catch (error) {
      console.error('Error updating restaurant coordinates:', error);
      return false;
    }
  }
}

export const geocodingService = new GeocodingService();