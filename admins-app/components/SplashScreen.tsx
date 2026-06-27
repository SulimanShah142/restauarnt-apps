import React, { useEffect } from 'react';
import { View, StyleSheet, Image, Dimensions, Platform } from 'react-native';

interface SplashScreenProps {
  onFinish: () => void;
}

export default function SplashScreen({ onFinish }: SplashScreenProps) {
  useEffect(() => {
    // Simple timer to finish splash after 2 seconds
    const timer = setTimeout(() => {
      onFinish();
    }, 2000);

    return () => clearTimeout(timer);
  }, [onFinish]);

  // Calculate logo size at render time for responsive sizing
  const screenWidth = Dimensions.get('window').width;
  const isWeb = Platform.OS === 'web';
  
  // Much smaller logo sizes to ensure full visibility
  const logoSize = isWeb 
    ? Math.min(screenWidth * 0.25, 250)  // On web: 25% of screen width, max 250px
    : screenWidth * 0.5;  // On mobile: 50% of screen width

  return (
    <View style={styles.container}>
      <Image
        source={require('../assets/images/splash-screen.jpg')}
        style={[styles.logo, { width: logoSize, height: logoSize }]}
        resizeMode="contain"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    width: '100%',
    height: '100%',
    backgroundColor: '#C41E26', // Darker AYAR Red - matches splash screen exactly
    justifyContent: 'center',
    alignItems: 'center',
  },
  logo: {
    // Size is set inline for responsive behavior
  },
});
