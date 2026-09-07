import { Platform, PermissionsAndroid } from 'react-native';
import { LocationCoords } from '../types';

// Default fallback coordinates (Downtown Metropolitan Area)
const DEFAULT_COORDS: LocationCoords = {
  latitude: 37.7749,
  longitude: -122.4194,
  accuracy: 10,
  timestamp: Date.now(),
};

class LocationServiceImpl {
  private lastKnownLocation: LocationCoords = DEFAULT_COORDS;

  /**
   * Request location permissions for Android / iOS
   */
  async requestPermission(): Promise<boolean> {
    if (Platform.OS === 'android') {
      try {
        const granted = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
          {
            title: 'Guardian App Location Permission',
            message:
              'Guardian needs access to your location to find nearby emergency safe zones and provide SOS dispatch.',
            buttonNeutral: 'Ask Me Later',
            buttonNegative: 'Cancel',
            buttonPositive: 'OK',
          }
        );
        return granted === PermissionsAndroid.RESULTS.GRANTED;
      } catch (err) {
        console.warn('Location permission error:', err);
        return false;
      }
    }
    // iOS and other platforms handle permissions via Info.plist or standard prompts
    return true;
  }

  /**
   * Get the current device coordinates or fallback to last known location
   */
  async getCurrentLocation(): Promise<LocationCoords> {
    return new Promise((resolve) => {
      const globalNav = (typeof globalThis !== 'undefined'
        ? (globalThis as unknown as { navigator?: { geolocation?: any } }).navigator
        : undefined);

      if (globalNav && globalNav.geolocation) {
        globalNav.geolocation.getCurrentPosition(
          (position: any) => {
            const coords: LocationCoords = {
              latitude: position.coords.latitude,
              longitude: position.coords.longitude,
              accuracy: position.coords.accuracy,
              timestamp: position.timestamp,
            };
            this.lastKnownLocation = coords;
            resolve(coords);
          },
          (error: any) => {
            console.warn('Geolocation lookup failed, using default coords:', error?.message);
            resolve(this.lastKnownLocation);
          },
          { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 }
        );
      } else {
        // Fallback for native runtime without active geolocation native module
        resolve(this.lastKnownLocation);
      }
    });
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
