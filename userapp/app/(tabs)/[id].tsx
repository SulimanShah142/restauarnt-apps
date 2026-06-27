import React from 'react';
import { View, Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function RestaurantDetailScreen() {
  return (
    <SafeAreaView>
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <Text>Restaurant Detail Screen</Text>
      </View>
    </SafeAreaView>
  );
}