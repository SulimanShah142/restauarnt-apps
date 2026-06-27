/**
 * Restaurant Utilities
 * Helper functions for restaurant operations
 */

import { supabase } from './supabase';

/**
 * Check if a restaurant is currently open based on opening and closing times
 * Handles overnight hours (e.g., 20:00 - 07:00)
 * @param openingTime - Opening time in HH:MM format (e.g., "09:00")
 * @param closingTime - Closing time in HH:MM format (e.g., "21:00")
 * @returns Object with isOpen boolean and status string
 */
export const checkRestaurantStatus = (
  openingTime: string | null,
  closingTime: string | null
): { isOpen: boolean; status: string } => {
  try {
    if (!openingTime || !closingTime) {
      // If no times set, assume open
      return { isOpen: true, status: 'Open' };
    }

    const now = new Date();
    const currentTime = now.getHours() * 60 + now.getMinutes(); // Current time in minutes

    // Parse opening and closing times
    const [openHour, openMinute] = openingTime.split(':').map(Number);
    const [closeHour, closeMinute] = closingTime.split(':').map(Number);

    const openingTimeInMinutes = openHour * 60 + openMinute;
    const closingTimeInMinutes = closeHour * 60 + closeMinute;

    // Check if this is an overnight shift (e.g., 20:00 - 07:00)
    const isOvernight = closingTimeInMinutes < openingTimeInMinutes;

    let isOpen = false;

    if (isOvernight) {
      // Overnight hours: Open if current time is AFTER opening OR BEFORE closing
      // Example: 20:00 - 07:00 means open from 8PM to 7AM next day
      isOpen = currentTime >= openingTimeInMinutes || currentTime < closingTimeInMinutes;
    } else {
      // Normal hours: Open if current time is BETWEEN opening and closing
      // Example: 09:00 - 21:00 means open from 9AM to 9PM same day
      isOpen = currentTime >= openingTimeInMinutes && currentTime < closingTimeInMinutes;
    }

    return {
      isOpen,
      status: isOpen ? 'Open' : 'Closed Now'
    };
  } catch (error) {
    // console.error('[Restaurant Utils] Error checking restaurant status:', error);
    return { isOpen: true, status: 'Open' }; // Default to open on error
  }
};

/**
 * Get formatted opening hours display
 * @param openingTime - Opening time in HH:MM format
 * @param closingTime - Closing time in HH:MM format
 * @returns Formatted hours string
 */
export const getOpeningHoursDisplay = (
  openingTime: string | null,
  closingTime: string | null
): string => {
  if (!openingTime || !closingTime) {
    return 'Hours not set';
  }

  // Convert to 12-hour format
  const formatTime = (timeStr: string) => {
    const [hours, minutes] = timeStr.split(':').map(Number);
    const period = hours >= 12 ? 'PM' : 'AM';
    const displayHours = hours % 12 || 12;
    return `${displayHours}:${minutes.toString().padStart(2, '0')} ${period}`;
  };

  return `${formatTime(openingTime)} - ${formatTime(closingTime)}`;
};

/**
 * Fetch restaurant status from database
 * @param restaurantId - Restaurant ID
 * @returns Promise with status information
 */
export const fetchRestaurantStatus = async (
  restaurantId: string
): Promise<{ isOpen: boolean; status: string; openingTime?: string; closingTime?: string }> => {
  try {
    const { data, error } = await supabase
      .from('restaurants')
      .select('opening_time, closing_time')
      .eq('id', restaurantId)
      .single() as { data: any; error: any };

    if (error || !data) {
      // console.error('[Restaurant Utils] Error fetching restaurant status:', error);
      return { isOpen: true, status: 'Open' };
    }

    const { isOpen, status } = checkRestaurantStatus(data.opening_time, data.closing_time);

    return {
      isOpen,
      status,
      openingTime: data.opening_time || undefined,
      closingTime: data.closing_time || undefined
    };
  } catch (error) {
    // console.error('[Restaurant Utils] Exception in fetchRestaurantStatus:', error);
    return { isOpen: true, status: 'Open' };
  }
};
