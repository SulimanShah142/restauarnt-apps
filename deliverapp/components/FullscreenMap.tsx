import React, { useState } from 'react';
import { View, StyleSheet, TouchableOpacity, Text, Modal } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import UnifiedMap from '@/components/UnifiedMap';

interface FullscreenMapProps {
  role: 'USER' | 'DELIVER' | 'ADMIN';
  orderId?: string;
  restaurantCoords?: [number, number];
  userCoords?: [number, number];
  destinationCoords?: [number, number];
  userLocation?: [number, number];
  restaurantName?: string;
  userName?: string;
  agentName?: string;
  isVisible: boolean;
  onClose: () => void;
}

export default function FullscreenMap({
  role,
  orderId,
  restaurantCoords,
  userCoords,
  destinationCoords,
  userLocation,
  restaurantName,
  userName,
  agentName,
  isVisible,
  onClose
}: FullscreenMapProps) {
  if (!isVisible) return null;

  return (
    <Modal
      visible={isVisible}
      animationType="slide"
      presentationStyle="fullScreen"
      onRequestClose={onClose}
    >
      <View style={styles.container}>
        {/* Header with close button */}
        <View style={styles.header}>
          <TouchableOpacity style={styles.closeButton} onPress={onClose}>
            <Ionicons name="close" size={28} color="#fff" />
            <Text style={styles.headerTitle}>Live Delivery Tracking</Text>
            <View style={styles.placeholder} />
          </TouchableOpacity>
        </View>

        {/* Fullscreen map */}
        <View style={styles.mapContainer}>
          <UnifiedMap
            role={role}
            orderId={orderId}
            restaurantCoords={restaurantCoords}
            userCoords={userCoords}
            destinationCoords={destinationCoords}
            userLocation={userLocation}
            restaurantName={restaurantName}
            userName={userName}
            agentName={agentName}
          />
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  header: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 1000,
    backgroundColor: 'rgba(0,0,0,0.8)',
    paddingTop: 50,
    paddingBottom: 15,
    paddingHorizontal: 20,
  },
  closeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  placeholder: {
    width: 28,
  },
  mapContainer: {
    flex: 1,
  },
});
