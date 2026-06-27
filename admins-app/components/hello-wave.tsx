import Animated, { useAnimatedStyle, useSharedValue, withRepeat, withTiming, Easing } from 'react-native-reanimated';
import { useEffect } from 'react';

export function HelloWave() {
  const rotationAnimation = useSharedValue(0);

  useEffect(() => {
    rotationAnimation.value = withRepeat(
      withTiming(25, { duration: 300, easing: Easing.inOut(Easing.ease) }),
      4, // Repeat 4 times
      false // Reverse direction
    );
  }, []);

  const animatedStyle = useAnimatedStyle(() => {
    return {
      fontSize: 28,
      lineHeight: 32,
      marginTop: -6,
      transform: [{ rotate: `${rotationAnimation.value}deg` }],
    };
  });

  return (
    <Animated.Text style={animatedStyle}>
      👋
    </Animated.Text>
  );
}
