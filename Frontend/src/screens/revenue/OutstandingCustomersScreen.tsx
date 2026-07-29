import React, { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator, RefreshControl, Platform,
} from 'react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { ScreenWrapper, HeaderBar, Card, Icon, EmptyState } from '../../components/ui';
import { colors, spacing, radius, typography } from '../../theme/tokens';
import { AdminStackParamList, OutstandingCustomer } from '../../types';
import { getOutstandingCustomers } from '../../services/customer';

type NavigationProp = NativeStackNavigationProp<AdminStackParamList, 'OutstandingCustomers'>;

const fmtCurrency = (v: number) => '₹ ' + Math.round(v).toLocaleString('en-IN');

const STATUS_CONFIG = {
  critical: { label: 'Overdue', color: colors.error, bg: colors.errorBg },
  warning: { label: 'Pending', color: colors.warning, bg: colors.warningBg },
  good: { label: 'Current', color: colors.success, bg: colors.successBg },
} as const;

export const OutstandingCustomersScreen = () => {
  const navigation = useNavigation<NavigationProp>();
  const [customers, setCustomers] = useState<OutstandingCustomer[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useFocusEffect(
    useCallback(() => {
      let mounted = true;
      setLoading(true);
      getOutstandingCustomers()
        .then((data) => { if (mounted) setCustomers(data); })
        .catch(() => {})
        .finally(() => { if (mounted) setLoading(false); });
      return () => { mounted = false; };
    }, [])
  );

  const exportCSV = useCallback(async () => {
    const headers = 'Customer Name,Outstanding Amount,Total Revenue,Total Paid,Pending Amount,Transactions,Last Transaction,Status\n';
    const rows = customers.map((c) => {
      const cfg = STATUS_CONFIG[c.status];
      return [
        `"${c.customer.name}"`,
        c.total_outstanding,
        c.total_revenue,
        c.total_paid,
        c.pending_amount,
        c.transaction_count,
        c.last_transaction_date ? new Date(c.last_transaction_date).toLocaleDateString('en-IN') : '',
        cfg.label,
      ].join(',');
    }).join('\n');
    const csv = '\uFEFF' + headers + rows;
    const uri = FileSystem.documentDirectory + `customer_outstanding_${Date.now()}.csv`;
    await FileSystem.writeAsStringAsync(uri, csv, { encoding: FileSystem.EncodingType.UTF8 });
    await Sharing.shareAsync(uri, { mimeType: 'text/csv' });
  }, [customers]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    getOutstandingCustomers()
      .then(setCustomers)
      .catch(() => {})
      .finally(() => setRefreshing(false));
  }, []);

  const renderItem = ({ item }: { item: OutstandingCustomer }) => {
    const cfg = STATUS_CONFIG[item.status];
    return (
      <TouchableOpacity
        style={styles.row}
        onPress={() => navigation.navigate('CustomerDetail', { customerId: item.customer.name })}
        activeOpacity={0.7}
      >
        <View style={styles.rowTop}>
          <Text style={styles.customerName}>{item.customer.name}</Text>
          <View style={[styles.statusBadge, { backgroundColor: cfg.bg }]}>
            <Text style={[styles.statusText, { color: cfg.color }]}>{cfg.label}</Text>
          </View>
        </View>
        <View style={styles.rowMiddle}>
          <View style={styles.amountGroup}>
            <Text style={styles.amountLabel}>Outstanding</Text>
            <Text style={[styles.amountValue, { color: colors.error }]}>{fmtCurrency(item.total_outstanding)}</Text>
          </View>
          <View style={styles.amountGroup}>
            <Text style={styles.amountLabel}>Total Due</Text>
            <Text style={styles.amountValue}>{fmtCurrency(item.total_revenue)}</Text>
          </View>
        </View>
        <View style={styles.rowBottom}>
          <Text style={styles.meta}>Txn: {item.transaction_count}</Text>
          {item.last_transaction_date && (
            <Text style={styles.meta}>Last: {new Date(item.last_transaction_date).toLocaleDateString('en-IN')}</Text>
          )}
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <ScreenWrapper>
      <HeaderBar
        title="Outstanding Customers"
        onBack={() => navigation.navigate('RevenueDashboard')}
        rightAction={customers.length > 0 ? (
          <TouchableOpacity onPress={exportCSV} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Icon name="download-outline" size={22} color={colors.headerText} />
          </TouchableOpacity>
        ) : undefined}
      />
      {loading && !refreshing ? (
        <View style={styles.center}><ActivityIndicator size="large" color={colors.accent} /></View>
      ) : (
        <FlatList
          data={customers}
          keyExtractor={(_, i) => String(i)}
          renderItem={renderItem}
          contentContainerStyle={customers.length === 0 ? styles.emptyList : styles.list}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accent} />}
          ListEmptyComponent={
            <EmptyState icon="happy-outline" title="All clear!" message="No outstanding customers." />
          }
          showsVerticalScrollIndicator={false}
        />
      )}
    </ScreenWrapper>
  );
};

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  list: { padding: spacing.lg, paddingBottom: spacing['5xl'] },
  emptyList: { flexGrow: 1, justifyContent: 'center' },
  row: {
    backgroundColor: colors.surface, borderRadius: radius.lg, padding: spacing.lg,
    marginBottom: spacing.md, borderWidth: 1, borderColor: colors.border,
  },
  rowTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.md },
  customerName: { ...typography.headline, color: colors.textPrimary, flex: 1, marginRight: spacing.sm },
  statusBadge: { paddingHorizontal: spacing.md, paddingVertical: spacing.xs, borderRadius: radius.full },
  statusText: { fontSize: 12, fontWeight: '700' },
  rowMiddle: { flexDirection: 'row', gap: spacing.xl, marginBottom: spacing.md },
  amountGroup: { flex: 1 },
  amountLabel: { fontSize: 12, color: colors.textTertiary, marginBottom: 2 },
  amountValue: { fontSize: 18, fontWeight: '700', color: colors.textPrimary },
  rowBottom: { flexDirection: 'row', gap: spacing.xl },
  meta: { fontSize: 12, color: colors.textSecondary },
});
