import React, { useEffect, useRef } from 'react';
import { View, StyleSheet, Animated, Dimensions, BackHandler, TouchableOpacity } from 'react-native';
import UserSheet from './sheet/UserSheet';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

interface DrawerLayoutProps {
  children: React.ReactNode;
  drawerOpen: boolean;
  setDrawerOpen: (open: boolean) => void;
}

const DrawerLayout: React.FC<DrawerLayoutProps> = ({ children, drawerOpen, setDrawerOpen }) => {
  const drawerPosition = useRef(new Animated.Value(-SCREEN_WIDTH)).current;

  // Animate drawer open/close
  useEffect(() => {
    Animated.timing(drawerPosition, {
      toValue: drawerOpen ? 0 : -SCREEN_WIDTH,
      duration: 250,
      useNativeDriver: true,
    }).start();
  }, [drawerOpen]);

  // Handle hardware back button
  useEffect(() => {
    const handleBackPress = () => {
      if (drawerOpen) {
        setDrawerOpen(false);
        return true;
      }
      return false;
    };

    const subscription = BackHandler.addEventListener('hardwareBackPress', handleBackPress);
    return () => {
      subscription.remove();
    };
  }, [drawerOpen, setDrawerOpen]);

  return (
    <View style={styles.container}>
      {/* Main content */}
      <View style={styles.contentContainer}>
        {children}
      </View>

      {/* Overlay - rendered when drawer is open */}
      {drawerOpen && (
        <TouchableOpacity
          style={styles.overlay}
          activeOpacity={1}
          onPress={() => setDrawerOpen(false)}
          disabled={!drawerOpen}
        />
      )}

      {/* Drawer */}
      <Animated.View
        style={[styles.drawer, { transform: [{ translateX: drawerPosition }] }]}
        pointerEvents={drawerOpen ? 'auto' : 'none'}
      >
        <UserSheet
          isVisible={drawerOpen}
          onClose={() => setDrawerOpen(false)}
        />
      </Animated.View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    overflow: 'hidden',
  },
  contentContainer: {
    flex: 1,
  },
  drawer: {
    position: 'absolute',
    top: 0,
    left: 0,
    bottom: 0,
    width: 300,
    zIndex: 9999,
    elevation: 100,
    backgroundColor: 'white',
  },
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    zIndex: 9998,
  },
});

export default DrawerLayout;