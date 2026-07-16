import React, { memo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { JobSheet } from '../types';
import { getStatusColors } from '../utils/constants';
import { formatDate } from '../utils/formatting';

interface Props {
  jobSheet: JobSheet;
  onPress: () => void;
  onStatusUpdate?: (jobSheetId: string, newStatus: string) => void;
  onQuickStatusPress?: () => void;
}

export const JobSheetCard: React.FC<Props> = memo(({ jobSheet, onPress, onQuickStatusPress }) => {
  const statusColors = getStatusColors(jobSheet.status);

  return (
    <TouchableOpacity 
      style={styles.card} 
      onPress={onPress}
      activeOpacity={0.7}
    >
      {/* Top Row: Serial No + Urgent Badge */}
      <View style={styles.topRow}>
        <View style={styles.serialContainer}>
          {jobSheet.serial_number && (
            <Text style={styles.serialText} allowFontScaling={false} numberOfLines={1} ellipsizeMode="tail">
              {jobSheet.serial_number}
            </Text>
          )}
        </View>
        <View style={styles.topRightContainer}>
          {jobSheet.priority === 'Urgent' && (
            <View style={styles.urgentBadge}>
              <Text style={styles.urgentBadgeText} allowFontScaling={false}>⚡ URGENT</Text>
            </View>
          )}
        </View>
      </View>

      {/* Header: Reg No + Status */}
      <View style={styles.header}>
        <Text style={styles.registration} allowFontScaling={false} numberOfLines={1} ellipsizeMode="tail">
          {jobSheet.registration_number}
        </Text>
        <View style={[styles.badge, { backgroundColor: statusColors.bg }]}>
          <Text style={[styles.badgeText, { color: statusColors.text }]} allowFontScaling={false}>
            {jobSheet.status}
          </Text>
        </View>
      </View>

      {/* Body: Info */}
      <View style={styles.body}>
        <View style={styles.infoCol}>
          <Text style={styles.detailText} allowFontScaling={false} numberOfLines={1} ellipsizeMode="tail">
            <Text style={styles.bold}>Cust:</Text> {jobSheet.customer_name || 'N/A'} {jobSheet.customer_mobile ? `(${jobSheet.customer_mobile})` : ''}
          </Text>
          <Text style={styles.detailText} allowFontScaling={false} numberOfLines={1} ellipsizeMode="tail">
            <Text style={styles.bold}>Model:</Text> {jobSheet.machine_model || 'N/A'}
          </Text>
          <Text style={styles.detailText} allowFontScaling={false} numberOfLines={1} ellipsizeMode="tail">
            <Text style={styles.bold}>Assigned:</Text> {jobSheet.assignee?.full_name || jobSheet.assignee?.username || 'Unassigned'}
          </Text>
          <Text style={styles.dateText} allowFontScaling={false} numberOfLines={1} ellipsizeMode="tail">
            {formatDate(jobSheet.entry_date_time)}
          </Text>
        </View>
        <View style={styles.arrowCol}>
          <Text style={styles.arrow} allowFontScaling={false}>❯</Text>
        </View>
      </View>

      {/* Bottom Row: Location Badge + Quick Status Button */}
      <View style={styles.bottomRow}>
        <View style={styles.locationBadge}>
          <Text style={styles.locationText} allowFontScaling={false}>
            {jobSheet.service_location === 'On-Site' ? '📍 On-Site' : '🏭 Workshop'}
          </Text>
        </View>
        <TouchableOpacity 
          style={styles.quickStatusBtn} 
          onPress={onQuickStatusPress}
          activeOpacity={0.7}
        >
          <Text style={styles.quickStatusBtnText} allowFontScaling={false}>⚡</Text>
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
  );
});

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 12,
    marginVertical: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    borderWidth: 1,
    borderColor: '#eee',
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
    height: 18,
  },
  serialContainer: { flex: 1 },
  serialText: { fontSize: 11, color: '#999', fontWeight: 'bold' },
  topRightContainer: { flexDirection: 'row', alignItems: 'center' },
  urgentBadge: { backgroundColor: '#FF4444', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  urgentBadgeText: { color: '#fff', fontSize: 9, fontWeight: 'bold' },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  registration: { fontSize: 18, fontWeight: 'bold', color: '#333', flexShrink: 1, marginRight: 8 },
  badge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10 },
  badgeText: { fontWeight: 'bold', fontSize: 11 },
  body: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  infoCol: { flex: 1 },
  arrowCol: { paddingLeft: 8, justifyContent: 'center' },
  detailText: { fontSize: 13, color: '#555', marginBottom: 2, flexShrink: 1 },
  bold: { fontWeight: 'bold', color: '#333' },
  dateText: { fontSize: 11, color: '#888', marginTop: 2, flexShrink: 1 },
  arrow: { fontSize: 16, color: '#ccc', fontWeight: 'bold' },
  bottomRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
    paddingTop: 8,
  },
  locationBadge: { backgroundColor: '#f5f5f5', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6, borderWidth: 1, borderColor: '#eee' },
  locationText: { fontSize: 11, color: '#555', fontWeight: '600' },
  quickStatusBtn: { backgroundColor: '#FFD700', width: 30, height: 30, borderRadius: 15, justifyContent: 'center', alignItems: 'center', elevation: 2 },
  quickStatusBtnText: { fontSize: 14, color: '#1a1a2e' },
});
