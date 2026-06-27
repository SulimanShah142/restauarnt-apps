import React from 'react';
import UnifiedMap from '@/components/UnifiedMap';

interface LiveTrackingMapProps {
  orderId: string;
  restaurantCoords: { latitude: number; longitude: number };
  destinationCoords: { latitude: number; longitude: number };
}

const LiveTrackingMap: React.FC<LiveTrackingMapProps> = ({
  orderId,
  restaurantCoords,
  destinationCoords
}) => {
  // Convert to [latitude, longitude] format for Leaflet
  const restaurantCoordsArray: [number, number] = [restaurantCoords.latitude, restaurantCoords.longitude];
  const destinationCoordsArray: [number, number] = [destinationCoords.latitude, destinationCoords.longitude];

  return (
    <UnifiedMap
      role="DELIVER"
      orderId={orderId || undefined}
      restaurantCoords={restaurantCoordsArray}
      destinationCoords={destinationCoordsArray}
    />
  );
};

export default LiveTrackingMap;