/**
 * Deliver App - Image Base64 Sync Helper
 * Converts images to base64 during sync for offline support
 */

import { imageUrlToBase64 } from '../utils/image-base64-utils';

/**
 * Convert restaurant images to base64
 */
export const convertRestaurantImagesToBase64 = async (restaurant: any): Promise<any> => {
  const base64Data: any = { ...restaurant };

  if (restaurant.image_url && restaurant.image_url.startsWith('http')) {
    try {
      base64Data.image_base64 = await imageUrlToBase64(restaurant.image_url);
    } catch (err) {
      console.warn('[Deliver-Images] ⚠️ Failed to convert image for:', restaurant.name, err);
    }
  }

  return base64Data;
};

/**
 * Convert delivery person images to base64
 */
export const convertDeliveryPersonImagesToBase64 = async (deliveryPerson: any): Promise<any> => {
  const base64Data: any = { ...deliveryPerson };

  if (deliveryPerson.image_url && deliveryPerson.image_url.startsWith('http')) {
    try {
      base64Data.image_base64 = await imageUrlToBase64(deliveryPerson.image_url);
    } catch (err) {
      console.warn('[Deliver-Images] ⚠️ Failed to convert image for:', deliveryPerson.name, err);
    }
  }

  return base64Data;
};

/**
 * Convert profile images to base64
 */
export const convertProfileImagesToBase64 = async (profile: any): Promise<any> => {
  const base64Data: any = { ...profile };

  if (profile.image_url && profile.image_url.startsWith('http')) {
    try {
      base64Data.image_base64 = await imageUrlToBase64(profile.image_url);
    } catch (err) {
      console.warn('[Deliver-Images] ⚠️ Failed to convert image for:', profile.full_name || profile.name, err);
    }
  }

  return base64Data;
};
