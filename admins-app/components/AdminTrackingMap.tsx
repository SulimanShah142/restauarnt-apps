import React, { useState, useEffect } from 'react';
import UnifiedMap from '@/components/UnifiedMap';
import { useDeliveryLocationListener } from '@/hooks/useDeliveryLocationListener';

interface AdminTrackingMapProps {
  orderIds: string[]; // Multiple order IDs to track
  ordersData: Array<{
    id: string;
    restaurantCoords: { latitude: number; longitude: number };
    userCoords: { latitude: number; longitude: number };
    deliveryPersonId?: string;
  }>;
}

const AdminTrackingMap: React.FC<AdminTrackingMapProps> = ({
  orderIds,
  ordersData
}) => {
  // For admin tracking, we'll focus on the first order for now
  // In a real implementation, you might want to show all orders simultaneously
  if (ordersData.length > 0) {
    const firstOrder = ordersData[0];
    // Convert to [latitude, longitude] format for Leaflet
    const restaurantCoords: [number, number] = [firstOrder.restaurantCoords.latitude, firstOrder.restaurantCoords.longitude];
    const userCoords: [number, number] = [firstOrder.userCoords.latitude, firstOrder.userCoords.longitude];

    // Use delivery location listener hook
    const { deliveryLocation, hasLocation } = useDeliveryLocationListener({
      enabled: true,
      orderId: firstOrder.id,
      deliveryPersonId: firstOrder.deliveryPersonId
    });

    // Driver location from broadcast
    const driverCoords: [number, number] | undefined = hasLocation && deliveryLocation
      ? [deliveryLocation.latitude, deliveryLocation.longitude]
      : undefined;

    return (
      <UnifiedMap
        role="ADMIN"
        orderId={firstOrder.id}
        restaurantCoords={restaurantCoords}
        userCoords={userCoords}
        userLocation={driverCoords}
      />
    );
  }

  return null; // Return null if no orders to track
};

export default AdminTrackingMap;