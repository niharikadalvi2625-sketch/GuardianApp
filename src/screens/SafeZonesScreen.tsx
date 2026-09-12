import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { SafeZoneService } from '../services/safeZoneService';
import { LocationService } from '../services/locationService';
import { AlertService } from '../services/alertService';
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
  shelterPurple: '#7C3AED',
  shelterPurpleBg: '#F3E8FF',
};

const CATEGORIES: { id: SafeZoneCategory | 'all'; label: string; icon: string }[] = [
  { id: 'all', label: 'All', icon: '🌐' },
  { id: 'shelter', label: 'Shelters', icon: '🏠' },
  { id: 'hospital', label: 'Hospitals', icon: '🏥' },
  { id: 'police', label: 'Police', icon: '👮' },
  { id: 'fire_station', label: 'Fire Dept', icon: '🚒' },
];

const QUICK_TAGS = [
  { label: 'Safe Haven', icon: '🛡️' },
  { label: 'My Home', icon: '🏠' },
  { label: 'High Ground', icon: '🏢' },
  { label: 'Evac Point', icon: '🚗' },
];

export default function SafeZonesScreen() {
  const [loading, setLoading] = useState<boolean>(true);
  const [userCoords, setUserCoords] = useState<LocationCoords | null>(null);
  const [locationDisabled, setLocationDisabled] = useState<boolean>(false);
  const [safeZones, setSafeZones] = useState<SafeZone[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<SafeZoneCategory | 'all'>('all');
  const [selectedZone, setSelectedZone] = useState<SafeZone | null>(null);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [markingSpot, setMarkingSpot] = useState<boolean>(false);

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
      const enabled = await LocationService.isLocationEnabled();
      setLocationDisabled(!enabled);

      const coords = await LocationService.getCurrentLocation();
      setUserCoords(coords);
      const zones = await SafeZoneService.getSafeZones(coords, selectedCategory);
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
    if (searchQuery.trim().length >= 2) {
      const results = await SafeZoneService.searchPlaces(searchQuery.trim(), userCoords || undefined);
      const filtered = selectedCategory === 'all' ? results : results.filter((r) => r.category === selectedCategory);
      setSafeZones(filtered);
      if (filtered.length > 0 && (!selectedZone || !filtered.find((z) => z.id === selectedZone.id))) {
        setSelectedZone(filtered[0]);
      }
    } else {
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
    }
  };

  const handleNavigate = (zone: SafeZone) => {
    SafeZoneService.openNavigation(zone, userCoords || undefined);
  };

  const handleCall = (phone: string) => {
    SafeZoneService.callSafeZone(phone);
  };

  /**
   * ⚡ 1-TAP INSTANT SAFE SHELTER MARKER (ZERO TYPING REQUIRED):
   * In a disaster, flood, fire, or emergency, users have no time to write forms.
   * Grabs live GPS coordinates immediately, reverse-geocodes landmark, and saves instantly.
   */
  const handleInstantMarkCurrentLocation = async (presetLabel: string = 'Safe Haven') => {
    setMarkingSpot(true);
    try {
      AlertService.triggerHaptic();

      const loc = userCoords || (await LocationService.getCurrentLocation());
      setUserCoords(loc);

      const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      const locality = loc.subLocality || loc.city || 'Emergency Zone';
      const shelterName = `${presetLabel} @ ${locality} (${timeStr})`;
      const addr = loc.address || `${locality}, ${loc.region || ''} (${loc.latitude.toFixed(4)}, ${loc.longitude.toFixed(4)})`;

      const created = await SafeZoneService.addCustomShelter({
        name: shelterName,
        address: addr,
        phone: '112',
        latitude: loc.latitude,
        longitude: loc.longitude,
        isOpen24Hours: true,
      });

      // Reload zones and select new shelter
      const updated = await SafeZoneService.getSafeZones(loc, selectedCategory);
      setSafeZones(updated);
      setSelectedZone(created);

      Alert.alert(
        '✅ Safe Shelter Marked Instantly!',
        `Saved at: ${addr}\n\nZero typing needed! This safe haven is now pinned. Anyone can tap "Directions & Live Navigation" to navigate directly here from their live location.`
      );
    } catch (err) {
      Alert.alert('GPS Notice', 'Could not acquire GPS coordinates to mark safe haven.');
    } finally {
      setMarkingSpot(false);
    }
  };

  const handleDeleteShelter = (id: string, name: string) => {
    Alert.alert(
      'Remove Safe Shelter',
      `Are you sure you want to remove "${name}" from your safe shelters list?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            await SafeZoneService.deleteCustomShelter(id);
            const updated = await SafeZoneService.getSafeZones(userCoords || undefined, selectedCategory);
            setSafeZones(updated);
            if (selectedZone?.id === id) {
              setSelectedZone(updated[0] || null);
            }
          },
        },
      ]
    );
  };

  const getCategoryColor = (category: SafeZoneCategory, isUserAdded?: boolean) => {
    if (isUserAdded) {
      return { bg: THEME.shelterPurpleBg, text: THEME.shelterPurple, icon: '⭐' };
    }
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
      {/* Compact Sticky Top Bar */}
      <View style={styles.topBar}>
        <View style={styles.topBarTextCol}>
          <Text style={styles.topBarTitle}>Safe Zone Finder</Text>
          <Text style={styles.topBarSubtitle} numberOfLines={1}>
            {userCoords
              ? `📍 ${LocationService.formatLocationName(userCoords)}`
              : 'GPS Standby'}
          </Text>
        </View>
        <TouchableOpacity style={styles.refreshBtn} onPress={loadLocationAndZones} activeOpacity={0.8}>
          <Text style={styles.refreshBtnText}>🔄 Refresh</Text>
        </TouchableOpacity>
      </View>

      {/* Main Smooth Scrollable Body */}
      <ScrollView
        style={styles.mainScrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* GPS Warning Banner if disabled */}
        {locationDisabled && (
          <TouchableOpacity
            style={styles.gpsWarningBanner}
            onPress={() => LocationService.openLocationSettings()}
            activeOpacity={0.8}
          >
            <Text style={styles.gpsWarningIcon}>⚠️</Text>
            <View style={styles.gpsWarningTextCol}>
              <Text style={styles.gpsWarningTitle}>Device Location / GPS is OFF</Text>
              <Text style={styles.gpsWarningSub}>Tap here to turn on Location Services in Settings</Text>
            </View>
            <Text style={styles.gpsWarningArrow}>⚙️</Text>
          </TouchableOpacity>
        )}

        {/* ⚡ 1-TAP INSTANT SAFE SPOT MARKER (DISASTER READY - ZERO TYPING) */}
        <View style={styles.instantMarkContainer}>
          <TouchableOpacity
            style={styles.instantMarkBanner}
            onPress={() => handleInstantMarkCurrentLocation('Safe Haven')}
            activeOpacity={0.85}
          >
            <View style={styles.instantMarkIconBg}>
              <Text style={styles.instantMarkIcon}>📍</Text>
            </View>
            <View style={styles.instantMarkTextCol}>
              <Text style={styles.instantMarkTitle}>
                {markingSpot ? 'Acquiring GPS Fix...' : '1-TAP: MARK HERE AS SAFE SHELTER'}
              </Text>
              <Text style={styles.instantMarkSub}>
                Zero typing • Instant live GPS anchor • Direct turn-by-turn navigation
              </Text>
            </View>
            <View style={styles.instantMarkPill}>
              {markingSpot ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <Text style={styles.instantMarkPillText}>+ MARK</Text>
              )}
            </View>
          </TouchableOpacity>

          {/* Quick 1-Touch Label Tags (1-Tap to label instantly without keyboard) */}
          <View style={styles.quickTagsRow}>
            <Text style={styles.quickTagsLabel}>INSTANT TAGS:</Text>
            {QUICK_TAGS.map((tag) => (
              <TouchableOpacity
                key={tag.label}
                style={styles.quickTagChip}
                onPress={() => handleInstantMarkCurrentLocation(tag.label)}
                activeOpacity={0.8}
              >
                <Text style={styles.quickTagChipIcon}>{tag.icon}</Text>
                <Text style={styles.quickTagChipText}>{tag.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
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
            <TouchableOpacity onPress={() => setSearchQuery('')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Text style={styles.clearIcon}>✕</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Category Horizontal Chips */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.categoriesScroll}
          nestedScrollEnabled={true}
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
              const catColor = getCategoryColor(zone.category, zone.isUserAdded);
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
            Tap any marker on the radar or choose from the list below
          </Text>
        </View>

        {/* Selected Zone Quick Action Card */}
        {selectedZone && (
          <View style={[styles.selectedZoneCard, selectedZone.isUserAdded && styles.userShelterSelectedCard]}>
            <View style={styles.selectedZoneHeader}>
              <View style={[styles.selectedIconBg, selectedZone.isUserAdded && { backgroundColor: THEME.shelterPurpleBg }]}>
                <Text style={styles.selectedZoneIcon}>
                  {getCategoryColor(selectedZone.category, selectedZone.isUserAdded).icon}
                </Text>
              </View>
              <View style={styles.selectedZoneInfo}>
                <View style={styles.selectedTitleRow}>
                  <Text style={styles.selectedZoneName} numberOfLines={1}>
                    {selectedZone.name}
                  </Text>
                  {selectedZone.isUserAdded ? (
                    <View style={styles.userShelterBadge}>
                      <Text style={styles.userShelterBadgeText}>MARKED SAFE HAVEN</Text>
                    </View>
                  ) : selectedZone.verified ? (
                    <View style={styles.verifiedBadge}>
                      <Text style={styles.verifiedBadgeText}>VERIFIED</Text>
                    </View>
                  ) : null}
                </View>
                <Text style={styles.selectedZoneAddress} numberOfLines={2}>
                  {selectedZone.address}
                </Text>
                <View style={styles.selectedMetaRow}>
                  {selectedZone.distanceKm !== undefined && (
                    <Text style={styles.selectedDistance}>
                      📍 {selectedZone.distanceKm < 1 ? `${Math.round(selectedZone.distanceKm * 1000)} m` : `${selectedZone.distanceKm.toFixed(1)} km`} away
                    </Text>
                  )}
                  {selectedZone.isOpen24Hours && (
                    <Text style={styles.open24Badge}>• Open 24/7</Text>
                  )}
                </View>
              </View>
            </View>

            <View style={styles.actionButtonsRow}>
              <TouchableOpacity
                style={[styles.navButton, selectedZone.isUserAdded && { backgroundColor: THEME.shelterPurple }]}
                onPress={() => handleNavigate(selectedZone)}
                activeOpacity={0.8}
              >
                <Text style={styles.navButtonIcon}>🧭</Text>
                <Text style={styles.navButtonText}>Directions & Live Navigation</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.callButton}
                onPress={() => handleCall(selectedZone.phone)}
                activeOpacity={0.8}
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
            Nearby Verified Safe Havens ({safeZones.length})
          </Text>
          <Text style={styles.listSectionSub}>
            Ranked by immediate proximity to your location
          </Text>
        </View>

        {safeZones.map((zone) => {
          const catColor = getCategoryColor(zone.category, zone.isUserAdded);
          const isSelected = selectedZone?.id === zone.id;

          return (
            <TouchableOpacity
              key={zone.id}
              style={[
                styles.zoneCard,
                isSelected && styles.zoneCardSelected,
                zone.isUserAdded && styles.userZoneCard,
              ]}
              onPress={() => setSelectedZone(zone)}
              activeOpacity={0.85}
            >
              <View style={[styles.zoneIconContainer, { backgroundColor: catColor.bg }]}>
                <Text style={styles.zoneIcon}>{catColor.icon}</Text>
              </View>

              <View style={styles.zoneDetails}>
                <View style={styles.zoneTitleRow}>
                  <Text style={styles.zoneName} numberOfLines={1}>
                    {zone.name}
                  </Text>
                  {zone.distanceKm !== undefined && (
                    <Text style={[styles.zoneDistance, zone.isUserAdded && { color: THEME.shelterPurple }]}>
                      {zone.distanceKm < 1 ? `${Math.round(zone.distanceKm * 1000)} m` : `${zone.distanceKm.toFixed(1)} km`}
                    </Text>
                  )}
                </View>
                <Text style={styles.zoneAddress} numberOfLines={1}>
                  {zone.address}
                </Text>
                <View style={styles.zoneBadgeRow}>
                  {zone.isUserAdded ? (
                    <View style={[styles.catBadge, { backgroundColor: THEME.shelterPurpleBg }]}>
                      <Text style={[styles.catBadgeText, { color: THEME.shelterPurple }]}>
                        ⭐ YOUR SAFE HAVEN
                      </Text>
                    </View>
                  ) : (
                    <View style={[styles.catBadge, { backgroundColor: catColor.bg }]}>
                      <Text style={[styles.catBadgeText, { color: catColor.text }]}>
                        {zone.category.toUpperCase().replace('_', ' ')}
                      </Text>
                    </View>
                  )}

                  {zone.isOpen24Hours && (
                    <View style={styles.hoursBadge}>
                      <Text style={styles.hoursBadgeText}>24/7 ACCESSIBLE</Text>
                    </View>
                  )}
                </View>
              </View>

              {zone.isUserAdded && (
                <TouchableOpacity
                  style={styles.deleteShelterBtn}
                  onPress={() => handleDeleteShelter(zone.id, zone.name)}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Text style={styles.deleteShelterIcon}>🗑️</Text>
                </TouchableOpacity>
              )}

              <TouchableOpacity
                style={styles.zoneQuickNav}
                onPress={() => handleNavigate(zone)}
                activeOpacity={0.7}
              >
                <Text style={styles.quickNavIcon}>➔</Text>
              </TouchableOpacity>
            </TouchableOpacity>
          );
        })}

        {/* Extra Bottom Cushion */}
        <View style={styles.bottomSpacer} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: THEME.background,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: THEME.background,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: THEME.textSecondary,
    fontWeight: '600',
  },
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 10,
    backgroundColor: THEME.cardBg,
    borderBottomWidth: 1,
    borderBottomColor: THEME.border,
  },
  topBarTextCol: {
    flex: 1,
  },
  topBarTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: THEME.textPrimary,
  },
  topBarSubtitle: {
    fontSize: 12,
    color: THEME.safeGreen,
    fontWeight: '700',
    marginTop: 2,
  },
  refreshBtn: {
    backgroundColor: '#F1F5F9',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 8,
  },
  refreshBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: THEME.secondary,
  },
  mainScrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 14,
    paddingBottom: 40,
  },

  // Instant 1-Tap Disaster Safe Spot Marker Styles
  instantMarkContainer: {
    marginBottom: 14,
  },
  instantMarkBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#7C3AED',
    borderRadius: 14,
    padding: 12,
    shadowColor: '#7C3AED',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 3,
  },
  instantMarkIconBg: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  instantMarkIcon: {
    fontSize: 20,
  },
  instantMarkTextCol: {
    flex: 1,
  },
  instantMarkTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: 0.3,
  },
  instantMarkSub: {
    fontSize: 10,
    color: '#DDD6FE',
    marginTop: 2,
    fontWeight: '500',
  },
  instantMarkPill: {
    backgroundColor: '#FFFFFF',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 8,
    marginLeft: 6,
  },
  instantMarkPillText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#7C3AED',
  },
  quickTagsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 8,
    flexWrap: 'wrap',
  },
  quickTagsLabel: {
    fontSize: 9,
    fontWeight: '800',
    color: THEME.textLight,
    letterSpacing: 0.5,
    marginRight: 2,
  },
  quickTagChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F3E8FF',
    borderWidth: 1,
    borderColor: '#DDD6FE',
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 12,
    gap: 4,
  },
  quickTagChipIcon: {
    fontSize: 11,
  },
  quickTagChipText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#6D28D9',
  },

  gpsWarningBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FCA5A5',
    borderRadius: 12,
    padding: 10,
    marginBottom: 12,
  },
  gpsWarningIcon: { fontSize: 18, marginRight: 8 },
  gpsWarningTextCol: { flex: 1 },
  gpsWarningTitle: { fontSize: 12, fontWeight: '800', color: '#B91C1C' },
  gpsWarningSub: { fontSize: 10, color: '#7F1D1D', marginTop: 1 },
  gpsWarningArrow: { fontSize: 16, marginLeft: 6 },

  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: THEME.border,
    borderRadius: 12,
    paddingHorizontal: 12,
    height: 42,
    marginBottom: 12,
  },
  searchIcon: { fontSize: 15, marginRight: 8 },
  searchInput: { flex: 1, fontSize: 13, color: THEME.textPrimary },
  clearIcon: { fontSize: 14, color: THEME.textLight, padding: 4 },

  categoriesScroll: {
    paddingBottom: 12,
    gap: 8,
  },
  categoryChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: THEME.border,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 20,
  },
  categoryChipActive: {
    backgroundColor: THEME.secondary,
    borderColor: THEME.secondary,
  },
  categoryIcon: { fontSize: 14, marginRight: 6 },
  categoryLabel: { fontSize: 12, fontWeight: '700', color: THEME.textSecondary },
  categoryLabelActive: { color: '#FFFFFF' },

  mapCard: {
    backgroundColor: '#0F172A',
    borderRadius: 20,
    padding: 16,
    marginBottom: 16,
    alignItems: 'center',
  },
  mapHeader: {
    width: '100%',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  mapLiveBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(42, 157, 143, 0.2)',
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 6,
  },
  mapLiveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#2A9D8F',
    marginRight: 6,
  },
  mapLiveText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#2A9D8F',
    textTransform: 'uppercase',
  },
  mapRadiusText: { fontSize: 11, color: '#94A3B8', fontWeight: '600' },
  radarVisual: {
    width: 220,
    height: 220,
    justifyContent: 'center',
    alignItems: 'center',
    marginVertical: 10,
  },
  radarRing: {
    position: 'absolute',
    borderWidth: 1,
    borderColor: 'rgba(148, 163, 184, 0.25)',
  },
  userPinContainer: {
    width: 24,
    height: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  userPinGlow: {
    position: 'absolute',
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: 'rgba(59, 130, 246, 0.35)',
  },
  userPinDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#3B82F6',
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  mapMarker: {
    position: 'absolute',
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  mapMarkerSelected: {
    borderColor: THEME.primary,
    borderWidth: 3,
    transform: [{ scale: 1.2 }],
  },
  markerEmoji: { fontSize: 16 },
  mapHintText: {
    fontSize: 11,
    color: '#94A3B8',
    textAlign: 'center',
    marginTop: 4,
  },

  selectedZoneCard: {
    backgroundColor: THEME.cardBg,
    borderRadius: 18,
    padding: 16,
    borderWidth: 2,
    borderColor: THEME.primary,
    marginBottom: 16,
  },
  userShelterSelectedCard: {
    borderColor: '#7C3AED',
  },
  selectedZoneHeader: {
    flexDirection: 'row',
    marginBottom: 14,
  },
  selectedIconBg: {
    width: 48,
    height: 48,
    borderRadius: 14,
    backgroundColor: '#FEE2E2',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  selectedZoneIcon: { fontSize: 22 },
  selectedZoneInfo: { flex: 1 },
  selectedTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  selectedZoneName: {
    fontSize: 16,
    fontWeight: '800',
    color: THEME.textPrimary,
    flex: 1,
  },
  verifiedBadge: {
    backgroundColor: THEME.safeGreenBg,
    paddingVertical: 2,
    paddingHorizontal: 6,
    borderRadius: 4,
  },
  verifiedBadgeText: {
    fontSize: 8,
    fontWeight: '800',
    color: THEME.safeGreen,
  },
  userShelterBadge: {
    backgroundColor: '#F3E8FF',
    paddingVertical: 2,
    paddingHorizontal: 6,
    borderRadius: 4,
  },
  userShelterBadgeText: {
    fontSize: 8,
    fontWeight: '800',
    color: '#7C3AED',
  },
  selectedZoneAddress: {
    fontSize: 12,
    color: THEME.textSecondary,
    marginTop: 2,
  },
  selectedMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 4,
  },
  selectedDistance: { fontSize: 12, fontWeight: '700', color: THEME.primary },
  open24Badge: { fontSize: 11, fontWeight: '700', color: THEME.safeGreen },
  actionButtonsRow: { flexDirection: 'row', gap: 10 },
  navButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: THEME.primary,
    paddingVertical: 12,
    borderRadius: 12,
    gap: 6,
  },
  navButtonIcon: { fontSize: 16 },
  navButtonText: { color: '#FFFFFF', fontSize: 13, fontWeight: '800' },
  callButton: {
    width: 80,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#EEF2F6',
    paddingVertical: 12,
    borderRadius: 12,
    gap: 4,
  },
  callButtonIcon: { fontSize: 14 },
  callButtonText: { color: THEME.secondary, fontSize: 13, fontWeight: '700' },

  listSectionHeader: { marginBottom: 12 },
  listSectionTitle: { fontSize: 17, fontWeight: '800', color: THEME.textPrimary },
  listSectionSub: { fontSize: 12, color: THEME.textSecondary, marginTop: 2 },

  zoneCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: THEME.cardBg,
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: THEME.border,
    marginBottom: 10,
  },
  userZoneCard: {
    borderColor: '#DDD6FE',
    backgroundColor: '#FAF5FF',
  },
  zoneCardSelected: {
    borderColor: THEME.primary,
    backgroundColor: '#FFF5F5',
  },
  zoneIconContainer: {
    width: 44,
    height: 44,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
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
  deleteShelterBtn: { padding: 6, marginRight: 4 },
  deleteShelterIcon: { fontSize: 14 },
  zoneQuickNav: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F1F5F9',
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 4,
  },
  quickNavIcon: { fontSize: 14, color: THEME.secondary, fontWeight: '800' },
  bottomSpacer: { height: 60 },
});
