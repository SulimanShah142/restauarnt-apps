// lib/providers/CustomOpenStreetMapProvider.ts

// Define BaseProvider interface locally since the module doesn't exist
interface BaseProvider {
  search(query: string, options?: any): Promise<any[]>;
  details(placeId: string, options?: any): Promise<any>;
}

interface OpenStreetMapResult {
  place_id: number;
  osm_id: number;
  osm_type: string;
  licence: string;
  boundingbox: string[];
  lat: string;
  lon: string;
  display_name: string;
  class: string;
  type: string;
  importance: number;
  icon: string;
}

export class CustomOpenStreetMapProvider implements BaseProvider {
  private readonly baseUrl = 'https://api.allorigins.win/raw?url=';
  
  async search(query: string, options: any = {}): Promise<any[]> {
    try {
      const limit = options.limit || 5;
      const encodedQuery = encodeURIComponent(query);
      const nominatimUrl = `https://nominatim.openstreetmap.org/search?q=${encodedQuery}&format=json&limit=${limit}&addressdetails=1`;
      const apiUrl = this.baseUrl + encodeURIComponent(nominatimUrl);

      const response = await fetch(apiUrl, {
        headers: {
          'User-Agent': 'RestaurantApp/1.0'
        }
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      // The response from the proxy might be the raw JSON from Nominatim
      let data;
      try {
        data = await response.json();
      } catch (parseError) {
        console.error('Error parsing JSON response:', parseError);
        return [];
      }

      // Check if data is an array (expected from Nominatim)
      if (!Array.isArray(data)) {
        console.error('Expected array from Nominatim API, got:', typeof data, data);
        return [];
      }

      // Transform the data to match what the component expects
      return data.map((result: any) => {
        // Ensure all required fields exist
        if (!result || typeof result !== 'object') {
          console.warn('Skipping invalid result:', result);
          return null;
        }

        const lat = parseFloat(result.lat);
        const lon = parseFloat(result.lon);

        // Skip if lat/lon are invalid
        if (isNaN(lat) || isNaN(lon)) {
          console.warn('Skipping result with invalid coordinates:', result);
          return null;
        }

        return {
          id: result.osm_id?.toString() || result.place_id?.toString(),
          name: result.display_name || result.name || 'Unknown location',
          lat: lat,
          lon: lon,
          address: result.display_name || result.name || 'Unknown address',
          raw: result
        };
      }).filter(Boolean); // Remove any null values
    } catch (error) {
      console.error('CustomOpenStreetMapProvider search error:', error);
      return [];
    }
  }

  async details(placeId: string, options: any = {}): Promise<any> {
    try {
      // For details, we'll just return a basic structure since it's rarely used
      // The main search functionality is what matters for address autocompletion
      return null;
    } catch (error) {
      console.error('CustomOpenStreetMapProvider details error:', error);
      return null;
    }
  }
}