import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  TouchableWithoutFeedback,
  Keyboard
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { useAuth } from '../../context/AuthContext';
import { supabase } from '../../services/supabase';
import { navigateBack } from '../../utils/navigationUtils';

export const EditProfileScreen = () => {
  const navigation = useNavigation();
  const { profile, updateProfile } = useAuth();

  const [fullName, setFullName] = useState(profile?.full_name || '');
  const [phone, setPhone] = useState(profile?.phone || '');
  const [email, setEmail] = useState(profile?.email || '');
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const validate = () => {
    const newErrors: Record<string, string> = {};

    if (fullName.trim().length < 3) {
      newErrors.fullName = 'Full name must be at least 3 characters.';
    }

    if (phone.trim().length !== 10 || !/^\d+$/.test(phone.trim())) {
      newErrors.phone = 'Phone number must be exactly 10 digits.';
    }

    if (!email.includes('@') || !email.includes('.')) {
      newErrors.email = 'Please enter a valid email address.';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSave = async () => {
    if (!validate() || !profile) return;

    setLoading(true);
    try {
      const trimmedEmail = email.trim().toLowerCase();
      const emailChanged = trimmedEmail !== profile.email;

      // Update auth user if email changed
      if (emailChanged) {
        const { error: authError } = await supabase.auth.updateUser({ email: trimmedEmail });
        if (authError) throw authError;
      }

      // Update profile
      const { error: profileError } = await supabase
        .from('profiles')
        .update({
          full_name: fullName.trim(),
          phone: phone.trim(),
          email: trimmedEmail,
        })
        .eq('id', profile.id);

      if (profileError) throw profileError;

      // Update local context
      updateProfile({
        full_name: fullName.trim(),
        phone: phone.trim(),
        email: trimmedEmail,
      });

      Alert.alert(
        '✅ Profile Updated',
        'Your profile has been saved successfully.',
        [{ text: 'OK', onPress: () => navigateBack(navigation) }]
      );
    } catch (error: any) {
      console.error('Error updating profile:', error);
      Alert.alert('Error', error.message || 'Failed to update profile.');
    } finally {
      setLoading(false);
    }
  };

  const initial = (profile?.full_name || profile?.username || 'U').charAt(0).toUpperCase();

  const content = (
    <KeyboardAvoidingView 
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <View style={styles.header}>
            <TouchableOpacity onPress={() => navigateBack(navigation)} style={styles.backButton}>
              <Text style={styles.backButtonText}>← Back</Text>
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Edit Profile</Text>
            <View style={{ width: 60 }} />
          </View>

          <ScrollView 
            contentContainerStyle={styles.content}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            <View style={styles.avatarContainer}>
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>{initial}</Text>
              </View>
            </View>

            {/* Username (Read Only) */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Username</Text>
              <TextInput
                style={[styles.input, styles.readOnlyInput]}
                value={profile?.username || ''}
                editable={false}
              />
              <Text style={styles.infoText}>Username cannot be changed</Text>
            </View>

            {/* Full Name */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Full Name</Text>
              <TextInput
                style={[styles.input, errors.fullName && styles.inputError]}
                placeholder="Enter full name"
                value={fullName}
                onChangeText={(text) => {
                  setFullName(text);
                  setErrors(prev => ({ ...prev, fullName: '' }));
                }}
              />
              {errors.fullName && <Text style={styles.errorText}>{errors.fullName}</Text>}
            </View>

            {/* Phone */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Phone Number</Text>
              <TextInput
                style={[styles.input, errors.phone && styles.inputError]}
                placeholder="10-digit phone number"
                keyboardType="numeric"
                maxLength={10}
                value={phone}
                onChangeText={(text) => {
                  setPhone(text);
                  setErrors(prev => ({ ...prev, phone: '' }));
                }}
              />
              {errors.phone && <Text style={styles.errorText}>{errors.phone}</Text>}
            </View>

            {/* Email */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Email Address</Text>
              <TextInput
                style={[styles.input, errors.email && styles.inputError]}
                placeholder="Enter email address"
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                value={email}
                onChangeText={(text) => {
                  setEmail(text);
                  setErrors(prev => ({ ...prev, email: '' }));
                }}
              />
              <Text style={styles.warningText}>⚠️ Changing email requires re-login to take effect</Text>
              {errors.email && <Text style={styles.errorText}>{errors.email}</Text>}
            </View>

            <TouchableOpacity
              style={[styles.submitButton, loading && styles.disabledButton]}
              onPress={handleSave}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="#1a1a2e" />
              ) : (
                <Text style={styles.submitButtonText}>Save Changes</Text>
              )}
            </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
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
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    backgroundColor: '#1a1a2e',
  },
  headerTitle: { color: '#fff', fontSize: 18, fontWeight: 'bold' },
  backButton: { padding: 8 },
  backButtonText: { color: '#fff', fontSize: 16 },
  content: { padding: 20, paddingBottom: 120, backgroundColor: '#f5f5f5', flexGrow: 1 },
  avatarContainer: { alignItems: 'center', marginVertical: 20 },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#FFD700',
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 3,
  },
  avatarText: { fontSize: 36, color: '#1a1a2e', fontWeight: 'bold' },
  inputGroup: { marginBottom: 20 },
  label: { fontSize: 14, fontWeight: '600', color: '#666', marginBottom: 8 },
  input: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    color: '#333',
  },
  readOnlyInput: { backgroundColor: '#f0f0f0', color: '#888' },
  inputError: { borderColor: '#dc3545' },
  errorText: { color: '#dc3545', fontSize: 12, marginTop: 4 },
  infoText: { color: '#888', fontSize: 12, marginTop: 4 },
  warningText: { color: '#856404', fontSize: 12, marginTop: 4, fontWeight: '500' },
  submitButton: {
    backgroundColor: '#FFD700',
    padding: 15,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 20,
    elevation: 2,
  },
  disabledButton: { opacity: 0.7 },
  submitButtonText: { color: '#1a1a2e', fontWeight: 'bold', fontSize: 17 },
});
