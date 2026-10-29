import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  Modal,
  ActivityIndicator,
  Switch,
  Dimensions,
  Animated,
  StatusBar,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { SosService } from '../services/sosService';
import { AuthService } from '../services/authService';
import { CloudSyncService } from '../services/cloudSyncService';
import { HardwareTriggerService } from '../services/hardwareTriggerService';
import { AlertService } from '../services/alertService';
import { DemoModeService, SimulatedSosPayload } from '../services/demoModeService';
import AuthModal from '../components/AuthModal';
import FirstAidModal from '../components/FirstAidModal';
import GuardianSimulationModal from '../components/GuardianSimulationModal';
import { UserProfile, EmergencyContact, SosAlertSession, AuthUser, CloudSyncState } from '../types';
import { useTheme } from '../context/ThemeContext';
import { ThemeColors } from '../theme/colors';

const { width } = Dimensions.get('window');

const BLOOD_TYPES = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];

export default function ProfileScreen() {
  const { theme, isDark, themePreference, setThemePreference } = useTheme();
  const THEME = theme;
  const styles = useMemo(() => getStyles(theme), [theme]);

  const [profile, setProfile] = useState<UserProfile>({
    name: '',
    phone: '',
    bloodType: 'O+',
    allergies: '',
    emergencyNotes: '',
    sosMessageTemplate: '',
  });
  const [contacts, setContacts] = useState<EmergencyContact[]>([]);
  const [history, setHistory] = useState<SosAlertSession[]>([]);
  const [isEditingProfile, setIsEditingProfile] = useState<boolean>(false);
  const [addContactModal, setAddContactModal] = useState<boolean>(false);

  // Authentication & Cloud Sync State
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(null);
  const [syncState, setSyncState] = useState<CloudSyncState | null>(null);
  const [authModalVisible, setAuthModalVisible] = useState<boolean>(false);
  const [syncing, setSyncing] = useState<boolean>(false);

  // New Contact Form State
  const [newContactName, setNewContactName] = useState<string>('');
  const [newContactPhone, setNewContactPhone] = useState<string>('');
  const [newContactRel, setNewContactRel] = useState<string>('Family');
  const [newContactPrimary, setNewContactPrimary] = useState<boolean>(false);

  // Hardware & Stealth Trigger Settings
  const [powerTriggerEnabled, setPowerTriggerEnabled] = useState<boolean>(true);
  const [lockNotificationEnabled, setLockNotificationEnabled] = useState<boolean>(true);
  const [firstAidModalVisible, setFirstAidModalVisible] = useState<boolean>(false);

  // Examiner Demo Mode State
  const [demoModeEnabled, setDemoModeEnabled] = useState<boolean>(true);
  const [demoSimModalVisible, setDemoSimModalVisible] = useState<boolean>(false);
  const [activeSimPayload, setActiveSimPayload] = useState<SimulatedSosPayload | null>(null);

  // Screen Animations
  const screenFadeAnim = useRef(new Animated.Value(0)).current;
  const screenSlideAnim = useRef(new Animated.Value(14)).current;
  const cloudPulseAnim = useRef(new Animated.Value(0.4)).current;

  useEffect(() => {
    loadData();

    // Smooth screen entrance
    Animated.parallel([
      Animated.timing(screenFadeAnim, {
        toValue: 1,
        duration: 400,
        useNativeDriver: true,
      }),
      Animated.spring(screenSlideAnim, {
        toValue: 0,
        tension: 50,
        friction: 8,
        useNativeDriver: true,
      }),
    ]).start();

    // Cloud sync breathing beacon loop
    const cloudLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(cloudPulseAnim, {
          toValue: 1,
          duration: 900,
          useNativeDriver: true,
        }),
        Animated.timing(cloudPulseAnim, {
          toValue: 0.35,
          duration: 900,
          useNativeDriver: true,
        }),
      ])
    );
    cloudLoop.start();

    const unsubAuth = AuthService.onAuthStateChanged((user) => {
      setCurrentUser(user);
    });
    const unsubSync = CloudSyncService.onSyncStateChanged((state) => {
      setSyncState(state);
    });

    DemoModeService.init().then((enabled) => {
      setDemoModeEnabled(enabled);
    });
    const unsubDemo = DemoModeService.onStateChanged((enabled) => {
      setDemoModeEnabled(enabled);
    });

    return () => {
      cloudLoop.stop();
      unsubAuth();
      unsubSync();
      unsubDemo();
    };
  }, []);

  const loadData = async () => {
    const p = await SosService.getProfile();
    const c = await SosService.getContacts();
    const h = await SosService.getSosHistory();
    setProfile(p);
    setContacts(c);
    setHistory(h);

    const pt = await HardwareTriggerService.isPowerTriggerEnabled();
    setPowerTriggerEnabled(pt);
    const ln = await HardwareTriggerService.isLockScreenNotificationEnabled();
    setLockNotificationEnabled(ln);
  };

  const handleTogglePowerTrigger = async (value: boolean) => {
    AlertService.triggerHaptic();
    setPowerTriggerEnabled(value);
    await HardwareTriggerService.setPowerTriggerEnabled(value);
  };

  const handleToggleLockNotification = async (value: boolean) => {
    AlertService.triggerHaptic();
    setLockNotificationEnabled(value);
    await HardwareTriggerService.setLockScreenNotificationEnabled(value);
  };

  const handleSaveProfile = async () => {
    AlertService.triggerHaptic();
    await SosService.saveProfile(profile);
    setIsEditingProfile(false);
    Alert.alert('✅ Saved', 'Emergency Medical ID & Guardian Profile updated successfully.');
  };

  const handleAddContact = async () => {
    if (!newContactName.trim() || !newContactPhone.trim()) {
      Alert.alert('Incomplete Details', 'Please enter both contact name and phone number.');
      return;
    }

    AlertService.triggerHaptic();
    const newContact: EmergencyContact = {
      id: `c-${Date.now()}`,
      name: newContactName.trim(),
      phone: newContactPhone.trim(),
      relationship: newContactRel.trim() || 'Contact',
      isPrimary: newContactPrimary,
    };

    let updated = [...contacts];
    if (newContactPrimary) {
      updated = updated.map((c) => ({ ...c, isPrimary: false }));
    }
    updated.push(newContact);

    await SosService.saveContacts(updated);
    setContacts(updated);
    setAddContactModal(false);
    setNewContactName('');
    setNewContactPhone('');
    setNewContactPrimary(false);
  };

  const handleDeleteContact = (id: string) => {
    AlertService.triggerHaptic();
    Alert.alert('Delete Guardian', 'Are you sure you want to remove this emergency contact?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          const updated = contacts.filter((c) => c.id !== id);
          await SosService.saveContacts(updated);
          setContacts(updated);
        },
      },
    ]);
  };

  const handleTogglePrimary = async (id: string) => {
    AlertService.triggerHaptic();
    const updated = contacts.map((c) => ({
      ...c,
      isPrimary: c.id === id,
    }));
    await SosService.saveContacts(updated);
    setContacts(updated);
  };

  const handleManualSync = async () => {
    AlertService.triggerHaptic();
    setSyncing(true);
    try {
      const res = await CloudSyncService.syncToCloud();
      Alert.alert(res.success ? '☁️ Google Cloud Synced' : 'Sync Notice', res.message);
    } finally {
      setSyncing(false);
    }
  };

  const handleSignOut = () => {
    AlertService.triggerHaptic();
    Alert.alert('Sign Out', 'Are you sure you want to disconnect? Your offline emergency data will stay safe on this device.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign Out',
        style: 'destructive',
        onPress: async () => {
          await AuthService.signOut();
          setCurrentUser(null);
        },
      },
    ]);
  };

  const handleToggleDemoMode = async (val: boolean) => {
    AlertService.triggerHaptic();
    await DemoModeService.setDemoMode(val);
    setDemoModeEnabled(val);
    Alert.alert(
      val ? '🎓 Examiner Demo Mode Enabled' : '⚡ Live Mode Enabled',
      val
        ? 'Examiner Demo Mode is active. When you trigger SOS, the app will simulate a 2.5s cellular dispatch and prompt an interactive Guardian Device Console, allowing you to showcase the complete two-way response lifecycle to your professor or examiner.'
        : 'Live mode active. Real native SMS and emergency phone dialing will be used.'
    );
  };

  const handleTestDemoTrigger = () => {
    AlertService.triggerHaptic();
    DemoModeService.simulateIncomingSosAlert(null, profile, contacts);
    setTimeout(() => {
      const p = DemoModeService.getActivePayload();
      setActiveSimPayload(p);
      setDemoSimModalVisible(true);
    }, 400);
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <StatusBar barStyle={theme.statusBarStyle} backgroundColor={theme.background} />
      {/* Top Header */}
      <View style={styles.topHeader}>
        <View style={styles.topHeaderTitleCol}>
          <Text style={styles.topHeaderTag}>IDENTITY & SECURITY HUB</Text>
          <Text style={styles.topHeaderTitle}>Executive Guardian ID</Text>
        </View>
        <View style={styles.secureStorageBadge}>
          <Text style={styles.secureStorageText}>🔒 ENCRYPTED</Text>
        </View>
      </View>

      <ScrollView
        style={styles.mainScrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <Animated.View style={{ flex: 1, opacity: screenFadeAnim, transform: [{ translateY: screenSlideAnim }] }}>
        {/* ========================================================
            1. HERO IDENTITY & CLOUD SYNCHRONIZATION CARD
        ======================================================== */}
        {currentUser && currentUser.provider !== 'guest' ? (
          <View style={styles.accountCard}>
            <View style={styles.accountHeaderRow}>
              <View style={styles.avatarCircle}>
                <Text style={styles.avatarText}>
                  {currentUser.name ? currentUser.name.charAt(0).toUpperCase() : 'G'}
                </Text>
              </View>

              <View style={styles.accountDetailsCol}>
                <View style={styles.accountNameRow}>
                  <Text style={styles.accountName} numberOfLines={1}>
                    {currentUser.name}
                  </Text>
                  <View style={styles.googleBadge}>
                    <Text style={styles.googleBadgeText}>GOOGLE</Text>
                  </View>
                </View>
                <Text style={styles.accountEmail} numberOfLines={1}>
                  {currentUser.email || currentUser.phone || 'Connected Account'}
                </Text>
              </View>
            </View>

            {/* Cloud Sync Telemetry Strip */}
            <View style={styles.cloudTelemetryBox}>
              <View style={styles.telemetryStatusRow}>
                <Animated.View
                  style={[
                    styles.statusLiveDot,
                    {
                      opacity: cloudPulseAnim,
                      transform: [
                        {
                          scale: cloudPulseAnim.interpolate({
                            inputRange: [0.35, 1],
                            outputRange: [0.85, 1.3],
                          }),
                        },
                      ],
                    },
                  ]}
                />
                <Text style={styles.telemetryHeadline}>Google Cloud Live Backup Active</Text>
              </View>

              <View style={styles.telemetryMetricsRow}>
                <View style={styles.telemetryMetricItem}>
                  <Text style={styles.telemetryMetricLabel}>LAST ANCHOR</Text>
                  <Text style={styles.telemetryMetricValue} numberOfLines={1}>
                    {syncState?.lastSyncedLocation?.city ||
                      syncState?.lastSyncedLocation?.subLocality ||
                      'GPS Live'}
                  </Text>
                </View>

                <View style={styles.telemetryMetricItem}>
                  <Text style={styles.telemetryMetricLabel}>GUARDIANS</Text>
                  <Text style={styles.telemetryMetricValue}>{contacts.length} Linked</Text>
                </View>

                <View style={styles.telemetryMetricItem}>
                  <Text style={styles.telemetryMetricLabel}>BLOOD GROUP</Text>
                  <Text style={[styles.telemetryMetricValue, { color: THEME.primary }]}>
                    {profile.bloodType || 'O+'}
                  </Text>
                </View>
              </View>
            </View>

            {/* Sync Now & Sign Out Buttons */}
            <View style={styles.accountActionsRow}>
              <TouchableOpacity
                style={styles.syncActionBtn}
                onPress={handleManualSync}
                disabled={syncing}
                activeOpacity={0.8}
              >
                {syncing ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <>
                    <Text style={styles.syncActionIcon}>☁️</Text>
                    <Text style={styles.syncActionText}>Sync Cloud Now</Text>
                  </>
                )}
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.signOutActionBtn}
                onPress={handleSignOut}
                activeOpacity={0.8}
              >
                <Text style={styles.signOutActionText}>Sign Out</Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : (
          <TouchableOpacity
            style={styles.connectGoogleCard}
            onPress={() => setAuthModalVisible(true)}
            activeOpacity={0.85}
          >
            <View style={styles.connectGoogleIconBg}>
              <Text style={styles.connectGoogleIcon}>🌐</Text>
            </View>
            <View style={styles.connectGoogleTextCol}>
              <Text style={styles.connectGoogleTitle}>Link Google Account to Sync Location</Text>
              <Text style={styles.connectGoogleSub}>
                Automatically backs up your live coordinates, parents' numbers, and medical ID.
              </Text>
              <View style={styles.connectGooglePill}>
                <Text style={styles.connectGooglePillText}>CONNECT ACCOUNT ➔</Text>
              </View>
            </View>
          </TouchableOpacity>
        )}

        {/* ========================================================
            2. EMERGENCY MEDICAL ID CONSOLE
        ======================================================== */}
        <View style={styles.sectionCard}>
          <View style={styles.sectionCardHeader}>
            <View style={styles.sectionTitleRow}>
              <View style={[styles.sectionIconBadge, { backgroundColor: 'rgba(239, 68, 68, 0.15)' }]}>
                <Text style={styles.sectionIconEmoji}>🩺</Text>
              </View>
              <View>
                <Text style={styles.sectionTitle}>Emergency Medical ID</Text>
                <Text style={styles.sectionSub}>Critical health directives for first-responders</Text>
              </View>
            </View>

            <TouchableOpacity
              style={[styles.headerActionPill, isEditingProfile && styles.headerActionPillSave]}
              onPress={() => {
                if (isEditingProfile) handleSaveProfile();
                else setIsEditingProfile(true);
              }}
              activeOpacity={0.8}
            >
              <Text style={[styles.headerActionPillText, isEditingProfile && styles.headerActionPillTextSave]}>
                {isEditingProfile ? '✓ Save' : '✏️ Edit'}
              </Text>
            </TouchableOpacity>
          </View>

          {isEditingProfile ? (
            <View style={styles.formContainer}>
              <Text style={styles.inputLabel}>FULL NAME</Text>
              <TextInput
                style={styles.textInput}
                value={profile.name}
                onChangeText={(v) => setProfile({ ...profile, name: v })}
                placeholder="e.g. Alex Morgan"
                placeholderTextColor={THEME.textMuted}
              />

              <Text style={styles.inputLabel}>BLOOD GROUP</Text>
              <View style={styles.bloodTypeGrid}>
                {BLOOD_TYPES.map((bt) => (
                  <TouchableOpacity
                    key={bt}
                    style={[
                      styles.bloodChip,
                      profile.bloodType.startsWith(bt) && styles.bloodChipActive,
                    ]}
                    onPress={() => setProfile({ ...profile, bloodType: bt })}
                    activeOpacity={0.75}
                  >
                    <Text
                      style={[
                        styles.bloodChipText,
                        profile.bloodType.startsWith(bt) && styles.bloodChipTextActive,
                      ]}
                    >
                      {bt}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={styles.inputLabel}>KNOWN ALLERGIES</Text>
              <TextInput
                style={styles.textInput}
                value={profile.allergies}
                onChangeText={(v) => setProfile({ ...profile, allergies: v })}
                placeholder="e.g. Penicillin, Peanuts, Sulfa drugs"
                placeholderTextColor={THEME.textMuted}
              />

              <Text style={styles.inputLabel}>CONDITIONS & EMERGENCY NOTES</Text>
              <TextInput
                style={[styles.textInput, styles.textAreaInput]}
                multiline
                numberOfLines={3}
                value={profile.emergencyNotes}
                onChangeText={(v) => setProfile({ ...profile, emergencyNotes: v })}
                placeholder="e.g. Asthmatic, carries inhaler. Contact Dr. Sharma: 98221 00000"
                placeholderTextColor={THEME.textMuted}
              />
            </View>
          ) : (
            <View style={styles.medicalInfoGrid}>
              <View style={styles.medicalTileRow}>
                <View style={styles.medicalTile}>
                  <Text style={styles.medicalTileLabel}>BLOOD GROUP</Text>
                  <View style={styles.bloodBadgeLarge}>
                    <Text style={styles.bloodBadgeLargeText}>{profile.bloodType || 'O+'}</Text>
                  </View>
                </View>

                <View style={[styles.medicalTile, { flex: 2 }]}>
                  <Text style={styles.medicalTileLabel}>REGISTERED NAME</Text>
                  <Text style={styles.medicalTileValue} numberOfLines={1}>
                    {profile.name || currentUser?.name || 'Guardian User'}
                  </Text>
                </View>
              </View>

              <View style={styles.medicalDetailBlock}>
                <Text style={styles.medicalTileLabel}>KNOWN ALLERGIES</Text>
                <Text style={styles.medicalTileSubValue}>
                  {profile.allergies || 'No allergies recorded'}
                </Text>
              </View>

              <View style={styles.medicalDetailBlock}>
                <Text style={styles.medicalTileLabel}>EMERGENCY MEDICAL NOTES</Text>
                <Text style={styles.medicalTileSubValue}>
                  {profile.emergencyNotes || 'No specific emergency instructions provided'}
                </Text>
              </View>
            </View>
          )}
        </View>

        {/* ========================================================
            3. TRUSTED GUARDIANS NETWORK (CONTACTS)
        ======================================================== */}
        <View style={styles.sectionCard}>
          <View style={styles.sectionCardHeader}>
            <View style={styles.sectionTitleRow}>
              <View style={[styles.sectionIconBadge, { backgroundColor: THEME.emeraldBg }]}>
                <Text style={styles.sectionIconEmoji}>🛡️</Text>
              </View>
              <View>
                <Text style={styles.sectionTitle}>Trusted Guardians ({contacts.length})</Text>
                <Text style={styles.sectionSub}>Automated SMS & live GPS recipients</Text>
              </View>
            </View>

            <TouchableOpacity
              style={styles.headerAddBtn}
              onPress={() => setAddContactModal(true)}
              activeOpacity={0.8}
            >
              <Text style={styles.headerAddBtnText}>+ Add</Text>
            </TouchableOpacity>
          </View>

          {contacts.length === 0 ? (
            <View style={styles.emptyContactsCard}>
              <Text style={styles.emptyContactsIcon}>👥</Text>
              <Text style={styles.emptyContactsTitle}>No Emergency Guardians Linked</Text>
              <Text style={styles.emptyContactsSub}>
                Add parents or spouse so the big SOS reactor immediately broadcasts to them.
              </Text>
            </View>
          ) : (
            contacts.map((contact) => (
              <View key={contact.id} style={styles.contactCard}>
                <View style={styles.contactMainCol}>
                  <View style={styles.contactNameRow}>
                    <Text style={styles.contactName}>{contact.name}</Text>
                    {contact.isPrimary && (
                      <View style={styles.primaryContactBadge}>
                        <Text style={styles.primaryContactBadgeText}>PRIMARY DISPATCH</Text>
                      </View>
                    )}
                  </View>
                  <Text style={styles.contactPhone}>{contact.phone}</Text>
                  <Text style={styles.contactRel}>Relation: {contact.relationship}</Text>
                </View>

                <View style={styles.contactActionsCol}>
                  {!contact.isPrimary && (
                    <TouchableOpacity
                      style={styles.makePrimaryPill}
                      onPress={() => handleTogglePrimary(contact.id)}
                      activeOpacity={0.75}
                    >
                      <Text style={styles.makePrimaryPillText}>Set Primary</Text>
                    </TouchableOpacity>
                  )}
                  <TouchableOpacity
                    style={styles.deleteContactIconBtn}
                    onPress={() => handleDeleteContact(contact.id)}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  >
                    <Text style={styles.deleteContactIcon}>🗑️</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ))
          )}
        </View>

        {/* ========================================================
            4. HARDWARE & STEALTH SECURITY TRIGGERS
        ======================================================== */}
        <View style={styles.sectionCard}>
          <View style={styles.sectionCardHeader}>
            <View style={styles.sectionTitleRow}>
              <View style={[styles.sectionIconBadge, { backgroundColor: THEME.amberBg }]}>
                <Text style={styles.sectionIconEmoji}>⚡</Text>
              </View>
              <View>
                <Text style={styles.sectionTitle}>Hardware & Stealth Security</Text>
                <Text style={styles.sectionSub}>Instant covert emergency triggers</Text>
              </View>
            </View>
          </View>

          {/* Power Button Triple-Press SOS */}
          <View style={styles.triggerRow}>
            <View style={styles.triggerTextCol}>
              <View style={styles.triggerTitleRow}>
                <Text style={styles.triggerTitle}>Power Button 3x SOS</Text>
                <View style={styles.stealthPill}>
                  <Text style={styles.stealthPillText}>HARDWARE</Text>
                </View>
              </View>
              <Text style={styles.triggerDesc}>
                Triple-press power button within 3 seconds to launch 5s countdown & dispatch live GPS to parents.
              </Text>
            </View>
            <Switch
              value={powerTriggerEnabled}
              onValueChange={handleTogglePowerTrigger}
              trackColor={{ false: '#334155', true: THEME.primary }}
              thumbColor={powerTriggerEnabled ? '#FFFFFF' : '#94A3B8'}
            />
          </View>

          <View style={styles.cardDivider} />

          {/* Lock-Screen Emergency Notification */}
          <View style={styles.triggerRow}>
            <View style={styles.triggerTextCol}>
              <Text style={styles.triggerTitle}>Lock-Screen Emergency Bar</Text>
              <Text style={styles.triggerDesc}>
                Display persistent notification on lock screen with 1-tap SOS trigger without unlocking device.
              </Text>
            </View>
            <Switch
              value={lockNotificationEnabled}
              onValueChange={handleToggleLockNotification}
              trackColor={{ false: '#334155', true: THEME.blue }}
              thumbColor={lockNotificationEnabled ? '#FFFFFF' : '#94A3B8'}
            />
          </View>

          <View style={styles.cardDivider} />

          {/* First Aid Playbooks Shortcut */}
          <TouchableOpacity
            style={styles.firstAidBannerBtn}
            onPress={() => setFirstAidModalVisible(true)}
            activeOpacity={0.8}
          >
            <Text style={styles.firstAidBannerIcon}>🩺</Text>
            <View style={styles.firstAidBannerTextCol}>
              <Text style={styles.firstAidBannerTitle}>Offline First-Aid & Survival Guides</Text>
              <Text style={styles.firstAidBannerSub}>CPR Metronome, Bleeding, Snakebites, Burns & Floods</Text>
            </View>
            <Text style={styles.firstAidBannerArrow}>➔</Text>
          </TouchableOpacity>
        </View>

        {/* ========================================================
            5. DISPLAY & THEME PREFERENCE (USER CHOICE)
        ======================================================== */}
        <View style={styles.sectionCard}>
          <View style={styles.sectionCardHeader}>
            <View style={styles.sectionTitleRow}>
              <View style={[styles.sectionIconBadge, { backgroundColor: THEME.purpleBg }]}>
                <Text style={styles.sectionIconEmoji}>🎨</Text>
              </View>
              <View>
                <Text style={styles.sectionTitle}>Display & Theme Preference</Text>
                <Text style={styles.sectionSub}>Active based on your choice</Text>
              </View>
            </View>
          </View>

          <View style={styles.themeOptionsGrid}>
            {/* Light Mode Option */}
            <TouchableOpacity
              style={[
                styles.themeOptionCard,
                themePreference === 'light' && styles.themeOptionCardActive,
              ]}
              onPress={() => setThemePreference('light')}
              activeOpacity={0.8}
            >
              <Text style={styles.themeOptionEmoji}>☀️</Text>
              <View style={styles.themeOptionInfo}>
                <Text
                  style={[
                    styles.themeOptionTitle,
                    themePreference === 'light' && styles.themeOptionTitleActive,
                  ]}
                >
                  Light Mode
                </Text>
                <Text style={styles.themeOptionDesc}>High-visibility clean daylight theme</Text>
              </View>
              {themePreference === 'light' && (
                <View style={styles.themeActiveBadge}>
                  <Text style={styles.themeActiveBadgeText}>✓ ACTIVE</Text>
                </View>
              )}
            </TouchableOpacity>

            {/* Dark Mode Option */}
            <TouchableOpacity
              style={[
                styles.themeOptionCard,
                themePreference === 'dark' && styles.themeOptionCardActive,
              ]}
              onPress={() => setThemePreference('dark')}
              activeOpacity={0.8}
            >
              <Text style={styles.themeOptionEmoji}>🌙</Text>
              <View style={styles.themeOptionInfo}>
                <Text
                  style={[
                    styles.themeOptionTitle,
                    themePreference === 'dark' && styles.themeOptionTitleActive,
                  ]}
                >
                  Dark Mode
                </Text>
                <Text style={styles.themeOptionDesc}>Tactical command obsidian theme</Text>
              </View>
              {themePreference === 'dark' && (
                <View style={styles.themeActiveBadge}>
                  <Text style={styles.themeActiveBadgeText}>✓ ACTIVE</Text>
                </View>
              )}
            </TouchableOpacity>

            {/* System Default Option */}
            <TouchableOpacity
              style={[
                styles.themeOptionCard,
                themePreference === 'system' && styles.themeOptionCardActive,
              ]}
              onPress={() => setThemePreference('system')}
              activeOpacity={0.8}
            >
              <Text style={styles.themeOptionEmoji}>📱</Text>
              <View style={styles.themeOptionInfo}>
                <Text
                  style={[
                    styles.themeOptionTitle,
                    themePreference === 'system' && styles.themeOptionTitleActive,
                  ]}
                >
                  System Default
                </Text>
                <Text style={styles.themeOptionDesc}>Follows device display settings</Text>
              </View>
              {themePreference === 'system' && (
                <View style={styles.themeActiveBadge}>
                  <Text style={styles.themeActiveBadgeText}>✓ ACTIVE</Text>
                </View>
              )}
            </TouchableOpacity>
          </View>
        </View>

        {/* ========================================================
            6. ACADEMIC & VIVA PRESENTATION SETTINGS
        ======================================================== */}
        <View style={styles.sectionCard}>
          <View style={styles.sectionCardHeader}>
            <View style={styles.sectionTitleRow}>
              <View style={[styles.sectionIconBadge, { backgroundColor: THEME.blueBg }]}>
                <Text style={styles.sectionIconEmoji}>🎓</Text>
              </View>
              <View>
                <Text style={styles.sectionTitle}>Academic & Viva Presentation</Text>
                <Text style={styles.sectionSub}>Examiner evaluation & simulation controls</Text>
              </View>
            </View>
          </View>

          {/* Examiner Demo Mode Switch */}
          <View style={styles.triggerRow}>
            <View style={styles.triggerTextCol}>
              <View style={styles.triggerTitleRow}>
                <Text style={styles.triggerTitle}>Examiner Demo Mode</Text>
                <View style={[styles.stealthPill, { backgroundColor: THEME.blueBg, borderColor: THEME.blue }]}>
                  <Text style={[styles.stealthPillText, { color: THEME.blue }]}>VIVA READY</Text>
                </View>
              </View>
              <Text style={styles.triggerDesc}>
                Simulate full end-to-end SOS packet transmission and display an interactive Guardian Receiver Console (Dad's Phone) without needing real SIM SMS balance.
              </Text>
            </View>
            <Switch
              value={demoModeEnabled}
              onValueChange={handleToggleDemoMode}
              trackColor={{ false: '#334155', true: THEME.blue }}
              thumbColor={demoModeEnabled ? '#FFFFFF' : '#94A3B8'}
            />
          </View>

          <View style={styles.cardDivider} />

          {/* Test Guardian Alert Trigger Button */}
          <TouchableOpacity
            style={[styles.firstAidBannerBtn, { borderColor: THEME.blue }]}
            onPress={handleTestDemoTrigger}
            activeOpacity={0.8}
          >
            <Text style={styles.firstAidBannerIcon}>📱</Text>
            <View style={styles.firstAidBannerTextCol}>
              <Text style={styles.firstAidBannerTitle}>Test Guardian Alert Dispatch</Text>
              <Text style={styles.firstAidBannerSub}>Open simulated parent device screen directly for demonstration</Text>
            </View>
            <Text style={[styles.firstAidBannerArrow, { color: THEME.blue }]}>➔</Text>
          </TouchableOpacity>
        </View>

        {/* ========================================================
            7. EMERGENCY DISPATCH AUDIT LOG (HISTORY)
        ======================================================== */}
        <View style={styles.sectionCard}>
          <View style={styles.sectionCardHeader}>
            <View style={styles.sectionTitleRow}>
              <View style={[styles.sectionIconBadge, { backgroundColor: 'rgba(239, 68, 68, 0.15)' }]}>
                <Text style={styles.sectionIconEmoji}>🚨</Text>
              </View>
              <View>
                <Text style={styles.sectionTitle}>Dispatch History</Text>
                <Text style={styles.sectionSub}>Recent alert sessions & transmission logs</Text>
              </View>
            </View>
          </View>

          {history.length === 0 ? (
            <View style={styles.emptyHistoryBox}>
              <Text style={styles.emptyHistoryText}>
                No emergency alerts recorded. Your system is armed, secure, and ready.
              </Text>
            </View>
          ) : (
            history.slice(0, 5).map((item) => (
              <View key={item.id} style={styles.historyCard}>
                <View style={styles.historyTopRow}>
                  <View
                    style={[
                      styles.historyStatusPill,
                      item.status === 'resolved'
                        ? { backgroundColor: THEME.emeraldBg, borderColor: THEME.emeraldBorder }
                        : { backgroundColor: THEME.primaryBg, borderColor: THEME.primaryBorder },
                    ]}
                  >
                    <Text
                      style={[
                        styles.historyStatusText,
                        item.status === 'resolved' ? { color: THEME.emerald } : { color: THEME.primary },
                      ]}
                    >
                      {item.status.toUpperCase()} ALERT
                    </Text>
                  </View>
                  <Text style={styles.historyTimestamp}>
                    {new Date(item.timestamp).toLocaleDateString()}{' '}
                    {new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </Text>
                </View>

                <Text style={styles.historyCoordsText}>
                  📍 GPS: {item.coords.latitude.toFixed(4)}, {item.coords.longitude.toFixed(4)}
                </Text>
                <Text style={styles.historyRecipientsText}>
                  Dispatched to: {item.contactsNotified.join(', ') || 'Parents'}
                </Text>
              </View>
            ))
          )}
        </View>

        <View style={{ height: 40 }} />
        </Animated.View>
      </ScrollView>

      {/* ========================================================
          MODALS: ADD CONTACT, AUTH, FIRST-AID
      ======================================================== */}
      {/* Modal: Add Guardian Contact */}
      <Modal
        visible={addContactModal}
        animationType="fade"
        transparent
        onRequestClose={() => setAddContactModal(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Add Trusted Guardian</Text>
              <TouchableOpacity onPress={() => setAddContactModal(false)}>
                <Text style={styles.modalCloseIcon}>✕</Text>
              </TouchableOpacity>
            </View>

            <Text style={styles.inputLabel}>FULL NAME</Text>
            <TextInput
              style={styles.textInput}
              placeholder="e.g. Mom / Dad / John Doe"
              placeholderTextColor={THEME.textMuted}
              value={newContactName}
              onChangeText={setNewContactName}
            />

            <Text style={styles.inputLabel}>MOBILE PHONE NUMBER</Text>
            <TextInput
              style={styles.textInput}
              placeholder="e.g. +91 98230 12345"
              placeholderTextColor={THEME.textMuted}
              keyboardType="phone-pad"
              value={newContactPhone}
              onChangeText={setNewContactPhone}
            />

            <Text style={styles.inputLabel}>RELATIONSHIP</Text>
            <TextInput
              style={styles.textInput}
              placeholder="e.g. Parent, Spouse, Sibling, Friend"
              placeholderTextColor={THEME.textMuted}
              value={newContactRel}
              onChangeText={setNewContactRel}
            />

            <TouchableOpacity
              style={styles.checkboxRow}
              onPress={() => setNewContactPrimary(!newContactPrimary)}
              activeOpacity={0.7}
            >
              <View style={[styles.checkbox, newContactPrimary && styles.checkboxActive]}>
                {newContactPrimary && <Text style={styles.checkmark}>✓</Text>}
              </View>
              <Text style={styles.checkboxLabel}>Set as Primary Recipient for 1-Tap SOS</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.submitModalBtn}
              onPress={handleAddContact}
              activeOpacity={0.85}
            >
              <Text style={styles.submitModalBtnText}>Save Guardian Contact</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <AuthModal
        visible={authModalVisible}
        onClose={() => setAuthModalVisible(false)}
        onSuccess={(u) => {
          setCurrentUser(u);
          loadData();
        }}
      />

      <FirstAidModal
        visible={firstAidModalVisible}
        onClose={() => setFirstAidModalVisible(false)}
      />

      {/* Examiner Demo Mode: Simulated Guardian Console Modal */}
      <GuardianSimulationModal
        visible={demoSimModalVisible}
        onClose={() => setDemoSimModalVisible(false)}
        payload={activeSimPayload}
        onAcknowledged={() => {
          setDemoSimModalVisible(false);
          Alert.alert(
            '✅ Two-Way Dispatch Confirmed',
            'The simulated guardian has acknowledged the alert with ETA 4 minutes.'
          );
        }}
      />
    </SafeAreaView>
  );
}

const getStyles = (THEME: ThemeColors) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: THEME.background,
  },
  mainScrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 40,
  },

  // Theme Options
  themeOptionsGrid: {
    gap: 10,
    marginTop: 6,
  },
  themeOptionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: THEME.cardElevated,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: THEME.cardBorder,
    padding: 12,
    gap: 12,
  },
  themeOptionCardActive: {
    borderColor: THEME.emerald,
    backgroundColor: THEME.emeraldBg,
  },
  themeOptionEmoji: {
    fontSize: 22,
  },
  themeOptionInfo: {
    flex: 1,
  },
  themeOptionTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: THEME.textPrimary,
  },
  themeOptionTitleActive: {
    color: THEME.emerald,
  },
  themeOptionDesc: {
    fontSize: 11,
    color: THEME.textSecondary,
    marginTop: 2,
  },
  themeActiveBadge: {
    backgroundColor: THEME.emerald,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  themeActiveBadgeText: {
    fontSize: 9,
    fontWeight: '900',
    color: '#FFFFFF',
    letterSpacing: 0.5,
  },

  // Top Header
  topHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: THEME.cardBorder,
  },
  topHeaderTitleCol: {
    flex: 1,
  },
  topHeaderTag: {
    fontSize: 9,
    fontWeight: '900',
    color: THEME.emerald,
    letterSpacing: 1,
  },
  topHeaderTitle: {
    fontSize: 16,
    fontWeight: '900',
    color: THEME.textPrimary,
    marginTop: 1,
  },
  secureStorageBadge: {
    backgroundColor: THEME.cardElevated,
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: THEME.cardBorder,
  },
  secureStorageText: {
    fontSize: 9,
    fontWeight: '800',
    color: THEME.textSecondary,
    letterSpacing: 0.5,
  },

  // 1. Account Hero Card
  accountCard: {
    backgroundColor: THEME.cardBg,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: THEME.cardBorder,
    padding: 14,
    marginBottom: 16,
  },
  accountHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  avatarCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: THEME.blueBg,
    borderWidth: 2,
    borderColor: THEME.blue,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  avatarText: {
    fontSize: 18,
    fontWeight: '900',
    color: THEME.blue,
  },
  accountDetailsCol: {
    flex: 1,
  },
  accountNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  accountName: {
    fontSize: 15,
    fontWeight: '800',
    color: THEME.textPrimary,
  },
  googleBadge: {
    backgroundColor: THEME.blueBg,
    paddingVertical: 2,
    paddingHorizontal: 6,
    borderRadius: 4,
  },
  googleBadgeText: {
    fontSize: 8,
    fontWeight: '900',
    color: THEME.blue,
    letterSpacing: 0.5,
  },
  accountEmail: {
    fontSize: 11,
    color: THEME.textSecondary,
    marginTop: 2,
  },
  cloudTelemetryBox: {
    backgroundColor: THEME.cardElevated,
    borderRadius: 10,
    padding: 10,
    borderWidth: 1,
    borderColor: THEME.cardBorder,
    marginBottom: 12,
  },
  telemetryStatusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 8,
  },
  statusLiveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: THEME.emerald,
  },
  telemetryHeadline: {
    fontSize: 11,
    fontWeight: '800',
    color: THEME.emerald,
  },
  telemetryMetricsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    borderTopColor: THEME.divider,
    paddingTop: 8,
  },
  telemetryMetricItem: {
    flex: 1,
  },
  telemetryMetricLabel: {
    fontSize: 8,
    fontWeight: '800',
    color: THEME.textMuted,
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  telemetryMetricValue: {
    fontSize: 11,
    fontWeight: '700',
    color: THEME.textPrimary,
  },
  accountActionsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  syncActionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: THEME.blue,
    borderRadius: 8,
    paddingVertical: 8,
    gap: 6,
  },
  syncActionIcon: {
    fontSize: 12,
  },
  syncActionText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  signOutActionBtn: {
    backgroundColor: THEME.cardElevated,
    borderWidth: 1,
    borderColor: THEME.cardBorder,
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  signOutActionText: {
    fontSize: 11,
    fontWeight: '700',
    color: THEME.textSecondary,
  },

  // Connect Google Card (Guest mode)
  connectGoogleCard: {
    flexDirection: 'row',
    backgroundColor: THEME.cardBg,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: THEME.cardBorder,
    padding: 14,
    marginBottom: 16,
    alignItems: 'center',
  },
  connectGoogleIconBg: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: THEME.blueBg,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  connectGoogleIcon: {
    fontSize: 20,
  },
  connectGoogleTextCol: {
    flex: 1,
  },
  connectGoogleTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: THEME.textPrimary,
    marginBottom: 2,
  },
  connectGoogleSub: {
    fontSize: 11,
    color: THEME.textSecondary,
    lineHeight: 15,
    marginBottom: 8,
  },
  connectGooglePill: {
    backgroundColor: THEME.blueBg,
    borderWidth: 1,
    borderColor: THEME.blueBorder,
    borderRadius: 6,
    paddingVertical: 4,
    paddingHorizontal: 8,
    alignSelf: 'flex-start',
  },
  connectGooglePillText: {
    fontSize: 9,
    fontWeight: '900',
    color: THEME.blue,
    letterSpacing: 0.5,
  },

  // Generic Section Card
  sectionCard: {
    backgroundColor: THEME.cardBg,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: THEME.cardBorder,
    padding: 14,
    marginBottom: 16,
  },
  sectionCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  sectionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 8,
  },
  sectionIconBadge: {
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  sectionIconEmoji: {
    fontSize: 15,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: THEME.textPrimary,
  },
  sectionSub: {
    fontSize: 10,
    color: THEME.textSecondary,
    marginTop: 1,
  },
  headerActionPill: {
    backgroundColor: THEME.cardElevated,
    borderWidth: 1,
    borderColor: THEME.cardBorder,
    paddingVertical: 4,
    paddingHorizontal: 9,
    borderRadius: 6,
  },
  headerActionPillSave: {
    backgroundColor: THEME.emeraldBg,
    borderColor: THEME.emeraldBorder,
  },
  headerActionPillText: {
    fontSize: 10,
    fontWeight: '800',
    color: THEME.textSecondary,
  },
  headerActionPillTextSave: {
    color: THEME.emerald,
  },
  headerAddBtn: {
    backgroundColor: THEME.emeraldBg,
    borderWidth: 1,
    borderColor: THEME.emeraldBorder,
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 6,
  },
  headerAddBtnText: {
    fontSize: 11,
    fontWeight: '800',
    color: THEME.emerald,
  },

  // Medical Info Grid
  medicalInfoGrid: {
    gap: 10,
  },
  medicalTileRow: {
    flexDirection: 'row',
    gap: 10,
  },
  medicalTile: {
    flex: 1,
    backgroundColor: THEME.cardElevated,
    borderRadius: 10,
    padding: 10,
    borderWidth: 1,
    borderColor: THEME.cardBorder,
  },
  medicalTileLabel: {
    fontSize: 8,
    fontWeight: '800',
    color: THEME.textMuted,
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  medicalTileValue: {
    fontSize: 13,
    fontWeight: '800',
    color: THEME.textPrimary,
  },
  medicalTileSubValue: {
    fontSize: 11,
    color: THEME.textSecondary,
    lineHeight: 16,
  },
  bloodBadgeLarge: {
    backgroundColor: THEME.primaryBg,
    borderWidth: 1,
    borderColor: THEME.primaryBorder,
    borderRadius: 6,
    paddingVertical: 2,
    paddingHorizontal: 8,
    alignSelf: 'flex-start',
  },
  bloodBadgeLargeText: {
    fontSize: 14,
    fontWeight: '900',
    color: THEME.primary,
  },
  medicalDetailBlock: {
    backgroundColor: THEME.cardElevated,
    borderRadius: 10,
    padding: 10,
    borderWidth: 1,
    borderColor: THEME.cardBorder,
  },

  // Medical Form Fields
  formContainer: {
    gap: 10,
  },
  inputLabel: {
    fontSize: 9,
    fontWeight: '800',
    color: THEME.textSecondary,
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  textInput: {
    backgroundColor: THEME.cardElevated,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: THEME.cardBorder,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 12,
    color: THEME.textPrimary,
  },
  textAreaInput: {
    minHeight: 65,
    textAlignVertical: 'top',
  },
  bloodTypeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 6,
  },
  bloodChip: {
    backgroundColor: THEME.cardElevated,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: THEME.cardBorder,
    paddingVertical: 5,
    paddingHorizontal: 10,
  },
  bloodChipActive: {
    backgroundColor: THEME.primaryBg,
    borderColor: THEME.primary,
  },
  bloodChipText: {
    fontSize: 11,
    fontWeight: '700',
    color: THEME.textSecondary,
  },
  bloodChipTextActive: {
    color: THEME.primary,
    fontWeight: '900',
  },

  // Contact Cards
  emptyContactsCard: {
    backgroundColor: THEME.cardElevated,
    borderRadius: 10,
    padding: 18,
    alignItems: 'center',
  },
  emptyContactsIcon: {
    fontSize: 22,
    marginBottom: 6,
  },
  emptyContactsTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: THEME.textPrimary,
  },
  emptyContactsSub: {
    fontSize: 10,
    color: THEME.textSecondary,
    textAlign: 'center',
    marginTop: 2,
  },
  contactCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: THEME.cardElevated,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: THEME.cardBorder,
    padding: 12,
    marginBottom: 8,
  },
  contactMainCol: {
    flex: 1,
  },
  contactNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  contactName: {
    fontSize: 13,
    fontWeight: '800',
    color: THEME.textPrimary,
  },
  primaryContactBadge: {
    backgroundColor: THEME.emeraldBg,
    paddingVertical: 2,
    paddingHorizontal: 6,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: THEME.emeraldBorder,
  },
  primaryContactBadgeText: {
    fontSize: 8,
    fontWeight: '900',
    color: THEME.emerald,
    letterSpacing: 0.5,
  },
  contactPhone: {
    fontSize: 11,
    color: THEME.blue,
    fontWeight: '700',
    marginTop: 2,
  },
  contactRel: {
    fontSize: 10,
    color: THEME.textMuted,
    marginTop: 1,
  },
  contactActionsCol: {
    alignItems: 'flex-end',
    gap: 6,
  },
  makePrimaryPill: {
    backgroundColor: THEME.cardBg,
    borderWidth: 1,
    borderColor: THEME.cardBorder,
    borderRadius: 6,
    paddingVertical: 3,
    paddingHorizontal: 8,
  },
  makePrimaryPillText: {
    fontSize: 9,
    fontWeight: '800',
    color: THEME.textSecondary,
  },
  deleteContactIconBtn: {
    padding: 4,
  },
  deleteContactIcon: {
    fontSize: 13,
  },

  // Trigger Rows
  triggerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 6,
  },
  triggerTextCol: {
    flex: 1,
    marginRight: 12,
  },
  triggerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 2,
  },
  triggerTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: THEME.textPrimary,
  },
  stealthPill: {
    backgroundColor: THEME.primaryBg,
    paddingVertical: 1,
    paddingHorizontal: 5,
    borderRadius: 4,
  },
  stealthPillText: {
    fontSize: 7,
    fontWeight: '900',
    color: THEME.primary,
    letterSpacing: 0.5,
  },
  triggerDesc: {
    fontSize: 10,
    color: THEME.textSecondary,
    lineHeight: 14,
  },
  cardDivider: {
    height: 1,
    backgroundColor: THEME.divider,
    marginVertical: 10,
  },
  firstAidBannerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: THEME.cardElevated,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: THEME.cardBorder,
    padding: 10,
  },
  firstAidBannerIcon: {
    fontSize: 18,
    marginRight: 10,
  },
  firstAidBannerTextCol: {
    flex: 1,
  },
  firstAidBannerTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: THEME.textPrimary,
  },
  firstAidBannerSub: {
    fontSize: 10,
    color: THEME.textSecondary,
    marginTop: 1,
  },
  firstAidBannerArrow: {
    fontSize: 12,
    color: THEME.textSecondary,
  },

  // History Cards
  emptyHistoryBox: {
    backgroundColor: THEME.cardElevated,
    borderRadius: 10,
    padding: 14,
    alignItems: 'center',
  },
  emptyHistoryText: {
    fontSize: 11,
    color: THEME.textSecondary,
    textAlign: 'center',
  },
  historyCard: {
    backgroundColor: THEME.cardElevated,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: THEME.cardBorder,
    padding: 10,
    marginBottom: 8,
  },
  historyTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  historyStatusPill: {
    paddingVertical: 2,
    paddingHorizontal: 6,
    borderRadius: 4,
    borderWidth: 1,
  },
  historyStatusText: {
    fontSize: 8,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  historyTimestamp: {
    fontSize: 10,
    color: THEME.textMuted,
  },
  historyCoordsText: {
    fontSize: 11,
    fontWeight: '700',
    color: THEME.textPrimary,
    marginTop: 2,
  },
  historyRecipientsText: {
    fontSize: 10,
    color: THEME.textSecondary,
    marginTop: 1,
  },

  // Modal: Add Contact
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalCard: {
    width: '100%',
    backgroundColor: THEME.cardBg,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: THEME.cardBorder,
    padding: 20,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: THEME.textPrimary,
  },
  modalCloseIcon: {
    fontSize: 18,
    color: THEME.textSecondary,
    padding: 4,
  },
  checkboxRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 6,
    marginBottom: 16,
    gap: 8,
  },
  checkbox: {
    width: 18,
    height: 18,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: THEME.textMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxActive: {
    backgroundColor: THEME.emerald,
    borderColor: THEME.emerald,
  },
  checkmark: {
    fontSize: 11,
    color: '#FFFFFF',
    fontWeight: '900',
  },
  checkboxLabel: {
    fontSize: 11,
    color: THEME.textSecondary,
    flex: 1,
  },
  submitModalBtn: {
    backgroundColor: THEME.primary,
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
  },
  submitModalBtnText: {
    fontSize: 13,
    fontWeight: '900',
    color: '#FFFFFF',
    letterSpacing: 0.5,
  },
});
