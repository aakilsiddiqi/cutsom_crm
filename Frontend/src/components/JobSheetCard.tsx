import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { JobSheet } from '../types';

interface Props {
  jobSheet: JobSheet;
  onPress?: () => void;
}

export const JobSheetCard: React.FC<Props> = ({ jobSheet, onPress }) => {
  const getStatusColors = (status: string) => {
    switch (status) {
      case 'In Queue': return { bg: '#FFF3CD', text: '#856404' };
      case 'In Progress': return { bg: '#CCE5FF', text: '#004085' };
      case 'Completed': return { bg: '#D4EDDA', text: '#155724' };
      case 'On Hold': return { bg: '#F8D7DA', text: '#721c24' };
      default: return { bg: '#e2e3e5', text: '#383d41' };
    }
  };

  const statusColors = getStatusColors(jobSheet.status);

  // Format date: "26 Apr 2026, 10:30 AM"
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const options: Intl.DateTimeFormatOptions = { 
      day: 'numeric', 
      month: 'short', 
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    };
    return new Intl.DateTimeFormat('en-GB', options).format(date);
  };

  return (
    <TouchableOpacity 
      style={styles.card} 
      onPress={onPress}
      activeOpacity={onPress ? 0.7 : 1}
      disabled={!onPress}
    >
      <View style={styles.header}>
        <Text style={styles.registration}>{jobSheet.registration_number}</Text>
        <View style={[styles.badge, { backgroundColor: statusColors.bg }]}>
          <Text style={[styles.badgeText, { color: statusColors.text }]}>{jobSheet.status}</Text>
        </View>
      </View>

      <View style={styles.body}>
        <View style={styles.infoCol}>
          <Text style={styles.detailText}><Text style={styles.bold}>Customer:</Text> {jobSheet.customer_name} ({jobSheet.customer_mobile})</Text>
          <Text style={styles.detailText}><Text style={styles.bold}>Model:</Text> {jobSheet.machine_model}</Text>
          {jobSheet.assignee && (
            <Text style={styles.detailText}><Text style={styles.bold}>Assigned:</Text> {jobSheet.assignee.full_name || jobSheet.assignee.username}</Text>
          )}
          <Text style={styles.dateText}>{formatDate(jobSheet.entry_date_time)}</Text>
        </View>
        <View style={styles.arrowCol}>
          <Text style={styles.arrow}>❯</Text>
        </View>
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginVertical: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    borderWidth: 1,
    borderColor: '#eee',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  registration: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
  },
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  badgeText: {
    fontWeight: 'bold',
    fontSize: 12,
  },
  body: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  infoCol: {
    flex: 1,
  },
  arrowCol: {
    paddingLeft: 10,
    justifyContent: 'center',
  },
  detailText: {
    fontSize: 14,
    color: '#555',
    marginBottom: 4,
  },
  bold: {
    fontWeight: 'bold',
    color: '#333',
  },
  dateText: {
    fontSize: 12,
    color: '#888',
    marginTop: 4,
  },
  arrow: {
    fontSize: 18,
    color: '#ccc',
    fontWeight: 'bold',
  }
});
