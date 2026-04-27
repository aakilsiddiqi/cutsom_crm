import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
  ActivityIndicator,
  Image,
  Platform,
} from 'react-native';
import { Picker } from '@react-native-picker/picker';
import DateTimePicker from '@react-native-community/datetimepicker';
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import { useRoute, useNavigation, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { supabase, uploadPhotoFromUri } from '../../services/supabase';
import { JobSheet, JobSheetStatus, UserProfile, PartUsed, RootStackParamList } from '../../types';

type EditRouteProp = RouteProp<RootStackParamList, 'EditJobSheet'>;
type NavigationProp = NativeStackNavigationProp<RootStackParamList, 'EditJobSheet'>;

const MACHINE_MODELS = ['3DX', '3CX', '4CX', 'JS205', 'JS220', '530-110', '535-125', 'Other'];

export const EditJobSheetScreen = () => {
  const route = useRoute<EditRouteProp>();
  const navigation = useNavigation<NavigationProp>();
  const { jobSheetId } = route.params;

  const [initialLoading, setInitialLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [originalJobSheet, setOriginalJobSheet] = useState<JobSheet | null>(null);

  // Form State
  const [registrationNumber, setRegistrationNumber] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [customerMobile, setCustomerMobile] = useState('');
  const [entryDateTime, setEntryDateTime] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [machineModel, setMachineModel] = useState('3DX');
  const [issuesDescription, setIssuesDescription] = useState('');
  const [status, setStatus] = useState<JobSheetStatus>('In Queue');
  const [assigneeId, setAssigneeId] = useState('');
  
  // Job Update Note (for activity log)
  const [updateNote, setUpdateNote] = useState('');

  // Parts State
  const [partsNeeded, setPartsNeeded] = useState<string[]>([]);
  const [newPartNeeded, setNewPartNeeded] = useState('');
  const [partsUsed, setPartsUsed] = useState<PartUsed[]>([]);
  const [newPartUsedName, setNewPartUsedName] = useState('');
  const [newPartUsedQty, setNewPartUsedQty] = useState('1');
  // Edit state for parts used
  const [editingPartIndex, setEditingPartIndex] = useState<number | null>(null);
  const [editingPartName, setEditingPartName] = useState('');
  const [editingPartQty, setEditingPartQty] = useState('1');

  // Photos State
  const [existingPhotos, setExistingPhotos] = useState<string[]>([]);
  const [newPhotos, setNewPhotos] = useState<string[]>([]); // local uris to be uploaded

  const [technicians, setTechnicians] = useState<UserProfile[]>([]);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      // Fetch Techs
      const { data: techData } = await supabase.from('profiles').select('*').eq('role', 'user');
      if (techData) setTechnicians(techData as UserProfile[]);

      // Fetch Job Sheet
      const { data: jobData, error } = await supabase
        .from('job_sheets')
        .select('*')
        .eq('id', jobSheetId)
        .single();
        
      if (error) throw error;
      if (jobData) {
        const job = jobData as JobSheet;
        setOriginalJobSheet(job);
        
        // Pre-fill
        setRegistrationNumber(job.registration_number);
        setCustomerName(job.customer_name || '');
        setCustomerMobile(job.customer_mobile || '');
        setEntryDateTime(new Date(job.entry_date_time));
        setMachineModel(job.machine_model || '3DX');
        setIssuesDescription(job.issues_description || '');
        setStatus(job.status);
        setAssigneeId(job.assigned_to || '');
        setPartsNeeded(job.parts_needed || []);
        setPartsUsed(job.parts_used || []);
        setExistingPhotos(job.photos || []);
      }
    } catch (error) {
      console.error('Error fetching data:', error);
      Alert.alert('Error', 'Could not load job sheet details.');
      navigation.goBack();
    } finally {
      setInitialLoading(false);
    }
  };

  const handleAddPartNeeded = () => {
    if (newPartNeeded.trim()) {
      setPartsNeeded([...partsNeeded, newPartNeeded.trim()]);
      setNewPartNeeded('');
    }
  };

  const handleRemovePartNeeded = (index: number) => {
    setPartsNeeded(partsNeeded.filter((_, i) => i !== index));
  };

  const handleAddPartUsed = () => {
    if (newPartUsedName.trim() && parseInt(newPartUsedQty) > 0) {
      setPartsUsed([...partsUsed, { name: newPartUsedName.trim(), quantity: parseInt(newPartUsedQty) }]);
      setNewPartUsedName('');
      setNewPartUsedQty('1');
    }
  };

  const handleRemovePartUsed = (index: number) => {
    setPartsUsed(partsUsed.filter((_, i) => i !== index));
  };

  const handleEditPartUsed = (index: number) => {
    setEditingPartIndex(index);
    setEditingPartName(partsUsed[index].name);
    setEditingPartQty(String(partsUsed[index].quantity));
  };

  const handleSaveEditPartUsed = () => {
    if (editingPartIndex === null) return;
    if (!editingPartName.trim() || parseInt(editingPartQty) < 1) {
      Alert.alert('Invalid', 'Please enter a valid name and quantity.');
      return;
    }
    const updated = [...partsUsed];
    updated[editingPartIndex] = { name: editingPartName.trim(), quantity: parseInt(editingPartQty) };
    setPartsUsed(updated);
    setEditingPartIndex(null);
    setEditingPartName('');
    setEditingPartQty('1');
  };

  const compressAndAddImage = async (uri: string) => {
    try {
      const manipResult = await ImageManipulator.manipulateAsync(
        uri,
        [{ resize: { width: 800 } }],
        { compress: 0.5, format: ImageManipulator.SaveFormat.JPEG }
      );
      setNewPhotos(prev => [...prev, manipResult.uri]);
    } catch (error) {
      console.error('Image compression error:', error);
    }
  };

  const openGallery = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission Denied', 'Camera roll permissions required.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      quality: 1,
    });

    if (!result.canceled && result.assets && result.assets.length > 0) {
      compressAndAddImage(result.assets[0].uri);
    }
  };

  const openCamera = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission Denied', 'Camera permissions required.');
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      quality: 1,
    });

    if (!result.canceled && result.assets && result.assets.length > 0) {
      compressAndAddImage(result.assets[0].uri);
    }
  };

  const removeExistingPhoto = (index: number) => {
    setExistingPhotos(existingPhotos.filter((_, i) => i !== index));
  };

  const removeNewPhoto = (index: number) => {
    setNewPhotos(newPhotos.filter((_, i) => i !== index));
  };

  const uploadNewImages = async (): Promise<string[]> => {
    const uploadedUrls: string[] = [];
    for (let i = 0; i < newPhotos.length; i++) {
      const uri = newPhotos[i];
      const filePath = `jobs/${Date.now()}_${i}.jpg`;
      try {
        const publicUrl = await uploadPhotoFromUri(filePath, uri);
        uploadedUrls.push(publicUrl);
      } catch (error) {
        console.error('Upload error:', error);
        throw new Error(`Failed to upload new image ${i + 1}`);
      }
    }
    return uploadedUrls;
  };

  const handleSave = async () => {
    if (!registrationNumber.trim() || !customerName.trim() || !customerMobile.trim()) {
      Alert.alert('Validation Error', 'Registration, Name, and Mobile are required.');
      return;
    }

    setSaving(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      // Upload new photos and combine with existing
      const uploadedUrls = await uploadNewImages();
      const finalPhotos = [...existingPhotos, ...uploadedUrls];

      // Prepare Update Payload
      let updatePayload: any = {
        registration_number: registrationNumber.trim().toUpperCase(),
        customer_name: customerName.trim(),
        customer_mobile: customerMobile.trim(),
        entry_date_time: entryDateTime.toISOString(),
        machine_model: machineModel,
        issues_description: issuesDescription.trim(),
        status,
        assigned_to: assigneeId || null,
        parts_needed: partsNeeded,
        parts_used: partsUsed,
        photos: finalPhotos,
      };

      // Handle Completion & TAT
      let statusChangedTo = null;
      if (originalJobSheet && originalJobSheet.status !== status) {
        statusChangedTo = status;
        if (status === 'Completed') {
          const completedAt = new Date().toISOString();
          const entryTime = new Date(entryDateTime).getTime();
          const completeTime = new Date().getTime();
          const tatHours = Number(((completeTime - entryTime) / (1000 * 60 * 60)).toFixed(1));
          
          updatePayload.completed_at = completedAt;
          updatePayload.tat_hours = tatHours;
        } else {
          // If changed back from completed to something else, clear TAT (optional, but logical)
          updatePayload.completed_at = null;
          updatePayload.tat_hours = null;
        }
      }

      // Update Job Sheet
      const { error: updateError } = await supabase
        .from('job_sheets')
        .update(updatePayload)
        .eq('id', jobSheetId);

      if (updateError) throw updateError;

      // Insert Job Update Log
      const { error: logError } = await supabase
        .from('job_updates')
        .insert({
          job_sheet_id: jobSheetId,
          updated_by: user.id,
          update_note: updateNote.trim() || null,
          status_changed_to: statusChangedTo
        });

      if (logError) throw logError;

      Alert.alert('Success', 'Job Sheet updated successfully!', [
        { text: 'OK', onPress: () => navigation.goBack() }
      ]);

    } catch (error: any) {
      console.error('Save error:', error);
      Alert.alert('Error', error.message || 'Failed to update job sheet.');
    } finally {
      setSaving(false);
    }
  };

  if (initialLoading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#FFD700" />
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.contentContainer}>
      <Text style={styles.screenTitle}>Edit Job Sheet - {originalJobSheet?.registration_number}</Text>

      {/* Basic Info */}
      <View style={styles.inputGroup}>
        <Text style={styles.label}>Machine Registration *</Text>
        <TextInput
          style={styles.input}
          value={registrationNumber}
          onChangeText={setRegistrationNumber}
          autoCapitalize="characters"
        />
      </View>

      <View style={styles.inputGroup}>
        <Text style={styles.label}>Customer Name *</Text>
        <TextInput
          style={styles.input}
          value={customerName}
          onChangeText={setCustomerName}
        />
      </View>

      <View style={styles.inputGroup}>
        <Text style={styles.label}>Customer Mobile *</Text>
        <TextInput
          style={styles.input}
          value={customerMobile}
          onChangeText={setCustomerMobile}
          keyboardType="phone-pad"
        />
      </View>

      <View style={styles.inputGroup}>
        <Text style={styles.label}>Entry Date & Time</Text>
        {Platform.OS === 'web' ? (
          <input
            type="datetime-local"
            value={new Date(entryDateTime.getTime() - entryDateTime.getTimezoneOffset() * 60000).toISOString().slice(0, 16)}
            onChange={(e) => {
              if (e.target.value) {
                setEntryDateTime(new Date(e.target.value));
              }
            }}
            style={{
              padding: '12px',
              borderRadius: '8px',
              border: '1px solid #ddd',
              fontSize: '16px',
              width: '100%',
              backgroundColor: '#fff',
              boxSizing: 'border-box'
            }}
          />
        ) : (
          <>
            <View style={styles.row}>
              <TouchableOpacity style={styles.dateButton} onPress={() => setShowDatePicker(true)}>
                <Text>{entryDateTime.toLocaleDateString()}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.dateButton} onPress={() => setShowTimePicker(true)}>
                <Text>{entryDateTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</Text>
              </TouchableOpacity>
            </View>
            {showDatePicker && (
              <DateTimePicker
                value={entryDateTime}
                mode="date"
                display="default"
                onChange={(_, date) => { setShowDatePicker(false); if(date) setEntryDateTime(date); }}
              />
            )}
            {showTimePicker && (
              <DateTimePicker
                value={entryDateTime}
                mode="time"
                display="default"
                onChange={(_, date) => { setShowTimePicker(false); if(date) setEntryDateTime(date); }}
              />
            )}
          </>
        )}
      </View>

      <View style={styles.inputGroup}>
        <Text style={styles.label}>Machine Model</Text>
        <View style={styles.pickerContainer}>
          <Picker selectedValue={machineModel} onValueChange={setMachineModel}>
            {MACHINE_MODELS.map(m => <Picker.Item key={m} label={m} value={m} />)}
          </Picker>
        </View>
      </View>

      <View style={styles.inputGroup}>
        <Text style={styles.label}>Assign to Technician</Text>
        <View style={styles.pickerContainer}>
          <Picker selectedValue={assigneeId} onValueChange={setAssigneeId}>
            <Picker.Item label="-- Select Technician --" value="" />
            {technicians.map(t => (
              <Picker.Item key={t.id} label={t.full_name || t.username} value={t.id} />
            ))}
          </Picker>
        </View>
      </View>

      <View style={styles.inputGroup}>
        <Text style={styles.label}>Issues Description</Text>
        <TextInput
          style={[styles.input, styles.textArea]}
          value={issuesDescription}
          onChangeText={setIssuesDescription}
          multiline
        />
      </View>

      {/* Parts Needed */}
      <View style={styles.inputGroup}>
        <Text style={styles.label}>Parts Needed</Text>
        <View style={styles.row}>
          <TextInput
            style={[styles.input, { flex: 1, marginBottom: 0 }]}
            placeholder="Add part..."
            value={newPartNeeded}
            onChangeText={setNewPartNeeded}
          />
          <TouchableOpacity style={styles.addButton} onPress={handleAddPartNeeded}>
            <Text style={styles.addButtonText}>Add</Text>
          </TouchableOpacity>
        </View>
        <View style={styles.tagsContainer}>
          {partsNeeded.map((part, index) => (
            <TouchableOpacity key={index} style={styles.tag} onPress={() => handleRemovePartNeeded(index)}>
              <Text style={styles.tagText}>{part} ✕</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* Parts Used */}
      <View style={styles.inputGroup}>
        <Text style={styles.label}>Parts Used (During Service)</Text>
        <View style={styles.row}>
          <TextInput
            style={[styles.input, { flex: 2, marginBottom: 0 }]}
            placeholder="Part name..."
            value={newPartUsedName}
            onChangeText={setNewPartUsedName}
          />
          <TextInput
            style={[styles.input, { flex: 1, marginBottom: 0, marginLeft: 10 }]}
            value={newPartUsedQty}
            onChangeText={setNewPartUsedQty}
            keyboardType="number-pad"
          />
          <TouchableOpacity style={styles.addButton} onPress={handleAddPartUsed}>
            <Text style={styles.addButtonText}>Add</Text>
          </TouchableOpacity>
        </View>
        <View style={styles.listContainer}>
          {partsUsed.map((part, index) => (
            <View key={index} style={styles.listItem}>
              {editingPartIndex === index ? (
                <View style={{ flex: 1 }}>
                  <View style={styles.row}>
                    <TextInput
                      style={[styles.input, { flex: 2, marginBottom: 6 }]}
                      value={editingPartName}
                      onChangeText={setEditingPartName}
                      placeholder="Part name"
                    />
                    <TextInput
                      style={[styles.input, { flex: 1, marginBottom: 6, marginLeft: 8 }]}
                      value={editingPartQty}
                      onChangeText={setEditingPartQty}
                      keyboardType="number-pad"
                    />
                  </View>
                  <View style={styles.row}>
                    <TouchableOpacity style={[styles.addButton, { flex: 1, alignItems: 'center', marginLeft: 0 }]} onPress={handleSaveEditPartUsed}>
                      <Text style={styles.addButtonText}>✓ Save</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={[styles.addButton, { flex: 1, alignItems: 'center', backgroundColor: '#666' }]} onPress={() => setEditingPartIndex(null)}>
                      <Text style={styles.addButtonText}>✕ Cancel</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ) : (
                <>
                  <Text style={styles.listText}>{part.name} (Qty: {part.quantity})</Text>
                  <View style={styles.row}>
                    <TouchableOpacity onPress={() => handleEditPartUsed(index)} style={{ marginRight: 12 }}>
                      <Text style={styles.editText}>Edit</Text>
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => handleRemovePartUsed(index)}>
                      <Text style={styles.removeText}>Remove</Text>
                    </TouchableOpacity>
                  </View>
                </>
              )}
            </View>
          ))}
        </View>
      </View>

      {/* Photos */}
      <View style={styles.inputGroup}>
        <Text style={styles.label}>Photos</Text>
        <View style={styles.row}>
          <TouchableOpacity style={[styles.photoButton, { flex: 1, marginRight: 5 }]} onPress={openCamera}>
            <Text style={styles.photoButtonText}>📷 Camera</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.photoButton, { flex: 1, marginLeft: 5 }]} onPress={openGallery}>
            <Text style={styles.photoButtonText}>🖼️ Gallery</Text>
          </TouchableOpacity>
        </View>
        <ScrollView horizontal style={styles.photosScroll}>
          {existingPhotos.map((url, index) => (
            <View key={`old-${index}`} style={styles.photoWrapper}>
              <Image source={{ uri: url }} style={styles.photo} />
              <TouchableOpacity style={styles.removePhotoBtn} onPress={() => removeExistingPhoto(index)}>
                <Text style={styles.removePhotoText}>✕</Text>
              </TouchableOpacity>
            </View>
          ))}
          {newPhotos.map((uri, index) => (
            <View key={`new-${index}`} style={styles.photoWrapper}>
              <Image source={{ uri }} style={styles.photo} />
              <TouchableOpacity style={styles.removePhotoBtn} onPress={() => removeNewPhoto(index)}>
                <Text style={styles.removePhotoText}>✕</Text>
              </TouchableOpacity>
            </View>
          ))}
        </ScrollView>
      </View>

      {/* Status & Update Log Section */}
      <View style={styles.statusUpdateBox}>
        <Text style={styles.updateTitle}>Update Status</Text>
        <View style={styles.pickerContainer}>
          <Picker selectedValue={status} onValueChange={(val) => setStatus(val as JobSheetStatus)}>
            <Picker.Item label="In Queue" value="In Queue" />
            <Picker.Item label="In Progress" value="In Progress" />
            <Picker.Item label="Completed" value="Completed" />
            <Picker.Item label="On Hold" value="On Hold" />
          </Picker>
        </View>
        
        <Text style={[styles.label, { marginTop: 16 }]}>Update Note (Activity Log)</Text>
        <TextInput
          style={[styles.input, styles.textArea]}
          placeholder="E.g., Waiting for spare parts..."
          value={updateNote}
          onChangeText={setUpdateNote}
          multiline
        />
      </View>

      {/* Submit */}
      <TouchableOpacity 
        style={[styles.submitButton, saving && styles.disabledButton]} 
        onPress={handleSave}
        disabled={saving}
      >
        {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.submitButtonText}>Save Changes</Text>}
      </TouchableOpacity>
      
      <View style={{ height: 40 }} />
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  centerContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  contentContainer: { padding: 16 },
  screenTitle: { fontSize: 22, fontWeight: 'bold', marginBottom: 20, color: '#333' },
  inputGroup: { marginBottom: 16 },
  label: { fontSize: 14, fontWeight: '600', color: '#555', marginBottom: 8 },
  input: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#ddd', borderRadius: 8, padding: 12, fontSize: 16 },
  textArea: { height: 100, textAlignVertical: 'top' },
  row: { flexDirection: 'row', alignItems: 'center' },
  dateButton: { flex: 1, backgroundColor: '#fff', borderWidth: 1, borderColor: '#ddd', borderRadius: 8, padding: 12, marginRight: 10, alignItems: 'center' },
  pickerContainer: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#ddd', borderRadius: 8, overflow: 'hidden' },
  addButton: { backgroundColor: '#000', paddingHorizontal: 20, paddingVertical: 14, borderRadius: 8, marginLeft: 10 },
  addButtonText: { color: '#ffcc00', fontWeight: 'bold' },
  tagsContainer: { flexDirection: 'row', flexWrap: 'wrap', marginTop: 10 },
  tag: { backgroundColor: '#ffcc00', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16, marginRight: 8, marginBottom: 8 },
  tagText: { color: '#000', fontSize: 14, fontWeight: '500' },
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
  statusUpdateBox: { backgroundColor: '#e9ecef', padding: 16, borderRadius: 8, marginTop: 10, marginBottom: 20 },
  updateTitle: { fontSize: 16, fontWeight: 'bold', color: '#333', marginBottom: 10 },
  submitButton: { backgroundColor: '#007bff', padding: 16, borderRadius: 8, alignItems: 'center' },
  disabledButton: { opacity: 0.7 },
  submitButtonText: { color: '#fff', fontWeight: 'bold', fontSize: 18 },
});
