import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors, typography, radius, spacing } from '../../theme/tokens';

interface StatusBadgeProps {
  status: string;
  size?: 'sm' | 'md';
}

const statusConfig: Record<string, { bg: string; text: string; label: string }> = {
  'In Queue': { bg: colors.statusQueueBg, text: colors.statusQueue, label: 'In Queue' },
  'In Progress': { bg: colors.statusProgressBg, text: colors.statusProgress, label: 'In Progress' },
  Completed: { bg: colors.statusCompletedBg, text: colors.statusCompleted, label: 'Completed' },
  'On Hold': { bg: colors.statusHoldBg, text: colors.statusHold, label: 'On Hold' },
};

const defaultConfig = { bg: colors.shimmer, text: colors.textSecondary, label: 'Unknown' };

export const StatusBadge: React.FC<StatusBadgeProps> = ({ status, size = 'sm' }) => {
  const config = statusConfig[status] || defaultConfig;
  const isSmall = size === 'sm';

  return (
    <View style={[styles.badge, { backgroundColor: config.bg }, isSmall ? styles.small : styles.medium]}>
      <View style={[styles.dot, { backgroundColor: config.text }]} />
      <Text
        style={[styles.label, { color: config.text }, isSmall ? styles.smallText : styles.mediumText]}
        allowFontScaling={false}
        numberOfLines={1}
      >
        {config.label}
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    borderRadius: radius.full,
  },
  small: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
  },
  medium: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: spacing.xs,
  },
  label: {
    fontWeight: '600',
  },
  smallText: {
    ...typography.caption2,
  },
  mediumText: {
    ...typography.footnote,
  },
});
