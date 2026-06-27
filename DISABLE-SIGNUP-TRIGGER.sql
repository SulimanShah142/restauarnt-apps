-- =====================================================
-- FIX: "Database error saving new user" on signup
-- This completely DISABLES the trigger and cleans up
-- Run this in Supabase SQL Editor
-- =====================================================

-- STEP 1: Drop ALL triggers on auth.users
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP TRIGGER IF EXISTS create_profile_on_signup ON auth.users;
DROP TRIGGER IF EXISTS handle_new_user ON auth.users;
DROP TRIGGER IF EXISTS on_user_created ON auth.users;

-- STEP 2: Drop ALL related functions
DROP FUNCTION IF EXISTS public.handle_new_user();
DROP FUNCTION IF EXISTS public.create_profile_for_user();
DROP FUNCTION IF EXISTS public.create_user_profile();
DROP FUNCTION IF EXISTS public.on_user_created();

-- STEP 3: Verify all triggers are gone
SELECT tgname, tgrelid::regclass as table_name FROM pg_trigger 
WHERE tgrelid = 'auth.users'::regclass;
-- Should return EMPTY - no triggers on auth.users
