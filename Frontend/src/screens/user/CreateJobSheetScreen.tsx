import React, { useEffect, useState } from 'react';
import {
  View, Text, TouchableOpacity, Alert, ActivityIndicator,
  Platform, KeyboardAvoidingView, ScrollView, TouchableWithoutFeedback, Keyboard, StyleSheet
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { supabase } from '../../services/supabase';
import { useAuth } from '../../context/AuthContext';
import { navigateToDashboard, navigateToJobDetail, navigateBack } from '../../utils/navigationUtils';
import { useJobSheetForm } from '../../hooks/useJobSheetForm';
import { JobSheetFormFields, PhotoManager } from '../../components/JobSheetFormFields';

export const CreateJobSheetScreen = () => {
  const navigation = useNavigation<any>();
  const { profile } = useAuth();
  const form = useJobSheetForm();
  const [photos, setPhotos] = useState<string[]>([]);
  const [descriptionBox, setDescriptionBox] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (profile?.role === 'admin') form.fetchTechnicians();
  }, [profile]);

  const handleSubmit = async () => {
    if (!form.registrationNumber.trim() || !form.customerName.trim() || !form.customerMobile.trim())
      return Alert.alert('Validation', 'Fill all required fields.');
    if (form.customerMobile.length < 10)
      return Alert.alert('Validation', 'Enter valid mobile number.');
    if (form.isCustomModel && !form.customModelText.trim())
      return Alert.alert('Validation', 'Enter machine model.');

    setLoading(true);
    try {
      if (!profile) throw new Error('Not authenticated');
      const urls = await form.uploadPhotos(photos);
      const assignedUser = profile.role === 'user' ? profile.id : (form.assigneeId || null);

      const { data, error } = await supabase.from('job_sheets').insert({
        registration_number: form.registrationNumber.trim().toUpperCase(),
        customer_name: form.customerName.trim(),
        customer_mobile: form.customerMobile.trim(),
        entry_date_time: form.entryDateTime.toISOString(),
        machine_model: form.getFinalModel(),
        service_location: form.serviceLocation,
        priority: form.priority,
        issues_description: form.issuesDescription.trim() + (descriptionBox ? `\n\nNotes: ${descriptionBox}` : ''),
        status: form.status,
        assigned_to: assignedUser,
        parts_needed: form.partsNeeded,
        parts_used: form.partsUsed,
        photos: urls,
        created_by: profile.id,
      }).select().single();

      if (error) throw error;

      if (Platform.OS === 'web') {
        window.alert('Job Sheet Created.');
        navigateToDashboard(navigation, profile.role);
      } else {
        Alert.alert('Created', 'Job sheet created.', [
          { text: 'View', onPress: () => navigateToJobDetail(navigation, profile.role, data.id) },
          { text: 'Dashboard', onPress: () => navigateToDashboard(navigation, profile.role) },
        ]);
      }
    } catch (error) {
      Alert.alert('Error', error instanceof Error ? error.message : 'Failed.');
    } finally {
      setLoading(false);
    }
  };

  const photoManager: PhotoManager = {
    uris: photos,
    onRemove: (i) => setPhotos(photos.filter((_, idx) => idx !== i)),
    onTake: () => form.openCamera((uri) => setPhotos(prev => [...prev, uri])),
    onPick: () => form.openGallery((uri) => setPhotos(prev => [...prev, uri])),
  };

  const content = (
    <JobSheetFormFields
      headerTitle="Create Job Sheet"
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
      assigneeLabel={profile?.role === 'user' ? `Assigned To: ${profile.full_name || profile.username} (You)` : undefined}
      assigneePicker={profile?.role === 'admin'}
      assigneeValue={form.assigneeId}
      onAssigneeChange={form.setAssigneeId}
      technicians={form.technicians.map(t => ({ id: t.id, name: t.full_name || t.username }))}
      descriptionBox={descriptionBox}
      onDescriptionBoxChange={setDescriptionBox}
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
      renderSubmit={() => (
        <TouchableOpacity style={[styles.submitButton, loading && styles.disabledButton]} onPress={handleSubmit} disabled={loading}>
          {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.submitButtonText}>Submit Job Sheet</Text>}
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
  submitButton: { backgroundColor: '#1a1a2e', padding: 16, borderRadius: 8, alignItems: 'center', marginTop: 20 },
  disabledButton: { opacity: 0.7 },
  submitButtonText: { color: '#FFD700', fontWeight: 'bold', fontSize: 18 },
});

const stylesSafe = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#1a1a2e' },
});
