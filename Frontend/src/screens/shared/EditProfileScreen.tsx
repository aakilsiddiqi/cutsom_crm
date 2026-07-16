import React, { useState } from 'react';
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity, ScrollView, Alert,
  ActivityIndicator, KeyboardAvoidingView, Platform, TouchableWithoutFeedback,
  Keyboard, StatusBar,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { useAuth } from '../../context/AuthContext';
import { supabase } from '../../services/supabase';
import { navigateBack } from '../../utils/navigationUtils';
import { colors, spacing, radius, typography } from '../../theme/tokens';
import { Icon } from '../../components/ui/Icon';
import { HeaderBar } from '../../components/ui/HeaderBar';
import { Card } from '../../components/ui/Card';

export const EditProfileScreen = () => {
  const navigation = useNavigation();
  const { profile, updateProfile } = useAuth();
  const [fullName, setFullName] = useState(profile?.full_name || '');
  const [phone, setPhone] = useState(profile?.phone || '');
  const [email, setEmail] = useState(profile?.email || '');
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const validate = () => {
    const e: Record<string, string> = {};
    if (fullName.trim().length < 3) e.fullName = 'Full name must be at least 3 characters.';
    if (phone.trim().length !== 10 || !/^\d+$/.test(phone.trim())) e.phone = 'Phone must be exactly 10 digits.';
    if (!email.includes('@') || !email.includes('.')) e.email = 'Enter a valid email address.';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSave = async () => {
    if (!validate() || !profile) return;
    setLoading(true);
    try {
      const trimmedEmail = email.trim().toLowerCase();
      if (trimmedEmail !== profile.email) {
        const { error: authError } = await supabase.auth.updateUser({ email: trimmedEmail });
        if (authError) throw authError;
      }
      const { error: profileError } = await supabase.from('profiles').update({
        full_name: fullName.trim(), phone: phone.trim(), email: trimmedEmail,
      }).eq('id', profile.id);
      if (profileError) throw profileError;
      updateProfile({ full_name: fullName.trim(), phone: phone.trim(), email: trimmedEmail });
      Alert.alert('Updated', 'Profile saved.', [{ text: 'OK', onPress: () => navigateBack(navigation) }]);
    } catch (error) {
      Alert.alert('Error', error instanceof Error ? error.message : 'Failed.');
    } finally { setLoading(false); }
  };

  const initial = (profile?.full_name || profile?.username || 'U').charAt(0).toUpperCase();

  const form = (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <HeaderBar title="Edit Profile" onBack={() => navigateBack(navigation)} />
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={styles.avatarSection}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText} allowFontScaling={false}>{initial}</Text>
          </View>
        </View>

        <Card>
          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel} allowFontScaling={false}>Username</Text>
            <View style={[styles.inputWrap, { backgroundColor: colors.bg }]}>
              <Icon name="at-outline" size={18} color={colors.textTertiary} />
              <TextInput
                style={[styles.fieldInput, { color: colors.textTertiary }]}
                value={profile?.username || ''}
                editable={false}
              />
            </View>
            <Text style={styles.helpText} allowFontScaling={false}>Username cannot be changed</Text>
          </View>

          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel} allowFontScaling={false}>Full Name</Text>
            <View style={[styles.inputWrap, errors.fullName && styles.inputError]}>
              <Icon name="person-outline" size={18} color={errors.fullName ? colors.error : colors.textTertiary} />
              <TextInput
                style={styles.fieldInput}
                placeholder="Enter full name"
                placeholderTextColor={colors.textTertiary}
                value={fullName}
                onChangeText={(t) => { setFullName(t); setErrors(prev => ({ ...prev, fullName: '' })); }}
              />
            </View>
            {errors.fullName && <Text style={styles.errorText} allowFontScaling={false}>{errors.fullName}</Text>}
          </View>

          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel} allowFontScaling={false}>Phone Number</Text>
            <View style={[styles.inputWrap, errors.phone && styles.inputError]}>
              <Icon name="call-outline" size={18} color={errors.phone ? colors.error : colors.textTertiary} />
              <TextInput
                style={styles.fieldInput}
                placeholder="10-digit number"
                placeholderTextColor={colors.textTertiary}
                keyboardType="phone-pad"
                maxLength={10}
                value={phone}
                onChangeText={(t) => { setPhone(t); setErrors(prev => ({ ...prev, phone: '' })); }}
              />
            </View>
            {errors.phone && <Text style={styles.errorText} allowFontScaling={false}>{errors.phone}</Text>}
          </View>

          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel} allowFontScaling={false}>Email Address</Text>
            <View style={[styles.inputWrap, errors.email && styles.inputError]}>
              <Icon name="mail-outline" size={18} color={errors.email ? colors.error : colors.textTertiary} />
              <TextInput
                style={styles.fieldInput}
                placeholder="Enter email"
                placeholderTextColor={colors.textTertiary}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                value={email}
                onChangeText={(t) => { setEmail(t); setErrors(prev => ({ ...prev, email: '' })); }}
              />
            </View>
            <Text style={[styles.helpText, { color: colors.warning }]} allowFontScaling={false}>Changing email requires re-login</Text>
            {errors.email && <Text style={styles.errorText} allowFontScaling={false}>{errors.email}</Text>}
          </View>
        </Card>

        <TouchableOpacity style={[styles.saveBtn, loading && { opacity: 0.6 }]} onPress={handleSave} disabled={loading} activeOpacity={0.8}>
          {loading ? <ActivityIndicator color={colors.headerBg} /> : (
            <View style={styles.saveContent}>
              <Icon name="checkmark-circle-outline" size={20} color={colors.headerBg} />
              <Text style={styles.saveText} allowFontScaling={false}>Save Changes</Text>
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

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.headerBg },
  content: { padding: spacing.lg, paddingBottom: 120 },
  avatarSection: { alignItems: 'center', marginVertical: spacing['2xl'] },
  avatar: {
    width: 80, height: 80, borderRadius: 40, backgroundColor: colors.accent,
    justifyContent: 'center', alignItems: 'center',
  },
  avatarText: { ...typography.title1, color: colors.headerBg },
  fieldGroup: { marginBottom: spacing.lg },
  fieldLabel: { ...typography.footnote, fontWeight: '600', color: colors.textSecondary, marginBottom: spacing.xs },
  inputWrap: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: colors.surface,
    borderWidth: 1, borderColor: colors.border, borderRadius: radius.md,
    paddingHorizontal: spacing.md, minHeight: 50, gap: spacing.sm,
  },
  inputError: { borderColor: colors.error },
  fieldInput: { flex: 1, ...typography.body, color: colors.textPrimary, paddingVertical: spacing.md },
  helpText: { ...typography.caption1, color: colors.textTertiary, marginTop: spacing.xs },
  errorText: { ...typography.caption1, color: colors.error, marginTop: spacing.xs },
  saveBtn: { backgroundColor: colors.accent, padding: spacing.lg, borderRadius: radius.md, marginTop: spacing.md, alignItems: 'center' },
  saveContent: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  saveText: { ...typography.headline, fontWeight: '700', color: colors.headerBg },
});
