import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Alert,
  SafeAreaView,
  Platform,
  FlatList
} from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { supabase } from '../../services/supabase';
import { JobSheet, JobSheetStatus } from '../../types';

type TechnicianStats = {
  name: string;
  total: number;
  completed: number;
  inProgress: number;
  onHold: number;
  inQueue: number;
  tatHours: number[];
};

export const ReportsScreen = () => {
  // Date states
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [dateError, setDateError] = useState('');

  // Data states
  const [loading, setLoading] = useState(false);
  const [jobsData, setJobsData] = useState<any[] | null>(null);
  const [stats, setStats] = useState<any>(null);

  // Billing states
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [selectedJob, setSelectedJob] = useState<any | null>(null);
  const [showDropdown, setShowDropdown] = useState(false);

  // Export loading states
  const [exportingSummary, setExportingSummary] = useState(false);
  const [exportingParts, setExportingParts] = useState(false);
  const [exportingTeam, setExportingTeam] = useState(false);

  // --- HELPERS ---

  const formatDate = (date: Date): string => {
    const d = date.getDate().toString().padStart(2, '0');
    const m = (date.getMonth() + 1).toString().padStart(2, '0');
    const y = date.getFullYear();
    return `${d}/${m}/${y}`;
  };

  const formatDateTime = (dateStr: string): string => {
    const date = new Date(dateStr);
    return `${formatDate(date)} ${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`;
  };

  const convertToISO = (dateStr: string): string | null => {
    const parts = dateStr.split('/');
    if (parts.length !== 3) return null;
    const [day, month, year] = parts;
    if (!day || !month || !year || year.length !== 4) return null;
    const date = new Date(
      parseInt(year),
      parseInt(month) - 1,
      parseInt(day)
    );
    if (isNaN(date.getTime())) return null;
    return date.toISOString();
  };

  const formatTAT = (hours: number): string => {
    if (hours < 1) return `${Math.round(hours * 60)} mins`;
    if (hours < 24) return `${hours.toFixed(1)} hrs`;
    const days = Math.floor(hours / 24);
    const remainingHours = Math.round(hours % 24);
    return `${days} days ${remainingHours} hrs`;
  };

  // --- QUICK SELECTS ---

  const handleQuickSelect = (type: string) => {
    const today = new Date();
    const year = today.getFullYear();
    const month = today.getMonth();
    let from = '';
    let to = formatDate(today);

    switch (type) {
      case 'Week': {
        const dayOfWeek = today.getDay();
        const monday = new Date(today);
        monday.setDate(today.getDate() - (dayOfWeek === 0 ? 6 : dayOfWeek - 1));
        from = formatDate(monday);
        break;
      }
      case 'Month': {
        from = `01/${(month + 1).toString().padStart(2, '0')}/${year}`;
        break;
      }
      case 'LastMonth': {
        const firstDay = new Date(year, month - 1, 1);
        const lastDay = new Date(year, month, 0);
        from = formatDate(firstDay);
        to = formatDate(lastDay);
        break;
      }
      case 'Quarter': {
        const quarter = Math.floor(month / 3);
        const firstDay = new Date(year, quarter * 3, 1);
        from = formatDate(firstDay);
        break;
      }
    }
    setFromDate(from);
    setToDate(to);
    setDateError('');
  };

  // --- DATA FETCHING ---

  const fetchReportsData = async () => {
    const fromISO = convertToISO(fromDate);
    const toISO = convertToISO(toDate);

    if (!fromISO || !toISO) {
      setDateError('Invalid date format. Use DD/MM/YYYY');
      return;
    }

    setDateError('');
    setLoading(true);
    setJobsData(null);

    try {
      const { data, error } = await supabase
        .from('job_sheets')
        .select(`
          id,
          serial_number,
          registration_number,
          customer_name,
          customer_mobile,
          machine_model,
          entry_date_time,
          completed_at,
          tat_hours,
          status,
          parts_used,
          issues_description,
          assigned_profile:profiles!assigned_to(full_name)
        `)
        .gte('entry_date_time', fromISO)
        .lte('entry_date_time', toISO)
        .order('entry_date_time', { ascending: false });

      if (error) throw error;

      if (!data || data.length === 0) {
        setJobsData([]);
        setStats(null);
      } else {
        setJobsData(data);
        
        // Compute stats
        const completedJobs = data.filter(j => j.status === 'Completed' && j.tat_hours !== null);
        const tatValues = completedJobs.map(j => j.tat_hours as number);
        
        const computedStats = {
          total: data.length,
          completed: data.filter(j => j.status === 'Completed').length,
          inProgress: data.filter(j => j.status === 'In Progress').length,
          inQueue: data.filter(j => j.status === 'In Queue').length,
          onHold: data.filter(j => j.status === 'On Hold').length,
          avgTAT: tatValues.length > 0 ? tatValues.reduce((a, b) => a + b, 0) / tatValues.length : 0,
          bestTAT: tatValues.length > 0 ? Math.min(...tatValues) : null,
          worstTAT: tatValues.length > 0 ? Math.max(...tatValues) : null,
        };
        setStats(computedStats);
      }
    } catch (error) {
      console.error('Fetch reports error:', error);
      Alert.alert('Error', 'Failed to fetch report data');
    } finally {
      setLoading(false);
    }
  };

  // --- CSV EXPORT ---

  const generateAndShareCSV = async (
    filename: string,
    headers: string[],
    rows: string[][]
  ): Promise<void> => {
    try {
      const csvRows = [
        headers.join(','),
        ...rows.map(row => row.join(','))
      ];
      const csvContent = csvRows.join('\n');
      const BOM = '\uFEFF';
      const fullContent = BOM + csvContent;

      if (Platform.OS === 'web') {
        const blob = new Blob([fullContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        const url = URL.createObjectURL(blob);
        link.setAttribute('href', url);
        link.setAttribute('download', filename);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      } else {
        const fileUri = FileSystem.documentDirectory + filename;
        await FileSystem.writeAsStringAsync(fileUri, fullContent, {
          encoding: FileSystem.EncodingType.UTF8
        });
        await Sharing.shareAsync(fileUri, {
          mimeType: 'text/csv',
          dialogTitle: 'Export Report',
          UTI: 'public.comma-separated-values-text'
        });
      }
    } catch (e) {
      console.error('CSV Export Error:', e);
      throw e;
    }
  };

  const exportJobSummary = async () => {
    if (!jobsData || jobsData.length === 0) {
      Alert.alert('Info', 'No data found for selected date range.');
      return;
    }
    setExportingSummary(true);
    try {
      const headers = [
        'Serial No', 'Registration No', 'Customer Name', 'Mobile', 'Machine Model',
        'Entry Date', 'Completion Date', 'TAT', 'Status', 'Technician', 'Issues'
      ];
      const rows = jobsData.map(job => [
        job.serial_number || 'N/A',
        job.registration_number,
        job.customer_name ?? '',
        job.customer_mobile ?? '',
        job.machine_model ?? '',
        formatDateTime(job.entry_date_time),
        job.completed_at ? formatDateTime(job.completed_at) : 'Pending',
        job.tat_hours ? formatTAT(job.tat_hours) : 'N/A',
        job.status,
        job.assigned_profile?.full_name ?? 'Unassigned',
        `"${(job.issues_description ?? '').replace(/"/g, '""')}"`,
      ]);

      await generateAndShareCSV(`JobSummary_${fromDate.replace(/\//g, '-')}_to_${toDate.replace(/\//g, '-')}.csv`, headers, rows);
    } catch (e) {
      Alert.alert('Error', 'Export failed. Please try again.');
    } finally {
      setExportingSummary(false);
    }
  };

  const exportPartsUsed = async () => {
    if (!jobsData || jobsData.length === 0) {
      Alert.alert('Info', 'No data found for selected date range.');
      return;
    }
    setExportingParts(true);
    try {
      const headers = ['Registration No', 'Customer Name', 'Entry Date', 'Part Name', 'Quantity', 'Technician'];
      const rows: string[][] = [];

      jobsData.forEach(job => {
        const parts = job.parts_used;
        if (Array.isArray(parts)) {
          parts.forEach((p: any) => {
            if (p && p.name) {
              rows.push([
                job.registration_number,
                job.customer_name ?? '',
                formatDateTime(job.entry_date_time),
                p.name,
                p.quantity?.toString() ?? '1',
                job.assigned_profile?.full_name ?? 'Unassigned'
              ]);
            }
          });
        }
      });

      if (rows.length === 0) {
        Alert.alert('Info', 'No parts usage found in this period.');
        return;
      }

      await generateAndShareCSV(`PartsReport_${fromDate.replace(/\//g, '-')}.csv`, headers, rows);
    } catch (e) {
      Alert.alert('Error', 'Export failed. Please try again.');
    } finally {
      setExportingParts(false);
    }
  };

  const exportTeamPerformance = async () => {
    if (!jobsData || jobsData.length === 0) {
      Alert.alert('Info', 'No data found for selected date range.');
      return;
    }
    setExportingTeam(true);
    try {
      const technicianMap = new Map<string, TechnicianStats>();

      jobsData.forEach(job => {
        const name = job.assigned_profile?.full_name ?? 'Unassigned';
        if (!technicianMap.has(name)) {
          technicianMap.set(name, {
            name, total: 0, completed: 0,
            inProgress: 0, onHold: 0, inQueue: 0, tatHours: []
          });
        }
        const tech = technicianMap.get(name)!;
        tech.total++;
        if (job.status === 'Completed') tech.completed++;
        if (job.status === 'In Progress') tech.inProgress++;
        if (job.status === 'On Hold') tech.onHold++;
        if (job.status === 'In Queue') tech.inQueue++;
        if (job.tat_hours) tech.tatHours.push(job.tat_hours);
      });

      const headers = ['Technician', 'Total Jobs', 'Completed', 'In Progress', 'On Hold', 'In Queue', 'Avg TAT'];
      const rows = Array.from(technicianMap.values()).map(tech => {
        const avg = tech.tatHours.length > 0 
          ? tech.tatHours.reduce((a, b) => a + b, 0) / tech.tatHours.length 
          : 0;
        return [
          tech.name,
          tech.total.toString(),
          tech.completed.toString(),
          tech.inProgress.toString(),
          tech.onHold.toString(),
          tech.inQueue.toString(),
          avg > 0 ? formatTAT(avg) : 'N/A'
        ];
      });

      await generateAndShareCSV(`TeamPerformance_${fromDate.replace(/\//g, '-')}.csv`, headers, rows);
    } catch (e) {
      Alert.alert('Error', 'Export failed. Please try again.');
    } finally {
      setExportingTeam(false);
    }
  };

  // --- BILLING SEARCH ---

  useEffect(() => {
    if (searchQuery.length >= 3) {
      const delay = setTimeout(async () => {
        const { data } = await supabase
          .from('job_sheets')
          .select('*, assigned_profile:profiles!assigned_to(full_name)')
          .ilike('registration_number', `%${searchQuery}%`)
          .limit(5);
        setSearchResults(data || []);
        setShowDropdown(true);
      }, 300);
      return () => clearTimeout(delay);
    } else {
      setSearchResults([]);
      setShowDropdown(false);
    }
  }, [searchQuery]);

  const handleShareAsText = async () => {
    if (!selectedJob) return;
    const parts = Array.isArray(selectedJob.parts_used) ? selectedJob.parts_used : [];
    
    const billText = `
================================
JCB WORKSHOP - SERVICE RECORD
================================
Machine  : ${selectedJob.registration_number}
Customer : ${selectedJob.customer_name ?? 'N/A'}
Mobile   : ${selectedJob.customer_mobile ?? 'N/A'}
Model    : ${selectedJob.machine_model ?? 'N/A'}
--------------------------------
Entry    : ${formatDateTime(selectedJob.entry_date_time)}
Closed   : ${selectedJob.completed_at ? formatDateTime(selectedJob.completed_at) : 'In Progress'}
TAT      : ${selectedJob.tat_hours ? formatTAT(selectedJob.tat_hours) : 'Ongoing'}
--------------------------------
PARTS USED:
${parts.length > 0 ? parts.map((p: any) => `• ${p.name} x ${p.quantity}`).join('\n') : 'No parts recorded.'}
--------------------------------
Issues   : ${selectedJob.issues_description ?? 'None'}
Engineer : ${selectedJob.assigned_profile?.full_name ?? 'Unassigned'}
================================
`;

    try {
      if (Platform.OS === 'web') {
        Alert.alert('Service Record', billText);
      } else {
        const filename = `Bill_${selectedJob.registration_number}_${new Date().getTime()}.txt`;
        const fileUri = FileSystem.documentDirectory + filename;
        await FileSystem.writeAsStringAsync(fileUri, billText);
        await Sharing.shareAsync(fileUri);
      }
    } catch (e) {
      Alert.alert('Error', 'Failed to share record');
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'In Queue': return '#856404';
      case 'In Progress': return '#004085';
      case 'Completed': return '#155724';
      case 'On Hold': return '#721c24';
      default: return '#333';
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Reports & Export</Text>
        <Text style={styles.headerSubtitle}>Generate reports and export data</Text>
      </View>

      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        
        {/* Date Range Selector */}
        <View style={styles.section}>
          <View style={styles.dateRow}>
            <View style={styles.dateInputContainer}>
              <Text style={styles.label}>From</Text>
              <TextInput
                style={styles.input}
                placeholder="DD/MM/YYYY"
                value={fromDate}
                onChangeText={setFromDate}
              />
            </View>
            <View style={styles.dateInputContainer}>
              <Text style={styles.label}>To</Text>
              <TextInput
                style={styles.input}
                placeholder="DD/MM/YYYY"
                value={toDate}
                onChangeText={setToDate}
              />
            </View>
          </View>
          {dateError ? <Text style={styles.errorText}>{dateError}</Text> : null}

          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.quickSelectRow}>
            {['Week', 'Month', 'LastMonth', 'Quarter'].map((type) => (
              <TouchableOpacity 
                key={type} 
                style={styles.quickButton}
                onPress={() => handleQuickSelect(type)}
              >
                <Text style={styles.quickButtonText}>{type.replace('LastMonth', 'Last Month')}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          <TouchableOpacity style={styles.applyButton} onPress={fetchReportsData}>
            <Text style={styles.applyButtonText}>Apply Filters</Text>
          </TouchableOpacity>
        </View>

        {/* Loading Spinner */}
        {loading && <ActivityIndicator size="large" color="#FFD700" style={{ marginVertical: 20 }} />}

        {/* Summary Stats */}
        {stats && (
          <View style={styles.statsCard}>
            <View style={styles.statsGrid}>
              <View style={styles.statCell}>
                <Text style={styles.statValue}>{stats.total}</Text>
                <Text style={styles.statLabel}>Total Machines</Text>
              </View>
              <View style={styles.statCell}>
                <Text style={[styles.statValue, { color: '#28a745' }]}>{stats.completed}</Text>
                <Text style={styles.statLabel}>Completed</Text>
              </View>
              <View style={styles.statCell}>
                <Text style={[styles.statValue, { color: '#007bff' }]}>{stats.inProgress}</Text>
                <Text style={styles.statLabel}>In Progress</Text>
              </View>
              <View style={styles.statCell}>
                <Text style={[styles.statValue, { color: '#ffc107' }]}>{stats.inQueue}</Text>
                <Text style={styles.statLabel}>In Queue</Text>
              </View>
              <View style={styles.statCell}>
                <Text style={[styles.statValue, { color: '#dc3545' }]}>{stats.onHold}</Text>
                <Text style={styles.statLabel}>On Hold</Text>
              </View>
              <View style={styles.statCell}>
                <Text style={styles.statValue}>{stats.avgTAT > 0 ? formatTAT(stats.avgTAT) : 'N/A'}</Text>
                <Text style={styles.statLabel}>Avg TAT</Text>
              </View>
            </View>
            <View style={styles.tatFooter}>
              <Text style={styles.bestTAT}>Best TAT: {stats.bestTAT ? formatTAT(stats.bestTAT) : 'N/A'}</Text>
              <Text style={styles.worstTAT}>Worst TAT: {stats.worstTAT ? formatTAT(stats.worstTAT) : 'N/A'}</Text>
            </View>
          </View>
        )}

        {/* Empty State */}
        {jobsData && jobsData.length === 0 && !loading && (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>No data for this period</Text>
          </View>
        )}

        {/* Export Buttons */}
        {jobsData && jobsData.length > 0 && (
          <View style={styles.section}>
            <TouchableOpacity 
              style={styles.exportButton} 
              onPress={exportJobSummary}
              disabled={exportingSummary}
            >
              <Text style={styles.exportButtonText}>
                {exportingSummary ? '📊 Generating...' : '📊 Export Job Summary'}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity 
              style={styles.exportButton} 
              onPress={exportPartsUsed}
              disabled={exportingParts}
            >
              <Text style={styles.exportButtonText}>
                {exportingParts ? '🔧 Generating...' : '🔧 Export Parts & Materials'}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity 
              style={styles.exportButton} 
              onPress={exportTeamPerformance}
              disabled={exportingTeam}
            >
              <Text style={styles.exportButtonText}>
                {exportingTeam ? '👥 Generating...' : '👥 Export Team Performance'}
              </Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Billing Generator */}
        <View style={[styles.section, { marginTop: 20 }]}>
          <Text style={styles.sectionTitle}>🧾 Billing Card Generator</Text>
          <Text style={styles.sectionSubtitle}>Search a completed job to generate service record</Text>
          
          <View style={styles.searchContainer}>
            <TextInput
              style={styles.input}
              placeholder="Enter registration number..."
              value={searchQuery}
              onChangeText={setSearchQuery}
            />
            {showDropdown && searchResults.length > 0 && (
              <View style={styles.dropdown}>
                {searchResults.map((job) => (
                  <TouchableOpacity 
                    key={job.id} 
                    style={styles.dropdownItem}
                    onPress={() => {
                      setSelectedJob(job);
                      setShowDropdown(false);
                      setSearchQuery('');
                    }}
                  >
                    <Text style={styles.dropdownMain}>{job.registration_number}</Text>
                    <Text style={styles.dropdownSub}>{job.customer_name ?? 'N/A'}</Text>
                    <Text style={[styles.dropdownStatus, { color: getStatusColor(job.status) }]}>{job.status}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </View>

          {selectedJob && (
            <View style={styles.billingCard}>
              <View style={styles.billingHeader}>
                <Text style={styles.billingTitle}>JCB WORKSHOP - SERVICE RECORD</Text>
              </View>
              <View style={styles.billingBody}>
                <View style={styles.billingRow}><Text style={styles.billLabel}>Machine :</Text><Text style={styles.billValue}>{selectedJob.registration_number}</Text></View>
                <View style={styles.billingRow}><Text style={styles.billLabel}>Customer:</Text><Text style={styles.billValue}>{selectedJob.customer_name ?? 'N/A'}</Text></View>
                <View style={styles.billingRow}><Text style={styles.billLabel}>Mobile  :</Text><Text style={styles.billValue}>{selectedJob.customer_mobile ?? 'N/A'}</Text></View>
                <View style={styles.billingRow}><Text style={styles.billLabel}>Model   :</Text><Text style={styles.billValue}>{selectedJob.machine_model ?? 'N/A'}</Text></View>
                <View style={styles.billDivider} />
                <View style={styles.billingRow}><Text style={styles.billLabel}>Entry   :</Text><Text style={styles.billValue}>{formatDateTime(selectedJob.entry_date_time)}</Text></View>
                <View style={styles.billingRow}><Text style={styles.billLabel}>Closed  :</Text><Text style={styles.billValue}>{selectedJob.completed_at ? formatDateTime(selectedJob.completed_at) : 'N/A'}</Text></View>
                <View style={styles.billingRow}><Text style={styles.billLabel}>TAT     :</Text><Text style={styles.billValue}>{selectedJob.tat_hours ? formatTAT(selectedJob.tat_hours) : 'Ongoing'}</Text></View>
                <View style={styles.billDivider} />
                <Text style={styles.billLabel}>PARTS USED:</Text>
                {Array.isArray(selectedJob.parts_used) && selectedJob.parts_used.length > 0 ? (
                  selectedJob.parts_used.map((p: any, idx: number) => (
                    <Text key={idx} style={styles.partItem}>• {p.name}   Qty: {p.quantity}</Text>
                  ))
                ) : <Text style={styles.partItem}>No parts recorded</Text>}
                <View style={styles.billDivider} />
                <View style={styles.billingRow}><Text style={styles.billLabel}>Issues  :</Text><Text style={styles.billValue}>{selectedJob.issues_description ?? 'None'}</Text></View>
                <View style={styles.billingRow}><Text style={styles.billLabel}>Engineer:</Text><Text style={styles.billValue}>{selectedJob.assigned_profile?.full_name ?? 'Unassigned'}</Text></View>
              </View>
              
              <View style={styles.billingActions}>
                <TouchableOpacity style={styles.shareButton} onPress={handleShareAsText}>
                  <Text style={styles.shareButtonText}>📤 Share as Text</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.clearButton} onPress={() => setSelectedJob(null)}>
                  <Text style={styles.clearButtonText}>🔄 Clear Selection</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
        </View>

        <View style={{ height: 60 }} />
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#1a1a2e' },
  header: { padding: 20, backgroundColor: '#1a1a2e' },
  headerTitle: { color: '#fff', fontSize: 24, fontWeight: 'bold' },
  headerSubtitle: { color: '#aaa', fontSize: 14, marginTop: 4 },
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  content: { padding: 16 },
  section: { marginBottom: 20 },
  label: { fontSize: 14, fontWeight: '600', color: '#666', marginBottom: 6 },
  dateRow: { flexDirection: 'row', justifyContent: 'space-between' },
  dateInputContainer: { width: '48%' },
  input: { backgroundColor: '#fff', padding: 12, borderRadius: 8, borderWidth: 1, borderColor: '#ccc', fontSize: 16 },
  errorText: { color: '#dc3545', fontSize: 12, marginTop: 4, fontWeight: '600' },
  quickSelectRow: { marginVertical: 12 },
  quickButton: { backgroundColor: '#fff', paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, marginRight: 10, borderWidth: 1, borderColor: '#ccc' },
  quickButtonText: { color: '#666', fontWeight: '600' },
  applyButton: { backgroundColor: '#1a1a2e', padding: 16, borderRadius: 8, alignItems: 'center', marginTop: 10 },
  applyButtonText: { color: '#fff', fontWeight: 'bold', fontSize: 16 },
  statsCard: { backgroundColor: '#fff', borderRadius: 12, padding: 16, marginBottom: 20, elevation: 3 },
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' },
  statCell: { width: '30%', marginBottom: 16, alignItems: 'center' },
  statValue: { fontSize: 22, fontWeight: 'bold', color: '#333' },
  statLabel: { fontSize: 10, color: '#999', marginTop: 2, textAlign: 'center' },
  tatFooter: { borderTopWidth: 1, borderTopColor: '#eee', paddingTop: 12, flexDirection: 'row', justifyContent: 'space-between' },
  bestTAT: { color: '#28a745', fontSize: 12, fontWeight: 'bold' },
  worstTAT: { color: '#dc3545', fontSize: 12, fontWeight: 'bold' },
  exportButton: { backgroundColor: '#1a1a2e', padding: 16, borderRadius: 8, alignItems: 'center', marginBottom: 12 },
  exportButtonText: { color: '#fff', fontWeight: 'bold' },
  sectionTitle: { fontSize: 18, fontWeight: 'bold', color: '#333' },
  sectionSubtitle: { fontSize: 12, color: '#666', marginBottom: 16 },
  searchContainer: { position: 'relative', zIndex: 10 },
  dropdown: { position: 'absolute', top: 50, left: 0, right: 0, backgroundColor: '#fff', borderRadius: 8, elevation: 5, borderWidth: 1, borderColor: '#eee' },
  dropdownItem: { padding: 12, borderBottomWidth: 1, borderBottomColor: '#f0f0f0' },
  dropdownMain: { fontWeight: 'bold', fontSize: 15 },
  dropdownSub: { fontSize: 12, color: '#666' },
  dropdownStatus: { fontSize: 10, fontWeight: 'bold', marginTop: 2 },
  billingCard: { backgroundColor: '#fff', borderRadius: 8, borderWidth: 2, borderColor: '#000', marginTop: 20, padding: 1 },
  billingHeader: { borderBottomWidth: 1, borderBottomColor: '#000', padding: 10, alignItems: 'center' },
  billingTitle: { fontWeight: 'bold', fontSize: 14 },
  billingBody: { padding: 15 },
  billingRow: { flexDirection: 'row', marginBottom: 4 },
  billLabel: { width: 80, fontWeight: 'bold', fontSize: 13 },
  billValue: { flex: 1, fontSize: 13 },
  billDivider: { height: 1, backgroundColor: '#000', marginVertical: 8, borderStyle: 'dashed' },
  partItem: { fontSize: 13, marginLeft: 10, marginBottom: 2 },
  billingActions: { padding: 15, gap: 10 },
  shareButton: { backgroundColor: '#007bff', padding: 12, borderRadius: 6, alignItems: 'center' },
  shareButtonText: { color: '#fff', fontWeight: 'bold' },
  clearButton: { backgroundColor: '#f8f9fa', padding: 12, borderRadius: 6, alignItems: 'center', borderWidth: 1, borderColor: '#ddd' },
  clearButtonText: { color: '#333', fontWeight: '600' },
  emptyContainer: { alignItems: 'center', padding: 40 },
  emptyText: { color: '#888', fontSize: 16 },
});
