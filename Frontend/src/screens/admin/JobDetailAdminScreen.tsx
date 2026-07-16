import React, { useState, useCallback, useRef, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator,
  Linking, Image, Modal, TextInput, Alert, StatusBar, Platform, Animated,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRoute, useNavigation, RouteProp, useFocusEffect } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import * as Sharing from 'expo-sharing';
import * as FileSystem from 'expo-file-system/legacy';
import { supabase } from '../../services/supabase';
import { AdminStackParamList, JobSheet, JobUpdate, UserProfile, JobSheetStatus } from '../../types';
import { useAuth } from '../../context/AuthContext';
import { navigateBack } from '../../utils/navigationUtils';
import { formatDate, timeAgo } from '../../utils/formatting';
import { colors, spacing, radius, typography } from '../../theme/tokens';
import { Icon } from '../../components/ui/Icon';
import { StatusBadge } from '../../components/ui/StatusBadge';

type DetailRouteProp = RouteProp<AdminStackParamList, 'JobDetailAdminScreen'>;
type NavigationProp = NativeStackNavigationProp<AdminStackParamList, 'JobDetailAdminScreen'>;

const STATUS_COLORS: Record<string, { bg: string; text: string }> = {
  'In Queue': { bg: colors.statusQueueBg, text: colors.statusQueue },
  'In Progress': { bg: colors.statusProgressBg, text: colors.statusProgress },
  Completed: { bg: colors.statusCompletedBg, text: colors.statusCompleted },
  'On Hold': { bg: colors.statusHoldBg, text: colors.statusHold },
};

export const JobDetailAdminScreen = () => {
  const route = useRoute<DetailRouteProp>();
  const navigation = useNavigation<NavigationProp>();
  const { jobSheetId } = route.params;
  const { profile: currentUser } = useAuth();

  const [jobSheet, setJobSheet] = useState<JobSheet | null>(null);
  const [jobUpdates, setJobUpdates] = useState<JobUpdate[]>([]);
  const [loading, setLoading] = useState(true);
  const [imageModalVisible, setImageModalVisible] = useState(false);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [billingModalVisible, setBillingModalVisible] = useState(false);
  const [statusModalVisible, setStatusModalVisible] = useState(false);
  const [reassignModalVisible, setReassignModalVisible] = useState(false);
  const [deleteModalVisible, setDeleteModalVisible] = useState(false);
  const [deleteReason, setDeleteReason] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [editingInstructions, setEditingInstructions] = useState(false);
  const [adminInstructionsText, setAdminInstructionsText] = useState('');
  const [technicians, setTechnicians] = useState<UserProfile[]>([]);
  const [statusNote, setStatusNote] = useState('');

  // Animations
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(15)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 400, useNativeDriver: true }),
      Animated.spring(slideAnim, { toValue: 0, speed: 50, bounciness: 6, useNativeDriver: true }),
    ]).start();
  }, []);

  const fetchJobDetails = async (signal: AbortSignal) => {
    try {
      if (!signal.aborted) setLoading(true);
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
      if (!signal.aborted) {
        setJobSheet(jobData as JobSheet);
        setAdminInstructionsText(jobData.admin_instructions || '');
        setJobUpdates(updatesData as JobUpdate[]);
      }
    } catch (error) {
    } finally {
      if (!signal.aborted) setLoading(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      const ac = new AbortController();
      fetchJobDetails(ac.signal);
      return () => ac.abort();
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
        update_note: 'Admin added instructions',
      });
      setEditingInstructions(false);
      const ac = new AbortController();
      fetchJobDetails(ac.signal);
      Alert.alert('Saved', 'Instructions sent to technician.');
    } catch {
      Alert.alert('Error', 'Failed to save instructions');
    }
  };

  const loadTechnicians = async () => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('role', 'user')
        .eq('is_active', true);
      if (error) throw error;
      setTechnicians(data as UserProfile[]);
      setReassignModalVisible(true);
    } catch {
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
        update_note: `Reassigned to ${tech.full_name || tech.username} by Admin`,
      });
      setReassignModalVisible(false);
      const ac = new AbortController();
      fetchJobDetails(ac.signal);
      Alert.alert('Reassigned', `Job reassigned to ${tech.full_name || tech.username}.`);
    } catch {
      Alert.alert('Error', 'Failed to reassign');
    }
  };

  const updateStatus = async (newStatus: JobSheetStatus) => {
    if (!currentUser) return;
    const exec = async () => {
      try {
        const payload: Record<string, unknown> = { status: newStatus };
        if (newStatus === 'Completed') {
          const completedAt = new Date().toISOString();
          const entryMs = new Date(jobSheet!.entry_date_time).getTime();
          const completeMs = new Date().getTime();
          payload.completed_at = completedAt;
          payload.tat_hours = Number(((completeMs - entryMs) / (1000 * 60 * 60)).toFixed(1));
        }
        const { error } = await supabase.from('job_sheets').update(payload).eq('id', jobSheetId);
        if (error) throw error;
        await supabase.from('job_updates').insert({
          job_sheet_id: jobSheetId,
          updated_by: currentUser.id,
          status_changed_to: newStatus,
          update_note: statusNote || null,
        });
        setStatusModalVisible(false);
        setStatusNote('');
        const ac = new AbortController();
        fetchJobDetails(ac.signal);
        Alert.alert('Updated', `Status changed to "${newStatus}".`);
      } catch {
        Alert.alert('Error', 'Failed to update status');
      }
    };
    if (newStatus === 'Completed') {
      Alert.alert('Confirm', 'This will mark job done and calculate TAT. Continue?', [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Continue', onPress: exec },
      ]);
    } else {
      exec();
    }
  };

  const generateServiceRecordText = () => {
    if (!jobSheet) return '';
    const partsText =
      jobSheet.parts_used && jobSheet.parts_used.length > 0
        ? jobSheet.parts_used.map((p) => `${p.name} x ${p.quantity}`).join('\n')
        : 'No parts used recorded.';
    return `================================
MS JCB SERVICES - SERVICE RECORD
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
    try {
      const uri = FileSystem.documentDirectory + 'ServiceRecord.txt';
      await FileSystem.writeAsStringAsync(uri, generateServiceRecordText());
      await Sharing.shareAsync(uri, { mimeType: 'text/plain', dialogTitle: 'Share Service Record' });
    } catch {
      Alert.alert('Error', 'Failed to share record');
    }
  };

  const handleDeleteJobSheet = async () => {
    if (!currentUser || !deleteReason.trim()) {
      Alert.alert('Required', 'Please enter a reason for deleting this job sheet.');
      return;
    }
    setDeleting(true);
    try {
      await supabase.from('job_updates').insert({
        job_sheet_id: jobSheetId,
        updated_by: currentUser.id,
        update_note: `DELETED by Admin — Reason: ${deleteReason.trim()}`,
        status_changed_to: 'Deleted',
      });
      const { error } = await supabase.from('job_sheets').delete().eq('id', jobSheetId);
      if (error) throw error;
      setDeleteModalVisible(false);
      Platform.OS === 'web'
        ? (window.alert('Job sheet deleted successfully.'), navigation.navigate('AdminTabs'))
        : Alert.alert('Success', 'Job sheet deleted successfully.', [{ text: 'OK', onPress: () => navigation.navigate('AdminTabs') }]);
    } catch {
      Alert.alert('Error', 'Failed to delete job sheet.');
    } finally {
      setDeleting(false);
    }
  };

  if (loading || !jobSheet) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <StatusBar barStyle="light-content" backgroundColor={colors.headerBg} />
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.accent} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="light-content" backgroundColor={colors.headerBg} />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => navigateBack(navigation)}
          style={styles.backBtn}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Icon name="chevron-back" size={24} color={colors.headerText} />
        </TouchableOpacity>
        <Text style={styles.headerTitle} allowFontScaling={false} numberOfLines={1}>
          {jobSheet.registration_number}
        </Text>
        <View style={styles.headerRight}>
          <TouchableOpacity style={styles.shareBtnSmall} onPress={() => setBillingModalVisible(true)}>
            <Icon name="share-outline" size={20} color={colors.headerText} />
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.body}>
        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
          <Animated.View style={{ opacity: fadeAnim, transform: [{ translateY: slideAnim }] }}>
            {/* Job Header Card */}
            <View style={styles.heroCard}>
              <View style={styles.heroTop}>
                <View>
                  <Text style={styles.heroReg} allowFontScaling={false}>{jobSheet.registration_number}</Text>
                  {jobSheet.serial_number && (
                    <Text style={styles.heroSerial} allowFontScaling={false}>Serial: {jobSheet.serial_number}</Text>
                  )}
                </View>
                <StatusBadge status={jobSheet.status} size="md" />
              </View>
              <View style={styles.heroBadges}>
                {jobSheet.service_location && (
                  <View style={styles.badgePill}>
                    <Icon
                      name={jobSheet.service_location === 'Workshop' ? 'business-outline' : 'location-outline'}
                      size={12}
                      color={colors.textSecondary}
                    />
                    <Text style={styles.badgePillText} allowFontScaling={false}>{jobSheet.service_location}</Text>
                  </View>
                )}
                {jobSheet.priority === 'Urgent' && (
                  <View style={[styles.badgePill, styles.urgentPill]}>
                    <Icon name="flash" size={12} color={colors.error} />
                    <Text style={[styles.badgePillText, { color: colors.error }]} allowFontScaling={false}>Urgent</Text>
                  </View>
                )}
              </View>
              <View style={styles.heroMeta}>
                <Text style={styles.heroDate} allowFontScaling={false}>{formatDate(jobSheet.entry_date_time)}</Text>
                {jobSheet.completed_at && (
                  <View style={styles.completedRow}>
                    <Icon name="checkmark-circle" size={14} color={colors.success} />
                    <Text style={styles.completedText} allowFontScaling={false}>
                      Completed · TAT {jobSheet.tat_hours} hrs
                    </Text>
                  </View>
                )}
              </View>
            </View>

            {/* Customer & Machine */}
            <View style={styles.sectionCard}>
              <Text style={styles.sectionCardTitle} allowFontScaling={false}>Customer & Machine</Text>
              <InfoRow icon="person-outline" label="Customer" value={jobSheet.customer_name || 'N/A'} />
              {jobSheet.customer_mobile ? (
                <InfoRow
                  icon="call-outline"
                  label="Mobile"
                  value={jobSheet.customer_mobile}
                  link={`tel:${jobSheet.customer_mobile}`}
                />
              ) : (
                <InfoRow icon="call-outline" label="Mobile" value="N/A" />
              )}
              <InfoRow icon="hardware-chip-outline" label="Model" value={jobSheet.machine_model || 'N/A'} />
              <InfoRow icon="person-circle-outline" label="Created By" value={jobSheet.creator?.full_name || jobSheet.creator?.username || 'System'} />
              <InfoRow icon="people-outline" label="Assigned To" value={jobSheet.assignee?.full_name || jobSheet.assignee?.username || 'Unassigned'} last />
            </View>

            {/* Admin Instructions */}
            <View style={styles.sectionCard}>
              <View style={styles.sectionCardHeader}>
                <View style={styles.sectionCardTitleRow}>
                  <Icon name="chatbubble-ellipses-outline" size={16} color={colors.accent} />
                  <Text style={styles.sectionCardTitle} allowFontScaling={false}>Admin Instructions</Text>
                </View>
                {!editingInstructions && (
                  <TouchableOpacity onPress={() => setEditingInstructions(true)}>
                    <Text style={styles.editLink} allowFontScaling={false}>Edit</Text>
                  </TouchableOpacity>
                )}
              </View>
              {editingInstructions ? (
                <View>
                  <TextInput
                    style={styles.textArea}
                    multiline
                    value={adminInstructionsText}
                    onChangeText={setAdminInstructionsText}
                    placeholder="Enter instructions for technician..."
                    placeholderTextColor={colors.textTertiary}
                  />
                  <View style={styles.instrActions}>
                    <TouchableOpacity style={styles.saveBtn} onPress={handleSaveInstructions} activeOpacity={0.8}>
                      <Icon name="checkmark" size={16} color="#000" />
                      <Text style={styles.saveBtnText} allowFontScaling={false}>Save</Text>
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => setEditingInstructions(false)} style={styles.cancelBtn}>
                      <Text style={styles.cancelBtnText} allowFontScaling={false}>Cancel</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ) : (
                <Text style={styles.instrText} allowFontScaling={false}>
                  {jobSheet.admin_instructions || 'No instructions provided.'}
                </Text>
              )}
            </View>

            {/* Assignment */}
            <View style={styles.sectionCard}>
              <View style={styles.sectionCardHeader}>
                <View style={styles.sectionCardTitleRow}>
                  <Icon name="people-outline" size={16} color={colors.accent} />
                  <Text style={styles.sectionCardTitle} allowFontScaling={false}>Assignment</Text>
                </View>
                <TouchableOpacity style={styles.reassignBtn} onPress={loadTechnicians} activeOpacity={0.7}>
                  <Icon name="swap-horizontal" size={14} color={colors.accent} />
                  <Text style={styles.reassignText} allowFontScaling={false}>Reassign</Text>
                </TouchableOpacity>
              </View>
              <View style={styles.assigneeRow}>
                <View style={styles.assigneeAvatar}>
                  <Text style={styles.assigneeInitial} allowFontScaling={false}>
                    {(jobSheet.assignee?.full_name || jobSheet.assignee?.username || 'U').charAt(0).toUpperCase()}
                  </Text>
                </View>
                <Text style={styles.assigneeName} allowFontScaling={false}>
                  {jobSheet.assignee?.full_name || jobSheet.assignee?.username || 'Unassigned'}
                </Text>
              </View>
            </View>

            {/* Issues & Parts */}
            <View style={styles.sectionCard}>
              <Text style={styles.sectionCardTitle} allowFontScaling={false}>Issues & Parts</Text>
              <Text style={styles.fieldLabel} allowFontScaling={false}>Issues</Text>
              <Text style={styles.fieldValue} allowFontScaling={false}>{jobSheet.issues_description || 'None'}</Text>
              <View style={styles.divider} />
              <Text style={styles.fieldLabel} allowFontScaling={false}>Parts Needed</Text>
              {jobSheet.parts_needed && jobSheet.parts_needed.length > 0 ? (
                jobSheet.parts_needed.map((p, i) => (
                  <Text key={i} style={styles.bullet} allowFontScaling={false}>· {p}</Text>
                ))
              ) : (
                <Text style={styles.fieldValue} allowFontScaling={false}>None</Text>
              )}
              <View style={styles.divider} />
              <Text style={styles.fieldLabel} allowFontScaling={false}>Parts Used</Text>
              {jobSheet.parts_used && jobSheet.parts_used.length > 0 ? (
                jobSheet.parts_used.map((p, i) => (
                  <Text key={i} style={styles.bullet} allowFontScaling={false}>· {p.name} (Qty: {p.quantity})</Text>
                ))
              ) : (
                <Text style={styles.fieldValue} allowFontScaling={false}>None</Text>
              )}
            </View>

            {/* Photos */}
            {jobSheet.photos && jobSheet.photos.length > 0 && (
              <View style={styles.sectionCard}>
                <Text style={styles.sectionCardTitle} allowFontScaling={false}>Photos ({jobSheet.photos.length})</Text>
                <View style={styles.photoStrip}>
                  {jobSheet.photos.map((url, idx) => (
                    <TouchableOpacity
                      key={idx}
                      onPress={() => { setSelectedImage(url); setImageModalVisible(true); }}
                      activeOpacity={0.7}
                    >
                      <Image source={{ uri: url }} style={styles.photo} />
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            )}

            {/* Activity Log */}
            <View style={styles.sectionCard}>
              <Text style={styles.sectionCardTitle} allowFontScaling={false}>Activity Log ({jobUpdates.length})</Text>
              {jobUpdates.length === 0 ? (
                <View style={styles.emptyLog}>
                  <Icon name="time-outline" size={24} color={colors.textTertiary} />
                  <Text style={styles.emptyLogText} allowFontScaling={false}>No activity recorded</Text>
                </View>
              ) : (
                jobUpdates.map((u, idx) => (
                  <View key={u.id} style={[styles.logEntry, idx < jobUpdates.length - 1 && styles.logEntryBorder]}>
                    <View style={styles.logDotWrap}>
                      <View style={styles.logDot} />
                      {idx < jobUpdates.length - 1 && <View style={styles.logLine} />}
                    </View>
                    <View style={styles.logContent}>
                      <View style={styles.logHeader}>
                        <Text style={styles.logActor} allowFontScaling={false} numberOfLines={1}>
                          {u.updated_by_name || 'System'}
                        </Text>
                        <Text style={styles.logTime} allowFontScaling={false}>{timeAgo(u.created_at)}</Text>
                      </View>
                      {u.status_changed_to && (
                        <View style={styles.logStatusWrap}>
                          <Text style={[styles.logStatus, { color: (STATUS_COLORS[u.status_changed_to] || {}).text || colors.info }]} allowFontScaling={false}>
                            {u.status_changed_to}
                          </Text>
                        </View>
                      )}
                      {u.update_note && (
                        <Text style={styles.logNote} allowFontScaling={false}>{u.update_note}</Text>
                      )}
                    </View>
                  </View>
                ))
              )}
            </View>
          </Animated.View>
          <View style={{ height: 100 }} />
        </ScrollView>

        {/* Bottom Bar */}
        <View style={styles.bottomBar}>
          <TouchableOpacity style={styles.updateBtn} onPress={() => setStatusModalVisible(true)} activeOpacity={0.8}>
            <Icon name="swap-horizontal-outline" size={20} color="#000" />
            <Text style={styles.updateBtnText} allowFontScaling={false}>Update Status</Text>
          </TouchableOpacity>
          {currentUser?.role === 'admin' && (
            <TouchableOpacity style={styles.deleteBtn} onPress={() => setDeleteModalVisible(true)} activeOpacity={0.8}>
              <Icon name="trash-outline" size={18} color={colors.textInverse} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Image Modal */}
      <Modal visible={imageModalVisible} transparent onRequestClose={() => setImageModalVisible(false)}>
        <View style={styles.imageOverlay}>
          <TouchableOpacity style={styles.imageClose} onPress={() => setImageModalVisible(false)}>
            <Icon name="close" size={28} color={colors.textInverse} />
          </TouchableOpacity>
          {selectedImage && <Image source={{ uri: selectedImage }} style={styles.fullImage} resizeMode="contain" />}
        </View>
      </Modal>

      {/* Reassign Modal */}
      <Modal visible={reassignModalVisible} animationType="slide" transparent onRequestClose={() => setReassignModalVisible(false)}>
        <View style={styles.sheetOverlay}>
          <View style={styles.sheet}>
            <View style={styles.sheetHandle} />
            <Text style={styles.sheetTitle} allowFontScaling={false}>Reassign Job</Text>
            <ScrollView style={styles.techList}>
              {technicians.map((t) => (
                <TouchableOpacity key={t.id} style={styles.techRow} onPress={() => handleReassign(t)} activeOpacity={0.6}>
                  <View style={styles.techAvatar}>
                    <Text style={styles.techAvatarText} allowFontScaling={false}>
                      {(t.full_name || t.username || 'T').charAt(0).toUpperCase()}
                    </Text>
                  </View>
                  <Text style={styles.techRowName} allowFontScaling={false}>{t.full_name || t.username}</Text>
                  <Icon name="chevron-forward" size={18} color={colors.textTertiary} />
                </TouchableOpacity>
              ))}
            </ScrollView>
            <TouchableOpacity style={styles.sheetCancel} onPress={() => setReassignModalVisible(false)}>
              <Text style={styles.sheetCancelText} allowFontScaling={false}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Billing Modal */}
      <Modal visible={billingModalVisible} animationType="slide" transparent onRequestClose={() => setBillingModalVisible(false)}>
        <SafeAreaView style={styles.billingModal}>
          <View style={styles.billingHeader}>
            <Text style={styles.billingTitle} allowFontScaling={false}>Service Record</Text>
            <TouchableOpacity onPress={() => setBillingModalVisible(false)}>
              <Icon name="close-circle" size={28} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>
          <ScrollView style={styles.billingContent}>
            <Text style={styles.billingText}>{generateServiceRecordText()}</Text>
          </ScrollView>
          <TouchableOpacity style={styles.shareBtn} onPress={handleShareServiceRecord} activeOpacity={0.8}>
            <Icon name="share-outline" size={18} color="#000" />
            <Text style={styles.shareBtnText} allowFontScaling={false}>Share as Text</Text>
          </TouchableOpacity>
        </SafeAreaView>
      </Modal>

      {/* Status Modal */}
      <Modal visible={statusModalVisible} animationType="slide" transparent onRequestClose={() => setStatusModalVisible(false)}>
        <View style={styles.sheetOverlay}>
          <View style={styles.sheet}>
            <View style={styles.sheetHandle} />
            <Text style={styles.sheetTitle} allowFontScaling={false}>Update Status</Text>
            <TextInput
              style={styles.noteInput}
              placeholder="Optional note..."
              placeholderTextColor={colors.textTertiary}
              multiline
              value={statusNote}
              onChangeText={setStatusNote}
            />
            <View style={styles.statusGrid}>
              {(['In Queue', 'In Progress', 'Completed', 'On Hold'] as JobSheetStatus[]).map((s) => {
                const sc = STATUS_COLORS[s] || { bg: colors.shimmer, text: colors.textSecondary };
                const active = s === jobSheet.status;
                return (
                  <TouchableOpacity
                    key={s}
                    style={[styles.statusCard, { backgroundColor: sc.bg }, active && styles.statusCardActive]}
                    onPress={() => updateStatus(s)}
                    disabled={active}
                    activeOpacity={0.7}
                  >
                    <Icon
                      name={
                        s === 'Completed'
                          ? 'checkmark-circle-outline'
                          : s === 'On Hold'
                          ? 'pause-circle-outline'
                          : s === 'In Progress'
                          ? 'construct-outline'
                          : 'hourglass-outline'
                      }
                      size={22}
                      color={sc.text}
                    />
                    <Text style={[styles.statusCardText, { color: sc.text }]} allowFontScaling={false}>{s}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
            <TouchableOpacity
              style={styles.sheetCancel}
              onPress={() => { setStatusModalVisible(false); setStatusNote(''); }}
            >
              <Text style={styles.sheetCancelText} allowFontScaling={false}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Delete Modal */}
      <Modal visible={deleteModalVisible} animationType="slide" transparent onRequestClose={() => setDeleteModalVisible(false)}>
        <View style={styles.sheetOverlay}>
          <View style={styles.sheet}>
            <View style={styles.sheetHandle} />
            <View style={styles.deleteHeader}>
              <Icon name="alert-circle-outline" size={28} color={colors.error} />
              <Text style={styles.deleteTitle} allowFontScaling={false}>Delete Job Sheet</Text>
            </View>
            <Text style={styles.deleteSubtitle} allowFontScaling={false}>
              This action cannot be undone. A record of the deletion will be saved.
            </Text>
            <TextInput
              style={styles.deleteInput}
              placeholder="Enter reason for deletion..."
              placeholderTextColor={colors.textTertiary}
              multiline
              value={deleteReason}
              onChangeText={setDeleteReason}
              maxLength={500}
            />
            <View style={styles.deleteActions}>
              <TouchableOpacity
                style={styles.deleteCancelBtn}
                onPress={() => { setDeleteModalVisible(false); setDeleteReason(''); }}
                disabled={deleting}
              >
                <Text style={styles.deleteCancelText} allowFontScaling={false}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.deleteConfirmBtn, deleting && { opacity: 0.6 }]}
                onPress={handleDeleteJobSheet}
                disabled={deleting}
                activeOpacity={0.8}
              >
                {deleting ? (
                  <ActivityIndicator color={colors.textInverse} size="small" />
                ) : (
                  <>
                    <Icon name="trash-outline" size={16} color={colors.textInverse} />
                    <Text style={styles.deleteConfirmText} allowFontScaling={false}>Delete</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

const InfoRow = ({ icon, label, value, link, last }: { icon: string; label: string; value: string; link?: string; last?: boolean }) => (
  <View style={[styles.infoRow, last && { borderBottomWidth: 0 }]}>
    <View style={styles.infoLeft}>
      <Icon name={icon as any} size={16} color={colors.textTertiary} />
      <Text style={styles.infoLabel} allowFontScaling={false}>{label}</Text>
    </View>
    {link ? (
      <TouchableOpacity onPress={() => Linking.openURL(link)}>
        <Text style={styles.infoLink} allowFontScaling={false}>{value}</Text>
      </TouchableOpacity>
    ) : (
      <Text style={styles.infoValue} allowFontScaling={false}>{value}</Text>
    )}
  </View>
);

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.headerBg },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    backgroundColor: colors.headerBg,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    flex: 1,
    fontSize: 18,
    fontWeight: '700',
    color: colors.headerText,
    textAlign: 'center',
    marginHorizontal: spacing.sm,
  },
  headerRight: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  shareBtnSmall: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  body: { flex: 1, backgroundColor: colors.bg },
  scroll: { padding: spacing.lg, paddingBottom: 0 },
  // Hero Card
  heroCard: {
    backgroundColor: colors.surface,
    borderRadius: 20,
    padding: spacing.xl,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
  },
  heroTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: spacing.md,
  },
  heroReg: { fontSize: 22, fontWeight: '800', color: colors.textPrimary, letterSpacing: -0.3 },
  heroSerial: { fontSize: 13, color: colors.textSecondary, marginTop: 2 },
  heroBadges: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.md },
  badgePill: {
    flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.sm, paddingVertical: 4,
    borderRadius: radius.full, backgroundColor: colors.bg, borderWidth: 1, borderColor: colors.border, gap: 4,
  },
  urgentPill: { backgroundColor: colors.errorBg, borderColor: colors.error },
  badgePillText: { fontSize: 12, fontWeight: '600', color: colors.textSecondary },
  heroMeta: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  heroDate: { fontSize: 13, color: colors.textSecondary },
  completedRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  completedText: { fontSize: 13, color: colors.success, fontWeight: '600' },
  // Section Cards
  sectionCard: {
    backgroundColor: colors.surface,
    borderRadius: 20,
    padding: spacing.xl,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 2,
  },
  sectionCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  sectionCardTitleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  sectionCardTitle: { fontSize: 16, fontWeight: '700', color: colors.textPrimary, marginBottom: spacing.md },
  editLink: { fontSize: 14, fontWeight: '600', color: colors.info },
  // Info Row
  infoRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingVertical: spacing.sm + 2, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border,
  },
  infoLeft: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  infoLabel: { fontSize: 14, color: colors.textSecondary },
  infoValue: { fontSize: 14, color: colors.textPrimary, fontWeight: '500', flexShrink: 1, textAlign: 'right' },
  infoLink: { fontSize: 14, color: colors.info, fontWeight: '500', textDecorationLine: 'underline' },
  // Instructions
  textArea: {
    borderWidth: 1, borderColor: colors.border, borderRadius: 12, padding: spacing.md,
    minHeight: 80, textAlignVertical: 'top', fontSize: 15, color: colors.textPrimary,
    backgroundColor: colors.bg,
  },
  instrActions: { flexDirection: 'row', alignItems: 'center', marginTop: spacing.md, gap: spacing.md },
  saveBtn: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: colors.accent,
    paddingVertical: spacing.sm, paddingHorizontal: spacing.lg, borderRadius: 10, gap: spacing.xs,
  },
  saveBtnText: { fontSize: 14, fontWeight: '600', color: '#000' },
  cancelBtn: { paddingVertical: spacing.sm, paddingHorizontal: spacing.md },
  cancelBtnText: { fontSize: 14, color: colors.textSecondary, fontWeight: '500' },
  instrText: { fontSize: 15, color: colors.textPrimary, lineHeight: 22 },
  // Assignment
  reassignBtn: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: `${colors.accent}15`,
    paddingVertical: spacing.sm, paddingHorizontal: spacing.md, borderRadius: 10, gap: spacing.xs,
  },
  reassignText: { fontSize: 13, fontWeight: '600', color: colors.accent },
  assigneeRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  assigneeAvatar: {
    width: 40, height: 40, borderRadius: 20, backgroundColor: colors.accent,
    alignItems: 'center', justifyContent: 'center',
  },
  assigneeInitial: { fontSize: 16, fontWeight: '700', color: '#000' },
  assigneeName: { fontSize: 16, fontWeight: '600', color: colors.textPrimary },
  // Parts
  divider: { height: StyleSheet.hairlineWidth, backgroundColor: colors.border, marginVertical: spacing.md },
  fieldLabel: { fontSize: 12, fontWeight: '600', color: colors.textSecondary, marginBottom: 4, textTransform: 'uppercase', letterSpacing: 0.5 },
  fieldValue: { fontSize: 15, color: colors.textPrimary, lineHeight: 22 },
  bullet: { fontSize: 15, color: colors.textPrimary, lineHeight: 24 },
  // Photos
  photoStrip: { flexDirection: 'row', gap: spacing.sm },
  photo: { width: 90, height: 90, borderRadius: 12, backgroundColor: colors.shimmer },
  // Activity Log
  emptyLog: { alignItems: 'center', paddingVertical: spacing.xl, gap: spacing.sm },
  emptyLogText: { fontSize: 14, color: colors.textTertiary },
  logEntry: { flexDirection: 'row', paddingVertical: spacing.md },
  logEntryBorder: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
  logDotWrap: { alignItems: 'center', marginRight: spacing.md },
  logDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.accent },
  logLine: { width: 1, flex: 1, backgroundColor: colors.border, marginTop: 4 },
  logContent: { flex: 1 },
  logHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  logActor: { fontSize: 14, fontWeight: '600', color: colors.textPrimary, flex: 1 },
  logTime: { fontSize: 12, color: colors.textTertiary, marginLeft: spacing.sm },
  logStatusWrap: {
    marginTop: 4, paddingHorizontal: spacing.sm, paddingVertical: 2,
    borderRadius: radius.full, backgroundColor: colors.bg, alignSelf: 'flex-start',
  },
  logStatus: { fontSize: 12, fontWeight: '600' },
  logNote: { fontSize: 13, color: colors.textSecondary, marginTop: 4, lineHeight: 18 },
  // Bottom Bar
  bottomBar: {
    padding: spacing.lg, paddingBottom: spacing.md,
    backgroundColor: colors.surface, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border,
  },
  updateBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    backgroundColor: colors.headerBg, paddingVertical: spacing.md + 2, borderRadius: 14, gap: spacing.sm,
  },
  updateBtnText: { fontSize: 16, fontWeight: '700', color: colors.accent },
  // Modals
  imageOverlay: { flex: 1, backgroundColor: '#000', justifyContent: 'center' },
  imageClose: {
    position: 'absolute', top: 50, right: 20, zIndex: 1,
    padding: spacing.sm, backgroundColor: 'rgba(0,0,0,0.5)', borderRadius: radius.full,
  },
  fullImage: { width: '100%', height: '80%' },
  sheetOverlay: { flex: 1, backgroundColor: colors.overlay, justifyContent: 'flex-end' },
  sheet: { backgroundColor: colors.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: spacing.xl, maxHeight: '80%' },
  sheetHandle: { width: 36, height: 4, borderRadius: 2, backgroundColor: colors.border, alignSelf: 'center', marginBottom: spacing.lg },
  sheetTitle: { fontSize: 20, fontWeight: '700', color: colors.textPrimary, marginBottom: spacing.md },
  noteInput: {
    borderWidth: 1, borderColor: colors.border, borderRadius: 12, padding: spacing.md,
    minHeight: 70, textAlignVertical: 'top', fontSize: 15, color: colors.textPrimary,
    marginBottom: spacing.lg, backgroundColor: colors.bg,
  },
  techList: { maxHeight: 300 },
  techRow: {
    flexDirection: 'row', alignItems: 'center', paddingVertical: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border, gap: spacing.md,
  },
  techAvatar: {
    width: 40, height: 40, borderRadius: 20, backgroundColor: colors.accent,
    alignItems: 'center', justifyContent: 'center',
  },
  techAvatarText: { fontSize: 16, fontWeight: '700', color: '#000' },
  techRowName: { flex: 1, fontSize: 16, fontWeight: '500', color: colors.textPrimary },
  sheetCancel: { alignItems: 'center', paddingVertical: spacing.md, marginTop: spacing.sm },
  sheetCancelText: { fontSize: 16, color: colors.textSecondary, fontWeight: '600' },
  statusGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },
  statusCard: {
    width: '47%', padding: spacing.xl, borderRadius: 16, alignItems: 'center',
    gap: spacing.sm, borderWidth: 1.5, borderColor: 'transparent',
  },
  statusCardActive: { borderColor: colors.textPrimary, opacity: 0.6 },
  statusCardText: { fontSize: 15, fontWeight: '700' },
  billingModal: { flex: 1, backgroundColor: colors.bg },
  billingHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    padding: spacing.lg, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border,
  },
  billingTitle: { fontSize: 20, fontWeight: '700', color: colors.textPrimary },
  billingContent: { flex: 1, padding: spacing.lg },
  billingText: { fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace', fontSize: 13, lineHeight: 20, color: colors.textPrimary },
  shareBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    backgroundColor: colors.accent, paddingVertical: spacing.md, marginHorizontal: spacing.lg,
    marginBottom: spacing.lg, borderRadius: 14, gap: spacing.sm,
  },
  shareBtnText: { fontSize: 16, fontWeight: '700', color: '#000' },
  // Delete
  deleteBtn: {
    width: 50, height: 50, borderRadius: 14, backgroundColor: colors.error,
    alignItems: 'center', justifyContent: 'center',
  },
  deleteHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginBottom: spacing.sm },
  deleteTitle: { fontSize: 20, fontWeight: '700', color: colors.textPrimary },
  deleteSubtitle: { fontSize: 14, color: colors.textSecondary, lineHeight: 20, marginBottom: spacing.xl },
  deleteInput: {
    borderWidth: 1, borderColor: colors.border, borderRadius: 12, padding: spacing.md,
    minHeight: 90, textAlignVertical: 'top', fontSize: 15, color: colors.textPrimary,
    marginBottom: spacing.xl, backgroundColor: colors.bg,
  },
  deleteActions: { flexDirection: 'row', gap: spacing.md },
  deleteCancelBtn: {
    flex: 1, paddingVertical: spacing.md, backgroundColor: colors.bg,
    borderRadius: 12, alignItems: 'center',
  },
  deleteCancelText: { fontSize: 16, fontWeight: '600', color: colors.textSecondary },
  deleteConfirmBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    backgroundColor: colors.error, paddingVertical: spacing.md, borderRadius: 12, gap: spacing.sm,
  },
  deleteConfirmText: { fontSize: 16, fontWeight: '700', color: colors.textInverse },
});
