import React, { useState, useEffect, useRef } from 'react';
import {
  StyleSheet,
  Text,
  View,
  Modal,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { LocationCoords, EmergencyContact } from '../types';
import { SosService } from '../services/sosService';
import { LocationService } from '../services/locationService';
import { AlertService } from '../services/alertService';

interface JourneySentinelModalProps {
  visible: boolean;
  onClose: () => void;
  userCoords: LocationCoords | null;
}

const DURATIONS = [
  { label: '10 Mins', seconds: 600 },
  { label: '20 Mins', seconds: 1200 },
  { label: '30 Mins', seconds: 1800 },
  { label: '45 Mins', seconds: 2700 },
];

export default function JourneySentinelModal({
  visible,
  onClose,
  userCoords,
}: JourneySentinelModalProps) {
  const [selectedDuration, setSelectedDuration] = useState(1200); // 20 mins default
  const [isActive, setIsActive] = useState<boolean>(false);
  const [remainingSeconds, setRemainingSeconds] = useState<number>(1200);
  const [primaryGuardian, setPrimaryGuardian] = useState<EmergencyContact | null>(null);

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (visible) {
      loadGuardian();
    }
  }, [visible]);

  const loadGuardian = async () => {
    const guardian = await SosService.getPrimaryGuardian();
    setPrimaryGuardian(guardian);
  };

  const handleStartTrip = () => {
    AlertService.triggerHaptic();
    setIsActive(true);
    setRemainingSeconds(selectedDuration);

    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      setRemainingSeconds((prev) => {
        if (prev <= 1) {
          clearInterval(timerRef.current!);
          handleTimeExpired();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  const handleTimeExpired = async () => {
    setIsActive(false);
    const loc = userCoords || (await LocationService.getCurrentLocation());
    const { message, primaryPhones } = await SosService.triggerBeingFollowedSos(loc);

    Alert.alert(
      '⚠️ Safe Arrival Time Expired!',
      'You did not check in as safe. Emergency alert is being sent to your guardians with your live GPS location.',
      [{ text: 'OK' }]
    );

    await SosService.sendSosSms(primaryPhones, message);
  };

  const handleReachedSafely = () => {
    AlertService.triggerHaptic();
    if (timerRef.current) clearInterval(timerRef.current);
    setIsActive(false);
    Alert.alert('Trip Ended', 'Great! Safe arrival confirmed. Guardian monitoring ended.');
    onClose();
  };

  const handleExtend5Mins = () => {
    AlertService.triggerHaptic();
    setRemainingSeconds((prev) => prev + 300);
  };

  const handleCancelTrip = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    setIsActive(false);
    onClose();
  };

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={false}
      onRequestClose={handleCancelTrip}
    >
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.badge}>JOURNEY SENTINEL</Text>
            <Text style={styles.title}>Safe Arrival Check-in Timer</Text>
          </View>
          <TouchableOpacity style={styles.closeBtn} onPress={handleCancelTrip}>
            <Text style={styles.closeText}>✕ Close</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.content}>
          <Text style={styles.description}>
            Traveling late in a cab, auto, or walking alone? Set your estimated trip duration. If you don't tap{' '}
            <Text style={{ fontWeight: '800', color: '#10B981' }}>"I've Reached Safely"</Text> before time runs out, an emergency SOS with your live GPS location is automatically dispatched to{' '}
            <Text style={{ fontWeight: '800', color: '#38BDF8' }}>
              {primaryGuardian ? primaryGuardian.name : 'your parents/spouse'}
            </Text>.
          </Text>

          {!isActive ? (
            /* --- SETUP SCREEN --- */
            <View style={styles.setupCard}>
              <Text style={styles.selectLabel}>CHOOSE ESTIMATED TRAVEL TIME</Text>
              <View style={styles.durationGrid}>
                {DURATIONS.map((d) => (
                  <TouchableOpacity
                    key={d.seconds}
                    style={[
                      styles.durationBtn,
                      selectedDuration === d.seconds && styles.durationBtnActive,
                    ]}
                    onPress={() => setSelectedDuration(d.seconds)}
                    activeOpacity={0.8}
                  >
                    <Text
                      style={[
                        styles.durationBtnText,
                        selectedDuration === d.seconds && styles.durationBtnTextActive,
                      ]}
                    >
                      {d.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <TouchableOpacity
                style={styles.startBtn}
                onPress={handleStartTrip}
                activeOpacity={0.85}
              >
                <Text style={styles.startBtnIcon}>⏱️</Text>
                <Text style={styles.startBtnText}>START JOURNEY SENTINEL</Text>
              </TouchableOpacity>
            </View>
          ) : (
            /* --- ACTIVE MONITORING SCREEN --- */
            <View style={styles.activeCard}>
              <View style={styles.pulseDotRow}>
                <View style={styles.greenDot} />
                <Text style={styles.monitoringStatus}>SENTINEL ACTIVE — MONITORING</Text>
              </View>

              <Text style={styles.countdownText}>{formatTime(remainingSeconds)}</Text>
              <Text style={styles.countdownSub}>Remaining until auto-emergency dispatch</Text>

              {/* Action Buttons */}
              <TouchableOpacity
                style={styles.safeBtn}
                onPress={handleReachedSafely}
                activeOpacity={0.85}
              >
                <Text style={styles.safeBtnIcon}>✓</Text>
                <Text style={styles.safeBtnText}>I'VE REACHED SAFELY</Text>
              </TouchableOpacity>

              <View style={styles.secondaryBtnRow}>
                <TouchableOpacity
                  style={styles.extendBtn}
                  onPress={handleExtend5Mins}
                  activeOpacity={0.8}
                >
                  <Text style={styles.extendText}>+5 Mins (Delay)</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.cancelBtn}
                  onPress={handleCancelTrip}
                  activeOpacity={0.8}
                >
                  <Text style={styles.cancelText}>Cancel Trip</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}

          <View style={styles.guardianNotice}>
            <Text style={styles.guardianNoticeIcon}>🛡️</Text>
            <View style={{ flex: 1 }}>
              <Text style={styles.guardianNoticeTitle}>Monitored by Primary Guardian</Text>
              <Text style={styles.guardianNoticeText}>
                {primaryGuardian ? `${primaryGuardian.name} (${primaryGuardian.phone})` : 'Configure in Profile screen'}
              </Text>
            </View>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0F172A',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 48,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#334155',
  },
  badge: {
    fontSize: 10,
    fontWeight: '800',
    color: '#38BDF8',
    letterSpacing: 1,
  },
  title: {
    fontSize: 18,
    fontWeight: '800',
    color: '#F8FAFC',
    marginTop: 2,
  },
  closeBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: '#1E293B',
    borderWidth: 1,
    borderColor: '#334155',
  },
  closeText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#94A3B8',
  },
  content: {
    padding: 20,
    flex: 1,
    justifyContent: 'space-between',
  },
  description: {
    fontSize: 13,
    color: '#94A3B8',
    lineHeight: 20,
  },
  setupCard: {
    backgroundColor: '#1E293B',
    borderRadius: 18,
    padding: 20,
    borderWidth: 1,
    borderColor: '#334155',
    marginVertical: 20,
  },
  selectLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: '#64748B',
    letterSpacing: 0.8,
    marginBottom: 14,
  },
  durationGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 20,
  },
  durationBtn: {
    flex: 1,
    minWidth: '45%',
    backgroundColor: '#0F172A',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#334155',
  },
  durationBtnActive: {
    backgroundColor: '#0284C7',
    borderColor: '#38BDF8',
  },
  durationBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#94A3B8',
  },
  durationBtnTextActive: {
    color: '#FFFFFF',
    fontWeight: '800',
  },
  startBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#0284C7',
    paddingVertical: 16,
    borderRadius: 14,
    gap: 8,
  },
  startBtnIcon: {
    fontSize: 18,
  },
  startBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  activeCard: {
    backgroundColor: '#1E293B',
    borderRadius: 20,
    padding: 24,
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#0284C7',
    marginVertical: 20,
  },
  pulseDotRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 16,
  },
  greenDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#10B981',
  },
  monitoringStatus: {
    fontSize: 11,
    fontWeight: '800',
    color: '#10B981',
    letterSpacing: 1,
  },
  countdownText: {
    fontSize: 54,
    fontWeight: '800',
    color: '#F8FAFC',
    letterSpacing: 2,
  },
  countdownSub: {
    fontSize: 12,
    color: '#94A3B8',
    marginTop: 4,
    marginBottom: 24,
  },
  safeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#10B981',
    paddingVertical: 16,
    width: '100%',
    borderRadius: 14,
    gap: 8,
    marginBottom: 12,
  },
  safeBtnIcon: {
    fontSize: 18,
    fontWeight: '900',
    color: '#FFFFFF',
  },
  safeBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  secondaryBtnRow: {
    flexDirection: 'row',
    gap: 10,
    width: '100%',
  },
  extendBtn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#334155',
    paddingVertical: 12,
    borderRadius: 10,
  },
  extendText: {
    color: '#E2E8F0',
    fontSize: 12,
    fontWeight: '700',
  },
  cancelBtn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    borderWidth: 1,
    borderColor: '#EF4444',
    paddingVertical: 12,
    borderRadius: 10,
  },
  cancelText: {
    color: '#EF4444',
    fontSize: 12,
    fontWeight: '700',
  },
  guardianNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1E293B',
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: '#334155',
    gap: 12,
  },
  guardianNoticeIcon: {
    fontSize: 22,
  },
  guardianNoticeTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#F8FAFC',
  },
  guardianNoticeText: {
    fontSize: 11,
    color: '#94A3B8',
    marginTop: 2,
  },
});

