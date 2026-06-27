import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, Modal, TextInput, Alert, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { RequireAuth } from '@/contexts/AuthContext';
import { localDbService } from '@/lib/local-db-service';
import { adminApiService } from '@/lib/admin-api-service';
import { supabase } from '@/lib/supabase';

interface Feedback {
  id: string;
  user_id: string;
  title: string;
  comment: string;
  rating: number;
  is_resolved: boolean;
  created_at: string;
  user_email?: string;
  user_name?: string;
}

function FeedbackManagementContent() {
  const [feedbacks, setFeedbacks] = useState<Feedback[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalVisible, setModalVisible] = useState(false);
  const [selectedFeedback, setSelectedFeedback] = useState<Feedback | null>(null);
  const [replyText, setReplyText] = useState('');

  useEffect(() => {
    loadFeedbacks();
  }, []);

  const loadFeedbacks = async () => {
    try {
      setLoading(true);

      // Fetch feedback from local database (synced with Supabase)
      const data = await localDbService.feedback.getAll();

      // Fetch user profiles separately and merge
      const processedFeedbacks = await Promise.all(data.map(async (fb) => {
        let user_email = '';
        let user_name = '';
        
        if (fb.user_id) {
          try {
            const { data: userData } = await supabase
              .from('users')
              .select('email, name')
              .eq('id', fb.user_id)
              .single();
            
            if (userData) {
              user_email = userData.email || '';
              user_name = userData.name || '';
            }
          } catch (err) {
            console.warn('[Feedback] Could not fetch user data for:', fb.user_id);
          }
        }
        
        return {
          ...fb,
          user_email,
          user_name,
        };
      }));

      setFeedbacks(processedFeedbacks);
    } catch (error: any) {
      console.error('[Feedback] ❌ Error loading feedbacks:', error);
      Alert.alert('Error', 'Failed to load feedbacks: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenFeedback = (feedback: Feedback) => {
    setSelectedFeedback(feedback);
    setReplyText('');
    setModalVisible(true);
  };

  const handleResolveFeedback = async () => {
    if (!selectedFeedback) return;

    try {
      // Update feedback using admin API service
      await adminApiService.feedback.update(selectedFeedback.id, { is_resolved: true });

      // Update local state
      setFeedbacks(prev => 
        prev.map(fb => 
          fb.id === selectedFeedback.id ? { ...fb, is_resolved: true } : fb
        )
      );

      Alert.alert('Success', 'Feedback marked as resolved');
      setModalVisible(false);
    } catch (error: any) {
      console.error('Error resolving feedback:', error);
      Alert.alert('Error', 'Failed to resolve feedback: ' + error.message);
    }
  };

  const renderFeedbackItem = ({ item }: { item: Feedback }) => (
    <TouchableOpacity
      style={[
        styles.feedbackItem,
        item.is_resolved && styles.resolvedFeedback
      ]}
      onPress={() => handleOpenFeedback(item)}
    >
      <View style={styles.feedbackHeader}>
        <Text style={styles.feedbackTitle}>{item.title}</Text>
        <Text style={styles.feedbackRating}>{'★'.repeat(item.rating || 0)}{'☆'.repeat(5 - (item.rating || 0))}</Text>
      </View>
      
      <Text style={styles.feedbackPreview} numberOfLines={2}>
        {item.comment}
      </Text>
      
      <View style={styles.feedbackMeta}>
        <Text style={styles.feedbackUser}>
          {item.user_name || item.user_email || 'Anonymous User'}
        </Text>
        <Text style={styles.feedbackDate}>
          {new Date(item.created_at).toLocaleDateString()}
        </Text>
      </View>
      
      {item.is_resolved && (
        <Text style={styles.resolvedTag}>Resolved</Text>
      )}
    </TouchableOpacity>
  );

  if (loading) {
    return (
      <View style={styles.container}>
        <Text>Loading feedbacks...</Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.title}>User Feedback</Text>
      
      {feedbacks.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>No feedback received yet</Text>
        </View>
      ) : (
        <FlatList
          data={feedbacks}
          renderItem={renderFeedbackItem}
          keyExtractor={item => item.id}
          contentContainerStyle={styles.listContent}
        />
      )}

      Feedback Detail Modal
      <Modal
        animationType="slide"
        transparent={false}
        visible={modalVisible}
        onRequestClose={() => setModalVisible(false)}
      >
        <SafeAreaView style={styles.modalContainer}>
          {selectedFeedback && (
            <ScrollView style={styles.modalContent}>
              <Text style={styles.modalTitle}>{selectedFeedback.title}</Text>
              
              <View style={styles.modalUserInfo}>
                <Text style={styles.modalUserText}>
                  From: {selectedFeedback.user_name || selectedFeedback.user_email || 'Anonymous User'}
                </Text>
                <Text style={styles.modalDateText}>
                  {new Date(selectedFeedback.created_at).toLocaleString()}
                </Text>
              </View>
              
              <View style={styles.ratingContainer}>
                <Text style={styles.ratingLabel}>Rating: </Text>
                <Text style={styles.ratingStars}>
                  {'★'.repeat(selectedFeedback.rating || 0)}{'☆'.repeat(5 - (selectedFeedback.rating || 0))}
                </Text>
              </View>
              
              <Text style={styles.modalComment}>{selectedFeedback.comment}</Text>
              
              <View style={styles.modalActions}>
                {!selectedFeedback.is_resolved ? (
                  <TouchableOpacity
                    style={[styles.actionButton, styles.resolveButton]}
                    onPress={handleResolveFeedback}
                  >
                    <Text style={styles.actionButtonText}>Mark as Resolved</Text>
                  </TouchableOpacity>
                ) : (
                  <Text style={styles.resolvedStatus}>This feedback has been resolved</Text>
                )}
                
                <TouchableOpacity
                  style={[styles.actionButton, styles.closeButton]}
                  onPress={() => setModalVisible(false)}
                >
                  <Text style={styles.actionButtonText}>Close</Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
          )}
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    padding: 16,
    textAlign: 'center',
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  listContent: {
    padding: 16,
  },
  feedbackItem: {
    backgroundColor: '#fff',
    padding: 16,
    marginBottom: 12,
    borderRadius: 8,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.22,
    shadowRadius: 2.22,
  },
  resolvedFeedback: {
    opacity: 0.7,
  },
  feedbackHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  feedbackTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    flex: 1,
    color: '#333',
  },
  feedbackRating: {
    fontSize: 16,
  },
  feedbackPreview: {
    fontSize: 14,
    color: '#666',
    marginBottom: 8,
  },
  feedbackMeta: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  feedbackUser: {
    fontSize: 12,
    color: '#888',
    fontStyle: 'italic',
  },
  feedbackDate: {
    fontSize: 12,
    color: '#aaa',
  },
  resolvedTag: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: '#4CAF50',
    color: '#fff',
    paddingVertical: 2,
    paddingHorizontal: 6,
    borderRadius: 10,
    fontSize: 10,
    fontWeight: 'bold',
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
  modalContainer: {
    flex: 1,
    backgroundColor: '#fff',
  },
  modalContent: {
    flex: 1,
    padding: 16,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 16,
    color: '#333',
  },
  modalUserInfo: {
    marginBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
    paddingBottom: 12,
  },
  modalUserText: {
    fontSize: 14,
    color: '#666',
    marginBottom: 4,
  },
  modalDateText: {
    fontSize: 12,
    color: '#999',
  },
  ratingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  ratingLabel: {
    fontSize: 14,
    color: '#333',
    marginRight: 8,
  },
  ratingStars: {
    fontSize: 18,
  },
  modalComment: {
    fontSize: 16,
    lineHeight: 24,
    color: '#333',
    marginBottom: 24,
    padding: 12,
    backgroundColor: '#f9f9f9',
    borderRadius: 6,
  },
  modalActions: {
    marginTop: 'auto',
    zIndex: 10,
  },
  actionButton: {
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 12,
    zIndex: 10,
    elevation: 2,
  },
  resolveButton: {
    backgroundColor: '#4CAF50',
    zIndex: 10,
    elevation: 2,
  },
  closeButton: {
    backgroundColor: '#C41E26',
    zIndex: 10,
    elevation: 2,
  },
  actionButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  resolvedStatus: {
    textAlign: 'center',
    padding: 16,
    backgroundColor: '#e8f5e8',
    borderRadius: 8,
    marginBottom: 12,
    color: '#4CAF50',
    fontWeight: 'bold',
  },
});

export default function FeedbackManagement() {
  return (
    <RequireAuth>
      <FeedbackManagementContent />
    </RequireAuth>
  );
}