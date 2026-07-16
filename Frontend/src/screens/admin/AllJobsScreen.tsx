import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  RefreshControl,
  Animated,
  StatusBar,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { supabase } from '../../services/supabase';
import { AdminStackParamList, JobSheetStatus, JobSheet } from '../../types';
import { colors, typography, radius, spacing, shadows } from '../../theme/tokens';
import { ScreenWrapper } from '../../components/ui/ScreenWrapper';
import { Icon } from '../../components/ui/Icon';
import { EmptyState } from '../../components/ui/EmptyState';
import { JobSheetCard } from '../../components/JobSheetCard';
import { QuickStatusModal } from '../../components/QuickStatusModal';
import { parseDateString } from '../../utils/formatting';

type NavigationProp = NativeStackNavigationProp<AdminStackParamList, 'AdminTabs'>;
type StatusFilter = 'All' | JobSheetStatus | 'Urgent';

export const AllJobsScreen = () => {
  const navigation = useNavigation<NavigationProp>();
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [jobs, setJobs] = useState<JobSheet[]>([]);
  const [errorOccurred, setErrorOccurred] = useState(false);
  const [totalCount, setTotalCount] = useState(0);

  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('All');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [showDateFilter, setShowDateFilter] = useState(false);

  const [page, setPage] = useState(0);
  const limit = 50;
  const [hasMore, setHasMore] = useState(true);

  const [quickStatusModalVisible, setQuickStatusModalVisible] = useState(false);
  const [selectedJobSheet, setSelectedJobSheet] = useState<JobSheet | null>(null);

  // Animations
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(15)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 400, useNativeDriver: true }),
      Animated.spring(slideAnim, { toValue: 0, speed: 50, bounciness: 6, useNativeDriver: true }),
    ]).start();
  }, []);

  const fetchJobs = async (pageNumber: number, isRefresh: boolean = false, signal: AbortSignal) => {
    try {
      if (!signal.aborted) setErrorOccurred(false);
      if (isRefresh) {
        if (!signal.aborted) setLoading(true);
      } else {
        if (!signal.aborted) setLoadingMore(true);
      }

      let query = supabase
        .from('job_sheets')
        .select('*, assignee:profiles!job_sheets_assigned_to_fkey(full_name)', { count: 'exact' });

      if (searchQuery.trim()) {
        const searchTerms = `%${searchQuery.trim()}%`;
        query = query.or(`registration_number.ilike.${searchTerms},customer_name.ilike.${searchTerms},customer_mobile.ilike.${searchTerms}`);
      }

      if (statusFilter === 'Urgent') {
        query = query.eq('priority', 'Urgent');
      } else if (statusFilter !== 'All') {
        query = query.eq('status', statusFilter);
      }

      if (fromDate.trim()) {
        const isoFrom = parseDateString(fromDate.trim(), false);
        if (isoFrom) query = query.gte('entry_date_time', isoFrom);
      }
      if (toDate.trim()) {
        const isoTo = parseDateString(toDate.trim(), true);
        if (isoTo) query = query.lte('entry_date_time', isoTo);
      }

      const from = pageNumber * limit;
      const to = from + limit - 1;
      query = query.order('created_at', { ascending: false }).range(from, to);

      const { data, count, error } = await query;
      if (error) throw error;

      if (data && !signal.aborted) {
        if (isRefresh) {
          setJobs(data);
        } else {
          setJobs((prev) => [...prev, ...data]);
        }
        setTotalCount(count || 0);
        setHasMore(data.length === limit);
      }
    } catch (error) {
      if (!signal.aborted) setErrorOccurred(true);
    } finally {
      if (!signal.aborted) {
        setLoading(false);
        setLoadingMore(false);
        setRefreshing(false);
      }
    }
  };

  useEffect(() => {
    const ac = new AbortController();
    fetchJobs(0, true, ac.signal);
    return () => ac.abort();
  }, []);

  useEffect(() => {
    const ac = new AbortController();
    if (!loading) {
      setPage(0);
      fetchJobs(0, true, ac.signal);
    }
    return () => ac.abort();
  }, [statusFilter]);

  const applyFilters = () => {
    setPage(0);
    const ac = new AbortController();
    fetchJobs(0, true, ac.signal);
  };

  const clearFilters = () => {
    setSearchQuery('');
    setStatusFilter('All');
    setFromDate('');
    setToDate('');
    setPage(0);
    setTimeout(() => {
      const ac = new AbortController();
      fetchJobs(0, true, ac.signal);
    }, 0);
  };

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    setPage(0);
    const ac = new AbortController();
    fetchJobs(0, true, ac.signal);
  }, [searchQuery, statusFilter, fromDate, toDate]);

  const loadMore = () => {
    if (!loadingMore && hasMore && !loading) {
      const nextPage = page + 1;
      setPage(nextPage);
      const ac = new AbortController();
      fetchJobs(nextPage, false, ac.signal);
    }
  };

  const handleStatusUpdate = (jobSheetId: string, newStatus: string) => {
    setJobs((prevJobs) =>
      prevJobs.map((job) =>
        job.id === jobSheetId ? { ...job, status: newStatus as JobSheetStatus } : job
      )
    );
  };

  const renderItem = useCallback(({ item }: { item: JobSheet }) => (
    <JobSheetCard
      jobSheet={item}
      onPress={() => navigation.navigate('JobDetailAdminScreen', { jobSheetId: item.id })}
      onQuickStatusPress={() => {
        setSelectedJobSheet(item);
        setQuickStatusModalVisible(true);
      }}
    />
  ), [navigation]);

  const statusPills: StatusFilter[] = ['All', 'In Queue', 'In Progress', 'On Hold', 'Completed', 'Urgent'];

  return (
    <ScreenWrapper>
      <StatusBar barStyle="light-content" />

      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Text style={styles.headerTitle} allowFontScaling={false}>All Jobs</Text>
          <View style={styles.headerBadge}>
            <Text style={styles.headerBadgeText} allowFontScaling={false}>{totalCount}</Text>
          </View>
        </View>
        <TouchableOpacity
          style={styles.dateToggleBtn}
          onPress={() => setShowDateFilter(!showDateFilter)}
          activeOpacity={0.7}
        >
          <Icon name="filter-outline" size={20} color={colors.headerText} />
          {showDateFilter && <View style={styles.filterDot} />}
        </TouchableOpacity>
      </View>

      <Animated.View style={[styles.container, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>
        {/* Search Bar */}
        <View style={styles.searchContainer}>
          <Icon name="search-outline" size={18} color={colors.textTertiary} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search jobs, customers, mobile..."
            placeholderTextColor={colors.textTertiary}
            value={searchQuery}
            onChangeText={setSearchQuery}
            onSubmitEditing={applyFilters}
            returnKeyType="search"
          />
          {searchQuery ? (
            <TouchableOpacity onPress={() => { setSearchQuery(''); applyFilters(); }} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Icon name="close-circle" size={18} color={colors.textTertiary} />
            </TouchableOpacity>
          ) : null}
        </View>

        {/* Date Filter */}
        {showDateFilter && (
          <View style={styles.dateFilterCard}>
            <View style={styles.dateInputsRow}>
              <View style={styles.dateInputWrap}>
                <Text style={styles.dateInputLabel} allowFontScaling={false}>From</Text>
                <TextInput
                  style={styles.dateInput}
                  placeholder="DD/MM/YYYY"
                  placeholderTextColor={colors.textTertiary}
                  value={fromDate}
                  onChangeText={setFromDate}
                />
              </View>
              <View style={styles.dateInputWrap}>
                <Text style={styles.dateInputLabel} allowFontScaling={false}>To</Text>
                <TextInput
                  style={styles.dateInput}
                  placeholder="DD/MM/YYYY"
                  placeholderTextColor={colors.textTertiary}
                  value={toDate}
                  onChangeText={setToDate}
                />
              </View>
            </View>
            <View style={styles.dateActions}>
              <TouchableOpacity style={styles.dateActionBtn} onPress={applyFilters}>
                <Text style={styles.dateActionText} allowFontScaling={false}>Apply</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.dateActionBtn, styles.dateActionClear]} onPress={clearFilters}>
                <Text style={[styles.dateActionText, { color: colors.textSecondary }]} allowFontScaling={false}>Clear</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* Status Pills */}
        <FlatList
          horizontal
          data={statusPills}
          keyExtractor={(item) => item}
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.pillsRow}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={[styles.pill, statusFilter === item && styles.pillActive]}
              onPress={() => setStatusFilter(item)}
              activeOpacity={0.7}
            >
              {item === 'Urgent' && <Icon name="flash" size={12} color={statusFilter === item ? '#000' : colors.error} />}
              <Text style={[styles.pillText, statusFilter === item && styles.pillTextActive]}>
                {item}
              </Text>
            </TouchableOpacity>
          )}
        />

        {/* Job List */}
        {loading && !refreshing && jobs.length === 0 ? (
          <View style={styles.centerState}>
            <ActivityIndicator size="large" color={colors.accent} />
          </View>
        ) : errorOccurred ? (
          <View style={styles.centerState}>
            <EmptyState icon="cloud-offline-outline" title="Failed to load data" message="Pull down to refresh and try again." />
          </View>
        ) : (
          <FlatList
            data={jobs}
            keyExtractor={(item) => item.id}
            renderItem={renderItem}
            contentContainerStyle={styles.listContent}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accent} />}
            onEndReached={loadMore}
            onEndReachedThreshold={0.5}
            removeClippedSubviews
            maxToRenderPerBatch={10}
            windowSize={7}
            showsVerticalScrollIndicator={false}
            ListFooterComponent={() =>
              loadingMore ? <ActivityIndicator color={colors.accent} style={{ margin: spacing.xl }} /> : null
            }
            ListEmptyComponent={() => (
              <EmptyState icon="clipboard-outline" title="No job sheets found" message="Try adjusting your filters or create a new job." />
            )}
          />
        )}
      </Animated.View>

      <QuickStatusModal
        visible={quickStatusModalVisible}
        jobSheet={selectedJobSheet}
        onClose={() => setQuickStatusModalVisible(false)}
        onStatusUpdate={handleStatusUpdate}
      />
    </ScreenWrapper>
  );
};

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    backgroundColor: colors.headerBg,
    borderBottomLeftRadius: 20,
    borderBottomRightRadius: 20,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: colors.headerText,
  },
  headerBadge: {
    backgroundColor: colors.accent,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radius.full,
  },
  headerBadgeText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#000',
  },
  dateToggleBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  filterDot: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.accent,
  },
  container: {
    flex: 1,
    backgroundColor: colors.bg,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
  },
  // Search
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: 14,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    color: colors.textPrimary,
    marginLeft: spacing.sm,
    paddingVertical: 2,
  },
  // Pills
  pillsRow: {
    paddingBottom: spacing.md,
    gap: spacing.xs,
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.full,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 4,
  },
  pillActive: {
    backgroundColor: colors.headerBg,
    borderColor: colors.headerBg,
  },
  pillText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  pillTextActive: {
    color: colors.headerText,
  },
  // Date Filter
  dateFilterCard: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: spacing.lg,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  dateInputsRow: {
    flexDirection: 'row',
    gap: spacing.md,
    marginBottom: spacing.md,
  },
  dateInputWrap: {
    flex: 1,
  },
  dateInputLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textSecondary,
    marginBottom: spacing.xs,
  },
  dateInput: {
    backgroundColor: colors.bg,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
    fontSize: 14,
    color: colors.textPrimary,
  },
  dateActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: spacing.sm,
  },
  dateActionBtn: {
    backgroundColor: colors.headerBg,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm + 2,
    borderRadius: 10,
  },
  dateActionClear: {
    backgroundColor: colors.bg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  dateActionText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.headerText,
  },
  // States
  centerState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: spacing['6xl'],
  },
  listContent: {
    paddingTop: spacing.xs,
    paddingBottom: spacing['5xl'],
  },
});
