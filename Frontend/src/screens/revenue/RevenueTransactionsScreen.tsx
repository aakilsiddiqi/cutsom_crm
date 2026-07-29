import React, { useState, useCallback, useRef, useEffect } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator,
  RefreshControl, TextInput, Alert, Platform, ScrollView,
} from 'react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import {
  ScreenWrapper, HeaderBar, EmptyState, Icon,
} from '../../components/ui';
import { colors, spacing, radius, typography } from '../../theme/tokens';
import {
  RevenueTransaction, RevenueTransactionType, RevenueCategory, RevenueStatus,
  REVENUE_TRANSACTION_TYPES, REVENUE_CATEGORIES, REVENUE_STATUSES,
  isIncomeType, isExpenseType, AdminStackParamList,
} from '../../types';
import { fetchTransactions, softDeleteTransaction, RevenueFilters } from '../../services/revenue';
import { useAuth } from '../../context/AuthContext';

type NavigationProp = NativeStackNavigationProp<AdminStackParamList, 'RevenueTransactions'>;

const TOP_CATEGORIES: RevenueCategory[] = ['Sales', 'Salary', 'Marketing', 'Rent', 'Other'];

const STATUS_COLORS: Record<RevenueStatus, string> = {
  Paid: colors.success,
  Pending: '#FF9500',
  'Partially Paid': colors.info,
  Cancelled: colors.error,
  Refunded: '#AF52DE',
  Adjusted: colors.textSecondary,
};

const parseDDMMYYYY = (val: string): string | null => {
  const parts = val.split('-');
  if (parts.length !== 3) return null;
  const d = parseInt(parts[0], 10);
  const m = parseInt(parts[1], 10);
  const y = parseInt(parts[2], 10);
  if (isNaN(d) || isNaN(m) || isNaN(y)) return null;
  return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
};

const formatAmount = (value: number): string =>
  `\u20B9 ${value.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export const RevenueTransactionsScreen = () => {
  const navigation = useNavigation<NavigationProp>();
  const { profile } = useAuth();

  const [transactions, setTransactions] = useState<RevenueTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [totalCount, setTotalCount] = useState(0);

  const [filterType, setFilterType] = useState('');
  const [filterCategory, setFilterCategory] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [search, setSearch] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');

  const currentPage = useRef(1);
  const isMounted = useRef(true);

  useEffect(() => {
    isMounted.current = true;
    return () => { isMounted.current = false; };
  }, []);

  const buildFilters = useCallback((page: number = 1): RevenueFilters => {
    const filters: RevenueFilters = { page, page_size: 50 };
    if (filterType) filters.transaction_type = filterType;
    if (filterCategory) filters.category = filterCategory;
    if (filterStatus) filters.status = filterStatus;
    if (search) filters.search = search;
    const fd = parseDDMMYYYY(fromDate);
    const td = parseDDMMYYYY(toDate);
    if (fd) filters.from_date = fd;
    if (td) filters.to_date = td;
    return filters;
  }, [filterType, filterCategory, filterStatus, search, fromDate, toDate]);

  const fetchData = useCallback(async (page: number = 1, append: boolean = false) => {
    try {
      const filters = buildFilters(page);
      const { data, count } = await fetchTransactions(filters);
      if (!isMounted.current) return;
      if (append) {
        setTransactions(prev => [...prev, ...data]);
      } else {
        setTransactions(data);
      }
      setTotalCount(count);
    } catch {
      if (!isMounted.current) return;
    }
  }, [buildFilters]);

  useFocusEffect(
    useCallback(() => {
      currentPage.current = 1;
      setLoading(true);
      fetchData(1).finally(() => {
        if (isMounted.current) setLoading(false);
      });
    }, [fetchData])
  );

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    currentPage.current = 1;
    fetchData(1).finally(() => {
      if (isMounted.current) setRefreshing(false);
    });
  }, [fetchData]);

  const handleLoadMore = useCallback(() => {
    if (loadingMore || transactions.length >= totalCount) return;
    setLoadingMore(true);
    const nextPage = currentPage.current + 1;
    currentPage.current = nextPage;
    fetchData(nextPage, true).finally(() => {
      if (isMounted.current) setLoadingMore(false);
    });
  }, [loadingMore, transactions.length, totalCount, fetchData]);

  const handleDelete = useCallback(async (txn: RevenueTransaction) => {
    if (!profile) return;
    let confirmed = false;
    if (Platform.OS === 'web') {
      confirmed = window.confirm(`Delete "${txn.description || txn.transaction_type}" transaction?`);
    } else {
      confirmed = await new Promise<boolean>((resolve) => {
        Alert.alert(
          'Delete Transaction',
          `Delete "${txn.description || txn.transaction_type}"? This cannot be undone.`,
          [
            { text: 'Cancel', style: 'cancel', onPress: () => resolve(false) },
            { text: 'Delete', style: 'destructive', onPress: () => resolve(true) },
          ]
        );
      });
    }
    if (!confirmed) return;
    try {
      const result = await softDeleteTransaction(txn.id, profile.id) as any;
      setTransactions(prev =>
        prev
          .filter(t => t.id !== txn.id)
          .map(t => (t.id === result.updatedParent?.id ? result.updatedParent : t))
      );
      setTotalCount(prev => prev - (result.updatedParent ? 0 : 1));
    } catch (e: any) {
      Alert.alert('Error', e?.message || 'Failed to delete transaction');
    }
  }, [profile]);

  const getTypeBadgeStyle = (type: RevenueTransactionType) => {
    if (isIncomeType(type)) return { bg: '#E8F8ED', fg: '#34C759' };
    if (isExpenseType(type)) return { bg: '#FFF0EF', fg: '#FF3B30' };
    return { bg: '#EBF5FF', fg: '#007AFF' };
  };

  const renderItem = ({ item }: { item: RevenueTransaction }) => {
    const typeStyle = getTypeBadgeStyle(item.transaction_type);
    const statusColor = STATUS_COLORS[item.status];
    const dateStr = new Date(item.transaction_date).toLocaleDateString('en-IN', {
      day: '2-digit', month: 'short', year: 'numeric',
    });
    return (
      <TouchableOpacity
        style={styles.row}
        onPress={() => navigation.navigate('RevenueTransactionDetail', { transactionId: item.id })}
        onLongPress={() => handleDelete(item)}
        activeOpacity={0.7}
      >
        <View style={styles.rowTop}>
          <Text style={styles.dateText} allowFontScaling={false}>{dateStr}</Text>
          <Text style={[styles.amountText, { color: typeStyle.fg }]} allowFontScaling={false}>
            {formatAmount(item.amount)}
          </Text>
        </View>
        <View style={styles.rowMiddle}>
          <View style={[styles.typeBadge, { backgroundColor: typeStyle.bg }]}>
            <Text style={[styles.typeBadgeText, { color: typeStyle.fg }]} allowFontScaling={false}>
              {item.transaction_type}
            </Text>
          </View>
          <Text style={[styles.statusBadge, { color: statusColor }]} allowFontScaling={false}>
            {item.status}
          </Text>
        </View>
        <View style={styles.metaRow}>
          {item.customer_name ? (
            <Text style={styles.metaText} numberOfLines={1} allowFontScaling={false}>
              {item.customer_name}
            </Text>
          ) : null}
          {item.service_sheet_number ? (
            <Text style={styles.metaText} numberOfLines={1} allowFontScaling={false}>
              {item.service_sheet_number}
            </Text>
          ) : null}
        </View>
        {item.description ? (
          <Text style={styles.descriptionText} numberOfLines={1} allowFontScaling={false}>
            {item.description}
          </Text>
        ) : null}
      </TouchableOpacity>
    );
  };

  const renderChip = (
    label: string,
    active: boolean,
    onPress: () => void,
  ) => (
    <TouchableOpacity
      key={label}
      style={[styles.chip, active && styles.chipActive]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <Text style={[styles.chipText, active && styles.chipTextActive]} allowFontScaling={false}>
        {label}
      </Text>
    </TouchableOpacity>
  );

  const renderChipRow = (
    items: readonly string[],
    active: string,
    setter: (v: string) => void,
  ) => (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipRow}>
      {renderChip('All', active === '', () => setter(''))}
      {items.map(item => renderChip(item, active === item, () => setter(active === item ? '' : item)))}
    </ScrollView>
  );

  const handleSearchSubmit = () => {
    currentPage.current = 1;
    setLoading(true);
    fetchData(1).finally(() => {
      if (isMounted.current) setLoading(false);
    });
  };

  return (
    <ScreenWrapper>
      <HeaderBar title="Transactions" onBack={() => navigation.navigate('RevenueDashboard')} />
      <View style={styles.filterContainer}>
        <ScrollView style={styles.filterScroll} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
          <Text style={styles.filterLabel} allowFontScaling={false}>Type</Text>
          {renderChipRow(REVENUE_TRANSACTION_TYPES, filterType, setFilterType)}

          <Text style={styles.filterLabel} allowFontScaling={false}>Category</Text>
          {renderChipRow(TOP_CATEGORIES, filterCategory, setFilterCategory)}

          <Text style={styles.filterLabel} allowFontScaling={false}>Status</Text>
          {renderChipRow(REVENUE_STATUSES, filterStatus, setFilterStatus)}

          <View style={styles.dateRow}>
            <TextInput
              style={styles.dateInput}
              placeholder="From DD-MM-YYYY"
              placeholderTextColor={colors.textTertiary}
              value={fromDate}
              onChangeText={setFromDate}
              maxLength={10}
              keyboardType="numbers-and-punctuation"
            />
            <Text style={styles.dateSep} allowFontScaling={false}>-</Text>
            <TextInput
              style={styles.dateInput}
              placeholder="To DD-MM-YYYY"
              placeholderTextColor={colors.textTertiary}
              value={toDate}
              onChangeText={setToDate}
              maxLength={10}
              keyboardType="numbers-and-punctuation"
            />
          </View>

          <View style={styles.searchRow}>
            <Icon name="search" size={18} color={colors.textTertiary} />
            <TextInput
              style={styles.searchInput}
              placeholder="Search description, invoice, customer, sheet..."
              placeholderTextColor={colors.textTertiary}
              value={search}
              onChangeText={setSearch}
              returnKeyType="search"
              onSubmitEditing={handleSearchSubmit}
            />
            {search ? (
              <TouchableOpacity onPress={() => setSearch('')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <Icon name="close-circle" size={18} color={colors.textTertiary} />
              </TouchableOpacity>
            ) : null}
          </View>

          {totalCount > 0 && (
            <Text style={styles.countText} allowFontScaling={false}>
              {totalCount} transaction{totalCount !== 1 ? 's' : ''}
            </Text>
          )}
        </ScrollView>
      </View>

      <View style={styles.listContainer}>
        {loading && !refreshing ? (
          <View style={styles.center}>
            <ActivityIndicator size="large" color={colors.accent} />
          </View>
        ) : (
          <FlatList
            data={transactions}
            keyExtractor={(item) => item.id}
            renderItem={renderItem}
            contentContainerStyle={transactions.length === 0 ? styles.emptyList : styles.list}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={onRefresh}
                tintColor={colors.accent}
                colors={[colors.accent]}
              />
            }
            onEndReached={handleLoadMore}
            onEndReachedThreshold={0.3}
            ListFooterComponent={
              loadingMore ? (
                <View style={styles.footerLoader}>
                  <ActivityIndicator size="small" color={colors.accent} />
                </View>
              ) : null
            }
            ListEmptyComponent={
              <EmptyState
                icon="receipt-outline"
                title="No Transactions"
                message="Pull down to refresh or adjust filters."
              />
            }
            showsVerticalScrollIndicator={false}
          />
        )}
      </View>

      <TouchableOpacity
        style={styles.fab}
        onPress={() => navigation.navigate('RevenueTransactionForm', undefined)}
        activeOpacity={0.8}
      >
        <Icon name="add" size={28} color="#000" />
      </TouchableOpacity>
    </ScreenWrapper>
  );
};

const styles = StyleSheet.create({
  filterContainer: {
    maxHeight: 240,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  filterScroll: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  filterLabel: {
    ...typography.caption1,
    color: colors.textSecondary,
    fontWeight: '600',
    marginBottom: spacing.xs,
    marginTop: spacing.sm,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  chipRow: {
    flexDirection: 'row',
    marginBottom: spacing.xs,
  },
  chip: {
    paddingVertical: 6,
    paddingHorizontal: spacing.md,
    borderRadius: radius.full,
    backgroundColor: colors.bg,
    borderWidth: 1,
    borderColor: colors.border,
    marginRight: spacing.sm,
  },
  chipActive: {
    backgroundColor: colors.accent,
    borderColor: colors.accent,
  },
  chipText: {
    ...typography.caption1,
    color: colors.textSecondary,
    fontWeight: '500',
  },
  chipTextActive: {
    color: '#000',
    fontWeight: '600',
  },
  dateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing.sm,
    marginBottom: spacing.xs,
  },
  dateInput: {
    flex: 1,
    height: 40,
    backgroundColor: colors.bg,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    ...typography.caption1,
    color: colors.textPrimary,
    borderWidth: 1,
    borderColor: colors.border,
  },
  dateSep: {
    marginHorizontal: spacing.sm,
    color: colors.textTertiary,
    ...typography.body,
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.bg,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    height: 40,
    marginTop: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  searchInput: {
    flex: 1,
    ...typography.caption1,
    color: colors.textPrimary,
    marginLeft: spacing.sm,
    paddingVertical: 0,
  },
  countText: {
    ...typography.caption2,
    color: colors.textTertiary,
    marginTop: spacing.sm,
    textAlign: 'right',
  },
  listContainer: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  list: {
    padding: spacing.lg,
    paddingBottom: 100,
  },
  emptyList: {
    flexGrow: 1,
    justifyContent: 'center',
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  row: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.lg,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  rowTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  dateText: {
    ...typography.caption1,
    color: colors.textSecondary,
  },
  amountText: {
    ...typography.headline,
    fontWeight: '700',
  },
  rowMiddle: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.xs,
    gap: spacing.sm,
  },
  typeBadge: {
    paddingVertical: 2,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.sm,
  },
  typeBadgeText: {
    ...typography.caption2,
    fontWeight: '600',
  },
  statusBadge: {
    ...typography.caption2,
    fontWeight: '600',
  },
  metaRow: { flexDirection: 'row', gap: spacing.md, marginTop: spacing.xs },
  metaText: { fontSize: 12, color: colors.info, fontWeight: '500' },
  descriptionText: {
    ...typography.caption1,
    color: colors.textSecondary,
    marginTop: spacing.xs,
  },
  footerLoader: {
    paddingVertical: spacing.xl,
    alignItems: 'center',
  },
  fab: {
    position: 'absolute',
    bottom: Platform.OS === 'ios' ? 100 : 90,
    right: spacing.xl,
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: colors.accent,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: colors.accent,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 16,
    elevation: 12,
    zIndex: 100,
  },
});
