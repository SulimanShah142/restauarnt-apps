// Offline Indicator Component - Shows network status and offline mode
import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';
import { subscribeToSync, getSyncState } from '../lib/enhanced-sync-service';

interface OfflineIndicatorProps {
  visible?: boolean;
}

export const OfflineIndicator: React.FC<OfflineIndicatorProps> = ({ visible = true }) => {
  const [isOnline, setIsOnline] = useState(true);
  const [fadeAnim] = useState(new Animated.Value(0));

  useEffect(() => {
    // Subscribe to sync state changes
    const unsubscribe = subscribeToSync((state) => {
      setIsOnline(state.isOnline);
      
      // Fade in when offline, fade out when online
      Animated.timing(fadeAnim, {
        toValue: state.isOnline ? 0 : 1,
        duration: 300,
        useNativeDriver: true,
      }).start();
    });

    // Set initial state
    const currentState = getSyncState();
    setIsOnline(currentState.isOnline);
    if (!currentState.isOnline) {
      fadeAnim.setValue(1);
    }

    return () => unsubscribe();
  }, [fadeAnim]);

  if (!visible || isOnline) {
    return null;
  }

  return (
    <Animated.View style={[styles.container, { opacity: fadeAnim }]}>
      <View style={styles.content}>
        <Text style={styles.icon}>📴</Text>
        <Text style={styles.text}>No internet connection - Using offline mode</Text>
      </View>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    backgroundColor: '#FF9800',
    zIndex: 9999,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  icon: {
    fontSize: 16,
    marginRight: 8,
  },
  text: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
});
