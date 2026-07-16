import React, { useEffect, useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, Alert, ActivityIndicator,
  Platform, KeyboardAvoidingView, ScrollView, TouchableWithoutFeedback, Keyboard, StyleSheet,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Picker } from '@react-native-picker/picker';
import { useRoute, useNavigation, RouteProp } from '@react-navigation/native';
import { supabase } from '../../services/supabase';
import { JobSheet, JobSheetStatus, RootStackParamList } from '../../types';
import { useAuth } from '../../context/AuthContext';
import { navigateBack } from '../../utils/navigationUtils';
import { STANDARD_MODELS } from '../../utils/constants';
import { useJobSheetForm } from '../../hooks/useJobSheetForm';
import { JobSheetFormFields, PhotoManager } from '../../components/JobSheetFormFields';
import { colors, spacing, radius, typography } from '../../theme/tokens';
import { Icon } from '../../components/ui/Icon';

type EditRouteProp = RouteProp<RootStackParamList, 'EditJobSheet'>;

export const EditJobSheetScreen = () => {
  const route = useRoute<EditRouteProp>();
  const navigation = useNavigation<any>();
  const { jobSheetId } = route.params;
  const { profile } = useAuth();
  const form = useJobSheetForm();
  const [initialLoading, setInitialLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [originalJobSheet, setOriginalJobSheet] = useState<JobSheet | null>(null);
  const [existingPhotos, setExistingPhotos] = useState<string[]>([]);
  const [newPhotos, setNewPhotos] = useState<string[]>([]);
  const [updateNote, setUpdateNote] = useState('');

  useEffect(() => { fetchData(); }, []);

  const fetchData = async () => {
    try {
      if (profile?.role === 'admin') {
        const { data } = await supabase.from('profiles').select('*').eq('role', 'user').eq('is_active', true);
        if (data) form.setTechnicians(data as any);
      }
      const { data, error } = await supabase.from('job_sheets').select('*').eq('id', jobSheetId).single();
      if (error) throw error;
      const job = data as JobSheet;
      setOriginalJobSheet(job);
      form.setRegistrationNumber(job.registration_number);
      form.setCustomerName(job.customer_name || '');
      form.setCustomerMobile(job.customer_mobile || '');
      form.setEntryDateTime(new Date(job.entry_date_time));
      const model = job.machine_model || '3DX';
      if (!STANDARD_MODELS.includes(model)) {
        form.setIsCustomModel(true); form.setSelectedModel('Other'); form.setCustomModelText(model);
      } else form.setSelectedModel(model);
      form.setServiceLocation(job.service_location || 'Workshop');
      form.setPriority(job.priority || 'Normal');
      form.setIssuesDescription(job.issues_description || '');
      form.setStatus(job.status);
      form.setAssigneeId(job.assigned_to || '');
      form.setPartsNeeded(job.parts_needed || []);
      form.setPartsUsed(job.parts_used || []);
      setExistingPhotos(job.photos || []);
    } catch { Alert.alert('Error', 'Could not load job.'); navigateBack(navigation); }
    finally { setInitialLoading(false); }
  };

  const handleSave = async () => {
    if (!form.registrationNumber.trim() || !form.customerName.trim() || !form.customerMobile.trim())
      return Alert.alert('Validation', 'Registration, Name, Mobile required.');
    setSaving(true);
    try {
      if (!profile) throw new Error('Not authenticated');
      const urls = await form.uploadPhotos(newPhotos);
      const finalPhotos = [...existingPhotos, ...urls];
      const payload: Record<string, unknown> = {
        registration_number: form.registrationNumber.trim().toUpperCase(),
        customer_name: form.customerName.trim(),
        customer_mobile: form.customerMobile.trim(),
        entry_date_time: form.entryDateTime.toISOString(),
        machine_model: form.getFinalModel(),
        service_location: form.serviceLocation,
        priority: form.priority,
        issues_description: form.issuesDescription.trim(),
        status: form.status,
        assigned_to: profile.role === 'user' ? (originalJobSheet?.assigned_to || profile.id) : (form.assigneeId || null),
        parts_needed: form.partsNeeded,
        parts_used: form.partsUsed,
        photos: finalPhotos,
      };
      let statusChangedTo: string | null = null;
      if (originalJobSheet && originalJobSheet.status !== form.status) {
        statusChangedTo = form.status;
        if (form.status === 'Completed') {
          const tatHours = Number(((Date.now() - new Date(form.entryDateTime).getTime()) / (1000 * 60 * 60)).toFixed(1));
          payload.completed_at = new Date().toISOString();
          payload.tat_hours = tatHours;
        } else { payload.completed_at = null; payload.tat_hours = null; }
      }
      await supabase.from('job_sheets').update(payload).eq('id', jobSheetId);
      await supabase.from('job_updates').insert({
        job_sheet_id: jobSheetId, updated_by: profile.id,
        update_note: updateNote.trim() || null, status_changed_to: statusChangedTo,
      });
      Platform.OS === 'web' ? (window.alert('Updated.'), navigateBack(navigation)) : Alert.alert('Updated', 'Job sheet updated.', [{ text: 'OK', onPress: () => navigateBack(navigation) }]);
    } catch (error) { Alert.alert('Error', error instanceof Error ? error.message : 'Failed.'); }
    finally { setSaving(false); }
  };

  if (initialLoading) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.center}><ActivityIndicator size="large" color={colors.accent} /></View>
      </SafeAreaView>
    );
  }

  const allPhotos = [...existingPhotos, ...newPhotos];
  const photoManager: PhotoManager = {
    uris: allPhotos,
    onRemove: (i) => {
      if (i < existingPhotos.length) setExistingPhotos(existingPhotos.filter((_, idx) => idx !== i));
      else setNewPhotos(newPhotos.filter((_, idx) => idx !== i - existingPhotos.length));
    },
    onTake: () => form.openCamera((uri) => setNewPhotos(prev => [...prev, uri])),
    onPick: () => form.openGallery((uri) => setNewPhotos(prev => [...prev, uri])),
  };

  const extraSection = (
    <View style={styles.statusBox}>
      <Text style={styles.statusBoxTitle} allowFontScaling={false}>Update Status</Text>
      <View style={styles.pickerWrap}>
        <Picker selectedValue={form.status} onValueChange={(v) => form.setStatus(v as JobSheetStatus)}>
          <Picker.Item label="In Queue" value="In Queue" />
          <Picker.Item label="In Progress" value="In Progress" />
          <Picker.Item label="Completed" value="Completed" />
          <Picker.Item label="On Hold" value="On Hold" />
        </Picker>
      </View>
      <Text style={styles.noteLabel} allowFontScaling={false}>Update Note (Activity Log)</Text>
      <TextInput
        style={styles.noteInput}
        placeholder="E.g., Waiting for spare parts..."
        placeholderTextColor={colors.textTertiary}
        value={updateNote}
        onChangeText={setUpdateNote}
        multiline
        textAlignVertical="top"
      />
    </View>
  );

  const content = (
    <JobSheetFormFields
      headerTitle="Edit Job Sheet"
      onBack={() => navigateBack(navigation)}
      registrationNumber={form.registrationNumber}
      onRegistrationNumberChange={form.setRegistrationNumber}
      customerName={form.customerName}
      onCustomerNameChange={form.setCustomerName}
      customerMobile={form.customerMobile}
      onCustomerMobileChange={form.setCustomerMobile}
      entryDateTime={form.entryDateTime}
      onEntryDateTimeChange={form.setEntryDateTime}
      showDatePicker={form.showDatePicker}
      onShowDatePickerChange={form.setShowDatePicker}
      showTimePicker={form.showTimePicker}
      onShowTimePickerChange={form.setShowTimePicker}
      selectedModel={form.selectedModel}
      isCustomModel={form.isCustomModel}
      customModelText={form.customModelText}
      onModelChange={form.handleModelChange}
      onCustomModelTextChange={form.setCustomModelText}
      onIsCustomModelChange={form.setIsCustomModel}
      serviceLocation={form.serviceLocation}
      onServiceLocationChange={form.setServiceLocation}
      priority={form.priority}
      onPriorityChange={form.setPriority}
      issuesDescription={form.issuesDescription}
      onIssuesDescriptionChange={form.setIssuesDescription}
      status={form.status}
      onStatusChange={form.setStatus}
      statusPicker={false}
      assigneeLabel={profile?.role === 'user' ? `Assigned To: ${originalJobSheet?.assignee?.full_name || profile.full_name || profile.username}` : undefined}
      assigneePicker={profile?.role === 'admin'}
      assigneeValue={form.assigneeId}
      onAssigneeChange={form.setAssigneeId}
      technicians={form.technicians.map(t => ({ id: t.id, name: t.full_name || t.username }))}
      partsNeeded={form.partsNeeded}
      newPartNeeded={form.newPartNeeded}
      onNewPartNeededChange={form.setNewPartNeeded}
      onAddPartNeeded={form.handleAddPartNeeded}
      onRemovePartNeeded={form.handleRemovePartNeeded}
      partsUsed={form.partsUsed}
      newPartUsedName={form.newPartUsedName}
      onNewPartUsedNameChange={form.setNewPartUsedName}
      newPartUsedQty={form.newPartUsedQty}
      onNewPartUsedQtyChange={form.setNewPartUsedQty}
      onAddPartUsed={form.handleAddPartUsed}
      onRemovePartUsed={form.handleRemovePartUsed}
      editingPartIndex={form.editingPartIndex}
      editingPartName={form.editingPartName}
      onEditingPartNameChange={form.setEditingPartName}
      editingPartQty={form.editingPartQty}
      onEditingPartQtyChange={form.setEditingPartQty}
      onEditPartUsed={form.handleEditPartUsed}
      onSaveEditPartUsed={form.handleSaveEditPartUsed}
      onCancelEditPartUsed={() => form.setEditingPartIndex(null)}
      photos={photoManager}
      extraSection={extraSection}
      renderSubmit={() => (
        <TouchableOpacity style={[styles.submit, saving && { opacity: 0.6 }]} onPress={handleSave} disabled={saving} activeOpacity={0.8}>
          {saving ? <ActivityIndicator color={colors.accent} /> : (
            <View style={styles.submitContent}>
              <Icon name="checkmark-circle-outline" size={20} color={colors.accent} />
              <Text style={styles.submitText} allowFontScaling={false}>Save Changes</Text>
            </View>
          )}
        </TouchableOpacity>
      )}
    />
  );

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
      {Platform.OS === 'web' ? content : <TouchableWithoutFeedback onPress={Keyboard.dismiss}>{content}</TouchableWithoutFeedback>}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.headerBg },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  submit: { backgroundColor: colors.headerBg, padding: spacing.lg, borderRadius: radius.md, alignItems: 'center' },
  submitContent: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  submitText: { ...typography.headline, fontWeight: '700', color: colors.accent },
  statusBox: {
    backgroundColor: colors.surface, padding: spacing.lg, borderRadius: radius.lg,
    marginBottom: spacing.lg, borderWidth: 1, borderColor: colors.border,
  },
  statusBoxTitle: { ...typography.callout, fontWeight: '600', color: colors.textPrimary, marginBottom: spacing.md },
  pickerWrap: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, overflow: 'hidden', marginBottom: spacing.lg },
  noteLabel: { ...typography.footnote, fontWeight: '600', color: colors.textSecondary, marginBottom: spacing.sm },
  noteInput: {
    backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md,
    padding: spacing.md, minHeight: 80, ...typography.body, color: colors.textPrimary,
  },
});
