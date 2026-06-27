// components/AdvertisementModal.tsx
import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity, Image, ScrollView, Dimensions } from 'react-native';
import { advertisementService, Advertisement } from '../lib/advertisement-service';
import { router } from 'expo-router';

const { width, height } = Dimensions.get('window');

interface AdvertisementModalProps {
  visible: boolean;
  onClose: () => void;
  onContinue: () => void;
}

export default function AdvertisementModal({ visible, onClose, onContinue }: AdvertisementModalProps) {
  const [advertisements, setAdvertisements] = useState<Advertisement[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [imageError, setImageError] = useState(false);

  useEffect(() => {
    if (visible) {
      loadAdvertisements();
    }
  }, [visible]);

  // Reset image error when changing ads - MUST be before early returns
  useEffect(() => {
    setImageError(false);
  }, [currentIndex]);

  const loadAdvertisements = async () => {
    try {
      setLoading(true);
      setImageError(false);
      const ads = await advertisementService.getActiveAdvertisements();
      console.log('[AdvertisementModal] Loaded ads:', ads?.length || 0);
      if (ads && ads.length > 0) {
        console.log('[AdvertisementModal] First ad:', JSON.stringify(ads[0], null, 2));
      }
      setAdvertisements(ads);
      setCurrentIndex(0);
    } catch (error) {
      console.error('Error loading advertisements:', error);
      setAdvertisements([]);
    } finally {
      setLoading(false);
    }
  };

  const nextAd = () => {
    if (advertisements.length > 0) {
      setCurrentIndex((prevIndex) => (prevIndex + 1) % advertisements.length);
    }
  };

  const prevAd = () => {
    if (advertisements.length > 0) {
      setCurrentIndex((prevIndex) => 
        prevIndex === 0 ? advertisements.length - 1 : prevIndex - 1
      );
    }
  };

  const handleContinue = () => {
    onContinue();
    onClose();
  };

  if (loading) {
    return null;
  }

  if (advertisements.length === 0) {
    return null;
  }

  const currentAd = advertisements[currentIndex];

  // Helper to get proper image URL
  const getImageUrl = (url: string | undefined): string | null => {
    if (!url) return null;

    // If it's already a valid HTTP URL, return it
    if (url.startsWith('http://') || url.startsWith('https://')) {
      return url;
    }

    // If it's a Supabase storage URL path, construct full URL
    if (url.includes('/storage/v1/object/')) {
      const { supabaseUrl } = require('../lib/supabase-config');
      return `${supabaseUrl}${url}`;
    }

    // If it looks like a file path in storage, construct Supabase URL
    if (url.startsWith('advertisements/') || url.includes('advertisements')) {
      const { supabaseUrl } = require('../lib/supabase-config');
      return `${supabaseUrl}/storage/v1/object/public/zootzoot/${url}`;
    }

    // Unknown format, return as-is
    return url;
  };

  const imageUrl = getImageUrl(currentAd.image_url);

  return (
    <Modal
      animationType="slide"
      transparent={true}
      visible={visible}
      onRequestClose={onClose}
    >
      <View style={styles.centeredView}>
        <View style={styles.modalView}>
          <Text style={styles.title}>{currentAd.title}</Text>

          {imageUrl && !imageError ? (
            <Image
              source={{ uri: imageUrl }}
              style={styles.adImage}
              resizeMode="cover"
              onError={(e) => {
                console.log('[AdvertisementModal] Image load error:', JSON.stringify(e.nativeEvent));
                setImageError(true);
              }}
            />
          ) : (
            <View style={[styles.adImage, styles.imagePlaceholder]}>
              <Text style={styles.imagePlaceholderText}>
                {currentAd.restaurant_name || 'Restaurant'}
              </Text>
            </View>
          )}

          <Text style={styles.description}>{currentAd.description}</Text>

          <Text style={styles.restaurantName}>
            {currentAd.restaurant_name || (currentAd.restaurant_id ? `Restaurant ID: ${currentAd.restaurant_id.substring(0, 8)}` : 'Featured Restaurant')}
          </Text>
          
          <View style={styles.navigationContainer}>
            <TouchableOpacity style={styles.navButton} onPress={prevAd}>
              <Text style={styles.navButtonText}>‹ Prev</Text>
            </TouchableOpacity>
            
            <Text style={styles.pageIndicator}>
              {currentIndex + 1} of {advertisements.length}
            </Text>
            
            <TouchableOpacity style={styles.navButton} onPress={nextAd}>
              <Text style={styles.navButtonText}>Next ›</Text>
            </TouchableOpacity>
          </View>
          
          <View style={styles.buttonContainer}>
            <TouchableOpacity style={styles.closeButton} onPress={onClose}>
              <Text style={styles.closeButtonText}>Close</Text>
            </TouchableOpacity>
            
            <TouchableOpacity style={styles.continueButton} onPress={handleContinue}>
              <Text style={styles.continueButtonText}>Continue to Menu</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  centeredView: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  modalView: {
    width: width * 0.9,
    maxHeight: height * 0.8,
    backgroundColor: 'white',
    borderRadius: 20,
    padding: 20,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 15,
    textAlign: 'center',
  },
  adImage: {
    width: '100%',
    height: 200,
    borderRadius: 10,
    marginBottom: 15,
  },
  imagePlaceholder: {
    backgroundColor: '#f0f0f0',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#ddd',
  },
  imagePlaceholderText: {
    fontSize: 16,
    color: '#999',
    fontWeight: '600',
  },
  description: {
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 15,
    lineHeight: 22,
  },
  restaurantName: {
    fontSize: 18,
    fontWeight: '600',
    color: '#C41E26',
    marginBottom: 20,
    textAlign: 'center',
  },
  navigationContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    width: '100%',
    marginBottom: 20,
  },
  navButton: {
    backgroundColor: '#f0f0f0',
    paddingVertical: 8,
    paddingHorizontal: 15,
    borderRadius: 20,
  },
  navButtonText: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  pageIndicator: {
    fontSize: 16,
    fontWeight: '600',
  },
  buttonContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
  },
  closeButton: {
    backgroundColor: '#f0f0f0',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
    flex: 0.45,
    alignItems: 'center',
  },
  closeButtonText: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  continueButton: {
    backgroundColor: '#4CAF50',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
    flex: 0.45,
    alignItems: 'center',
  },
  continueButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
});