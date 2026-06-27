import { supabase } from './supabase';

/**
 * @param tableName - 'restaurants' | 'menu_items' | 'categories'
 * @param id - The UUID of the record
 * @param imageUrl - The full public URL stored in the DB
 */
export const deleteRecord = async (tableName: string, id: string, imageUrl?: string | null) => {
  try {

    // CASCADE DELETE: Handle child records first
    if (tableName === 'restaurants') {
      
      // Step 1: Delete menu items belonging to this restaurant
      const { error: menuItemsError } = await supabase
        .from('menu_items')
        .delete()
        .eq('restaurant_id', id);
      
      if (menuItemsError) {
        console.error('DELETE RECORD - Error deleting menu items:', menuItemsError);
      }

      // Step 2: Delete menu categories belonging to this restaurant
      const { error: categoriesError } = await supabase
        .from('menu_categories')
        .delete()
        .eq('restaurant_id', id);

      if (categoriesError) {
        console.error('DELETE RECORD - Error deleting categories:', categoriesError);
      }
    }

    if (tableName === 'menu_categories') {
      // Delete menu items belonging to this category
      const { error: menuItemsError } = await supabase
        .from('menu_items')
        .delete()
        .eq('menu_category_id', id);

      if (menuItemsError) {
        console.error('DELETE RECORD - Error deleting menu items:', menuItemsError);
      }
    }

    // 1. EXTRACT THE PATH CORRECTLY AND DELETE FROM STORAGE (if exists)
    if (imageUrl && imageUrl.includes('zootzoot/')) {
      const filePath = imageUrl.split('zootzoot/')[1]; // Gets everything AFTER 'zootzoot/'

      if (filePath) {
        const { error: storageError } = await supabase.storage
          .from('zootzoot')
          .remove([filePath]);

        if (storageError) {
          console.error("DELETE RECORD - Storage Error:", storageError.message);
        }
      }
    }

    // 2. HARD DELETE the record FIRST (permanent deletion) - DO NOT soft delete first!
    const { error: dbError, count } = await supabase
      .from(tableName)
      .delete()
      .eq('id', id);

    if (dbError) {
      console.error("DELETE RECORD - Database error:", dbError);
      console.error("DELETE RECORD - Error details:", dbError.message, dbError.details, dbError.hint);
      console.error("DELETE RECORD - Error code:", dbError.code);
      throw dbError;
    }


    // 3. Wait for Supabase to propagate the deletion
    await new Promise(resolve => setTimeout(resolve, 3000));

    return { success: true };

  } catch (error: any) {
    console.error("DELETE RECORD - ❌ Delete operation failed:", error);
    console.error("DELETE RECORD - Error message:", error.message);
    console.error("DELETE RECORD - Error stack:", error.stack);
    return { success: false, error: error.message };
  }
};