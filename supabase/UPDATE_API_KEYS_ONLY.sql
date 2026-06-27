-- =====================================================
-- COMPLETE NOTIFICATION FIX - ALL FUNCTIONS, TRIGGERS & TESTS
-- =====================================================

-- STEP 1: Drop ALL old triggers and functions (CASCADE removes dependencies)
DROP TRIGGER IF EXISTS notify_admins_new_order ON orders;
DROP TRIGGER IF EXISTS notify_users_order_status_change ON orders;
DROP TRIGGER IF EXISTS notify_delivery_assignment ON delivery_assignments;
DROP TRIGGER IF EXISTS notify_user_admin_on_pickup ON delivery_assignments;
DROP TRIGGER IF EXISTS notify_user_admin_on_delivered ON delivery_assignments;
DROP TRIGGER IF EXISTS notify_delivery_cancellation ON delivery_assignments;

DROP FUNCTION IF EXISTS notify_admins_new_order() CASCADE;
DROP FUNCTION IF EXISTS notify_users_order_status_change() CASCADE;
DROP FUNCTION IF EXISTS notify_delivery_assignment() CASCADE;
DROP FUNCTION IF EXISTS notify_user_admin_on_pickup() CASCADE;
DROP FUNCTION IF EXISTS notify_user_admin_on_delivered() CASCADE;
DROP FUNCTION IF EXISTS notify_delivery_cancellation() CASCADE;
DROP FUNCTION IF EXISTS send_onesignal_direct(text, text, uuid, text, text, text) CASCADE;
DROP FUNCTION IF EXISTS send_onesignal_direct_uuid(text, text, uuid, text, uuid, text) CASCADE;

SELECT '✅ Step 1: All old triggers and functions dropped!' as result;

-- STEP 2: Create send_onesignal_direct - queries ALL token sources
CREATE OR REPLACE FUNCTION send_onesignal_direct(
  p_title text,
  p_message text,
  p_order_id uuid,
  p_order_number text,
  p_user_type text,
  p_app_type text
)
RETURNS void AS $$
DECLARE
  l_onesignal_app_id TEXT;
  l_onesignal_api_key TEXT;
  l_player_ids TEXT[];
  l_user_id uuid;
BEGIN
  IF p_app_type = 'admin' THEN
    l_onesignal_app_id := '2665a069-40cb-4335-8af1-0f4d8b77aeea';
    l_onesignal_api_key := 'os_v2_app_ezs2a2kaznbtlcxrb5gyw55o5lvxw3weicce4pebmq5jtmyu7fpi56ficmcr7fr23xs7dsz2srzxffx4kmqc7jbw73n6j4hi2xt4nra';

    SELECT ARRAY_AGG(DISTINCT player_id)
    INTO l_player_ids
    FROM (
      SELECT onesignal_player_id AS player_id FROM onesignal_players WHERE app_type = 'admin' AND onesignal_player_id IS NOT NULL
      UNION
      SELECT onesignal_player_id AS player_id FROM admins WHERE onesignal_player_id IS NOT NULL AND is_active = true
    ) combined;

  ELSIF p_app_type = 'user' THEN
    l_onesignal_app_id := '38e20d47-839b-4944-8455-daf65977aaf9';
    l_onesignal_api_key := 'os_v2_app_hdra2r4dtneujbcv3l3fs55k7eourhifo63ufb4en4lfmptextciwwwbedrevmiayzmmufgamouelfuwcuspsav246una3n4wryzl5a';

    l_user_id := p_user_type::uuid;

    -- STRICT: Only get tokens for this SPECIFIC user_id
    -- Priority: profiles.onesignal_player_id (direct) > onesignal_players (by exact user_id match)
    SELECT ARRAY_AGG(DISTINCT player_id)
    INTO l_player_ids
    FROM (
      -- Direct token on profiles table (the user's own row)
      SELECT onesignal_player_id AS player_id
      FROM profiles
      WHERE id = l_user_id
        AND onesignal_player_id IS NOT NULL
        AND deleted_at IS NULL
      UNION
      -- Token from onesignal_players table, STRICTLY matched by user_id
      SELECT onesignal_player_id AS player_id
      FROM onesignal_players
      WHERE user_id = l_user_id
        AND app_type = 'user'
        AND onesignal_player_id IS NOT NULL
    ) combined;

    -- DEBUG: Log how many tokens were found for this user
    RAISE NOTICE '📱 User notification: user_id=%, tokens_found=%', l_user_id, COALESCE(array_length(l_player_ids, 1), 0);

  ELSIF p_app_type = 'delivery' THEN
    l_onesignal_app_id := 'da1609d1-cebc-47a1-9b0c-4d797997344c';
    l_onesignal_api_key := 'os_v2_app_3ilatuooxrd2dgymjv4xtfzujr2x2y7v6kfetdffai74pilmpclmsm3leyvnjecoqt3favq4cdztwajy7xa7wlgvnrec42szuelas5i';

    -- Try specific delivery person first
    BEGIN
      l_user_id := p_user_type::uuid;
      SELECT ARRAY_AGG(DISTINCT player_id)
      INTO l_player_ids
      FROM (
        SELECT onesignal_player_id AS player_id FROM onesignal_players WHERE user_id = l_user_id AND app_type = 'delivery' AND onesignal_player_id IS NOT NULL
        UNION
        SELECT onesignal_player_id AS player_id FROM delivery_persons WHERE user_id = l_user_id AND onesignal_player_id IS NOT NULL AND deleted_at IS NULL
      ) combined;
    EXCEPTION WHEN OTHERS THEN
      NULL;
    END;

    -- Fallback: ALL delivery persons
    IF l_player_ids IS NULL OR array_length(l_player_ids, 1) IS NULL THEN
      SELECT ARRAY_AGG(DISTINCT player_id)
      INTO l_player_ids
      FROM (
        SELECT onesignal_player_id AS player_id FROM onesignal_players WHERE app_type = 'delivery' AND onesignal_player_id IS NOT NULL
        UNION
        SELECT onesignal_player_id AS player_id FROM delivery_persons WHERE onesignal_player_id IS NOT NULL AND deleted_at IS NULL
      ) combined;
    END IF;

  ELSE
    RAISE NOTICE 'Invalid app_type: %', p_app_type;
    RETURN;
  END IF;

  IF l_player_ids IS NULL OR array_length(l_player_ids, 1) IS NULL THEN
    INSERT INTO notifications (title, message, data, app_type, created_at)
    VALUES (
      '⚠️ TRIGGER DEBUG: No tokens found',
      'app_type=' || p_app_type || ' user_type=' || COALESCE(p_user_type, 'null'),
      jsonb_build_object('query', 'onesignal_players + app tables'),
      p_app_type,
      now()
    );
    RETURN;
  END IF;

  PERFORM net.http_post(
    url := 'https://onesignal.com/api/v1/notifications',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Basic ' || l_onesignal_api_key
    ),
    body := jsonb_build_object(
      'app_id', l_onesignal_app_id,
      'include_player_ids', l_player_ids,
      'headings', jsonb_build_object('en', p_title),
      'contents', jsonb_build_object('en', p_message),
      'data', jsonb_build_object(
        'order_id', p_order_id::text,
        'order_number', p_order_number,
        'type', 'order_notification',
        'app_type', p_app_type
      ),
      'priority', 10
    ),
    timeout_milliseconds := 10000
  );

  RAISE NOTICE '✅ Sent to % player(s) in %', array_length(l_player_ids, 1), p_app_type;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION send_onesignal_direct_uuid(
  p_title text,
  p_message text,
  p_order_id uuid,
  p_order_number text,
  p_user_type uuid,
  p_app_type text
)
RETURNS void AS $$
BEGIN
  PERFORM send_onesignal_direct(
    p_title, p_message, p_order_id, p_order_number,
    p_user_type::text, p_app_type
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION send_onesignal_direct TO authenticated, anon, service_role;
GRANT EXECUTE ON FUNCTION send_onesignal_direct_uuid TO authenticated, anon, service_role;

SELECT '✅ Step 2: send_onesignal_direct function created!' as result;

-- =====================================================
-- TRIGGER 1: NEW ORDER → Notify ADMIN + USER
-- Fires when userapp checkout.tsx does: supabase.from('orders').insert(...)
-- =====================================================
CREATE OR REPLACE FUNCTION notify_admins_new_order()
RETURNS TRIGGER AS $$
BEGIN
  -- Notify ALL admins about the new order
  PERFORM send_onesignal_direct(
    '🔔 New Order Received!',
    'A new order has been placed',
    NEW.id, COALESCE(NEW.order_number, ''), 'admin', 'admin'
  );

  -- DEBUG: Log that trigger fired
  INSERT INTO notifications (title, message, data, app_type, created_at)
  VALUES (
    '✅ TRIGGER FIRED: New Order',
    'Order placed by user ' || COALESCE(NEW.user_id::text, 'unknown'),
    jsonb_build_object('order_id', NEW.id, 'order_number', COALESCE(NEW.order_number, ''), 'status', NEW.status),
    'admin',
    now()
  );

  -- Also notify the user who placed the order
  IF NEW.user_id IS NOT NULL THEN
    PERFORM send_onesignal_direct_uuid(
      '✅ Order Received',
      'Your order has been received',
      NEW.id, COALESCE(NEW.order_number, ''), NEW.user_id, 'user'
    );
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER notify_admins_new_order
  AFTER INSERT ON orders
  FOR EACH ROW
  EXECUTE FUNCTION notify_admins_new_order();

-- =====================================================
-- TRIGGER 2: ORDER STATUS CHANGE → Notify based on status
-- EXCLUDES statuses handled by delivery_assignments triggers (picked_up, delivered, on_the_way)
-- =====================================================
CREATE OR REPLACE FUNCTION notify_users_order_status_change()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    CASE NEW.status
      -- These are handled by the delivery_assignments trigger, NOT here
      WHEN 'picked_up' THEN
        NULL; -- Skip - handled by notify_user_admin_on_pickup
      WHEN 'on_the_way' THEN
        NULL; -- Skip - handled by delivery_assignments trigger
      WHEN 'delivered' THEN
        NULL; -- Skip - handled by notify_user_admin_on_delivered

      -- These are handled by the orders trigger
      WHEN 'confirmed' THEN
        PERFORM send_onesignal_direct_uuid(
          '✅ Order Confirmed',
          'Your order has been confirmed',
          NEW.id, COALESCE(NEW.order_number, ''), NEW.user_id, 'user'
        );
      WHEN 'preparing' THEN
        PERFORM send_onesignal_direct_uuid(
          '👨‍🍳 Order Preparing',
          'Your order is being prepared',
          NEW.id, COALESCE(NEW.order_number, ''), NEW.user_id, 'user'
        );
      WHEN 'ready' THEN
        PERFORM send_onesignal_direct_uuid(
          '📦 Order Ready',
          'Your order is ready for pickup',
          NEW.id, COALESCE(NEW.order_number, ''), NEW.user_id, 'user'
        );
        PERFORM send_onesignal_direct(
          '🚴 Delivery Available',
          'An order is ready for pickup',
          NEW.id, COALESCE(NEW.order_number, ''), 'delivery', 'delivery'
        );
      ELSE
        IF NEW.user_id IS NOT NULL THEN
          PERFORM send_onesignal_direct_uuid(
            '📋 Order Update',
            'Your order status: ' || NEW.status,
            NEW.id, COALESCE(NEW.order_number, ''), NEW.user_id, 'user'
          );
        END IF;
    END CASE;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER notify_users_order_status_change
  AFTER UPDATE ON orders
  FOR EACH ROW
  WHEN (OLD.status IS DISTINCT FROM NEW.status)
  EXECUTE FUNCTION notify_users_order_status_change();

SELECT '✅ Step 3: Orders table triggers created!' as result;

-- =====================================================
-- TRIGGER 3: NEW DELIVERY ASSIGNMENT → Notify SPECIFIC delivery person
-- Fires when admins-app INSERTs into delivery_assignments
-- =====================================================
CREATE OR REPLACE FUNCTION notify_delivery_assignment()
RETURNS TRIGGER AS $$
DECLARE
  order_record RECORD;
  delivery_player_ids TEXT[];
BEGIN
  -- Get order details
  SELECT o.order_number, o.total_amount
  INTO order_record
  FROM orders o WHERE o.id = NEW.order_id;

  -- Notify the SPECIFIC assigned delivery person
  IF NEW.delivery_person_id IS NOT NULL THEN
    -- Get ALL possible player IDs for this delivery person from BOTH tables
    SELECT ARRAY_AGG(DISTINCT player_id)
    INTO delivery_player_ids
    FROM (
      -- From onesignal_players table (via user_id)
      SELECT onesignal_player_id AS player_id
      FROM onesignal_players
      WHERE user_id = (SELECT user_id FROM delivery_persons WHERE id = NEW.delivery_person_id)
        AND app_type = 'delivery'
        AND onesignal_player_id IS NOT NULL
      UNION
      -- From delivery_persons table directly (by id)
      SELECT onesignal_player_id AS player_id
      FROM delivery_persons
      WHERE id = NEW.delivery_person_id
        AND onesignal_player_id IS NOT NULL
        AND deleted_at IS NULL
    ) combined;

    IF delivery_player_ids IS NOT NULL AND array_length(delivery_player_ids, 1) > 0 THEN
      -- Send directly to the specific delivery person
      PERFORM net.http_post(
        url := 'https://onesignal.com/api/v1/notifications',
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'Authorization', 'Basic os_v2_app_3ilatuooxrd2dgymjv4xtfzujr2x2y7v6kfetdffai74pilmpclmsm3leyvnjecoqt3favq4cdztwajy7xa7wlgvnrec42szuelas5i'
        ),
        body := jsonb_build_object(
          'app_id', 'da1609d1-cebc-47a1-9b0c-4d797997344c',
          'include_player_ids', delivery_player_ids,
          'headings', jsonb_build_object('en', '🚴 New Delivery Assigned!'),
          'contents', jsonb_build_object('en', 'Order #' || COALESCE(order_record.order_number, 'N/A') || ' - AFG ' || COALESCE(order_record.total_amount::text, '0')),
          'data', jsonb_build_object(
            'order_id', NEW.order_id::text,
            'order_number', COALESCE(order_record.order_number, 'N/A'),
            'type', 'delivery_assignment',
            'app_type', 'delivery',
            'delivery_person_id', NEW.delivery_person_id::text
          ),
          'priority', 10
        ),
        timeout_milliseconds := 10000
      );

      -- DEBUG: Log that trigger fired
      INSERT INTO notifications (title, message, data, app_type, created_at)
      VALUES (
        '✅ TRIGGER FIRED: Delivery Assigned',
        'New delivery assignment for delivery person ' || NEW.delivery_person_id::text || ' (' || array_length(delivery_player_ids, 1) || ' tokens found)',
        jsonb_build_object('order_id', NEW.order_id, 'delivery_person_id', NEW.delivery_person_id, 'token_count', array_length(delivery_player_ids, 1)),
        'delivery',
        now()
      );
    ELSE
      -- Fallback: notify ALL delivery persons
      PERFORM send_onesignal_direct(
        '🚴 New Delivery Assignment!',
        'A new delivery has been assigned',
        NEW.order_id, COALESCE(order_record.order_number, ''), 'delivery', 'delivery'
      );

      -- DEBUG
      INSERT INTO notifications (title, message, data, app_type, created_at)
      VALUES (
        '⚠️ TRIGGER: Delivery assigned (fallback)',
        'No specific tokens found for delivery person ' || NEW.delivery_person_id::text || ', sent to all',
        jsonb_build_object('order_id', NEW.order_id, 'delivery_person_id', NEW.delivery_person_id),
        'delivery',
        now()
      );
    END IF;
  ELSE
    -- No delivery person assigned yet, notify all
    PERFORM send_onesignal_direct(
      '🚴 Delivery Available!',
      'An order is ready for pickup',
      NEW.order_id, COALESCE(order_record.order_number, ''), 'delivery', 'delivery'
    );
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER notify_delivery_assignment
  AFTER INSERT ON delivery_assignments
  FOR EACH ROW
  EXECUTE FUNCTION notify_delivery_assignment();

-- =====================================================
-- TRIGGER 4: DELIVERY PICKED UP → Notify USER + ADMIN
-- Fires when deliverapp UPDATEs delivery_assignments.status to 'in_transit' or 'accepted'
-- =====================================================
CREATE OR REPLACE FUNCTION notify_user_admin_on_pickup()
RETURNS TRIGGER AS $$
DECLARE
  order_record RECORD;
BEGIN
  IF NEW.status NOT IN ('in_transit', 'accepted') THEN RETURN NEW; END IF;
  IF OLD.status = NEW.status THEN RETURN NEW; END IF;

  SELECT o.order_number, o.user_id INTO order_record
  FROM orders o WHERE o.id = NEW.order_id;

  IF order_record.user_id IS NOT NULL THEN
    PERFORM send_onesignal_direct_uuid(
      '🚴 Order Picked Up!',
      'Your order has been picked up',
      NEW.order_id, COALESCE(order_record.order_number, ''), order_record.user_id, 'user'
    );
  END IF;

  PERFORM send_onesignal_direct(
    '📦 Order Picked Up',
    'An order has been picked up by delivery',
    NEW.order_id, COALESCE(order_record.order_number, ''), 'admin', 'admin'
  );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER notify_user_admin_on_pickup
  AFTER UPDATE ON delivery_assignments
  FOR EACH ROW
  WHEN (OLD.status IS DISTINCT FROM NEW.status AND NEW.status IN ('in_transit', 'accepted'))
  EXECUTE FUNCTION notify_user_admin_on_pickup();

-- =====================================================
-- TRIGGER 5: DELIVERY DELIVERED → Notify USER + ADMIN
-- Fires when deliverapp UPDATEs delivery_assignments.status to 'delivered'
-- =====================================================
CREATE OR REPLACE FUNCTION notify_user_admin_on_delivered()
RETURNS TRIGGER AS $$
DECLARE
  order_record RECORD;
BEGIN
  IF NEW.status != 'delivered' THEN RETURN NEW; END IF;
  IF OLD.status = NEW.status THEN RETURN NEW; END IF;

  SELECT o.order_number, o.user_id INTO order_record
  FROM orders o WHERE o.id = NEW.order_id;

  IF order_record.user_id IS NOT NULL THEN
    PERFORM send_onesignal_direct_uuid(
      '🎉 Order Delivered!',
      'Your order has been delivered',
      NEW.order_id, COALESCE(order_record.order_number, ''), order_record.user_id, 'user'
    );
  END IF;

  PERFORM send_onesignal_direct(
    '✅ Order Completed',
    'An order has been delivered',
    NEW.order_id, COALESCE(order_record.order_number, ''), 'admin', 'admin'
  );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER notify_user_admin_on_delivered
  AFTER UPDATE ON delivery_assignments
  FOR EACH ROW
  WHEN (OLD.status IS DISTINCT FROM NEW.status AND NEW.status = 'delivered')
  EXECUTE FUNCTION notify_user_admin_on_delivered();

-- =====================================================
-- TRIGGER 6: DELIVERY CANCELLED → Notify DELIVERY PERSON
-- Fires when admin cancels a delivery assignment (status changed to 'cancelled')
-- =====================================================
CREATE OR REPLACE FUNCTION notify_delivery_cancellation()
RETURNS TRIGGER AS $$
DECLARE
  order_record RECORD;
  delivery_player_ids TEXT[];
  delivery_person_record RECORD;
BEGIN
  -- Only fire when status changes to 'cancelled'
  IF NEW.status != 'cancelled' THEN RETURN NEW; END IF;
  IF OLD.status = NEW.status THEN RETURN NEW; END IF;

  -- Get order details
  SELECT o.order_number, o.total_amount
  INTO order_record
  FROM orders o WHERE o.id = NEW.order_id;

  -- Get delivery person details
  SELECT dp.user_id, dp.name
  INTO delivery_person_record
  FROM delivery_persons dp
  WHERE dp.id = NEW.delivery_person_id;

  -- Notify the SPECIFIC delivery person whose assignment was cancelled
  IF NEW.delivery_person_id IS NOT NULL AND delivery_person_record.user_id IS NOT NULL THEN
    -- Get ALL possible player IDs for this delivery person from BOTH tables
    SELECT ARRAY_AGG(DISTINCT player_id)
    INTO delivery_player_ids
    FROM (
      -- From onesignal_players table (via user_id)
      SELECT onesignal_player_id AS player_id
      FROM onesignal_players
      WHERE user_id = delivery_person_record.user_id
        AND app_type = 'delivery'
        AND onesignal_player_id IS NOT NULL
      UNION
      -- From delivery_persons table directly (by id)
      SELECT onesignal_player_id AS player_id
      FROM delivery_persons
      WHERE id = NEW.delivery_person_id
        AND onesignal_player_id IS NOT NULL
        AND deleted_at IS NULL
    ) combined;

    IF delivery_player_ids IS NOT NULL AND array_length(delivery_player_ids, 1) > 0 THEN
      -- Send directly to the specific delivery person
      PERFORM net.http_post(
        url := 'https://onesignal.com/api/v1/notifications',
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'Authorization', 'Basic os_v2_app_3ilatuooxrd2dgymjv4xtfzujr2x2y7v6kfetdffai74pilmpclmsm3leyvnjecoqt3favq4cdztwajy7xa7wlgvnrec42szuelas5i'
        ),
        body := jsonb_build_object(
          'app_id', 'da1609d1-cebc-47a1-9b0c-4d797997344c',
          'include_player_ids', delivery_player_ids,
          'headings', jsonb_build_object('en', '❌ Delivery Assignment Cancelled'),
          'contents', jsonb_build_object('en', 'Order #' || COALESCE(order_record.order_number, 'N/A') || ' delivery has been cancelled by admin. You no longer need to deliver this order.'),
          'data', jsonb_build_object(
            'order_id', NEW.order_id::text,
            'order_number', COALESCE(order_record.order_number, 'N/A'),
            'type', 'delivery_cancellation',
            'app_type', 'delivery',
            'delivery_person_id', NEW.delivery_person_id::text
          ),
          'priority', 10
        ),
        timeout_milliseconds := 10000
      );

      -- DEBUG: Log that trigger fired
      INSERT INTO notifications (title, message, data, app_type, created_at)
      VALUES (
        '✅ TRIGGER FIRED: Delivery Cancelled',
        'Delivery cancellation notification sent to ' || COALESCE(delivery_person_record.name, 'Unknown') || ' (' || array_length(delivery_player_ids, 1) || ' tokens found)',
        jsonb_build_object('order_id', NEW.order_id, 'delivery_person_id', NEW.delivery_person_id, 'token_count', array_length(delivery_player_ids, 1)),
        'delivery',
        now()
      );
    ELSE
      -- Fallback: log to notifications
      INSERT INTO notifications (title, message, data, app_type, created_at)
      VALUES (
        '⚠️ TRIGGER: Delivery cancelled (no tokens)',
        'No tokens found for delivery person ' || COALESCE(delivery_person_record.name, 'Unknown') || ', order ' || COALESCE(order_record.order_number, 'N/A'),
        jsonb_build_object('order_id', NEW.order_id, 'delivery_person_id', NEW.delivery_person_id),
        'delivery',
        now()
      );
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER notify_delivery_cancellation
  AFTER UPDATE ON delivery_assignments
  FOR EACH ROW
  WHEN (OLD.status IS DISTINCT FROM NEW.status AND NEW.status = 'cancelled')
  EXECUTE FUNCTION notify_delivery_cancellation();

SELECT '✅ Step 4: Delivery assignments triggers created!' as result;

-- STEP 5: Grant all permissions
GRANT EXECUTE ON FUNCTION notify_admins_new_order TO authenticated, anon, service_role;
GRANT EXECUTE ON FUNCTION notify_users_order_status_change TO authenticated, anon, service_role;
GRANT EXECUTE ON FUNCTION notify_delivery_assignment TO authenticated, anon, service_role;
GRANT EXECUTE ON FUNCTION notify_user_admin_on_pickup TO authenticated, anon, service_role;
GRANT EXECUTE ON FUNCTION notify_user_admin_on_delivered TO authenticated, anon, service_role;
GRANT EXECUTE ON FUNCTION notify_delivery_cancellation TO authenticated, anon, service_role;

SELECT '✅ Step 5: Permissions granted!' as result;

-- STEP 6: Verify all triggers
SELECT '🔍 Step 6a: Active triggers:' as step;
SELECT trigger_name, event_object_table as "Table", event_manipulation as "Event"
FROM information_schema.triggers
WHERE event_object_table IN ('orders', 'delivery_assignments')
ORDER BY event_object_table, trigger_name;

-- STEP 7: Token counts
SELECT '📊 Step 6b: Token counts:' as step;
SELECT 'onesignal_players (admin)' as source, COUNT(*) as tokens FROM onesignal_players WHERE app_type = 'admin' AND onesignal_player_id IS NOT NULL
UNION ALL
SELECT 'admins table', COUNT(*) FROM admins WHERE onesignal_player_id IS NOT NULL
UNION ALL
SELECT 'onesignal_players (delivery)', COUNT(*) FROM onesignal_players WHERE app_type = 'delivery' AND onesignal_player_id IS NOT NULL
UNION ALL
SELECT 'delivery_persons table', COUNT(*) FROM delivery_persons WHERE onesignal_player_id IS NOT NULL
UNION ALL
SELECT 'onesignal_players (user)', COUNT(*) FROM onesignal_players WHERE app_type = 'user' AND onesignal_player_id IS NOT NULL
UNION ALL
SELECT 'profiles table', COUNT(*) FROM profiles WHERE onesignal_player_id IS NOT NULL;

-- STEP 6: Verify all triggers
SELECT '🔍 Active triggers:' as step;
SELECT trigger_name, event_object_table as "Table", event_manipulation as "Event"
FROM information_schema.triggers
WHERE event_object_table IN ('orders', 'delivery_assignments')
ORDER BY event_object_table, trigger_name;

-- STEP 7: Token counts
SELECT '📊 Token counts:' as step;
SELECT 'onesignal_players (admin)' as source, COUNT(*) as tokens FROM onesignal_players WHERE app_type = 'admin' AND onesignal_player_id IS NOT NULL
UNION ALL
SELECT 'admins table', COUNT(*) FROM admins WHERE onesignal_player_id IS NOT NULL
UNION ALL
SELECT 'onesignal_players (delivery)', COUNT(*) FROM onesignal_players WHERE app_type = 'delivery' AND onesignal_player_id IS NOT NULL
UNION ALL
SELECT 'delivery_persons table', COUNT(*) FROM delivery_persons WHERE onesignal_player_id IS NOT NULL
UNION ALL
SELECT 'onesignal_players (user)', COUNT(*) FROM onesignal_players WHERE app_type = 'user' AND onesignal_player_id IS NOT NULL
UNION ALL
SELECT 'profiles table', COUNT(*) FROM profiles WHERE onesignal_player_id IS NOT NULL;

SELECT '✅ COMPLETE! All triggers created. Each event fires exactly once.' as result;
