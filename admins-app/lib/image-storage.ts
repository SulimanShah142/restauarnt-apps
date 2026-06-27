import { supabase } from './supabase';
import { getOptimizedImage } from './imageUtility';
import { checkNetworkStatus } from './network-utils';
import { Platform } from 'react-native';

// Configuration for image storage in the 'zootzoot' bucket
const IMAGE_STORAGE_BUCKET = 'zootzoot';

export const imageStorageService = {
  /**
   * Upload an image to the zootzoot bucket
   * @param fileUri - URI of the image file to upload
   * @param folder - Folder path within the bucket (e.g., 'restaurants', 'menu-items', 'users')
   * @param fileName - Optional custom filename (if not provided, generates one)
   * @returns Public URL of the uploaded image or null if upload fails
   */
  uploadImage: async (fileUri: string, folder: string, fileName?: string): Promise<string | null> => {
    try {
      // Step 1: Check network connectivity
      const isOnline = await checkNetworkStatus();
      if (!isOnline) {
        console.error('[ImageUpload] ❌ No network connection');
        throw new Error('No network connection. Please check your internet connection and try again.');
      }

      // Step 2: Verify Supabase client is configured
      if (!supabase) {
        console.error('[ImageUpload] ❌ Supabase client not initialized');
        throw new Error('Supabase client not initialized');
      }

      // Step 3: Check if bucket exists and is accessible
      const { data: bucketData, error: bucketError } = await supabase.storage
        .from(IMAGE_STORAGE_BUCKET)
        .list('', { limit: 1 });
      
      if (bucketError) {
        console.error('[ImageUpload] ⚠️ Bucket access error:', bucketError.message);
        // Continue anyway - might be permission issue but upload could still work
      }

      // Step 4: Prepare image data
      const isWeb = Platform.OS === 'web';
      let imageData: ArrayBuffer | Blob;
      let size: string;


      if (isWeb) {
        // On web, fetch the image as blob
        const response = await fetch(fileUri);
        if (!response.ok) {
          throw new Error(`Failed to fetch image: ${response.status} ${response.statusText}`);
        }
        const blob = await response.blob();
        
        // Use blob directly on web
        imageData = blob;
        size = (blob.size / 1024).toFixed(2) + ' KB';
      } else {
        // On native, use the optimized image function
        const result = await getOptimizedImage(fileUri);
        imageData = result.data;
        size = result.size;
      }

      // Step 5: Generate filename
      const fileExt = 'jpg';
      const finalFileName = fileName || `${Date.now()}_${Math.floor(Math.random() * 1000)}.${fileExt}`;
      const filePath = `${folder}/${finalFileName}`;

      // Step 6: Upload to Supabase storage
      
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from(IMAGE_STORAGE_BUCKET)
        .upload(filePath, imageData, {
          contentType: 'image/jpeg',
          upsert: false, // Don't overwrite existing files
          cacheControl: '3600',
        });

      if (uploadError) {
        console.error('[ImageUpload] ❌ Upload error:', uploadError);
        throw uploadError;
      }


      // Step 7: Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from(IMAGE_STORAGE_BUCKET)
        .getPublicUrl(filePath);

      if (!publicUrl) {
        throw new Error('Failed to get public URL for uploaded image');
      }

      return publicUrl;

    } catch (error: any) {
      console.error('[ImageUpload] ❌ Error uploading image:', error);
      console.error('[ImageUpload] Error details:', {
        message: error?.message,
        name: error?.name,
        stack: error?.stack,
      });
      
      // Provide more helpful error messages
      if (error?.message?.includes('Network request failed')) {
        throw new Error('Network error: Please check your internet connection and try again.');
      } else if (error?.message?.includes('bucket')) {
        throw new Error('Storage bucket error: The image storage bucket may not be configured properly.');
      } else if (error?.message?.includes('Unauthorized') || error?.message?.includes('JWT')) {
        throw new Error('Authentication error: Please log in again and try uploading.');
      } else {
        throw new Error(`Image upload failed: ${error?.message || 'Unknown error'}`);
      }
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
        console.error('Error deleting image from zootzoot bucket:', error);
        return false;
      }

      return true;
    } catch (error) {
      console.error('Error deleting image:', error);
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
      console.error('Error in multiple image uploads:', error);
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
        console.error('Error creating signed URL:', error);
        return null;
      }

      return data?.signedUrl || null;
    } catch (error) {
      console.error('Error getting signed URL:', error);
      return null;
    }
  }
};