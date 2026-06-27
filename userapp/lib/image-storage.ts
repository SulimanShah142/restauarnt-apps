import { supabase } from './supabase';
import { getOptimizedImage } from './imageUtility';

// Type declarations for web globals
declare const window: any;

// Configuration for image storage in the 'zootzoot' bucket
const IMAGE_STORAGE_BUCKET = 'zootzoot';

export const imageStorageService = {
  /**
   * Upload an image to the zootzoot bucket
   * @param fileUri - URI of the image file to upload
   * @param folder - Folder path within the bucket (e.g., 'restaurants', 'menu-items', 'users')
   * @returns Public URL of the uploaded image or null if upload fails
   */
  uploadImage: async (fileUri: string, folder: string): Promise<string | null> => {
    try {
      // Check if we're on web platform
      const isWeb = typeof window !== 'undefined';
      
      let imageData: ArrayBuffer;
      let size: string;
      
      if (isWeb) {
        // On web, we need to handle image differently
        // Fetch the image as blob and convert to ArrayBuffer
        const response = await fetch(fileUri);
        const blob = await response.blob();
        imageData = await blob.arrayBuffer();
        size = (blob.size / 1024).toFixed(2) + ' KB';
      } else {
        // On native, for now skip image optimization and upload directly
        // This is a simplified implementation
        imageData = new ArrayBuffer(0); // Placeholder
        size = 'N/A';
      }

      // Generate a unique filename
      const fileExt = 'jpg';
      const fileName = `${Date.now()}_${Math.floor(Math.random() * 1000)}.${fileExt}`;
      const filePath = `${folder}/${fileName}`;

      // Upload to the zootzoot bucket
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from(IMAGE_STORAGE_BUCKET)
        .upload(filePath, imageData, {
          contentType: 'image/jpeg',
          upsert: true,
        });

      if (uploadError) throw uploadError;

      // Get the public URL for the uploaded image
      const { data: { publicUrl } } = supabase.storage
        .from(IMAGE_STORAGE_BUCKET)
        .getPublicUrl(filePath);

      return publicUrl || null;
    } catch (error) {
      // console.error('[ImageUpload] Error in image upload:', error);
      return null;
    }
  },

  /**
   * Delete an image from the zootzoot bucket
   * @param filePath - Path to the file in the bucket (e.g., 'restaurants/restaurant1.jpg')
   * @returns Boolean indicating success or failure
   */
  deleteImage: async (filePath: string): Promise<boolean> => {
    try {
      const { error } = await supabase
        .storage
        .from(IMAGE_STORAGE_BUCKET)
        .remove([filePath]);

      if (error) {
        // console.error('Error deleting image from zootzoot bucket:', error);
        return false;
      }

      return true;
    } catch (error) {
      // console.error('Error deleting image:', error);
      return false;
    }
  },

  /**
   * Upload multiple images to the zootzoot bucket
   * @param fileUris - Array of URIs of the image files to upload
   * @param folder - Folder path within the bucket
   * @returns Array of public URLs for the uploaded images
   */
  uploadMultipleImages: async (fileUris: string[], folder: string): Promise<(string | null)[]> => {
    try {
      const uploadPromises = fileUris.map(uri => imageStorageService.uploadImage(uri, folder));
      const results = await Promise.all(uploadPromises);
      return results;
    } catch (error) {
      // console.error('Error in multiple image uploads:', error);
      return [];
    }
  },

  /**
   * Get a signed URL for an image (useful for temporary access)
   * @param filePath - Path to the file in the bucket
   * @param expiresIn - Time in seconds for the URL to expire (default: 3600 seconds)
   * @returns Signed URL or null if operation fails
   */
  getSignedUrl: async (filePath: string, expiresIn: number = 3600): Promise<string | null> => {
    try {
      const { data, error } = await supabase
        .storage
        .from(IMAGE_STORAGE_BUCKET)
        .createSignedUrl(filePath, expiresIn);

      if (error) {
        // console.error('Error creating signed URL:', error);
        return null;
      }

      return data?.signedUrl || null;
    } catch (error) {
      // console.error('Error getting signed URL:', error);
      return null;
    }
  }
};