import { View, TouchableOpacity, Text, StyleSheet, Alert, Platform, ScrollView } from "react-native";
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '../lib/supabase';

export default function SocialSignIn() {
    const handleGoogleLogin = async () => {
        try {
            // Note: Supabase OAuth requires server-side configuration
            // Make sure you have configured Google OAuth in your Supabase dashboard
            const { error } = await supabase.auth.signInWithOAuth({
                provider: 'google',
                options: {
                    redirectTo: Platform.OS === 'web' ?
                        `${typeof window !== 'undefined' ? (window as any).location.origin : ''}/auth/callback` :
                        'deliverapp://',
                }
            });

            if (error) throw error;
        } catch (error: any) {
            console.error('Social login error:', error);
            Alert.alert('Social login failed', error.message || 'An error occurred during social login');
        }
    };

    return (
        <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
            <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
                <View style={styles.container}>
                    <TouchableOpacity style={styles.googleButton} onPress={handleGoogleLogin}>
                        <Text style={styles.googleButtonText}>Login with Google</Text>
                    </TouchableOpacity>
                </View>
            </ScrollView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    safeArea: {
        flex: 1,
        backgroundColor: '#f5f5f5',
    },
    scrollView: {
        flex: 1,
        backgroundColor: '#f5f5f5',
    },
    scrollContent: {
        flexGrow: 1,
    },
    container: {
        flex: 1,
        justifyContent: 'center',
        padding: 20,
    },
    googleButton: {
        backgroundColor: '#C41E26',
        padding: 15,
        borderRadius: 8,
        alignItems: 'center',
        marginVertical: 10,
    },
    googleButtonText: {
        color: 'white',
        fontSize: 16,
        fontWeight: 'bold',
    }
});