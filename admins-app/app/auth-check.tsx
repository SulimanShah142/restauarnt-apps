import React, { useEffect } from 'react';
import { View, ActivityIndicator, StyleSheet, Text } from 'react-native';
import { Redirect } from 'expo-router';
import { useAdminAuth } from '@/contexts/AdminAuthContext';

export default function AuthCheck() {
  const { isAdmin, isAdminLoading } = useAdminAuth();
  const [isChecking, setIsChecking] = React.useState(true);

  // Add a small delay to ensure auth context has fully propagated
  useEffect(() => {
    if (!isAdminLoading) {
      const timer = setTimeout(() => {
        setIsChecking(false);
      }, 200);
      return () => clearTimeout(timer);
    }
  }, [isAdminLoading]);

  // Show loading while checking auth or during the delay
  if (isAdminLoading || isChecking) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color="#C41E26" />
        <Text style={styles.loadingText}>Checking authentication...</Text>
      </View>
    );
  }

  // Redirect based on admin auth state
  if (isAdmin === true) {
    return <Redirect href="/admin/dashboard" />;
  }

  // Not authenticated - go to login
  return <Redirect href="/admin/login" />;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#666',
    fontWeight: '500',
  },
});
