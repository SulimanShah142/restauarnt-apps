import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, Alert, ActivityIndicator, Switch } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '@/lib/supabase';
import DrawerLayout from '@/components/DrawerLayout';

export default function AdminFeedbackScreen() {
  const [feedbacks, setFeedbacks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    loadFeedbacks();
  }, []);

  const loadFeedbacks = async () => {
    try {
      const { data, error } = await supabase
        .from('feedback')
        .select(`
          *,
          users (email, user_metadata)
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;

      setFeedbacks(data || []);
    } catch (error: any) {
      console.error('Error loading feedback:', error);
      Alert.alert('Error', 'Failed to load feedback');
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadFeedbacks();
    setRefreshing(false);
  };

  const toggleResolved = async (feedbackId: string, currentStatus: boolean) => {
    try {
      const { error } = await supabase
        .from('feedback')
        .update({ is_resolved: !currentStatus })
        .eq('id', feedbackId);

      if (error) throw error;

      // Update local state
      setFeedbacks(prev => 
        prev.map(fb => 
          fb.id === feedbackId ? { ...fb, is_resolved: !currentStatus } : fb
        )
      );
    } catch (error: any) {
      console.error('Error updating feedback status:', error);
      Alert.alert('Error', 'Failed to update feedback status');
    }
  };

  const renderFeedbackItem = ({ item }: { item: any }) => (
    <View style={styles.feedbackCard}>
      <View style={styles.feedbackHeader}>
        <Text style={styles.feedbackTitle}>{item.title}</Text>
        <View style={[styles.statusBadge, item.is_resolved ? styles.resolved : styles.pending]}>
          <Text style={styles.statusText}>
            {item.is_resolved ? 'Resolved' : 'Pending'}
          </Text>
        </View>
      </View>
      
      <Text style={styles.feedbackUser}>
        From: {item.users?.email || 'Unknown User'}
      </Text>
      
      <View style={styles.ratingContainer}>
        <Text style={styles.ratingLabel}>Rating: </Text>
        {[...Array(5)].map((_, i) => (
          <Text 
            key={i} 
            style={[styles.star, i < item.rating ? styles.filledStar : styles.emptyStar]}
          >
            ★
          </Text>
        ))}
      </View>
      
      <Text style={styles.feedbackComment}>{item.comment}</Text>
      
      <View style={styles.feedbackFooter}>
        <Text style={styles.feedbackDate}>
          {new Date(item.created_at).toLocaleDateString()}
        </Text>
        <View style={styles.toggleContainer}>
          <Text style={styles.toggleLabel}>
            {item.is_resolved ? 'Mark as Pending' : 'Mark Resolved'}
          </Text>
          <Switch
            value={item.is_resolved}
            onValueChange={() => toggleResolved(item.id, item.is_resolved)}
          />
        </View>
      </View>
    </View>
  );

  if (loading) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color="#C41E26" />
        <Text>Loading feedback...</Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>User Feedback</Text>
          <Text style={styles.subtitle}>{feedbacks.length} feedback(s)</Text>
        </View>

        {feedbacks.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>No feedback received yet</Text>
          </View>
        ) : (
          <FlatList
            data={feedbacks}
            renderItem={renderFeedbackItem}
            keyExtractor={(item) => item.id}
            refreshing={refreshing}
            onRefresh={onRefresh}
            contentContainerStyle={styles.listContent}
          />
        )}
      </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
    padding: 16,
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
    marginTop: 4,
  },
  listContent: {
    padding: 16,
  },
  feedbackCard: {
    backgroundColor: 'white',
    borderRadius: 8,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  feedbackHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  feedbackTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    flex: 1,
    marginRight: 10,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  resolved: {
    backgroundColor: '#e8f5e9',
  },
  pending: {
    backgroundColor: '#fff3e0',
  },
  statusText: {
    fontSize: 12,
    fontWeight: 'bold',
  },
  feedbackUser: {
    fontSize: 14,
    color: '#666',
    marginBottom: 8,
  },
  ratingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  ratingLabel: {
    fontSize: 14,
    color: '#333',
    marginRight: 5,
  },
  star: {
    fontSize: 16,
    marginHorizontal: 1,
  },
  filledStar: {
    color: '#FFD700',
  },
  emptyStar: {
    color: '#ccc',
  },
  feedbackComment: {
    fontSize: 16,
    color: '#333',
    lineHeight: 20,
    marginBottom: 12,
  },
  feedbackFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#eee',
  },
  feedbackDate: {
    fontSize: 12,
    color: '#999',
  },
  toggleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  toggleLabel: {
    fontSize: 12,
    color: '#666',
    marginRight: 8,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 16,
    color: '#666',
  },
});