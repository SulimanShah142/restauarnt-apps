import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Modal, Alert, ActivityIndicator } from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { isAdminAuthenticated } from '@/lib/admin-auth';
import { supabase } from '@/lib/supabase';
import { checkNetworkStatus, showNetworkErrorAlert } from '@/lib/network-utils';
import { signOut } from '@/lib/auth-client';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAdminAuth } from '@/contexts/AdminAuthContext';
import { Ionicons } from '@expo/vector-icons';

// Define TypeScript interfaces
interface SummaryStats {
  totalRestaurants: number;
  totalMenuItems: number;
  totalOrders: number;
  activeDeliveries: number;
  availableDeliveryPersons: number;
}

function AdminDashboardContent() {
  const { session } = useAdminAuth();
  const router = useRouter();
  const [lastResetTime, setLastResetTime] = useState<string | null>(null);
  const [isResetting, setIsResetting] = useState(false);
  const [stats, setStats] = useState<SummaryStats>({
    totalRestaurants: 0,
    totalMenuItems: 0,
    totalOrders: 0,
    activeDeliveries: 0,
    availableDeliveryPersons: 0,
  });
  const [loading, setLoading] = useState(true);
  const [showUserSheet, setShowUserSheet] = useState(false);

  // Lazy load forceResetSync only when needed
  const handleForceReset = async () => {
    Alert.alert(
      '⚠️ Force Reset & Sync',
      'This will:\n\n1. Delete ALL local data\n2. Clear sync history\n3. Re-download EVERYTHING from Supabase\n\nContinue?',
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: '✅ Yes, Reset',
          style: 'destructive',
          onPress: async () => {
            try {
              setIsResetting(true);
              const { getDatabase } = await import('@/database');
              const db = await getDatabase();
              if (db?.syncWithSupabase) {
                await db.syncWithSupabase({ force: true });
                setLastResetTime(new Date().toLocaleString());
                Alert.alert('✅ Success', 'Database refreshed!');
                loadDashboardData();
              } else {
                Alert.alert('❌ Error', 'Database sync not available');
              }
            } catch (error: any) {
              console.error('[Dashboard] ❌ Force reset failed:', error);
              Alert.alert('❌ Error', `Reset failed: ${error.message}`);
            } finally {
              setIsResetting(false);
            }
          },
        },
      ]
    );
  };

  // Check authentication on screen focus
  useFocusEffect(
    React.useCallback(() => {
      // Add a small delay to allow auth context to initialize
      const timer = setTimeout(() => {
        checkAuth();
      }, 100);
      return () => clearTimeout(timer);
    }, [])
  );

  const checkAuth = async () => {
    try {
      const authenticated = await isAdminAuthenticated();

      if (!authenticated) {
        router.replace('/admin/login');
        return;
      }
    } catch (error) {
      console.error('[Dashboard] Auth check error:', error);
      router.replace('/admin/login');
    }
  };

  // Load dashboard data from SUPABASE (online only)
  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    try {
      // Check network status first
      const isOnline = await checkNetworkStatus();
      if (!isOnline) {
        const userIgnored = await showNetworkErrorAlert();
        if (!userIgnored) {
          return; // User didn't ignore, exit
        }
      }


      // Get today's date range in LOCAL timezone (not UTC)
      const today = new Date();
      const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate()).toISOString();
      const todayEnd = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1).toISOString();


      // Fetch data directly from Supabase
      const [{ data: restaurants }, { data: menuItems }, { data: deliveryPersonsData }] = await Promise.all([
        supabase.from('restaurants').select('id'),
        supabase.from('menu_items').select('id'),
        supabase.from('delivery_persons').select('id, is_available')
      ]);

      // Fetch ONLY today's orders (using local date range)
      const { data: orders, error: ordersError } = await supabase
        .from('orders')
        .select('id, status, created_at')
        .gte('created_at', todayStart)
        .lt('created_at', todayEnd);

      if (ordersError) {
        console.error('[Dashboard] Error fetching orders:', ordersError);
      }


      const availableDeliveryPersons = deliveryPersonsData?.filter(
        (person: any) => person.is_available === true
      ).length || 0;

      const activeDeliveries = orders?.filter(
        (order: any) => order.status === 'on_the_way' || order.status === 'delivered'
      ).length || 0;

      const stats: SummaryStats = {
        totalRestaurants: restaurants?.length || 0,
        totalMenuItems: menuItems?.length || 0,
        totalOrders: orders?.length || 0, // Today's orders only
        activeDeliveries: activeDeliveries,
        availableDeliveryPersons: availableDeliveryPersons,
      };

      setStats(stats);
      setLoading(false);
    } catch (error) {
      console.error('[Dashboard] ❌ Error loading dashboard data:', error);
      Alert.alert('Error', 'Failed to load dashboard data');
      setLoading(false);
    }
  };

  const handleSignOut = async () => {
    try {
      // Clear the admin session using the auth client
      await signOut();
      router.push('/admin/login');
    } catch (error) {
      console.error('Error signing out:', error);
      Alert.alert('Error', 'Failed to sign out');
    }
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <Text>Loading dashboard...</Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        {/* Header with profile button */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <Text style={styles.title}>Admin Dashboard</Text>
            {lastResetTime && (
              <Text style={styles.lastResetInfo}>Last reset: {lastResetTime}</Text>
            )}
          </View>
          <View style={styles.headerRight}>
            <TouchableOpacity
              style={[styles.resetButton, isResetting && styles.resetButtonDisabled]}
              onPress={handleForceReset}
              disabled={isResetting}
              accessibilityLabel="Force Reset & Sync"
            >
              {isResetting ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Ionicons name="refresh-outline" size={20} color="#fff" />
              )}
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.profileButton}
              onPress={() => setShowUserSheet(true)}
            >
              <Text style={styles.profileButtonText}>👤</Text>
            </TouchableOpacity>
          </View>
        </View>

      {/* Stats Cards */}
      <View style={styles.statsContainer}>
        <View style={[styles.statCard, styles.restaurantsCard]}>
          <Text style={styles.statValue}>{stats.totalRestaurants}</Text>
          <Text style={styles.statLabel}>Restaurants</Text>
        </View>

        <View style={[styles.statCard, styles.menuItemsCard]}>
          <Text style={styles.statValue}>{stats.totalMenuItems}</Text>
          <Text style={styles.statLabel}>Menu Items</Text>
        </View>

        <View style={[styles.statCard, styles.ordersCard]}>
          <Text style={styles.statValue}>{stats.totalOrders}</Text>
          <Text style={styles.statLabel}>Today's Orders</Text>
        </View>

        <View style={[styles.statCard, styles.deliveriesCard]}>
          <Text style={styles.statValue}>{stats.activeDeliveries}</Text>
          <Text style={styles.statLabel}>Active Deliveries</Text>
        </View>

        <View style={[styles.statCard, styles.deliveryPersonsCard]}>
          <Text style={styles.statValue}>{stats.availableDeliveryPersons}</Text>
          <Text style={styles.statLabel}>Available Drivers</Text>
        </View>
      </View>

      {/* Quick Actions */}
      <View style={styles.quickActionsContainer}>
        <Text style={styles.sectionTitle}>Quick Actions</Text>
        <View style={styles.quickActionsGrid}>
          <TouchableOpacity
            style={[styles.quickAction, styles.restaurantsAction]}
            onPress={() => router.push('/admin/restaurants')}
          >
            <Text style={styles.quickActionText}>Manage Restaurants</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.quickAction, styles.menuItemsAction]}
            onPress={() => router.push('/admin/menu-items')}
          >
            <Text style={styles.quickActionText}>Manage Menu Items</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.quickAction, styles.deliveryAction]}
            onPress={() => router.push('/admin/delivery-personnel')}
          >
            <Text style={styles.quickActionText}>Manage Delivery Personnel</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.quickAction, styles.trackingAction]}
            onPress={() => router.push('/admin/delivery-tracking')}
          >
            <Text style={styles.quickActionText}>Track Deliveries</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.quickAction, styles.settingsAction]}
            onPress={() => router.push('/admin/settings')}
          >
            <Text style={styles.quickActionText}>App Settings</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.quickAction, styles.feedbackAction]}
            onPress={() => router.push('/admin/feedback')}
          >
            <Text style={styles.quickActionText}>User Feedback</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.quickAction, styles.advertisementsAction]}
            onPress={() => router.push('/admin/advertisements')}
          >
            <Text style={styles.quickActionText}>Advertisements</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* User Sheet Modal */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={showUserSheet}
        onRequestClose={() => setShowUserSheet(false)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Account</Text>

            <View style={styles.userInfo}>
              <Text style={styles.userName}>Admin User</Text>
              <Text style={styles.userEmail}>slliman.sarwary08@gmail.com</Text>
            </View>

            <TouchableOpacity
              style={styles.signOutButton}
              onPress={handleSignOut}
            >
              <Text style={styles.signOutButtonText}>Sign Out</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.closeButton}
              onPress={() => setShowUserSheet(false)}
            >
              <Text style={styles.closeButtonText}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
      </ScrollView>
    </SafeAreaView>
  );
}

// Define styles as plain objects with proper ViewStyle typing
const styles: { [key: string]: any } = {
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 15,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  headerLeft: {
    flex: 1,
  },
  lastResetInfo: {
    fontSize: 12,
    color: '#666',
    marginTop: 4,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  resetButton: {
    backgroundColor: '#C41E26',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    flexDirection: 'row',
    alignItems: 'center',
  },
  resetButtonDisabled: {
    backgroundColor: '#ccc',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
  },
  profileButton: {
    backgroundColor: '#f0f0f0',
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  profileButtonText: {
    fontSize: 18,
  },
  statsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    paddingHorizontal: 15,
    paddingVertical: 10,
  },
  statCard: {
    width: '48%',
    padding: 15,
    marginVertical: 5,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  restaurantsCard: {
    backgroundColor: '#FFEBEE',
  },
  menuItemsCard: {
    backgroundColor: '#f3e5f5',
  },
  ordersCard: {
    backgroundColor: '#e8f5e9',
  },
  deliveriesCard: {
    backgroundColor: '#fff3e0',
  },
  deliveryPersonsCard: {
    backgroundColor: '#fce4ec',
  },
  statValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
  },
  statLabel: {
    fontSize: 14,
    color: '#666',
    marginTop: 5,
    textAlign: 'center',
  },
  quickActionsContainer: {
    backgroundColor: '#fff',
    margin: 15,
    padding: 15,
    borderRadius: 8,
    // Elevation and shadows for native platforms
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 15,
  },
  quickActionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  quickAction: {
    width: '48%',
    padding: 15,
    marginVertical: 5,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  restaurantsAction: {
    backgroundColor: '#C41E26',
  },
  menuItemsAction: {
    backgroundColor: '#9c27b0',
  },
  deliveryAction: {
    backgroundColor: '#ff9800',
  },
  trackingAction: {
    backgroundColor: '#4caf50',
  },
  settingsAction: {
    backgroundColor: '#C41E26',
  },
  feedbackAction: {
    backgroundColor: '#FF9800',
  },
  advertisementsAction: {
    backgroundColor: '#00BCD4',
  },
  quickActionText: {
    color: '#fff',
    fontWeight: 'bold',
    textAlign: 'center',
  },
  // Modal styles
  modalContainer: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  modalContent: {
    backgroundColor: '#fff',
    padding: 20,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 20,
  },
  userInfo: {
    alignItems: 'center',
    marginBottom: 20,
  },
  userName: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  userEmail: {
    fontSize: 14,
    color: '#666',
    marginTop: 5,
  },
  signOutButton: {
    backgroundColor: '#dc3545',
    padding: 15,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 10,
  },
  signOutButtonText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 16,
  },
  closeButton: {
    backgroundColor: '#ccc',
    padding: 15,
    borderRadius: 8,
    alignItems: 'center',
  },
  closeButtonText: {
    color: '#333',
    fontWeight: 'bold',
    fontSize: 16,
  },
};

export default AdminDashboardContent;