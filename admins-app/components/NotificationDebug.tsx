// Debug Component for Admin Notifications
// Add this to your admin app temporarily to debug realtime issues

import React, { useEffect, useState } from 'react';
import { View, Text, Button, Alert } from 'react-native';
import { supabase } from '@/lib/supabase';
import { useAdminAuth } from '@/contexts/AdminAuthContext';

export default function NotificationDebug() {
  const { session } = useAdminAuth();
  const [logs, setLogs] = useState<string[]>([]);
  const [isListening, setIsListening] = useState(false);

  const addLog = (message: string) => {
    setLogs(prev => [`${new Date().toLocaleTimeString()}: ${message}`, ...prev.slice(0, 20)]);
  };

  useEffect(() => {
    addLog('========================================');
    addLog('DEBUG: Component mounted');
    addLog('Session exists: ' + !!session);
    addLog('User ID: ' + (session?.id || 'NONE'));
    addLog('User Email: ' + (session?.email || 'NONE'));
    addLog('========================================');
  }, []);

  const startListening = async () => {
    if (!session?.id) {
      Alert.alert('Error', 'Not logged in!');
      return;
    }

    addLog('📡 Starting realtime listener...');

    const userId = session.id;
    
    const channel = supabase
      .channel('debug-admin-notifications')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${userId}`
        },
        (payload) => {
          addLog('🔔 REALTIME NOTIFICATION RECEIVED!');
          addLog('   Event: ' + payload.eventType);
          addLog('   Table: ' + payload.table);
          addLog('   Title: ' + payload.new.title);
          addLog('   Message: ' + payload.new.message);
          addLog('   User ID: ' + payload.new.user_id);
          
          Alert.alert(
            '🔔 Realtime Test Success!',
            `Title: ${payload.new.title}\nMessage: ${payload.new.message}`,
            [{ text: 'OK' }]
          );
        }
      )
      .subscribe((status) => {
        addLog('Subscription status: ' + status);
        if (status === 'SUBSCRIBED') {
          addLog('✅ Successfully subscribed to realtime!');
          setIsListening(true);
        } else if (status === 'CHANNEL_ERROR') {
          addLog('❌ CHANNEL ERROR - Realtime may not be enabled!');
          Alert.alert(
            'Realtime Error',
            'Check if notifications table has realtime enabled in Supabase Dashboard:\nDatabase → Replication → Source',
            [{ text: 'OK' }]
          );
        }
      });

    // Store channel for cleanup
    (globalThis as any).__debugNotificationChannel = channel;
  };

  const testManualInsert = async () => {
    if (!session?.id) {
      Alert.alert('Error', 'Not logged in!');
      return;
    }

    addLog('📩 Inserting test notification...');

    const { error } = await supabase
      .from('notifications')
      .insert({
        user_id: session.id,
        title: '🔔 Manual Test from Debug',
        message: 'This is a test notification inserted manually',
        type: 'info',
        is_read: false
      });

    if (error) {
      addLog('❌ Insert failed: ' + error.message);
      Alert.alert('Insert Failed', error.message);
    } else {
      addLog('✅ Insert successful! Check if realtime catches it...');
      Alert.alert(
        'Insert Successful',
        'Notification inserted. If realtime is working, you should see an alert in 1-2 seconds.',
        [{ text: 'OK' }]
      );
    }
  };

  const checkRealtimeEnabled = async () => {
    addLog('🔍 Checking if realtime is enabled...');
    
    // Try to subscribe to a test channel
    const testChannel = supabase
      .channel('test-realtime-check')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications'
        },
        () => {}
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          addLog('✅ Realtime appears to be enabled (subscription successful)');
          Alert.alert(
            'Realtime Check',
            '✅ Realtime subscription successful!\nThe issue might be with the user_id filter or RLS policies.',
            [{ text: 'OK' }]
          );
        } else if (status === 'CHANNEL_ERROR') {
          addLog('❌ Realtime NOT enabled (channel error)');
          Alert.alert(
            'Realtime NOT Enabled',
            '❌ Supabase Realtime is not enabled for notifications table.\n\nGo to Supabase Dashboard:\nDatabase → Replication → Source\n\nEnable "notifications" table',
            [{ text: 'OK' }]
          );
        }
        
        supabase.removeChannel(testChannel);
      });
  };

  const cleanup = () => {
    const channel = (globalThis as any).__debugNotificationChannel;
    if (channel) {
      supabase.removeChannel(channel);
      addLog('🧹 Cleaned up debug channel');
    }
    setIsListening(false);
  };

  return (
    <View style={{ padding: 20, backgroundColor: '#f0f0f0', margin: 10, borderRadius: 8 }}>
      <Text style={{ fontSize: 18, fontWeight: 'bold', marginBottom: 10 }}>
        🔍 Notification Debug Tool
      </Text>
      
      <View style={{ marginBottom: 10 }}>
        <Text style={{ fontWeight: '600' }}>Status:</Text>
        <Text>{isListening ? '✅ Listening' : '❌ Not Listening'}</Text>
        <Text>User ID: {session?.id || 'Not logged in'}</Text>
      </View>

      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 10 }}>
        <Button
          title="Check Realtime"
          onPress={checkRealtimeEnabled}
        />
        <Button
          title="Start Listening"
          onPress={startListening}
          disabled={!session?.id}
        />
        <Button
          title="Test Insert"
          onPress={testManualInsert}
          disabled={!session?.id}
        />
        <Button
          title="Cleanup"
          onPress={cleanup}
        />
      </View>

      <View style={{ backgroundColor: '#000', padding: 10, borderRadius: 4, maxHeight: 300, overflow: 'scroll' }}>
        <Text style={{ color: '#0f0', fontSize: 10, fontFamily: 'monospace' }}>
          {logs.join('\n') || 'No logs yet...'}
        </Text>
      </View>
    </View>
  );
}
