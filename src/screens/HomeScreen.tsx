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
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { HomeScreenNavigationProp } from '../types/navigation';
import { LocationService } from '../services/locationService';
import { SosService } from '../services/sosService';
import { LocationCoords, UserProfile, EmergencyContact } from '../types';
import SosModal from '../components/SosModal';
import BeingFollowedModal from '../components/BeingFollowedModal';
import FakeCallModal from '../components/FakeCallModal';
import JourneySentinelModal from '../components/JourneySentinelModal';

const { width } = Dimensions.get('window');
const SOS_BUTTON_SIZE = width * 0.42;

const THEME = {
  primary: '#E63946',
  primaryDark: '#B71C1C',
  primaryGlow: 'rgba(230, 57, 70, 0.25)',
  secondary: '#1D3557',
  background: '#F8F9FA',
  cardBg: '#FFFFFF',
  textPrimary: '#1E293B',
  textSecondary: '#64748B',
  textLight: '#94A3B8',
  safeGreen: '#2A9D8F',
  safeGreenBg: '#E8F5E9',
  blue: '#3B82F6',
  amber: '#F59E0B',
  border: '#E2E8F0',
  indigo: '#4F46E5',
  indigoBg: '#EEF2FF',
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

  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    loadData();

    // Pulse animation for high-visibility SOS alert ring
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.15,
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
    return () => pulse.stop();
  }, []);

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
      await LocationService.requestPermission();
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
      const loc = await LocationService.getCurrentLocation();
      setCoords(loc);
    } catch {
      // Handled via defaults
    } finally {
      setLoadingLocation(false);
    }
  };

  const handleCall = (num: string) => {
    SosService.dialEmergencyServices(num);
  };

  const primaryContact = contacts.find((c) => c.isPrimary) || contacts[0];

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <StatusBar barStyle="dark-content" backgroundColor={THEME.background} />

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Top Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.greetingSub}>Stay Safe,</Text>
            <Text style={styles.greetingTitle}>
              {profile ? profile.name : 'Guardian User'}
            </Text>
          </View>
          <View style={styles.statusPill}>
            <View style={styles.statusDot} />
            <Text style={styles.statusText}>Active Shield</Text>
          </View>
        </View>

        {/* Live Location / Safety Status Card */}
        <View style={styles.locationCard}>
          <Text style={styles.locationIcon}>📍</Text>
          <View style={styles.locationDetails}>
            <Text style={styles.locationTitle}>
              {coords ? LocationService.formatLocationName(coords) : 'Current Safe Location'}
            </Text>
            <Text style={styles.locationSubtitle}>
              {coords
                ? LocationService.formatCoordinates(coords)
                : 'Acquiring GPS location...'}
            </Text>
          </View>
          <TouchableOpacity
            style={styles.locationBadge}
            onPress={refreshLocation}
            activeOpacity={0.7}
          >
            {loadingLocation ? (
              <ActivityIndicator size="small" color="#0284C7" />
            ) : (
              <Text style={styles.locationBadgeText}>🔄 Refresh</Text>
            )}
          </TouchableOpacity>
        </View>

        {/* Primary Guardian Contact Card */}
        {primaryContact && (
          <View style={styles.guardianBar}>
            <View style={styles.guardianAvatar}>
              <Text style={styles.guardianAvatarIcon}>🛡️</Text>
            </View>
            <View style={styles.guardianInfo}>
              <Text style={styles.guardianBadge}>PRIMARY GUARDIAN</Text>
              <Text style={styles.guardianName} numberOfLines={1}>
                {primaryContact.name}
              </Text>
              <Text style={styles.guardianPhone}>{primaryContact.phone}</Text>
            </View>
            <TouchableOpacity
              style={styles.guardianCallBtn}
              onPress={() => handleCall(primaryContact.phone)}
              activeOpacity={0.8}
            >
              <Text style={styles.guardianCallIcon}>📞</Text>
              <Text style={styles.guardianCallText}>Call</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* --- WOMEN'S SAFETY SHIELD SECTION --- */}
        <View style={styles.womenSafetySection}>
          <View style={styles.sectionHeaderRow}>
            <Text style={styles.sectionTitle}>Women's Safety Shield</Text>
            <Text style={styles.shieldBadge}>NIGHT TRAVEL & DEFENSE</Text>
          </View>

          {/* Large High-Priority "Being Followed / Unsafe" Trigger */}
          <TouchableOpacity
            style={styles.beingFollowedBanner}
            onPress={() => setBeingFollowedVisible(true)}
            activeOpacity={0.88}
          >
            <View style={styles.bannerIconContainer}>
              <Text style={styles.bannerIcon}>🚨</Text>
            </View>
            <View style={styles.bannerTextCol}>
              <Text style={styles.bannerTitle}>I Feel Unsafe / Being Followed</Text>
              <Text style={styles.bannerDesc}>
                1-tap stealth GPS alert to parents/spouse, silent SOS, or speed-dial
              </Text>
            </View>
            <Text style={styles.bannerArrow}>➔</Text>
          </TouchableOpacity>

          {/* Quick Protective Actions Grid */}
          <View style={styles.protectiveGrid}>
            <TouchableOpacity
              style={[styles.protectiveCard, { backgroundColor: '#EEF2FF', borderColor: '#C7D2FE' }]}
              onPress={() => setBeingFollowedVisible(true)}
              activeOpacity={0.8}
            >
              <Text style={styles.protectiveIcon}>🤫</Text>
              <Text style={[styles.protectiveTitle, { color: '#4338CA' }]}>Silent SOS</Text>
              <Text style={styles.protectiveSub}>For hiding / danger</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.protectiveCard, { backgroundColor: '#F0FDF4', borderColor: '#BBF7D0' }]}
              onPress={() => setJourneySentinelVisible(true)}
              activeOpacity={0.8}
            >
              <Text style={styles.protectiveIcon}>⏱️</Text>
              <Text style={[styles.protectiveTitle, { color: '#15803D' }]}>Safe Arrival</Text>
              <Text style={styles.protectiveSub}>Night travel timer</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.protectiveCard, { backgroundColor: '#FFF7ED', borderColor: '#FED7AA' }]}
              onPress={() => setFakeCallVisible(true)}
              activeOpacity={0.8}
            >
              <Text style={styles.protectiveIcon}>📞</Text>
              <Text style={[styles.protectiveTitle, { color: '#C2410C' }]}>Fake Call</Text>
              <Text style={styles.protectiveSub}>Discreet cab exit</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* High-Visibility Emergency SOS Trigger */}
        <View style={styles.sosSection}>
          <Animated.View
            style={[
              styles.sosOuterRing,
              {
                transform: [{ scale: pulseAnim }],
              },
            ]}
          />
          <View style={styles.sosMiddleRing}>
            <TouchableOpacity
              activeOpacity={0.85}
              style={styles.sosButton}
              onPress={() => setSosModalVisible(true)}
              accessibilityLabel="Emergency SOS Button"
              accessibilityHint="Tap to initiate emergency distress broadcast"
              accessibilityRole="button"
            >
              <Text style={styles.sosText}>SOS</Text>
              <Text style={styles.sosSubtext}>TAP FOR EMERGENCY</Text>
            </TouchableOpacity>
          </View>
        </View>

        <Text style={styles.sosHelperText}>
          Instant dispatch: sends real-time GPS link & Medical ID to{' '}
          {contacts.length} emergency contacts
        </Text>

        {/* Emergency Quick Hotlines Row */}
        <View style={styles.hotlinesSection}>
          <Text style={styles.sectionTitle}>1-Tap Emergency Hotlines</Text>
          <View style={styles.hotlinesRow}>
            <TouchableOpacity
              style={[styles.hotlineBtn, { backgroundColor: '#FEE2E2' }]}
              onPress={() => handleCall('112')}
              activeOpacity={0.8}
            >
              <Text style={styles.hotlineIcon}>👮</Text>
              <Text style={[styles.hotlineLabel, { color: '#B91C1C' }]}>Police</Text>
              <Text style={styles.hotlineNum}>112</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.hotlineBtn, { backgroundColor: '#FFF1F2' }]}
              onPress={() => handleCall('1091')}
              activeOpacity={0.8}
            >
              <Text style={styles.hotlineIcon}>👩</Text>
              <Text style={[styles.hotlineLabel, { color: '#BE123C' }]}>Women</Text>
              <Text style={styles.hotlineNum}>1091</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.hotlineBtn, { backgroundColor: '#EFF6FF' }]}
              onPress={() => handleCall('108')}
              activeOpacity={0.8}
            >
              <Text style={styles.hotlineIcon}>🚑</Text>
              <Text style={[styles.hotlineLabel, { color: '#1D4ED8' }]}>Ambulance</Text>
              <Text style={styles.hotlineNum}>108</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.hotlineBtn, { backgroundColor: '#FEF3C7' }]}
              onPress={() => handleCall('181')}
              activeOpacity={0.8}
            >
              <Text style={styles.hotlineIcon}>🛡️</Text>
              <Text style={[styles.hotlineLabel, { color: '#B45309' }]}>Helpline</Text>
              <Text style={styles.hotlineNum}>181</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Core Modules Grid */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Safety Services</Text>
        </View>

        <View style={styles.grid}>
          <TouchableOpacity
            style={styles.gridCard}
            activeOpacity={0.7}
            onPress={() => navigation.navigate('SafeZonesTab')}
          >
            <View style={[styles.cardIconBg, { backgroundColor: '#E0F2FE' }]}>
              <Text style={styles.cardIcon}>🏥</Text>
            </View>
            <Text style={styles.cardTitle}>Safe Zones</Text>
            <Text style={styles.cardDesc}>Hospitals, Police, Shelters</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.gridCard}
            activeOpacity={0.7}
            onPress={() => navigation.navigate('ReportsTab')}
          >
            <View style={[styles.cardIconBg, { backgroundColor: '#FEF3C7' }]}>
              <Text style={styles.cardIcon}>⚠️</Text>
            </View>
            <Text style={styles.cardTitle}>Live Hazards</Text>
            <Text style={styles.cardDesc}>Safety Alerts & Roadblocks</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.gridCard}
            activeOpacity={0.7}
            onPress={() => navigation.navigate('ChatbotTab')}
          >
            <View style={[styles.cardIconBg, { backgroundColor: '#FCE7F3' }]}>
              <Text style={styles.cardIcon}>💬</Text>
            </View>
            <Text style={styles.cardTitle}>MIA Assistant</Text>
            <Text style={styles.cardDesc}>Emergency AI • MR / HI / EN</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.gridCard}
            activeOpacity={0.7}
            onPress={() => navigation.navigate('ProfileTab')}
          >
            <View style={[styles.cardIconBg, { backgroundColor: '#F3E8FF' }]}>
              <Text style={styles.cardIcon}>👥</Text>
            </View>
            <Text style={styles.cardTitle}>Guardians & ID</Text>
            <Text style={styles.cardDesc}>{contacts.length} Contacts Configured</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* Standard SOS Countdown & Dispatch Modal */}
      <SosModal
        visible={sosModalVisible}
        onClose={() => setSosModalVisible(false)}
        userCoords={coords}
      />

      {/* Dedicated Women Safety Modals */}
      <BeingFollowedModal
        visible={beingFollowedVisible}
        onClose={() => setBeingFollowedVisible(false)}
        userCoords={coords}
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
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: THEME.background,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 40,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  greetingSub: {
    fontSize: 14,
    color: THEME.textSecondary,
    fontWeight: '500',
    letterSpacing: 0.2,
  },
  greetingTitle: {
    fontSize: 24,
    color: THEME.textPrimary,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: THEME.safeGreenBg,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#C8E6C9',
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: THEME.safeGreen,
    marginRight: 6,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '700',
    color: THEME.safeGreen,
  },
  locationCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: THEME.cardBg,
    borderRadius: 16,
    padding: 14,
    marginBottom: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
    borderWidth: 1,
    borderColor: THEME.border,
  },
  locationIcon: {
    fontSize: 22,
    marginRight: 12,
  },
  locationDetails: {
    flex: 1,
  },
  locationTitle: {
    fontSize: 11,
    fontWeight: '600',
    color: THEME.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  locationSubtitle: {
    fontSize: 14,
    fontWeight: '700',
    color: THEME.textPrimary,
    marginTop: 2,
  },
  locationBadge: {
    backgroundColor: '#E0F2FE',
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 8,
  },
  locationBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#0284C7',
  },
  guardianBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F0FDF4',
    borderWidth: 1,
    borderColor: '#BBF7D0',
    borderRadius: 14,
    padding: 12,
    marginBottom: 16,
  },
  guardianAvatar: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: '#DCFCE7',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  guardianAvatarIcon: {
    fontSize: 18,
  },
  guardianInfo: {
    flex: 1,
  },
  guardianBadge: {
    fontSize: 9,
    fontWeight: '800',
    color: '#16A34A',
    letterSpacing: 0.8,
  },
  guardianName: {
    fontSize: 13,
    fontWeight: '700',
    color: THEME.textPrimary,
  },
  guardianPhone: {
    fontSize: 11,
    color: THEME.textSecondary,
  },
  guardianCallBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#16A34A',
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 10,
    gap: 4,
  },
  guardianCallIcon: {
    fontSize: 12,
  },
  guardianCallText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  womenSafetySection: {
    marginBottom: 20,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  shieldBadge: {
    fontSize: 9,
    fontWeight: '800',
    color: THEME.primary,
    letterSpacing: 0.8,
  },
  beingFollowedBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#881337',
    borderRadius: 16,
    padding: 14,
    shadowColor: '#881337',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
    marginBottom: 10,
  },
  bannerIconContainer: {
    width: 42,
    height: 42,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  bannerIcon: {
    fontSize: 22,
  },
  bannerTextCol: {
    flex: 1,
  },
  bannerTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  bannerDesc: {
    fontSize: 11,
    color: '#FECDD3',
    marginTop: 2,
    fontWeight: '500',
  },
  bannerArrow: {
    fontSize: 18,
    color: '#FFFFFF',
    fontWeight: '800',
    marginLeft: 8,
  },
  protectiveGrid: {
    flexDirection: 'row',
    gap: 8,
  },
  protectiveCard: {
    flex: 1,
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    alignItems: 'center',
  },
  protectiveIcon: {
    fontSize: 20,
    marginBottom: 4,
  },
  protectiveTitle: {
    fontSize: 12,
    fontWeight: '800',
  },
  protectiveSub: {
    fontSize: 9,
    color: THEME.textSecondary,
    marginTop: 2,
    textAlign: 'center',
  },
  sosSection: {
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 10,
    height: SOS_BUTTON_SIZE + 36,
  },
  sosOuterRing: {
    position: 'absolute',
    width: SOS_BUTTON_SIZE + 36,
    height: SOS_BUTTON_SIZE + 36,
    borderRadius: (SOS_BUTTON_SIZE + 36) / 2,
    backgroundColor: THEME.primaryGlow,
  },
  sosMiddleRing: {
    width: SOS_BUTTON_SIZE + 14,
    height: SOS_BUTTON_SIZE + 14,
    borderRadius: (SOS_BUTTON_SIZE + 14) / 2,
    backgroundColor: 'rgba(230, 57, 70, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  sosButton: {
    width: SOS_BUTTON_SIZE,
    height: SOS_BUTTON_SIZE,
    borderRadius: SOS_BUTTON_SIZE / 2,
    backgroundColor: THEME.primary,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: THEME.primaryDark,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.45,
    shadowRadius: 16,
    elevation: 10,
    borderWidth: 4,
    borderColor: '#FFFFFF',
  },
  sosText: {
    fontSize: 32,
    fontWeight: '900',
    color: '#FFFFFF',
    letterSpacing: 2,
  },
  sosSubtext: {
    fontSize: 9,
    fontWeight: '800',
    color: 'rgba(255, 255, 255, 0.9)',
    letterSpacing: 1.2,
    marginTop: 4,
  },
  sosHelperText: {
    textAlign: 'center',
    fontSize: 12,
    color: THEME.textSecondary,
    marginBottom: 20,
    paddingHorizontal: 20,
    lineHeight: 18,
  },
  hotlinesSection: {
    marginBottom: 24,
  },
  sectionHeader: {
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: THEME.textPrimary,
    letterSpacing: -0.3,
  },
  hotlinesRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 8,
    marginTop: 10,
  },
  hotlineBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 14,
    alignItems: 'center',
  },
  hotlineIcon: {
    fontSize: 20,
    marginBottom: 4,
  },
  hotlineLabel: {
    fontSize: 11,
    fontWeight: '700',
  },
  hotlineNum: {
    fontSize: 12,
    fontWeight: '800',
    color: THEME.textPrimary,
    marginTop: 2,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: 12,
  },
  gridCard: {
    width: (width - 52) / 2,
    backgroundColor: THEME.cardBg,
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: THEME.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.03,
    shadowRadius: 6,
    elevation: 1,
  },
  cardIconBg: {
    width: 44,
    height: 44,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  cardIcon: {
    fontSize: 20,
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: THEME.textPrimary,
  },
  cardDesc: {
    fontSize: 12,
    color: THEME.textSecondary,
    marginTop: 2,
    fontWeight: '500',
  },
});
