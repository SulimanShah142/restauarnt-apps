// userapp/components/AddressAutocomplete.tsx
import React from 'react';
import { View, StyleSheet, Text } from 'react-native';
import { LocationAutocomplete } from '@julekgwa/react-native-places-autocomplete';

// Create a custom provider to handle CORS issues
class CustomOpenStreetMapProvider {
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
        // console.error('Error parsing JSON response:', parseError);
        return [];
      }

      // Check if data is an array (expected from Nominatim)
      if (!Array.isArray(data)) {
        // console.error('Expected array from Nominatim API, got:', typeof data, data);
        return [];
      }

      // Transform the data to match what the component expects
      return data.map((result: any) => {
        // Ensure all required fields exist
        if (!result || typeof result !== 'object') {
          // console.warn('Skipping invalid result:', result);
          return null;
        }

        const lat = parseFloat(result.lat);
        const lon = parseFloat(result.lon);

        // Skip if lat/lon are invalid
        if (isNaN(lat) || isNaN(lon)) {
          // console.warn('Skipping result with invalid coordinates:', result);
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
      // console.error('CustomOpenStreetMapProvider search error:', error);
      return [];
    }
  }

  async details(placeId: string, options: any = {}): Promise<any> {
    try {
      // For details, we'll just return a basic structure since it's rarely used
      // The main search functionality is what matters for address autocompletion
      return null;
    } catch (error) {
      // console.error('CustomOpenStreetMapProvider details error:', error);
      return null;
    }
  }
}

interface AddressAutocompleteProps {
  onLocationSelected: (locationData: {
    address: string;
    lat: number;
    lng: number;
  }) => void;
  placeholder?: string;
  label?: string;
}

export default function UserAddressSearch({
  onLocationSelected,
  placeholder = "Type your delivery address...",
  label = "Search Delivery Address"
}: AddressAutocompleteProps) {

  const handleSelect = (data: any) => {
    // data contains: { display_name, lat, lon }

    // Check if data has the expected properties
    if (data && data.display_name && data.lat && data.lon) {
      // We send these back to your main form to save in Supabase
      onLocationSelected({
        address: data.display_name,
        lat: parseFloat(data.lat),
        lng: parseFloat(data.lon)
      });
    } else {
      // console.error("Invalid location data received:", data);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.label}>{label}</Text>
      <LocationAutocomplete
        provider={new CustomOpenStreetMapProvider()} // Use our custom provider to avoid CORS
        placeholder={placeholder}
        onLocationSelect={handleSelect}
        queryOptions={{
          limit: 5, // Show top 5 matches
        }}
        onError={(error) => {
          // console.error("LocationAutocomplete error:", error);
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: 20,
    zIndex: 999,
    width: '100%'
  }, // High zIndex so list shows over form
  label: { fontSize: 16, fontWeight: 'bold', marginBottom: 8 },
  searchContainer: { width: '100%' },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    backgroundColor: '#fff',
    width: '100%', // Ensure full width
  },
  resultsList: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    marginTop: 5,
    zIndex: 1000, // Higher z-index for results list
  }
});