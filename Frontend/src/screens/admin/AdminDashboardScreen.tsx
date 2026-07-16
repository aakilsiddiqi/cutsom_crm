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
  Alert,
  Platform,
  Animated,
  StatusBar,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { supabase } from '../../services/supabase';
import { AdminStackParamList, JobSheet, JobSheetStatus, JobUpdate } from '../../types';
import { useAuth } from '../../context/AuthContext';
import { getGreeting, getGreetingEmoji } from '../../utils/greetingUtils';
import { timeAgo } from '../../utils/formatting';
import { colors, typography, radius, spacing, shadows } from '../../theme/tokens';
import { Icon } from '../../components/ui/Icon';
import { StatusBadge } from '../../components/ui/StatusBadge';
import { EmptyState } from '../../components/ui/EmptyState';
import { JobSheetCard } from '../../components/JobSheetCard';
import { QuickStatusModal } from '../../components/QuickStatusModal';
import { ScreenWrapper } from '../../components/ui/ScreenWrapper';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';

type NavigationProp = NativeStackNavigationProp<AdminStackParamList, 'AdminTabs'>;
type FilterType = 'Today' | 'This Week' | 'This Month' | 'Previous Month' | 'Custom';

const getSavedFilter = () => {
  try {
    if (Platform.OS === 'web') {
      const raw = sessionStorage.getItem('dashFilter');
      if (raw) return JSON.parse(raw);
    }
  } catch {}
  return null;
};

const getDefaultFilter = (): FilterType => {
  const saved = getSavedFilter();
  if (saved?.filter) return saved.filter;
  return 'Today';
};

const STATUS_COLORS: Record<string, { bg: string; text: string }> = {
  'In Queue': { bg: colors.statusQueueBg, text: colors.statusQueue },
  'In Progress': { bg: colors.statusProgressBg, text: colors.statusProgress },
  Completed: { bg: colors.statusCompletedBg, text: colors.statusCompleted },
  'On Hold': { bg: colors.statusHoldBg, text: colors.statusHold },
};

export const AdminDashboardScreen = () => {
  const navigation = useNavigation<NavigationProp>();
  const { signOut, profile } = useAuth();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [errorOccurred, setErrorOccurred] = useState(false);
  const [selectedFilter, setSelectedFilter] = useState<FilterType>(getDefaultFilter);
  const greeting = getGreeting();
  const greetingEmoji = getGreetingEmoji();

  const [metrics, setMetrics] = useState({
    totalToday: 0,
    inQueue: 0,
    inProgress: 0,
    completed: 0,
    onHold: 0,
    totalThisMonth: 0,
  });

  const [recentActivity, setRecentActivity] = useState<JobSheet[]>([]);
  const [updates, setUpdates] = useState<JobUpdate[]>([]);
  const [logFromDate, setLogFromDate] = useState('');
  const [logToDate, setLogToDate] = useState('');
  const [quickStatusModalVisible, setQuickStatusModalVisible] = useState(false);
  const [selectedJobSheet, setSelectedJobSheet] = useState<JobSheet | null>(null);
  const [fromDate, setFromDate] = useState(getSavedFilter()?.from || '');
  const [toDate, setToDate] = useState(getSavedFilter()?.to || '');
  const [showCustomDate, setShowCustomDate] = useState(false);
  const [customFromIso, setCustomFromIso] = useState('');
  const [customToIso, setCustomToIso] = useState('');

  // ponytail: simple timestamp cache, avoids refetch on tab switch
  const cacheTs = useRef(0);
  const CACHE_TTL = 30_000;

  // Animations
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(20)).current;
  const fabScale = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 500, useNativeDriver: true }),
      Animated.spring(slideAnim, { toValue: 0, speed: 50, bounciness: 6, useNativeDriver: true }),
    ]).start();

    Animated.spring(fabScale, { toValue: 1, speed: 50, bounciness: 8, useNativeDriver: true }).start();
  }, []);

  // ponytail: persist filter across page reload (web)
  useEffect(() => {
    if (Platform.OS !== 'web') return;
    try { sessionStorage.setItem('dashFilter', JSON.stringify({ filter: selectedFilter, from: fromDate, to: toDate })); } catch {}
  }, [selectedFilter, fromDate, toDate]);

  const fetchDashboardData = async (signal: AbortSignal, force: boolean = false) => {
    if (!force && Date.now() - cacheTs.current < CACHE_TTL) {
      setLoading(false);
      return;
    }
    try {
      if (!signal.aborted) setErrorOccurred(false);
      const now = new Date();
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const startOfWeek = new Date(today);
      const day = startOfWeek.getDay();
      const diff = startOfWeek.getDate() - day + (day === 0 ? -6 : 1);
      startOfWeek.setDate(diff);
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      const quarter = Math.floor(now.getMonth() / 3);
      const startOfQuarter = new Date(now.getFullYear(), quarter * 3, 1);
      const startOfPrevMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const endOfPrevMonth = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59);

      let filterDate = today;
      let customFilterIso: string | null = null;

      if (selectedFilter === 'This Week') filterDate = startOfWeek;
      else if (selectedFilter === 'This Month') filterDate = startOfMonth;
      else if (selectedFilter === 'Previous Month') {
        filterDate = startOfPrevMonth;
        customFilterIso = endOfPrevMonth.toISOString();
      } else if (selectedFilter === 'Custom') {
        filterDate = new Date(0);
      }

      const filterIso = customFilterIso || filterDate.toISOString();
      const monthIso = startOfMonth.toISOString();

      let allJobsQuery = supabase
        .from('job_sheets')
        .select('*, assignee:profiles!job_sheets_assigned_to_fkey(*)')
        .order('entry_date_time', { ascending: false })
        .limit(50);

      if (selectedFilter === 'Previous Month') {
        allJobsQuery = allJobsQuery
          .gte('entry_date_time', filterDate.toISOString())
          .lte('entry_date_time', customFilterIso!);
      } else if (selectedFilter === 'Custom') {
        if (customFromIso) allJobsQuery = allJobsQuery.gte('entry_date_time', customFromIso);
        if (customToIso) allJobsQuery = allJobsQuery.lte('entry_date_time', customToIso);
      } else {
        allJobsQuery = allJobsQuery.gte('entry_date_time', filterIso);
      }

      const oneMonthAgo = new Date(now.getFullYear(), now.getMonth() - 1, now.getDate()).toISOString();

      const [{ data: allJobs, error }, { count: monthCount, error: monthError }] = await Promise.all([
        allJobsQuery,
        supabase
          .from('job_sheets')
          .select('id', { count: 'exact', head: true })
          .gte('entry_date_time', monthIso),
      ]);

      if (error) throw error;
      if (monthError) throw monthError;

      if (!signal.aborted) {
        cacheTs.current = Date.now();
        setMetrics({
          totalToday: allJobs?.length || 0,
          inQueue: allJobs?.filter(j => j.status === 'In Queue').length || 0,
          inProgress: allJobs?.filter(j => j.status === 'In Progress').length || 0,
          completed: allJobs?.filter(j => j.status === 'Completed').length || 0,
          onHold: allJobs?.filter(j => j.status === 'On Hold').length || 0,
          totalThisMonth: monthCount || 0,
        });

        const sortedActivity = [...(allJobs || [])]
          .sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime())
          .slice(0, 10);
        setRecentActivity(sortedActivity);
      }
    } catch (error) {
      if (!signal.aborted) setErrorOccurred(true);
    } finally {
      if (!signal.aborted) {
        setLoading(false);
        setRefreshing(false);
      }
    }
  };

  const handleCustomSearch = () => {
    const ddmmToIso = (v: string) => {
      const parts = v.split('-');
      if (parts.length !== 3) return '';
      return `${parts[2]}-${parts[1]}-${parts[0]}`;
    };
    cacheTs.current = 0;
    setCustomFromIso(fromDate ? ddmmToIso(fromDate) : '');
    setCustomToIso(toDate ? ddmmToIso(toDate) : '');
  };

  useEffect(() => {
    const ac = new AbortController();
    setShowCustomDate(selectedFilter === 'Custom');
    fetchDashboardData(ac.signal);
    return () => ac.abort();
  }, [selectedFilter, customFromIso, customToIso]);

  const fetchActivityLog = useCallback(async (from: string, to: string) => {
    try {
      let query = supabase
        .from('job_updates_with_profile')
        .select('id, job_sheet_id, update_note, status_changed_to, created_at, updated_by_name')
        .order('created_at', { ascending: false })
        .limit(100);

      if (from) query = query.gte('created_at', from);
      if (to) query = query.lte('created_at', to);

      const { data, error } = await query;
      if (!error && data) setUpdates(data as JobUpdate[]);
    } catch {}
  }, []);

  const handleLogSearch = () => {
    const ddmmToIso = (v: string) => {
      const parts = v.split('-');
      if (parts.length !== 3) return '';
      return `${parts[2]}-${parts[1]}-${parts[0]}`;
    };
    const from = logFromDate ? `${ddmmToIso(logFromDate)}T00:00:00` : '';
    const to = logToDate ? `${ddmmToIso(logToDate)}T23:59:59` : '';
    fetchActivityLog(from, to);
  };

  // Initial log fetch: last 1 month
  useEffect(() => {
    const d = new Date(); d.setMonth(d.getMonth() - 1);
    fetchActivityLog(d.toISOString(), new Date().toISOString());
  }, []);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    cacheTs.current = 0;
    const ac = new AbortController();
    fetchDashboardData(ac.signal, true);
  }, [selectedFilter, customFromIso, customToIso]);

  const handleLogout = () => {
    if (Platform.OS === 'web') {
      if (window.confirm('Are you sure you want to logout?')) signOut();
    } else {
      Alert.alert('Logout', 'Are you sure you want to logout?', [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Logout', style: 'destructive', onPress: async () => { await signOut(); } },
      ]);
    }
  };

  const handleStatusUpdate = (jobSheetId: string, newStatus: string) => {
    setRecentActivity((prev) =>
      prev.map((job) => job.id === jobSheetId ? { ...job, status: newStatus as JobSheetStatus } : job)
    );
    const ac = new AbortController();
    fetchDashboardData(ac.signal);
  };

  const todayStr = new Intl.DateTimeFormat('en-GB', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  }).format(new Date());

  const kpiCards = [
    { label: 'Total Jobs', value: metrics.totalToday, icon: 'layers-outline', color: '#6366F1', bg: '#EEF2FF' },
    { label: 'In Queue', value: metrics.inQueue, icon: 'time-outline', color: '#F59E0B', bg: '#FFFBEB' },
    { label: 'In Progress', value: metrics.inProgress, icon: 'construct-outline', color: '#3B82F6', bg: '#EFF6FF' },
    { label: 'On Hold', value: metrics.onHold, icon: 'pause-circle-outline', color: '#EF4444', bg: '#FEF2F2' },
  ];

  return (
    <ScreenWrapper>
      <StatusBar barStyle="light-content" />

      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerContent}>
          <View style={styles.headerLeft}>
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
              style={styles.iconBtn}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              accessibilityLabel="Notifications"
            >
              <Icon name="notifications-outline" size={22} color={colors.headerText} />
              <View style={styles.notifDot} />
            </TouchableOpacity>
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

        {/* Quick Stats Row */}
        <View style={styles.quickStats}>
          <View style={styles.quickStatItem}>
            <Text style={styles.quickStatValue} allowFontScaling={false}>{metrics.completed}</Text>
            <Text style={styles.quickStatLabel} allowFontScaling={false}>Completed</Text>
          </View>
          <View style={styles.quickStatDivider} />
          <View style={styles.quickStatItem}>
            <Text style={styles.quickStatValue} allowFontScaling={false}>{metrics.totalThisMonth}</Text>
            <Text style={styles.quickStatLabel} allowFontScaling={false}>This Month</Text>
          </View>
          <View style={styles.quickStatDivider} />
          <View style={styles.quickStatItem}>
            <Text style={[styles.quickStatValue, { color: colors.accent }]} allowFontScaling={false}>
              {metrics.totalToday > 0 ? Math.round((metrics.completed / metrics.totalToday) * 100) : 0}%
            </Text>
            <Text style={styles.quickStatLabel} allowFontScaling={false}>Completion</Text>
          </View>
        </View>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accent} />}
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
              title="Failed to load data"
              message="Pull down to refresh and try again."
            />
          </View>
        ) : (
          <Animated.View style={{ opacity: fadeAnim, transform: [{ translateY: slideAnim }] }}>
            {/* Filter Chips */}
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filtersRow}>
              {(['Today', 'This Week', 'This Month', 'Previous Month', 'Custom'] as FilterType[]).map((filter) => (
                <TouchableOpacity
                  key={filter}
                  style={[styles.filterChip, selectedFilter === filter && styles.filterChipActive]}
                  onPress={() => setSelectedFilter(filter)}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.filterChipText, selectedFilter === filter && styles.filterChipTextActive]}>
                    {filter}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            {showCustomDate && (
              <Card>
                <View style={styles.customDateRow}>
                  <View style={styles.customDateField}>
                    <Text style={styles.fieldLabel} allowFontScaling={false}>From</Text>
                    <TextInput
                      style={styles.dateInput}
                      placeholder="DD-MM-YYYY"
                      placeholderTextColor={colors.textTertiary}
                      value={fromDate}
                      onChangeText={setFromDate}
                    />
                  </View>
                  <View style={styles.customDateField}>
                    <Text style={styles.fieldLabel} allowFontScaling={false}>To</Text>
                    <TextInput
                      style={styles.dateInput}
                      placeholder="DD-MM-YYYY"
                      placeholderTextColor={colors.textTertiary}
                      value={toDate}
                      onChangeText={setToDate}
                    />
                  </View>
                </View>
                <Button title="Search" icon="search-outline" variant="primary" fullWidth onPress={handleCustomSearch} />
              </Card>
            )}

            {/* KPI Cards */}
            <Text style={styles.sectionTitle} allowFontScaling={false}>Overview</Text>
            <View style={styles.kpiGrid}>
              {kpiCards.map((kpi, i) => (
                <TouchableOpacity
                  key={kpi.label}
                  style={styles.kpiCard}
                  activeOpacity={0.7}
                >
                  <View style={[styles.kpiIconWrap, { backgroundColor: kpi.bg }]}>
                    <Icon name={kpi.icon as any} size={22} color={kpi.color} />
                  </View>
                  <Text style={styles.kpiValue} allowFontScaling={false}>{kpi.value}</Text>
                  <Text style={styles.kpiLabel} allowFontScaling={false}>{kpi.label}</Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Recent Activity */}
            <Text style={styles.sectionTitle} allowFontScaling={false}>Recent Activity</Text>

            {recentActivity.length === 0 ? (
              <EmptyState
                icon="clipboard-outline"
                title="No job sheets found"
                message="Create a new job sheet to get started."
              />
            ) : (
              recentActivity.map((activity) => (
                <JobSheetCard
                  key={activity.id}
                  jobSheet={activity}
                  onPress={() => navigation.navigate('JobDetailAdminScreen', { jobSheetId: activity.id })}
                  onQuickStatusPress={() => {
                    setSelectedJobSheet(activity);
                    setQuickStatusModalVisible(true);
                  }}
                />
              ))
            )}

            {/* Activity Log */}
            <View style={styles.sectionHeaderRow}>
              <Text style={styles.sectionTitle} allowFontScaling={false}>Activity Log</Text>
              {Platform.OS === 'web' && (
                <TouchableOpacity onPress={() => {
                  const d = new Date(); d.setMonth(d.getMonth() - 1);
                  setLogFromDate(''); setLogToDate('');
                  fetchActivityLog(d.toISOString(), new Date().toISOString());
                }}>
                  <Text style={styles.resetLink} allowFontScaling={false}>Reset</Text>
                </TouchableOpacity>
              )}
            </View>
            <Card>
              <View style={styles.logFilterRow}>
                <TextInput
                  style={styles.logDateInput}
                  placeholder="DD-MM-YYYY"
                  placeholderTextColor={colors.textTertiary}
                  value={logFromDate}
                  onChangeText={setLogFromDate}
                />
                <Text style={styles.logDateSep} allowFontScaling={false}>to</Text>
                <TextInput
                  style={styles.logDateInput}
                  placeholder="DD-MM-YYYY"
                  placeholderTextColor={colors.textTertiary}
                  value={logToDate}
                  onChangeText={setLogToDate}
                />
                <TouchableOpacity style={styles.logSearchBtn} onPress={handleLogSearch} activeOpacity={0.7}>
                  <Icon name="search-outline" size={16} color="#000" />
                </TouchableOpacity>
              </View>
            </Card>
            {updates.length === 0 ? (
              <Card>
                <View style={styles.emptyLogCard}>
                  <Icon name="time-outline" size={24} color={colors.textTertiary} />
                  <Text style={styles.emptyLogText} allowFontScaling={false}>No updates in this period.</Text>
                </View>
              </Card>
            ) : (
              updates.map((u) => {
                const ts = new Date(u.created_at);
                const formattedTs = `${ts.getDate().toString().padStart(2, '0')}-${(ts.getMonth()+1).toString().padStart(2, '0')}-${ts.getFullYear()}, ${ts.getHours().toString().padStart(2, '0')}:${ts.getMinutes().toString().padStart(2, '0')}`;
                const statusTag = u.status_changed_to ? ` → ${u.status_changed_to}` : '';
                const detail = u.update_note ? ` — ${u.update_note}` : '';
                return (
                  <Card key={u.id} padded={false}>
                    <View style={styles.logLineRow}>
                      <Text style={styles.logLineText} allowFontScaling={false} numberOfLines={3}>
                        <Text style={styles.logBold}>{u.updated_by_name || 'System'}</Text>
                        {statusTag}
                        {detail}
                        {' · '}
                        <Text style={styles.logLineTime}>{formattedTs}</Text>
                      </Text>
                    </View>
                  </Card>
                );
              })
            )}
          </Animated.View>
        )}
        <View style={{ height: 100 }} />
      </ScrollView>

      {/* FAB */}
      <Animated.View style={[styles.fab, { transform: [{ scale: fabScale }] }]}>
        <TouchableOpacity
          style={styles.fabInner}
          activeOpacity={0.85}
          onPress={() => navigation.navigate('CreateJobSheet')}
          accessibilityLabel="Create job sheet"
        >
          <Icon name="add" size={28} color="#000" />
        </TouchableOpacity>
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
  notifDot: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.error,
    borderWidth: 2,
    borderColor: colors.headerBg,
  },
  // Quick Stats
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
    fontSize: 22,
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
  // Scroll
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
  // Filters
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
  // Section
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
    marginTop: spacing.sm,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.textPrimary,
    marginBottom: spacing.md,
    marginTop: spacing.sm,
  },
  seeAll: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.accent,
    marginBottom: spacing.md,
  },
  // KPI Grid
  kpiGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginBottom: spacing.xl,
  },
  kpiCard: {
    width: '48%',
    backgroundColor: colors.surface,
    borderRadius: 20,
    padding: spacing.lg,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  kpiIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  kpiValue: {
    fontSize: 28,
    fontWeight: '800',
    color: colors.textPrimary,
    marginBottom: 2,
  },
  kpiLabel: {
    fontSize: 13,
    fontWeight: '500',
    color: colors.textSecondary,
  },
  // Custom Date
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
  // FAB
  fab: {
    position: 'absolute',
    bottom: Platform.OS === 'ios' ? 100 : 90,
    right: spacing.xl,
    shadowColor: colors.accent,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 16,
    elevation: 12,
    zIndex: 100,
  },
  fabInner: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Activity Log
  sectionHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.md, marginTop: spacing.sm },
  resetLink: { fontSize: 14, fontWeight: '600', color: colors.info },
  emptyLogCard: { alignItems: 'center', paddingVertical: spacing.xl, gap: spacing.sm },
  emptyLogText: { fontSize: 14, color: colors.textTertiary },
  logFilterRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  logDateInput: {
    flex: 1, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md,
    padding: spacing.sm, fontSize: 13, color: colors.textPrimary, backgroundColor: colors.surface,
  },
  logDateSep: { fontSize: 13, color: colors.textTertiary, fontWeight: '600' },
  logSearchBtn: {
    width: 36, height: 36, borderRadius: 10, backgroundColor: colors.accent,
    alignItems: 'center', justifyContent: 'center',
  },
  logLineRow: { paddingHorizontal: spacing.lg, paddingVertical: spacing.md },
  logLineText: { fontSize: 14, color: colors.textPrimary, lineHeight: 20 },
  logBold: { fontWeight: '700' },
  logLineTime: { fontSize: 12, color: colors.textTertiary },
});
