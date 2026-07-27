import React, { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator,
  Linking, Image, Modal, StatusBar,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRoute, useNavigation, RouteProp, useFocusEffect } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { supabase } from '../../services/supabase';
import { RootStackParamList, JobSheet, JobUpdate } from '../../types';
import { navigateBack } from '../../utils/navigationUtils';
import { formatDate, timeAgo } from '../../utils/formatting';
import { colors, spacing, radius, typography } from '../../theme/tokens';
import { Icon } from '../../components/ui/Icon';
import { StatusBadge } from '../../components/ui/StatusBadge';
import { Card } from '../../components/ui/Card';
import { HeaderBar } from '../../components/ui/HeaderBar';
import { SectionHeader } from '../../components/ui/SectionHeader';

type DetailRouteProp = RouteProp<RootStackParamList, 'JobSheetDetail'>;
type NavigationProp = NativeStackNavigationProp<RootStackParamList, 'JobSheetDetail'>;

const STATUS_COLORS: Record<string, { bg: string; text: string }> = {
  'In Queue': { bg: colors.statusQueueBg, text: colors.statusQueue },
  'In Progress': { bg: colors.statusProgressBg, text: colors.statusProgress },
  Completed: { bg: colors.statusCompletedBg, text: colors.statusCompleted },
  'On Hold': { bg: colors.statusHoldBg, text: colors.statusHold },
};

export const JobSheetDetailScreen = () => {
  const route = useRoute<DetailRouteProp>();
  const navigation = useNavigation<NavigationProp>();
  const { jobSheetId } = route.params;

  const [jobSheet, setJobSheet] = useState<JobSheet | null>(null);
  const [jobUpdates, setJobUpdates] = useState<JobUpdate[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalVisible, setModalVisible] = useState(false);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);

  const fetchJobDetails = async (signal: AbortSignal) => {
    try {
      if (!signal.aborted) setLoading(true);
      const { data: jobData, error: jobError } = await supabase
        .from('job_sheets').select(`*, assignee:profiles!job_sheets_assigned_to_fkey(*)`).eq('id', jobSheetId).single();
      if (jobError) throw jobError;
      const { data: updatesData, error: updatesError } = await supabase
        .from('job_updates_with_profile').select('*').eq('job_sheet_id', jobSheetId).order('created_at', { ascending: false });
      if (updatesError) throw updatesError;
      if (!signal.aborted) { setJobSheet(jobData as JobSheet); setJobUpdates(updatesData as JobUpdate[]); }
    } catch { } finally { if (!signal.aborted) setLoading(false); }
  };

  useFocusEffect(
    useCallback(() => {
      const ac = new AbortController();
      fetchJobDetails(ac.signal);
      return () => ac.abort();
    }, [jobSheetId])
  );

  const handleCall = (phone: string) => Linking.openURL(`tel:${phone}`);

  const InfoRow = ({ label, value, link }: { label: string; value: string; link?: string }) => (
    <View style={styles.infoRow}>
      <Text style={styles.infoLabel} allowFontScaling={false}>{label}</Text>
      {link ? (
        <TouchableOpacity onPress={() => Linking.openURL(link)}>
          <Text style={styles.infoLink} allowFontScaling={false}>{value}</Text>
        </TouchableOpacity>
      ) : (
        <Text style={styles.infoValue} allowFontScaling={false}>{value}</Text>
      )}
    </View>
  );

  if (loading || !jobSheet) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <StatusBar barStyle="light-content" backgroundColor={colors.headerBg} />
        <View style={styles.center}><ActivityIndicator size="large" color={colors.accent} /></View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="light-content" backgroundColor={colors.headerBg} />
      <HeaderBar title="Job Details" onBack={() => navigateBack(navigation, 'UserDashboard')} />
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <Card>
          <Text style={styles.reg} allowFontScaling={false}>{jobSheet.registration_number}</Text>
          {jobSheet.serial_number && <Text style={styles.serial} allowFontScaling={false}>Serial: {jobSheet.serial_number}</Text>}
          <View style={styles.badges}>
            <StatusBadge status={jobSheet.status} size="md" />
            {jobSheet.service_location && (
              <View style={styles.pill}>
                <Icon name={jobSheet.service_location === 'Workshop' ? 'business-outline' : 'location-outline'} size={12} color={colors.textSecondary} />
                <Text style={styles.pillText} allowFontScaling={false}>{jobSheet.service_location}</Text>
              </View>
            )}
            {jobSheet.priority === 'Urgent' && (
              <View style={[styles.pill, { backgroundColor: colors.errorBg, borderColor: colors.error }]}>
                <Icon name="flash-outline" size={12} color={colors.error} />
                <Text style={[styles.pillText, { color: colors.error }]} allowFontScaling={false}>Urgent</Text>
              </View>
            )}
          </View>
          <Text style={styles.date} allowFontScaling={false}>{formatDate(jobSheet.entry_date_time)}</Text>
          {jobSheet.admin_instructions && (
            <View style={styles.instrBox}>
              <View style={styles.instrHeader}>
                <Icon name="information-circle-outline" size={16} color={colors.accentDark} />
                <Text style={styles.instrTitle} allowFontScaling={false}>Admin Instructions</Text>
              </View>
              <Text style={styles.instrText} allowFontScaling={false}>{jobSheet.admin_instructions}</Text>
            </View>
          )}
        </Card>

        <SectionHeader title="Customer & Machine" />
        <Card>
          <InfoRow label="Customer" value={jobSheet.customer_name || 'N/A'} />
          <InfoRow label="Mobile" value={jobSheet.customer_mobile || 'N/A'} link={jobSheet.customer_mobile ? `tel:${jobSheet.customer_mobile}` : undefined} />
          <InfoRow label="Model" value={jobSheet.machine_model || 'N/A'} />
          <InfoRow label="Technician" value={jobSheet.assignee?.full_name || jobSheet.assignee?.username || 'Unassigned'} />
        </Card>

        <SectionHeader title="Issues & Description" />
        <Card>
          <Text style={styles.descText} allowFontScaling={false}>{jobSheet.issues_description || 'No description provided.'}</Text>
        </Card>

        <SectionHeader title="Parts Information" />
        <Card>
          <Text style={styles.subLabel} allowFontScaling={false}>Parts Needed</Text>
          {jobSheet.parts_needed && jobSheet.parts_needed.length > 0
            ? jobSheet.parts_needed.map((p, i) => <Text key={i} style={styles.bullet} allowFontScaling={false}>· {p}</Text>)
            : <Text style={styles.noneText} allowFontScaling={false}>None specified</Text>}
          <View style={styles.divider} />
          <Text style={styles.subLabel} allowFontScaling={false}>Parts Used</Text>
          {jobSheet.parts_used && jobSheet.parts_used.length > 0
            ? jobSheet.parts_used.map((p, i) => <Text key={i} style={styles.bullet} allowFontScaling={false}>· {p.name} (Qty: {p.quantity})</Text>)
            : <Text style={styles.noneText} allowFontScaling={false}>None recorded</Text>}
        </Card>

        {jobSheet.photos && jobSheet.photos.length > 0 && (
          <>
            <SectionHeader title="Photos" subtitle={`${jobSheet.photos.length} images`} />
            <View style={styles.photoStrip}>
              {jobSheet.photos.map((url, idx) => (
                <TouchableOpacity key={idx} onPress={() => { setSelectedImage(url); setModalVisible(true); }}>
                  <Image source={{ uri: url }} style={styles.photo} />
                </TouchableOpacity>
              ))}
            </View>
          </>
        )}

        <SectionHeader title="Activity Log" subtitle={`${jobUpdates.length} entries`} />
        {jobUpdates.length === 0 ? (
          <Card>
            <View style={styles.emptyLog}>
              <Icon name="time-outline" size={24} color={colors.textTertiary} />
              <Text style={styles.emptyLogText} allowFontScaling={false}>No activity recorded</Text>
            </View>
          </Card>
        ) : (
          jobUpdates.map(u => (
            <Card key={u.id} padded={false}>
              <View style={styles.logEntry}>
                <View style={styles.logDot} />
                <View style={styles.logContent}>
                  <View style={styles.logHeader}>
                    <Text style={styles.logActor} allowFontScaling={false}>{u.updated_by_name || 'Unknown'}</Text>
                    <Text style={styles.logTime} allowFontScaling={false}>{timeAgo(u.created_at)}</Text>
                  </View>
                  {u.status_changed_to && (
                    <Text style={[styles.logStatus, { color: (STATUS_COLORS[u.status_changed_to] || {}).text || colors.info }]} allowFontScaling={false}>
                      → {u.status_changed_to}
                    </Text>
                  )}
                  {u.update_note && <Text style={styles.logNote} allowFontScaling={false}>{u.update_note}</Text>}
                </View>
              </View>
            </Card>
          ))
        )}
        <View style={{ height: 100 }} />
      </ScrollView>

      <View style={styles.bottomBar}>
        <TouchableOpacity style={styles.editBtn} onPress={() => navigation.navigate('EditJobSheet', { jobSheetId })} activeOpacity={0.8}>
          <Icon name="create-outline" size={18} color={colors.textInverse} />
          <Text style={styles.bottomBtnText} allowFontScaling={false}>Edit</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.aiBtn} activeOpacity={0.8}>
          <Icon name="sparkles-outline" size={18} color={colors.headerBg} />
          <Text style={[styles.bottomBtnText, { color: colors.headerBg }]} allowFontScaling={false}>AI Help</Text>
        </TouchableOpacity>
      </View>

      <Modal visible={modalVisible} transparent animationType="fade" onRequestClose={() => setModalVisible(false)}>
        <View style={styles.imageOverlay}>
          <TouchableOpacity style={styles.imageClose} onPress={() => setModalVisible(false)}>
            <Icon name="close-outline" size={28} color={colors.textInverse} />
          </TouchableOpacity>
          {selectedImage && <Image source={{ uri: selectedImage }} style={styles.fullImage} resizeMode="contain" />}
        </View>
      </Modal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.headerBg },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  scroll: { padding: spacing.lg, paddingBottom: 80 },
  reg: { ...typography.title1, color: colors.textPrimary, marginBottom: spacing.xs },
  serial: { ...typography.subhead, color: colors.textSecondary, marginBottom: spacing.sm },
  badges: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.sm },
  pill: {
    flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.sm, paddingVertical: 3,
    borderRadius: radius.full, backgroundColor: colors.bg, borderWidth: 1, borderColor: colors.border, gap: 4,
  },
  pillText: { ...typography.caption2, color: colors.textSecondary, fontWeight: '600' },
  date: { ...typography.footnote, color: colors.textSecondary },
  instrBox: { backgroundColor: colors.accentLight, padding: spacing.md, borderRadius: radius.md, marginTop: spacing.md, borderWidth: 1, borderColor: colors.accent },
  instrHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: spacing.xs, gap: spacing.xs },
  instrTitle: { ...typography.footnote, fontWeight: '700', color: colors.accentDark },
  instrText: { ...typography.footnote, color: colors.accentDark, lineHeight: 18 },
  infoRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingVertical: spacing.sm, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border,
  },
  infoLabel: { ...typography.subhead, color: colors.textSecondary },
  infoValue: { ...typography.subhead, color: colors.textPrimary, fontWeight: '500', flexShrink: 1, textAlign: 'right' },
  infoLink: { ...typography.subhead, color: colors.info, fontWeight: '500', textDecorationLine: 'underline' },
  descText: { ...typography.subhead, color: colors.textPrimary, lineHeight: 22 },
  subLabel: { ...typography.footnote, fontWeight: '600', color: colors.textSecondary, marginBottom: spacing.xs },
  bullet: { ...typography.subhead, color: colors.textPrimary, lineHeight: 24 },
  noneText: { ...typography.subhead, color: colors.textTertiary, fontStyle: 'italic' },
  divider: { height: StyleSheet.hairlineWidth, backgroundColor: colors.border, marginVertical: spacing.md },
  photoStrip: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.xl },
  photo: { width: 100, height: 100, borderRadius: radius.md, backgroundColor: colors.shimmer },
  emptyLog: { alignItems: 'center', paddingVertical: spacing.xl, gap: spacing.sm },
  emptyLogText: { ...typography.subhead, color: colors.textTertiary },
  logEntry: { flexDirection: 'row', padding: spacing.lg },
  logDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.accent, marginTop: 5, marginRight: spacing.md },
  logContent: { flex: 1 },
  logHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  logActor: { ...typography.subhead, fontWeight: '600', color: colors.textPrimary, flex: 1 },
  logTime: { ...typography.caption2, color: colors.textTertiary, marginLeft: spacing.sm },
  logStatus: { ...typography.footnote, fontWeight: '600', marginTop: 2 },
  logNote: { ...typography.footnote, color: colors.textSecondary, marginTop: 2, lineHeight: 18 },
  bottomBar: {
    flexDirection: 'row', padding: spacing.lg, paddingBottom: spacing.md,
    backgroundColor: colors.surface, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border, gap: spacing.md,
  },
  editBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    backgroundColor: colors.headerBg, paddingVertical: spacing.md, borderRadius: radius.md, gap: spacing.sm,
  },
  aiBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    backgroundColor: colors.accent, paddingVertical: spacing.md, borderRadius: radius.md, gap: spacing.sm,
  },
  bottomBtnText: { ...typography.callout, fontWeight: '600', color: colors.textInverse },
  imageOverlay: { flex: 1, backgroundColor: '#000', justifyContent: 'center' },
  imageClose: {
    position: 'absolute', top: 40, right: 20, zIndex: 1,
    padding: spacing.sm, backgroundColor: 'rgba(0,0,0,0.5)', borderRadius: radius.full,
  },
  fullImage: { width: '100%', height: '80%' },
});
