import { supabase } from './supabase'; // Your supabase client
import { getOptimizedImage } from './imageUtility';
import { Platform } from 'react-native';

export const uploadToZootZoot = async (uri: string, folder: 'restaurants' | 'menu-items' | 'avatars' | 'users' | 'delivery-persons') => {
  try {
    // On web, we can't use expo-file-system, so we'll upload directly without compression
    if (Platform.OS === 'web') {
      
      // For web, fetch the image as blob
      const response = await fetch(uri);
      const blob = await response.blob();
      
      // Generate a unique filename
      const fileExt = 'jpg';
      const fileName = `${Date.now()}_${Math.floor(Math.random() * 1000)}.${fileExt}`;
      const filePath = `${folder}/${fileName}`;

      // Upload to the "zootzoot" bucket
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('zootzoot')
        .upload(filePath, blob, {
          contentType: 'image/jpeg',
          upsert: true,
        });

      if (uploadError) throw uploadError;

      // Get the Public URL to save in your Database
      const { data: { publicUrl } } = supabase.storage
        .from('zootzoot')
        .getPublicUrl(filePath);

      return { publicUrl, size: 'N/A (web)' };
    }

    // For native platforms (iOS/Android), use the optimized image compression
    const { data, size } = await getOptimizedImage(uri);

    // 2. Generate a unique filename
    const fileExt = 'jpg';
    const fileName = `${Date.now()}_${Math.floor(Math.random() * 1000)}.${fileExt}`;
    const filePath = `${folder}/${fileName}`;

    // 3. Upload to the "zootzoot" bucket
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('zootzoot')
      .upload(filePath, data, {
        contentType: 'image/jpeg',
        upsert: true,
      });

    if (uploadError) throw uploadError;

    // 4. Get the Public URL to save in your Database
    const { data: { publicUrl } } = supabase.storage
      .from('zootzoot')
      .getPublicUrl(filePath);

    return { publicUrl, size };

  } catch (err: any) {
    console.error("Upload failed:", err.message);
    return { error: err.message };
  }
};