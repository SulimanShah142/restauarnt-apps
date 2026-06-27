// lib/routing/DirectionsService.ts
import { Alert } from 'react-native';

interface RouteResponse {
  code: string;
  routes: Array<{
    geometry: {
      coordinates: [number, number][];
    };
    distance: number;
    duration: number;
  }>;
}

export interface RouteData {
  coordinates: [number, number][];
  distance: number;
  duration: number;
}

class DirectionsService {
  private readonly baseUrl = 'https://api.openrouteservice.org/v2/directions/driving-car';

  constructor(private apiKey: string) {}

  async getRoute(start: [number, number], end: [number, number]): Promise<RouteData | null> {
    try {
      const params = {
        api_key: this.apiKey,
        start: `${start[0]},${start[1]}`,
        end: `${end[0]},${end[1]}`
      };

      const url = `${this.baseUrl}?${new URLSearchParams(params)}`;

      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Accept': 'application/json, application/geo+json, application/gpx+xml, img/png; charset=utf-8',
          'Authorization': this.apiKey,
        }
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data: RouteResponse = await response.json();

      if (data.code !== 'Ok' || !data.routes || data.routes.length === 0) {
        console.warn('No route found or invalid response:', data);
        return null;
      }

      const route = data.routes[0];
      return {
        coordinates: route.geometry.coordinates,
        distance: route.distance,
        duration: route.duration
      };
    } catch (error) {
      console.error('Error getting route:', error);
      // Note: Alert is not available in web context, so we'll just log the error
      console.warn('Routing Error', 'Could not calculate route. Using straight line instead.');
      return null;
    }
  }
}

// Alternative implementation using MapBox Directions API
class MapBoxDirectionsService {
  private readonly baseUrl = 'https://api.mapbox.com/directions/v5/mapbox/driving';

  constructor(private accessToken: string) {}

  async getRoute(start: [number, number], end: [number, number]): Promise<RouteData | null> {
    try {
      const params = {
        access_token: this.accessToken,
        geometries: 'geojson',
        steps: 'false',
        overview: 'full'
      };

      const coordinates = `${start[0]},${start[1]};${end[0]},${end[1]}`;
      const url = `${this.baseUrl}/${coordinates}?${new URLSearchParams(params)}`;

      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
        }
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();

      if (!data.routes || data.routes.length === 0) {
        console.warn('No route found or invalid response:', data);
        return null;
      }

      const route = data.routes[0];
      return {
        coordinates: route.geometry.coordinates as [number, number][],
        distance: route.distance,
        duration: route.duration
      };
    } catch (error) {
      console.error('Error getting route from MapBox:', error);
      console.warn('Routing Error', 'Could not calculate route. Using straight line instead.');
      return null;
    }
  }
}

// Fallback implementation that creates a straight line
class StraightLineService {
  async getRoute(start: [number, number], end: [number, number]): Promise<RouteData | null> {
    // Simple straight line between two points
    const coordinates: [number, number][] = [start, end];

    // Calculate approximate distance (this is a simplified calculation)
    const latDiff = end[1] - start[1];
    const lngDiff = end[0] - start[0];
    const distance = Math.sqrt(latDiff * latDiff + lngDiff * lngDiff) * 111000; // Rough conversion to meters

    return {
      coordinates,
      distance,
      duration: distance / 10 // Rough estimate (10 m/s average speed)
    };
  }
}

// Main routing service that tries multiple providers
export class RoutingService {
  private openRouteService: DirectionsService | null = null;
  private mapBoxService: MapBoxDirectionsService | null = null;
  private straightLineService = new StraightLineService();

  constructor(apiKeys?: { openRouteService?: string; mapBox?: string }) {
    if (apiKeys?.openRouteService) {
      this.openRouteService = new DirectionsService(apiKeys.openRouteService);
    }

    if (apiKeys?.mapBox) {
      this.mapBoxService = new MapBoxDirectionsService(apiKeys.mapBox);
    }
  }

  async getRoute(start: [number, number], end: [number, number]): Promise<RouteData | null> {
    // Try OpenRouteService first if available
    if (this.openRouteService) {
      const route = await this.openRouteService.getRoute(start, end);
      if (route) return route;
    }

    // Then try MapBox if available
    if (this.mapBoxService) {
      const route = await this.mapBoxService.getRoute(start, end);
      if (route) return route;
    }

    // Fallback to straight line
    return await this.straightLineService.getRoute(start, end);
  }
}