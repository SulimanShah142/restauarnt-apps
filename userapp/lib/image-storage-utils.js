// image-storage-utils.js
import { supabase } from './supabase';

/**
 * Uploads an image file to Supabase Storage
 * @param {File} file - The image file to upload
 * @param {string} bucketName - The storage bucket name
 * @returns {Promise<string>} - The public URL of the uploaded image
 */
async function uploadImage(file, bucketName = 'zootzoot') {
  // Validate file type
  const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
  if (!allowedTypes.includes(file.type)) {
    throw new Error('Invalid file type. Only JPEG, PNG, GIF, and WebP images are allowed.');
  }

  // Validate file size (e.g., max 5MB)
  const maxSize = 5 * 1024 * 1024; // 5MB in bytes
  if (file.size > maxSize) {
    throw new Error('File size exceeds 5MB limit.');
  }

  // Generate a unique filename with timestamp and random string
  const fileExtension = file.name.split('.').pop().toLowerCase();
  const fileName = `images/${Date.now()}_${Math.random().toString(36).substring(2, 15)}.${fileExtension}`;

  // Upload the file to Supabase Storage
  const { data, error } = await supabase
    .storage
    .from(bucketName)
    .upload(fileName, file, {
      cacheControl: '3600',
      upsert: false
    });

  if (error) {
    // console.error('Error uploading image:', error);
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
async function deleteImage(imageUrl, bucketName = 'zootzoot') {
  try {
    // Extract filename from URL
    const fileName = imageUrl.split('/').pop();

    const { error } = await supabase
      .storage
      .from(bucketName)
      .remove([fileName]);

    if (error) {
      // console.error('Error deleting image:', error);
      throw error;
    }
  } catch (err) {
    // console.error('Error in deleteImage:', err);
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
async function updateRecordWithImage(tableName, recordId, imageUrl, column = 'image_url') {
  const { error } = await supabase
    .from(tableName)
    .update({ [column]: imageUrl })
    .eq('id', recordId);

  if (error) {
    // console.error(`Error updating ${tableName} record with image URL:`, error);
    throw error;
  }
}

/**
 * Uploads an image and updates the corresponding record in one function
 * @param {File} file - The image file to upload
 * @param {string} tableName - The database table name
 * @param {string|number} recordId - The ID of the record to update
 * @param {string} bucketName - The storage bucket name
 * @param {string} column - The column name for the image URL (default: 'image_url')
 * @returns {Promise<string>} - The public URL of the uploaded image
 */
async function uploadImageAndUpdateRecord(file, tableName, recordId, bucketName = 'zootzoot', column = 'image_url') {
  try {
    // Upload the image
    const imageUrl = await uploadImage(file, bucketName);

    // Update the record with the image URL
    await updateRecordWithImage(tableName, recordId, imageUrl, column);

    return imageUrl;
  } catch (error) {
    // console.error('Error in uploadImageAndUpdateRecord:', error);
    throw error;
  }
}

export {
  uploadImage,
  deleteImage,
  updateRecordWithImage,
  uploadImageAndUpdateRecord
};