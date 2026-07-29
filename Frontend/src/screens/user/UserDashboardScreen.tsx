import React, { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, FlatList, TextInput,
  ActivityIndicator, RefreshControl, Alert, StatusBar, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { supabase } from '../../services/supabase';
import { RootStackParamList, JobSheet, UserProfile } from '../../types';
import { JobSheetCard } from '../../components/JobSheetCard';
import { QuickStatusModal } from '../../components/QuickStatusModal';
import { useAuth } from '../../context/AuthContext';
import { getGreeting } from '../../utils/greetingUtils';
import { colors, spacing, radius, typography, shadows } from '../../theme/tokens';
import { Icon } from '../../components/ui/Icon';
import { Card } from '../../components/ui/Card';

type NavigationProp = NativeStackNavigationProp<RootStackParamList, 'UserDashboard'>;

export const UserDashboardScreen = () => {
  const navigation = useNavigation<NavigationProp>();
  const { signOut } = useAuth();
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [jobSheets, setJobSheets] = useState<JobSheet[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [errorOccurred, setErrorOccurred] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState('All');
  const [quickStatusModalVisible, setQuickStatusModalVisible] = useState(false);
  const [selectedJobSheet, setSelectedJobSheet] = useState<JobSheet | null>(null);

  const greeting = getGreeting();
  const todayDate = new Intl.DateTimeFormat('en-GB', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  }).format(new Date());

  const fetchData = async (signal: AbortSignal) => {
    try {
      setErrorOccurred(false);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data: profile } = await supabase.from('profiles').select('*').eq('id', user.id).single();
      const { data: jobs } = await supabase
        .from('job_sheets').select(`*, assignee:profiles!job_sheets_assigned_to_fkey(*)`).eq('assigned_to', user.id).order('created_at', { ascending: false });
      if (!signal.aborted) {
        if (profile) setUserProfile(profile as UserProfile);
        if (jobs) setJobSheets(jobs as JobSheet[]);
      }
    } catch { if (!signal.aborted) setErrorOccurred(true); }
    finally { if (!signal.aborted) { setLoading(false); setRefreshing(false); } }
  };

  useFocusEffect(
    useCallback(() => {
      const ac = new AbortController();
      fetchData(ac.signal);
      return () => ac.abort();
    }, [])
  );

  const onRefresh = () => { setRefreshing(true); fetchData(new AbortController().signal); };

  const handleLogout = () => {
    if (Platform.OS === 'web') {
      if (window.confirm('Are you sure you want to logout?')) signOut();
    } else {
      Alert.alert('Logout', 'Sure you want to logout?', [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Logout', style: 'destructive', onPress: signOut },
      ]);
    }
  };

  const handleStatusUpdate = (jobSheetId: string, newStatus: string) => {
    setJobSheets(prev => prev.map(j => j.id === jobSheetId ? { ...j, status: newStatus as JobSheet['status'] } : j));
  };

  const renderJobItem = useCallback(({ item }: { item: JobSheet }) => (
    <JobSheetCard
      jobSheet={item}
      onPress={() => navigation.navigate('JobSheetDetail', { jobSheetId: item.id })}
      onQuickStatusPress={() => { setSelectedJobSheet(item); setQuickStatusModalVisible(true); }}
    />
  ), [navigation]);

  const activeJobsCount = jobSheets.filter(j => j.status !== 'Completed').length;
  const completedJobsCount = jobSheets.filter(j => j.status === 'Completed').length;

  const filteredJobs = jobSheets.filter(job => {
    const matchesSearch = job.registration_number.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (job.customer_name && job.customer_name.toLowerCase().includes(searchQuery.toLowerCase()));
    return matchesSearch && (activeFilter === 'All' || job.status === activeFilter);
  });

  const filters = ['All', 'In Queue', 'In Progress', 'On Hold', 'Completed'];

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="light-content" backgroundColor={colors.headerBg} />
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <Text style={styles.greeting} allowFontScaling={false}>{greeting}, {userProfile?.full_name || userProfile?.username || 'Tech'}!</Text>
          <Text style={styles.date} allowFontScaling={false}>{todayDate}</Text>
        </View>
        <View style={styles.headerActions}>
          <TouchableOpacity onPress={() => navigation.navigate('Settings')} style={styles.iconBtn} hitSlop={8}>
            <Icon name="settings-outline" size={22} color={colors.headerText} />
          </TouchableOpacity>
          <TouchableOpacity onPress={handleLogout} style={styles.iconBtn} hitSlop={8}>
            <Icon name="log-out-outline" size={22} color={colors.headerText} />
          </TouchableOpacity>
        </View>
      </View>
      <View style={styles.body}>

        <View style={styles.summaryRow}>
          <Card>
            <View style={styles.summaryContent}>
              <Icon name="construct-outline" size={24} color={colors.info} />
              <Text style={[styles.summaryValue, { color: colors.info }]} allowFontScaling={false}>{activeJobsCount}</Text>
              <Text style={styles.summaryLabel} allowFontScaling={false}>Active</Text>
            </View>
          </Card>
          <Card>
            <View style={styles.summaryContent}>
              <Icon name="checkmark-done-outline" size={24} color={colors.success} />
              <Text style={[styles.summaryValue, { color: colors.success }]} allowFontScaling={false}>{completedJobsCount}</Text>
              <Text style={styles.summaryLabel} allowFontScaling={false}>Completed</Text>
            </View>
          </Card>
        </View>

        <Text style={styles.sectionTitle} allowFontScaling={false}>My Job Sheets</Text>

        <View style={styles.searchWrap}>
          <Icon name="search-outline" size={18} color={colors.textTertiary} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search by reg or customer..."
            placeholderTextColor={colors.textTertiary}
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
          {searchQuery ? (
            <TouchableOpacity onPress={() => setSearchQuery('')} hitSlop={8}>
              <Icon name="close-circle" size={18} color={colors.textTertiary} />
            </TouchableOpacity>
          ) : null}
        </View>

        <FlatList
          horizontal
          showsHorizontalScrollIndicator={false}
          data={filters}
          keyExtractor={(item) => item}
          contentContainerStyle={styles.filterRow}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={[styles.filterChip, activeFilter === item && styles.filterChipActive]}
              onPress={() => setActiveFilter(item)}
            >
              <Text style={[styles.filterText, activeFilter === item && styles.filterTextActive]} allowFontScaling={false}>{item}</Text>
            </TouchableOpacity>
          )}
        />

        {loading && !refreshing ? (
          <View style={styles.center}><ActivityIndicator size="large" color={colors.accent} /></View>
        ) : errorOccurred ? (
          <View style={styles.center}>
            <Icon name="cloud-offline-outline" size={40} color={colors.textTertiary} />
            <Text style={styles.errorText} allowFontScaling={false}>Failed to load. Pull down to refresh.</Text>
          </View>
        ) : (
          <FlatList
            data={filteredJobs}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.list}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accent} colors={[colors.accent]} />}
            removeClippedSubviews
            maxToRenderPerBatch={10}
            windowSize={7}
            ListEmptyComponent={
              <View style={styles.center}>
                <Icon name="clipboard-outline" size={40} color={colors.textTertiary} />
                <Text style={styles.emptyText} allowFontScaling={false}>No job sheets found.</Text>
              </View>
            }
            renderItem={renderJobItem}
          />
        )}
      </View>

      <TouchableOpacity style={styles.fab} onPress={() => navigation.navigate('CreateJobSheet')} activeOpacity={0.8}>
        <Icon name="add" size={28} color={colors.headerBg} />
      </TouchableOpacity>

      <QuickStatusModal
        visible={quickStatusModalVisible}
        jobSheet={selectedJobSheet}
        onClose={() => setQuickStatusModalVisible(false)}
        onStatusUpdate={handleStatusUpdate}
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.headerBg },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', padding: spacing.lg, paddingBottom: spacing.xl, backgroundColor: colors.headerBg },
  greeting: { ...typography.title2, color: colors.headerText },
  date: { ...typography.footnote, color: 'rgba(255,255,255,0.5)', marginTop: 2 },
  headerActions: { flexDirection: 'row', gap: spacing.sm, marginTop: 4 },
  iconBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.1)', alignItems: 'center', justifyContent: 'center' },
  body: { flex: 1, backgroundColor: colors.bg, padding: spacing.lg },
  summaryRow: { flexDirection: 'row', gap: spacing.md, marginBottom: spacing.xl },
  summaryContent: { alignItems: 'center', gap: spacing.xs, paddingVertical: spacing.sm },
  summaryValue: { ...typography.title1, fontWeight: '700' },
  summaryLabel: { ...typography.caption2, fontWeight: '600', color: colors.textSecondary },
  sectionTitle: { ...typography.title3, color: colors.textPrimary, marginBottom: spacing.md },
  searchWrap: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: colors.surface,
    borderWidth: 1, borderColor: colors.border, borderRadius: radius.md,
    paddingHorizontal: spacing.md, marginBottom: spacing.sm, gap: spacing.sm,
  },
  searchInput: { flex: 1, ...typography.body, color: colors.textPrimary, paddingVertical: spacing.md },
  filterRow: { marginBottom: spacing.md },
  filterChip: {
    paddingHorizontal: spacing.lg, paddingVertical: spacing.sm, borderRadius: radius.full,
    backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, marginRight: spacing.sm,
  },
  filterChipActive: { backgroundColor: colors.headerBg, borderColor: colors.headerBg },
  filterText: { ...typography.subhead, color: colors.textSecondary, fontWeight: '500' },
  filterTextActive: { color: colors.accent, fontWeight: '600' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: spacing['3xl'], gap: spacing.md },
  list: { paddingBottom: 100 },
  errorText: { ...typography.subhead, color: colors.textSecondary, textAlign: 'center' },
  emptyText: { ...typography.callout, color: colors.textSecondary, textAlign: 'center' },
  fab: {
    position: 'absolute', bottom: spacing.xl, right: spacing.xl,
    width: 56, height: 56, borderRadius: 28, backgroundColor: colors.accent,
    justifyContent: 'center', alignItems: 'center',
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 6, elevation: 8,
  },
});
