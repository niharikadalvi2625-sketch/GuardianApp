import React, { useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  ScrollView,
  StatusBar,
  TextInput,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AuthService } from '../services/authService';
import { CloudSyncService } from '../services/cloudSyncService';
import { AlertService } from '../services/alertService';
import { AuthUser } from '../types';

const THEME = {
  primary: '#E63946',
  primaryDark: '#B71C1C',
  googleBlue: '#4285F4',
  background: '#0F172A', // Dark modern security aesthetic
  cardBg: '#1E293B',
  cardBgLight: '#334155',
  textPrimary: '#FFFFFF',
  textSecondary: '#94A3B8',
  textLight: '#64748B',
  border: '#334155',
  safeGreen: '#10B981',
};

interface WelcomeAuthScreenProps {
  onLoginSuccess: (user: AuthUser) => void;
}

export default function WelcomeAuthScreen({ onLoginSuccess }: WelcomeAuthScreenProps) {
  const [authMode, setAuthMode] = useState<'main' | 'phone' | 'email'>('main');
  const [loading, setLoading] = useState<boolean>(false);

  // Phone input state
  const [phoneNumber, setPhoneNumber] = useState<string>('');
  const [otpCode, setOtpCode] = useState<string>('');
  const [otpSent, setOtpSent] = useState<boolean>(false);
  const [simulatedOtp, setSimulatedOtp] = useState<string>('');

  // Email input state
  const [isSignUp, setIsSignUp] = useState<boolean>(false);
  const [emailName, setEmailName] = useState<string>('');
  const [email, setEmail] = useState<string>('');
  const [password, setPassword] = useState<string>('');

  const handleGoogleSignIn = async () => {
    setLoading(true);
    try {
      AlertService.triggerHaptic();
      const res = await AuthService.signInWithGoogle();
      if (res.success) {
        await CloudSyncService.restoreFromCloud();
        onLoginSuccess(res.user);
      }
    } catch {
      Alert.alert('Error', 'Google Sign-In failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleSendOtp = async () => {
    if (phoneNumber.trim().length < 10) {
      Alert.alert('Invalid Mobile', 'Please enter a valid 10-digit mobile number.');
      return;
    }
    setLoading(true);
    try {
      AlertService.triggerHaptic();
      const res = await AuthService.sendPhoneOtp(phoneNumber.trim());
      if (res.success) {
        setOtpSent(true);
        setSimulatedOtp(res.simulatedOtp);
        setOtpCode(res.simulatedOtp);
        Alert.alert('Verification Code Sent', res.message);
      } else {
        Alert.alert('Notice', res.message);
      }
    } catch {
      Alert.alert('Error', 'Could not send verification code.');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async () => {
    if (!otpCode.trim()) {
      Alert.alert('Enter OTP', 'Please enter the 6-digit verification code.');
      return;
    }
    setLoading(true);
    try {
      AlertService.triggerHaptic();
      const res = await AuthService.verifyPhoneOtp(phoneNumber.trim(), otpCode.trim());
      if (res.success && res.user) {
        onLoginSuccess(res.user);
      } else {
        Alert.alert('Verification Failed', res.message);
      }
    } catch {
      Alert.alert('Error', 'OTP verification failed.');
    } finally {
      setLoading(false);
    }
  };

  const handleEmailAuth = async () => {
    if (!email.trim() || !password.trim()) {
      Alert.alert('Missing Info', 'Please enter your email and password.');
      return;
    }
    setLoading(true);
    try {
      AlertService.triggerHaptic();
      let res;
      if (isSignUp) {
        res = await AuthService.signUpWithEmail(emailName.trim() || 'Guardian User', email.trim(), password.trim());
      } else {
        res = await AuthService.signInWithEmail(email.trim(), password.trim());
      }

      if (res.success && res.user) {
        onLoginSuccess(res.user);
      } else {
        Alert.alert('Authentication Notice', res.message);
      }
    } catch {
      Alert.alert('Error', 'Authentication request failed.');
    } finally {
      setLoading(false);
    }
  };

  const handleGuestMode = async () => {
    AlertService.triggerHaptic();
    const guestUser = await AuthService.continueAsGuest();
    onLoginSuccess(guestUser);
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={THEME.background} />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.keyboardAvoid}
      >
        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          {/* Header & Logo */}
          <View style={styles.logoSection}>
            <View style={styles.shieldHalo}>
              <Text style={styles.shieldEmoji}>🛡️</Text>
            </View>
            <Text style={styles.brandTitle}>GUARDIAN</Text>
            <Text style={styles.brandTagline}>WOMEN & DISASTER SAFETY NETWORK</Text>
          </View>

          {/* Subtitle / Intro */}
          <View style={styles.introBox}>
            <Text style={styles.heroHeadline}>Stay Safe. Stay Connected.</Text>
            <Text style={styles.heroDesc}>
              Log in once to enable Google Cloud Sync for live GPS location, trusted emergency contacts, and real hospital discovery.
            </Text>
          </View>

          {/* MAIN ACTION CHOICES */}
          {authMode === 'main' && (
            <View style={styles.actionContainer}>
              {/* 🌐 1-Tap Google Sign-In */}
              <TouchableOpacity
                style={styles.googleButton}
                onPress={handleGoogleSignIn}
                disabled={loading}
                activeOpacity={0.85}
              >
                {loading ? (
                  <ActivityIndicator color="#0F172A" size="small" />
                ) : (
                  <>
                    <View style={styles.googleGContainer}>
                      <Text style={styles.googleGText}>G</Text>
                    </View>
                    <Text style={styles.googleButtonText}>Continue with Google</Text>
                  </>
                )}
              </TouchableOpacity>

              {/* 📱 Phone Number Login */}
              <TouchableOpacity
                style={styles.phoneButton}
                onPress={() => setAuthMode('phone')}
                activeOpacity={0.8}
              >
                <Text style={styles.phoneButtonIcon}>📱</Text>
                <Text style={styles.phoneButtonText}>Continue with Phone (OTP)</Text>
              </TouchableOpacity>

              {/* ✉️ Email Login */}
              <TouchableOpacity
                style={styles.emailButton}
                onPress={() => setAuthMode('email')}
                activeOpacity={0.8}
              >
                <Text style={styles.emailButtonIcon}>✉️</Text>
                <Text style={styles.emailButtonText}>Continue with Email</Text>
              </TouchableOpacity>

              {/* Security Benefit Highlights */}
              <View style={styles.featuresCard}>
                <View style={styles.featureRow}>
                  <Text style={styles.featureIcon}>☁️</Text>
                  <Text style={styles.featureText}>Google Cloud Live Location Sync</Text>
                </View>
                <View style={styles.featureRow}>
                  <Text style={styles.featureIcon}>🏥</Text>
                  <Text style={styles.featureText}>Real Hospitals & Google Maps Navigation</Text>
                </View>
                <View style={styles.featureRow}>
                  <Text style={styles.featureIcon}>🚨</Text>
                  <Text style={styles.featureText}>1-Tap Silent SOS & Stealth Siren Control</Text>
                </View>
              </View>

              {/* Emergency Guest Mode */}
              <TouchableOpacity
                style={styles.guestButton}
                onPress={handleGuestMode}
                activeOpacity={0.8}
              >
                <Text style={styles.guestButtonIcon}>🚨</Text>
                <Text style={styles.guestButtonText}>Emergency? Continue as Guest</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* PHONE OTP VIEW */}
          {authMode === 'phone' && (
            <View style={styles.formContainer}>
              <TouchableOpacity style={styles.backRow} onPress={() => setAuthMode('main')}>
                <Text style={styles.backArrow}>←</Text>
                <Text style={styles.backText}>Back to options</Text>
              </TouchableOpacity>

              <Text style={styles.formTitle}>Phone Verification</Text>
              <Text style={styles.formSub}>We will send a 6-digit verification code to your mobile phone.</Text>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Mobile Phone Number</Text>
                <View style={styles.phoneInputRow}>
                  <View style={styles.countryCodeBox}>
                    <Text style={styles.countryCodeText}>🇮🇳 +91</Text>
                  </View>
                  <TextInput
                    style={[styles.inputField, styles.phoneField]}
                    placeholder="10-digit number"
                    placeholderTextColor={THEME.textLight}
                    value={phoneNumber}
                    onChangeText={setPhoneNumber}
                    keyboardType="phone-pad"
                    maxLength={10}
                    editable={!otpSent}
                  />
                </View>
              </View>

              {!otpSent ? (
                <TouchableOpacity
                  style={styles.submitBtn}
                  onPress={handleSendOtp}
                  disabled={loading}
                  activeOpacity={0.85}
                >
                  {loading ? (
                    <ActivityIndicator color="#FFFFFF" size="small" />
                  ) : (
                    <Text style={styles.submitBtnText}>Send Verification Code ➔</Text>
                  )}
                </TouchableOpacity>
              ) : (
                <>
                  <View style={styles.inputGroup}>
                    <View style={styles.otpHeaderRow}>
                      <Text style={styles.inputLabel}>Enter 6-Digit OTP</Text>
                      <TouchableOpacity onPress={handleSendOtp}>
                        <Text style={styles.resendLink}>Resend</Text>
                      </TouchableOpacity>
                    </View>
                    <TextInput
                      style={[styles.inputField, styles.otpField]}
                      placeholder="123456"
                      placeholderTextColor={THEME.textLight}
                      value={otpCode}
                      onChangeText={setOtpCode}
                      keyboardType="number-pad"
                      maxLength={6}
                    />
                    {simulatedOtp ? (
                      <Text style={styles.otpNotice}>
                        Demo OTP: <Text style={styles.otpBold}>{simulatedOtp}</Text>
                      </Text>
                    ) : null}
                  </View>

                  <TouchableOpacity
                    style={styles.submitBtn}
                    onPress={handleVerifyOtp}
                    disabled={loading}
                    activeOpacity={0.85}
                  >
                    {loading ? (
                      <ActivityIndicator color="#FFFFFF" size="small" />
                    ) : (
                      <Text style={styles.submitBtnText}>Verify & Continue ➔</Text>
                    )}
                  </TouchableOpacity>
                </>
              )}
            </View>
          )}

          {/* EMAIL LOGIN VIEW */}
          {authMode === 'email' && (
            <View style={styles.formContainer}>
              <TouchableOpacity style={styles.backRow} onPress={() => setAuthMode('main')}>
                <Text style={styles.backArrow}>←</Text>
                <Text style={styles.backText}>Back to options</Text>
              </TouchableOpacity>

              <Text style={styles.formTitle}>{isSignUp ? 'Create Guardian Account' : 'Sign In with Email'}</Text>

              {isSignUp && (
                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>Full Name</Text>
                  <TextInput
                    style={styles.inputField}
                    placeholder="Your name"
                    placeholderTextColor={THEME.textLight}
                    value={emailName}
                    onChangeText={setEmailName}
                  />
                </View>
              )}

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Email Address</Text>
                <TextInput
                  style={styles.inputField}
                  placeholder="name@example.com"
                  placeholderTextColor={THEME.textLight}
                  value={email}
                  onChangeText={setEmail}
                  keyboardType="email-address"
                  autoCapitalize="none"
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Password</Text>
                <TextInput
                  style={styles.inputField}
                  placeholder="At least 6 characters"
                  placeholderTextColor={THEME.textLight}
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry
                />
              </View>

              <TouchableOpacity
                style={styles.submitBtn}
                onPress={handleEmailAuth}
                disabled={loading}
                activeOpacity={0.85}
              >
                {loading ? (
                  <ActivityIndicator color="#FFFFFF" size="small" />
                ) : (
                  <Text style={styles.submitBtnText}>{isSignUp ? 'Create Account ➔' : 'Sign In ➔'}</Text>
                )}
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.toggleRow}
                onPress={() => setIsSignUp(!isSignUp)}
                activeOpacity={0.7}
              >
                <Text style={styles.toggleText}>
                  {isSignUp ? 'Already have an account? ' : "Don't have an account? "}
                  <Text style={styles.toggleBold}>{isSignUp ? 'Sign In' : 'Create One'}</Text>
                </Text>
              </TouchableOpacity>
            </View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: THEME.background,
  },
  keyboardAvoid: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 24,
    paddingTop: 36,
    paddingBottom: 40,
    alignItems: 'center',
  },
  logoSection: {
    alignItems: 'center',
    marginBottom: 24,
  },
  shieldHalo: {
    width: 76,
    height: 76,
    borderRadius: 38,
    backgroundColor: 'rgba(230, 57, 70, 0.16)',
    borderWidth: 2,
    borderColor: 'rgba(230, 57, 70, 0.4)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  shieldEmoji: {
    fontSize: 38,
  },
  brandTitle: {
    fontSize: 26,
    fontWeight: '900',
    color: '#FFFFFF',
    letterSpacing: 2,
  },
  brandTagline: {
    fontSize: 10,
    fontWeight: '800',
    color: THEME.primary,
    letterSpacing: 1.5,
    marginTop: 4,
  },
  introBox: {
    alignItems: 'center',
    marginBottom: 32,
    maxWidth: 320,
  },
  heroHeadline: {
    fontSize: 22,
    fontWeight: '800',
    color: THEME.textPrimary,
    textAlign: 'center',
    marginBottom: 8,
  },
  heroDesc: {
    fontSize: 13,
    color: THEME.textSecondary,
    textAlign: 'center',
    lineHeight: 19,
  },
  actionContainer: {
    width: '100%',
  },
  googleButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 3,
  },
  googleGContainer: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#4285F4',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  googleGText: {
    fontSize: 15,
    fontWeight: '900',
    color: '#FFFFFF',
  },
  googleButtonText: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0F172A',
  },
  phoneButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: THEME.cardBg,
    borderRadius: 14,
    paddingVertical: 14,
    borderWidth: 1,
    borderColor: THEME.border,
    marginBottom: 12,
  },
  phoneButtonIcon: {
    fontSize: 16,
    marginRight: 8,
  },
  phoneButtonText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  emailButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: THEME.cardBg,
    borderRadius: 14,
    paddingVertical: 14,
    borderWidth: 1,
    borderColor: THEME.border,
    marginBottom: 24,
  },
  emailButtonIcon: {
    fontSize: 16,
    marginRight: 8,
  },
  emailButtonText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  featuresCard: {
    backgroundColor: 'rgba(30, 41, 59, 0.7)',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: THEME.border,
    marginBottom: 20,
  },
  featureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 4,
  },
  featureIcon: {
    fontSize: 16,
    marginRight: 10,
  },
  featureText: {
    fontSize: 12,
    fontWeight: '600',
    color: THEME.textSecondary,
  },
  guestButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(230, 57, 70, 0.4)',
    backgroundColor: 'rgba(230, 57, 70, 0.08)',
  },
  guestButtonIcon: {
    fontSize: 16,
    marginRight: 8,
  },
  guestButtonText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#F87171',
  },
  formContainer: {
    width: '100%',
  },
  backRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  backArrow: {
    fontSize: 18,
    color: THEME.textSecondary,
    marginRight: 6,
  },
  backText: {
    fontSize: 13,
    color: THEME.textSecondary,
    fontWeight: '600',
  },
  formTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#FFFFFF',
    marginBottom: 4,
  },
  formSub: {
    fontSize: 12,
    color: THEME.textSecondary,
    marginBottom: 16,
    lineHeight: 16,
  },
  inputGroup: {
    marginBottom: 14,
  },
  inputLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: THEME.textSecondary,
    marginBottom: 6,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  inputField: {
    backgroundColor: THEME.cardBg,
    borderWidth: 1,
    borderColor: THEME.border,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 14,
    color: '#FFFFFF',
  },
  phoneInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  countryCodeBox: {
    backgroundColor: THEME.cardBgLight,
    paddingHorizontal: 12,
    paddingVertical: 13,
    borderTopLeftRadius: 12,
    borderBottomLeftRadius: 12,
    borderWidth: 1,
    borderColor: THEME.border,
    borderRightWidth: 0,
  },
  countryCodeText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  phoneField: {
    flex: 1,
    borderTopLeftRadius: 0,
    borderBottomLeftRadius: 0,
  },
  otpHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  resendLink: {
    fontSize: 12,
    fontWeight: '700',
    color: '#60A5FA',
  },
  otpField: {
    letterSpacing: 8,
    fontSize: 18,
    fontWeight: '800',
    textAlign: 'center',
  },
  otpNotice: {
    fontSize: 11,
    color: THEME.textSecondary,
    marginTop: 6,
    textAlign: 'center',
  },
  otpBold: {
    fontWeight: '800',
    color: THEME.primary,
  },
  submitBtn: {
    backgroundColor: THEME.primary,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
  },
  submitBtnText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  toggleRow: {
    alignItems: 'center',
    marginTop: 16,
  },
  toggleText: {
    fontSize: 12,
    color: THEME.textSecondary,
  },
  toggleBold: {
    fontWeight: '800',
    color: THEME.primary,
  },
});

