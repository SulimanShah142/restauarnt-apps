import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Colors, Spacing, Typography, Shadow, HeaderHeight } from '@/lib/design-system';

interface HeaderProps {
  title: string;
  onMenuPress?: () => void;
  showMenu?: boolean;
  rightAction?: {
    icon: any;
    onPress: () => void;
  };
}

export default function Header({ title, onMenuPress, showMenu = true, rightAction }: HeaderProps) {
  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <View style={styles.container}>
        Left side - Menu button
        <View style={styles.leftSection}>
          {showMenu && onMenuPress && (
            <TouchableOpacity onPress={onMenuPress} style={styles.menuButton} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <Ionicons name="menu" size={24} color="#1A1A1A" />
            </TouchableOpacity>
          )}
          
          Title
          <Text style={styles.title} numberOfLines={1}>
            {title}
          </Text>
        </View>

        Right side - Optional action
        {rightAction && (
          <TouchableOpacity onPress={rightAction.onPress} style={styles.rightButton} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <Ionicons name={rightAction.icon} size={24} color={Colors.primary} />
          </TouchableOpacity>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    backgroundColor: Colors.surface,
  },
  container: {
    height: HeaderHeight,
    backgroundColor: Colors.surface,
    paddingHorizontal: Spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    ...Shadow.sm,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  leftSection: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  menuButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: Spacing.md,
  },
  title: {
    fontSize: Typography.fontSize.xl,
    fontWeight: Typography.fontWeight.bold,
    color: Colors.textPrimary,
    flex: 1,
  },
  rightButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
