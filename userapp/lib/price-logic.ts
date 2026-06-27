/**
 * Calculate delivery fee based on distance and rate
 * @param distanceInMeters - Raw distance from Google/OSRM (in meters)
 * @param ratePerKm - Price per kilometer retrieved from Supabase settings
 * @returns Formatted total price as string
 */
export const calculateDeliveryFee = (distanceInMeters: number, ratePerKm: number): string => {
  const distanceInKm = distanceInMeters / 1000;
  const total = distanceInKm * ratePerKm;
  
  // Return formatted to 2 decimal places
  return total.toFixed(2);
};

/**
 * Calculate total order amount including delivery fee
 * @param itemsPrice - Total price of items in cart
 * @param distanceInMeters - Distance in meters from routing API
 * @param ratePerKm - Rate per kilometer from settings
 * @param minimumDeliveryFee - Minimum delivery fee if applicable
 * @returns Object containing delivery cost and total amount
 */
export const calculateOrderTotal = (
  itemsPrice: number, 
  distanceInMeters: number, 
  ratePerKm: number,
  minimumDeliveryFee: number = 0
): { deliveryCost: string; totalAmount: string } => {
  const distanceInKm = distanceInMeters / 1000;
  let deliveryCost = distanceInKm * ratePerKm;
  
  // Apply minimum delivery fee if the calculated cost is less than minimum
  if (minimumDeliveryFee > 0 && deliveryCost < minimumDeliveryFee) {
    deliveryCost = minimumDeliveryFee;
  }
  
  const totalAmount = itemsPrice + deliveryCost;
  
  return {
    deliveryCost: deliveryCost.toFixed(2),
    totalAmount: totalAmount.toFixed(2)
  };
};