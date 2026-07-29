import React, { useState, useCallback, useRef, useEffect } from 'react';
import {
  View, Text, TextInput, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator,
  RefreshControl, Linking, Switch, Alert, Modal, StatusBar, Animated, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Picker } from '@react-native-picker/picker';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { supabase } from '../../services/supabase';
import { supabaseAdmin } from '../../services/supabaseAdmin';
import { UserProfile, AdminStackParamList } from '../../types';
import { useAuth } from '../../context/AuthContext';
import { colors, spacing, radius, typography } from '../../theme/tokens';
import { Icon } from '../../components/ui/Icon';

type NavigationProp = NativeStackNavigationProp<AdminStackParamList, 'AdminTabs'>;

type TeamMemberStats = UserProfile & {
  activeJobs: number;
  completedThisMonth: number;
};

export const TeamScreen = () => {
  const navigation = useNavigation<NavigationProp>();
  const { profile } = useAuth();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [errorOccurred, setErrorOccurred] = useState(false);
  const [teamStats, setTeamStats] = useState<TeamMemberStats[]>([]);
  const [reassignModalVisible, setReassignModalVisible] = useState(false);
  const [techToRemove, setTechToRemove] = useState<{ id: string; name: string } | null>(null);
  const [activeJobsToReassign, setActiveJobsToReassign] = useState<any[]>([]);
  const [availableTechs, setAvailableTechs] = useState<UserProfile[]>([]);
  const [reassignToTechId, setReassignToTechId] = useState('');
  const [resetPwdModalVisible, setResetPwdModalVisible] = useState(false);
  const [resetPwdTarget, setResetPwdTarget] = useState<{ id: string; name: string } | null>(null);
  const [newPassword, setNewPassword] = useState('');
  const [resettingPwd, setResettingPwd] = useState(false);

  const cacheTs = useRef(0);
  const CACHE_TTL = 30_000;

  // Animations
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(15)).current;
  const fabScale = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 400, useNativeDriver: true }),
      Animated.spring(slideAnim, { toValue: 0, speed: 50, bounciness: 6, useNativeDriver: true }),
    ]).start();
    Animated.spring(fabScale, { toValue: 1, speed: 50, bounciness: 8, useNativeDriver: true }).start();
  }, []);

  const fetchTeamStats = async (signal: AbortSignal, force: boolean = false) => {
    if (!force && Date.now() - cacheTs.current < CACHE_TTL) {
      setLoading(false);
      return;
    }
    try {
      if (!signal.aborted) setErrorOccurred(false);
      const { data: techsData, error: techsError } = await supabase
        .from('profiles').select('*').eq('role', 'user');
      if (techsError) throw techsError;
      const technicians = techsData as UserProfile[];
      if (technicians.length === 0) {
        if (!signal.aborted) setTeamStats([]);
        return;
      }
      const now = new Date();
      const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
      const stats = await Promise.all(
        technicians.map(async (tech) => {
          const [activeRes, completedRes] = await Promise.all([
            supabase.from('job_sheets').select('*', { count: 'exact', head: true }).eq('assigned_to', tech.id).neq('status', 'Completed'),
            supabase.from('job_sheets').select('*', { count: 'exact', head: true }).eq('assigned_to', tech.id).eq('status', 'Completed').gte('completed_at', firstDayOfMonth),
          ]);
          return { ...tech, activeJobs: activeRes.count || 0, completedThisMonth: completedRes.count || 0 };
        })
      );
      stats.sort((a, b) => b.activeJobs - a.activeJobs);
      if (!signal.aborted) {
        cacheTs.current = Date.now();
        setTeamStats(stats);
      }
    } catch {
      if (!signal.aborted) setErrorOccurred(true);
    } finally {
      if (!signal.aborted) { setLoading(false); setRefreshing(false); }
    }
  };

  useFocusEffect(
    useCallback(() => {
      const ac = new AbortController();
      fetchTeamStats(ac.signal);
      return () => ac.abort();
    }, [])
  );

  const onRefresh = () => {
    setRefreshing(true);
    cacheTs.current = 0;
    fetchTeamStats(new AbortController().signal, true);
  };

  const handleCall = (phone: string) => Linking.openURL(`tel:${phone}`);

  const toggleTechStatus = async (techId: string, currentStatus: boolean, name: string) => {
    const update = async () => {
      await supabase.from('profiles').update({ is_active: !currentStatus }).eq('id', techId);
      setTeamStats(prev => prev.map(t => t.id === techId ? { ...t, is_active: !currentStatus } : t));
    };
    Alert.alert('Confirm', `${currentStatus ? 'Deactivate' : 'Activate'} ${name}?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Yes', onPress: update },
    ]);
  };

  const handleResetPassword = async () => {
    if (!resetPwdTarget || !newPassword || newPassword.length < 6) {
      Alert.alert('Error', 'Password must be at least 6 characters.');
      return;
    }
    setResettingPwd(true);
    try {
      const { error } = await supabaseAdmin.auth.admin.updateUserById(resetPwdTarget.id, { password: newPassword });
      if (error) throw error;
      await supabase.from('revenue_audit_log').insert({
        action: 'password_reset',
        new_data: { user_id: resetPwdTarget.id, user_name: resetPwdTarget.name },
        changed_by: profile?.id,
      });
      Alert.alert('Success', `Password reset for ${resetPwdTarget.name}.`);
      setResetPwdModalVisible(false);
      setNewPassword('');
      setResetPwdTarget(null);
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to reset password.');
    } finally {
      setResettingPwd(false);
    }
  };

  const handleRemovePress = async (techId: string, name: string) => {
    try {
      const { data: activeJobs } = await supabase
        .from('job_sheets').select('id, registration_number').eq('assigned_to', techId).neq('status', 'Completed');
      if (!activeJobs || activeJobs.length === 0) {
        const deactivate = () => { setLoading(true); supabase.from('profiles').update({ is_active: false }).eq('id', techId); fetchTeamStats(new AbortController().signal); };
        Alert.alert('Remove Technician', `Remove ${name}? Account deactivated, history preserved.`, [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Remove', style: 'destructive', onPress: deactivate },
        ]);
      } else {
        const { data: others } = await supabase.from('profiles').select('*').eq('role', 'user').eq('is_active', true).neq('id', techId);
        setAvailableTechs((others as UserProfile[]) || []);
        setActiveJobsToReassign(activeJobs);
        setTechToRemove({ id: techId, name });
        setReassignToTechId('');
        setReassignModalVisible(true);
      }
    } catch { Alert.alert('Error', 'Failed to fetch active jobs.'); }
  };

  const handleReassignAndRemove = async () => {
    if (!techToRemove || !reassignToTechId) return Alert.alert('Error', 'Select technician.');
    setLoading(true);
    setReassignModalVisible(false);
    try {
      await supabase.from('job_sheets').update({ assigned_to: reassignToTechId }).eq('assigned_to', techToRemove.id).neq('status', 'Completed');
      await supabase.from('profiles').update({ is_active: false }).eq('id', techToRemove.id);
      Alert.alert('Success', `Jobs reassigned, ${techToRemove.name} deactivated.`);
      fetchTeamStats(new AbortController().signal);
    } catch { Alert.alert('Error', 'Failed.'); setLoading(false); }
  };

  const renderItem = ({ item }: { item: TeamMemberStats }) => (
    <View style={styles.card}>
      <View style={styles.cardTop}>
        <View style={styles.cardLeft}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText} allowFontScaling={false}>
              {(item.full_name || item.username || '?').charAt(0).toUpperCase()}
            </Text>
          </View>
          <View style={styles.cardInfo}>
            <Text style={styles.techName} allowFontScaling={false}>{item.full_name || item.username}</Text>
            <View style={styles.statusRow}>
              <View style={[styles.statusDot, { backgroundColor: item.is_active ? colors.success : colors.error }]} />
              <Text style={[styles.statusLabel, { color: item.is_active ? colors.success : colors.error }]} allowFontScaling={false}>
                {item.is_active ? 'Active' : 'Inactive'}
              </Text>
            </View>
          </View>
        </View>
        <Switch
          value={item.is_active}
          onValueChange={() => toggleTechStatus(item.id, item.is_active || false, item.full_name || item.username)}
          trackColor={{ false: colors.border, true: colors.accent }}
          thumbColor={item.is_active ? colors.headerBg : colors.textTertiary}
        />
      </View>

      <TouchableOpacity style={styles.phoneRow} onPress={() => item.phone && handleCall(item.phone)} disabled={!item.phone}>
        <Icon name="call-outline" size={14} color={item.phone ? colors.info : colors.textTertiary} />
        <Text style={[styles.phoneText, !item.phone && { color: colors.textTertiary }]} allowFontScaling={false}>
          {item.phone || 'No phone'}
        </Text>
      </TouchableOpacity>

      <View style={styles.statsRow}>
        <View style={styles.stat}>
          <Text style={styles.statValue} allowFontScaling={false}>{item.activeJobs}</Text>
          <Text style={styles.statLabel} allowFontScaling={false}>Active</Text>
        </View>
        <View style={[styles.stat, styles.statGreen]}>
          <Text style={[styles.statValue, { color: colors.success }]} allowFontScaling={false}>{item.completedThisMonth}</Text>
          <Text style={[styles.statLabel, { color: colors.success }]} allowFontScaling={false}>This Month</Text>
        </View>
      </View>

      <View style={styles.cardActions}>
        <TouchableOpacity
          style={styles.actionBtn}
          onPress={() => {
            setResetPwdTarget({ id: item.id, name: item.full_name || item.username });
            setNewPassword('');
            setResetPwdModalVisible(true);
          }}
        >
          <Icon name="key-outline" size={14} color={colors.info} />
          <Text style={[styles.actionText, { color: colors.info }]} allowFontScaling={false}>Reset Password</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.actionBtn} onPress={() => handleRemovePress(item.id, item.full_name || item.username)}>
          <Icon name="trash-outline" size={14} color={colors.error} />
          <Text style={[styles.actionText, { color: colors.error }]} allowFontScaling={false}>Remove</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="light-content" backgroundColor={colors.headerBg} />
      <View style={styles.header}>
        <Text style={styles.headerTitle} allowFontScaling={false}>Our Team</Text>
        <TouchableOpacity style={styles.addBtn} onPress={() => navigation.navigate('AddTechnician')}>
          <Icon name="person-add-outline" size={18} color="#000" />
          <Text style={styles.addBtnText} allowFontScaling={false}>Add</Text>
        </TouchableOpacity>
      </View>
      <View style={styles.body}>
        {loading && !refreshing ? (
          <View style={styles.center}><ActivityIndicator size="large" color={colors.accent} /></View>
        ) : errorOccurred ? (
          <View style={styles.center}>
            <Icon name="cloud-offline-outline" size={48} color={colors.textTertiary} />
            <Text style={styles.errorText} allowFontScaling={false}>Failed to load. Pull down to refresh.</Text>
          </View>
        ) : (
          <FlatList
            data={teamStats}
            keyExtractor={(item) => item.id}
            renderItem={renderItem}
            contentContainerStyle={styles.list}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accent} colors={[colors.accent]} />}
            showsVerticalScrollIndicator={false}
            ListEmptyComponent={
              <View style={styles.center}>
                <Icon name="people-outline" size={48} color={colors.textTertiary} />
                <Text style={styles.emptyText} allowFontScaling={false}>No technicians added yet.</Text>
              </View>
            }
          />
        )}
      </View>
      <Animated.View style={[styles.fab, { transform: [{ scale: fabScale }] }]}>
        <TouchableOpacity style={styles.fabInner} onPress={() => navigation.navigate('AddTechnician')} activeOpacity={0.8}>
          <Icon name="add" size={28} color="#000" />
        </TouchableOpacity>
      </Animated.View>

      <Modal visible={resetPwdModalVisible} transparent animationType="slide" onRequestClose={() => setResetPwdModalVisible(false)}>
        <View style={styles.overlay}>
          <View style={styles.sheet}>
            <View style={styles.sheetHandle} />
            <Text style={styles.sheetTitle} allowFontScaling={false}>Reset Password</Text>
            <Text style={styles.sheetSubtitle} allowFontScaling={false}>
              New password for {resetPwdTarget?.name}
            </Text>
            <TextInput
              style={styles.pwdInput}
              placeholder="Enter new password"
              placeholderTextColor={colors.textTertiary}
              value={newPassword}
              onChangeText={setNewPassword}
              secureTextEntry
              autoCapitalize="none"
            />
            <Text style={styles.pwdHint} allowFontScaling={false}>Minimum 6 characters</Text>
            <View style={styles.sheetActions}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setResetPwdModalVisible(false)}>
                <Text style={styles.cancelBtnText} allowFontScaling={false}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.reassignBtn, { backgroundColor: colors.info }]}
                onPress={handleResetPassword}
                disabled={resettingPwd || newPassword.length < 6}
              >
                {resettingPwd ? (
                  <ActivityIndicator size="small" color={colors.textInverse} />
                ) : (
                  <Text style={styles.reassignBtnText} allowFontScaling={false}>Reset</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Modal visible={reassignModalVisible} transparent animationType="slide" onRequestClose={() => setReassignModalVisible(false)}>
        <View style={styles.overlay}>
          <View style={styles.sheet}>
            <View style={styles.sheetHandle} />
            <Text style={styles.sheetTitle} allowFontScaling={false}>Reassign Active Jobs</Text>
            <Text style={styles.sheetSubtitle} allowFontScaling={false}>
              {techToRemove?.name} has {activeJobsToReassign.length} active job{activeJobsToReassign.length !== 1 ? 's' : ''}.
            </Text>
            <View style={styles.jobsList}>
              {activeJobsToReassign.slice(0, 3).map(j => (
                <Text key={j.id} style={styles.jobItem} allowFontScaling={false}>· {j.registration_number}</Text>
              ))}
              {activeJobsToReassign.length > 3 && (
                <Text style={styles.jobItem} allowFontScaling={false}>· ...and {activeJobsToReassign.length - 3} more</Text>
              )}
            </View>
            <Text style={styles.sheetLabel} allowFontScaling={false}>Reassign all to:</Text>
            <View style={styles.pickerContainer}>
              <Picker selectedValue={reassignToTechId} onValueChange={setReassignToTechId}>
                <Picker.Item label="-- Select Technician --" value="" />
                {availableTechs.map(t => (
                  <Picker.Item key={t.id} label={t.full_name || t.username} value={t.id} />
                ))}
              </Picker>
            </View>
            <View style={styles.sheetActions}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setReassignModalVisible(false)}>
                <Text style={styles.cancelBtnText} allowFontScaling={false}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.reassignBtn} onPress={handleReassignAndRemove}>
                <Text style={styles.reassignBtnText} allowFontScaling={false}>Reassign & Remove</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.headerBg },
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: spacing.xl, paddingVertical: spacing.md, backgroundColor: colors.headerBg,
    borderBottomLeftRadius: 20, borderBottomRightRadius: 20,
  },
  headerTitle: { fontSize: 22, fontWeight: '700', color: colors.headerText },
  addBtn: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: colors.accent,
    paddingVertical: spacing.sm, paddingHorizontal: spacing.md, borderRadius: 10, gap: spacing.xs,
  },
  addBtnText: { fontSize: 14, fontWeight: '600', color: '#000' },
  body: { flex: 1, backgroundColor: colors.bg },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: spacing['3xl'], gap: spacing.md },
  list: { padding: spacing.lg, paddingBottom: 100 },
  card: {
    backgroundColor: colors.surface, borderRadius: 20, padding: spacing.lg,
    marginBottom: spacing.md, borderWidth: 1, borderColor: colors.border,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.04, shadowRadius: 8, elevation: 2,
  },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.md },
  cardLeft: { flexDirection: 'row', alignItems: 'center', flex: 1, gap: spacing.md },
  avatar: {
    width: 48, height: 48, borderRadius: 24, backgroundColor: colors.accent,
    alignItems: 'center', justifyContent: 'center',
  },
  avatarText: { fontSize: 18, fontWeight: '700', color: '#000' },
  cardInfo: { flex: 1 },
  techName: { fontSize: 16, fontWeight: '600', color: colors.textPrimary },
  statusRow: { flexDirection: 'row', alignItems: 'center', marginTop: 2, gap: 4 },
  statusDot: { width: 6, height: 6, borderRadius: 3 },
  statusLabel: { fontSize: 12, fontWeight: '600' },
  phoneRow: { flexDirection: 'row', alignItems: 'center', marginBottom: spacing.md, gap: spacing.sm },
  phoneText: { fontSize: 14, color: colors.info },
  statsRow: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.md },
  stat: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    paddingVertical: spacing.sm + 2, borderRadius: 10, gap: spacing.xs,
    backgroundColor: colors.statusProgressBg,
  },
  statGreen: { backgroundColor: colors.statusCompletedBg },
  statValue: { fontSize: 16, fontWeight: '700', color: colors.statusProgress },
  statLabel: { fontSize: 12, fontWeight: '600', color: colors.statusProgress },
  cardActions: {
    flexDirection: 'row', justifyContent: 'flex-end', gap: spacing.md, paddingTop: spacing.sm,
    borderTopWidth: 1, borderTopColor: colors.border,
  },
  actionBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingVertical: spacing.xs, paddingHorizontal: spacing.sm },
  actionText: { fontSize: 12, fontWeight: '600' },
  pwdInput: {
    borderWidth: 1, borderColor: colors.border, borderRadius: radius.md,
    padding: spacing.md, fontSize: 16, color: colors.textPrimary, backgroundColor: colors.bg,
    marginBottom: spacing.xs,
  },
  pwdHint: { fontSize: 12, color: colors.textSecondary, marginBottom: spacing.xl },
  errorText: { fontSize: 15, color: colors.textSecondary, textAlign: 'center' },
  emptyText: { fontSize: 16, color: colors.textSecondary, textAlign: 'center' },
  fab: {
    position: 'absolute', bottom: Platform.OS === 'ios' ? 100 : 90, right: spacing.xl,
    shadowColor: colors.accent, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.4, shadowRadius: 16, elevation: 12,
    zIndex: 100,
  },
  fabInner: {
    width: 60, height: 60, borderRadius: 30, backgroundColor: colors.accent,
    justifyContent: 'center', alignItems: 'center',
  },
  overlay: { flex: 1, backgroundColor: colors.overlay, justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: colors.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24,
    padding: spacing.xl, maxHeight: '80%',
  },
  sheetHandle: { width: 36, height: 4, borderRadius: 2, backgroundColor: colors.border, alignSelf: 'center', marginBottom: spacing.lg },
  sheetTitle: { fontSize: 20, fontWeight: '700', color: colors.textPrimary, marginBottom: spacing.xs },
  sheetSubtitle: { fontSize: 14, color: colors.error, marginBottom: spacing.md, fontWeight: '500' },
  jobsList: { backgroundColor: colors.bg, padding: spacing.md, borderRadius: 12, marginBottom: spacing.lg },
  jobItem: { fontSize: 14, color: colors.textSecondary, marginBottom: 2 },
  sheetLabel: { fontSize: 13, fontWeight: '600', color: colors.textPrimary, marginBottom: spacing.sm },
  pickerContainer: { borderWidth: 1, borderColor: colors.border, borderRadius: 12, marginBottom: spacing.xl, backgroundColor: colors.surface },
  sheetActions: { flexDirection: 'row', gap: spacing.md },
  cancelBtn: { flex: 1, padding: spacing.md, alignItems: 'center', backgroundColor: colors.bg, borderRadius: 12 },
  cancelBtnText: { fontSize: 16, fontWeight: '600', color: colors.textSecondary },
  reassignBtn: { flex: 1, padding: spacing.md, alignItems: 'center', backgroundColor: colors.error, borderRadius: 12 },
  reassignBtnText: { fontSize: 16, fontWeight: '600', color: colors.textInverse },
});
