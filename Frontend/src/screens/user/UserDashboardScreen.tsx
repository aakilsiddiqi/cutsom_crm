import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { supabase } from '../../services/supabase';

export const UserDashboardScreen = () => {
  const handleLogout = async () => {
    await supabase.auth.signOut();
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Technician Dashboard</Text>
      <Text style={styles.subtitle}>My Active Jobs</Text>
      
      <View style={styles.jobList}>
        <View style={styles.jobCard}>
          <Text style={styles.jobTitle}>JCB 3DX EcoXcellence - Service</Text>
          <Text style={styles.jobStatus}>In Progress</Text>
        </View>
        <View style={styles.jobCard}>
          <Text style={styles.jobTitle}>JCB JS205 - Hydraulic Repair</Text>
          <Text style={styles.jobStatus}>Pending Parts</Text>
        </View>
      </View>

      <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
        <Text style={styles.logoutText}>Log Out</Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    backgroundColor: '#f5f5f5',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginTop: 20,
    color: '#333',
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
    marginBottom: 20,
  },
  jobList: {
    flex: 1,
  },
  jobCard: {
    backgroundColor: '#fff',
    padding: 15,
    borderRadius: 8,
    marginBottom: 15,
    borderLeftWidth: 4,
    borderLeftColor: '#ffcc00',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  jobTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 5,
  },
  jobStatus: {
    fontSize: 14,
    color: '#e67e22',
  },
  logoutButton: {
    backgroundColor: '#e74c3c',
    padding: 15,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 20,
  },
  logoutText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 16,
  },
});
