import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  RefreshControl,
  SafeAreaView
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { supabase } from '../../services/supabase';
import { AdminStackParamList, JobSheetStatus, JobSheet } from '../../types';
import { JobSheetCard } from '../../components/JobSheetCard';
import { QuickStatusModal } from '../../components/QuickStatusModal';

type NavigationProp = NativeStackNavigationProp<AdminStackParamList, 'AdminTabs'>;

type StatusFilter = 'All' | JobSheetStatus | 'Urgent';

export const AllJobsScreen = () => {
  const navigation = useNavigation<NavigationProp>();
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [jobs, setJobs] = useState<any[]>([]);
  const [errorOccurred, setErrorOccurred] = useState(false);
  const [totalCount, setTotalCount] = useState(0);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('All');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');

  // Pagination
  const [page, setPage] = useState(0);
  const limit = 50;
  const [hasMore, setHasMore] = useState(true);

  // Quick Status Modal
  const [quickStatusModalVisible, setQuickStatusModalVisible] = useState(false);
  const [selectedJobSheet, setSelectedJobSheet] = useState<JobSheet | null>(null);

  const parseDate = (dStr: string, isEnd: boolean): string | null => {
    const parts = dStr.split('/');
    if (parts.length === 3) {
      const day = parseInt(parts[0], 10);
      const month = parseInt(parts[1], 10) - 1;
      const year = parseInt(parts[2], 10);
      const date = new Date(year, month, day);
      if (isEnd) {
        date.setHours(23, 59, 59, 999);
      }
      return date.toISOString();
    }
    return null;
  };

  const fetchJobs = async (pageNumber: number, isRefresh: boolean = false, isMounted: boolean = true) => {
    try {
      if (isMounted) setErrorOccurred(false);
      if (isRefresh) {
        if (isMounted) setLoading(true);
      } else {
        if (isMounted) setLoadingMore(true);
      }

      let query = supabase
        .from('job_sheets')
        .select('*, assignee:profiles!job_sheets_assigned_to_fkey(full_name)', { count: 'exact' });

      // Apply Search (ilike on reg, name, mobile)
      if (searchQuery.trim()) {
        const searchTerms = `%${searchQuery.trim()}%`;
        query = query.or(`registration_number.ilike.${searchTerms},customer_name.ilike.${searchTerms},customer_mobile.ilike.${searchTerms}`);
      }

      // Apply Status/Priority
      if (statusFilter === 'Urgent') {
        query = query.eq('priority', 'Urgent');
      } else if (statusFilter !== 'All') {
        query = query.eq('status', statusFilter);
      }

      // Apply Dates
      if (fromDate.trim()) {
        const isoFrom = parseDate(fromDate.trim(), false);
        if (isoFrom) query = query.gte('entry_date_time', isoFrom);
      }
      if (toDate.trim()) {
        const isoTo = parseDate(toDate.trim(), true);
        if (isoTo) query = query.lte('entry_date_time', isoTo);
      }

      // Pagination
      const from = pageNumber * limit;
      const to = from + limit - 1;
      query = query.order('created_at', { ascending: false }).range(from, to);

      const { data, count, error } = await query;
      if (error) throw error;

      if (data && isMounted) {
        if (isRefresh) {
          setJobs(data);
        } else {
          setJobs((prev) => [...prev, ...data]);
        }
        setTotalCount(count || 0);
        setHasMore(data.length === limit);
      }
    } catch (error) {
      console.error('Error fetching jobs:', error);
      if (isMounted) setErrorOccurred(true);
    } finally {
      if (isMounted) {
        setLoading(false);
        setLoadingMore(false);
        setRefreshing(false);
      }
    }
  };

  useEffect(() => {
    let isMounted = true;
    fetchJobs(0, true, isMounted);
    return () => { isMounted = false; };
  }, []);

  const applyFilters = () => {
    setPage(0);
    fetchJobs(0, true);
  };

  const clearFilters = () => {
    setSearchQuery('');
    setStatusFilter('All');
    setFromDate('');
    setToDate('');
    setPage(0);
    setTimeout(() => {
      fetchJobs(0, true);
    }, 0);
  };

  useEffect(() => {
    let isMounted = true;
    if (!loading) {
      setPage(0);
      fetchJobs(0, true, isMounted);
    }
    return () => { isMounted = false; };
  }, [statusFilter]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    setPage(0);
    fetchJobs(0, true);
  }, [searchQuery, statusFilter, fromDate, toDate]);

  const loadMore = () => {
    if (!loadingMore && hasMore && !loading) {
      const nextPage = page + 1;
      setPage(nextPage);
      fetchJobs(nextPage, false);
    }
  };

  const formatDate = (dateString: string) => {
    const options: Intl.DateTimeFormatOptions = {
      day: 'numeric', month: 'short', year: 'numeric',
      hour: 'numeric', minute: '2-digit', hour12: true
    };
    return new Intl.DateTimeFormat('en-GB', options).format(new Date(dateString));
  };

  const handleStatusUpdate = (jobSheetId: string, newStatus: string) => {
    setJobs((prevJobs) =>
      prevJobs.map((job) =>
        job.id === jobSheetId ? { ...job, status: newStatus } : job
      )
    );
  };

  const renderItem = ({ item }: { item: any }) => {
    return (
      <JobSheetCard
        jobSheet={item}
        onPress={() => navigation.navigate('JobDetailAdminScreen', { jobSheetId: item.id })}
        onQuickStatusPress={() => {
          setSelectedJobSheet(item);
          setQuickStatusModalVisible(true);
        }}
      />
    );
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>All Jobs</Text>
      </View>

      <View style={styles.container}>
        {/* Search */}
        <TextInput
          style={styles.searchInput}
          placeholder="Search by registration, customer, mobile..."
          placeholderTextColor="#888"
          value={searchQuery}
          onChangeText={setSearchQuery}
          onSubmitEditing={applyFilters}
        />

        {/* Status Pills */}
        <View style={styles.pillsContainer}>
          <FlatList
            horizontal
            showsHorizontalScrollIndicator={false}
            data={['All', 'In Queue', 'In Progress', 'On Hold', 'Completed', 'Urgent']}
            keyExtractor={(item) => item}
            renderItem={({ item }) => (
              <TouchableOpacity
                activeOpacity={0.7}
                style={[styles.pill, statusFilter === item && styles.pillActive]}
                onPress={() => setStatusFilter(item as StatusFilter)}
              >
                <Text style={[
                  styles.pillText, 
                  statusFilter === item && styles.pillTextActive,
                  item === 'Urgent' && statusFilter !== 'Urgent' && { color: '#e74c3c' }
                ]}>
                  {item === 'Urgent' ? '⚡ Urgent' : item}
                </Text>
              </TouchableOpacity>
            )}
          />
        </View>

        {/* Date Filters */}
        <View style={styles.dateFilterContainer}>
          <View style={styles.dateInputsRow}>
            <TextInput
              style={styles.dateInput}
              placeholder="From DD/MM/YYYY"
              value={fromDate}
              onChangeText={setFromDate}
            />
            <TextInput
              style={styles.dateInput}
              placeholder="To DD/MM/YYYY"
              value={toDate}
              onChangeText={setToDate}
            />
          </View>
          <View style={styles.dateButtonsRow}>
            <TouchableOpacity activeOpacity={0.7} style={styles.applyButton} onPress={applyFilters}>
              <Text style={styles.applyButtonText}>Apply Filters</Text>
            </TouchableOpacity>
            <TouchableOpacity activeOpacity={0.7} style={styles.clearButton} onPress={clearFilters}>
              <Text style={styles.clearButtonText}>Clear</Text>
            </TouchableOpacity>
          </View>
        </View>

        <Text style={styles.countText}>Showing {totalCount} job sheets</Text>

        {loading && !refreshing && jobs.length === 0 ? (
          <ActivityIndicator size="large" color="#FFD700" style={{ marginTop: 40 }} />
        ) : errorOccurred ? (
          <View style={styles.errorContainer}>
            <Text style={styles.errorText}>⚠️ Failed to load data. Pull down to refresh.</Text>
          </View>
        ) : (
          <FlatList
            data={jobs}
            keyExtractor={(item) => item.id}
            renderItem={renderItem}
            contentContainerStyle={styles.listContent}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#FFD700" />}
            onEndReached={loadMore}
            onEndReachedThreshold={0.5}
            ListFooterComponent={() =>
              loadingMore ? <ActivityIndicator color="#FFD700" style={{ margin: 20 }} /> : null
            }
            ListEmptyComponent={() => (
              <View style={styles.emptyContainer}>
                <Text style={styles.emptyIcon}>🔧</Text>
                <Text style={styles.emptyText}>No job sheets found.</Text>
              </View>
            )}
          />
        )}
      </View>

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
  header: { padding: 20, backgroundColor: '#1a1a2e' },
  headerTitle: { color: '#fff', fontSize: 24, fontWeight: 'bold' },
  container: { flex: 1, backgroundColor: '#f5f5f5', padding: 12 },
  searchInput: { backgroundColor: '#fff', padding: 14, borderRadius: 8, borderWidth: 1, borderColor: '#ddd', fontSize: 16, marginBottom: 12 },
  pillsContainer: { marginBottom: 12 },
  pill: { backgroundColor: '#fff', paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, marginRight: 8, borderWidth: 1, borderColor: '#ddd' },
  pillActive: { backgroundColor: '#FFD700', borderColor: '#FFD700' },
  pillText: { color: '#666', fontWeight: '600' },
  pillTextActive: { color: '#1a1a2e' },
  dateFilterContainer: { backgroundColor: '#fff', padding: 12, borderRadius: 8, marginBottom: 12, borderWidth: 1, borderColor: '#ddd' },
  dateInputsRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10 },
  dateInput: { flex: 1, backgroundColor: '#f9f9f9', borderWidth: 1, borderColor: '#eee', borderRadius: 6, padding: 10, marginRight: 5, fontSize: 14 },
  dateButtonsRow: { flexDirection: 'row', justifyContent: 'flex-end' },
  applyButton: { backgroundColor: '#FFD700', paddingHorizontal: 16, paddingVertical: 8, borderRadius: 6, marginLeft: 8 },
  applyButtonText: { color: '#1a1a2e', fontWeight: 'bold' },
  clearButton: { backgroundColor: '#f0f0f0', paddingHorizontal: 16, paddingVertical: 8, borderRadius: 6, marginLeft: 8 },
  clearButtonText: { color: '#333', fontWeight: 'bold' },
  countText: { fontSize: 14, color: '#666', marginBottom: 8, fontWeight: '500', marginLeft: 4 },
  listContent: { paddingBottom: 20 },
  card: { backgroundColor: '#fff', borderRadius: 12, padding: 16, marginBottom: 12, elevation: 1, borderWidth: 1, borderColor: '#eee' },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  regNumber: { fontSize: 18, fontWeight: 'bold', color: '#1a1a2e' },
  badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  badgeText: { fontSize: 12, fontWeight: 'bold' },
  customerText: { fontSize: 15, color: '#444', marginBottom: 4 },
  modelText: { fontSize: 14, color: '#666', marginBottom: 4 },
  dateText: { fontSize: 13, color: '#888', marginBottom: 10 },
  cardFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderTopWidth: 1, borderTopColor: '#f0f0f0', paddingTop: 10 },
  techText: { fontSize: 14, color: '#555', fontWeight: '500' },
  tatText: { fontSize: 13, color: '#155724', fontWeight: 'bold', backgroundColor: '#D4EDDA', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 4 },
  emptyText: { textAlign: 'center', color: '#888', marginTop: 10, fontSize: 16 },
  errorContainer: { alignItems: 'center', padding: 40 },
  errorText: { color: '#e74c3c', fontSize: 14, textAlign: 'center', fontWeight: '600' },
  emptyContainer: { alignItems: 'center', padding: 40 },
  emptyIcon: { fontSize: 50, marginBottom: 16 },
});
