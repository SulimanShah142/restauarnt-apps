import { Button, View, StyleSheet, Alert, Platform } from "react-native";
import { supabase } from '../lib/supabase';

// Type declarations for web globals
declare const window: any;

export default function SocialSignIn() {
    const handleGoogleLogin = async () => {
        try {
            // Note: Supabase OAuth requires server-side configuration
            // Make sure you have configured Google OAuth in your Supabase dashboard
            const { error } = await supabase.auth.signInWithOAuth({
                provider: 'google',
                options: {
                    redirectTo: Platform.OS === 'web' ? 
                        `${typeof window !== 'undefined' ? window.location.origin : ''}/auth/callback` : 
                        'userapp://',
                }
            });
            
            if (error) throw error;
        } catch (error: any) {
            // console.error('Social login error:', error);
            Alert.alert('Social login failed', error.message || 'An error occurred during social login');
        }
    };

    return (
        <View style={styles.container}>
            <Button title="Login with Google" onPress={handleGoogleLogin} />
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        justifyContent: 'center',
        padding: 20,
    }
});