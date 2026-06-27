// Utility functions for calculating delivery costs and times
// Copied from userapp/lib/delivery-calculator.ts for admin app use

/**
 * Calculate the distance between two coordinates using the haversine formula
 * @param lat1 Latitude of the first point
 * @param lon1 Longitude of the first point
 * @param lat2 Latitude of the second point
 * @param lon2 Longitude of the second point
 * @returns Distance in kilometers
 */
export const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
  const R = 6371; // Earth's radius in kilometers
  const dLat = deg2rad(lat2 - lat1);
  const dLon = deg2rad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c; // Distance in kilometers
};

/** Convert degrees to radians */
function deg2rad(deg: number): number {
  return deg * (Math.PI / 180);
}

/**
 * Calculate delivery time based on distance and average speed
 * @param distanceKm Distance in kilometers
 * @param minSpeed Minimum average speed in km/h (default: 20)
 * @param maxSpeed Maximum average speed in km/h (default: 25)
 * @param prepTimeMinutes Optional restaurant preparation time in minutes
 * @returns Object containing minTime and maxTime in minutes (includes prep time if provided)
 */
export const calculateDeliveryTime = (
  distanceKm: number,
  minSpeed: number = 20,
  maxSpeed: number = 25,
  prepTimeMinutes: number = 0
): { minTime: number; maxTime: number } => {
  // Time = Distance / Speed (in hours), then convert to minutes
  const minTimeHours = distanceKm / maxSpeed;
  const maxTimeHours = distanceKm / minSpeed;

  const travelMinTime = Math.ceil(minTimeHours * 60); // Convert to minutes and round up
  const travelMaxTime = Math.ceil(maxTimeHours * 60);  // Convert to minutes and round up

  // Add preparation time if provided
  return {
    minTime: travelMinTime + prepTimeMinutes,
    maxTime: travelMaxTime + prepTimeMinutes
  };
};

/**
 * Calculate delivery cost based on settings (constant fee)
 * @param distanceKm Distance in kilometers (not used in constant fee calculation)
 * @param constantDeliveryFee Fixed delivery fee regardless of distance
 * @param baseDeliveryFee Base delivery fee (not used in constant fee calculation)
 * @param maxFreeDeliveryDistance Max distance for free delivery (not used in constant fee calculation)
 * @param additionalFeePerKmAfterFree Additional fee per km after free (not used in constant fee calculation)
 * @returns Total delivery cost
 */
export const calculateDeliveryCost = (
  distanceKm: number,
  constantDeliveryFee: number,
  baseDeliveryFee: number = 0,
  maxFreeDeliveryDistance: number = 0,
  additionalFeePerKmAfterFree: number = 0
): number => {
  // With constant delivery fee, the cost is always the same regardless of distance
  return constantDeliveryFee;
};

/**
 * Get delivery settings from the database
 * @returns Object containing delivery settings
 */
export const getDeliverySettings = async (supabase: any): Promise<{
  constant_delivery_fee: number;
  is_delivery_enabled: boolean;
  base_delivery_fee: number;
  max_free_delivery_distance: number;
  additional_fee_per_km_after_free: number;
}> => {
  try {
    const { data, error } = await supabase
      .from('app_settings')
      .select('constant_delivery_fee, is_delivery_enabled, base_delivery_fee, max_free_delivery_distance, additional_fee_per_km_after_free')
      .single();

    if (error) {
      if (error.code === 'PGRST116') { // No rows found
        // Return default values if no settings exist
        return {
          constant_delivery_fee: 50.00, // 50 AFG fixed delivery fee
          is_delivery_enabled: true,
          base_delivery_fee: 0.00,
          max_free_delivery_distance: 0.00,
          additional_fee_per_km_after_free: 10.00
        };
      } else {
        console.error('Error fetching delivery settings:', error);
        throw error;
      }
    }

    return {
      constant_delivery_fee: data.constant_delivery_fee ?? 50.00,
      is_delivery_enabled: data.is_delivery_enabled ?? true,
      base_delivery_fee: data.base_delivery_fee ?? 0.00,
      max_free_delivery_distance: data.max_free_delivery_distance ?? 0.00,
      additional_fee_per_km_after_free: data.additional_fee_per_km_after_free ?? 10.00
    };
  } catch (error) {
    console.error('Error in getDeliverySettings:', error);
    // Return default values in case of error
    return {
      constant_delivery_fee: 50.00,
      is_delivery_enabled: true,
      base_delivery_fee: 0.00,
      max_free_delivery_distance: 0.00,
      additional_fee_per_km_after_free: 10.00
    };
  }
};
