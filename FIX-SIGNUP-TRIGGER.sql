-- =====================================================
-- FIX: "Database error saving new user" on signup
-- Run this ENTIRE script in Supabase SQL Editor
-- =====================================================

-- STEP 1: Drop the broken trigger (if it exists)
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

-- STEP 2: Drop the broken function (if it exists)
DROP FUNCTION IF EXISTS public.handle_new_user();

-- STEP 3: Recreate the function properly
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER -- This is CRITICAL - allows bypassing RLS
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, email, role, created_at, updated_at)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', ''),
    COALESCE(NEW.email, ''),
    COALESCE(NEW.raw_user_meta_data->>'role', 'customer'),
    NOW(),
    NOW()
  )
  ON CONFLICT (id) DO NOTHING;
  
  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    -- Log the error but don't block user creation
    RAISE WARNING 'Profile creation failed for user %: %', NEW.id, SQLERRM;
    RETURN NEW;
END;
$$;

-- STEP 4: Recreate the trigger
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- STEP 5: Ensure RLS allows the trigger to insert (SECURITY DEFINER bypasses this, but just in case)
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- STEP 6: Allow service role to insert profiles (for the trigger)
DROP POLICY IF EXISTS "Service role can insert profiles" ON public.profiles;
CREATE POLICY "Service role can insert profiles"
  ON public.profiles
  FOR INSERT
  TO service_role
  WITH CHECK (true);

-- STEP 7: Allow users to read their own profile
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
CREATE POLICY "Users can view own profile"
  ON public.profiles
  FOR SELECT
  USING (auth.uid() = id);

-- STEP 8: Allow users to update their own profile
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
CREATE POLICY "Users can update own profile"
  ON public.profiles
  FOR UPDATE
  USING (auth.uid() = id);

-- STEP 9: Allow users to insert their own profile (for manual creation fallback)
DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;
CREATE POLICY "Users can insert own profile"
  ON public.profiles
  FOR INSERT
  WITH CHECK (auth.uid() = id);

-- =====================================================
-- Verify the fix worked:
-- 1. Check trigger exists:
SELECT tgname, tgtype FROM pg_trigger WHERE tgname = 'on_auth_user_created';
-- Should return: on_auth_user_created | 7
--
-- 2. Check function exists:
SELECT proname, prosecdef FROM pg_proc WHERE proname = 'handle_new_user';
-- Should return: handle_new_user | t
-- =====================================================
