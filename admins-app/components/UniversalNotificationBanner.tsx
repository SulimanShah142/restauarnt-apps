// Universal Notification Banner Component
// Shows notifications from GlobalNotificationContext
// Can be placed in any layout to show notifications globally

import React, { useEffect } from 'react';
import { View, Text, TouchableOpacity, Animated, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useGlobalNotification, AppNotification } from '../contexts/GlobalNotificationContext';

interface NotificationBannerProps {
  position?: 'top' | 'bottom';
}

export default function UniversalNotificationBanner({ position = 'top' }: NotificationBannerProps) {
  const { notifications, removeNotification } = useGlobalNotification();
  const fadeAnim = new Animated.Value(0);
  const slideAnim = new Animated.Value(position === 'top' ? -100 : 100);

  useEffect(() => {
    if (notifications.length > 0) {
      // Animate in
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.timing(slideAnim, {
          toValue: 0,
          duration: 300,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [notifications.length]);

  if (notifications.length === 0) return null;

  // Show most recent notification
  const notification = notifications[0];

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'order':
      case 'assignment':
        return '#C41E26'; // Red for urgent
      case 'success':
        return '#4CAF50'; // Green
      case 'error':
        return '#F44336'; // Red
      case 'warning':
        return '#FF9800'; // Orange
      default:
        return '#2196F3'; // Blue
    }
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'order':
        return 'restaurant';
      case 'assignment':
        return 'bicycle';
      case 'success':
        return 'checkmark-circle';
      case 'error':
        return 'close-circle';
      case 'warning':
        return 'warning';
      default:
        return 'information-circle';
    }
  };

  return (
    <Animated.View
      style={[
        styles.container,
        {
          opacity: fadeAnim,
          transform: [{ translateY: slideAnim }],
          top: position === 'top' ? 0 : undefined,
          bottom: position === 'bottom' ? 0 : undefined,
        },
      ]}
    >
      <View style={[styles.content, { borderLeftColor: getTypeColor(notification.type) }]}>
        <Ionicons
          name={getTypeIcon(notification.type)}
          size={24}
          color={getTypeColor(notification.type)}
          style={styles.icon}
        />
        <View style={styles.textContainer}>
          <Text style={styles.title}>{notification.title}</Text>
          <Text style={styles.message}>{notification.message}</Text>
        </View>
        <TouchableOpacity onPress={() => removeNotification(notification.id)} style={styles.closeButton}>
          <Ionicons name="close" size={20} color="#666" />
        </TouchableOpacity>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    left: 0,
    right: 0,
    zIndex: 9999,
    elevation: 10,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    marginHorizontal: 16,
    marginVertical: 8,
    padding: 16,
    borderRadius: 12,
    borderLeftWidth: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 8,
  },
  icon: {
    marginRight: 12,
  },
  textContainer: {
    flex: 1,
  },
  title: {
    fontSize: 16,
    fontWeight: '700',
    color: '#000',
    marginBottom: 4,
  },
  message: {
    fontSize: 14,
    color: '#666',
  },
  closeButton: {
    padding: 4,
  },
});
