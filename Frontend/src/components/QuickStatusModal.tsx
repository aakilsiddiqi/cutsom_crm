import React, { useState, useEffect, useRef, memo } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, TextInput, Modal, Animated,
  ActivityIndicator, KeyboardAvoidingView, Platform, TouchableWithoutFeedback,
  Keyboard, Alert,
} from 'react-native';
import { supabase } from '../services/supabase';
import { JobSheet } from '../types';
import { colors, spacing, radius, typography } from '../theme/tokens';
import { Icon } from './ui/Icon';

interface QuickStatusModalProps {
  visible: boolean;
  jobSheet: JobSheet | null;
  onClose: () => void;
  onStatusUpdate: (jobSheetId: string, newStatus: string) => void;
}

const STATUS_CONFIG: Record<string, { bg: string; text: string; icon: React.ComponentProps<typeof Icon>['name'] }> = {
  'In Queue': { bg: colors.statusQueueBg, text: colors.statusQueue, icon: 'hourglass-outline' },
  'In Progress': { bg: colors.statusProgressBg, text: colors.statusProgress, icon: 'construct-outline' },
  Completed: { bg: colors.statusCompletedBg, text: colors.statusCompleted, icon: 'checkmark-circle-outline' },
  'On Hold': { bg: colors.statusHoldBg, text: colors.statusHold, icon: 'pause-circle-outline' },
};

export const QuickStatusModal: React.FC<QuickStatusModalProps> = memo(({
  visible, jobSheet, onClose, onStatusUpdate,
}) => {
  const [selectedStatus, setSelectedStatus] = useState('');
  const [noteText, setNoteText] = useState('');
  const [loading, setLoading] = useState(false);
  const translateY = useRef(new Animated.Value(500)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible && jobSheet) {
      setSelectedStatus(jobSheet.status);
      setNoteText('');
      Animated.parallel([
        Animated.timing(translateY, { toValue: 0, duration: 300, useNativeDriver: true }),
        Animated.timing(fadeAnim, { toValue: 1, duration: 300, useNativeDriver: true }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(translateY, { toValue: 500, duration: 300, useNativeDriver: true }),
        Animated.timing(fadeAnim, { toValue: 0, duration: 300, useNativeDriver: true }),
      ]).start();
    }
  }, [visible, jobSheet]);

  const handleUpdate = async () => {
    if (!jobSheet || !selectedStatus) return;
    const exec = async () => {
      setLoading(true);
      try {
        const payload: Record<string, unknown> = { status: selectedStatus };
        if (selectedStatus === 'Completed') {
          payload.completed_at = new Date().toISOString();
          payload.tat_hours = Number(((new Date().getTime() - new Date(jobSheet.entry_date_time).getTime()) / (1000 * 60 * 60)).toFixed(1));
        }
        await supabase.from('job_sheets').update(payload).eq('id', jobSheet.id);
        await supabase.from('job_updates').insert({
          job_sheet_id: jobSheet.id,
          update_note: noteText.trim() || `Status updated to ${selectedStatus}`,
          status_changed_to: selectedStatus,
        });
        onStatusUpdate(jobSheet.id, selectedStatus);
        onClose();
      } catch { Alert.alert('Error', 'Failed to update.'); }
      finally { setLoading(false); }
    };
    if (selectedStatus === 'Completed') {
      Alert.alert('Confirm', 'Mark job done and calculate TAT?', [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Continue', onPress: exec },
      ]);
    } else exec();
  };

  if (!jobSheet) return null;

  return (
    <Modal transparent visible={visible} animationType="none" onRequestClose={onClose}>
      <TouchableWithoutFeedback onPress={onClose}>
        <Animated.View style={[styles.backdrop, { opacity: fadeAnim }]}>
          <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
            <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.keyboardView}>
              <Animated.View style={[styles.sheet, { transform: [{ translateY }] }]}>
                <View style={styles.handle} />
                <View style={styles.headerRow}>
                  <Icon name="swap-horizontal-outline" size={22} color={colors.accentDark} />
                  <Text style={styles.title} allowFontScaling={false}>Quick Update</Text>
                </View>
                <Text style={styles.subtitle} allowFontScaling={false}>{jobSheet.registration_number}</Text>

                <View style={styles.grid}>
                  {Object.entries(STATUS_CONFIG).map(([status, cfg]) => {
                    const active = selectedStatus === status;
                    return (
                      <TouchableOpacity
                        key={status}
                        style={[styles.statusCard, { backgroundColor: cfg.bg }, active && styles.statusCardActive]}
                        onPress={() => setSelectedStatus(status)}
                        activeOpacity={0.7}
                      >
                        <Icon name={cfg.icon} size={22} color={cfg.text} />
                        <Text style={[styles.statusText, { color: cfg.text }]} allowFontScaling={false}>{status}</Text>
                        {active && <View style={styles.checkmark}><Icon name="checkmark-circle" size={16} color={cfg.text} /></View>}
                      </TouchableOpacity>
                    );
                  })}
                </View>

                <TextInput
                  style={styles.noteInput}
                  placeholder="Add a note... (optional)"
                  placeholderTextColor={colors.textTertiary}
                  value={noteText}
                  onChangeText={setNoteText}
                  multiline
                  maxLength={200}
                />

                <View style={styles.actions}>
                  <TouchableOpacity style={styles.cancelBtn} onPress={onClose} disabled={loading}>
                    <Text style={styles.cancelBtnText} allowFontScaling={false}>Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={[styles.updateBtn, loading && { opacity: 0.6 }]} onPress={handleUpdate} disabled={loading}>
                    {loading ? <ActivityIndicator color={colors.headerBg} size="small" /> : (
                      <Text style={styles.updateBtnText} allowFontScaling={false}>Update</Text>
                    )}
                  </TouchableOpacity>
                </View>
              </Animated.View>
            </KeyboardAvoidingView>
          </TouchableWithoutFeedback>
        </Animated.View>
      </TouchableWithoutFeedback>
    </Modal>
  );
});

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: colors.overlay, justifyContent: 'flex-end' },
  keyboardView: { justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: colors.surface, borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl,
    padding: spacing.xl, paddingTop: spacing.md,
  },
  handle: { width: 40, height: 4, backgroundColor: colors.border, borderRadius: 2, alignSelf: 'center', marginBottom: spacing.lg },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: 2 },
  title: { ...typography.title2, color: colors.textPrimary },
  subtitle: { ...typography.subhead, color: colors.textSecondary, marginBottom: spacing.xl },
  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' },
  statusCard: {
    width: '48%', paddingVertical: spacing.lg, paddingHorizontal: spacing.md,
    borderRadius: radius.lg, alignItems: 'center', marginBottom: spacing.md, gap: spacing.xs,
    borderWidth: 1, borderColor: 'transparent',
  },
  statusCardActive: { borderColor: colors.textPrimary, borderWidth: 2 },
  statusText: { ...typography.callout, fontWeight: '700' },
  checkmark: { position: 'absolute', top: spacing.sm, right: spacing.sm },
  noteInput: {
    backgroundColor: colors.bg, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md,
    padding: spacing.md, minHeight: 80, textAlignVertical: 'top', ...typography.body, color: colors.textPrimary,
    marginBottom: spacing.xl,
  },
  actions: { flexDirection: 'row', gap: spacing.md },
  cancelBtn: {
    flex: 1, paddingVertical: spacing.md, backgroundColor: colors.bg,
    borderRadius: radius.md, alignItems: 'center',
  },
  cancelBtnText: { ...typography.callout, fontWeight: '600', color: colors.textSecondary },
  updateBtn: {
    flex: 1, paddingVertical: spacing.md, backgroundColor: colors.accent,
    borderRadius: radius.md, alignItems: 'center',
  },
  updateBtnText: { ...typography.callout, fontWeight: '700', color: colors.headerBg },
});
