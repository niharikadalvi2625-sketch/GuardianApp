import React, { useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  Modal,
  TouchableOpacity,
  ScrollView,
  Dimensions,
  Alert,
  Linking,
} from 'react-native';
import {
  SimulatedSosPayload,
  GuardianAcknowledgment,
  DemoModeService,
} from '../services/demoModeService';
import { AlertService } from '../services/alertService';
import { useTheme } from '../context/ThemeContext';

interface GuardianSimulationModalProps {
  visible: boolean;
  onClose: () => void;
  payload: SimulatedSosPayload | null;
  onAcknowledged?: (ack: GuardianAcknowledgment) => void;
}

const { width } = Dimensions.get('window');

export default function GuardianSimulationModal({
  visible,
  onClose,
  payload,
  onAcknowledged,
}: GuardianSimulationModalProps) {
  const { theme, isDark } = useTheme();
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [acknowledgedState, setAcknowledgedState] = useState<boolean>(false);

  if (!payload) return null;

  const handleAcknowledge = async (etaMinutes: number = 4) => {
    setIsProcessing(true);
    AlertService.triggerHaptic();
    try {
      const ack = await DemoModeService.acknowledgeAlert(
        etaMinutes,
        `I received your emergency alert! I am coming right now to ${payload.locality}. Stay safe!`
      );
      setAcknowledgedState(true);
      if (onAcknowledged) {
        onAcknowledged(ack);
      }
      setTimeout(() => {
        setIsProcessing(false);
        onClose();
      }, 900);
    } catch (_e) {
      setIsProcessing(false);
    }
  };

  const handleEscalatePolice = async () => {
    setIsProcessing(true);
    AlertService.triggerHaptic();
    try {
      const ack = await DemoModeService.escalateToPolice();
      setAcknowledgedState(true);
      if (onAcknowledged) {
        onAcknowledged(ack);
      }
      Alert.alert(
        '🚓 112 Control Room Notified',
        `Live GPS Packet forwarded to local Police PCR Van dispatch in ${payload.coords.city || 'Pune'}. Patrol unit dispatched.`
      );
      setTimeout(() => {
        setIsProcessing(false);
        onClose();
      }, 1000);
    } catch (_e) {
      setIsProcessing(false);
    }
  };

  const handleCallVictim = () => {
    AlertService.triggerHaptic();
    if (payload.victimPhone) {
      Linking.openURL(`tel:${payload.victimPhone}`).catch(() => {
        Alert.alert('Simulated Call', `Dialing ${payload.victimName} at ${payload.victimPhone}`);
      });
    } else {
      Alert.alert('Simulated Call', `Dialing ${payload.victimName}...`);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View
          style={[
            styles.container,
            {
              backgroundColor: isDark ? '#090D16' : '#FFFFFF',
              borderColor: isDark ? 'rgba(59, 130, 246, 0.3)' : '#CBD5E1',
            },
          ]}
        >
          {/* Simulated Smartphone Status Bar */}
          <View style={[styles.simStatusBar, { backgroundColor: isDark ? '#111827' : '#F1F5F9' }]}>
            <Text style={[styles.simCarrier, { color: theme.textMuted }]}>
              📶 Jio 5G • 🔋 94%
            </Text>
            <View style={styles.simPill}>
              <Text style={styles.simPillText}>🎓 EXAMINER VIVA PERSPECTIVE</Text>
            </View>
            <Text style={[styles.simTime, { color: theme.textMuted }]}>
              {payload.timeFormatted}
            </Text>
          </View>

          {/* Receiver Device Header */}
          <View style={[styles.deviceHeader, { borderBottomColor: theme.cardBorder }]}>
            <View style={styles.deviceInfo}>
              <View style={[styles.avatarCircle, { backgroundColor: isDark ? 'rgba(59, 130, 246, 0.2)' : '#DBEAFE' }]}>
                <Text style={styles.avatarText}>👨‍👧</Text>
              </View>
              <View>
                <View style={styles.nameRow}>
                  <Text style={[styles.guardianName, { color: theme.textPrimary }]}>
                    {payload.guardianContact.name} ({payload.guardianContact.relationship || 'Guardian'})
                  </Text>
                  <View style={[styles.onlineDot, { backgroundColor: theme.emerald }]} />
                </View>
                <Text style={[styles.guardianPhone, { color: theme.textSecondary }]}>
                  {payload.guardianContact.phone} • Receiver Device
                </Text>
              </View>
            </View>

            <TouchableOpacity style={styles.closeBtn} onPress={onClose}>
              <Text style={[styles.closeBtnText, { color: theme.textMuted }]}>✕</Text>
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.bodyScroll} contentContainerStyle={styles.bodyContent}>
            {/* Context Explanation for Examiners */}
            <View style={[styles.examinerNotice, { backgroundColor: isDark ? 'rgba(59, 130, 246, 0.08)' : '#EFF6FF', borderColor: theme.blue }]}>
              <Text style={[styles.examinerNoticeTitle, { color: theme.blue }]}>
                💡 Presentation Mode Context
              </Text>
              <Text style={[styles.examinerNoticeText, { color: theme.textSecondary }]}>
                This screen demonstrates what the emergency contact receives on their phone when the user triggers SOS, proving the full end-to-end communication pipeline.
              </Text>
            </View>

            {/* Simulated Incoming Emergency SMS Box */}
            <View style={[styles.smsCard, { backgroundColor: isDark ? '#111827' : '#F8FAFC', borderColor: theme.primaryBorder }]}>
              <View style={styles.smsHeader}>
                <View style={styles.smsHeaderLeft}>
                  <Text style={styles.smsIcon}>🚨</Text>
                  <Text style={[styles.smsSender, { color: theme.primary }]}>
                    EMERGENCY SOS DISPATCH
                  </Text>
                </View>
                <Text style={[styles.smsTime, { color: theme.textMuted }]}>
                  Just Now
                </Text>
              </View>

              <View style={[styles.smsPayloadBox, { backgroundColor: isDark ? '#090D16' : '#FFFFFF', borderColor: theme.cardBorder }]}>
                <Text style={[styles.smsPayloadText, { color: theme.textPrimary }]}>
                  <Text style={{ fontWeight: '800', color: theme.primary }}>[CRITICAL SOS ALERT]{'\n'}</Text>
                  {payload.victimName} has activated Emergency SOS!{'\n\n'}
                  📍 <Text style={{ fontWeight: '700' }}>Location:</Text> {payload.locality}{'\n'}
                  🌐 <Text style={{ fontWeight: '700' }}>GPS Coordinates:</Text> {payload.coords.latitude.toFixed(4)}° N, {payload.coords.longitude.toFixed(4)}° E (±{payload.coords.accuracy || 5}m){'\n'}
                  🔋 <Text style={{ fontWeight: '700' }}>Device Battery:</Text> {payload.batteryLevel}%{'\n'}
                  ⏱️ <Text style={{ fontWeight: '700' }}>Trigger Time:</Text> {payload.timeFormatted}{'\n\n'}
                  🔗 <Text style={{ color: theme.blue, textDecorationLine: 'underline' }}>{payload.trackingUrl}</Text>
                </Text>
              </View>
            </View>

            {/* Proximity & Navigation Mini-Radar */}
            <View style={[styles.mapPreviewCard, { backgroundColor: isDark ? '#111827' : '#F8FAFC', borderColor: theme.cardBorder }]}>
              <View style={styles.mapHeader}>
                <Text style={[styles.mapTitle, { color: theme.textPrimary }]}>
                  🗺️ Live Proximity & GPS Fix
                </Text>
                <View style={[styles.distBadge, { backgroundColor: isDark ? 'rgba(16, 185, 129, 0.15)' : '#DCFCE7' }]}>
                  <Text style={[styles.distText, { color: theme.emerald }]}>
                    📍 ~1.4 km away
                  </Text>
                </View>
              </View>

              <View style={[styles.mapCanvas, { backgroundColor: isDark ? '#0F172A' : '#E2E8F0' }]}>
                {/* Visual Radar Rings */}
                <View style={[styles.radarRing, { width: 140, height: 140, borderColor: theme.blue }]} />
                <View style={[styles.radarRing, { width: 80, height: 80, borderColor: theme.blue }]} />
                <View style={[styles.victimPin, { backgroundColor: theme.primary }]}>
                  <Text style={styles.pinIcon}>📍</Text>
                </View>
                <Text style={[styles.pinLabel, { color: theme.textPrimary }]}>
                  {payload.victimName}
                </Text>
              </View>
            </View>

            {/* Two-Way Response Action Buttons */}
            <Text style={[styles.actionsSectionTitle, { color: theme.textSecondary }]}>
              GUARDIAN ACTIONS (TWO-WAY DISPATCH)
            </Text>

            <TouchableOpacity
              style={[
                styles.primaryActionBtn,
                { backgroundColor: theme.emerald },
                isProcessing && { opacity: 0.7 },
              ]}
              onPress={() => handleAcknowledge(4)}
              disabled={isProcessing}
            >
              <Text style={styles.primaryActionIcon}>✅</Text>
              <View style={styles.primaryActionTextCol}>
                <Text style={styles.primaryActionTitle}>
                  Acknowledge & Mark "En Route"
                </Text>
                <Text style={styles.primaryActionSub}>
                  Sends confirmation back to {payload.victimName} (ETA: 4 mins)
                </Text>
              </View>
            </TouchableOpacity>

            <View style={styles.dualActionRow}>
              <TouchableOpacity
                style={[
                  styles.secondaryActionBtn,
                  { backgroundColor: isDark ? 'rgba(239, 68, 68, 0.15)' : '#FEE2E2', borderColor: theme.primary },
                ]}
                onPress={handleEscalatePolice}
                disabled={isProcessing}
              >
                <Text style={styles.secondaryActionIcon}>🚓</Text>
                <Text style={[styles.secondaryActionText, { color: theme.primary }]}>
                  Escalate 112
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.secondaryActionBtn,
                  { backgroundColor: isDark ? 'rgba(59, 130, 246, 0.15)' : '#EFF6FF', borderColor: theme.blue },
                ]}
                onPress={handleCallVictim}
                disabled={isProcessing}
              >
                <Text style={styles.secondaryActionIcon}>📞</Text>
                <Text style={[styles.secondaryActionText, { color: theme.blue }]}>
                  Call {payload.victimName.split(' ')[0]}
                </Text>
              </TouchableOpacity>
            </View>
          </ScrollView>

          {/* Bottom Bar */}
          <View style={[styles.bottomBar, { borderTopColor: theme.cardBorder, backgroundColor: isDark ? '#111827' : '#F8FAFC' }]}>
            <TouchableOpacity style={styles.dismissBtn} onPress={onClose}>
              <Text style={[styles.dismissBtnText, { color: theme.textMuted }]}>
                Close Simulation View
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    justifyContent: 'flex-end',
  },
  container: {
    height: '92%',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderWidth: 1,
    overflow: 'hidden',
  },
  simStatusBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  simCarrier: {
    fontSize: 10,
    fontWeight: '700',
  },
  simPill: {
    backgroundColor: '#3B82F6',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  simPillText: {
    color: '#FFFFFF',
    fontSize: 9,
    fontWeight: '800',
  },
  simTime: {
    fontSize: 10,
    fontWeight: '700',
  },
  deviceHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  deviceInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  avatarCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    fontSize: 22,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  guardianName: {
    fontSize: 15,
    fontWeight: '700',
  },
  onlineDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  guardianPhone: {
    fontSize: 12,
    fontWeight: '500',
    marginTop: 2,
  },
  closeBtn: {
    padding: 6,
  },
  closeBtnText: {
    fontSize: 16,
    fontWeight: '700',
  },
  bodyScroll: {
    flex: 1,
  },
  bodyContent: {
    padding: 16,
    gap: 14,
  },
  examinerNotice: {
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
  },
  examinerNoticeTitle: {
    fontSize: 12,
    fontWeight: '800',
    marginBottom: 4,
    letterSpacing: 0.3,
  },
  examinerNoticeText: {
    fontSize: 11,
    lineHeight: 16,
  },
  smsCard: {
    borderRadius: 16,
    padding: 14,
    borderWidth: 1.5,
  },
  smsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  smsHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  smsIcon: {
    fontSize: 16,
  },
  smsSender: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  smsTime: {
    fontSize: 11,
    fontWeight: '600',
  },
  smsPayloadBox: {
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
  },
  smsPayloadText: {
    fontSize: 13,
    lineHeight: 20,
    fontFamily: 'monospace',
  },
  mapPreviewCard: {
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
  },
  mapHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  mapTitle: {
    fontSize: 13,
    fontWeight: '700',
  },
  distBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  distText: {
    fontSize: 11,
    fontWeight: '700',
  },
  mapCanvas: {
    height: 120,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
    position: 'relative',
  },
  radarRing: {
    position: 'absolute',
    borderRadius: 100,
    borderWidth: 1,
    borderStyle: 'dashed',
    opacity: 0.4,
  },
  victimPin: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 6,
  },
  pinIcon: {
    fontSize: 16,
  },
  pinLabel: {
    fontSize: 10,
    fontWeight: '800',
    marginTop: 4,
  },
  actionsSectionTitle: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.8,
    marginTop: 4,
  },
  primaryActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: 14,
    gap: 12,
  },
  primaryActionIcon: {
    fontSize: 22,
  },
  primaryActionTextCol: {
    flex: 1,
  },
  primaryActionTitle: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
  },
  primaryActionSub: {
    color: 'rgba(255, 255, 255, 0.85)',
    fontSize: 11,
    fontWeight: '500',
    marginTop: 2,
  },
  dualActionRow: {
    flexDirection: 'row',
    gap: 10,
  },
  secondaryActionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    gap: 8,
  },
  secondaryActionIcon: {
    fontSize: 16,
  },
  secondaryActionText: {
    fontSize: 12,
    fontWeight: '700',
  },
  bottomBar: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderTopWidth: 1,
    alignItems: 'center',
  },
  dismissBtn: {
    paddingVertical: 6,
    paddingHorizontal: 16,
  },
  dismissBtnText: {
    fontSize: 12,
    fontWeight: '600',
  },
});
