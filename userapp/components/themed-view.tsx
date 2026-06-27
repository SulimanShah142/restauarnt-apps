
import { View } from 'react-native';
import type { ViewProps, ViewStyle } from 'react-native';

import { useThemeColor } from '../hooks/use-theme-color';

export type ThemedViewProps = Omit<ViewProps, 'style'> & {
  lightColor?: string;
  darkColor?: string;
  style?: ViewStyle;
};

export function ThemedView({ style, lightColor, darkColor, ...otherProps }: ThemedViewProps) {
  const backgroundColor = useThemeColor({ light: lightColor, dark: darkColor }, 'background');

  return <View style={[{ backgroundColor } as ViewStyle, style]} {...otherProps} />;
}
