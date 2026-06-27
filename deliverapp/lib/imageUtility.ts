import * as ImageManipulator from 'expo-image-manipulator';

// Conditional import for expo-file-system
let FileSystem: any = null;
try {
  FileSystem = require('expo-file-system');
} catch (error) {
  console.warn('expo-file-system not available, using fallback');
}

// Fallback base64 decoding if not available
const decodeBase64 = (base64: string): ArrayBuffer => {
  const binaryString = atob(base64);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes.buffer;
};

/**
 * Compresses images to be as small as possible (~30-50KB)
 * without inflating already small files.
 */
export const getOptimizedImage = async (uri: string) => {
  try {
    if (!FileSystem) {
      throw new Error('expo-file-system is not available');
    }

    // 1. Get initial file info
    const fileInfo = await FileSystem.getInfoAsync(uri);

    if (!fileInfo.exists) {
      throw new Error("File does not exist at the provided URI");
    }

    const originalSizeKB = fileInfo.size / 1024;

    // 2. SAFETY CHECK: If image is already under 60KB, don't touch it.
    // This prevents the "63 bytes becoming 5000 bytes" issue.
    if (originalSizeKB < 60) {
      const base64 = await FileSystem.readAsStringAsync(uri, { encoding: 'base64' });
      return {
        data: decodeBase64(base64),
        size: originalSizeKB.toFixed(2) + ' KB'
      };
    }

    // 3. AGGRESSIVE COMPRESSION
    // We resize to a max width of 800px (standard for mobile apps)
    // and drop quality to 0.5 (50%).

    const result = await ImageManipulator.manipulateAsync(
      uri,
      [{ resize: { width: 800 } }],
      {
        compress: 0.5,
        format: ImageManipulator.SaveFormat.JPEG
      }
    );

    // 4. Verify new size
    const newFileInfo = await FileSystem.getInfoAsync(result.uri);
    const newSizeKB = newFileInfo.exists ? (newFileInfo.size / 1024) : 0;


    // 5. Convert to ArrayBuffer for Supabase
    const base64 = await FileSystem.readAsStringAsync(result.uri, { encoding: 'base64' });
    return {
      data: decodeBase64(base64),
      size: newSizeKB.toFixed(2) + ' KB'
    };

  } catch (error) {
    console.error("[SmartCompress] Error:", error);
    throw error;
  }
};
