-- =====================================================
-- Fix: Drop ALL foreign keys on delivery_assignments
-- Run this in Supabase SQL Editor
-- =====================================================

-- STEP 1: Drop ALL FK constraints (including the legacy one)
ALTER TABLE public.delivery_assignments DROP CONSTRAINT IF EXISTS delivery_assignments_order_id_fkey;
ALTER TABLE public.delivery_assignments DROP CONSTRAINT IF EXISTS delivery_assignments_delivery_person_id_fkey;
ALTER TABLE public.delivery_assignments DROP CONSTRAINT IF EXISTS delivery_assignments_user_id_fkey;
ALTER TABLE public.delivery_assignments DROP CONSTRAINT IF EXISTS delivery_assignments_restaurant_id_fkey;
ALTER TABLE public.delivery_assignments DROP CONSTRAINT IF EXISTS fk_delivery_assignments_delivery_person;

-- STEP 2: Verify all FK constraints are gone
SELECT conname as remaining_constraints
FROM pg_constraint
WHERE conrelid = 'public.delivery_assignments'::regclass
  AND contype = 'f';
-- Should return ZERO rows
