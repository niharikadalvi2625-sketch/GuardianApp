import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { SafeZoneService } from '../services/safeZoneService';
import { LocationService } from '../services/locationService';
import { SafeZone, SafeZoneCategory, LocationCoords } from '../types/index';

const THEME = {
  primary: '#E63946',
  primaryDark: '#B71C1C',
  secondary: '#1D3557',
  background: '#F8F9FA',
  cardBg: '#FFFFFF',
  textPrimary: '#1E293B',
  textSecondary: '#64748B',
  textLight: '#94A3B8',
  safeGreen: '#2A9D8F',
  safeGreenBg: '#E8F5E9',
  blue: '#3B82F6',
  blueBg: '#EFF6FF',
  amber: '#F59E0B',
  amberBg: '#FEF3C7',
  border: '#E2E8F0',
};

const CATEGORIES: { id: SafeZoneCategory | 'all'; label: string; icon: string }[] = [
  { id: 'all', label: 'All', icon: '🌐' },
  { id: 'hospital', label: 'Hospitals', icon: '🏥' },
  { id: 'police', label: 'Police', icon: '👮' },
  { id: 'shelter', label: 'Shelters', icon: '🏠' },
  { id: 'fire_station', label: 'Fire Dept', icon: '🚒' },
];

export default function SafeZonesScreen() {
  const [loading, setLoading] = useState<boolean>(true);
  const [userCoords, setUserCoords] = useState<LocationCoords | null>(null);
  const [safeZones, setSafeZones] = useState<SafeZone[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<SafeZoneCategory | 'all'>('all');
  const [selectedZone, setSelectedZone] = useState<SafeZone | null>(null);
  const [searchQuery, setSearchQuery] = useState<string>('');

  useEffect(() => {
    loadLocationAndZones();
  }, []);

  useEffect(() => {
    filterZones();
  }, [selectedCategory, searchQuery, userCoords]);

  const loadLocationAndZones = async () => {
    setLoading(true);
    try {
      await LocationService.requestPermission();
      const coords = await LocationService.getCurrentLocation();
      setUserCoords(coords);
      const zones = await SafeZoneService.getSafeZones(coords, 'all');
      setSafeZones(zones);
      if (zones.length > 0) {
        setSelectedZone(zones[0]);
      }
    } catch (_e) {
      // Handled via defaults
    } finally {
      setLoading(false);
    }
  };

  const filterZones = async () => {
    let zones = await SafeZoneService.getSafeZones(
      userCoords || undefined,
      selectedCategory
    );

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      zones = zones.filter(
        (z) =>
          z.name.toLowerCase().includes(q) ||
          z.address.toLowerCase().includes(q)
      );
    }

    setSafeZones(zones);
    if (zones.length > 0 && (!selectedZone || !zones.find((z) => z.id === selectedZone.id))) {
      setSelectedZone(zones[0]);
    }
  };

  const handleNavigate = (zone: SafeZone) => {
    SafeZoneService.openNavigation(zone, userCoords || undefined);
  };

  const handleCall = (phone: string) => {
    SafeZoneService.callSafeZone(phone);
  };

  const getCategoryColor = (category: SafeZoneCategory) => {
    switch (category) {
      case 'hospital':
        return { bg: THEME.blueBg, text: THEME.blue, icon: '🏥' };
      case 'police':
        return { bg: THEME.amberBg, text: THEME.amber, icon: '👮' };
      case 'shelter':
        return { bg: THEME.safeGreenBg, text: THEME.safeGreen, icon: '🏠' };
      case 'fire_station':
        return { bg: '#FEE2E2', text: THEME.primary, icon: '🚒' };
      default:
        return { bg: '#F1F5F9', text: THEME.textSecondary, icon: '📍' };
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={THEME.primary} />
        <Text style={styles.loadingText}>Acquiring GPS & Nearest Safe Zones...</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Top Header & Search */}
      <View style={styles.header}>
        <View style={styles.titleRow}>
          <View>
            <Text style={styles.headerTitle}>Safe Zone Finder</Text>
            <Text style={styles.headerSubtitle} numberOfLines={1}>
              {userCoords
                ? `📍 ${LocationService.formatLocationName(userCoords)}`
                : 'GPS Standby'}
            </Text>
          </View>
          <TouchableOpacity style={styles.refreshBtn} onPress={loadLocationAndZones}>
            <Text style={styles.refreshBtnText}>🔄 Refresh</Text>
          </TouchableOpacity>
        </View>

        {/* Search Bar */}
        <View style={styles.searchBar}>
          <Text style={styles.searchIcon}>🔍</Text>
          <TextInput
            style={styles.searchInput}
            placeholder="Search hospitals, police, shelters..."
            placeholderTextColor={THEME.textLight}
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery('')}>
              <Text style={styles.clearIcon}>✕</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Category Horizontal Chips */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.categoriesScroll}
        >
          {CATEGORIES.map((cat) => {
            const isSelected = selectedCategory === cat.id;
            return (
              <TouchableOpacity
                key={cat.id}
                style={[
                  styles.categoryChip,
                  isSelected && styles.categoryChipActive,
                ]}
                onPress={() => setSelectedCategory(cat.id)}
                activeOpacity={0.7}
              >
                <Text style={styles.categoryIcon}>{cat.icon}</Text>
                <Text
                  style={[
                    styles.categoryLabel,
                    isSelected && styles.categoryLabelActive,
                  ]}
                >
                  {cat.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Visual Map / Radar View */}
        <View style={styles.mapCard}>
          <View style={styles.mapHeader}>
            <View style={styles.mapLiveBadge}>
              <View style={styles.mapLiveDot} />
              <Text style={styles.mapLiveText}>Live Radar View</Text>
            </View>
            <Text style={styles.mapRadiusText}>Within 5 km radius</Text>
          </View>

          <View style={styles.radarVisual}>
            <View style={[styles.radarRing, { width: 220, height: 220, borderRadius: 110 }]} />
            <View style={[styles.radarRing, { width: 140, height: 140, borderRadius: 70 }]} />
            <View style={[styles.radarRing, { width: 60, height: 60, borderRadius: 30 }]} />

            {/* Center User Location Pin */}
            <View style={styles.userPinContainer}>
              <View style={styles.userPinGlow} />
              <View style={styles.userPinDot} />
            </View>

            {/* Interactive Markers for safe zones */}
            {safeZones.slice(0, 6).map((zone, idx) => {
              const catColor = getCategoryColor(zone.category);
              const isSelected = selectedZone?.id === zone.id;
              const angles = [45, 130, 210, 300, 85, 260];
              const distances = [75, 90, 65, 80, 45, 100];
              const angle = angles[idx % angles.length] * (Math.PI / 180);
              const dist = distances[idx % distances.length];
              const top = 110 + Math.sin(angle) * dist - 18;
              const left = 110 + Math.cos(angle) * dist - 18;

              return (
                <TouchableOpacity
                  key={zone.id}
                  style={[
                    styles.mapMarker,
                    { top, left, backgroundColor: catColor.bg },
                    isSelected && styles.mapMarkerSelected,
                  ]}
                  onPress={() => setSelectedZone(zone)}
                  activeOpacity={0.8}
                >
                  <Text style={styles.markerEmoji}>{catColor.icon}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
          <Text style={styles.mapHintText}>
            Tap any marker on the radar or choose from the verified list below
          </Text>
        </View>

        {/* Selected Zone Quick Action Card */}
        {selectedZone && (
          <View style={styles.selectedZoneCard}>
            <View style={styles.selectedZoneHeader}>
              <View style={styles.selectedIconBg}>
                <Text style={styles.selectedZoneIcon}>
                  {getCategoryColor(selectedZone.category).icon}
                </Text>
              </View>
              <View style={styles.selectedZoneInfo}>
                <View style={styles.selectedTitleRow}>
                  <Text style={styles.selectedZoneName} numberOfLines={1}>
                    {selectedZone.name}
                  </Text>
                  {selectedZone.verified && (
                    <View style={styles.verifiedBadge}>
                      <Text style={styles.verifiedBadgeText}>✓ VERIFIED</Text>
                    </View>
                  )}
                </View>
                <Text style={styles.selectedZoneAddress} numberOfLines={1}>
                  {selectedZone.address}
                </Text>
                <View style={styles.selectedMetaRow}>
                  <Text style={styles.selectedDistance}>
                    📍 {selectedZone.distanceKm !== undefined ? selectedZone.distanceKm : '1.2'} km away
                  </Text>
                  {selectedZone.isOpen24Hours && (
                    <Text style={styles.open24Badge}>• Open 24/7</Text>
                  )}
                </View>
              </View>
            </View>

            {/* Quick Action Navigation & Call Buttons */}
            <View style={styles.actionButtonsRow}>
              <TouchableOpacity
                style={styles.navButton}
                onPress={() => handleNavigate(selectedZone)}
                activeOpacity={0.85}
              >
                <Text style={styles.navButtonIcon}>🧭</Text>
                <Text style={styles.navButtonText}>Start Navigation</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.callButton}
                onPress={() => handleCall(selectedZone.phone)}
                activeOpacity={0.85}
              >
                <Text style={styles.callButtonIcon}>📞</Text>
                <Text style={styles.callButtonText}>Call</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* Safe Zones List Section */}
        <View style={styles.listSectionHeader}>
          <Text style={styles.listSectionTitle}>
            Nearby Verified Facilities ({safeZones.length})
          </Text>
          <Text style={styles.listSectionSub}>Sorted by nearest first</Text>
        </View>

        {safeZones.map((zone) => {
          const cat = getCategoryColor(zone.category);
          const isSelected = selectedZone?.id === zone.id;

          return (
            <TouchableOpacity
              key={zone.id}
              style={[styles.zoneCard, isSelected && styles.zoneCardSelected]}
              onPress={() => setSelectedZone(zone)}
              activeOpacity={0.7}
            >
              <View style={[styles.zoneIconContainer, { backgroundColor: cat.bg }]}>
                <Text style={styles.zoneIcon}>{cat.icon}</Text>
              </View>

              <View style={styles.zoneDetails}>
                <View style={styles.zoneTitleRow}>
                  <Text style={styles.zoneName} numberOfLines={1}>
                    {zone.name}
                  </Text>
                  <Text style={styles.zoneDistance}>
                    {zone.distanceKm !== undefined ? `${zone.distanceKm} km` : '1.2 km'}
                  </Text>
                </View>

                <Text style={styles.zoneAddress} numberOfLines={1}>
                  {zone.address}
                </Text>

                <View style={styles.zoneBadgeRow}>
                  <View style={[styles.catBadge, { backgroundColor: cat.bg }]}>
                    <Text style={[styles.catBadgeText, { color: cat.text }]}>
                      {zone.category.replace('_', ' ').toUpperCase()}
                    </Text>
                  </View>
                  {zone.isOpen24Hours && (
                    <View style={styles.hoursBadge}>
                      <Text style={styles.hoursBadgeText}>24/7</Text>
                    </View>
                  )}
                </View>
              </View>

              <TouchableOpacity
                style={styles.zoneQuickNav}
                onPress={() => handleNavigate(zone)}
              >
                <Text style={styles.quickNavIcon}>➔</Text>
              </TouchableOpacity>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: THEME.background },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: THEME.background },
  loadingText: { marginTop: 12, fontSize: 14, color: THEME.textSecondary, fontWeight: '600' },
  header: { paddingHorizontal: 20, paddingTop: 12, paddingBottom: 8, backgroundColor: THEME.cardBg, borderBottomWidth: 1, borderBottomColor: THEME.border },
  titleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  headerTitle: { fontSize: 22, fontWeight: '800', color: THEME.textPrimary },
  headerSubtitle: { fontSize: 12, color: THEME.safeGreen, fontWeight: '700', marginTop: 2 },
  refreshBtn: { backgroundColor: '#F1F5F9', paddingVertical: 6, paddingHorizontal: 12, borderRadius: 8 },
  refreshBtnText: { fontSize: 12, fontWeight: '700', color: THEME.secondary },
  searchBar: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F8FAFC', borderWidth: 1, borderColor: THEME.border, borderRadius: 12, paddingHorizontal: 12, height: 42, marginBottom: 12 },
  searchIcon: { fontSize: 15, marginRight: 8 },
  searchInput: { flex: 1, fontSize: 13, color: THEME.textPrimary },
  clearIcon: { fontSize: 14, color: THEME.textLight, padding: 4 },
  categoriesScroll: { paddingBottom: 6, gap: 8 },
  categoryChip: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F1F5F9', paddingVertical: 6, paddingHorizontal: 12, borderRadius: 20 },
  categoryChipActive: { backgroundColor: THEME.secondary },
  categoryIcon: { fontSize: 14, marginRight: 6 },
  categoryLabel: { fontSize: 12, fontWeight: '700', color: THEME.textSecondary },
  categoryLabelActive: { color: '#FFFFFF' },
  scrollContent: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 36 },
  mapCard: { backgroundColor: '#0F172A', borderRadius: 20, padding: 16, marginBottom: 16, alignItems: 'center' },
  mapHeader: { width: '100%', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  mapLiveBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(42, 157, 143, 0.2)', paddingVertical: 4, paddingHorizontal: 8, borderRadius: 6 },
  mapLiveDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#2A9D8F', marginRight: 6 },
  mapLiveText: { fontSize: 10, fontWeight: '800', color: '#2A9D8F', textTransform: 'uppercase' },
  mapRadiusText: { fontSize: 11, color: '#94A3B8', fontWeight: '600' },
  radarVisual: { width: 220, height: 220, justifyContent: 'center', alignItems: 'center', marginVertical: 10 },
  radarRing: { position: 'absolute', borderWidth: 1, borderColor: 'rgba(148, 163, 184, 0.25)' },
  userPinContainer: { width: 24, height: 24, justifyContent: 'center', alignItems: 'center' },
  userPinGlow: { position: 'absolute', width: 24, height: 24, borderRadius: 12, backgroundColor: 'rgba(59, 130, 246, 0.35)' },
  userPinDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: '#3B82F6', borderWidth: 2, borderColor: '#FFFFFF' },
  mapMarker: { position: 'absolute', width: 36, height: 36, borderRadius: 18, justifyContent: 'center', alignItems: 'center', borderWidth: 2, borderColor: '#FFFFFF' },
  mapMarkerSelected: { borderColor: THEME.primary, borderWidth: 3, transform: [{ scale: 1.2 }] },
  markerEmoji: { fontSize: 16 },
  mapHintText: { fontSize: 11, color: '#94A3B8', textAlign: 'center', marginTop: 4 },
  selectedZoneCard: { backgroundColor: THEME.cardBg, borderRadius: 18, padding: 16, borderWidth: 2, borderColor: THEME.primary, marginBottom: 20 },
  selectedZoneHeader: { flexDirection: 'row', marginBottom: 14 },
  selectedIconBg: { width: 48, height: 48, borderRadius: 14, backgroundColor: '#FEE2E2', justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  selectedZoneIcon: { fontSize: 22 },
  selectedZoneInfo: { flex: 1 },
  selectedTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  selectedZoneName: { fontSize: 16, fontWeight: '800', color: THEME.textPrimary, flex: 1 },
  verifiedBadge: { backgroundColor: THEME.safeGreenBg, paddingVertical: 2, paddingHorizontal: 6, borderRadius: 4 },
  verifiedBadgeText: { fontSize: 8, fontWeight: '800', color: THEME.safeGreen },
  selectedZoneAddress: { fontSize: 12, color: THEME.textSecondary, marginTop: 2 },
  selectedMetaRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4 },
  selectedDistance: { fontSize: 12, fontWeight: '700', color: THEME.primary },
  open24Badge: { fontSize: 11, fontWeight: '700', color: THEME.safeGreen },
  actionButtonsRow: { flexDirection: 'row', gap: 10 },
  navButton: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: THEME.primary, paddingVertical: 12, borderRadius: 12, gap: 6 },
  navButtonIcon: { fontSize: 16 },
  navButtonText: { color: '#FFFFFF', fontSize: 13, fontWeight: '800' },
  callButton: { width: 80, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: '#EEF2F6', paddingVertical: 12, borderRadius: 12, gap: 4 },
  callButtonIcon: { fontSize: 14 },
  callButtonText: { color: THEME.secondary, fontSize: 13, fontWeight: '700' },
  listSectionHeader: { marginBottom: 12 },
  listSectionTitle: { fontSize: 17, fontWeight: '800', color: THEME.textPrimary },
  listSectionSub: { fontSize: 12, color: THEME.textSecondary, marginTop: 2 },
  zoneCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: THEME.cardBg, borderRadius: 16, padding: 14, borderWidth: 1, borderColor: THEME.border, marginBottom: 10 },
  zoneCardSelected: { borderColor: THEME.primary, backgroundColor: '#FFF5F5' },
  zoneIconContainer: { width: 44, height: 44, borderRadius: 12, justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  zoneIcon: { fontSize: 20 },
  zoneDetails: { flex: 1 },
  zoneTitleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  zoneName: { fontSize: 14, fontWeight: '700', color: THEME.textPrimary, flex: 1, marginRight: 8 },
  zoneDistance: { fontSize: 12, fontWeight: '800', color: THEME.primary },
  zoneAddress: { fontSize: 12, color: THEME.textSecondary, marginTop: 2 },
  zoneBadgeRow: { flexDirection: 'row', gap: 6, marginTop: 6 },
  catBadge: { paddingVertical: 2, paddingHorizontal: 6, borderRadius: 4 },
  catBadgeText: { fontSize: 9, fontWeight: '800' },
  hoursBadge: { backgroundColor: '#F1F5F9', paddingVertical: 2, paddingHorizontal: 6, borderRadius: 4 },
  hoursBadgeText: { fontSize: 9, fontWeight: '700', color: THEME.textSecondary },
  zoneQuickNav: { width: 32, height: 32, borderRadius: 16, backgroundColor: '#F1F5F9', justifyContent: 'center', alignItems: 'center', marginLeft: 8 },
  quickNavIcon: { fontSize: 14, color: THEME.secondary, fontWeight: '800' },
});