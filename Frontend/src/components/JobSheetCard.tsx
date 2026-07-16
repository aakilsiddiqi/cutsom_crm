import React, { memo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { JobSheet } from '../types';
import { formatDate } from '../utils/formatting';
import { colors, spacing, radius, typography } from '../theme/tokens';
import { Icon } from './ui/Icon';
import { StatusBadge } from './ui/StatusBadge';

interface Props {
  jobSheet: JobSheet;
  onPress: () => void;
  onStatusUpdate?: (jobSheetId: string, newStatus: string) => void;
  onQuickStatusPress?: () => void;
}

export const JobSheetCard: React.FC<Props> = memo(({ jobSheet, onPress, onQuickStatusPress }) => (
  <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.7}>
    <View style={styles.topRow}>
      <View style={{ flex: 1 }}>
        {jobSheet.serial_number && (
          <Text style={styles.serial} allowFontScaling={false} numberOfLines={1}>{jobSheet.serial_number}</Text>
        )}
      </View>
      {jobSheet.priority === 'Urgent' && (
        <View style={styles.urgentPill}>
          <Icon name="flash-outline" size={10} color={colors.textInverse} />
          <Text style={styles.urgentText} allowFontScaling={false}>Urgent</Text>
        </View>
      )}
    </View>

    <View style={styles.header}>
      <Text style={styles.reg} allowFontScaling={false} numberOfLines={1}>{jobSheet.registration_number}</Text>
      <StatusBadge status={jobSheet.status} size="sm" />
    </View>

    <View style={styles.body}>
      <View style={styles.info}>
        <Text style={styles.detail} allowFontScaling={false} numberOfLines={1}>
          <Text style={styles.bold}>Cust: </Text>{jobSheet.customer_name || 'N/A'} {jobSheet.customer_mobile ? `(${jobSheet.customer_mobile})` : ''}
        </Text>
        <Text style={styles.detail} allowFontScaling={false} numberOfLines={1}>
          <Text style={styles.bold}>Model: </Text>{jobSheet.machine_model || 'N/A'}
        </Text>
        <Text style={styles.detail} allowFontScaling={false} numberOfLines={1}>
          <Text style={styles.bold}>Assigned: </Text>{jobSheet.assignee?.full_name || jobSheet.assignee?.username || 'Unassigned'}
        </Text>
        <Text style={styles.date} allowFontScaling={false} numberOfLines={1}>{formatDate(jobSheet.entry_date_time)}</Text>
      </View>
      <Icon name="chevron-forward-outline" size={20} color={colors.textTertiary} />
    </View>

    <View style={styles.bottomRow}>
      <View style={styles.locationPill}>
        <Icon
          name={jobSheet.service_location === 'On-Site' ? 'location-outline' : 'business-outline'}
          size={12}
          color={colors.textSecondary}
        />
        <Text style={styles.locationText} allowFontScaling={false}>{jobSheet.service_location || 'Workshop'}</Text>
      </View>
      {onQuickStatusPress && (
        <TouchableOpacity style={styles.quickBtn} onPress={onQuickStatusPress} activeOpacity={0.7}>
          <Icon name="swap-horizontal-outline" size={16} color={colors.headerBg} />
        </TouchableOpacity>
      )}
    </View>
  </TouchableOpacity>
));

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface, borderRadius: radius.lg, padding: spacing.md,
    marginVertical: spacing.xs, borderWidth: 1, borderColor: colors.border,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 6, elevation: 2,
  },
  topRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4, minHeight: 18 },
  serial: { ...typography.caption2, color: colors.textTertiary, fontWeight: '600' },
  urgentPill: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: colors.error,
    paddingHorizontal: spacing.xs, paddingVertical: 2, borderRadius: radius.sm, gap: 2,
  },
  urgentText: { ...typography.caption2, color: colors.textInverse, fontWeight: '700', fontSize: 9 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.sm },
  reg: { ...typography.callout, fontWeight: '700', color: colors.textPrimary, flexShrink: 1, marginRight: spacing.sm },
  body: { flexDirection: 'row', alignItems: 'center', marginBottom: spacing.sm },
  info: { flex: 1 },
  detail: { ...typography.footnote, color: colors.textSecondary, marginBottom: 1 },
  bold: { fontWeight: '600', color: colors.textPrimary },
  date: { ...typography.caption2, color: colors.textTertiary, marginTop: 2 },
  bottomRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border, paddingTop: spacing.sm,
  },
  locationPill: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: colors.bg,
    paddingHorizontal: spacing.sm, paddingVertical: 3, borderRadius: radius.sm,
    borderWidth: 1, borderColor: colors.border, gap: 4,
  },
  locationText: { ...typography.caption2, color: colors.textSecondary, fontWeight: '600' },
  quickBtn: {
    backgroundColor: colors.accent, width: 28, height: 28, borderRadius: 14,
    justifyContent: 'center', alignItems: 'center',
  },
});
