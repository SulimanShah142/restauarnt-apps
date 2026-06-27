// User Orders History Screen - Shows all user orders with instant cache loading
import React, { useState, useEffect } from 'react';
import { View, Text, FlatList, StyleSheet, TouchableOpacity, ActivityIndicator, RefreshControl, Image } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '../../lib/supabase';
import { Session } from '@supabase/supabase-js';
import { ordersServiceWithCache, type Order } from '../../lib/orders-service-with-cache';
import { OfflineIndicator } from '../../components/OfflineIndicator';
import { SyncStatusNotification } from '../../components/SyncStatusNotification';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Spacing, Typography, BorderRadius, Shadow } from '../../lib/design-system';

export default function UserOrdersScreen() {
  const router = useRouter();
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isReady, setIsReady] = useState(false);

  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showAllOrders, setShowAllOrders] = useState(false);

  // Display only first 4 orders unless user taps "Show All"
  const displayedOrders = showAllOrders ? orders : orders.slice(0, 4);

  // Load session on mount
  useEffect(() => {
    const loadSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      setSession(session);
      setIsReady(true);
      setIsLoading(false);
    };
    loadSession();
  }, []);

  useEffect(() => {
    // Wait for auth to be ready before loading orders
    if (!isReady || isLoading) {
      return;
    }

    if (session?.user?.id) {
      loadOrders();
    } else if (!session) {
      setLoading(false);
    }
  }, [session?.user?.id, isLoading, isReady]);

  const loadOrders = async () => {
    if (!session?.user?.id) {
      setLoading(false);
      return;
    }

    try {
      setOrders([]);
      setError(null);

      // Load orders immediately from cache (INSTANT UI)
      const dbModule = await import('@/db');
      const database = await dbModule.getDatabase();
      const cachedOrders = await database.getOrders(session.user.id);

      if (cachedOrders.length > 0) {
        setOrders(cachedOrders);
        setLoading(false);
        return;
      }

      // No cache - need to sync from Supabase

      // Trigger sync and WAIT for it to complete
      const userOrders = await ordersServiceWithCache.getUserOrders(session.user.id);

      // Show synced orders
      if (userOrders.length > 0) {
        setOrders(userOrders);
      } else {
        setOrders([]);
      }
    } catch (err: any) {
      console.error('[UserOrders] ❌ Error loading orders:', err);
      console.error('[UserOrders] Error details:', err.message);
      console.error('[UserOrders] Error stack:', err.stack);
      setError('Failed to load orders: ' + (err.message || 'Unknown error'));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleRefresh = () => {
    setRefreshing(true);
    loadOrders();
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'delivered':
        return '#4CAF50';
      case 'confirmed':
      case 'preparing':
      case 'ready':
        return '#2196F3';
      case 'cancelled':
      case 'rejected':
        return '#C41E26';
      default:
        return '#FF9800';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'delivered':
        return 'checkmark-circle';
      case 'confirmed':
        return 'checkmark';
      case 'preparing':
        return 'flame';
      case 'ready':
        return 'bag-check';
      case 'cancelled':
      case 'rejected':
        return 'close-circle';
      default:
        return 'time';
    }
  };

  const formatDate = (dateString: any) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return '';
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const renderOrderItem = ({ item }: { item: Order }) => {
    // Safety check for invalid item
    if (!item) return null;

    return (
      <TouchableOpacity
        style={styles.orderCard}
        onPress={() => {
          try {
            router.push(`/order-details?orderId=${item.id}`);
          } catch (error) {
            console.error('[UserOrders] Navigation error:', error);
          }
        }}
        activeOpacity={0.7}
      >
        {/* Order Header */}
        <View style={styles.orderHeader}>
          <View style={styles.orderInfo}>
            <Text style={styles.orderNumber}>🍽️ {item.restaurantName || 'Restaurant'}</Text>
            <Text style={styles.orderDate}>{formatDate(item.createdAt)}</Text>
          </View>
          <View style={[styles.statusBadge, { backgroundColor: getStatusColor(item.status) + '20' }]}>
            <Ionicons
              name={getStatusIcon(item.status) as any}
              size={16}
              color={getStatusColor(item.status)}
            />
            <Text style={[styles.statusText, { color: getStatusColor(item.status) }]}>
              {String(item.status).charAt(0).toUpperCase() + String(item.status).slice(1)}
            </Text>
          </View>
        </View>

        {/* Restaurant Name */}
        {item.restaurantName && (
          <Text style={styles.restaurantName}>{item.restaurantName}</Text>
        )}

        {/* Order Items Summary */}
        {item.items && Array.isArray(item.items) && item.items.length > 0 && (
          <View style={styles.itemsSummary}>
            <View style={styles.itemsList}>
              {item.items.slice(0, 3).map((i, idx) => {
                // Safety check for each item
                if (!i) return null;
                return (
                  <View key={idx} style={styles.itemRow}>
                    {i.imageUrl ? (
                      <Image source={{ uri: i.imageUrl }} style={styles.itemImage} />
                    ) : (
                      <View style={styles.itemImagePlaceholder}>
                        <Text style={styles.itemImagePlaceholderText}>🍽️</Text>
                      </View>
                    )}
                    <View style={styles.itemRowInfo}>
                      <Text style={styles.itemName}>{i.name || 'Item'}</Text>
                      <Text style={styles.itemQuantity}>x{i.quantity || 1}</Text>
                    </View>
                  </View>
                );
              })}
            </View>
            {item.items.length > 3 && (
              <Text style={styles.moreItemsText}>+{item.items.length - 3} more items</Text>
            )}
          </View>
        )}

        {/* Order Total */}
        <View style={styles.orderFooter}>
          <Text style={styles.totalLabel}>Total Amount:</Text>
          <Text style={styles.totalAmount}>AFN {Number(item.totalAmount || 0).toFixed(2)}</Text>
        </View>

        {/* View Details Button */}
        <TouchableOpacity
          style={styles.viewDetailsButton}
          onPress={() => router.push(`/order-details?orderId=${item.id}`)}
        >
          <Text style={styles.viewDetailsText}>View Details</Text>
          <Ionicons name="chevron-forward" size={16} color={Colors.primary} />
        </TouchableOpacity>
      </TouchableOpacity>
    );
  };

  if (!isReady || isLoading) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={Colors.primary} />
          <Text style={styles.loadingText}>Loading orders...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!session) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.loadingContainer}>
          <Ionicons name="log-in-outline" size={48} color={Colors.textSecondary} />
          <Text style={styles.loadingText}>Please log in to view your orders</Text>
          <TouchableOpacity
            style={styles.loginButton}
            onPress={() => {
              try {
                router.push('/(auth)/sign-in');
              } catch (error) {
                console.error('[UserOrders] Navigation error:', error);
              }
            }}
          >
            <Text style={styles.loginButtonText}>Sign In</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      {/* Offline Indicator */}
      <OfflineIndicator />

      {/* Sync Status Notification */}
      <SyncStatusNotification />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => {
            try {
              router.back();
            } catch (error) {
              console.error('[UserOrders] Navigation error:', error);
            }
          }}
        >
          <Ionicons name="arrow-back" size={24} color={Colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>My Orders</Text>
        <View style={styles.placeholder} />
      </View>

      {/* Orders List */}
      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={Colors.primary} />
          <Text style={styles.loadingText}>Loading your orders...</Text>
        </View>
      ) : error ? (
        <View style={styles.errorContainer}>
          <Ionicons name="alert-circle-outline" size={48} color={Colors.error} />
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity style={styles.retryButton} onPress={loadOrders}>
            <Text style={styles.retryButtonText}>Retry</Text>
          </TouchableOpacity>
        </View>
      ) : orders.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Ionicons name="bag-remove-outline" size={64} color={Colors.textSecondary} />
          <Text style={styles.emptyTitle}>No orders yet</Text>
          <Text style={styles.emptySubtitle}>
            Start ordering from your favorite restaurants!
          </Text>
          <TouchableOpacity
            style={styles.browseButton}
            onPress={() => {
              try {
                router.push('/(tabs)/menu');
              } catch (error) {
                console.error('[UserOrders] Navigation error:', error);
              }
            }}
          >
            <Text style={styles.browseButtonText}>Browse Menu</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={displayedOrders}
          renderItem={renderOrderItem}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          ListFooterComponent={
            !showAllOrders && orders.length > 4 ? (
              <TouchableOpacity
                style={styles.showAllButton}
                onPress={() => setShowAllOrders(true)}
              >
                <Text style={styles.showAllButtonText}>Show All Orders ({orders.length})</Text>
                <Ionicons name="chevron-down" size={20} color={Colors.primary} />
              </TouchableOpacity>
            ) : null
          }
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              colors={[Colors.primary]}
              tintColor={Colors.primary}
            />
          }
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    backgroundColor: Colors.surface,
    ...Shadow.sm,
  },
  backButton: {
    padding: Spacing.sm,
  },
  headerTitle: {
    fontSize: Typography.fontSize.xl,
    fontWeight: Typography.fontWeight.bold,
    color: Colors.textPrimary,
  },
  placeholder: {
    width: 40,
  },
  listContent: {
    padding: Spacing.md,
  },
  orderCard: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    marginBottom: Spacing.md,
    ...Shadow.md,
  },
  orderHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.sm,
  },
  orderInfo: {
    flex: 1,
  },
  orderNumber: {
    fontSize: Typography.fontSize.md,
    fontWeight: Typography.fontWeight.bold,
    color: Colors.textPrimary,
  },
  orderDate: {
    fontSize: Typography.fontSize.sm,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    borderRadius: BorderRadius.md,
    gap: 4,
  },
  statusText: {
    fontSize: Typography.fontSize.xs,
    fontWeight: Typography.fontWeight.semibold,
  },
  restaurantName: {
    fontSize: Typography.fontSize.md,
    fontWeight: Typography.fontWeight.semibold,
    color: Colors.textPrimary,
    marginBottom: Spacing.sm,
  },
  itemsSummary: {
    marginBottom: Spacing.sm,
  },
  itemsList: {
    gap: Spacing.xs,
  },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  itemImage: {
    width: 40,
    height: 40,
    borderRadius: BorderRadius.md,
    backgroundColor: Colors.background,
  },
  itemImagePlaceholder: {
    width: 40,
    height: 40,
    borderRadius: BorderRadius.md,
    backgroundColor: Colors.background,
    justifyContent: 'center',
    alignItems: 'center',
  },
  itemImagePlaceholderText: {
    fontSize: 20,
  },
  itemRowInfo: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  itemName: {
    fontSize: Typography.fontSize.sm,
    color: Colors.textPrimary,
    flex: 1,
  },
  itemQuantity: {
    fontSize: Typography.fontSize.sm,
    color: Colors.textSecondary,
    fontWeight: Typography.fontWeight.medium,
  },
  moreItemsText: {
    fontSize: Typography.fontSize.xs,
    color: Colors.textSecondary,
    marginTop: Spacing.xs,
  },
  itemsCount: {
    fontSize: Typography.fontSize.sm,
    color: Colors.textSecondary,
  },
  itemNames: {
    fontSize: Typography.fontSize.sm,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  orderFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: Spacing.sm,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  totalLabel: {
    fontSize: Typography.fontSize.sm,
    color: Colors.textSecondary,
  },
  totalAmount: {
    fontSize: Typography.fontSize.lg,
    fontWeight: Typography.fontWeight.bold,
    color: Colors.primary,
  },
  viewDetailsButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: Spacing.sm,
    paddingVertical: Spacing.sm,
  },
  viewDetailsText: {
    fontSize: Typography.fontSize.sm,
    color: Colors.primary,
    fontWeight: Typography.fontWeight.semibold,
    marginRight: 4,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.xl,
  },
  loadingText: {
    fontSize: Typography.fontSize.md,
    color: Colors.textSecondary,
    marginTop: Spacing.md,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.xl,
  },
  errorText: {
    fontSize: Typography.fontSize.md,
    color: Colors.error,
    marginTop: Spacing.md,
    textAlign: 'center',
  },
  retryButton: {
    marginTop: Spacing.lg,
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.md,
    backgroundColor: Colors.primary,
    borderRadius: BorderRadius.md,
  },
  retryButtonText: {
    color: Colors.white,
    fontSize: Typography.fontSize.md,
    fontWeight: Typography.fontWeight.semibold,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.xl,
  },
  emptyTitle: {
    fontSize: Typography.fontSize.xl,
    fontWeight: Typography.fontWeight.bold,
    color: Colors.textPrimary,
    marginTop: Spacing.lg,
  },
  emptySubtitle: {
    fontSize: Typography.fontSize.md,
    color: Colors.textSecondary,
    marginTop: Spacing.sm,
    textAlign: 'center',
  },
  browseButton: {
    marginTop: Spacing.xl,
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.md,
    backgroundColor: Colors.primary,
    borderRadius: BorderRadius.md,
  },
  browseButtonText: {
    color: Colors.white,
    fontSize: Typography.fontSize.md,
    fontWeight: Typography.fontWeight.semibold,
  },
  loginButton: {
    marginTop: Spacing.lg,
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.md,
    backgroundColor: Colors.primary,
    borderRadius: BorderRadius.md,
  },
  loginButtonText: {
    color: Colors.white,
    fontSize: Typography.fontSize.md,
    fontWeight: Typography.fontWeight.semibold,
  },
  showAllButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.lg,
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.md,
    marginTop: Spacing.sm,
    borderWidth: 1,
    borderColor: Colors.border,
    gap: Spacing.sm,
  },
  showAllButtonText: {
    color: Colors.primary,
    fontSize: Typography.fontSize.md,
    fontWeight: Typography.fontWeight.semibold,
  },
});
