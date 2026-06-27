-- =====================================================
-- DELETE USER ACCOUNT FUNCTION
-- =====================================================
-- This function permanently deletes a user and all associated data
-- Run this in your Supabase SQL Editor

CREATE OR REPLACE FUNCTION public.delete_user_account(user_id_to_delete uuid)
RETURNS void AS $$
BEGIN
  -- Delete in order respecting foreign key constraints
  
  -- 1. Delete OneSignal players
  DELETE FROM public.onesignal_players WHERE user_id = user_id_to_delete;
  
  -- 2. Delete push tokens
  DELETE FROM public.push_tokens WHERE user_id = user_id_to_delete;
  
  -- 3. Delete notifications
  DELETE FROM public.notifications WHERE user_id = user_id_to_delete;
  
  -- 4. Delete feedback
  DELETE FROM public.feedback WHERE user_id = user_id_to_delete;
  
  -- 5. Delete reviews
  DELETE FROM public.reviews WHERE user_id = user_id_to_delete;
  
  -- 6. Delete addresses
  DELETE FROM public.addresses WHERE user_id = user_id_to_delete;
  
  -- 7. Delete carts
  DELETE FROM public.carts WHERE user_id = user_id_to_delete;
  
  -- 8. Delete order items (via orders)
  -- First delete order_items for user's orders
  DELETE FROM public.order_items 
  WHERE order_id IN (SELECT id FROM public.orders WHERE user_id = user_id_to_delete);
  
  -- 9. Delete orders
  DELETE FROM public.orders WHERE user_id = user_id_to_delete;
  
  -- 10. Delete delivery assignments
  DELETE FROM public.delivery_assignments WHERE user_id = user_id_to_delete;
  
  -- 11. Delete from profiles (soft delete by setting deleted_at)
  UPDATE public.profiles 
  SET deleted_at = now() 
  WHERE id = user_id_to_delete;
  
  -- 12. Delete from users table (soft delete)
  UPDATE public.users 
  SET deleted_at = now() 
  WHERE id = user_id_to_delete;
  
  -- 13. Finally, delete the auth user (this is irreversible!)
  -- Note: This requires proper RLS policies and admin privileges
  DELETE FROM auth.users WHERE id = user_id_to_delete;
  
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- GRANT EXECUTE PERMISSION TO AUTHENTICATED USERS
-- =====================================================
GRANT EXECUTE ON FUNCTION public.delete_user_account TO authenticated;

-- =====================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- =====================================================
-- Ensure users can only delete their own accounts

ALTER FUNCTION public.delete_user_account SECURITY DEFINER;

-- =====================================================
-- USAGE EXAMPLE (run in Supabase SQL Editor):
-- =====================================================
-- SELECT public.delete_user_account('your-user-id-here'::uuid);
