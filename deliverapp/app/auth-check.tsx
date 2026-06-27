import { Text, View, ActivityIndicator, StyleSheet } from "react-native";
import { SafeAreaView } from 'react-native-safe-area-context';
import { isDeliveryPersonAuthenticated, getCurrentSession } from '../lib/delivery-auth';
import { useRouter } from 'expo-router';
import { useEffect, useState } from "react";

export default function AuthCheck() {
    const [isChecking, setIsChecking] = useState(true);
    const router = useRouter();

    useEffect(() => {
        const checkAuth = async () => {

            try {
                // Wait a bit for the navigator to be ready
                await new Promise(resolve => setTimeout(resolve, 100));
                
                const authenticated = await isDeliveryPersonAuthenticated();

                if (authenticated) {
                    const session = await getCurrentSession();
                    // Use replace to prevent back navigation to auth-check
                    router.replace("/(tabs)/orders");
                } else {
                    router.replace("/login");
                }
            } catch (error) {
                console.error('[AuthCheck] Error checking authentication:', error);
                // Wait before retrying navigation
                await new Promise(resolve => setTimeout(resolve, 500));
                router.replace("/login");
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
        color: '#C41E26', // AYAR Red - matches app scheme
        fontWeight: '500',
    },
});