import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert, ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import { useAdminAuth } from '@/contexts/AdminAuthContext';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import * as Device from 'expo-device';
import { syncOneSignalTokens } from '@/utils/onesignal';
import Checkbox from 'expo-checkbox'; // npx expo install expo-checkbox
import * as WebBrowser from 'expo-web-browser'; // npx expo install expo-web-browser

export default function AdminLogin() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const { checkAdminStatus } = useAdminAuth();
  const { refreshAuth } = useAuth();
const [isAgreed, setIsAgreed] = useState(false);
  // Create admin record in ADMINS table if it doesn't exist
  // This also creates user and profile records if needed
  // Schema: admins.user_id -> profiles.id -> users.id
  const createAdminRecord = async (email: string): Promise<string | null> => {
    try {
      console.log('[AdminLogin] Creating admin record for email:', email);

      // First check if admin already exists in ADMINS table
      const { data: existingAdmin, error: fetchError } = await supabase
        .from('admins')
        .select('id, user_id, email, role, is_active, expo_push_token, onesignal_player_id')
        .eq('email', email)
        .maybeSingle();

      if (fetchError && fetchError.code !== 'PGRST116') {
        console.error('[AdminLogin] ❌ Error checking existing admin:', fetchError);
      }

      if (existingAdmin?.user_id) {
        console.log('[AdminLogin] ✅ Admin already exists with user_id:', existingAdmin.user_id);
        return existingAdmin.user_id;
      }

      // Admin doesn't exist - check if profile exists
      const { data: existingProfile, error: profileFetchError } = await supabase
        .from('profiles')
        .select('id, email, expo_push_token, onesignal_player_id')
        .eq('email', email)
        .maybeSingle();

      if (profileFetchError && profileFetchError.code !== 'PGRST116') {
        console.error('[AdminLogin] ❌ Error checking existing profile:', profileFetchError);
      }

      let userId = existingProfile?.id;

      if (!existingProfile) {
        // Profile doesn't exist - check if user exists first
        const { data: existingUser, error: userFetchError } = await supabase
          .from('users')
          .select('id, email')
          .eq('email', email)
          .maybeSingle();

        userId = existingUser?.id;

        if (!existingUser) {
          // User doesn't exist - create it first with a generated ID
          const newUserId = generateUUID();
          console.log('[AdminLogin] Creating new user with ID:', newUserId);

          const { data: newUser, error: userError } = await supabase
            .from('users')
            .insert({
              id: newUserId,
              email: email,
              name: 'Admin User',
              phone: null,
              is_active: true,
              role: 'USER',
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString()
            })
            .select('id, email')
            .single();

          if (userError) {
            console.error('[AdminLogin] ❌ Error creating user:', userError);
            console.error('[AdminLogin] Error details:', JSON.stringify(userError, null, 2));
            return null;
          }

          userId = newUser.id;
          console.log('[AdminLogin] ✅ User created successfully');
        }

        // Now create profile record (admins.user_id references profiles.id)
        console.log('[AdminLogin] Creating profile for user:', userId);
        const { data: newProfile, error: profileError } = await supabase
          .from('profiles')
          .insert({
            id: userId,  // Use same ID as user
            email: email,
            full_name: 'Admin User',
            name: 'Admin User',
            phone: null,
            role: 'admin',
            image_url: null,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          })
          .select('id, email')
          .single();

        if (profileError) {
          console.error('[AdminLogin] ❌ Error creating profile:', profileError);
          console.error('[AdminLogin] Error details:', JSON.stringify(profileError, null, 2));
          return null;
        }

        userId = newProfile.id;
        console.log('[AdminLogin] ✅ Profile created successfully');
      }

      // Now create admin record with user_id pointing to profile.id
      console.log('[AdminLogin] Creating admin record with user_id:', userId);
      const { data: newAdmin, error: adminError } = await supabase
        .from('admins')
        .insert({
          id: generateUUID(),
          user_id: userId,
          email: email,
          role: 'admin',
          is_active: true,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .select('id, user_id, email, role')
        .single();

      if (adminError) {
        console.error('[AdminLogin] ❌ Error creating admin:', adminError);
        console.error('[AdminLogin] Error details:', JSON.stringify(adminError, null, 2));
        return null;
      }

      console.log('[AdminLogin] ✅ Admin record created successfully');
      return newAdmin.user_id;
    } catch (error) {
      console.error('[AdminLogin] Error in createAdminRecord:', error);
      return null;
    }
  };

  // Helper function to generate UUID
  const generateUUID = () => {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
      const r = Math.random() * 16 | 0;
      const v = c === 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  };

  // Register push token for admin - called immediately after successful login
  const registerAdminPushToken = async (email: string) => {
    try {
      console.log('[AdminLogin] Starting push token registration for admin:', email);

      // Must use physical device for push notifications
      if (!Device.isDevice) {
        console.log('[AdminLogin] ⚠️ Not a physical device, skipping push token registration');
        // Still update admins table with a placeholder
        await supabase
          .from('admins')
          .update({
            onesignal_player_id: 'emulator-device-' + Date.now(),
            expo_push_token: 'emulator-device-' + Date.now(),
            updated_at: new Date().toISOString()
          })
          .eq('email', email);
        return;
      }

      // OneSignal already initialized in _layout.tsx, just sync tokens
      console.log('[AdminLogin] Syncing OneSignal tokens...');
      try {
        const { syncOneSignalTokens } = await import('@/utils/onesignal');
        await syncOneSignalTokens();
        console.log('[AdminLogin] ✅ OneSignal tokens synced');
      } catch (error) {
        console.error('[AdminLogin] ❌ Error syncing push tokens:', error);
      }

    } catch (error) {
      console.error('[AdminLogin] ❌ Error registering push token:', error);
    }
  };

  const handleLogin = async () => {
    // 1. Mandatory Privacy Policy Check
    if (!isAgreed) {
        Alert.alert('Privacy Policy', 'Please accept the privacy policy to access the Admin Panel.');
        return;
    }

    if (!username.trim() || !password.trim()) {
        Alert.alert('Error', 'Please enter both username and password');
        return;
    }

    setLoading(true);
    try {
        console.log('[AdminLogin] Attempting login with:', { email: username, passwordLength: password.length });
        
        const { verifyAdminCredentials } = await import('@/lib/admin-auth');
        const isValid = await verifyAdminCredentials(username, password);
        
        console.log('[AdminLogin] Credential verification result:', isValid);

        if (isValid) {
            // STEP 1: Create admin record in ADMINS table FIRST
            const adminId = await createAdminRecord(username);
            
            if (adminId) {
                console.warn('[AdminLogin] ⚠️ Admin record creation returned null, continuing anyway...');
            }

            // STEP 2: Create session
            const ONE_DAY_SECONDS = 30 * 24 * 60 * 60;
            const currentTime = Math.floor(Date.now() / 1000);
            const expiresAt = currentTime + ONE_DAY_SECONDS;
            const tempToken = 'admin-session-' + Date.now();

            const sessionData = {
                user: {
                    id: adminId || 'admin-user-' + Date.now(),
                    email: username,
                    name: 'Admin',
                    role: 'ADMIN'
                },
                token: tempToken,
                expiresAt: expiresAt
            };

            await AsyncStorage.setItem('admin_session', JSON.stringify(sessionData));

            await new Promise(resolve => setTimeout(resolve, 300));
            const savedSession = await AsyncStorage.getItem('admin_session');

            if (!savedSession) {
                Alert.alert('Error', 'Failed to save session. Please try again.');
                setLoading(false);
                return;
            }

            // STEP 3, 4, 5
            await registerAdminPushToken(username);
            await checkAdminStatus();
            await refreshAuth();
            await new Promise(resolve => setTimeout(resolve, 500));
            router.replace('/admin/dashboard');

        } else {
            Alert.alert('Error', 'Incorrect username or password');
        }
    } catch (error: any) {
        console.error('[AdminLogin] ❌ Error:', error);
        Alert.alert('Error', error?.message || 'An error occurred during login');
    } finally {
        setLoading(false);
    }
};


  return (
    <KeyboardAvoidingView
      style={styles.keyboardView}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 100 : 0}
    >
      <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
        <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
          <View style={styles.container}>
            <Text style={styles.title}>Admin Login</Text>
            <Text style={styles.subtitle}>Sign in to continue</Text>

            <TextInput
              style={styles.input}
              placeholder="Admin Email"
              value={username}
              onChangeText={setUsername}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              editable={!loading}
            />

            <View style={styles.passwordContainer}>
              <TextInput
                style={styles.passwordInput}
                placeholder="Admin Password"
                value={password}
                onChangeText={setPassword}
                secureTextEntry={!showPassword}
                autoCapitalize="none"
                autoCorrect={false}
                editable={!loading}
              />
              <TouchableOpacity
                style={styles.visibilityButton}
                onPress={() => setShowPassword(!showPassword)}
                disabled={loading}
              >
                <Ionicons
                  name={showPassword ? 'eye-off' : 'eye'}
                  size={20}
                  color="#666"
                />
              </TouchableOpacity>
            </View>

          <View style={styles.checkboxContainer}>
    <Checkbox
        value={isAgreed}
        onValueChange={setIsAgreed}
        color={isAgreed ? '#C41E26' : undefined}
        style={styles.checkbox}
    />
    <Text style={styles.checkboxLabel}>
        I accept the{' '}
        <Text 
            style={styles.linkText} 
            onPress={() => WebBrowser.openBrowserAsync('https://sites.google.com/view/privacy-web/admin-panel-privacy-panel')}
        >
            Privacy Policy
        </Text>
    </Text>
</View>

<TouchableOpacity
    style={[styles.button, (loading || !isAgreed) && styles.buttonDisabled]}
    onPress={handleLogin}
    disabled={loading || !isAgreed}
>
    {loading ? (
        <ActivityIndicator color="#fff" />
    ) : (
        <Text style={styles.buttonText}>Login</Text>
    )}
</TouchableOpacity>
          </View>
        </ScrollView>
      </SafeAreaView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  keyboardView: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  scrollView: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
  },
  container: {
    flex: 1,
    justifyContent: 'center',
    padding: 20,
    backgroundColor: '#ffffff',
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
    marginBottom: 40,
  },
  input: {
    borderWidth: 2,
    borderColor: '#C41E26',
    padding: 15,
    marginBottom: 15,
    borderRadius: 8,
    backgroundColor: 'white',
    fontSize: 16,
  },
  passwordContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#C41E26',
    borderRadius: 8,
    backgroundColor: 'white',
    marginBottom: 15,
  },
  passwordInput: {
    flex: 1,
    padding: 15,
    fontSize: 16,
  },
  visibilityButton: {
    padding: 15,
    paddingRight: 15,
  },
  button: {
    backgroundColor: '#C41E26',
    padding: 15,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 10,
    shadowColor: '#C41E26',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
  },
  checkboxContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
    paddingHorizontal: 5,
},
checkbox: {
    marginRight: 10,
    borderRadius: 4,
    width: 20,
    height: 20,
    borderColor: '#C41E26',
    borderWidth: 2,
},
checkboxLabel: {
    fontSize: 14,
    color: '#444',
    flex: 1,
},
linkText: {
    color: '#C41E26',
    fontWeight: 'bold',
    textDecorationLine: 'underline',
},

  buttonDisabled: {
    backgroundColor: '#ccc',
  },
  buttonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
    letterSpacing: 1,
  },
});
