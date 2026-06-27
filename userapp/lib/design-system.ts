/**
 * AYAR Design System
 * Minimal, Modern, Red & White Theme
 */

export const Colors = {
  // Primary Brand Colors - Match splash screen darker red
  primary: '#C41E26',           // AYAR Red (darker, from splash screen)
  primaryDark: '#A31820',       // Darker red for press states
  primaryLight: '#D44A52',      // Lighter red for highlights
  
  // Neutral Colors
  white: '#FFFFFF',
  black: '#000000',
  
  // Background Colors
  background: '#FAFAFA',        // Very light gray background
  surface: '#FFFFFF',           // White cards/surfaces
  surfaceElevated: '#FFFFFF',   // Elevated surfaces with shadow
  
  // Border & Divider
  border: '#E5E5E5',            // Light borders
  divider: '#F0F0F0',           // Subtle dividers
  
  // Text Colors
  textPrimary: '#1A1A1A',       // Primary text (near black)
  textSecondary: '#666666',     // Secondary text (gray)
  textTertiary: '#999999',      // Tertiary text (light gray)
  textInverse: '#FFFFFF',       // Text on dark backgrounds
  
  // Status Colors
  success: '#10B981',           // Green for success/available
  warning: '#F59E0B',           // Amber for warnings
  error: '#EF4444',             // Red for errors/closed
  info: '#3B82F6',              // Blue for info
  
  // Overlay
  overlay: 'rgba(0, 0, 0, 0.5)',
  overlayLight: 'rgba(0, 0, 0, 0.3)',
};

export const Typography = {
  // Font Sizes
  fontSize: {
    xs: 11,
    sm: 13,
    md: 15,
    lg: 17,
    xl: 20,
    '2xl': 24,
    '3xl': 30,
    '4xl': 36,
  },
  
  // Font Weights (React Native compatible)
  fontWeight: {
    regular: '400' as const,
    medium: '500' as const,
    semibold: '600' as const,
    bold: '700' as const,
    extrabold: '800' as const,
    black: '900' as const,
  },
  
  // Letter Spacing
  letterSpacing: {
    tight: -0.5,
    normal: 0,
    wide: 1,
    wider: 2,
    widest: 8,
  },
};

export const Spacing = {
  // Padding & Margin
  none: 0,
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  '2xl': 24,
  '3xl': 32,
  '4xl': 40,
  '5xl': 48,
};

export const BorderRadius = {
  none: 0,
  sm: 4,
  md: 8,
  lg: 12,
  xl: 16,
  '2xl': 20,
  '3xl': 24,
  full: 9999,
};

export const Shadow = {
  sm: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 } as const,
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  md: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 } as const,
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  lg: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 } as const,
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 5,
  },
  xl: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 } as const,
    shadowOpacity: 0.2,
    shadowRadius: 16,
    elevation: 8,
  },
};

export const IconSize = {
  xs: 12,
  sm: 16,
  md: 20,
  lg: 24,
  xl: 28,
  '2xl': 32,
};

export const ButtonHeight = {
  sm: 36,
  md: 44,
  lg: 52,
};

export const HeaderHeight = 60;

// Common Style Presets
export const Presets = {
  card: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.lg,
    ...Shadow.md,
  },
  buttonPrimary: {
    backgroundColor: Colors.primary,
    borderRadius: BorderRadius.md,
    height: ButtonHeight.md,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  buttonSecondary: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: Colors.primary,
    borderRadius: BorderRadius.md,
    height: ButtonHeight.md,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  input: {
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.lg,
    height: ButtonHeight.md,
  },
  badge: {
    backgroundColor: Colors.primary,
    borderRadius: BorderRadius.full,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
  },
};

export default {
  Colors,
  Typography,
  Spacing,
  BorderRadius,
  Shadow,
  IconSize,
  ButtonHeight,
  HeaderHeight,
  Presets,
};
