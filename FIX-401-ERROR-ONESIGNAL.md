# Fix 401 Error - send-onesignal-notification Edge Function

## Problem

The edge function `send-onesignal-notification` is returning a **401 Unauthorized** error when called from database triggers.

**Error Details:**
- Execution ID: `3426df63-78ad-42c9-855d-eea396557cd0`
- Timestamp: `31 Mar 26 21:22:58`
- Status Code: `401`

## Root Cause

The 401 error can be caused by:

1. **Missing OneSignal API Keys** - The edge function doesn't have the required OneSignal REST API keys configured
2. **Missing Supabase Configuration** - The edge function doesn't have `SUPABASE_URL` or `SUPABASE_SERVICE_ROLE_KEY` configured
3. **Database trigger not sending auth headers** - The `pg_net.http_post()` call doesn't include proper authentication

## Solution

### Step 1: Run the SQL Fix Script

Run **`supabase/migrations/FIX_401_COMPLETE.sql`** in your Supabase SQL Editor.

This script will:
- Verify `pg_net` extension is installed
- Update the `send_onesignal_notification()` function with proper headers
- Create a test function
- Show configuration status

### Step 2: Set Service Role Key

**IMPORTANT:** You MUST set your service role key in the database:

1. Go to: https://gjyipzhhgxgumgbnpikg.supabase.co/dashboard/settings/api
2. Copy the **service_role** key (NOT the anon key!)
3. Run in SQL Editor:
   ```sql
   ALTER DATABASE postgres SET "app.settings.service_role_key" = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...';
   ```

### Step 3: Configure OneSignal API Keys

Set the OneSignal API keys as **Edge Function Secrets**:

1. Go to: https://gjyipzhhgxgumgbnpikg.supabase.co/dashboard/functions
2. Select **send-onesignal-notification** function
3. Click **Secrets** tab
4. Add these secrets:

| Secret Name | Value |
|-------------|-------|
| `ONESIGNAL_USERAPP_KEY` | Your User app OneSignal REST API key |
| `ONESIGNAL_DELIVERAP_KEY` | Your Delivery app OneSignal REST API key |
| `ONESIGNAL_ADMINSAPP_KEY` | Your Admin app OneSignal REST API key |

**Where to find OneSignal REST API keys:**
1. Go to OneSignal Dashboard
2. Select your app
3. Go to Settings → Keys & IDs
4. Copy the **REST API Key**

### Step 4: Test the Setup

Run the test function:

```sql
SELECT test_onesignal_notification();
```

Check the response:
- ✅ `{"success": true, "request_id": 12345, ...}` - Working!
- ❌ `{"success": false, "error": "..."}` - Check logs

### Step 5: Check Logs

Go to: https://gjyipzhhgxgumgbnpikg.supabase.co/dashboard/logs/explorer

Filter by:
- Function: `send-onesignal-notification`
- Time: Last 15 minutes

Look for these log messages:
- `📬 Received request to send-onesignal-notification`
- `Supabase URL configured: true`
- `Service role key configured: true`
- `OneSignal API Keys configured: true`

## Verification Checklist

- [ ] `pg_net` extension is installed
- [ ] Service role key is set in database settings
- [ ] OneSignal API keys are set as edge function secrets
- [ ] Test function returns success
- [ ] Logs show all configurations as "true"
- [ ] Trigger `orders_onesignal_notification` exists and is enabled

## Common Issues

### Issue 1: "Missing OneSignal API keys"

**Symptom:** Test returns 500 error with message about missing API keys

**Fix:** Make sure you set all three OneSignal API keys as edge function secrets (Step 3)

### Issue 2: "Service role key not configured"

**Symptom:** Warning message in SQL but function still works

**Fix:** Set the service role key in database settings (Step 2)

### Issue 3: OneSignal returns 400 error

**Symptom:** Edge function works but OneSignal API returns error

**Fix:** Check that:
- OneSignal player IDs exist in `onesignal_players` table
- OneSignal App IDs are correct in the edge function
- OneSignal REST API keys match the correct apps

### Issue 4: pg_net not working

**Symptom:** Function returns error about `net.http_post`

**Fix:** 
```sql
CREATE EXTENSION IF NOT EXISTS pg_net;
```

## Edge Function Code Updates

The edge function has been updated with:
- Better logging to diagnose issues
- Validation for required configuration
- Clear error messages for missing keys
- CORS headers for browser requests

## Database Trigger

The trigger function `send_onesignal_notification()` now:
- Includes `Authorization` header with service role key
- Has longer timeout (15 seconds)
- Logs request IDs for debugging
- Handles errors gracefully

## OneSignal App Configuration

Make sure your OneSignal apps are configured correctly:

**User App:**
- App ID: `38e20d47-839b-4944-8455-daf65977aaf9`
- Platform: iOS + Android (Expo)

**Delivery App:**
- App ID: `da1609d1-cebc-47a1-9b0c-4d797997344c`
- Platform: iOS + Android (Expo)

**Admin App:**
- App ID: `2665a069-40cb-4335-8af1-0f4d8b77aeea`
- Platform: iOS + Android (Expo)

## Support

If you're still getting 401 errors after following all steps:

1. Check edge function logs for detailed error messages
2. Verify all secrets are set correctly
3. Test with a simple HTTP request:
   ```sql
   SELECT net.http_get('https://httpbin.org/get') as test;
   ```
4. Contact Supabase support with the execution ID: `3426df63-78ad-42c9-855d-eea396557cd0`
