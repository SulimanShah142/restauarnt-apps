/**
 * Admin App - Image Base64 Sync Helper
 * Converts images to base64 during sync for offline support
 */

import { imageUrlToBase64 } from '@/utils/image-base64-utils';

/**
 * Convert restaurant images to base64
 */
export const convertRestaurantImagesToBase64 = async (restaurant: any): Promise<any> => {
  const base64Data: any = { ...restaurant };
  
  // Convert main image
  if (restaurant.image_url && restaurant.image_url.startsWith('http')) {
    try {
      base64Data.image_base64 = await imageUrlToBase64(restaurant.image_url);
    } catch (err) {
      console.warn('[Admin-Images] ⚠️ Failed to convert image for:', restaurant.name, err);
    }
  }

  // Convert logo
  if (restaurant.logo_url && restaurant.logo_url.startsWith('http')) {
    try {
      base64Data.logo_base64 = await imageUrlToBase64(restaurant.logo_url);
    } catch (err) {
      console.warn('[Admin-Images] ⚠️ Failed to convert logo for:', restaurant.name, err);
    }
  }

  // Convert cover image
  if (restaurant.cover_image_url && restaurant.cover_image_url.startsWith('http')) {
    try {
      base64Data.cover_image_base64 = await imageUrlToBase64(restaurant.cover_image_url);
    } catch (err) {
      console.warn('[Admin-Images] ⚠️ Failed to convert cover image for:', restaurant.name, err);
    }
  }
  
  return base64Data;
};

/**
 * Convert menu item images to base64
 */
export const convertMenuItemImagesToBase64 = async (menuItem: any): Promise<any> => {
  const base64Data: any = { ...menuItem };
  
  if (menuItem.image_url && menuItem.image_url.startsWith('http')) {
    try {
      base64Data.image_base64 = await imageUrlToBase64(menuItem.image_url);
    } catch (err) {
      console.warn('[Admin-Images] ⚠️ Failed to convert image for:', menuItem.name, err);
    }
  }
  
  return base64Data;
};

/**
 * Convert menu category images to base64
 */
export const convertMenuCategoryImagesToBase64 = async (category: any): Promise<any> => {
  const base64Data: any = { ...category };
  
  if (category.image_url && category.image_url.startsWith('http')) {
    try {
      base64Data.image_base64 = await imageUrlToBase64(category.image_url);
    } catch (err) {
      console.warn('[Admin-Images] ⚠️ Failed to convert image for:', category.name, err);
    }
  }
  
  return base64Data;
};

/**
 * Batch convert images for multiple items
 */
export const batchConvertImages = async <T extends { image_url?: string; id?: string; name?: string }>(
  items: T[],
  converter: (item: T) => Promise<any>
): Promise<any[]> => {
  const results: any[] = [];
  
  
  // Process in batches of 5 to avoid overwhelming the system
  const BATCH_SIZE = 5;
  for (let i = 0; i < items.length; i += BATCH_SIZE) {
    const batch = items.slice(i, i + BATCH_SIZE);
    
    const batchResults = await Promise.allSettled(
      batch.map(item => converter(item))
    );
    
    batchResults.forEach((result, index) => {
      if (result.status === 'fulfilled') {
        results.push(result.value);
      } else {
        const item = batch[index];
        console.error(`[Admin-Images] Failed to convert ${item.name || item.id}:`, result.reason);
        results.push({ ...item }); // Keep original without base64
      }
    });
  }
  
  return results;
};
