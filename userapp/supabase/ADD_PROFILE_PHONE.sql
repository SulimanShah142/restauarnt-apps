-- Run this in the Supabase SQL editor before releasing the phone sign-in update.
-- Existing profiles are retained; phone numbers are optional for existing accounts.
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS phone text;

-- Clean up the failed unique-index attempt if PostgreSQL left its invalid index behind.
DROP INDEX IF EXISTS public.profiles_phone_unique;

-- Backfill numbers already captured in Supabase Auth metadata, including accounts
-- created before email confirmation was completed.
UPDATE public.profiles AS profile
SET phone = NULLIF(regexp_replace(auth_user.raw_user_meta_data->>'phone', '[[:space:]()-]', '', 'g'), '')
FROM auth.users AS auth_user
WHERE auth_user.id = profile.id
  AND COALESCE(profile.phone, '') = ''
  AND COALESCE(auth_user.raw_user_meta_data->>'phone', '') <> '';

-- Store the signup phone on profiles from the auth trigger, so confirmation-pending
-- accounts have a phone mapping before they can sign in.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, email, role, phone, created_at, updated_at)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', ''),
    COALESCE(NEW.email, ''),
    COALESCE(NEW.raw_user_meta_data->>'role', 'customer'),
    NULLIF(regexp_replace(COALESCE(NEW.raw_user_meta_data->>'phone', ''), '[[:space:]()-]', '', 'g'), ''),
    NOW(),
    NOW()
  )
  ON CONFLICT (id) DO UPDATE
    SET phone = COALESCE(NULLIF(public.profiles.phone, ''), EXCLUDED.phone),
        updated_at = NOW();
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'Profile creation failed for user %: %', NEW.id, SQLERRM;
  RETURN NEW;
END;
$$;

-- Create the auth trigger only if it is not already present.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname = 'on_auth_user_created'
      AND tgrelid = 'auth.users'::regclass
      AND NOT tgisinternal
  ) THEN
    CREATE TRIGGER on_auth_user_created
      AFTER INSERT ON auth.users
      FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
  END IF;
END;
$$;

-- Index phone lookups without rejecting shared numbers already present in profiles.
CREATE INDEX IF NOT EXISTS profiles_phone_lookup
  ON public.profiles (phone)
  WHERE phone IS NOT NULL AND phone <> '';
