import { Linking, Platform } from 'react-native';
import { SafeZone, SafeZoneCategory, LocationCoords } from '../types';
import { StorageService } from './storageService';

const SAFE_ZONES_CACHE_PREFIX = '@guardian_safe_zones_v4_';
const CUSTOM_SHELTERS_KEY = '@guardian_custom_safe_shelters';

const OVERPASS_ENDPOINTS = [
  'https://overpass-api.de/api/interpreter',
  'https://lz4.overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
  'https://overpass.private.coffee/api/interpreter',
];

function calculateHaversineDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371; // Earth's radius in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return parseFloat((R * c).toFixed(2));
}

function getDefaultPhoneForCategory(category: SafeZoneCategory, country?: string): string {
  const isIndia = !country || country.toLowerCase().includes('india');
  if (isIndia) {
    switch (category) {
      case 'hospital':
      case 'clinic':
        return '108';
      case 'police':
        return '112';
      case 'fire_station':
        return '101';
      case 'shelter':
        return '1077';
      default:
        return '112';
    }
  }
  switch (category) {
    case 'hospital':
    case 'clinic':
      return '911';
    case 'police':
      return '911';
    case 'fire_station':
      return '911';
    case 'shelter':
      return '211';
    default:
      return '911';
  }
}

function classifyCategory(rawName: string, amenity: string = '', healthcare: string = ''): SafeZoneCategory {
  const name = rawName.toLowerCase();
  const a = amenity.toLowerCase();
  const h = healthcare.toLowerCase();

  if (
    a === 'clinic' ||
    a === 'doctors' ||
    a === 'pharmacy' ||
    h === 'clinic' ||
    h === 'doctor' ||
    h === 'pharmacy' ||
    name.includes('clinic') ||
    name.includes('dispensary') ||
    name.includes('dr.') ||
    name.includes('dr ') ||
    name.includes('doctor') ||
    name.includes('polyclinic') ||
    name.includes('ayurvedic') ||
    name.includes('homeopathic') ||
    name.includes('medical store') ||
    name.includes('aarogya') ||
    name.includes('chemist') ||
    name.includes('dental')
  ) {
    return 'clinic';
  }

  if (
    a === 'police' ||
    name.includes('police') ||
    name.includes('chowki') ||
    name.includes('thana') ||
    name.includes('outpost')
  ) {
    return 'police';
  }

  if (
    a === 'fire_station' ||
    name.includes('fire station') ||
    name.includes('fire brigade') ||
    name.includes('agnishaman')
  ) {
    return 'fire_station';
  }

  if (
    a === 'shelter' ||
    a === 'community_centre' ||
    name.includes('shelter') ||
    name.includes('relief') ||
    name.includes('karyalaya') ||
    name.includes('sabhagruha') ||
    name.includes('community centre') ||
    name.includes('dharamshala') ||
    name.includes('hall') ||
    name.includes('ashram')
  ) {
    return 'shelter';
  }

  return 'hospital';
}

/**
 * 1. Live Overpass Engine (15km radius, multi-mirror)
 */
async function fetchFromOverpass(coords: LocationCoords): Promise<SafeZone[]> {
  const query = `[out:json][timeout:12];
(
  node["amenity"~"^(hospital|clinic|doctors|pharmacy|police|shelter|fire_station|community_centre)$"](around:15000,${coords.latitude},${coords.longitude});
  node["healthcare"](around:15000,${coords.latitude},${coords.longitude});
  way["amenity"~"^(hospital|clinic|doctors|pharmacy|police|shelter|fire_station|community_centre)$"](around:15000,${coords.latitude},${coords.longitude});
  way["healthcare"](around:15000,${coords.latitude},${coords.longitude});
);
out center 60;`;

  const postData = 'data=' + encodeURIComponent(query);

  for (const ep of OVERPASS_ENDPOINTS) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 9000);

      const res = await fetch(ep, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'User-Agent': 'GuardianApp/1.0 (Emergency Safe Zones)',
        },
        body: postData,
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      if (res.ok) {
        const data = await res.json();
        if (data && Array.isArray(data.elements) && data.elements.length > 0) {
          const results: SafeZone[] = [];
          const seen = new Set<string>();

          for (const el of data.elements) {
            const tags = el.tags || {};
            const rawName = tags.name || tags['name:en'] || '';
            if (!rawName || rawName.trim().length < 2) continue;
            const name = rawName.trim();

            const lat = el.lat ?? el.center?.lat;
            const lon = el.lon ?? el.center?.lon;
            if (typeof lat !== 'number' || typeof lon !== 'number') continue;

            const dedupe = `${name.toLowerCase()}_${Math.round(lat * 1000)}_${Math.round(lon * 1000)}`;
            if (seen.has(dedupe)) continue;
            seen.add(dedupe);

            const category = classifyCategory(name, tags.amenity, tags.healthcare);
            const street = tags['addr:street'] || tags['addr:road'] || '';
            const suburb = tags['addr:suburb'] || tags['addr:neighbourhood'] || '';
            const city = tags['addr:district'] || tags['addr:city'] || coords.city || '';
            const addrParts = [street, suburb, city].filter(Boolean);
            const address = addrParts.length > 0 ? addrParts.join(', ') : `${name}, ${coords.subLocality || coords.city || 'Local Area'}`;

            const phone = tags.phone || tags['contact:phone'] || tags['emergency:phone'] || getDefaultPhoneForCategory(category, coords.country);
            const dist = calculateHaversineDistance(coords.latitude, coords.longitude, lat, lon);

            results.push({
              id: `osm-${category}-${el.type || 'n'}-${el.id || Math.random().toString(36).substring(2, 8)}`,
              name,
              category,
              address,
              phone: phone.trim(),
              latitude: lat,
              longitude: lon,
              isOpen24Hours: tags.opening_hours === '24/7' || category === 'hospital' || category === 'police',
              verified: true,
              distanceKm: dist,
            });
          }

          if (results.length >= 2) {
            return results;
          }
        }
      }
    } catch {
      // Try next mirror
    }
  }

  return [];
}

/**
 * 2. Nominatim Emergency Geocoder (OpenStreetMap Foundation API)
 */
async function fetchFromNominatim(coords: LocationCoords): Promise<SafeZone[]> {
  const queries = ['hospital', 'clinic', 'police', 'shelter'];
  const results: SafeZone[] = [];
  const seen = new Set<string>();

  const box = `${coords.longitude - 0.15},${coords.latitude + 0.15},${coords.longitude + 0.15},${coords.latitude - 0.15}`;

  await Promise.all(
    queries.map(async (q) => {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 4500);

        const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(
          q
        )}&format=json&bounded=1&viewbox=${box}&limit=10`;

        const res = await fetch(url, {
          headers: { 'User-Agent': 'GuardianSafetyApp/1.0' },
          signal: controller.signal,
        });
        clearTimeout(timeoutId);

        if (res.ok) {
          const items = await res.json();
          if (Array.isArray(items)) {
            for (const item of items) {
              const name = (item.name || item.display_name?.split(',')[0] || '').trim();
              if (!name) continue;

              const lat = parseFloat(item.lat);
              const lon = parseFloat(item.lon);
              if (isNaN(lat) || isNaN(lon)) continue;

              const dedupe = `${name.toLowerCase()}_${Math.round(lat * 1000)}_${Math.round(lon * 1000)}`;
              if (seen.has(dedupe)) continue;
              seen.add(dedupe);

              const category = classifyCategory(name, item.type, item.class);
              const dist = calculateHaversineDistance(coords.latitude, coords.longitude, lat, lon);

              results.push({
                id: `nom-${category}-${item.place_id || Math.random().toString(36).substring(2, 8)}`,
                name,
                category,
                address: item.display_name || `${name}, ${coords.city || 'Emergency Safe Area'}`,
                phone: getDefaultPhoneForCategory(category, coords.country),
                latitude: lat,
                longitude: lon,
                isOpen24Hours: true,
                verified: true,
                distanceKm: dist,
              });
            }
          }
        }
      } catch {
        // Tolerated
      }
    })
  );

  return results;
}

/**
 * 3. Photon Geocoder (Komoot CDN)
 */
async function fetchFromPhoton(coords: LocationCoords): Promise<SafeZone[]> {
  const queries = [
    { q: 'hospital', cat: 'hospital' as SafeZoneCategory },
    { q: 'clinic doctor', cat: 'clinic' as SafeZoneCategory },
    { q: 'police', cat: 'police' as SafeZoneCategory },
    { q: 'shelter community hall', cat: 'shelter' as SafeZoneCategory },
  ];

  const results: SafeZone[] = [];
  await Promise.all(
    queries.map(async (item) => {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 4000);
        const url = `https://photon.komoot.io/api/?q=${encodeURIComponent(
          item.q
        )}&lat=${coords.latitude}&lon=${coords.longitude}&limit=8`;
        const res = await fetch(url, { signal: controller.signal });
        clearTimeout(timeoutId);

        if (res.ok) {
          const data = await res.json();
          if (data && Array.isArray(data.features)) {
            for (const f of data.features) {
              const props = f.properties || {};
              const coordsArr = f.geometry?.coordinates || [];
              if (coordsArr.length >= 2 && props.name) {
                const lon = parseFloat(coordsArr[0]);
                const lat = parseFloat(coordsArr[1]);
                const dist = calculateHaversineDistance(coords.latitude, coords.longitude, lat, lon);
                if (dist <= 25) {
                  results.push({
                    id: `photon-${item.cat}-${props.osm_id || Math.random().toString(36).substring(2, 7)}`,
                    name: props.name.trim(),
                    category: classifyCategory(props.name, props.osm_value),
                    address: [props.street, props.city || coords.city, props.state || coords.region].filter(Boolean).join(', ') || props.name,
                    phone: getDefaultPhoneForCategory(item.cat, coords.country),
                    latitude: lat,
                    longitude: lon,
                    isOpen24Hours: true,
                    verified: true,
                    distanceKm: dist,
                  });
                }
              }
            }
          }
        }
      } catch {
        // Tolerated
      }
    })
  );

  return results;
}

export const SafeZoneService = {
  /**
   * Fetch real-time safe zones near user location using multi-source OpenStreetMap engines
   */
  async getSafeZones(
    userLocation?: LocationCoords,
    category?: SafeZoneCategory | 'all'
  ): Promise<SafeZone[]> {
    const coords: LocationCoords = userLocation || {
      latitude: 18.5204,
      longitude: 73.8567,
      city: 'Pune',
      region: 'Maharashtra',
      country: 'India',
    };

    const gridLat = Math.round(coords.latitude * 25);
    const gridLon = Math.round(coords.longitude * 25);
    const cacheKey = `${SAFE_ZONES_CACHE_PREFIX}${gridLat}_${gridLon}`;

    let zones: SafeZone[] = [];

    // 1. Try reading grid cache for 0ms instant display
    try {
      const cached = await StorageService.getItem(cacheKey);
      if (cached) {
        const parsed = JSON.parse(cached);
        if (Array.isArray(parsed) && parsed.length > 0) {
          zones = parsed;
        }
      }
    } catch {
      // Ignored
    }

    // 2. Query Live Overpass Engine (15km radius)
    if (zones.length === 0) {
      try {
        const overpassZones = await fetchFromOverpass(coords);
        if (overpassZones.length >= 2) {
          zones = overpassZones;
          await StorageService.setItem(cacheKey, JSON.stringify(zones));
        }
      } catch {
        // Continue
      }
    }

    // 3. If Overpass had few results, try Nominatim Emergency Engine
    if (zones.length < 2) {
      try {
        const nomZones = await fetchFromNominatim(coords);
        if (nomZones.length >= 2) {
          zones = nomZones;
          await StorageService.setItem(cacheKey, JSON.stringify(zones));
        }
      } catch {
        // Continue
      }
    }

    // 4. If still few results, try Photon API
    if (zones.length < 2) {
      try {
        const photonZones = await fetchFromPhoton(coords);
        if (photonZones.length >= 2) {
          zones = photonZones;
          await StorageService.setItem(cacheKey, JSON.stringify(zones));
        }
      } catch {
        // Continue
      }
    }

    // 5. Merge custom user-pinned safe havens
    const customShelters = await this.getCustomShelters();
    let allZones = [...customShelters, ...zones];

    // 6. Filter by category if requested
    if (category && category !== 'all') {
      allZones = allZones.filter((z) => z.category === category);
    }

    // 7. Calculate real GPS distance
    allZones = allZones.map((zone) => ({
      ...zone,
      distanceKm: calculateHaversineDistance(
        coords.latitude,
        coords.longitude,
        zone.latitude,
        zone.longitude
      ),
    }));

    allZones.sort((a, b) => (a.distanceKm || 0) - (b.distanceKm || 0));

    return allZones;
  },

  async getCustomShelters(): Promise<SafeZone[]> {
    try {
      const stored = await StorageService.getItem(CUSTOM_SHELTERS_KEY);
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  },

  async addCustomShelter(shelterData: {
    name: string;
    address: string;
    phone?: string;
    latitude: number;
    longitude: number;
    isOpen24Hours?: boolean;
  }): Promise<SafeZone> {
    const shelters = await this.getCustomShelters();
    const newShelter: SafeZone = {
      id: `custom-shelter-${Date.now()}`,
      name: shelterData.name.trim(),
      category: 'shelter',
      address: shelterData.address.trim(),
      phone: shelterData.phone?.trim() || '112',
      latitude: shelterData.latitude,
      longitude: shelterData.longitude,
      isOpen24Hours: shelterData.isOpen24Hours ?? true,
      verified: true,
      isUserAdded: true,
    };
    shelters.unshift(newShelter);
    await StorageService.setItem(CUSTOM_SHELTERS_KEY, JSON.stringify(shelters));
    return newShelter;
  },

  async deleteCustomShelter(id: string): Promise<void> {
    const shelters = await this.getCustomShelters();
    const filtered = shelters.filter((s) => s.id !== id);
    await StorageService.setItem(CUSTOM_SHELTERS_KEY, JSON.stringify(filtered));
  },

  async searchPlaces(query: string, userLocation?: LocationCoords): Promise<SafeZone[]> {
    if (!query.trim()) {
      return this.getSafeZones(userLocation, 'all');
    }

    const coords = userLocation || {
      latitude: 18.5204,
      longitude: 73.8567,
      country: 'India',
    };

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 4500);

      const url = `https://photon.komoot.io/api/?q=${encodeURIComponent(
        query.trim()
      )}&lat=${coords.latitude}&lon=${coords.longitude}&limit=10`;

      const res = await fetch(url, { signal: controller.signal });
      clearTimeout(timeoutId);

      if (res.ok) {
        const data = await res.json();
        if (data && Array.isArray(data.features) && data.features.length > 0) {
          const results: SafeZone[] = [];
          data.features.forEach((feature: any, index: number) => {
            const props = feature.properties || {};
            const geometry = feature.geometry || {};
            const coordinates = geometry.coordinates || [];

            if (coordinates.length >= 2) {
              const lon = parseFloat(coordinates[0]);
              const lat = parseFloat(coordinates[1]);
              const name = props.name || props.street || query;
              const street = props.street || '';
              const city = props.city || props.district || '';
              const state = props.state || '';
              const address = [street, city, state].filter(Boolean).join(', ') || name;

              const category = classifyCategory(name, props.osm_value, props.osm_key);

              results.push({
                id: `search-${index}-${Date.now()}`,
                name: name.trim(),
                category,
                address: address.trim(),
                phone: getDefaultPhoneForCategory(category, coords.country),
                latitude: lat,
                longitude: lon,
                isOpen24Hours: true,
                verified: true,
                distanceKm: calculateHaversineDistance(coords.latitude, coords.longitude, lat, lon),
              });
            }
          });

          if (results.length > 0) {
            results.sort((a, b) => (a.distanceKm || 0) - (b.distanceKm || 0));
            return results;
          }
        }
      }
    } catch {
      // Ignored
    }

    const baseZones = await this.getSafeZones(userLocation, 'all');
    const q = query.toLowerCase();
    return baseZones.filter(
      (z) => z.name.toLowerCase().includes(q) || z.address.toLowerCase().includes(q)
    );
  },

  /**
   * 🚗 Launches Google Maps directly in turn-by-turn driving navigation mode
   * (matching the screenshot provided by user)
   */
  async openNavigation(zone: SafeZone, userLocation?: LocationCoords) {
    const lat = zone.latitude;
    const lon = zone.longitude;
    const label = encodeURIComponent(zone.name);

    let url: string;
    if (Platform.OS === 'android') {
      if (userLocation) {
        // Direct driving navigation intent from user's live coordinates to safe zone
        url = `google.navigation:q=${lat},${lon}&mode=d`;
      } else {
        url = `geo:${lat},${lon}?q=${lat},${lon}(${label})`;
      }
    } else if (Platform.OS === 'ios') {
      url = `maps:0,0?q=${label}@${lat},${lon}`;
    } else {
      url = `https://www.google.com/maps/dir/?api=1&destination=${lat},${lon}`;
    }

    try {
      const supported = await Linking.canOpenURL(url);
      if (supported) {
        await Linking.openURL(url);
        return;
      }
    } catch {
      // Fallback to web directions
    }

    const webUrl = userLocation
      ? `https://www.google.com/maps/dir/?api=1&origin=${userLocation.latitude},${userLocation.longitude}&destination=${lat},${lon}&travelmode=driving`
      : `https://www.google.com/maps/search/?api=1&query=${lat},${lon}`;
    await Linking.openURL(webUrl).catch(() => {});
  },

  /**
   * 🌐 Launches Google Maps to search real facilities near user's GPS coordinates
   */
  async openGoogleMapsSearch(category: SafeZoneCategory | 'all' = 'hospital', coords?: LocationCoords) {
    if (!coords) return;
    const queryMap: Record<string, string> = {
      hospital: 'emergency+hospitals',
      clinic: 'clinics+and+doctors',
      police: 'police+stations',
      shelter: 'emergency+shelters',
      fire_station: 'fire+station',
      all: 'emergency+hospitals+and+clinics',
    };

    const q = queryMap[category] || 'emergency+hospitals';
    let url =
      Platform.OS === 'android'
        ? `geo:${coords.latitude},${coords.longitude}?q=${q}`
        : `https://www.google.com/maps/search/${q}/@${coords.latitude},${coords.longitude},14z`;

    try {
      const supported = await Linking.canOpenURL(url);
      if (supported) {
        await Linking.openURL(url);
        return;
      }
    } catch {
      // Fallback
    }

    const webUrl = `https://www.google.com/maps/search/${q}/@${coords.latitude},${coords.longitude},14z`;
    await Linking.openURL(webUrl).catch(() => {});
  },

  /**
   * 🗺️ Opens the user's current GPS location in Google Maps
   */
  async openAreaInGoogleMaps(coords: LocationCoords) {
    const url =
      Platform.OS === 'android'
        ? `geo:${coords.latitude},${coords.longitude}?z=15`
        : `https://www.google.com/maps/@${coords.latitude},${coords.longitude},15z`;
    try {
      const supported = await Linking.canOpenURL(url);
      if (supported) {
        await Linking.openURL(url);
        return;
      }
    } catch {
      // Fallback
    }
    await Linking.openURL(`https://www.google.com/maps/@${coords.latitude},${coords.longitude},15z`).catch(() => {});
  },

  async callSafeZone(phoneNumber: string) {
    const cleanPhone = phoneNumber.replace(/[^0-9+]/g, '');
    const url = `tel:${cleanPhone}`;
    try {
      const supported = await Linking.canOpenURL(url);
      if (supported) {
        await Linking.openURL(url);
      }
    } catch {
      // Ignored
    }
  },
};

export default SafeZoneService;
