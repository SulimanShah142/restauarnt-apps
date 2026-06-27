-- =====================================================
-- ONE SIGNAL PUSH NOTIFICATIONS SETUP
-- =====================================================
-- Run this ONCE in Supabase SQL Editor
-- This sets up background push notifications using OneSignal
-- Works even when app is closed!
-- =====================================================

-- 1. Enable extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA extensions;

-- 2. Create onesignal_players table
CREATE TABLE IF NOT EXISTS public.onesignal_players (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  onesignal_player_id text NOT NULL,
  app_type text NOT NULL DEFAULT 'user' CHECK (app_type IN ('user', 'admin', 'delivery')),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(user_id, onesignal_player_id)
);

-- Enable RLS
ALTER TABLE public.onesignal_players ENABLE ROW LEVEL SECURITY;

-- Drop old policies
DROP POLICY IF EXISTS "Users can insert own tokens" ON public.onesignal_players;
DROP POLICY IF EXISTS "Users can view own tokens" ON public.onesignal_players;
DROP POLICY IF EXISTS "Service role can manage tokens" ON public.onesignal_players;

-- Create policies
CREATE POLICY "Users can insert own tokens" ON public.onesignal_players FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can view own tokens" ON public.onesignal_players FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Service role can manage tokens" ON public.onesignal_players FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_onesignal_players_user_id ON public.onesignal_players(user_id);
CREATE INDEX IF NOT EXISTS idx_onesignal_players_app_type ON public.onesignal_players(app_type);

-- 3. Create notification handler function
CREATE OR REPLACE FUNCTION public.handle_onesignal_notification()
RETURNS trigger AS $$
DECLARE
  response record;
  edge_function_url text := 'https://gjyipzhhgxgumgbnpikg.supabase.co/functions/v1/send-onesignal-notification';
  service_role_key text := 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdqeWlwemhoZ3hndW1nYm5waWtnIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MDM5NjcyOSwiZXhwIjoyMDg1OTcyNzI5fQ.VhVMt-4UeQzjiCHd7G4hr-TaLpuMv5lBE8Fxj_He4Fg';
  payload jsonb;
BEGIN
  -- Handle orders
  IF TG_TABLE_NAME = 'orders' THEN
    -- Build payload with both new and old record
    payload := jsonb_build_object(
      'record', to_jsonb(NEW),
      'old_record', to_jsonb(OLD),
      'table', TG_TABLE_NAME,
      'type', TG_OP
    );

    -- Call edge function
    SELECT * INTO response FROM net.http_post(
      url := edge_function_url,
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || service_role_key
      ),
      body := payload,
      timeout_milliseconds := 10000
    );

  -- Handle delivery_assignments
  ELSIF TG_TABLE_NAME = 'delivery_assignments' THEN
    -- Build payload
    payload := jsonb_build_object(
      'record', to_jsonb(NEW),
      'table', TG_TABLE_NAME,
      'type', TG_OP
    );

    -- Call edge function
    SELECT * INTO response FROM net.http_post(
      url := edge_function_url,
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || service_role_key
      ),
      body := payload,
      timeout_milliseconds := 10000
    );
  END IF;

  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. Create triggers
DROP TRIGGER IF EXISTS trigger_order_notifications ON public.orders;
CREATE TRIGGER trigger_order_notifications AFTER INSERT OR UPDATE ON public.orders FOR EACH ROW EXECUTE FUNCTION public.handle_onesignal_notification();

DROP TRIGGER IF EXISTS trigger_delivery_notifications ON public.delivery_assignments;
CREATE TRIGGER trigger_delivery_notifications AFTER INSERT ON public.delivery_assignments FOR EACH ROW EXECUTE FUNCTION public.handle_onesignal_notification();

-- 5. Verify
SELECT '✅ ONE SIGNAL SETUP COMPLETE!' as status;
SELECT tablename FROM pg_tables WHERE tablename = 'onesignal_players';
SELECT trigger_name FROM information_schema.triggers WHERE trigger_name IN ('trigger_order_notifications', 'trigger_delivery_notifications');
