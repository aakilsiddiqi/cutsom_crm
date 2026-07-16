import { TextStyle, ViewStyle } from 'react-native';

export const colors = {
  bg: '#F5F5F7',
  surface: '#FFFFFF',
  surfaceElevated: '#FFFFFF',
  border: '#E5E5EA',
  borderFocus: '#007AFF',
  borderError: '#FF3B30',

  textPrimary: '#1C1C1E',
  textSecondary: '#8E8E93',
  textTertiary: '#C7C7CC',
  textInverse: '#FFFFFF',

  accent: '#FFD700',
  accentLight: '#FFF8DC',
  accentDark: '#B8960F',

  success: '#34C759',
  successBg: '#E8F8ED',
  warning: '#FF9500',
  warningBg: '#FFF4E5',
  error: '#FF3B30',
  errorBg: '#FFF0EF',
  info: '#007AFF',
  infoBg: '#EBF5FF',

  statusQueue: '#FF9500',
  statusQueueBg: '#FFF4E5',
  statusProgress: '#007AFF',
  statusProgressBg: '#EBF5FF',
  statusCompleted: '#34C759',
  statusCompletedBg: '#E8F8ED',
  statusHold: '#FF3B30',
  statusHoldBg: '#FFF0EF',

  headerBg: '#1C1C1E',
  headerText: '#FFFFFF',
  headerAccent: '#FFD700',

  overlay: 'rgba(0,0,0,0.4)',
  shimmer: '#E5E5EA',
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  '2xl': 24,
  '3xl': 32,
  '4xl': 40,
  '5xl': 48,
  '6xl': 64,
};

export const typography: Record<string, TextStyle> = {
  largeTitle: { fontSize: 34, fontWeight: '700', lineHeight: 41, letterSpacing: 0.37 },
  title1: { fontSize: 28, fontWeight: '700', lineHeight: 34, letterSpacing: 0.36 },
  title2: { fontSize: 22, fontWeight: '700', lineHeight: 28, letterSpacing: 0.35 },
  title3: { fontSize: 20, fontWeight: '600', lineHeight: 25, letterSpacing: 0.38 },
  headline: { fontSize: 17, fontWeight: '600', lineHeight: 22, letterSpacing: -0.41 },
  body: { fontSize: 17, fontWeight: '400', lineHeight: 22, letterSpacing: -0.41 },
  callout: { fontSize: 16, fontWeight: '400', lineHeight: 21, letterSpacing: -0.32 },
  subhead: { fontSize: 15, fontWeight: '400', lineHeight: 20, letterSpacing: -0.24 },
  footnote: { fontSize: 13, fontWeight: '400', lineHeight: 18, letterSpacing: -0.08 },
  caption1: { fontSize: 12, fontWeight: '400', lineHeight: 16, letterSpacing: 0 },
  caption2: { fontSize: 11, fontWeight: '400', lineHeight: 13, letterSpacing: 0.07 },
};

export const radius = {
  sm: 6,
  md: 10,
  lg: 14,
  xl: 20,
  '2xl': 24,
  full: 999,
};

export const shadows: Record<string, ViewStyle> = {
  sm: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  md: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
  lg: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
    elevation: 8,
  },
};
