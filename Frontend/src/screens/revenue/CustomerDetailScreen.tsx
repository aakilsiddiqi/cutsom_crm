import React, { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, ActivityIndicator, TouchableOpacity,
} from 'react-native';
import { useRoute, useNavigation, useFocusEffect, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { ScreenWrapper, HeaderBar, Card, Icon, EmptyState, StatusBadge } from '../../components/ui';
import { colors, spacing, radius, typography } from '../../theme/tokens';
import { AdminStackParamList, RevenueTransaction, CustomerSummary } from '../../types';
import { getCustomerById, getCustomerByExactName, getCustomerSummary, getCustomerLedger } from '../../services/customer';
import { CustomerLedgerEntry } from '../../types';
import { fetchTransactions } from '../../services/revenue';

type DetailRouteProp = RouteProp<AdminStackParamList, 'CustomerDetail'>;
type NavigationProp = NativeStackNavigationProp<AdminStackParamList, 'CustomerDetail'>;

const fmtCurrency = (v: number) => '₹ ' + Math.round(v).toLocaleString('en-IN');
type TabKey = 'summary' | 'transactions' | 'ledger';

const formatDate = (d: string) => new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });

export const CustomerDetailScreen = () => {
  const route = useRoute<DetailRouteProp>();
  const navigation = useNavigation<NavigationProp>();
  const { customerId } = route.params;

  const [customerName, setCustomerName] = useState('');
  const [summary, setSummary] = useState<CustomerSummary | null>(null);
  const [transactions, setTransactions] = useState<RevenueTransaction[]>([]);
  const [ledger, setLedger] = useState<CustomerLedgerEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<TabKey>('summary');

  useFocusEffect(
    useCallback(() => {
      let mounted = true;
      const load = async () => {
        setLoading(true);
        try {
          const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(customerId);
          let name = customerId;
          let custId = customerId;
          if (isUuid) {
            const cust = await getCustomerById(customerId);
            if (cust) { name = cust.name; custId = cust.id; }
          } else {
            const cust = await getCustomerByExactName(customerId);
            if (cust) { name = cust.name; custId = cust.id; }
          }
          setCustomerName(name);

          const [sum, txns, lgr] = await Promise.all([
            getCustomerSummary(custId).catch(() => null),
            fetchTransactions({ customer_name: name, page_size: 100 }).catch(() => ({ data: [], count: 0 })),
            getCustomerLedger(custId).catch(() => [] as CustomerLedgerEntry[]),
          ]);
          if (!mounted) return;
          setSummary(sum);
          setTransactions(txns.data);
          setLedger(lgr);
        } catch { /* */ } finally { if (mounted) setLoading(false); }
      };
      load();
      return () => { mounted = false; };
    }, [customerId])
  );

  if (loading) {
    return (
      <ScreenWrapper>
        <HeaderBar title="Customer Details" onBack={() => navigation.navigate('RevenueDashboard')} />
        <View style={styles.center}><ActivityIndicator size="large" color={colors.accent} /></View>
      </ScreenWrapper>
    );
  }

  const renderSummary = () => (
    <>
      <Card>
        <Text style={styles.sectionTitle}>Financial Summary</Text>
        <View style={styles.summaryGrid}>
          <SummaryItem label="Total Revenue" value={fmtCurrency(summary?.total_revenue || 0)} color={colors.success} />
          <SummaryItem label="Total Paid" value={fmtCurrency(summary?.total_paid || 0)} color={colors.success} />
          <SummaryItem label="Outstanding" value={fmtCurrency(summary?.total_outstanding || 0)} color={colors.error} />
          <SummaryItem label="Pending" value={fmtCurrency(summary?.pending_amount || 0)} color={colors.warning} />
        </View>
      </Card>
      <Card>
        <Text style={styles.sectionTitle}>Activity</Text>
        <InfoRow label="Transactions" value={String(summary?.transaction_count || 0)} />
        <InfoRow label="Last Payment" value={summary?.last_payment_date ? formatDate(summary.last_payment_date) : 'N/A'} />
        <InfoRow label="Last Transaction" value={summary?.last_transaction_date ? formatDate(summary.last_transaction_date) : 'N/A'} last />
      </Card>
    </>
  );

  const renderTransactions = () => {
    if (transactions.length === 0) {
      return <EmptyState icon="receipt-outline" title="No transactions" message="No transactions found for this customer." />;
    }
    return (
      <Card>
        {transactions.map((t, i) => {
          const isIncome = ['Income', 'Client Payment', 'Refund', 'Adjustment'].includes(t.transaction_type);
          return (
            <TouchableOpacity
              key={t.id}
              style={[styles.txnRow, i < transactions.length - 1 && styles.txnRowBorder]}
              onPress={() => navigation.navigate('RevenueTransactionDetail', { transactionId: t.id })}
              activeOpacity={0.7}
            >
              <View style={styles.txnLeft}>
                <Text style={styles.txnDate}>{formatDate(t.transaction_date)}</Text>
                <Text style={styles.txnType}>{t.transaction_type}{t.service_sheet_number ? ` • ${t.service_sheet_number}` : ''}</Text>
              </View>
              <View style={styles.txnRight}>
                <Text style={[styles.txnAmount, { color: isIncome ? colors.success : colors.error }]}>
                  {fmtCurrency(t.amount)}
                </Text>
                <StatusBadge status={t.status as any} size="sm" />
              </View>
            </TouchableOpacity>
          );
        })}
      </Card>
    );
  };

  const renderLedger = () => {
    if (ledger.length === 0) {
      return <EmptyState icon="book-outline" title="No entries" message="No ledger entries for this customer." />;
    }
    return (
      <Card>
        {ledger.map((entry, i) => (
          <View key={entry.id} style={[styles.ledgerRow, i < ledger.length - 1 && styles.ledgerRowBorder]}>
            <View style={styles.ledgerLeft}>
              <View style={styles.ledgerHeader}>
                <Icon
                  name={entry.direction === 'debit' ? 'arrow-up-circle-outline' : 'arrow-down-circle-outline'}
                  size={16}
                  color={entry.direction === 'debit' ? colors.error : colors.success}
                />
                <Text style={styles.ledgerType}>{entry.entry_type.toUpperCase()}</Text>
              </View>
              {entry.description && <Text style={styles.ledgerDesc} numberOfLines={1}>{entry.description}</Text>}
              <Text style={styles.ledgerDate}>{formatDate(entry.created_at)}</Text>
            </View>
            <View style={styles.ledgerRight}>
              <Text style={[styles.ledgerAmount, { color: entry.direction === 'debit' ? colors.error : colors.success }]}>
                {entry.direction === 'debit' ? '+' : '-'}{fmtCurrency(entry.amount)}
              </Text>
              <Text style={styles.ledgerBalance}>Balance: {fmtCurrency(entry.running_balance)}</Text>
            </View>
          </View>
        ))}
      </Card>
    );
  };

  return (
    <ScreenWrapper>
      <HeaderBar title={customerName || 'Customer Details'} onBack={() => navigation.navigate('RevenueDashboard')} />

      <View style={styles.tabBar}>
        {(['summary', 'transactions', 'ledger'] as TabKey[]).map((tab) => (
          <TouchableOpacity
            key={tab}
            style={[styles.tab, activeTab === tab && styles.tabActive]}
            onPress={() => setActiveTab(tab)}
            activeOpacity={0.7}
          >
            <Text style={[styles.tabText, activeTab === tab && styles.tabTextActive]}>
              {tab.charAt(0).toUpperCase() + tab.slice(1)}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {activeTab === 'summary' && renderSummary()}
        {activeTab === 'transactions' && renderTransactions()}
        {activeTab === 'ledger' && renderLedger()}
        <View style={{ height: 40 }} />
      </ScrollView>
    </ScreenWrapper>
  );
};

const SummaryItem = ({ label, value, color }: { label: string; value: string; color: string }) => (
  <View style={styles.summaryItem}>
    <Text style={styles.summaryLabel}>{label}</Text>
    <Text style={[styles.summaryValue, { color }]}>{value}</Text>
  </View>
);

const InfoRow = ({ label, value, last }: { label: string; value: string; last?: boolean }) => (
  <View style={[styles.infoRow, last && { borderBottomWidth: 0 }]}>
    <Text style={styles.infoLabel}>{label}</Text>
    <Text style={styles.infoValue}>{value}</Text>
  </View>
);

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  scroll: { padding: spacing.lg, paddingBottom: spacing['5xl'] },
  tabBar: { flexDirection: 'row', backgroundColor: colors.surface, borderBottomWidth: 1, borderBottomColor: colors.border },
  tab: { flex: 1, paddingVertical: spacing.md, alignItems: 'center' },
  tabActive: { borderBottomWidth: 2, borderBottomColor: colors.accent },
  tabText: { fontSize: 14, fontWeight: '600', color: colors.textSecondary },
  tabTextActive: { color: colors.textPrimary },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: colors.textPrimary, marginBottom: spacing.md },
  summaryGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },
  summaryItem: { width: '46%', marginBottom: spacing.md },
  summaryLabel: { fontSize: 12, color: colors.textTertiary, marginBottom: 2 },
  summaryValue: { fontSize: 20, fontWeight: '700' },
  infoRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: spacing.md, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
  infoLabel: { fontSize: 14, color: colors.textSecondary },
  infoValue: { fontSize: 14, fontWeight: '600', color: colors.textPrimary },
  txnRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: spacing.md },
  txnRowBorder: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
  txnLeft: { flex: 1, marginRight: spacing.md },
  txnDate: { fontSize: 13, color: colors.textSecondary, marginBottom: 2 },
  txnType: { fontSize: 14, fontWeight: '600', color: colors.textPrimary },
  txnRight: { alignItems: 'flex-end', gap: spacing.xs },
  txnAmount: { fontSize: 16, fontWeight: '700' },
  ledgerRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: spacing.md },
  ledgerRowBorder: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
  ledgerLeft: { flex: 1, marginRight: spacing.md },
  ledgerHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, marginBottom: 2 },
  ledgerType: { fontSize: 13, fontWeight: '700', color: colors.textPrimary },
  ledgerDesc: { fontSize: 12, color: colors.textSecondary, marginBottom: 2 },
  ledgerDate: { fontSize: 11, color: colors.textTertiary },
  ledgerRight: { alignItems: 'flex-end', gap: 2 },
  ledgerAmount: { fontSize: 15, fontWeight: '700' },
  ledgerBalance: { fontSize: 11, color: colors.textTertiary },
});
