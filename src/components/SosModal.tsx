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
}

const { width, height } = Dimensions.get('window');

export default function SosModal({
  visible,
  onClose,
  userCoords,
  immediateTrigger = true,
  onTalkWithMia,
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
      <View style={styles.backdrop}>
        <View style={styles.cardContainer}>
          {/* TOP POPUP BAR WITH PROMINENT CANCEL BUTTON */}
          <View style={styles.popupTopBar}>
            <View style={styles.popupTopStatus}>
              <View style={[styles.statusDot, !isTriggered && { backgroundColor: '#F59E0B' }]} />
              <Text style={styles.popupTopStatusText}>
                {isTriggered ? 'SOS BROADCAST ACTIVE' : 'SOS COUNTDOWN'}
              </Text>
            </View>

            {/* Clear, prominent Cancel button for the pop up bar */}
            <TouchableOpacity
              style={styles.popupCancelBtn}
              onPress={handleCancel}
              activeOpacity={0.7}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              accessibilityLabel="Cancel SOS popup"
            >
              <Text style={styles.popupCancelBtnText}>✕ Cancel</Text>
            </TouchableOpacity>
          </View>

          <ScrollView
            style={styles.modalScroll}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
          >
            {!isTriggered ? (
              /* --- Phase 1: 5-Second Countdown State --- */
              <View style={styles.countdownContainer}>
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
                <Text style={styles.activeTitle}>Distress Alert Sent</Text>
                <Text style={styles.activeSub}>
                  Your emergency contacts have been pinged with your exact location and Medical ID.
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

                {/* Quick Action Buttons */}
                <View style={styles.actionsColumn}>
                  {/* FEATURE: TALK WITH MIA ASSISTANT (AI Safety Guidance) */}
                  <TouchableOpacity
                    style={styles.miaBtn}
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
                      <View style={styles.miaHeaderRow}>
                        <Text style={styles.miaTitle}>Talk with MIA (AI Assistant)</Text>
                        <View style={styles.miaBadge}>
                          <Text style={styles.miaBadgeText}>AI GUIDE</Text>
                        </View>
                      </View>
                      <Text style={styles.miaSub}>
                        Ask what to do • First aid • Stay calm • EN/MR/HI
                      </Text>
                    </View>
                    <Text style={styles.miaArrow}>➔</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.resendSmsBtn}
                    onPress={handleResendSms}
                    activeOpacity={0.8}
                  >
                    <Text style={styles.resendSmsIcon}>💬</Text>
                    <View>
                      <Text style={styles.resendSmsTitle}>Open / Send Live GPS via SMS</Text>
                      <Text style={styles.resendSmsSub}>Distress SMS text with Google Maps link</Text>
                    </View>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.whatsappBtn}
                    onPress={handleWhatsAppPrimary}
                    activeOpacity={0.85}
                  >
                    <Text style={styles.whatsappIcon}>📱</Text>
                    <View>
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
                      <Text style={styles.callIcon}>📞</Text>
                      <View>
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
                    <Text style={styles.callIcon}>🚨</Text>
                    <View>
                      <Text style={styles.callTitle}>Call 112 (Emergency Police Dispatch)</Text>
                      <Text style={styles.callSub}>Police • Fire • Medical</Text>
                    </View>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.callPoliceBtn, { backgroundColor: '#BE123C' }]}
                    onPress={() => SosService.dialEmergencyServices('1091')}
                    activeOpacity={0.85}
                  >
                    <Text style={styles.callIcon}>👮‍♀️</Text>
                    <View>
                      <Text style={styles.callTitle}>Call 1091 (Women Safety Helpline)</Text>
                      <Text style={styles.callSub}>24x7 Police Rescue for Women</Text>
                    </View>
                  </TouchableOpacity>
                </View>

                {/* Mark Safe / Bottom Cancel Bar */}
                <TouchableOpacity
                  style={styles.dismissBtn}
                  onPress={handleCancel}
                  activeOpacity={0.8}
                >
                  <Text style={styles.dismissBtnText}>✕ Cancel Alert • I Am Safe Now</Text>
                </TouchableOpacity>
              </View>
            )}
          </ScrollView>
        </View>
      </View>
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
    width: Math.min(width - 32, 440),
    maxHeight: Math.min(height * 0.88, 700),
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    shadowColor: '#E63946',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 12,
    overflow: 'hidden',
  },
  popupTopBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#F8FAFC',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  popupTopStatus: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#EF4444',
    marginRight: 6,
  },
  popupTopStatusText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#0F172A',
    letterSpacing: 0.5,
  },
  popupCancelBtn: {
    backgroundColor: '#FEE2E2',
    borderWidth: 1,
    borderColor: '#FECACA',
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 8,
  },
  popupCancelBtnText: {
    color: '#DC2626',
    fontSize: 12,
    fontWeight: '800',
  },
  modalScroll: {
    flexGrow: 0,
  },
  scrollContent: {
    padding: 18,
    paddingBottom: 24,
  },
  countdownContainer: {
    alignItems: 'center',
    paddingTop: 8,
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
    marginBottom: 20,
    paddingHorizontal: 8,
  },
  countdownRingWrapper: {
    width: 130,
    height: 130,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 22,
  },
  beaconRing: {
    position: 'absolute',
    width: 130,
    height: 130,
    borderRadius: 65,
    backgroundColor: 'rgba(230, 57, 70, 0.2)',
  },
  countdownCircle: {
    width: 100,
    height: 100,
    borderRadius: 50,
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
    fontSize: 44,
    fontWeight: '900',
    color: '#FFFFFF',
    lineHeight: 48,
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
    paddingVertical: 14,
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
  activeTitle: {
    fontSize: 20,
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
  },
  coordsBox: {
    width: '100%',
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    padding: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 12,
  },
  coordsLabel: {
    fontSize: 9,
    fontWeight: '800',
    color: '#94A3B8',
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  coordsValue: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0F172A',
  },
  medicalNotice: {
    fontSize: 10,
    color: '#64748B',
    marginTop: 3,
    fontWeight: '500',
  },
  actionsColumn: {
    width: '100%',
    gap: 8,
    marginBottom: 14,
  },
  // MIA Assistant Button Styling
  miaBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FAF5FF',
    borderWidth: 1.5,
    borderColor: '#C084FC',
    borderRadius: 14,
    padding: 12,
  },
  miaIconBg: {
    width: 36,
    height: 36,
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
  miaHeaderRow: {
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

  resendSmsBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EFF6FF',
    padding: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#BFDBFE',
    gap: 10,
  },
  resendSmsIcon: {
    fontSize: 20,
  },
  resendSmsTitle: {
    color: '#1E40AF',
    fontSize: 13,
    fontWeight: '800',
  },
  resendSmsSub: {
    color: '#3B82F6',
    fontSize: 10,
    fontWeight: '500',
    marginTop: 1,
  },
  whatsappBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#16A34A',
    padding: 12,
    borderRadius: 14,
    gap: 10,
  },
  whatsappIcon: {
    fontSize: 20,
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
    backgroundColor: '#0F172A',
    padding: 12,
    borderRadius: 14,
    gap: 10,
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
    gap: 10,
  },
  callIcon: {
    fontSize: 20,
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
  guardianNotifiedBox: {
    backgroundColor: '#EFF6FF',
    borderRadius: 12,
    padding: 10,
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
    fontSize: 13,
    fontWeight: '800',
    color: '#0F172A',
  },
  guardianNotifiedPhone: {
    fontSize: 11,
    color: '#2563EB',
    fontWeight: '700',
    marginTop: 1,
  },
});
