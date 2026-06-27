// Image Cache Utility for Offline Support
// Downloads and caches images locally for offline access
// Web-compatible: skips file system operations on web

import { Platform } from 'react-native';

// Use legacy expo-file-system API for better Expo Go compatibility
let FileSystem: any = null;
let Crypto: any = null;

if (Platform.OS !== 'web') {
  try {
    // Import legacy API for Expo Go compatibility
    FileSystem = require('expo-file-system/legacy');
    Crypto = require('expo-crypto');
  } catch (e) {
    // console.warn('[ImageCache] expo modules not available:', e);
  }
}

const IMAGE_CACHE_DIR = Platform.OS !== 'web'
  ? `${FileSystem.documentDirectory}image_cache/`
  : '';

/**
 * Generate a unique filename from URL
 */
export const getImageCacheFileName = async (url: string): Promise<string> => {
  if (Platform.OS === 'web') {
    // On web, just use URL hash
    return `cache_${Math.abs(hashCode(url))}.jpg`;
  }
  const hash = await Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256,
    url
  );
  return `${hash}.jpg`;
};

/**
 * Simple hash function for web
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
 * Get the local cache path for an image URL
 */
export const getImageCachePath = async (url: string): Promise<string> => {
  if (Platform.OS === 'web') {
    // On web, return original URL (no caching)
    return url;
  }
  const fileName = await getImageCacheFileName(url);
  return `${IMAGE_CACHE_DIR}${fileName}`;
};

/**
 * Ensure cache directory exists
 */
export const ensureCacheDir = async (): Promise<void> => {
  if (Platform.OS === 'web') {
    // No-op on web
    return;
  }
  try {
    const dirInfo = await FileSystem.getInfoAsync(IMAGE_CACHE_DIR);
    if (!dirInfo.exists) {
      await FileSystem.makeDirectoryAsync(IMAGE_CACHE_DIR, { intermediates: true });
    }
  } catch (error) {
    // console.error('[ImageCache] Error creating cache directory:', error);
  }
};

/**
 * Download and cache an image from URL
 * Returns the local file URI on native, original URL on web
 */
export const cacheImage = async (url: string): Promise<string | null> => {
  if (!url || url.startsWith('data:') || url.startsWith('blob:')) {
    return url;
  }

  // On web, just return the original URL (browser handles caching)
  if (Platform.OS === 'web') {
    return url;
  }

  try {
    await ensureCacheDir();

    const cachePath = await getImageCachePath(url);
    const cacheInfo = await FileSystem.getInfoAsync(cachePath);

    // Return cached image if it exists
    if (cacheInfo.exists) {
      return cachePath;
    }

    // Download and cache the image
    const downloadResult = await FileSystem.downloadAsync(url, cachePath);

    if (downloadResult.status === 200) {
      return cachePath;
    }

    return url; // Return original URL if download fails
  } catch (error) {
    // console.error('[ImageCache] Error caching image:', error);
    return url; // Return original URL on error
  }
};

/**
 * Cache multiple images in parallel
 */
export const cacheImages = async (urls: string[]): Promise<Map<string, string>> => {
  const cacheMap = new Map<string, string>();

  // On web, just map URLs to themselves
  if (Platform.OS === 'web') {
    urls.forEach(url => cacheMap.set(url, url));
    return cacheMap;
  }

  await Promise.all(
    urls.map(async (url) => {
      const cachedPath = await cacheImage(url);
      if (cachedPath) {
        cacheMap.set(url, cachedPath);
      }
    })
  );

  return cacheMap;
};

/**
 * Get cached image path or original URL
 */
export const getCachedImagePath = async (url: string): Promise<string> => {
  if (!url || url.startsWith('data:') || url.startsWith('blob:')) {
    return url;
  }

  // On web, return original URL
  if (Platform.OS === 'web') {
    return url;
  }

  try {
    const cachePath = await getImageCachePath(url);
    const cacheInfo = await FileSystem.getInfoAsync(cachePath);

    if (cacheInfo.exists) {
      return cachePath;
    }

    return url;
  } catch (error) {
    // console.error('[ImageCache] Error getting cached image:', error);
    return url;
  }
};

/**
 * Clear all cached images
 */
export const clearImageCache = async (): Promise<void> => {
  if (Platform.OS === 'web') {
    // No-op on web
    return;
  }
  try {
    const dirInfo = await FileSystem.getInfoAsync(IMAGE_CACHE_DIR);
    if (dirInfo.exists) {
      await FileSystem.deleteAsync(IMAGE_CACHE_DIR, { idempotent: true });
    }
    // console.log('[ImageCache] Cache cleared successfully');
  } catch (error) {
    // console.error('[ImageCache] Error clearing cache:', error);
  }
};

/**
 * Get cache size in bytes
 */
export const getCacheSize = async (): Promise<number> => {
  if (Platform.OS === 'web') {
    return 0;
  }
  try {
    const dirInfo = await FileSystem.getInfoAsync(IMAGE_CACHE_DIR);
    if (!dirInfo.exists) {
      return 0;
    }

    const files = await FileSystem.readDirectoryAsync(IMAGE_CACHE_DIR);
    let totalSize = 0;

    for (const file of files) {
      const fileInfo = await FileSystem.getInfoAsync(`${IMAGE_CACHE_DIR}${file}`);
      if (fileInfo.exists && fileInfo.size) {
        totalSize += fileInfo.size;
      }
    }

    return totalSize;
  } catch (error) {
    // console.error('[ImageCache] Error getting cache size:', error);
    return 0;
  }
};

/**
 * Format bytes to human readable string
 */
export const formatBytes = (bytes: number): string => {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
};
