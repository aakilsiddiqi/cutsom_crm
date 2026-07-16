import { useState } from 'react';
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import { supabase, uploadPhotoFromUri } from '../services/supabase';
import { UserProfile, JobSheetStatus, PartUsed } from '../types';

export function useJobSheetForm() {
  const [registrationNumber, setRegistrationNumber] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [customerMobile, setCustomerMobile] = useState('');
  const [entryDateTime, setEntryDateTime] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [selectedModel, setSelectedModel] = useState('3DX');
  const [isCustomModel, setIsCustomModel] = useState(false);
  const [customModelText, setCustomModelText] = useState('');
  const [serviceLocation, setServiceLocation] = useState<'Workshop' | 'On-Site'>('Workshop');
  const [priority, setPriority] = useState<'Normal' | 'Urgent'>('Normal');
  const [issuesDescription, setIssuesDescription] = useState('');
  const [status, setStatus] = useState<JobSheetStatus>('In Queue');
  const [assigneeId, setAssigneeId] = useState('');
  const [partsNeeded, setPartsNeeded] = useState<string[]>([]);
  const [newPartNeeded, setNewPartNeeded] = useState('');
  const [partsUsed, setPartsUsed] = useState<PartUsed[]>([]);
  const [newPartUsedName, setNewPartUsedName] = useState('');
  const [newPartUsedQty, setNewPartUsedQty] = useState('1');
  const [editingPartIndex, setEditingPartIndex] = useState<number | null>(null);
  const [editingPartName, setEditingPartName] = useState('');
  const [editingPartQty, setEditingPartQty] = useState('1');
  const [technicians, setTechnicians] = useState<UserProfile[]>([]);

  const fetchTechnicians = async () => {
    const { data } = await supabase
      .from('profiles').select('*').eq('role', 'user').eq('is_active', true);
    if (data) setTechnicians(data as UserProfile[]);
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

  const handleAddPartNeeded = () => {
    if (newPartNeeded.trim()) {
      setPartsNeeded([...partsNeeded, newPartNeeded.trim()]);
      setNewPartNeeded('');
    }
  };

  const handleRemovePartNeeded = (index: number) =>
    setPartsNeeded(partsNeeded.filter((_, i) => i !== index));

  const handleAddPartUsed = () => {
    if (newPartUsedName.trim() && parseInt(newPartUsedQty) > 0) {
      setPartsUsed([...partsUsed, { name: newPartUsedName.trim(), quantity: parseInt(newPartUsedQty) }]);
      setNewPartUsedName('');
      setNewPartUsedQty('1');
    }
  };

  const handleRemovePartUsed = (index: number) =>
    setPartsUsed(partsUsed.filter((_, i) => i !== index));

  const handleEditPartUsed = (index: number) => {
    setEditingPartIndex(index);
    setEditingPartName(partsUsed[index].name);
    setEditingPartQty(String(partsUsed[index].quantity));
  };

  const handleSaveEditPartUsed = () => {
    if (editingPartIndex === null) return;
    if (!editingPartName.trim() || parseInt(editingPartQty) < 1) {
      throw new Error('Invalid part');
    }
    const updated = [...partsUsed];
    updated[editingPartIndex] = { name: editingPartName.trim(), quantity: parseInt(editingPartQty) };
    setPartsUsed(updated);
    setEditingPartIndex(null);
  };

  const compressAndAddImage = async (uri: string, onAdd: (uri: string) => void) => {
    try {
      const manipResult = await ImageManipulator.manipulateAsync(
        uri, [{ resize: { width: 800 } }], { compress: 0.5, format: ImageManipulator.SaveFormat.JPEG }
      );
      onAdd(manipResult.uri);
    } catch { /* skip silently */ }
  };

  const openGallery = async (onAdd: (uri: string) => void) => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') return;
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images, allowsEditing: true, quality: 1
    });
    if (!result.canceled && result.assets) compressAndAddImage(result.assets[0].uri, onAdd);
  };

  const openCamera = async (onAdd: (uri: string) => void) => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') return;
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images, allowsEditing: true, quality: 1
    });
    if (!result.canceled && result.assets) compressAndAddImage(result.assets[0].uri, onAdd);
  };

  const getFinalModel = () => isCustomModel ? customModelText.trim() : selectedModel;

  const resetForm = () => {
    setRegistrationNumber('');
    setCustomerName('');
    setCustomerMobile('');
    setEntryDateTime(new Date());
    setSelectedModel('3DX');
    setIsCustomModel(false);
    setCustomModelText('');
    setServiceLocation('Workshop');
    setPriority('Normal');
    setIssuesDescription('');
    setStatus('In Queue');
    setAssigneeId('');
    setPartsNeeded([]);
    setNewPartNeeded('');
    setPartsUsed([]);
    setNewPartUsedName('');
    setNewPartUsedQty('1');
    setEditingPartIndex(null);
    setEditingPartName('');
    setEditingPartQty('');
  };

  return {
    registrationNumber, setRegistrationNumber,
    customerName, setCustomerName,
    customerMobile, setCustomerMobile,
    entryDateTime, setEntryDateTime,
    showDatePicker, setShowDatePicker,
    showTimePicker, setShowTimePicker,
    selectedModel, setSelectedModel,
    isCustomModel, setIsCustomModel,
    customModelText, setCustomModelText,
    serviceLocation, setServiceLocation,
    priority, setPriority,
    issuesDescription, setIssuesDescription,
    status, setStatus,
    assigneeId, setAssigneeId,
    partsNeeded, setPartsNeeded,
    newPartNeeded, setNewPartNeeded,
    partsUsed, setPartsUsed,
    newPartUsedName, setNewPartUsedName,
    newPartUsedQty, setNewPartUsedQty,
    editingPartIndex, setEditingPartIndex,
    editingPartName, setEditingPartName,
    editingPartQty, setEditingPartQty,
    technicians, setTechnicians,
    fetchTechnicians,
    handleModelChange,
    handleAddPartNeeded, handleRemovePartNeeded,
    handleAddPartUsed, handleRemovePartUsed,
    handleEditPartUsed, handleSaveEditPartUsed,
    compressAndAddImage,
    openGallery, openCamera,
    getFinalModel,
    resetForm,
    uploadPhotos: async (photos: string[]): Promise<string[]> => {
      const ts = Date.now();
      return Promise.all(
        photos.map((photo, i) => uploadPhotoFromUri(`jobs/${ts}_${i}.jpg`, photo))
      );
    },
  };
}
