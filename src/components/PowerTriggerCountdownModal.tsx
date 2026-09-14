import React, { useState, useEffect, useRef } from 'react';
import {
  StyleSheet,
  Text,
  View,
  Modal,
  TouchableOpacity,
  Animated,
  StatusBar,
} from 'react-native';
import { AlertService } from '../services/alertService';

interface PowerTriggerCountdownModalProps {
  visible: boolean;
  onCancel: () => void;
  onTriggerSos: () => void;
  guardianName?: string;
}

export default function PowerTriggerCountdownModal({
  visible,
  onCancel,
  onTriggerSos,
  guardianName = 'Parents / Guardian',
}: PowerTriggerCountdownModalProps) {
  const [secondsLeft, setSecondsLeft] = useState<number>(5);
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const timerRef = useRef<any>(null);

  useEffect(() => {
    if (visible) {
      setSecondsLeft(5);
      AlertService.triggerHaptic();

      // Start pulsing ring animation
      Animated.loop(
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
      ).start();

      // Countdown interval
      timerRef.current = setInterval(() => {
        setSecondsLeft((prev) => {
          if (prev <= 1) {
            if (timerRef.current) clearInterval(timerRef.current);
            onTriggerSos();
            return 0;
          }
          AlertService.triggerHaptic();
          return prev - 1;
        });
      }, 1000);
    } else {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
      pulseAnim.stopAnimation();
    }

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, [visible]);

  const handleCancel = () => {
    AlertService.triggerHaptic();
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    onCancel();
  };

  const handleImmediateSend = () => {
    AlertService.triggerHaptic();
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    onTriggerSos();
  };

  if (!visible) return null;

  return (
    <Modal visible={visible} transparent animationType="fade" statusBarTranslucent>
      <StatusBar barStyle="light-content" backgroundColor="rgba(0, 0, 0, 0.9)" />
      <View style={styles.overlay}>
        <View style={styles.card}>
          {/* Pulsing Radar Ring with Countdown */}
          <View style={styles.radarWrapper}>
            <Animated.View
              style={[
                styles.pulseRing,
                { transform: [{ scale: pulseAnim }] },
              ]}
            />
            <View style={styles.countdownCenter}>
              <Text style={styles.countdownNumber}>{secondsLeft}</Text>
              <Text style={styles.countdownSecondsText}>SEC</Text>
            </View>
          </View>

          {/* Alert Title */}
          <Text style={styles.alertHeader}>⚡ POWER BUTTON SOS DETECTED</Text>
          <Text style={styles.alertSubtitle}>
            Triple-click trigger activated. Dispatching emergency live GPS tracking alert to:
          </Text>

          <View style={styles.recipientPill}>
            <Text style={styles.recipientIcon}>🛡️</Text>
            <Text style={styles.recipientName}>{guardianName}</Text>
          </View>

          {/* Action Buttons */}
          <View style={styles.buttonGroup}>
            <TouchableOpacity
              style={styles.cancelBtn}
              onPress={handleCancel}
              activeOpacity={0.85}
            >
              <Text style={styles.cancelBtnText}>✕ CANCEL (I'M SAFE)</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.immediateBtn}
              onPress={handleImmediateSend}
              activeOpacity={0.85}
            >
              <Text style={styles.immediateBtnText}>🚨 SEND NOW IMMEDIATELY</Text>
            </TouchableOpacity>
          </View>

          <Text style={styles.falseAlarmNotice}>
            Tap "CANCEL" if this was pressed by mistake.
          </Text>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.94)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  card: {
    width: '100%',
    maxWidth: 380,
    backgroundColor: '#1E293B',
    borderRadius: 24,
    padding: 24,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#EF4444',
    shadowColor: '#EF4444',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.5,
    shadowRadius: 16,
    elevation: 12,
  },
  radarWrapper: {
    width: 140,
    height: 140,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  pulseRing: {
    position: 'absolute',
    width: 130,
    height: 130,
    borderRadius: 65,
    backgroundColor: 'rgba(239, 68, 68, 0.25)',
    borderWidth: 2,
    borderColor: '#EF4444',
  },
  countdownCenter: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: '#DC2626',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 6,
  },
  countdownNumber: {
    fontSize: 44,
    fontWeight: '900',
    color: '#FFFFFF',
    lineHeight: 48,
  },
  countdownSecondsText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#FEE2E2',
    letterSpacing: 1,
    marginTop: -2,
  },
  alertHeader: {
    fontSize: 18,
    fontWeight: '900',
    color: '#FFFFFF',
    textAlign: 'center',
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  alertSubtitle: {
    fontSize: 13,
    color: '#94A3B8',
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: 14,
    paddingHorizontal: 10,
  },
  recipientPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    paddingVertical: 6,
    paddingHorizontal: 14,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.35)',
    marginBottom: 22,
    gap: 6,
  },
  recipientIcon: {
    fontSize: 14,
  },
  recipientName: {
    fontSize: 14,
    fontWeight: '800',
    color: '#FCA5A5',
  },
  buttonGroup: {
    width: '100%',
    gap: 10,
  },
  cancelBtn: {
    backgroundColor: '#10B981',
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#10B981',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.35,
    shadowRadius: 6,
    elevation: 4,
  },
  cancelBtnText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  immediateBtn: {
    backgroundColor: '#B91C1C',
    paddingVertical: 12,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  immediateBtnText: {
    color: '#FEE2E2',
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  falseAlarmNotice: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 14,
    textAlign: 'center',
  },
});
