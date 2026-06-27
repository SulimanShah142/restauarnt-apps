// lib/advertisement-service.ts
import { supabase } from './supabase';

export interface Advertisement {
  id: string;
  restaurant_id: string; // TEXT type to match restaurants.id
  title: string;
  description: string;
  image_url?: string;
  is_active: boolean;
  priority: number;
  start_date: string;
  end_date?: string;
  created_by?: string;
  created_at: string;
  updated_at: string;
  restaurant_name?: string;
  restaurant_image_url?: string; // Add restaurant image
}

export const advertisementService = {
  // Get active advertisements ordered by priority
  getActiveAdvertisements: async (): Promise<Advertisement[]> => {
    try {
      const today = new Date().toISOString().split('T')[0]; // Just the date part for comparison

      console.log('[Advertisements] Fetching active ads, today:', today);

      const { data, error } = await supabase
        .from('advertisements')
        .select(`
          *,
          restaurants (
            id,
            name,
            image_url
          )
        `)
        .eq('is_active', true)
        .lte('start_date', today)
        .or(`end_date.is.null,end_date.gte.${today}`)
        .order('priority', { ascending: false }) as { data: any; error: any };

      if (error) {
        console.error('[Advertisements] Error fetching:', error);
        // Try fetching without date filters to debug
        console.log('[Advertisements] Trying without date filters...');
        const { data: fallbackData, error: fallbackError } = await supabase
          .from('advertisements')
          .select(`
            *,
            restaurants (
              id,
              name
            )
          `)
          .eq('is_active', true)
          .order('priority', { ascending: false });

        if (fallbackError) {
          console.error('[Advertisements] Fallback fetch also failed:', fallbackError);
          throw new Error(`Supabase error: ${error.message}`);
        }

        console.log('[Advertisements] Fallback fetch returned:', fallbackData?.length || 0, 'ads');
        if (fallbackData && fallbackData.length > 0) {
          console.log('[Advertisements] First ad (no date filter):', JSON.stringify(fallbackData[0], null, 2));
        }

        // Filter expired ads from fallback - only return non-expired ads
        const today = new Date().toISOString().split('T')[0];
        const filteredFallback = (fallbackData || []).filter((ad: any) => {
          // Check if ad has started
          const started = ad.start_date <= today;
          // Check if ad is not expired (no end_date or end_date >= today)
          const notExpired = !ad.end_date || ad.end_date >= today;
          return started && notExpired;
        });

        console.log('[Advertisements] Fallback: filtered from', fallbackData?.length, 'to', filteredFallback.length, 'non-expired ads');

        const transformedFallback = filteredFallback.map((ad: any) => ({
          ...ad,
          restaurant_name: ad.restaurants?.name || null,
          restaurant_image_url: ad.restaurants?.image_url || null,
          restaurants: undefined
        }));
        return transformedFallback;
      }

      if (!data || data.length === 0) {
        console.log('[Advertisements] No active advertisements found with date filters');
        // Try without date filters
        console.log('[Advertisements] Trying without date filters...');
        const { data: allActiveData, error: allActiveError } = await supabase
          .from('advertisements')
          .select(`
            *,
            restaurants (
              id,
              name
            )
          `)
          .eq('is_active', true)
          .order('priority', { ascending: false });

        if (!allActiveError && allActiveData && allActiveData.length > 0) {
          console.log('[Advertisements] Found', allActiveData.length, 'active ads (ignoring dates)');
          console.log('[Advertisements] First ad:', JSON.stringify(allActiveData[0], null, 2));

          // Filter expired ads - only return non-expired
          const today = new Date().toISOString().split('T')[0];
          const filteredData = allActiveData.filter((ad: any) => {
            const started = ad.start_date <= today;
            const notExpired = !ad.end_date || ad.end_date >= today;
            return started && notExpired;
          });

          console.log('[Advertisements] Filtered from', allActiveData.length, 'to', filteredData.length, 'non-expired ads');

          const transformedData = filteredData.map((ad: any) => ({
            ...ad,
            restaurant_name: ad.restaurants?.name || null,
            restaurant_image_url: ad.restaurants?.image_url || null,
            restaurants: undefined
          }));
          return transformedData;
        }

        return [];
      }

      console.log('[Advertisements] Fetched ads with date filters:', data.length, 'items');
      console.log('[Advertisements] First ad:', JSON.stringify(data[0], null, 2));

      // Transform the data to include restaurant name from nested relation
      const transformedData = data.map((ad: any) => ({
        ...ad,
        restaurant_name: ad.restaurants?.name || null,
        restaurants: undefined // Remove nested object to avoid confusion
      }));

      return transformedData;
    } catch (error: any) {
      console.error('[Advertisements] Error in getActiveAdvertisements:', error);
      // Don't throw, return empty array
      return [];
    }
  },

  // Get advertisement by ID
  getAdvertisementById: async (id: string): Promise<Advertisement | null> => {
    try {
      const { data, error } = await supabase
        .from('advertisements')
        .select(`
          *,
          restaurants(name)
        `)
        .eq('id', id)
        .single() as { data: any; error: any };

      if (error) {
        if (error.code === 'PGRST116') { // Record not found
          return null;
        }
        // console.error('Error fetching advertisement:', error);
        throw new Error(`Supabase error: ${error.message}`);
      }

      return {
        ...data,
        restaurant_name: data.restaurants?.name
      };
    } catch (error) {
      // console.error('Error in getAdvertisementById:', error);
      throw error;
    }
  },

  // Create a new advertisement (for admin use)
  createAdvertisement: async (
    restaurantId: string,
    title: string,
    description: string,
    imageUrl?: string,
    priority: number = 0,
    isActive: boolean = true,
    startDate?: string,
    endDate?: string
  ): Promise<Advertisement> => {
    try {
      const { data, error } = await supabase
        .from('advertisements')
        .insert([{
          restaurant_id: restaurantId,
          title,
          description,
          image_url: imageUrl,
          is_active: isActive,
          priority,
          start_date: startDate || new Date().toISOString(),
          end_date: endDate || null
        }] as any)
        .select()
        .single() as { data: any; error: any };

      if (error) {
        // console.error('Error creating advertisement:', error);
        throw new Error(`Supabase error: ${error.message}`);
      }

      return data;
    } catch (error) {
      // console.error('Error in createAdvertisement:', error);
      throw error;
    }
  },

  // Update an advertisement (for admin use)
  updateAdvertisement: async (
    id: string,
    updates: Partial<Advertisement>
  ): Promise<Advertisement> => {
    try {
      const { data, error } = await (supabase
        .from('advertisements')
        .update(updates as any)
        .eq('id', id)
        .select()
        .single() as { data: any; error: any });

      if (error) {
        // console.error('Error updating advertisement:', error);
        throw new Error(`Supabase error: ${error.message}`);
      }

      return data;
    } catch (error) {
      // console.error('Error in updateAdvertisement:', error);
      throw error;
    }
  },

  // Delete an advertisement (for admin use)
  deleteAdvertisement: async (id: string): Promise<boolean> => {
    try {
      const { error } = await supabase
        .from('advertisements')
        .delete()
        .eq('id', id);

      if (error) {
        // console.error('Error deleting advertisement:', error);
        throw new Error(`Supabase error: ${error.message}`);
      }

      return true;
    } catch (error) {
      // console.error('Error in deleteAdvertisement:', error);
      throw error;
    }
  }
};