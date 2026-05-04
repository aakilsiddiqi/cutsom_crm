import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  Platform,
  ScrollView
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { supabase } from '../../services/supabase';
import { useAuth } from '../../context/AuthContext';
import { RootStackParamList } from '../../types';
import { navigateBack } from '../../utils/navigationUtils';

type NavigationProp = NativeStackNavigationProp<RootStackParamList, 'Settings'>;

export const SettingsScreen = () => {
  const navigation = useNavigation<NavigationProp>();
  const { profile, signOut } = useAuth();

  const handleLogout = () => {
    if (Platform.OS === 'web') {
      if (window.confirm('Are you sure you want to logout?')) {
        signOut();
      }
    } else {
      Alert.alert(
        'Logout',
        'Are you sure you want to logout?',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Logout',
            style: 'destructive',
            onPress: async () => {
              await signOut();
            }
          }
        ]
      );
    }
  };

  const firstLetter = profile?.full_name
    ? profile.full_name.charAt(0).toUpperCase()
    : profile?.username
      ? profile.username.charAt(0).toUpperCase()
      : '?';

  const roleBadgeText = profile?.role === 'admin' ? 'Admin' : 'Technician';

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <View style={styles.headerBar}>
        <TouchableOpacity activeOpacity={0.7} onPress={() => navigateBack(navigation)}>
          <Text style={styles.backButton}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Settings</Text>
        <View style={{ width: 50 }} />
      </View>

      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        {/* Avatar */}
        <View style={styles.avatarContainer}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{firstLetter}</Text>
          </View>
          <Text style={styles.fullName}>{profile?.full_name || profile?.username || 'User'}</Text>
          <View style={styles.roleBadge}>
            <Text style={styles.roleBadgeText}>{roleBadgeText}</Text>
          </View>
        </View>

        {/* Profile Settings */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle} allowFontScaling={false}>Profile Settings</Text>
          <TouchableOpacity 
            style={styles.actionButton}
            onPress={() => navigation.navigate('EditProfile')}
          >
            <Text style={styles.actionButtonIcon} allowFontScaling={false}>✏️</Text>
            <Text style={styles.actionButtonText} allowFontScaling={false}>Edit Profile</Text>
          </TouchableOpacity>
        </View>

        {/* Support Section */}
        <View style={styles.infoCard}>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Email</Text>
            <Text style={styles.infoValue}>{profile?.email || 'N/A'}</Text>
          </View>
          <View style={styles.divider} />
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Phone</Text>
            <Text style={styles.infoValue}>{profile?.phone || 'N/A'}</Text>
          </View>
          <View style={styles.divider} />
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Username</Text>
            <Text style={styles.infoValue}>{profile?.username || 'N/A'}</Text>
          </View>
        </View>

        {/* Edit Profile Button */}
        <TouchableOpacity 
          style={styles.editButton} 
          activeOpacity={0.7} 
          onPress={() => navigation.navigate('EditProfile')}
        >
          <Text style={styles.editButtonText}>✏️ Edit Profile</Text>
        </TouchableOpacity>

        {/* Logout Button */}
        <TouchableOpacity style={styles.logoutButton} activeOpacity={0.7} onPress={handleLogout}>
          <Text style={styles.logoutButtonText}>Logout</Text>
        </TouchableOpacity>

        {/* App Info */}
        <View style={styles.appInfo}>
          <Text style={styles.appVersion}>JCB Workshop CRM v1.0.0</Text>
          <Text style={styles.poweredBy}>Powered by Anthropic AI</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#1a1a2e' },
  headerBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16, backgroundColor: '#1a1a2e' },
  headerTitle: { color: '#fff', fontSize: 20, fontWeight: 'bold' },
  backButton: { color: '#fff', fontSize: 16 },
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  content: { padding: 20, alignItems: 'center' },
  avatarContainer: { alignItems: 'center', marginBottom: 30, marginTop: 10 },
  avatar: { width: 80, height: 80, borderRadius: 40, backgroundColor: '#FFD700', justifyContent: 'center', alignItems: 'center', marginBottom: 12 },
  avatarText: { fontSize: 36, fontWeight: 'bold', color: '#1a1a2e' },
  fullName: { fontSize: 22, fontWeight: 'bold', color: '#333', marginBottom: 8 },
  roleBadge: { backgroundColor: '#1a1a2e', paddingHorizontal: 14, paddingVertical: 4, borderRadius: 12 },
  roleBadgeText: { color: '#FFD700', fontWeight: 'bold', fontSize: 13 },
  infoCard: { backgroundColor: '#fff', borderRadius: 12, padding: 16, width: '100%', marginBottom: 30, elevation: 2 },
  infoRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 10 },
  infoLabel: { color: '#888', fontSize: 15 },
  infoValue: { color: '#333', fontSize: 15, fontWeight: '500' },
  divider: { height: 1, backgroundColor: '#f0f0f0' },
  editButton: { backgroundColor: '#FFD700', paddingVertical: 16, borderRadius: 10, width: '100%', alignItems: 'center', marginBottom: 16 },
  editButtonText: { color: '#1a1a2e', fontWeight: 'bold', fontSize: 17 },
  logoutButton: { backgroundColor: '#e74c3c', paddingVertical: 16, borderRadius: 10, width: '100%', alignItems: 'center', marginBottom: 40 },
  logoutButtonText: { color: '#fff', fontWeight: 'bold', fontSize: 17 },
  section: { width: '100%', marginBottom: 20 },
  sectionTitle: { fontSize: 16, fontWeight: 'bold', color: '#555', marginBottom: 12, marginLeft: 4 },
  actionButton: { flexDirection: 'row', backgroundColor: '#fff', padding: 16, borderRadius: 12, alignItems: 'center', elevation: 2 },
  actionButtonIcon: { fontSize: 20, marginRight: 12 },
  actionButtonText: { fontSize: 16, fontWeight: '600', color: '#333' },
  appInfo: { alignItems: 'center' },
  appVersion: { color: '#888', fontSize: 14, marginBottom: 4 },
  poweredBy: { color: '#aaa', fontSize: 12 },
});
