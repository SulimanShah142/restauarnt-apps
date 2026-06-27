import { useState, useEffect } from "react";
import { View, TextInput, Button, StyleSheet, Alert, ActivityIndicator, ScrollView, KeyboardAvoidingView, Platform, TouchableOpacity, Text } from "react-native";
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '../lib/supabase';
import { router, useRootNavigation } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { authenticateDeliveryPerson, storeDeliverySession } from '../lib/delivery-auth';
import { syncOneSignalTokens } from '@/utils/onesignal';
import * as WebBrowser from 'expo-web-browser';
import Checkbox from 'expo-checkbox';

export default function SignIn() {
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [showPassword, setShowPassword] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [isNavigationReady, setIsNavigationReady] = useState(false);
    const [deliveryPersonEmail, setDeliveryPersonEmail] = useState<string | null>(null);
    const [isAgreed, setIsAgreed] = useState(false);

    const rootNavigation = useRootNavigation();

    useEffect(() => {
        if (rootNavigation) {
            setIsNavigationReady(true);
        }
    }, [rootNavigation]);

    // Opens your Google Site privacy URL
    const openPrivacyPolicy = () => {
        WebBrowser.openBrowserAsync('https://sites.google.com/view/policy-web-deliver/deliver-app-privacy-policy');
    };

    const handleLogin = async () => {
        // 1. Privacy Policy Validation
        if (!isAgreed) {
            Alert.alert(
                'Privacy Policy', 
                'You must accept the Privacy Policy to continue using the AYAR Delivery Partner app.'
            );
            return;
        }

        // 2. Form Field Validations
        if (!email.trim()) {
            Alert.alert('Validation Error', 'Please enter a valid email address.');
            return;
        }

        if (!password) {
            Alert.alert('Validation Error', 'Please enter your password.');
            return;
        }

        setIsLoading(true);
        try {
            // Use custom delivery person authentication
            const deliveryPerson = await authenticateDeliveryPerson(email, password);

            // Store the session details to disk
            await storeDeliverySession(deliveryPerson);

            // Clear form fields immediately
            setEmail('');
            setPassword('');

            // Force a small delay to ensure native disk write commits safely
            await new Promise(resolve => setTimeout(resolve, 500));

            // Sync OneSignal tokens (Non-blocking background thread)
            if (deliveryPerson?.email) {
                setDeliveryPersonEmail(deliveryPerson.email);

                console.log('[SignIn] Spawning background OneSignal token sync...');
                // 💡 NO AWAIT HERE: Let it process without holding the navigation flow hostage
                syncOneSignalTokens()
                    .then(() => console.log('[SignIn] ✅ OneSignal tokens sync sequence finished'))
                    .catch((err) => console.error('[SignIn] OneSignal background sync error:', err));
            }

            // Redirect to auth-check immediately
            console.log('[SignIn] Session established. Navigating to auth-check...');
            if (isNavigationReady) {
                router.replace('/auth-check');
            } else {
                setTimeout(() => {
                    router.replace('/auth-check');
                }, 100);
            }
        } catch (error: any) {
            console.error('Login error:', error);
            let errorMessage = 'Failed to login. Please check your credentials.';

            if (error?.message) {
                errorMessage = error.message;
            } else if (typeof error === 'string') {
                errorMessage = error;
            }

            Alert.alert('Error', errorMessage);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <KeyboardAvoidingView
            style={styles.keyboardView}
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
            <SafeAreaView style={styles.safeArea}>
                <ScrollView contentContainerStyle={styles.scrollContent}>
                    <View style={styles.container}>
                        <Text style={styles.title}>Delivery Partner</Text>
                        <Text style={styles.subtitle}>Sign in to continue</Text>

                        <TextInput
                            style={styles.input}
                            placeholder="Email"
                            value={email}
                            onChangeText={setEmail}
                            autoCapitalize="none"
                            keyboardType="email-address"
                            editable={!isLoading}
                        />

                        <View style={styles.passwordInputContainer}>
                            <TextInput
                                style={styles.passwordTextInput}
                                placeholder="Password"
                                value={password}
                                onChangeText={setPassword}
                                secureTextEntry={!showPassword}
                                editable={!isLoading}
                            />
                            <TouchableOpacity style={styles.eyeIcon} onPress={() => setShowPassword(!showPassword)}>
                                <Ionicons name={showPassword ? 'eye-off' : 'eye'} size={20} color="#666" />
                            </TouchableOpacity>
                        </View>

                        {/* PRIVACY POLICY CHECKBOX SECTION */}
                        <View style={styles.checkboxContainer}>
                            <Checkbox
                                value={isAgreed}
                                onValueChange={setIsAgreed}
                                color={isAgreed ? '#C41E26' : undefined}
                                style={styles.checkbox}
                            />
                            <Text style={styles.checkboxLabel}>
                                I accept the{' '}
                                <Text style={styles.linkText} onPress={openPrivacyPolicy}>
                                    Privacy Policy
                                </Text>
                            </Text>
                        </View>

                        {/* LOGIN BUTTON */}
                        <TouchableOpacity
                            style={[
                                styles.button, 
                                (isLoading || !isAgreed) && styles.buttonDisabled
                            ]}
                            onPress={handleLogin}
                            disabled={isLoading || !isAgreed}
                        >
                            {isLoading ? (
                                <ActivityIndicator color="#fff" />
                            ) : (
                                <Text style={styles.buttonText}>Sign In</Text>
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
    passwordInputContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        borderWidth: 2,
        borderColor: '#C41E26',
        borderRadius: 8,
        backgroundColor: 'white',
        marginBottom: 15,
    },
    passwordTextInput: {
        flex: 1,
        padding: 15,
        fontSize: 16,
    },
    eyeIcon: {
        paddingHorizontal: 15,
    },
    checkboxContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 25,
        paddingHorizontal: 5
    },
    checkbox: {
        marginRight: 10,
        borderRadius: 4,
        borderColor: '#C41E26',
        borderWidth: 2,
        width: 20,
        height: 20
    },
    checkboxLabel: {
        fontSize: 14,
        color: '#444',
        flex: 1
    },
    linkText: {
        color: '#C41E26',
        fontWeight: 'bold',
        textDecorationLine: 'underline'
    },
    button: {
        backgroundColor: '#C41E26',
        padding: 15,
        borderRadius: 8,
        alignItems: 'center',
        justifyContent: 'center',
        marginTop: 10,
    },
    buttonDisabled: {
        backgroundColor: '#e0a6a8',
    },
    buttonText: {
        color: '#ffffff',
fontSize: 16,fontWeight: 'bold',},signUpContainer: {flexDirection: 'row',justifyContent: 'center',marginTop: 25,},signUpText: {color: '#666',fontSize: 14,},signUpLink: {color: '#C41E26',fontWeight: 'bold',fontSize: 14,}});