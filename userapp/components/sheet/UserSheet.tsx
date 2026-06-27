import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert, Image, ScrollView } from 'react-native';
import { supabase } from '../../lib/supabase';
import { useRouter } from 'expo-router';
import { orderService } from '../../lib/order-service';
import { useBadge } from '../../contexts/BadgeContext';

interface UserSheetProps {
  isVisible?: boolean;
  onClose?: () => void;
}

const UserSheet: React.FC<UserSheetProps> = ({ isVisible = false, onClose }) => {
  const router = useRouter();
  const { orderUpdatesCount, refreshBadge } = useBadge();
  const [user, setUser] = useState<any>(null);
  const [activeOrders, setActiveOrders] = useState<any[]>([]);

  // Load user directly from Supabase auth session - no loading state
  useEffect(() => {
    if (!isVisible) {
      setUser(null);
      return;
    }

    // Get session synchronously from cache (already loaded by Supabase SDK)
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        setUser(session.user);
      } else {
        setUser(null);
      }
    });
  }, [isVisible]);

  // Load active orders when user is available
  useEffect(() => {
    const loadActiveOrders = async () => {
      if (!user?.id || !isVisible) {
        setActiveOrders([]);
        return;
      }

      try {
        const userOrders = await orderService.getOrdersByUserId(user.id);
        // Filter for active orders (not delivered or cancelled)
        const active = userOrders.filter(order =>
          order.status !== 'delivered' && order.status !== 'cancelled'
        );
        // Only keep the most recent active order
        setActiveOrders(active.length > 0 ? [active[0]] : []);
      } catch (error) {
        console.error('[UserSheet] Error loading orders:', error);
        setActiveOrders([]);
      }
    };

    loadActiveOrders();
  }, [isVisible, user?.id]);

  // Get user's profile picture from session metadata
  const getUserAvatar = () => {
    if (user?.user_metadata?.picture_url) {
      return user.user_metadata.picture_url;
    } else if (user?.user_metadata?.avatar) {
      return user.user_metadata.avatar;
    } else if (user?.user_metadata?.image) {
      return user.user_metadata.image;
    }
    return null;
  };

  if (!isVisible) return null;

  const handleSignOut = async () => {
    try {
      console.log('[UserSheet] Signing out...');
      await supabase.auth.signOut();
      console.log('[UserSheet] Signed out, waiting for session to clear...');
      
      // Wait for session to be cleared from AsyncStorage
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // Verify session was cleared
      const { data: { session } } = await supabase.auth.getSession();
      console.log('[UserSheet] Session cleared:', !session);
      
      console.log('[UserSheet] Redirecting to sign-in');
      // Direct redirect to sign-in - no middleman
      router.replace('/(auth)/sign-in');
      onClose?.();
    } catch (error) {
      console.error('[UserSheet] Sign out error:', error);
      Alert.alert('Error', 'Failed to sign out. Please try again.');
    }
  };

  const handleDeleteAccount = async () => {
    Alert.alert(
      'Delete Account',
      'Are you sure you want to delete your account? This action cannot be undone and will permanently delete:\n\n• Your profile and personal information\n• Saved addresses\n• Feedback and reviews\n• Cart items\n• Notifications\n• Login credentials\n\n⚠️ Your order history will be preserved (anonymized) for admin and restaurant records, but will no longer be linked to your personal information.',
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Delete Account',
          style: 'destructive',
          onPress: async () => {
            try {
              console.log('[UserSheet] Deleting account...');

              // Get current session directly
              const { data: { session } } = await supabase.auth.getSession();

              if (!session?.user?.id) {
                console.error('[UserSheet] No session found');
                Alert.alert('Error', 'No user session found. Please try signing in again.');
                return;
              }

              const userId = session.user.id;
              console.log('[UserSheet] Deleting account for user:', userId);

              // Call the delete account function
              const { error } = await (supabase.rpc('delete_user_account', {
                user_id_to_delete: userId
              } as any) as any);

              if (error) {
                console.error('[UserSheet] Delete account error:', error);
                throw error;
              }

              console.log('[UserSheet] Account deleted successfully');

              // Sign out
              await supabase.auth.signOut();

              // Wait for session to clear
              await new Promise(resolve => setTimeout(resolve, 500));

              Alert.alert(
                'Account Deleted',
                'Your account and personal data have been permanently deleted. Your order history has been preserved (anonymized) for admin records.',
                [
                  {
                    text: 'OK',
                    onPress: () => {
                      router.replace('/(auth)/sign-in');
                      onClose?.();
                    }
                  }
                ]
              );
            } catch (error: any) {
              console.error('[UserSheet] Delete account error:', error);
              Alert.alert(
                'Error',
                `Failed to delete account: ${error.message || 'Please try again or contact support.'}`
              );
            }
          },
        },
      ]
    );
  };

  return (
    <ScrollView style={styles.drawer}>
      <View style={styles.header}>
        <Text style={styles.title}>User Profile</Text>
        <TouchableOpacity
          onPress={onClose}
          style={styles.closeButton}
        >
          <Text style={styles.closeButtonText}>×</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.content}>
        {user ? (
          <View>
            <View style={styles.avatarContainer}>
              {getUserAvatar() ? (
                <Image source={{ uri: getUserAvatar() }} style={styles.avatar} />
              ) : (
                <View style={styles.avatarPlaceholder}>
                  <Text style={styles.avatarInitials}>
                    {user.user_metadata?.full_name?.charAt(0)?.toUpperCase() ||
                     user.user_metadata?.name?.charAt(0)?.toUpperCase() ||
                     user.user_metadata?.first_name?.charAt(0)?.toUpperCase() ||
                     user.email?.charAt(0)?.toUpperCase() || 'U'}
                  </Text>
                </View>
              )}
            </View>

            <Text style={styles.userName}>
              {user.user_metadata?.full_name ||
               user.user_metadata?.name ||
               user.user_metadata?.first_name ||
               user.email?.split('@')[0] || 'User'}
            </Text>
            <Text style={styles.userEmail}>
              {user.email || ''}
            </Text>

            {/* Navigation Links */}
            <View style={styles.navLinks}>
              <TouchableOpacity
                style={styles.navLink}
                onPress={() => {
                  try {
                    router.push('/(tabs)/menu');
                  } catch (error) {
                    console.error('[UserSheet] Navigation error:', error);
                  }
                  onClose?.();
                }}
              >
                <Text style={styles.navLinkText}>Home</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.navLink}
                onPress={() => {
                  try {
                    router.push('/(tabs)/user-orders');
                  } catch (error) {
                    console.error('[UserSheet] Navigation error:', error);
                  }
                  onClose?.();
                }}
              >
                <Text style={styles.navLinkText}>📦 My Orders</Text>
                {orderUpdatesCount > 0 && (
                  <View style={styles.badge}>
                    <Text style={styles.badgeText}>
                      {orderUpdatesCount > 99 ? '99+' : orderUpdatesCount}
                    </Text>
                  </View>
                )}
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.navLink}
                onPress={() => {
                  try {
                    router.push('/(tabs)/feedback');
                  } catch (error) {
                    console.error('[UserSheet] Navigation error:', error);
                  }
                  onClose?.();
                }}
              >
                <Text style={styles.navLinkText}>Feedback</Text>
              </TouchableOpacity>
            </View>

            {/* Active Orders Section */}
            {activeOrders.length > 0 && (
              <View style={styles.activeOrdersSection}>
                <Text style={styles.activeOrdersTitle}>Active Orders</Text>
                {activeOrders.map((order, index) => (
                  <TouchableOpacity
                    key={order.id || index}
                    style={styles.activeOrderItem}
                    onPress={() => {
                      try {
                        // Navigate to order-status page with the specific order ID
                        router.push(`/(tabs)/order-status?orderId=${order.id}`);
                      } catch (error) {
                        console.error('[UserSheet] Navigation error:', error);
                      }
                      onClose?.();
                    }}
                  >
                    {/* Show restaurant name */}
                    <Text style={styles.activeOrderRestaurant}>
                      📍 {order.restaurant?.name || order.restaurantName || 'Restaurant'}
                    </Text>
                    {/* Show order items */}
                    <View style={styles.activeOrderItems}>
                      {order.items && order.items.length > 0 ? (
                        order.items.slice(0, 2).map((item: any, itemIndex: number) => (
                          <Text key={itemIndex} style={styles.activeOrderItemText}>
                            {item.quantity}x {item.name || 'Item'}
                          </Text>
                        ))
                      ) : (
                        <Text style={styles.activeOrderItemText}>No items</Text>
                      )}
                    </View>
                    {/* Show status */}
                    <Text style={styles.activeOrderStatus}>{order.status}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}

            <TouchableOpacity
              style={[styles.button, styles.logoutButton]}
              onPress={handleSignOut}
            >
              <Text style={styles.buttonText}>Logout</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.button, styles.deleteAccountButton]}
              onPress={handleDeleteAccount}
            >
              <Text style={[styles.buttonText, styles.deleteAccountButtonText]}>Delete Account</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View>
            <Text style={styles.notLoggedIn}>Not logged in</Text>
          </View>
        )}
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  drawer: {
    position: 'absolute',
    top: 0,
    left: 0,
    bottom: 0,
    width: 300,
    backgroundColor: 'white',
    zIndex: 1000,
    shadowColor: '#000',
    shadowOffset: {
      width: 2,
      height: 0,
    },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  closeButton: {
    padding: 5,
  },
  closeButtonText: {
    fontSize: 24,
  },
  content: {
    flex: 1,
    padding: 20,
  },
  avatarContainer: {
    alignItems: 'center',
    marginBottom: 20,
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    marginBottom: 10,
  },
  avatarPlaceholder: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#C41E26',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 10,
  },
  avatarInitials: {
    fontSize: 24,
    color: 'white',
    fontWeight: 'bold',
  },
  userName: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 5,
    textAlign: 'center',
  },
  navLinks: {
    marginBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
    paddingBottom: 15,
  },
  activeOrdersSection: {
    marginBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
    paddingBottom: 15,
  },
  activeOrdersTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 10,
    color: '#333',
  },
  activeOrderItem: {
    paddingVertical: 8,
    paddingHorizontal: 10,
    backgroundColor: '#f9f9f9',
    borderRadius: 5,
    marginBottom: 5,
  },
  activeOrderRestaurant: {
    fontSize: 13,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
  },
  activeOrderItems: {
    marginBottom: 4,
  },
  activeOrderItemText: {
    fontSize: 12,
    color: '#666',
    marginBottom: 2,
  },
  activeOrderStatus: {
    fontSize: 11,
    color: '#C41E26',
    fontWeight: '600',
  },
  navLink: {
    paddingVertical: 12,
    paddingHorizontal: 10,
    position: 'relative',
  },
  navLinkText: {
    fontSize: 16,
    color: '#333',
  },
  badge: {
    position: 'absolute',
    right: 10,
    top: 8,
    backgroundColor: '#FF3B30',
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 6,
  },
  badgeText: {
    color: 'white',
    fontSize: 12,
    fontWeight: 'bold',
  },
  userEmail: {
    fontSize: 14,
    color: '#666',
    marginBottom: 20,
    textAlign: 'center',
  },
  button: {
    backgroundColor: '#C41E26',
    padding: 15,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 10,
  },
  buttonText: {
    color: 'white',
    fontWeight: 'bold',
  },
  logoutButton: {
    backgroundColor: '#C41E26',
  },
  deleteAccountButton: {
    backgroundColor: '#FF3B30',
    marginTop: 5,
  },
  deleteAccountButtonText: {
    color: 'white',
  },
  notLoggedIn: {
    textAlign: 'center',
    paddingVertical: 20,
    fontSize: 16,
    color: '#666',
  },
});

export default UserSheet;