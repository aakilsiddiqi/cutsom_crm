import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  RefreshControl,
  Animated,
  StatusBar,
} from 'react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { AdminStackParamList, RevenueTransaction, isIncomeType, isExpenseType, OutstandingCustomer } from '../../types';
import { useAuth } from '../../context/AuthContext';
import { fetchSummary, fetchPeriodBreakdown, RevenueSummary } from '../../services/revenue';
import { getOutstandingCustomers } from '../../services/customer';
import { getGreeting, getGreetingEmoji } from '../../utils/greetingUtils';
import { goToAdminDashboard } from '../../utils/navigationUtils';
import { colors, radius, spacing } from '../../theme/tokens';
import { ScreenWrapper } from '../../components/ui/ScreenWrapper';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { StatCard } from '../../components/ui/StatCard';
import { EmptyState } from '../../components/ui/EmptyState';
import { Icon } from '../../components/ui/Icon';

type NavigationProp = NativeStackNavigationProp<AdminStackParamList, 'RevenueDashboard'>;
type FilterType = 'Today' | 'This Week' | 'This Month' | 'This Quarter' | 'This Year' | 'Custom';

type MonthBucket = {
  label: string;
  income: number;
  expense: number;
};

const fmtCurrency = (v: number) =>
  '₹' + Math.round(v).toLocaleString('en-IN');

const fmtPercent = (v: number) =>
  Math.round(v * 10) / 10 + '%';

const getDateRange = (filter: FilterType, customFrom?: string, customTo?: string) => {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  switch (filter) {
    case 'Today': {
      const s = today.toISOString();
      const e = new Date(today.getTime() + 86400000 - 1).toISOString();
      return { from: s, to: e };
    }
    case 'This Week': {
      const day = today.getDay();
      const diff = today.getDate() - day + (day === 0 ? -6 : 1);
      const start = new Date(today.getFullYear(), today.getMonth(), diff);
      return { from: start.toISOString(), to: now.toISOString() };
    }
    case 'This Month': {
      const start = new Date(now.getFullYear(), now.getMonth(), 1);
      return { from: start.toISOString(), to: now.toISOString() };
    }
    case 'This Quarter': {
      const q = Math.floor(now.getMonth() / 3) * 3;
      const start = new Date(now.getFullYear(), q, 1);
      return { from: start.toISOString(), to: now.toISOString() };
    }
    case 'This Year': {
      const start = new Date(now.getFullYear(), 0, 1);
      return { from: start.toISOString(), to: now.toISOString() };
    }
    case 'Custom': {
      const ddmmToIso = (v: string) => {
        const parts = v.split('-');
        if (parts.length !== 3) return '';
        return `${parts[2]}-${parts[1]}-${parts[0]}`;
      };
      const f = customFrom ? ddmmToIso(customFrom) : '';
      const t = customTo ? ddmmToIso(customTo) : '';
      return {
        from: f ? `${f}T00:00:00` : new Date(0).toISOString(),
        to: t ? `${t}T23:59:59` : now.toISOString(),
      };
    }
  }
};

const buildMonthlyBuckets = (txns: RevenueTransaction[]): MonthBucket[] => {
  const map = new Map<string, { income: number; expense: number }>();

  for (const t of txns) {
    const m = t.transaction_date.slice(0, 7);
    const b = map.get(m) || { income: 0, expense: 0 };
    if (isIncomeType(t.transaction_type)) b.income += t.amount;
    if (isExpenseType(t.transaction_type)) b.expense += t.amount;
    map.set(m, b);
  }

  const sorted = Array.from(map.entries()).sort(([a], [b]) => a.localeCompare(b));
  return sorted.map(([key, val]) => {
    const [y, m] = key.split('-');
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return { label: `${months[parseInt(m) - 1]} ${y}`, income: val.income, expense: val.expense };
  });
};

export const RevenueDashboardScreen = () => {
  const navigation = useNavigation<NavigationProp>();
  const { profile } = useAuth();
  const greeting = getGreeting();
  const greetingEmoji = getGreetingEmoji();

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [errorOccurred, setErrorOccurred] = useState(false);
  const [selectedFilter, setSelectedFilter] = useState<FilterType>('This Month');
  const [showCustomDate, setShowCustomDate] = useState(false);
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');

  const [summary, setSummary] = useState<RevenueSummary | null>(null);
  const [chartBuckets, setChartBuckets] = useState<MonthBucket[]>([]);
  const [outstandingCustomers, setOutstandingCustomers] = useState<OutstandingCustomer[]>([]);

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(20)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 500, useNativeDriver: true }),
      Animated.spring(slideAnim, { toValue: 0, speed: 50, bounciness: 6, useNativeDriver: true }),
    ]).start();
  }, []);

  useEffect(() => {
    setShowCustomDate(selectedFilter === 'Custom');
  }, [selectedFilter]);

  const fetchData = useCallback(async (force = false) => {
    try {
      if (!force) setLoading(true);
      setErrorOccurred(false);

      const range = getDateRange(selectedFilter, customFrom, customTo);

      const [summaryData, breakdownData] = await Promise.all([
        fetchSummary(range.from, range.to),
        fetchPeriodBreakdown(range.from, range.to),
      ]);

      const buckets = buildMonthlyBuckets(breakdownData);
      setSummary(summaryData);
      setChartBuckets(buckets);

      const outstanding = await getOutstandingCustomers();
      setOutstandingCustomers(outstanding.slice(0, 5));
    } catch {
      setErrorOccurred(true);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [selectedFilter, customFrom, customTo]);

  useFocusEffect(
    useCallback(() => {
      fetchData();
    }, [fetchData])
  );

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchData(true);
  }, [fetchData]);

  const todayStr = new Intl.DateTimeFormat('en-GB', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  }).format(new Date());

  const chartMax = chartBuckets.length > 0
    ? Math.max(...chartBuckets.flatMap(b => [b.income, b.expense]), 1)
    : 1;

  return (
    <ScreenWrapper>
      <StatusBar barStyle="light-content" />

      <View style={styles.header}>
        <View style={styles.headerContent}>
          <View style={styles.headerLeft}>
            <TouchableOpacity
              onPress={() => goToAdminDashboard(navigation)}
              style={styles.backBtn}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              accessibilityLabel="Back to Dashboard"
            >
              <Icon name="chevron-back" size={24} color={colors.headerText} />
            </TouchableOpacity>
            <View style={styles.avatar}>
              <Text style={styles.avatarText} allowFontScaling={false}>
                {(profile?.full_name || profile?.username || 'A').charAt(0).toUpperCase()}
              </Text>
            </View>
            <View>
              <Text style={styles.greeting} allowFontScaling={false}>
                {greeting}, {profile?.full_name || 'Admin'} {greetingEmoji}
              </Text>
              <Text style={styles.dateLabel} allowFontScaling={false}>{todayStr}</Text>
            </View>
          </View>
          <View style={styles.headerActions}>
            <TouchableOpacity
              onPress={() => navigation.navigate('Settings')}
              style={styles.iconBtn}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              accessibilityLabel="Settings"
            >
              <Icon name="settings-outline" size={22} color={colors.headerText} />
            </TouchableOpacity>
          </View>
        </View>

        {summary && (
          <View style={styles.quickStats}>
            <View style={styles.quickStatItem}>
              <Text style={styles.quickStatValue} allowFontScaling={false}>{fmtCurrency(summary.net_profit)}</Text>
              <Text style={styles.quickStatLabel} allowFontScaling={false}>Net Profit</Text>
            </View>
            <View style={styles.quickStatDivider} />
            <View style={styles.quickStatItem}>
              <Text style={styles.quickStatValue} allowFontScaling={false}>{fmtPercent(summary.profit_margin)}</Text>
              <Text style={styles.quickStatLabel} allowFontScaling={false}>Margin</Text>
            </View>
            <View style={styles.quickStatDivider} />
            <View style={styles.quickStatItem}>
              <Text style={[styles.quickStatValue, { color: colors.accent }]} allowFontScaling={false}>
                {summary.total_transactions}
              </Text>
              <Text style={styles.quickStatLabel} allowFontScaling={false}>Transactions</Text>
            </View>
          </View>
        )}
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accent} />
        }
        showsVerticalScrollIndicator={false}
      >
        {loading && !refreshing ? (
          <View style={styles.centerState}>
            <ActivityIndicator size="large" color={colors.accent} />
          </View>
        ) : errorOccurred ? (
          <View style={styles.centerState}>
            <EmptyState
              icon="cloud-offline-outline"
              title="Failed to load revenue data"
              message="Pull down to refresh and try again."
            />
          </View>
        ) : (
          <Animated.View style={{ opacity: fadeAnim, transform: [{ translateY: slideAnim }] }}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filtersRow}>
              {(['Today', 'This Week', 'This Month', 'This Quarter', 'This Year', 'Custom'] as FilterType[]).map(
                (filter) => (
                  <TouchableOpacity
                    key={filter}
                    style={[styles.filterChip, selectedFilter === filter && styles.filterChipActive]}
                    onPress={() => setSelectedFilter(filter)}
                    activeOpacity={0.7}
                  >
                    <Text
                      style={[styles.filterChipText, selectedFilter === filter && styles.filterChipTextActive]}
                      allowFontScaling={false}
                    >
                      {filter}
                    </Text>
                  </TouchableOpacity>
                ),
              )}
            </ScrollView>

            {showCustomDate && (
              <Card>
                <View style={styles.customDateRow}>
                  <View style={styles.customDateField}>
                    <Text style={styles.fieldLabel} allowFontScaling={false}>From (DD-MM-YYYY)</Text>
                    <TextInput
                      style={styles.dateInput}
                      placeholder="DD-MM-YYYY"
                      placeholderTextColor={colors.textTertiary}
                      value={customFrom}
                      onChangeText={setCustomFrom}
                    />
                  </View>
                  <View style={styles.customDateField}>
                    <Text style={styles.fieldLabel} allowFontScaling={false}>To (DD-MM-YYYY)</Text>
                    <TextInput
                      style={styles.dateInput}
                      placeholder="DD-MM-YYYY"
                      placeholderTextColor={colors.textTertiary}
                      value={customTo}
                      onChangeText={setCustomTo}
                    />
                  </View>
                </View>
              </Card>
            )}

            {summary && (
              <>
                <Text style={styles.sectionTitle} allowFontScaling={false}>Key Metrics</Text>
                <View style={styles.kpiGrid}>
                  <StatCard
                    label="Total Revenue"
                    value={fmtCurrency(summary.total_income)}
                    icon="trending-up-outline"
                    color="#34C759"
                    bg="#E8F8ED"
                  />
                  <StatCard
                    label="Total Expenses"
                    value={fmtCurrency(summary.total_expense)}
                    icon="trending-down-outline"
                    color="#FF3B30"
                    bg="#FFF0EF"
                  />
                  <StatCard
                    label="Net Profit"
                    value={fmtCurrency(summary.net_profit)}
                    icon="cash-outline"
                    color={summary.net_profit >= 0 ? '#34C759' : '#FF3B30'}
                    bg={summary.net_profit >= 0 ? '#E8F8ED' : '#FFF0EF'}
                  />
                  <StatCard
                    label="Profit Margin"
                    value={fmtPercent(summary.profit_margin)}
                    icon="pie-chart-outline"
                    color="#007AFF"
                    bg="#EBF5FF"
                  />
                </View>

                <Text style={styles.sectionTitle} allowFontScaling={false}>Outstanding</Text>
                <View style={styles.kpiGrid}>
                  <StatCard
                    label="Receivables"
                    value={fmtCurrency(summary.outstanding_receivables)}
                    icon="wallet-outline"
                    color="#FF9500"
                    bg="#FFF4E5"
                  />
                  <StatCard
                    label="Payables"
                    value={fmtCurrency(summary.outstanding_payables)}
                    icon="card-outline"
                    color="#FF3B30"
                    bg="#FFF0EF"
                  />
                  <StatCard
                    label="Pending Bills"
                    value={String(summary.pending_bills)}
                    icon="document-text-outline"
                    color="#5856D6"
                    bg="#F0EFFF"
                  />
                  <StatCard
                    label="Collection Rate"
                    value={fmtPercent(summary.collection_rate)}
                    icon="checkmark-circle-outline"
                    color="#34C759"
                    bg="#E8F8ED"
                  />
                </View>

                {chartBuckets.length > 0 && (
                  <>
                    <Text style={styles.sectionTitle} allowFontScaling={false}>Revenue vs Expenses</Text>
                    <Card>
                      <View style={styles.chartContainer}>
                        <View style={styles.chartLegend}>
                          <View style={styles.legendRow}>
                            <View style={[styles.legendDot, { backgroundColor: '#34C759' }]} />
                            <Text style={styles.legendText} allowFontScaling={false}>Income</Text>
                          </View>
                          <View style={styles.legendRow}>
                            <View style={[styles.legendDot, { backgroundColor: '#FF3B30' }]} />
                            <Text style={styles.legendText} allowFontScaling={false}>Expense</Text>
                          </View>
                        </View>

                        {chartBuckets.map((b) => {
                          const incomePct = (b.income / chartMax) * 100;
                          const expensePct = (b.expense / chartMax) * 100;
                          return (
                            <View key={b.label} style={styles.chartRow}>
                              <Text style={styles.chartLabel} numberOfLines={1} allowFontScaling={false}>
                                {b.label}
                              </Text>
                              <View style={styles.chartBars}>
                                <View style={styles.barRow}>
                                  <View style={styles.barTrack}>
                                    <View
                                      style={[
                                        styles.bar,
                                        {
                                          width: `${Math.max(incomePct, 2)}%` as any,
                                          backgroundColor: '#34C759',
                                        },
                                      ]}
                                    />
                                  </View>
                                  <Text style={styles.barValue} allowFontScaling={false}>
                                    {fmtCurrency(b.income)}
                                  </Text>
                                </View>
                                <View style={styles.barRow}>
                                  <View style={styles.barTrack}>
                                    <View
                                      style={[
                                        styles.bar,
                                        {
                                          width: `${Math.max(expensePct, 2)}%` as any,
                                          backgroundColor: '#FF3B30',
                                        },
                                      ]}
                                    />
                                  </View>
                                  <Text style={styles.barValue} allowFontScaling={false}>
                                    {fmtCurrency(b.expense)}
                                  </Text>
                                </View>
                              </View>
                            </View>
                          );
                        })}
                      </View>
                    </Card>
                  </>
                )}

                {chartBuckets.length === 0 && (
                  <EmptyState
                    icon="bar-chart-outline"
                    title="No transaction data"
                    message="Add transactions to see revenue trends."
                  />
                )}

                {outstandingCustomers.length > 0 && (
                  <>
                    <Text style={styles.sectionTitle} allowFontScaling={false}>Outstanding Customers</Text>
                    <Card>
                      {outstandingCustomers.map((c, i) => (
                        <TouchableOpacity
                          key={i}
                          style={[styles.outstandingRow, i < outstandingCustomers.length - 1 && styles.outstandingRowBorder]}
                          onPress={() => navigation.navigate('OutstandingCustomers')}
                          activeOpacity={0.7}
                        >
                          <View style={styles.outstandingLeft}>
                            <Text style={styles.outstandingName} numberOfLines={1} allowFontScaling={false}>{c.customer.name}</Text>
                          </View>
                          <View style={styles.outstandingRight}>
                            <Text style={[styles.outstandingAmount, { color: '#FF3B30' }]} allowFontScaling={false}>
                              {fmtCurrency(c.total_outstanding)}
                            </Text>
                            <View style={[styles.outstandingStatus, { backgroundColor: c.total_outstanding > 0 ? colors.errorBg : colors.warningBg }]}>
                              <Text style={[styles.outstandingStatusText, { color: c.total_outstanding > 0 ? colors.error : colors.warning }]}>
                                {c.total_outstanding > 0 ? 'Overdue' : 'Pending'}
                              </Text>
                            </View>
                          </View>
                        </TouchableOpacity>
                      ))}
                      <TouchableOpacity
                        style={styles.viewAllBtn}
                        onPress={() => navigation.navigate('OutstandingCustomers')}
                        activeOpacity={0.7}
                      >
                        <Text style={styles.viewAllText} allowFontScaling={false}>View All Outstanding Customers</Text>
                      </TouchableOpacity>
                    </Card>
                  </>
                )}

                <View style={styles.actionsRow}>
                  <Button
                    title="New Transaction"
                    icon="add-circle-outline"
                    variant="primary"
                    fullWidth
                    onPress={() => navigation.navigate('RevenueTransactionForm', {})}
                  />
                  <View style={styles.actionsSpacer} />
                  <Button
                    title="View All Transactions"
                    icon="list-outline"
                    variant="tonal"
                    fullWidth
                    onPress={() => navigation.navigate('RevenueTransactions', undefined)}
                  />
                </View>
              </>
            )}
          </Animated.View>
        )}
        <View style={{ height: 40 }} />
      </ScrollView>
    </ScreenWrapper>
  );
};

const styles = StyleSheet.create({
  header: {
    backgroundColor: colors.headerBg,
    paddingBottom: spacing.xl,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
  },
  headerContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.lg,
    paddingBottom: spacing.md,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontSize: 20,
    fontWeight: '700',
    color: '#000',
  },
  greeting: {
    fontSize: 17,
    fontWeight: '600',
    color: colors.headerText,
    letterSpacing: -0.3,
  },
  dateLabel: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.5)',
    marginTop: 2,
  },
  headerActions: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  iconBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  quickStats: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: spacing.xl,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 16,
    paddingVertical: spacing.md,
  },
  quickStatItem: {
    flex: 1,
    alignItems: 'center',
  },
  quickStatValue: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.headerText,
  },
  quickStatLabel: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.5)',
    marginTop: 2,
    fontWeight: '500',
  },
  quickStatDivider: {
    width: 1,
    height: 28,
    backgroundColor: 'rgba(255,255,255,0.15)',
  },
  scroll: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  scrollContent: {
    padding: spacing.lg,
    paddingBottom: spacing['5xl'],
  },
  centerState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: spacing['6xl'],
  },
  filtersRow: {
    marginBottom: spacing.xl,
  },
  filterChip: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm + 2,
    borderRadius: radius.full,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    marginRight: spacing.sm,
  },
  filterChipActive: {
    backgroundColor: colors.headerBg,
    borderColor: colors.headerBg,
  },
  filterChipText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  filterChipTextActive: {
    color: colors.headerText,
  },
  customDateRow: {
    flexDirection: 'row',
    gap: spacing.md,
    paddingVertical: spacing.sm,
  },
  customDateField: {
    flex: 1,
  },
  fieldLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textSecondary,
    marginBottom: spacing.xs,
  },
  dateInput: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.sm,
    fontSize: 14,
    color: colors.textPrimary,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.textPrimary,
    marginBottom: spacing.md,
    marginTop: spacing.sm,
  },
  kpiGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginBottom: spacing.xl,
  },
  chartContainer: {
    gap: spacing.md,
  },
  chartLegend: {
    flexDirection: 'row',
    gap: spacing.xl,
    marginBottom: spacing.sm,
  },
  legendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  legendDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  legendText: {
    fontSize: 13,
    fontWeight: '500',
    color: colors.textSecondary,
  },
  chartRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  chartLabel: {
    width: 68,
    fontSize: 11,
    fontWeight: '600',
    color: colors.textSecondary,
    textAlign: 'right',
  },
  chartBars: {
    flex: 1,
    gap: 3,
  },
  barRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  barTrack: {
    flex: 1,
    height: 14,
    borderRadius: 7,
    backgroundColor: colors.bg,
    overflow: 'hidden',
  },
  bar: {
    height: 14,
    borderRadius: 7,
    minWidth: 4,
  },
  barValue: {
    width: 72,
    fontSize: 10,
    fontWeight: '600',
    color: colors.textTertiary,
    textAlign: 'right',
  },
  actionsRow: {
    marginTop: spacing.xl,
    gap: spacing.md,
  },
  actionsSpacer: {
    height: spacing.xs,
  },
  outstandingRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingVertical: spacing.md,
  },
  outstandingRowBorder: {
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border,
  },
  outstandingLeft: { flex: 1, marginRight: spacing.md },
  outstandingName: { fontSize: 15, fontWeight: '600', color: colors.textPrimary },
  outstandingRight: { alignItems: 'flex-end', gap: spacing.xs },
  outstandingAmount: { fontSize: 16, fontWeight: '700' },
  outstandingStatus: { paddingHorizontal: spacing.sm, paddingVertical: 2, borderRadius: radius.sm },
  outstandingStatusText: { fontSize: 11, fontWeight: '600' },
  viewAllBtn: { marginTop: spacing.md, paddingVertical: spacing.sm, alignItems: 'center' },
  viewAllText: { fontSize: 14, fontWeight: '600', color: colors.info },
});
