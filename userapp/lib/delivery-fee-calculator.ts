// Delivery fee calculator with constant pricing
import { restaurantService } from './restaurant-service';

/**
 * Calculate the total order amount with constant delivery fee
 * @param subtotal The subtotal of items in the cart
 * @returns Object containing subtotal, delivery fee, and total
 */
export async function calculateOrderTotal(subtotal: number) {
  // Use constant delivery fee of 50 AFN
  const deliveryFee = 50;
  const total = subtotal + deliveryFee;

  return {
    subtotal,
    deliveryFee,
    total
  };
}

/**
 * Check if the order meets the minimum amount requirement
 * @param subtotal The subtotal of items in the cart
 * @returns Whether the order meets the minimum requirement
 */
export async function checkMinimumOrderRequirement(subtotal: number): Promise<boolean> {
  // Use constant minimum order amount of 100 AFN
  const minimumOrderAmount = 100;
  return subtotal >= minimumOrderAmount;
}

/**
 * Get the minimum order amount
 * @returns The minimum order amount required
 */
export async function getMinimumOrderAmount(): Promise<number> {
  // Use constant minimum order amount of 100 AFN
  return 100;
}