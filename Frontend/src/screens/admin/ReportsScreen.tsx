import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput,
  ActivityIndicator, Alert, StatusBar,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { supabase } from '../../services/supabase';
import { formatShortDate, formatDateTime, formatTAT, convertToISO } from '../../utils/formatting';
import { colors, spacing, radius, typography } from '../../theme/tokens';
import { Icon } from '../../components/ui/Icon';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { SectionHeader } from '../../components/ui/SectionHeader';

type TechnicianStats = {
  name: string; total: number; completed: number; inProgress: number;
  onHold: number; inQueue: number; tatHours: number[];
};

type JobSheetReport = Record<string, unknown> & {
  id: string; serial_number?: string; registration_number: string; customer_name?: string;
  customer_mobile?: string; machine_model?: string; entry_date_time: string;
  completed_at?: string; tat_hours?: number; status: string;
  parts_used?: Array<{ name: string; quantity: number }>; issues_description?: string;
  assigned_profile?: { full_name?: string };
};

type ReportStats = {
  total: number; completed: number; inProgress: number; inQueue: number;
  onHold: number; avgTAT: number; bestTAT: number | null; worstTAT: number | null;
};

const QUICK_SELECTS = ['Week', 'Month', 'LastMonth', 'Quarter'] as const;

export const ReportsScreen = () => {
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [dateError, setDateError] = useState('');
  const [loading, setLoading] = useState(false);
  const [jobsData, setJobsData] = useState<JobSheetReport[] | null>(null);
  const [stats, setStats] = useState<ReportStats | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<JobSheetReport[]>([]);
  const [selectedJob, setSelectedJob] = useState<JobSheetReport | null>(null);
  const [showDropdown, setShowDropdown] = useState(false);
  const [exportingSummary, setExportingSummary] = useState(false);
  const [exportingParts, setExportingParts] = useState(false);
  const [exportingTeam, setExportingTeam] = useState(false);

  const handleQuickSelect = (type: string) => {
    const today = new Date();
    const year = today.getFullYear();
    const month = today.getMonth();
    let from = '';
    let to = formatShortDate(today);
    switch (type) {
      case 'Week': {
        const dow = today.getDay();
        const monday = new Date(today);
        monday.setDate(today.getDate() - (dow === 0 ? 6 : dow - 1));
        from = formatShortDate(monday);
        break;
      }
      case 'Month': from = `01/${(month + 1).toString().padStart(2, '0')}/${year}`; break;
      case 'LastMonth': {
        from = formatShortDate(new Date(year, month - 1, 1));
        to = formatShortDate(new Date(year, month, 0));
        break;
      }
      case 'Quarter': from = formatShortDate(new Date(year, Math.floor(month / 3) * 3, 1)); break;
    }
    setFromDate(from);
    setToDate(to);
    setDateError('');
  };

  const fetchReportsData = async () => {
    const fromISO = convertToISO(fromDate);
    const toISO = convertToISO(toDate);
    if (!fromISO || !toISO) { setDateError('Invalid date. Use DD/MM/YYYY'); return; }
    setDateError('');
    setLoading(true);
    setJobsData(null);
    try {
      const { data, error } = await supabase
        .from('job_sheets')
        .select(`id, serial_number, registration_number, customer_name, customer_mobile, machine_model, entry_date_time, completed_at, tat_hours, status, parts_used, issues_description, assigned_profile:profiles!assigned_to(full_name)`)
        .gte('entry_date_time', fromISO)
        .lte('entry_date_time', toISO)
        .order('entry_date_time', { ascending: false });
      if (error) throw error;
      if (!data || data.length === 0) { setJobsData([]); setStats(null); return; }
      setJobsData(data as unknown as JobSheetReport[]);
      let completed = 0, inProgress = 0, inQueue = 0, onHold = 0;
      const tatVals: number[] = [];
      for (const j of data) {
        if (j.status === 'Completed') { completed++; if (j.tat_hours !== null) tatVals.push(j.tat_hours); }
        else if (j.status === 'In Progress') inProgress++;
        else if (j.status === 'In Queue') inQueue++;
        else if (j.status === 'On Hold') onHold++;
      }
      const avg = tatVals.length > 0 ? tatVals.reduce((a, b) => a + b, 0) / tatVals.length : 0;
      setStats({ total: data.length, completed, inProgress, inQueue, onHold, avgTAT: avg, bestTAT: tatVals.length > 0 ? Math.min(...tatVals) : null, worstTAT: tatVals.length > 0 ? Math.max(...tatVals) : null });
    } catch { Alert.alert('Error', 'Failed to fetch data'); }
    finally { setLoading(false); }
  };

  const generateCSV = async (name: string, headers: string[], rows: string[][]) => {
    const BOM = '\uFEFF';
    const content = BOM + [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const uri = FileSystem.documentDirectory + name;
    await FileSystem.writeAsStringAsync(uri, content, { encoding: FileSystem.EncodingType.UTF8 });
    await Sharing.shareAsync(uri, { mimeType: 'text/csv', dialogTitle: 'Export Report', UTI: 'public.comma-separated-values-text' });
  };

  const exportJobSummary = async () => {
    if (!jobsData?.length) { Alert.alert('Info', 'No data.'); return; }
    setExportingSummary(true);
    try {
      const headers = ['Serial No', 'Registration No', 'Customer', 'Mobile', 'Model', 'Entry', 'Completion', 'TAT', 'Status', 'Technician', 'Issues'];
      const rows = jobsData.map(j => [
        j.serial_number || 'N/A', j.registration_number, j.customer_name ?? '', j.customer_mobile ?? '',
        j.machine_model ?? '', formatDateTime(j.entry_date_time), j.completed_at ? formatDateTime(j.completed_at) : 'Pending',
        j.tat_hours ? formatTAT(j.tat_hours) : 'N/A', j.status, j.assigned_profile?.full_name ?? 'Unassigned',
        `"${(j.issues_description ?? '').replace(/"/g, '""')}"`,
      ]);
      await generateCSV(`JobSummary_${fromDate.replace(/\//g, '-')}.csv`, headers, rows);
    } catch { Alert.alert('Error', 'Export failed.'); }
    finally { setExportingSummary(false); }
  };

  const exportPartsUsed = async () => {
    if (!jobsData?.length) { Alert.alert('Info', 'No data.'); return; }
    setExportingParts(true);
    try {
      const headers = ['Registration', 'Customer', 'Entry Date', 'Part Name', 'Qty', 'Technician'];
      const rows: string[][] = [];
      jobsData.forEach(j => {
        if (Array.isArray(j.parts_used)) {
          j.parts_used.forEach((p) => {
            if (p?.name) rows.push([j.registration_number, j.customer_name ?? '', formatDateTime(j.entry_date_time), p.name, (p.quantity ?? 1).toString(), j.assigned_profile?.full_name ?? 'Unassigned']);
          });
        }
      });
      if (!rows.length) { Alert.alert('Info', 'No parts used.'); return; }
      await generateCSV(`PartsReport_${fromDate.replace(/\//g, '-')}.csv`, headers, rows);
    } catch { Alert.alert('Error', 'Export failed.'); }
    finally { setExportingParts(false); }
  };

  const exportTeamPerformance = async () => {
    if (!jobsData?.length) { Alert.alert('Info', 'No data.'); return; }
    setExportingTeam(true);
    try {
      const map = new Map<string, TechnicianStats>();
      jobsData.forEach(j => {
        const n = j.assigned_profile?.full_name ?? 'Unassigned';
        if (!map.has(n)) map.set(n, { name: n, total: 0, completed: 0, inProgress: 0, onHold: 0, inQueue: 0, tatHours: [] });
        const t = map.get(n)!;
        t.total++;
        if (j.status === 'Completed') t.completed++;
        else if (j.status === 'In Progress') t.inProgress++;
        else if (j.status === 'On Hold') t.onHold++;
        else if (j.status === 'In Queue') t.inQueue++;
        if (j.tat_hours) t.tatHours.push(j.tat_hours);
      });
      const headers = ['Technician', 'Total', 'Completed', 'In Progress', 'On Hold', 'In Queue', 'Avg TAT'];
      const rows = Array.from(map.values()).map(t => {
        const avg = t.tatHours.length > 0 ? t.tatHours.reduce((a, b) => a + b, 0) / t.tatHours.length : 0;
        return [t.name, t.total.toString(), t.completed.toString(), t.inProgress.toString(), t.onHold.toString(), t.inQueue.toString(), avg > 0 ? formatTAT(avg) : 'N/A'];
      });
      await generateCSV(`TeamPerformance_${fromDate.replace(/\//g, '-')}.csv`, headers, rows);
    } catch { Alert.alert('Error', 'Export failed.'); }
    finally { setExportingTeam(false); }
  };

  useEffect(() => {
    if (searchQuery.length >= 3) {
      const timer = setTimeout(async () => {
        const { data } = await supabase.from('job_sheets').select('*, assigned_profile:profiles!assigned_to(full_name)').ilike('registration_number', `%${searchQuery}%`).limit(5);
        setSearchResults(data || []);
        setShowDropdown(true);
      }, 300);
      return () => clearTimeout(timer);
    } else { setSearchResults([]); setShowDropdown(false); }
  }, [searchQuery]);

  const handleShareAsText = async () => {
    if (!selectedJob) return;
    const parts = Array.isArray(selectedJob.parts_used) ? selectedJob.parts_used : [];
    const text = `================================
MS JCB SERVICES - SERVICE RECORD
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
${parts.length > 0 ? parts.map(p => `• ${p.name} x ${p.quantity}`).join('\n') : 'No parts recorded.'}
--------------------------------
Issues   : ${selectedJob.issues_description ?? 'None'}
Engineer : ${selectedJob.assigned_profile?.full_name ?? 'Unassigned'}
================================`;
    try {
      const uri = FileSystem.documentDirectory + `Bill_${selectedJob.registration_number}.txt`;
      await FileSystem.writeAsStringAsync(uri, text);
      await Sharing.shareAsync(uri);
    } catch { Alert.alert('Error', 'Failed to share'); }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="light-content" backgroundColor={colors.headerBg} />
      <View style={styles.header}>
        <Text style={styles.headerTitle} allowFontScaling={false}>Reports & Export</Text>
        <Text style={styles.headerSub} allowFontScaling={false}>Generate reports and export data</Text>
      </View>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Card>
          <View style={styles.dateRow}>
            <View style={styles.dateField}>
              <Text style={styles.fieldLabel} allowFontScaling={false}>From</Text>
              <TextInput style={styles.input} placeholder="DD/MM/YYYY" value={fromDate} onChangeText={setFromDate} placeholderTextColor={colors.textTertiary} />
            </View>
            <View style={styles.dateField}>
              <Text style={styles.fieldLabel} allowFontScaling={false}>To</Text>
              <TextInput style={styles.input} placeholder="DD/MM/YYYY" value={toDate} onChangeText={setToDate} placeholderTextColor={colors.textTertiary} />
            </View>
          </View>
          {dateError ? <Text style={styles.errorText} allowFontScaling={false}>{dateError}</Text> : null}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginVertical: spacing.md }}>
            <View style={styles.chipsRow}>
              {QUICK_SELECTS.map(t => (
                <TouchableOpacity key={t} style={styles.chip} onPress={() => handleQuickSelect(t)} activeOpacity={0.7}>
                  <Text style={styles.chipText} allowFontScaling={false}>{t === 'LastMonth' ? 'Last Month' : t}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </ScrollView>
          <Button title="Apply Filters" onPress={fetchReportsData} variant="primary" fullWidth />
        </Card>

        {loading && <View style={{ padding: spacing['3xl'] }}><ActivityIndicator size="large" color={colors.accent} /></View>}

        {stats && (
          <Card elevated>
            <View style={styles.statsGrid}>
              {[
                { label: 'Total', value: stats.total, color: colors.textPrimary },
                { label: 'Completed', value: stats.completed, color: colors.success },
                { label: 'In Progress', value: stats.inProgress, color: colors.info },
                { label: 'In Queue', value: stats.inQueue, color: colors.warning },
                { label: 'On Hold', value: stats.onHold, color: colors.error },
                { label: 'Avg TAT', value: stats.avgTAT > 0 ? formatTAT(stats.avgTAT) : 'N/A', color: colors.textPrimary },
              ].map((s, i) => (
                <View key={i} style={styles.statCell}>
                  <Text style={[styles.statValue, { color: s.color }]} allowFontScaling={false}>{s.value}</Text>
                  <Text style={styles.statLabel} allowFontScaling={false}>{s.label}</Text>
                </View>
              ))}
            </View>
            <View style={styles.tatRow}>
              <Text style={[styles.tatText, { color: colors.success }]} allowFontScaling={false}>Best TAT: {stats.bestTAT ? formatTAT(stats.bestTAT) : 'N/A'}</Text>
              <Text style={[styles.tatText, { color: colors.error }]} allowFontScaling={false}>Worst TAT: {stats.worstTAT ? formatTAT(stats.worstTAT) : 'N/A'}</Text>
            </View>
          </Card>
        )}

        {jobsData && jobsData.length === 0 && !loading && (
          <View style={styles.empty}>
            <Icon name="search-outline" size={40} color={colors.textTertiary} />
            <Text style={styles.emptyText} allowFontScaling={false}>No data for this period</Text>
          </View>
        )}

        {jobsData && jobsData.length > 0 && (
          <Card>
            <Text style={styles.sectionTitle} allowFontScaling={false}>Exports</Text>
            <View style={styles.exportList}>
              <TouchableOpacity style={styles.exportBtn} onPress={exportJobSummary} disabled={exportingSummary} activeOpacity={0.7}>
                <Icon name="document-text-outline" size={20} color={colors.accent} />
                <Text style={styles.exportBtnText} allowFontScaling={false}>{exportingSummary ? 'Generating...' : 'Export Job Summary'}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.exportBtn} onPress={exportPartsUsed} disabled={exportingParts} activeOpacity={0.7}>
                <Icon name="construct-outline" size={20} color={colors.accent} />
                <Text style={styles.exportBtnText} allowFontScaling={false}>{exportingParts ? 'Generating...' : 'Export Parts & Materials'}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.exportBtn} onPress={exportTeamPerformance} disabled={exportingTeam} activeOpacity={0.7}>
                <Icon name="people-outline" size={20} color={colors.accent} />
                <Text style={styles.exportBtnText} allowFontScaling={false}>{exportingTeam ? 'Generating...' : 'Export Team Performance'}</Text>
              </TouchableOpacity>
            </View>
          </Card>
        )}

        <SectionHeader title="Billing Card Generator" subtitle="Search completed job for service record" />
        <Card>
          <View style={styles.searchWrap}>
            <TextInput
              style={styles.input}
              placeholder="Enter registration number..."
              value={searchQuery}
              onChangeText={setSearchQuery}
              placeholderTextColor={colors.textTertiary}
            />
            {showDropdown && searchResults.length > 0 && (
              <View style={styles.dropdown}>
                {searchResults.map(j => (
                  <TouchableOpacity key={j.id} style={styles.dropdownItem} onPress={() => { setSelectedJob(j); setShowDropdown(false); setSearchQuery(''); }}>
                    <Text style={styles.dropdownMain} allowFontScaling={false}>{j.registration_number}</Text>
                    <View style={styles.dropdownRow}>
                      <Text style={styles.dropdownSub} allowFontScaling={false}>{j.customer_name ?? 'N/A'}</Text>
                      <View style={[styles.miniStatus, { backgroundColor: STATUS_COLORS[j.status]?.bg || colors.shimmer }]}>
                        <Text style={[styles.miniStatusText, { color: STATUS_COLORS[j.status]?.text || colors.textSecondary }]} allowFontScaling={false}>{j.status}</Text>
                      </View>
                    </View>
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </View>

          {selectedJob && (
            <View style={styles.billingCard}>
              <View style={styles.billingHeader}>
                <Text style={styles.billingTitle} allowFontScaling={false}>MS JCB SERVICES - SERVICE RECORD</Text>
              </View>
              <View style={styles.billingBody}>
                {[
                  ['Machine', selectedJob.registration_number],
                  ['Customer', selectedJob.customer_name ?? 'N/A'],
                  ['Mobile', selectedJob.customer_mobile ?? 'N/A'],
                  ['Model', selectedJob.machine_model ?? 'N/A'],
                ].map(([l, v]) => (
                  <BillRow key={l} label={l} value={v} />
                ))}
                <BillDivider />
                {[
                  ['Entry', formatDateTime(selectedJob.entry_date_time)],
                  ['Closed', selectedJob.completed_at ? formatDateTime(selectedJob.completed_at) : 'N/A'],
                  ['TAT', selectedJob.tat_hours ? formatTAT(selectedJob.tat_hours) : 'Ongoing'],
                ].map(([l, v]) => (
                  <BillRow key={l} label={l} value={v} />
                ))}
                <BillDivider />
                <Text style={styles.billSectionLabel} allowFontScaling={false}>PARTS USED:</Text>
                {Array.isArray(selectedJob.parts_used) && selectedJob.parts_used.length > 0
                  ? selectedJob.parts_used.map((p, i) => (
                      <Text key={i} style={styles.partItem} allowFontScaling={false}>• {p.name}   Qty: {p.quantity}</Text>
                    ))
                  : <Text style={styles.partItem} allowFontScaling={false}>No parts recorded</Text>}
                <BillDivider />
                <BillRow label="Issues" value={selectedJob.issues_description ?? 'None'} />
                <BillRow label="Engineer" value={selectedJob.assigned_profile?.full_name ?? 'Unassigned'} />
              </View>
              <View style={styles.billingFooter}>
                <Button title="Share as Text" icon="share-outline" onPress={handleShareAsText} variant="secondary" fullWidth />
                <Button title="Clear" variant="ghost" onPress={() => setSelectedJob(null)} fullWidth />
              </View>
            </View>
          )}
        </Card>
        <View style={{ height: 60 }} />
      </ScrollView>
    </SafeAreaView>
  );
};

const BillRow = ({ label, value }: { label: string; value: string }) => (
  <View style={styles.billRow}>
    <Text style={styles.billLabel} allowFontScaling={false}>{label}</Text>
    <Text style={styles.billValue} allowFontScaling={false}>{value}</Text>
  </View>
);

const BillDivider = () => <View style={styles.billDivider} />;

const STATUS_COLORS: Record<string, { bg: string; text: string }> = {
  'In Queue': { bg: colors.statusQueueBg, text: colors.statusQueue },
  'In Progress': { bg: colors.statusProgressBg, text: colors.statusProgress },
  Completed: { bg: colors.statusCompletedBg, text: colors.statusCompleted },
  'On Hold': { bg: colors.statusHoldBg, text: colors.statusHold },
};

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.headerBg },
  header: { padding: spacing.xl, backgroundColor: colors.headerBg },
  headerTitle: { ...typography.title2, color: colors.headerText },
  headerSub: { ...typography.footnote, color: colors.textTertiary, marginTop: 2 },
  content: { padding: spacing.lg },
  dateRow: { flexDirection: 'row', gap: spacing.md },
  dateField: { flex: 1 },
  fieldLabel: { ...typography.footnote, fontWeight: '600', color: colors.textSecondary, marginBottom: spacing.xs },
  input: {
    backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md,
    padding: spacing.md, ...typography.body, color: colors.textPrimary,
  },
  errorText: { ...typography.caption1, color: colors.error, marginTop: spacing.xs },
  chipsRow: { flexDirection: 'row', gap: spacing.sm },
  chip: {
    paddingHorizontal: spacing.lg, paddingVertical: spacing.sm, borderRadius: radius.full,
    backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border,
  },
  chipText: { ...typography.subhead, color: colors.textSecondary, fontWeight: '600' },
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap' },
  statCell: { width: '33%', alignItems: 'center', marginBottom: spacing.md },
  statValue: { ...typography.title2, fontWeight: '700' },
  statLabel: { ...typography.caption2, color: colors.textSecondary, marginTop: 2 },
  tatRow: { flexDirection: 'row', justifyContent: 'space-between', borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border, paddingTop: spacing.md },
  tatText: { ...typography.footnote, fontWeight: '700' },
  empty: { alignItems: 'center', padding: spacing['4xl'], gap: spacing.md },
  emptyText: { ...typography.callout, color: colors.textSecondary },
  sectionTitle: { ...typography.headline, color: colors.textPrimary, marginBottom: spacing.md },
  exportList: { gap: spacing.sm },
  exportBtn: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: colors.headerBg,
    padding: spacing.lg, borderRadius: radius.md, gap: spacing.md,
  },
  exportBtnText: { ...typography.callout, fontWeight: '600', color: colors.accent, flex: 1 },
  searchWrap: { position: 'relative', zIndex: 10 },
  dropdown: {
    position: 'absolute', top: 52, left: 0, right: 0, backgroundColor: colors.surface,
    borderRadius: radius.md, borderWidth: 1, borderColor: colors.border,
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.12, shadowRadius: 8, elevation: 5,
  },
  dropdownItem: { padding: spacing.md, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
  dropdownMain: { ...typography.callout, fontWeight: '600', color: colors.textPrimary },
  dropdownRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 2 },
  dropdownSub: { ...typography.caption1, color: colors.textSecondary },
  miniStatus: { paddingHorizontal: spacing.sm, paddingVertical: 2, borderRadius: radius.sm },
  miniStatusText: { ...typography.caption2, fontWeight: '600' },
  billingCard: { marginTop: spacing.lg },
  billingHeader: { borderBottomWidth: 1, borderBottomColor: colors.textPrimary, paddingBottom: spacing.sm, marginBottom: spacing.md },
  billingTitle: { ...typography.callout, fontWeight: '700', color: colors.textPrimary, textAlign: 'center' },
  billingBody: {},
  billRow: { flexDirection: 'row', marginBottom: 3 },
  billLabel: { width: 80, ...typography.footnote, fontWeight: '700', color: colors.textPrimary },
  billValue: { flex: 1, ...typography.footnote, color: colors.textPrimary },
  billDivider: { height: 1, backgroundColor: colors.textPrimary, marginVertical: spacing.sm },
  billSectionLabel: { ...typography.footnote, fontWeight: '700', color: colors.textPrimary, marginBottom: 2 },
  partItem: { ...typography.footnote, color: colors.textPrimary, marginLeft: spacing.md, marginBottom: 2 },
  billingFooter: { gap: spacing.sm, marginTop: spacing.md },
});
