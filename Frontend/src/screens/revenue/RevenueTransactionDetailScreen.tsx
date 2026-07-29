import React, { useState, useCallback, useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, ScrollView, ActivityIndicator,
  Alert, Platform, Animated, TouchableOpacity,
} from 'react-native';
import { useRoute, useNavigation, useFocusEffect, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import {
  ScreenWrapper, HeaderBar, Card, Button, Icon, StatusBadge, Input,
} from '../../components/ui';
import { colors, spacing, radius, typography } from '../../theme/tokens';
import {
  fetchTransactionById, fetchChildren, recordPayment,
  softDeleteTransaction, restoreTransaction, fetchAuditLog,
} from '../../services/revenue';
import {
  AdminStackParamList, RevenueTransaction, RevenueAuditLog,
  RevenuePaymentMode, REVENUE_PAYMENT_MODES, isIncomeType, isExpenseType,
} from '../../types';
import { useAuth } from '../../context/AuthContext';
import { navigateBack } from '../../utils/navigationUtils';
import { formatDate } from '../../utils/formatting';
import { getCustomerSummary } from '../../services/customer';

type DetailRouteProp = RouteProp<AdminStackParamList, 'RevenueTransactionDetail'>;
type NavigationProp = NativeStackNavigationProp<AdminStackParamList, 'RevenueTransactionDetail'>;

const CURRENCY = '₹';

const formatCurrency = (amount: number): string =>
  `${CURRENCY} ${amount.toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;

const actionLabelMap: Record<string, { label: string; color: string; bg: string }> = {
  create: { label: 'Created', color: colors.success, bg: colors.successBg },
  update: { label: 'Updated', color: colors.info, bg: colors.infoBg },
  payment: { label: 'Payment', color: colors.warning, bg: colors.warningBg },
  soft_delete: { label: 'Deleted', color: colors.error, bg: colors.errorBg },
  restore: { label: 'Restored', color: colors.success, bg: colors.successBg },
};

export const RevenueTransactionDetailScreen = () => {
  const route = useRoute<DetailRouteProp>();
  const navigation = useNavigation<NavigationProp>();
  const { transactionId } = route.params;
  const { profile: currentUser } = useAuth();

  const [transaction, setTransaction] = useState<RevenueTransaction | null>(null);
  const [children, setChildren] = useState<RevenueTransaction[]>([]);
  const [auditLog, setAuditLog] = useState<RevenueAuditLog[]>([]);
  const [customerSummary, setCustomerSummary] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [paymentFormVisible, setPaymentFormVisible] = useState(false);
  const [payAmount, setPayAmount] = useState('');
  const [payMode, setPayMode] = useState<RevenuePaymentMode>('Cash');
  const [payDate, setPayDate] = useState('');
  const [payDesc, setPayDesc] = useState('');
  const [paying, setPaying] = useState(false);

  const [deleting, setDeleting] = useState(false);

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(15)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 400, useNativeDriver: true }),
      Animated.spring(slideAnim, { toValue: 0, speed: 50, bounciness: 6, useNativeDriver: true }),
    ]).start();
  }, []);

  const fetchData = useCallback(async (signal: AbortSignal) => {
    try {
      if (!signal.aborted) setLoading(true);
      setError(null);
      const [txn, kids, logs] = await Promise.all([
        fetchTransactionById(transactionId),
        fetchChildren(transactionId),
        fetchAuditLog(transactionId),
      ]);
      if (!signal.aborted) {
        setTransaction(txn);
        setChildren(kids);
        setAuditLog(logs);
        if (txn.customer_name) {
          getCustomerSummary(txn.customer_name).then(setCustomerSummary).catch(() => {});
        } else {
          setCustomerSummary(null);
        }
      }
    } catch (err: any) {
      if (!signal.aborted) setError(err.message || 'Failed to load transaction');
    } finally {
      if (!signal.aborted) setLoading(false);
    }
  }, [transactionId]);

  useFocusEffect(
    useCallback(() => {
      const ac = new AbortController();
      fetchData(ac.signal);
      return () => ac.abort();
    }, [fetchData])
  );

  const handleRecordPayment = async () => {
    if (!currentUser || !transaction) return;
    const amount = parseFloat(payAmount);
    if (!amount || amount <= 0) {
      Alert.alert('Invalid', 'Enter a valid payment amount');
      return;
    }
    if (amount > transaction.remaining_amount) {
      Alert.alert('Exceeds', `Remaining amount is ${formatCurrency(transaction.remaining_amount)}`);
      return;
    }
    setPaying(true);
    try {
      const result = await recordPayment(transactionId, {
        amount,
        payment_mode: payMode,
        transaction_date: payDate ? new Date(payDate).toISOString() : new Date().toISOString(),
        description: payDesc || `Payment for ${transaction.description || transaction.invoice_number || transactionId}`,
      }, currentUser.id);
      setTransaction(result.parent);
      setChildren(prev => [...prev, result.child]);
      setPaymentFormVisible(false);
      setPayAmount('');
      setPayDate('');
      setPayDesc('');
      const logs = await fetchAuditLog(transactionId);
      setAuditLog(logs);
      Alert.alert('Success', 'Payment recorded');
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to record payment');
    } finally {
      setPaying(false);
    }
  };

  const handleDelete = () => {
    if (!currentUser) return;
    const doDelete = async () => {
      setDeleting(true);
      try {
        await softDeleteTransaction(transactionId, currentUser.id);
        Alert.alert('Deleted', 'Transaction has been deleted', [
          { text: 'OK', onPress: () => navigateBack(navigation, 'AdminTabs') },
        ]);
      } catch (err: any) {
        Alert.alert('Error', err.message || 'Failed to delete transaction');
      } finally {
        setDeleting(false);
      }
    };
    if (Platform.OS === 'web') {
      if (window.confirm('Delete this transaction? This cannot be undone.')) doDelete();
    } else {
      Alert.alert('Confirm', 'Delete this transaction? This cannot be undone.', [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: doDelete },
      ]);
    }
  };

  const handleRestore = () => {
    if (!currentUser) return;
    const doRestore = async () => {
      try {
        const restored = await restoreTransaction(transactionId, currentUser.id);
        setTransaction(restored);
        const logs = await fetchAuditLog(transactionId);
        setAuditLog(logs);
        Alert.alert('Restored', 'Transaction has been restored');
      } catch (err: any) {
        Alert.alert('Error', err.message || 'Failed to restore transaction');
      }
    };
    Platform.OS === 'web'
      ? (window.confirm('Restore this transaction?') && doRestore())
      : Alert.alert('Confirm', 'Restore this transaction?', [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Restore', onPress: doRestore },
        ]);
  };

  if (loading) {
    return (
      <ScreenWrapper>
        <HeaderBar title="Transaction Details" onBack={() => navigation.navigate('RevenueDashboard')} />
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.accent} />
        </View>
      </ScreenWrapper>
    );
  }

  if (error || !transaction) {
    return (
      <ScreenWrapper>
        <HeaderBar title="Transaction Details" onBack={() => navigation.navigate('RevenueDashboard')} />
        <View style={styles.center}>
          <Icon name="alert-circle-outline" size={48} color={colors.error} />
          <Text style={styles.errorText}>{error || 'Transaction not found'}</Text>
          <Button title="Retry" variant="tonal" onPress={() => { const ac = new AbortController(); fetchData(ac.signal); }} />
        </View>
      </ScreenWrapper>
    );
  }

  const isIncome = isIncomeType(transaction.transaction_type);
  const isDeleted = !!transaction.deleted_at;
  const percentage = transaction.total_amount > 0
    ? Math.min(100, (transaction.paid_amount / transaction.total_amount) * 100)
    : 0;
  const hasChildren = children.length > 0;

  return (
    <ScreenWrapper>
      <HeaderBar title="Transaction Details" onBack={() => navigation.navigate('RevenueDashboard')} />

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <Animated.View style={{ opacity: fadeAnim, transform: [{ translateY: slideAnim }] }}>

          {/* 1. Transaction Info Card */}
          <Card>
            <View style={styles.badgeRow}>
              <View style={[styles.typeBadge, { backgroundColor: isIncome ? colors.successBg : colors.errorBg }]}>
                <Text style={[styles.typeBadgeText, { color: isIncome ? colors.success : colors.error }]}>
                  {isIncome ? 'Income' : 'Expense'}
                </Text>
              </View>
              <StatusBadge status={transaction.status} size="sm" />
            </View>

            <Text style={styles.amount} allowFontScaling={false}>
              {formatCurrency(transaction.amount)}
            </Text>

            <View style={styles.divider} />

            <InfoRow label="Category" value={transaction.category || '-'} />
            <InfoRow label="Payment Mode" value={transaction.payment_mode || '-'} />
            <InfoRow label="Date" value={formatDate(transaction.transaction_date)} />
            {transaction.description && (
              <InfoRow label="Description" value={transaction.description} />
            )}
            {transaction.vendor_name && (
              <InfoRow label="Client/Vendor" value={transaction.vendor_name} />
            )}
            {transaction.invoice_number && (
              <InfoRow label="Invoice No." value={transaction.invoice_number} />
            )}
            {transaction.customer_name && (
              <InfoRow label="Customer" value={transaction.customer_name} />
            )}
            {transaction.service_sheet_number && (
              <InfoRow label="Sheet No." value={transaction.service_sheet_number} />
            )}
            {transaction.custom_transaction_type && (
              <InfoRow label="Custom Type" value={transaction.custom_transaction_type} />
            )}
            {transaction.custom_category && (
              <InfoRow label="Custom Category" value={transaction.custom_category} />
            )}
            {transaction.custom_payment_mode && (
              <InfoRow label="Custom Payment Mode" value={transaction.custom_payment_mode} />
            )}
          </Card>

          {/* 2. Payment Summary Card */}
          <Card>
            <Text style={styles.sectionTitle}>Payment Summary</Text>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Total Amount</Text>
              <Text style={styles.summaryValue}>{formatCurrency(transaction.total_amount)}</Text>
            </View>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Paid Amount</Text>
              <Text style={[styles.summaryValue, { color: colors.success }]}>{formatCurrency(transaction.paid_amount)}</Text>
            </View>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Remaining</Text>
              <Text style={[styles.summaryValue, { color: transaction.remaining_amount > 0 ? colors.error : colors.success }]}>
                {formatCurrency(transaction.remaining_amount)}
              </Text>
            </View>

            <View style={styles.progressBar}>
              <View style={[styles.progressFill, { width: `${percentage}%`, backgroundColor: percentage >= 100 ? colors.success : colors.warning }]} />
            </View>
            <Text style={styles.progressLabel}>{percentage.toFixed(0)}% paid</Text>
          </Card>

          {/* 3. Customer Financial Summary Card */}
          {customerSummary && (
            <Card>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>Customer Financial Summary</Text>
                <TouchableOpacity
                  onPress={() => navigation.navigate('CustomerDetail', { customerId: transaction.customer_name! })}
                >
                  <Text style={{ fontSize: 13, color: colors.info, fontWeight: '600' }}>View All</Text>
                </TouchableOpacity>
              </View>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md }}>
                <View style={{ width: '46%' }}>
                  <Text style={{ fontSize: 12, color: colors.textTertiary }}>Revenue</Text>
                  <Text style={{ fontSize: 18, fontWeight: '700', color: colors.success }}>
                    {formatCurrency(customerSummary.total_revenue)}
                  </Text>
                </View>
                <View style={{ width: '46%' }}>
                  <Text style={{ fontSize: 12, color: colors.textTertiary }}>Outstanding</Text>
                  <Text style={{ fontSize: 18, fontWeight: '700', color: colors.error }}>
                    {formatCurrency(customerSummary.total_outstanding)}
                  </Text>
                </View>
                <View style={{ width: '46%' }}>
                  <Text style={{ fontSize: 12, color: colors.textTertiary }}>Paid</Text>
                  <Text style={{ fontSize: 18, fontWeight: '700', color: colors.success }}>
                    {formatCurrency(customerSummary.total_paid)}
                  </Text>
                </View>
                <View style={{ width: '46%' }}>
                  <Text style={{ fontSize: 12, color: colors.textTertiary }}>Txns</Text>
                  <Text style={{ fontSize: 18, fontWeight: '700', color: colors.textPrimary }}>
                    {customerSummary.transaction_count}
                  </Text>
                </View>
              </View>
            </Card>
          )}

          {/* 4. Payment History Card */}
          <Card>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Payment History</Text>
              {!isDeleted && transaction.remaining_amount > 0 && (
                <Button
                  title="Record Payment"
                  variant="tonal"
                  size="sm"
                  icon="cash-outline"
                  onPress={() => setPaymentFormVisible(prev => !prev)}
                />
              )}
            </View>

            {paymentFormVisible && (
              <View style={styles.paymentForm}>
                <Input
                  label="Amount"
                  value={payAmount}
                  onChangeText={setPayAmount}
                  keyboardType="phone-pad"
                  placeholder="Enter amount"
                />
                <View style={styles.payModeRow}>
                  {REVENUE_PAYMENT_MODES.map(mode => (
                    <TouchableBadge
                      key={mode}
                      label={mode}
                      active={payMode === mode}
                      onPress={() => setPayMode(mode)}
                    />
                  ))}
                </View>
                <Input
                  label="Date (optional)"
                  value={payDate}
                  onChangeText={setPayDate}
                  placeholder="YYYY-MM-DD"
                />
                <Input
                  label="Description (optional)"
                  value={payDesc}
                  onChangeText={setPayDesc}
                  placeholder="Payment description"
                />
                <Button
                  title={paying ? 'Recording...' : 'Submit Payment'}
                  onPress={handleRecordPayment}
                  loading={paying}
                  disabled={paying}
                  fullWidth
                />
              </View>
            )}

            {children.length === 0 ? (
              <View style={styles.emptySection}>
                <Icon name="receipt-outline" size={24} color={colors.textTertiary} />
                <Text style={styles.emptyText}>No payments recorded yet</Text>
              </View>
            ) : (
              children.map((child, idx) => (
                <View key={child.id} style={[styles.childRow, idx < children.length - 1 && styles.childRowBorder]}>
                  <View style={styles.childLeft}>
                    <Text style={styles.childDate}>{formatDate(child.transaction_date)}</Text>
                    <Text style={styles.childMode}>{child.payment_mode}</Text>
                  </View>
                  <Text style={styles.childAmount}>{formatCurrency(child.amount)}</Text>
                </View>
              ))
            )}
          </Card>

          {/* 4. Action Buttons */}
          {!isDeleted && (
            <Card>
              <View style={styles.actionRow}>
                {transaction.remaining_amount > 0 && (
                  <Button
                    title="Record Payment"
                    variant="tonal"
                    icon="cash-outline"
                    onPress={() => setPaymentFormVisible(prev => !prev)}
                    size="sm"
                  />
                )}
                <Button
                  title="Edit"
                  variant="tonal"
                  icon="create-outline"
                  onPress={() => navigation.navigate('RevenueTransactionForm', { transactionId })}
                  size="sm"
                />
              </View>
              <View style={styles.actionRow}>
                <Button
                  title={hasChildren ? 'Delete (remove children first)' : 'Delete'}
                  variant="danger"
                  icon="trash-outline"
                  onPress={handleDelete}
                  disabled={deleting || hasChildren}
                  loading={deleting}
                  size="sm"
                />
              </View>
            </Card>
          )}

          {isDeleted && (
            <Card>
              <Text style={styles.deletedBanner}>Transaction deleted</Text>
              <Button
                title="Restore Transaction"
                variant="primary"
                icon="refresh-outline"
                onPress={handleRestore}
                fullWidth
              />
            </Card>
          )}

          {/* 5. Audit Log Card */}
          <Card>
            <Text style={styles.sectionTitle}>Audit Log</Text>
            {auditLog.length === 0 ? (
              <View style={styles.emptySection}>
                <Icon name="time-outline" size={24} color={colors.textTertiary} />
                <Text style={styles.emptyText}>No audit records</Text>
              </View>
            ) : (
              auditLog.map((log, idx) => {
                const cfg = actionLabelMap[log.action] || { label: log.action, color: colors.textSecondary, bg: colors.bg };
                return (
                  <View key={log.id} style={[styles.logRow, idx < auditLog.length - 1 && styles.logRowBorder]}>
                    <View style={[styles.logBadge, { backgroundColor: cfg.bg }]}>
                      <Text style={[styles.logBadgeText, { color: cfg.color }]}>{cfg.label}</Text>
                    </View>
                    <Text style={styles.logTime}>{formatDate(log.created_at)}</Text>
                  </View>
                );
              })
            )}
          </Card>

        </Animated.View>
        <View style={{ height: 40 }} />
      </ScrollView>
    </ScreenWrapper>
  );
};

const InfoRow = ({ label, value, last }: { label: string; value: string; last?: boolean }) => (
  <View style={[styles.infoRow, last && { borderBottomWidth: 0 }]}>
    <Text style={styles.infoLabel}>{label}</Text>
    <Text style={styles.infoValue} allowFontScaling={false}>{value}</Text>
  </View>
);

const TouchableBadge = ({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) => (
  <View style={styles.payModeItem}>
    <Button
      title={label}
      variant={active ? 'primary' : 'ghost'}
      size="sm"
      onPress={onPress}
    />
  </View>
);

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: spacing.xl, gap: spacing.md },
  errorText: { fontSize: 15, color: colors.error, textAlign: 'center', marginBottom: spacing.sm },
  scroll: { padding: spacing.lg },
  badgeRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.md },
  typeBadge: { paddingHorizontal: spacing.md, paddingVertical: spacing.xs, borderRadius: radius.full },
  typeBadgeText: { fontSize: 13, fontWeight: '700' },
  amount: { fontSize: 28, fontWeight: '800', color: colors.textPrimary, marginBottom: spacing.lg },
  divider: { height: StyleSheet.hairlineWidth, backgroundColor: colors.border, marginBottom: spacing.md },
  infoRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: spacing.sm + 2, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
  infoLabel: { fontSize: 14, color: colors.textSecondary },
  infoValue: { fontSize: 14, color: colors.textPrimary, fontWeight: '500', flexShrink: 1, textAlign: 'right', maxWidth: '60%' },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.md },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: colors.textPrimary, marginBottom: spacing.md },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: spacing.sm },
  summaryLabel: { fontSize: 15, color: colors.textSecondary },
  summaryValue: { fontSize: 16, fontWeight: '700', color: colors.textPrimary },
  progressBar: { height: 8, borderRadius: 4, backgroundColor: colors.border, marginTop: spacing.md, overflow: 'hidden' },
  progressFill: { height: 8, borderRadius: 4 },
  progressLabel: { fontSize: 12, color: colors.textTertiary, marginTop: spacing.xs, textAlign: 'right' },
  paymentForm: { marginBottom: spacing.md },
  payModeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs, marginBottom: spacing.md },
  payModeItem: { marginBottom: spacing.xs },
  childRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: spacing.md },
  childRowBorder: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
  childLeft: { flex: 1 },
  childDate: { fontSize: 14, fontWeight: '600', color: colors.textPrimary },
  childMode: { fontSize: 12, color: colors.textSecondary, marginTop: 2 },
  childAmount: { fontSize: 16, fontWeight: '700', color: colors.success },
  emptySection: { alignItems: 'center', paddingVertical: spacing.xl, gap: spacing.sm },
  emptyText: { fontSize: 14, color: colors.textTertiary },
  actionRow: { flexDirection: 'row', gap: spacing.md, marginBottom: spacing.md, flexWrap: 'wrap' },
  deletedBanner: { fontSize: 15, fontWeight: '600', color: colors.error, textAlign: 'center', marginBottom: spacing.md },
  logRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: spacing.md },
  logRowBorder: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
  logBadge: { paddingHorizontal: spacing.sm, paddingVertical: 2, borderRadius: radius.sm },
  logBadgeText: { fontSize: 12, fontWeight: '600' },
  logTime: { fontSize: 12, color: colors.textTertiary },
});
