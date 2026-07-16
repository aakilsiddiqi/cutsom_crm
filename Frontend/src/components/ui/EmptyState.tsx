import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors, typography, spacing } from '../../theme/tokens';
import { Icon } from './Icon';

interface EmptyStateProps {
  icon: React.ComponentProps<typeof Icon>['name'];
  title: string;
  message?: string;
}

export const EmptyState: React.FC<EmptyStateProps> = ({ icon, title, message }) => (
  <View style={styles.container}>
    <View style={styles.iconWrap}>
      <Icon name={icon} size={40} color={colors.textTertiary} />
    </View>
    <Text style={styles.title} allowFontScaling={false}>{title}</Text>
    {message && <Text style={styles.message} allowFontScaling={false}>{message}</Text>}
  </View>
);

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing['6xl'],
    paddingHorizontal: spacing['3xl'],
  },
  iconWrap: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: colors.bg,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.lg,
  },
  title: {
    ...typography.title3,
    color: colors.textPrimary,
    textAlign: 'center',
    marginBottom: spacing.sm,
  },
  message: {
    ...typography.subhead,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
  },
});
