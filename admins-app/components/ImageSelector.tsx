import React, { useState } from 'react';
import { View, Text, TouchableOpacity, Image, StyleSheet, Alert, Linking } from 'react-native';
import * as ImagePicker from 'expo-image-picker';

interface ImageSelectorProps {
  onImageSelect: (uri: string) => void;
  currentImage?: string | null;
  label?: string;
  size?: 'normal' | 'small';
  showLandscapeWarning?: boolean;
  showPortraitWarning?: boolean;
  aspectRatio?: [number, number]; // [width, height] - default [16, 9] landscape
}

const ImageSelector: React.FC<ImageSelectorProps> = ({
  onImageSelect,
  currentImage,
  label = "Select Image",
  size = 'normal',
  showLandscapeWarning = false,
  showPortraitWarning = false,
  aspectRatio = [16, 9] // Default to landscape
}) => {
  const [selectedImage, setSelectedImage] = useState<string | null>(currentImage || null);

  // Determine image dimensions based on size prop
  const imageSize = size === 'small' ? 100 : 150;

  const pickImage = async () => {
    // Request permission to access media library
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();

    if (status !== 'granted') {
      Alert.alert('Sorry, we need camera roll permissions to make this work!');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: aspectRatio,
      quality: 0.8,
    });

    if (!result.canceled && result.assets && result.assets[0]) {
      const uri = result.assets[0].uri;
      const width = result.assets[0].width || 0;
      const height = result.assets[0].height || 0;

      // Warn if image orientation doesn't match expected
      if (showPortraitWarning && width > height) {
        Alert.alert(
          'Landscape Image Detected',
          'We recommend using a portrait (vertical) image for better display. Landscape images may be cropped or not display optimally. Would you like to choose a different image?',
          [
            { text: 'Use Anyway', style: 'cancel', onPress: () => { setSelectedImage(uri); onImageSelect(uri); } },
            { text: 'Choose Again', onPress: pickImage }
          ]
        );
      } else if (showLandscapeWarning && height > width) {
        Alert.alert(
          'Portrait Image Detected',
          'We recommend using a landscape (horizontal) image for better display. Portrait images may be cropped or not display optimally. Would you like to choose a different image?',
          [
            { text: 'Use Anyway', style: 'cancel', onPress: () => { setSelectedImage(uri); onImageSelect(uri); } },
            { text: 'Choose Again', onPress: pickImage }
          ]
        );
      } else {
        setSelectedImage(uri);
        onImageSelect(uri);
      }
    }
  };

  const takePhoto = async () => {
    try {
      // First check if camera is available
      const cameraAvailable = await ImagePicker.getCameraPermissionsAsync();

      if (!cameraAvailable || !cameraAvailable.granted) {
        // Request camera permission with proper rationale
        const { status, canAskAgain } = await ImagePicker.requestCameraPermissionsAsync();

        if (status !== 'granted') {
          if (!canAskAgain) {
            // Permission permanently denied, show alert to go to settings
            Alert.alert(
              'Camera Permission Required',
              'Camera permission has been permanently denied. Please go to app settings to enable camera access.',
              [
                { text: 'Cancel', style: 'cancel' },
                { text: 'Open Settings', onPress: () => Linking.openSettings() }
              ]
            );
          } else {
            Alert.alert(
              'Camera Permission Required',
              'Sorry, we need camera permission to take photos. Please allow camera access.'
            );
          }
          return;
        }
      }

      // Launch camera
      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: aspectRatio,
        quality: 0.8,
        cameraType: ImagePicker.CameraType.back, // Use back camera by default
      });

      if (!result.canceled && result.assets && result.assets[0]) {
        const uri = result.assets[0].uri;
        const width = result.assets[0].width || 0;
        const height = result.assets[0].height || 0;

        // Warn if image orientation doesn't match expected
        if (showPortraitWarning && width > height) {
          Alert.alert(
            'Landscape Image Detected',
            'We recommend using a portrait (vertical) image for better display. Landscape images may be cropped or not display optimally. Would you like to take a new photo?',
            [
              { text: 'Use Anyway', style: 'cancel', onPress: () => { setSelectedImage(uri); onImageSelect(uri); } },
              { text: 'Retake', onPress: takePhoto }
            ]
          );
        } else if (showLandscapeWarning && height > width) {
          Alert.alert(
            'Portrait Image Detected',
            'We recommend using a landscape (horizontal) image for better display. Portrait images may be cropped or not display optimally. Would you like to take a new photo?',
            [
              { text: 'Use Anyway', style: 'cancel', onPress: () => { setSelectedImage(uri); onImageSelect(uri); } },
              { text: 'Retake', onPress: takePhoto }
            ]
          );
        } else {
          setSelectedImage(uri);
          onImageSelect(uri);
        }
      }
    } catch (error: any) {
      console.error('[ImageSelector] Camera error:', error);
      Alert.alert(
        'Camera Error',
        'Failed to open camera. Please make sure your device has a camera and try again.'
      );
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.label}>{label}</Text>

      {selectedImage ? (
        <View style={styles.imagePreviewContainer}>
          <Image source={{ uri: selectedImage }} style={dynamicStyles(imageSize, aspectRatio).imagePreview} resizeMode="cover" />
          <TouchableOpacity style={styles.changeImageButton} onPress={pickImage}>
            <Text style={styles.changeImageText}>Change Image</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <View style={styles.noImageContainer}>
          <Text style={styles.noImageText}>No image selected</Text>
          {showLandscapeWarning && (
            <Text style={styles.landscapeHintText}>💡 Tip: Use a landscape (horizontal) image for best results</Text>
          )}
        </View>
      )}

      <View style={styles.buttonContainer}>
        <TouchableOpacity style={styles.button} onPress={pickImage}>
          <Text style={styles.buttonText}>Choose from Library</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.button} onPress={takePhoto}>
          <Text style={styles.buttonText}>Take Photo</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginBottom: 15,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    marginVertical: 5,
  },
  imagePreviewContainer: {
    alignItems: 'center',
    marginBottom: 10,
  },
  changeImageButton: {
    backgroundColor: '#C41E26',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 4,
  },
  changeImageText: {
    color: '#fff',
    fontWeight: '600',
  },
  noImageContainer: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderStyle: 'dashed',
    borderRadius: 8,
    padding: 20,
    alignItems: 'center',
    marginBottom: 10,
  },
  noImageText: {
    color: '#999',
    fontSize: 14,
  },
  landscapeHintText: {
    color: '#666',
    fontSize: 12,
    marginTop: 8,
    fontStyle: 'italic',
    textAlign: 'center',
  },
  buttonContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  button: {
    flex: 1,
    backgroundColor: '#f0f0f0',
    padding: 10,
    borderRadius: 4,
    alignItems: 'center',
    marginHorizontal: 5,
  },
  buttonText: {
    color: '#333',
    fontWeight: '600',
  },
});

// Dynamic styles based on props
const dynamicStyles = (imageSize: number, ratio: [number, number] = [16, 9]) => StyleSheet.create({
  imagePreview: {
    width: '100%',
    maxWidth: imageSize * (ratio[0] / ratio[1]), // Calculate width based on aspect ratio
    height: imageSize,
    borderRadius: 8,
    marginBottom: 10,
  },
});

export default ImageSelector;