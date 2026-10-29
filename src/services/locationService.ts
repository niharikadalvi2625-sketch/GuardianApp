import { Platform, PermissionsAndroid, NativeModules, Linking } from 'react-native';
import { LocationCoords } from '../types';
import { StorageService } from './storageService';

const { GuardianLocation } = NativeModules;
const LOCATION_CACHE_KEY = '@guardian_last_known_coords';

// Clean baseline coordinates (Maharashtra, India)
const DEFAULT_COORDS: LocationCoords = {
  latitude: 21.1463,
  longitude: 79.0849,
  accuracy: 25,
  timestamp: Date.now(),
  city: 'Maharashtra',
  region: 'Maharashtra',
  country: 'India',
  address: 'Maharashtra, India',
};

class LocationServiceImpl {
  private lastKnownLocation: LocationCoords = DEFAULT_COORDS;
  private permissionGranted: boolean | null = null;
  private isLocatingInProgress: boolean = false;

  constructor() {
    this.initFromCache();
  }

  private async initFromCache() {
    try {
      const cached = await StorageService.getItem(LOCATION_CACHE_KEY);
      if (cached) {
        this.lastKnownLocation = JSON.parse(cached);
      } else {
        // Pre-warm baseline region asynchronously via network IP if no cache exists
        this.fetchIpLocation().then((ipLoc) => {
          if (ipLoc && !this.lastKnownLocation.address) {
            this.lastKnownLocation = ipLoc;
          }
        }).catch(() => {});
      }
    } catch {
      // Continue with default
    }
  }

  /**
   * Return synchronous last known cached location
   */
  getLastKnownLocation(): LocationCoords {
    return this.lastKnownLocation;
  }

  /**
   * Check if location permission is already granted without popping up any prompt
   */
  async checkPermission(): Promise<boolean> {
    if (Platform.OS === 'android') {
      try {
        const finePermission = PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION;
        const coarsePermission = PermissionsAndroid.PERMISSIONS.ACCESS_COARSE_LOCATION;
        const fineGranted = await PermissionsAndroid.check(finePermission);
        const coarseGranted = await PermissionsAndroid.check(coarsePermission);
        const isGranted = fineGranted || coarseGranted;
        this.permissionGranted = isGranted;
        return isGranted;
      } catch (err) {
        return false;
      }
    }
    this.permissionGranted = true;
    return true;
  }

  /**
   * Request location permissions for Android / iOS
   */
  async requestPermission(): Promise<boolean> {
    if (Platform.OS === 'android') {
      try {
        const finePermission = PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION;
        const coarsePermission = PermissionsAndroid.PERMISSIONS.ACCESS_COARSE_LOCATION;

        // Check if fine location is already granted
        const alreadyGranted = await PermissionsAndroid.check(finePermission);
        if (alreadyGranted) {
          this.permissionGranted = true;
          return true;
        }

        const granted = await PermissionsAndroid.requestMultiple([
          finePermission,
          coarsePermission,
        ]);

        const isGranted =
          granted[finePermission] === PermissionsAndroid.RESULTS.GRANTED ||
          granted[coarsePermission] === PermissionsAndroid.RESULTS.GRANTED;

        this.permissionGranted = isGranted;
        return isGranted;
      } catch (err) {
        console.warn('Location permission request error:', err);
        return false;
      }
    }
    this.permissionGranted = true;
    return true;
  }

  /**
   * Check if device location services (GPS/Network) are enabled on the phone
   */
  async isLocationEnabled(): Promise<boolean> {
    if (Platform.OS === 'android' && GuardianLocation?.isLocationEnabled) {
      try {
        return await GuardianLocation.isLocationEnabled();
      } catch {
        return true;
      }
    }
    return true;
  }

  /**
   * Open Android Device Location Settings
   */
  async openLocationSettings(): Promise<void> {
    if (Platform.OS === 'android') {
      try {
        if (GuardianLocation?.openLocationSettings) {
          await GuardianLocation.openLocationSettings();
          return;
        }
        await Linking.sendIntent('android.settings.LOCATION_SOURCE_SETTINGS');
      } catch {
        try {
          await Linking.openSettings();
        } catch {}
      }
    } else {
      await Linking.openSettings();
    }
  }

  /**
   * Fetch address details from coordinates using multi-tier reverse geocoding:
   * Tier 1: BigDataCloud Reverse Geocode (Instant, high accuracy for Indian cities/localities)
   * Tier 2: OpenStreetMap Nominatim
   */
  async reverseGeocode(lat: number, lon: number): Promise<Partial<LocationCoords>> {
    // 1. Tier 1: BigDataCloud (Sub-second response, detailed locality in India)
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 2500);

      const bdcUrl = `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${lat}&longitude=${lon}&localityLanguage=en`;
      const res = await fetch(bdcUrl, { signal: controller.signal });
      clearTimeout(timeoutId);

      if (res.ok) {
        const data = await res.json();
        const city = data.city || data.locality || data.principalSubdivision || '';
        const locality = data.locality && data.locality !== city ? data.locality : '';
        const region = data.principalSubdivision || '';
        const country = data.countryName || 'India';

        let fullAddress = '';
        if (locality && city && locality !== city) {
          fullAddress = `${locality}, ${city}`;
        } else if (city && region) {
          fullAddress = `${city}, ${region}`;
        } else {
          fullAddress = city || region || `${lat.toFixed(4)}, ${lon.toFixed(4)}`;
        }

        if (city || region) {
          return {
            city: city || undefined,
            subLocality: locality || undefined,
            region: region || undefined,
            country: country || undefined,
            address: fullAddress || undefined,
          };
        }
      }
    } catch {
      // Fall through to Nominatim
    }

    // 2. Tier 2: OpenStreetMap Nominatim Reverse Geocoding
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 3000);

      const nomUrl = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}&addressdetails=1`;
      const res = await fetch(nomUrl, {
        headers: { 'User-Agent': 'GuardianSafetyApp/1.0' },
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      if (res.ok) {
        const data = await res.json();
        const addr = data.address || {};
        const city = addr.city || addr.town || addr.municipality || addr.district || addr.county || '';
        const suburb = addr.suburb || addr.neighbourhood || addr.residential || '';
        const region = addr.state || '';
        const country = addr.country || '';
        const fullAddress = suburb && city
          ? `${suburb}, ${city}`
          : (data.display_name?.split(',').slice(0, 3).join(', ') || `${city}, ${region}`);

        return {
          city: city || undefined,
          subLocality: suburb || undefined,
          region: region || undefined,
          country: country || undefined,
          address: fullAddress || undefined,
        };
      }
    } catch {
      // Tolerated
    }

    return {
      address: `${lat.toFixed(4)}°, ${lon.toFixed(4)}°`,
    };
  }

  /**
   * Fetch current location using network IP geolocation (fast fallback when GPS unavailable)
   */
  async fetchIpLocation(): Promise<LocationCoords | null> {
    // Primary: ipwho.is
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 3000);

      const res = await fetch('https://ipwho.is/', {
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      if (res.ok) {
        const data = await res.json();
        if (data && data.success !== false && data.latitude && data.longitude) {
          const lat = parseFloat(data.latitude);
          const lon = parseFloat(data.longitude);
          const city = data.city || '';
          const region = data.region || 'Maharashtra';
          const country = data.country || 'India';
          const address = city ? `${city}, ${region}` : `${region}, ${country}`;

          return {
            latitude: lat,
            longitude: lon,
            accuracy: 80,
            timestamp: Date.now(),
            city: city || undefined,
            region: region || undefined,
            country: country || undefined,
            address: address || undefined,
          };
        }
      }
    } catch {
      // Fall through to secondary
    }

    // Secondary: ipapi.co
    try {
      const controller2 = new AbortController();
      const timeoutId2 = setTimeout(() => controller2.abort(), 3000);

      const res2 = await fetch('https://ipapi.co/json/', {
        signal: controller2.signal,
      });
      clearTimeout(timeoutId2);

      if (res2.ok) {
        const data2 = await res2.json();
        if (data2 && data2.latitude && data2.longitude) {
          const lat = parseFloat(data2.latitude);
          const lon = parseFloat(data2.longitude);
          const city = data2.city || '';
          const region = data2.region || 'Maharashtra';
          const country = data2.country_name || 'India';
          const address = city ? `${city}, ${region}` : `${region}, ${country}`;

          return {
            latitude: lat,
            longitude: lon,
            accuracy: 80,
            timestamp: Date.now(),
            city: city || undefined,
            region: region || undefined,
            country: country || undefined,
            address: address || undefined,
          };
        }
      }
    } catch {
      // Fallback failed
    }

    return null;
  }

  /**
   * Get the current device coordinates:
   * 1. Requests permission automatically if not yet granted
   * 2. Uses Native Android Google Play Services Fused Location + GPS sensors
   * 3. Reverse geocodes coordinates to human address
   * 4. Seamlessly falls back to IP geolocation if GPS is unavailable
   */
  async getCurrentLocation(options?: {
    forceFresh?: boolean;
    autoRequestPerm?: boolean;
  }): Promise<LocationCoords> {
    const autoRequest = options?.autoRequestPerm !== false;

    // 1. Check or Request Permission
    let hasPerm = await this.checkPermission();
    if (!hasPerm && autoRequest && Platform.OS === 'android') {
      hasPerm = await this.requestPermission();
    }

    // 2. Primary: Native Android Fused Location & GPS
    if (hasPerm && Platform.OS === 'android' && GuardianLocation?.getCurrentLocation) {
      try {
        const nativeLoc = await GuardianLocation.getCurrentLocation();
        if (
          nativeLoc &&
          typeof nativeLoc.latitude === 'number' &&
          typeof nativeLoc.longitude === 'number'
        ) {
          let city = nativeLoc.city || nativeLoc.subLocality || '';
          let subLocality = nativeLoc.subLocality || '';
          let region = nativeLoc.region || '';
          let country = nativeLoc.country || '';
          let address = nativeLoc.address || (subLocality ? `${subLocality}, ${city}` : city);

          // If native Android Geocoder did not return address/city, run fast multi-tier reverse geocode
          if (!city || !address) {
            try {
              const geoInfo = await Promise.race([
                this.reverseGeocode(nativeLoc.latitude, nativeLoc.longitude),
                new Promise<Partial<LocationCoords>>((res) =>
                  setTimeout(() => res({}), 2600)
                ),
              ]);

              if (geoInfo) {
                city = city || geoInfo.city || '';
                subLocality = subLocality || geoInfo.subLocality || '';
                region = region || geoInfo.region || '';
                country = country || geoInfo.country || '';
                address = address || geoInfo.address || '';
              }
            } catch {}
          }

          if (!address) {
            address = city
              ? `${city}, ${region || 'India'}`
              : `${nativeLoc.latitude.toFixed(4)}°, ${nativeLoc.longitude.toFixed(4)}°`;
          }

          const coords: LocationCoords = {
            latitude: nativeLoc.latitude,
            longitude: nativeLoc.longitude,
            accuracy: nativeLoc.accuracy || 10,
            timestamp: nativeLoc.timestamp || Date.now(),
            city: city || undefined,
            subLocality: subLocality || undefined,
            region: region || undefined,
            country: country || undefined,
            address: address || undefined,
          };

          this.lastKnownLocation = coords;
          await StorageService.setItem(LOCATION_CACHE_KEY, JSON.stringify(coords));
          return coords;
        }
      } catch (nativeErr) {
        console.warn('Native GPS lookup error, checking IP geolocation fallback:', nativeErr);
      }
    }

    // 3. Secondary: Network IP Geolocation (Real regional city/state)
    const ipLocation = await this.fetchIpLocation();
    if (ipLocation) {
      this.lastKnownLocation = ipLocation;
      await StorageService.setItem(LOCATION_CACHE_KEY, JSON.stringify(this.lastKnownLocation));
      return this.lastKnownLocation;
    }

    // 4. Fallback to cached coordinates
    return this.lastKnownLocation;
  }

  /**
   * Manually override location (when user selects or searches a location)
   */
  async setManualLocation(coords: LocationCoords): Promise<void> {
    this.lastKnownLocation = coords;
    await StorageService.setItem(LOCATION_CACHE_KEY, JSON.stringify(coords));
  }

  /**
   * Formats coordinates into standard geographical representation (e.g. "21.1463° N, 79.0849° E")
   */
  formatCoordinates(coords: LocationCoords): string {
    const latDir = coords.latitude >= 0 ? 'N' : 'S';
    const lonDir = coords.longitude >= 0 ? 'E' : 'W';
    return `${Math.abs(coords.latitude).toFixed(4)}° ${latDir}, ${Math.abs(coords.longitude).toFixed(4)}° ${lonDir}`;
  }

  /**
   * Formats human-friendly location string (e.g. "Ramdaspeth, Nagpur" or "Nagpur, Maharashtra")
   */
  formatLocationName(coords: LocationCoords): string {
    if (coords.address) {
      return coords.address;
    }
    if (coords.subLocality && coords.city) {
      return `${coords.subLocality}, ${coords.city}`;
    }
    if (coords.city && coords.region) {
      return `${coords.city}, ${coords.region}`;
    }
    if (coords.city) {
      return coords.city;
    }
    return this.formatCoordinates(coords);
  }

  /**
   * Calculate Haversine distance in kilometers between two GPS coordinates
   */
  calculateDistance(
    lat1: number,
    lon1: number,
    lat2: number,
    lon2: number
  ): number {
    const R = 6371; // Radius of the Earth in km
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
}

export const LocationService = new LocationServiceImpl();
export default LocationService;
