import React, { useEffect, useState } from 'react';
import { View, Text, Modal, TouchableOpacity, StyleSheet, Platform, Linking } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

// expo-notifications doesn't work in Expo Go (SDK 53+), only in development builds
// We NEVER import it at module level to prevent auto-initialization errors
let Notifications: any = null;
let isExpoGo = false;
let checked = false;

const checkEnvironment = () => {
  if (checked) return;
  try {
    if (Platform.OS !== 'web') {
      const Device = require('expo-device').default;
      isExpoGo = !Device.isDevice;
    }
  } catch {
    isExpoGo = true;
  }
  
  if (!isExpoGo && Platform.OS !== 'web') {
    try {
      Notifications = require('expo-notifications');
    } catch {
      Notifications = null;
    }
  }
  checked = true;
};

interface NotificationPermissionPromptProps {
  visible: boolean;
  onClose: () => void;
}

export default function NotificationPermissionPrompt({
  visible,
  onClose,
}: NotificationPermissionPromptProps) {
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);

  useEffect(() => {
    checkEnvironment();
    checkPermission();
  }, []);

  const checkPermission = async () => {
    if (!Notifications || isExpoGo || Platform.OS === 'web') {
      // Notifications not available in Expo Go or web
      setHasPermission(true);
      return;
    }
    try {
      const { status } = await Notifications.getPermissionsAsync();
      setHasPermission(status === 'granted');
    } catch (error) {
      setHasPermission(true);
    }
  };

  const requestPermission = async () => {
    if (!Notifications || isExpoGo || Platform.OS === 'web') {
      onClose();
      return;
    }
    try {
      const { status } = await Notifications.requestPermissionsAsync();
      if (status === 'granted') {
        setHasPermission(true);
        onClose();
      }
    } catch (error) {
      onClose();
    }
  };

  const openSettings = async () => {
    try {
      if (Platform.OS === 'ios') {
        await Linking.openURL('app-settings:');
      } else {
        await Linking.openSettings();
      }
    } catch (error) {
      console.error('[NotificationPrompt] Error opening settings:', error);
    }
  };

  if (hasPermission === true) {
    return null;
  }

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={styles.modal}>
          <View style={styles.iconContainer}>
            <Ionicons name="notifications" size={48} color="#C41E26" />
          </View>
          
          <Text style={styles.title}>Enable Notifications</Text>
          <Text style={styles.message}>
            Stay updated with real-time notifications for orders, deliveries, and important updates.
          </Text>

          <View style={styles.buttonContainer}>
            <TouchableOpacity
              style={styles.allowButton}
              onPress={requestPermission}
              activeOpacity={0.7}
            >
              <Ionicons name="checkmark-circle" size={20} color="#FFFFFF" />
              <Text style={styles.allowButtonText}>Allow Notifications</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.settingsButton}
              onPress={openSettings}
              activeOpacity={0.7}
            >
              <Ionicons name="settings" size={20} color="#C41E26" />
              <Text style={styles.settingsButtonText}>Open Settings</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.laterButton}
              onPress={onClose}
              activeOpacity={0.7}
            >
              <Text style={styles.laterButtonText}>Maybe Later</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modal: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 24,
    width: '100%',
    maxWidth: 340,
    alignItems: 'center',
  },
  iconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#FFF5F5',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  title: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 12,
    textAlign: 'center',
  },
  message: {
    fontSize: 15,
    color: '#666',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 24,
  },
  buttonContainer: {
    width: '100%',
    gap: 12,
  },
  allowButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#C41E26',
    paddingVertical: 14,
    borderRadius: 12,
    gap: 8,
  },
  allowButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  settingsButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFF5F5',
    paddingVertical: 14,
    borderRadius: 12,
    gap: 8,
  },
  settingsButtonText: {
    color: '#C41E26',
    fontSize: 16,
    fontWeight: '600',
  },
  laterButton: {
    paddingVertical: 14,
    alignItems: 'center',
  },
  laterButtonText: {
    color: '#999',
    fontSize: 15,
    fontWeight: '500',
  },
});
