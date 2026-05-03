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
  KeyboardAvoidingView,
  TouchableWithoutFeedback,
  Keyboard
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Picker } from '@react-native-picker/picker';
import DateTimePicker from '@react-native-community/datetimepicker';
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import { useNavigation } from '@react-navigation/native';
import { supabase, uploadPhotoFromUri } from '../../services/supabase';
import { JobSheet, JobSheetStatus, UserProfile, PartUsed } from '../../types';
import { JobSheetCard } from '../../components/JobSheetCard';
import { useAuth } from '../../context/AuthContext';

const STANDARD_MODELS = ['3DX', '3CX', '4CX', 'JS205', 'JS220', '530-110', '535-125'];

export const CreateJobSheetScreen = () => {
  const navigation = useNavigation<any>();
  const { profile } = useAuth();

  // Form State
  const [registrationNumber, setRegistrationNumber] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [customerMobile, setCustomerMobile] = useState('');
  const [entryDateTime, setEntryDateTime] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  
  // Model State
  const [selectedModel, setSelectedModel] = useState('3DX');
  const [isCustomModel, setIsCustomModel] = useState(false);
  const [customModelText, setCustomModelText] = useState('');

  // Location & Priority
  const [serviceLocation, setServiceLocation] = useState<'Workshop' | 'On-Site'>('Workshop');
  const [priority, setPriority] = useState<'Normal' | 'Urgent'>('Normal');

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
  const [editingPartIndex, setEditingPartIndex] = useState<number | null>(null);
  const [editingPartName, setEditingPartName] = useState('');
  const [editingPartQty, setEditingPartQty] = useState('1');

  // Photos State
  const [photos, setPhotos] = useState<string[]>([]);

  // Other State
  const [technicians, setTechnicians] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (profile?.role === 'admin') {
      fetchTechnicians();
    }
  }, [profile]);

  const fetchTechnicians = async () => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('role', 'user')
        .eq('is_active', true);
      
      if (error) throw error;
      if (data) {
        setTechnicians(data as UserProfile[]);
      }
    } catch (error) {
      console.error('Error fetching technicians:', error);
    }
  };

  const handleModelChange = (value: string) => {
    if (value === 'Other') {
      setIsCustomModel(true);
      setSelectedModel('Other');
    } else {
      setIsCustomModel(false);
      setSelectedModel(value);
      setCustomModelText('');
    }
  };

  // Rest of part & photo handlers remain mostly identical
  const handleAddPartNeeded = () => {
    if (newPartNeeded.trim()) {
      setPartsNeeded([...partsNeeded, newPartNeeded.trim()]);
      setNewPartNeeded('');
    }
  };
  const handleRemovePartNeeded = (index: number) => setPartsNeeded(partsNeeded.filter((_, i) => i !== index));
  const handleAddPartUsed = () => {
    if (newPartUsedName.trim() && parseInt(newPartUsedQty) > 0) {
      setPartsUsed([...partsUsed, { name: newPartUsedName.trim(), quantity: parseInt(newPartUsedQty) }]);
      setNewPartUsedName('');
      setNewPartUsedQty('1');
    }
  };
  const handleRemovePartUsed = (index: number) => setPartsUsed(partsUsed.filter((_, i) => i !== index));
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
  };
  const compressAndAddImage = async (uri: string) => {
    try {
      const manipResult = await ImageManipulator.manipulateAsync(
        uri, [{ resize: { width: 800 } }], { compress: 0.5, format: ImageManipulator.SaveFormat.JPEG }
      );
      setPhotos(prev => [...prev, manipResult.uri]);
    } catch (error) {
      console.error('Error compressing image:', error);
    }
  };
  const openGallery = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') return Alert.alert('Permission Denied', 'Gallery permissions required.');
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, allowsEditing: true, quality: 1 });
    if (!result.canceled && result.assets) compressAndAddImage(result.assets[0].uri);
  };
  const openCamera = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') return Alert.alert('Permission Denied', 'Camera permissions required.');
    const result = await ImagePicker.launchCameraAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, allowsEditing: true, quality: 1 });
    if (!result.canceled && result.assets) compressAndAddImage(result.assets[0].uri);
  };
  const removeImage = (index: number) => setPhotos(photos.filter((_, i) => i !== index));
  const uploadImages = async (): Promise<string[]> => {
    const uploadedUrls: string[] = [];
    for (let i = 0; i < photos.length; i++) {
      const uri = photos[i];
      const filePath = `jobs/${Date.now()}_${i}.jpg`;
      const publicUrl = await uploadPhotoFromUri(filePath, uri);
      uploadedUrls.push(publicUrl);
    }
    return uploadedUrls;
  };

  const handleSubmit = async () => {
    if (!registrationNumber.trim() || !customerName.trim() || !customerMobile.trim()) {
      return Alert.alert('Validation Error', 'Please fill in all required fields (Registration, Name, Mobile).');
    }
    if (customerMobile.length < 10) {
      return Alert.alert('Validation Error', 'Please enter a valid mobile number.');
    }
    if (isCustomModel && !customModelText.trim()) {
      return Alert.alert('Validation Error', 'Please enter the machine model.');
    }

    setLoading(true);
    try {
      if (!profile) throw new Error('Not authenticated');

      const uploadedPhotoUrls = await uploadImages();
      const finalModel = isCustomModel ? customModelText.trim() : selectedModel;
      
      const assignedUser = profile.role === 'user' ? profile.id : (assigneeId || null);

      const newJobSheet = {
        registration_number: registrationNumber.trim().toUpperCase(),
        customer_name: customerName.trim(),
        customer_mobile: customerMobile.trim(),
        entry_date_time: entryDateTime.toISOString(),
        machine_model: finalModel,
        service_location: serviceLocation,
        priority: priority,
        issues_description: issuesDescription.trim() + (descriptionBox ? `\n\nNotes: ${descriptionBox}` : ''),
        status,
        assigned_to: assignedUser,
        parts_needed: partsNeeded,
        parts_used: partsUsed,
        photos: uploadedPhotoUrls,
        created_by: profile.id,
      };

      const { error } = await supabase.from('job_sheets').insert(newJobSheet);
      if (error) throw error;

      Alert.alert(
        '✅ Job Sheet Created',
        'New job sheet has been created successfully.',
        [{
          text: 'OK',
          onPress: () => {
            if (profile.role === 'admin') {
              navigation.navigate('AdminTabs');
            } else {
              navigation.navigate('UserDashboard');
            }
          }
        }]
      );

    } catch (error: any) {
      console.error('Submit error:', error);
      Alert.alert('Error', error.message || 'Failed to create job sheet.');
    } finally {
      setLoading(false);
    }
  };

  const content = (
    <KeyboardAvoidingView 
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView 
        style={styles.container} 
        contentContainerStyle={styles.contentContainer}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
            <View style={styles.header}>
              <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
                <Text style={styles.backBtnText}>← Back</Text>
              </TouchableOpacity>
              <Text style={styles.screenTitle} allowFontScaling={false}>Create Job Sheet</Text>
              <View style={{ width: 60 }} />
            </View>

            {/* Required Fields */}
            <View style={styles.inputGroup}>
              <Text style={styles.label} allowFontScaling={false}>Machine Registration *</Text>
              <TextInput
                style={styles.input}
                placeholder="e.g. MH 12 AB 1234"
                value={registrationNumber}
                onChangeText={setRegistrationNumber}
                autoCapitalize="characters"
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label} allowFontScaling={false}>Customer Name *</Text>
              <TextInput
                style={styles.input}
                placeholder="e.g. Rahul Sharma"
                value={customerName}
                onChangeText={setCustomerName}
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label} allowFontScaling={false}>Customer Mobile *</Text>
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
              <Text style={styles.label} allowFontScaling={false}>Entry Date & Time</Text>
              {Platform.OS === 'web' ? (
                <input
                  type="datetime-local"
                  value={new Date(entryDateTime.getTime() - entryDateTime.getTimezoneOffset() * 60000).toISOString().slice(0, 16)}
                  onChange={(e) => {
                    if (e.target.value) setEntryDateTime(new Date(e.target.value));
                  }}
                  style={{
                    padding: '12px', borderRadius: '8px', border: '1px solid #ddd',
                    fontSize: '16px', width: '100%', backgroundColor: '#fff', boxSizing: 'border-box'
                  }}
                />
              ) : (
                <>
                  <View style={styles.row}>
                    <TouchableOpacity style={styles.dateButton} onPress={() => setShowDatePicker(true)}>
                      <Text allowFontScaling={false}>{entryDateTime.toLocaleDateString()}</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.dateButton} onPress={() => setShowTimePicker(true)}>
                      <Text allowFontScaling={false}>{entryDateTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</Text>
                    </TouchableOpacity>
                  </View>
                  {showDatePicker && (
                    <DateTimePicker
                      value={entryDateTime}
                      mode="date"
                      display="default"
                      onChange={(event, date) => { setShowDatePicker(false); if (date) setEntryDateTime(date); }}
                    />
                  )}
                  {showTimePicker && (
                    <DateTimePicker
                      value={entryDateTime}
                      mode="time"
                      display="default"
                      onChange={(event, date) => { setShowTimePicker(false); if (date) setEntryDateTime(date); }}
                    />
                  )}
                </>
              )}
            </View>

            {/* Machine Model */}
            <View style={styles.inputGroup}>
              <Text style={styles.label} allowFontScaling={false}>Machine Model</Text>
              {!isCustomModel ? (
                <View style={styles.pickerContainer}>
                  <Picker
                    selectedValue={selectedModel}
                    onValueChange={handleModelChange}
                  >
                    {[...STANDARD_MODELS, 'Other'].map((model) => (
                      <Picker.Item key={model} label={model} value={model} />
                    ))}
                  </Picker>
                </View>
              ) : (
                <View>
                  <TextInput
                    style={styles.input}
                    placeholder="Enter machine model manually"
                    value={customModelText}
                    onChangeText={setCustomModelText}
                  />
                  <TouchableOpacity onPress={() => setIsCustomModel(false)} style={styles.changeModelBtn}>
                    <Text style={styles.changeModelText}>← Change Model</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>

            {/* Service Location */}
            <View style={styles.inputGroup}>
              <Text style={styles.label} allowFontScaling={false}>Service Location</Text>
              <View style={styles.row}>
                <TouchableOpacity 
                  style={[styles.cardBtn, serviceLocation === 'Workshop' && styles.cardBtnSelected]}
                  onPress={() => setServiceLocation('Workshop')}
                >
                  <Text style={[styles.cardBtnText, serviceLocation === 'Workshop' && styles.cardBtnTextSelected]}>🏭 Workshop</Text>
                </TouchableOpacity>
                <TouchableOpacity 
                  style={[styles.cardBtn, serviceLocation === 'On-Site' && styles.cardBtnSelected, { marginLeft: 12 }]}
                  onPress={() => setServiceLocation('On-Site')}
                >
                  <Text style={[styles.cardBtnText, serviceLocation === 'On-Site' && styles.cardBtnTextSelected]}>📍 On-Site</Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* Priority */}
            <View style={styles.inputGroup}>
              <Text style={styles.label} allowFontScaling={false}>Priority</Text>
              <View style={styles.row}>
                <TouchableOpacity 
                  style={[styles.priorityBtn, priority === 'Normal' && styles.priorityNormalSelected]}
                  onPress={() => setPriority('Normal')}
                >
                  <Text style={[styles.priorityBtnText, priority === 'Normal' && styles.priorityTextSelected]}>✅ Normal</Text>
                </TouchableOpacity>
                <TouchableOpacity 
                  style={[styles.priorityBtn, priority === 'Urgent' && styles.priorityUrgentSelected, { marginLeft: 12 }]}
                  onPress={() => setPriority('Urgent')}
                >
                  <Text style={[styles.priorityBtnText, priority === 'Urgent' && styles.priorityTextSelected]}>⚡ Urgent</Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* Status */}
            <View style={styles.inputGroup}>
              <Text style={styles.label} allowFontScaling={false}>Status</Text>
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

            {/* Assignee */}
            <View style={styles.inputGroup}>
              <Text style={styles.label} allowFontScaling={false}>Assign to Technician</Text>
              {profile?.role === 'user' ? (
                <View style={styles.readOnlyBox}>
                  <Text style={styles.readOnlyText} allowFontScaling={false}>
                    👤 Assigned To: {profile.full_name || profile.username} (You)
                  </Text>
                </View>
              ) : (
                <View style={styles.pickerContainer}>
                  <Picker
                    selectedValue={assigneeId}
                    onValueChange={(itemValue) => setAssigneeId(itemValue)}
                  >
                    <Picker.Item label="-- Select Technician --" value="" />
                    {technicians.map((tech) => (
                      <Picker.Item key={tech.id} label={tech.full_name || tech.username} value={tech.id} />
                    ))}
                  </Picker>
                </View>
              )}
            </View>

            {/* Issues */}
            <View style={styles.inputGroup}>
              <Text style={styles.label} allowFontScaling={false}>Issues in Machine</Text>
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
              <Text style={styles.label} allowFontScaling={false}>Additional Description/Notes</Text>
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
              <Text style={styles.label} allowFontScaling={false}>Parts Needed</Text>
              <View style={styles.row}>
                <TextInput style={[styles.input, { flex: 1, marginBottom: 0 }]} placeholder="Add part..." value={newPartNeeded} onChangeText={setNewPartNeeded} />
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
              <Text style={styles.label} allowFontScaling={false}>Parts Used (During Service)</Text>
              <View style={styles.row}>
                <TextInput style={[styles.input, { flex: 2, marginBottom: 0 }]} placeholder="Part name..." value={newPartUsedName} onChangeText={setNewPartUsedName} />
                <TextInput style={[styles.input, { flex: 1, marginBottom: 0, marginLeft: 10 }]} placeholder="Qty" value={newPartUsedQty} onChangeText={setNewPartUsedQty} keyboardType="number-pad" />
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
                          <TextInput style={[styles.input, { flex: 2, marginBottom: 6 }]} value={editingPartName} onChangeText={setEditingPartName} />
                          <TextInput style={[styles.input, { flex: 1, marginBottom: 6, marginLeft: 8 }]} value={editingPartQty} onChangeText={setEditingPartQty} keyboardType="number-pad" />
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
              <Text style={styles.label} allowFontScaling={false}>Machine Photos</Text>
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
                <Text style={styles.submitButtonText} allowFontScaling={false}>Submit Job Sheet</Text>
              )}
            </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
      {Platform.OS === 'web' ? content : (
        <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
          {content}
        </TouchableWithoutFeedback>
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#1a1a2e' },
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  contentContainer: { padding: 20, paddingBottom: 100 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 },
  backBtn: { padding: 8, backgroundColor: '#1a1a2e', borderRadius: 8 },
  backBtnText: { color: '#fff', fontSize: 14, fontWeight: 'bold' },
  screenTitle: { fontSize: 22, fontWeight: 'bold', color: '#1a1a2e' },
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
  tagText: { color: '#1a1a2e', fontSize: 14, fontWeight: '600' },
  listContainer: { marginTop: 10 },
  listItem: { flexDirection: 'row', justifyContent: 'space-between', backgroundColor: '#fff', padding: 12, borderBottomWidth: 1, borderBottomColor: '#eee' },
  listText: { fontSize: 16, color: '#333' },
  removeText: { color: '#e74c3c', fontWeight: 'bold' },
  editText: { color: '#007bff', fontWeight: 'bold' },
  photoButton: { borderWidth: 2, borderColor: '#ddd', borderStyle: 'dashed', borderRadius: 8, padding: 15, alignItems: 'center', marginBottom: 10, backgroundColor: '#fafafa' },
  photoButtonText: { color: '#555', fontWeight: '600' },
  photosScroll: { flexDirection: 'row' },
  photoWrapper: { marginRight: 10, position: 'relative' },
  photo: { width: 100, height: 100, borderRadius: 8 },
  removePhotoBtn: { position: 'absolute', top: -5, right: -5, backgroundColor: '#e74c3c', width: 24, height: 24, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  removePhotoText: { color: '#fff', fontWeight: 'bold', fontSize: 12 },
  submitButton: { backgroundColor: '#1a1a2e', padding: 16, borderRadius: 8, alignItems: 'center', marginTop: 20 },
  disabledButton: { opacity: 0.7 },
  submitButtonText: { color: '#FFD700', fontWeight: 'bold', fontSize: 18 },
});
