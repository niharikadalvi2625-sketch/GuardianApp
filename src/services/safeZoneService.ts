import { Linking, Platform } from 'react-native';
import { SafeZone, SafeZoneCategory, LocationCoords } from '../types';
import { StorageService } from './storageService';

const SAFE_ZONES_CACHE_KEY = '@guardian_safe_zones_cache';

const INITIAL_SAFE_ZONES: SafeZone[] = [
  {
    id: 'sz-1',
    name: 'Central Metropolitan Hospital',
    category: 'hospital',
    address: '450 Health Avenue, Medical District',
    phone: '+1 (555) 911-4000',
    latitude: 37.7858,
    longitude: -122.4064,
    isOpen24Hours: true,
    verified: true,
  },
  {
    id: 'sz-2',
    name: 'Downtown Police Precinct #4',
    category: 'police',
    address: '120 Justice Way, Downtown',
    phone: '+1 (555) 911-2040',
    latitude: 37.7794,
    longitude: -122.4182,
    isOpen24Hours: true,
    verified: true,
  },
  {
    id: 'sz-3',
    name: 'Civic Center Community Shelter',
    category: 'shelter',
    address: '880 Refuge Plaza, West End',
    phone: '+1 (555) 555-7435',
    latitude: 37.7712,
    longitude: -122.4225,
    isOpen24Hours: true,
    verified: true,
  },
  {
    id: 'sz-4',
    name: 'Station 14 Fire & Rescue Headquarters',
    category: 'fire_station',
    address: '310 Beacon Street, Eastside',
    phone: '+1 (555) 911-1400',
    latitude: 37.7680,
    longitude: -122.4105,
    isOpen24Hours: true,
    verified: true,
  },
  {
    id: 'sz-5',
    name: 'St. Jude Emergency Urgent Care',
    category: 'hospital',
    address: '920 Care Boulevard, Midtown',
    phone: '+1 (555) 911-8200',
    latitude: 37.7890,
    longitude: -122.4280,
    isOpen24Hours: true,
    verified: true,
  },
  {
    id: 'sz-6',
    name: 'North Sector Police Substation',
    category: 'police',
    address: '505 Shield Parkway, Northgate',
    phone: '+1 (555) 911-2090',
    latitude: 37.7945,
    longitude: -122.4075,
    isOpen24Hours: true,
    verified: true,
  },
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

export const SafeZoneService = {
  async getSafeZones(
    userLocation?: LocationCoords,
    category?: SafeZoneCategory | 'all'
  ): Promise<SafeZone[]> {
    let zones = INITIAL_SAFE_ZONES;

    try {
      const cached = await StorageService.getItem(SAFE_ZONES_CACHE_KEY);
      if (cached) {
        zones = JSON.parse(cached);
      } else {
        await StorageService.setItem(SAFE_ZONES_CACHE_KEY, JSON.stringify(INITIAL_SAFE_ZONES));
      }
    } catch (e) {
      console.warn('Using fallback initial zones');
    }

    if (category && category !== 'all') {
      zones = zones.filter((z) => z.category === category);
    }

    if (userLocation) {
      zones = zones.map((zone) => ({
        ...zone,
        distanceKm: calculateHaversineDistance(
          userLocation.latitude,
          userLocation.longitude,
          zone.latitude,
          zone.longitude
        ),
      }));

      zones.sort((a, b) => (a.distanceKm || 0) - (b.distanceKm || 0));
    }

    return zones;
  },

  async openNavigation(zone: SafeZone, userLocation?: LocationCoords) {
    const scheme = Platform.select({
      ios: 'maps:0,0?q=',
      android: 'geo:0,0?q=',
    });
    const latLng = `${zone.latitude},${zone.longitude}`;
    const label = encodeURIComponent(zone.name);

    let url = Platform.select({
      ios: `${scheme}${label}@${latLng}`,
      android: `${scheme}${latLng}(${label})`,
      default: `https://www.google.com/maps/dir/?api=1&destination=${latLng}`,
    });

    if (userLocation && Platform.OS !== 'ios' && Platform.OS !== 'android') {
      url = `https://www.google.com/maps/dir/${userLocation.latitude},${userLocation.longitude}/${latLng}`;
    }

    const supported = await Linking.canOpenURL(url);
    if (supported) {
      await Linking.openURL(url);
    } else {
      const webUrl = `https://maps.google.com/?q=${zone.latitude},${zone.longitude}`;
      await Linking.openURL(webUrl);
    }
  },

  async callSafeZone(phoneNumber: string) {
    const cleanPhone = phoneNumber.replace(/[^0-9+]/g, '');
    const url = `tel:${cleanPhone}`;
    const supported = await Linking.canOpenURL(url);
    if (supported) {
      await Linking.openURL(url);
    }
  },
};