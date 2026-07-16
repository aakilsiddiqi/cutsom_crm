import React, { useEffect, useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, Alert, ActivityIndicator,
  Platform, KeyboardAvoidingView, ScrollView, TouchableWithoutFeedback, Keyboard, StyleSheet
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
        form.setIsCustomModel(true);
        form.setSelectedModel('Other');
        form.setCustomModelText(model);
      } else {
        form.setSelectedModel(model);
      }
      form.setServiceLocation(job.service_location || 'Workshop');
      form.setPriority(job.priority || 'Normal');
      form.setIssuesDescription(job.issues_description || '');
      form.setStatus(job.status);
      form.setAssigneeId(job.assigned_to || '');
      form.setPartsNeeded(job.parts_needed || []);
      form.setPartsUsed(job.parts_used || []);
      setExistingPhotos(job.photos || []);
    } catch {
      Alert.alert('Error', 'Could not load job.');
      navigateBack(navigation);
    } finally {
      setInitialLoading(false);
    }
  };

  const handleSave = async () => {
    if (!form.registrationNumber.trim() || !form.customerName.trim() || !form.customerMobile.trim())
      return Alert.alert('Validation', 'Registration, Name, Mobile required.');

    setSaving(true);
    try {
      if (!profile) throw new Error('Not authenticated');
      const urls = await form.uploadPhotos(newPhotos);
      const finalPhotos = [...existingPhotos, ...urls];
      const updatePayload: Record<string, unknown> = {
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
          const now = Date.now();
          const tatHours = Number(((now - new Date(form.entryDateTime).getTime()) / (1000 * 60 * 60)).toFixed(1));
          updatePayload.completed_at = new Date().toISOString();
          updatePayload.tat_hours = tatHours;
        } else {
          updatePayload.completed_at = null;
          updatePayload.tat_hours = null;
        }
      }

      const { error: updateError } = await supabase.from('job_sheets').update(updatePayload).eq('id', jobSheetId);
      if (updateError) throw updateError;

      const { error: logError } = await supabase.from('job_updates').insert({
        job_sheet_id: jobSheetId, updated_by: profile.id,
        update_note: updateNote.trim() || null, status_changed_to: statusChangedTo,
      });
      if (logError) throw logError;

      if (Platform.OS === 'web') {
        window.alert('Updated.');
        navigateBack(navigation);
      } else {
        Alert.alert('Updated', 'Job sheet updated.', [{ text: 'OK', onPress: () => navigateBack(navigation) }]);
      }
    } catch (error) {
      Alert.alert('Error', error instanceof Error ? error.message : 'Failed.');
    } finally {
      setSaving(false);
    }
  };

  if (initialLoading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#1a1a2e" />
      </View>
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
    <View style={styles.statusUpdateBox}>
      <Text style={styles.updateTitle}>Update Status</Text>
      <View style={styles.sPickerContainer}>
        <Picker selectedValue={form.status} onValueChange={(v) => form.setStatus(v as JobSheetStatus)}>
          <Picker.Item label="In Queue" value="In Queue" />
          <Picker.Item label="In Progress" value="In Progress" />
          <Picker.Item label="Completed" value="Completed" />
          <Picker.Item label="On Hold" value="On Hold" />
        </Picker>
      </View>
      <Text style={[styles.label, { marginTop: 16 }]}>Update Note (Activity Log)</Text>
      <TextInput style={[styles.input, { height: 80, textAlignVertical: 'top' }]} placeholder="E.g., Waiting for spare parts..." value={updateNote} onChangeText={setUpdateNote} multiline />
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
        <TouchableOpacity style={[styles.submitButton, saving && styles.disabledButton]} onPress={handleSave} disabled={saving}>
          {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.submitButtonText}>Save Changes</Text>}
        </TouchableOpacity>
      )}
    />
  );

  return (
    <SafeAreaView style={stylesSafe.safeArea} edges={['top', 'left', 'right']}>
      {Platform.OS === 'web' ? content : (
        <TouchableWithoutFeedback onPress={Keyboard.dismiss}>{content}</TouchableWithoutFeedback>
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  centerContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  submitButton: { backgroundColor: '#1a1a2e', padding: 16, borderRadius: 8, alignItems: 'center' },
  disabledButton: { opacity: 0.7 },
  submitButtonText: { color: '#FFD700', fontWeight: 'bold', fontSize: 18 },
  statusUpdateBox: { backgroundColor: '#fff', padding: 16, borderRadius: 8, marginTop: 10, marginBottom: 20, borderWidth: 1, borderColor: '#ddd' },
  updateTitle: { fontSize: 16, fontWeight: 'bold', color: '#1a1a2e', marginBottom: 10 },
  label: { fontSize: 14, fontWeight: '600', color: '#555', marginBottom: 8 },
  input: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#ddd', borderRadius: 8, padding: 12, fontSize: 16 },
  sPickerContainer: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#ddd', borderRadius: 8, overflow: 'hidden' },
});

const stylesSafe = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#1a1a2e' },
});
