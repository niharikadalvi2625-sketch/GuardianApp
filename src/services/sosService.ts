import { Linking, Platform } from 'react-native';
import { EmergencyContact, UserProfile, LocationCoords, SosAlertSession } from '../types';
import { StorageService } from './storageService';

const CONTACTS_STORAGE_KEY = '@guardian_contacts';
const PROFILE_STORAGE_KEY = '@guardian_user_profile';
const SOS_HISTORY_STORAGE_KEY = '@guardian_sos_history';

const DEFAULT_CONTACTS: EmergencyContact[] = [
  {
    id: 'c1',
    name: 'Sarah Connor (Spouse)',
    phone: '+1 (555) 234-5678',
    relationship: 'Spouse',
    isPrimary: true,
  },
  {
    id: 'c2',
    name: 'David Morgan (Brother)',
    phone: '+1 (555) 876-5432',
    relationship: 'Brother',
    isPrimary: true,
  },
  {
    id: 'c3',
    name: 'Dr. Emily Vance (Physician)',
    phone: '+1 (555) 432-1098',
    relationship: 'Doctor',
    isPrimary: false,
  },
];

const DEFAULT_PROFILE: UserProfile = {
  name: 'Alex Morgan',
  phone: '+1 (555) 019-2831',
  bloodType: 'O-Positive (O+)',
  allergies: 'Penicillin, Peanuts',
  emergencyNotes: 'Asthmatic. Carries emergency inhaler in backpack.',
  sosMessageTemplate: 'EMERGENCY SOS: I need urgent help! My live location is:',
};

class SosServiceImpl {
  async getContacts(): Promise<EmergencyContact[]> {
    try {
      const stored = await StorageService.getItem(CONTACTS_STORAGE_KEY);
      if (stored) {
        return JSON.parse(stored);
      }
      await StorageService.setItem(CONTACTS_STORAGE_KEY, JSON.stringify(DEFAULT_CONTACTS));
      return DEFAULT_CONTACTS;
    } catch {
      return DEFAULT_CONTACTS;
    }
  }

  async saveContacts(contacts: EmergencyContact[]): Promise<void> {
    await StorageService.setItem(CONTACTS_STORAGE_KEY, JSON.stringify(contacts));
  }

  async getProfile(): Promise<UserProfile> {
    try {
      const stored = await StorageService.getItem(PROFILE_STORAGE_KEY);
      if (stored) {
        return JSON.parse(stored);
      }
      await StorageService.setItem(PROFILE_STORAGE_KEY, JSON.stringify(DEFAULT_PROFILE));
      return DEFAULT_PROFILE;
    } catch {
      return DEFAULT_PROFILE;
    }
  }

  async saveProfile(profile: UserProfile): Promise<void> {
    await StorageService.setItem(PROFILE_STORAGE_KEY, JSON.stringify(profile));
  }

  async triggerSosAlert(coords: LocationCoords): Promise<{
    session: SosAlertSession;
    message: string;
    contacts: EmergencyContact[];
  }> {
    const contacts = await this.getContacts();
    const profile = await this.getProfile();

    const mapsUrl = `https://maps.google.com/?q=${coords.latitude},${coords.longitude}`;
    const baseTemplate = profile.sosMessageTemplate || 'EMERGENCY SOS: I need urgent help!';
    const message = `🚨 ${baseTemplate}\nName: ${profile.name} (${profile.bloodType})\nCoordinates: ${coords.latitude.toFixed(5)}, ${coords.longitude.toFixed(5)}\nGPS Location: ${mapsUrl}`;

    const session: SosAlertSession = {
      id: `sos-${Date.now()}`,
      timestamp: new Date().toISOString(),
      coords,
      status: 'active',
      contactsNotified: contacts.map((c) => c.name),
    };

    // Save into history
    await this.recordSosHistory(session);

    return { session, message, contacts };
  }

  async dialEmergencyServices(phoneNumber: string = '911'): Promise<void> {
    const cleanNumber = phoneNumber.replace(/[^0-9+]/g, '');
    const url = `tel:${cleanNumber}`;
    try {
      const canOpen = await Linking.canOpenURL(url);
      if (canOpen) {
        await Linking.openURL(url);
      }
    } catch (e) {
      console.warn('Error opening dialer:', e);
    }
  }

  async sendSosSms(phoneNumbers: string[], message: string): Promise<void> {
    if (phoneNumbers.length === 0) return;
    const separator = Platform.OS === 'ios' ? '&' : '?';
    const phones = phoneNumbers.map((p) => p.replace(/[^0-9+]/g, '')).join(',');
    const url = `sms:${phones}${separator}body=${encodeURIComponent(message)}`;

    try {
      const canOpen = await Linking.canOpenURL(url);
      if (canOpen) {
        await Linking.openURL(url);
      }
    } catch (e) {
      console.warn('Error sending SMS:', e);
    }
  }

  async recordSosHistory(session: SosAlertSession): Promise<void> {
    try {
      const history = await this.getSosHistory();
      history.unshift(session);
      await StorageService.setItem(
        SOS_HISTORY_STORAGE_KEY,
        JSON.stringify(history.slice(0, 20))
      );
    } catch (e) {
      console.warn('Failed to record SOS history:', e);
    }
  }

  async getSosHistory(): Promise<SosAlertSession[]> {
    try {
      const stored = await StorageService.getItem(SOS_HISTORY_STORAGE_KEY);
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  }
}

export const SosService = new SosServiceImpl();
export default SosService;
