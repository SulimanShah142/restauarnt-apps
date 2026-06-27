import React, { useState, useEffect } from 'react';
import { View, ActivityIndicator, StyleSheet, Text } from 'react-native';
import { Redirect } from 'expo-router';
import { useAdminAuth } from '@/contexts/AdminAuthContext';

export default function HomeScreen() {
  const { isAdmin, isAdminLoading } = useAdminAuth();

  // Always wait for loading to complete - no timeout redirect
  if (isAdminLoading) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color="#C41E26" />
        <Text style={styles.loadingText}>Loading...</Text>
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
