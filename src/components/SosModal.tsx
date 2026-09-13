import React, { useState, useEffect, useRef } from 'react';
import {
  StyleSheet,
  Text,
  View,
  Modal,
  TouchableOpacity,
  ScrollView,
  Animated,
  Dimensions,
} from 'react-native';
import { LocationCoords, EmergencyContact, UserProfile } from '../types';
import { SosService } from '../services/sosService';
import { LocationService } from '../services/locationService';

interface SosModalProps {
  visible: boolean;
  onClose: () => void;
  userCoords: LocationCoords | null;
  immediateTrigger?: boolean;
  onTalkWithMia?: () => void;
  onNavigateToSafeZones?: () => void;
}

const { width, height } = Dimensions.get('window');

export default function SosModal({
  visible,
  onClose,
  userCoords,
  immediateTrigger = true,
  onTalkWithMia,
  onNavigateToSafeZones,
}: SosModalProps) {
  const [countdown, setCountdown] = useState<number>(immediateTrigger ? 0 : 5);
  const [isTriggered, setIsTriggered] = useState<boolean>(immediateTrigger);
  const [contacts, setContacts] = useState<EmergencyContact[]>([]);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [sosMessage, setSosMessage] = useState<string>('');

  const pulseAnim = useRef(new Animated.Value(1)).current;
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (visible) {
      loadContactsAndProfile();

      if (immediateTrigger) {
        setIsTriggered(true);
        setCountdown(0);
        executeSosTrigger();
      } else {
        setCountdown(5);
        setIsTriggered(false);
        startCountdown();
      }

      // Beacon pulsing animation
      const loop = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.25,
            duration: 600,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 600,
            useNativeDriver: true,
          }),
        ])
      );
      loop.start();

      return () => {
        loop.stop();
        if (timerRef.current) clearInterval(timerRef.current);
      };
    }
  }, [visible, immediateTrigger]);

  const loadContactsAndProfile = async () => {
    const c = await SosService.getContacts();
    const p = await SosService.getProfile();
    setContacts(c);
    setProfile(p);
  };

  const startCountdown = () => {
    let count = 5;
    if (timerRef.current) clearInterval(timerRef.current);

    timerRef.current = setInterval(() => {
      count -= 1;
      setCountdown(count);
      if (count <= 0) {
        if (timerRef.current) clearInterval(timerRef.current);
        executeSosTrigger();
      }
    }, 1000);
  };

  const executeSosTrigger = async () => {
    setIsTriggered(true);
    const coords = userCoords || LocationService.getLastKnownLocation();

    const { message, contacts: alertContacts } = await SosService.triggerSosAlert(coords);
    setSosMessage(message);

    // Auto dispatch SMS to parents / primary guardians immediately
    const primaryPhones = alertContacts
      .filter((c) => c.isPrimary)
      .map((c) => c.phone);
    const phonesToUse = primaryPhones.length > 0 ? primaryPhones : (alertContacts[0] ? [alertContacts[0].phone] : []);
    if (phonesToUse.length > 0) {
      await SosService.sendSosSms(phonesToUse, message);
    }
  };

  const handleCancel = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    onClose();
  };

  const handleManualTriggerNow = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    executeSosTrigger();
  };

  const handleCall911 = () => {
    SosService.dialEmergencyServices('112');
  };

  const handleCallPrimary = () => {
    const primary = contacts.find((c) => c.isPrimary) || contacts[0];
    if (primary) {
      SosService.dialEmergencyServices(primary.phone);
    }
  };

  const handleWhatsAppPrimary = () => {
    const primary = contacts.find((c) => c.isPrimary) || contacts[0];
    if (primary) {
      SosService.shareViaWhatsApp(sosMessage, primary.phone);
    }
  };

  const handleResendSms = () => {
    const primary = contacts.find((c) => c.isPrimary) || contacts[0];
    const phones = primary ? [primary.phone] : contacts.map((c) => c.phone);
    SosService.sendSosSms(phones, sosMessage);
  };

  return (
    <Modal
      visible={visible}
      animationType="fade"
      transparent
      onRequestClose={handleCancel}
    >
      <TouchableOpacity
        style={styles.backdrop}
        activeOpacity={1}
        onPress={handleCancel}
      >
        <TouchableOpacity
          activeOpacity={1}
          style={styles.cardContainer}
          onPress={(e) => e.stopPropagation()}
        >
          {/* Top-Right Corner Close Button (Always visible) */}
          <TouchableOpacity
            style={styles.cornerCloseBtn}
            onPress={handleCancel}
            hitSlop={{ top: 14, bottom: 14, left: 14, right: 14 }}
            accessibilityLabel="Close SOS Dialog"
          >
            <Text style={styles.cornerCloseText}>✕</Text>
          </TouchableOpacity>

          <ScrollView
            style={styles.modalScroll}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
          >
            {!isTriggered ? (
              /* --- Phase 1: 5-Second Countdown State --- */
              <View style={styles.countdownContainer}>
                <View style={styles.urgencyPill}>
                  <Text style={styles.urgencyText}>⚠️ SOS COUNTDOWN</Text>
                </View>

                <Text style={styles.warningTitle}>Broadcasting Distress Signal</Text>
                <Text style={styles.warningDesc}>
                  Distress alert and real-time GPS coordinates will be sent to your{' '}
                  {contacts.length} emergency contacts in:
                </Text>

                {/* Glowing Countdown Ring */}
                <View style={styles.countdownRingWrapper}>
                  <Animated.View
                    style={[
                      styles.beaconRing,
                      { transform: [{ scale: pulseAnim }] },
                    ]}
                  />
                  <View style={styles.countdownCircle}>
                    <Text style={styles.countdownNumber}>{countdown}</Text>
                    <Text style={styles.countdownUnit}>SEC</Text>
                  </View>
                </View>

                <TouchableOpacity
                  style={styles.cancelButton}
                  onPress={handleCancel}
                  activeOpacity={0.8}
                >
                  <Text style={styles.cancelButtonText}>✕ I AM SAFE (CANCEL)</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.instantButton}
                  onPress={handleManualTriggerNow}
                  activeOpacity={0.7}
                >
                  <Text style={styles.instantButtonText}>Send SOS Immediately ➔</Text>
                </TouchableOpacity>
              </View>
            ) : (
              /* --- Phase 2: Active SOS Emergency Dispatch State --- */
              <View style={styles.activeContainer}>
                {/* Active SOS Status Pill */}
                <View style={styles.activeBadge}>
                  <View style={styles.activeDot} />
                  <Text style={styles.activeBadgeText}>SOS BROADCAST ACTIVE</Text>
                </View>

                <Text style={styles.activeTitle}>Distress Alert Sent</Text>
                <Text style={styles.activeSub}>
                  Your trusted guardians have been pinged with your exact location and Medical ID.
                </Text>

                {/* Primary Guardian Target Confirmation */}
                {contacts.length > 0 && (
                  <View style={styles.guardianNotifiedBox}>
                    <Text style={styles.guardianNotifiedLabel}>ALERT SENT DIRECTLY TO PARENTS / GUARDIAN</Text>
                    <Text style={styles.guardianNotifiedName}>
                      {contacts.find((c) => c.isPrimary)?.name || contacts[0]?.name || 'Primary Guardian'}
                    </Text>
                    <Text style={styles.guardianNotifiedPhone}>
                      {contacts.find((c) => c.isPrimary)?.phone || contacts[0]?.phone}
                    </Text>
                  </View>
                )}

                {/* Coordinates summary */}
                <View style={styles.coordsBox}>
                  <Text style={styles.coordsLabel}>BROADCAST LOCATION</Text>
                  <Text style={styles.coordsValue}>
                    {userCoords
                      ? LocationService.formatCoordinates(userCoords)
                      : 'Acquiring GPS fix...'}
                  </Text>
                  {profile && (
                    <Text style={styles.medicalNotice}>
                      Medical Info: {profile.bloodType} | {profile.allergies}
                    </Text>
                  )}
                </View>

                {/* --- TOP 2 ESSENTIAL ASSISTANCE CARDS (NEW) --- */}
                <View style={styles.rescueCardsSection}>
                  <Text style={styles.sectionHeading}>IMMEDIATE HELP & GUIDANCE</Text>

                  {/* 1. TALK WITH MIA ASSISTANT */}
                  <TouchableOpacity
                    style={styles.miaCard}
                    onPress={() => {
                      if (onTalkWithMia) {
                        onTalkWithMia();
                      } else {
                        handleCancel();
                      }
                    }}
                    activeOpacity={0.85}
                  >
                    <View style={styles.miaIconBg}>
                      <Text style={styles.miaIcon}>💬</Text>
                    </View>
                    <View style={styles.miaTextCol}>
                      <View style={styles.miaTitleRow}>
                        <Text style={styles.miaTitle}>Talk with MIA (AI Assistant)</Text>
                        <View style={styles.miaBadge}>
                          <Text style={styles.miaBadgeText}>AI GUIDE</Text>
                        </View>
                      </View>
                      <Text style={styles.miaSub}>
                        Ask what to do • First aid • Stay calm • EN / MR / HI
                      </Text>
                    </View>
                    <Text style={styles.miaArrow}>➔</Text>
                  </TouchableOpacity>

                  {/* 2. VIEW SAFE ZONES & SHELTERS */}
                  <TouchableOpacity
                    style={styles.safeZoneCard}
                    onPress={() => {
                      if (onNavigateToSafeZones) {
                        onNavigateToSafeZones();
                      } else {
                        handleCancel();
                      }
                    }}
                    activeOpacity={0.85}
                  >
                    <View style={styles.safeZoneIconBg}>
                      <Text style={styles.safeZoneIcon}>🏥</Text>
                    </View>
                    <View style={styles.safeZoneTextCol}>
                      <View style={styles.safeZoneTitleRow}>
                        <Text style={styles.safeZoneTitle}>View Safe Zones & Shelters</Text>
                        <View style={styles.safeZoneBadge}>
                          <Text style={styles.safeZoneBadgeText}>GOOGLE MAP</Text>
                        </View>
                      </View>
                      <Text style={styles.safeZoneSub}>
                        Hospitals, Police Stations & Safe Shelters near you
                      </Text>
                    </View>
                    <Text style={styles.safeZoneArrow}>➔</Text>
                  </TouchableOpacity>
                </View>

                {/* --- DISPATCH & CALL ACTIONS --- */}
                <Text style={styles.sectionHeading}>LIVE GPS SHARING & HOTLINES</Text>
                <View style={styles.actionsColumn}>
                  <TouchableOpacity
                    style={styles.resendSmsBtn}
                    onPress={handleResendSms}
                    activeOpacity={0.8}
                  >
                    <Text style={styles.btnLeadingIcon}>💬</Text>
                    <Text style={styles.resendSmsText}>Open / Send Live GPS via SMS</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.whatsappBtn}
                    onPress={handleWhatsAppPrimary}
                    activeOpacity={0.85}
                  >
                    <Text style={styles.btnLeadingIcon}>📱</Text>
                    <View style={styles.btnTextCol}>
                      <Text style={styles.whatsappTitle}>Send Live GPS on WhatsApp</Text>
                      <Text style={styles.whatsappSub}>Instant map link to parents</Text>
                    </View>
                  </TouchableOpacity>

                  {contacts.length > 0 && (
                    <TouchableOpacity
                      style={styles.callGuardianBtn}
                      onPress={handleCallPrimary}
                      activeOpacity={0.85}
                    >
                      <Text style={styles.btnLeadingIcon}>📞</Text>
                      <View style={styles.btnTextCol}>
                        <Text style={styles.callGuardianTitle}>
                          Call {contacts.find((c) => c.isPrimary)?.name || contacts[0]?.name}
                        </Text>
                        <Text style={styles.callGuardianSub}>Parents / Primary Contact</Text>
                      </View>
                    </TouchableOpacity>
                  )}

                  <TouchableOpacity
                    style={styles.callPoliceBtn}
                    onPress={handleCall911}
                    activeOpacity={0.85}
                  >
                    <Text style={styles.btnLeadingIcon}>🚨</Text>
                    <View style={styles.btnTextCol}>
                      <Text style={styles.callTitle}>Call 112 (Emergency Police Dispatch)</Text>
                      <Text style={styles.callSub}>Police • Fire • Medical</Text>
                    </View>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.callPoliceBtn, { backgroundColor: '#C2410C' }]}
                    onPress={() => SosService.dialEmergencyServices('1091')}
                    activeOpacity={0.85}
                  >
                    <Text style={styles.btnLeadingIcon}>👮</Text>
                    <View style={styles.btnTextCol}>
                      <Text style={styles.callTitle}>Call 1091 (Women Safety Helpline)</Text>
                      <Text style={styles.callSub}>24x7 Police Rescue for Women</Text>
                    </View>
                  </TouchableOpacity>
                </View>

                {/* Dismiss Button */}
                <TouchableOpacity
                  style={styles.dismissBtn}
                  onPress={handleCancel}
                  activeOpacity={0.8}
                >
                  <Text style={styles.dismissBtnText}>I am Safe Now • Dismiss SOS</Text>
                </TouchableOpacity>
              </View>
            )}
          </ScrollView>
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.82)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  cardContainer: {
    width: Math.min(width - 32, 430),
    maxHeight: Math.min(height * 0.90, 720),
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    shadowColor: '#E63946',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 12,
    overflow: 'hidden',
    position: 'relative',
  },
  // Top-Right Corner Close Button
  cornerCloseBtn: {
    position: 'absolute',
    top: 14,
    right: 14,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F1F5F9',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 99,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  cornerCloseText: {
    fontSize: 16,
    fontWeight: '800',
    color: '#475569',
    lineHeight: 18,
  },
  modalScroll: {
    flexGrow: 0,
  },
  scrollContent: {
    padding: 20,
    paddingTop: 18,
    paddingBottom: 24,
  },
  countdownContainer: {
    alignItems: 'center',
    paddingTop: 8,
  },
  urgencyPill: {
    backgroundColor: '#FEF2F2',
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#FCA5A5',
    marginBottom: 10,
  },
  urgencyText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#DC2626',
    letterSpacing: 0.5,
  },
  warningTitle: {
    fontSize: 20,
    fontWeight: '900',
    color: '#1E293B',
    textAlign: 'center',
    marginBottom: 6,
  },
  warningDesc: {
    fontSize: 12,
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 17,
    marginBottom: 18,
    paddingHorizontal: 8,
  },
  countdownRingWrapper: {
    width: 124,
    height: 124,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  beaconRing: {
    position: 'absolute',
    width: 124,
    height: 124,
    borderRadius: 62,
    backgroundColor: 'rgba(230, 57, 70, 0.2)',
  },
  countdownCircle: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: '#E63946',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#B71C1C',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.4,
    shadowRadius: 10,
    elevation: 8,
  },
  countdownNumber: {
    fontSize: 42,
    fontWeight: '900',
    color: '#FFFFFF',
    lineHeight: 46,
  },
  countdownUnit: {
    fontSize: 10,
    fontWeight: '800',
    color: 'rgba(255, 255, 255, 0.8)',
    letterSpacing: 1,
  },
  cancelButton: {
    width: '100%',
    backgroundColor: '#10B981',
    paddingVertical: 13,
    borderRadius: 14,
    alignItems: 'center',
    marginBottom: 10,
  },
  cancelButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  instantButton: {
    paddingVertical: 6,
  },
  instantButtonText: {
    color: '#DC2626',
    fontSize: 13,
    fontWeight: '700',
  },
  activeContainer: {
    alignItems: 'center',
  },
  activeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEE2E2',
    paddingVertical: 5,
    paddingHorizontal: 12,
    borderRadius: 16,
    marginBottom: 8,
    marginTop: 2,
  },
  activeDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#EF4444',
    marginRight: 6,
  },
  activeBadgeText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#B91C1C',
    letterSpacing: 0.5,
  },
  activeTitle: {
    fontSize: 22,
    fontWeight: '900',
    color: '#1E293B',
    marginBottom: 4,
  },
  activeSub: {
    fontSize: 12,
    color: '#64748B',
    textAlign: 'center',
    marginBottom: 14,
    lineHeight: 16,
    paddingHorizontal: 8,
  },
  guardianNotifiedBox: {
    backgroundColor: '#EFF6FF',
    borderRadius: 14,
    padding: 12,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#BFDBFE',
    width: '100%',
  },
  guardianNotifiedLabel: {
    fontSize: 9,
    fontWeight: '800',
    color: '#1D4ED8',
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  guardianNotifiedName: {
    fontSize: 14,
    fontWeight: '800',
    color: '#0F172A',
  },
  guardianNotifiedPhone: {
    fontSize: 12,
    color: '#2563EB',
    fontWeight: '700',
    marginTop: 1,
  },
  coordsBox: {
    width: '100%',
    backgroundColor: '#F8FAFC',
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 14,
  },
  coordsLabel: {
    fontSize: 9,
    fontWeight: '800',
    color: '#94A3B8',
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  coordsValue: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0F172A',
  },
  medicalNotice: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 3,
    fontWeight: '500',
  },

  // Section Headings
  sectionHeading: {
    width: '100%',
    fontSize: 10,
    fontWeight: '800',
    color: '#64748B',
    letterSpacing: 0.8,
    marginBottom: 8,
    marginTop: 4,
  },

  // Top 2 Immediate Rescue Cards
  rescueCardsSection: {
    width: '100%',
    marginBottom: 12,
    gap: 8,
  },
  miaCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FAF5FF',
    borderWidth: 1.5,
    borderColor: '#C084FC',
    borderRadius: 14,
    padding: 12,
  },
  miaIconBg: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: '#7C3AED',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  miaIcon: {
    fontSize: 18,
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
    color: '#581C87',
  },
  miaBadge: {
    backgroundColor: '#7C3AED',
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
    color: '#7E22CE',
    marginTop: 2,
    fontWeight: '500',
  },
  miaArrow: {
    fontSize: 16,
    fontWeight: '800',
    color: '#7C3AED',
    marginLeft: 6,
  },

  safeZoneCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F0F9FF',
    borderWidth: 1.5,
    borderColor: '#7DD3FC',
    borderRadius: 14,
    padding: 12,
  },
  safeZoneIconBg: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: '#0284C7',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  safeZoneIcon: {
    fontSize: 18,
    color: '#FFFFFF',
  },
  safeZoneTextCol: {
    flex: 1,
  },
  safeZoneTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  safeZoneTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: '#075985',
  },
  safeZoneBadge: {
    backgroundColor: '#0284C7',
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 4,
  },
  safeZoneBadgeText: {
    fontSize: 8,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: 0.5,
  },
  safeZoneSub: {
    fontSize: 10,
    color: '#0369A1',
    marginTop: 2,
    fontWeight: '500',
  },
  safeZoneArrow: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0284C7',
    marginLeft: 6,
  },

  // Actions Column
  actionsColumn: {
    width: '100%',
    gap: 8,
    marginBottom: 14,
  },
  btnLeadingIcon: {
    fontSize: 18,
    marginRight: 4,
  },
  btnTextCol: {
    flex: 1,
  },
  resendSmsBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F0F9FF',
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#BAE6FD',
  },
  resendSmsText: {
    color: '#0284C7',
    fontSize: 13,
    fontWeight: '700',
  },
  whatsappBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#16A34A',
    padding: 12,
    borderRadius: 14,
    gap: 8,
  },
  whatsappTitle: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '800',
  },
  whatsappSub: {
    color: 'rgba(255, 255, 255, 0.9)',
    fontSize: 10,
    fontWeight: '500',
    marginTop: 1,
  },
  callGuardianBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1E293B',
    padding: 12,
    borderRadius: 14,
    gap: 8,
  },
  callGuardianTitle: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '800',
  },
  callGuardianSub: {
    color: '#94A3B8',
    fontSize: 10,
    fontWeight: '500',
    marginTop: 1,
  },
  callPoliceBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#DC2626',
    padding: 12,
    borderRadius: 14,
    gap: 8,
  },
  callTitle: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '800',
  },
  callSub: {
    color: 'rgba(255, 255, 255, 0.85)',
    fontSize: 10,
    fontWeight: '500',
    marginTop: 1,
  },
  dismissBtn: {
    width: '100%',
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: '#CBD5E1',
  },
  dismissBtnText: {
    color: '#475569',
    fontSize: 12,
    fontWeight: '700',
  },
});
