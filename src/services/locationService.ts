import { Platform, PermissionsAndroid, NativeModules, Linking } from 'react-native';
import { LocationCoords } from '../types';
import { StorageService } from './storageService';

const { GuardianLocation } = NativeModules;
const LOCATION_CACHE_KEY = '@guardian_last_known_coords';

// Default initial coordinates centered around the user's region
const DEFAULT_COORDS: LocationCoords = {
  latitude: 18.5204,
  longitude: 73.8567,
  accuracy: 15,
  timestamp: Date.now(),
  city: 'Pune',
  region: 'Maharashtra',
  country: 'India',
  address: 'Pune, Maharashtra, India',
};

class LocationServiceImpl {
  private lastKnownLocation: LocationCoords = DEFAULT_COORDS;
  private permissionGranted: boolean | null = null;

  constructor() {
    this.initFromCache();
  }

  private async initFromCache() {
    try {
      const cached = await StorageService.getItem(LOCATION_CACHE_KEY);
      if (cached) {
        this.lastKnownLocation = JSON.parse(cached);
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
        await Linking.sendIntent('android.settings.LOCATION_SOURCE_SETTINGS');
      } catch {
        await Linking.openSettings();
      }
    } else {
      await Linking.openSettings();
    }
  }

  /**
   * Fetch address details from coordinates using OpenStreetMap reverse geocoding
   */
  async reverseGeocode(lat: number, lon: number): Promise<Partial<LocationCoords>> {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 4000);

      const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}&addressdetails=1`;
      const res = await fetch(url, {
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
          region: region || undefined,
          country: country || undefined,
          address: fullAddress || undefined,
        };
      }
    } catch {
      // Ignore reverse geocode network failures
    }
    return {};
  }

  /**
   * Fetch current location using network IP geolocation
   */
  private async fetchIpLocation(): Promise<LocationCoords | null> {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 4000);

      const res = await fetch('https://ipwho.is/', {
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      if (res.ok) {
        const data = await res.json();
        if (data && data.success !== false && data.latitude && data.longitude) {
          return {
            latitude: parseFloat(data.latitude),
            longitude: parseFloat(data.longitude),
            accuracy: 50,
            timestamp: Date.now(),
            city: data.city || 'Pune',
            region: data.region || 'Maharashtra',
            country: data.country || 'India',
            address: `${data.city || 'Pune'}, ${data.region || 'Maharashtra'}, ${data.country || 'India'}`,
          };
        }
      }
    } catch {
      // Try secondary endpoint
      try {
        const res2 = await fetch('https://ipapi.co/json/');
        if (res2.ok) {
          const data2 = await res2.json();
          if (data2 && data2.latitude && data2.longitude) {
            return {
              latitude: parseFloat(data2.latitude),
              longitude: parseFloat(data2.longitude),
              accuracy: 50,
              timestamp: Date.now(),
              city: data2.city || 'Pune',
              region: data2.region || 'Maharashtra',
              country: data2.country_name || 'India',
              address: `${data2.city || 'Pune'}, ${data2.region || 'Maharashtra'}`,
            };
          }
        }
      } catch {
        // Fallback failed
      }
    }
    return null;
  }

  /**
   * Get the current device coordinates using native Android GPS hardware first
   */
  async getCurrentLocation(): Promise<LocationCoords> {
    // 1. Check if permission has been granted without aggressively prompting
    const hasPerm = await this.checkPermission();
    if (!hasPerm && Platform.OS === 'android') {
      return this.lastKnownLocation;
    }

    // 2. Primary: Use Native Android GPS Module directly from hardware sensor
    if (Platform.OS === 'android' && GuardianLocation?.getCurrentLocation) {
      try {
        const nativeLoc = await GuardianLocation.getCurrentLocation();
        if (nativeLoc && typeof nativeLoc.latitude === 'number' && typeof nativeLoc.longitude === 'number') {
          const city = nativeLoc.city || nativeLoc.subLocality || '';
          const address = nativeLoc.address || (nativeLoc.subLocality ? `${nativeLoc.subLocality}, ${nativeLoc.city || ''}` : nativeLoc.city);

          const coords: LocationCoords = {
            latitude: nativeLoc.latitude,
            longitude: nativeLoc.longitude,
            accuracy: nativeLoc.accuracy || 10,
            timestamp: nativeLoc.timestamp || Date.now(),
            city: city || undefined,
            region: nativeLoc.region || undefined,
            country: nativeLoc.country || undefined,
            address: address || undefined,
          };

          // If Android Geocoder didn't return city/address, reverse geocode via Nominatim in background
          if (!coords.city && !coords.address) {
            this.reverseGeocode(coords.latitude, coords.longitude)
              .then((geoInfo) => {
                if (geoInfo) {
                  Object.assign(this.lastKnownLocation, geoInfo);
                  StorageService.setItem(LOCATION_CACHE_KEY, JSON.stringify(this.lastKnownLocation)).catch(() => {});
                }
              })
              .catch(() => {});
          }

          this.lastKnownLocation = coords;
          await StorageService.setItem(LOCATION_CACHE_KEY, JSON.stringify(coords));
          return coords;
        }
      } catch (nativeErr) {
        console.warn('Native GPS lookup error, checking fallbacks:', nativeErr);
      }
    }

    // 3. Secondary: Try JS geolocation if available
    const gpsLocation = await new Promise<LocationCoords | null>((resolve) => {
      const globalNav = (typeof globalThis !== 'undefined'
        ? (globalThis as unknown as { navigator?: { geolocation?: any } }).navigator
        : undefined);

      if (globalNav && globalNav.geolocation) {
        let resolved = false;
        const timer = setTimeout(() => {
          if (!resolved) {
            resolved = true;
            resolve(null);
          }
        }, 3000);

        globalNav.geolocation.getCurrentPosition(
          (position: any) => {
            if (!resolved) {
              resolved = true;
              clearTimeout(timer);
              resolve({
                latitude: position.coords.latitude,
                longitude: position.coords.longitude,
                accuracy: position.coords.accuracy || 10,
                timestamp: position.timestamp || Date.now(),
              });
            }
          },
          () => {
            if (!resolved) {
              resolved = true;
              clearTimeout(timer);
              resolve(null);
            }
          },
          { enableHighAccuracy: true, timeout: 3000, maximumAge: 30000 }
        );
      } else {
        resolve(null);
      }
    });

    if (gpsLocation) {
      const geoInfo = await this.reverseGeocode(gpsLocation.latitude, gpsLocation.longitude);
      this.lastKnownLocation = {
        ...gpsLocation,
        ...geoInfo,
      };
      await StorageService.setItem(LOCATION_CACHE_KEY, JSON.stringify(this.lastKnownLocation));
      return this.lastKnownLocation;
    }

    // 4. Tertiary: Resolve via live IP geolocation
    const ipLocation = await this.fetchIpLocation();
    if (ipLocation) {
      this.lastKnownLocation = ipLocation;
      await StorageService.setItem(LOCATION_CACHE_KEY, JSON.stringify(this.lastKnownLocation));
      return this.lastKnownLocation;
    }

    // 5. Fallback to cached coordinates
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
   * Formats coordinates into standard geographical representation (e.g. "18.5204° N, 73.8567° E")
   */
  formatCoordinates(coords: LocationCoords): string {
    const latDir = coords.latitude >= 0 ? 'N' : 'S';
    const lonDir = coords.longitude >= 0 ? 'E' : 'W';
    return `${Math.abs(coords.latitude).toFixed(4)}° ${latDir}, ${Math.abs(coords.longitude).toFixed(4)}° ${lonDir}`;
  }

  /**
   * Formats human-friendly location string (e.g. "Shaniwar Peth, Pune" or "Pune, Maharashtra")
   */
  formatLocationName(coords: LocationCoords): string {
    if (coords.address) {
      return coords.address;
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
