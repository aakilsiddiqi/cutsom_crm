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
import { supabase, uploadPhotoFromUri } from '../../services/supabase';
import { JobSheet, JobSheetStatus, UserProfile, PartUsed } from '../../types';
import { JobSheetCard } from '../../components/JobSheetCard';

const MACHINE_MODELS = ['3DX', '3CX', '4CX', 'JS205', 'JS220', '530-110', '535-125', 'Other'];

export const CreateJobSheetScreen = () => {
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
  const [descriptionBox, setDescriptionBox] = useState('');

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
  const [photos, setPhotos] = useState<string[]>([]);

  // Other State
  const [technicians, setTechnicians] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(false);
  const [submittedJobSheet, setSubmittedJobSheet] = useState<JobSheet | null>(null);

  useEffect(() => {
    fetchTechnicians();
  }, []);

  const fetchTechnicians = async () => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('role', 'user');
      
      if (error) throw error;
      if (data) {
        setTechnicians(data as UserProfile[]);
        if (data.length > 0) {
          setAssigneeId(data[0].id);
        }
      }
    } catch (error) {
      console.error('Error fetching technicians:', error);
      Alert.alert('Error', 'Could not load technicians');
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
        [{ resize: { width: 800 } }], // Resize width
        { compress: 0.5, format: ImageManipulator.SaveFormat.JPEG } // 50% quality for high compression
      );
      setPhotos(prev => [...prev, manipResult.uri]);
    } catch (error) {
      console.error('Error compressing image:', error);
      Alert.alert('Error', 'Failed to process image');
    }
  };

  const openGallery = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission Denied', 'Gallery permissions required.');
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

  const removeImage = (index: number) => {
    setPhotos(photos.filter((_, i) => i !== index));
  };

  const uploadImages = async (): Promise<string[]> => {
    const uploadedUrls: string[] = [];

    for (let i = 0; i < photos.length; i++) {
      const uri = photos[i];
      const filePath = `jobs/${Date.now()}_${i}.jpg`;

      try {
        const publicUrl = await uploadPhotoFromUri(filePath, uri);
        uploadedUrls.push(publicUrl);
      } catch (error) {
        console.error('Error uploading image:', error);
        throw new Error(`Failed to upload image ${i + 1}`);
      }
    }

    return uploadedUrls;
  };

  const handleSubmit = async () => {
    // Validation
    if (!registrationNumber.trim() || !customerName.trim() || !customerMobile.trim()) {
      Alert.alert('Validation Error', 'Please fill in all required fields (Registration, Name, Mobile).');
      return;
    }

    if (customerMobile.length < 10) {
      Alert.alert('Validation Error', 'Please enter a valid mobile number.');
      return;
    }

    setLoading(true);

    try {
      // Get current user id
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      // 1. Upload Photos
      const uploadedPhotoUrls = await uploadImages();

      // 2. Insert to Database
      const newJobSheet = {
        registration_number: registrationNumber.trim().toUpperCase(),
        customer_name: customerName.trim(),
        customer_mobile: customerMobile.trim(),
        entry_date_time: entryDateTime.toISOString(),
        machine_model: machineModel,
        issues_description: issuesDescription.trim() + (descriptionBox ? `\n\nNotes: ${descriptionBox}` : ''),
        status,
        assigned_to: assigneeId || null,
        parts_needed: partsNeeded,
        parts_used: partsUsed,
        photos: uploadedPhotoUrls,
        created_by: user.id,
      };

      const { data, error } = await supabase
        .from('job_sheets')
        .insert(newJobSheet)
        .select(`
          *,
          assignee:profiles!job_sheets_assigned_to_fkey(*)
        `)
        .single();

      if (error) throw error;

      // Success
      setSubmittedJobSheet(data as JobSheet);
      Alert.alert('Success', 'Job Sheet created successfully!');

    } catch (error: any) {
      console.error('Submit error:', error);
      Alert.alert('Error', error.message || 'Failed to create job sheet.');
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setRegistrationNumber('');
    setCustomerName('');
    setCustomerMobile('');
    setEntryDateTime(new Date());
    setMachineModel('3DX');
    setIssuesDescription('');
    setStatus('In Queue');
    setPartsNeeded([]);
    setPartsUsed([]);
    setPhotos([]);
    setDescriptionBox('');
    setSubmittedJobSheet(null);
  };

  if (submittedJobSheet) {
    return (
      <ScrollView style={styles.container} contentContainerStyle={styles.contentContainer}>
        <Text style={styles.successTitle}>Job Sheet Created!</Text>
        <JobSheetCard jobSheet={submittedJobSheet} />
        <TouchableOpacity style={styles.primaryButton} onPress={resetForm}>
          <Text style={styles.primaryButtonText}>Create Another</Text>
        </TouchableOpacity>
      </ScrollView>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.contentContainer}>
      <Text style={styles.screenTitle}>Create Job Sheet</Text>

      {/* Required Fields */}
      <View style={styles.inputGroup}>
        <Text style={styles.label}>Machine Registration *</Text>
        <TextInput
          style={styles.input}
          placeholder="e.g. MH 12 AB 1234"
          value={registrationNumber}
          onChangeText={setRegistrationNumber}
          autoCapitalize="characters"
        />
      </View>

      <View style={styles.inputGroup}>
        <Text style={styles.label}>Customer Name *</Text>
        <TextInput
          style={styles.input}
          placeholder="e.g. Rahul Sharma"
          value={customerName}
          onChangeText={setCustomerName}
        />
      </View>

      <View style={styles.inputGroup}>
        <Text style={styles.label}>Customer Mobile *</Text>
        <TextInput
          style={styles.input}
          placeholder="10-digit mobile number"
          value={customerMobile}
          onChangeText={setCustomerMobile}
          keyboardType="phone-pad"
          maxLength={15}
        />
      </View>

      {/* Date Time */}
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
                onChange={(event, date) => {
                  setShowDatePicker(false);
                  if (date) setEntryDateTime(date);
                }}
              />
            )}
            {showTimePicker && (
              <DateTimePicker
                value={entryDateTime}
                mode="time"
                display="default"
                onChange={(event, date) => {
                  setShowTimePicker(false);
                  if (date) setEntryDateTime(date);
                }}
              />
            )}
          </>
        )}
      </View>

      {/* Pickers */}
      <View style={styles.inputGroup}>
        <Text style={styles.label}>Machine Model</Text>
        <View style={styles.pickerContainer}>
          <Picker
            selectedValue={machineModel}
            onValueChange={(itemValue) => setMachineModel(itemValue)}
          >
            {MACHINE_MODELS.map((model) => (
              <Picker.Item key={model} label={model} value={model} />
            ))}
          </Picker>
        </View>
      </View>

      <View style={styles.inputGroup}>
        <Text style={styles.label}>Status</Text>
        <View style={styles.pickerContainer}>
          <Picker
            selectedValue={status}
            onValueChange={(itemValue) => setStatus(itemValue as JobSheetStatus)}
          >
            <Picker.Item label="In Queue" value="In Queue" />
            <Picker.Item label="In Progress" value="In Progress" />
            <Picker.Item label="Completed" value="Completed" />
            <Picker.Item label="On Hold" value="On Hold" />
          </Picker>
        </View>
      </View>

      <View style={styles.inputGroup}>
        <Text style={styles.label}>Assign to Technician</Text>
        <View style={styles.pickerContainer}>
          <Picker
            selectedValue={assigneeId}
            onValueChange={(itemValue) => setAssigneeId(itemValue)}
          >
            <Picker.Item label="-- Select Technician --" value="" />
            {technicians.map((tech) => (
              <Picker.Item 
                key={tech.id} 
                label={tech.full_name || tech.username} 
                value={tech.id} 
              />
            ))}
          </Picker>
        </View>
      </View>

      {/* Issues */}
      <View style={styles.inputGroup}>
        <Text style={styles.label}>Issues in Machine</Text>
        <TextInput
          style={[styles.input, styles.textArea]}
          placeholder="Describe the problems..."
          value={issuesDescription}
          onChangeText={setIssuesDescription}
          multiline
          numberOfLines={4}
          textAlignVertical="top"
        />
      </View>

      <View style={styles.inputGroup}>
        <Text style={styles.label}>Additional Description/Notes</Text>
        <TextInput
          style={[styles.input, styles.textArea]}
          placeholder="Any other notes..."
          value={descriptionBox}
          onChangeText={setDescriptionBox}
          multiline
          numberOfLines={3}
          textAlignVertical="top"
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
            placeholder="Qty"
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
                // Inline Edit Mode
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
                // Display Mode
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
        <Text style={styles.label}>Machine Photos</Text>
        <View style={styles.row}>
          <TouchableOpacity style={[styles.photoButton, { flex: 1, marginRight: 5 }]} onPress={openCamera}>
            <Text style={styles.photoButtonText}>📷 Camera</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.photoButton, { flex: 1, marginLeft: 5 }]} onPress={openGallery}>
            <Text style={styles.photoButtonText}>🖼️ Gallery</Text>
          </TouchableOpacity>
        </View>
        <ScrollView horizontal style={styles.photosScroll}>
          {photos.map((photo, index) => (
            <View key={index} style={styles.photoWrapper}>
              <Image source={{ uri: photo }} style={styles.photo} />
              <TouchableOpacity style={styles.removePhotoBtn} onPress={() => removeImage(index)}>
                <Text style={styles.removePhotoText}>✕</Text>
              </TouchableOpacity>
            </View>
          ))}
        </ScrollView>
      </View>

      {/* Submit */}
      <TouchableOpacity 
        style={[styles.submitButton, loading && styles.disabledButton]} 
        onPress={handleSubmit}
        disabled={loading}
      >
        {loading ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.submitButtonText}>Submit Job Sheet</Text>
        )}
      </TouchableOpacity>
      
      <View style={{ height: 40 }} />
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  contentContainer: {
    padding: 20,
  },
  screenTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 20,
    color: '#333',
  },
  successTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#2ecc71',
    textAlign: 'center',
    marginBottom: 20,
    marginTop: 20,
  },
  inputGroup: {
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#555',
    marginBottom: 8,
  },
  input: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
  },
  textArea: {
    height: 100,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  dateButton: {
    flex: 1,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    marginRight: 10,
    alignItems: 'center',
  },
  pickerContainer: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    overflow: 'hidden',
  },
  addButton: {
    backgroundColor: '#000',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderRadius: 8,
    marginLeft: 10,
  },
  addButtonText: {
    color: '#ffcc00',
    fontWeight: 'bold',
  },
  tagsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 10,
  },
  tag: {
    backgroundColor: '#ffcc00',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    marginRight: 8,
    marginBottom: 8,
  },
  tagText: {
    color: '#000',
    fontSize: 14,
    fontWeight: '500',
  },
  listContainer: {
    marginTop: 10,
  },
  listItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: '#fff',
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  listText: {
    fontSize: 16,
  },
  removeText: {
    color: '#e74c3c',
    fontWeight: 'bold',
  },
  editText: {
    color: '#007bff',
    fontWeight: 'bold',
  },
  photoButton: {
    borderWidth: 2,
    borderColor: '#ddd',
    borderStyle: 'dashed',
    borderRadius: 8,
    padding: 15,
    alignItems: 'center',
    marginBottom: 10,
    backgroundColor: '#fafafa',
  },
  photoButtonText: {
    color: '#555',
    fontWeight: '600',
  },
  photosScroll: {
    flexDirection: 'row',
  },
  photoWrapper: {
    marginRight: 10,
    position: 'relative',
  },
  photo: {
    width: 100,
    height: 100,
    borderRadius: 8,
  },
  removePhotoBtn: {
    position: 'absolute',
    top: -5,
    right: -5,
    backgroundColor: 'red',
    width: 24,
    height: 24,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  removePhotoText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 12,
  },
  submitButton: {
    backgroundColor: '#000',
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 20,
  },
  primaryButton: {
    backgroundColor: '#ffcc00',
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 20,
  },
  primaryButtonText: {
    color: '#000',
    fontWeight: 'bold',
    fontSize: 18,
  },
  disabledButton: {
    opacity: 0.7,
  },
  submitButtonText: {
    color: '#ffcc00',
    fontWeight: 'bold',
    fontSize: 18,
  },
});
