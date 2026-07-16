import React, { useState } from 'react';
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity, ScrollView, Alert,
  ActivityIndicator, KeyboardAvoidingView, Platform, Switch,
  TouchableWithoutFeedback, Keyboard, StatusBar,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { AdminStackParamList } from '../../types';
import { supabase } from '../../services/supabase';
import { supabaseAdmin } from '../../services/supabaseAdmin';
import { navigateToDashboard, navigateBack } from '../../utils/navigationUtils';
import { colors, spacing, radius, typography } from '../../theme/tokens';
import { Icon } from '../../components/ui/Icon';
import { HeaderBar } from '../../components/ui/HeaderBar';
import { Card } from '../../components/ui/Card';

type NavigationProp = NativeStackNavigationProp<AdminStackParamList, 'AddTechnician'>;

export const AddTechnicianScreen = () => {
  const navigation = useNavigation<NavigationProp>();
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isActive, setIsActive] = useState(true);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const validate = () => {
    const e: Record<string, string> = {};
    if (fullName.trim().length < 3) e.fullName = 'Full name must be at least 3 characters.';
    if (!email.includes('@') || !email.includes('.')) e.email = 'Enter a valid email address.';
    if (phone.trim().length !== 10 || !/^\d+$/.test(phone.trim())) e.phone = 'Phone number must be exactly 10 digits.';
    if (username.trim().length < 3 || username.includes(' ')) e.username = 'Username must be 3+ chars, no spaces.';
    if (password.length < 8) e.password = 'Password must be at least 8 characters.';
    else if (!/\d/.test(password)) e.password = 'Password must contain at least one number.';
    if (password !== confirmPassword) e.confirmPassword = 'Passwords do not match.';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const getStrength = (): { label: string; color: string; width: string } | null => {
    if (!password) return null;
    if (password.length < 8) return { label: 'Weak', color: colors.error, width: '33%' };
    const hasNumber = /\d/.test(password);
    const hasSpecial = /[!@#$%^&*(),.?":{}|<>]/.test(password);
    if (hasNumber && hasSpecial) return { label: 'Strong', color: colors.success, width: '100%' };
    if (hasNumber) return { label: 'Medium', color: colors.warning, width: '66%' };
    return { label: 'Weak', color: colors.error, width: '33%' };
  };

  const handleSubmit = async () => {
    if (!validate()) return;
    Alert.alert('Confirm', `Create account for ${fullName}?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Create', onPress: createUser },
    ]);
  };

  const createUser = async () => {
    setLoading(true);
    try {
      const { data: existing } = await supabase.from('profiles').select('id').eq('username', username.trim().toLowerCase()).maybeSingle();
      if (existing) { setErrors({ ...errors, username: 'Username taken.' }); setLoading(false); return; }
      const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
        email: email.trim().toLowerCase(), password, email_confirm: true,
      });
      if (authError) {
        if (authError.message.includes('already registered')) setErrors({ ...errors, email: 'Email already registered.' });
        else throw authError;
        setLoading(false); return;
      }
      if (!authData.user) throw new Error('Failed to create user');
      const { error: profileError } = await supabase.from('profiles').insert({
        id: authData.user.id, username: username.trim().toLowerCase(), email: email.trim().toLowerCase(),
        full_name: fullName.trim(), role: 'user', phone: phone.trim(), is_active: isActive,
      });
      if (profileError) { await supabaseAdmin.auth.admin.deleteUser(authData.user.id); throw profileError; }
      Alert.alert('Success', `${fullName} can now login.`, [{ text: 'OK', onPress: () => navigateToDashboard(navigation, 'admin') }]);
    } catch (error) {
      Alert.alert('Error', error instanceof Error ? error.message : 'Failed.');
    } finally { setLoading(false); }
  };

  const strength = getStrength();

  const form = (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <HeaderBar title="Add Technician" onBack={() => navigateBack(navigation)} />
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Card>
          <Field label="Full Name" value={fullName} onChange={setFullName} error={errors.fullName} icon="person-outline" />
          <Field label="Email Address" value={email} onChange={setEmail} error={errors.email} keyboard="email-address" autoCap="none" icon="mail-outline" />
          <Field label="Phone Number" value={phone} onChange={setPhone} error={errors.phone} keyboard="phone-pad" maxLen={10} icon="call-outline" />
          <Field label="Username" value={username} onChange={setUsername} error={errors.username} autoCap="none" icon="at-outline" />
          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel} allowFontScaling={false}>Password</Text>
            <View style={[styles.inputWrap, errors.password && styles.inputError]}>
              <Icon name="lock-closed-outline" size={18} color={errors.password ? colors.error : colors.textTertiary} />
              <TextInput
                style={styles.fieldInput}
                placeholder="Min 8 characters"
                placeholderTextColor={colors.textTertiary}
                secureTextEntry
                value={password}
                onChangeText={setPassword}
              />
            </View>
            {strength && (
              <View style={styles.strengthRow}>
                <View style={[styles.strengthBar, { backgroundColor: strength.color, width: strength.width as any }]} />
                <Text style={[styles.strengthText, { color: strength.color }]} allowFontScaling={false}>{strength.label}</Text>
              </View>
            )}
            {errors.password && <Text style={styles.errorText} allowFontScaling={false}>{errors.password}</Text>}
          </View>
          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel} allowFontScaling={false}>Confirm Password</Text>
            <View style={[styles.inputWrap, errors.confirmPassword && styles.inputError]}>
              <Icon name="lock-closed-outline" size={18} color={errors.confirmPassword ? colors.error : colors.textTertiary} />
              <TextInput
                style={styles.fieldInput}
                placeholder="Repeat password"
                placeholderTextColor={colors.textTertiary}
                secureTextEntry
                value={confirmPassword}
                onChangeText={setConfirmPassword}
              />
            </View>
            {errors.confirmPassword && <Text style={styles.errorText} allowFontScaling={false}>{errors.confirmPassword}</Text>}
          </View>
          <View style={styles.switchRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.fieldLabel} allowFontScaling={false}>Active Status</Text>
              <Text style={styles.helperText} allowFontScaling={false}>Inactive users cannot login or be assigned jobs.</Text>
            </View>
            <Switch
              value={isActive}
              onValueChange={setIsActive}
              trackColor={{ false: colors.border, true: colors.accent }}
              thumbColor={isActive ? colors.headerBg : colors.textTertiary}
            />
          </View>
        </Card>
        <TouchableOpacity style={[styles.submitBtn, loading && { opacity: 0.6 }]} onPress={handleSubmit} disabled={loading} activeOpacity={0.8}>
          {loading ? <ActivityIndicator color={colors.headerBg} /> : (
            <View style={styles.submitContent}>
              <Icon name="checkmark-circle-outline" size={20} color={colors.headerBg} />
              <Text style={styles.submitText} allowFontScaling={false}>Create Technician</Text>
            </View>
          )}
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="light-content" backgroundColor={colors.headerBg} />
      {Platform.OS === 'web' ? form : <TouchableWithoutFeedback onPress={Keyboard.dismiss}>{form}</TouchableWithoutFeedback>}
    </SafeAreaView>
  );
};

const Field = ({
  label, value, onChange, error, keyboard, autoCap, maxLen, icon,
}: {
  label: string; value: string; onChange: (v: string) => void; error?: string;
  keyboard?: 'email-address' | 'phone-pad'; autoCap?: 'none'; maxLen?: number; icon: React.ComponentProps<typeof Icon>['name'];
}) => (
  <View style={styles.fieldGroup}>
    <Text style={styles.fieldLabel} allowFontScaling={false}>{label}</Text>
    <View style={[styles.inputWrap, error && styles.inputError]}>
      <Icon name={icon} size={18} color={error ? colors.error : colors.textTertiary} />
      <TextInput
        style={styles.fieldInput}
        value={value}
        onChangeText={onChange}
        placeholderTextColor={colors.textTertiary}
        keyboardType={keyboard}
        autoCapitalize={autoCap}
        autoCorrect={false}
        maxLength={maxLen}
      />
    </View>
    {error && <Text style={styles.errorText} allowFontScaling={false}>{error}</Text>}
  </View>
);

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.headerBg },
  content: { padding: spacing.lg, paddingBottom: 120 },
  fieldGroup: { marginBottom: spacing.lg },
  fieldLabel: { ...typography.footnote, fontWeight: '600', color: colors.textSecondary, marginBottom: spacing.xs },
  inputWrap: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: colors.surface,
    borderWidth: 1, borderColor: colors.border, borderRadius: radius.md,
    paddingHorizontal: spacing.md, minHeight: 50, gap: spacing.sm,
  },
  inputError: { borderColor: colors.error },
  fieldInput: { flex: 1, ...typography.body, color: colors.textPrimary, paddingVertical: spacing.md },
  errorText: { ...typography.caption1, color: colors.error, marginTop: spacing.xs },
  strengthRow: { flexDirection: 'row', alignItems: 'center', marginTop: spacing.sm, gap: spacing.sm },
  strengthBar: { height: 4, borderRadius: 2 },
  strengthText: { ...typography.caption2, fontWeight: '700' },
  switchRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingVertical: spacing.sm,
  },
  helperText: { ...typography.caption1, color: colors.textTertiary, marginTop: 2 },
  submitBtn: { backgroundColor: colors.accent, padding: spacing.lg, borderRadius: radius.md, marginTop: spacing.md, alignItems: 'center' },
  submitContent: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  submitText: { ...typography.headline, fontWeight: '700', color: colors.headerBg },
});
