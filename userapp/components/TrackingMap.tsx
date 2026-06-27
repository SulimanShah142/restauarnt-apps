import React from 'react';
import UnifiedMap from './UnifiedMap';

interface TrackingMapProps {
  orderId: string;
  restaurantCoords: { latitude: number; longitude: number };
  userCoords?: { latitude: number; longitude: number };
  isAdmin?: boolean; // True if used in admin app
}

const TrackingMap: React.FC<TrackingMapProps> = ({
  orderId,
  restaurantCoords,
  userCoords,
  isAdmin = false
}) => {
  const role = isAdmin ? 'ADMIN' : 'USER';

  // Convert to [latitude, longitude] format for Leaflet
  const restaurantCoordsArray: [number, number] = [restaurantCoords.latitude, restaurantCoords.longitude];
  const userCoordsArray: [number, number] | undefined = userCoords
    ? [userCoords.latitude, userCoords.longitude]
    : undefined;

  return (
    <UnifiedMap
      role={role as 'USER' | 'DELIVER' | 'ADMIN'}
      orderId={orderId || undefined}
      restaurantCoords={restaurantCoordsArray}
      userCoords={userCoordsArray}
    />
  );
};

export default TrackingMap;