import React, { useEffect, useRef } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  Animated,
  Dimensions,
  Platform,
} from 'react-native';
import { SimulatedSosPayload } from '../services/demoModeService';
import { useTheme } from '../context/ThemeContext';

interface GuardianResponseBannerProps {
  payload: SimulatedSosPayload | null;
  onPressInspect: () => void;
  onDismiss: () => void;
}

const { width } = Dimensions.get('window');

export default function GuardianResponseBanner({
  payload,
  onPressInspect,
  onDismiss,
}: GuardianResponseBannerProps) {
  const { theme, isDark } = useTheme();
  const slideAnim = useRef(new Animated.Value(-120)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (payload) {
      // Slide down banner
      Animated.spring(slideAnim, {
        toValue: 0,
        tension: 60,
        friction: 9,
        useNativeDriver: true,
      }).start();

      // Pulsing notification dot
      const pulseLoop = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.25,
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
      pulseLoop.start();

      return () => {
        pulseLoop.stop();
      };
    } else {
      // Slide up banner
      Animated.timing(slideAnim, {
        toValue: -140,
        duration: 250,
        useNativeDriver: true,
      }).start();
    }
  }, [payload]);

  if (!payload) return null;

  return (
    <Animated.View
      style={[
        styles.container,
        {
          transform: [{ translateY: slideAnim }],
        },
      ]}
    >
      <TouchableOpacity
        style={[
          styles.bannerCard,
          {
            backgroundColor: isDark ? '#111827' : '#FFFFFF',
            borderColor: isDark ? 'rgba(59, 130, 246, 0.4)' : '#BFDBFE',
            shadowColor: theme.blue,
          },
        ]}
        activeOpacity={0.88}
        onPress={onPressInspect}
      >
        <View style={styles.topRow}>
          <View style={styles.headerLeft}>
            <Animated.View
              style={[
                styles.pulseIndicator,
                {
                  transform: [{ scale: pulseAnim }],
                  backgroundColor: theme.emerald,
                },
              ]}
            />
            <Text style={[styles.appBadge, { color: theme.blue }]}>
              📱 GUARDIAN DEVICE ACTIVE
            </Text>
            <View style={[styles.timeBadge, { backgroundColor: isDark ? '#1E293B' : '#F1F5F9' }]}>
              <Text style={[styles.timeText, { color: theme.textMuted }]}>
                {payload.timeFormatted}
              </Text>
            </View>
          </View>

          <TouchableOpacity
            style={styles.closeBtn}
            onPress={onDismiss}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Text style={[styles.closeBtnText, { color: theme.textMuted }]}>✕</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.contentRow}>
          <View style={[styles.iconWrapper, { backgroundColor: isDark ? 'rgba(59, 130, 246, 0.15)' : '#EFF6FF' }]}>
            <Text style={styles.iconText}>🛡️</Text>
          </View>
          <View style={styles.textContainer}>
            <Text style={[styles.title, { color: theme.textPrimary }]} numberOfLines={1}>
              {payload.guardianContact.name}'s Device Received SOS!
            </Text>
            <Text style={[styles.subtitle, { color: theme.textSecondary }]} numberOfLines={1}>
              SMS & Live GPS coordinates decoded at {payload.locality}
            </Text>
          </View>
        </View>

        <View style={styles.actionRow}>
          <View style={[styles.inspectBadge, { backgroundColor: isDark ? 'rgba(16, 185, 129, 0.15)' : '#ECFDF5', borderColor: theme.emerald }]}>
            <Text style={[styles.inspectText, { color: theme.emerald }]}>
              🎓 Tap to Inspect Receiver Screen →
            </Text>
          </View>
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 48 : 20,
    left: 12,
    right: 12,
    zIndex: 9999,
    elevation: 24,
  },
  bannerCard: {
    borderRadius: 16,
    padding: 14,
    borderWidth: 1.5,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.35,
    shadowRadius: 16,
    elevation: 12,
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  pulseIndicator: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  appBadge: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.6,
  },
  timeBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  timeText: {
    fontSize: 10,
    fontWeight: '600',
  },
  closeBtn: {
    padding: 2,
  },
  closeBtnText: {
    fontSize: 14,
    fontWeight: '700',
  },
  contentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  iconWrapper: {
    width: 38,
    height: 38,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  iconText: {
    fontSize: 20,
  },
  textContainer: {
    flex: 1,
  },
  title: {
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 2,
  },
  subtitle: {
    fontSize: 12,
    fontWeight: '500',
  },
  actionRow: {
    marginTop: 10,
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },
  inspectBadge: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 8,
    borderWidth: 1,
  },
  inspectText: {
    fontSize: 11,
    fontWeight: '700',
  },
});
