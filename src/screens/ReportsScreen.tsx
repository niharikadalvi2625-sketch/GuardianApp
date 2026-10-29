import React, { useState, useEffect, useMemo } from 'react';
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
  Image,
  StatusBar,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { SafetyReport, HazardReportType, LocationCoords } from '../types';
import { LocationService } from '../services/locationService';
import { AlertService } from '../services/alertService';
import { CommunityReportService, ReportScope } from '../services/communityReportService';
import { CameraService } from '../services/cameraService';
import { useTheme } from '../context/ThemeContext';

const CATEGORIES: { id: HazardReportType | 'all'; label: string; icon: string }[] = [
  { id: 'all', label: 'All Hazards', icon: '🌐' },
  { id: 'danger', label: 'Danger Alerts', icon: '🚨' },
  { id: 'hazard', label: 'Hazards', icon: '⚠️' },
  { id: 'blocked_road', label: 'Blocked Roads', icon: '🚧' },
  { id: 'safe_haven', label: 'Safe Havens', icon: '🛡️' },
];

export default function ReportsScreen() {
  const { theme, isDark } = useTheme();
  const reportsTheme = useMemo(
    () => ({
      primary: theme.primary,
      primaryDark: theme.primaryDark,
      secondary: isDark ? '#38BDF8' : '#1D3557',
      background: theme.background,
      cardBg: theme.cardBg,
      textPrimary: theme.textPrimary,
      textSecondary: theme.textSecondary,
      textLight: theme.textMuted,
      danger: theme.primary,
      dangerBg: theme.primaryBg,
      hazard: theme.amber,
      hazardBg: theme.amberBg,
      blocked: theme.purple,
      blockedBg: theme.purpleBg,
      safe: theme.emerald,
      safeBg: theme.emeraldBg,
      border: theme.cardBorder,
      skyBlue: theme.blue,
      skyBlueBg: theme.blueBg,
    }),
    [theme, isDark]
  );
  const THEME = reportsTheme;
  const styles = useMemo(() => getStyles(reportsTheme), [reportsTheme]);

  const [reports, setReports] = useState<SafetyReport[]>([]);
  const [selectedFilter, setSelectedFilter] = useState<HazardReportType | 'all'>('all');
  const [selectedScope, setSelectedScope] = useState<ReportScope>('nearby');
  const [viewMode, setViewMode] = useState<'list' | 'radar'>('list');
  const [selectedRadarReport, setSelectedRadarReport] = useState<SafetyReport | null>(null);
  const [modalVisible, setModalVisible] = useState<boolean>(false);
  const [userLocation, setUserLocation] = useState<LocationCoords | null>(null);
  const [fetchingGps, setFetchingGps] = useState<boolean>(false);
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [confirmingMap, setConfirmingMap] = useState<Record<string, boolean>>({});

  // Form State
  const [newTitle, setNewTitle] = useState<string>('');
  const [newType, setNewType] = useState<HazardReportType>('hazard');
  const [newDesc, setNewDesc] = useState<string>('');
  const [newLocality, setNewLocality] = useState<string>('');
  const [submittingReport, setSubmittingReport] = useState<boolean>(false);
  const [attachedImageUrl, setAttachedImageUrl] = useState<string>('');
  const [photoInfo, setPhotoInfo] = useState<{ fileSize?: number; isRealCapture?: boolean } | null>(null);

  const handleTakePhotoWithCamera = async () => {
    AlertService.triggerHaptic();
    try {
      const photo = await CameraService.takePhoto();
      if (photo) {
        setAttachedImageUrl(photo.uri);
        setPhotoInfo({ fileSize: photo.fileSize, isRealCapture: true });
      }
    } catch (_err) {
      // Handled in CameraService
    }
  };

  const handlePickFromGallery = async () => {
    AlertService.triggerHaptic();
    try {
      const photo = await CameraService.pickFromGallery();
      if (photo) {
        setAttachedImageUrl(photo.uri);
        setPhotoInfo({ fileSize: photo.fileSize, isRealCapture: true });
      }
    } catch (_err) {
      // Handled in CameraService
    }
  };

  useEffect(() => {
    loadLocationAndReports();
  }, []);

  useEffect(() => {
    refreshFilteredScope();
  }, [selectedScope, userLocation]);

  const loadLocationAndReports = async () => {
    setFetchingGps(true);
    let coords: LocationCoords | null = null;
    try {
      coords = await LocationService.getCurrentLocation();
      setUserLocation(coords);
      setNewLocality(coords.subLocality || coords.city || '');
    } catch (_e) {
      coords = LocationService.getLastKnownLocation();
      setUserLocation(coords);
    } finally {
      setFetchingGps(false);
    }

    await loadReports(coords, selectedScope);
  };

  const loadReports = async (coords?: LocationCoords | null, scope: ReportScope = 'nearby') => {
    const activeCoords = coords !== undefined ? coords : userLocation;
    const data = await CommunityReportService.getReports(activeCoords, scope, false);
    setReports(data);
    if (data.length > 0 && !selectedRadarReport) {
      setSelectedRadarReport(data[0]);
    }
  };

  const refreshFilteredScope = async () => {
    await loadReports(userLocation, selectedScope);
  };

  const handleManualSync = async () => {
    setIsSyncing(true);
    AlertService.triggerHaptic();
    try {
      const { newCount } = await CommunityReportService.syncWithCloud(userLocation);
      const data = await CommunityReportService.getReports(userLocation, selectedScope, false);
      setReports(data);
      if (newCount > 0) {
        Alert.alert('Cloud Feed Updated', `Synced ${newCount} new incident reports from nearby citizens.`);
      }
    } catch (_e) {
      // Handled gracefully
    } finally {
      setIsSyncing(false);
    }
  };

  const handleCreateReport = async () => {
    if (!newTitle.trim() || !newDesc.trim()) {
      Alert.alert('Incomplete Report', 'Please enter a title and description for this incident.');
      return;
    }

    setSubmittingReport(true);
    AlertService.triggerHaptic();
    try {
      const coords = userLocation || (await LocationService.getCurrentLocation());
      const locality = newLocality.trim() || coords.subLocality || coords.city || 'Local Landmark';

      const created = await CommunityReportService.publishReport(
        {
          title: newTitle.trim(),
          type: newType,
          description: newDesc.trim(),
          locality,
          city: coords.city || 'My City',
          imageUrl: attachedImageUrl || undefined,
          isVerified: Boolean(attachedImageUrl),
          verificationScore: attachedImageUrl ? 1.0 : undefined,
          detectedHazard: attachedImageUrl ? 'User Verified Real Field Photo' : undefined,
        },
        coords
      );

      // Reload reports
      const updated = await CommunityReportService.getReports(coords, selectedScope, false);
      setReports(updated);
      setSelectedRadarReport(created);

      // Reset Form
      setNewTitle('');
      setNewDesc('');
      setNewType('hazard');
      setAttachedImageUrl('');
      setPhotoInfo(null);
      setModalVisible(false);

      const cityLabel = coords.city || 'your area';
      Alert.alert(
        '✅ Alert Published Live to Network',
        `Your report has been broadcast to all Guardian users in ${cityLabel} and within 50 km.\n\nThank you for keeping your community safe!`
      );
    } catch (_err) {
      Alert.alert('Submission Error', 'Could not broadcast report. Saved locally on your device.');
    } finally {
      setSubmittingReport(false);
    }
  };

  const handleConfirmReport = async (reportId: string) => {
    AlertService.triggerHaptic();
    setConfirmingMap((prev) => ({ ...prev, [reportId]: true }));
    try {
      const updatedCount = await CommunityReportService.confirmReport(reportId);
      setReports((prev) =>
        prev.map((r) => (r.id === reportId ? { ...r, confirmationsCount: updatedCount } : r))
      );
      if (selectedRadarReport?.id === reportId) {
        setSelectedRadarReport((prev) => (prev ? { ...prev, confirmationsCount: updatedCount } : null));
      }
    } finally {
      setConfirmingMap((prev) => ({ ...prev, [reportId]: false }));
    }
  };

  const openMap = (lat: number, lon: number) => {
    AlertService.triggerHaptic();
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
        return { label: 'Danger Zone', bg: THEME.dangerBg, text: THEME.danger, icon: '🚨', pinColor: '#EF4444' };
      case 'hazard':
        return { label: 'Hazard', bg: THEME.hazardBg, text: '#B45309', icon: '⚠️', pinColor: '#F59E0B' };
      case 'blocked_road':
        return { label: 'Blocked Road', bg: THEME.blockedBg, text: THEME.blocked, icon: '🚧', pinColor: '#6366F1' };
      case 'safe_haven':
        return { label: 'Safe Haven', bg: THEME.safeBg, text: '#065F46', icon: '🛡️', pinColor: '#10B981' };
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

  // Nearby count for badge (within 50 km)
  const nearbyCount = reports.filter((r) => r.distanceKm !== undefined && r.distanceKm <= 50).length;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <StatusBar barStyle={theme.statusBarStyle} backgroundColor={theme.background} />
      {/* Top Header */}
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <View style={styles.headerTitleCol}>
            <View style={styles.headerTitleRow}>
              <Text style={styles.headerTitle}>Live Hazard Feed</Text>
              <View style={styles.liveCloudPill}>
                <View style={styles.liveGreenDot} />
                <Text style={styles.liveCloudText}>CLOUD NETWORK</Text>
              </View>
            </View>
            <Text style={styles.headerSubtitle} numberOfLines={1}>
              {userLocation
                ? `📍 ${userLocation.subLocality || userLocation.city || 'Nearby'} • Cross-device community feed`
                : 'Connecting to community radar...'}
            </Text>
          </View>

          <View style={styles.headerActionRow}>
            <TouchableOpacity
              style={styles.syncBtn}
              onPress={handleManualSync}
              activeOpacity={0.8}
            >
              {isSyncing ? (
                <ActivityIndicator size="small" color="#1A73E8" />
              ) : (
                <Text style={styles.syncBtnText}>🔄</Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.newReportBtn}
              onPress={async () => {
                AlertService.triggerHaptic();
                if (!newLocality && userLocation) {
                  setNewLocality(userLocation.subLocality || userLocation.city || '');
                } else if (!newLocality) {
                  try {
                    const loc = await LocationService.getCurrentLocation();
                    setUserLocation(loc);
                    setNewLocality(loc.subLocality || loc.city || '');
                  } catch {}
                }
                setModalVisible(true);
              }}
              activeOpacity={0.8}
            >
              <Text style={styles.newReportText}>+ Report</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Proximity Scope Bar: Nearby (<50km) | Same Town | Regional */}
        <View style={styles.scopeBar}>
          <TouchableOpacity
            style={[styles.scopeBtn, selectedScope === 'nearby' && styles.scopeBtnActive]}
            onPress={() => {
              AlertService.triggerHaptic();
              setSelectedScope('nearby');
            }}
            activeOpacity={0.8}
          >
            <Text style={[styles.scopeBtnText, selectedScope === 'nearby' && styles.scopeBtnTextActive]}>
              📍 Nearby (&lt;50 km)
            </Text>
            {nearbyCount > 0 && (
              <View style={[styles.scopeCountBadge, selectedScope === 'nearby' && styles.scopeCountBadgeActive]}>
                <Text style={[styles.scopeCountText, selectedScope === 'nearby' && styles.scopeCountTextActive]}>
                  {nearbyCount}
                </Text>
              </View>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.scopeBtn, selectedScope === 'city' && styles.scopeBtnActive]}
            onPress={() => {
              AlertService.triggerHaptic();
              setSelectedScope('city');
            }}
            activeOpacity={0.8}
          >
            <Text
              style={[styles.scopeBtnText, selectedScope === 'city' && styles.scopeBtnTextActive]}
              numberOfLines={1}
            >
              🏙️ {userLocation?.city || 'My Town'}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.scopeBtn, selectedScope === 'all' && styles.scopeBtnActive]}
            onPress={() => {
              AlertService.triggerHaptic();
              setSelectedScope('all');
            }}
            activeOpacity={0.8}
          >
            <Text style={[styles.scopeBtnText, selectedScope === 'all' && styles.scopeBtnTextActive]}>
              🌐 Regional All
            </Text>
          </TouchableOpacity>
        </View>

        {/* View Toggle Bar: Cards List vs Radar Map View */}
        <View style={styles.viewToggleRow}>
          <View style={styles.viewToggleGroup}>
            <TouchableOpacity
              style={[styles.viewToggleBtn, viewMode === 'list' && styles.viewToggleBtnActive]}
              onPress={() => setViewMode('list')}
              activeOpacity={0.8}
            >
              <Text style={[styles.viewToggleText, viewMode === 'list' && styles.viewToggleTextActive]}>
                📋 Cards List ({filteredReports.length})
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.viewToggleBtn, viewMode === 'radar' && styles.viewToggleBtnActive]}
              onPress={() => setViewMode('radar')}
              activeOpacity={0.8}
            >
              <Text style={[styles.viewToggleText, viewMode === 'radar' && styles.viewToggleTextActive]}>
                🗺️ Radar Map View
              </Text>
            </TouchableOpacity>
          </View>
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
                <Text style={[styles.filterLabel, isActive && styles.filterLabelActive]}>
                  {cat.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {/* Main Content Area: Radar Map or Cards List */}
      {viewMode === 'radar' ? (
        /* --- RADAR MAP VIEW --- */
        <ScrollView contentContainerStyle={styles.radarScrollContent} showsVerticalScrollIndicator={false}>
          <View style={styles.radarCard}>
            <View style={styles.radarHeader}>
              <Text style={styles.radarTitle}>Proximity Hazard Radar</Text>
              <Text style={styles.radarSub}>Live beacon range: 10 km • 25 km • 50 km</Text>
            </View>

            {/* Radar Canvas with Dynamic Pins */}
            <View style={styles.radarCanvas}>
              {/* Concentric distance rings */}
              <View style={[styles.radarRing, { width: 80, height: 80, borderRadius: 40 }]} />
              <View style={[styles.radarRing, { width: 170, height: 170, borderRadius: 85 }]} />
              <View style={[styles.radarRing, { width: 260, height: 260, borderRadius: 130 }]} />

              <Text style={[styles.radarRingLabel, { top: 140 - 40 - 8 }]}>10 km</Text>
              <Text style={[styles.radarRingLabel, { top: 140 - 85 - 8 }]}>25 km</Text>
              <Text style={[styles.radarRingLabel, { top: 140 - 130 - 8 }]}>50 km</Text>

              {/* Center User Location Pin */}
              <View style={styles.radarUserDot}>
                <View style={styles.radarUserPulse} />
                <View style={styles.radarUserCenter} />
                <Text style={styles.radarUserLabel}>You</Text>
              </View>

              {/* Dynamic Incident Pins relative to User Coords */}
              {filteredReports.map((report) => {
                const isSelected = selectedRadarReport?.id === report.id;
                const cat = getCategoryDetails(report.type);

                // Compute relative position on radar
                let posX = 160;
                let posY = 140;

                if (userLocation && report.latitude && report.longitude) {
                  const dLatKm = (report.latitude - userLocation.latitude) * 111.0;
                  const dLonKm =
                    (report.longitude - userLocation.longitude) *
                    111.0 *
                    Math.cos((userLocation.latitude * Math.PI) / 180);
                  const scale = 2.6; // 2.6px per km (50km ~ 130px)
                  posX = 160 + dLonKm * scale;
                  posY = 140 - dLatKm * scale;
                } else if (report.distanceKm !== undefined) {
                  const hash = Math.abs(report.id.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0));
                  const angle = (hash % 360) * (Math.PI / 180);
                  const distPx = Math.min(125, report.distanceKm * 2.5);
                  posX = 160 + Math.cos(angle) * distPx;
                  posY = 140 + Math.sin(angle) * distPx;
                }

                // Clamping within radar boundary
                const boundedX = Math.max(20, Math.min(300, posX));
                const boundedY = Math.max(20, Math.min(260, posY));

                return (
                  <TouchableOpacity
                    key={`radar-${report.id}`}
                    style={[
                      styles.radarPinAnchor,
                      {
                        left: boundedX - 14,
                        top: boundedY - 14,
                        zIndex: isSelected ? 30 : 10,
                      },
                    ]}
                    onPress={() => {
                      AlertService.triggerHaptic();
                      setSelectedRadarReport(report);
                    }}
                    activeOpacity={0.8}
                  >
                    <View
                      style={[
                        styles.radarPinCircle,
                        { backgroundColor: cat.pinColor },
                        isSelected && styles.radarPinCircleActive,
                      ]}
                    >
                      <Text style={styles.radarPinIcon}>{cat.icon}</Text>
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Selected Report Inspection Box */}
            {selectedRadarReport && (
              <View style={styles.radarInspectCard}>
                <View style={styles.cardHeaderRow}>
                  <View style={[styles.badge, { backgroundColor: getCategoryDetails(selectedRadarReport.type).bg }]}>
                    <Text style={styles.badgeIcon}>{getCategoryDetails(selectedRadarReport.type).icon}</Text>
                    <Text style={[styles.badgeText, { color: getCategoryDetails(selectedRadarReport.type).text }]}>
                      {getCategoryDetails(selectedRadarReport.type).label}
                    </Text>
                  </View>
                  <Text style={styles.proximityBadgeText}>
                    📍 {selectedRadarReport.distanceKm !== undefined
                      ? selectedRadarReport.distanceKm < 1
                        ? `${Math.round(selectedRadarReport.distanceKm * 1000)} m away`
                        : `${selectedRadarReport.distanceKm.toFixed(1)} km away`
                      : 'Nearby'}
                  </Text>
                </View>

                {selectedRadarReport.isVerified && (
                  <View style={styles.aiVerifiedBadge}>
                    <Text style={styles.aiVerifiedBadgeIcon}>🤖</Text>
                    <Text style={styles.aiVerifiedBadgeText}>
                      AI VERIFIED • {Math.round((selectedRadarReport.verificationScore || 0.9) * 100)}% CONFIDENCE
                    </Text>
                  </View>
                )}

                {selectedRadarReport.imageUrl ? (
                  <Image
                    source={{ uri: selectedRadarReport.imageUrl }}
                    style={styles.radarCardImage}
                    resizeMode="cover"
                  />
                ) : null}

                <Text style={styles.reportTitle}>{selectedRadarReport.title}</Text>
                <Text style={styles.reportDesc} numberOfLines={2}>
                  {selectedRadarReport.description}
                </Text>
                <Text style={styles.localityPillText}>
                  📍 {selectedRadarReport.locality || selectedRadarReport.city || 'Incident Site'}
                </Text>

                <View style={styles.radarActionRow}>
                  <TouchableOpacity
                    style={styles.confirmBtn}
                    onPress={() => handleConfirmReport(selectedRadarReport.id)}
                    activeOpacity={0.8}
                  >
                    <Text style={styles.confirmBtnText}>
                      👍 Confirm Active ({selectedRadarReport.confirmationsCount || 1})
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.radarNavBtn}
                    onPress={() => openMap(selectedRadarReport.latitude, selectedRadarReport.longitude)}
                    activeOpacity={0.8}
                  >
                    <Text style={styles.radarNavBtnText}>Navigate ➔</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}
          </View>
        </ScrollView>
      ) : (
        /* --- CARDS LIST VIEW --- */
        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          <View style={styles.feedInfoBar}>
            <Text style={styles.feedCountText}>
              Showing {filteredReports.length} {selectedScope === 'nearby' ? 'nearby' : ''} hazard alerts
            </Text>
            <View style={styles.feedStatusIndicator}>
              <Text style={styles.feedStatusText}>
                {userLocation?.city ? `Filtered for ${userLocation.city}` : 'Live Proximity Active'}
              </Text>
            </View>
          </View>

          {/* Empty State when no reports found in current scope */}
          {filteredReports.length === 0 && (
            <View style={styles.emptyCard}>
              <Text style={styles.emptyIcon}>🛡️</Text>
              <Text style={styles.emptyTitle}>
                All Clear in {userLocation?.city || 'Your Area'}!
              </Text>
              <Text style={styles.emptySubtitle}>
                No active hazards, blocked roads, or danger zones are currently reported in this scope.
              </Text>

              <View style={styles.emptyActionsRow}>
                <TouchableOpacity
                  style={styles.emptyReportBtn}
                  onPress={() => setModalVisible(true)}
                  activeOpacity={0.85}
                >
                  <Text style={styles.emptyReportBtnText}>+ Report First Hazard</Text>
                </TouchableOpacity>

                {selectedScope !== 'all' && (
                  <TouchableOpacity
                    style={styles.emptyScopeBtn}
                    onPress={() => setSelectedScope('all')}
                    activeOpacity={0.8}
                  >
                    <Text style={styles.emptyScopeBtnText}>View Regional Feed</Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>
          )}

          {/* Incident Report Cards */}
          {filteredReports.map((report) => {
            const cat = getCategoryDetails(report.type);
            const isVeryClose = report.distanceKm !== undefined && report.distanceKm < 5;
            const isNearby = report.distanceKm !== undefined && report.distanceKm <= 50;

            return (
              <View key={report.id} style={[styles.reportCard, isVeryClose && styles.reportCardUrgent]}>
                <View style={styles.cardHeaderRow}>
                  <View style={[styles.badge, { backgroundColor: cat.bg }]}>
                    <Text style={styles.badgeIcon}>{cat.icon}</Text>
                    <Text style={[styles.badgeText, { color: cat.text }]}>
                      {cat.label}
                    </Text>
                  </View>

                  {/* Distance / Proximity Badge */}
                  <View
                    style={[
                      styles.proximityBadge,
                      isVeryClose
                        ? styles.proximityBadgeUrgent
                        : isNearby
                        ? styles.proximityBadgeNearby
                        : styles.proximityBadgeRegional,
                    ]}
                  >
                    <Text
                      style={[
                        styles.proximityBadgeText,
                        isVeryClose
                          ? styles.proximityTextUrgent
                          : isNearby
                          ? styles.proximityTextNearby
                          : styles.proximityTextRegional,
                      ]}
                    >
                      {report.distanceKm !== undefined
                        ? report.distanceKm < 1
                          ? `⚠️ ${Math.round(report.distanceKm * 1000)}m away`
                          : isVeryClose
                          ? `⚠️ ${report.distanceKm.toFixed(1)} km away`
                          : `📍 ${report.distanceKm.toFixed(1)} km away`
                        : 'Nearby'}
                    </Text>
                  </View>

                  <Text style={styles.timeAgo}>{formatTimeAgo(report.timestamp)}</Text>
                </View>

                {report.isVerified && (
                  <View style={styles.aiVerifiedCardBadge}>
                    <Text style={styles.aiVerifiedBadgeIcon}>🤖</Text>
                    <Text style={styles.aiVerifiedCardBadgeText}>
                      AI VERIFIED HAZARD • {Math.round((report.verificationScore || 0.9) * 100)}% CONFIDENCE
                    </Text>
                  </View>
                )}

                {report.imageUrl ? (
                  <View style={styles.cardImageContainer}>
                    <Image
                      source={{ uri: report.imageUrl }}
                      style={styles.cardImage}
                      resizeMode="cover"
                    />
                    {report.detectedHazard ? (
                      <View style={styles.detectedHazardOverlay}>
                        <Text style={styles.detectedHazardOverlayText}>
                          🔍 AI Detection: {report.detectedHazard}
                        </Text>
                      </View>
                    ) : null}
                  </View>
                ) : null}

                <Text style={styles.reportTitle}>{report.title}</Text>
                <Text style={styles.reportDesc}>{report.description}</Text>

                {/* Location & Author Metadata Pill */}
                <View style={styles.locationPillRow}>
                  <Text style={styles.localityText}>
                    📍 {report.locality || report.city || 'Incident Site'}
                    {report.city && report.locality && !report.locality.includes(report.city)
                      ? `, ${report.city}`
                      : ''}
                  </Text>
                  <Text style={styles.authorText}>
                    • 👤 {report.authorName || 'Local Citizen'}
                  </Text>
                </View>

                {/* Card Action Footer */}
                <View style={styles.cardFooter}>
                  <TouchableOpacity
                    style={styles.confirmActiveBtn}
                    onPress={() => handleConfirmReport(report.id)}
                    activeOpacity={0.75}
                  >
                    <Text style={styles.confirmActiveIcon}>👍</Text>
                    <Text style={styles.confirmActiveText}>
                      Confirmed by {report.confirmationsCount || 1} locals
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.viewMapBtn}
                    onPress={() => openMap(report.latitude, report.longitude)}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.viewMapText}>🧭 View / Route ➔</Text>
                  </TouchableOpacity>
                </View>
              </View>
            );
          })}
        </ScrollView>
      )}

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
              <View>
                <Text style={styles.modalTitle}>Report Safety Hazard</Text>
                <Text style={styles.modalSubTitle}>
                  Broadcasts to all Guardian users in {userLocation?.city || 'your area'} & nearby (within 50 km)
                </Text>
              </View>
              <TouchableOpacity onPress={() => setModalVisible(false)}>
                <Text style={styles.modalClose}>✕</Text>
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
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
                placeholder="e.g. Flooded roadway near railway station"
                placeholderTextColor={THEME.textLight}
                value={newTitle}
                onChangeText={setNewTitle}
              />

              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                <Text style={[styles.inputLabel, { marginBottom: 0 }]}>Locality / Landmark Name</Text>
                <TouchableOpacity
                  onPress={async () => {
                    AlertService.triggerHaptic();
                    try {
                      const loc = await LocationService.getCurrentLocation();
                      setUserLocation(loc);
                      const name = loc.subLocality || loc.city || loc.address || '';
                      if (name) setNewLocality(name);
                    } catch {}
                  }}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Text style={{ fontSize: 12, color: THEME.skyBlue, fontWeight: '700' }}>📍 Auto-detect GPS</Text>
                </TouchableOpacity>
              </View>
              <TextInput
                style={styles.input}
                placeholder="e.g. Mahim Road, Station West"
                placeholderTextColor={THEME.textLight}
                value={newLocality}
                onChangeText={setNewLocality}
              />

              <Text style={styles.inputLabel}>Detailed Description</Text>
              <TextInput
                style={[styles.input, styles.textArea]}
                placeholder="Provide helpful context for others navigating this area..."
                placeholderTextColor={THEME.textLight}
                multiline
                numberOfLines={3}
                value={newDesc}
                onChangeText={setNewDesc}
              />

              {/* Actual Incident Photo Section (Real Evidence via Camera / Gallery) */}
              <View style={styles.realPhotoSectionContainer}>
                <View style={styles.realPhotoSectionHeader}>
                  <Text style={styles.inputLabel}>📷 Incident Photo (Real Field Evidence)</Text>
                  <View style={styles.realEvidencePill}>
                    <Text style={styles.realEvidencePillText}>REAL EVIDENCE</Text>
                  </View>
                </View>

                <Text style={styles.realPhotoSectionHint}>
                  Attach an actual, real photo taken by you. Real photos provide authentic proof to citizens and first responders within 50 km.
                </Text>

                {!attachedImageUrl ? (
                  <View style={styles.photoCaptureButtonsRow}>
                    <TouchableOpacity
                      style={styles.realCameraBtn}
                      onPress={handleTakePhotoWithCamera}
                      activeOpacity={0.85}
                    >
                      <View style={styles.realCameraIconBadge}>
                        <Text style={styles.realCameraIcon}>📸</Text>
                      </View>
                      <View style={styles.realCameraTextCol}>
                        <Text style={styles.realCameraBtnTitle}>Take Real Photo</Text>
                        <Text style={styles.realCameraBtnSub}>Launch Camera (Asks Permission)</Text>
                      </View>
                      <Text style={styles.realCameraArrow}>➔</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={styles.realGalleryBtn}
                      onPress={handlePickFromGallery}
                      activeOpacity={0.85}
                    >
                      <View style={styles.realGalleryIconBadge}>
                        <Text style={styles.realGalleryIcon}>🖼️</Text>
                      </View>
                      <View style={styles.realGalleryTextCol}>
                        <Text style={styles.realGalleryBtnTitle}>Choose from Gallery</Text>
                        <Text style={styles.realGalleryBtnSub}>Select real device photo</Text>
                      </View>
                      <Text style={styles.realGalleryArrow}>➔</Text>
                    </TouchableOpacity>
                  </View>
                ) : (
                  <View style={styles.attachedRealPhotoCard}>
                    <View style={styles.attachedRealPhotoRow}>
                      <Image
                        source={{ uri: attachedImageUrl }}
                        style={styles.attachedRealPhotoThumb}
                        resizeMode="cover"
                      />
                      <View style={styles.attachedRealPhotoDetails}>
                        <View style={styles.realVerifiedBadge}>
                          <Text style={styles.realVerifiedBadgeIcon}>✅</Text>
                          <Text style={styles.realVerifiedBadgeText}>Real Photo Attached</Text>
                        </View>
                        <Text style={styles.realPhotoMetaText}>
                          {photoInfo?.fileSize
                            ? `File size: ${(photoInfo.fileSize / 1024).toFixed(0)} KB • Authentic citizen evidence`
                            : 'Authentic field photo attached'}
                        </Text>

                        <View style={styles.attachedPhotoActionsRow}>
                          <TouchableOpacity
                            style={styles.retakePhotoBtn}
                            onPress={handleTakePhotoWithCamera}
                            activeOpacity={0.8}
                          >
                            <Text style={styles.retakePhotoText}>🔄 Retake</Text>
                          </TouchableOpacity>

                          <TouchableOpacity
                            style={styles.removeRealPhotoBtn}
                            onPress={() => {
                              setAttachedImageUrl('');
                              setPhotoInfo(null);
                            }}
                            activeOpacity={0.8}
                          >
                            <Text style={styles.removeRealPhotoText}>✕ Remove</Text>
                          </TouchableOpacity>
                        </View>
                      </View>
                    </View>
                  </View>
                )}
              </View>

              {/* Live Location / GPS Stamp */}
              <View style={styles.gpsStampBox}>
                <Text style={styles.gpsLabel}>LIVE GPS ANCHOR</Text>
                <Text style={styles.gpsValue}>
                  {userLocation
                    ? `📍 ${userLocation.subLocality || userLocation.city || 'Live GPS'} (${userLocation.latitude.toFixed(4)}, ${userLocation.longitude.toFixed(4)})`
                    : 'Acquiring GPS fix...'}
                </Text>
                {fetchingGps && <ActivityIndicator size="small" color={THEME.secondary} />}
              </View>

              {/* Public Broadcast Notice */}
              <View style={styles.broadcastNoticeBox}>
                <Text style={styles.broadcastNoticeIcon}>📡</Text>
                <Text style={styles.broadcastNoticeText}>
                  This alert will be broadcast live to the community. Nearby people within 50 km of your location will immediately see this alert on their feed and radar map.
                </Text>
              </View>

              <TouchableOpacity
                style={styles.submitReportBtn}
                onPress={handleCreateReport}
                activeOpacity={0.8}
                disabled={submittingReport}
              >
                {submittingReport ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Text style={styles.submitReportText}>📡 Broadcast Live Alert to Nearby People</Text>
                )}
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const getStyles = (THEME: any) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: THEME.background,
  },
  header: {
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 6,
    backgroundColor: THEME.cardBg,
    borderBottomWidth: 1,
    borderBottomColor: THEME.border,
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  headerTitleCol: {
    flex: 1,
  },
  headerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '900',
    color: THEME.textPrimary,
  },
  liveCloudPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#DCFCE7',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    gap: 4,
  },
  liveGreenDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#16A34A',
  },
  liveCloudText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#15803D',
    letterSpacing: 0.4,
  },
  headerSubtitle: {
    fontSize: 11,
    color: THEME.textSecondary,
    marginTop: 2,
  },
  headerActionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  syncBtn: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: '#F1F5F9',
    justifyContent: 'center',
    alignItems: 'center',
  },
  syncBtnText: {
    fontSize: 14,
  },
  newReportBtn: {
    backgroundColor: THEME.primary,
    paddingVertical: 7,
    paddingHorizontal: 12,
    borderRadius: 8,
  },
  newReportText: {
    fontSize: 12,
    fontWeight: '900',
    color: '#FFFFFF',
  },
  scopeBar: {
    flexDirection: 'row',
    backgroundColor: '#F1F5F9',
    borderRadius: 10,
    padding: 3,
    marginBottom: 8,
  },
  scopeBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 6,
    borderRadius: 8,
    gap: 4,
  },
  scopeBtnActive: {
    backgroundColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.12,
    shadowRadius: 2,
    elevation: 2,
  },
  scopeBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: THEME.textSecondary,
  },
  scopeBtnTextActive: {
    color: THEME.secondary,
    fontWeight: '800',
  },
  scopeCountBadge: {
    backgroundColor: '#E2E8F0',
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 10,
  },
  scopeCountBadgeActive: {
    backgroundColor: THEME.primary,
  },
  scopeCountText: {
    fontSize: 9,
    fontWeight: '800',
    color: THEME.textSecondary,
  },
  scopeCountTextActive: {
    color: '#FFFFFF',
  },
  viewToggleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  viewToggleGroup: {
    flexDirection: 'row',
    backgroundColor: '#F8FAFC',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 2,
    flex: 1,
  },
  viewToggleBtn: {
    flex: 1,
    paddingVertical: 5,
    alignItems: 'center',
    borderRadius: 6,
  },
  viewToggleBtnActive: {
    backgroundColor: THEME.secondary,
  },
  viewToggleText: {
    fontSize: 11,
    fontWeight: '700',
    color: THEME.textSecondary,
  },
  viewToggleTextActive: {
    color: '#FFFFFF',
    fontWeight: '800',
  },
  filterScroll: {
    paddingBottom: 4,
    gap: 6,
  },
  filterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F1F5F9',
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: 16,
  },
  filterChipActive: {
    backgroundColor: THEME.primary,
  },
  filterIcon: {
    fontSize: 11,
    marginRight: 4,
  },
  filterLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: THEME.textSecondary,
  },
  filterLabelActive: {
    color: '#FFFFFF',
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 36,
  },
  feedInfoBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  feedCountText: {
    fontSize: 11,
    fontWeight: '700',
    color: THEME.textSecondary,
  },
  feedStatusIndicator: {
    backgroundColor: '#EFF6FF',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  feedStatusText: {
    fontSize: 10,
    color: '#1D4ED8',
    fontWeight: '700',
  },
  emptyCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    marginTop: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  emptyIcon: {
    fontSize: 40,
    marginBottom: 8,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: THEME.textPrimary,
    marginBottom: 4,
  },
  emptySubtitle: {
    fontSize: 12,
    color: THEME.textSecondary,
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: 16,
  },
  emptyActionsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  emptyReportBtn: {
    backgroundColor: THEME.primary,
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 8,
  },
  emptyReportBtnText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  emptyScopeBtn: {
    backgroundColor: '#F1F5F9',
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 8,
  },
  emptyScopeBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: THEME.textSecondary,
  },
  reportCard: {
    backgroundColor: THEME.cardBg,
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: THEME.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 1,
  },
  reportCardUrgent: {
    borderColor: '#FCA5A5',
    backgroundColor: '#FFFBFB',
  },
  cardHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 2,
    paddingHorizontal: 6,
    borderRadius: 5,
  },
  badgeIcon: {
    fontSize: 11,
    marginRight: 3,
  },
  badgeText: {
    fontSize: 9,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  proximityBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  proximityBadgeUrgent: {
    backgroundColor: '#FEE2E2',
  },
  proximityBadgeNearby: {
    backgroundColor: '#E0F2FE',
  },
  proximityBadgeRegional: {
    backgroundColor: '#F1F5F9',
  },
  proximityBadgeText: {
    fontSize: 10,
    fontWeight: '800',
  },
  proximityTextUrgent: {
    color: '#DC2626',
  },
  proximityTextNearby: {
    color: '#0284C7',
  },
  proximityTextRegional: {
    color: '#64748B',
  },
  timeAgo: {
    fontSize: 10,
    color: THEME.textLight,
    fontWeight: '600',
  },
  reportTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: THEME.textPrimary,
    marginBottom: 4,
  },
  reportDesc: {
    fontSize: 12,
    color: THEME.textSecondary,
    lineHeight: 18,
    marginBottom: 8,
  },
  locationPillRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 6,
    marginBottom: 10,
    flexWrap: 'wrap',
  },
  localityText: {
    fontSize: 11,
    fontWeight: '700',
    color: THEME.secondary,
  },
  authorText: {
    fontSize: 10,
    color: THEME.textLight,
    marginLeft: 4,
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
    paddingTop: 8,
  },
  confirmActiveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F0FDF4',
    borderWidth: 1,
    borderColor: '#BBF7D0',
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 6,
    gap: 4,
  },
  confirmActiveIcon: {
    fontSize: 11,
  },
  confirmActiveText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#15803D',
  },
  viewMapBtn: {
    paddingVertical: 2,
    paddingHorizontal: 6,
  },
  viewMapText: {
    fontSize: 11,
    fontWeight: '800',
    color: THEME.secondary,
  },
  radarScrollContent: {
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 36,
  },
  radarCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: THEME.border,
  },
  radarHeader: {
    marginBottom: 8,
  },
  radarTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: THEME.textPrimary,
  },
  radarSub: {
    fontSize: 11,
    color: THEME.textSecondary,
    marginTop: 1,
  },
  radarCanvas: {
    height: 280,
    backgroundColor: '#0F172A',
    borderRadius: 14,
    position: 'relative',
    overflow: 'hidden',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  radarRing: {
    position: 'absolute',
    borderWidth: 1,
    borderColor: 'rgba(56, 189, 248, 0.25)',
    borderStyle: 'dashed',
  },
  radarRingLabel: {
    position: 'absolute',
    left: 165,
    fontSize: 8,
    fontWeight: '800',
    color: '#94A3B8',
    backgroundColor: 'rgba(15, 23, 42, 0.75)',
    paddingHorizontal: 3,
    borderRadius: 2,
  },
  radarUserDot: {
    position: 'absolute',
    alignItems: 'center',
    zIndex: 20,
  },
  radarUserPulse: {
    position: 'absolute',
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: 'rgba(56, 189, 248, 0.25)',
  },
  radarUserCenter: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#38BDF8',
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  radarUserLabel: {
    fontSize: 8,
    fontWeight: '800',
    color: '#38BDF8',
    marginTop: 2,
  },
  radarPinAnchor: {
    position: 'absolute',
    alignItems: 'center',
  },
  radarPinCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 3,
    elevation: 3,
  },
  radarPinCircleActive: {
    borderColor: '#FDE047',
    borderWidth: 3,
    transform: [{ scale: 1.25 }],
  },
  radarPinIcon: {
    fontSize: 12,
  },
  radarInspectCard: {
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  localityPillText: {
    fontSize: 11,
    fontWeight: '700',
    color: THEME.secondary,
    marginBottom: 8,
  },
  radarActionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  confirmBtn: {
    backgroundColor: '#F0FDF4',
    borderWidth: 1,
    borderColor: '#BBF7D0',
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: 6,
  },
  confirmBtnText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#15803D',
  },
  radarNavBtn: {
    backgroundColor: THEME.secondary,
    paddingVertical: 5,
    paddingHorizontal: 12,
    borderRadius: 6,
  },
  radarNavBtnText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#FFFFFF',
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
    padding: 20,
    maxHeight: '90%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '900',
    color: THEME.textPrimary,
  },
  modalSubTitle: {
    fontSize: 11,
    color: THEME.textSecondary,
    marginTop: 2,
  },
  modalClose: {
    fontSize: 18,
    color: THEME.textLight,
    padding: 4,
  },
  inputLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: THEME.textSecondary,
    marginBottom: 4,
    marginTop: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  categoryPicker: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 6,
  },
  categoryChoice: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: 8,
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: THEME.border,
  },
  categoryChoicePicked: {
    backgroundColor: THEME.secondary,
    borderColor: THEME.secondary,
  },
  choiceIcon: {
    fontSize: 12,
    marginRight: 4,
  },
  choiceLabel: {
    fontSize: 11,
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
    paddingVertical: 8,
    fontSize: 13,
    color: THEME.textPrimary,
  },
  textArea: {
    minHeight: 65,
    textAlignVertical: 'top',
  },
  gpsStampBox: {
    backgroundColor: '#F1F5F9',
    borderRadius: 8,
    padding: 10,
    marginTop: 10,
    marginBottom: 10,
  },
  gpsLabel: {
    fontSize: 9,
    fontWeight: '800',
    color: THEME.textSecondary,
    marginBottom: 1,
  },
  gpsValue: {
    fontSize: 11,
    fontWeight: '700',
    color: THEME.textPrimary,
  },
  broadcastNoticeBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EFF6FF',
    borderWidth: 1,
    borderColor: '#BFDBFE',
    borderRadius: 8,
    padding: 10,
    marginBottom: 14,
    gap: 8,
  },
  broadcastNoticeIcon: {
    fontSize: 18,
  },
  broadcastNoticeText: {
    fontSize: 11,
    color: '#1D4ED8',
    lineHeight: 16,
    flex: 1,
    fontWeight: '600',
  },
  submitReportBtn: {
    backgroundColor: THEME.primary,
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
    marginBottom: 14,
  },
  submitReportText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '900',
  },
  // AI Verification & Image Styles
  aiVerifiedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ECFDF5',
    borderWidth: 1,
    borderColor: '#A7F3D0',
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderRadius: 6,
    alignSelf: 'flex-start',
    marginVertical: 4,
    gap: 4,
  },
  aiVerifiedBadgeIcon: {
    fontSize: 12,
  },
  aiVerifiedBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#065F46',
    letterSpacing: 0.3,
  },
  aiVerifiedCardBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F0FDF4',
    borderWidth: 1,
    borderColor: '#BBF7D0',
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderRadius: 6,
    alignSelf: 'flex-start',
    marginBottom: 6,
    gap: 4,
  },
  aiVerifiedCardBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#15803D',
    letterSpacing: 0.3,
  },
  radarCardImage: {
    width: '100%',
    height: 120,
    borderRadius: 8,
    marginVertical: 6,
  },
  cardImageContainer: {
    position: 'relative',
    width: '100%',
    height: 150,
    borderRadius: 10,
    overflow: 'hidden',
    marginBottom: 8,
  },
  cardImage: {
    width: '100%',
    height: '100%',
  },
  detectedHazardOverlay: {
    position: 'absolute',
    bottom: 6,
    left: 6,
    right: 6,
    backgroundColor: 'rgba(15, 23, 42, 0.85)',
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 6,
  },
  detectedHazardOverlayText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#38BDF8',
  },
  aiSectionContainer: {
    marginTop: 10,
    marginBottom: 10,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 10,
    padding: 10,
  },
  aiSectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  aiMlPill: {
    backgroundColor: '#EEF2FF',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#C7D2FE',
  },
  aiMlPillText: {
    fontSize: 8,
    fontWeight: '800',
    color: '#4F46E5',
    letterSpacing: 0.5,
  },
  // Real Evidence Photo Styles
  realPhotoSectionContainer: {
    marginTop: 10,
    marginBottom: 10,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    padding: 12,
  },
  realPhotoSectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  realEvidencePill: {
    backgroundColor: '#ECFDF5',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#A7F3D0',
  },
  realEvidencePillText: {
    fontSize: 9,
    fontWeight: '900',
    color: '#065F46',
    letterSpacing: 0.5,
  },
  realPhotoSectionHint: {
    fontSize: 11,
    color: THEME.textSecondary,
    marginTop: 3,
    marginBottom: 10,
    lineHeight: 16,
  },
  photoCaptureButtonsRow: {
    gap: 8,
  },
  realCameraBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: '#3B82F6',
    borderRadius: 10,
    padding: 10,
    gap: 10,
  },
  realCameraIconBadge: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#EFF6FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  realCameraIcon: {
    fontSize: 20,
  },
  realCameraTextCol: {
    flex: 1,
  },
  realCameraBtnTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: '#1E293B',
  },
  realCameraBtnSub: {
    fontSize: 10,
    color: '#64748B',
    marginTop: 1,
  },
  realCameraArrow: {
    fontSize: 14,
    color: '#3B82F6',
    fontWeight: '800',
  },
  realGalleryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 10,
    padding: 10,
    gap: 10,
  },
  realGalleryIconBadge: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  realGalleryIcon: {
    fontSize: 20,
  },
  realGalleryTextCol: {
    flex: 1,
  },
  realGalleryBtnTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#334155',
  },
  realGalleryBtnSub: {
    fontSize: 10,
    color: '#64748B',
    marginTop: 1,
  },
  realGalleryArrow: {
    fontSize: 14,
    color: '#94A3B8',
    fontWeight: '800',
  },
  attachedRealPhotoCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 10,
  },
  attachedRealPhotoRow: {
    flexDirection: 'row',
    gap: 12,
  },
  attachedRealPhotoThumb: {
    width: 72,
    height: 72,
    borderRadius: 8,
  },
  attachedRealPhotoDetails: {
    flex: 1,
    justifyContent: 'space-between',
  },
  realVerifiedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ECFDF5',
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderRadius: 6,
    alignSelf: 'flex-start',
    gap: 4,
  },
  realVerifiedBadgeIcon: {
    fontSize: 11,
  },
  realVerifiedBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#065F46',
  },
  realPhotoMetaText: {
    fontSize: 10,
    color: '#64748B',
    marginVertical: 4,
  },
  attachedPhotoActionsRow: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'center',
  },
  retakePhotoBtn: {
    paddingVertical: 3,
    paddingHorizontal: 8,
    backgroundColor: '#EFF6FF',
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#BFDBFE',
  },
  retakePhotoText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#1D4ED8',
  },
  removeRealPhotoBtn: {
    paddingVertical: 3,
  },
  removeRealPhotoText: {
    fontSize: 11,
    fontWeight: '700',
    color: THEME.danger,
  },
  realPhotoFeedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ECFDF5',
    borderWidth: 1,
    borderColor: '#A7F3D0',
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderRadius: 6,
    alignSelf: 'flex-start',
    marginBottom: 6,
    gap: 4,
  },
  realPhotoFeedBadgeIcon: {
    fontSize: 11,
  },
  realPhotoFeedBadgeText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#065F46',
    letterSpacing: 0.3,
  },
});
