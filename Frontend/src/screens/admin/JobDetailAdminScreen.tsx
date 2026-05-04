import React, { useState, useEffect } from 'react';
import { 
  View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, Linking, Image, Modal, SafeAreaView, TextInput, Alert 
} from 'react-native';
import { useRoute, useNavigation, RouteProp, useFocusEffect } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import * as Sharing from 'expo-sharing';
import * as FileSystem from 'expo-file-system/legacy';
import { supabase } from '../../services/supabase';
import { AdminStackParamList, JobSheet, JobUpdate, UserProfile, JobSheetStatus } from '../../types';
import { useAuth } from '../../context/AuthContext';
import { navigateBack } from '../../utils/navigationUtils';

type DetailRouteProp = RouteProp<AdminStackParamList, 'JobDetailAdminScreen'>;
type NavigationProp = NativeStackNavigationProp<AdminStackParamList, 'JobDetailAdminScreen'>;

export const JobDetailAdminScreen = () => {
  const route = useRoute<DetailRouteProp>();
  const navigation = useNavigation<NavigationProp>();
  const { jobSheetId } = route.params;
  const { profile: currentUser } = useAuth();

  const [jobSheet, setJobSheet] = useState<JobSheet | null>(null);
  const [jobUpdates, setJobUpdates] = useState<JobUpdate[]>([]);
  const [loading, setLoading] = useState(true);

  // Modals state
  const [imageModalVisible, setImageModalVisible] = useState(false);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  
  const [billingModalVisible, setBillingModalVisible] = useState(false);
  const [statusModalVisible, setStatusModalVisible] = useState(false);
  const [reassignModalVisible, setReassignModalVisible] = useState(false);

  // Editing Admin Instructions
  const [editingInstructions, setEditingInstructions] = useState(false);
  const [adminInstructionsText, setAdminInstructionsText] = useState('');

  // Reassign data
  const [technicians, setTechnicians] = useState<UserProfile[]>([]);

  // Status update
  const [statusNote, setStatusNote] = useState('');

  const fetchJobDetails = async (isMounted: boolean = true) => {
    try {
      if (isMounted) setLoading(true);
      const { data: jobData, error: jobError } = await supabase
        .from('job_sheets')
        .select(`*, assignee:profiles!job_sheets_assigned_to_fkey(*), creator:profiles!job_sheets_created_by_fkey(*)`)
        .eq('id', jobSheetId)
        .single();

      if (jobError) throw jobError;
      
      const { data: updatesData, error: updatesError } = await supabase
        .from('job_updates_with_profile')
        .select('*')
        .eq('job_sheet_id', jobSheetId)
        .order('created_at', { ascending: false });

      if (updatesError) throw updatesError;

      if (isMounted) {
        setJobSheet(jobData as JobSheet);
        setAdminInstructionsText(jobData.admin_instructions || '');
        setJobUpdates(updatesData as JobUpdate[]);
      }
    } catch (error) {
      console.error('Error fetching job details:', error);
    } finally {
      if (isMounted) setLoading(false);
    }
  };

  useFocusEffect(
    React.useCallback(() => {
      let isMounted = true;
      fetchJobDetails(isMounted);
      return () => { isMounted = false; };
    }, [jobSheetId])
  );

  const handleSaveInstructions = async () => {
    if (!currentUser) return;
    try {
      const { error } = await supabase
        .from('job_sheets')
        .update({ admin_instructions: adminInstructionsText })
        .eq('id', jobSheetId);
      if (error) throw error;

      await supabase.from('job_updates').insert({
        job_sheet_id: jobSheetId,
        updated_by: currentUser.id,
        update_note: 'Admin added instructions'
      });

      setEditingInstructions(false);
      fetchJobDetails();
      Alert.alert('✅ Instructions Saved', 'Instructions have been sent to the technician.');
    } catch (e) {
      Alert.alert('Error', 'Failed to save instructions');
    }
  };

  const loadTechnicians = async () => {
    try {
      const { data, error } = await supabase.from('profiles').select('*').eq('role', 'user').eq('is_active', true);
      if (error) throw error;
      setTechnicians(data as UserProfile[]);
      setReassignModalVisible(true);
    } catch (e) {
      Alert.alert('Error', 'Failed to load technicians');
    }
  };

  const handleReassign = async (tech: UserProfile) => {
    if (!currentUser) return;
    try {
      const { error } = await supabase
        .from('job_sheets')
        .update({ assigned_to: tech.id })
        .eq('id', jobSheetId);
      if (error) throw error;

      await supabase.from('job_updates').insert({
        job_sheet_id: jobSheetId,
        updated_by: currentUser.id,
        update_note: `Reassigned to ${tech.full_name || tech.username} by Admin`
      });

      setReassignModalVisible(false);
      fetchJobDetails();
      Alert.alert('✅ Reassigned Successfully', `Job sheet has been reassigned to ${tech.full_name || tech.username}.`);
    } catch (e) {
      Alert.alert('Error', 'Failed to reassign');
    }
  };

  const updateStatus = async (newStatus: JobSheetStatus) => {
    if (!currentUser) return;
    
    const executeUpdate = async () => {
      try {
        const updatePayload: any = { status: newStatus };
        
        if (newStatus === 'Completed') {
          const completedAt = new Date().toISOString();
          const entryTime = new Date(jobSheet!.entry_date_time).getTime();
          const completeTime = new Date().getTime();
          const tatHours = Number(((completeTime - entryTime) / (1000 * 60 * 60)).toFixed(1));
          
          updatePayload.completed_at = completedAt;
          updatePayload.tat_hours = tatHours;
        }

        const { error } = await supabase.from('job_sheets').update(updatePayload).eq('id', jobSheetId);
        if (error) throw error;

        await supabase.from('job_updates').insert({
          job_sheet_id: jobSheetId,
          updated_by: currentUser.id,
          status_changed_to: newStatus,
          update_note: statusNote || null
        });

        setStatusModalVisible(false);
        setStatusNote('');
        fetchJobDetails();
        Alert.alert('✅ Status Updated', `Status changed to "${newStatus}" successfully.`);
      } catch (e) {
        Alert.alert('Error', 'Failed to update status');
      }
    };

    if (newStatus === 'Completed') {
      Alert.alert(
        'Confirm Completion',
        'This will mark the job as done and calculate TAT. Continue?',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Continue', onPress: executeUpdate }
        ]
      );
    } else {
      executeUpdate();
    }
  };

  const generateServiceRecordText = () => {
    if (!jobSheet) return '';
    
    let partsText = '';
    if (jobSheet.parts_used && jobSheet.parts_used.length > 0) {
      partsText = jobSheet.parts_used.map(p => `${p.name} x ${p.quantity}`).join('\n');
    } else {
      partsText = 'No parts used recorded.';
    }

    return `================================
JCB WORKSHOP - SERVICE RECORD
================================
Machine: ${jobSheet.registration_number}
${jobSheet.serial_number ? `Serial No: ${jobSheet.serial_number}\n` : ''}Customer: ${jobSheet.customer_name || 'N/A'}
Mobile: ${jobSheet.customer_mobile || 'N/A'}
Model: ${jobSheet.machine_model || 'N/A'}
Priority: ${jobSheet.priority || 'Normal'}
Location: ${jobSheet.service_location || 'Workshop'}
--------------------------------
Entry: ${formatDate(jobSheet.entry_date_time)}
Completed: ${jobSheet.completed_at ? formatDate(jobSheet.completed_at) : 'In Progress'}
TAT: ${jobSheet.tat_hours !== null ? `${jobSheet.tat_hours} hrs` : 'Ongoing'}
--------------------------------
PARTS USED:
${partsText}
--------------------------------
Issues: ${jobSheet.issues_description || 'None'}
Technician: ${jobSheet.assignee?.full_name || jobSheet.assignee?.username || 'Unassigned'}
================================`;
  };

  const handleShareServiceRecord = async () => {
    const text = generateServiceRecordText();
    try {
      const fileUri = FileSystem.documentDirectory + 'ServiceRecord.txt';
      await FileSystem.writeAsStringAsync(fileUri, text);
      await Sharing.shareAsync(fileUri, { mimeType: 'text/plain', dialogTitle: 'Share Service Record' });
    } catch (e) {
      Alert.alert('Error', 'Failed to share record');
    }
  };

  const getStatusColors = (status: string) => {
    switch (status) {
      case 'In Queue': return { bg: '#FFF3CD', text: '#856404' };
      case 'In Progress': return { bg: '#CCE5FF', text: '#004085' };
      case 'Completed': return { bg: '#D4EDDA', text: '#155724' };
      case 'On Hold': return { bg: '#F8D7DA', text: '#721c24' };
      default: return { bg: '#e2e3e5', text: '#383d41' };
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const options: Intl.DateTimeFormatOptions = { 
      day: 'numeric', month: 'short', year: 'numeric',
      hour: 'numeric', minute: '2-digit', hour12: true
    };
    return new Intl.DateTimeFormat('en-GB', options).format(date);
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

  if (loading || !jobSheet) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#FFD700" />
      </View>
    );
  }

  const statusColors = getStatusColors(jobSheet.status);

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.headerBar}>
        <TouchableOpacity activeOpacity={0.7} onPress={() => navigateBack(navigation)}>
          <Text style={styles.backButton}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerBarTitle} numberOfLines={1} allowFontScaling={false}>{jobSheet.registration_number}</Text>
        <View style={{ width: 50 }} />
      </View>

      <ScrollView style={styles.container} contentContainerStyle={styles.contentContainer}>
        
        {/* SECTION 1: Header */}
        <View style={styles.section}>
          <Text style={styles.registrationLarge} allowFontScaling={false}>{jobSheet.registration_number}</Text>
          {jobSheet.serial_number && (
            <Text style={styles.serialNumber} allowFontScaling={false}>Serial: {jobSheet.serial_number}</Text>
          )}

          <View style={styles.badgesContainer}>
            <View style={[styles.badge, { backgroundColor: statusColors.bg }]}>
              <Text style={[styles.badgeText, { color: statusColors.text }]} allowFontScaling={false}>{jobSheet.status}</Text>
            </View>
            
            {jobSheet.service_location && (
              <View style={[styles.badge, styles.locationBadge]}>
                <Text style={styles.locationBadgeText} allowFontScaling={false}>
                  {jobSheet.service_location === 'Workshop' ? '🏭 Workshop' : '📍 On-Site'}
                </Text>
              </View>
            )}

            {jobSheet.priority === 'Urgent' && (
              <View style={[styles.badge, styles.urgentBadge]}>
                <Text style={styles.urgentBadgeText} allowFontScaling={false}>⚡ Urgent</Text>
              </View>
            )}
          </View>
          
          <Text style={styles.dateText} allowFontScaling={false}>{formatDate(jobSheet.entry_date_time)}</Text>
          {jobSheet.completed_at && (
            <View style={{ marginTop: 8 }}>
              <Text style={{ color: '#155724', fontWeight: 'bold' }} allowFontScaling={false}>Completed: {formatDate(jobSheet.completed_at)}</Text>
              <Text style={{ color: '#155724', fontWeight: 'bold' }} allowFontScaling={false}>TAT: {jobSheet.tat_hours} hrs</Text>
            </View>
          )}
        </View>

        {/* SECTION 2: Customer & Machine Info */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle} allowFontScaling={false}>Customer & Machine Info</Text>
          <View style={styles.infoCard}>
            <View style={styles.infoRow}><Text style={styles.infoLabel} allowFontScaling={false}>Customer</Text><Text style={styles.infoValue}>{jobSheet.customer_name || 'N/A'}</Text></View>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel} allowFontScaling={false}>Mobile</Text>
              {jobSheet.customer_mobile ? (
                <TouchableOpacity onPress={() => Linking.openURL(`tel:${jobSheet.customer_mobile}`)}>
                  <Text style={[styles.infoValue, { color: '#0066cc', textDecorationLine: 'underline' }]}>{jobSheet.customer_mobile}</Text>
                </TouchableOpacity>
              ) : <Text style={styles.infoValue}>N/A</Text>}
            </View>
            <View style={styles.infoRow}><Text style={styles.infoLabel} allowFontScaling={false}>Model</Text><Text style={styles.infoValue}>{jobSheet.machine_model || 'N/A'}</Text></View>
            <View style={styles.infoRow}><Text style={styles.infoLabel} allowFontScaling={false}>Created By</Text><Text style={styles.infoValue}>{jobSheet.creator?.full_name || jobSheet.creator?.username || 'System'}</Text></View>
            <View style={styles.infoRow}><Text style={styles.infoLabel} allowFontScaling={false}>Assigned To</Text><Text style={styles.infoValue}>{jobSheet.assignee?.full_name || jobSheet.assignee?.username || 'Unassigned'}</Text></View>
          </View>
        </View>

        {/* SECTION 3: Admin Instructions */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle} allowFontScaling={false}>Admin Instructions</Text>
          {editingInstructions ? (
            <View style={styles.instructionBox}>
              <TextInput
                style={[styles.input, { height: 80, backgroundColor: '#fff' }]}
                multiline
                value={adminInstructionsText}
                onChangeText={setAdminInstructionsText}
                placeholder="Enter instructions for technician..."
              />
              <View style={{ flexDirection: 'row', marginTop: 10 }}>
                <TouchableOpacity activeOpacity={0.7} style={[styles.button, { flex: 1, marginRight: 5 }]} onPress={handleSaveInstructions}>
                  <Text style={styles.buttonText} allowFontScaling={false}>Save Instructions</Text>
                </TouchableOpacity>
                <TouchableOpacity activeOpacity={0.7} style={[styles.button, { flex: 1, marginLeft: 5, backgroundColor: '#888' }]} onPress={() => setEditingInstructions(false)}>
                  <Text style={styles.buttonText} allowFontScaling={false}>Cancel</Text>
                </TouchableOpacity>
              </View>
            </View>
          ) : (
            <View style={styles.instructionBox}>
              <Text style={styles.instructionTitle} allowFontScaling={false}>🔔 Instructions</Text>
              <Text style={styles.instructionText}>{jobSheet.admin_instructions || 'No instructions provided.'}</Text>
              <TouchableOpacity activeOpacity={0.7} style={{ marginTop: 10, flexDirection: 'row', alignItems: 'center' }} onPress={() => setEditingInstructions(true)}>
                <Text style={{ color: '#0066cc', fontWeight: 'bold' }} allowFontScaling={false}>✏️ Edit Instructions</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>

        {/* SECTION 4: REASSIGN */}
        <View style={styles.section}>
          <View style={[styles.infoCard, { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }]}>
            <View>
              <Text style={styles.infoLabel} allowFontScaling={false}>Current Technician</Text>
              <Text style={[styles.infoValue, { fontSize: 16 }]}>{jobSheet.assignee?.full_name || jobSheet.assignee?.username || 'Unassigned'}</Text>
            </View>
            <TouchableOpacity activeOpacity={0.7} style={[styles.button, { backgroundColor: '#1a1a2e', paddingHorizontal: 20, flexDirection: 'row', alignItems: 'center' }]} onPress={loadTechnicians}>
              <Text style={[styles.buttonText, { color: '#FFD700' }]} allowFontScaling={false}>👤 Reassign Job</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* SECTION 5: Issues & Parts */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle} allowFontScaling={false}>Issues & Parts</Text>
          <View style={styles.infoCard}>
            <Text style={{ fontWeight: 'bold', marginBottom: 4 }} allowFontScaling={false}>Issues:</Text>
            <Text style={{ marginBottom: 12 }}>{jobSheet.issues_description || 'None'}</Text>
            
            <Text style={{ fontWeight: 'bold', marginBottom: 4 }} allowFontScaling={false}>Parts Needed:</Text>
            {jobSheet.parts_needed?.map((p, i) => <Text key={i}>• {p}</Text>)}
            
            <View style={{ height: 1, backgroundColor: '#eee', marginVertical: 10 }} />
            
            <Text style={{ fontWeight: 'bold', marginBottom: 4 }} allowFontScaling={false}>Parts Used:</Text>
            {jobSheet.parts_used?.map((p, i) => <Text key={i}>• {p.name} (Qty: {p.quantity})</Text>)}
          </View>
        </View>

        {/* SECTION 6: Photos */}
        {jobSheet.photos && jobSheet.photos.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle} allowFontScaling={false}>Photos</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              {jobSheet.photos.map((url, idx) => (
                <TouchableOpacity key={idx} onPress={() => { setSelectedImage(url); setImageModalVisible(true); }}>
                  <Image source={{ uri: url }} style={styles.thumbnail} />
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        )}

        {/* SECTION 7: BILLING VIEW */}
        <View style={styles.section}>
          <TouchableOpacity activeOpacity={0.7} style={[styles.button, { backgroundColor: '#1a1a2e', flexDirection: 'row', alignItems: 'center', justifyContent: 'center' }]} onPress={() => setBillingModalVisible(true)}>
            <Text style={[styles.buttonText, { color: '#FFD700' }]} allowFontScaling={false}>🧾 View Billing (Service Record)</Text>
          </TouchableOpacity>
        </View>

        {/* SECTION 8: Activity Log */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle} allowFontScaling={false}>Activity Log</Text>
          {jobUpdates.map(u => (
            <View key={u.id} style={styles.logCard}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                <Text style={{ fontWeight: 'bold', color: '#1a1a2e' }}>{u.updated_by_name || 'System'}</Text>
                <Text style={{ color: '#888', fontSize: 12 }}>{timeAgo(u.created_at)}</Text>
              </View>
              {u.status_changed_to && <Text style={{ color: '#28a745', fontWeight: 'bold' }}>→ {u.status_changed_to}</Text>}
              {u.update_note && <Text style={{ color: '#555', marginTop: 4 }}>{u.update_note}</Text>}
            </View>
          ))}
        </View>

        <View style={{ height: 100 }} />
      </ScrollView>

      {/* Bottom Button */}
      <View style={styles.bottomBar}>
        <TouchableOpacity activeOpacity={0.7} style={[styles.button, { flex: 1, backgroundColor: '#1a1a2e', flexDirection: 'row', alignItems: 'center', justifyContent: 'center' }]} onPress={() => setStatusModalVisible(true)}>
          <Text style={[styles.buttonText, { color: '#FFD700', fontSize: 18 }]} allowFontScaling={false}>🔄 Update Status</Text>
        </TouchableOpacity>
      </View>

      {/* MODALS */}
      {/* 1. Image Modal */}
      <Modal visible={imageModalVisible} transparent={true} onRequestClose={() => setImageModalVisible(false)}>
        <SafeAreaView style={styles.modalBg}>
          <TouchableOpacity style={styles.closeBtn} onPress={() => setImageModalVisible(false)}>
            <Text style={{ color: '#fff', fontSize: 18 }} allowFontScaling={false}>Close</Text>
          </TouchableOpacity>
          {selectedImage && <Image source={{ uri: selectedImage }} style={{ width: '100%', height: '80%' }} resizeMode="contain" />}
        </SafeAreaView>
      </Modal>

      {/* 2. Reassign Modal */}
      <Modal visible={reassignModalVisible} animationType="slide" transparent={true} onRequestClose={() => setReassignModalVisible(false)}>
        <View style={styles.modalBgHalf}>
          <View style={styles.modalContent}>
            <Text style={{ fontSize: 20, fontWeight: 'bold', marginBottom: 20, color: '#1a1a2e' }} allowFontScaling={false}>Reassign Job Sheet</Text>
            <ScrollView style={{ maxHeight: 300 }}>
              {technicians.map(t => (
                <TouchableOpacity key={t.id} style={styles.techRow} onPress={() => handleReassign(t)}>
                  <Text style={{ fontSize: 16 }}>{t.full_name || t.username}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
            <TouchableOpacity style={[styles.button, { marginTop: 20, backgroundColor: '#888' }]} onPress={() => setReassignModalVisible(false)}>
              <Text style={styles.buttonText} allowFontScaling={false}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* 3. Billing View Modal */}
      <Modal visible={billingModalVisible} animationType="slide" transparent={true} onRequestClose={() => setBillingModalVisible(false)}>
        <SafeAreaView style={[styles.modalBg, { backgroundColor: '#f5f5f5' }]}>
          <View style={{ padding: 20, flex: 1 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 20 }}>
              <Text style={{ fontSize: 22, fontWeight: 'bold', color: '#1a1a2e' }} allowFontScaling={false}>Service Record</Text>
              <TouchableOpacity onPress={() => setBillingModalVisible(false)}>
                <Text style={{ color: '#e74c3c', fontSize: 18, fontWeight: 'bold' }} allowFontScaling={false}>Close</Text>
              </TouchableOpacity>
            </View>
            <ScrollView style={{ backgroundColor: '#fff', padding: 20, borderRadius: 8 }}>
              <Text style={{ fontFamily: 'monospace' }}>{generateServiceRecordText()}</Text>
            </ScrollView>
            <TouchableOpacity style={[styles.button, { marginTop: 20, backgroundColor: '#1a1a2e' }]} onPress={handleShareServiceRecord}>
              <Text style={[styles.buttonText, { color: '#FFD700' }]} allowFontScaling={false}>Share as Text</Text>
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </Modal>

      {/* 4. Status Update Modal */}
      <Modal visible={statusModalVisible} animationType="slide" transparent={true} onRequestClose={() => setStatusModalVisible(false)}>
        <View style={styles.modalBgHalf}>
          <View style={styles.modalContent}>
            <Text style={{ fontSize: 20, fontWeight: 'bold', marginBottom: 20, color: '#1a1a2e' }} allowFontScaling={false}>Update Status</Text>
            
            <TextInput
              style={[styles.input, { height: 80, marginBottom: 20 }]}
              placeholder="Optional note for activity log..."
              multiline
              value={statusNote}
              onChangeText={setStatusNote}
            />

            <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' }}>
              {(['In Queue', 'In Progress', 'Completed', 'On Hold'] as JobSheetStatus[]).map(s => {
                const colors = getStatusColors(s);
                return (
                  <TouchableOpacity 
                    key={s} 
                    style={[styles.statusCard, { backgroundColor: colors.bg }]}
                    onPress={() => updateStatus(s)}
                  >
                    <Text style={{ color: colors.text, fontWeight: 'bold', fontSize: 16 }} allowFontScaling={false}>{s}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
            <TouchableOpacity style={[styles.button, { marginTop: 20, backgroundColor: '#888' }]} onPress={() => setStatusModalVisible(false)}>
              <Text style={styles.buttonText} allowFontScaling={false}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#1a1a2e' },
  headerBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16, backgroundColor: '#1a1a2e' },
  headerBarTitle: { color: '#FFD700', fontSize: 20, fontWeight: 'bold' },
  backButton: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
  centerContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  contentContainer: { padding: 16 },
  section: { marginBottom: 20 },
  sectionTitle: { fontSize: 18, fontWeight: 'bold', color: '#1a1a2e', marginBottom: 10, borderBottomWidth: 1, borderBottomColor: '#ccc', paddingBottom: 4 },
  registrationLarge: { fontSize: 28, fontWeight: 'bold', color: '#1a1a2e', marginBottom: 8 },
  serialNumber: { fontSize: 14, color: '#666', marginBottom: 12 },
  badgesContainer: { flexDirection: 'row', flexWrap: 'wrap', marginBottom: 10, alignItems: 'center' },
  badge: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16, marginRight: 8, marginBottom: 8 },
  badgeText: { fontWeight: 'bold', fontSize: 14 },
  locationBadge: { backgroundColor: '#e9ecef', borderWidth: 1, borderColor: '#ced4da' },
  locationBadgeText: { color: '#495057', fontWeight: 'bold', fontSize: 12 },
  urgentBadge: { backgroundColor: '#FF4444' },
  urgentBadgeText: { color: '#fff', fontWeight: 'bold', fontSize: 12 },
  dateText: { color: '#666', fontSize: 14 },
  infoCard: { backgroundColor: '#fff', borderRadius: 8, padding: 16, borderWidth: 1, borderColor: '#eee' },
  infoRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  infoLabel: { color: '#666', fontSize: 15 },
  infoValue: { fontWeight: '500', color: '#333', fontSize: 15 },
  instructionBox: { backgroundColor: '#fff3cd', borderWidth: 1, borderColor: '#ffeeba', padding: 16, borderRadius: 8 },
  instructionTitle: { fontWeight: 'bold', color: '#856404', marginBottom: 4 },
  instructionText: { color: '#856404' },
  thumbnail: { width: 100, height: 100, borderRadius: 8, marginRight: 10, backgroundColor: '#ccc' },
  logCard: { backgroundColor: '#fff', padding: 12, borderRadius: 8, marginBottom: 10, borderLeftWidth: 3, borderLeftColor: '#1a1a2e' },
  bottomBar: { position: 'absolute', bottom: 0, left: 0, right: 0, padding: 16, backgroundColor: '#fff', borderTopWidth: 1, borderTopColor: '#ddd' },
  button: { padding: 14, borderRadius: 8, alignItems: 'center', backgroundColor: '#1a1a2e' },
  buttonText: { color: '#FFD700', fontWeight: 'bold', fontSize: 16 },
  input: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#ddd', borderRadius: 8, padding: 12, fontSize: 16, textAlignVertical: 'top' },
  modalBg: { flex: 1, backgroundColor: '#000', justifyContent: 'center' },
  closeBtn: { position: 'absolute', top: 40, right: 20, zIndex: 1, padding: 10, backgroundColor: 'rgba(0,0,0,0.5)', borderRadius: 20 },
  modalBgHalf: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: '#fff', padding: 20, borderTopLeftRadius: 20, borderTopRightRadius: 20 },
  techRow: { padding: 16, borderBottomWidth: 1, borderBottomColor: '#eee' },
  statusCard: { width: '48%', padding: 20, borderRadius: 12, alignItems: 'center', marginBottom: 15, elevation: 2 }
});
