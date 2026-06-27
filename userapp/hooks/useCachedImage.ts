// React Hook for Cached Images
// Automatically caches images and returns local path for offline access

import { useState, useEffect } from 'react';
import { cacheImage, getCachedImagePath } from '../utils/image-cache';

/**
 * Hook to get cached image URI
 * Returns the local cached path if available, otherwise the original URL
 */
export const useCachedImage = (url: string | null | undefined, preload: boolean = false) => {
  const [cachedUri, setCachedUri] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!url) {
      setCachedUri(null);
      return;
    }

    let mounted = true;

    const loadCachedImage = async () => {
      setLoading(true);
      try {
        const cachedPath = preload 
          ? await cacheImage(url) 
          : await getCachedImagePath(url);
        
        if (mounted) {
          setCachedUri(cachedPath);
        }
      } catch (error) {
        // console.error('[useCachedImage] Error loading cached image:', error);
        if (mounted) {
          setCachedUri(url);
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    };

    loadCachedImage();

    return () => {
      mounted = false;
    };
  }, [url, preload]);

  return { cachedUri, loading };
};

/**
 * Hook to preload and cache multiple images
 */
export const useCachedImages = (urls: string[], preload: boolean = true) => {
  const [cachedMap, setCachedMap] = useState<Map<string, string>>(new Map());
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!urls.length || !preload) {
      return;
    }

    let mounted = true;

    const loadCachedImages = async () => {
      setLoading(true);
      try {
        const { cacheImages } = await import('../utils/image-cache');
        const cacheMap = await cacheImages(urls);
        
        if (mounted) {
          setCachedMap(cacheMap);
        }
      } catch (error) {
        // console.error('[useCachedImages] Error loading cached images:', error);
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    };

    loadCachedImages();

    return () => {
      mounted = false;
    };
  }, [urls.join(','), preload]);

  const getCached = (url: string): string => {
    return cachedMap.get(url) || url;
  };

  return { getCached, cachedMap, loading };
};
