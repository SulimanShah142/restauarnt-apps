/**
 * Image to Base64 Utility Functions
 * Converts images from URLs to base64 strings for offline storage
 * Works on both web (IndexedDB) and mobile (SQLite)
 */

// Only import Platform on native platforms
let Platform: any = { OS: 'web' };

try {
  const reactNative = require('react-native');
  Platform = reactNative.Platform;
} catch (e) {
  // React Native not available, running on web
  console.log('[ImageBase64] Running on web platform');
}

// Only import expo-file-system on native platforms
let FileSystem: any = null;
let ImageManipulator: any = null;

if (Platform.OS !== 'web') {
  try {
    // Import legacy API to avoid deprecation errors
    FileSystem = require('expo-file-system/legacy');
    ImageManipulator = require('expo-image-manipulator');
  } catch (e) {
    console.warn('[ImageBase64] expo modules not available:', e);
  }
}

/**
 * Configuration for image optimization
 */
const IMAGE_CONFIG = {
  // Maximum dimensions for stored images (balance quality vs storage size)
  MAX_WIDTH: 800,
  MAX_HEIGHT: 800,
  // JPEG compression quality (0-1, lower = smaller file size)
  COMPRESS_QUALITY: 0.7,
  // Maximum base64 string size before warning (in KB)
  MAX_SIZE_WARNING_KB: 500,
};

/**
 * Convert a Blob to base64 string
 */
const blobToBase64 = (blob: Blob): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const result = reader.result as string;
      // Remove data:image/jpeg;base64, prefix if present
      const base64 = result.split(',')[1] || result;
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
};

/**
 * Fetch image from URL and convert to blob (web)
 */
const fetchImageAsBlob = async (url: string): Promise<Blob> => {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch image: ${response.status} ${response.statusText}`);
  }
  return await response.blob();
};

/**
 * Compress and resize image on native platform
 */
const optimizeImageNative = async (uri: string): Promise<string> => {
  if (!ImageManipulator) {
    console.warn('[ImageBase64] ImageManipulator not available, skipping optimization');
    return uri;
  }

  try {
    const manipulated = await ImageManipulator.manipulateAsync(
      uri,
      [
        {
          resize: {
            width: IMAGE_CONFIG.MAX_WIDTH,
            height: IMAGE_CONFIG.MAX_HEIGHT,
          },
        },
      ],
      {
        compress: IMAGE_CONFIG.COMPRESS_QUALITY,
        format: ImageManipulator.SaveFormat.JPEG,
      }
    );

    return manipulated.uri;
  } catch (error) {
    console.error('[ImageBase64] Error optimizing image:', error);
    return uri; // Return original if optimization fails
  }
};

/**
 * Read file as base64 on native platform
 */
const readNativeFileAsBase64 = async (uri: string): Promise<string> => {
  if (!FileSystem) {
    throw new Error('FileSystem not available for native platform');
  }

  try {
    const base64 = await FileSystem.readAsStringAsync(uri, {
      encoding: FileSystem.EncodingType.Base64,
    });
    return base64;
  } catch (error) {
    console.error('[ImageBase64] Error reading native file:', error);
    throw error;
  }
};

/**
 * Download image to local cache and return URI (native)
 */
const downloadImageNative = async (url: string): Promise<string> => {
  if (!FileSystem) {
    throw new Error('FileSystem not available for native platform');
  }

  try {
    const cacheDir = FileSystem.documentDirectory + 'image_cache/';

    // Ensure cache directory exists
    try {
      await FileSystem.makeDirectoryAsync(cacheDir, { intermediates: true });
    } catch (e) {
      // Directory might already exist, ignore error
    }

    // Generate filename from URL hash
    const filename = 'img_' + Math.abs(hashCode(url)) + '.jpg';
    const localUri = cacheDir + filename;

    // Check if already cached
    try {
      const fileInfo = await FileSystem.getInfoAsync(localUri);
      if (fileInfo.exists) {
        console.log('[ImageBase64] Using cached image:', localUri);
        return localUri;
      }
    } catch (e) {
      // File doesn't exist, continue with download
    }

    // Download the image
    console.log('[ImageBase64] Downloading image:', url);
    const downloadResult = await FileSystem.downloadAsync(url, localUri);

    if (downloadResult.status !== 200) {
      throw new Error(`Download failed with status ${downloadResult.status}`);
    }

    return localUri;
  } catch (error) {
    console.error('[ImageBase64] Error downloading image:', error);
    throw error;
  }
};

/**
 * Simple hash function for strings
 */
const hashCode = (str: string): number => {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return hash;
};

/**
 * Check base64 string size and warn if too large
 */
const checkBase64Size = (base64: string): void => {
  const sizeKB = Math.ceil((base64.length * 3) / 4 / 1024);
  if (sizeKB > IMAGE_CONFIG.MAX_SIZE_WARNING_KB) {
    console.warn(
      `[ImageBase64] Large image detected: ${sizeKB}KB (max recommended: ${IMAGE_CONFIG.MAX_SIZE_WARNING_KB}KB)`
    );
  }
};

/**
 * Convert image URL to base64 string
 * Platform-aware: works on both web and native
 * 
 * @param imageUrl - The URL of the image to convert
 * @param optimize - Whether to optimize/compress the image (default: true)
 * @returns Base64 string (without data:image prefix)
 */
export const imageUrlToBase64 = async (
  imageUrl: string,
  optimize: boolean = true
): Promise<string> => {
  if (!imageUrl || !imageUrl.startsWith('http')) {
    console.log('[ImageBase64] Invalid or non-HTTP URL, returning as-is');
    return imageUrl || '';
  }

  console.log('[ImageBase64] Converting image to base64:', imageUrl);

  try {
    if (Platform.OS === 'web') {
      // ===== WEB IMPLEMENTATION =====
      console.log('[ImageBase64] Web platform detected');
      
      const blob = await fetchImageAsBlob(imageUrl);
      const base64 = await blobToBase64(blob);
      
      checkBase64Size(base64);
      console.log('[ImageBase64] Web conversion successful, size:', Math.ceil((base64.length * 3) / 4 / 1024), 'KB');
      
      return base64;
    } else {
      // ===== NATIVE IMPLEMENTATION =====
      console.log('[ImageBase64] Native platform detected');
      
      // Download image to local cache
      const localUri = await downloadImageNative(imageUrl);
      
      // Optimize if requested
      let optimizedUri = localUri;
      if (optimize) {
        optimizedUri = await optimizeImageNative(localUri);
      }
      
      // Read as base64
      const base64 = await readNativeFileAsBase64(optimizedUri);
      
      checkBase64Size(base64);
      console.log('[ImageBase64] Native conversion successful, size:', Math.ceil((base64.length * 3) / 4 / 1024), 'KB');
      
      return base64;
    }
  } catch (error) {
    console.error('[ImageBase64] Error converting image to base64:', error);
    throw error;
  }
};

/**
 * Convert multiple image URLs to base64 in parallel
 * 
 * @param imageUrls - Array of image URLs to convert
 * @param optimize - Whether to optimize/compress images (default: true)
 * @returns Map of original URLs to base64 strings
 */
export const imageUrlsToBase64 = async (
  imageUrls: string[],
  optimize: boolean = true
): Promise<Map<string, string>> => {
  const result = new Map<string, string>();
  
  const validUrls = imageUrls.filter(url => url && url.startsWith('http'));
  console.log(`[ImageBase64] Converting ${validUrls.length} images to base64...`);
  
  // Process in batches to avoid overwhelming the system
  const BATCH_SIZE = 5;
  for (let i = 0; i < validUrls.length; i += BATCH_SIZE) {
    const batch = validUrls.slice(i, i + BATCH_SIZE);
    console.log(`[ImageBase64] Processing batch ${Math.floor(i / BATCH_SIZE) + 1}...`);
    
    const batchResults = await Promise.allSettled(
      batch.map(url => imageUrlToBase64(url, optimize))
    );
    
    batchResults.forEach((batchResult, index) => {
      const url = batch[index];
      if (batchResult.status === 'fulfilled') {
        result.set(url, batchResult.value);
      } else {
        console.error(`[ImageBase64] Failed to convert ${url}:`, batchResult.reason);
        // Store empty string for failed conversions
        result.set(url, '');
      }
    });
  }
  
  console.log(`[ImageBase64] Completed converting ${result.size} images`);
  return result;
};

/**
 * Convert base64 string back to data URL for display
 * 
 * @param base64 - Base64 string (without prefix)
 * @param mimeType - MIME type of the image (default: 'image/jpeg')
 * @returns Data URL suitable for Image component source
 */
export const base64ToDataUrl = (
  base64: string,
  mimeType: string = 'image/jpeg'
): string => {
  if (!base64 || base64.startsWith('data:')) {
    return base64;
  }
  return `data:${mimeType};base64,${base64}`;
};

/**
 * Estimate base64 string size in KB
 */
export const estimateBase64SizeKB = (base64: string): number => {
  return Math.ceil((base64.length * 3) / 4 / 1024);
};

/**
 * Clear image cache (native only)
 */
export const clearImageCache = async (): Promise<void> => {
  if (Platform.OS === 'web') {
    console.log('[ImageBase64] Web platform, no cache to clear');
    return;
  }

  if (!FileSystem) {
    console.warn('[ImageBase64] FileSystem not available');
    return;
  }

  try {
    const cacheDir = FileSystem.documentDirectory + 'image_cache/';
    const dirInfo = await FileSystem.getInfoAsync(cacheDir);
    
    if (dirInfo.exists) {
      await FileSystem.deleteAsync(cacheDir, { idempotent: true });
      console.log('[ImageBase64] Image cache cleared');
    }
  } catch (error) {
    console.error('[ImageBase64] Error clearing cache:', error);
  }
};

export default {
  imageUrlToBase64,
  imageUrlsToBase64,
  base64ToDataUrl,
  estimateBase64SizeKB,
  clearImageCache,
  IMAGE_CONFIG,
};
