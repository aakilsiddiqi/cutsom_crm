import React, { useState, useEffect, useCallback } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  ScrollView, 
  TouchableOpacity, 
  ActivityIndicator,
  Linking,
  Image,
  Modal
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRoute, useNavigation, RouteProp, useFocusEffect } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { supabase } from '../../services/supabase';
import { RootStackParamList, JobSheet, JobUpdate } from '../../types';
import { navigateBack } from '../../utils/navigationUtils';
import { getStatusColors } from '../../utils/constants';
import { formatDate, timeAgo } from '../../utils/formatting';

type DetailRouteProp = RouteProp<RootStackParamList, 'JobSheetDetail'>;
type NavigationProp = NativeStackNavigationProp<RootStackParamList, 'JobSheetDetail'>;

export const JobSheetDetailScreen = () => {
  const route = useRoute<DetailRouteProp>();
  const navigation = useNavigation<NavigationProp>();
  const { jobSheetId } = route.params;

  const [jobSheet, setJobSheet] = useState<JobSheet | null>(null);
  const [jobUpdates, setJobUpdates] = useState<JobUpdate[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Image Viewer State
  const [modalVisible, setModalVisible] = useState(false);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);

  const fetchJobDetails = async (signal: AbortSignal) => {
    try {
      if (!signal.aborted) setLoading(true);
      const { data: jobData, error: jobError } = await supabase
        .from('job_sheets')
        .select(`*, assignee:profiles!job_sheets_assigned_to_fkey(*)`)
        .eq('id', jobSheetId)
        .single();

      if (jobError) throw jobError;
      
      const { data: updatesData, error: updatesError } = await supabase
        .from('job_updates_with_profile')
        .select('*')
        .eq('job_sheet_id', jobSheetId)
        .order('created_at', { ascending: false });

      if (updatesError) throw updatesError;

      if (!signal.aborted) {
        setJobSheet(jobData as JobSheet);
        setJobUpdates(updatesData as JobUpdate[]);
      }
    } catch (error) {
    } finally {
      if (!signal.aborted) setLoading(false);
    }
  };

  useFocusEffect(
    React.useCallback(() => {
      const ac = new AbortController();
      fetchJobDetails(ac.signal);
      return () => ac.abort();
    }, [jobSheetId])
  );

  const handleCall = (phone: string) => {
    Linking.openURL(`tel:${phone}`);
  };

  if (loading || !jobSheet) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#1a1a2e" />
      </View>
    );
  }

  const statusColors = getStatusColors(jobSheet.status);

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigateBack(navigation)} style={styles.backBtn}>
          <Text style={styles.backBtnText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle} allowFontScaling={false}>Job Sheet Details</Text>
        <View style={{ width: 60 }} />
      </View>

      <ScrollView style={styles.container} contentContainerStyle={styles.contentContainer}>
        
        {/* SECTION 1: Header */}
        <View style={styles.headerSection}>
          <Text style={styles.registrationLarge} allowFontScaling={false}>{jobSheet.registration_number}</Text>
          {jobSheet.serial_number && (
            <Text style={styles.serialNumber} allowFontScaling={false}>Serial: {jobSheet.serial_number}</Text>
          )}

          <View style={styles.badgesContainer}>
            <View style={[styles.badge, { backgroundColor: statusColors.bg }]}>
              <Text style={[styles.badgeText, { color: statusColors.text }]} allowFontScaling={false}>{jobSheet.status}</Text>
            </View>
            
            {jobSheet.service_location && (
              <View style={[styles.badge, styles.locationBadge]}>
                <Text style={styles.locationBadgeText} allowFontScaling={false}>
                  {jobSheet.service_location === 'Workshop' ? '🏭 Workshop' : '📍 On-Site'}
                </Text>
              </View>
            )}

            {jobSheet.priority === 'Urgent' && (
              <View style={[styles.badge, styles.urgentBadge]}>
                <Text style={styles.urgentBadgeText} allowFontScaling={false}>⚡ Urgent</Text>
              </View>
            )}
          </View>

          <Text style={styles.dateText} allowFontScaling={false}>{formatDate(jobSheet.entry_date_time)}</Text>

          {jobSheet.admin_instructions && (
            <View style={styles.instructionBox}>
              <Text style={styles.instructionTitle} allowFontScaling={false}>🔔 Admin Instructions</Text>
              <Text style={styles.instructionText}>{jobSheet.admin_instructions}</Text>
            </View>
          )}
        </View>

        {/* SECTION 2: Info */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle} allowFontScaling={false}>Customer & Machine Info</Text>
          <View style={styles.infoCard}>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel} allowFontScaling={false}>Customer</Text>
              <Text style={styles.infoValue}>{jobSheet.customer_name || 'N/A'}</Text>
            </View>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel} allowFontScaling={false}>Mobile</Text>
              {jobSheet.customer_mobile ? (
                <TouchableOpacity onPress={() => handleCall(jobSheet.customer_mobile!)}>
                  <Text style={[styles.infoValue, styles.linkText]}>{jobSheet.customer_mobile}</Text>
                </TouchableOpacity>
              ) : (
                <Text style={styles.infoValue}>N/A</Text>
              )}
            </View>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel} allowFontScaling={false}>Model</Text>
              <Text style={styles.infoValue}>{jobSheet.machine_model || 'N/A'}</Text>
            </View>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel} allowFontScaling={false}>Assigned Tech</Text>
              <Text style={styles.infoValue}>
                {jobSheet.assignee?.full_name || jobSheet.assignee?.username || 'Unassigned'}
              </Text>
            </View>
          </View>
        </View>

        {/* SECTION 3: Issues */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle} allowFontScaling={false}>Issues & Description</Text>
          <View style={styles.infoCard}>
            <Text style={styles.descriptionText}>{jobSheet.issues_description || 'No description provided.'}</Text>
          </View>
        </View>

        {/* SECTION 4: Parts */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle} allowFontScaling={false}>Parts Information</Text>
          <View style={styles.infoCard}>
            <Text style={styles.subTitle} allowFontScaling={false}>Parts Needed:</Text>
            {jobSheet.parts_needed && jobSheet.parts_needed.length > 0 ? (
              jobSheet.parts_needed.map((part, idx) => (
                <Text key={idx} style={styles.listItem}>• {part}</Text>
              ))
            ) : (
              <Text style={styles.emptyListText}>None specified</Text>
            )}
            
            <View style={styles.divider} />

            <Text style={styles.subTitle} allowFontScaling={false}>Parts Used:</Text>
            {jobSheet.parts_used && jobSheet.parts_used.length > 0 ? (
              jobSheet.parts_used.map((part, idx) => (
                <Text key={idx} style={styles.listItem}>• {part.name} (Qty: {part.quantity})</Text>
              ))
            ) : (
              <Text style={styles.emptyListText}>None recorded</Text>
            )}
          </View>
        </View>

        {/* SECTION 5: Photos */}
        {jobSheet.photos && jobSheet.photos.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle} allowFontScaling={false}>Photos</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              {jobSheet.photos.map((photoUrl, idx) => (
                <TouchableOpacity 
                  key={idx} 
                  onPress={() => {
                    setSelectedImage(photoUrl);
                    setModalVisible(true);
                  }}
                >
                  <Image source={{ uri: photoUrl }} style={styles.thumbnail} />
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        )}

        {/* SECTION 6: Activity Log */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle} allowFontScaling={false}>Activity Log</Text>
          {jobUpdates.length > 0 ? (
            jobUpdates.map((update) => (
              <View key={update.id} style={styles.logCard}>
                <View style={styles.logHeader}>
                  <Text style={styles.logUser}>{update.updated_by_name || 'Unknown User'}</Text>
                  <Text style={styles.logTime}>{timeAgo(update.created_at)}</Text>
                </View>
                {update.status_changed_to && (
                  <Text style={styles.logStatusChange}>Status → {update.status_changed_to}</Text>
                )}
                {update.update_note && (
                  <Text style={styles.logNote}>{update.update_note}</Text>
                )}
              </View>
            ))
          ) : (
            <Text style={styles.emptyListText}>No activity recorded yet.</Text>
          )}
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>

      {/* Fixed Bottom Action Buttons */}
      <View style={styles.bottomBar}>
        <TouchableOpacity 
          style={styles.editButton} 
          onPress={() => navigation.navigate('EditJobSheet', { jobSheetId })}
        >
          <Text style={styles.buttonTextWhite} allowFontScaling={false}>Edit Job Sheet</Text>
        </TouchableOpacity>
        
        <TouchableOpacity style={styles.aiButton} onPress={() => {}}>
          <Text style={styles.buttonTextWhite} allowFontScaling={false}>Get AI Help</Text>
        </TouchableOpacity>
      </View>

      {/* Full Screen Image Modal */}
      <Modal
        visible={modalVisible}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setModalVisible(false)}
      >
        <SafeAreaView style={styles.modalContainer}>
          <TouchableOpacity 
            style={styles.closeButton} 
            onPress={() => setModalVisible(false)}
          >
            <Text style={styles.closeButtonText} allowFontScaling={false}>✕ Close</Text>
          </TouchableOpacity>
          {selectedImage && (
            <Image 
              source={{ uri: selectedImage }} 
              style={styles.fullScreenImage} 
              resizeMode="contain" 
            />
          )}
        </SafeAreaView>
      </Modal>

    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#1a1a2e',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    backgroundColor: '#1a1a2e',
  },
  backBtn: {
    padding: 8,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 8,
  },
  backBtnText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: 'bold',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#FFD700',
  },
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  contentContainer: {
    padding: 16,
    paddingBottom: 100, // Space for bottom bar
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerSection: {
    marginBottom: 20,
  },
  registrationLarge: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#1a1a2e',
  },
  serialNumber: {
    fontSize: 14,
    color: '#666',
    marginBottom: 12,
  },
  badgesContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 10,
    alignItems: 'center',
  },
  badge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    marginRight: 8,
    marginBottom: 8,
  },
  badgeText: {
    fontWeight: 'bold',
    fontSize: 14,
  },
  locationBadge: {
    backgroundColor: '#e9ecef',
    borderWidth: 1,
    borderColor: '#ced4da',
  },
  locationBadgeText: {
    color: '#495057',
    fontWeight: 'bold',
    fontSize: 12,
  },
  urgentBadge: {
    backgroundColor: '#FF4444',
  },
  urgentBadgeText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 12,
  },
  dateText: {
    color: '#666',
    fontSize: 14,
  },
  instructionBox: {
    backgroundColor: '#fff3cd',
    borderWidth: 1,
    borderColor: '#ffeeba',
    padding: 12,
    borderRadius: 8,
    marginTop: 16,
  },
  instructionTitle: {
    fontWeight: 'bold',
    color: '#856404',
    marginBottom: 4,
  },
  instructionText: {
    color: '#856404',
  },
  section: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1a1a2e',
    marginBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#ccc',
    paddingBottom: 4,
  },
  infoCard: {
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 16,
    borderWidth: 1,
    borderColor: '#eee',
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  infoLabel: {
    color: '#666',
    fontSize: 15,
  },
  infoValue: {
    fontWeight: '500',
    color: '#333',
    fontSize: 15,
  },
  linkText: {
    color: '#0066cc',
    textDecorationLine: 'underline',
  },
  descriptionText: {
    fontSize: 15,
    color: '#444',
    lineHeight: 22,
  },
  subTitle: {
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
    fontSize: 15,
  },
  listItem: {
    fontSize: 15,
    color: '#444',
    marginBottom: 4,
    marginLeft: 8,
  },
  emptyListText: {
    color: '#999',
    fontStyle: 'italic',
    marginBottom: 8,
  },
  divider: {
    height: 1,
    backgroundColor: '#eee',
    marginVertical: 12,
  },
  thumbnail: {
    width: 100,
    height: 100,
    borderRadius: 8,
    marginRight: 10,
    backgroundColor: '#ccc',
  },
  logCard: {
    backgroundColor: '#fff',
    padding: 12,
    borderRadius: 8,
    marginBottom: 10,
    borderLeftWidth: 3,
    borderLeftColor: '#1a1a2e',
  },
  logHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  logUser: {
    fontWeight: 'bold',
    color: '#333',
  },
  logTime: {
    color: '#888',
    fontSize: 12,
  },
  logStatusChange: {
    fontWeight: '600',
    color: '#28a745',
    marginBottom: 2,
  },
  logNote: {
    color: '#555',
  },
  bottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    padding: 16,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#ddd',
  },
  editButton: {
    flex: 1,
    backgroundColor: '#1a1a2e',
    padding: 14,
    borderRadius: 8,
    alignItems: 'center',
    marginRight: 8,
  },
  aiButton: {
    flex: 1,
    backgroundColor: '#FFD700',
    padding: 14,
    borderRadius: 8,
    alignItems: 'center',
    marginLeft: 8,
  },
  buttonTextWhite: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 16,
  },
  modalContainer: {
    flex: 1,
    backgroundColor: '#000',
    justifyContent: 'center',
  },
  fullScreenImage: {
    width: '100%',
    height: '80%',
  },
  closeButton: {
    position: 'absolute',
    top: 40,
    right: 20,
    zIndex: 1,
    padding: 10,
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderRadius: 20,
  },
  closeButtonText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 16,
  }
});
