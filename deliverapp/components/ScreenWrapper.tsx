/**
 * ScreenWrapper Component - Deliver App
 * 
 * Provides consistent safe area handling across all screens
 * - Uses SafeAreaView from react-native-safe-area-context
 * - Adds proper status bar spacing for native
 * - Configures StatusBar appearance
 * - Works on both web and native platforms
 */

import React from 'react';
import { View, StyleSheet, Platform, StatusBar as ExpoStatusBar } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useColorScheme } from '@/hooks/use-color-scheme';

interface ScreenWrapperProps {
  children: React.ReactNode;
  style?: any;
  backgroundColor?: string;
  statusBarStyle?: 'dark' | 'light' | 'auto';
  edges?: ('top' | 'bottom' | 'left' | 'right')[];
}

export default function ScreenWrapper({
  children,
  style,
  backgroundColor,
  statusBarStyle = 'auto',
  edges = ['top', 'bottom'],
}: ScreenWrapperProps) {
  const colorScheme = useColorScheme();
  const bgColor = backgroundColor || (colorScheme === 'dark' ? '#000000' : '#ffffff');
  
  const barStyle = statusBarStyle === 'auto' 
    ? (colorScheme === 'dark' ? 'light-content' : 'dark-content')
    : (statusBarStyle === 'light' ? 'light-content' : 'dark-content');

  return (
    <>
      <ExpoStatusBar 
        barStyle={barStyle} 
        backgroundColor={bgColor}
        translucent={Platform.OS === 'android'}
      />
      
      {Platform.OS === 'web' ? (
        <View style={[styles.webContainer, { backgroundColor: bgColor }, style]}>
          {children}
        </View>
      ) : (
        <SafeAreaView 
          style={[styles.container, { backgroundColor: bgColor }, style]}
          edges={edges}
        >
          {children}
        </SafeAreaView>
      )}
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  webContainer: {
    flex: 1,
    paddingTop: Platform.OS === 'web' ? 8 : undefined,
  },
});
