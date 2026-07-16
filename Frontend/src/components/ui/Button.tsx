import React, { useRef } from 'react';
import {
  TouchableOpacity,
  Text,
  StyleSheet,
  ActivityIndicator,
  View,
  Animated,
  Platform,
} from 'react-native';
import { colors, typography, radius, spacing, shadows } from '../../theme/tokens';
import { Icon } from './Icon';

type ButtonVariant = 'primary' | 'secondary' | 'tonal' | 'ghost' | 'danger';
type ButtonSize = 'sm' | 'md' | 'lg';

interface ButtonProps {
  title: string;
  onPress: () => void;
  variant?: ButtonVariant;
  size?: ButtonSize;
  icon?: React.ComponentProps<typeof Icon>['name'];
  iconPosition?: 'left' | 'right';
  loading?: boolean;
  disabled?: boolean;
  fullWidth?: boolean;
  accessibilityLabel?: string;
}

export const Button: React.FC<ButtonProps> = ({
  title,
  onPress,
  variant = 'primary',
  size = 'md',
  icon,
  iconPosition = 'left',
  loading = false,
  disabled = false,
  fullWidth = false,
  accessibilityLabel,
}) => {
  const scaleAnim = useRef(new Animated.Value(1)).current;

  const handlePressIn = () => {
    Animated.spring(scaleAnim, {
      toValue: 0.97,
      useNativeDriver: true,
      speed: 50,
      bounciness: 4,
    }).start();
  };

  const handlePressOut = () => {
    Animated.spring(scaleAnim, {
      toValue: 1,
      useNativeDriver: true,
      speed: 50,
      bounciness: 4,
    }).start();
  };

  const variantStyles = getVariantStyles(variant);
  const sizeStyles = getSizeStyles(size);
  const iconSize = size === 'sm' ? 16 : size === 'lg' ? 22 : 18;

  return (
    <Animated.View style={[{ transform: [{ scale: scaleAnim }] }, fullWidth && { width: '100%' }]}>
      <TouchableOpacity
        onPress={onPress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        activeOpacity={0.85}
        disabled={disabled || loading}
        accessibilityLabel={accessibilityLabel || title}
        accessibilityRole="button"
        accessibilityState={{ disabled: disabled || loading }}
        style={[
          styles.base,
          variantStyles.container,
          sizeStyles.container,
          disabled && styles.disabled,
          fullWidth && styles.fullWidth,
        ]}
      >
        {loading ? (
          <ActivityIndicator
            size="small"
            color={variantStyles.activityColor}
          />
        ) : (
          <View style={styles.content}>
            {icon && iconPosition === 'left' && (
              <Icon
                name={icon}
                size={iconSize}
                color={variantStyles.textColor}
                accessibilityLabel={undefined}
              />
            )}
            <Text
              style={[
                variantStyles.text,
                sizeStyles.text,
                icon ? { marginHorizontal: spacing.sm } : {},
              ]}
              allowFontScaling={false}
            >
              {title}
            </Text>
            {icon && iconPosition === 'right' && (
              <Icon
                name={icon}
                size={iconSize}
                color={variantStyles.textColor}
                accessibilityLabel={undefined}
              />
            )}
          </View>
        )}
      </TouchableOpacity>
    </Animated.View>
  );
};

function getVariantStyles(variant: ButtonVariant) {
  switch (variant) {
    case 'primary':
      return {
        container: { backgroundColor: colors.accent },
        text: { color: colors.textPrimary } as const,
        textColor: colors.textPrimary,
        activityColor: colors.textPrimary,
      };
    case 'secondary':
      return {
        container: { backgroundColor: colors.headerBg },
        text: { color: colors.textInverse } as const,
        textColor: colors.textInverse,
        activityColor: colors.textInverse,
      };
    case 'tonal':
      return {
        container: { backgroundColor: colors.accentLight },
        text: { color: colors.accentDark } as const,
        textColor: colors.accentDark,
        activityColor: colors.accentDark,
      };
    case 'ghost':
      return {
        container: { backgroundColor: 'transparent' },
        text: { color: colors.info } as const,
        textColor: colors.info,
        activityColor: colors.info,
      };
    case 'danger':
      return {
        container: { backgroundColor: colors.error },
        text: { color: colors.textInverse } as const,
        textColor: colors.textInverse,
        activityColor: colors.textInverse,
      };
  }
}

function getSizeStyles(size: ButtonSize) {
  switch (size) {
    case 'sm':
      return {
        container: { paddingVertical: spacing.sm, paddingHorizontal: spacing.md, borderRadius: radius.sm },
        text: { ...typography.subhead, fontWeight: '600' } as const,
      };
    case 'md':
      return {
        container: { paddingVertical: spacing.md, paddingHorizontal: spacing.xl, borderRadius: radius.md },
        text: { ...typography.callout, fontWeight: '600' } as const,
      };
    case 'lg':
      return {
        container: { paddingVertical: spacing.lg, paddingHorizontal: spacing['2xl'], borderRadius: radius.lg },
        text: { ...typography.headline } as const,
      };
  }
}

const styles = StyleSheet.create({
  base: {
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
  },
  disabled: {
    opacity: 0.4,
  },
  fullWidth: {
    width: '100%',
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
