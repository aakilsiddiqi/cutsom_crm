import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { colors, typography, spacing } from '../../theme/tokens';
import { Icon } from './Icon';

interface HeaderBarProps {
  title: string;
  onBack?: () => void;
  rightAction?: React.ReactNode;
}

export const HeaderBar: React.FC<HeaderBarProps> = ({ title, onBack, rightAction }) => (
  <View style={styles.container}>
    <View style={styles.left}>
      {onBack && (
        <TouchableOpacity onPress={onBack} style={styles.backBtn} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <Icon name="chevron-back" size={24} color={colors.headerText} />
        </TouchableOpacity>
      )}
    </View>
    <Text style={styles.title} numberOfLines={1} allowFontScaling={false}>{title}</Text>
    <View style={styles.right}>
      {rightAction}
    </View>
  </View>
);

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    backgroundColor: colors.headerBg,
    minHeight: 52,
  },
  left: {
    width: 40,
    alignItems: 'flex-start',
  },
  right: {
    width: 40,
    alignItems: 'flex-end',
  },
  title: {
    flex: 1,
    textAlign: 'center',
    color: colors.headerAccent,
    ...typography.headline,
  },
  backBtn: {
    padding: spacing.xs,
    marginLeft: -spacing.xs,
  },
});
