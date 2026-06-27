// Test OneSignal notifications directly
import React, { useState } from 'react';
import { View, Text, Button, Alert, ScrollView } from 'react-native';
import { supabase } from '@/lib/supabase';

export default function TestNotificationsScreen() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState('');

  const testNewOrderNotification = async () => {
    setLoading(true);
    setResult('Sending new order notification...\n');
    
    try {
      // Get current user
      const { data: { session } } = await supabase.auth.getSession();
      const userId = session?.user?.id || 'bdef354c-3bb4-4541-9096-629b98ebd537';

      const response = await supabase.functions.invoke('send-onesignal-notification', {
        body: {
          record: {
            id: `test-${Date.now()}`,
            order_number: `TEST-${Date.now()}`,
            user_id: userId,
            total_amount: 100,
            status: 'pending',
            created_at: new Date().toISOString()
          },
          old_record: null,
          table: 'orders',
          type: 'INSERT'
        }
      });

      if (response.error) {
        setResult(prev => prev + `❌ Error: ${JSON.stringify(response.error)}\n`);
        Alert.alert('Error', JSON.stringify(response.error));
      } else {
        setResult(prev => prev + `✅ Success! Response: ${JSON.stringify(response.data)}\n`);
        Alert.alert('Success', 'Notification sent! Check OneSignal dashboard.');
      }
    } catch (error: any) {
      setResult(prev => prev + `❌ Exception: ${error.message}\n`);
      Alert.alert('Error', error.message);
    } finally {
      setLoading(false);
    }
  };

  const testStatusUpdateNotification = async () => {
    setLoading(true);
    setResult('Sending status update notification...\n');
    
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const userId = session?.user?.id || 'bdef354c-3bb4-4541-9096-629b98ebd537';

      const response = await supabase.functions.invoke('send-onesignal-notification', {
        body: {
          record: {
            id: `test-${Date.now()}`,
            order_number: `TEST-${Date.now()}`,
            user_id: userId,
            status: 'confirmed'
          },
          old_record: {
            status: 'pending'
          },
          table: 'orders',
          type: 'UPDATE'
        }
      });

      if (response.error) {
        setResult(prev => prev + `❌ Error: ${JSON.stringify(response.error)}\n`);
      } else {
        setResult(prev => prev + `✅ Success! Response: ${JSON.stringify(response.data)}\n`);
        Alert.alert('Success', 'Status update notification sent!');
      }
    } catch (error: any) {
      setResult(prev => prev + `❌ Exception: ${error.message}\n`);
    } finally {
      setLoading(false);
    }
  };

  const checkOneSignalPlayers = async () => {
    setLoading(true);
    setResult('Checking onesignal_players table...\n');
    
    try {
      const { data, error } = await supabase
        .from('onesignal_players')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(10);

      if (error) {
        setResult(prev => prev + `❌ Error: ${error.message}\n`);
      } else {
        setResult(prev => prev + `✅ Found ${data?.length} records:\n`);
        data?.forEach((row: any) => {
          setResult(prev => prev + `  - ${row.app_type}: ${row.onesignal_player_id.substring(0, 8)}...\n`);
        });
      }
    } catch (error: any) {
      setResult(prev => prev + `❌ Exception: ${error.message}\n`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView style={{ flex: 1, padding: 20 }}>
      <Text style={{ fontSize: 24, fontWeight: 'bold', marginBottom: 20 }}>
        Test Notifications
      </Text>

      <Button
        title="Test New Order Notification"
        onPress={testNewOrderNotification}
        disabled={loading}
      />

      <View style={{ height: 10 }} />

      <Button
        title="Test Status Update Notification"
        onPress={testStatusUpdateNotification}
        disabled={loading}
      />

      <View style={{ height: 10 }} />

      <Button
        title="Check OneSignal Players"
        onPress={checkOneSignalPlayers}
        disabled={loading}
      />

      <View style={{ height: 20 }} />

      {result && (
        <View style={{ 
          backgroundColor: '#f0f0f0', 
          padding: 10, 
          borderRadius: 8,
          minHeight: 200 
        }}>
          <Text style={{ fontFamily: 'monospace', fontSize: 12 }}>
            {result}
          </Text>
        </View>
      )}
    </ScrollView>
  );
}
