import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  ScrollView,
  StatusBar,
  Animated,
  Dimensions,
  ActivityIndicator,
  Alert,
  Modal,
  TextInput,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { HomeScreenNavigationProp } from '../types/navigation';
import { LocationService } from '../services/locationService';
import { SosService } from '../services/sosService';
import { AlertService } from '../services/alertService';
import { DisasterService } from '../services/disasterService';
import { AuthService } from '../services/authService';
import { CloudSyncService } from '../services/cloudSyncService';
import {
  LocationCoords,
  UserProfile,
  EmergencyContact,
  DisasterThreatAssessment,
  SafetyNewsItem,
  AuthUser,
  CloudSyncState,
} from '../types';
import SosModal from '../components/SosModal';
import BeingFollowedModal from '../components/BeingFollowedModal';
import FakeCallModal from '../components/FakeCallModal';
import JourneySentinelModal from '../components/JourneySentinelModal';
import AuthModal from '../components/AuthModal';
import FirstAidModal from '../components/FirstAidModal';
import PowerTriggerCountdownModal from '../components/PowerTriggerCountdownModal';
import GuardianResponseBanner from '../components/GuardianResponseBanner';
import GuardianSimulationModal from '../components/GuardianSimulationModal';
import {
  DemoModeService,
  SimulatedSosPayload,
  GuardianAcknowledgment,
} from '../services/demoModeService';
import { HardwareTriggerService } from '../services/hardwareTriggerService';
import { useTheme } from '../context/ThemeContext';
import { ThemeColors } from '../theme/colors';

const { width } = Dimensions.get('window');
const SOS_BUTTON_SIZE = Math.min(width * 0.42, 170);

interface HomeScreenProps {
  navigation: HomeScreenNavigationProp;
}

export default function HomeScreen({ navigation }: HomeScreenProps) {
  const { theme, isDark } = useTheme();
  const THEME = theme;
  const styles = useMemo(() => getStyles(theme), [theme]);

  const [coords, setCoords] = useState<LocationCoords | null>(null);
  const [loadingLocation, setLoadingLocation] = useState<boolean>(false);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [contacts, setContacts] = useState<EmergencyContact[]>([]);

  // Modals
  const [sosModalVisible, setSosModalVisible] = useState<boolean>(false);
  const [beingFollowedVisible, setBeingFollowedVisible] = useState<boolean>(false);
  const [fakeCallVisible, setFakeCallVisible] = useState<boolean>(false);
  const [journeySentinelVisible, setJourneySentinelVisible] = useState<boolean>(false);
  const [parentModalVisible, setParentModalVisible] = useState<boolean>(false);
  const [parentName, setParentName] = useState<string>('');
  const [parentPhone, setParentPhone] = useState<string>('');
  const [authModalVisible, setAuthModalVisible] = useState<boolean>(false);

  // First Aid & Hardware Trigger State
  const [firstAidModalVisible, setFirstAidModalVisible] = useState<boolean>(false);
  const [initialPlaybookId, setInitialPlaybookId] = useState<string | undefined>(undefined);
  const [powerTriggerModalVisible, setPowerTriggerModalVisible] = useState<boolean>(false);

  // Authentication & Cloud Sync State
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(null);
  const [syncState, setSyncState] = useState<CloudSyncState | null>(null);

  // Examiner Presentation Demo Mode & Guardian Simulation State
  const [isDemoMode, setIsDemoMode] = useState<boolean>(true);
  const [simulatedPayload, setSimulatedPayload] = useState<SimulatedSosPayload | null>(null);
  const [guardianSimVisible, setGuardianSimVisible] = useState<boolean>(false);
  const [guardianAck, setGuardianAck] = useState<GuardianAcknowledgment | null>(null);

  // Disaster & News State
  const [assessment, setAssessment] = useState<DisasterThreatAssessment | null>(null);
  const [newsList, setNewsList] = useState<SafetyNewsItem[]>([]);
  const [newsFilter, setNewsFilter] = useState<'all' | 'disaster' | 'women_safety' | 'weather'>('all');

  // Multi-Ring Pulse Animation & Tactile Micro-interactions
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const pulseWave = useRef(new Animated.Value(1)).current;
  const sosScaleAnim = useRef(new Animated.Value(1)).current;
  const armedBeaconAnim = useRef(new Animated.Value(0.4)).current;
  const radarDotAnim = useRef(new Animated.Value(0.3)).current;
  const screenFadeAnim = useRef(new Animated.Value(0)).current;
  const screenSlideAnim = useRef(new Animated.Value(16)).current;

  useEffect(() => {
    loadData();

    HardwareTriggerService.initialize();
    const unsubPower = HardwareTriggerService.onPowerTrigger(() => {
      setPowerTriggerModalVisible(true);
    });

    const unsubAuth = AuthService.onAuthStateChanged((user) => {
      setCurrentUser(user);
    });

    const unsubSync = CloudSyncService.onSyncStateChanged((state) => {
      setSyncState(state);
    });

    DemoModeService.init().then((enabled) => {
      setIsDemoMode(enabled);
      setGuardianAck(DemoModeService.getCurrentAcknowledgment());
    });

    const unsubDemoState = DemoModeService.onStateChanged((enabled) => {
      setIsDemoMode(enabled);
    });

    const unsubDemoAlert = DemoModeService.onGuardianAlertReceived((payload) => {
      setSimulatedPayload(payload);
    });

    const unsubDemoAck = DemoModeService.onGuardianAcknowledged((ack) => {
      setGuardianAck(ack);
    });

    // Screen entrance animation
    Animated.parallel([
      Animated.timing(screenFadeAnim, {
        toValue: 1,
        duration: 450,
        useNativeDriver: true,
      }),
      Animated.spring(screenSlideAnim, {
        toValue: 0,
        tension: 50,
        friction: 8,
        useNativeDriver: true,
      }),
    ]).start();

    // Dual-wave pulsating shockwave
    const pulseLoop = Animated.loop(
      Animated.parallel([
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.15,
            duration: 1100,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 1100,
            useNativeDriver: true,
          }),
        ]),
        Animated.sequence([
          Animated.timing(pulseWave, {
            toValue: 1.35,
            duration: 1400,
            useNativeDriver: true,
          }),
          Animated.timing(pulseWave, {
            toValue: 1,
            duration: 1400,
            useNativeDriver: true,
          }),
        ]),
      ])
    );
    pulseLoop.start();

    // Breathing pulse on ARMED badge
    const armedBeaconLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(armedBeaconAnim, {
          toValue: 1,
          duration: 900,
          useNativeDriver: true,
        }),
        Animated.timing(armedBeaconAnim, {
          toValue: 0.35,
          duration: 900,
          useNativeDriver: true,
        }),
      ])
    );
    armedBeaconLoop.start();

    // Blinking radar dot loop
    const radarDotLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(radarDotAnim, {
          toValue: 1,
          duration: 700,
          useNativeDriver: true,
        }),
        Animated.timing(radarDotAnim, {
          toValue: 0.25,
          duration: 700,
          useNativeDriver: true,
        }),
      ])
    );
    radarDotLoop.start();

    return () => {
      pulseLoop.stop();
      armedBeaconLoop.stop();
      radarDotLoop.stop();
      unsubAuth();
      unsubSync();
      unsubPower();
      unsubDemoState();
      unsubDemoAlert();
      unsubDemoAck();
    };
  }, []);

  useEffect(() => {
    const threat = DisasterService.getDisasterAssessment(coords);
    const news = DisasterService.getSafetyNews(coords);
    setAssessment(threat);
    setNewsList(news);

    // Auto-sync live GPS coordinates to Google Cloud if user is signed in
    if (coords && currentUser && currentUser.provider !== 'guest') {
      CloudSyncService.syncToCloud(coords);
    }
  }, [coords, currentUser]);

  const loadData = async () => {
    refreshLocation();
    const p = await SosService.getProfile();
    const c = await SosService.getContacts();
    setProfile(p);
    setContacts(c);
  };

  const refreshLocation = async () => {
    setLoadingLocation(true);
    try {
      const hasPerm = await LocationService.checkPermission();
      if (!hasPerm) {
        const granted = await LocationService.requestPermission();
        if (!granted) {
          Alert.alert(
            'Location Permission Required',
            'Guardian requires location access to pinpoint your emergency coordinates and locate nearby safe havens.',
            [
              { text: 'Cancel', style: 'cancel' },
              { text: 'Settings', onPress: () => LocationService.openLocationSettings() },
            ]
          );
        }
      } else {
        const isEnabled = await LocationService.isLocationEnabled();
        if (!isEnabled) {
          Alert.alert(
            'Location Services Disabled',
            'Please turn on Device Location / GPS in your phone settings to detect your real-time coordinates and nearby emergency services.',
            [
              { text: 'Cancel', style: 'cancel' },
              { text: 'Open Settings', onPress: () => LocationService.openLocationSettings() },
            ]
          );
        }
      }
      const loc = await LocationService.getCurrentLocation();
      setCoords(loc);
    } catch {
      // Defaults handled in service
    } finally {
      setLoadingLocation(false);
    }
  };

  const handleCall = (num: string) => {
    AlertService.triggerHaptic();
    SosService.dialEmergencyServices(num);
  };

  const primaryContact = contacts.find((c) => c.isPrimary) || contacts[0];
  const isDefaultPhone =
    !primaryContact ||
    primaryContact.phone.includes('98765 43210') ||
    primaryContact.phone.includes('9876543210');

  const handleOpenParentModal = () => {
    setParentName(
      primaryContact
        ? primaryContact.name.includes('Primary Guardian')
          ? 'Parents'
          : primaryContact.name
        : 'Parents'
    );
    setParentPhone(isDefaultPhone ? '' : primaryContact?.phone || '');
    setParentModalVisible(true);
  };

  const handleSaveParentContact = async () => {
    const trimmedPhone = parentPhone.trim();
    if (!trimmedPhone) {
      Alert.alert('Phone Number Required', 'Please enter your parents or spouse mobile number.');
      return;
    }
    const trimmedName = parentName.trim() || 'Parents';
    const updated = await SosService.updatePrimaryGuardian(trimmedName, trimmedPhone);
    setContacts(updated);
    setParentModalVisible(false);
    Alert.alert(
      'Parents Number Saved! 🛡️',
      `The SOS button is now directly linked to dispatch your live GPS location to ${trimmedName} (${trimmedPhone}).`
    );
  };

  const handleToggleDemoMode = async () => {
    AlertService.triggerHaptic();
    const next = await DemoModeService.toggleDemoMode();
    setIsDemoMode(next);
    Alert.alert(
      next ? '🎓 Presentation Demo Mode ON' : '⚡ Live Emergency Mode ON',
      next
        ? 'Examiner Demo Mode is active! Triggering SOS will simulate cellular transmission and open the Guardian Response Console without needing real SIM SMS balance.'
        : 'Live mode active! SOS alerts will trigger native hardware actions, direct phone calls, and real SMS dispatch.'
    );
  };

  const handleDirectSosPress = () => {
    AlertService.triggerHaptic();

    if (isDefaultPhone && !isDemoMode) {
      Alert.alert(
        'Set Parents Mobile Number',
        'Please enter your parents or spouse mobile number so the emergency SOS with live GPS reaches them directly.',
        [
          {
            text: '✏️ Enter Number Now',
            onPress: handleOpenParentModal,
          },
          {
            text: 'Send via SMS Anyway',
            onPress: () => setSosModalVisible(true),
          },
          { text: 'Cancel', style: 'cancel' },
        ]
      );
      return;
    }

    setSosModalVisible(true);
  };

  const filteredNews = newsList.filter((item) => {
    if (newsFilter === 'all') return true;
    return item.category === newsFilter;
  });

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <StatusBar barStyle={theme.statusBarStyle} backgroundColor={theme.background} />

      <ScrollView
        style={styles.mainScrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        nestedScrollEnabled={true}
        keyboardShouldPersistTaps="handled"
        bounces={true}
      >
        <Animated.View style={{ flex: 1, opacity: screenFadeAnim, transform: [{ translateY: screenSlideAnim }] }}>
        {/* ========================================================
            1. TOP COMMAND BAR: IDENTITY & SYSTEM STATUS
        ======================================================== */}
        <View style={styles.commandHeader}>
          <View style={styles.commandBrandRow}>
            <View style={styles.logoBadgeContainer}>
              <Image
                source={require('../assets/logo.png')}
                style={styles.logoBadge}
                resizeMode="contain"
              />
            </View>
            <View style={styles.brandTitleCol}>
              <Text style={styles.brandTag}>
                {isDark ? 'TACTICAL SYSTEM • ONLINE' : 'GUARDIAN SHIELD • ACTIVE'}
              </Text>
              <Text style={styles.brandTitle} numberOfLines={1}>
                {currentUser?.name || (profile ? profile.name : 'Guardian Agent')}
              </Text>
            </View>
          </View>

          <View style={styles.commandRightActions}>
            {/* Quick 1-Tap Examiner Demo Mode Switcher */}
            <TouchableOpacity
              style={[
                styles.demoTogglePill,
                isDemoMode && styles.demoTogglePillActive,
              ]}
              onPress={handleToggleDemoMode}
              activeOpacity={0.8}
              accessibilityLabel="Toggle Presentation Demo Mode"
            >
              <Text style={[styles.demoToggleText, isDemoMode && styles.demoToggleTextActive]}>
                {isDemoMode ? '🎓 DEMO' : '⚡ LIVE'}
              </Text>
            </TouchableOpacity>

            {currentUser && currentUser.provider !== 'guest' ? (
              <TouchableOpacity
                style={styles.cloudStatusPill}
                onPress={() => navigation.navigate('ProfileTab')}
                activeOpacity={0.8}
              >
                <Text style={styles.cloudStatusIcon}>☁️</Text>
                <Text style={styles.cloudStatusText}>
                  {syncState?.syncStatus === 'syncing' ? 'SYNC' : 'LIVE'}
                </Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity
                style={styles.cloudSyncPromptPill}
                onPress={() => setAuthModalVisible(true)}
                activeOpacity={0.8}
              >
                <Text style={styles.cloudSyncPromptText}>SYNC GPS</Text>
              </TouchableOpacity>
            )}

            <View style={styles.armedPill}>
              <Animated.View
                style={[
                  styles.armedDot,
                  {
                    opacity: armedBeaconAnim,
                    transform: [
                      {
                        scale: armedBeaconAnim.interpolate({
                          inputRange: [0.35, 1],
                          outputRange: [0.85, 1.3],
                        }),
                      },
                    ],
                  },
                ]}
              />
              <Text style={styles.armedText}>ARMED</Text>
            </View>
          </View>
        </View>

        {/* ========================================================
            2. TELEMETRY STRIP (GPS ANCHOR & LINKED GUARDIAN)
        ======================================================== */}
        <View style={styles.telemetryCard}>
          {/* GPS Location Left Segment */}
          <TouchableOpacity
            style={styles.telemetryLocationCol}
            onPress={refreshLocation}
            activeOpacity={0.75}
          >
            <View style={styles.telemetryIconBadge}>
              <Text style={styles.telemetryPinIcon}>📍</Text>
            </View>
            <View style={styles.telemetryTextCol}>
              <Text style={styles.telemetryLabel}>LIVE GPS ANCHOR</Text>
              <Text style={styles.telemetryValue} numberOfLines={1}>
                {coords ? LocationService.formatLocationName(coords) : 'Acquiring GPS fix...'}
              </Text>
            </View>
            {loadingLocation && (
              <ActivityIndicator size="small" color={THEME.blue} style={{ marginLeft: 4 }} />
            )}
          </TouchableOpacity>

          <View style={styles.telemetryDivider} />

          {/* Linked Parent Right Segment */}
          <TouchableOpacity
            style={styles.telemetryParentCol}
            onPress={handleOpenParentModal}
            activeOpacity={0.75}
          >
            <View style={styles.telemetryIconBadge}>
              <Text style={styles.telemetryParentIcon}>{isDefaultPhone ? '⚠️' : '🛡️'}</Text>
            </View>
            <View style={styles.telemetryTextCol}>
              <Text style={styles.telemetryLabel}>EMERGENCY RECIPIENT</Text>
              <Text
                style={[
                  styles.telemetryValue,
                  isDefaultPhone && { color: THEME.amber },
                ]}
                numberOfLines={1}
              >
                {isDefaultPhone ? 'Unlinked (Tap)' : primaryContact?.name || 'Parents'}
              </Text>
            </View>
          </TouchableOpacity>
        </View>

        {/* ========================================================
            2.5. GUARDIAN ACKNOWLEDGMENT (TWO-WAY RESPONSE FEED)
        ======================================================== */}
        {guardianAck && (
          <View
            style={[
              styles.guardianAckBanner,
              {
                backgroundColor: isDark ? '#111827' : '#FFFFFF',
                borderColor: guardianAck.policeEscalated ? THEME.primary : THEME.emerald,
              },
            ]}
          >
            <View style={styles.guardianAckHeader}>
              <View style={styles.guardianAckBadgeRow}>
                <View
                  style={[
                    styles.guardianAckDot,
                    {
                      backgroundColor: guardianAck.policeEscalated
                        ? THEME.primary
                        : THEME.emerald,
                    },
                  ]}
                />
                <Text
                  style={[
                    styles.guardianAckTitle,
                    {
                      color: guardianAck.policeEscalated
                        ? THEME.primary
                        : THEME.emerald,
                    },
                  ]}
                >
                  {guardianAck.policeEscalated
                    ? '🚓 POLICE PATROL DISPATCHED'
                    : '🟢 GUARDIAN ON THE WAY'}
                </Text>
              </View>
              <TouchableOpacity
                onPress={() => DemoModeService.clearActiveDemo()}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Text style={[styles.guardianAckClose, { color: THEME.textMuted }]}>✕</Text>
              </TouchableOpacity>
            </View>

            <Text style={[styles.guardianAckNote, { color: THEME.textPrimary }]}>
              "{guardianAck.message}"
            </Text>

            <View style={styles.guardianAckMetaRow}>
              <Text style={[styles.guardianAckMetaText, { color: THEME.textSecondary }]}>
                ⏱️ ETA ~{guardianAck.etaMinutes} mins • {guardianAck.guardianName}
              </Text>
              <TouchableOpacity
                style={[styles.guardianAckInspectBtn, { backgroundColor: isDark ? 'rgba(59, 130, 246, 0.15)' : '#EFF6FF', borderColor: THEME.blue }]}
                onPress={() => setGuardianSimVisible(true)}
              >
                <Text style={[styles.guardianAckInspectText, { color: THEME.blue }]}>
                  View Parent Console →
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* ========================================================
            3. HERO SOS REACTOR (TACTICAL EMERGENCY CORE)
        ======================================================== */}
        <View style={styles.heroSosSection}>
          <View style={styles.reactorContainer}>
            {/* Outer Shockwave 2 */}
            <Animated.View
              style={[
                styles.reactorShockwaveOuter,
                {
                  transform: [{ scale: pulseWave }],
                  opacity: pulseWave.interpolate({
                    inputRange: [1, 1.35],
                    outputRange: [0.65, 0.15],
                  }),
                },
              ]}
            />
            {/* Inner Shockwave 1 */}
            <Animated.View
              style={[
                styles.reactorShockwaveInner,
                {
                  transform: [{ scale: pulseAnim }],
                  opacity: pulseAnim.interpolate({
                    inputRange: [1, 1.15],
                    outputRange: [0.85, 0.35],
                  }),
                },
              ]}
            />

            {/* Main Interactive Button with Spring Tactile Feedback */}
            <Animated.View style={{ transform: [{ scale: sosScaleAnim }] }}>
              <TouchableOpacity
                activeOpacity={0.9}
                style={styles.sosReactorButton}
                onPress={handleDirectSosPress}
                onPressIn={() => {
                  Animated.spring(sosScaleAnim, {
                    toValue: 0.91,
                    useNativeDriver: true,
                  }).start();
                }}
                onPressOut={() => {
                  Animated.spring(sosScaleAnim, {
                    toValue: 1,
                    friction: 3.5,
                    tension: 45,
                    useNativeDriver: true,
                  }).start();
                }}
                accessibilityLabel="Emergency SOS Dispatch Button"
                accessibilityHint="Instant 1-tap live distress broadcast"
                accessibilityRole="button"
              >
                <View style={styles.sosCoreRing}>
                  <Text style={styles.sosCoreIcon}>⚡</Text>
                  <Text style={styles.sosCoreText}>SOS</Text>
                  <Text style={styles.sosCoreSub}>DISPATCH</Text>
                </View>
              </TouchableOpacity>
            </Animated.View>
          </View>

          {/* Status & Subtitle Telemetry */}
          <View style={styles.sosTelemetryBanner}>
            <Animated.View
              style={[
                styles.sosLiveRadarDot,
                {
                  opacity: radarDotAnim,
                  transform: [
                    {
                      scale: radarDotAnim.interpolate({
                        inputRange: [0.25, 1],
                        outputRange: [0.85, 1.3],
                      }),
                    },
                  ],
                },
              ]}
            />
            <Text style={styles.sosTelemetryTitle}>
              {isDefaultPhone
                ? 'LINK PARENT PHONE TO ENABLE DIRECT 1-TAP GPS SMS'
                : `1-TAP BROADCASTS LIVE GPS SMS TO ${primaryContact?.name?.toUpperCase()}`}
            </Text>
          </View>

          <Text style={styles.powerHardwareNotice}>
            ⚡ Triple-click Power button also triggers emergency dispatch
          </Text>
        </View>

        {/* ========================================================
            4. 1-TAP EMERGENCY HOTLINES (TACTICAL DIAL MATRIX)
        ======================================================== */}
        <View style={styles.hotlinesContainer}>
          <Text style={styles.groupHeaderTitle}>EMERGENCY DISPATCH SERVICES</Text>

          <View style={styles.hotlinesMatrix}>
            <TouchableOpacity
              style={[styles.hotlineMatrixBtn, { borderColor: 'rgba(239, 68, 68, 0.4)' }]}
              onPress={() => handleCall('112')}
              activeOpacity={0.78}
            >
              <View style={[styles.hotlineBadgeIcon, { backgroundColor: 'rgba(239, 68, 68, 0.15)' }]}>
                <Text style={styles.hotlineEmoji}>👮</Text>
              </View>
              <View style={styles.hotlineInfoCol}>
                <Text style={styles.hotlineName}>Police</Text>
                <Text style={[styles.hotlineCode, { color: '#EF4444' }]}>112</Text>
              </View>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.hotlineMatrixBtn, { borderColor: 'rgba(59, 130, 246, 0.4)' }]}
              onPress={() => handleCall('108')}
              activeOpacity={0.78}
            >
              <View style={[styles.hotlineBadgeIcon, { backgroundColor: 'rgba(59, 130, 246, 0.15)' }]}>
                <Text style={styles.hotlineEmoji}>🚑</Text>
              </View>
              <View style={styles.hotlineInfoCol}>
                <Text style={styles.hotlineName}>Ambulance</Text>
                <Text style={[styles.hotlineCode, { color: '#3B82F6' }]}>108</Text>
              </View>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.hotlineMatrixBtn, { borderColor: 'rgba(236, 72, 153, 0.4)' }]}
              onPress={() => handleCall('1091')}
              activeOpacity={0.78}
            >
              <View style={[styles.hotlineBadgeIcon, { backgroundColor: 'rgba(236, 72, 153, 0.15)' }]}>
                <Text style={styles.hotlineEmoji}>👩</Text>
              </View>
              <View style={styles.hotlineInfoCol}>
                <Text style={styles.hotlineName}>Women Helpline</Text>
                <Text style={[styles.hotlineCode, { color: '#EC4899' }]}>1091</Text>
              </View>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.hotlineMatrixBtn, { borderColor: 'rgba(245, 158, 11, 0.4)' }]}
              onPress={() => handleCall('181')}
              activeOpacity={0.78}
            >
              <View style={[styles.hotlineBadgeIcon, { backgroundColor: 'rgba(245, 158, 11, 0.15)' }]}>
                <Text style={styles.hotlineEmoji}>🛡️</Text>
              </View>
              <View style={styles.hotlineInfoCol}>
                <Text style={styles.hotlineName}>Crisis Help</Text>
                <Text style={[styles.hotlineCode, { color: '#F59E0B' }]}>181</Text>
              </View>
            </TouchableOpacity>
          </View>
        </View>

        {/* ========================================================
            5. TACTICAL ACTION BENTO GRID (2x2 DEFENSE ARSENAL)
        ======================================================== */}
        <View style={styles.bentoSection}>
          <Text style={styles.groupHeaderTitle}>TACTICAL DEFENSE ARSENAL</Text>

          <View style={styles.bentoGrid}>
            {/* Bento 1: Silent SOS / Being Followed */}
            <TouchableOpacity
              style={[styles.bentoCard, { borderColor: THEME.primaryDark }]}
              onPress={() => {
                AlertService.triggerHaptic();
                setBeingFollowedVisible(true);
              }}
              activeOpacity={0.8}
            >
              <View style={styles.bentoHeaderRow}>
                <View style={[styles.bentoIconBadge, { backgroundColor: 'rgba(239, 68, 68, 0.2)' }]}>
                  <Text style={styles.bentoIcon}>🚨</Text>
                </View>
                <View style={styles.bentoPillTag}>
                  <Text style={[styles.bentoPillTagText, { color: '#EF4444' }]}>STEALTH</Text>
                </View>
              </View>
              <Text style={styles.bentoTitle}>Being Followed</Text>
              <Text style={styles.bentoSub}>Silent SOS alert & covert police trigger</Text>
              <Text style={styles.bentoArrow}>Launch ➔</Text>
            </TouchableOpacity>

            {/* Bento 2: Transit Sentinel (Arrival Timer) */}
            <TouchableOpacity
              style={[styles.bentoCard, { borderColor: THEME.emeraldBorder }]}
              onPress={() => {
                AlertService.triggerHaptic();
                setJourneySentinelVisible(true);
              }}
              activeOpacity={0.8}
            >
              <View style={styles.bentoHeaderRow}>
                <View style={[styles.bentoIconBadge, { backgroundColor: THEME.emeraldBg }]}>
                  <Text style={styles.bentoIcon}>⏱️</Text>
                </View>
                <View style={[styles.bentoPillTag, { backgroundColor: THEME.emeraldBg }]}>
                  <Text style={[styles.bentoPillTagText, { color: THEME.emerald }]}>TRANSIT</Text>
                </View>
              </View>
              <Text style={styles.bentoTitle}>Safe Arrival</Text>
              <Text style={styles.bentoSub}>Night transit timer & automatic beacon</Text>
              <Text style={[styles.bentoArrow, { color: THEME.emerald }]}>Arm Timer ➔</Text>
            </TouchableOpacity>

            {/* Bento 3: Fake Decoy Rescue Call */}
            <TouchableOpacity
              style={[styles.bentoCard, { borderColor: THEME.amberBorder }]}
              onPress={() => {
                AlertService.triggerHaptic();
                setFakeCallVisible(true);
              }}
              activeOpacity={0.8}
            >
              <View style={styles.bentoHeaderRow}>
                <View style={[styles.bentoIconBadge, { backgroundColor: THEME.amberBg }]}>
                  <Text style={styles.bentoIcon}>📞</Text>
                </View>
                <View style={[styles.bentoPillTag, { backgroundColor: THEME.amberBg }]}>
                  <Text style={[styles.bentoPillTagText, { color: THEME.amber }]}>DECOY</Text>
                </View>
              </View>
              <Text style={styles.bentoTitle}>Fake Rescue Call</Text>
              <Text style={styles.bentoSub}>Incoming police/parent voice simulation</Text>
              <Text style={[styles.bentoArrow, { color: THEME.amber }]}>Trigger ➔</Text>
            </TouchableOpacity>

            {/* Bento 4: Offline First-Aid & Survival Playbooks */}
            <TouchableOpacity
              style={[styles.bentoCard, { borderColor: THEME.blueBorder }]}
              onPress={() => {
                AlertService.triggerHaptic();
                setInitialPlaybookId(undefined);
                setFirstAidModalVisible(true);
              }}
              activeOpacity={0.8}
            >
              <View style={styles.bentoHeaderRow}>
                <View style={[styles.bentoIconBadge, { backgroundColor: THEME.blueBg }]}>
                  <Text style={styles.bentoIcon}>🩺</Text>
                </View>
                <View style={[styles.bentoPillTag, { backgroundColor: THEME.blueBg }]}>
                  <Text style={[styles.bentoPillTagText, { color: THEME.blue }]}>OFFLINE</Text>
                </View>
              </View>
              <Text style={styles.bentoTitle}>First-Aid & CPR</Text>
              <Text style={styles.bentoSub}>110 BPM metronome & survival protocols</Text>
              <Text style={[styles.bentoArrow, { color: THEME.blue }]}>Open Guides ➔</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* ========================================================
            6. SITUATIONAL RADAR & DISASTER THREAT METRIC
        ======================================================== */}
        {assessment && (
          <View style={styles.radarSection}>
            <View style={styles.sectionTitleRow}>
              <Text style={styles.groupHeaderTitle}>ENVIRONMENTAL SITUATIONAL RADAR</Text>
              <View
                style={[
                  styles.threatLevelBadge,
                  assessment.overallThreatLevel === 'low'
                    ? styles.threatLevelBadgeLow
                    : assessment.overallThreatLevel === 'moderate'
                    ? styles.threatLevelBadgeMed
                    : styles.threatLevelBadgeHigh,
                ]}
              >
                <Text
                  style={[
                    styles.threatLevelBadgeText,
                    assessment.overallThreatLevel === 'low'
                      ? styles.threatTextLow
                      : assessment.overallThreatLevel === 'moderate'
                      ? styles.threatTextMed
                      : styles.threatTextHigh,
                  ]}
                >
                  {assessment.overallScorePercent}% THREAT • {assessment.overallThreatLevel.toUpperCase()}
                </Text>
              </View>
            </View>

            <View style={styles.radarCard}>
              {/* Progress Risk Track */}
              <View style={styles.riskTrack}>
                <View
                  style={[
                    styles.riskProgress,
                    {
                      width: `${Math.max(6, assessment.overallScorePercent)}%`,
                      backgroundColor:
                        assessment.overallThreatLevel === 'low'
                          ? THEME.emerald
                          : assessment.overallThreatLevel === 'moderate'
                          ? THEME.amber
                          : THEME.primary,
                    },
                  ]}
                />
              </View>

              <Text style={styles.radarHeadline}>{assessment.headline}</Text>
              <Text style={styles.radarSummary}>{assessment.summary}</Text>

              {/* Factors Quick Matrix */}
              <View style={styles.factorsRow}>
                {assessment.factors.map((factor) => (
                  <View key={factor.id} style={styles.factorChip}>
                    <Text style={styles.factorChipIcon}>{factor.icon}</Text>
                    <Text style={styles.factorChipName}>{factor.name}</Text>
                    <Text style={styles.factorChipPercent}>{factor.probabilityPercent}%</Text>
                  </View>
                ))}
              </View>

              {/* Evac & Shelter Navigation Action */}
              <TouchableOpacity
                style={styles.shelterEvacBtn}
                onPress={() => navigation.navigate('SafeZonesTab')}
                activeOpacity={0.8}
              >
                <Text style={styles.shelterEvacIcon}>🏛️</Text>
                <Text style={styles.shelterEvacText}>
                  Locate Verified Safe Shelters & Evacuation Points
                </Text>
                <Text style={styles.shelterEvacArrow}>➔</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* ========================================================
            7. TACTICAL SAFETY INTEL & DISASTER NEWS BRIEFING
        ======================================================== */}
        <View style={styles.intelSection}>
          <View style={styles.sectionTitleRow}>
            <Text style={styles.groupHeaderTitle}>LIVE SAFETY & WEATHER INTEL</Text>
            <View style={styles.liveIntelBadge}>
              <Animated.View
                style={[
                  styles.liveIntelDot,
                  {
                    opacity: radarDotAnim,
                    transform: [
                      {
                        scale: radarDotAnim.interpolate({
                          inputRange: [0.25, 1],
                          outputRange: [0.85, 1.3],
                        }),
                      },
                    ],
                  },
                ]}
              />
              <Text style={styles.liveIntelText}>LIVE RADAR</Text>
            </View>
          </View>

          {/* Filter Chips Horizontal Bar */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.intelFiltersRow}
          >
            {[
              { id: 'all', label: 'All Intel' },
              { id: 'disaster', label: '🏛️ Disaster' },
              { id: 'women_safety', label: '🛡️ Women Defense' },
              { id: 'weather', label: '🌧️ Weather' },
            ].map((chip) => {
              const active = newsFilter === chip.id;
              return (
                <TouchableOpacity
                  key={chip.id}
                  style={[styles.intelFilterChip, active && styles.intelFilterChipActive]}
                  onPress={() => setNewsFilter(chip.id as any)}
                  activeOpacity={0.7}
                >
                  <Text
                    style={[
                      styles.intelFilterText,
                      active && styles.intelFilterTextActive,
                    ]}
                  >
                    {chip.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          {/* Intel Horizontal Swipeable Carousel */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.intelCardsCarousel}
          >
            {filteredNews.map((item) => (
              <View key={item.id} style={styles.intelCard}>
                <View style={styles.intelCardTop}>
                  <View
                    style={[
                      styles.intelCategoryPill,
                      { backgroundColor: `${item.categoryColor}25` },
                    ]}
                  >
                    <Text style={[styles.intelCategoryText, { color: item.categoryColor }]}>
                      {item.categoryIcon} {item.categoryLabel}
                    </Text>
                  </View>
                  <Text style={styles.intelTimeAgo}>{item.timeAgo}</Text>
                </View>

                <Text style={styles.intelTitle} numberOfLines={2}>
                  {item.title}
                </Text>
                <Text style={styles.intelSnippet} numberOfLines={3}>
                  {item.summary}
                </Text>

                <View style={styles.intelFooter}>
                  <Text style={styles.intelSource} numberOfLines={1}>
                    Source: {item.source}
                  </Text>
                  {item.isUrgent && (
                    <View style={styles.priorityPill}>
                      <Text style={styles.priorityText}>PRIORITY</Text>
                    </View>
                  )}
                </View>
              </View>
            ))}
          </ScrollView>
        </View>

        <View style={{ height: 40 }} />
        </Animated.View>
      </ScrollView>

      {/* ========================================================
          MODALS & SYSTEM OVERLAYS (100% PRESERVED & WORKING)
      ======================================================== */}
      {/* Standard SOS Modal */}
      <SosModal
        visible={sosModalVisible}
        onClose={() => setSosModalVisible(false)}
        userCoords={coords}
        onTalkWithMia={() => {
          setSosModalVisible(false);
          navigation.navigate('ChatbotTab', {
            initialQuery: 'I pressed the SOS button! What should I do right now to stay safe?',
          });
        }}
        onNavigateToSafeZones={() => {
          setSosModalVisible(false);
          navigation.navigate('SafeZonesTab');
        }}
      />

      {/* Women Safety Modals */}
      <BeingFollowedModal
        visible={beingFollowedVisible}
        onClose={() => setBeingFollowedVisible(false)}
        userCoords={coords}
        onTalkWithMia={() => {
          setBeingFollowedVisible(false);
          navigation.navigate('ChatbotTab', {
            initialQuery: 'I feel unsafe and someone might be following me. What should I do?',
          });
        }}
        onNavigateToSafeZones={() => {
          setBeingFollowedVisible(false);
          navigation.navigate('SafeZonesTab');
        }}
      />

      <FakeCallModal
        visible={fakeCallVisible}
        onClose={() => setFakeCallVisible(false)}
      />

      <JourneySentinelModal
        visible={journeySentinelVisible}
        onClose={() => setJourneySentinelVisible(false)}
        userCoords={coords}
      />

      {/* Parents / Spouse Mobile Number Config Modal */}
      <Modal
        visible={parentModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setParentModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.parentModalCard}>
            <View style={styles.parentModalHeader}>
              <Text style={styles.parentModalTitle}>🛡️ Parents / Guardian Contact</Text>
              <TouchableOpacity
                onPress={() => setParentModalVisible(false)}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Text style={styles.parentModalClose}>✕</Text>
              </TouchableOpacity>
            </View>

            <Text style={styles.parentModalDesc}>
              When you activate the tactical SOS or hardware power triggers, your live GPS coordinates and automated distress alert will dispatch directly to this mobile phone number.
            </Text>

            <Text style={styles.inputLabel}>Guardian Relation / Name</Text>
            <TextInput
              style={styles.textInput}
              value={parentName}
              onChangeText={setParentName}
              placeholder="e.g. Mom / Dad / Parents / Spouse"
              placeholderTextColor="#64748B"
            />

            <Text style={styles.inputLabel}>Mobile Phone Number</Text>
            <TextInput
              style={styles.textInput}
              value={parentPhone}
              onChangeText={setParentPhone}
              placeholder="e.g. +91 98230 12345"
              placeholderTextColor="#64748B"
              keyboardType="phone-pad"
            />

            <TouchableOpacity
              style={styles.saveParentBtn}
              onPress={handleSaveParentContact}
              activeOpacity={0.85}
            >
              <Text style={styles.saveParentBtnText}>🛡️ Save & Link to SOS Reactor</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Authentication & Google Cloud Sync Modal */}
      <AuthModal
        visible={authModalVisible}
        onClose={() => setAuthModalVisible(false)}
        onSuccess={(u) => {
          setCurrentUser(u);
          loadData();
        }}
      />

      {/* Hardware Power Button Triple-Press Countdown Modal */}
      <PowerTriggerCountdownModal
        visible={powerTriggerModalVisible}
        onCancel={() => setPowerTriggerModalVisible(false)}
        onTriggerSos={() => {
          setPowerTriggerModalVisible(false);
          handleDirectSosPress();
        }}
        guardianName={
          contacts.length > 0 && contacts[0].name ? contacts[0].name : 'Parents'
        }
      />

      {/* Offline First-Aid & Survival Playbooks Hub Modal */}
      <FirstAidModal
        visible={firstAidModalVisible}
        onClose={() => {
          setFirstAidModalVisible(false);
          setInitialPlaybookId(undefined);
        }}
        initialPlaybookId={initialPlaybookId}
      />

      {/* Examiner Presentation Demo Mode: Top Drop-Down Notification Banner */}
      <GuardianResponseBanner
        payload={simulatedPayload}
        onPressInspect={() => setGuardianSimVisible(true)}
        onDismiss={() => setSimulatedPayload(null)}
      />

      {/* Examiner Presentation Demo Mode: Simulated Receiver Console */}
      <GuardianSimulationModal
        visible={guardianSimVisible}
        onClose={() => setGuardianSimVisible(false)}
        payload={simulatedPayload}
        onAcknowledged={(ack) => {
          setGuardianAck(ack);
          setSimulatedPayload(null);
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

  // 1. Command Header
  commandHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
    paddingTop: 4,
  },
  commandBrandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  logoBadgeContainer: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: THEME.cardBg,
    borderWidth: 1,
    borderColor: THEME.cardBorder,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  logoBadge: {
    width: 32,
    height: 32,
  },
  brandTitleCol: {
    flex: 1,
  },
  brandTag: {
    fontSize: 9,
    fontWeight: '800',
    color: THEME.emerald,
    letterSpacing: 1,
  },
  brandTitle: {
    fontSize: 16,
    fontWeight: '900',
    color: THEME.textPrimary,
    marginTop: 1,
  },
  commandRightActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  themeTogglePill: {
    backgroundColor: THEME.cardElevated,
    borderWidth: 1,
    borderColor: THEME.cardBorder,
    paddingVertical: 5,
    paddingHorizontal: 8,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  themeToggleIcon: {
    fontSize: 13,
  },
  demoTogglePill: {
    backgroundColor: THEME.cardElevated,
    borderWidth: 1,
    borderColor: THEME.cardBorder,
    paddingVertical: 5,
    paddingHorizontal: 8,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  demoTogglePillActive: {
    backgroundColor: THEME.blueBg,
    borderColor: THEME.blue,
  },
  demoToggleText: {
    fontSize: 10,
    fontWeight: '800',
    color: THEME.textMuted,
    letterSpacing: 0.5,
  },
  demoToggleTextActive: {
    color: THEME.blue,
  },
  // Guardian Acknowledgment Banner
  guardianAckBanner: {
    borderRadius: 14,
    borderWidth: 1.5,
    padding: 12,
    marginBottom: 14,
  },
  guardianAckHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  guardianAckBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  guardianAckDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  guardianAckTitle: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.6,
  },
  guardianAckClose: {
    fontSize: 14,
    fontWeight: '700',
    padding: 2,
  },
  guardianAckNote: {
    fontSize: 12,
    lineHeight: 18,
    fontStyle: 'italic',
    marginBottom: 10,
  },
  guardianAckMetaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  guardianAckMetaText: {
    fontSize: 11,
    fontWeight: '600',
    flex: 1,
  },
  guardianAckInspectBtn: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
  },
  guardianAckInspectText: {
    fontSize: 10,
    fontWeight: '700',
  },
  cloudStatusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: THEME.cardElevated,
    paddingVertical: 5,
    paddingHorizontal: 9,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: THEME.cardBorder,
    gap: 4,
  },
  cloudStatusIcon: {
    fontSize: 11,
  },
  cloudStatusText: {
    fontSize: 10,
    fontWeight: '800',
    color: THEME.blue,
    letterSpacing: 0.5,
  },
  cloudSyncPromptPill: {
    backgroundColor: THEME.blueBg,
    paddingVertical: 5,
    paddingHorizontal: 9,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: THEME.blueBorder,
  },
  cloudSyncPromptText: {
    fontSize: 10,
    fontWeight: '800',
    color: THEME.blue,
    letterSpacing: 0.5,
  },
  armedPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: THEME.emeraldBg,
    borderWidth: 1,
    borderColor: THEME.emeraldBorder,
    paddingVertical: 5,
    paddingHorizontal: 9,
    borderRadius: 8,
    gap: 5,
  },
  armedDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: THEME.emerald,
  },
  armedText: {
    fontSize: 10,
    fontWeight: '900',
    color: THEME.emerald,
    letterSpacing: 0.8,
  },

  // 2. Telemetry Card
  telemetryCard: {
    flexDirection: 'row',
    backgroundColor: THEME.cardBg,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: THEME.cardBorder,
    padding: 12,
    alignItems: 'center',
    marginBottom: 18,
  },
  telemetryLocationCol: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  telemetryParentCol: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  telemetryIconBadge: {
    width: 28,
    height: 28,
    borderRadius: 7,
    backgroundColor: THEME.cardElevated,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
  },
  telemetryPinIcon: {
    fontSize: 13,
  },
  telemetryParentIcon: {
    fontSize: 13,
  },
  telemetryTextCol: {
    flex: 1,
  },
  telemetryLabel: {
    fontSize: 8,
    fontWeight: '800',
    color: THEME.textMuted,
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  telemetryValue: {
    fontSize: 12,
    fontWeight: '700',
    color: THEME.textPrimary,
  },
  telemetryDivider: {
    width: 1,
    height: 28,
    backgroundColor: THEME.divider,
    marginHorizontal: 10,
  },

  // 3. Hero SOS Reactor
  heroSosSection: {
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
    paddingVertical: 8,
  },
  reactorContainer: {
    width: SOS_BUTTON_SIZE * 1.5,
    height: SOS_BUTTON_SIZE * 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    marginVertical: 4,
  },
  reactorShockwaveOuter: {
    position: 'absolute',
    width: SOS_BUTTON_SIZE * 1.35,
    height: SOS_BUTTON_SIZE * 1.35,
    borderRadius: (SOS_BUTTON_SIZE * 1.35) / 2,
    backgroundColor: THEME.primaryHalo,
  },
  reactorShockwaveInner: {
    position: 'absolute',
    width: SOS_BUTTON_SIZE * 1.16,
    height: SOS_BUTTON_SIZE * 1.16,
    borderRadius: (SOS_BUTTON_SIZE * 1.16) / 2,
    backgroundColor: THEME.primaryGlow,
  },
  sosReactorButton: {
    width: SOS_BUTTON_SIZE,
    height: SOS_BUTTON_SIZE,
    borderRadius: SOS_BUTTON_SIZE / 2,
    backgroundColor: THEME.primary,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: THEME.primary,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.65,
    shadowRadius: 24,
    elevation: 18,
    borderWidth: 4,
    borderColor: '#F87171',
  },
  sosCoreRing: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  sosCoreIcon: {
    fontSize: 18,
    color: '#FEF2F2',
    marginBottom: -2,
  },
  sosCoreText: {
    fontSize: 32,
    fontWeight: '900',
    color: '#FFFFFF',
    letterSpacing: 2,
  },
  sosCoreSub: {
    fontSize: 9,
    fontWeight: '900',
    color: 'rgba(255, 255, 255, 0.85)',
    letterSpacing: 1.5,
    marginTop: 1,
  },
  sosTelemetryBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(239, 68, 68, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.3)',
    borderRadius: 20,
    paddingVertical: 6,
    paddingHorizontal: 14,
    marginTop: 8,
    gap: 7,
  },
  sosLiveRadarDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: THEME.primary,
  },
  sosTelemetryTitle: {
    fontSize: 10,
    fontWeight: '800',
    color: '#FCA5A5',
    letterSpacing: 0.5,
  },
  powerHardwareNotice: {
    fontSize: 11,
    color: THEME.textMuted,
    marginTop: 8,
    textAlign: 'center',
    fontWeight: '500',
  },

  // 4. Hotlines Matrix
  hotlinesContainer: {
    marginBottom: 24,
  },
  groupHeaderTitle: {
    fontSize: 10,
    fontWeight: '800',
    color: THEME.textSecondary,
    letterSpacing: 1.2,
    marginBottom: 10,
    textTransform: 'uppercase',
  },
  hotlinesMatrix: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  hotlineMatrixBtn: {
    flex: 1,
    minWidth: (width - 40) / 2 - 4,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: THEME.cardBg,
    borderRadius: 12,
    borderWidth: 1,
    padding: 10,
  },
  hotlineBadgeIcon: {
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 9,
  },
  hotlineEmoji: {
    fontSize: 15,
  },
  hotlineInfoCol: {
    flex: 1,
  },
  hotlineName: {
    fontSize: 12,
    fontWeight: '700',
    color: THEME.textPrimary,
  },
  hotlineCode: {
    fontSize: 12,
    fontWeight: '900',
    marginTop: 1,
  },

  // 5. Bento Grid
  bentoSection: {
    marginBottom: 24,
  },
  bentoGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  bentoCard: {
    width: (width - 42) / 2,
    backgroundColor: THEME.cardBg,
    borderRadius: 14,
    borderWidth: 1,
    padding: 13,
  },
  bentoHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  bentoIconBadge: {
    width: 34,
    height: 34,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bentoIcon: {
    fontSize: 17,
  },
  bentoPillTag: {
    backgroundColor: 'rgba(239, 68, 68, 0.12)',
    paddingVertical: 3,
    paddingHorizontal: 6,
    borderRadius: 6,
  },
  bentoPillTagText: {
    fontSize: 8,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  bentoTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: THEME.textPrimary,
    marginBottom: 3,
  },
  bentoSub: {
    fontSize: 11,
    color: THEME.textSecondary,
    lineHeight: 15,
    minHeight: 30,
  },
  bentoArrow: {
    fontSize: 11,
    fontWeight: '800',
    color: '#EF4444',
    marginTop: 8,
  },

  // 6. Situational Radar & Threat Metric
  radarSection: {
    marginBottom: 24,
  },
  sectionTitleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  threatLevelBadge: {
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderRadius: 6,
    borderWidth: 1,
  },
  threatLevelBadgeLow: {
    backgroundColor: THEME.emeraldBg,
    borderColor: THEME.emeraldBorder,
  },
  threatLevelBadgeMed: {
    backgroundColor: THEME.amberBg,
    borderColor: THEME.amberBorder,
  },
  threatLevelBadgeHigh: {
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    borderColor: 'rgba(239, 68, 68, 0.4)',
  },
  threatLevelBadgeText: {
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  threatTextLow: { color: THEME.emerald },
  threatTextMed: { color: THEME.amber },
  threatTextHigh: { color: THEME.primary },
  radarCard: {
    backgroundColor: THEME.cardBg,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: THEME.cardBorder,
    padding: 14,
  },
  riskTrack: {
    height: 5,
    backgroundColor: THEME.divider,
    borderRadius: 3,
    overflow: 'hidden',
    marginBottom: 10,
  },
  riskProgress: {
    height: '100%',
    borderRadius: 3,
  },
  radarHeadline: {
    fontSize: 14,
    fontWeight: '800',
    color: THEME.textPrimary,
    marginBottom: 3,
  },
  radarSummary: {
    fontSize: 12,
    color: THEME.textSecondary,
    lineHeight: 17,
    marginBottom: 12,
  },
  factorsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 14,
  },
  factorChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: THEME.cardElevated,
    paddingVertical: 5,
    paddingHorizontal: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: THEME.cardBorder,
    gap: 4,
  },
  factorChipIcon: {
    fontSize: 11,
  },
  factorChipName: {
    fontSize: 10,
    fontWeight: '700',
    color: THEME.textSecondary,
  },
  factorChipPercent: {
    fontSize: 10,
    fontWeight: '900',
    color: THEME.textPrimary,
  },
  shelterEvacBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: THEME.cardElevated,
    borderWidth: 1,
    borderColor: THEME.emeraldBorder,
    borderRadius: 10,
    paddingVertical: 9,
    paddingHorizontal: 12,
  },
  shelterEvacIcon: {
    fontSize: 14,
    marginRight: 8,
  },
  shelterEvacText: {
    flex: 1,
    fontSize: 11,
    fontWeight: '700',
    color: THEME.emerald,
  },
  shelterEvacArrow: {
    fontSize: 12,
    fontWeight: '900',
    color: THEME.emerald,
  },

  // 7. Tactical Intel Briefing
  intelSection: {
    marginBottom: 10,
  },
  liveIntelBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(59, 130, 246, 0.15)',
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderRadius: 6,
    gap: 4,
  },
  liveIntelDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: THEME.blue,
  },
  liveIntelText: {
    fontSize: 9,
    fontWeight: '900',
    color: THEME.blue,
    letterSpacing: 0.5,
  },
  intelFiltersRow: {
    gap: 6,
    marginBottom: 12,
  },
  intelFilterChip: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: THEME.cardBg,
    borderWidth: 1,
    borderColor: THEME.cardBorder,
  },
  intelFilterChipActive: {
    backgroundColor: THEME.cardElevated,
    borderColor: THEME.blue,
  },
  intelFilterText: {
    fontSize: 11,
    fontWeight: '700',
    color: THEME.textSecondary,
  },
  intelFilterTextActive: {
    color: THEME.textPrimary,
    fontWeight: '800',
  },
  intelCardsCarousel: {
    gap: 12,
    paddingRight: 16,
  },
  intelCard: {
    width: width * 0.72,
    backgroundColor: THEME.cardBg,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: THEME.cardBorder,
    padding: 13,
  },
  intelCardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  intelCategoryPill: {
    paddingVertical: 3,
    paddingHorizontal: 7,
    borderRadius: 6,
  },
  intelCategoryText: {
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.4,
  },
  intelTimeAgo: {
    fontSize: 10,
    color: THEME.textMuted,
    fontWeight: '600',
  },
  intelTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: THEME.textPrimary,
    lineHeight: 18,
    marginBottom: 4,
  },
  intelSnippet: {
    fontSize: 11,
    color: THEME.textSecondary,
    lineHeight: 16,
    marginBottom: 10,
  },
  intelFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: THEME.divider,
    paddingTop: 8,
  },
  intelSource: {
    fontSize: 10,
    color: THEME.textMuted,
    fontWeight: '600',
    flex: 1,
  },
  priorityPill: {
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    paddingVertical: 2,
    paddingHorizontal: 6,
    borderRadius: 4,
  },
  priorityText: {
    fontSize: 8,
    fontWeight: '900',
    color: THEME.primary,
    letterSpacing: 0.5,
  },

  // Modal Overlay
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  parentModalCard: {
    width: '100%',
    backgroundColor: THEME.cardBg,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: THEME.cardBorder,
    padding: 20,
  },
  parentModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  parentModalTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: THEME.textPrimary,
  },
  parentModalClose: {
    fontSize: 18,
    color: THEME.textSecondary,
    padding: 4,
  },
  parentModalDesc: {
    fontSize: 12,
    color: THEME.textSecondary,
    lineHeight: 17,
    marginBottom: 16,
  },
  inputLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: THEME.textSecondary,
    letterSpacing: 0.5,
    marginBottom: 6,
    textTransform: 'uppercase',
  },
  textInput: {
    backgroundColor: THEME.cardElevated,
    borderWidth: 1,
    borderColor: THEME.cardBorder,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 13,
    color: THEME.textPrimary,
    marginBottom: 14,
  },
  saveParentBtn: {
    backgroundColor: THEME.primary,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 6,
  },
  saveParentBtnText: {
    fontSize: 13,
    fontWeight: '900',
    color: '#FFFFFF',
    letterSpacing: 0.5,
  },
});
