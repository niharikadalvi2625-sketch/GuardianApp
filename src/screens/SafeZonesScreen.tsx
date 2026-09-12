import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Modal,
  Alert,
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
  shelterPurple: '#8B5CF6',
  shelterPurpleBg: '#F3E8FF',
};

const CATEGORIES: { id: SafeZoneCategory | 'all'; label: string; icon: string }[] = [
  { id: 'all', label: 'All', icon: '🌐' },
  { id: 'shelter', label: 'Shelters', icon: '🏠' },
  { id: 'hospital', label: 'Hospitals', icon: '🏥' },
  { id: 'police', label: 'Police', icon: '👮' },
  { id: 'fire_station', label: 'Fire Dept', icon: '🚒' },
];

export default function SafeZonesScreen() {
  const [loading, setLoading] = useState<boolean>(true);
  const [userCoords, setUserCoords] = useState<LocationCoords | null>(null);
  const [locationDisabled, setLocationDisabled] = useState<boolean>(false);
  const [safeZones, setSafeZones] = useState<SafeZone[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<SafeZoneCategory | 'all'>('all');
  const [selectedZone, setSelectedZone] = useState<SafeZone | null>(null);
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Add Safe Shelter Modal State
  const [addModalVisible, setAddModalVisible] = useState<boolean>(false);
  const [newShelterName, setNewShelterName] = useState<string>('');
  const [newShelterAddress, setNewShelterAddress] = useState<string>('');
  const [newShelterPhone, setNewShelterPhone] = useState<string>('');
  const [newShelterLat, setNewShelterLat] = useState<number | null>(null);
  const [newShelterLng, setNewShelterLng] = useState<number | null>(null);
  const [isUsingLiveGps, setIsUsingLiveGps] = useState<boolean>(false);

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

  const handleUseCurrentLocationForShelter = async () => {
    try {
      const loc = userCoords || (await LocationService.getCurrentLocation());
      setNewShelterLat(loc.latitude);
      setNewShelterLng(loc.longitude);
      setIsUsingLiveGps(true);
      if (loc.address) {
        setNewShelterAddress(loc.address);
      } else {
        const city = loc.city || 'Local Area';
        setNewShelterAddress(`Near ${city} (${loc.latitude.toFixed(4)}, ${loc.longitude.toFixed(4)})`);
      }
    } catch (e) {
      Alert.alert('GPS Notice', 'Could not fetch current GPS coordinates.');
    }
  };

  const handleSaveCustomShelter = async () => {
    if (!newShelterName.trim()) {
      Alert.alert('Missing Name', 'Please enter a name for this Safe Shelter (e.g. "My Home", "Aunt Priya\'s House").');
      return;
    }

    const lat = newShelterLat ?? userCoords?.latitude ?? 18.5204;
    const lng = newShelterLng ?? userCoords?.longitude ?? 73.8567;
    const addr = newShelterAddress.trim() || `Coordinates: ${lat.toFixed(4)}, ${lng.toFixed(4)}`;

    const created = await SafeZoneService.addCustomShelter({
      name: newShelterName.trim(),
      address: addr,
      phone: newShelterPhone.trim() || '112',
      latitude: lat,
      longitude: lng,
      isOpen24Hours: true,
    });

    setAddModalVisible(false);
    setNewShelterName('');
    setNewShelterAddress('');
    setNewShelterPhone('');
    setNewShelterLat(null);
    setNewShelterLng(null);
    setIsUsingLiveGps(false);

    Alert.alert(
      'Safe Shelter Added!',
      `"${created.name}" is now saved as your trusted sanctuary. You can navigate directly to it with 1 tap anytime.`
    );

    // Reload safe zones list
    const updated = await SafeZoneService.getSafeZones(userCoords || undefined, selectedCategory);
    setSafeZones(updated);
    setSelectedZone(created);
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
          <View style={styles.headerButtonsRow}>
            <TouchableOpacity
              style={styles.addShelterHeaderBtn}
              onPress={() => {
                setAddModalVisible(true);
                handleUseCurrentLocationForShelter();
              }}
              activeOpacity={0.8}
            >
              <Text style={styles.addShelterHeaderBtnText}>➕ Add Shelter</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.refreshBtn} onPress={loadLocationAndZones}>
              <Text style={styles.refreshBtnText}>🔄</Text>
            </TouchableOpacity>
          </View>
        </View>

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
                      <Text style={styles.userShelterBadgeText}>YOUR SAFE HAVEN</Text>
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
                        ⭐ TRUSTED SHELTER
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
      </ScrollView>

      {/* --- ADD SAFE SHELTER MODAL --- */}
      <Modal
        visible={addModalVisible}
        animationType="slide"
        transparent
        onRequestClose={() => setAddModalVisible(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalBadge}>SAFE HAVEN DIRECTORY</Text>
                <Text style={styles.modalTitle}>Add Safe Shelter</Text>
              </View>
              <TouchableOpacity
                style={styles.modalCloseBtn}
                onPress={() => setAddModalVisible(false)}
              >
                <Text style={styles.modalCloseText}>✕</Text>
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              <Text style={styles.modalDesc}>
                Save your home, a relative's house, a gated society, or trusted sanctuary so you can direct yourself or others there instantly via live GPS navigation.
              </Text>

              {/* 1-Tap Use Current Location Button */}
              <TouchableOpacity
                style={[
                  styles.useGpsBtn,
                  isUsingLiveGps && styles.useGpsBtnActive,
                ]}
                onPress={handleUseCurrentLocationForShelter}
                activeOpacity={0.8}
              >
                <Text style={styles.useGpsIcon}>📍</Text>
                <Text style={styles.useGpsText}>
                  {isUsingLiveGps
                    ? '✓ Using Your Live GPS Coordinates'
                    : 'Use My Current Live Location'}
                </Text>
              </TouchableOpacity>

              {/* Shelter Name Input */}
              <Text style={styles.inputLabel}>SHELTER / SANCTUARY NAME *</Text>
              <TextInput
                style={styles.textInput}
                placeholder="e.g. My Home, Aunt Priya's Flat, Sakhi Hostel"
                placeholderTextColor={THEME.textLight}
                value={newShelterName}
                onChangeText={setNewShelterName}
              />

              {/* Address / Landmark Input */}
              <Text style={styles.inputLabel}>ADDRESS / LANDMARK *</Text>
              <TextInput
                style={[styles.textInput, { height: 60 }]}
                multiline
                placeholder="e.g. Building 4, Green Glen Layout, Main Road"
                placeholderTextColor={THEME.textLight}
                value={newShelterAddress}
                onChangeText={setNewShelterAddress}
              />

              {/* Contact Phone Input */}
              <Text style={styles.inputLabel}>CONTACT NUMBER (OPTIONAL)</Text>
              <TextInput
                style={styles.textInput}
                keyboardType="phone-pad"
                placeholder="e.g. +91 98765 43210"
                placeholderTextColor={THEME.textLight}
                value={newShelterPhone}
                onChangeText={setNewShelterPhone}
              />

              {/* Save Button */}
              <TouchableOpacity
                style={styles.saveShelterBtn}
                onPress={handleSaveCustomShelter}
                activeOpacity={0.85}
              >
                <Text style={styles.saveShelterBtnIcon}>💾</Text>
                <Text style={styles.saveShelterBtnText}>SAVE SAFE SHELTER</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>
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
  headerButtonsRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  addShelterHeaderBtn: {
    backgroundColor: '#8B5CF6',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 8,
  },
  addShelterHeaderBtnText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  refreshBtn: { backgroundColor: '#F1F5F9', paddingVertical: 6, paddingHorizontal: 10, borderRadius: 8 },
  refreshBtnText: { fontSize: 13, fontWeight: '700', color: THEME.secondary },
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
  userShelterSelectedCard: { borderColor: '#8B5CF6' },
  selectedZoneHeader: { flexDirection: 'row', marginBottom: 14 },
  selectedIconBg: { width: 48, height: 48, borderRadius: 14, backgroundColor: '#FEE2E2', justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  selectedZoneIcon: { fontSize: 22 },
  selectedZoneInfo: { flex: 1 },
  selectedTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  selectedZoneName: { fontSize: 16, fontWeight: '800', color: THEME.textPrimary, flex: 1 },
  verifiedBadge: { backgroundColor: THEME.safeGreenBg, paddingVertical: 2, paddingHorizontal: 6, borderRadius: 4 },
  verifiedBadgeText: { fontSize: 8, fontWeight: '800', color: THEME.safeGreen },
  userShelterBadge: { backgroundColor: '#F3E8FF', paddingVertical: 2, paddingHorizontal: 6, borderRadius: 4 },
  userShelterBadgeText: { fontSize: 8, fontWeight: '800', color: '#7C3AED' },
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
  userZoneCard: { borderColor: '#DDD6FE', backgroundColor: '#FAF5FF' },
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
  deleteShelterBtn: { padding: 6, marginRight: 4 },
  deleteShelterIcon: { fontSize: 14 },
  zoneQuickNav: { width: 32, height: 32, borderRadius: 16, backgroundColor: '#F1F5F9', justifyContent: 'center', alignItems: 'center', marginLeft: 4 },
  quickNavIcon: { fontSize: 14, color: THEME.secondary, fontWeight: '800' },

  // Modal Styles
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0, 0, 0, 0.65)', justifyContent: 'flex-end' },
  modalCard: { backgroundColor: '#FFFFFF', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 22, maxHeight: '85%' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  modalBadge: { fontSize: 10, fontWeight: '800', color: '#8B5CF6', letterSpacing: 0.8 },
  modalTitle: { fontSize: 20, fontWeight: '800', color: THEME.textPrimary, marginTop: 2 },
  modalCloseBtn: { width: 32, height: 32, borderRadius: 16, backgroundColor: '#F1F5F9', justifyContent: 'center', alignItems: 'center' },
  modalCloseText: { fontSize: 14, fontWeight: '700', color: THEME.textSecondary },
  modalDesc: { fontSize: 13, color: THEME.textSecondary, lineHeight: 18, marginBottom: 14 },
  useGpsBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#EDE9FE',
    borderWidth: 1.5,
    borderColor: '#8B5CF6',
    paddingVertical: 12,
    borderRadius: 12,
    marginBottom: 16,
    gap: 8,
  },
  useGpsBtnActive: { backgroundColor: '#8B5CF6' },
  useGpsIcon: { fontSize: 16 },
  useGpsText: { fontSize: 13, fontWeight: '700', color: '#6D28D9' },
  inputLabel: { fontSize: 11, fontWeight: '800', color: THEME.textSecondary, letterSpacing: 0.8, marginBottom: 6 },
  textInput: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: THEME.border,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 14,
    color: THEME.textPrimary,
    marginBottom: 14,
  },
  saveShelterBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#8B5CF6',
    paddingVertical: 14,
    borderRadius: 14,
    marginTop: 8,
    marginBottom: 20,
    gap: 8,
  },
  saveShelterBtnIcon: { fontSize: 16 },
  saveShelterBtnText: { color: '#FFFFFF', fontSize: 14, fontWeight: '800', letterSpacing: 0.5 },
});
