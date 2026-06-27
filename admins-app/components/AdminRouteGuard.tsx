// components/AdminRouteGuard.tsx

import React from 'react';
import { View, Text, ActivityIndicator } from 'react-native';
import { useAuth } from '@/contexts/AuthContext';
import { Redirect } from 'expo-router';

interface AdminRouteGuardProps {
  children: React.ReactNode;
  requireAuth?: boolean; // If true, requires authentication; if false, redirects away if authenticated
}

const AdminRouteGuard: React.FC<AdminRouteGuardProps> = ({
  children,
  requireAuth = true
}) => {
  const { isAuthenticated, loading } = useAuth();

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color="#C41E26" />
        <Text>Loading admin authentication...</Text>
      </View>
    );
  }

  // Handle auth requirement - redirect if needed
  if (requireAuth && !isAuthenticated) {
    return <Redirect href="/admin/login" />;
  }

  if (!requireAuth && isAuthenticated) {
    return <Redirect href="/admin/dashboard" />;
  }

  // Render children if auth requirement is met
  return <>{children}</>;
};

export default AdminRouteGuard;