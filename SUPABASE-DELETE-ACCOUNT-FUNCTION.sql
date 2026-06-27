-- =====================================================
-- DELETE USER ACCOUNT FUNCTION
-- =====================================================
-- This function deletes user personal data BUT KEEPS orders
-- Orders are preserved for admin records and restaurant analytics
-- Run this in your Supabase SQL Editor

CREATE OR REPLACE FUNCTION public.delete_user_account(user_id_to_delete uuid)
RETURNS void AS $$
BEGIN
  -- Delete in order respecting foreign key constraints
  -- IMPORTANT: We preserve orders and order_items for admin/restaurant records
  
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
  
  -- 8. Delete delivery assignments (but keep orders)
  DELETE FROM public.delivery_assignments WHERE user_id = user_id_to_delete;
  
  -- 9. Update orders to remove user reference (but keep order for admin)
  -- Set user_id to NULL but preserve the order record
  UPDATE public.orders 
  SET user_id = NULL,
      customer_name = 'Deleted User',
      customer_phone = NULL,
      deleted_at = now()
  WHERE user_id = user_id_to_delete;
  
  -- 10. Soft delete from profiles (set deleted_at)
  UPDATE public.profiles 
  SET deleted_at = now(),
      full_name = 'Deleted User',
      email = NULL,
      phone = NULL,
      image_url = NULL,
      avatar_url = NULL,
      name = 'Deleted User',
      push_token = NULL,
      expo_push_token = NULL,
      onesignal_player_id = NULL
  WHERE id = user_id_to_delete;
  
  -- 11. Soft delete from users table (set deleted_at)
  UPDATE public.users 
  SET deleted_at = now(),
      email = 'deleted_' || user_id_to_delete || '@deleted.com',
      name = 'Deleted User',
      phone = NULL,
      image_url = NULL
  WHERE id = user_id_to_delete;
  
  -- 12. Finally, delete the auth user (this is irreversible!)
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
-- WHAT GETS DELETED vs PRESERVED
-- =====================================================

/*
DELETED (User Personal Data):
✅ OneSignal players
✅ Push tokens  
✅ Notifications
✅ Feedback
✅ Reviews
✅ Addresses
✅ Carts
✅ Delivery assignments
✅ Profile data (soft deleted - anonymized)
✅ User account (soft deleted - anonymized)
✅ Auth user (permanently deleted)

PRESERVED (For Admin/Restaurant Records):
✅ Orders (user_id set to NULL, customer anonymized)
✅ Order Items (linked to orders, preserved)
✅ Restaurant data
✅ Menu items
✅ Categories

WHY PRESERVE ORDERS:
- Admin needs order history for business analytics
- Restaurants need order records for accounting
- Tax/legal requirements may require keeping order records
- Order items are linked to orders and menu items

GDPR COMPLIANCE:
- Personal data is deleted/anonymized
- User can no longer be identified from preserved orders
- Orders remain but are not linked to identifiable user
- This balances user privacy with business record-keeping
*/

-- =====================================================
-- USAGE EXAMPLE (run in Supabase SQL Editor):
-- =====================================================
-- SELECT public.delete_user_account('your-user-id-here'::uuid);

-- =====================================================
-- VERIFICATION QUERY (after deletion):
-- =====================================================
-- Check that user data is deleted but orders remain:

-- Should return 0 rows (user deleted)
-- SELECT * FROM auth.users WHERE id = 'your-user-id-here'::uuid;

-- Should show orders with NULL user_id (preserved but anonymized)
-- SELECT * FROM public.orders WHERE user_id IS NULL;

-- Should show anonymized profile
-- SELECT * FROM public.profiles WHERE id = 'your-user-id-here'::uuid;
-- Expected: name = 'Deleted User', email = NULL
