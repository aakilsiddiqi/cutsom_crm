import React, { useState, useEffect, useCallback } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  TouchableOpacity, 
  FlatList, 
  TextInput,
  ActivityIndicator,
  RefreshControl
} from 'react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { supabase } from '../../services/supabase';
import { RootStackParamList, JobSheet, UserProfile } from '../../types';
import { JobSheetCard } from '../../components/JobSheetCard';

type NavigationProp = NativeStackNavigationProp<RootStackParamList, 'UserDashboard'>;

export const UserDashboardScreen = () => {
  const navigation = useNavigation<NavigationProp>();
  
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [jobSheets, setJobSheets] = useState<JobSheet[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState('All');

  const fetchDashboardData = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Fetch Profile
      const { data: profile } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();
      
      if (profile) setUserProfile(profile as UserProfile);

      // Fetch Job Sheets (assigned to OR created by)
      const { data: jobs, error } = await supabase
        .from('job_sheets')
        .select(`
          *,
          assignee:profiles!job_sheets_assigned_to_fkey(*)
        `)
        .or(`assigned_to.eq.${user.id},created_by.eq.${user.id}`)
        .order('created_at', { ascending: false });

      if (error) throw error;
      if (jobs) setJobSheets(jobs as JobSheet[]);
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      fetchDashboardData();
    }, [])
  );

  const onRefresh = () => {
    setRefreshing(true);
    fetchDashboardData();
  };

  // Formatting Date
  const todayDate = new Intl.DateTimeFormat('en-GB', { 
    weekday: 'long', 
    day: 'numeric', 
    month: 'long', 
    year: 'numeric' 
  }).format(new Date());

  // Metrics
  const activeJobsCount = jobSheets.filter(j => j.status !== 'Completed').length;
  const completedJobsCount = jobSheets.filter(j => j.status === 'Completed').length;

  // Filtering
  const filteredJobs = jobSheets.filter(job => {
    const matchesSearch = 
      job.registration_number.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (job.customer_name && job.customer_name.toLowerCase().includes(searchQuery.toLowerCase()));
    
    const matchesFilter = activeFilter === 'All' || job.status === activeFilter;
    
    return matchesSearch && matchesFilter;
  });

  const filters = ['All', 'In Queue', 'In Progress', 'On Hold', 'Completed'];

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.greeting}>Namaste, {userProfile?.full_name || userProfile?.username || 'Technician'}!</Text>
        <Text style={styles.dateText}>{todayDate}</Text>
      </View>

      {/* Summary Cards */}
      <View style={styles.summaryContainer}>
        <View style={[styles.summaryCard, { backgroundColor: '#CCE5FF' }]}>
          <Text style={[styles.summaryValue, { color: '#004085' }]}>{activeJobsCount}</Text>
          <Text style={[styles.summaryLabel, { color: '#004085' }]}>My Active Jobs</Text>
        </View>
        <View style={[styles.summaryCard, { backgroundColor: '#D4EDDA' }]}>
          <Text style={[styles.summaryValue, { color: '#155724' }]}>{completedJobsCount}</Text>
          <Text style={[styles.summaryLabel, { color: '#155724' }]}>My Completed</Text>
        </View>
      </View>

      {/* Search & Filters */}
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>My Job Sheets</Text>
      </View>
      
      <TextInput
        style={styles.searchBar}
        placeholder="Search by Registration or Customer..."
        value={searchQuery}
        onChangeText={setSearchQuery}
      />

      <View style={styles.filterRow}>
        <FlatList
          horizontal
          showsHorizontalScrollIndicator={false}
          data={filters}
          keyExtractor={(item) => item}
          renderItem={({ item }) => (
            <TouchableOpacity 
              style={[styles.filterChip, activeFilter === item && styles.filterChipActive]}
              onPress={() => setActiveFilter(item)}
            >
              <Text style={[styles.filterText, activeFilter === item && styles.filterTextActive]}>{item}</Text>
            </TouchableOpacity>
          )}
        />
      </View>

      {/* Job List */}
      {loading && !refreshing ? (
        <ActivityIndicator size="large" color="#FFD700" style={{ marginTop: 50 }} />
      ) : (
        <FlatList
          data={filteredJobs}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ paddingBottom: 100 }}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#FFD700']} tintColor="#FFD700" />
          }
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <Text style={styles.emptyIcon}>🔧</Text>
              <Text style={styles.emptyText}>No job sheets yet. Tap + to create your first one.</Text>
            </View>
          }
          renderItem={({ item }) => (
            <JobSheetCard 
              jobSheet={item} 
              onPress={() => navigation.navigate('JobSheetDetail', { jobSheetId: item.id })}
            />
          )}
        />
      )}

      {/* FAB */}
      <TouchableOpacity 
        style={styles.fab} 
        onPress={() => navigation.navigate('CreateJobSheet')}
      >
        <Text style={styles.fabText}>+</Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
    padding: 16,
  },
  header: {
    marginTop: 10,
    marginBottom: 20,
  },
  greeting: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
  },
  dateText: {
    fontSize: 14,
    color: '#666',
    marginTop: 4,
  },
  summaryContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 24,
  },
  summaryCard: {
    flex: 1,
    padding: 16,
    borderRadius: 12,
    marginHorizontal: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  summaryValue: {
    fontSize: 28,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  summaryLabel: {
    fontSize: 14,
    fontWeight: '600',
  },
  sectionHeader: {
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
  },
  searchBar: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    marginBottom: 12,
  },
  filterRow: {
    marginBottom: 16,
  },
  filterChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#e0e0e0',
    marginRight: 8,
  },
  filterChipActive: {
    backgroundColor: '#333',
  },
  filterText: {
    fontSize: 14,
    color: '#555',
    fontWeight: '500',
  },
  filterTextActive: {
    color: '#FFD700',
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 60,
  },
  emptyIcon: {
    fontSize: 50,
    marginBottom: 16,
  },
  emptyText: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
  },
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
    elevation: 5,
  },
  fabText: {
    fontSize: 30,
    fontWeight: 'normal',
    color: '#1a1a2e',
    lineHeight: 34,
  }
});
