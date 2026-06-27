import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, Alert, Linking, StyleSheet } from 'react-native';
import { supabase } from '@/lib/supabase';

const CallAdminButton = () => {
  const [adminPhoneNumber, setAdminPhoneNumber] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    loadAdminPhoneNumber();
  }, []);

  const loadAdminPhoneNumber = async () => {
    try {
      const { data, error } = await supabase
        .from('app_settings')
        .select('admin_phone')
        .single();

      if (error && error.code !== 'PGRST116') { // PGRST116 means no rows found
        throw error;
      }

      if (data && data.admin_phone) {
        setAdminPhoneNumber(data.admin_phone);
      } else {
        setAdminPhoneNumber(null);
      }
    } catch (error: any) {
      console.error('Error loading admin phone number:', error);
      Alert.alert('Error', 'Failed to load admin contact information');
    } finally {
      setLoading(false);
    }
  };

  const handleCallAdmin = () => {
    if (!adminPhoneNumber) {
      Alert.alert('Contact Information Not Available', 'Admin phone number is not set.');
      return;
    }

    // Format the phone number for dialing
    const phoneNumber = adminPhoneNumber.replace(/[^+0-9]/g, ''); // Remove non-numeric characters except +

    if (!phoneNumber) {
      Alert.alert('Invalid Phone Number', 'The admin phone number is invalid.');
      return;
    }

    const url = `tel:${phoneNumber}`;

    Linking.canOpenURL(url)
      .then((supported) => {
        if (supported) {
          Linking.openURL(url);
        } else {
          Alert.alert('Unable to Open Dialer', 'Cannot open the phone dialer on this device.');
        }
      })
      .catch((err) => {
        console.error('Error opening dialer:', err);
        Alert.alert('Error', 'Failed to open phone dialer');
      });
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <Text style={styles.text}>Loading contact info...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <TouchableOpacity style={styles.button} onPress={handleCallAdmin}>
        <Text style={styles.buttonText}>📞 Call Admin</Text>
      </TouchableOpacity>
      {adminPhoneNumber && (
        <Text style={styles.phoneNumber}>{adminPhoneNumber}</Text>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginVertical: 10,
    alignItems: 'center',
  },
  button: {
    backgroundColor: '#FF6B6B',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
    minWidth: 150,
  },
  buttonText: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 16,
  },
  phoneNumber: {
    fontSize: 14,
    color: '#666',
    marginTop: 5,
    fontWeight: '500',
  },
  text: {
    fontSize: 16,
    color: '#666',
  },
});

export default CallAdminButton;