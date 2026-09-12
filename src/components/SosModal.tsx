import React, { useState, useEffect, useRef } from 'react';
import {
  StyleSheet,
  Text,
  View,
  Modal,
  TouchableOpacity,
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
}

const { width } = Dimensions.get('window');

export default function SosModal({
  visible,
  onClose,
  userCoords,
  immediateTrigger = true,
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
          {!isTriggered ? (
            /* --- Phase 1: 5-Second Countdown State --- */
            <View style={styles.countdownContainer}>
              <View style={styles.urgencyPill}>
                <Text style={styles.urgencyText}>⚠️ SOS TRIGGER CONFIRMATION</Text>
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

              {/* Quick Action Buttons */}
              <View style={styles.actionsColumn}>
                <TouchableOpacity
                  style={styles.resendSmsBtn}
                  onPress={handleResendSms}
                  activeOpacity={0.8}
                >
                  <Text style={styles.resendSmsText}>💬 Open / Send Live GPS via SMS</Text>
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
                  style={[styles.callPoliceBtn, { backgroundColor: '#C2410C' }]}
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

              {/* Mark Safe / Close */}
              <TouchableOpacity
                style={styles.dismissBtn}
                onPress={handleCancel}
                activeOpacity={0.8}
              >
                <Text style={styles.dismissBtnText}>I am Safe Now • Dismiss SOS</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.85)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  cardContainer: {
    width: width - 40,
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 24,
    shadowColor: '#E63946',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 12,
  },
  countdownContainer: {
    alignItems: 'center',
  },
  urgencyPill: {
    backgroundColor: '#FEF2F2',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#FCA5A5',
    marginBottom: 12,
  },
  urgencyText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#DC2626',
    letterSpacing: 0.5,
  },
  warningTitle: {
    fontSize: 22,
    fontWeight: '900',
    color: '#1E293B',
    textAlign: 'center',
    marginBottom: 8,
  },
  warningDesc: {
    fontSize: 13,
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: 24,
    paddingHorizontal: 10,
  },
  countdownRingWrapper: {
    width: 140,
    height: 140,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 28,
  },
  beaconRing: {
    position: 'absolute',
    width: 140,
    height: 140,
    borderRadius: 70,
    backgroundColor: 'rgba(230, 57, 70, 0.2)',
  },
  countdownCircle: {
    width: 110,
    height: 110,
    borderRadius: 55,
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
    fontSize: 48,
    fontWeight: '900',
    color: '#FFFFFF',
    lineHeight: 52,
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
    marginBottom: 12,
  },
  cancelButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
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
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 16,
    marginBottom: 10,
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
    marginBottom: 6,
  },
  activeSub: {
    fontSize: 13,
    color: '#64748B',
    textAlign: 'center',
    marginBottom: 18,
    lineHeight: 18,
  },
  coordsBox: {
    width: '100%',
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 16,
  },
  coordsLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: '#94A3B8',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  coordsValue: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0F172A',
  },
  medicalNotice: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 4,
    fontWeight: '500',
  },
  actionsColumn: {
    width: '100%',
    gap: 10,
    marginBottom: 16,
  },
  callPoliceBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#DC2626',
    padding: 14,
    borderRadius: 14,
    gap: 12,
  },
  callIcon: {
    fontSize: 24,
  },
  callTitle: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
  },
  callSub: {
    color: 'rgba(255, 255, 255, 0.85)',
    fontSize: 11,
    fontWeight: '600',
  },
  callGuardianBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1E293B',
    padding: 14,
    borderRadius: 14,
    gap: 12,
  },
  callGuardianTitle: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
  },
  callGuardianSub: {
    color: '#94A3B8',
    fontSize: 11,
    fontWeight: '600',
  },
  resendSmsBtn: {
    backgroundColor: '#EFF6FF',
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#BFDBFE',
  },
  resendSmsText: {
    color: '#2563EB',
    fontSize: 13,
    fontWeight: '700',
  },
  dismissBtn: {
    width: '100%',
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
    backgroundColor: '#F1F5F9',
  },
  dismissBtnText: {
    color: '#475569',
    fontSize: 13,
    fontWeight: '700',
  },
  guardianNotifiedBox: {
    backgroundColor: '#EFF6FF',
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#BFDBFE',
  },
  guardianNotifiedLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: '#1D4ED8',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  guardianNotifiedName: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0F172A',
  },
  guardianNotifiedPhone: {
    fontSize: 13,
    color: '#2563EB',
    fontWeight: '700',
    marginTop: 2,
  },
  whatsappBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#16A34A',
    padding: 14,
    borderRadius: 14,
    gap: 12,
  },
  whatsappIcon: {
    fontSize: 22,
  },
  whatsappTitle: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
  },
  whatsappSub: {
    color: 'rgba(255, 255, 255, 0.9)',
    fontSize: 11,
    fontWeight: '600',
  },
});
