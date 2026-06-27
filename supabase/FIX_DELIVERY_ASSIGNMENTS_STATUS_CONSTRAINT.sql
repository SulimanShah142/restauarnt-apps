-- =====================================================
-- FIX: Add 'cancelled' to delivery_assignments status check constraint
-- =====================================================

-- Drop the existing check constraint
ALTER TABLE delivery_assignments DROP CONSTRAINT IF EXISTS delivery_assignments_status_check;

-- Add new check constraint that includes 'cancelled' status
ALTER TABLE delivery_assignments 
ADD CONSTRAINT delivery_assignments_status_check 
CHECK (status IN ('pending', 'accepted', 'in_transit', 'delivered', 'cancelled'));

-- Verify the constraint was added
SELECT conname, pg_get_constraintdef(oid) as constraint_definition
FROM pg_constraint
WHERE conrelid = 'delivery_assignments'::regclass 
AND contype = 'c';

SELECT '✅ delivery_assignments status constraint updated to include cancelled!' as result;
