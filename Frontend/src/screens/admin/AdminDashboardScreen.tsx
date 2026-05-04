import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  SafeAreaView,
  Alert,
  Platform
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { supabase } from '../../services/supabase';
import { AdminStackParamList, JobSheet } from '../../types';
import { useAuth } from '../../context/AuthContext';
import { getGreeting, getGreetingEmoji } from '../../utils/greetingUtils';
import { JobSheetCard } from '../../components/JobSheetCard';
import { QuickStatusModal } from '../../components/QuickStatusModal';

type NavigationProp = NativeStackNavigationProp<AdminStackParamList, 'AdminTabs'>;

type FilterType = 'Today' | 'This Week' | 'This Month' | 'This Quarter';

export const AdminDashboardScreen = () => {
  const navigation = useNavigation<NavigationProp>();
  const { signOut } = useAuth();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [errorOccurred, setErrorOccurred] = useState(false);
  const [selectedFilter, setSelectedFilter] = useState<FilterType>('Today');

  const { profile } = useAuth();
  const [greeting, setGreeting] = useState(getGreeting());
  const [greetingEmoji, setGreetingEmoji] = useState(getGreetingEmoji());

  useEffect(() => {
    const interval = setInterval(() => {
      setGreeting(getGreeting());
      setGreetingEmoji(getGreetingEmoji());
    }, 60000);
    return () => clearInterval(interval);
  }, []);

  const [metrics, setMetrics] = useState({
    totalToday: 0,
    inQueue: 0,
    inProgress: 0,
    completed: 0,
    onHold: 0,
    totalThisMonth: 0,
  });

  const [recentActivity, setRecentActivity] = useState<any[]>([]);

  // Quick Status Modal
  const [quickStatusModalVisible, setQuickStatusModalVisible] = useState(false);
  const [selectedJobSheet, setSelectedJobSheet] = useState<JobSheet | null>(null);

  const fetchDashboardData = async (isMounted: boolean = true) => {
    try {
      if (isMounted) setErrorOccurred(false);
      const now = new Date();
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

      const startOfWeek = new Date(today);
      const day = startOfWeek.getDay();
      const diff = startOfWeek.getDate() - day + (day === 0 ? -6 : 1);
      startOfWeek.setDate(diff);

      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

      const quarter = Math.floor(now.getMonth() / 3);
      const startOfQuarter = new Date(now.getFullYear(), quarter * 3, 1);

      let filterDate = today;
      if (selectedFilter === 'This Week') filterDate = startOfWeek;
      if (selectedFilter === 'This Month') filterDate = startOfMonth;
      if (selectedFilter === 'This Quarter') filterDate = startOfQuarter;

      const minDate = filterDate < startOfMonth ? filterDate : startOfMonth;
      const minIso = minDate.toISOString();
      const filterIso = filterDate.toISOString();
      const monthIso = startOfMonth.toISOString();

      const { data: allJobs, error } = await supabase
        .from('job_sheets')
        .select('*, assignee:profiles!job_sheets_assigned_to_fkey(*)')
        .gte('entry_date_time', minIso);

      if (error) throw error;

      if (isMounted) {
        const filterJobs = allJobs?.filter(j => new Date(j.entry_date_time) >= new Date(filterIso)) || [];
        const monthJobs = allJobs?.filter(j => new Date(j.entry_date_time) >= new Date(monthIso)) || [];

        setMetrics({
          totalToday: filterJobs.length,
          inQueue: filterJobs.filter(j => j.status === 'In Queue').length,
          inProgress: filterJobs.filter(j => j.status === 'In Progress').length,
          completed: filterJobs.filter(j => j.status === 'Completed').length,
          onHold: filterJobs.filter(j => j.status === 'On Hold').length,
          totalThisMonth: monthJobs.length,
        });

        const sortedActivity = [...filterJobs]
          .sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime())
          .slice(0, 10);
          
        setRecentActivity(sortedActivity);
      }
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
      if (isMounted) setErrorOccurred(true);
    } finally {
      if (isMounted) {
        setLoading(false);
        setRefreshing(false);
      }
    }
  };

  useEffect(() => {
    let isMounted = true;
    fetchDashboardData(isMounted);
    return () => { isMounted = false; };
  }, [selectedFilter]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchDashboardData(true);
  }, [selectedFilter]);

  const handleLogout = () => {
    if (Platform.OS === 'web') {
      if (window.confirm('Are you sure you want to logout?')) {
        signOut();
      }
    } else {
      Alert.alert(
        'Logout',
        'Are you sure you want to logout?',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Logout',
            style: 'destructive',
            onPress: async () => {
              await signOut();
            }
          }
        ]
      );
    }
  };

  const handleStatusUpdate = (jobSheetId: string, newStatus: string) => {
    setRecentActivity((prev) =>
      prev.map((job) =>
        job.id === jobSheetId ? { ...job, status: newStatus } : job
      )
    );
    // Refresh metrics without full loading
    fetchDashboardData(true);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'In Queue': return '#FFF3CD';
      case 'In Progress': return '#CCE5FF';
      case 'Completed': return '#D4EDDA';
      case 'On Hold': return '#F8D7DA';
      default: return '#eee';
    }
  };

  const getStatusTextColor = (status: string) => {
    switch (status) {
      case 'In Queue': return '#856404';
      case 'In Progress': return '#004085';
      case 'Completed': return '#155724';
      case 'On Hold': return '#721c24';
      default: return '#333';
    }
  };

  const timeAgo = (dateString: string) => {
    const diffMs = new Date().getTime() - new Date(dateString).getTime();
    const mins = Math.round(diffMs / 60000);
    const hrs = Math.round(mins / 60);
    const days = Math.round(hrs / 24);
    if (mins < 60) return `${mins} mins ago`;
    if (hrs < 24) return `${hrs} hours ago`;
    return `${days} days ago`;
  };

  const todayStr = new Intl.DateTimeFormat('en-GB', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
  }).format(new Date());

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>{greetingEmoji} {greeting}, {profile?.full_name || 'Admin'}</Text>
          <Text style={styles.headerSubtitle}>{todayStr}</Text>
        </View>
        <View style={styles.headerActions}>
          <TouchableOpacity 
            activeOpacity={0.7} 
            onPress={() => navigation.navigate('Settings')} 
            style={styles.headerButton}
            accessibilityLabel="Settings"
          >
            <Text style={styles.headerButtonText}>⚙️</Text>
            <Text style={styles.headerButtonLabel}>Settings</Text>
          </TouchableOpacity>
          <TouchableOpacity 
            activeOpacity={0.7} 
            onPress={handleLogout} 
            style={styles.headerButton}
            accessibilityLabel="Logout"
          >
            <Text style={styles.headerButtonText}>🚪</Text>
            <Text style={styles.headerButtonLabel}>Logout</Text>
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#FFD700" />}
      >
        {loading && !refreshing ? (
          <ActivityIndicator size="large" color="#FFD700" style={{ marginTop: 40 }} />
        ) : errorOccurred ? (
          <View style={styles.centerContainer}>
            <Text style={styles.errorText}>⚠️ Failed to load data. Pull down to refresh.</Text>
          </View>
        ) : (
          <>
            {/* Metric Cards */}
            <View style={styles.metricsGrid}>
              <View style={[styles.metricCard, { backgroundColor: '#f0f0f0' }]}>
                <Text style={styles.metricNumber}>{metrics.totalToday}</Text>
                <Text style={styles.metricLabel}>Total Period</Text>
              </View>
              <View style={[styles.metricCard, { backgroundColor: '#FFF3CD' }]}>
                <Text style={styles.metricNumber}>{metrics.inQueue}</Text>
                <Text style={styles.metricLabel}>In Queue</Text>
              </View>
              <View style={[styles.metricCard, { backgroundColor: '#CCE5FF' }]}>
                <Text style={styles.metricNumber}>{metrics.inProgress}</Text>
                <Text style={styles.metricLabel}>In Progress</Text>
              </View>
              <View style={[styles.metricCard, { backgroundColor: '#D4EDDA' }]}>
                <Text style={styles.metricNumber}>{metrics.completed}</Text>
                <Text style={styles.metricLabel}>Completed</Text>
              </View>
              <View style={[styles.metricCard, { backgroundColor: '#F8D7DA' }]}>
                <Text style={styles.metricNumber}>{metrics.onHold}</Text>
                <Text style={styles.metricLabel}>On Hold</Text>
              </View>
              <View style={[styles.metricCard, { backgroundColor: '#e9ecef' }]}>
                <Text style={styles.metricNumber}>{metrics.totalThisMonth}</Text>
                <Text style={styles.metricLabel}>Total This Month</Text>
              </View>
            </View>

            {/* Filters */}
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filtersScroll} contentContainerStyle={styles.filtersContent}>
              {(['Today', 'This Week', 'This Month', 'This Quarter'] as FilterType[]).map((filter) => (
                <TouchableOpacity
                  key={filter}
                  activeOpacity={0.7}
                  style={[styles.filterButton, selectedFilter === filter && styles.filterButtonActive]}
                  onPress={() => setSelectedFilter(filter)}
                >
                  <Text style={[styles.filterText, selectedFilter === filter && styles.filterTextActive]}>
                    {filter}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            {/* Recent Activity */}
            <Text style={styles.sectionTitle}>Recent Activity</Text>
            {recentActivity.length === 0 ? (
              <View style={styles.emptyContainer}>
                <Text style={styles.emptyText}>🔧 No job sheets found</Text>
              </View>
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
          </>
        )}
      </ScrollView>

      <TouchableOpacity 
        style={styles.fab}
        activeOpacity={0.7}
        onPress={() => navigation.navigate('CreateJobSheet')}
      >
        <Text style={styles.fabText}>+</Text>
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
  safeArea: { flex: 1, backgroundColor: '#1a1a2e' },
  header: { padding: 15, backgroundColor: '#1a1a2e', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  headerTitle: { color: '#fff', fontSize: 20, fontWeight: 'bold', marginBottom: 2 },
  headerSubtitle: { color: '#aaa', fontSize: 12 },
  headerActions: { flexDirection: 'row', gap: 12 },
  headerButton: { alignItems: 'center', minWidth: 50 },
  headerButtonText: { fontSize: 20, marginBottom: 2 },
  headerButtonLabel: { color: '#aaa', fontSize: 10, fontWeight: '600' },
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  content: { padding: 16, paddingBottom: 40 },
  metricsGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', marginBottom: 20 },
  metricCard: { width: '48%', padding: 20, borderRadius: 12, marginBottom: 12, alignItems: 'center', elevation: 2 },
  metricNumber: { fontSize: 32, fontWeight: 'bold', color: '#333' },
  metricLabel: { fontSize: 12, color: '#666', marginTop: 4, fontWeight: '600' },
  filtersScroll: { marginBottom: 24 },
  filtersContent: { paddingVertical: 4 },
  filterButton: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, backgroundColor: '#fff', marginRight: 10, elevation: 1 },
  filterButtonActive: { backgroundColor: '#FFD700' },
  filterText: { color: '#666', fontWeight: '600' },
  filterTextActive: { color: '#1a1a2e' },
  sectionTitle: { fontSize: 20, fontWeight: 'bold', color: '#333', marginBottom: 16 },
  activityCard: { backgroundColor: '#fff', padding: 16, borderRadius: 12, marginBottom: 12, elevation: 1 },
  activityHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  activityReg: { fontSize: 16, fontWeight: 'bold', color: '#333' },
  activityTime: { fontSize: 12, color: '#888' },
  activityCustomer: { fontSize: 14, color: '#555', marginBottom: 12 },
  activityFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  badgeText: { fontSize: 12, fontWeight: 'bold' },
  activityTech: { fontSize: 12, color: '#666', fontWeight: '500' },
  centerContainer: { alignItems: 'center', padding: 40 },
  errorText: { color: '#e74c3c', fontSize: 14, textAlign: 'center', fontWeight: '600' },
  emptyContainer: { alignItems: 'center', padding: 40 },
  emptyText: { color: '#888', fontSize: 16 },
  fab: {
    position: 'absolute',
    bottom: 20,
    right: 20,
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#FFD700',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 10,
    zIndex: 999,
  },
  fabText: {
    fontSize: 34,
    fontWeight: 'bold',
    color: '#1a1a2e',
    lineHeight: 38,
  },
});
