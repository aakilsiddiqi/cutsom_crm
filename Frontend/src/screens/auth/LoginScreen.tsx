import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  TouchableOpacity,
  Animated,
  StatusBar,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '../../services/supabase';
import { useAuth } from '../../context/AuthContext';
import { colors, typography, radius, spacing, shadows } from '../../theme/tokens';
import { Icon } from '../../components/ui/Icon';

export const LoginScreen = () => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const { session, profile, loading: authLoading, fetchProfile, signOut } = useAuth();

  // Animations
  const brandFade = useRef(new Animated.Value(0)).current;
  const brandSlide = useRef(new Animated.Value(30)).current;
  const formFade = useRef(new Animated.Value(0)).current;
  const formSlide = useRef(new Animated.Value(40)).current;
  const glowAnim = useRef(new Animated.Value(0.3)).current;

  useEffect(() => {
    // Staggered entrance animation
    Animated.sequence([
      Animated.parallel([
        Animated.timing(brandFade, {
          toValue: 1,
          duration: 800,
          useNativeDriver: true,
        }),
        Animated.spring(brandSlide, {
          toValue: 0,
          speed: 50,
          bounciness: 8,
          useNativeDriver: true,
        }),
      ]),
      Animated.parallel([
        Animated.timing(formFade, {
          toValue: 1,
          duration: 600,
          useNativeDriver: true,
        }),
        Animated.spring(formSlide, {
          toValue: 0,
          speed: 50,
          bounciness: 6,
          useNativeDriver: true,
        }),
      ]),
    ]).start();

    // Subtle glow pulse on the brand badge
    Animated.loop(
      Animated.sequence([
        Animated.timing(glowAnim, {
          toValue: 0.6,
          duration: 2000,
          useNativeDriver: true,
        }),
        Animated.timing(glowAnim, {
          toValue: 0.3,
          duration: 2000,
          useNativeDriver: true,
        }),
      ])
    ).start();
  }, []);

  const handleLogin = async () => {
    if (!username.trim() || !password) {
      setLoginError('Please enter both username and password');
      return;
    }

    setLoading(true);
    setLoginError(null);
    try {
      const { data: emailData, error: lookupError } = await supabase
        .rpc('get_user_email_by_username', { p_username: username.trim().toLowerCase() });

      if (lookupError || !emailData) {
        setLoginError('Username not found. Please check your username.');
        setLoading(false);
        return;
      }

      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: emailData,
        password,
      });

      if (signInError) {
        setLoginError('Incorrect password. Please try again.');
      }
    } catch {
      setLoginError('Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = () => {
    Alert.alert("Reset Password", "Please contact your administrator to reset your password.");
  };

  const handleRetryProfile = async () => {
    if (session) {
      await fetchProfile(session.user.id);
    }
  };

  // If logged in but profile is missing
  if (session && !authLoading && !profile) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <StatusBar barStyle="light-content" />
        <View style={styles.profileMissingContainer}>
          <View style={styles.profileMissingCard}>
            <View style={styles.errorIconWrap}>
              <Icon name="alert-circle" size={40} color={colors.error} />
            </View>
            <Text style={styles.profileMissingTitle}>Profile Not Found</Text>
            <Text style={styles.profileMissingMsg}>
              Login successful but profile not found.{'\n'}
              Please check your internet connection and try again.{'\n'}
              If the problem persists, contact your administrator.
            </Text>
            <TouchableOpacity
              style={styles.retryButton}
              onPress={handleRetryProfile}
              activeOpacity={0.8}
            >
              <Icon name="refresh" size={20} color="#000" />
              <Text style={styles.retryButtonText}>Try Again</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.signOutButton}
              onPress={() => signOut()}
              activeOpacity={0.8}
            >
              <Text style={styles.signOutButtonText}>Back to Login</Text>
            </TouchableOpacity>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />

      {/* Hero Background - Gradient layers */}
      <View style={styles.heroBackground}>
        <View style={styles.heroLayer1} />
        <View style={styles.heroLayer2} />
        <View style={styles.heroLayer3} />
        <View style={styles.heroOverlay} />
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="always"
          bounces={false}
          showsVerticalScrollIndicator={false}
        >
          {/* Brand Section - Animated */}
          <Animated.View
            style={[
              styles.brandSection,
              {
                opacity: brandFade,
                transform: [{ translateY: brandSlide }],
              },
            ]}
          >
            <Animated.View style={[styles.brandBadge, { opacity: glowAnim }]}>
              <View style={styles.brandBadgeInner}>
                <Icon name="construct" size={32} color="#000" />
              </View>
            </Animated.View>
            <Text style={styles.brandTitle}>MS JCB</Text>
            <Text style={styles.brandSubtitle}>Services</Text>
            <View style={styles.brandDivider} />
            <Text style={styles.brandTagline}>Workshop Management System</Text>
          </Animated.View>

          {/* Form Section - Glassmorphism */}
          <Animated.View
            style={[
              styles.formWrapper,
              {
                opacity: formFade,
                transform: [{ translateY: formSlide }],
              },
            ]}
          >
            <View style={styles.glassCard}>
              {/* Glassmorphism layers */}
              <View style={styles.glassShine} />

              <Text style={styles.formTitle}>Welcome back</Text>
              <Text style={styles.formSubtitle}>Sign in to continue to your account</Text>

              {/* Username Input */}
              <View style={styles.inputContainer}>
                <View style={[styles.inputRow, loginError && styles.inputError]}>
                  <Icon
                    name="person-outline"
                    size={20}
                    color={username ? colors.accent : colors.textTertiary}
                  />
                  <TextInput
                    style={styles.textInput}
                    value={username}
                    onChangeText={(text) => {
                      setUsername(text);
                      setLoginError(null);
                    }}
                    placeholder="Username"
                    placeholderTextColor={colors.textTertiary}
                    autoCapitalize="none"
                    autoCorrect={false}
                    returnKeyType="next"
                  />
                  {username.length > 0 && (
                    <TouchableOpacity onPress={() => setUsername('')} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                      <Icon name="close-circle" size={18} color={colors.textTertiary} />
                    </TouchableOpacity>
                  )}
                </View>
              </View>

              {/* Password Input */}
              <View style={styles.inputContainer}>
                <View style={[styles.inputRow, loginError && styles.inputError]}>
                  <Icon
                    name="lock-closed-outline"
                    size={20}
                    color={password ? colors.accent : colors.textTertiary}
                  />
                  <TextInput
                    style={styles.textInput}
                    value={password}
                    onChangeText={(text) => {
                      setPassword(text);
                      setLoginError(null);
                    }}
                    placeholder="Password"
                    placeholderTextColor={colors.textTertiary}
                    secureTextEntry={!showPassword}
                    returnKeyType="go"
                    onSubmitEditing={handleLogin}
                  />
                  <TouchableOpacity
                    onPress={() => setShowPassword(!showPassword)}
                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                  >
                    <Icon
                      name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                      size={20}
                      color={colors.textTertiary}
                    />
                  </TouchableOpacity>
                </View>
              </View>

              {/* Error Banner */}
              {loginError && (
                <View style={styles.errorBanner}>
                  <Icon name="alert-circle" size={16} color={colors.error} />
                  <Text style={styles.errorText}>{loginError}</Text>
                </View>
              )}

              {/* Remember Me + Forgot Password */}
              <View style={styles.optionsRow}>
                <TouchableOpacity
                  style={styles.rememberRow}
                  onPress={() => setRememberMe(!rememberMe)}
                  activeOpacity={0.7}
                >
                  <View style={[styles.checkbox, rememberMe && styles.checkboxActive]}>
                    {rememberMe && <Icon name="checkmark" size={14} color="#000" />}
                  </View>
                  <Text style={styles.rememberText}>Remember me</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={handleForgotPassword} activeOpacity={0.7}>
                  <Text style={styles.forgotText}>Forgot Password?</Text>
                </TouchableOpacity>
              </View>

              {/* Sign In Button */}
              <TouchableOpacity
                style={[styles.signInButton, loading && styles.signInButtonLoading]}
                onPress={handleLogin}
                disabled={loading}
                activeOpacity={0.85}
              >
                {loading ? (
                  <ActivityIndicator color="#000" size="small" />
                ) : (
                  <>
                    <Text style={styles.signInButtonText}>Sign In</Text>
                    <Icon name="arrow-forward" size={20} color="#000" />
                  </>
                )}
              </TouchableOpacity>

              {/* Footer */}
              <View style={styles.footerRow}>
                <View style={styles.footerDot} />
                <Text style={styles.footerText}>Secure</Text>
                <View style={styles.footerDot} />
                <Text style={styles.footerText}>Fast</Text>
                <View style={styles.footerDot} />
                <Text style={styles.footerText}>Reliable</Text>
                <View style={styles.footerDot} />
              </View>
            </View>
          </Animated.View>

          {/* Bottom Spacer */}
          <View style={styles.bottomSpacer} />
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  container: {
    flex: 1,
  },
  // Hero Background
  heroBackground: {
    ...StyleSheet.absoluteFillObject,
  },
  heroLayer1: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#1a1a2e',
  },
  heroLayer2: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#16213e',
    opacity: 0.8,
  },
  heroLayer3: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#0f3460',
    opacity: 0.4,
  },
  heroOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.15)',
  },
  keyboardView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: spacing.xl,
    paddingTop: Platform.OS === 'ios' ? 60 : 50,
  },
  // Brand Section
  brandSection: {
    alignItems: 'center',
    marginBottom: spacing['4xl'],
  },
  brandBadge: {
    width: 80,
    height: 80,
    borderRadius: 24,
    backgroundColor: colors.accent,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.xl,
    shadowColor: colors.accent,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 20,
    elevation: 12,
  },
  brandBadgeInner: {
    width: 72,
    height: 72,
    borderRadius: 20,
    backgroundColor: colors.accent,
    justifyContent: 'center',
    alignItems: 'center',
  },
  brandTitle: {
    fontSize: 36,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: 2,
    marginBottom: spacing.xs,
  },
  brandSubtitle: {
    fontSize: 24,
    fontWeight: '300',
    color: colors.accent,
    letterSpacing: 6,
    textTransform: 'uppercase',
    marginBottom: spacing.lg,
  },
  brandDivider: {
    width: 40,
    height: 2,
    backgroundColor: colors.accent,
    marginBottom: spacing.lg,
    opacity: 0.6,
  },
  brandTagline: {
    fontSize: 14,
    fontWeight: '400',
    color: 'rgba(255,255,255,0.6)',
    letterSpacing: 1,
  },
  // Glassmorphism Card
  formWrapper: {
    marginBottom: spacing['2xl'],
  },
  glassCard: {
    backgroundColor: 'rgba(255,255,255,0.95)',
    borderRadius: 24,
    padding: spacing['2xl'],
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 24,
    elevation: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
    overflow: 'hidden',
  },
  glassShine: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.6)',
  },
  formTitle: {
    fontSize: 28,
    fontWeight: '700',
    color: '#1C1C1E',
    marginBottom: spacing.xs,
  },
  formSubtitle: {
    fontSize: 15,
    color: '#8E8E93',
    marginBottom: spacing.xl,
  },
  // Inputs
  inputContainer: {
    marginBottom: spacing.md,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F5F5F7',
    borderRadius: 14,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderWidth: 1.5,
    borderColor: 'transparent',
  },
  inputError: {
    borderColor: colors.error,
    backgroundColor: '#FFF0EF',
  },
  textInput: {
    flex: 1,
    fontSize: 16,
    fontWeight: '400',
    color: '#1C1C1E',
    marginLeft: spacing.md,
    paddingVertical: 2,
  },
  // Error
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF0EF',
    padding: spacing.md,
    borderRadius: 12,
    marginBottom: spacing.lg,
    gap: spacing.sm,
    borderWidth: 1,
    borderColor: '#FFD4D2',
  },
  errorText: {
    fontSize: 13,
    color: colors.error,
    fontWeight: '500',
    flex: 1,
  },
  // Options Row
  optionsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.xl,
  },
  rememberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: '#D1D1D6',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
  },
  checkboxActive: {
    backgroundColor: colors.accent,
    borderColor: colors.accent,
  },
  rememberText: {
    fontSize: 14,
    color: '#8E8E93',
    fontWeight: '400',
  },
  forgotText: {
    fontSize: 14,
    color: colors.accent,
    fontWeight: '600',
  },
  // Sign In Button
  signInButton: {
    backgroundColor: colors.accent,
    borderRadius: 14,
    paddingVertical: spacing.lg,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: spacing.sm,
    shadowColor: colors.accent,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 6,
  },
  signInButtonLoading: {
    opacity: 0.7,
  },
  signInButtonText: {
    fontSize: 17,
    fontWeight: '700',
    color: '#000',
    letterSpacing: 0.5,
  },
  // Footer
  footerRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: spacing.xl,
    gap: spacing.sm,
  },
  footerDot: {
    width: 3,
    height: 3,
    borderRadius: 1.5,
    backgroundColor: '#C7C7CC',
  },
  footerText: {
    fontSize: 12,
    color: '#C7C7CC',
    fontWeight: '500',
    letterSpacing: 0.5,
  },
  bottomSpacer: {
    height: spacing['3xl'],
  },
  // Profile Missing State
  profileMissingContainer: {
    flex: 1,
    backgroundColor: colors.bg,
    justifyContent: 'center',
    paddingHorizontal: spacing['2xl'],
  },
  profileMissingCard: {
    backgroundColor: colors.surface,
    borderRadius: 24,
    padding: spacing['3xl'],
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 16,
    elevation: 8,
    borderWidth: 1,
    borderColor: colors.border,
  },
  errorIconWrap: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: '#FFF0EF',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.lg,
  },
  profileMissingTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#1C1C1E',
    marginBottom: spacing.sm,
  },
  profileMissingMsg: {
    fontSize: 15,
    color: '#8E8E93',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: spacing['2xl'],
  },
  retryButton: {
    backgroundColor: colors.accent,
    borderRadius: 14,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xl,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    width: '100%',
    justifyContent: 'center',
    shadowColor: colors.accent,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  retryButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#000',
  },
  signOutButton: {
    marginTop: spacing.md,
    paddingVertical: spacing.md,
    width: '100%',
    alignItems: 'center',
  },
  signOutButtonText: {
    fontSize: 15,
    color: '#8E8E93',
    fontWeight: '500',
  },
});
