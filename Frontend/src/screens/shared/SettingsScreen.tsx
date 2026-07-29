import React from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Alert, ScrollView, StatusBar, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useAuth } from '../../context/AuthContext';
import { RootStackParamList } from '../../types';
import { navigateBack } from '../../utils/navigationUtils';
import { colors, spacing, radius, typography } from '../../theme/tokens';
import { Icon } from '../../components/ui/Icon';
import { HeaderBar } from '../../components/ui/HeaderBar';
import { Card } from '../../components/ui/Card';

type NavigationProp = NativeStackNavigationProp<RootStackParamList, 'Settings'>;

export const SettingsScreen = () => {
  const navigation = useNavigation<NavigationProp>();
  const { profile, signOut } = useAuth();

  const handleLogout = () => {
    if (Platform.OS === 'web') {
      if (window.confirm('Are you sure you want to logout?')) signOut();
    } else {
      Alert.alert('Logout', 'Sure you want to logout?', [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Logout', style: 'destructive', onPress: signOut },
      ]);
    }
  };

  const initial = (profile?.full_name || profile?.username || '?').charAt(0).toUpperCase();
  const roleLabel = profile?.role === 'admin' ? 'Admin' : 'Technician';

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="light-content" backgroundColor={colors.headerBg} />
      <HeaderBar title="Settings" onBack={() => navigateBack(navigation)} />
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.avatarSection}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText} allowFontScaling={false}>{initial}</Text>
          </View>
          <Text style={styles.name} allowFontScaling={false}>{profile?.full_name || profile?.username || 'User'}</Text>
          <View style={styles.roleBadge}>
            <Text style={styles.roleBadgeText} allowFontScaling={false}>{roleLabel}</Text>
          </View>
        </View>

        <Card>
          <View style={styles.infoRow}>
            <View style={styles.infoLeft}>
              <Icon name="mail-outline" size={16} color={colors.textSecondary} />
              <Text style={styles.infoLabel} allowFontScaling={false}>Email</Text>
            </View>
            <Text style={styles.infoValue} allowFontScaling={false}>{profile?.email || 'N/A'}</Text>
          </View>
          <View style={styles.divider} />
          <View style={styles.infoRow}>
            <View style={styles.infoLeft}>
              <Icon name="call-outline" size={16} color={colors.textSecondary} />
              <Text style={styles.infoLabel} allowFontScaling={false}>Phone</Text>
            </View>
            <Text style={styles.infoValue} allowFontScaling={false}>{profile?.phone || 'N/A'}</Text>
          </View>
          <View style={styles.divider} />
          <View style={styles.infoRow}>
            <View style={styles.infoLeft}>
              <Icon name="at-outline" size={16} color={colors.textSecondary} />
              <Text style={styles.infoLabel} allowFontScaling={false}>Username</Text>
            </View>
            <Text style={styles.infoValue} allowFontScaling={false}>{profile?.username || 'N/A'}</Text>
          </View>
        </Card>

        <TouchableOpacity style={styles.menuBtn} onPress={() => navigation.navigate('EditProfile')} activeOpacity={0.7}>
          <View style={styles.menuLeft}>
            <Icon name="create-outline" size={20} color={colors.accent} />
            <Text style={styles.menuText} allowFontScaling={false}>Edit Profile</Text>
          </View>
          <Icon name="chevron-forward-outline" size={18} color={colors.textTertiary} />
        </TouchableOpacity>

        <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout} activeOpacity={0.7}>
          <Icon name="log-out-outline" size={20} color={colors.textInverse} />
          <Text style={styles.logoutText} allowFontScaling={false}>Logout</Text>
        </TouchableOpacity>

        <View style={styles.appInfo}>
          <Text style={styles.versionText} allowFontScaling={false}>MS JCB Services v1.0.0</Text>
          <Text style={styles.poweredText} allowFontScaling={false}>Powered by Anthropic AI</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.headerBg },
  content: { alignItems: 'center', padding: spacing.xl },
  avatarSection: { alignItems: 'center', marginBottom: spacing['3xl'], marginTop: spacing.md },
  avatar: {
    width: 80, height: 80, borderRadius: 40, backgroundColor: colors.accent,
    justifyContent: 'center', alignItems: 'center', marginBottom: spacing.md,
  },
  avatarText: { ...typography.title1, color: colors.headerBg },
  name: { ...typography.title2, color: colors.textPrimary, marginBottom: spacing.sm },
  roleBadge: { backgroundColor: colors.headerBg, paddingHorizontal: spacing.lg, paddingVertical: spacing.xs, borderRadius: radius.full },
  roleBadgeText: { ...typography.footnote, fontWeight: '700', color: colors.accent },
  infoRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: spacing.sm },
  infoLeft: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  infoLabel: { ...typography.subhead, color: colors.textSecondary },
  infoValue: { ...typography.subhead, color: colors.textPrimary, fontWeight: '500' },
  divider: { height: StyleSheet.hairlineWidth, backgroundColor: colors.border },
  menuBtn: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    backgroundColor: colors.surface, padding: spacing.lg, borderRadius: radius.lg,
    marginTop: spacing.xl, width: '100%', borderWidth: 1, borderColor: colors.border,
  },
  menuLeft: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  menuText: { ...typography.callout, fontWeight: '600', color: colors.textPrimary },
  logoutBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    backgroundColor: colors.error, padding: spacing.lg, borderRadius: radius.md,
    marginTop: spacing.md, width: '100%', gap: spacing.sm,
  },
  logoutText: { ...typography.callout, fontWeight: '600', color: colors.textInverse },
  appInfo: { alignItems: 'center', marginTop: spacing['4xl'] },
  versionText: { ...typography.footnote, color: colors.textTertiary },
  poweredText: { ...typography.caption2, color: colors.textTertiary, marginTop: 2 },
});
