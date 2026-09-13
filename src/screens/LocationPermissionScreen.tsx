import React, { useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  ActivityIndicator,
  StatusBar,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LocationService } from '../services/locationService';
import { AlertService } from '../services/alertService';

const THEME = {
  primary: '#E63946',
  primaryDark: '#B71C1C',
  background: '#0F172A',
  cardBg: '#1E293B',
  border: '#334155',
  textPrimary: '#FFFFFF',
  textSecondary: '#94A3B8',
  safeGreen: '#10B981',
};

interface LocationPermissionScreenProps {
  onPermissionGranted: () => void;
  onSkip: () => void;
}

export default function LocationPermissionScreen({
  onPermissionGranted,
  onSkip,
}: LocationPermissionScreenProps) {
  const [requesting, setRequesting] = useState<boolean>(false);

  const handleAllowLocation = async () => {
    setRequesting(true);
    try {
      AlertService.triggerHaptic();
      await LocationService.requestPermission();
      onPermissionGranted();
    } catch {
      onPermissionGranted();
    } finally {
      setRequesting(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={THEME.background} />
      <View style={styles.content}>
        {/* Glowing GPS Radar Icon */}
        <View style={styles.iconRadarOuter}>
          <View style={styles.iconRadarMid}>
            <View style={styles.iconRadarInner}>
              <Text style={styles.pinEmoji}>📍</Text>
            </View>
          </View>
        </View>

        {/* Title & Headline */}
        <Text style={styles.title}>Enable Location Access</Text>
        <Text style={styles.subtitle}>
          Guardian uses your location to discover real nearby hospitals, local clinics, police chowkis, and share live GPS tracking with your guardians during SOS.
        </Text>

        {/* Value Proposition Cards */}
        <View style={styles.benefitList}>
          <View style={styles.benefitCard}>
            <Text style={styles.benefitIcon}>🏥</Text>
            <View style={styles.benefitCol}>
              <Text style={styles.benefitTitle}>Real Google Maps Safe Havens</Text>
              <Text style={styles.benefitSub}>
                Find verified emergency hospitals and clinics closest to where you are right now.
              </Text>
            </View>
          </View>

          <View style={styles.benefitCard}>
            <Text style={styles.benefitIcon}>🚨</Text>
            <View style={styles.benefitCol}>
              <Text style={styles.benefitTitle}>Live SOS Dispatch to Guardians</Text>
              <Text style={styles.benefitSub}>
                Send your exact live GPS coordinates to parents/spouse with 1 tap in danger.
              </Text>
            </View>
          </View>

          <View style={styles.benefitCard}>
            <Text style={styles.benefitIcon}>🧭</Text>
            <View style={styles.benefitCol}>
              <Text style={styles.benefitTitle}>Turn-by-Turn Route Navigation</Text>
              <Text style={styles.benefitSub}>
                Launch direct Google Maps driving navigation to the nearest safe shelter.
              </Text>
            </View>
          </View>
        </View>

        {/* Buttons */}
        <View style={styles.actionSection}>
          <TouchableOpacity
            style={styles.allowButton}
            onPress={handleAllowLocation}
            disabled={requesting}
            activeOpacity={0.85}
          >
            {requesting ? (
              <ActivityIndicator color="#FFFFFF" size="small" />
            ) : (
              <Text style={styles.allowButtonText}>Allow Location Access ➔</Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity style={styles.skipButton} onPress={onSkip} activeOpacity={0.7}>
            <Text style={styles.skipButtonText}>Not Now / Maybe Later</Text>
          </TouchableOpacity>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: THEME.background,
  },
  content: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 36,
    paddingBottom: 32,
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  iconRadarOuter: {
    width: 110,
    height: 110,
    borderRadius: 55,
    backgroundColor: 'rgba(230, 57, 70, 0.08)',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 12,
  },
  iconRadarMid: {
    width: 86,
    height: 86,
    borderRadius: 43,
    backgroundColor: 'rgba(230, 57, 70, 0.16)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconRadarInner: {
    width: 62,
    height: 62,
    borderRadius: 31,
    backgroundColor: THEME.primary,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: THEME.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 10,
    elevation: 6,
  },
  pinEmoji: {
    fontSize: 30,
  },
  title: {
    fontSize: 24,
    fontWeight: '800',
    color: THEME.textPrimary,
    textAlign: 'center',
    marginTop: 18,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 13,
    color: THEME.textSecondary,
    textAlign: 'center',
    lineHeight: 19,
    paddingHorizontal: 12,
    marginBottom: 20,
  },
  benefitList: {
    width: '100%',
    gap: 12,
  },
  benefitCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: THEME.cardBg,
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: THEME.border,
  },
  benefitIcon: {
    fontSize: 24,
    marginRight: 14,
  },
  benefitCol: {
    flex: 1,
  },
  benefitTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#FFFFFF',
    marginBottom: 2,
  },
  benefitSub: {
    fontSize: 12,
    color: THEME.textSecondary,
    lineHeight: 16,
  },
  actionSection: {
    width: '100%',
    marginTop: 20,
  },
  allowButton: {
    backgroundColor: THEME.primary,
    borderRadius: 14,
    paddingVertical: 15,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
    shadowColor: THEME.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 4,
  },
  allowButtonText: {
    fontSize: 15,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  skipButton: {
    paddingVertical: 10,
    alignItems: 'center',
  },
  skipButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: THEME.textSecondary,
  },
});

