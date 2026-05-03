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
  SafeAreaView,
  KeyboardAvoidingView,
  Platform,
  Switch,
  TouchableWithoutFeedback,
  Keyboard,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { AdminStackParamList } from '../../types';
import { supabase } from '../../services/supabase';
import { supabaseAdmin } from '../../services/supabaseAdmin';

type NavigationProp = NativeStackNavigationProp<AdminStackParamList, 'AddTechnician'>;

export const AddTechnicianScreen = () => {
  const navigation = useNavigation<NavigationProp>();

  // Form state
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isActive, setIsActive] = useState(true);

  // UI state
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const validate = () => {
    const newErrors: Record<string, string> = {};

    if (fullName.trim().length < 3) {
      newErrors.fullName = 'Full name must be at least 3 characters.';
    }

    if (!email.includes('@') || !email.includes('.')) {
      newErrors.email = 'Please enter a valid email address.';
    }

    if (phone.trim().length !== 10 || !/^\d+$/.test(phone.trim())) {
      newErrors.phone = 'Phone number must be exactly 10 digits.';
    }

    if (username.trim().length < 3 || username.includes(' ')) {
      newErrors.username = 'Username must be 3+ chars and have no spaces.';
    }

    if (password.length < 8) {
      newErrors.password = 'Password must be at least 8 characters.';
    } else if (!/\d/.test(password)) {
      newErrors.password = 'Password must contain at least one number.';
    }

    if (password !== confirmPassword) {
      newErrors.confirmPassword = 'Passwords do not match.';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const getPasswordStrength = () => {
    if (password.length === 0) return null;
    if (password.length < 8) return 'Weak';
    const hasNumber = /\d/.test(password);
    const hasSpecial = /[!@#$%^&*(),.?":{}|<>]/.test(password);
    if (hasNumber && hasSpecial) return 'Strong';
    if (hasNumber) return 'Medium';
    return 'Weak';
  };

  const getStrengthColor = () => {
    const strength = getPasswordStrength();
    if (strength === 'Strong') return '#28a745';
    if (strength === 'Medium') return '#ffc107';
    return '#dc3545';
  };

  const handleCreateTechnician = async () => {
    if (!validate()) return;

    Alert.alert(
      'Confirm Creation',
      `Create technician account for ${fullName}?\nThey will use email ${email.toLowerCase()} to login.`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Create', onPress: performCreation }
      ]
    );
  };

  const performCreation = async () => {
    setLoading(true);
    try {
      // 1. Check if username already exists
      const { data: existingUser, error: checkError } = await supabase
        .from('profiles')
        .select('id')
        .eq('username', username.trim().toLowerCase())
        .maybeSingle();

      if (checkError) throw checkError;
      if (existingUser) {
        setErrors({ ...errors, username: 'This username is already taken.' });
        setLoading(false);
        return;
      }

      // 2. Create Auth User via Admin Client
      const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
        email: email.trim().toLowerCase(),
        password: password,
        email_confirm: true,
      });

      if (authError) {
        if (authError.message.includes('already registered')) {
          setErrors({ ...errors, email: 'This email is already registered.' });
        } else {
          throw authError;
        }
        setLoading(false);
        return;
      }

      if (!authData.user) throw new Error('Failed to create auth user');

      // 3. Insert Profile via Regular Client
      const { error: profileError } = await supabase
        .from('profiles')
        .insert({
          id: authData.user.id,
          username: username.trim().toLowerCase(),
          email: email.trim().toLowerCase(),
          full_name: fullName.trim(),
          role: 'user',
          phone: phone.trim(),
          is_active: isActive,
        });

      if (profileError) {
        // Rollback Auth User
        await supabaseAdmin.auth.admin.deleteUser(authData.user.id);
        throw profileError;
      }

      Alert.alert(
        '✅ Success',
        `${fullName} can now login with their email and password.`,
        [{ text: 'OK', onPress: () => navigation.navigate('AdminTabs') }]
      );
    } catch (error: any) {
      console.error('Error creating technician:', error);
      Alert.alert('Error', error.message || 'Failed to create account. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const strength = getPasswordStrength();

  const content = (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={{ flex: 1 }}
    >
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.backButton}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Add New Technician</Text>
        <View style={{ width: 50 }} />
      </View>

      <ScrollView style={styles.container} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        {/* Full Name */}
        <View style={styles.inputGroup}>
          <Text style={styles.label}>Full Name</Text>
          <TextInput
            style={[styles.input, errors.fullName && styles.inputError]}
            placeholder="Enter full name"
            value={fullName}
            onChangeText={setFullName}
          />
          {errors.fullName && <Text style={styles.errorText}>{errors.fullName}</Text>}
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
            onChangeText={setEmail}
          />
          {errors.email && <Text style={styles.errorText}>{errors.email}</Text>}
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
            onChangeText={setPhone}
          />
          {errors.phone && <Text style={styles.errorText}>{errors.phone}</Text>}
        </View>

        {/* Username */}
        <View style={styles.inputGroup}>
          <Text style={styles.label}>Username</Text>
          <TextInput
            style={[styles.input, errors.username && styles.inputError]}
            placeholder="e.g. ramesh_kumar"
            autoCapitalize="none"
            value={username}
            onChangeText={setUsername}
          />
          {errors.username && <Text style={styles.errorText}>{errors.username}</Text>}
        </View>

        {/* Password */}
        <View style={styles.inputGroup}>
          <Text style={styles.label}>Password</Text>
          <TextInput
            style={[styles.input, errors.password && styles.inputError]}
            placeholder="Minimum 8 characters"
            secureTextEntry
            value={password}
            onChangeText={setPassword}
          />
          {strength && (
            <View style={styles.strengthContainer}>
              <View style={[styles.strengthBar, { backgroundColor: getStrengthColor(), width: strength === 'Weak' ? '33%' : strength === 'Medium' ? '66%' : '100%' }]} />
              <Text style={[styles.strengthText, { color: getStrengthColor() }]}>{strength}</Text>
            </View>
          )}
          {errors.password && <Text style={styles.errorText}>{errors.password}</Text>}
        </View>

        {/* Confirm Password */}
        <View style={styles.inputGroup}>
          <Text style={styles.label}>Confirm Password</Text>
          <TextInput
            style={[styles.input, errors.confirmPassword && styles.inputError]}
            placeholder="Repeat password"
            secureTextEntry
            value={confirmPassword}
            onChangeText={setConfirmPassword}
          />
          {errors.confirmPassword && <Text style={styles.errorText}>{errors.confirmPassword}</Text>}
        </View>

        {/* Active Status */}
        <View style={[styles.inputGroup, styles.switchGroup]}>
          <View>
            <Text style={styles.label}>Active Status</Text>
            <Text style={styles.helperText}>Inactive technicians cannot login or be assigned jobs.</Text>
          </View>
          <Switch
            value={isActive}
            onValueChange={setIsActive}
            trackColor={{ false: '#767577', true: '#FFD700' }}
            thumbColor={isActive ? '#1a1a2e' : '#f4f3f4'}
          />
        </View>

        <TouchableOpacity
          style={[styles.submitButton, loading && styles.disabledButton]}
          onPress={handleCreateTechnician}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#1a1a2e" />
          ) : (
            <Text style={styles.submitButtonText}>Create Technician</Text>
          )}
        </TouchableOpacity>

        <View style={{ height: 40 }} />
      </ScrollView>
    </KeyboardAvoidingView>
  );

  return (
    <SafeAreaView style={styles.safeArea}>
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
  backButton: { color: '#fff', fontSize: 16 },
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  content: { padding: 20 },
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
  inputError: { borderColor: '#dc3545' },
  switchGroup: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#fff', padding: 16, borderRadius: 8, borderWidth: 1, borderColor: '#ddd' },
  helperText: { fontSize: 12, color: '#888', marginTop: 4, maxWidth: '90%' },
  errorText: { color: '#dc3545', fontSize: 12, marginTop: 4 },
  submitButton: {
    backgroundColor: '#FFD700',
    padding: 15,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 10,
    elevation: 2,
  },
  disabledButton: { opacity: 0.7 },
  submitButtonText: { color: '#1a1a2e', fontWeight: 'bold', fontSize: 17 },
  strengthContainer: { flexDirection: 'row', alignItems: 'center', marginTop: 8 },
  strengthBar: { height: 4, borderRadius: 2, marginRight: 8 },
  strengthText: { fontSize: 12, fontWeight: 'bold' },
});
