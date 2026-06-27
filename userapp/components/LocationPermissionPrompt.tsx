// LocationPermissionPrompt.tsx
// Custom dialog to explain location permission before requesting it

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  Image,
  Platform,
  Linking,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';

interface LocationPermissionPromptProps {
  visible: boolean;
  onPermissionGranted: () => void;
  onPermissionDenied: () => void;
}

const LocationPermissionPrompt: React.FC<LocationPermissionPromptProps> = ({
  visible,
  onPermissionGranted,
  onPermissionDenied,
}) => {
  const [showCustomDialog, setShowCustomDialog] = useState(false);
  const [showSettingsDialog, setShowSettingsDialog] = useState(false);

  useEffect(() => {
    console.log('[LocationPrompt] visible prop changed:', visible);
    if (visible) {
      console.log('[LocationPrompt] Showing custom dialog');
      // Show custom explanation dialog
      setShowCustomDialog(true);
    }
  }, [visible]);

  const requestLocationPermission = async () => {
    try {
      console.log('[LocationPermission] Requesting OS permission...');
      
      // Close custom dialog FIRST
      setShowCustomDialog(false);
      
      // Small delay to ensure modal is closed before OS dialog appears
      await new Promise(resolve => setTimeout(resolve, 300));
      
      // Request OS permission
      const { status } = await Location.requestForegroundPermissionsAsync();
      console.log('[LocationPermission] OS permission result:', status);

      if (status === 'granted') {
        console.log('[LocationPermission] Permission granted');
        onPermissionGranted();
      } else {
        console.log('[LocationPermission] Permission denied');
        // Show settings dialog if user denied
        setShowSettingsDialog(true);
      }
    } catch (error) {
      console.error('[LocationPermission] Error requesting permission:', error);
      setShowCustomDialog(false);
      onPermissionDenied();
    }
  };

  const openSettings = async () => {
    try {
      if (Platform.OS === 'ios') {
        await Linking.openURL('app-settings:');
      } else {
        await Linking.openSettings();
      }
      setShowSettingsDialog(false);
    } catch (error) {
      console.error('[LocationPermission] Error opening settings:', error);
    }
  };

  const handleDeny = () => {
    setShowCustomDialog(false);
    onPermissionDenied();
  };

  return (
    <>
      {/* Custom Explanation Dialog */}
      <Modal
        visible={showCustomDialog}
        transparent
        animationType="fade"
        onRequestClose={() => setShowCustomDialog(false)}
      >
        <View style={styles.overlay}>
          <View style={styles.dialogContainer}>
            {/* Icon */}
            <View style={styles.iconContainer}>
              <Ionicons name="location" size={48} color="#C41E26" />
            </View>

            {/* Title */}
            <Text style={styles.title}>Location Access Required</Text>

            {/* Description */}
            <Text style={styles.description}>
              To ensure your food is delivered to the exact correct location, we need access to your device's location.
            </Text>

            {/* Benefits List */}
            <View style={styles.benefitsContainer}>
              <View style={styles.benefitItem}>
                <Ionicons name="checkmark-circle" size={20} color="#4CAF50" />
                <Text style={styles.benefitText}>
                  Accurate delivery to your exact address
                </Text>
              </View>
              <View style={styles.benefitItem}>
                <Ionicons name="checkmark-circle" size={20} color="#4CAF50" />
                <Text style={styles.benefitText}>
                  Real-time order tracking on the map
                </Text>
              </View>
              <View style={styles.benefitItem}>
                <Ionicons name="checkmark-circle" size={20} color="#4CAF50" />
                <Text style={styles.benefitText}>
                  Faster delivery time estimation
                </Text>
              </View>
              <View style={styles.benefitItem}>
                <Ionicons name="checkmark-circle" size={20} color="#4CAF50" />
                <Text style={styles.benefitText}>
                  Find restaurants near you
                </Text>
              </View>
            </View>

            {/* Privacy Note */}
            <View style={styles.privacyNote}>
              <Ionicons name="shield-checkmark" size={16} color="#666" />
              <Text style={styles.privacyText}>
                Your location is only used for delivery purposes and is never shared with third parties.
              </Text>
            </View>

            {/* Buttons */}
            <View style={styles.buttonContainer}>
              <TouchableOpacity
                style={[styles.button, styles.denyButton]}
                onPress={handleDeny}
              >
                <Text style={styles.denyButtonText}>Not Now</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.button, styles.allowButton]}
                onPress={requestLocationPermission}
              >
                <Text style={styles.allowButtonText}>Allow Location</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Settings Dialog (if user denied permission) */}
      <Modal
        visible={showSettingsDialog}
        transparent
        animationType="fade"
        onRequestClose={() => setShowSettingsDialog(false)}
      >
        <View style={styles.overlay}>
          <View style={styles.dialogContainer}>
            <View style={styles.iconContainer}>
              <Ionicons name="alert-circle" size={48} color="#FF9800" />
            </View>

            <Text style={styles.title}>Location Access Disabled</Text>

            <Text style={styles.description}>
              Without location access, we cannot guarantee accurate delivery to your address. Please enable location in your device settings.
            </Text>

            <View style={styles.buttonContainer}>
              <TouchableOpacity
                style={[styles.button, styles.cancelButton]}
                onPress={() => setShowSettingsDialog(false)}
              >
                <Text style={styles.cancelButtonText}>Maybe Later</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.button, styles.settingsButton]}
                onPress={openSettings}
              >
                <Text style={styles.settingsButtonText}>Open Settings</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  dialogContainer: {
    backgroundColor: 'white',
    borderRadius: 20,
    padding: 24,
    width: '100%',
    maxWidth: 400,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 10,
  },
  iconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#FFECEC',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  title: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#1A1A1A',
    textAlign: 'center',
    marginBottom: 12,
  },
  description: {
    fontSize: 15,
    color: '#666',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 20,
  },
  benefitsContainer: {
    width: '100%',
    alignItems: 'flex-start',
    marginBottom: 20,
  },
  benefitItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    width: '100%',
  },
  benefitText: {
    fontSize: 14,
    color: '#333',
    marginLeft: 10,
    flex: 1,
  },
  privacyNote: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F5F5F5',
    padding: 12,
    borderRadius: 8,
    marginBottom: 20,
    width: '100%',
  },
  privacyText: {
    fontSize: 12,
    color: '#666',
    marginLeft: 8,
    flex: 1,
    lineHeight: 18,
  },
  buttonContainer: {
    flexDirection: 'row',
    width: '100%',
    gap: 12,
  },
  button: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  denyButton: {
    backgroundColor: '#F5F5F5',
  },
  denyButtonText: {
    color: '#666',
    fontSize: 16,
    fontWeight: '600',
  },
  allowButton: {
    backgroundColor: '#C41E26',
  },
  allowButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
  cancelButton: {
    backgroundColor: '#F5F5F5',
  },
  cancelButtonText: {
    color: '#666',
    fontSize: 16,
    fontWeight: '600',
  },
  settingsButton: {
    backgroundColor: '#4CAF50',
  },
  settingsButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
});

export default LocationPermissionPrompt;
