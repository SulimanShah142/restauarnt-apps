import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, Alert, ScrollView, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '@/lib/supabase';
import DrawerLayout from '@/components/DrawerLayout';

export default function AdminSettingsScreen() {
  const [settings, setSettings] = useState({
    constant_delivery_fee: '',
    is_delivery_enabled: true,
    base_delivery_fee: '',
    max_free_delivery_distance: '',
    additional_fee_per_km_after_free: ''
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      const { data, error } = await supabase
        .from('app_settings')
        .select('*')
        .single();

      if (error && error.code !== 'PGRST116') { // PGRST116 means no rows found
        throw error;
      }

      if (data) {
        setSettings({
          constant_delivery_fee: data.constant_delivery_fee?.toString() || '50.00',
          is_delivery_enabled: data.is_delivery_enabled ?? true,
          base_delivery_fee: data.base_delivery_fee?.toString() || '50.00',
          max_free_delivery_distance: data.max_free_delivery_distance?.toString() || '2.00',
          additional_fee_per_km_after_free: data.additional_fee_per_km_after_free?.toString() || '30.00'
        });
      } else {
        // Set defaults if no settings exist
        setSettings({
          constant_delivery_fee: '50.00',
          is_delivery_enabled: true,
          base_delivery_fee: '50.00',
          max_free_delivery_distance: '2.00',
          additional_fee_per_km_after_free: '30.00'
        });
      }
    } catch (error: any) {
      console.error('Error loading settings:', error);
      Alert.alert('Error', 'Failed to load settings');
    } finally {
      setLoading(false);
    }
  };

  const saveSettings = async () => {
    if (!validateInputs()) {
      return;
    }

    setSaving(true);

    try {
      const settingsToSave = {
        constant_delivery_fee: parseFloat(settings.constant_delivery_fee),
        is_delivery_enabled: settings.is_delivery_enabled,
        base_delivery_fee: parseFloat(settings.base_delivery_fee),
        max_free_delivery_distance: parseFloat(settings.max_free_delivery_distance),
        additional_fee_per_km_after_free: parseFloat(settings.additional_fee_per_km_after_free),
        updated_at: new Date().toISOString()
      };

      const { error } = await supabase
        .from('app_settings')
        .upsert([settingsToSave], { onConflict: 'id' }); // Use upsert to insert or update

      if (error) {
        throw error;
      }

      Alert.alert('Success', 'Settings saved successfully!');
    } catch (error: any) {
      console.error('Error saving settings:', error);
      Alert.alert('Error', 'Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  const validateInputs = (): boolean => {
    if (isNaN(parseFloat(settings.constant_delivery_fee)) || parseFloat(settings.constant_delivery_fee) < 0) {
      Alert.alert('Validation Error', 'Constant delivery fee must be a valid positive number');
      return false;
    }

    if (isNaN(parseFloat(settings.base_delivery_fee)) || parseFloat(settings.base_delivery_fee) < 0) {
      Alert.alert('Validation Error', 'Base delivery fee must be a valid positive number');
      return false;
    }

    if (isNaN(parseFloat(settings.max_free_delivery_distance)) || parseFloat(settings.max_free_delivery_distance) < 0) {
      Alert.alert('Validation Error', 'Max free delivery distance must be a valid positive number');
      return false;
    }

    if (isNaN(parseFloat(settings.additional_fee_per_km_after_free)) || parseFloat(settings.additional_fee_per_km_after_free) < 0) {
      Alert.alert('Validation Error', 'Additional fee per km after free must be a valid positive number');
      return false;
    }

    return true;
  };

  const toggleDeliveryEnabled = () => {
    setSettings(prev => ({
      ...prev,
      is_delivery_enabled: !prev.is_delivery_enabled
    }));
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color="#C41E26" />
        <Text>Loading settings...</Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
        <ScrollView contentContainerStyle={styles.content}>
          <Text style={styles.title}>Delivery Settings</Text>
          
          <View style={styles.settingContainer}>
            <Text style={styles.label}>Constant Delivery Fee (AFG)</Text>
            <TextInput
              style={styles.input}
              value={settings.constant_delivery_fee}
              onChangeText={(value) => setSettings(prev => ({ ...prev, constant_delivery_fee: value }))}
              placeholder="Fixed delivery fee"
              keyboardType="numeric"
            />
          </View>

          <View style={styles.settingContainer}>
            <Text style={styles.label}>Base Delivery Fee (AFG)</Text>
            <TextInput
              style={styles.input}
              value={settings.base_delivery_fee}
              onChangeText={(value) => setSettings(prev => ({ ...prev, base_delivery_fee: value }))}
              placeholder="Base fee"
              keyboardType="numeric"
            />
          </View>

          <View style={styles.settingContainer}>
            <Text style={styles.label}>Max Free Delivery Distance (km)</Text>
            <TextInput
              style={styles.input}
              value={settings.max_free_delivery_distance}
              onChangeText={(value) => setSettings(prev => ({ ...prev, max_free_delivery_distance: value }))}
              placeholder="Distance in km"
              keyboardType="numeric"
            />
          </View>

          <View style={styles.settingContainer}>
            <Text style={styles.label}>Additional Fee Per Km After Free (AFG)</Text>
            <TextInput
              style={styles.input}
              value={settings.additional_fee_per_km_after_free}
              onChangeText={(value) => setSettings(prev => ({ ...prev, additional_fee_per_km_after_free: value }))}
              placeholder="Additional cost per km"
              keyboardType="numeric"
            />
          </View>

          <View style={styles.toggleContainer}>
            <Text style={styles.label}>Delivery Enabled</Text>
            <TouchableOpacity 
              style={[styles.toggleButton, settings.is_delivery_enabled ? styles.enabledToggle : styles.disabledToggle]}
              onPress={toggleDeliveryEnabled}
            >
              <Text style={styles.toggleText}>
                {settings.is_delivery_enabled ? 'ENABLED' : 'DISABLED'}
              </Text>
            </TouchableOpacity>
          </View>

          <TouchableOpacity
            style={styles.saveButton}
            onPress={saveSettings}
            disabled={saving}
          >
            <Text style={styles.saveButtonText}>
              {saving ? 'Saving...' : 'Save Settings'}
            </Text>
          </TouchableOpacity>
        </ScrollView>
      </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  content: {
    padding: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 20,
    color: '#333',
  },
  settingContainer: {
    backgroundColor: 'white',
    padding: 16,
    borderRadius: 8,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
    color: '#333',
  },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    backgroundColor: '#fafafa',
  },
  toggleContainer: {
    backgroundColor: 'white',
    padding: 16,
    borderRadius: 8,
    marginBottom: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  toggleButton: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 20,
  },
  enabledToggle: {
    backgroundColor: '#4CAF50',
  },
  disabledToggle: {
    backgroundColor: '#FF9800',
  },
  toggleText: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 12,
  },
  saveButton: {
    backgroundColor: '#C41E26',
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 10,
  },
  saveButtonText: {
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
  },
});