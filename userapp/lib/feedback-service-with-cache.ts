// Feedback Service with Local Cache Support
// Syncs from Supabase first, then uses local cache for offline access

import { supabase } from './supabase';
import { isOnline } from './sync-utils';
import { getDatabase } from '../db';
import { Platform } from 'react-native';

export interface Feedback {
  id: string;
  userId: string;
  title: string;
  comment: string;
  rating: number;
  isResolved: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export const feedbackServiceWithCache = {
  /**
   * Get user feedback - Sync from Supabase first, then use local cache
   */
  getUserFeedback: async (userId: string): Promise<Feedback[]> => {

    try {
      // STEP 1: Check if online
      const online = await isOnline();
      
      if (online) {

        // STEP 2: Fetch from Supabase and sync to local DB
        const { data, error } = await supabase
          .from('feedback')
          .select('*')
          .eq('user_id', userId)
          .order('created_at', { ascending: false }) as { data: any; error: any };

        if (error) {
          // console.error('[FeedbackService] Error fetching from Supabase:', error);
          // Fall back to local cache if Supabase fails
          return await getFeedbackFromLocalCache(userId);
        }

        const feedback = data || [];

        // STEP 3: Sync to local database for offline access
        if (Platform.OS !== 'web') {
          try {
            await syncFeedbackToLocalDB(userId, feedback);
          } catch (syncError) {
            // console.error('[FeedbackService] Error syncing to local DB:', syncError);
          }
        }

        // STEP 4: Load from local DB (now synced)
        return await getFeedbackFromLocalCache(userId);
      } else {
        // Offline - use local cache only
        return await getFeedbackFromLocalCache(userId);
      }
    } catch (error) {
      // console.error('[FeedbackService] Error fetching feedback:', error);
      // Last resort - try local cache
      return await getFeedbackFromLocalCache(userId);
    }
  },

  /**
   * Submit new feedback - saves to Supabase first, then cache
   */
  submitFeedback: async (
    userId: string,
    title: string,
    comment: string,
    rating: number
  ): Promise<Feedback | null> => {

    try {
      // Insert into Supabase
      const { data, error } = await supabase
        .from('feedback')
        .insert({
          user_id: userId,
          title,
          comment,
          rating,
          is_resolved: false,
        } as any)
        .select()
        .single() as { data: any; error: any };

      if (error) {
        // console.error('[FeedbackService] Error submitting feedback:', error);
        throw error;
      }

      const feedback: Feedback = {
        id: data.id,
        userId: data.user_id,
        title: data.title,
        comment: data.comment,
        rating: data.rating,
        isResolved: data.is_resolved,
        createdAt: new Date(data.created_at),
        updatedAt: new Date(data.updated_at),
      };

      // Cache locally
      const db = await getDatabase();
      await cacheFeedbackItem(db, feedback);

      return feedback;
    } catch (error) {
      // console.error('[FeedbackService] Error submitting feedback:', error);
      return null;
    }
  },

  /**
   * Get feedback by ID - Sync from Supabase first, then use local cache
   */
  getFeedbackById: async (feedbackId: string): Promise<Feedback | null> => {

    try {
      // Check if online
      const online = await isOnline();
      
      if (online) {
        // Fetch from Supabase
        const { data, error } = await supabase
          .from('feedback')
          .select('*')
          .eq('id', feedbackId)
          .single() as { data: any; error: any };

        if (error || !data) {
          // console.error('[FeedbackService] Error fetching feedback from Supabase:', error);
          // Try cache as fallback
          return await getFeedbackByIdFromCache(feedbackId);
        }

        // Sync to local DB
        if (Platform.OS !== 'web') {
          try {
            const db = await getDatabase();
            await db.saveFeedback({
              id: data.id,
              user_id: data.user_id,
              title: data.title,
              comment: data.comment,
              rating: data.rating,
              is_resolved: data.is_resolved,
              created_at: data.created_at,
              updated_at: data.updated_at,
            });
          } catch (cacheError) {
            // console.error('[FeedbackService] Error caching feedback:', cacheError);
          }
        }

        // Return from local DB (now synced)
        return await getFeedbackByIdFromCache(feedbackId);
      } else {
        // Offline - use cache
        return await getFeedbackByIdFromCache(feedbackId);
      }
    } catch (error) {
      // console.error('[FeedbackService] Error fetching feedback:', error);
      return await getFeedbackByIdFromCache(feedbackId);
    }
  },
};

/**
 * Get feedback by ID from cache (fallback)
 */
async function getFeedbackByIdFromCache(feedbackId: string): Promise<Feedback | null> {
  try {
    const db = await getDatabase();
    const result = await db.getFeedbackById(feedbackId);

    if (!result) {
      return null;
    }

    return {
      id: result.id,
      userId: result.user_id,
      title: result.title,
      comment: result.comment,
      rating: result.rating,
      isResolved: result.is_resolved,
      createdAt: new Date(result.created_at),
      updatedAt: new Date(result.updated_at),
    };
  } catch (error) {
    // console.error('[FeedbackService] Error loading feedback from cache:', error);
    return null;
  }
}

/**
 * Sync feedback from Supabase to local DB
 */
async function syncFeedbackToLocalDB(userId: string, feedback: any[]) {
  try {
    // Only sync on native platforms
    if (Platform.OS === 'web') {
      return;
    }

    const db = await getDatabase();
    
    // Clear existing feedback for this user first
    await clearFeedbackForUser(db, userId);
    
    // Insert all feedback
    for (const item of feedback) {
      await db.saveFeedback({
        id: item.id,
        user_id: item.user_id,
        title: item.title,
        comment: item.comment,
        rating: item.rating,
        is_resolved: item.is_resolved,
        created_at: item.created_at,
        updated_at: item.updated_at,
      });
    }
  } catch (error) {
    // console.error('[FeedbackService] Error syncing feedback:', error);
  }
}

/**
 * Clear feedback for a specific user (before syncing new data)
 */
async function clearFeedbackForUser(db: any, userId: string) {
  try {
    // Only clear on native platforms
    if (Platform.OS === 'web') {
      return;
    }

    // Get all feedback for this user and delete them
    const existingFeedback = await db.getFeedbackByUserId(userId);
    for (const item of existingFeedback) {
      // We'll need to add a delete method or use raw SQL
      // For now, we'll just overwrite with new data
    }
  } catch (error) {
    // console.error('[FeedbackService] Error clearing feedback:', error);
  }
}

/**
 * Get feedback from local cache (fallback when offline)
 */
async function getFeedbackFromLocalCache(userId: string): Promise<Feedback[]> {
  try {
    const db = await getDatabase();
    const result = await db.getFeedbackByUserId(userId);

    return result.map((item: any) => ({
      id: item.id,
      userId: item.user_id,
      title: item.title,
      comment: item.comment,
      rating: item.rating,
      isResolved: item.is_resolved,
      createdAt: new Date(item.created_at),
      updatedAt: new Date(item.updated_at),
    }));
  } catch (error) {
    // console.error('[FeedbackService] Error loading feedback from cache:', error);
    return [];
  }
}

/**
 * Cache a single feedback item
 */
async function cacheFeedbackItem(db: any, feedback: Feedback) {
  try {
    // Only cache on native platforms
    if (Platform.OS === 'web') {
      return;
    }

    // Use the new database method
    await db.saveFeedback({
      id: feedback.id,
      user_id: feedback.userId,
      title: feedback.title,
      comment: feedback.comment,
      rating: feedback.rating,
      is_resolved: feedback.isResolved,
      created_at: feedback.createdAt.toISOString(),
      updated_at: feedback.updatedAt.toISOString(),
    });
  } catch (error) {
    // console.error('[FeedbackService] Error caching feedback:', error);
  }
}
