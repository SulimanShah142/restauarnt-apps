-- =====================================================
-- COMPLETE FIX: "Database error saving new user"
-- Run this ENTIRE script in Supabase SQL Editor
-- =====================================================

-- STEP 1: Find ALL user-created triggers on auth.users (skip system triggers)
SELECT tgname, tgrelid::regclass as table_name, proname as function_name
FROM pg_trigger t
JOIN pg_proc p ON t.tgfoid = p.oid
WHERE tgrelid = 'auth.users'::regclass
  AND tgname NOT LIKE 'RI_ConstraintTrigger%'
  AND tgname NOT LIKE 'pg_%'
  AND tgisinternal = false;

-- STEP 2: Drop ONLY user-created triggers (skip FK constraint triggers)
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN 
        SELECT tgname 
        FROM pg_trigger 
        WHERE tgrelid = 'auth.users'::regclass
          AND tgisinternal = false
          AND tgname NOT LIKE 'RI_ConstraintTrigger%'
          AND tgname NOT LIKE 'pg_%'
    LOOP
        EXECUTE format('DROP TRIGGER IF EXISTS %I ON auth.users', r.tgname);
        RAISE NOTICE 'Dropped trigger: %', r.tgname;
    END LOOP;
    RAISE NOTICE 'Done dropping triggers';
END $$;

-- STEP 3: Drop ALL functions that might be related
DROP FUNCTION IF EXISTS public.handle_new_user() CASCADE;
DROP FUNCTION IF EXISTS public.create_profile_for_user() CASCADE;
DROP FUNCTION IF EXISTS public.create_user_profile() CASCADE;
DROP FUNCTION IF EXISTS public.on_user_created() CASCADE;
DROP FUNCTION IF EXISTS public.on_auth_user_created() CASCADE;

-- STEP 4: Verify user triggers are gone
SELECT tgname FROM pg_trigger 
WHERE tgrelid = 'auth.users'::regclass 
  AND tgisinternal = false;
-- Should return ZERO rows

-- =====================================================
-- If triggers were dropped successfully, signup should now work.
-- If it still fails, go to Supabase Dashboard > Authentication > Settings
-- and turn OFF "Enable email confirmations" for testing.
-- =====================================================
