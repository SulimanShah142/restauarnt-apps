import * as ImageManipulator from 'expo-image-manipulator';
import * as FileSystem from 'expo-file-system/legacy'; // Use legacy API to avoid deprecation warnings
import { decode } from 'base64-arraybuffer';

/**
 * Compresses images to be as small as possible (~30-50KB)
 * without inflating already small files.
 */
export const getOptimizedImage = async (uri: string) => {
  try {
    
    // 1. Get initial file info
    const fileInfo = await FileSystem.getInfoAsync(uri);

    if (!fileInfo.exists) {
      console.error('[ImageUtility] File does not exist:', uri);
      throw new Error("File does not exist at the provided URI");
    }

    const originalSizeKB = fileInfo.size / 1024;

    // 2. SAFETY CHECK: If image is already under 60KB, don't touch it.
    // This prevents the "63 bytes becoming 5000 bytes" issue.
    if (originalSizeKB < 60) {
      const base64 = await FileSystem.readAsStringAsync(uri, { encoding: 'base64' });
      return {
        data: decode(base64),
        size: originalSizeKB.toFixed(2) + ' KB'
      };
    }

    // 3. AGGRESSIVE COMPRESSION
    // We resize to a max width of 800px (standard for mobile apps)
    // and drop quality to 0.5 (50%).

    const result = await ImageManipulator.manipulateAsync(
      uri,
      [
        { resize: { width: 800 } },
        { rotate: 0 } // Ensure no rotation issues
      ],
      {
        compress: 0.5,
        format: ImageManipulator.SaveFormat.JPEG,
      }
    );


    // 4. Verify new size
    const newFileInfo = await FileSystem.getInfoAsync(result.uri);
    const newSizeKB = newFileInfo.exists ? (newFileInfo.size / 1024) : 0;


    // 5. Convert to ArrayBuffer for Supabase
    const base64 = await FileSystem.readAsStringAsync(result.uri, { encoding: 'base64' });
    
    
    return {
      data: decode(base64),
      size: newSizeKB.toFixed(2) + ' KB'
    };

  } catch (error) {
    console.error("[ImageUtility] Error:", error);
    // Re-throw with more context
    throw new Error(`Image optimization failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
};