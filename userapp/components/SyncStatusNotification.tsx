
// Sync Status Notification Component - Shows sync progress and completion status
import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Animated, Modal, TouchableOpacity } from 'react-native';
import { subscribeToSync, getSyncState, type SyncStatus } from '../lib/enhanced-sync-service';

interface SyncStatusNotificationProps {
  visible?: boolean;
  autoHide?: boolean;
  autoHideDelay?: number;
}

export const SyncStatusNotification: React.FC<SyncStatusNotificationProps> = ({
  visible = true,
  autoHide = true,
  autoHideDelay = 4000,
}) => {
  const [syncState, setSyncState] = useState(getSyncState());
  const [lastStatus, setLastStatus] = useState<SyncStatus | null>(null);
  const [showNotification, setShowNotification] = useState(false);
  const [fadeAnim] = useState(new Animated.Value(0));
  const [slideAnim] = useState(new Animated.Value(100));

  useEffect(() => {
    // Subscribe to sync state changes
    const unsubscribe = subscribeToSync((state, status) => {
      setSyncState({ ...state });
      
      if (status) {
        setLastStatus(status);
        setShowNotification(true);
        
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

        // Auto-hide for success messages
        if (autoHide && status.type === 'success' && !state.isSyncing) {
          setTimeout(() => {
            hideNotification();
          }, autoHideDelay);
        }
      }
    });

    return () => unsubscribe();
  }, [autoHide, autoHideDelay, fadeAnim, slideAnim]);

  const hideNotification = () => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 100,
        duration: 300,
        useNativeDriver: true,
      }),
    ]).start(() => {
      setShowNotification(false);
      setLastStatus(null);
    });
  };

  const getStatusIcon = (type: string) => {
    switch (type) {
      case 'success':
        return '✅';
      case 'error':
        return '❌';
      case 'warning':
        return '⚠️';
      default:
        return 'ℹ️';
    }
  };

  const getStatusColor = (type: string) => {
    switch (type) {
      case 'success':
        return '#C41E26';
      case 'error':
        return '#C41E26';
      case 'warning':
        return '#FF6B00';
      default:
        return '#C41E26';
    }
  };

  if (!visible || !showNotification || !lastStatus) {
    return null;
  }

  return (
    <Animated.View
      style={[
        styles.container,
        {
          opacity: fadeAnim,
          transform: [{ translateY: slideAnim }],
          borderColor: getStatusColor(lastStatus.type),
        },
      ]}
    >
      <View style={styles.content}>
        <Text style={styles.icon}>{getStatusIcon(lastStatus.type)}</Text>
        <View style={styles.textContainer}>
          {syncState.isSyncing && (
            <>
              <Text style={styles.title}>Syncing...</Text>
              <Text style={styles.message}>{syncState.syncMessage}</Text>
              <View style={styles.progressBar}>
                <View
                  style={[styles.progressFill, { width: `${syncState.syncProgress}%` }]}
                />
              </View>
            </>
          )}
          {!syncState.isSyncing && (
            <>
              <Text style={styles.title}>
                {lastStatus.type === 'success' ? 'Sync Complete' : 'Sync Status'}
              </Text>
              <Text style={styles.message}>{lastStatus.message}</Text>
            </>
          )}
        </View>
        <TouchableOpacity onPress={hideNotification} style={styles.closeButton}>
          <Text style={styles.closeButtonText}>✕</Text>
        </TouchableOpacity>
      </View>

      Sync Details
      {!syncState.isSyncing && lastStatus.type === 'success' && (
        <View style={styles.detailsContainer}>
          {syncState.addedRestaurants > 0 && (
            <Text style={styles.detailText}>🍽️ +{syncState.addedRestaurants} restaurants</Text>
          )}
          {syncState.deletedRestaurants > 0 && (
            <Text style={styles.detailText}>🗑️ -{syncState.deletedRestaurants} removed</Text>
          )}
          {syncState.addedMenuItems > 0 && (
            <Text style={styles.detailText}>🍔 +{syncState.addedMenuItems} menu items</Text>
          )}
          {syncState.addedOrders > 0 && (
            <Text style={styles.detailText}>📦 {syncState.addedOrders} new orders</Text>
          )}
          {syncState.updatedOrders > 0 && (
            <Text style={styles.detailText}>🔄 {syncState.updatedOrders} orders updated</Text>
          )}
          {syncState.addedFeedback > 0 && (
            <Text style={styles.detailText}>💬 {syncState.addedFeedback} feedback synced</Text>
          )}
          {syncState.addedRestaurants === 0 &&
            syncState.deletedRestaurants === 0 &&
            syncState.addedMenuItems === 0 &&
            syncState.addedOrders === 0 &&
            syncState.updatedOrders === 0 &&
            syncState.addedFeedback === 0 && (
              <Text style={styles.detailText}>✨ All data up to date</Text>
            )}
        </View>
      )}
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: 80,
    left: 16,
    right: 16,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 2,
    overflow: 'hidden',
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    zIndex: 1000,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
  },
  icon: {
    fontSize: 24,
    marginRight: 12,
  },
  textContainer: {
    flex: 1,
  },
  title: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 2,
  },
  message: {
    fontSize: 14,
    color: '#666',
  },
  progressBar: {
    height: 4,
    backgroundColor: '#E0E0E0',
    borderRadius: 2,
    marginTop: 8,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#C41E26',
    borderRadius: 2,
  },
  closeButton: {
    padding: 4,
    marginLeft: 8,
  },
  closeButtonText: {
    fontSize: 18,
    color: '#999',
  },
  detailsContainer: {
    paddingHorizontal: 12,
    paddingBottom: 12,
    borderTopWidth: 1,
    borderTopColor: '#E0E0E0',
  },
  detailText: {
    fontSize: 13,
    color: '#666',
    marginTop: 4,
  },
});
