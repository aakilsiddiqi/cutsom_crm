import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors, typography, spacing } from '../../theme/tokens';

interface SectionHeaderProps {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
}

export const SectionHeader: React.FC<SectionHeaderProps> = ({ title, subtitle, action }) => (
  <View style={styles.container}>
    <View style={styles.textContainer}>
      <Text style={styles.title} allowFontScaling={false}>{title}</Text>
      {subtitle && <Text style={styles.subtitle} allowFontScaling={false}>{subtitle}</Text>}
    </View>
    {action && <View style={styles.action}>{action}</View>}
  </View>
);

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: spacing.md,
    paddingHorizontal: spacing.lg,
  },
  textContainer: {
    flex: 1,
  },
  title: {
    ...typography.title3,
    color: colors.textPrimary,
  },
  subtitle: {
    ...typography.footnote,
    color: colors.textSecondary,
    marginTop: 2,
  },
  action: {
    marginLeft: spacing.md,
  },
});
