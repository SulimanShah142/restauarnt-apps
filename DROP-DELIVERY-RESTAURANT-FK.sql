-- =====================================================
-- Drop foreign key on delivery_assignments.restaurant_id
-- Run this in Supabase SQL Editor
-- =====================================================

-- Drop the FK constraint on delivery_assignments -> restaurants
ALTER TABLE public.delivery_assignments 
DROP CONSTRAINT IF EXISTS delivery_assignments_restaurant_id_fkey;

-- Verify it was dropped
SELECT conname 
FROM pg_constraint 
WHERE conrelid = 'public.delivery_assignments'::regclass 
  AND contype = 'f'
  AND conname = 'delivery_assignments_restaurant_id_fkey';
-- Should return ZERO rows if successfully dropped
