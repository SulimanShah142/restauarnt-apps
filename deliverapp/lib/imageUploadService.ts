import { supabase } from './supabase'; // Your supabase client
import { getOptimizedImage } from './imageUtility';

export const uploadToZootZoot = async (uri: string, folder: 'restaurants' | 'menu' | 'avatars' | 'delivery' | 'profiles') => {
  try {
    // 1. Get the smallest version of the image
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