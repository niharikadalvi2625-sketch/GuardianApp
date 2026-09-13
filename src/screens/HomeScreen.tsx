import React, { useState, useEffect, useRef } from 'react';
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

const { width } = Dimensions.get('window');
const SOS_BUTTON_SIZE = width * 0.32;

const THEME = {
  primary: '#E63946',
  primaryDark: '#B71C1C',
  primaryGlow: 'rgba(230, 57, 70, 0.22)',
  secondary: '#1D3557',
  background: '#F8FAFC',
  cardBg: '#FFFFFF',
  textPrimary: '#0F172A',
  textSecondary: '#64748B',
  textLight: '#94A3B8',
  safeGreen: '#16A34A',
  safeGreenBg: '#F0FDF4',
  safeGreenBorder: '#BBF7D0',
  blue: '#2563EB',
  blueBg: '#EFF6FF',
  amber: '#D97706',
  amberBg: '#FFFBEB',
  border: '#E2E8F0',
  rose: '#E11D48',
  roseBg: '#FFF1F2',
  purple: '#7C3AED',
  purpleBg: '#F5F3FF',
};

interface HomeScreenProps {
  navigation: HomeScreenNavigationProp;
}

export default function HomeScreen({ navigation }: HomeScreenProps) {
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

  // Authentication & Cloud Sync State
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(null);
  const [syncState, setSyncState] = useState<CloudSyncState | null>(null);

  // Disaster & News State
  const [assessment, setAssessment] = useState<DisasterThreatAssessment | null>(null);
  const [newsList, setNewsList] = useState<SafetyNewsItem[]>([]);
  const [newsFilter, setNewsFilter] = useState<'all' | 'disaster' | 'women_safety' | 'weather'>('all');

  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    loadData();

    const unsubAuth = AuthService.onAuthStateChanged((user) => {
      setCurrentUser(user);
    });

    const unsubSync = CloudSyncService.onSyncStateChanged((state) => {
      setSyncState(state);
    });

    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.12,
          duration: 1200,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 1200,
          useNativeDriver: true,
        }),
      ])
    );
    pulse.start();
    return () => {
      pulse.stop();
      unsubAuth();
      unsubSync();
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
      if (hasPerm) {
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

  const handleDirectSosPress = () => {
    AlertService.triggerHaptic();

    if (isDefaultPhone) {
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
      <StatusBar barStyle="dark-content" backgroundColor={THEME.background} />

      <ScrollView
        style={styles.mainScrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={true}
        nestedScrollEnabled={true}
        keyboardShouldPersistTaps="handled"
        bounces={true}
        overScrollMode="always"
      >
        {/* Top Header: Greeting + Status */}
        <View style={styles.header}>
          <View style={styles.headerUserRow}>
            <Image
              source={require('../assets/logo.png')}
              style={styles.headerLogoBadge}
              resizeMode="contain"
            />
            <View style={styles.headerTextCol}>
              <Text style={styles.headerGreeting}>Stay Protected,</Text>
              <Text style={styles.headerUserName}>
                {currentUser?.name || (profile ? profile.name : 'Guardian User')}
              </Text>
            </View>
          </View>
          <View style={styles.headerRightRow}>
            {currentUser && currentUser.provider !== 'guest' ? (
              <TouchableOpacity
                style={styles.cloudSyncPill}
                onPress={() => navigation.navigate('ProfileTab')}
                activeOpacity={0.8}
              >
                <Text style={styles.cloudSyncPillIcon}>☁️</Text>
                <Text style={styles.cloudSyncPillText}>
                  {syncState?.syncStatus === 'syncing' ? 'SYNCING...' : 'SYNCED'}
                </Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity
                style={styles.cloudSignInPill}
                onPress={() => setAuthModalVisible(true)}
                activeOpacity={0.8}
              >
                <Text style={styles.cloudSignInPillIcon}>🌐</Text>
                <Text style={styles.cloudSignInPillText}>SYNC GPS</Text>
              </TouchableOpacity>
            )}
            <View style={styles.shieldPill}>
              <View style={styles.shieldPulseDot} />
              <Text style={styles.shieldPillText}>SHIELD ON</Text>
            </View>
          </View>
        </View>

        {/* Compact Location Strip */}
        <View style={styles.locationStrip}>
          <Text style={styles.locationPinIcon}>📍</Text>
          <View style={styles.locationTextCol}>
            <Text style={styles.locationLabel}>CURRENT LOCATION</Text>
            <Text style={styles.locationValue} numberOfLines={1}>
              {coords ? LocationService.formatLocationName(coords) : 'Detecting GPS position...'}
            </Text>
          </View>
          <TouchableOpacity
            style={styles.refreshBtn}
            onPress={refreshLocation}
            activeOpacity={0.7}
          >
            {loadingLocation ? (
              <ActivityIndicator size="small" color="#2563EB" />
            ) : (
              <Text style={styles.refreshBtnText}>🔄</Text>
            )}
          </TouchableOpacity>
        </View>

        {/* 1. HERO SOS CENTER CARD */}
        <View style={styles.sosCard}>
          {/* Linked Parent Bar */}
          <TouchableOpacity
            style={[
              styles.guardianLinkBar,
              isDefaultPhone && styles.guardianLinkBarUnset,
            ]}
            onPress={handleOpenParentModal}
            activeOpacity={0.85}
          >
            <Text style={styles.guardianLinkIcon}>{isDefaultPhone ? '⚠️' : '🛡️'}</Text>
            <View style={styles.guardianLinkTextCol}>
              <Text style={styles.guardianLinkTag}>
                {isDefaultPhone ? 'DIRECT SOS RECIPIENT NOT SET' : 'DIRECT SOS LINKED TO'}
              </Text>
              <Text style={styles.guardianLinkName} numberOfLines={1}>
                {isDefaultPhone
                  ? 'Tap to link Parents / Spouse phone'
                  : `${primaryContact?.name} • ${primaryContact?.phone}`}
              </Text>
            </View>
            <View style={styles.guardianEditPill}>
              <Text style={styles.guardianEditText}>{isDefaultPhone ? 'SET' : 'EDIT'}</Text>
            </View>
          </TouchableOpacity>

          {/* Glowing SOS Button */}
          <View style={styles.sosButtonContainer}>
            <Animated.View
              style={[
                styles.sosOuterGlow,
                {
                  transform: [{ scale: pulseAnim }],
                },
              ]}
            />
            <TouchableOpacity
              activeOpacity={0.88}
              style={styles.sosButton}
              onPress={handleDirectSosPress}
              accessibilityLabel="Emergency SOS Button"
              accessibilityHint="Tap to instantly send live GPS to parents and emergency contacts"
              accessibilityRole="button"
            >
              <Text style={styles.sosText}>SOS</Text>
              <Text style={styles.sosSubtext}>TAP FOR HELP</Text>
            </TouchableOpacity>
          </View>

          <Text style={styles.sosInstruction}>
            {isDefaultPhone
              ? 'Tap "SET" above so your live location immediately goes to parents'
              : `1-Tap sends live GPS distress SMS to ${primaryContact?.name}`}
          </Text>
        </View>

        {/* 2. 1-TAP EMERGENCY HOTLINES */}
        <View style={styles.hotlinesSection}>
          <View style={styles.hotlinesRow}>
            <TouchableOpacity
              style={[styles.hotlinePill, { backgroundColor: '#FEE2E2', borderColor: '#FECACA' }]}
              onPress={() => handleCall('112')}
              activeOpacity={0.8}
            >
              <Text style={styles.hotlineIcon}>👮</Text>
              <View>
                <Text style={[styles.hotlineLabel, { color: '#B91C1C' }]}>Police</Text>
                <Text style={styles.hotlineNum}>112</Text>
              </View>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.hotlinePill, { backgroundColor: '#FFE4E6', borderColor: '#FECDD3' }]}
              onPress={() => handleCall('1091')}
              activeOpacity={0.8}
            >
              <Text style={styles.hotlineIcon}>👩</Text>
              <View>
                <Text style={[styles.hotlineLabel, { color: '#BE123C' }]}>Women</Text>
                <Text style={styles.hotlineNum}>1091</Text>
              </View>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.hotlinePill, { backgroundColor: '#EFF6FF', borderColor: '#BFDBFE' }]}
              onPress={() => handleCall('108')}
              activeOpacity={0.8}
            >
              <Text style={styles.hotlineIcon}>🚑</Text>
              <View>
                <Text style={[styles.hotlineLabel, { color: '#1D4ED8' }]}>Medical</Text>
                <Text style={styles.hotlineNum}>108</Text>
              </View>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.hotlinePill, { backgroundColor: '#FEF3C7', borderColor: '#FDE68A' }]}
              onPress={() => handleCall('181')}
              activeOpacity={0.8}
            >
              <Text style={styles.hotlineIcon}>🛡️</Text>
              <View>
                <Text style={[styles.hotlineLabel, { color: '#B45309' }]}>Helpline</Text>
                <Text style={styles.hotlineNum}>181</Text>
              </View>
            </TouchableOpacity>
          </View>
        </View>

        {/* 3. DISASTER CHANCES & THREAT METER */}
        {assessment && (
          <View style={styles.disasterSection}>
            <View style={styles.sectionHeaderRow}>
              <View>
                <Text style={styles.sectionTitle}>Disaster Risk & Chances</Text>
                <Text style={styles.sectionSubTitle}>Live Regional Climate & Seismic Index</Text>
              </View>
              <View
                style={[
                  styles.threatBadge,
                  assessment.overallThreatLevel === 'low'
                    ? styles.threatBadgeLow
                    : assessment.overallThreatLevel === 'moderate'
                    ? styles.threatBadgeMed
                    : styles.threatBadgeHigh,
                ]}
              >
                <Text
                  style={[
                    styles.threatBadgeText,
                    assessment.overallThreatLevel === 'low'
                      ? styles.threatTextLow
                      : assessment.overallThreatLevel === 'moderate'
                      ? styles.threatTextMed
                      : styles.threatTextHigh,
                  ]}
                >
                  {assessment.overallScorePercent}% CHANCE • {assessment.overallThreatLevel.toUpperCase()}
                </Text>
              </View>
            </View>

            <View style={styles.disasterCard}>
              {/* Progress bar representing chance of disaster */}
              <View style={styles.riskBarTrack}>
                <View
                  style={[
                    styles.riskBarFill,
                    {
                      width: `${Math.max(8, assessment.overallScorePercent)}%`,
                      backgroundColor:
                        assessment.overallThreatLevel === 'low'
                          ? '#16A34A'
                          : assessment.overallThreatLevel === 'moderate'
                          ? '#D97706'
                          : '#DC2626',
                    },
                  ]}
                />
              </View>

              <Text style={styles.disasterHeadline}>{assessment.headline}</Text>
              <Text style={styles.disasterSummary}>{assessment.summary}</Text>

              {/* 4 Factor Grid */}
              <View style={styles.factorsGrid}>
                {assessment.factors.map((factor) => (
                  <View key={factor.id} style={styles.factorCard}>
                    <View style={styles.factorTopRow}>
                      <Text style={styles.factorIcon}>{factor.icon}</Text>
                      <Text style={styles.factorPercent}>{factor.probabilityPercent}%</Text>
                    </View>
                    <Text style={styles.factorName} numberOfLines={1}>{factor.name}</Text>
                    <Text style={styles.factorStatus} numberOfLines={1}>{factor.statusDescription}</Text>
                  </View>
                ))}
              </View>

              {/* Quick shelter shortcut */}
              <TouchableOpacity
                style={styles.shelterShortcutBtn}
                onPress={() => navigation.navigate('SafeZonesTab')}
                activeOpacity={0.85}
              >
                <Text style={styles.shelterShortcutIcon}>🏛️</Text>
                <Text style={styles.shelterShortcutText}>View Verified Safe Shelters & Evacuation Centers</Text>
                <Text style={styles.shelterShortcutArrow}>➔</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* 4. WOMEN'S SAFETY SHIELD */}
        <View style={styles.womenShieldSection}>
          <View style={styles.sectionHeaderRow}>
            <View>
              <Text style={styles.sectionTitle}>Women's Safety Shield</Text>
              <Text style={styles.sectionSubTitle}>Discreet Defense & Night Transit Tools</Text>
            </View>
            <View style={styles.stealthBadge}>
              <Text style={styles.stealthBadgeText}>STEALTH DEFENSE</Text>
            </View>
          </View>

          {/* Primary "Being Followed" Banner */}
          <TouchableOpacity
            style={styles.beingFollowedCard}
            onPress={() => setBeingFollowedVisible(true)}
            activeOpacity={0.88}
          >
            <View style={styles.followedIconCircle}>
              <Text style={styles.followedIconText}>🚨</Text>
            </View>
            <View style={styles.followedTextCol}>
              <Text style={styles.followedTitle}>I Feel Unsafe / Being Followed</Text>
              <Text style={styles.followedDesc}>
                1-tap stealth GPS alert to parents, silent trigger & speed dial
              </Text>
            </View>
            <Text style={styles.followedArrow}>➔</Text>
          </TouchableOpacity>

          {/* 3 Quick Actions */}
          <View style={styles.shieldActionsRow}>
            <TouchableOpacity
              style={[styles.shieldActionCard, { backgroundColor: '#EEF2FF', borderColor: '#C7D2FE' }]}
              onPress={() => setBeingFollowedVisible(true)}
              activeOpacity={0.8}
            >
              <Text style={styles.shieldActionIcon}>🤫</Text>
              <Text style={[styles.shieldActionTitle, { color: '#3730A3' }]}>Silent SOS</Text>
              <Text style={styles.shieldActionSub}>For danger / hiding</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.shieldActionCard, { backgroundColor: '#F0FDF4', borderColor: '#BBF7D0' }]}
              onPress={() => setJourneySentinelVisible(true)}
              activeOpacity={0.8}
            >
              <Text style={styles.shieldActionIcon}>⏱️</Text>
              <Text style={[styles.shieldActionTitle, { color: '#166534' }]}>Safe Arrival</Text>
              <Text style={styles.shieldActionSub}>Night transit timer</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.shieldActionCard, { backgroundColor: '#FFF7ED', borderColor: '#FED7AA' }]}
              onPress={() => setFakeCallVisible(true)}
              activeOpacity={0.8}
            >
              <Text style={styles.shieldActionIcon}>📞</Text>
              <Text style={[styles.shieldActionTitle, { color: '#9A3412' }]}>Fake Call</Text>
              <Text style={styles.shieldActionSub}>Discreet cab exit</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* 5. LIVE SAFETY & DISASTER NEWS FEED */}
        <View style={styles.newsSection}>
          <View style={styles.sectionHeaderRow}>
            <View>
              <Text style={styles.sectionTitle}>Safety & Disaster News</Text>
              <Text style={styles.sectionSubTitle}>Official bulletins, weather & police advisories</Text>
            </View>
            <View style={styles.liveTag}>
              <View style={styles.liveDot} />
              <Text style={styles.liveTagText}>LIVE</Text>
            </View>
          </View>

          {/* News Filter Chips */}
          <ScrollView
            horizontal
            nestedScrollEnabled={true}
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.filterChipsRow}
          >
            {[
              { id: 'all', label: 'All Updates' },
              { id: 'disaster', label: '🏛️ Disaster' },
              { id: 'women_safety', label: '🛡️ Women Defense' },
              { id: 'weather', label: '🌧️ Weather' },
            ].map((chip) => {
              const active = newsFilter === chip.id;
              return (
                <TouchableOpacity
                  key={chip.id}
                  style={[styles.filterChip, active && styles.filterChipActive]}
                  onPress={() => setNewsFilter(chip.id as any)}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.filterChipText, active && styles.filterChipTextActive]}>
                    {chip.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          {/* News Cards */}
          <View style={styles.newsList}>
            {filteredNews.map((item) => (
              <View key={item.id} style={styles.newsCard}>
                <View style={styles.newsTopRow}>
                  <View
                    style={[
                      styles.newsCategoryBadge,
                      { backgroundColor: `${item.categoryColor}15` },
                    ]}
                  >
                    <Text style={[styles.newsCategoryText, { color: item.categoryColor }]}>
                      {item.categoryIcon} {item.categoryLabel}
                    </Text>
                  </View>
                  <Text style={styles.newsTimeAgo}>{item.timeAgo}</Text>
                </View>

                <Text style={styles.newsTitle}>{item.title}</Text>
                <Text style={styles.newsSummary}>{item.summary}</Text>

                <View style={styles.newsFooterRow}>
                  <Text style={styles.newsSource}>Official: {item.source}</Text>
                  {item.isUrgent && (
                    <View style={styles.urgentPill}>
                      <Text style={styles.urgentText}>PRIORITY</Text>
                    </View>
                  )}
                </View>
              </View>
            ))}
          </View>
        </View>

        {/* 6. CORE SAFETY SERVICES NAVIGATION */}
        <View style={styles.servicesSection}>
          <Text style={styles.sectionTitle}>Safety Services</Text>
          <View style={styles.servicesRow}>
            <TouchableOpacity
              style={styles.serviceCard}
              activeOpacity={0.75}
              onPress={() => navigation.navigate('SafeZonesTab')}
            >
              <View style={[styles.serviceIconBg, { backgroundColor: '#E0F2FE' }]}>
                <Text style={styles.serviceIcon}>🏥</Text>
              </View>
              <Text style={styles.serviceTitle}>Safe Zones</Text>
              <Text style={styles.serviceSub}>Hospitals, Shelters</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.serviceCard}
              activeOpacity={0.75}
              onPress={() => navigation.navigate('ReportsTab')}
            >
              <View style={[styles.serviceIconBg, { backgroundColor: '#FEF3C7' }]}>
                <Text style={styles.serviceIcon}>⚠️</Text>
              </View>
              <Text style={styles.serviceTitle}>Live Hazards</Text>
              <Text style={styles.serviceSub}>Roadblocks & Alerts</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.serviceCard}
              activeOpacity={0.75}
              onPress={() => navigation.navigate('ChatbotTab')}
            >
              <View style={[styles.serviceIconBg, { backgroundColor: '#FCE7F3' }]}>
                <Text style={styles.serviceIcon}>💬</Text>
              </View>
              <Text style={styles.serviceTitle}>MIA Assistant</Text>
              <Text style={styles.serviceSub}>Emergency AI Bot</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>

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
              When you press the big red SOS button or stealth triggers, your live GPS location and distress alert will be sent directly to this mobile number.
            </Text>

            <Text style={styles.inputLabel}>Guardian Relation / Name</Text>
            <TextInput
              style={styles.textInput}
              value={parentName}
              onChangeText={setParentName}
              placeholder="e.g. Mom / Dad / Parents / Spouse"
              placeholderTextColor="#94A3B8"
            />

            <Text style={styles.inputLabel}>Mobile Phone Number</Text>
            <TextInput
              style={styles.textInput}
              value={parentPhone}
              onChangeText={setParentPhone}
              placeholder="e.g. +91 98230 12345"
              placeholderTextColor="#94A3B8"
              keyboardType="phone-pad"
            />

            <TouchableOpacity
              style={styles.saveParentBtn}
              onPress={handleSaveParentContact}
              activeOpacity={0.85}
            >
              <Text style={styles.saveParentBtnText}>🛡️ Save & Link to SOS Button</Text>
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
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: THEME.background,
  },
  mainScrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 70,
    flexGrow: 1,
  },
  // Top Header
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  headerUserRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 10,
  },
  headerLogoBadge: {
    width: 40,
    height: 40,
    borderRadius: 10,
    shadowColor: '#E63946',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  headerTextCol: {
    flex: 1,
  },
  headerGreeting: {
    fontSize: 13,
    color: THEME.textSecondary,
    fontWeight: '500',
  },
  headerUserName: {
    fontSize: 22,
    fontWeight: '800',
    color: THEME.textPrimary,
    letterSpacing: -0.4,
  },
  headerRightRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  cloudSyncPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EFF6FF',
    paddingVertical: 5,
    paddingHorizontal: 9,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#BFDBFE',
  },
  cloudSyncPillIcon: {
    fontSize: 12,
    marginRight: 4,
  },
  cloudSyncPillText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#2563EB',
    letterSpacing: 0.5,
  },
  cloudSignInPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    paddingVertical: 5,
    paddingHorizontal: 9,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#CBD5E1',
  },
  cloudSignInPillIcon: {
    fontSize: 12,
    marginRight: 4,
  },
  cloudSignInPillText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#475569',
    letterSpacing: 0.5,
  },
  shieldPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: THEME.safeGreenBg,
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: THEME.safeGreenBorder,
  },
  shieldPulseDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: THEME.safeGreen,
    marginRight: 6,
  },
  shieldPillText: {
    fontSize: 11,
    fontWeight: '800',
    color: THEME.safeGreen,
    letterSpacing: 0.5,
  },

  // Location Strip
  locationStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: THEME.cardBg,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 9,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: THEME.border,
  },
  locationPinIcon: {
    fontSize: 18,
    marginRight: 8,
  },
  locationTextCol: {
    flex: 1,
  },
  locationLabel: {
    fontSize: 9,
    fontWeight: '700',
    color: THEME.textLight,
    letterSpacing: 0.6,
  },
  locationValue: {
    fontSize: 13,
    fontWeight: '700',
    color: THEME.textPrimary,
    marginTop: 1,
  },
  refreshBtn: {
    padding: 6,
    borderRadius: 8,
    backgroundColor: '#F1F5F9',
  },
  refreshBtnText: {
    fontSize: 13,
  },

  // 1. Hero SOS Card
  sosCard: {
    backgroundColor: THEME.cardBg,
    borderRadius: 20,
    padding: 16,
    alignItems: 'center',
    marginBottom: 14,
    borderWidth: 1,
    borderColor: THEME.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 3,
  },
  guardianLinkBar: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F0FDF4',
    borderWidth: 1,
    borderColor: '#BBF7D0',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginBottom: 16,
  },
  guardianLinkBarUnset: {
    backgroundColor: '#FFFBEB',
    borderColor: '#FDE68A',
  },
  guardianLinkIcon: {
    fontSize: 18,
    marginRight: 8,
  },
  guardianLinkTextCol: {
    flex: 1,
  },
  guardianLinkTag: {
    fontSize: 9,
    fontWeight: '800',
    color: THEME.textSecondary,
    letterSpacing: 0.5,
  },
  guardianLinkName: {
    fontSize: 12,
    fontWeight: '700',
    color: THEME.textPrimary,
    marginTop: 1,
  },
  guardianEditPill: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: THEME.border,
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderRadius: 6,
  },
  guardianEditText: {
    fontSize: 10,
    fontWeight: '800',
    color: THEME.blue,
  },
  sosButtonContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    width: SOS_BUTTON_SIZE + 32,
    height: SOS_BUTTON_SIZE + 32,
    marginVertical: 4,
  },
  sosOuterGlow: {
    position: 'absolute',
    width: SOS_BUTTON_SIZE + 32,
    height: SOS_BUTTON_SIZE + 32,
    borderRadius: (SOS_BUTTON_SIZE + 32) / 2,
    backgroundColor: THEME.primaryGlow,
  },
  sosButton: {
    width: SOS_BUTTON_SIZE,
    height: SOS_BUTTON_SIZE,
    borderRadius: SOS_BUTTON_SIZE / 2,
    backgroundColor: THEME.primary,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: THEME.primaryDark,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 8,
    borderWidth: 4,
    borderColor: '#FFFFFF',
  },
  sosText: {
    fontSize: 28,
    fontWeight: '900',
    color: '#FFFFFF',
    letterSpacing: 2,
  },
  sosSubtext: {
    fontSize: 8,
    fontWeight: '800',
    color: 'rgba(255, 255, 255, 0.9)',
    letterSpacing: 1,
    marginTop: 2,
  },
  sosInstruction: {
    fontSize: 11,
    color: THEME.textSecondary,
    textAlign: 'center',
    marginTop: 10,
    fontWeight: '500',
  },

  // 2. Hotlines
  hotlinesSection: {
    marginBottom: 16,
  },
  hotlinesRow: {
    flexDirection: 'row',
    gap: 8,
  },
  hotlinePill: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 8,
    borderRadius: 12,
    borderWidth: 1,
    gap: 6,
  },
  hotlineIcon: {
    fontSize: 18,
  },
  hotlineLabel: {
    fontSize: 10,
    fontWeight: '700',
  },
  hotlineNum: {
    fontSize: 12,
    fontWeight: '800',
    color: THEME.textPrimary,
  },

  // Shared Section Header
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 10,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: THEME.textPrimary,
    letterSpacing: -0.3,
  },
  sectionSubTitle: {
    fontSize: 11,
    color: THEME.textSecondary,
    marginTop: 1,
  },

  // 3. Disaster Risk Section
  disasterSection: {
    marginBottom: 18,
  },
  threatBadge: {
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 8,
  },
  threatBadgeLow: {
    backgroundColor: '#DCFCE7',
  },
  threatBadgeMed: {
    backgroundColor: '#FEF3C7',
  },
  threatBadgeHigh: {
    backgroundColor: '#FEE2E2',
  },
  threatBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  threatTextLow: {
    color: '#15803D',
  },
  threatTextMed: {
    color: '#B45309',
  },
  threatTextHigh: {
    color: '#B91C1C',
  },
  disasterCard: {
    backgroundColor: THEME.cardBg,
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: THEME.border,
  },
  riskBarTrack: {
    height: 6,
    borderRadius: 3,
    backgroundColor: '#E2E8F0',
    overflow: 'hidden',
    marginBottom: 12,
  },
  riskBarFill: {
    height: '100%',
    borderRadius: 3,
  },
  disasterHeadline: {
    fontSize: 14,
    fontWeight: '800',
    color: THEME.textPrimary,
    marginBottom: 4,
  },
  disasterSummary: {
    fontSize: 12,
    color: THEME.textSecondary,
    lineHeight: 17,
    marginBottom: 12,
  },
  factorsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 12,
  },
  factorCard: {
    width: (width - 32 - 28 - 8) / 2,
    backgroundColor: '#F8FAFC',
    borderRadius: 10,
    padding: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  factorTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  factorIcon: {
    fontSize: 16,
  },
  factorPercent: {
    fontSize: 11,
    fontWeight: '800',
    color: THEME.textPrimary,
  },
  factorName: {
    fontSize: 11,
    fontWeight: '700',
    color: THEME.textPrimary,
  },
  factorStatus: {
    fontSize: 9,
    color: THEME.textSecondary,
    marginTop: 1,
  },
  shelterShortcutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F1F5F9',
    borderRadius: 10,
    paddingVertical: 9,
    paddingHorizontal: 12,
  },
  shelterShortcutIcon: {
    fontSize: 14,
    marginRight: 8,
  },
  shelterShortcutText: {
    flex: 1,
    fontSize: 11,
    fontWeight: '700',
    color: THEME.blue,
  },
  shelterShortcutArrow: {
    fontSize: 12,
    fontWeight: '800',
    color: THEME.blue,
  },

  // 4. Women's Safety Shield
  womenShieldSection: {
    marginBottom: 18,
  },
  stealthBadge: {
    backgroundColor: '#FFE4E6',
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderRadius: 6,
  },
  stealthBadgeText: {
    fontSize: 9,
    fontWeight: '800',
    color: THEME.rose,
    letterSpacing: 0.5,
  },
  beingFollowedCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#881337',
    borderRadius: 14,
    padding: 12,
    marginBottom: 10,
    shadowColor: '#881337',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 3,
  },
  followedIconCircle: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: 'rgba(255, 255, 255, 0.16)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  followedIconText: {
    fontSize: 18,
  },
  followedTextCol: {
    flex: 1,
  },
  followedTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  followedDesc: {
    fontSize: 10,
    color: '#FECDD3',
    marginTop: 1,
    fontWeight: '500',
  },
  followedArrow: {
    fontSize: 16,
    color: '#FFFFFF',
    fontWeight: '800',
    marginLeft: 6,
  },
  shieldActionsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  shieldActionCard: {
    flex: 1,
    borderRadius: 12,
    padding: 10,
    borderWidth: 1,
    alignItems: 'center',
  },
  shieldActionIcon: {
    fontSize: 18,
    marginBottom: 2,
  },
  shieldActionTitle: {
    fontSize: 11,
    fontWeight: '800',
  },
  shieldActionSub: {
    fontSize: 9,
    color: THEME.textSecondary,
    marginTop: 1,
    textAlign: 'center',
  },

  // 5. Safety News
  newsSection: {
    marginBottom: 18,
  },
  liveTag: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEE2E2',
    paddingVertical: 3,
    paddingHorizontal: 7,
    borderRadius: 6,
  },
  liveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#DC2626',
    marginRight: 4,
  },
  liveTagText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#DC2626',
    letterSpacing: 0.5,
  },
  filterChipsRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 10,
  },
  filterChip: {
    backgroundColor: '#FFFFFF',
    paddingVertical: 5,
    paddingHorizontal: 12,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: THEME.border,
  },
  filterChipActive: {
    backgroundColor: '#0F172A',
    borderColor: '#0F172A',
  },
  filterChipText: {
    fontSize: 11,
    fontWeight: '600',
    color: THEME.textSecondary,
  },
  filterChipTextActive: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  newsList: {
    gap: 8,
  },
  newsCard: {
    backgroundColor: THEME.cardBg,
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: THEME.border,
  },
  newsTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  newsCategoryBadge: {
    paddingVertical: 2,
    paddingHorizontal: 6,
    borderRadius: 4,
  },
  newsCategoryText: {
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.4,
  },
  newsTimeAgo: {
    fontSize: 10,
    color: THEME.textLight,
  },
  newsTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: THEME.textPrimary,
    marginBottom: 3,
  },
  newsSummary: {
    fontSize: 11,
    color: THEME.textSecondary,
    lineHeight: 16,
  },
  newsFooterRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 8,
    paddingTop: 6,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  newsSource: {
    fontSize: 10,
    color: THEME.textLight,
    fontWeight: '500',
  },
  urgentPill: {
    backgroundColor: '#FEE2E2',
    paddingVertical: 1,
    paddingHorizontal: 6,
    borderRadius: 4,
  },
  urgentText: {
    fontSize: 8,
    fontWeight: '800',
    color: '#DC2626',
    letterSpacing: 0.5,
  },

  // 6. Services Bottom Section
  servicesSection: {
    marginBottom: 10,
  },
  servicesRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 8,
  },
  serviceCard: {
    flex: 1,
    backgroundColor: THEME.cardBg,
    borderRadius: 14,
    padding: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: THEME.border,
  },
  serviceIconBg: {
    width: 38,
    height: 38,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 6,
  },
  serviceIcon: {
    fontSize: 18,
  },
  serviceTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: THEME.textPrimary,
  },
  serviceSub: {
    fontSize: 9,
    color: THEME.textSecondary,
    marginTop: 1,
    textAlign: 'center',
  },

  // Modal Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.65)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  parentModalCard: {
    width: '100%',
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.25,
    shadowRadius: 16,
    elevation: 8,
  },
  parentModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  parentModalTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0F172A',
  },
  parentModalClose: {
    fontSize: 18,
    color: '#94A3B8',
    fontWeight: '700',
    padding: 4,
  },
  parentModalDesc: {
    fontSize: 13,
    color: '#64748B',
    lineHeight: 18,
    marginBottom: 16,
  },
  inputLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#334155',
    marginBottom: 6,
    marginTop: 6,
  },
  textInput: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: '#0F172A',
    marginBottom: 10,
  },
  saveParentBtn: {
    backgroundColor: '#16A34A',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 8,
  },
  saveParentBtnText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800',
  },
});
