import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert, ScrollView, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, Redirect } from 'expo-router';
import { useAdminAuth } from '@/contexts/AdminAuthContext';
import { supabase } from '@/lib/supabase';

export default function AdminSettingsScreen() {
  const { isAdmin } = useAdminAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  
  // Settings state
  const [adminPhone, setAdminPhone] = useState('');
  const [constantDeliveryFee, setConstantDeliveryFee] = useState('50');
  const [baseDeliveryFee, setBaseDeliveryFee] = useState('3');
  const [perKmFee, setPerKmFee] = useState('5');
  const [minOrder, setMinOrder] = useState('100');
  const [freeDeliveryThreshold, setFreeDeliveryThreshold] = useState('500');

  // Load current settings
  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      const { data, error } = await supabase
        .from('app_settings')
        .select('*')
        .eq('id', 'app-settings')
        .single();

      if (error) {
        console.error('[AdminSettings] Error loading settings:', error);
        // If no settings exist, create default ones
        if (error.code === 'PGRST116') {
          await createDefaultSettings();
          return;
        }
        Alert.alert('Error', 'Failed to load settings');
        return;
      }

      
      // Populate form with existing values
      setAdminPhone(data.admin_phone || '');
      setConstantDeliveryFee(data.constant_delivery_fee?.toString() || '50');
      setBaseDeliveryFee(data.base_delivery_fee?.toString() || '3');
      setPerKmFee(data.per_km_fee?.toString() || '5');
      setMinOrder(data.minimum_order?.toString() || '100');
      setFreeDeliveryThreshold(data.free_delivery_threshold?.toString() || '500');
    } catch (error) {
      console.error('[AdminSettings] Error:', error);
      Alert.alert('Error', 'Failed to load settings');
    } finally {
      setLoading(false);
    }
  };

  const createDefaultSettings = async () => {
    try {
      const { error } = await supabase
        .from('app_settings')
        .insert([{
          id: 'app-settings',
          admin_phone: '',
          constant_delivery_fee: 50,
          base_delivery_fee: 3,
          per_km_fee: 5,
          minimum_order: 100,
          free_delivery_threshold: 500,
          is_delivery_enabled: true,
        }]);

      if (error) throw error;

      Alert.alert('Success', 'Default settings created');
      loadSettings();
    } catch (error) {
      console.error('[AdminSettings] Error creating defaults:', error);
    }
  };

  const saveSettings = async () => {
    try {
      setSaving(true);

      // Validate inputs
      if (!adminPhone.trim()) {
        Alert.alert('Error', 'Admin phone number is required');
        return;
      }

      const settingsUpdate = {
        admin_phone: adminPhone.trim(),
        constant_delivery_fee: parseFloat(constantDeliveryFee) || 50,
        base_delivery_fee: parseFloat(baseDeliveryFee) || 3,
        per_km_fee: parseFloat(perKmFee) || 5,
        minimum_order: parseFloat(minOrder) || 100,
        free_delivery_threshold: parseFloat(freeDeliveryThreshold) || 500,
        updated_at: new Date().toISOString(),
      };


      const { error } = await supabase
        .from('app_settings')
        .update(settingsUpdate)
        .eq('id', 'app-settings');

      if (error) throw error;

      Alert.alert('Success', 'Settings saved successfully!');
    } catch (error: any) {
      console.error('[AdminSettings] Error saving:', error);
      Alert.alert('Error', 'Failed to save settings: ' + error.message);
    } finally {
      setSaving(false);
    }
  };

  if (!isAdmin) {
    return <Redirect href="/admin/login" />;
  }

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#C41E26" />
          <Text style={styles.loadingText}>Loading settings...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        <Text style={styles.title}>Admin Settings</Text>
        <Text style={styles.subtitle}>Configure app-wide settings</Text>

        {/* Admin Phone Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>📞 Contact Information</Text>
          
          <Text style={styles.label}>Admin Phone Number *</Text>
          <TextInput
            style={styles.input}
            value={adminPhone}
            onChangeText={setAdminPhone}
            placeholder="Enter admin phone number"
            placeholderTextColor="#999"
            keyboardType="phone-pad"
          />
          <Text style={styles.hint}>This number will be shown to customers</Text>
        </View>

        {/* Delivery Fees Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>💰 Delivery Fees</Text>
          
          <Text style={styles.label}>Constant Delivery Fee (AFN)</Text>
          <TextInput
            style={styles.input}
            value={constantDeliveryFee}
            onChangeText={setConstantDeliveryFee}
            placeholder="50"
            placeholderTextColor="#999"
            keyboardType="numeric"
          />
          <Text style={styles.hint}>Flat delivery fee for all orders</Text>

          <Text style={styles.label}>Base Delivery Fee (AFN)</Text>
          <TextInput
            style={styles.input}
            value={baseDeliveryFee}
            onChangeText={setBaseDeliveryFee}
            placeholder="3"
            placeholderTextColor="#999"
            keyboardType="numeric"
          />
          <Text style={styles.hint}>Starting fee for delivery calculation</Text>

          <Text style={styles.label}>Per KM Fee (AFN)</Text>
          <TextInput
            style={styles.input}
            value={perKmFee}
            onChangeText={setPerKmFee}
            placeholder="5"
            placeholderTextColor="#999"
            keyboardType="numeric"
          />
          <Text style={styles.hint}>Additional fee per kilometer</Text>
        </View>

        {/* Order Settings Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>📦 Order Settings</Text>
          
          <Text style={styles.label}>Minimum Order Amount (AFN)</Text>
          <TextInput
            style={styles.input}
            value={minOrder}
            onChangeText={setMinOrder}
            placeholder="100"
            placeholderTextColor="#999"
            keyboardType="numeric"
          />
          <Text style={styles.hint}>Minimum order amount required</Text>

          <Text style={styles.label}>Free Delivery Threshold (AFN)</Text>
          <TextInput
            style={styles.input}
            value={freeDeliveryThreshold}
            onChangeText={setFreeDeliveryThreshold}
            placeholder="500"
            placeholderTextColor="#999"
            keyboardType="numeric"
          />
          <Text style={styles.hint}>Orders above this amount get free delivery</Text>
        </View>

        {/* Save Button */}
        <TouchableOpacity
          style={[styles.saveButton, saving && styles.saveButtonDisabled]}
          onPress={saveSettings}
          disabled={saving}
        >
          {saving ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.saveButtonText}>Save Settings</Text>
          )}
        </TouchableOpacity>

        <View style={{ height: 50 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
    color: '#666',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
  },
  title: {
    fontSize: 32,
    fontWeight: '900',
    color: '#C41E26',
    textAlign: 'center',
    marginBottom: 8,
    letterSpacing: 2,
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginBottom: 30,
  },
  section: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 20,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1A1A1A',
    marginBottom: 15,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
    marginTop: 12,
  },
  input: {
    borderWidth: 2,
    borderColor: '#E0E0E0',
    borderRadius: 8,
    padding: 15,
    fontSize: 16,
    backgroundColor: '#FAFAFA',
  },
  hint: {
    fontSize: 12,
    color: '#999',
    marginTop: 6,
  },
  saveButton: {
    backgroundColor: '#C41E26',
    padding: 18,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 10,
    shadowColor: '#C41E26',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
  },
  saveButtonDisabled: {
    backgroundColor: '#ccc',
    shadowOpacity: 0,
    elevation: 0,
  },
  saveButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
    letterSpacing: 1,
  },
});
