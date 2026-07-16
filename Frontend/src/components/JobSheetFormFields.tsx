import React from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ScrollView, Image, Platform, KeyboardAvoidingView
} from 'react-native';
import { Picker } from '@react-native-picker/picker';
import DateTimePicker from '@react-native-community/datetimepicker';
import { JobSheetStatus } from '../types';
import { STANDARD_MODELS } from '../utils/constants';

export type PhotoManager = {
  uris: string[];
  onRemove: (index: number) => void;
  onTake: () => void;
  onPick: () => void;
};

type Props = {
  headerTitle: string;
  onBack: () => void;
  registrationNumber: string;
  onRegistrationNumberChange: (v: string) => void;
  customerName: string;
  onCustomerNameChange: (v: string) => void;
  customerMobile: string;
  onCustomerMobileChange: (v: string) => void;
  entryDateTime: Date;
  onEntryDateTimeChange: (v: Date) => void;
  showDatePicker: boolean;
  onShowDatePickerChange: (v: boolean) => void;
  showTimePicker: boolean;
  onShowTimePickerChange: (v: boolean) => void;
  selectedModel: string;
  isCustomModel: boolean;
  customModelText: string;
  onModelChange: (v: string) => void;
  onCustomModelTextChange: (v: string) => void;
  onIsCustomModelChange: (v: boolean) => void;
  serviceLocation: 'Workshop' | 'On-Site';
  onServiceLocationChange: (v: 'Workshop' | 'On-Site') => void;
  priority: 'Normal' | 'Urgent';
  onPriorityChange: (v: 'Normal' | 'Urgent') => void;
  issuesDescription: string;
  onIssuesDescriptionChange: (v: string) => void;
  status: JobSheetStatus;
  onStatusChange: (v: JobSheetStatus) => void;
  statusPicker?: boolean;
  assigneeLabel?: string;
  assigneePicker?: boolean;
  assigneeValue: string;
  onAssigneeChange: (v: string) => void;
  technicians: { id: string; name: string }[];
  descriptionBox?: string;
  onDescriptionBoxChange?: (v: string) => void;
  partsNeeded: string[];
  newPartNeeded: string;
  onNewPartNeededChange: (v: string) => void;
  onAddPartNeeded: () => void;
  onRemovePartNeeded: (i: number) => void;
  partsUsed: { name: string; quantity: number }[];
  newPartUsedName: string;
  onNewPartUsedNameChange: (v: string) => void;
  newPartUsedQty: string;
  onNewPartUsedQtyChange: (v: string) => void;
  onAddPartUsed: () => void;
  onRemovePartUsed: (i: number) => void;
  editingPartIndex: number | null;
  editingPartName: string;
  onEditingPartNameChange: (v: string) => void;
  editingPartQty: string;
  onEditingPartQtyChange: (v: string) => void;
  onEditPartUsed: (i: number) => void;
  onSaveEditPartUsed: () => void;
  onCancelEditPartUsed: () => void;
  photos: PhotoManager;
  extraSection?: React.ReactNode;
  renderSubmit: () => React.ReactNode;
};

export const JobSheetFormFields = (p: Props) => {
  const content = (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <ScrollView style={styles.container} contentContainerStyle={styles.contentContainer} keyboardShouldPersistTaps="handled">
        <View style={styles.header}>
          <TouchableOpacity onPress={p.onBack} style={styles.backBtn}>
            <Text style={styles.backBtnText}>← Back</Text>
          </TouchableOpacity>
          <Text style={styles.screenTitle} allowFontScaling={false}>{p.headerTitle}</Text>
          <View style={{ width: 60 }} />
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.label} allowFontScaling={false}>Machine Registration *</Text>
          <TextInput style={styles.input} placeholder="e.g. MH 12 AB 1234" value={p.registrationNumber} onChangeText={p.onRegistrationNumberChange} autoCapitalize="characters" />
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.label} allowFontScaling={false}>Customer Name *</Text>
          <TextInput style={styles.input} placeholder="e.g. Rahul Sharma" value={p.customerName} onChangeText={p.onCustomerNameChange} />
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.label} allowFontScaling={false}>Customer Mobile *</Text>
          <TextInput style={styles.input} placeholder="10-digit mobile number" value={p.customerMobile} onChangeText={p.onCustomerMobileChange} keyboardType="phone-pad" maxLength={15} />
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.label} allowFontScaling={false}>Entry Date & Time</Text>
          {Platform.OS === 'web' ? (
            <input type="datetime-local" value={new Date(p.entryDateTime.getTime() - p.entryDateTime.getTimezoneOffset() * 60000).toISOString().slice(0, 16)} onChange={(e) => { if (e.target.value) p.onEntryDateTimeChange(new Date(e.target.value)); }} style={{ padding: '12px', borderRadius: '8px', border: '1px solid #ddd', fontSize: '16px', width: '100%', backgroundColor: '#fff', boxSizing: 'border-box' }} />
          ) : (
            <>
              <View style={styles.row}>
                <TouchableOpacity style={styles.dateButton} onPress={() => p.onShowDatePickerChange(true)}>
                  <Text allowFontScaling={false}>{p.entryDateTime.toLocaleDateString()}</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.dateButton} onPress={() => p.onShowTimePickerChange(true)}>
                  <Text allowFontScaling={false}>{p.entryDateTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</Text>
                </TouchableOpacity>
              </View>
              {p.showDatePicker && (
                <DateTimePicker value={p.entryDateTime} mode="date" display="default" onChange={(_, date) => { p.onShowDatePickerChange(false); if (date) p.onEntryDateTimeChange(date); }} />
              )}
              {p.showTimePicker && (
                <DateTimePicker value={p.entryDateTime} mode="time" display="default" onChange={(_, date) => { p.onShowTimePickerChange(false); if (date) p.onEntryDateTimeChange(date); }} />
              )}
            </>
          )}
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.label} allowFontScaling={false}>Machine Model</Text>
          {!p.isCustomModel ? (
            <View style={styles.pickerContainer}>
              <Picker selectedValue={p.selectedModel} onValueChange={p.onModelChange}>
                {[...STANDARD_MODELS, 'Other'].map(m => <Picker.Item key={m} label={m} value={m} />)}
              </Picker>
            </View>
          ) : (
            <View>
              <TextInput style={styles.input} placeholder="Enter machine model manually" value={p.customModelText} onChangeText={p.onCustomModelTextChange} />
              <TouchableOpacity onPress={() => p.onIsCustomModelChange(false)} style={styles.changeModelBtn}>
                <Text style={styles.changeModelText}>← Change Model</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.label} allowFontScaling={false}>Service Location</Text>
          <View style={styles.row}>
            <TouchableOpacity style={[styles.cardBtn, p.serviceLocation === 'Workshop' && styles.cardBtnSelected]} onPress={() => p.onServiceLocationChange('Workshop')}>
              <Text style={[styles.cardBtnText, p.serviceLocation === 'Workshop' && styles.cardBtnTextSelected]}>🏭 Workshop</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.cardBtn, p.serviceLocation === 'On-Site' && styles.cardBtnSelected, { marginLeft: 12 }]} onPress={() => p.onServiceLocationChange('On-Site')}>
              <Text style={[styles.cardBtnText, p.serviceLocation === 'On-Site' && styles.cardBtnTextSelected]}>📍 On-Site</Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.label} allowFontScaling={false}>Priority</Text>
          <View style={styles.row}>
            <TouchableOpacity style={[styles.priorityBtn, p.priority === 'Normal' && styles.priorityNormalSelected]} onPress={() => p.onPriorityChange('Normal')}>
              <Text style={[styles.priorityBtnText, p.priority === 'Normal' && styles.priorityTextSelected]}>✅ Normal</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.priorityBtn, p.priority === 'Urgent' && styles.priorityUrgentSelected, { marginLeft: 12 }]} onPress={() => p.onPriorityChange('Urgent')}>
              <Text style={[styles.priorityBtnText, p.priority === 'Urgent' && styles.priorityTextSelected]}>⚡ Urgent</Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.label} allowFontScaling={false}>Assign to Technician</Text>
          {p.assigneePicker ? (
            <View style={styles.pickerContainer}>
              <Picker selectedValue={p.assigneeValue} onValueChange={p.onAssigneeChange}>
                <Picker.Item label="-- Select Technician --" value="" />
                {p.technicians.map(t => <Picker.Item key={t.id} label={t.name} value={t.id} />)}
              </Picker>
            </View>
          ) : p.assigneeLabel ? (
            <View style={styles.readOnlyBox}>
              <Text style={styles.readOnlyText} allowFontScaling={false}>{p.assigneeLabel}</Text>
            </View>
          ) : null}
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.label} allowFontScaling={false}>Issues Description</Text>
          <TextInput style={[styles.input, styles.textArea]} placeholder="Describe the problems..." value={p.issuesDescription} onChangeText={p.onIssuesDescriptionChange} multiline textAlignVertical="top" />
        </View>

        {p.descriptionBox !== undefined && (
          <View style={styles.inputGroup}>
            <Text style={styles.label} allowFontScaling={false}>Additional Description/Notes</Text>
            <TextInput style={[styles.input, styles.textArea]} placeholder="Any other notes..." value={p.descriptionBox} onChangeText={(v) => p.onDescriptionBoxChange?.(v)} multiline textAlignVertical="top" />
          </View>
        )}

        <View style={styles.inputGroup}>
          <Text style={styles.label} allowFontScaling={false}>Parts Needed</Text>
          <View style={styles.row}>
            <TextInput style={[styles.input, { flex: 1, marginBottom: 0 }]} placeholder="Add part..." value={p.newPartNeeded} onChangeText={p.onNewPartNeededChange} />
            <TouchableOpacity style={styles.addButton} onPress={p.onAddPartNeeded}>
              <Text style={styles.addButtonText}>Add</Text>
            </TouchableOpacity>
          </View>
          <View style={styles.tagsContainer}>
            {p.partsNeeded.map((part, index) => (
              <TouchableOpacity key={index} style={styles.tag} onPress={() => p.onRemovePartNeeded(index)}>
                <Text style={styles.tagText}>{part} ✕</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.label} allowFontScaling={false}>Parts Used (During Service)</Text>
          <View style={styles.row}>
            <TextInput style={[styles.input, { flex: 2, marginBottom: 0 }]} placeholder="Part name..." value={p.newPartUsedName} onChangeText={p.onNewPartUsedNameChange} />
            <TextInput style={[styles.input, { flex: 1, marginBottom: 0, marginLeft: 10 }]} placeholder="Qty" value={p.newPartUsedQty} onChangeText={p.onNewPartUsedQtyChange} keyboardType="number-pad" />
            <TouchableOpacity style={styles.addButton} onPress={p.onAddPartUsed}>
              <Text style={styles.addButtonText}>Add</Text>
            </TouchableOpacity>
          </View>
          <View style={styles.listContainer}>
            {p.partsUsed.map((part, index) => (
              <View key={index} style={styles.listItem}>
                {p.editingPartIndex === index ? (
                  <View style={{ flex: 1 }}>
                    <View style={styles.row}>
                      <TextInput style={[styles.input, { flex: 2, marginBottom: 6 }]} value={p.editingPartName} onChangeText={p.onEditingPartNameChange} placeholder="Part name" />
                      <TextInput style={[styles.input, { flex: 1, marginBottom: 6, marginLeft: 8 }]} value={p.editingPartQty} onChangeText={p.onEditingPartQtyChange} keyboardType="number-pad" />
                    </View>
                    <View style={styles.row}>
                      <TouchableOpacity style={[styles.addButton, { flex: 1, alignItems: 'center', marginLeft: 0 }]} onPress={p.onSaveEditPartUsed}><Text style={styles.addButtonText}>✓ Save</Text></TouchableOpacity>
                      <TouchableOpacity style={[styles.addButton, { flex: 1, alignItems: 'center', backgroundColor: '#666' }]} onPress={p.onCancelEditPartUsed}><Text style={styles.addButtonText}>✕ Cancel</Text></TouchableOpacity>
                    </View>
                  </View>
                ) : (
                  <>
                    <Text style={styles.listText}>{part.name} (Qty: {part.quantity})</Text>
                    <View style={styles.row}>
                      <TouchableOpacity onPress={() => p.onEditPartUsed(index)} style={{ marginRight: 12 }}><Text style={styles.editText}>Edit</Text></TouchableOpacity>
                      <TouchableOpacity onPress={() => p.onRemovePartUsed(index)}><Text style={styles.removeText}>Remove</Text></TouchableOpacity>
                    </View>
                  </>
                )}
              </View>
            ))}
          </View>
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.label} allowFontScaling={false}>Machine Photos</Text>
          <View style={styles.row}>
            <TouchableOpacity style={[styles.photoButton, { flex: 1, marginRight: 5 }]} onPress={p.photos.onTake}><Text style={styles.photoButtonText}>📷 Camera</Text></TouchableOpacity>
            <TouchableOpacity style={[styles.photoButton, { flex: 1, marginLeft: 5 }]} onPress={p.photos.onPick}><Text style={styles.photoButtonText}>🖼️ Gallery</Text></TouchableOpacity>
          </View>
          <ScrollView horizontal style={styles.photosScroll}>
            {p.photos.uris.map((uri, index) => (
              <View key={`photo-${index}`} style={styles.photoWrapper}>
                <Image source={{ uri }} style={styles.photo} />
                <TouchableOpacity style={styles.removePhotoBtn} onPress={() => p.photos.onRemove(index)}><Text style={styles.removePhotoText}>✕</Text></TouchableOpacity>
              </View>
            ))}
          </ScrollView>
        </View>

        {p.statusPicker !== false && (
          <View style={styles.inputGroup}>
            <Text style={styles.label} allowFontScaling={false}>Status</Text>
            <View style={styles.pickerContainer}>
              <Picker selectedValue={p.status} onValueChange={(v) => p.onStatusChange(v as JobSheetStatus)}>
                <Picker.Item label="In Queue" value="In Queue" />
                <Picker.Item label="In Progress" value="In Progress" />
                <Picker.Item label="Completed" value="Completed" />
                <Picker.Item label="On Hold" value="On Hold" />
              </Picker>
            </View>
          </View>
        )}

        {p.extraSection}
        {p.renderSubmit()}
      </ScrollView>
    </KeyboardAvoidingView>
  );

  return content;
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  contentContainer: { padding: 16, paddingBottom: 100 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 },
  backBtn: { padding: 8, backgroundColor: '#1a1a2e', borderRadius: 8 },
  backBtnText: { color: '#fff', fontSize: 14, fontWeight: 'bold' },
  screenTitle: { fontSize: 20, fontWeight: 'bold', color: '#1a1a2e' },
  inputGroup: { marginBottom: 16 },
  label: { fontSize: 14, fontWeight: '600', color: '#555', marginBottom: 8 },
  input: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#ddd', borderRadius: 8, padding: 12, fontSize: 16 },
  textArea: { height: 100 },
  row: { flexDirection: 'row', alignItems: 'center' },
  dateButton: { flex: 1, backgroundColor: '#fff', borderWidth: 1, borderColor: '#ddd', borderRadius: 8, padding: 12, marginRight: 10, alignItems: 'center' },
  pickerContainer: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#ddd', borderRadius: 8, overflow: 'hidden' },
  changeModelBtn: { marginTop: 8 },
  changeModelText: { color: '#007bff', fontSize: 14, fontWeight: '600' },
  cardBtn: { flex: 1, backgroundColor: '#fff', borderWidth: 1, borderColor: '#ccc', borderRadius: 8, paddingVertical: 14, alignItems: 'center' },
  cardBtnSelected: { backgroundColor: '#FFD700', borderColor: '#1a1a2e', borderWidth: 2 },
  cardBtnText: { color: '#888', fontWeight: 'bold', fontSize: 15 },
  cardBtnTextSelected: { color: '#1a1a2e' },
  priorityBtn: { flex: 1, backgroundColor: '#fff', borderWidth: 1, borderColor: '#ccc', borderRadius: 8, paddingVertical: 14, alignItems: 'center' },
  priorityNormalSelected: { backgroundColor: '#28a745', borderColor: '#28a745', borderWidth: 2 },
  priorityUrgentSelected: { backgroundColor: '#FF4444', borderColor: '#FF4444', borderWidth: 2 },
  priorityBtnText: { color: '#888', fontWeight: 'bold', fontSize: 15 },
  priorityTextSelected: { color: '#fff' },
  readOnlyBox: { backgroundColor: '#e9ecef', padding: 14, borderRadius: 8, borderWidth: 1, borderColor: '#ced4da' },
  readOnlyText: { color: '#495057', fontSize: 15, fontWeight: '500' },
  addButton: { backgroundColor: '#1a1a2e', paddingHorizontal: 20, paddingVertical: 14, borderRadius: 8, marginLeft: 10 },
  addButtonText: { color: '#FFD700', fontWeight: 'bold' },
  tagsContainer: { flexDirection: 'row', flexWrap: 'wrap', marginTop: 10 },
  tag: { backgroundColor: '#FFD700', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16, marginRight: 8, marginBottom: 8 },
  tagText: { color: '#1a1a2e', fontSize: 14, fontWeight: '500' },
  listContainer: { marginTop: 10 },
  listItem: { flexDirection: 'row', justifyContent: 'space-between', backgroundColor: '#fff', padding: 12, borderBottomWidth: 1, borderBottomColor: '#eee' },
  listText: { fontSize: 16 },
  removeText: { color: '#e74c3c', fontWeight: 'bold' },
  editText: { color: '#007bff', fontWeight: 'bold' },
  photoButton: { borderWidth: 2, borderColor: '#ddd', borderStyle: 'dashed', borderRadius: 8, padding: 15, alignItems: 'center', marginBottom: 10, backgroundColor: '#fafafa' },
  photoButtonText: { color: '#555', fontWeight: '600' },
  photosScroll: { flexDirection: 'row' },
  photoWrapper: { marginRight: 10, position: 'relative' },
  photo: { width: 100, height: 100, borderRadius: 8 },
  removePhotoBtn: { position: 'absolute', top: -5, right: -5, backgroundColor: 'red', width: 24, height: 24, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  removePhotoText: { color: '#fff', fontWeight: 'bold', fontSize: 12 },
});
