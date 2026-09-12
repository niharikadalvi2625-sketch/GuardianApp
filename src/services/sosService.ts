import { Linking, Platform } from 'react-native';
import { EmergencyContact, UserProfile, LocationCoords, SosAlertSession } from '../types';
import { StorageService } from './storageService';
import { AlertService } from './alertService';

const CONTACTS_STORAGE_KEY = '@guardian_contacts';
const PROFILE_STORAGE_KEY = '@guardian_user_profile';
const SOS_HISTORY_STORAGE_KEY = '@guardian_sos_history';

const DEFAULT_CONTACTS: EmergencyContact[] = [
  {
    id: 'c1',
    name: 'Primary Guardian (Spouse / Parents)',
    phone: '+91 98765 43210',
    relationship: 'Family',
    isPrimary: true,
  },
  {
    id: 'c2',
    name: 'Women Safety Helpline (1091)',
    phone: '1091',
    relationship: 'Helpline',
    isPrimary: false,
  },
  {
    id: 'c3',
    name: 'National Emergency ERSS (112)',
    phone: '112',
    relationship: 'Emergency',
    isPrimary: false,
  },
  {
    id: 'c4',
    name: 'Medical Ambulance (108)',
    phone: '108',
    relationship: 'Medical',
    isPrimary: false,
  },
];

const DEFAULT_PROFILE: UserProfile = {
  name: 'Guardian User',
  phone: '+91 98765 00000',
  bloodType: 'O-Positive (O+)',
  allergies: 'None',
  emergencyNotes: 'Late night commuter. Emergency SOS enabled.',
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

  async getPrimaryGuardian(): Promise<EmergencyContact | null> {
    const contacts = await this.getContacts();
    return contacts.find((c) => c.isPrimary) || contacts[0] || null;
  }

  async updatePrimaryGuardian(name: string, phone: string): Promise<EmergencyContact[]> {
    const contacts = await this.getContacts();
    const cleanPhone = phone.trim();
    const cleanName = name.trim() || 'Primary Guardian (Parents / Spouse)';

    let found = false;
    const updated = contacts.map((c) => {
      if (c.isPrimary || (!found && (c.relationship.toLowerCase().includes('family') || c.relationship.toLowerCase().includes('parent')))) {
        found = true;
        return {
          ...c,
          name: cleanName,
          phone: cleanPhone,
          isPrimary: true,
        };
      }
      return {
        ...c,
        isPrimary: false,
      };
    });

    if (!found) {
      if (updated.length > 0) {
        updated[0] = {
          ...updated[0],
          name: cleanName,
          phone: cleanPhone,
          isPrimary: true,
        };
      } else {
        updated.unshift({
          id: `c-${Date.now()}`,
          name: cleanName,
          phone: cleanPhone,
          relationship: 'Family',
          isPrimary: true,
        });
      }
    }

    await this.saveContacts(updated);
    return updated;
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

  /**
   * Standard SOS alert message
   */
  async triggerSosAlert(coords: LocationCoords): Promise<{
    session: SosAlertSession;
    message: string;
    contacts: EmergencyContact[];
  }> {
    const contacts = await this.getContacts();
    const profile = await this.getProfile();

    const mapsUrl = `https://maps.google.com/?q=${coords.latitude},${coords.longitude}`;
    const baseTemplate = profile.sosMessageTemplate || 'EMERGENCY SOS: I need urgent help!';
    const locationArea = coords.address || (coords.city && coords.region ? `${coords.city}, ${coords.region}` : coords.city || '');
    const message = `🚨 ${baseTemplate}\nName: ${profile.name} (${profile.bloodType})${locationArea ? `\nLocation: ${locationArea}` : ''}\nCoordinates: ${coords.latitude.toFixed(5)}, ${coords.longitude.toFixed(5)}\nLive GPS: ${mapsUrl}`;

    const session: SosAlertSession = {
      id: `sos-${Date.now()}`,
      timestamp: new Date().toISOString(),
      coords,
      status: 'active',
      contactsNotified: contacts.map((c) => c.name),
    };

    await this.recordSosHistory(session);
    return { session, message, contacts };
  }

  /**
   * 🤫 SILENT SOS FOR HIDING / CANNOT MAKE NOISE:
   * Explicitly informs family: DO NOT CALL ME (I am hiding/cannot make noise). Send help immediately to GPS.
   */
  async triggerHidingSilentSos(coords: LocationCoords): Promise<{
    message: string;
    primaryPhones: string[];
  }> {
    const contacts = await this.getContacts();
    const profile = await this.getProfile();

    const mapsUrl = `https://maps.google.com/?q=${coords.latitude},${coords.longitude}`;
    const locationArea = coords.address || (coords.city && coords.region ? `${coords.city}, ${coords.region}` : coords.city || '');

    const message = `🚨 URGENT SOS from ${profile.name}!\nI am in acute danger / hiding / suspect I am being followed.\n⚠️ DO NOT CALL ME (I cannot make noise / hiding).\n📍 Live GPS: ${mapsUrl}${locationArea ? `\n📍 Near: ${locationArea}` : ''}\nSend police or help to these coordinates immediately!`;

    const primaryPhones = contacts
      .filter((c) => c.isPrimary || c.relationship.toLowerCase().includes('family') || c.relationship.toLowerCase().includes('spouse') || c.relationship.toLowerCase().includes('parent'))
      .map((c) => c.phone);

    const phonesToUse = primaryPhones.length > 0 ? primaryPhones : contacts.slice(0, 1).map((c) => c.phone);

    const session: SosAlertSession = {
      id: `silent-sos-${Date.now()}`,
      timestamp: new Date().toISOString(),
      coords,
      status: 'active',
      contactsNotified: phonesToUse,
    };
    await this.recordSosHistory(session);

    return { message, primaryPhones: phonesToUse };
  }

  /**
   * 🚶 BEING FOLLOWED / UNSAFE NIGHT TRAVEL ALERT:
   */
  async triggerBeingFollowedSos(coords: LocationCoords): Promise<{
    message: string;
    primaryPhones: string[];
  }> {
    const contacts = await this.getContacts();
    const profile = await this.getProfile();

    const mapsUrl = `https://maps.google.com/?q=${coords.latitude},${coords.longitude}`;
    const locationArea = coords.address || (coords.city && coords.region ? `${coords.city}, ${coords.region}` : coords.city || '');

    const message = `🚨 EMERGENCY: I feel unsafe & suspect I am being followed!\nName: ${profile.name}\n📍 Live Location: ${mapsUrl}${locationArea ? `\n📍 Landmark: ${locationArea}` : ''}\nPlease call me or send help immediately!`;

    const primaryPhones = contacts
      .filter((c) => c.isPrimary)
      .map((c) => c.phone);

    const phonesToUse = primaryPhones.length > 0 ? primaryPhones : contacts.slice(0, 1).map((c) => c.phone);

    return { message, primaryPhones: phonesToUse };
  }

  /**
   * 📍 SHARE LIVE TRIP WITH FAMILY:
   */
  async getLiveTripShareMessage(coords: LocationCoords): Promise<string> {
    const profile = await this.getProfile();
    const mapsUrl = `https://maps.google.com/?q=${coords.latitude},${coords.longitude}`;
    const locationArea = coords.address || (coords.city && coords.region ? `${coords.city}, ${coords.region}` : coords.city || '');

    return `👋 Hey! I am traveling right now.\nTracking my live GPS route: ${mapsUrl}${locationArea ? `\nNear: ${locationArea}` : ''}\nKeeping you updated until I reach home safely. - ${profile.name}`;
  }

  /**
   * Open phone dialer
   */
  async dialEmergencyServices(phoneNumber: string = '112'): Promise<void> {
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

  /**
   * Open SMS composer addressed to phone numbers
   */
  async sendSosSms(phoneNumbers: string[], message: string): Promise<boolean> {
    if (phoneNumbers.length === 0) return false;
    const primaryPhone = phoneNumbers[0];

    // Priority 1: Native Android Direct SMS Composer (Never fails, opens messaging app directly)
    if (Platform.OS === 'android') {
      try {
        const handled = await AlertService.openSmsComposer(primaryPhone, message);
        if (handled) return true;
      } catch (e) {
        console.warn('Native SMS composer failed, using URL fallback:', e);
      }
    }

    // Priority 2: Standard URL scheme fallback
    const separator = Platform.OS === 'ios' ? '&' : '?';
    const cleanPhone = primaryPhone.replace(/[^0-9+]/g, '');
    const url = `sms:${cleanPhone}${separator}body=${encodeURIComponent(message)}`;

    try {
      await Linking.openURL(url);
      return true;
    } catch (e) {
      console.warn('Error sending SMS:', e);
      return false;
    }
  }

  /**
   * Share message via WhatsApp
   */
  async shareViaWhatsApp(message: string, phoneNumber?: string): Promise<boolean> {
    const cleanNumber = phoneNumber ? phoneNumber.replace(/[^0-9]/g, '') : '';
    const whatsappUrl = cleanNumber
      ? `whatsapp://send?phone=${cleanNumber}&text=${encodeURIComponent(message)}`
      : `whatsapp://send?text=${encodeURIComponent(message)}`;

    const fallbackWebUrl = cleanNumber
      ? `https://api.whatsapp.com/send?phone=${cleanNumber}&text=${encodeURIComponent(message)}`
      : `https://api.whatsapp.com/send?text=${encodeURIComponent(message)}`;

    try {
      const canOpen = await Linking.canOpenURL(whatsappUrl);
      if (canOpen) {
        await Linking.openURL(whatsappUrl);
        return true;
      }
      await Linking.openURL(fallbackWebUrl);
      return true;
    } catch (e) {
      console.warn('WhatsApp share error:', e);
      return false;
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
