import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';
import { colors, typography, radius, spacing, shadows } from '../../theme/tokens';
import { Icon } from './Icon';

interface StatCardProps {
  label: string;
  value: string | number;
  icon: React.ComponentProps<typeof Icon>['name'];
  color: string;
  bg?: string;
}

export const StatCard: React.FC<StatCardProps> = ({ label, value, icon, color, bg }) => {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.95)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 400,
        useNativeDriver: true,
      }),
      Animated.spring(scaleAnim, {
        toValue: 1,
        friction: 8,
        tension: 40,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  return (
    <Animated.View
      style={[
        styles.card,
        shadows.sm,
        { opacity: fadeAnim, transform: [{ scale: scaleAnim }] },
      ]}
    >
      <View style={[styles.iconWrap, { backgroundColor: bg || `${color}15` }]}>
        <Icon name={icon} size={20} color={color} />
      </View>
      <Text style={styles.value} allowFontScaling={false}>
        {value}
      </Text>
      <Text style={styles.label} allowFontScaling={false}>
        {label}
      </Text>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.lg,
    width: '48%',
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  iconWrap: {
    width: 36,
    height: 36,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  value: {
    ...typography.largeTitle,
    color: colors.textPrimary,
    marginBottom: 2,
  },
  label: {
    ...typography.footnote,
    color: colors.textSecondary,
    fontWeight: '500',
  },
});
