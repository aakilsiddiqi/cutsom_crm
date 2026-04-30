import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  SafeAreaView,
  Linking
} from 'react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { supabase } from '../../services/supabase';
import { UserProfile, AdminStackParamList } from '../../types';

type NavigationProp = NativeStackNavigationProp<AdminStackParamList, 'AdminTabs'>;

type TeamMemberStats = UserProfile & {
  activeJobs: number;
  completedThisMonth: number;
};

export const TeamScreen = () => {
  const navigation = useNavigation<NavigationProp>();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [errorOccurred, setErrorOccurred] = useState(false);
  const [teamStats, setTeamStats] = useState<TeamMemberStats[]>([]);

  const fetchTeamStats = async () => {
    try {
      setErrorOccurred(false);
      // 1. Fetch all technicians
      const { data: techsData, error: techsError } = await supabase
        .from('profiles')
        .select('*')
        .eq('role', 'user');

      if (techsError) throw techsError;

      const technicians = techsData as UserProfile[];

      if (technicians.length === 0) {
        setTeamStats([]);
        return;
      }

      // First day of current month
      const now = new Date();
      const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

      // 2. Batch fetch counts
      const statsPromises = technicians.map(async (tech) => {
        const [activeRes, completedRes] = await Promise.all([
          supabase
            .from('job_sheets')
            .select('*', { count: 'exact', head: true })
            .eq('assigned_to', tech.id)
            .neq('status', 'Completed'),
          supabase
            .from('job_sheets')
            .select('*', { count: 'exact', head: true })
            .eq('assigned_to', tech.id)
            .eq('status', 'Completed')
            .gte('completed_at', firstDayOfMonth)
        ]);

        return {
          ...tech,
          activeJobs: activeRes.count || 0,
          completedThisMonth: completedRes.count || 0,
        };
      });

      const results = await Promise.all(statsPromises);

      // Sort by active jobs descending
      results.sort((a, b) => b.activeJobs - a.activeJobs);

      setTeamStats(results);
    } catch (error) {
      console.error('Error fetching team stats:', error);
      setErrorOccurred(true);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      fetchTeamStats();
    }, [])
  );

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchTeamStats();
  }, []);

  const handleCall = (phone: string) => {
    Linking.openURL(`tel:${phone}`);
  };

  const renderItem = ({ item }: { item: TeamMemberStats }) => (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <Text style={styles.nameText}>{item.full_name || item.username}</Text>
      </View>
      
      {item.phone ? (
        <TouchableOpacity activeOpacity={0.7} onPress={() => handleCall(item.phone!)} style={styles.phoneButton}>
          <Text style={styles.phoneText}>📞 {item.phone}</Text>
        </TouchableOpacity>
      ) : (
        <Text style={styles.noPhoneText}>No phone number</Text>
      )}

      <View style={styles.statsRow}>
        <View style={[styles.badge, { backgroundColor: '#CCE5FF' }]}>
          <Text style={[styles.badgeText, { color: '#004085' }]}>Active Jobs: {item.activeJobs}</Text>
        </View>
        <View style={[styles.badge, { backgroundColor: '#D4EDDA' }]}>
          <Text style={[styles.badgeText, { color: '#155724' }]}>Completed This Month: {item.completedThisMonth}</Text>
        </View>
      </View>
    </View>
  );

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Our Team</Text>
        <TouchableOpacity 
          style={styles.headerAddButton}
          onPress={() => navigation.navigate('AddTechnician')}
        >
          <Text style={styles.headerAddButtonText}>➕ Add</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.container}>
        {loading && !refreshing ? (
          <ActivityIndicator size="large" color="#FFD700" style={{ marginTop: 40 }} />
        ) : errorOccurred ? (
          <View style={styles.errorContainer}>
            <Text style={styles.errorText}>⚠️ Failed to load data. Pull down to refresh.</Text>
          </View>
        ) : (
          <FlatList
            data={teamStats}
            keyExtractor={(item) => item.id}
            renderItem={renderItem}
            contentContainerStyle={styles.listContent}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#FFD700" />}
            ListEmptyComponent={() => (
              <View style={styles.emptyContainer}>
                <Text style={styles.emptyIcon}>👥</Text>
                <Text style={styles.emptyText}>No technicians added yet.</Text>
              </View>
            )}
          />
        )}
      </View>

      <TouchableOpacity 
        style={styles.fab}
        activeOpacity={0.7}
        onPress={() => navigation.navigate('AddTechnician')}
      >
        <Text style={styles.fabText}>+</Text>
      </TouchableOpacity>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#1a1a2e' },
  header: { 
    padding: 20, 
    backgroundColor: '#1a1a2e',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  headerTitle: { color: '#fff', fontSize: 24, fontWeight: 'bold' },
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  listContent: { padding: 16 },
  card: { backgroundColor: '#fff', padding: 16, borderRadius: 12, marginBottom: 12, elevation: 2 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  nameText: { fontSize: 18, fontWeight: 'bold', color: '#333' },
  phoneButton: { marginBottom: 12 },
  phoneText: { color: '#0066cc', fontSize: 15, fontWeight: '500' },
  noPhoneText: { color: '#888', fontSize: 14, marginBottom: 12, fontStyle: 'italic' },
  statsRow: { flexDirection: 'row', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 },
  badge: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8, flexGrow: 1, alignItems: 'center' },
  badgeText: { fontWeight: 'bold', fontSize: 14 },
  emptyContainer: { alignItems: 'center', marginTop: 60, padding: 20 },
  emptyIcon: { fontSize: 48, marginBottom: 16 },
  emptyText: { color: '#666', fontSize: 16, textAlign: 'center', lineHeight: 24 },
  errorContainer: { alignItems: 'center', padding: 40 },
  errorText: { color: '#e74c3c', fontSize: 14, textAlign: 'center', fontWeight: '600' },
  headerAddButton: {
    backgroundColor: 'rgba(255, 215, 0, 0.2)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#FFD700',
  },
  headerAddButtonText: {
    color: '#FFD700',
    fontWeight: 'bold',
    fontSize: 14,
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
