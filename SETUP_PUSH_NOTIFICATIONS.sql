-- =====================================================
-- PUSH NOTIFICATIONS SETUP - COMPLETE SYSTEM
-- =====================================================
-- Run this ONCE in Supabase SQL Editor
-- This sets up background push notifications (works when app is closed)
-- =====================================================

-- 1. Enable extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA extensions;

-- 2. Create push_tokens table
CREATE TABLE IF NOT EXISTS public.push_tokens (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  expo_push_token text NOT NULL,
  app_type text NOT NULL DEFAULT 'user' CHECK (app_type IN ('user', 'admin', 'delivery')),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(user_id, expo_push_token)
);

-- Enable RLS
ALTER TABLE public.push_tokens ENABLE ROW LEVEL SECURITY;

-- Drop old policies
DROP POLICY IF EXISTS "Users can insert own tokens" ON public.push_tokens;
DROP POLICY IF EXISTS "Users can view own tokens" ON public.push_tokens;
DROP POLICY IF EXISTS "Service role can manage tokens" ON public.push_tokens;

-- Create policies
CREATE POLICY "Users can insert own tokens" ON public.push_tokens FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can view own tokens" ON public.push_tokens FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Service role can manage tokens" ON public.push_tokens FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_push_tokens_user_id ON public.push_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_push_tokens_app_type ON public.push_tokens(app_type);

-- 3. Create notification handler function
CREATE OR REPLACE FUNCTION public.handle_push_notification()
RETURNS trigger AS $$
DECLARE
  push_token_record record;
  notification_title text;
  notification_body text;
  notification_data jsonb;
  response record;
  edge_function_url text := 'https://gjyipzhhgxgumgbnpikg.supabase.co/functions/v1/send-push-notification';
  service_role_key text := 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdqeWlwemhoZ3hndW1nYm5waWtnIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MDM5NjcyOSwiZXhwIjoyMDg1OTcyNzI5fQ.VhVMt-4UeQzjiCHd7G4hr-TaLpuMv5lBE8Fxj_He4Fg';
BEGIN
  -- Handle orders
  IF TG_TABLE_NAME = 'orders' THEN
    IF TG_OP = 'INSERT' THEN
      -- Notify admins
      FOR push_token_record IN SELECT pt.expo_push_token FROM push_tokens pt INNER JOIN admins a ON pt.user_id = a.user_id WHERE a.is_active = true AND pt.app_type = 'admin' LOOP
        SELECT * INTO response FROM net.http_post(url := edge_function_url, headers := jsonb_build_object('Content-Type', 'application/json', 'Authorization', 'Bearer ' || service_role_key), body := jsonb_build_object('push_token', push_token_record.expo_push_token, 'title', '🔔 New Order', 'body', format('Order #%s - AFG %s', NEW.order_number, NEW.total_amount), 'data', jsonb_build_object('type', 'new_order', 'order_id', NEW.id, 'order_number', NEW.order_number)), timeout_milliseconds := 5000);
      END LOOP;
      
      -- Notify user
      IF NEW.user_id IS NOT NULL THEN
        FOR push_token_record IN SELECT expo_push_token FROM push_tokens WHERE user_id = NEW.user_id AND app_type = 'user' LOOP
          SELECT * INTO response FROM net.http_post(url := edge_function_url, headers := jsonb_build_object('Content-Type', 'application/json', 'Authorization', 'Bearer ' || service_role_key), body := jsonb_build_object('push_token', push_token_record.expo_push_token, 'title', '✅ Order Placed', 'body', format('Your order #%s', NEW.order_number), 'data', jsonb_build_object('type', 'order_placed', 'order_id', NEW.id)), timeout_milliseconds := 5000);
        END LOOP;
      END IF;
    END IF;
    
    -- Status change
    IF TG_OP = 'UPDATE' AND OLD.status IS DISTINCT FROM NEW.status THEN
      IF NEW.user_id IS NOT NULL THEN
        FOR push_token_record IN SELECT expo_push_token FROM push_tokens WHERE user_id = NEW.user_id AND app_type = 'user' LOOP
          SELECT * INTO response FROM net.http_post(url := edge_function_url, headers := jsonb_build_object('Content-Type', 'application/json', 'Authorization', 'Bearer ' || service_role_key), body := jsonb_build_object('push_token', push_token_record.expo_push_token, 'title', '📦 Order Update', 'body', format('Order #%s: %s', NEW.order_number, NEW.status), 'data', jsonb_build_object('type', 'order_status_changed', 'order_id', NEW.id, 'new_status', NEW.status)), timeout_milliseconds := 5000);
        END LOOP;
      END IF;
    END IF;
    
  -- Handle delivery_assignments
  ELSIF TG_TABLE_NAME = 'delivery_assignments' THEN
    IF TG_OP = 'INSERT' AND NEW.delivery_person_id IS NOT NULL THEN
      FOR push_token_record IN SELECT pt.expo_push_token FROM push_tokens pt WHERE pt.user_id = (SELECT user_id FROM delivery_persons WHERE id = NEW.delivery_person_id) AND pt.app_type = 'delivery' LOOP
        SELECT * INTO response FROM net.http_post(url := edge_function_url, headers := jsonb_build_object('Content-Type', 'application/json', 'Authorization', 'Bearer ' || service_role_key), body := jsonb_build_object('push_token', push_token_record.expo_push_token, 'title', '🚴 New Delivery', 'body', format('Order #%s', NEW.order_id), 'data', jsonb_build_object('type', 'new_assignment', 'assignment_id', NEW.id)), timeout_milliseconds := 5000);
      END LOOP;
    END IF;
  END IF;
  
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. Create triggers
DROP TRIGGER IF EXISTS trigger_order_notifications ON public.orders;
CREATE TRIGGER trigger_order_notifications AFTER INSERT OR UPDATE ON public.orders FOR EACH ROW EXECUTE FUNCTION public.handle_push_notification();

DROP TRIGGER IF EXISTS trigger_delivery_notifications ON public.delivery_assignments;
CREATE TRIGGER trigger_delivery_notifications AFTER INSERT ON public.delivery_assignments FOR EACH ROW EXECUTE FUNCTION public.handle_push_notification();

-- 5. Verify
SELECT '✅ SETUP COMPLETE!' as status;
SELECT tablename FROM pg_tables WHERE tablename = 'push_tokens';
SELECT trigger_name FROM information_schema.triggers WHERE trigger_name IN ('trigger_order_notifications', 'trigger_delivery_notifications');
