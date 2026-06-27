import React from 'react';
import { Stack } from 'expo-router';
import { View, StyleSheet, Platform, Text } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import DrawerLayout from '@/components/DrawerLayout';
import { Ionicons } from '@expo/vector-icons';
import { TouchableOpacity } from 'react-native';

function MenuIconButton({ onPress }: { onPress: () => void }) {
  return (
    <TouchableOpacity
      style={styles.iconButton}
      onPress={onPress}
      hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
    >
      <Ionicons name="menu" size={24} color="#1A1A1A" />
    </TouchableOpacity>
  );
}

export default function AdminLayout() {
  const [drawerOpen, setDrawerOpen] = React.useState(false);

  return (
    <DrawerLayout drawerOpen={drawerOpen} setDrawerOpen={setDrawerOpen}>
      <View style={styles.container}>
        <StatusBar style="dark" />

        {/* Top Bar with AYAR Branding */}
        <View style={styles.topBar}>
          <View style={styles.leftContainer}>
            <MenuIconButton onPress={() => setDrawerOpen(true)} />
          </View>
          <View style={styles.centerContainer}>
            <Text style={styles.brandingText}>AYAR</Text>
          </View>
          <View style={styles.rightContainer} />
        </View>

        <Stack screenOptions={{ headerShown: false }} />
      </View>
    </DrawerLayout>
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
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 8,
    zIndex: 1000,
    position: 'relative',
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 4 },
      android: { elevation: 4 }
    })
  },
  leftContainer: { width: 40, alignItems: 'flex-start', justifyContent: 'center' },
  centerContainer: { flex: 2, alignItems: 'center', justifyContent: 'center' },
  rightContainer: { width: 40, alignItems: 'flex-end', justifyContent: 'center' },
  iconButton: { width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center' },
  brandingText: { fontSize: 26, fontWeight: '900', color: '#C41E26', letterSpacing: 4, textTransform: 'uppercase' },
});
