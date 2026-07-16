import React, { useState, useEffect, useRef, memo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  Modal,
  Animated,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  TouchableWithoutFeedback,
  Keyboard,
  Alert
} from 'react-native';
import { supabase } from '../services/supabase';
import { JobSheet } from '../types';
import { STATUS_OPTIONS } from '../utils/constants';

interface QuickStatusModalProps {
  visible: boolean;
  jobSheet: JobSheet | null;
  onClose: () => void;
  onStatusUpdate: (jobSheetId: string, newStatus: string) => void;
}

export const QuickStatusModal: React.FC<QuickStatusModalProps> = memo(({
  visible,
  jobSheet,
  onClose,
  onStatusUpdate
}) => {
  const [selectedStatus, setSelectedStatus] = useState<string>('');
  const [noteText, setNoteText] = useState('');
  const [loading, setLoading] = useState(false);
  
  const translateY = useRef(new Animated.Value(500)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible && jobSheet) {
      setSelectedStatus(jobSheet.status);
      setNoteText('');
      
      Animated.parallel([
        Animated.timing(translateY, {
          toValue: 0,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        })
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(translateY, {
          toValue: 500,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.timing(fadeAnim, {
          toValue: 0,
          duration: 300,
          useNativeDriver: true,
        })
      ]).start();
    }
  }, [visible, jobSheet]);

  const handleUpdate = async () => {
    if (!jobSheet || !selectedStatus) return;

    const executeUpdate = async () => {
      setLoading(true);
      try {
        const updateData: Record<string, unknown> = { status: selectedStatus };
        
        if (selectedStatus === 'Completed') {
          updateData.completed_at = new Date().toISOString();
          updateData.tat_hours = Number(
            ((new Date().getTime() - new Date(jobSheet.entry_date_time).getTime()) / (1000 * 60 * 60)).toFixed(1)
          );
        }

        const { error: updateError } = await supabase
          .from('job_sheets')
          .update(updateData)
          .eq('id', jobSheet.id);

        if (updateError) throw updateError;

        const { error: logError } = await supabase
          .from('job_updates')
          .insert({
            job_sheet_id: jobSheet.id,
            update_note: noteText.trim() || `Status updated to ${selectedStatus}`,
            status_changed_to: selectedStatus,
          });

        if (logError) throw logError;

        onStatusUpdate(jobSheet.id, selectedStatus);
        onClose();
      } catch (error) {
        console.error('Error updating status:', error);
        Alert.alert('Error', 'Failed to update status.');
      } finally {
        setLoading(false);
      }
    };

    if (selectedStatus === 'Completed') {
      Alert.alert(
        'Confirm Completion',
        'This will mark the job as done and calculate TAT. Continue?',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Continue', onPress: executeUpdate }
        ]
      );
    } else {
      executeUpdate();
    }
  };

  if (!jobSheet) return null;

  return (
    <Modal
      transparent
      visible={visible}
      animationType="none"
      onRequestClose={onClose}
    >
      <TouchableWithoutFeedback onPress={onClose}>
        <Animated.View style={[styles.backdrop, { opacity: fadeAnim }]}>
          <TouchableWithoutFeedback onPress={() => Keyboard.dismiss()}>
            <KeyboardAvoidingView 
              behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
              style={styles.keyboardView}
            >
              <Animated.View 
                style={[
                  styles.modalContent,
                  { transform: [{ translateY }] }
                ]}
              >
                <View style={styles.handle} />
                <Text style={styles.title} allowFontScaling={false}>⚡ Quick Update</Text>
                <Text style={styles.subtitle} allowFontScaling={false}>
                  {jobSheet.registration_number}
                </Text>

                <View style={styles.grid}>
                  {STATUS_OPTIONS.map((opt) => {
                    const isSelected = selectedStatus === opt.value;
                    return (
                      <TouchableOpacity
                        key={opt.value}
                        style={[
                          styles.statusButton,
                          { backgroundColor: opt.color, borderColor: isSelected ? '#000' : opt.border },
                          isSelected && styles.statusButtonSelected
                        ]}
                        onPress={() => setSelectedStatus(opt.value)}
                        activeOpacity={0.7}
                      >
                        <Text style={[styles.statusButtonText, { color: opt.text }]} allowFontScaling={false}>
                          {opt.label} {isSelected ? '✓' : ''}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>

                <TextInput
                  style={styles.noteInput}
                  placeholder="Add a note... (optional)"
                  value={noteText}
                  onChangeText={setNoteText}
                  multiline
                  maxLength={200}
                />

                <View style={styles.actions}>
                  <TouchableOpacity 
                    style={styles.cancelBtn} 
                    onPress={onClose}
                    disabled={loading}
                  >
                    <Text style={styles.cancelBtnText} allowFontScaling={false}>Cancel</Text>
                  </TouchableOpacity>
                  
                  <TouchableOpacity 
                    style={[styles.updateBtn, loading && styles.disabledBtn]} 
                    onPress={handleUpdate}
                    disabled={loading}
                  >
                    {loading ? (
                      <ActivityIndicator color="#1a1a2e" size="small" />
                    ) : (
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
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  keyboardView: {
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 24,
    paddingTop: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 5,
  },
  handle: {
    width: 40,
    height: 4,
    backgroundColor: '#ddd',
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 16,
  },
  title: { fontSize: 20, fontWeight: 'bold', color: '#1a1a2e', marginBottom: 4 },
  subtitle: { fontSize: 14, color: '#666', marginBottom: 20 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' },
  statusButton: {
    width: '48%',
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
    marginBottom: 12,
  },
  statusButtonSelected: {
    borderWidth: 2,
  },
  statusButtonText: {
    fontWeight: 'bold',
    fontSize: 14,
  },
  noteInput: {
    backgroundColor: '#f9f9f9',
    borderWidth: 1,
    borderColor: '#eee',
    borderRadius: 8,
    padding: 12,
    height: 80,
    textAlignVertical: 'top',
    marginBottom: 24,
    fontSize: 15,
  },
  actions: { flexDirection: 'row', justifyContent: 'space-between' },
  cancelBtn: {
    flex: 1,
    paddingVertical: 14,
    backgroundColor: '#f0f0f0',
    borderRadius: 8,
    alignItems: 'center',
    marginRight: 8,
  },
  cancelBtnText: { color: '#666', fontWeight: 'bold', fontSize: 16 },
  updateBtn: {
    flex: 1,
    paddingVertical: 14,
    backgroundColor: '#FFD700',
    borderRadius: 8,
    alignItems: 'center',
    marginLeft: 8,
  },
  disabledBtn: { opacity: 0.7 },
  updateBtnText: { color: '#1a1a2e', fontWeight: 'bold', fontSize: 16 },
});
