import { Stack } from 'expo-router';
import React from 'react';
import DrawerLayout from '@/components/DrawerLayout';
import { View, StyleSheet, Text, TouchableOpacity, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useBadge, BadgeProvider } from '@/contexts/BadgeContext';

// Component to display badge on menu icon
function MenuIconButton({ onPress, drawerOpen }: { onPress: () => void; drawerOpen: boolean }) {
  const { newDeliveriesCount } = useBadge();
  const showBadge = newDeliveriesCount > 0;

  return (
    <TouchableOpacity
      style={styles.iconButton}
      onPress={onPress}
      hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
      disabled={drawerOpen}
    >
      <Ionicons name="menu" size={24} color="#1A1A1A" />
      {showBadge && (
        <View style={styles.menuBadge}>
          <Text style={styles.menuBadgeText}>
            {newDeliveriesCount > 99 ? '99+' : newDeliveriesCount}
          </Text>
        </View>
      )}
    </TouchableOpacity>
  );
}

export default function TabLayout() {
  const [drawerOpen, setDrawerOpen] = React.useState(false);

  return (
    <BadgeProvider>
      <DrawerLayout drawerOpen={drawerOpen} setDrawerOpen={setDrawerOpen}>
        <View style={styles.container}>
          {/* Top Bar with AYAR Branding */}
          <View style={styles.topBar}>
            {/* Left: Hamburger Menu with Badge */}
            <View style={styles.leftContainer}>
              <MenuIconButton
                onPress={() => setDrawerOpen(true)}
                drawerOpen={drawerOpen}
              />
            </View>

            {/* Center: AYAR Logo */}
            <View style={styles.centerContainer}>
              <Text style={styles.brandingText}>AYAR</Text>
            </View>

            {/* Right: Placeholder for balance */}
            <View style={styles.rightContainer} />
          </View>

          <Stack screenOptions={{ headerShown: false }}>
            <Stack.Screen name="orders" options={{ headerShown: false }} />
            <Stack.Screen name="profile" options={{ headerShown: false }} />
            <Stack.Screen name="delivery-tracking" options={{ headerShown: false }} />
          </Stack>
        </View>
      </DrawerLayout>
    </BadgeProvider>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
    paddingTop: Platform.OS === 'android' ? 30 : 0,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 8,
    backgroundColor: '#FFFFFF',
    zIndex: 1000,
    position: 'relative',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
      },
      android: {
        elevation: 4,
      },
    }),
  },
  leftContainer: {
    width: 40,
    alignItems: 'flex-start',
    justifyContent: 'center',
  },
  centerContainer: {
    flex: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rightContainer: {
    width: 40,
    alignItems: 'flex-end',
    justifyContent: 'center',
  },
  iconButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  menuBadge: {
    position: 'absolute',
    right: 6,
    top: 6,
    backgroundColor: '#FF3B30',
    borderRadius: 10,
    minWidth: 18,
    height: 18,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 5,
    zIndex: 10,
  },
  menuBadgeText: {
    color: 'white',
    fontSize: 10,
    fontWeight: 'bold',
  },
  brandingText: {
    fontSize: 26,
    fontWeight: '900',
    color: '#C41E26',
    letterSpacing: 4,
    textTransform: 'uppercase',
    textShadowColor: 'rgba(0, 0, 0, 0.3)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 4,
    ...Platform.select({
      ios: {
        shadowColor: '#C41E26',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.3,
        shadowRadius: 2,
      },
      android: {
        elevation: 6,
      },
    }),
  },
});