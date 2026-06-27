import React, { useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Animated, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface NotificationBannerProps {
  visible: boolean;
  title: string;
  message: string;
  type?: 'success' | 'error' | 'info' | 'warning' | 'order';
  onHide: () => void;
  duration?: number;
  onAction?: () => void;
  actionLabel?: string;
}

export default function NotificationBanner({
  visible,
  title,
  message,
  type = 'info',
  onHide,
  duration = 5000,
  onAction,
  actionLabel,
}: NotificationBannerProps) {
  const fadeAnim = React.useRef(new Animated.Value(0)).current;
  const slideAnim = React.useRef(new Animated.Value(-100)).current;

  useEffect(() => {
    if (visible) {
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

      if (duration > 0) {
        setTimeout(() => {
          hideNotification();
        }, duration);
      }
    } else {
      hideNotification();
    }
  }, [visible]);

  const hideNotification = () => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: -100,
        duration: 300,
        useNativeDriver: true,
      }),
    ]).start(() => {
      onHide();
    });
  };

  const getTypeStyles = () => {
    switch (type) {
      case 'success':
        return { backgroundColor: '#4CAF50', icon: 'checkmark-circle' as const, iconColor: '#FFFFFF' };
      case 'error':
        return { backgroundColor: '#C41E26', icon: 'alert-circle' as const, iconColor: '#FFFFFF' };
      case 'warning':
        return { backgroundColor: '#FF9800', icon: 'warning' as const, iconColor: '#FFFFFF' };
      case 'order':
        return { backgroundColor: '#C41E26', icon: 'restaurant' as const, iconColor: '#FFFFFF' };
      default:
        return { backgroundColor: '#2196F3', icon: 'information-circle' as const, iconColor: '#FFFFFF' };
    }
  };

  const typeStyles = getTypeStyles();

  if (!visible) return null;

  return (
    <Animated.View
      style={[
        styles.container,
        { backgroundColor: typeStyles.backgroundColor },
        { opacity: fadeAnim, transform: [{ translateY: slideAnim }] },
      ]}
    >
      <View style={styles.content}>
        <Ionicons name={typeStyles.icon} size={24} color={typeStyles.iconColor} />
        <View style={styles.textContainer}>
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.message} numberOfLines={2}>{message}</Text>
        </View>
        {onAction && actionLabel && (
          <TouchableOpacity style={styles.actionButton} onPress={onAction}>
            <Text style={styles.actionButtonText}>{actionLabel}</Text>
          </TouchableOpacity>
        )}
        <TouchableOpacity style={styles.closeButton} onPress={hideNotification}>
          <Ionicons name="close" size={20} color="#FFFFFF" />
        </TouchableOpacity>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 9999,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    paddingTop: Platform.OS === 'android' ? 20 : 16,
    gap: 12,
  },
  textContainer: { flex: 1 },
  title: { fontSize: 16, fontWeight: 'bold', color: '#FFFFFF', marginBottom: 4 },
  message: { fontSize: 14, color: '#FFFFFF', opacity: 0.9 },
  actionButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: 6,
  },
  actionButtonText: { color: '#FFFFFF', fontSize: 13, fontWeight: '600' },
  closeButton: { padding: 4 },
});
