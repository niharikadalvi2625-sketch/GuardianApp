import React, { useState, useEffect, useRef } from 'react';
import {
  StyleSheet,
  Text,
  View,
  Modal,
  TouchableOpacity,
  Dimensions,
  Animated,
} from 'react-native';
import { AlertService } from '../services/alertService';

interface FakeCallModalProps {
  visible: boolean;
  onClose: () => void;
}

const { width, height } = Dimensions.get('window');

const CALLER_PRESETS = [
  { id: 'dad', name: 'Dad (Papa)', role: 'Father' },
  { id: 'mom', name: 'Mom (Mummy)', role: 'Mother' },
  { id: 'spouse', name: 'Spouse', role: 'Partner' },
  { id: 'police', name: 'Inspector Sharma', role: 'Police Officer' },
];

export default function FakeCallModal({ visible, onClose }: FakeCallModalProps) {
  const [selectedCaller, setSelectedCaller] = useState(CALLER_PRESETS[0]);
  const [callState, setCallState] = useState<'incoming' | 'connected'>('incoming');
  const [callDuration, setCallDuration] = useState<number>(0);

  const pulseAnim = useRef(new Animated.Value(1)).current;
  const durationTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (visible) {
      setCallState('incoming');
      setCallDuration(0);
      AlertService.startPhoneRingVibrate();

      // Pulsing incoming call button animation
      const loop = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.2,
            duration: 700,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 700,
            useNativeDriver: true,
          }),
        ])
      );
      loop.start();

      return () => {
        loop.stop();
        AlertService.stopPhoneRingVibrate();
        if (durationTimerRef.current) clearInterval(durationTimerRef.current);
      };
    }
  }, [visible]);

  const handleAccept = () => {
    AlertService.stopPhoneRingVibrate();
    setCallState('connected');

    let sec = 0;
    durationTimerRef.current = setInterval(() => {
      sec += 1;
      setCallDuration(sec);
    }, 1000);
  };

  const handleDeclineOrEnd = () => {
    AlertService.stopPhoneRingVibrate();
    if (durationTimerRef.current) clearInterval(durationTimerRef.current);
    onClose();
  };

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <Modal
      visible={visible}
      animationType="fade"
      transparent={false}
      onRequestClose={handleDeclineOrEnd}
    >
      <View style={styles.container}>
        {callState === 'incoming' ? (
          /* --- INCOMING CALL SCREEN --- */
          <View style={styles.screenContent}>
            {/* Top Caller Select Chips (Allows switching caller persona discreetly) */}
            <View style={styles.callerSwitchRow}>
              {CALLER_PRESETS.map((caller) => (
                <TouchableOpacity
                  key={caller.id}
                  style={[
                    styles.callerChip,
                    selectedCaller.id === caller.id && styles.callerChipActive,
                  ]}
                  onPress={() => setSelectedCaller(caller)}
                >
                  <Text
                    style={[
                      styles.callerChipText,
                      selectedCaller.id === caller.id && styles.callerChipTextActive,
                    ]}
                  >
                    {caller.name.split(' ')[0]}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Main Caller Avatar & Info */}
            <View style={styles.callerInfoSection}>
              <View style={styles.avatarCircle}>
                <Text style={styles.avatarEmoji}>👤</Text>
              </View>
              <Text style={styles.callerName}>{selectedCaller.name}</Text>
              <Text style={styles.callerSub}>Incoming Call...</Text>
              <Text style={styles.callerNumber}>Mobile +91 98765 43210</Text>
            </View>

            {/* Bottom Action Controls */}
            <View style={styles.actionSection}>
              <View style={styles.buttonsRow}>
                {/* Decline Button */}
                <View style={styles.buttonWrapper}>
                  <TouchableOpacity
                    style={styles.declineBtn}
                    onPress={handleDeclineOrEnd}
                    activeOpacity={0.8}
                  >
                    <Text style={styles.btnIcon}>📞</Text>
                  </TouchableOpacity>
                  <Text style={styles.buttonLabel}>Decline</Text>
                </View>

                {/* Accept Button */}
                <View style={styles.buttonWrapper}>
                  <Animated.View style={{ transform: [{ scale: pulseAnim }] }}>
                    <TouchableOpacity
                      style={styles.acceptBtn}
                      onPress={handleAccept}
                      activeOpacity={0.8}
                    >
                      <Text style={styles.btnIcon}>📞</Text>
                    </TouchableOpacity>
                  </Animated.View>
                  <Text style={styles.buttonLabel}>Accept</Text>
                </View>
              </View>

              <Text style={styles.hintText}>
                Tip: Accept and say "Yes Dad, I'm just 2 minutes away, wait outside" to deter suspicious individuals.
              </Text>
            </View>
          </View>
        ) : (
          /* --- ACTIVE CALL SCREEN --- */
          <View style={styles.screenContent}>
            <View style={styles.callerInfoSection}>
              <View style={styles.avatarCircleSmall}>
                <Text style={styles.avatarEmojiSmall}>👤</Text>
              </View>
              <Text style={styles.callerName}>{selectedCaller.name}</Text>
              <Text style={styles.connectedDuration}>{formatDuration(callDuration)}</Text>
            </View>

            {/* Fake In-Call Controls Grid */}
            <View style={styles.inCallGrid}>
              <View style={styles.inCallItem}>
                <View style={styles.inCallCircle}>
                  <Text style={styles.inCallIcon}>🔇</Text>
                </View>
                <Text style={styles.inCallText}>Mute</Text>
              </View>

              <View style={styles.inCallItem}>
                <View style={styles.inCallCircle}>
                  <Text style={styles.inCallIcon}>🔢</Text>
                </View>
                <Text style={styles.inCallText}>Keypad</Text>
              </View>

              <View style={styles.inCallItem}>
                <View style={[styles.inCallCircle, { backgroundColor: '#334155' }]}>
                  <Text style={styles.inCallIcon}>🔊</Text>
                </View>
                <Text style={styles.inCallText}>Speaker</Text>
              </View>
            </View>

            {/* Script Suggestion for User */}
            <View style={styles.scriptCard}>
              <Text style={styles.scriptHeading}>SUGGESTED ESCAPE SCRIPT</Text>
              <Text style={styles.scriptBody}>
                "Hello? Yes, I'm taking the turn now. I see your car at the end of the road. I'll be there in 1 minute."
              </Text>
            </View>

            {/* End Call Button */}
            <View style={styles.endCallSection}>
              <TouchableOpacity
                style={styles.endCallBtn}
                onPress={handleDeclineOrEnd}
                activeOpacity={0.8}
              >
                <Text style={styles.endCallIcon}>📞</Text>
              </TouchableOpacity>
              <Text style={styles.buttonLabel}>End Call</Text>
            </View>
          </View>
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0A0F1D',
  },
  screenContent: {
    flex: 1,
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    paddingTop: 54,
    paddingBottom: 40,
  },
  callerSwitchRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
    flexWrap: 'wrap',
  },
  callerChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: '#1E293B',
    borderWidth: 1,
    borderColor: '#334155',
  },
  callerChipActive: {
    backgroundColor: '#3B82F6',
    borderColor: '#60A5FA',
  },
  callerChipText: {
    fontSize: 12,
    color: '#94A3B8',
    fontWeight: '600',
  },
  callerChipTextActive: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  callerInfoSection: {
    alignItems: 'center',
    marginTop: 24,
  },
  avatarCircle: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: '#1E293B',
    borderWidth: 2,
    borderColor: '#475569',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  avatarEmoji: {
    fontSize: 48,
  },
  avatarCircleSmall: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: '#1E293B',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 14,
  },
  avatarEmojiSmall: {
    fontSize: 34,
  },
  callerName: {
    fontSize: 28,
    fontWeight: '800',
    color: '#F8FAFC',
    textAlign: 'center',
  },
  callerSub: {
    fontSize: 16,
    color: '#38BDF8',
    fontWeight: '600',
    marginTop: 6,
  },
  callerNumber: {
    fontSize: 13,
    color: '#64748B',
    marginTop: 4,
  },
  connectedDuration: {
    fontSize: 20,
    fontWeight: '700',
    color: '#10B981',
    marginTop: 8,
    letterSpacing: 1,
  },
  actionSection: {
    alignItems: 'center',
  },
  buttonsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    width: '100%',
    paddingHorizontal: 24,
    marginBottom: 24,
  },
  buttonWrapper: {
    alignItems: 'center',
  },
  declineBtn: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: '#EF4444',
    justifyContent: 'center',
    alignItems: 'center',
    transform: [{ rotate: '135deg' }],
  },
  acceptBtn: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: '#10B981',
    justifyContent: 'center',
    alignItems: 'center',
  },
  btnIcon: {
    fontSize: 30,
  },
  buttonLabel: {
    color: '#F1F5F9',
    fontSize: 13,
    fontWeight: '600',
    marginTop: 10,
  },
  hintText: {
    fontSize: 12,
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 18,
    paddingHorizontal: 16,
  },
  inCallGrid: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginVertical: 20,
  },
  inCallItem: {
    alignItems: 'center',
  },
  inCallCircle: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#1E293B',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  inCallIcon: {
    fontSize: 22,
  },
  inCallText: {
    fontSize: 12,
    color: '#94A3B8',
    fontWeight: '600',
  },
  scriptCard: {
    backgroundColor: '#1E293B',
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: '#334155',
    marginVertical: 10,
  },
  scriptHeading: {
    fontSize: 10,
    fontWeight: '800',
    color: '#F59E0B',
    letterSpacing: 0.8,
    marginBottom: 6,
  },
  scriptBody: {
    fontSize: 13,
    color: '#E2E8F0',
    lineHeight: 20,
    fontStyle: 'italic',
  },
  endCallSection: {
    alignItems: 'center',
    marginTop: 10,
  },
  endCallBtn: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: '#EF4444',
    justifyContent: 'center',
    alignItems: 'center',
    transform: [{ rotate: '135deg' }],
  },
  endCallIcon: {
    fontSize: 30,
  },
});

