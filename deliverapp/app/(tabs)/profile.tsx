import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Image, TouchableOpacity, Alert, FlatList, Switch, Modal, TextInput, ScrollView, ActivityIndicator, Linking } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '@/lib/supabase';
import { getCurrentSession, logoutDeliveryPerson } from '@/lib/delivery-auth';
import DrawerLayout from '@/components/DrawerLayout';
import CallAdminButton from '@/components/CallAdminButton';
import { router } from 'expo-router';

// Get delivery fee from app_settings
const getDeliveryFee = async (): Promise<number> => {
  try {
    const { data, error } = await supabase
      .from('app_settings')
      .select('constant_delivery_fee')
      .single();

    if (error) {
      console.error('[Profile] ❌ Error fetching delivery fee:', error.message);
      return 50.0;
    }

    if (!data) {
      return 50.0;
    }

    const fee = parseFloat(String(data.constant_delivery_fee)) || 50.0;
    return fee;
  } catch (error) {
    return 50.0;
  }
};

export default function DeliveryProfile() {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [profile, setProfile] = useState<any>(null);
  const [deliveries, setDeliveries] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [deliveryPersonData, setDeliveryPersonData] = useState<any>(null);
  const [viewAllDeliveries, setViewAllDeliveries] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);

  useEffect(() => {
    const loadProfile = async () => {
      // Wait a bit for component to mount
      await new Promise(resolve => setTimeout(resolve, 100));
      
      
      // Get delivery person session from AsyncStorage
      const session = await getCurrentSession();

      if (!session) {
        console.warn('[Profile] ❌ No delivery person session found');
        setFetchError('Please log in to view your profile');
        setProfile(null);
        setDeliveries([]);
        setDeliveryPersonData(null);
        setLoading(false);
        return;
      }

      // Get userId from session (user_id is the auth user ID)
      const userId = session.user_id || session.delivery_person_id;
      
      if (userId) {
        setFetchError(null);
        await loadDeliveryPersonProfile(userId, session.delivery_person_id);
      } else {
        console.warn('[Profile] ❌ No valid userId in session');
        setFetchError('Invalid session. Please log in again.');
        setLoading(false);
      }
    };

    loadProfile();
  }, []);

  const loadDeliveryPersonProfile = async (userId: string, deliveryPersonId?: string) => {
    // Use delivery_person_id if available, otherwise use user_id
    const idToUse = deliveryPersonId || userId;


    try {
      setLoading(true);
      setFetchError(null);

      let deliveryPersonData: any = null;
      let ordersData: any[] | null = null;

      // 1. Fetch Delivery Person Data from delivery_persons table
      try {
        const dpResult = await supabase
          .from('delivery_persons')
          .select('*')
          .eq('id', idToUse)
          .single();

        deliveryPersonData = dpResult.data;

        if (dpResult.error) {
          console.error('[Profile] ❌ Delivery person fetch error:', dpResult.error);
        }
      } catch (err) {
        console.error('[Profile] ❌ Delivery person fetch exception:', err);
      }

      // 2. Fetch Orders from delivery_assignments table
      try {
        // Get today's date in ISO format (start of day)
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const todayStart = today.toISOString();

        // Get date 7 days ago for recent orders fallback
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
        const sevenDaysAgoStart = sevenDaysAgo.toISOString();

        // Fetch from delivery_assignments using delivery_person_id
        // First try to get today's orders
        let ordersResult = await supabase
          .from('delivery_assignments')
          .select('*')
          .eq('delivery_person_id', idToUse)
          .gte('created_at', todayStart) // Today's orders only
          .order('created_at', { ascending: false });

        ordersData = ordersResult.data || [];

        if (ordersResult.error) {
          console.error('[Profile] ❌ delivery_assignments fetch error:', ordersResult.error);
        }

        // If no today's orders, fetch recent orders from last 7 days
        if (!ordersData || ordersData.length === 0) {
          ordersResult = await supabase
            .from('delivery_assignments')
            .select('*')
            .eq('delivery_person_id', idToUse)
            .gte('created_at', sevenDaysAgoStart) // Last 7 days
            .order('created_at', { ascending: false });

          ordersData = ordersResult.data || [];

          if (ordersResult.error) {
            console.error('[Profile] ❌ delivery_assignments (recent) fetch error:', ordersResult.error);
          }
        }

        // Filter out completed orders client-side (safer than server-side filter)
        if (ordersData) {
          ordersData = ordersData.filter(o => !o.is_completed);
        }
      } catch (err) {
        console.error('[Profile] ❌ delivery_assignments fetch exception:', err);
        // Fallback to orders table

        // Get date 7 days ago for recent orders
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
        const sevenDaysAgoStart = sevenDaysAgo.toISOString();

        const ordersResult = await supabase
          .from('orders')
          .select('*')
          .eq('delivery_person_id', idToUse)
          .gte('created_at', sevenDaysAgoStart) // Last 7 days
          .order('created_at', { ascending: false });

        ordersData = ordersResult.data;
        if (ordersResult.error) {
          console.error('[Profile] ❌ Orders table fetch error:', ordersResult.error);
        } else {
          // Filter out completed orders
          if (ordersData) {
            ordersData = ordersData.filter(o => !o.is_completed);
          }
        }
      }

      // Calculate statistics from ACTUAL delivered orders (excluding completed orders)
      if (ordersData && ordersData.length > 0) {
        // Filter out completed orders - they should not appear in delivery app
        const activeOrders = ordersData.filter(o => !o.is_completed);
        const deliveredOrders = activeOrders.filter(o => o.status === 'delivered');

        // Get delivery fee from app_settings
        const deliveryFeeFromSettings = await getDeliveryFee();

        // Calculate total earnings from delivery_fee for delivered orders only
        const totalEarnings = deliveredOrders.reduce((sum, o) => {
          const deliveryFee = parseFloat(o.delivery_fee?.toString() || '0') || deliveryFeeFromSettings;
          return sum + deliveryFee;
        }, 0);

      }

      // Combine essential data from delivery_persons table
      const combinedProfile = {
        // Name: from delivery_persons table
        full_name: deliveryPersonData?.name || 'Delivery Person',

        // Email: from delivery_persons
        email: deliveryPersonData?.email || 'Email not available',

        // Phone: from delivery_persons
        phone: deliveryPersonData?.phone || 'Phone not available',

        // Image: from delivery_persons.image_url
        image: deliveryPersonData?.image_url || null,

        // Availability
        is_available: deliveryPersonData?.is_available ?? false,

        // Stats from delivery_persons table
        rating: deliveryPersonData?.rating ?? 0,
        total_deliveries: deliveryPersonData?.total_deliveries ?? 0,

        // Vehicle info from delivery_persons table
        vehicle_type: deliveryPersonData?.vehicle_type || 'Not set',
        license_plate: deliveryPersonData?.license_plate || 'Not set',
      };


      // Get delivery fee from app_settings and add to deliveries
      const deliveryFeeFromSettings = await getDeliveryFee();

      // Filter out completed orders and add delivery_fee to each delivery if it's missing
      const deliveriesWithFee = (ordersData || [])
        .filter((delivery: any) => !delivery.is_completed) // Filter out completed orders
        .map((delivery: any) => ({
          ...delivery,
          delivery_fee: delivery.delivery_fee || deliveryFeeFromSettings
        }));

      setProfile(combinedProfile);
      setDeliveries(deliveriesWithFee);
      if (deliveryPersonData) {
        setDeliveryPersonData(deliveryPersonData);
      }

    } catch (error) {
      console.error('[Profile] ❌ Unexpected error in profile fetch:', error);
      setFetchError('Connection error. Please check your internet and try again.');
    } finally {
      setLoading(false);
    }
  };

  const toggleAvailability = async () => {
    if (!deliveryPersonData?.id) {
      Alert.alert('Error', 'Delivery person data not loaded');
      return;
    }

    const deliveryPersonId = deliveryPersonData.id;
    const currentAvailability = deliveryPersonData?.is_available ?? false;
    const newAvailability = !currentAvailability;


    try {
      // Update the delivery person's availability status in Supabase
      const { data, error } = await supabase
        .from('delivery_persons')
        .update({
          is_available: newAvailability,
          updated_at: new Date().toISOString()
        })
        .eq('id', deliveryPersonId)
        .select()
        .single();

      if (error) {
        console.error('Error updating availability:', error);
        Alert.alert('Error', 'Failed to update availability status: ' + error.message);
        return;
      }


      // Update the deliveryPersonData state
      setDeliveryPersonData((prev: any) => ({
        ...prev,
        is_available: newAvailability
      }));

      // Update the profile state
      setProfile((prevProfile: any) => ({
        ...prevProfile,
        is_available: newAvailability
      }));

      Alert.alert(
        'Success',
        `You are now ${newAvailability ? 'available' : 'unavailable'} for deliveries`
      );
    } catch (err) {
      console.error('Unexpected error updating availability:', err);
      Alert.alert('Error', 'An unexpected error occurred: ' + (err as Error).message);
    }
  };

  // Refresh profile data
  const refreshProfile = async (e?: any) => {
    // Prevent event from being passed as parameter
    if (e && e.preventDefault) {
      e.preventDefault();
    }
    
    const session = await getCurrentSession();
    if (session) {
      const userId = session.user_id || session.delivery_person_id;
      if (userId) {
        await loadDeliveryPersonProfile(userId, session.delivery_person_id);
      }
    }
  };

  const getAvatar = () => {
    // Priority: delivery_persons.image_url > profile.image
    if (deliveryPersonData?.image_url) {
      return deliveryPersonData.image_url;
    }
    if (profile?.image) {
      return profile.image;
    }
    return null;
  };

  // Get display name with fallbacks
  const getDisplayName = () => {
    return deliveryPersonData?.name ||
           profile?.full_name ||
           'Delivery Person';
  };

  // Get display email with fallbacks
  const getDisplayEmail = () => {
    return deliveryPersonData?.email ||
           profile?.email ||
           'Email not available';
  };

  // Get display phone with fallbacks
  const getDisplayPhone = () => {
    return deliveryPersonData?.phone ||
           profile?.phone ||
           'Phone not available';
  };

  // Note: Delivery personnel cannot change their profile picture
  // Profile pictures are managed by admin only

  const handleLogout = async () => {
    try {
      // Stop background location tracking
      const { stopBackgroundTracking } = await import('@/lib/background-location');
      await stopBackgroundTracking();

      const { logoutDeliveryPerson } = await import('@/lib/delivery-auth');
      await logoutDeliveryPerson();
      router.replace('/login');
    } catch (error) {
      console.error('Logout error:', error);
      Alert.alert('Error', 'Failed to logout. Please try again.');
    }
  };

  if (loading) {
    return (
      <DrawerLayout drawerOpen={drawerOpen} setDrawerOpen={setDrawerOpen}>
        <View style={styles.container}>
          <ActivityIndicator size="large" color="#C41E26" />
          <Text style={styles.loadingText}>Loading profile...</Text>
          <Text style={styles.loadingSubText}>Fetching your data from server</Text>
        </View>
      </DrawerLayout>
    );
  }

  return (
    <DrawerLayout drawerOpen={drawerOpen} setDrawerOpen={setDrawerOpen}>
      <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
        <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
          Back Button
          <View style={styles.backButtonContainer}>
            <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
              <Text style={styles.backButtonText}>← Back</Text>
            </TouchableOpacity>
          </View>

          Error Banner
          {fetchError && (
            <View style={styles.errorBanner}>
              <Text style={styles.errorBannerText}>⚠️ {fetchError}</Text>
              <TouchableOpacity onPress={() => refreshProfile()}>
                <Text style={styles.retryText}>🔄 Retry</Text>
              </TouchableOpacity>
            </View>
          )}

          Profile Header with Avatar
          <View style={styles.profileHeader}>
          <View style={styles.avatarContainer}>
            {getAvatar() ? (
              <Image source={{ uri: getAvatar() }} style={styles.avatar} />
            ) : (
              <View style={styles.avatarPlaceholder}>
                <Text style={styles.avatarInitials}>
                  {getDisplayName().charAt(0).toUpperCase()}
                </Text>
              </View>
            )}

            Info text - Profile picture is managed by admin
            <View style={styles.avatarInfoContainer}>
              <Text style={styles.avatarInfoText}>
                {getAvatar()
                  ? '📷 Profile picture set by admin'
                  : '📩 Contact admin to set your profile picture'}
              </Text>
            </View>
          </View>

          <Text style={styles.profileName}>{getDisplayName()}</Text>
          <Text style={styles.profileEmail}>{getDisplayEmail()}</Text>

          Refresh Button
          <TouchableOpacity
            style={styles.refreshButton}
            onPress={() => refreshProfile()}
          >
            <Text style={styles.refreshButtonText}>🔄 Refresh Data</Text>
          </TouchableOpacity>
        </View>

        {/* Navigation Links */}
        <View style={styles.navLinks}>
          <TouchableOpacity
            style={styles.navLink}
            onPress={() => router.push('/(tabs)/orders')}
          >
            <Text style={styles.navLinkText}>📦 Orders</Text>
          </TouchableOpacity>
        </View>

        {/* Basic Profile Information */}
        <View style={styles.infoSection}>
          <Text style={styles.sectionTitle}>Profile Information</Text>

          <View style={styles.fieldContainer}>
            <Text style={styles.fieldLabel}>Status:</Text>
            <View style={styles.statusToggleContainer}>
              <Text style={[styles.statusText, (deliveryPersonData?.is_available ?? false) ? styles.availableText : styles.unavailableText]}>
                {deliveryPersonData?.is_available ? 'Available' : 'Unavailable'}
              </Text>
              <Switch
                trackColor={{ false: "#767577", true: "#81b0ff" }}
                thumbColor={deliveryPersonData?.is_available ? "#f5dd4b" : "#f4f3f4"}
                ios_backgroundColor="#3e3e3e"
                onValueChange={toggleAvailability}
                value={deliveryPersonData?.is_available ?? false}
              />
            </View>
          </View>

          <View style={styles.fieldContainer}>
            <Text style={styles.fieldLabel}>Vehicle Type:</Text>
            <View style={styles.fieldValueContainer}>
              <Text style={styles.fieldValue}>
                {deliveryPersonData?.vehicle_type || 'Not set'}
              </Text>
              <Text style={styles.fieldNote}>Contact admin to update</Text>
            </View>
          </View>

          <View style={styles.fieldContainer}>
            <Text style={styles.fieldLabel}>License Plate:</Text>
            <View style={styles.fieldValueContainer}>
              <Text style={styles.fieldValue}>
                {deliveryPersonData?.license_plate || 'Not set'}
              </Text>
              <Text style={styles.fieldNote}>Contact admin to update</Text>
            </View>
          </View>

          <View style={styles.fieldContainer}>
            <Text style={styles.fieldLabel}>Rating:</Text>
            <Text style={styles.fieldValue}>
              {deliveryPersonData?.rating ? deliveryPersonData.rating.toFixed(1) : 'No ratings yet'}
            </Text>
          </View>

          <View style={styles.fieldContainer}>
            <Text style={styles.fieldLabel}>Total Deliveries:</Text>
            <Text style={styles.fieldValue}>
              {deliveryPersonData?.total_deliveries || 0}
            </Text>
          </View>
        </View>

        Recent Deliveries Section
        <View style={styles.infoSection}>
          <View style={styles.infoHeader}>
            <Text style={styles.sectionTitle}>📦 Delivery History</Text>
            {deliveries.length > 5 && (
              <TouchableOpacity onPress={() => setViewAllDeliveries(!viewAllDeliveries)}>
                <Text style={styles.viewAllText}>
                  {viewAllDeliveries ? 'Show Less' : `View All (${deliveries.length})`}
                </Text>
              </TouchableOpacity>
            )}
          </View>

          {deliveries.length > 0 ? (
            <>
              {(viewAllDeliveries ? deliveries : deliveries.slice(0, 5)).map((delivery, index) => {
                // Skip completed orders - they should not appear in delivery app
                if (delivery.is_completed) return null;
                
                const deliveryFee = parseFloat(delivery.delivery_fee?.toString() || '0') || 0;
                const orderTotal = parseFloat(delivery.total_amount?.toString() || '0') || 0;

                return (
                  <View key={delivery.id || index} style={styles.deliveryItem}>
                    <View style={styles.deliveryItemHeader}>
                      <View style={styles.deliveryIdContainer}>
                        <Text style={styles.deliveryRestaurant}>
                          🍽️ {delivery.restaurant_name || 'Restaurant'}
                        </Text>
                      </View>
                      <Text style={[styles.deliveryStatus, delivery.status === 'delivered' ? styles.deliveredStatus : styles.pendingStatus]}>
                        {delivery.status}
                      </Text>
                    </View>

                    <Text style={styles.deliveryAddress}>📍 {delivery.delivery_address || 'N/A'}</Text>

                    <View style={styles.deliveryFooter}>
                      <View style={styles.deliveryEarnings}>
                        <Text style={styles.deliveryTotalLabel}>Your Earnings:</Text>
                        <Text style={[styles.deliveryTotalValue, styles.deliveryFeeValue]}>
                          AFG {deliveryFee.toFixed(2)}
                        </Text>
                      </View>

                      <Text style={styles.deliveryDate}>
                        {new Date(delivery.created_at).toLocaleDateString('en-US', {
                          month: 'short',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </Text>
                    </View>
                  </View>
                );
              })}
            </>
          ) : (
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyIcon}>📦</Text>
              <Text style={styles.emptyText}>No recent deliveries</Text>
              <Text style={styles.emptySubtext}>
                {loading 
                  ? 'Loading your delivery history...' 
                  : 'No deliveries assigned today or in the last 7 days'}
              </Text>
            </View>
          )}
        </View>

        Logout Button
        <TouchableOpacity
          style={[styles.button, styles.logoutButton]}
          onPress={handleLogout}
        >
          <Text style={styles.buttonText}>Logout</Text>
        </TouchableOpacity>

        Call Admin Button
        <View style={styles.callAdminContainer}>
          <CallAdminButton />
        </View>
        </ScrollView>
      </SafeAreaView>
    </DrawerLayout>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  scrollView: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  scrollContent: {
    flexGrow: 1,
  },
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
    padding: 20,
  },
  backButtonContainer: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#f5f5f5',
    marginBottom: 10,
  },
  backButton: {
    padding: 10,
    backgroundColor: '#C41E26',
    borderRadius: 8,
    alignSelf: 'flex-start',
  },
  backButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  loadingText: {
    marginTop: 15,
    fontSize: 16,
    color: '#666',
    fontWeight: '600',
  },
  loadingSubText: {
    marginTop: 8,
    fontSize: 14,
    color: '#999',
  },
  errorBanner: {
    backgroundColor: '#FFF3CD',
    borderLeftWidth: 4,
    borderLeftColor: '#FFC107',
    padding: 12,
    borderRadius: 8,
    marginBottom: 15,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  errorBannerText: {
    fontSize: 14,
    color: '#856404',
    flex: 1,
    marginRight: 10,
  },
  retryText: {
    fontSize: 14,
    color: '#007AFF',
    fontWeight: '600',
  },
  profileHeader: {
    alignItems: 'center',
    marginBottom: 20,
    paddingTop: 20,
  },
  avatarContainer: {
    alignItems: 'center',
    marginBottom: 15,
  },
  avatar: {
    width: 120,
    height: 120,
    borderRadius: 60,
  },
  avatarPlaceholder: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: '#C41E26',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarInitials: {
    fontSize: 40,
    color: 'white',
    fontWeight: 'bold',
  },
  avatarActions: {
    flexDirection: 'row',
    marginTop: 10,
    gap: 10,
  },
  avatarInfoContainer: {
    marginTop: 10,
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: '#f0f0f0',
    borderRadius: 8,
    maxWidth: 250,
  },
  avatarInfoText: {
    fontSize: 12,
    color: '#666',
    textAlign: 'center',
    fontWeight: '500',
  },
  avatarButton: {
    backgroundColor: '#C41E26',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  avatarButtonText: {
    color: 'white',
    fontWeight: '600',
    fontSize: 14,
  },
  profileName: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 5,
  },
  profileEmail: {
    fontSize: 16,
    color: '#666',
    marginBottom: 5,
  },
  profileStatus: {
    fontSize: 16,
    fontWeight: '600',
    color: '#C41E26',
  },
  refreshButton: {
    marginTop: 10,
    backgroundColor: '#C41E26',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
  },
  refreshButtonText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600',
  },
  navLinks: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    backgroundColor: 'white',
    padding: 15,
    borderRadius: 10,
    marginBottom: 15,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
  },
  navLink: {
    alignItems: 'center',
    padding: 10,
  },
  navLinkText: {
    fontSize: 14,
    color: '#333',
    fontWeight: '600',
  },
  infoSection: {
    backgroundColor: 'white',
    padding: 20,
    borderRadius: 10,
    marginBottom: 15,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
  },
  statsSection: {
    backgroundColor: 'white',
    padding: 20,
    borderRadius: 10,
    marginBottom: 15,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginBottom: 15,
  },
  statCard: {
    width: '48%',
    backgroundColor: '#f5f5f5',
    padding: 15,
    borderRadius: 8,
    marginBottom: 10,
    alignItems: 'center',
  },
  statValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#C41E26',
    marginBottom: 5,
  },
  statLabel: {
    fontSize: 13,
    color: '#666',
    textAlign: 'center',
  },
  earningsCard: {
    backgroundColor: '#FFF8E1',
    padding: 15,
    borderRadius: 8,
    marginBottom: 15,
  },
  earningsLabel: {
    fontSize: 14,
    color: '#666',
    marginBottom: 5,
  },
  earningsValue: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#C41E26',
    marginBottom: 10,
  },
  earningsBreakdown: {
    borderTopWidth: 1,
    borderTopColor: '#FFE0B2',
    paddingTop: 10,
  },
  breakdownRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 5,
  },
  breakdownLabel: {
    fontSize: 13,
    color: '#666',
  },
  tipsValue: {
    fontSize: 13,
    color: '#4CAF50',
    fontWeight: '600',
  },
  ratingCard: {
    backgroundColor: '#E8F5E9',
    padding: 15,
    borderRadius: 8,
    alignItems: 'center',
  },
  ratingLabel: {
    fontSize: 14,
    color: '#666',
    marginBottom: 5,
  },
  ratingValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#4CAF50',
  },
  deliveryItem: {
    backgroundColor: '#f9f9f9',
    padding: 15,
    borderRadius: 8,
    marginBottom: 10,
  },
  deliveryItemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  deliveryId: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#C41E26',
  },
  deliveryStatus: {
    fontSize: 12,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    fontWeight: '600',
  },
  deliveredStatus: {
    backgroundColor: '#E8F5E9',
    color: '#2E7D32',
  },
  pendingStatus: {
    backgroundColor: '#FFF3E0',
    color: '#EF6C00',
  },
  deliveryAddress: {
    fontSize: 13,
    color: '#666',
    marginBottom: 10,
  },
  deliveryFooter: {
    flexDirection: 'column',
    alignItems: 'flex-start',
    gap: 6,
  },
  deliveryTotal: {
    fontSize: 15,
    fontWeight: 'bold',
    color: '#C41E26',
  },
  deliveryTotalLabel: {
    fontSize: 13,
    color: '#666',
    fontWeight: '500',
  },
  deliveryTotalValue: {
    fontSize: 15,
    fontWeight: 'bold',
    color: '#333',
  },
  deliveryEarningsTotal: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#C41E26',
    marginLeft: 4,
  },
  deliveryDate: {
    fontSize: 12,
    color: '#999',
    alignSelf: 'flex-end',
  },
  infoHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 15,
  },
  editText: {
    color: '#C41E26',
    fontSize: 16,
    fontWeight: '600',
  },
  infoText: {
    fontSize: 16,
    color: '#666',
    lineHeight: 24,
  },
  locationWarning: {
    color: '#C41E26',
    fontSize: 14,
    marginTop: 8,
    fontStyle: 'italic',
  },
  statusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    marginTop: 10,
  },
  statusButton: {
    padding: 10,
    borderRadius: 8,
    minWidth: 120,
    alignItems: 'center',
  },
  availableButton: {
    backgroundColor: '#4CAF50',
  },
  unavailableButton: {
    backgroundColor: '#FF9800',
  },
  orderCard: {
    backgroundColor: 'white',
    borderRadius: 8,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 1.41,
    elevation: 2,
  },
  orderNumber: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#C41E26',
  },
  orderStatus: {
    fontSize: 14,
    color: '#666',
    marginTop: 4,
  },
  orderRestaurant: {
    fontSize: 14,
    color: '#333',
    marginTop: 4,
  },
  orderUser: {
    fontSize: 14,
    color: '#333',
    marginTop: 2,
  },
  orderAddress: {
    fontSize: 14,
    color: '#666',
    marginTop: 4,
  },
  orderTotal: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#C41E26',
    marginTop: 8,
  },
  statusButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 10,
  },
  statusButtonAlt: {
    flex: 1,
    padding: 10,
    borderRadius: 6,
    alignItems: 'center',
    marginHorizontal: 5,
  },
  deliveredButton: {
    backgroundColor: '#4CAF50',
  },
  onTheWayButton: {
    backgroundColor: '#C41E26',
  },
  statusButtonText: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 14,
  },
  emptyText: {
    textAlign: 'center',
    padding: 10,
    color: '#666',
    fontStyle: 'italic',
    fontSize: 16,
    fontWeight: '600',
  },
  emptyContainer: {
    padding: 30,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyIcon: {
    fontSize: 48,
    marginBottom: 10,
  },
  emptySubtext: {
    textAlign: 'center',
    color: '#999',
    fontSize: 14,
    marginTop: 5,
  },
  modalContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  modalContent: {
    backgroundColor: 'white',
    padding: 20,
    borderRadius: 10,
    width: '80%',
    maxWidth: 400,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 15,
    textAlign: 'center',
  },
  phoneInput: {
    borderWidth: 1,
    borderColor: '#ddd',
    padding: 12,
    borderRadius: 8,
    fontSize: 16,
    marginBottom: 20,
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  modalButton: {
    flex: 1,
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
    marginHorizontal: 5,
  },
  cancelButton: {
    backgroundColor: '#ccc',
  },
  saveButton: {
    backgroundColor: '#C41E26',
  },
  modalButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
  breakdownValue: {
    fontSize: 14,
    color: '#4CAF50',
    fontWeight: '600',
  },
  timeBasedEarnings: {
    borderTopWidth: 1,
    borderTopColor: '#FFE0B2',
    paddingTop: 10,
    marginTop: 5,
  },
  timeEarningsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 6,
  },
  timeEarningsLabel: {
    fontSize: 13,
    color: '#666',
    fontWeight: '500',
  },
  timeEarningsValue: {
    fontSize: 14,
    color: '#C41E26',
    fontWeight: 'bold',
  },
  viewAllText: {
    fontSize: 14,
    color: '#C41E26',
    fontWeight: '600',
    alignSelf: 'center',
  },
  deliveryIdContainer: {
    flex: 1,
  },
  deliveryRestaurant: {
    fontSize: 12,
    color: '#666',
    marginTop: 2,
  },
  deliveryEarnings: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  orderTotalValue: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#C41E26',
  },
  driverEarningsSection: {
    backgroundColor: '#e8f5e9',
    padding: 10,
    borderRadius: 6,
    marginTop: 8,
    borderWidth: 1,
    borderColor: '#4CAF50',
  },
  driverEarningsLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#2e7d32',
    marginBottom: 6,
  },
  earningsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  earningsDetailLabel: {
    fontSize: 13,
    color: '#666',
  },
  earningsDetailValue: {
    fontSize: 13,
    fontWeight: '600',
    color: '#333',
  },
  deliveryFeeValue: {
    color: '#2e7d32',
    fontWeight: 'bold',
  },
  tipValue: {
    color: '#FF9800',
    fontWeight: 'bold',
  },
  totalEarningsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 6,
    paddingTop: 6,
    borderTopWidth: 1,
    borderTopColor: '#a5d6a7',
  },
  totalEarningsLabel: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#1b5e20',
  },
  totalEarningsValue: {
    fontSize: 15,
    fontWeight: 'bold',
    color: '#2e7d32',
  },
  deliveryFee: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#C41E26',
  },
  deliveryTip: {
    fontSize: 12,
    color: '#4CAF50',
    fontWeight: '600',
  },
  fieldContainer: {
    marginBottom: 15,
  },
  fieldLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 5,
  },
  fieldValueContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  fieldValue: {
    fontSize: 16,
    color: '#666',
    flex: 1,
  },
  fieldNote: {
    fontSize: 12,
    color: '#999',
    fontStyle: 'italic',
    marginLeft: 10,
  },
  statusToggleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statusText: {
    fontSize: 16,
    marginRight: 10,
  },
  availableText: {
    color: '#4CAF50',
    fontWeight: 'bold',
  },
  unavailableText: {
    color: '#FF9800',
    fontWeight: 'bold',
  },
  editInput: {
    borderWidth: 1,
    borderColor: '#ddd',
    padding: 12,
    borderRadius: 8,
    fontSize: 16,
    marginBottom: 10,
  },
  editButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  button: {
    backgroundColor: '#C41E26',
    padding: 10,
    borderRadius: 8,
    alignItems: 'center',
  },
  cancelButtonAlt: {
    backgroundColor: '#ccc',
  },
  buttonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
  logoutButton: {
    backgroundColor: '#C41E26',
    padding: 15,
    borderRadius: 8,
    marginTop: 10,
    marginBottom: 10,
  },
  callAdminContainer: {
    marginTop: 20,
    alignItems: 'center',
    paddingVertical: 10,
  },
});
