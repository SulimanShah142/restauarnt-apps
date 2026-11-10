import { useState, useEffect } from "react";
import { View, TextInput, StyleSheet, Alert, ActivityIndicator, ScrollView, KeyboardAvoidingView, Platform, TouchableOpacity, Text, Linking } from "react-native";
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useRootNavigation, useLocalSearchParams } from 'expo-router';
import { supabase } from '../../lib/supabase';
import { Ionicons } from '@expo/vector-icons';
import { syncOneSignalTokens } from '../../utils/onesignal';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Privacy Policy and Terms URLs
const PRIVACY_POLICY_URL = 'https://sites.google.com/view/ayar-app-privacy-policy/privacy-policy';
const TERMS_OF_SERVICE_URL = 'https://sites.google.com/view/ayar-terms-of-service/terms-of-service';
const DELETE_ACCOUNT_URL = 'https://sites.google.com/view/ayar-terms-of-service/delete-my-account';

export default function SignIn() {
    const [identifier, setIdentifier] = useState("");
    const [password, setPassword] = useState("");
    const [showPassword, setShowPassword] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [agreedToTerms, setAgreedToTerms] = useState(false);
    const [isNavigationReady, setIsNavigationReady] = useState(false);
    const router = useRouter();
    const { redirectTo } = useLocalSearchParams<{ redirectTo?: string }>();
    const rootNavigation = useRootNavigation();

    // Check if navigation is ready
    useEffect(() => {
        if (rootNavigation) {
            setIsNavigationReady(true);
        }
    }, [rootNavigation]);

    const handleLogin = async () => {
        const value = identifier.trim();
        const isEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
        const normalizedPhone = value.replace(/[\s()-]/g, '');
        const isPhone = /^\+?\d{7,15}$/.test(normalizedPhone);
        if (!value) {
            Alert.alert('Required field', 'Enter your email address or phone number.');
            return;
        }
        if (!isEmail && !isPhone) {
            Alert.alert('Invalid email or phone', 'Enter a valid email address or phone number (7–15 digits).');
            return;
        }

        if (!password) {
            Alert.alert('Error', 'Please enter your password');
            return;
        }

        if (!agreedToTerms) {
            Alert.alert(
                'Terms Acceptance Required',
                'Please accept the Terms of Service and Privacy Policy to continue.',
                [{ text: 'OK' }]
            );
            return;
        }

        setIsLoading(true);
        try {
            let error: any = null;
            if (isEmail) {
                const result = await supabase.auth.signInWithPassword({ email: value.toLowerCase(), password });
                error = result.error;
            } else {
                const result = await supabase.functions.invoke('phone-password-login', {
                    body: { phone: normalizedPhone, password },
                });
                if (result.error) {
                    let message = result.error.message;
                    try { message = (await (result.error as any).context?.json())?.error || message; } catch { /* retain SDK message */ }
                    throw new Error(message);
                }
                if (!result.data?.session?.access_token || !result.data?.session?.refresh_token) {
                    throw new Error(result.data?.error || 'Phone or password is incorrect.');
                }
                const sessionResult = await supabase.auth.setSession({
                    access_token: result.data.session.access_token,
                    refresh_token: result.data.session.refresh_token,
                });
                error = sessionResult.error;
            }

            if (error) {
                console.error('[SignIn] Supabase error:', error);
                throw error;
            }

            console.log('[SignIn] Success!');
            console.log('[SignIn] Credentials accepted');

            // Clear form fields
            setIdentifier('');
            setPassword('');

            // Wait for session to persist to AsyncStorage
            console.log('[SignIn] Waiting for session to persist...');
            await new Promise(resolve => setTimeout(resolve, 1000));

            // Verify session exists and is persisted
            console.log('[SignIn] Verifying session...');
            const { data: { session }, error: sessionError } = await supabase.auth.getSession();

            if (sessionError) {
                console.error('[SignIn] Session error:', sessionError);
            }

            console.log('[SignIn] Session verified:', !!session);

            if (session) {
                console.log('[SignIn] User ID from session:', session.user.id);
                console.log('[SignIn] Redirecting to auth-check...');

                // Cache user ID for OneSignal subscription events
                await AsyncStorage.setItem('user_id', session.user.id);
                console.log('[SignIn] ✅ Cached user_id for OneSignal');

                // Ensure profile exists for this user (in case trigger didn't fire)
                console.log('[SignIn] Ensuring profile exists...');
                try {
                    const { error: profileError } = await supabase.rpc('ensure_profile_exists', {
                        p_user_id: session.user.id,
                        p_email: session.user.email || null,
                        p_full_name: session.user.user_metadata?.full_name || null
                    });
                    
                    if (profileError) {
                        console.error('[SignIn] Error ensuring profile:', profileError);
                    } else {
                        console.log('[SignIn] ✅ Profile ensured to exist');
                    }
                } catch (err) {
                    console.error('[SignIn] Error calling ensure_profile_exists:', err);
                }

                const metadataPhone = session.user.user_metadata?.phone;
                if (metadataPhone) {
                    const { error: phoneProfileError } = await supabase.from('profiles').upsert({
                        id: session.user.id,
                        email: session.user.email ?? null,
                        full_name: session.user.user_metadata?.full_name ?? null,
                        phone: metadataPhone,
                    } as any);
                    if (phoneProfileError) console.error('[SignIn] Unable to sync profile phone:', phoneProfileError);
                }

                // Register push token for this user (non-blocking, don't wait for it)
                console.log('[SignIn] Registering push token...');
                syncOneSignalTokens()
                    .then(() => console.log('[SignIn] ✅ Push token registered'))
                    .catch((err) => console.error('[SignIn] Error registering push token:', err));

                // Navigate to auth-check which will verify session and redirect appropriately
                // AuthContext's onAuthStateChange fires synchronously after signInWithPassword,
                // so auth state is already updated by the time we navigate
                console.log('[SignIn] Navigating to auth-check...');
                router.replace(redirectTo === 'checkout' ? '/(tabs)/checkout' : '/auth-check');
            } else {
                console.error('[SignIn] No session found after login!');
                Alert.alert('Error', 'Login succeeded but no session found. Please try again.');
            }
        } catch (error: any) {
            console.error('[SignIn] Error:', error);
            console.error('[SignIn] Error message:', error.message);
            Alert.alert('Login Error', error.message || 'Failed to login');
        } finally {
            setIsLoading(false);
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
                        <Text style={styles.title}>Welcome Back</Text>
                        <Text style={styles.subtitle}>Sign in to continue</Text>

                        <TextInput
                            style={styles.input}
                            placeholder="Email or Phone Number"
                            placeholderTextColor="#999999"
                            value={identifier}
                            onChangeText={setIdentifier}
                            keyboardType="default"
                            autoCapitalize="none"
                            autoComplete="email"
                            editable={!isLoading}
                        />

                        <View style={styles.passwordContainer}>
                            <TextInput
                                style={styles.passwordInput}
                                placeholder="Password"
                                placeholderTextColor="#999999"
                                value={password}
                                onChangeText={setPassword}
                                secureTextEntry={!showPassword}
                                autoComplete="password"
                                editable={!isLoading}
                            />
                            <TouchableOpacity
                                style={styles.visibilityButton}
                                onPress={() => setShowPassword(!showPassword)}
                                disabled={isLoading}
                            >
                                <Ionicons
                                    name={showPassword ? 'eye-off' : 'eye'}
                                    size={20}
                                    color="#666"
                                />
                            </TouchableOpacity>
                        </View>

                        {/* Terms of Service Checkbox */}
                        <View style={styles.termsContainer}>
                            <TouchableOpacity
                                style={styles.checkbox}
                                onPress={() => setAgreedToTerms(!agreedToTerms)}
                                activeOpacity={0.7}
                            >
                                <Ionicons
                                    name={agreedToTerms ? 'checkbox' : 'square-outline'}
                                    size={24}
                                    color={agreedToTerms ? '#C41E26' : '#666'}
                                />
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={styles.termsTextContainer}
                                onPress={() => setAgreedToTerms(!agreedToTerms)}
                            >
                                <Text style={styles.termsText}>
                                    I agree to the{' '}
                                </Text>
                                <TouchableOpacity onPress={() => Linking.openURL(PRIVACY_POLICY_URL)}>
                                    <Text style={styles.termsLink}>Privacy Policy</Text>
                                </TouchableOpacity>
                                <Text style={styles.termsText}> and </Text>
                                <TouchableOpacity onPress={() => Linking.openURL(TERMS_OF_SERVICE_URL)}>
                                    <Text style={styles.termsLink}>Terms of Service</Text>
                                </TouchableOpacity>
                            </TouchableOpacity>
                        </View>

                        <TouchableOpacity
                            style={[styles.button, isLoading && styles.buttonDisabled, !agreedToTerms && styles.buttonDisabled]}
                            onPress={handleLogin}
                            disabled={isLoading || !agreedToTerms}
                        >
                            {isLoading ? (
                                <ActivityIndicator color="#fff" />
                            ) : (
                                <Text style={[styles.buttonText, !agreedToTerms && styles.buttonTextDisabled]}>
                                    Sign In
                                </Text>
                            )}
                        </TouchableOpacity>


  <TouchableOpacity
                            style={styles.skipButton}
                            onPress={() => router.replace('/(tabs)/menu')}
                            disabled={isLoading}
                        >
                            <Text style={styles.skipButtonText}>Skip & Browse Menu</Text>
                        </TouchableOpacity>

 
                        <View style={styles.signUpContainer}>
                            <Text style={styles.signUpText}>Don&apos;t have an account? </Text>
                            <TouchableOpacity onPress={() => router.replace('/(auth)/sign-up')}>
                                <Text style={styles.signUpLink}>Sign Up</Text>
                            </TouchableOpacity>
                        </View>

                        
                    </View>
                </ScrollView>
            </SafeAreaView>
        </KeyboardAvoidingView>
    );
}

const styles = StyleSheet.create({
    keyboardView: { flex: 1 },
    safeArea: { flex: 1, backgroundColor: '#ffffff' },
    scrollView: { flex: 1, backgroundColor: '#ffffff' },
    scrollContent: { flexGrow: 1, justifyContent: 'center' },
    container: { flex: 1, justifyContent: 'center', padding: 20, backgroundColor: '#ffffff' },
    title: { fontSize: 32, fontWeight: '900', color: '#C41E26', textAlign: 'center', marginBottom: 8, letterSpacing: 2 },
    subtitle: { fontSize: 16, color: '#666', textAlign: 'center', marginBottom: 40 },
    input: { borderWidth: 2, borderColor: '#C41E26', padding: 15, marginBottom: 15, borderRadius: 8, backgroundColor: 'white', fontSize: 16 },
    passwordContainer: { flexDirection: 'row', alignItems: 'center', borderWidth: 2, borderColor: '#C41E26', borderRadius: 8, backgroundColor: 'white', marginBottom: 15 },
    passwordInput: { flex: 1, padding: 15, fontSize: 16 },
    visibilityButton: { padding: 15, paddingRight: 15 },
    button: { backgroundColor: '#C41E26', padding: 15, borderRadius: 8, alignItems: 'center', marginTop: 10, shadowColor: '#C41E26', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 5 },
    buttonDisabled: { backgroundColor: '#ccc', shadowOpacity: 0, elevation: 0 },
    buttonText: { color: '#ffffff', fontSize: 18, fontWeight: '700', letterSpacing: 1 },
    buttonTextDisabled: { color: '#999' },
    termsContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: 15,
        marginBottom: 15,
        paddingHorizontal: 5,
    },
        skipButton: {
        marginTop: 15,
        padding: 10,
        alignItems: 'center',
    },
    skipButtonText: {
            color: '#666',
        fontSize: 16,
        fontWeight: '600',
        textDecorationLine: 'underline',
   },
 
    checkbox: {
        marginRight: 10,
    },
    termsTextContainer: {
        flex: 1,
        flexDirection: 'row',
        flexWrap: 'wrap',
        alignItems: 'center',
    },
    termsText: {
        fontSize: 14,
        color: '#666',
    },
    termsLink: {
        fontSize: 14,
        color: '#C41E26',
        fontWeight: '600',
        textDecorationLine: 'underline',
    },
    signUpContainer: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', marginTop: 20 },
    signUpText: { fontSize: 16, color: '#666' },
    signUpLink: { fontSize: 16, color: '#C41E26', fontWeight: '700' },
});
