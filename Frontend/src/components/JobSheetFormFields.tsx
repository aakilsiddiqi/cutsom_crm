import React from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ScrollView, Image, Platform, KeyboardAvoidingView,
} from 'react-native';
import { Picker } from '@react-native-picker/picker';
import DateTimePicker from '@react-native-community/datetimepicker';
import { JobSheetStatus } from '../types';
import { STANDARD_MODELS } from '../utils/constants';
import { colors, spacing, radius, typography } from '../theme/tokens';
import { Icon } from './ui/Icon';
import { HeaderBar } from './ui/HeaderBar';

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

const FormInput = ({ label, value, onChange, placeholder, keyboardType, autoCap, maxLen, multiline }: {
  label: string; value: string; onChange: (v: string) => void; placeholder?: string;
  keyboardType?: 'phone-pad' | 'number-pad' | 'email-address'; autoCap?: 'characters' | 'none';
  maxLen?: number; multiline?: boolean;
}) => (
  <View style={styles.fieldGroup}>
    <Text style={styles.fieldLabel} allowFontScaling={false}>{label}</Text>
    <TextInput
      style={[styles.input, multiline && styles.textArea]}
      placeholder={placeholder}
      placeholderTextColor={colors.textTertiary}
      value={value}
      onChangeText={onChange}
      keyboardType={keyboardType}
      autoCapitalize={autoCap}
      autoCorrect={false}
      maxLength={maxLen}
      multiline={multiline}
      textAlignVertical={multiline ? 'top' : 'center'}
    />
  </View>
);

export const JobSheetFormFields = (p: Props) => {
  const content = (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <HeaderBar title={p.headerTitle} onBack={p.onBack} />
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={styles.card}>
          <FormInput label="Machine Registration *" value={p.registrationNumber} onChange={p.onRegistrationNumberChange} placeholder="e.g. MH 12 AB 1234" autoCap="characters" />
          <FormInput label="Customer Name *" value={p.customerName} onChange={p.onCustomerNameChange} placeholder="e.g. Rahul Sharma" />
          <FormInput label="Customer Mobile *" value={p.customerMobile} onChange={p.onCustomerMobileChange} placeholder="10-digit mobile number" keyboardType="phone-pad" maxLen={15} />

          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel} allowFontScaling={false}>Entry Date & Time</Text>
            {Platform.OS === 'web' ? (
              <input
                type="datetime-local"
                value={new Date(p.entryDateTime.getTime() - p.entryDateTime.getTimezoneOffset() * 60000).toISOString().slice(0, 16)}
                onChange={(e) => { if (e.target.value) p.onEntryDateTimeChange(new Date(e.target.value)); }}
                style={{ padding: '12px', borderRadius: '8px', border: `1px solid ${colors.border}`, fontSize: '16px', width: '100%', backgroundColor: colors.surface, boxSizing: 'border-box', color: colors.textPrimary }}
              />
            ) : (
              <>
                <View style={styles.row}>
                  <TouchableOpacity style={styles.dateBtn} onPress={() => p.onShowDatePickerChange(true)}>
                    <Icon name="calendar-outline" size={18} color={colors.textSecondary} />
                    <Text style={styles.dateBtnText} allowFontScaling={false}>{p.entryDateTime.toLocaleDateString()}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.dateBtn} onPress={() => p.onShowTimePickerChange(true)}>
                    <Icon name="time-outline" size={18} color={colors.textSecondary} />
                    <Text style={styles.dateBtnText} allowFontScaling={false}>{p.entryDateTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</Text>
                  </TouchableOpacity>
                </View>
                {p.showDatePicker && (
                  <DateTimePicker value={p.entryDateTime} mode="date" display="default" onChange={(_, d) => { p.onShowDatePickerChange(false); if (d) p.onEntryDateTimeChange(d); }} />
                )}
                {p.showTimePicker && (
                  <DateTimePicker value={p.entryDateTime} mode="time" display="default" onChange={(_, d) => { p.onShowTimePickerChange(false); if (d) p.onEntryDateTimeChange(d); }} />
                )}
              </>
            )}
          </View>

          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel} allowFontScaling={false}>Machine Model</Text>
            {!p.isCustomModel ? (
              <View style={styles.pickerWrap}>
                <Picker selectedValue={p.selectedModel} onValueChange={p.onModelChange}>
                  {[...STANDARD_MODELS, 'Other'].map(m => <Picker.Item key={m} label={m} value={m} />)}
                </Picker>
              </View>
            ) : (
              <View>
                <TextInput style={styles.input} placeholder="Enter model manually" placeholderTextColor={colors.textTertiary} value={p.customModelText} onChangeText={p.onCustomModelTextChange} />
                <TouchableOpacity onPress={() => p.onIsCustomModelChange(false)} style={styles.inlineLink}>
                  <Icon name="arrow-back-outline" size={14} color={colors.info} />
                  <Text style={styles.inlineLinkText} allowFontScaling={false}>Change Model</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>

          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel} allowFontScaling={false}>Service Location</Text>
            <View style={styles.row}>
              <TouchableOpacity style={[styles.toggleBtn, p.serviceLocation === 'Workshop' && styles.toggleActive]} onPress={() => p.onServiceLocationChange('Workshop')}>
                <Icon name="business-outline" size={18} color={p.serviceLocation === 'Workshop' ? colors.headerBg : colors.textSecondary} />
                <Text style={[styles.toggleText, p.serviceLocation === 'Workshop' && styles.toggleTextActive]} allowFontScaling={false}>Workshop</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.toggleBtn, p.serviceLocation === 'On-Site' && styles.toggleActive]} onPress={() => p.onServiceLocationChange('On-Site')}>
                <Icon name="location-outline" size={18} color={p.serviceLocation === 'On-Site' ? colors.headerBg : colors.textSecondary} />
                <Text style={[styles.toggleText, p.serviceLocation === 'On-Site' && styles.toggleTextActive]} allowFontScaling={false}>On-Site</Text>
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel} allowFontScaling={false}>Priority</Text>
            <View style={styles.row}>
              <TouchableOpacity style={[styles.toggleBtn, p.priority === 'Normal' && { backgroundColor: colors.successBg, borderColor: colors.success }]} onPress={() => p.onPriorityChange('Normal')}>
                <Icon name="checkmark-outline" size={18} color={p.priority === 'Normal' ? colors.success : colors.textSecondary} />
                <Text style={[styles.toggleText, p.priority === 'Normal' && { color: colors.success, fontWeight: '700' }]} allowFontScaling={false}>Normal</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.toggleBtn, p.priority === 'Urgent' && { backgroundColor: colors.errorBg, borderColor: colors.error }]} onPress={() => p.onPriorityChange('Urgent')}>
                <Icon name="flash-outline" size={18} color={p.priority === 'Urgent' ? colors.error : colors.textSecondary} />
                <Text style={[styles.toggleText, p.priority === 'Urgent' && { color: colors.error, fontWeight: '700' }]} allowFontScaling={false}>Urgent</Text>
              </TouchableOpacity>
            </View>
          </View>

          {p.assigneeLabel && (
            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel} allowFontScaling={false}>Assigned To</Text>
              <View style={styles.readOnly}>
                <Text style={styles.readOnlyText} allowFontScaling={false}>{p.assigneeLabel}</Text>
              </View>
            </View>
          )}

          {p.assigneePicker && (
            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel} allowFontScaling={false}>Assign to Technician</Text>
              <View style={styles.pickerWrap}>
                <Picker selectedValue={p.assigneeValue} onValueChange={p.onAssigneeChange}>
                  <Picker.Item label="-- Select Technician --" value="" />
                  {p.technicians.map(t => <Picker.Item key={t.id} label={t.name} value={t.id} />)}
                </Picker>
              </View>
            </View>
          )}

          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel} allowFontScaling={false}>Issues Description</Text>
            <TextInput style={[styles.input, styles.textArea]} placeholder="Describe the problems..." placeholderTextColor={colors.textTertiary} value={p.issuesDescription} onChangeText={p.onIssuesDescriptionChange} multiline textAlignVertical="top" />
          </View>

          {p.descriptionBox !== undefined && (
            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel} allowFontScaling={false}>Additional Notes</Text>
              <TextInput style={[styles.input, styles.textArea]} placeholder="Any other notes..." placeholderTextColor={colors.textTertiary} value={p.descriptionBox} onChangeText={(v) => p.onDescriptionBoxChange?.(v)} multiline textAlignVertical="top" />
            </View>
          )}
        </View>

        <View style={styles.card}>
          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel} allowFontScaling={false}>Parts Needed</Text>
            <View style={styles.row}>
              <TextInput style={[styles.input, { flex: 1, marginBottom: 0 }]} placeholder="Add part..." placeholderTextColor={colors.textTertiary} value={p.newPartNeeded} onChangeText={p.onNewPartNeededChange} />
              <TouchableOpacity style={styles.addBtn} onPress={p.onAddPartNeeded}>
                <Icon name="add-outline" size={18} color={colors.accent} />
              </TouchableOpacity>
            </View>
            <View style={styles.tagsRow}>
              {p.partsNeeded.map((part, i) => (
                <TouchableOpacity key={i} style={styles.tag} onPress={() => p.onRemovePartNeeded(i)}>
                  <Text style={styles.tagText} allowFontScaling={false}>{part}</Text>
                  <Icon name="close-outline" size={14} color={colors.headerBg} />
                </TouchableOpacity>
              ))}
            </View>
          </View>

          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel} allowFontScaling={false}>Parts Used (During Service)</Text>
            <View style={styles.row}>
              <TextInput style={[styles.input, { flex: 2, marginBottom: 0 }]} placeholder="Part name..." placeholderTextColor={colors.textTertiary} value={p.newPartUsedName} onChangeText={p.onNewPartUsedNameChange} />
              <TextInput style={[styles.input, { flex: 1, marginBottom: 0, marginHorizontal: spacing.sm }]} placeholder="Qty" placeholderTextColor={colors.textTertiary} value={p.newPartUsedQty} onChangeText={p.onNewPartUsedQtyChange} keyboardType="number-pad" />
              <TouchableOpacity style={styles.addBtn} onPress={p.onAddPartUsed}>
                <Icon name="add-outline" size={18} color={colors.accent} />
              </TouchableOpacity>
            </View>
            {p.partsUsed.map((part, i) => (
              <View key={i} style={styles.partRow}>
                {p.editingPartIndex === i ? (
                  <View style={{ flex: 1 }}>
                    <View style={styles.row}>
                      <TextInput style={[styles.input, { flex: 2, marginBottom: spacing.xs }]} value={p.editingPartName} onChangeText={p.onEditingPartNameChange} placeholder="Part name" placeholderTextColor={colors.textTertiary} />
                      <TextInput style={[styles.input, { flex: 1, marginBottom: spacing.xs, marginLeft: spacing.sm }]} value={p.editingPartQty} onChangeText={p.onEditingPartQtyChange} keyboardType="number-pad" placeholderTextColor={colors.textTertiary} />
                    </View>
                    <View style={styles.row}>
                      <TouchableOpacity style={[styles.actionBtn, { backgroundColor: colors.success, marginRight: spacing.sm }]} onPress={p.onSaveEditPartUsed}>
                        <Icon name="checkmark-outline" size={16} color={colors.textInverse} />
                        <Text style={styles.actionBtnText} allowFontScaling={false}>Save</Text>
                      </TouchableOpacity>
                      <TouchableOpacity style={[styles.actionBtn, { backgroundColor: colors.textTertiary }]} onPress={p.onCancelEditPartUsed}>
                        <Icon name="close-outline" size={16} color={colors.textInverse} />
                        <Text style={styles.actionBtnText} allowFontScaling={false}>Cancel</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                ) : (
                  <View style={styles.partInfo}>
                    <Text style={styles.partText} allowFontScaling={false}>{part.name} (Qty: {part.quantity})</Text>
                    <View style={styles.partActions}>
                      <TouchableOpacity onPress={() => p.onEditPartUsed(i)} style={styles.partActionBtn}>
                        <Icon name="create-outline" size={14} color={colors.info} />
                      </TouchableOpacity>
                      <TouchableOpacity onPress={() => p.onRemovePartUsed(i)} style={styles.partActionBtn}>
                        <Icon name="trash-outline" size={14} color={colors.error} />
                      </TouchableOpacity>
                    </View>
                  </View>
                )}
              </View>
            ))}
          </View>
        </View>

        <View style={styles.card}>
          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel} allowFontScaling={false}>Machine Photos</Text>
            <View style={styles.row}>
              <TouchableOpacity style={[styles.photoBtn, { marginRight: spacing.sm }]} onPress={p.photos.onTake}>
                <Icon name="camera-outline" size={20} color={colors.textSecondary} />
                <Text style={styles.photoBtnText} allowFontScaling={false}>Camera</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.photoBtn} onPress={p.photos.onPick}>
                <Icon name="images-outline" size={20} color={colors.textSecondary} />
                <Text style={styles.photoBtnText} allowFontScaling={false}>Gallery</Text>
              </TouchableOpacity>
            </View>
            <ScrollView horizontal style={styles.photoScroll}>
              {p.photos.uris.map((uri, i) => (
                <View key={i} style={styles.photoWrap}>
                  <Image source={{ uri }} style={styles.photo} />
                  <TouchableOpacity style={styles.photoRemove} onPress={() => p.photos.onRemove(i)}>
                    <Icon name="close-circle" size={22} color={colors.error} />
                  </TouchableOpacity>
                </View>
              ))}
            </ScrollView>
          </View>
        </View>

        {p.statusPicker !== false && (
          <View style={styles.card}>
            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel} allowFontScaling={false}>Status</Text>
              <View style={styles.pickerWrap}>
                <Picker selectedValue={p.status} onValueChange={(v) => p.onStatusChange(v as JobSheetStatus)}>
                  <Picker.Item label="In Queue" value="In Queue" />
                  <Picker.Item label="In Progress" value="In Progress" />
                  <Picker.Item label="Completed" value="Completed" />
                  <Picker.Item label="On Hold" value="On Hold" />
                </Picker>
              </View>
            </View>
          </View>
        )}

        {p.extraSection}
        {p.renderSubmit()}
        <View style={{ height: 60 }} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
  return content;
};

const styles = StyleSheet.create({
  content: { padding: spacing.lg, paddingBottom: 120 },
  card: {
    backgroundColor: colors.surface, borderRadius: radius.lg, padding: spacing.lg,
    marginBottom: spacing.lg, borderWidth: 1, borderColor: colors.border,
  },
  fieldGroup: { marginBottom: spacing.lg },
  fieldLabel: { ...typography.footnote, fontWeight: '600', color: colors.textSecondary, marginBottom: spacing.sm },
  input: {
    backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border,
    borderRadius: radius.md, padding: spacing.md, ...typography.body, color: colors.textPrimary,
  },
  textArea: { minHeight: 100 },
  row: { flexDirection: 'row', alignItems: 'center' },
  dateBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border,
    borderRadius: radius.md, padding: spacing.md, marginRight: spacing.sm, gap: spacing.sm,
  },
  dateBtnText: { ...typography.body, color: colors.textPrimary },
  pickerWrap: {
    backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border,
    borderRadius: radius.md, overflow: 'hidden',
  },
  inlineLink: { flexDirection: 'row', alignItems: 'center', marginTop: spacing.sm, gap: spacing.xs },
  inlineLinkText: { ...typography.subhead, color: colors.info, fontWeight: '600' },
  toggleBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border,
    borderRadius: radius.md, paddingVertical: spacing.md, gap: spacing.sm,
  },
  toggleActive: { backgroundColor: colors.accentLight, borderColor: colors.accent, borderWidth: 2 },
  toggleText: { ...typography.callout, fontWeight: '600', color: colors.textSecondary },
  toggleTextActive: { color: colors.headerBg, fontWeight: '700' },
  readOnly: { backgroundColor: colors.bg, padding: spacing.md, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border },
  readOnlyText: { ...typography.body, color: colors.textSecondary, fontWeight: '500' },
  addBtn: {
    backgroundColor: colors.headerBg, width: 48, height: 48, borderRadius: radius.md,
    alignItems: 'center', justifyContent: 'center', marginLeft: spacing.sm,
  },
  tagsRow: { flexDirection: 'row', flexWrap: 'wrap', marginTop: spacing.sm, gap: spacing.sm },
  tag: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: colors.accentLight,
    paddingHorizontal: spacing.md, paddingVertical: spacing.xs, borderRadius: radius.full,
    borderWidth: 1, borderColor: colors.accent, gap: spacing.xs,
  },
  tagText: { ...typography.subhead, color: colors.headerBg, fontWeight: '500' },
  partRow: {
    backgroundColor: colors.bg, padding: spacing.md, borderRadius: radius.md,
    marginTop: spacing.sm, borderWidth: 1, borderColor: colors.border,
  },
  partInfo: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  partText: { ...typography.subhead, color: colors.textPrimary, flex: 1 },
  partActions: { flexDirection: 'row', gap: spacing.md, marginLeft: spacing.sm },
  partActionBtn: { padding: spacing.xs },
  actionBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    paddingVertical: spacing.sm, paddingHorizontal: spacing.md, borderRadius: radius.sm, gap: spacing.xs,
  },
  actionBtnText: { ...typography.subhead, fontWeight: '600', color: colors.textInverse },
  photoBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    borderWidth: 2, borderColor: colors.border, borderStyle: 'dashed', borderRadius: radius.md,
    padding: spacing.lg, backgroundColor: colors.bg, gap: spacing.sm,
  },
  photoBtnText: { ...typography.subhead, fontWeight: '600', color: colors.textSecondary },
  photoScroll: { marginTop: spacing.md },
  photoWrap: { marginRight: spacing.md, position: 'relative' },
  photo: { width: 100, height: 100, borderRadius: radius.md, backgroundColor: colors.shimmer },
  photoRemove: { position: 'absolute', top: -8, right: -8 },
});
