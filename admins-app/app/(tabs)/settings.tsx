import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, Button, StyleSheet, Alert, ScrollView, Switch } from 'react-native';
import { supabase } from '@/lib/supabase';

export default function SettingsScreen() {
  const [constantDeliveryFee, setConstantDeliveryFee] = useState<string>('50.00');
  const [isDeliveryEnabled, setIsDeliveryEnabled] = useState<boolean>(true);
  const [adminPhone, setAdminPhone] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(true);
  const [saving, setSaving] = useState<boolean>(false);

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('app_settings')
        .select('*')
        .single();

      if (error && error.code !== 'PGRST116') {
        console.error('[Settings] Error loading:', error);
        throw error;
      }

      if (data) {
        setConstantDeliveryFee(data.constant_delivery_fee?.toString() || '50.00');
        setIsDeliveryEnabled(data.is_delivery_enabled ?? true);
        setAdminPhone(data.admin_phone || '');
        setConstantDeliveryFee('50.00');
        setIsDeliveryEnabled(true);
        setAdminPhone('');
      }
    } catch (error) {
      console.error('[Settings] Error:', error);
      Alert.alert('Error', 'Failed to load settings');
    } finally {
      setLoading(false);
    }
  };

  const saveSettings = async () => {
    
    if (!constantDeliveryFee || isNaN(parseFloat(constantDeliveryFee))) {
      Alert.alert('Error', 'Please enter a valid constant delivery fee');
      return;
    }

    setSaving(true);
    try {
      const settingsData = {
        constant_delivery_fee: parseFloat(constantDeliveryFee),
        is_delivery_enabled: isDeliveryEnabled,
        admin_phone: adminPhone,
        updated_at: new Date().toISOString()
      };


      const { data: existingSettings } = await supabase
        .from('app_settings')
        .select('id')
        .single();

      let result;
      if (existingSettings) {
        result = await supabase
          .from('app_settings')
          .update(settingsData)
          .eq('id', existingSettings.id)
          .select();
      } else {
        result = await supabase
          .from('app_settings')
          .insert([{ ...settingsData, id: 'app-settings' }])
          .select();
      }


      if (result.error) {
        throw result.error;
      }

      Alert.alert('Success', 'Settings saved successfully!\nAdmin Phone: ' + adminPhone);
    } catch (error: any) {
      console.error('[Settings] Save error:', error);
      Alert.alert('Error', 'Failed to save settings: ' + error.message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <Text>Loading settings...</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.scrollContent}>
      <View style={styles.form}>
        <Text style={styles.title}>⚙️ App Settings</Text>

        Admin Phone Number Section - PROMINENT
        <View style={[styles.inputGroup, styles.prominentSection]}>
          <Text style={[styles.label, styles.prominentLabel]}>📞 Admin Phone Number</Text>
          <Text style={styles.description}>This number appears on "Call Admin" and "Call Customer Service" buttons</Text>
          <TextInput
            style={[styles.input, styles.prominentInput]}
            value={adminPhone}
            onChangeText={setAdminPhone}
            keyboardType="phone-pad"
            placeholder="+93700000000"
            placeholderTextColor="#999"
            autoCapitalize="none"
            autoCorrect={false}
          />
          {adminPhone && (
            <Text style={styles.currentValue}>Current: {adminPhone}</Text>
          )}
        </View>

        <View style={styles.separator} />

        Delivery Settings Section
        <Text style={styles.sectionTitle}>🚚 Delivery Settings</Text>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>Constant Delivery Fee (AFN)</Text>
          <TextInput
            style={styles.input}
            value={constantDeliveryFee}
            onChangeText={setConstantDeliveryFee}
            keyboardType="numeric"
            placeholder="50.00"
          />
        </View>

        <View style={styles.toggleContainer}>
          <View style={styles.toggleLabel}>
            <Text style={styles.label}>Enable Delivery</Text>
            <Text style={styles.toggleDescription}>Turn on/off delivery service</Text>
          </View>
          <Switch
            value={isDeliveryEnabled}
            onValueChange={setIsDeliveryEnabled}
            trackColor={{ false: "#767577", true: "#4CAF50" }}
            thumbColor={isDeliveryEnabled ? "#fff" : "#f4f3f4"}
          />
        </View>

        <View style={styles.saveButtonContainer}>
          <Button
            title={saving ? "Saving..." : "💾 Save Settings"}
            onPress={saveSettings}
            disabled={saving}
            color="#4CAF50"
          />
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f0f0f0',
  },
  scrollContent: {
    padding: 16,
  },
  form: {
    backgroundColor: 'white',
    padding: 20,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  title: {
    fontSize: 26,
    fontWeight: 'bold',
    marginBottom: 24,
    textAlign: 'center',
    color: '#333',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 16,
    color: '#555',
  },
  prominentSection: {
    backgroundColor: '#f9f9f9',
    padding: 16,
    borderRadius: 8,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  prominentLabel: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
  },
  prominentInput: {
    backgroundColor: 'white',
    borderWidth: 2,
    borderColor: '#4CAF50',
    fontSize: 18,
  },
  description: {
    fontSize: 13,
    color: '#666',
    marginBottom: 12,
    lineHeight: 18,
  },
  currentValue: {
    fontSize: 14,
    color: '#4CAF50',
    fontWeight: '500',
    marginTop: 8,
  },
  separator: {
    height: 1,
    backgroundColor: '#e0e0e0',
    marginVertical: 20,
  },
  inputGroup: {
    marginBottom: 20,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
    color: '#333',
  },
  toggleLabel: {
    flex: 1,
  },
  toggleDescription: {
    fontSize: 13,
    color: '#666',
    marginTop: 4,
  },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    padding: 12,
    borderRadius: 8,
    fontSize: 16,
    backgroundColor: 'white',
  },
  toggleContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
    padding: 12,
    backgroundColor: '#f9f9f9',
    borderRadius: 8,
  },
  saveButtonContainer: {
    marginTop: 10,
    paddingTop: 20,
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
  },
});
