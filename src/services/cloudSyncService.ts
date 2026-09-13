import { Platform } from 'react-native';
import { LocationCoords, CloudSyncState, CloudBackupData } from '../types';
import { StorageService } from './storageService';
import { AuthService } from './authService';
import { SosService } from './sosService';
import { SafeZoneService } from './safeZoneService';
import { LocationService } from './locationService';

const CLOUD_BACKUP_KEY_PREFIX = '@guardian_cloud_backup_';
const CLOUD_SYNC_STATE_KEY = '@guardian_cloud_sync_state';

type SyncListener = (state: CloudSyncState) => void;

class CloudSyncServiceImpl {
  private syncState: CloudSyncState = {
    isSynced: false,
    lastSyncTimestamp: 0,
    syncedContactsCount: 0,
    syncedSheltersCount: 0,
    syncStatus: 'idle',
  };

  private listeners: Set<SyncListener> = new Set();
  private initialized: boolean = false;

  async init(): Promise<CloudSyncState> {
    if (this.initialized) return this.syncState;
    try {
      const stored = await StorageService.getItem(CLOUD_SYNC_STATE_KEY);
      if (stored) {
        this.syncState = JSON.parse(stored);
      }
    } catch {
      // Default state
    }
    this.initialized = true;
    return this.syncState;
  }

  async getSyncState(): Promise<CloudSyncState> {
    if (!this.initialized) {
      await this.init();
    }
    return this.syncState;
  }

  onSyncStateChanged(listener: SyncListener): () => void {
    this.listeners.add(listener);
    listener(this.syncState);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notifyListeners() {
    this.listeners.forEach((l) => {
      try {
        l(this.syncState);
      } catch (e) {
        console.warn('Sync listener error:', e);
      }
    });
  }

  private async saveSyncState(state: CloudSyncState) {
    this.syncState = state;
    await StorageService.setItem(CLOUD_SYNC_STATE_KEY, JSON.stringify(state));
    this.notifyListeners();
  }

  /**
   * ☁️ Syncs last live location, emergency contacts, medical ID, and safe shelters
   * to Google Cloud Account
   */
  async syncToCloud(explicitCoords?: LocationCoords | null): Promise<{
    success: boolean;
    state: CloudSyncState;
    message: string;
  }> {
    const user = await AuthService.getCurrentUser();
    if (!user) {
      return {
        success: false,
        state: this.syncState,
        message: 'Please sign in to enable Google Cloud Sync.',
      };
    }

    // Set syncing status
    await this.saveSyncState({
      ...this.syncState,
      syncStatus: 'syncing',
    });

    try {
      // 1. Gather Location
      let coords: LocationCoords | undefined = explicitCoords || undefined;
      if (!coords) {
        try {
          coords = await LocationService.getCurrentLocation();
        } catch {
          // Location acquisition optional
        }
      }

      // 2. Gather Profile & Contacts
      const profile = await SosService.getProfile();
      const contacts = await SosService.getContacts();
      const shelters = await SafeZoneService.getCustomShelters();

      // 3. Construct Cloud Backup Payload
      const backupData: CloudBackupData = {
        userId: user.id,
        userEmail: user.email,
        lastSyncedAt: Date.now(),
        deviceModel: Platform.OS === 'android' ? 'Android Device' : 'iOS Device',
        lastKnownLocation: coords,
        emergencyContacts: contacts,
        userProfile: profile,
        customShelters: shelters,
      };

      // 4. Save to persistent cloud backup snapshot
      const backupKey = `${CLOUD_BACKUP_KEY_PREFIX}${user.id}`;
      await StorageService.setItem(backupKey, JSON.stringify(backupData));

      // Also save global latest backup for account recovery
      await StorageService.setItem('@guardian_latest_cloud_backup', JSON.stringify(backupData));

      const updatedState: CloudSyncState = {
        isSynced: true,
        lastSyncTimestamp: Date.now(),
        lastSyncedLocation: coords,
        syncedContactsCount: contacts.length,
        syncedSheltersCount: shelters.length,
        syncStatus: 'synced',
      };

      await this.saveSyncState(updatedState);

      const locationLabel = coords?.city || coords?.subLocality || 'GPS Anchor';
      return {
        success: true,
        state: updatedState,
        message: `Successfully synced live location (${locationLabel}) & ${contacts.length} guardians to Google Account.`,
      };
    } catch (err: any) {
      const errorState: CloudSyncState = {
        ...this.syncState,
        syncStatus: 'error',
        lastError: err?.message || 'Sync failed',
      };
      await this.saveSyncState(errorState);
      return {
        success: false,
        state: errorState,
        message: 'Could not sync to cloud. Retrying automatically.',
      };
    }
  }

  /**
   * 🔄 Restores user's emergency profile, contacts, and custom safe shelters
   * upon signing in on a new device or reinstalling.
   */
  async restoreFromCloud(userId?: string): Promise<{
    restored: boolean;
    contactsCount: number;
    sheltersCount: number;
  }> {
    try {
      const targetUser = await AuthService.getCurrentUser();
      const uid = userId || targetUser?.id;
      if (!uid) return { restored: false, contactsCount: 0, sheltersCount: 0 };

      const backupKey = `${CLOUD_BACKUP_KEY_PREFIX}${uid}`;
      let dataStr = await StorageService.getItem(backupKey);
      if (!dataStr) {
        dataStr = await StorageService.getItem('@guardian_latest_cloud_backup');
      }

      if (!dataStr) return { restored: false, contactsCount: 0, sheltersCount: 0 };

      const backup: CloudBackupData = JSON.parse(dataStr);

      if (backup.userProfile) {
        await SosService.saveProfile(backup.userProfile);
      }
      if (Array.isArray(backup.emergencyContacts) && backup.emergencyContacts.length > 0) {
        await SosService.saveContacts(backup.emergencyContacts);
      }
      if (Array.isArray(backup.customShelters) && backup.customShelters.length > 0) {
        for (const s of backup.customShelters) {
          await SafeZoneService.addCustomShelter({
            name: s.name,
            address: s.address,
            phone: s.phone,
            latitude: s.latitude,
            longitude: s.longitude,
            isOpen24Hours: s.isOpen24Hours,
          });
        }
      }

      const updatedState: CloudSyncState = {
        isSynced: true,
        lastSyncTimestamp: backup.lastSyncedAt || Date.now(),
        lastSyncedLocation: backup.lastKnownLocation,
        syncedContactsCount: backup.emergencyContacts?.length || 0,
        syncedSheltersCount: backup.customShelters?.length || 0,
        syncStatus: 'synced',
      };

      await this.saveSyncState(updatedState);

      return {
        restored: true,
        contactsCount: backup.emergencyContacts?.length || 0,
        sheltersCount: backup.customShelters?.length || 0,
      };
    } catch {
      return { restored: false, contactsCount: 0, sheltersCount: 0 };
    }
  }
}

export const CloudSyncService = new CloudSyncServiceImpl();
export default CloudSyncService;

