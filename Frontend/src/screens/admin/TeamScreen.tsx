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
  Linking,
  Switch,
  Alert,
  Modal,
  Platform
} from 'react-native';
import { Picker } from '@react-native-picker/picker';
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

  // Reassignment Modal State
  const [reassignModalVisible, setReassignModalVisible] = useState(false);
  const [techToRemove, setTechToRemove] = useState<{ id: string, name: string } | null>(null);
  const [activeJobsToReassign, setActiveJobsToReassign] = useState<any[]>([]);
  const [availableTechs, setAvailableTechs] = useState<UserProfile[]>([]);
  const [reassignToTechId, setReassignToTechId] = useState('');

  const fetchTeamStats = async (signal: AbortSignal) => {
    try {
      if (!signal.aborted) setErrorOccurred(false);
      const { data: techsData, error: techsError } = await supabase
        .from('profiles')
        .select('*')
        .eq('role', 'user');

      if (techsError) throw techsError;
      const technicians = techsData as UserProfile[];

      if (technicians.length === 0) {
        if (!signal.aborted) setTeamStats([]);
        return;
      }

      const now = new Date();
      const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

      const statsPromises = technicians.map(async (tech) => {
        const [activeRes, completedRes] = await Promise.all([
          supabase.from('job_sheets').select('*', { count: 'exact', head: true }).eq('assigned_to', tech.id).neq('status', 'Completed'),
          supabase.from('job_sheets').select('*', { count: 'exact', head: true }).eq('assigned_to', tech.id).eq('status', 'Completed').gte('completed_at', firstDayOfMonth),
        ]);
        return { ...tech, activeJobs: activeRes.count || 0, completedThisMonth: completedRes.count || 0 };
      });

      const results = await Promise.all(statsPromises);
      results.sort((a, b) => b.activeJobs - a.activeJobs);

      if (!signal.aborted) setTeamStats(results);
    } catch (error) {
      if (!signal.aborted) setErrorOccurred(true);
    } finally {
      if (!signal.aborted) {
        setLoading(false);
        setRefreshing(false);
      }
    }
  };

  useFocusEffect(
    useCallback(() => {
      const ac = new AbortController();
      fetchTeamStats(ac.signal);
      return () => ac.abort();
    }, [])
  );

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    const ac = new AbortController();
    fetchTeamStats(ac.signal);
  }, []);

  const handleCall = (phone: string) => {
    Linking.openURL(`tel:${phone}`);
  };

  const toggleTechStatus = async (techId: string, currentStatus: boolean, name: string) => {
    const performUpdate = async () => {
      try {
        const { error } = await supabase
          .from('profiles')
          .update({ is_active: !currentStatus })
          .eq('id', techId);

        if (error) throw error;
        
        setTeamStats(prev => prev.map(t => 
          t.id === techId ? { ...t, is_active: !currentStatus } : t
        ));
      } catch (error) {
        Alert.alert('Error', 'Failed to update status');
      }
    };

    if (Platform.OS === 'web') {
      const confirmed = window.confirm(`Are you sure you want to ${currentStatus ? 'deactivate' : 'activate'} ${name}?`);
      if (confirmed) {
        performUpdate();
      }
    } else {
      Alert.alert(
        'Confirm Status Change',
        `Are you sure you want to ${currentStatus ? 'deactivate' : 'activate'} ${name}?`,
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Yes', onPress: performUpdate }
        ]
      );
    }
  };

  const handleRemovePress = async (techId: string, name: string) => {
    try {
      const { data: activeJobs, error } = await supabase
        .from('job_sheets')
        .select('id, registration_number')
        .eq('assigned_to', techId)
        .neq('status', 'Completed');

      if (error) throw error;

      if (!activeJobs || activeJobs.length === 0) {
        if (Platform.OS === 'web') {
          const confirmed = window.confirm(`Remove ${name} from the team? Their account will be deactivated. Completed job history is preserved.`);
          if (confirmed) {
            deactivateUser(techId, name);
          }
        } else {
          Alert.alert(
            'Remove Technician',
            `Remove ${name} from the team? Their account will be deactivated. Completed job history is preserved.`,
            [
              { text: 'Cancel', style: 'cancel' },
              { 
                text: 'Remove', 
                style: 'destructive', 
                onPress: () => deactivateUser(techId, name) 
              }
            ]
          );
        }
      } else {
        const { data: otherTechs } = await supabase
          .from('profiles')
          .select('*')
          .eq('role', 'user')
          .eq('is_active', true)
          .neq('id', techId);
        
        setAvailableTechs((otherTechs as UserProfile[]) || []);
        setActiveJobsToReassign(activeJobs);
        setTechToRemove({ id: techId, name });
        setReassignToTechId('');
        setReassignModalVisible(true);
      }
    } catch {
      Alert.alert('Error', 'Failed to fetch active jobs.');
    }
  };

  const deactivateUser = async (techId: string, name: string) => {
    setLoading(true);
    await supabase.from('profiles').update({ is_active: false }).eq('id', techId);
    Alert.alert('✅ Technician Removed', `${name} has been deactivated.`);
    const ac = new AbortController();
    fetchTeamStats(ac.signal);
  };

  const handleReassignAndRemove = async () => {
    if (!techToRemove || !reassignToTechId) {
      Alert.alert('Error', 'Please select a technician to reassign jobs to.');
      return;
    }
    
    setLoading(true);
    setReassignModalVisible(false);
    
    try {
      // Reassign jobs
      const { error: updateJobsError } = await supabase
        .from('job_sheets')
        .update({ assigned_to: reassignToTechId })
        .eq('assigned_to', techToRemove.id)
        .neq('status', 'Completed');
        
      if (updateJobsError) throw updateJobsError;

      // Deactivate
      const { error: deactivateError } = await supabase
        .from('profiles')
        .update({ is_active: false })
        .eq('id', techToRemove.id);

      if (deactivateError) throw deactivateError;

      const newTechName = availableTechs.find(t => t.id === reassignToTechId)?.full_name || 'the selected technician';
        
      Alert.alert('✅ Success', `Jobs reassigned to ${newTechName} and ${techToRemove.name} has been deactivated.`);
      const ac2 = new AbortController();
      fetchTeamStats(ac2.signal);
    } catch {
      Alert.alert('Error', 'Failed to complete the process.');
      setLoading(false);
    }
  };

  const renderItem = ({ item }: { item: TeamMemberStats }) => (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <View style={{ flex: 1 }}>
          <Text style={styles.nameText}>{item.full_name || item.username}</Text>
        </View>
        <View style={styles.toggleContainer}>
          <Text style={[styles.statusText, { color: item.is_active ? '#28a745' : '#dc3545' }]}>
            {item.is_active ? 'Active' : 'Inactive'}
          </Text>
          <Switch
            value={item.is_active}
            onValueChange={() => toggleTechStatus(item.id, item.is_active || false, item.full_name || item.username)}
            trackColor={{ false: '#767577', true: '#FFD700' }}
            thumbColor={item.is_active ? '#1a1a2e' : '#f4f3f4'}
            style={{ transform: [{ scaleX: 0.8 }, { scaleY: 0.8 }] }}
          />
        </View>
      </View>
      
      {item.phone ? (
        <TouchableOpacity activeOpacity={0.7} onPress={() => handleCall(item.phone!)} style={styles.phoneButton}>
          <Text style={styles.phoneText}>📞 {item.phone}</Text>
        </TouchableOpacity>
      ) : (
        <Text style={styles.noPhoneText}>No phone number</Text>
      )}

      <View style={styles.actionRow}>
        <TouchableOpacity 
          style={styles.removeBtn} 
          onPress={() => handleRemovePress(item.id, item.full_name || item.username)}
        >
          <Text style={styles.removeBtnText}>🗑️ Remove</Text>
        </TouchableOpacity>
      </View>

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

      {/* Reassign Modal */}
      <Modal
        visible={reassignModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setReassignModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Reassign Active Jobs</Text>
            <Text style={styles.modalSubtitle}>
              {techToRemove?.name} has {activeJobsToReassign.length} active jobs.
            </Text>
            
            <View style={styles.activeJobsList}>
              {activeJobsToReassign.slice(0, 3).map(job => (
                <Text key={job.id} style={styles.activeJobItem}>• {job.registration_number}</Text>
              ))}
              {activeJobsToReassign.length > 3 && (
                <Text style={styles.activeJobItem}>...and {activeJobsToReassign.length - 3} more</Text>
              )}
            </View>

            <Text style={styles.modalLabel}>Reassign all to:</Text>
            <View style={styles.pickerContainer}>
              <Picker
                selectedValue={reassignToTechId}
                onValueChange={(val) => setReassignToTechId(val)}
              >
                <Picker.Item label="-- Select Technician --" value="" />
                {availableTechs.map(tech => (
                  <Picker.Item key={tech.id} label={tech.full_name || tech.username} value={tech.id} />
                ))}
              </Picker>
            </View>

            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.modalCancelBtn} onPress={() => setReassignModalVisible(false)}>
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.modalReassignBtn} onPress={handleReassignAndRemove}>
                <Text style={styles.modalReassignText}>Reassign & Remove</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
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
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 },
  nameText: { fontSize: 18, fontWeight: 'bold', color: '#333' },
  toggleContainer: { alignItems: 'flex-end', marginLeft: 10 },
  statusText: { fontSize: 11, fontWeight: 'bold', marginBottom: 2 },
  phoneButton: { marginBottom: 8 },
  phoneText: { color: '#0066cc', fontSize: 15, fontWeight: '500' },
  noPhoneText: { color: '#888', fontSize: 14, marginBottom: 8, fontStyle: 'italic' },
  actionRow: { flexDirection: 'row', justifyContent: 'flex-end', marginBottom: 12 },
  removeBtn: { backgroundColor: '#ffeeee', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 6, borderWidth: 1, borderColor: '#ffcccc' },
  removeBtnText: { color: '#dc3545', fontWeight: 'bold', fontSize: 13 },
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
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', padding: 20 },
  modalContent: { backgroundColor: '#fff', padding: 20, borderRadius: 12, width: '100%', maxWidth: 400 },
  modalTitle: { fontSize: 20, fontWeight: 'bold', color: '#333', marginBottom: 8 },
  modalSubtitle: { fontSize: 15, color: '#e74c3c', marginBottom: 16, fontWeight: '500' },
  activeJobsList: { backgroundColor: '#f9f9f9', padding: 12, borderRadius: 8, marginBottom: 16, borderWidth: 1, borderColor: '#eee' },
  activeJobItem: { fontSize: 14, color: '#555', marginBottom: 4 },
  modalLabel: { fontSize: 14, fontWeight: 'bold', color: '#333', marginBottom: 8 },
  pickerContainer: { borderWidth: 1, borderColor: '#ddd', borderRadius: 8, marginBottom: 24, backgroundColor: '#fff' },
  modalActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 12 },
  modalCancelBtn: { paddingVertical: 10, paddingHorizontal: 16, borderRadius: 8, backgroundColor: '#f0f0f0' },
  modalCancelText: { color: '#333', fontWeight: 'bold' },
  modalReassignBtn: { paddingVertical: 10, paddingHorizontal: 16, borderRadius: 8, backgroundColor: '#e74c3c' },
  modalReassignText: { color: '#fff', fontWeight: 'bold' },
});
