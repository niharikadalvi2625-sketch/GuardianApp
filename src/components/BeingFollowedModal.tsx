import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  Text,
  View,
  Modal,
  TouchableOpacity,
  ScrollView,
  Alert,
} from 'react-native';
import { LocationCoords, EmergencyContact } from '../types';
import { SosService } from '../services/sosService';
import { AlertService } from '../services/alertService';
import { LocationService } from '../services/locationService';

interface BeingFollowedModalProps {
  visible: boolean;
  onClose: () => void;
  userCoords: LocationCoords | null;
  onTalkWithMia?: () => void;
}

const THEME = {
  primary: '#E63946',
  primaryDark: '#B71C1C',
  secondary: '#1D3557',
  background: '#0F172A',
  cardBg: '#1E293B',
  border: '#334155',
  textPrimary: '#F8FAFC',
  textSecondary: '#94A3B8',
  amber: '#F59E0B',
  green: '#10B981',
  purple: '#8B5CF6',
};

export default function BeingFollowedModal({
  visible,
  onClose,
  userCoords,
  onTalkWithMia,
}: BeingFollowedModalProps) {
  const [coords, setCoords] = useState<LocationCoords | null>(userCoords);
  const [primaryGuardian, setPrimaryGuardian] = useState<EmergencyContact | null>(null);
  const [allContacts, setAllContacts] = useState<EmergencyContact[]>([]);
  const [alertSent, setAlertSent] = useState<boolean>(false);

  useEffect(() => {
    if (visible) {
      setAlertSent(false);
      loadData();
    }
  }, [visible]);

  const loadData = async () => {
    const contacts = await SosService.getContacts();
    setAllContacts(contacts);
    const primary = await SosService.getPrimaryGuardian();
    setPrimaryGuardian(primary);

    const liveLoc = userCoords || (await LocationService.getCurrentLocation());
    setCoords(liveLoc);
  };

  /**
   * 🤫 100% SILENT SOS (HIDING / DANGER):
   * Zero sound, zero vibration to avoid revealing hiding location.
   */
  const handleTriggerSilentSos = async () => {
    AlertService.triggerHaptic();
    const loc = coords || (await LocationService.getCurrentLocation());
    const { message, primaryPhones } = await SosService.triggerHidingSilentSos(loc);

    setAlertSent(true);
    await SosService.sendSosSms(primaryPhones, message);
  };

  /**
   * 🚶 BEING FOLLOWED ALERT:
   */
  const handleTriggerBeingFollowed = async () => {
    AlertService.triggerHaptic();
    const loc = coords || (await LocationService.getCurrentLocation());
    const { message, primaryPhones } = await SosService.triggerBeingFollowedSos(loc);

    setAlertSent(true);
    await SosService.sendSosSms(primaryPhones, message);
  };

  /**
   * 💬 SHARE ROUTE VIA WHATSAPP
   */
  const handleShareWhatsApp = async () => {
    AlertService.triggerHaptic();
    const loc = coords || (await LocationService.getCurrentLocation());
    const msg = await SosService.getLiveTripShareMessage(loc);
    await SosService.shareViaWhatsApp(msg, primaryGuardian?.phone);
  };

  /**
   * 📱 SHARE ROUTE VIA SMS
   */
  const handleShareSms = async () => {
    AlertService.triggerHaptic();
    const loc = coords || (await LocationService.getCurrentLocation());
    const msg = await SosService.getLiveTripShareMessage(loc);
    const phones = primaryGuardian ? [primaryGuardian.phone] : [];
    await SosService.sendSosSms(phones, msg);
  };

  const handleCallGuardian = () => {
    if (primaryGuardian) {
      SosService.dialEmergencyServices(primaryGuardian.phone);
    } else {
      Alert.alert('No Guardian Found', 'Please configure your family contact in Profile.');
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={false}
      onRequestClose={onClose}
    >
      <View style={styles.container}>
        {/* Top Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.headerBadge}>DISCREET PROTECTION</Text>
            <Text style={styles.headerTitle}>Night Travel & Safety Shield</Text>
          </View>
          <TouchableOpacity
            style={styles.closeBtn}
            onPress={onClose}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          >
            <Text style={styles.closeBtnText}>✕ Close</Text>
          </TouchableOpacity>
        </View>

        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* Current Live GPS Location Preview */}
          <View style={styles.locationBanner}>
            <Text style={styles.locationIcon}>📍</Text>
            <View style={styles.locationInfo}>
              <Text style={styles.locationHeading}>YOUR EXACT LIVE LOCATION</Text>
              <Text style={styles.locationAddress} numberOfLines={2}>
                {coords ? LocationService.formatLocationName(coords) : 'Acquiring GPS coordinates...'}
              </Text>
              <Text style={styles.locationCoords}>
                {coords ? LocationService.formatCoordinates(coords) : 'Waiting for fix...'}
              </Text>
            </View>
          </View>

          {alertSent && (
            <View style={styles.successBanner}>
              <Text style={styles.successIcon}>✓</Text>
              <Text style={styles.successText}>
                Distress SMS prepared with your live Google Maps coordinates!
              </Text>
            </View>
          )}

          {/* TALK WITH MIA ASSISTANT (AI DEFENSE GUIDE) */}
          <TouchableOpacity
            style={styles.miaCard}
            onPress={() => {
              if (onTalkWithMia) {
                onTalkWithMia();
              } else {
                onClose();
              }
            }}
            activeOpacity={0.85}
          >
            <View style={styles.miaIconCircle}>
              <Text style={styles.miaIcon}>💬</Text>
            </View>
            <View style={styles.miaTextCol}>
              <View style={styles.miaTitleRow}>
                <Text style={styles.miaTitle}>Ask MIA Assistant for Guidance</Text>
                <View style={styles.miaBadge}>
                  <Text style={styles.miaBadgeText}>AI GUIDE</Text>
                </View>
              </View>
              <Text style={styles.miaSub}>
                What to do if being followed • Safe shelters • EN / MR / HI
              </Text>
            </View>
            <Text style={styles.miaArrow}>➔</Text>
          </TouchableOpacity>

          {/* PRIMARY OPTION 1: 🤫 SILENT SOS (HIDING / CANNOT MAKE NOISE) */}
          <View style={styles.modeCardHighlight}>
            <View style={styles.modeHeaderRow}>
              <Text style={styles.modeIcon}>🤫</Text>
              <View style={styles.modeTitleBox}>
                <Text style={styles.modeTitle}>SILENT SOS (I am Hiding)</Text>
                <Text style={styles.modeSub}>
                  100% silent alert. Explicitly instructs family:
                </Text>
              </View>
            </View>

            <View style={styles.quoteBox}>
              <Text style={styles.quoteText}>
                "⚠️ DO NOT CALL ME (I cannot make noise / hiding). Send police/help to my GPS location immediately!"
              </Text>
            </View>

            <TouchableOpacity
              style={styles.silentActionBtn}
              onPress={handleTriggerSilentSos}
              activeOpacity={0.85}
            >
              <Text style={styles.silentActionIcon}>⚡</Text>
              <Text style={styles.silentActionText}>
                DISPATCH SILENT SOS TO FAMILY
              </Text>
            </TouchableOpacity>
          </View>

          {/* PRIMARY OPTION 2: 🚶 I AM BEING FOLLOWED / UNSAFE */}
          <View style={styles.modeCard}>
            <View style={styles.modeHeaderRow}>
              <Text style={styles.modeIcon}>🚶‍♀️</Text>
              <View style={styles.modeTitleBox}>
                <Text style={styles.modeTitle}>I Am Being Followed</Text>
                <Text style={styles.modeSub}>
                  Alert parents/spouse instantly with your live GPS location link
                </Text>
              </View>
            </View>

            <TouchableOpacity
              style={styles.followedActionBtn}
              onPress={handleTriggerBeingFollowed}
              activeOpacity={0.85}
            >
              <Text style={styles.followedActionIcon}>🚨</Text>
              <Text style={styles.followedActionText}>
                ALERT PARENTS / SPOUSE VIA SMS
              </Text>
            </TouchableOpacity>

            {/* Direct Speed-Dial Row */}
            <Text style={styles.speedDialLabel}>IMMEDIATE 1-TAP CALLS (IF SAFE TO TALK)</Text>
            <View style={styles.callRow}>
              <TouchableOpacity
                style={styles.callBtnPrimary}
                onPress={handleCallGuardian}
                activeOpacity={0.8}
              >
                <Text style={styles.callBtnIcon}>📞</Text>
                <Text style={styles.callBtnText}>
                  {primaryGuardian ? `Call ${primaryGuardian.name.split(' ')[0]}` : 'Call Family'}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.callBtnPolice}
                onPress={() => SosService.dialEmergencyServices('1091')}
                activeOpacity={0.8}
              >
                <Text style={styles.callBtnIcon}>👮‍♀️</Text>
                <Text style={styles.callBtnText}>Call 1091 (Women)</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.callBtnErss}
                onPress={() => SosService.dialEmergencyServices('112')}
                activeOpacity={0.8}
              >
                <Text style={styles.callBtnIcon}>🚨</Text>
                <Text style={styles.callBtnText}>Call 112</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* PRIMARY OPTION 3: 📍 SHARE LIVE TRIP WITH FAMILY */}
          <View style={styles.modeCard}>
            <View style={styles.modeHeaderRow}>
              <Text style={styles.modeIcon}>📍</Text>
              <View style={styles.modeTitleBox}>
                <Text style={styles.modeTitle}>Share Route / Travel With Family</Text>
                <Text style={styles.modeSub}>
                  Keep parents or spouse updated on your ride home
                </Text>
              </View>
            </View>

            <View style={styles.shareButtonsRow}>
              <TouchableOpacity
                style={styles.whatsappBtn}
                onPress={handleShareWhatsApp}
                activeOpacity={0.8}
              >
                <Text style={styles.shareIcon}>💬</Text>
                <Text style={styles.whatsappBtnText}>Share on WhatsApp</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.smsBtn}
                onPress={handleShareSms}
                activeOpacity={0.8}
              >
                <Text style={styles.shareIcon}>📱</Text>
                <Text style={styles.smsBtnText}>Share via SMS</Text>
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.footerSpace} />
        </ScrollView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: THEME.background,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 48,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: THEME.border,
  },
  headerBadge: {
    fontSize: 10,
    fontWeight: '800',
    color: THEME.primary,
    letterSpacing: 1.2,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: THEME.textPrimary,
    marginTop: 2,
  },
  closeBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: THEME.cardBg,
    borderWidth: 1,
    borderColor: THEME.border,
  },
  closeBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: THEME.textSecondary,
  },
  scrollContent: {
    padding: 16,
  },
  locationBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: THEME.cardBg,
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: THEME.border,
    marginBottom: 14,
  },
  locationIcon: {
    fontSize: 24,
    marginRight: 12,
  },
  locationInfo: {
    flex: 1,
  },
  locationHeading: {
    fontSize: 10,
    fontWeight: '800',
    color: '#38BDF8',
    letterSpacing: 0.8,
  },
  locationAddress: {
    fontSize: 14,
    fontWeight: '700',
    color: THEME.textPrimary,
    marginTop: 2,
  },
  locationCoords: {
    fontSize: 11,
    color: THEME.textSecondary,
    marginTop: 2,
  },
  successBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    borderWidth: 1,
    borderColor: THEME.green,
    borderRadius: 12,
    padding: 12,
    marginBottom: 14,
    gap: 8,
  },
  successIcon: {
    fontSize: 16,
    fontWeight: '800',
    color: THEME.green,
  },
  successText: {
    fontSize: 13,
    fontWeight: '600',
    color: THEME.green,
    flex: 1,
  },
  modeCardHighlight: {
    backgroundColor: '#1E1B4B',
    borderRadius: 18,
    padding: 16,
    borderWidth: 1.5,
    borderColor: '#6366F1',
    marginBottom: 16,
  },
  modeCard: {
    backgroundColor: THEME.cardBg,
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: THEME.border,
    marginBottom: 16,
  },
  modeHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  modeIcon: {
    fontSize: 26,
    marginRight: 12,
  },
  modeTitleBox: {
    flex: 1,
  },
  modeTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: THEME.textPrimary,
  },
  modeSub: {
    fontSize: 12,
    color: THEME.textSecondary,
    marginTop: 2,
  },
  quoteBox: {
    backgroundColor: 'rgba(99, 102, 241, 0.15)',
    borderLeftWidth: 3,
    borderLeftColor: '#818CF8',
    padding: 10,
    borderRadius: 6,
    marginBottom: 14,
  },
  quoteText: {
    fontSize: 12,
    color: '#C7D2FE',
    fontStyle: 'italic',
    lineHeight: 18,
  },
  silentActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#4F46E5',
    paddingVertical: 14,
    borderRadius: 12,
    gap: 8,
  },
  silentActionIcon: {
    fontSize: 16,
  },
  silentActionText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: 0.5,
  },
  followedActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: THEME.primary,
    paddingVertical: 14,
    borderRadius: 12,
    gap: 8,
    marginBottom: 16,
  },
  followedActionIcon: {
    fontSize: 16,
  },
  followedActionText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: 0.5,
  },
  speedDialLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: THEME.textSecondary,
    letterSpacing: 0.8,
    marginBottom: 10,
  },
  callRow: {
    flexDirection: 'row',
    gap: 8,
  },
  callBtnPrimary: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(37, 99, 235, 0.2)',
    borderWidth: 1,
    borderColor: '#3B82F6',
    paddingVertical: 10,
    borderRadius: 10,
    gap: 6,
  },
  callBtnPolice: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(234, 88, 12, 0.2)',
    borderWidth: 1,
    borderColor: '#EA580C',
    paddingVertical: 10,
    borderRadius: 10,
    gap: 6,
  },
  callBtnErss: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(220, 38, 38, 0.2)',
    borderWidth: 1,
    borderColor: THEME.primary,
    paddingVertical: 10,
    borderRadius: 10,
    gap: 6,
  },
  callBtnIcon: {
    fontSize: 14,
  },
  callBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: THEME.textPrimary,
  },
  shareButtonsRow: {
    flexDirection: 'row',
    gap: 10,
  },
  whatsappBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#059669',
    paddingVertical: 12,
    borderRadius: 12,
    gap: 6,
  },
  whatsappBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  smsBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#2563EB',
    paddingVertical: 12,
    borderRadius: 12,
    gap: 6,
  },
  smsBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  shareIcon: {
    fontSize: 14,
  },
  footerSpace: {
    height: 32,
  },
  miaCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#3B0764',
    borderWidth: 1.5,
    borderColor: '#A855F7',
    borderRadius: 16,
    padding: 14,
    marginBottom: 16,
  },
  miaIconCircle: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: '#7C3AED',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  miaIcon: {
    fontSize: 20,
    color: '#FFFFFF',
  },
  miaTextCol: {
    flex: 1,
  },
  miaTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  miaTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: '#FAF5FF',
  },
  miaBadge: {
    backgroundColor: '#9333EA',
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 4,
  },
  miaBadgeText: {
    fontSize: 8,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: 0.5,
  },
  miaSub: {
    fontSize: 10,
    color: '#D8B4FE',
    marginTop: 2,
    fontWeight: '500',
  },
  miaArrow: {
    fontSize: 16,
    fontWeight: '800',
    color: '#C084FC',
    marginLeft: 6,
  },
});

