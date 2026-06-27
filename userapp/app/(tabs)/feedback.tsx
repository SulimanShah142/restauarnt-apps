import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert, ScrollView, FlatList, Dimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { supabase } from '../../lib/supabase';
import { Session } from '@supabase/supabase-js';
import { feedbackServiceWithCache, type Feedback } from '../../lib/feedback-service-with-cache';
import { OfflineIndicator } from '../../components/OfflineIndicator';
import { SyncStatusNotification } from '../../components/SyncStatusNotification';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Spacing, Typography, BorderRadius } from '../../lib/design-system';

const FeedbackScreen = () => {
  const router = useRouter();
  const [session, setSession] = useState<Session | null>(null);
  const [isReady, setIsReady] = useState(false);
  const [feedback, setFeedback] = useState({
    subject: '',
    message: '',
    rating: 0,
  });
  const [loading, setLoading] = useState(false);
  const [isLargeDevice, setIsLargeDevice] = useState(false);
  const [userFeedback, setUserFeedback] = useState<Feedback[]>([]);
  const [feedbackLoading, setFeedbackLoading] = useState(false);

  // Load session on mount
  useEffect(() => {
    const loadSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      setSession(session);
      setIsReady(true);
    };
    loadSession();

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, _session) => {
      setSession(_session);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    // Check if device is large (width > 768px, typical tablet size)
    const { width } = Dimensions.get('window');
    setIsLargeDevice(width > 768);
  }, []);

  // Load user's feedback history
  useEffect(() => {
    if (session?.user?.id && isReady) {
      loadUserFeedback();
    }
  }, [session?.user?.id, isReady]);

  const loadUserFeedback = async () => {
    if (!session?.user?.id) return;
    
    setFeedbackLoading(true);
    try {
      const feedbackList = await feedbackServiceWithCache.getUserFeedback(session.user.id);
      setUserFeedback(feedbackList);
    } catch (error) {
      // console.error('[Feedback] ❌ Error loading feedback:', error);
    } finally {
      setFeedbackLoading(false);
    }
  };

  if (!isReady) {
    return (
      <View style={styles.container}>
        <Text>Loading...</Text>
      </View>
    );
  }

  if (!session) {
    return (
      <View style={styles.container}>
        <Text>Please log in to submit feedback</Text>
      </View>
    );
  }

  const handleSendFeedback = async () => {
    if (!feedback.subject.trim() || !feedback.message.trim()) {
      Alert.alert('Validation Error', 'Please fill in both subject and message fields.');
      return;
    }

    if (feedback.rating === 0) {
      Alert.alert('Validation Error', 'Please select a rating.');
      return;
    }

    setLoading(true);

    try {

      if (!session?.user?.id) {
        throw new Error('User ID not found in session');
      }

      // Use cached feedback service
      const result = await feedbackServiceWithCache.submitFeedback(
        session.user.id,
        feedback.subject,
        feedback.message,
        feedback.rating
      );

      if (!result) {
        throw new Error('Failed to submit feedback');
      }


      // Reset form immediately
      setFeedback({
        subject: '',
        message: '',
        rating: 0,
      });

      // Reload feedback list
      await loadUserFeedback();

      // Show success alert
      Alert.alert(
        'Feedback Sent!',
        'Thank you for your feedback. We appreciate your input.',
        [
          {
            text: 'OK',
            onPress: () => {
              try {
                router.back(); // Go back to previous screen
              } catch (error) {
                console.error('[Feedback] Navigation error:', error);
              }
            }
          }
        ]
      );
    } catch (error: any) {
      // console.error('[Feedback] Error submitting feedback:', error);
      Alert.alert('Error', `Failed to submit feedback: ${error.message || 'Please try again.'}`);
    } finally {
      setLoading(false);
    }
  };

  const handleRatingPress = (rating: number) => {
    setFeedback(prev => ({
      ...prev,
      rating
    }));
  };

  // Dynamic styles based on device size
  const dynamicStyles = StyleSheet.create({
    title: {
      fontSize: isLargeDevice ? 28 : 24,
      fontWeight: 'bold',
      textAlign: 'center',
      flex: 1,
    },
    label: {
      fontSize: isLargeDevice ? 18 : 16,
      fontWeight: '600',
      marginVertical: isLargeDevice ? 12 : 8,
      color: '#333',
    },
    input: {
      backgroundColor: 'white',
      borderWidth: 1,
      borderColor: '#ddd',
      borderRadius: 8,
      padding: isLargeDevice ? 16 : 12,
      fontSize: isLargeDevice ? 18 : 16,
      marginBottom: isLargeDevice ? 20 : 16,
    },
    textArea: {
      height: isLargeDevice ? 150 : 120,
      textAlignVertical: 'top',
    },
    star: {
      fontSize: isLargeDevice ? 36 : 30,
      marginHorizontal: isLargeDevice ? 8 : 5,
    },
    sendButton: {
      backgroundColor: '#C41E26',
      padding: isLargeDevice ? 20 : 16,
      borderRadius: 8,
      alignItems: 'center',
      marginTop: isLargeDevice ? 30 : 20,
    },
    sendButtonText: {
      color: 'white',
      fontSize: isLargeDevice ? 20 : 18,
      fontWeight: 'bold',
    },
  });

  return (
    <SafeAreaView style={styles.safeArea}>
      {/* Offline Indicator */}
      <OfflineIndicator />

      {/* Sync Status Notification */}
      <SyncStatusNotification />

      <ScrollView contentContainerStyle={styles.scrollViewContent}>
        <View style={styles.container}>
          {/* Back Button */}
          <View style={styles.backButtonContainer}>
            <TouchableOpacity style={styles.backButton} onPress={() => {
              try {
                router.back();
              } catch (error) {
                console.error('[Feedback] Navigation error:', error);
              }
            }}>
              <Ionicons name="arrow-back" size={24} color="#333" />
              <Text style={styles.backButtonText}>Back</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.header}>
            <Text style={dynamicStyles.title}>Send Feedback</Text>
          </View>

          {/* Feedback History */}
          {userFeedback.length > 0 && (
            <View style={styles.feedbackHistory}>
              <Text style={dynamicStyles.label}>Your Feedback History</Text>
              <FlatList
                data={userFeedback}
                keyExtractor={(item : any) => item.id}
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.feedbackList}
                renderItem={({ item }: any) => (
                  <View style={styles.feedbackCard}>
                    <View style={styles.feedbackHeader}>
                      <Text style={styles.feedbackTitle}>{item.title}</Text>
                      <View style={[styles.feedbackRating, { backgroundColor: getRatingColor(item.rating) + '20' }]}>
                        <Text style={[styles.feedbackRatingText, { color: getRatingColor(item.rating) }]}>
                          {'★'.repeat(item.rating)}{'☆'.repeat(5 - item.rating)}
                        </Text>
                      </View>
                    </View>
                    <Text style={styles.feedbackComment} numberOfLines={2}>{item.comment}</Text>
                    <Text style={styles.feedbackDate}>{formatDate(item.createdAt)}</Text>
                    {item.isResolved && (
                      <View style={styles.resolvedBadge}>
                        <Ionicons name="checkmark-circle" size={14} color="#4CAF50" />
                        <Text style={styles.resolvedText}>Resolved</Text>
                      </View>
                    )}
                  </View>
                )}
              />
            </View>
          )}

          <Text style={dynamicStyles.label}>Subject *</Text>
          <TextInput
            style={dynamicStyles.input}
            placeholder="Enter feedback subject"
            placeholderTextColor="#999"
            value={feedback.subject}
            onChangeText={(text : any) => setFeedback(prev => ({ ...prev, subject: text }))}
          />

          <Text style={dynamicStyles.label}>Message *</Text>
          <TextInput
            style={[dynamicStyles.input, dynamicStyles.textArea]}
            placeholder="Enter your feedback message"
            placeholderTextColor="#999"
            value={feedback.message}
            onChangeText={(text : any) => setFeedback(prev => ({ ...prev, message: text }))}
            multiline
            numberOfLines={5}
          />

          <Text style={dynamicStyles.label}>Rating</Text>
          <View style={styles.ratingContainer}>
            {[1, 2, 3, 4, 5].map((star) => (
              <TouchableOpacity
                key={star}
                onPress={() => handleRatingPress(star)}
              >
                <Text style={[dynamicStyles.star, feedback.rating >= star ? styles.filledStar : styles.emptyStar]}>
                  ★
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <TouchableOpacity
            style={dynamicStyles.sendButton}
            onPress={handleSendFeedback}
            disabled={loading}
          >
            <Text style={dynamicStyles.sendButtonText}>
              {loading ? 'Sending...' : 'Send Feedback'}
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

// Helper functions
const getRatingColor = (rating: number) => {
  if (rating >= 4) return '#4CAF50';
  if (rating >= 3) return '#FF9800';
  return '#C41E26';
};

const formatDate = (dateString: Date) => {
  const date = new Date(dateString);
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
    padding: 16,
  },
  backButtonContainer: {
    marginBottom: 16,
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: '#fff',
    borderRadius: 8,
    alignSelf: 'flex-start',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  backButtonText: {
    fontSize: 16,
    color: '#333',
    marginLeft: 8,
    fontWeight: '600',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  feedbackHistory: {
    marginBottom: 20,
  },
  feedbackList: {
    paddingHorizontal: 8,
  },
  feedbackCard: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 16,
    marginRight: 12,
    width: 280,
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
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    flex: 1,
    marginRight: 8,
  },
  feedbackRating: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  feedbackRatingText: {
    fontSize: 14,
    fontWeight: '600',
  },
  feedbackComment: {
    fontSize: 14,
    color: '#666',
    marginBottom: 8,
    lineHeight: 20,
  },
  feedbackDate: {
    fontSize: 12,
    color: '#999',
  },
  resolvedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#eee',
  },
  resolvedText: {
    fontSize: 12,
    color: '#4CAF50',
    marginLeft: 4,
    fontWeight: '600',
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    marginVertical: 8,
    color: '#333',
  },
  input: {
    backgroundColor: 'white',
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    marginBottom: 16,
  },
  textArea: {
    height: 120,
    textAlignVertical: 'top',
  },
  ratingContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginVertical: 16,
  },
  star: {
    fontSize: 30,
    marginHorizontal: 5,
  },
  filledStar: {
    color: '#FFD700',
  },
  emptyStar: {
    color: '#ccc',
  },
  sendButton: {
    backgroundColor: '#C41E26',
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 20,
  },
  sendButtonText: {
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
  },
  safeArea: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  scrollViewContent: {
    flexGrow: 1,
    paddingBottom: 20,
  },
});

export default FeedbackScreen;