import { Text, View, ActivityIndicator, StyleSheet } from "react-native";
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '../lib/supabase';
import { useRouter } from 'expo-router';
import { useEffect, useState, useRef } from "react";
import { syncOneSignalTokens } from '../utils/onesignal';

export default function AuthCheck() {
    const [isChecking, setIsChecking] = useState(true);
    const router = useRouter();
    const hasNavigatedRef = useRef(false);

    useEffect(() => {
        const checkAuth = async () => {
            // Prevent re-running if already navigated
            if (hasNavigatedRef.current) {
                return;
            }

            try {
                // Wait a bit for the navigator to be ready
                await new Promise(resolve => setTimeout(resolve, 100));

                // Direct Supabase session check - no context dependency
                const { data: { session }, error } = await supabase.auth.getSession();

                if (error) {
                    console.error('[AuthCheck] Session error:', error);
                    hasNavigatedRef.current = true;
                    router.replace('/(auth)/sign-in');
                    return;
                }

                               if (session?.user) {
                    console.log('[AuthCheck] Session found, user:', session.user.id);
                    hasNavigatedRef.current = true;

                    // Fire and forget OneSignal sync - don't block navigation
                    syncOneSignalTokens().catch(e => console.error('[AuthCheck] OneSignal Sync Failed', e));

                    // Navigate immediately so the UI doesn't freeze/crash
                    router.replace('/(tabs)/menu');
                } else {
                    console.log('[AuthCheck] No session found, allowing guest browsing');
                    hasNavigatedRef.current = true;
                    // Allow guest browsing by navigating to menu instead of sign-in
                    router.replace('/(tabs)/menu');
                }






                        } catch (error) {
                console.error('[AuthCheck] Error checking authentication:', error);
                // Wait before retrying navigation
                await new Promise(resolve => setTimeout(resolve, 500));
                hasNavigatedRef.current = true;
                // On error, default to menu as guest instead of forcing sign-in
                router.replace('/(tabs)/menu');
            } finally {
                setIsChecking(false);
            }
        };

        checkAuth();
    }, [router]);

    // If still loading, show a loading indicator
    if (isChecking) {
        return (
            <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
                <View style={styles.container}>
                    <ActivityIndicator size="large" color="#C41E26" />
                    <Text style={styles.text}>Checking authentication...</Text>
                </View>
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
            <View style={styles.container}>
                <ActivityIndicator size="large" color="#C41E26" />
                <Text style={styles.text}>Loading...</Text>
            </View>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    safeArea: {
        flex: 1,
        backgroundColor: '#f5f5f5',
    },
    container: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#f5f5f5',
    },
    text: {
        marginTop: 10,
        fontSize: 16,
        color: '#C41E26',
        fontWeight: '500',
    },
});
