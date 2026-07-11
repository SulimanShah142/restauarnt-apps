import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert, ActivityIndicator, Platform, ScrollView, KeyboardAvoidingView, Linking } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../../lib/supabase';

// Privacy Policy and Terms URLs (replace with your actual Google Sites URLs)
const PRIVACY_POLICY_URL = 'https://sites.google.com/view/ayar-app-privacy-policy/privacy-policy';
const TERMS_OF_SERVICE_URL = 'https://sites.google.com/view/ayar-terms-of-service/terms-of-service';
const DELETE_ACCOUNT_URL = 'https://sites.google.com/view/ayar-terms-of-service/delete-my-account';

export default function SignUp() {
    const [email, setEmail] = useState("");
    const [name, setName] = useState("");
    const [password, setPassword] = useState("");
    const [showPassword, setShowPassword] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [agreedToTerms, setAgreedToTerms] = useState(false);
    const router = useRouter();

    console.log('[SignUp] Render - email:', email, 'name:', name, 'isLoading:', isLoading);

    const handleSignUp = async () => {
        console.log('[SignUp] handleSignUp called');
        
        if (!email.trim()) {
            console.log('[SignUp] Validation failed: empty email');
            Alert.alert('Error', 'Please enter your email');
            return;
        }

        if (!name.trim()) {
            console.log('[SignUp] Validation failed: empty name');
            Alert.alert('Error', 'Please enter your name');
            return;
        }

        if (!password) {
            console.log('[SignUp] Validation failed: empty password');
            Alert.alert('Error', 'Please enter a password');
            return;
        }

        if (password.length < 6) {
            console.log('[SignUp] Validation failed: password too short');
            Alert.alert('Error', 'Password must be at least 6 characters');
            return;
        }

        if (!agreedToTerms) {
            console.log('[SignUp] Validation failed: terms not agreed');
            Alert.alert(
                'Terms Acceptance Required',
                'Please accept the Terms of Service and Privacy Policy to continue.',
                [{ text: 'OK' }]
            );
            return;
        }

        console.log('[SignUp] Validation passed, starting signup...');
        setIsLoading(true);
        try {
            console.log('[SignUp] Calling supabase.auth.signUp...');
            // Sign up with Supabase - NO metadata to avoid trigger issues
            const { data, error } = await supabase.auth.signUp({
                email,
                password,
            });

            if (error) {
                console.error('[SignUp] Supabase error:', error);
                throw error;
            }

            console.log('[SignUp] ✅ Auth signup success, user_id:', data.user?.id);

            // Clear form
            setEmail('');
            setName('');
            setPassword('');

            // Navigate to sign-in - user will verify email and log in
            console.log('[SignUp] Navigating to sign-in for email verification');
            try {
                router.push('/(auth)/sign-in');
            } catch (error) {
                console.error('[SignUp] Navigation error:', error);
                router.replace('/(auth)/sign-in');
            }
        } catch (error: any) {
            console.error('[SignUp] ❌ Error:', error);
            console.error('[SignUp] Error message:', error.message);
            Alert.alert('Sign Up Error', error.message || 'Failed to create account');
        } finally {
            setIsLoading(false);
            console.log('[SignUp] Loading complete');
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
                        <Text style={styles.title}>Create Account</Text>
                        <Text style={styles.subtitle}>Sign up to get started</Text>

                        <TextInput
                            style={styles.input}
                            placeholder="Full Name"
                            placeholderTextColor="#999999"
                            value={name}
                            onChangeText={setName}
                            autoComplete="name"
                            editable={!isLoading}
                        />

                        <TextInput
                            style={styles.input}
                            placeholder="Email"
                            placeholderTextColor="#999999"
                            value={email}
                            onChangeText={setEmail}
                            keyboardType="email-address"
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
                            onPress={handleSignUp}
                            disabled={isLoading || !agreedToTerms}
                        >
                            {isLoading ? (
                                <ActivityIndicator color="#fff" />
                            ) : (
                                <Text style={[styles.buttonText, !agreedToTerms && styles.buttonTextDisabled]}>
                                    Sign Up
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
                       

                        <View style={styles.signInContainer}>
                            <Text style={styles.signInText}>Already have an account? </Text>
                            <TouchableOpacity onPress={() => {
                                setTimeout(() => {
                                    try {
                                        router.push('/(auth)/sign-in');
                                    } catch (error) {
                                        console.error('[SignUp] Navigation error:', error);
                                        router.replace('/(auth)/sign-in');
                                    }
                                }, 300);
                            }}>
                                <Text style={styles.signInLink}>Sign In</Text>
                            </TouchableOpacity>

                             
                        </View>

                         
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
    buttonDisabled: {
        backgroundColor: '#ccc',
        shadowOpacity: 0,
        elevation: 0,
    },
    buttonText: {
        color: '#ffffff',
        fontSize: 18,
        fontWeight: '700',
        letterSpacing: 1,
    },
    buttonTextDisabled: {
        color: '#999',
    },
    termsContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: 15,
        marginBottom: 15,
        paddingHorizontal: 5,
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
    signInContainer: {
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
        marginTop: 20,
    },
    signInText: {
        fontSize: 16,
        color: '#666',
    },
    signInLink: {
        fontSize: 16,
        color: '#C41E26',
        fontWeight: '700',
    },
});