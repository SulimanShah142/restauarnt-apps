import { supabase } from './supabase';
import { compressImage } from './image-utils';

/**
 * Uploads an image file to Supabase Storage
 * @param {any} file - The image file to upload (with uri property)
 * @param {string} bucketName - The storage bucket name
 * @param {boolean} compress - Whether to compress the image before upload (default: true)
 * @returns {Promise<string>} - The public URL of the uploaded image
 */
async function uploadImage(file: any, bucketName: string = 'zootzoot', compress: boolean = true): Promise<string> {
  // If compress is true, we'll compress the image first
  let fileToUpload = file;
  
  if (compress && file.uri) {
    // Compress the image before uploading
    const compressedResult = await compressImage(file.uri);
    if (!compressedResult) {
      throw new Error('Image compression failed');
    }
    
    // Create a new file object with the compressed blob
    fileToUpload = {
      uri: compressedResult.uri,
      type: 'image/jpeg',
      name: file.name || `compressed_image_${Date.now()}.jpg`
    };
  }

  // Validate file type
  const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
  if (fileToUpload.type && !allowedTypes.some(type => fileToUpload.type.includes(type))) {
    throw new Error('Invalid file type. Only JPEG, PNG, GIF, and WebP images are allowed.');
  }

  // Validate file size (e.g., max 5MB)
  // Note: We can't validate the size of the blob directly, so we skip this validation for compressed images
  if (!compress) {
    const maxSize = 5 * 1024 * 1024; // 5MB in bytes
    if (fileToUpload.size && fileToUpload.size > maxSize) {
      throw new Error('File size exceeds 5MB limit.');
    }
  }

  // Generate a unique filename with timestamp and random string
  const fileExtension = fileToUpload.name ? fileToUpload.name.split('.').pop().toLowerCase() : 'jpg';
  const fileName = `images/${Date.now()}_${Math.random().toString(36).substring(2, 15)}.${fileExtension}`;

  // Upload the file to Supabase Storage
  const { data, error } = await supabase
    .storage
    .from(bucketName)
    .upload(fileName, fileToUpload, {
      cacheControl: '3600',
      upsert: false
    });

  if (error) {
    console.error('Error uploading image:', error);
    throw error;
  }

  // Get and return the public URL
  const { data: { publicUrl } } = supabase
    .storage
    .from(bucketName)
    .getPublicUrl(fileName);

  return publicUrl;
}

/**
 * Deletes an image from Supabase Storage
 * @param {string} imageUrl - The public URL of the image to delete
 * @param {string} bucketName - The storage bucket name
 */
async function deleteImage(imageUrl: string, bucketName: string = 'zootzoot'): Promise<void> {
  try {
    // Extract filename from URL
    const fileName = imageUrl.split('/').pop();

    if (!fileName) {
      throw new Error('Could not extract filename from URL');
    }

    const { error } = await supabase
      .storage
      .from(bucketName)
      .remove([fileName]);

    if (error) {
      console.error('Error deleting image:', error);
      throw error;
    }
  } catch (err) {
    console.error('Error in deleteImage:', err);
    throw err;
  }
}

/**
 * Updates a record with an image URL
 * @param {string} tableName - The database table name
 * @param {string|number} recordId - The ID of the record to update
 * @param {string} imageUrl - The URL of the uploaded image
 * @param {string} column - The column name for the image URL (default: 'image_url')
 */
async function updateRecordWithImage(tableName: string, recordId: string | number, imageUrl: string, column: string = 'image_url'): Promise<void> {
  const { error } = await supabase
    .from(tableName)
    .update({ [column]: imageUrl })
    .eq('id', recordId);

  if (error) {
    console.error(`Error updating ${tableName} record with image URL:`, error);
    throw error;
  }
}

/**
 * Uploads an image and updates the corresponding record in one function
 * @param {any} file - The image file to upload (with uri property)
 * @param {string} tableName - The database table name
 * @param {string|number} recordId - The ID of the record to update
 * @param {string} bucketName - The storage bucket name
 * @param {string} column - The column name for the image URL (default: 'image_url')
 * @param {boolean} compress - Whether to compress the image before upload (default: true)
 * @returns {Promise<string>} - The public URL of the uploaded image
 */
async function uploadImageAndUpdateRecord(
  file: any, 
  tableName: string, 
  recordId: string | number, 
  bucketName: string = 'zootzoot', 
  column: string = 'image_url',
  compress: boolean = true
): Promise<string> {
  try {
    // Upload the image
    const imageUrl = await uploadImage(file, bucketName, compress);

    // Update the record with the image URL
    await updateRecordWithImage(tableName, recordId, imageUrl, column);

    return imageUrl;
  } catch (error) {
    console.error('Error in uploadImageAndUpdateRecord:', error);
    throw error;
  }
}

export {
  uploadImage,
  deleteImage,
  updateRecordWithImage,
  uploadImageAndUpdateRecord
};
