import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Alert,
  PanResponder,
  Modal,
  Dimensions,
  Animated,
  StatusBar,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { SafeZoneService } from '../services/safeZoneService';
import { LocationService } from '../services/locationService';
import { AlertService } from '../services/alertService';
import { SafeZone, SafeZoneCategory, LocationCoords } from '../types/index';
import { useTheme } from '../context/ThemeContext';
import { ThemeColors } from '../theme/colors';

const { width } = Dimensions.get('window');

const CATEGORIES: { id: SafeZoneCategory | 'all'; label: string; icon: string }[] = [
  { id: 'all', label: 'All', icon: '🌐' },
  { id: 'hospital', label: 'Hospitals', icon: '🏥' },
  { id: 'clinic', label: 'Clinics', icon: '🩺' },
  { id: 'police', label: 'Police', icon: '👮' },
  { id: 'shelter', label: 'Shelters', icon: '🏠' },
  { id: 'fire_station', label: 'Fire Dept', icon: '🚒' },
];

const QUICK_TAGS = [
  { label: 'Safe Haven', icon: '🛡️' },
  { label: 'My Home', icon: '🏠' },
  { label: 'High Ground', icon: '🏢' },
  { label: 'Evac Point', icon: '🚗' },
];

export default function SafeZonesScreen() {
  const { theme, isDark } = useTheme();
  const THEME = theme;
  const styles = useMemo(() => getStyles(theme), [theme]);

  const [loading, setLoading] = useState<boolean>(true);
  const [userCoords, setUserCoords] = useState<LocationCoords | null>(null);
  const [locationDisabled, setLocationDisabled] = useState<boolean>(false);
  const [safeZones, setSafeZones] = useState<SafeZone[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<SafeZoneCategory | 'all'>('all');
  const [selectedZone, setSelectedZone] = useState<SafeZone | null>(null);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [markingSpot, setMarkingSpot] = useState<boolean>(false);
  const [markModalVisible, setMarkModalVisible] = useState<boolean>(false);
  const [mapType, setMapType] = useState<'map' | 'satellite'>('map');
  const [mapZoom, setMapZoom] = useState<number>(1);
  const [panOffset, setPanOffset] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isDraggingMap, setIsDraggingMap] = useState<boolean>(false);

  const panOffsetRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const panStartRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  panOffsetRef.current = panOffset;

  // 2D Pan Responder for drag-to-pan map interaction
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onStartShouldSetPanResponderCapture: () => false,
      onMoveShouldSetPanResponder: (_, gs) => {
        return Math.abs(gs.dx) > 4 || Math.abs(gs.dy) > 4;
      },
      onMoveShouldSetPanResponderCapture: (_, gs) => {
        return Math.abs(gs.dx) > 4 || Math.abs(gs.dy) > 4;
      },
      onPanResponderGrant: () => {
        setIsDraggingMap(true);
        panStartRef.current = { ...panOffsetRef.current };
      },
      onPanResponderMove: (_, gs) => {
        setPanOffset({
          x: Math.round(panStartRef.current.x + gs.dx),
          y: Math.round(panStartRef.current.y + gs.dy),
        });
      },
      onPanResponderRelease: () => {
        setIsDraggingMap(false);
      },
      onPanResponderTerminate: () => {
        setIsDraggingMap(false);
      },
    })
  ).current;

  // Tactical Radar Animations
  const radarWaveAnim = useRef(new Animated.Value(0)).current;
  const userGpsPulseAnim = useRef(new Animated.Value(1)).current;
  const pinHaloAnim = useRef(new Animated.Value(1)).current;
  const screenFadeAnim = useRef(new Animated.Value(0)).current;
  const screenSlideAnim = useRef(new Animated.Value(14)).current;

  useEffect(() => {
    loadLocationAndZones();

    // Smooth screen entrance
    Animated.parallel([
      Animated.timing(screenFadeAnim, {
        toValue: 1,
        duration: 400,
        useNativeDriver: true,
      }),
      Animated.spring(screenSlideAnim, {
        toValue: 0,
        tension: 50,
        friction: 8,
        useNativeDriver: true,
      }),
    ]).start();

    // Tactical Radar Shockwave Wave Loop
    const radarWaveLoop = Animated.loop(
      Animated.timing(radarWaveAnim, {
        toValue: 1,
        duration: 2500,
        useNativeDriver: true,
      })
    );
    radarWaveLoop.start();

    // User GPS breathing dot loop
    const userGpsPulseLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(userGpsPulseAnim, {
          toValue: 1.4,
          duration: 1000,
          useNativeDriver: true,
        }),
        Animated.timing(userGpsPulseAnim, {
          toValue: 1,
          duration: 1000,
          useNativeDriver: true,
        }),
      ])
    );
    userGpsPulseLoop.start();

    // Selected Pin Halo Breathing Loop
    const pinHaloLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(pinHaloAnim, {
          toValue: 1.35,
          duration: 900,
          useNativeDriver: true,
        }),
        Animated.timing(pinHaloAnim, {
          toValue: 1,
          duration: 900,
          useNativeDriver: true,
        }),
      ])
    );
    pinHaloLoop.start();

    return () => {
      radarWaveLoop.stop();
      userGpsPulseLoop.stop();
      pinHaloLoop.stop();
    };
  }, []);

  useEffect(() => {
    filterZones();
  }, [selectedCategory, searchQuery, userCoords]);

  const loadLocationAndZones = async () => {
    setLoading(true);
    try {
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
    AlertService.triggerHaptic();
    SafeZoneService.openNavigation(zone, userCoords || undefined);
  };

  const focusPlaceOnMap = (zone: SafeZone) => {
    AlertService.triggerHaptic();
    setSelectedZone(zone);
    if (userCoords && zone.latitude && zone.longitude) {
      const dLatKm = (zone.latitude - userCoords.latitude) * 111.0;
      const dLonKm =
        (zone.longitude - userCoords.longitude) *
        111.0 *
        Math.cos((userCoords.latitude * Math.PI) / 180);
      const scale = 32 * mapZoom;
      const targetPanX = Math.round(-dLonKm * scale);
      const targetPanY = Math.round(dLatKm * scale);
      setPanOffset({ x: targetPanX, y: targetPanY });
      panOffsetRef.current = { x: targetPanX, y: targetPanY };
    }
  };

  const handleCall = (phone: string) => {
    AlertService.triggerHaptic();
    SafeZoneService.callSafeZone(phone);
  };

  const handleInstantMarkCurrentLocation = async (presetLabel: string = 'Safe Haven') => {
    setMarkingSpot(true);
    try {
      AlertService.triggerHaptic();
      const loc = userCoords || (await LocationService.getCurrentLocation());
      setUserCoords(loc);

      const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      const locality = loc.subLocality || loc.city || 'Emergency Point';
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

      const updated = await SafeZoneService.getSafeZones(loc, selectedCategory);
      setSafeZones(updated);
      setSelectedZone(created);
      setMarkModalVisible(false);

      Alert.alert(
        '✅ Safe Spot Pinned',
        `Pinned: ${shelterName}\n\nStored securely on local database. You and your family can navigate directly here anytime.`
      );
    } catch {
      Alert.alert('GPS Notice', 'Could not acquire GPS fix to pin safe spot.');
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
      return { bg: THEME.purpleBg, text: THEME.purple, icon: '⭐' };
    }
    switch (category) {
      case 'hospital':
        return { bg: THEME.blueBg, text: THEME.blue, icon: '🏥' };
      case 'clinic':
        return { bg: THEME.tealBg, text: THEME.teal, icon: '🩺' };
      case 'police':
        return { bg: THEME.amberBg, text: THEME.amber, icon: '👮' };
      case 'shelter':
        return { bg: THEME.emeraldBg, text: THEME.emerald, icon: '🏠' };
      case 'fire_station':
        return { bg: 'rgba(239, 68, 68, 0.15)', text: THEME.primary, icon: '🚒' };
      default:
        return { bg: THEME.cardElevated, text: THEME.textSecondary, icon: '📍' };
    }
  };

  const getGooglePinStyle = (category: SafeZoneCategory, isUserAdded?: boolean) => {
    if (isUserAdded) {
      return { pinColor: '#8B5CF6', icon: '🛡️', label: 'Safe Haven' };
    }
    switch (category) {
      case 'hospital':
        return { pinColor: '#3B82F6', icon: '🏥', label: 'Hospital' };
      case 'clinic':
        return { pinColor: '#0D9488', icon: '🩺', label: 'Clinic' };
      case 'police':
        return { pinColor: '#F59E0B', icon: '👮', label: 'Police' };
      case 'shelter':
        return { pinColor: '#10B981', icon: '🏠', label: 'Shelter' };
      case 'fire_station':
        return { pinColor: '#EF4444', icon: '🚒', label: 'Fire Dept' };
      default:
        return { pinColor: '#EF4444', icon: '📍', label: 'Safe Zone' };
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={THEME.blue} />
        <Text style={styles.loadingText}>Acquiring GPS Radar & Verified Facilities...</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <StatusBar barStyle={theme.statusBarStyle} backgroundColor={theme.background} />
      {/* ========================================================
          1. TOP COMMAND BAR: TITLE, LOCATION & ACTIONS
      ======================================================== */}
      <View style={styles.topBar}>
        <View style={styles.topBarLeftCol}>
          <Text style={styles.topBarTag}>
            {isDark ? 'TACTICAL HAVEN RADAR' : 'VERIFIED SAFE HAVENS'}
          </Text>
          <Text style={styles.topBarLocation} numberOfLines={1}>
            {userCoords
              ? `📍 ${LocationService.formatLocationName(userCoords)}`
              : 'GPS Standby'}
          </Text>
        </View>

        <View style={styles.topBarRightRow}>
          <TouchableOpacity
            style={styles.markHavenHeaderBtn}
            onPress={() => setMarkModalVisible(true)}
            activeOpacity={0.8}
          >
            <Text style={styles.markHavenHeaderIcon}>➕</Text>
            <Text style={styles.markHavenHeaderText}>Pin Spot</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.refreshHeaderBtn}
            onPress={loadLocationAndZones}
            activeOpacity={0.8}
          >
            <Text style={styles.refreshHeaderText}>🔄</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Main Body Scroll */}
      <ScrollView
        style={styles.mainScrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        nestedScrollEnabled={true}
        keyboardShouldPersistTaps="handled"
        bounces={true}
        scrollEnabled={!isDraggingMap}
      >
        <Animated.View style={{ flex: 1, opacity: screenFadeAnim, transform: [{ translateY: screenSlideAnim }] }}>
        {/* GPS Disabled Alert */}
        {locationDisabled && (
          <TouchableOpacity
            style={styles.gpsDisabledBanner}
            onPress={() => LocationService.openLocationSettings()}
            activeOpacity={0.8}
          >
            <Text style={styles.gpsDisabledIcon}>⚠️</Text>
            <View style={styles.gpsDisabledTextCol}>
              <Text style={styles.gpsDisabledTitle}>Device Location / GPS is OFF</Text>
              <Text style={styles.gpsDisabledSub}>Tap here to enable location for live turn-by-turn routing</Text>
            </View>
            <Text style={styles.gpsDisabledArrow}>⚙️</Text>
          </TouchableOpacity>
        )}

        {/* ========================================================
            2. SEARCH & CATEGORY MATRIX
        ======================================================== */}
        <View style={styles.searchBarContainer}>
          <Text style={styles.searchIcon}>🔍</Text>
          <TextInput
            style={styles.searchInput}
            placeholder="Search hospitals, clinics, police, shelters..."
            placeholderTextColor={THEME.textMuted}
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery('')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Text style={styles.clearSearchIcon}>✕</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Category Horizontal Filter Chips */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.categoryChipsScroll}
        >
          {CATEGORIES.map((cat) => {
            const isSelected = selectedCategory === cat.id;
            return (
              <TouchableOpacity
                key={cat.id}
                style={[
                  styles.categoryFilterChip,
                  isSelected && styles.categoryFilterChipActive,
                ]}
                onPress={() => {
                  AlertService.triggerHaptic();
                  setSelectedCategory(cat.id);
                }}
                activeOpacity={0.75}
              >
                <Text style={styles.categoryFilterIcon}>{cat.icon}</Text>
                <Text
                  style={[
                    styles.categoryFilterText,
                    isSelected && styles.categoryFilterTextActive,
                  ]}
                >
                  {cat.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {/* ========================================================
            3. INTERACTIVE MAP & ROUTE RADAR CONSOLE
        ======================================================== */}
        <View style={styles.mapConsoleCard}>
          {/* Map Console Top Controller */}
          <View style={styles.mapConsoleHeader}>
            <View style={styles.mapModeToggle}>
              <TouchableOpacity
                style={[styles.mapModeBtn, mapType === 'map' && styles.mapModeBtnActive]}
                onPress={() => setMapType('map')}
                activeOpacity={0.8}
              >
                <Text style={[styles.mapModeText, mapType === 'map' && styles.mapModeTextActive]}>
                  🗺️ Map
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.mapModeBtn, mapType === 'satellite' && styles.mapModeBtnActive]}
                onPress={() => setMapType('satellite')}
                activeOpacity={0.8}
              >
                <Text style={[styles.mapModeText, mapType === 'satellite' && styles.mapModeTextActive]}>
                  🛰️ Satellite
                </Text>
              </TouchableOpacity>
            </View>

            <View style={styles.mapControlsRow}>
              {/* Zoom Controls */}
              <TouchableOpacity
                style={styles.mapToolBtn}
                onPress={() => setMapZoom((prev) => Math.min(2.0, Number((prev + 0.25).toFixed(2))))}
                activeOpacity={0.7}
              >
                <Text style={styles.mapToolBtnText}>＋</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.mapToolBtn}
                onPress={() => setMapZoom((prev) => Math.max(0.75, Number((prev - 0.25).toFixed(2))))}
                activeOpacity={0.7}
              >
                <Text style={styles.mapToolBtnText}>−</Text>
              </TouchableOpacity>

              {/* Recenter Button */}
              <TouchableOpacity
                style={[styles.mapToolBtn, styles.mapRecenterBtn]}
                onPress={() => {
                  AlertService.triggerHaptic();
                  setPanOffset({ x: 0, y: 0 });
                  panOffsetRef.current = { x: 0, y: 0 };
                  setMapZoom(1);
                }}
                activeOpacity={0.7}
              >
                <Text style={styles.mapRecenterIcon}>⌖</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Interactive Tactical Canvas */}
          <View
            style={[
              styles.tacticalCanvas,
              mapType === 'satellite' ? styles.canvasSatellite : styles.canvasDefault,
            ]}
            {...panResponder.panHandlers}
          >
            {(() => {
              const originX = 165;
              const originY = 140;
              const centerX = originX + panOffset.x;
              const centerY = originY + panOffset.y;
              const baseScale = 32 * mapZoom;

              // 1. Calculate projected coordinates
              const renderedPlaces = safeZones.slice(0, 25).map((zone) => {
                let rawX = originX;
                let rawY = originY;

                if (userCoords && zone.latitude && zone.longitude) {
                  const dLatKm = (zone.latitude - userCoords.latitude) * 111.0;
                  const dLonKm =
                    (zone.longitude - userCoords.longitude) *
                    111.0 *
                    Math.cos((userCoords.latitude * Math.PI) / 180);
                  rawX = originX + panOffset.x + dLonKm * baseScale;
                  rawY = originY + panOffset.y - dLatKm * baseScale;
                } else if (zone.distanceKm !== undefined) {
                  const hash = Math.abs(zone.name.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0));
                  const angle = (hash % 360) * (Math.PI / 180);
                  const distPixels = Math.min(180, zone.distanceKm * 28 * mapZoom);
                  rawX = originX + panOffset.x + Math.cos(angle) * distPixels;
                  rawY = originY + panOffset.y + Math.sin(angle) * distPixels;
                }
                return { zone, rawX, rawY };
              });

              // 2. Spiderfy clustering
              const CLUSTER_RADIUS = 28;
              const clusters: (typeof renderedPlaces)[] = [];

              for (const item of renderedPlaces) {
                let placed = false;
                for (const cluster of clusters) {
                  const leader = cluster[0];
                  const dist = Math.hypot(item.rawX - leader.rawX, item.rawY - leader.rawY);
                  if (dist < CLUSTER_RADIUS) {
                    cluster.push(item);
                    placed = true;
                    break;
                  }
                }
                if (!placed) clusters.push([item]);
              }

              const pinPositions = new Map<string, { posX: number; posY: number }>();
              for (const cluster of clusters) {
                if (cluster.length === 1) {
                  pinPositions.set(cluster[0].zone.id, {
                    posX: cluster[0].rawX,
                    posY: cluster[0].rawY,
                  });
                } else {
                  const count = cluster.length;
                  const fanRadius = 26 + Math.min(count * 2.5, 16);
                  cluster.forEach((item, idx) => {
                    const angle = (idx / count) * 2 * Math.PI - Math.PI / 2;
                    pinPositions.set(item.zone.id, {
                      posX: item.rawX + Math.cos(angle) * fanRadius,
                      posY: item.rawY + Math.sin(angle) * fanRadius,
                    });
                  });
                }
              }

              return (
                <>
                  {/* Range rings centered at live GPS position */}
                  <View
                    style={[
                      styles.tacticalRing,
                      {
                        left: centerX,
                        top: centerY,
                        width: 90 * mapZoom,
                        height: 90 * mapZoom,
                        borderRadius: 45 * mapZoom,
                        transform: [{ translateX: -45 * mapZoom }, { translateY: -45 * mapZoom }],
                      },
                    ]}
                  />
                  <View
                    style={[
                      styles.tacticalRing,
                      {
                        left: centerX,
                        top: centerY,
                        width: 180 * mapZoom,
                        height: 180 * mapZoom,
                        borderRadius: 90 * mapZoom,
                        transform: [{ translateX: -90 * mapZoom }, { translateY: -90 * mapZoom }],
                      },
                    ]}
                  />
                  <View
                    style={[
                      styles.tacticalRing,
                      {
                        left: centerX,
                        top: centerY,
                        width: 270 * mapZoom,
                        height: 270 * mapZoom,
                        borderRadius: 135 * mapZoom,
                        transform: [{ translateX: -135 * mapZoom }, { translateY: -135 * mapZoom }],
                      },
                    ]}
                  />

                  {/* Animated Expanding Tactical Radar Wave */}
                  <Animated.View
                    style={[
                      styles.tacticalRadarWave,
                      {
                        left: centerX,
                        top: centerY,
                        transform: [
                          { translateX: -60 * mapZoom },
                          { translateY: -60 * mapZoom },
                          {
                            scale: radarWaveAnim.interpolate({
                              inputRange: [0, 1],
                              outputRange: [0.4, 2.6],
                            }),
                          },
                        ],
                        opacity: radarWaveAnim.interpolate({
                          inputRange: [0, 0.4, 0.8, 1],
                          outputRange: [0.75, 0.4, 0.12, 0],
                        }),
                      },
                    ]}
                  />

                  {/* Range Labels */}
                  <Text style={[styles.tacticalRingLabel, { left: centerX + 4, top: centerY - 45 * mapZoom - 8 }]}>1km</Text>
                  <Text style={[styles.tacticalRingLabel, { left: centerX + 4, top: centerY - 90 * mapZoom - 8 }]}>3km</Text>
                  <Text style={[styles.tacticalRingLabel, { left: centerX + 4, top: centerY - 135 * mapZoom - 8 }]}>5km</Text>

                  {/* Live User Anchor with Breathing Sonar Pulse Dot */}
                  <View style={[styles.userAnchorWrapper, { left: centerX - 12, top: centerY - 12 }]}>
                    <Animated.View
                      style={[
                        styles.userPulseRing,
                        {
                          transform: [{ scale: userGpsPulseAnim }],
                          opacity: userGpsPulseAnim.interpolate({
                            inputRange: [1, 1.4],
                            outputRange: [0.85, 0.2],
                          }),
                        },
                      ]}
                    />
                    <View style={styles.userCoreDot} />
                  </View>

                  {/* Dynamic Facility Pins */}
                  {renderedPlaces.map(({ zone }) => {
                    const pinStyle = getGooglePinStyle(zone.category, zone.isUserAdded);
                    const isSelected = selectedZone?.id === zone.id;
                    const pos = pinPositions.get(zone.id) || { posX: originX, posY: originY };

                    if (pos.posX < -100 || pos.posX > 450 || pos.posY < -100 || pos.posY > 400) {
                      return null;
                    }

                    return (
                      <View
                        key={zone.id}
                        style={[
                          styles.markerAnchor,
                          {
                            left: pos.posX - 14,
                            top: pos.posY - 32,
                            zIndex: isSelected ? 60 : 10,
                          },
                        ]}
                      >
                        {/* Callout Bubble for focused place */}
                        {isSelected && (
                          <View style={styles.markerCallout}>
                            <Text style={styles.markerCalloutTitle} numberOfLines={1}>
                              {zone.name}
                            </Text>
                            <Text style={styles.markerCalloutDist}>
                              {zone.distanceKm !== undefined
                                ? `${zone.distanceKm < 1 ? `${Math.round(zone.distanceKm * 1000)}m` : `${zone.distanceKm.toFixed(1)}km`} • Tap Route below`
                                : 'Nearby facility'}
                            </Text>
                            <View style={styles.markerCalloutArrow} />
                          </View>
                        )}

                        {/* Selected Pin Halo Beacon */}
                        {isSelected && (
                          <Animated.View
                            style={[
                              styles.pinHaloRing,
                              {
                                backgroundColor: pinStyle.pinColor,
                                transform: [{ scale: pinHaloAnim }],
                                opacity: pinHaloAnim.interpolate({
                                  inputRange: [1, 1.35],
                                  outputRange: [0.6, 0.1],
                                }),
                              },
                            ]}
                          />
                        )}

                        {/* Interactive Teardrop Pin */}
                        <TouchableOpacity
                          style={[
                            styles.teardropPin,
                            isSelected && styles.teardropPinSelected,
                            { backgroundColor: pinStyle.pinColor },
                          ]}
                          onPress={() => focusPlaceOnMap(zone)}
                          activeOpacity={0.8}
                        >
                          <Text style={styles.teardropIcon}>{pinStyle.icon}</Text>
                        </TouchableOpacity>
                      </View>
                    );
                  })}
                </>
              );
            })()}
          </View>

          {/* Minimalist Live Route & ETA Action Bar */}
          {selectedZone && (
            <View style={styles.activeRouteBar}>
              <View style={styles.activeRouteInfo}>
                <View style={styles.activeRouteTitleRow}>
                  <Text style={styles.activeRouteName} numberOfLines={1}>
                    {selectedZone.name}
                  </Text>
                  <View style={styles.activeRouteEtaBadge}>
                    <Text style={styles.activeRouteEtaText}>
                      ⏱️ {Math.max(2, Math.round((selectedZone.distanceKm ?? 1) * 3.5))} min
                    </Text>
                  </View>
                </View>
                <Text style={styles.activeRouteDist} numberOfLines={1}>
                  📍 {selectedZone.distanceKm !== undefined ? `${selectedZone.distanceKm.toFixed(1)} km away` : 'Nearby'} • {selectedZone.address}
                </Text>
              </View>

              <TouchableOpacity
                style={styles.startNavigationBtn}
                onPress={() => handleNavigate(selectedZone)}
                activeOpacity={0.85}
              >
                <Text style={styles.startNavIcon}>▶</Text>
                <Text style={styles.startNavText}>NAVIGATE</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>

        {/* ========================================================
            4. QUICK-FOCUSED HORIZONTAL CAROUSEL
        ======================================================== */}
        <View style={styles.carouselSection}>
          <Text style={styles.sectionHeaderTitle}>VERIFIED HAVENS IN VICINITY ({safeZones.length})</Text>

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.carouselDeck}
          >
            {safeZones.slice(0, 8).map((zone) => {
              const catColor = getCategoryColor(zone.category, zone.isUserAdded);
              const isSelected = selectedZone?.id === zone.id;

              return (
                <TouchableOpacity
                  key={`carousel-${zone.id}`}
                  style={[styles.carouselCard, isSelected && styles.carouselCardSelected]}
                  onPress={() => focusPlaceOnMap(zone)}
                  activeOpacity={0.8}
                >
                  <View style={styles.carouselCardTop}>
                    <View style={[styles.carouselIconBadge, { backgroundColor: catColor.bg }]}>
                      <Text style={styles.carouselIcon}>{catColor.icon}</Text>
                    </View>
                    <View style={styles.carouselDistPill}>
                      <Text style={styles.carouselDistText}>
                        {zone.distanceKm !== undefined
                          ? zone.distanceKm < 1
                            ? `${Math.round(zone.distanceKm * 1000)}m`
                            : `${zone.distanceKm.toFixed(1)}km`
                          : 'Near'}
                      </Text>
                    </View>
                  </View>

                  <Text style={styles.carouselTitle} numberOfLines={1}>
                    {zone.name}
                  </Text>
                  <Text style={styles.carouselAddress} numberOfLines={1}>
                    {zone.address}
                  </Text>

                  <View style={styles.carouselFooter}>
                    <Text style={[styles.carouselActionText, isSelected && { color: THEME.blue }]}>
                      {isSelected ? '✓ FOCUSED' : 'Tap to Focus ➔'}
                    </Text>
                  </View>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>

        {/* ========================================================
            5. STRUCTURED PLACES DIRECTORY (LIST TILES)
        ======================================================== */}
        <View style={styles.directorySection}>
          <Text style={styles.sectionHeaderTitle}>FACILITY DIRECTORY</Text>

          {safeZones.length === 0 ? (
            <View style={styles.emptyStateCard}>
              <Text style={styles.emptyIcon}>🛡️</Text>
              <Text style={styles.emptyTitle}>No facilities found in this filter</Text>
              <Text style={styles.emptySub}>Try searching for another landmark or select "All".</Text>
            </View>
          ) : (
            safeZones.map((zone) => {
              const catColor = getCategoryColor(zone.category, zone.isUserAdded);
              const isSelected = selectedZone?.id === zone.id;

              return (
                <View
                  key={zone.id}
                  style={[styles.facilityTile, isSelected && styles.facilityTileSelected]}
                >
                  <View style={styles.facilityMainRow}>
                    <View style={[styles.facilityIconCircle, { backgroundColor: catColor.bg }]}>
                      <Text style={styles.facilityEmoji}>{catColor.icon}</Text>
                    </View>

                    <View style={styles.facilityContentCol}>
                      <View style={styles.facilityTitleRow}>
                        <Text style={styles.facilityName} numberOfLines={1}>
                          {zone.name}
                        </Text>
                        {zone.isUserAdded && (
                          <TouchableOpacity
                            onPress={() => handleDeleteShelter(zone.id, zone.name)}
                            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                          >
                            <Text style={styles.deleteShelterText}>✕</Text>
                          </TouchableOpacity>
                        )}
                      </View>

                      <Text style={styles.facilityAddress} numberOfLines={2}>
                        {zone.address}
                      </Text>

                      <View style={styles.facilityMetaRow}>
                        <View style={styles.facilityMetaPill}>
                          <Text style={styles.facilityMetaPillText}>
                            📍 {zone.distanceKm !== undefined ? `${zone.distanceKm.toFixed(1)} km` : 'Nearby'}
                          </Text>
                        </View>
                        {zone.isOpen24Hours && (
                          <View style={styles.facility247Pill}>
                            <Text style={styles.facility247Text}>24/7 OPEN</Text>
                          </View>
                        )}
                        {zone.verified && (
                          <View style={styles.verifiedShieldPill}>
                            <Text style={styles.verifiedShieldText}>VERIFIED</Text>
                          </View>
                        )}
                      </View>
                    </View>
                  </View>

                  {/* Action Buttons: Navigate & Call */}
                  <View style={styles.facilityActionsRow}>
                    <TouchableOpacity
                      style={styles.facilityFocusBtn}
                      onPress={() => focusPlaceOnMap(zone)}
                      activeOpacity={0.8}
                    >
                      <Text style={styles.facilityFocusText}>🗺️ Focus on Radar</Text>
                    </TouchableOpacity>

                    {zone.phone && zone.phone !== '112' && (
                      <TouchableOpacity
                        style={styles.facilityCallBtn}
                        onPress={() => handleCall(zone.phone)}
                        activeOpacity={0.8}
                      >
                        <Text style={styles.facilityCallText}>📞 Call</Text>
                      </TouchableOpacity>
                    )}

                    <TouchableOpacity
                      style={styles.facilityRouteBtn}
                      onPress={() => handleNavigate(zone)}
                      activeOpacity={0.85}
                    >
                      <Text style={styles.facilityRouteText}>🧭 Route ➔</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              );
            })
          )}
        </View>

        <View style={{ height: 40 }} />
        </Animated.View>
      </ScrollView>

      {/* ========================================================
          6. MODAL: 1-TAP INSTANT SAFE SPOT PINNING
      ======================================================== */}
      <Modal
        visible={markModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setMarkModalVisible(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.markModalCard}>
            <View style={styles.markModalHeader}>
              <View>
                <Text style={styles.markModalTitle}>📍 Pin Safe Spot at Current GPS</Text>
                <Text style={styles.markModalSub}>Instant zero-typing disaster shelter bookmarking</Text>
              </View>
              <TouchableOpacity onPress={() => setMarkModalVisible(false)}>
                <Text style={styles.markModalClose}>✕</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.gpsSnapshotBox}>
              <Text style={styles.gpsSnapshotLabel}>CURRENT GPS FIX</Text>
              <Text style={styles.gpsSnapshotCoords}>
                {userCoords
                  ? `${userCoords.latitude.toFixed(4)}, ${userCoords.longitude.toFixed(4)} • ${userCoords.subLocality || userCoords.city || 'Live Location'}`
                  : 'Acquiring GPS fix...'}
              </Text>
            </View>

            <Text style={styles.instantTagHeading}>SELECT PRESET TO PIN IMMEDIATELY:</Text>
            <View style={styles.instantTagsGrid}>
              {QUICK_TAGS.map((tag) => (
                <TouchableOpacity
                  key={tag.label}
                  style={styles.instantTagButton}
                  onPress={() => handleInstantMarkCurrentLocation(tag.label)}
                  disabled={markingSpot}
                  activeOpacity={0.8}
                >
                  <Text style={styles.instantTagEmoji}>{tag.icon}</Text>
                  <Text style={styles.instantTagLabel}>{tag.label}</Text>
                </TouchableOpacity>
              ))}
            </View>

            {markingSpot && (
              <View style={styles.markingProgressRow}>
                <ActivityIndicator size="small" color={THEME.blue} />
                <Text style={styles.markingProgressText}>Writing to encrypted local SQLite database...</Text>
              </View>
            )}
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const getStyles = (THEME: ThemeColors) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: THEME.background,
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: THEME.background,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  loadingText: {
    fontSize: 13,
    fontWeight: '700',
    color: THEME.textSecondary,
  },
  mainScrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 40,
  },

  // Top Bar
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: THEME.cardBorder,
  },
  topBarLeftCol: {
    flex: 1,
  },
  topBarTag: {
    fontSize: 9,
    fontWeight: '900',
    color: THEME.emerald,
    letterSpacing: 1,
  },
  topBarLocation: {
    fontSize: 14,
    fontWeight: '800',
    color: THEME.textPrimary,
    marginTop: 1,
  },
  topBarRightRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  markHavenHeaderBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: THEME.emeraldBg,
    borderWidth: 1,
    borderColor: THEME.emeraldBorder,
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: 8,
    gap: 4,
  },
  markHavenHeaderIcon: {
    fontSize: 10,
  },
  markHavenHeaderText: {
    fontSize: 11,
    fontWeight: '800',
    color: THEME.emerald,
  },
  refreshHeaderBtn: {
    backgroundColor: THEME.cardElevated,
    paddingVertical: 5,
    paddingHorizontal: 9,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: THEME.cardBorder,
  },
  refreshHeaderText: {
    fontSize: 12,
  },

  // GPS Disabled Warning
  gpsDisabledBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.35)',
    borderRadius: 12,
    padding: 10,
    marginBottom: 12,
    gap: 10,
  },
  gpsDisabledIcon: {
    fontSize: 18,
  },
  gpsDisabledTextCol: {
    flex: 1,
  },
  gpsDisabledTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: '#FCA5A5',
  },
  gpsDisabledSub: {
    fontSize: 10,
    color: THEME.textSecondary,
    marginTop: 1,
  },
  gpsDisabledArrow: {
    fontSize: 16,
  },

  // Search Bar
  searchBarContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: THEME.cardBg,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: THEME.cardBorder,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginBottom: 12,
  },
  searchIcon: {
    fontSize: 14,
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 13,
    color: THEME.textPrimary,
    padding: 0,
  },
  clearSearchIcon: {
    fontSize: 14,
    color: THEME.textMuted,
    paddingHorizontal: 4,
  },

  // Category Filter Chips
  categoryChipsScroll: {
    gap: 6,
    marginBottom: 16,
  },
  categoryFilterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: THEME.cardBg,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: THEME.cardBorder,
    paddingVertical: 6,
    paddingHorizontal: 10,
    gap: 5,
  },
  categoryFilterChipActive: {
    backgroundColor: THEME.cardElevated,
    borderColor: THEME.blue,
  },
  categoryFilterIcon: {
    fontSize: 12,
  },
  categoryFilterText: {
    fontSize: 11,
    fontWeight: '700',
    color: THEME.textSecondary,
  },
  categoryFilterTextActive: {
    color: THEME.textPrimary,
    fontWeight: '800',
  },

  // Map Console Card
  mapConsoleCard: {
    backgroundColor: THEME.cardBg,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: THEME.cardBorder,
    overflow: 'hidden',
    marginBottom: 20,
  },
  mapConsoleHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: THEME.cardBorder,
  },
  mapModeToggle: {
    flexDirection: 'row',
    backgroundColor: THEME.cardElevated,
    borderRadius: 8,
    padding: 2,
    gap: 2,
  },
  mapModeBtn: {
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 6,
  },
  mapModeBtnActive: {
    backgroundColor: '#1E293B',
  },
  mapModeText: {
    fontSize: 10,
    fontWeight: '700',
    color: THEME.textMuted,
  },
  mapModeTextActive: {
    color: THEME.textPrimary,
    fontWeight: '800',
  },
  mapControlsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  mapToolBtn: {
    width: 28,
    height: 28,
    borderRadius: 6,
    backgroundColor: THEME.cardElevated,
    borderWidth: 1,
    borderColor: THEME.cardBorder,
    alignItems: 'center',
    justifyContent: 'center',
  },
  mapToolBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: THEME.textPrimary,
  },
  mapRecenterBtn: {
    backgroundColor: THEME.blueBg,
    borderColor: THEME.blueBorder,
  },
  mapRecenterIcon: {
    fontSize: 14,
    color: THEME.blue,
    fontWeight: '800',
  },

  // Tactical Canvas
  tacticalCanvas: {
    width: '100%',
    height: 260,
    position: 'relative',
    overflow: 'hidden',
  },
  canvasDefault: {
    backgroundColor: THEME.mapCanvas,
  },
  canvasSatellite: {
    backgroundColor: THEME.mapSatelliteCanvas,
  },
  tacticalRing: {
    position: 'absolute',
    borderWidth: 1,
    borderColor: THEME.radarGrid,
    borderStyle: 'dashed',
  },
  tacticalRingLabel: {
    position: 'absolute',
    fontSize: 8,
    fontWeight: '800',
    color: THEME.blue,
    letterSpacing: 0.5,
  },
  userAnchorWrapper: {
    position: 'absolute',
    width: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 40,
  },
  userPulseRing: {
    position: 'absolute',
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: THEME.blueBg,
  },
  userCoreDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: THEME.blue,
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  markerAnchor: {
    position: 'absolute',
    alignItems: 'center',
    width: 28,
    height: 32,
  },
  markerCallout: {
    position: 'absolute',
    bottom: 36,
    backgroundColor: THEME.cardElevated,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: THEME.blue,
    paddingHorizontal: 8,
    paddingVertical: 5,
    minWidth: 140,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.4,
    shadowRadius: 6,
    elevation: 8,
  },
  markerCalloutTitle: {
    fontSize: 11,
    fontWeight: '800',
    color: THEME.textPrimary,
  },
  markerCalloutDist: {
    fontSize: 9,
    color: THEME.blue,
    marginTop: 1,
  },
  markerCalloutArrow: {
    position: 'absolute',
    bottom: -6,
    width: 0,
    height: 0,
    borderLeftWidth: 6,
    borderRightWidth: 6,
    borderTopWidth: 6,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    borderTopColor: THEME.cardElevated,
  },
  teardropPin: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOpacity: 0.35,
    shadowRadius: 4,
    elevation: 6,
  },
  teardropPinSelected: {
    transform: [{ scale: 1.25 }],
    borderColor: '#38BDF8',
    borderWidth: 3,
  },
  pinHaloRing: {
    position: 'absolute',
    top: -4,
    left: -4,
    width: 36,
    height: 36,
    borderRadius: 18,
  },
  tacticalRadarWave: {
    position: 'absolute',
    width: 120,
    height: 120,
    borderRadius: 60,
    borderWidth: 1.5,
    borderColor: '#38BDF8',
    backgroundColor: 'rgba(56, 189, 248, 0.08)',
  },
  teardropIcon: {
    fontSize: 13,
  },

  // Active Route Bar
  activeRouteBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: THEME.cardElevated,
    borderTopWidth: 1,
    borderTopColor: THEME.cardBorder,
    padding: 12,
    gap: 10,
  },
  activeRouteInfo: {
    flex: 1,
  },
  activeRouteTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 2,
  },
  activeRouteName: {
    flex: 1,
    fontSize: 13,
    fontWeight: '800',
    color: THEME.textPrimary,
  },
  activeRouteEtaBadge: {
    backgroundColor: THEME.emeraldBg,
    paddingVertical: 2,
    paddingHorizontal: 6,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: THEME.emeraldBorder,
  },
  activeRouteEtaText: {
    fontSize: 10,
    fontWeight: '800',
    color: THEME.emerald,
  },
  activeRouteDist: {
    fontSize: 10,
    color: THEME.textSecondary,
  },
  startNavigationBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: THEME.blue,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    gap: 5,
  },
  startNavIcon: {
    fontSize: 10,
    color: '#FFFFFF',
  },
  startNavText: {
    fontSize: 11,
    fontWeight: '900',
    color: '#FFFFFF',
    letterSpacing: 0.5,
  },

  // Carousel
  carouselSection: {
    marginBottom: 20,
  },
  sectionHeaderTitle: {
    fontSize: 10,
    fontWeight: '800',
    color: THEME.textSecondary,
    letterSpacing: 1.2,
    marginBottom: 10,
    textTransform: 'uppercase',
  },
  carouselDeck: {
    gap: 10,
    paddingRight: 16,
  },
  carouselCard: {
    width: width * 0.48,
    backgroundColor: THEME.cardBg,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: THEME.cardBorder,
    padding: 12,
  },
  carouselCardSelected: {
    borderColor: THEME.blue,
    backgroundColor: THEME.cardElevated,
  },
  carouselCardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  carouselIconBadge: {
    width: 28,
    height: 28,
    borderRadius: 7,
    alignItems: 'center',
    justifyContent: 'center',
  },
  carouselIcon: {
    fontSize: 13,
  },
  carouselDistPill: {
    backgroundColor: THEME.cardElevated,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  carouselDistText: {
    fontSize: 9,
    fontWeight: '700',
    color: THEME.textSecondary,
  },
  carouselTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: THEME.textPrimary,
    marginBottom: 2,
  },
  carouselAddress: {
    fontSize: 10,
    color: THEME.textMuted,
    lineHeight: 14,
    marginBottom: 8,
  },
  carouselFooter: {
    borderTopWidth: 1,
    borderTopColor: THEME.divider,
    paddingTop: 6,
  },
  carouselActionText: {
    fontSize: 10,
    fontWeight: '700',
    color: THEME.textSecondary,
  },

  // Directory Section
  directorySection: {
    marginBottom: 20,
  },
  emptyStateCard: {
    backgroundColor: THEME.cardBg,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: THEME.cardBorder,
    padding: 24,
    alignItems: 'center',
  },
  emptyIcon: {
    fontSize: 28,
    marginBottom: 8,
  },
  emptyTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: THEME.textPrimary,
    marginBottom: 4,
  },
  emptySub: {
    fontSize: 11,
    color: THEME.textSecondary,
    textAlign: 'center',
  },
  facilityTile: {
    backgroundColor: THEME.cardBg,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: THEME.cardBorder,
    padding: 12,
    marginBottom: 10,
  },
  facilityTileSelected: {
    borderColor: THEME.blue,
  },
  facilityMainRow: {
    flexDirection: 'row',
    marginBottom: 10,
  },
  facilityIconCircle: {
    width: 38,
    height: 38,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  facilityEmoji: {
    fontSize: 17,
  },
  facilityContentCol: {
    flex: 1,
  },
  facilityTitleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  facilityName: {
    fontSize: 13,
    fontWeight: '800',
    color: THEME.textPrimary,
    flex: 1,
  },
  deleteShelterText: {
    fontSize: 14,
    color: THEME.primary,
    paddingLeft: 6,
  },
  facilityAddress: {
    fontSize: 11,
    color: THEME.textSecondary,
    lineHeight: 15,
    marginTop: 2,
    marginBottom: 6,
  },
  facilityMetaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 5,
  },
  facilityMetaPill: {
    backgroundColor: THEME.cardElevated,
    paddingVertical: 2,
    paddingHorizontal: 6,
    borderRadius: 4,
  },
  facilityMetaPillText: {
    fontSize: 9,
    fontWeight: '700',
    color: THEME.textSecondary,
  },
  facility247Pill: {
    backgroundColor: THEME.emeraldBg,
    paddingVertical: 2,
    paddingHorizontal: 6,
    borderRadius: 4,
  },
  facility247Text: {
    fontSize: 9,
    fontWeight: '800',
    color: THEME.emerald,
  },
  verifiedShieldPill: {
    backgroundColor: THEME.blueBg,
    paddingVertical: 2,
    paddingHorizontal: 6,
    borderRadius: 4,
  },
  verifiedShieldText: {
    fontSize: 9,
    fontWeight: '800',
    color: THEME.blue,
  },
  facilityActionsRow: {
    flexDirection: 'row',
    gap: 8,
    borderTopWidth: 1,
    borderTopColor: THEME.divider,
    paddingTop: 8,
  },
  facilityFocusBtn: {
    flex: 1,
    backgroundColor: THEME.cardElevated,
    borderRadius: 8,
    paddingVertical: 6,
    alignItems: 'center',
  },
  facilityFocusText: {
    fontSize: 11,
    fontWeight: '700',
    color: THEME.textSecondary,
  },
  facilityCallBtn: {
    backgroundColor: THEME.cardElevated,
    borderRadius: 8,
    paddingVertical: 6,
    paddingHorizontal: 12,
    alignItems: 'center',
  },
  facilityCallText: {
    fontSize: 11,
    fontWeight: '700',
    color: THEME.emerald,
  },
  facilityRouteBtn: {
    backgroundColor: THEME.blueBg,
    borderWidth: 1,
    borderColor: THEME.blueBorder,
    borderRadius: 8,
    paddingVertical: 6,
    paddingHorizontal: 12,
    alignItems: 'center',
  },
  facilityRouteText: {
    fontSize: 11,
    fontWeight: '800',
    color: THEME.blue,
  },

  // Modal: Mark Safe Spot
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  markModalCard: {
    width: '100%',
    backgroundColor: THEME.cardBg,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: THEME.cardBorder,
    padding: 20,
  },
  markModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  markModalTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: THEME.textPrimary,
  },
  markModalSub: {
    fontSize: 11,
    color: THEME.textSecondary,
    marginTop: 2,
  },
  markModalClose: {
    fontSize: 18,
    color: THEME.textSecondary,
    padding: 4,
  },
  gpsSnapshotBox: {
    backgroundColor: THEME.cardElevated,
    borderRadius: 10,
    padding: 10,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: THEME.cardBorder,
  },
  gpsSnapshotLabel: {
    fontSize: 8,
    fontWeight: '800',
    color: THEME.blue,
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  gpsSnapshotCoords: {
    fontSize: 11,
    fontWeight: '700',
    color: THEME.textPrimary,
  },
  instantTagHeading: {
    fontSize: 10,
    fontWeight: '800',
    color: THEME.textSecondary,
    letterSpacing: 0.8,
    marginBottom: 8,
  },
  instantTagsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 14,
  },
  instantTagButton: {
    flex: 1,
    minWidth: (width - 76) / 2,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: THEME.cardElevated,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: THEME.cardBorder,
    padding: 10,
    gap: 8,
  },
  instantTagEmoji: {
    fontSize: 16,
  },
  instantTagLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: THEME.textPrimary,
  },
  markingProgressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingTop: 4,
  },
  markingProgressText: {
    fontSize: 11,
    color: THEME.blue,
    fontWeight: '600',
  },
});
