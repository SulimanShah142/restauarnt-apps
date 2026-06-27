import * as ImageManipulator from 'expo-image-manipulator';

/**
 * Compress an image by resizing and reducing quality
 * @param {string} uri - The URI of the image to compress
 * @param {number} maxWidth - Maximum width for the resized image (default: 800)
 * @param {number} quality - JPEG quality (0-1, default: 0.7)
 * @returns {Promise<Object>} Object containing the compressed blob, URI, and size
 */
export const compressImage = async (
  uri, 
  maxWidth = 800, 
  quality = 0.7
) => {
  try {
    // Resize and compress the image
    const result = await ImageManipulator.manipulateAsync(
      uri,
      [{ resize: { width: maxWidth } }], // Resize width to maxWidth (keeps aspect ratio)
      { 
        compress: quality, 
        format: ImageManipulator.SaveFormat.JPEG // Use JPEG for consistent compression
      }
    );

    // Convert URI to Blob (essential for Supabase Web/Mobile)
    const response = await fetch(result.uri);
    const blob = await response.blob();

    return {
      blob,
      uri: result.uri,
      size: blob.size // Log this to see the savings!
    };
  } catch (error) {
    console.error("Compression failed:", error);
    // If compression fails, return the original image as fallback
    const response = await fetch(uri);
    const blob = await response.blob();
    
    return {
      blob,
      uri,
      size: blob.size
    };
  }
};

/**
 * Create a thumbnail from an image
 * @param {string} uri - The URI of the image to create a thumbnail from
 * @param {number} maxWidth - Maximum width for the thumbnail (default: 200)
 * @param {number} quality - JPEG quality (0-1, default: 0.6)
 * @returns {Promise<Object>} Object containing the compressed thumbnail blob, URI, and size
 */
export const createThumbnail = async (
  uri, 
  maxWidth = 200, 
  quality = 0.6
) => {
  try {
    // Resize and compress the image to thumbnail size
    const result = await ImageManipulator.manipulateAsync(
      uri,
      [{ resize: { width: maxWidth } }],
      { 
        compress: quality, 
        format: ImageManipulator.SaveFormat.JPEG
      }
    );

    // Convert URI to Blob
    const response = await fetch(result.uri);
    const blob = await response.blob();

    return {
      blob,
      uri: result.uri,
      size: blob.size
    };
  } catch (error) {
    console.error("Thumbnail creation failed:", error);
    // If thumbnail creation fails, return the original image as fallback
    const response = await fetch(uri);
    const blob = await response.blob();
    
    return {
      blob,
      uri,
      size: blob.size
    };
  }
};

/**
 * Compress an image and create a thumbnail simultaneously
 * @param {string} uri - The URI of the image to compress
 * @returns {Promise<Object>} Object containing both the compressed image and thumbnail
 */
export const compressImageWithThumbnail = async (uri) => {
  try {
    // First, create the thumbnail
    const thumbnailResult = await createThumbnail(uri);
    
    // Then, create the full-size compressed image
    const fullSizeResult = await compressImage(uri);
    
    return {
      fullSize: fullSizeResult,
      thumbnail: thumbnailResult
    };
  } catch (error) {
    console.error("Error in compressImageWithThumbnail:", error);
    // Fallback to original image if anything goes wrong
    const response = await fetch(uri);
    const blob = await response.blob();
    
    return {
      fullSize: {
        blob,
        uri,
        size: blob.size
      },
      thumbnail: {
        blob,
        uri,
        size: blob.size
      }
    };
  }
};