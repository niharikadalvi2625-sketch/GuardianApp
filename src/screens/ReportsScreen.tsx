import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Modal,
  Alert,
  Linking,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { SafetyReport, HazardReportType, LocationCoords } from '../types';
import { StorageService } from '../services/storageService';
import { LocationService } from '../services/locationService';

const REPORTS_CACHE_KEY = '@guardian_hazard_reports';

const THEME = {
  primary: '#E63946',
  primaryDark: '#B71C1C',
  secondary: '#1D3557',
  background: '#F8F9FA',
  cardBg: '#FFFFFF',
  textPrimary: '#1E293B',
  textSecondary: '#64748B',
  textLight: '#94A3B8',
  danger: '#EF4444',
  dangerBg: '#FEE2E2',
  hazard: '#F59E0B',
  hazardBg: '#FEF3C7',
  blocked: '#6366F1',
  blockedBg: '#EEF2FF',
  safe: '#10B981',
  safeBg: '#D1FAE5',
  border: '#E2E8F0',
};

const INITIAL_REPORTS: SafetyReport[] = [
  {
    id: 'rep-1',
    title: 'Street Light Failure & Aggressive Strangers',
    type: 'danger',
    description: 'Multiple streetlights out on 5th Ave between Pine and Market. Low visibility area.',
    latitude: 37.7812,
    longitude: -122.4111,
    timestamp: new Date(Date.now() - 15 * 60000).toISOString(),
    isSynced: true,
  },
  {
    id: 'rep-2',
    title: 'Flooded Underpass / Fallen Tree',
    type: 'blocked_road',
    description: 'Underpass on Westbound Highway 101 connector is submerged. Detour via Mission St.',
    latitude: 37.7725,
    longitude: -122.4208,
    timestamp: new Date(Date.now() - 45 * 60000).toISOString(),
    isSynced: true,
  },
  {
    id: 'rep-3',
    title: 'Slippery Fuel Spill Near Intersection',
    type: 'hazard',
    description: 'Commercial truck spilled diesel near 8th & Harrison. Emergency crews en route.',
    latitude: 37.7768,
    longitude: -122.4085,
    timestamp: new Date(Date.now() - 110 * 60000).toISOString(),
    isSynced: true,
  },
  {
    id: 'rep-4',
    title: 'Emergency Community Warming & Medical Aid Post',
    type: 'safe_haven',
    description: 'Volunteer nurses and free water/first-aid supplies available at Community Hall.',
    latitude: 37.7854,
    longitude: -122.4172,
    timestamp: new Date(Date.now() - 180 * 60000).toISOString(),
    isSynced: true,
  },
];

const CATEGORIES: { id: HazardReportType | 'all'; label: string; icon: string }[] = [
  { id: 'all', label: 'All Hazards', icon: '🌐' },
  { id: 'danger', label: 'Danger Alerts', icon: '🚨' },
  { id: 'hazard', label: 'Hazards', icon: '⚠️' },
  { id: 'blocked_road', label: 'Blocked Roads', icon: '🚧' },
  { id: 'safe_haven', label: 'Safe Havens', icon: '🛡️' },
];

export default function ReportsScreen() {
  const [reports, setReports] = useState<SafetyReport[]>([]);
  const [selectedFilter, setSelectedFilter] = useState<HazardReportType | 'all'>('all');
  const [modalVisible, setModalVisible] = useState<boolean>(false);
  const [userLocation, setUserLocation] = useState<LocationCoords | null>(null);
  const [fetchingGps, setFetchingGps] = useState<boolean>(false);

  // Form State
  const [newTitle, setNewTitle] = useState<string>('');
  const [newType, setNewType] = useState<HazardReportType>('hazard');
  const [newDesc, setNewDesc] = useState<string>('');

  useEffect(() => {
    loadReports();
    fetchCurrentCoords();
  }, []);

  const loadReports = async () => {
    try {
      const stored = await StorageService.getItem(REPORTS_CACHE_KEY);
      if (stored) {
        setReports(JSON.parse(stored));
      } else {
        await StorageService.setItem(REPORTS_CACHE_KEY, JSON.stringify(INITIAL_REPORTS));
        setReports(INITIAL_REPORTS);
      }
    } catch {
      setReports(INITIAL_REPORTS);
    }
  };

  const fetchCurrentCoords = async () => {
    setFetchingGps(true);
    try {
      const coords = await LocationService.getCurrentLocation();
      setUserLocation(coords);
    } catch {
      // Handled via defaults
    } finally {
      setFetchingGps(false);
    }
  };

  const handleCreateReport = async () => {
    if (!newTitle.trim() || !newDesc.trim()) {
      Alert.alert('Incomplete Report', 'Please enter a title and description for this incident.');
      return;
    }

    const coords = userLocation || {
      latitude: 37.7749,
      longitude: -122.4194,
    };

    const newReport: SafetyReport = {
      id: `rep-${Date.now()}`,
      title: newTitle.trim(),
      type: newType,
      description: newDesc.trim(),
      latitude: coords.latitude,
      longitude: coords.longitude,
      timestamp: new Date().toISOString(),
      isSynced: false,
    };

    const updated = [newReport, ...reports];
    await StorageService.setItem(REPORTS_CACHE_KEY, JSON.stringify(updated));
    setReports(updated);

    // Reset Form
    setNewTitle('');
    setNewDesc('');
    setNewType('hazard');
    setModalVisible(false);

    Alert.alert(
      'Hazard Reported',
      'Your incident report has been submitted to the community safety feed and stored locally.'
    );
  };

  const openMap = (lat: number, lon: number) => {
    const url = `https://maps.google.com/?q=${lat},${lon}`;
    Linking.openURL(url);
  };

  const filteredReports =
    selectedFilter === 'all'
      ? reports
      : reports.filter((r) => r.type === selectedFilter);

  const getCategoryDetails = (type: HazardReportType) => {
    switch (type) {
      case 'danger':
        return { label: 'Danger Zone', bg: THEME.dangerBg, text: THEME.danger, icon: '🚨' };
      case 'hazard':
        return { label: 'Hazard', bg: THEME.hazardBg, text: '#B45309', icon: '⚠️' };
      case 'blocked_road':
        return { label: 'Blocked Road', bg: THEME.blockedBg, text: THEME.blocked, icon: '🚧' };
      case 'safe_haven':
        return { label: 'Safe Haven', bg: THEME.safeBg, text: '#065F46', icon: '🛡️' };
    }
  };

  const formatTimeAgo = (isoDate: string) => {
    const diffMin = Math.round((Date.now() - new Date(isoDate).getTime()) / 60000);
    if (diffMin < 1) return 'Just now';
    if (diffMin < 60) return `${diffMin}m ago`;
    const diffHours = Math.round(diffMin / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    return `${Math.round(diffHours / 24)}d ago`;
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Top Header */}
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <View>
            <Text style={styles.headerTitle}>Live Hazard Feed</Text>
            <Text style={styles.headerSubtitle}>
              Crowd-sourced neighborhood hazard & incident alerts
            </Text>
          </View>
          <TouchableOpacity
            style={styles.newReportBtn}
            onPress={() => setModalVisible(true)}
            activeOpacity={0.8}
          >
            <Text style={styles.newReportText}>+ Report</Text>
          </TouchableOpacity>
        </View>

        {/* Filter Chips Horizontal Scroll */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filterScroll}
        >
          {CATEGORIES.map((cat) => {
            const isActive = selectedFilter === cat.id;
            return (
              <TouchableOpacity
                key={cat.id}
                style={[styles.filterChip, isActive && styles.filterChipActive]}
                onPress={() => setSelectedFilter(cat.id)}
                activeOpacity={0.7}
              >
                <Text style={styles.filterIcon}>{cat.icon}</Text>
                <Text
                  style={[styles.filterLabel, isActive && styles.filterLabelActive]}
                >
                  {cat.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {/* Reports List */}
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.feedInfoBar}>
          <Text style={styles.feedCountText}>
            Showing {filteredReports.length} incident reports
          </Text>
          <TouchableOpacity onPress={loadReports} style={styles.refreshBtn}>
            <Text style={styles.refreshText}>🔄 Sync</Text>
          </TouchableOpacity>
        </View>

        {filteredReports.map((report) => {
          const cat = getCategoryDetails(report.type);
          return (
            <View key={report.id} style={styles.reportCard}>
              <View style={styles.cardHeaderRow}>
                <View style={[styles.badge, { backgroundColor: cat.bg }]}>
                  <Text style={styles.badgeIcon}>{cat.icon}</Text>
                  <Text style={[styles.badgeText, { color: cat.text }]}>
                    {cat.label}
                  </Text>
                </View>
                <Text style={styles.timeAgo}>{formatTimeAgo(report.timestamp)}</Text>
              </View>

              <Text style={styles.reportTitle}>{report.title}</Text>
              <Text style={styles.reportDesc}>{report.description}</Text>

              <View style={styles.cardFooter}>
                <Text style={styles.coordsText}>
                  📍 {report.latitude.toFixed(4)}, {report.longitude.toFixed(4)}
                </Text>
                <TouchableOpacity
                  style={styles.viewMapBtn}
                  onPress={() => openMap(report.latitude, report.longitude)}
                  activeOpacity={0.7}
                >
                  <Text style={styles.viewMapText}>View on Map ➔</Text>
                </TouchableOpacity>
              </View>
            </View>
          );
        })}
      </ScrollView>

      {/* Report Incident Modal */}
      <Modal
        visible={modalVisible}
        animationType="slide"
        transparent
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Report Safety Hazard</Text>
              <TouchableOpacity onPress={() => setModalVisible(false)}>
                <Text style={styles.modalClose}>✕</Text>
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              {/* Category Selector */}
              <Text style={styles.inputLabel}>Incident Category</Text>
              <View style={styles.categoryPicker}>
                {(['danger', 'hazard', 'blocked_road', 'safe_haven'] as HazardReportType[]).map(
                  (type) => {
                    const c = getCategoryDetails(type);
                    const isPicked = newType === type;
                    return (
                      <TouchableOpacity
                        key={type}
                        style={[
                          styles.categoryChoice,
                          isPicked && styles.categoryChoicePicked,
                        ]}
                        onPress={() => setNewType(type)}
                      >
                        <Text style={styles.choiceIcon}>{c.icon}</Text>
                        <Text
                          style={[
                            styles.choiceLabel,
                            isPicked && styles.choiceLabelPicked,
                          ]}
                        >
                          {c.label}
                        </Text>
                      </TouchableOpacity>
                    );
                  }
                )}
              </View>

              <Text style={styles.inputLabel}>Headline / Summary</Text>
              <TextInput
                style={styles.input}
                placeholder="e.g. Flooded roadway near junction"
                value={newTitle}
                onChangeText={setNewTitle}
              />

              <Text style={styles.inputLabel}>Detailed Description</Text>
              <TextInput
                style={[styles.input, styles.textArea]}
                placeholder="Provide helpful context for others navigating this area..."
                multiline
                numberOfLines={3}
                value={newDesc}
                onChangeText={setNewDesc}
              />

              {/* GPS Stamp */}
              <View style={styles.gpsStampBox}>
                <Text style={styles.gpsLabel}>INCIDENT LOCATION</Text>
                <Text style={styles.gpsValue}>
                  {userLocation
                    ? `${userLocation.latitude.toFixed(4)}, ${userLocation.longitude.toFixed(4)} (Current GPS)`
                    : 'Acquiring GPS coordinates...'}
                </Text>
                {fetchingGps && <ActivityIndicator size="small" color={THEME.secondary} />}
              </View>

              <TouchableOpacity
                style={styles.submitReportBtn}
                onPress={handleCreateReport}
                activeOpacity={0.8}
              >
                <Text style={styles.submitReportText}>Post Community Alert</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: THEME.background,
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 8,
    backgroundColor: THEME.cardBg,
    borderBottomWidth: 1,
    borderBottomColor: THEME.border,
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: THEME.textPrimary,
  },
  headerSubtitle: {
    fontSize: 12,
    color: THEME.textSecondary,
    marginTop: 2,
  },
  newReportBtn: {
    backgroundColor: THEME.primary,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 8,
  },
  newReportText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  filterScroll: {
    paddingBottom: 6,
    gap: 8,
  },
  filterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F1F5F9',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 20,
  },
  filterChipActive: {
    backgroundColor: THEME.secondary,
  },
  filterIcon: {
    fontSize: 13,
    marginRight: 6,
  },
  filterLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: THEME.textSecondary,
  },
  filterLabelActive: {
    color: '#FFFFFF',
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 36,
  },
  feedInfoBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  feedCountText: {
    fontSize: 12,
    fontWeight: '700',
    color: THEME.textSecondary,
  },
  refreshBtn: {
    padding: 4,
  },
  refreshText: {
    fontSize: 11,
    color: THEME.secondary,
    fontWeight: '700',
  },
  reportCard: {
    backgroundColor: THEME.cardBg,
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: THEME.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.03,
    shadowRadius: 6,
    elevation: 1,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderRadius: 6,
  },
  badgeIcon: {
    fontSize: 12,
    marginRight: 4,
  },
  badgeText: {
    fontSize: 10,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  timeAgo: {
    fontSize: 11,
    color: THEME.textLight,
    fontWeight: '600',
  },
  reportTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: THEME.textPrimary,
    marginBottom: 6,
  },
  reportDesc: {
    fontSize: 13,
    color: THEME.textSecondary,
    lineHeight: 19,
    marginBottom: 12,
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: '#F8FAFC',
    paddingTop: 10,
  },
  coordsText: {
    fontSize: 11,
    fontWeight: '600',
    color: THEME.textLight,
  },
  viewMapBtn: {
    paddingVertical: 2,
  },
  viewMapText: {
    fontSize: 12,
    fontWeight: '700',
    color: THEME.secondary,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.65)',
    justifyContent: 'flex-end',
  },
  modalCard: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    maxHeight: '90%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: THEME.textPrimary,
  },
  modalClose: {
    fontSize: 18,
    color: THEME.textLight,
    padding: 4,
  },
  inputLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: THEME.textSecondary,
    marginBottom: 6,
    marginTop: 10,
    textTransform: 'uppercase',
  },
  categoryPicker: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 8,
  },
  categoryChoice: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 10,
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: THEME.border,
  },
  categoryChoicePicked: {
    backgroundColor: THEME.secondary,
    borderColor: THEME.secondary,
  },
  choiceIcon: {
    fontSize: 13,
    marginRight: 6,
  },
  choiceLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: THEME.textSecondary,
  },
  choiceLabelPicked: {
    color: '#FFFFFF',
  },
  input: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: THEME.border,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 13,
    color: THEME.textPrimary,
  },
  textArea: {
    minHeight: 70,
    textAlignVertical: 'top',
  },
  gpsStampBox: {
    backgroundColor: '#F1F5F9',
    borderRadius: 10,
    padding: 12,
    marginTop: 14,
    marginBottom: 16,
  },
  gpsLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: THEME.textSecondary,
    marginBottom: 2,
  },
  gpsValue: {
    fontSize: 12,
    fontWeight: '700',
    color: THEME.textPrimary,
  },
  submitReportBtn: {
    backgroundColor: THEME.primary,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 12,
  },
  submitReportText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
  },
});
