import React, { useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  Modal,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Alert,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { AuthService } from '../services/authService';
import { CloudSyncService } from '../services/cloudSyncService';
import { AlertService } from '../services/alertService';
import { AuthUser } from '../types';

const THEME = {
  primary: '#E63946',
  primaryDark: '#B71C1C',
  googleBlue: '#4285F4',
  googleRed: '#EA4335',
  googleYellow: '#FBBC04',
  googleGreen: '#34A853',
  background: '#FFFFFF',
  cardBg: '#F8FAFC',
  textPrimary: '#0F172A',
  textSecondary: '#475569',
  textLight: '#94A3B8',
  border: '#E2E8F0',
  safeGreen: '#16A34A',
  safeGreenBg: '#F0FDF4',
};

interface AuthModalProps {
  visible: boolean;
  onClose: () => void;
  onSuccess?: (user: AuthUser) => void;
  canDismiss?: boolean;
}

export default function AuthModal({
  visible,
  onClose,
  onSuccess,
  canDismiss = true,
}: AuthModalProps) {
  const [activeTab, setActiveTab] = useState<'google' | 'phone' | 'email'>('google');
  const [loading, setLoading] = useState<boolean>(false);

  // Google Input State
  const [googleEmail, setGoogleEmail] = useState<string>('');
  const [googleName, setGoogleName] = useState<string>('');

  // Phone Input State
  const [phoneNumber, setPhoneNumber] = useState<string>('');
  const [otpCode, setOtpCode] = useState<string>('');
  const [otpSent, setOtpSent] = useState<boolean>(false);
  const [simulatedOtp, setSimulatedOtp] = useState<string>('');

  // Email Input State
  const [isSignUp, setIsSignUp] = useState<boolean>(false);
  const [emailName, setEmailName] = useState<string>('');
  const [email, setEmail] = useState<string>('');
  const [password, setPassword] = useState<string>('');

  const handleGoogleSignIn = async () => {
    setLoading(true);
    try {
      AlertService.triggerHaptic();
      const chosenEmail = googleEmail.trim() || 'user@gmail.com';
      const chosenName = googleName.trim() || chosenEmail.split('@')[0].replace('.', ' ').replace(/\b\w/g, (c) => c.toUpperCase());

      const res = await AuthService.signInWithGoogle({
        email: chosenEmail,
        name: chosenName,
      });

      if (res.success) {
        // Automatically sync location and guardians to Google Cloud
        await CloudSyncService.syncToCloud();
        await CloudSyncService.restoreFromCloud();

        Alert.alert(
          '✅ Google Account Connected',
          `Welcome, ${res.user.name}!\n\nYour live location and emergency guardians are now securely synced to Google Cloud.`
        );
        onSuccess?.(res.user);
        onClose();
      }
    } catch {
      Alert.alert('Error', 'Google Sign-In failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleSendPhoneOtp = async () => {
    if (phoneNumber.trim().length < 10) {
      Alert.alert('Invalid Mobile', 'Please enter a valid 10-digit phone number.');
      return;
    }
    setLoading(true);
    try {
      AlertService.triggerHaptic();
      const res = await AuthService.sendPhoneOtp(phoneNumber.trim());
      if (res.success) {
        setOtpSent(true);
        setSimulatedOtp(res.simulatedOtp);
        setOtpCode(res.simulatedOtp); // Auto-fill for convenience
        Alert.alert('OTP Sent', res.message);
      } else {
        Alert.alert('Error', res.message);
      }
    } catch {
      Alert.alert('Error', 'Failed to send OTP.');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyPhoneOtp = async () => {
    if (!otpCode.trim()) {
      Alert.alert('Enter OTP', 'Please enter the 6-digit verification code.');
      return;
    }
    setLoading(true);
    try {
      AlertService.triggerHaptic();
      const res = await AuthService.verifyPhoneOtp(phoneNumber.trim(), otpCode.trim());
      if (res.success && res.user) {
        await CloudSyncService.syncToCloud();
        Alert.alert('Verified', 'Phone number verified and account synced.');
        onSuccess?.(res.user);
        onClose();
      } else {
        Alert.alert('Verification Failed', res.message);
      }
    } catch {
      Alert.alert('Error', 'Verification error occurred.');
    } finally {
      setLoading(false);
    }
  };

  const handleEmailAuth = async () => {
    if (!email.trim() || !password.trim()) {
      Alert.alert('Missing Fields', 'Please enter your email and password.');
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
        await CloudSyncService.syncToCloud();
        Alert.alert('Success', res.message);
        onSuccess?.(res.user);
        onClose();
      } else {
        Alert.alert('Authentication Failed', res.message);
      }
    } catch {
      Alert.alert('Error', 'Authentication request failed.');
    } finally {
      setLoading(false);
    }
  };

  const handleEmergencyGuest = async () => {
    AlertService.triggerHaptic();
    const guestUser = await AuthService.continueAsGuest();
    onSuccess?.(guestUser);
    onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={canDismiss ? onClose : undefined}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.modalBackdrop}
      >
        <View style={styles.modalCard}>
          {/* Top Bar with Close Option */}
          <View style={styles.topBar}>
            <View style={styles.brandingRow}>
              <Text style={styles.brandIcon}>🛡️</Text>
              <Text style={styles.brandTitle}>GUARDIAN</Text>
              <View style={styles.brandPill}>
                <Text style={styles.brandPillText}>CLOUD SYNC</Text>
              </View>
            </View>
            {canDismiss && (
              <TouchableOpacity onPress={onClose} style={styles.closeBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <Text style={styles.closeBtnText}>✕</Text>
              </TouchableOpacity>
            )}
          </View>

          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
            {/* Header Title */}
            <Text style={styles.mainTitle}>Sign In to Guardian</Text>
            <Text style={styles.mainSub}>
              Synchronize your last known live GPS location, trusted parents/spouse contacts, and emergency medical ID
            </Text>

            {/* Tab Selector */}
            <View style={styles.tabBar}>
              <TouchableOpacity
                style={[styles.tabBtn, activeTab === 'google' && styles.tabBtnActive]}
                onPress={() => setActiveTab('google')}
                activeOpacity={0.8}
              >
                <Text style={styles.tabIcon}>🌐</Text>
                <Text style={[styles.tabText, activeTab === 'google' && styles.tabTextActive]}>Google</Text>
                {activeTab === 'google' && <View style={styles.tabActiveBar} />}
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.tabBtn, activeTab === 'phone' && styles.tabBtnActive]}
                onPress={() => setActiveTab('phone')}
                activeOpacity={0.8}
              >
                <Text style={styles.tabIcon}>📱</Text>
                <Text style={[styles.tabText, activeTab === 'phone' && styles.tabTextActive]}>Phone OTP</Text>
                {activeTab === 'phone' && <View style={styles.tabActiveBar} />}
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.tabBtn, activeTab === 'email' && styles.tabBtnActive]}
                onPress={() => setActiveTab('email')}
                activeOpacity={0.8}
              >
                <Text style={styles.tabIcon}>✉️</Text>
                <Text style={[styles.tabText, activeTab === 'email' && styles.tabTextActive]}>Email</Text>
                {activeTab === 'email' && <View style={styles.tabActiveBar} />}
              </TouchableOpacity>
            </View>

            {/* TAB 1: GOOGLE SIGN-IN */}
            {activeTab === 'google' && (
              <View style={styles.tabPanel}>
                <View style={styles.googleHeroBox}>
                  <View style={styles.googleLogoRow}>
                    <Text style={[styles.googleLetter, { color: '#4285F4' }]}>G</Text>
                    <Text style={[styles.googleLetter, { color: '#EA4335' }]}>o</Text>
                    <Text style={[styles.googleLetter, { color: '#FBBC04' }]}>o</Text>
                    <Text style={[styles.googleLetter, { color: '#4285F4' }]}>g</Text>
                    <Text style={[styles.googleLetter, { color: '#34A853' }]}>l</Text>
                    <Text style={[styles.googleLetter, { color: '#EA4335' }]}>e</Text>
                    <Text style={styles.googleHeroText}> Account Sync</Text>
                  </View>
                  <Text style={styles.googleHeroSub}>
                    Recommended for instant automatic location backup and multi-device guardian recovery
                  </Text>
                </View>

                {/* Optional Custom Email Input */}
                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>Google Account Email</Text>
                  <TextInput
                    style={styles.inputField}
                    placeholder="e.g. yourname@gmail.com"
                    placeholderTextColor={THEME.textLight}
                    value={googleEmail}
                    onChangeText={setGoogleEmail}
                    keyboardType="email-address"
                    autoCapitalize="none"
                  />
                </View>

                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>Your Name (Optional)</Text>
                  <TextInput
                    style={styles.inputField}
                    placeholder="e.g. Niharika Dalvi"
                    placeholderTextColor={THEME.textLight}
                    value={googleName}
                    onChangeText={setGoogleName}
                  />
                </View>

                {/* Google Sign-In Action Button */}
                <TouchableOpacity
                  style={styles.googleBtn}
                  onPress={handleGoogleSignIn}
                  disabled={loading}
                  activeOpacity={0.85}
                >
                  {loading ? (
                    <ActivityIndicator color="#FFFFFF" size="small" />
                  ) : (
                    <>
                      <View style={styles.googleGContainer}>
                        <Text style={styles.googleGText}>G</Text>
                      </View>
                      <Text style={styles.googleBtnText}>
                        {googleEmail.trim() ? `Sign in as ${googleEmail.trim()}` : 'Sign in with Google Account'}
                      </Text>
                    </>
                  )}
                </TouchableOpacity>

                {/* Google Sync Advantages List */}
                <View style={styles.benefitList}>
                  <View style={styles.benefitItem}>
                    <Text style={styles.benefitIcon}>☁️</Text>
                    <Text style={styles.benefitText}>
                      <Text style={styles.benefitBold}>Live GPS Sync: </Text>
                      Last location continuously anchored to Google Cloud
                    </Text>
                  </View>
                  <View style={styles.benefitItem}>
                    <Text style={styles.benefitIcon}>🛡️</Text>
                    <Text style={styles.benefitText}>
                      <Text style={styles.benefitBold}>Guardian Recovery: </Text>
                      Never lose emergency parent/spouse numbers if phone is lost
                    </Text>
                  </View>
                  <View style={styles.benefitItem}>
                    <Text style={styles.benefitIcon}>🩺</Text>
                    <Text style={styles.benefitText}>
                      <Text style={styles.benefitBold}>Medical ID Backup: </Text>
                      Blood group and allergy profile saved securely
                    </Text>
                  </View>
                </View>
              </View>
            )}

            {/* TAB 2: PHONE NUMBER OTP */}
            {activeTab === 'phone' && (
              <View style={styles.tabPanel}>
                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>Mobile Phone Number</Text>
                  <View style={styles.phoneInputRow}>
                    <View style={styles.countryCodeBox}>
                      <Text style={styles.countryCodeText}>🇮🇳 +91</Text>
                    </View>
                    <TextInput
                      style={[styles.inputField, styles.phoneField]}
                      placeholder="10-digit mobile number"
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
                    style={styles.primaryActionBtn}
                    onPress={handleSendPhoneOtp}
                    disabled={loading}
                    activeOpacity={0.85}
                  >
                    {loading ? (
                      <ActivityIndicator color="#FFFFFF" size="small" />
                    ) : (
                      <Text style={styles.primaryActionBtnText}>Send 6-Digit Verification OTP ➔</Text>
                    )}
                  </TouchableOpacity>
                ) : (
                  <>
                    <View style={styles.inputGroup}>
                      <View style={styles.otpHeaderRow}>
                        <Text style={styles.inputLabel}>Enter 6-Digit OTP</Text>
                        <TouchableOpacity onPress={handleSendPhoneOtp}>
                          <Text style={styles.resendText}>Resend OTP</Text>
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
                          Demo Code: <Text style={styles.otpNoticeBold}>{simulatedOtp}</Text> (auto-filled)
                        </Text>
                      ) : null}
                    </View>

                    <TouchableOpacity
                      style={styles.primaryActionBtn}
                      onPress={handleVerifyPhoneOtp}
                      disabled={loading}
                      activeOpacity={0.85}
                    >
                      {loading ? (
                        <ActivityIndicator color="#FFFFFF" size="small" />
                      ) : (
                        <Text style={styles.primaryActionBtnText}>Verify OTP & Connect Account</Text>
                      )}
                    </TouchableOpacity>
                  </>
                )}
              </View>
            )}

            {/* TAB 3: EMAIL & PASSWORD */}
            {activeTab === 'email' && (
              <View style={styles.tabPanel}>
                {isSignUp && (
                  <View style={styles.inputGroup}>
                    <Text style={styles.inputLabel}>Full Name</Text>
                    <TextInput
                      style={styles.inputField}
                      placeholder="e.g. Niharika Dalvi"
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
                    placeholder="Minimum 6 characters"
                    placeholderTextColor={THEME.textLight}
                    value={password}
                    onChangeText={setPassword}
                    secureTextEntry
                  />
                </View>

                <TouchableOpacity
                  style={styles.primaryActionBtn}
                  onPress={handleEmailAuth}
                  disabled={loading}
                  activeOpacity={0.85}
                >
                  {loading ? (
                    <ActivityIndicator color="#FFFFFF" size="small" />
                  ) : (
                    <Text style={styles.primaryActionBtnText}>
                      {isSignUp ? 'Create Guardian Account' : 'Sign In with Email'}
                    </Text>
                  )}
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.toggleAuthRow}
                  onPress={() => setIsSignUp(!isSignUp)}
                  activeOpacity={0.7}
                >
                  <Text style={styles.toggleAuthText}>
                    {isSignUp
                      ? 'Already registered? '
                      : 'Need a new account? '}
                    <Text style={styles.toggleAuthBold}>
                      {isSignUp ? 'Sign In' : 'Create Account'}
                    </Text>
                  </Text>
                </TouchableOpacity>
              </View>
            )}

            {/* EMERGENCY GUEST BYPASS - NEVER LOCK USER IN A CRISIS */}
            <View style={styles.guestContainer}>
              <View style={styles.dividerRow}>
                <View style={styles.dividerLine} />
                <Text style={styles.dividerText}>OR</Text>
                <View style={styles.dividerLine} />
              </View>

              <TouchableOpacity
                style={styles.guestBtn}
                onPress={handleEmergencyGuest}
                activeOpacity={0.8}
              >
                <Text style={styles.guestBtnIcon}>🚨</Text>
                <View style={styles.guestBtnTextCol}>
                  <Text style={styles.guestBtnTitle}>Emergency? Continue as Guest</Text>
                  <Text style={styles.guestBtnSub}>Immediate 1-tap access to SOS and Safe Zones (No login required)</Text>
                </View>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.72)',
    justifyContent: 'flex-end',
  },
  modalCard: {
    backgroundColor: THEME.background,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    maxHeight: '92%',
    paddingBottom: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -6 },
    shadowOpacity: 0.25,
    shadowRadius: 16,
    elevation: 20,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 22,
    paddingTop: 18,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: THEME.border,
  },
  brandingRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  brandIcon: {
    fontSize: 20,
    marginRight: 6,
  },
  brandTitle: {
    fontSize: 16,
    fontWeight: '900',
    color: THEME.primary,
    letterSpacing: 1,
  },
  brandPill: {
    backgroundColor: '#EFF6FF',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
    marginLeft: 8,
    borderWidth: 1,
    borderColor: '#BFDBFE',
  },
  brandPillText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#2563EB',
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeBtnText: {
    fontSize: 16,
    fontWeight: '700',
    color: THEME.textSecondary,
  },
  scrollContent: {
    paddingHorizontal: 22,
    paddingTop: 16,
    paddingBottom: 24,
  },
  mainTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: THEME.textPrimary,
    marginBottom: 4,
  },
  mainSub: {
    fontSize: 13,
    color: THEME.textSecondary,
    lineHeight: 18,
    marginBottom: 16,
  },
  tabBar: {
    flexDirection: 'row',
    backgroundColor: '#F1F5F9',
    borderRadius: 12,
    padding: 4,
    marginBottom: 18,
  },
  tabBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: 10,
    position: 'relative',
  },
  tabBtnActive: {
    backgroundColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  tabIcon: {
    fontSize: 14,
    marginRight: 6,
  },
  tabText: {
    fontSize: 13,
    fontWeight: '600',
    color: THEME.textSecondary,
  },
  tabTextActive: {
    color: THEME.textPrimary,
    fontWeight: '800',
  },
  tabActiveBar: {
    position: 'absolute',
    bottom: 2,
    width: 16,
    height: 3,
    backgroundColor: THEME.primary,
    borderRadius: 2,
  },
  tabPanel: {
    marginBottom: 8,
  },
  googleHeroBox: {
    backgroundColor: '#F8FAFC',
    borderRadius: 14,
    padding: 14,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  googleLogoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  googleLetter: {
    fontSize: 18,
    fontWeight: '900',
  },
  googleHeroText: {
    fontSize: 15,
    fontWeight: '800',
    color: THEME.textPrimary,
    marginLeft: 4,
  },
  googleHeroSub: {
    fontSize: 12,
    color: THEME.textSecondary,
    lineHeight: 16,
  },
  inputGroup: {
    marginBottom: 14,
  },
  inputLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: THEME.textPrimary,
    marginBottom: 6,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  inputField: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: THEME.border,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 11,
    fontSize: 15,
    color: THEME.textPrimary,
  },
  phoneInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  countryCodeBox: {
    backgroundColor: '#E2E8F0',
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderTopLeftRadius: 12,
    borderBottomLeftRadius: 12,
    borderWidth: 1,
    borderColor: THEME.border,
    borderRightWidth: 0,
  },
  countryCodeText: {
    fontSize: 14,
    fontWeight: '700',
    color: THEME.textPrimary,
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
  resendText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#2563EB',
  },
  otpField: {
    letterSpacing: 8,
    fontSize: 18,
    fontWeight: '800',
    textAlign: 'center',
  },
  otpNotice: {
    fontSize: 12,
    color: THEME.textSecondary,
    marginTop: 6,
    textAlign: 'center',
  },
  otpNoticeBold: {
    fontWeight: '800',
    color: THEME.primary,
  },
  googleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#4285F4',
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 16,
    marginBottom: 16,
    shadowColor: '#4285F4',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  googleGContainer: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  googleGText: {
    fontSize: 16,
    fontWeight: '900',
    color: '#4285F4',
  },
  googleBtnText: {
    fontSize: 15,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  primaryActionBtn: {
    backgroundColor: THEME.primary,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
    marginBottom: 12,
  },
  primaryActionBtnText: {
    fontSize: 15,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  benefitList: {
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  benefitItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  benefitIcon: {
    fontSize: 15,
    marginRight: 8,
    marginTop: 1,
  },
  benefitText: {
    flex: 1,
    fontSize: 12,
    color: THEME.textSecondary,
    lineHeight: 16,
  },
  benefitBold: {
    fontWeight: '700',
    color: THEME.textPrimary,
  },
  toggleAuthRow: {
    alignItems: 'center',
    marginTop: 6,
    marginBottom: 12,
  },
  toggleAuthText: {
    fontSize: 13,
    color: THEME.textSecondary,
  },
  toggleAuthBold: {
    fontWeight: '800',
    color: THEME.primary,
  },
  guestContainer: {
    marginTop: 8,
  },
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 12,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: THEME.border,
  },
  dividerText: {
    fontSize: 11,
    fontWeight: '800',
    color: THEME.textLight,
    marginHorizontal: 12,
  },
  guestBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF1F2',
    borderWidth: 1,
    borderColor: '#FECDD3',
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 14,
  },
  guestBtnIcon: {
    fontSize: 22,
    marginRight: 10,
  },
  guestBtnTextCol: {
    flex: 1,
  },
  guestBtnTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: THEME.primaryDark,
  },
  guestBtnSub: {
    fontSize: 11,
    color: THEME.primary,
    marginTop: 1,
  },
});

