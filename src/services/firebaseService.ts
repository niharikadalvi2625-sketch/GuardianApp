import { API_CONFIG } from './apiConfig';
import { CloudBackupData } from '../types';

/**
 * Firebase Cloud Service
 * Integrates directly with Firebase Realtime Database & Cloud Storage
 * over high-performance REST APIs without requiring heavy native SDKs.
 */
class FirebaseServiceImpl {
  private databaseUrl: string = API_CONFIG.FIREBASE_DB_URL;

  /**
   * Save user emergency backup snapshot directly to Firebase Realtime Database
   */
  async syncBackupToFirebase(userId: string, backupData: CloudBackupData): Promise<boolean> {
    const endpoint = `${this.databaseUrl}/guardian_users/${userId}/backup.json`;
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), API_CONFIG.REQUEST_TIMEOUT_MS);

      const res = await fetch(endpoint, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(backupData),
        signal: controller.signal,
      });
      clearTimeout(timer);
      return res.ok;
    } catch (_err) {
      return false;
    }
  }

  /**
   * Restore user emergency backup snapshot from Firebase Realtime Database
   */
  async restoreBackupFromFirebase(userId: string): Promise<CloudBackupData | null> {
    const endpoint = `${this.databaseUrl}/guardian_users/${userId}/backup.json`;
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), API_CONFIG.REQUEST_TIMEOUT_MS);

      const res = await fetch(endpoint, { signal: controller.signal });
      clearTimeout(timer);

      if (res.ok) {
        return (await res.json()) as CloudBackupData;
      }
      return null;
    } catch (_err) {
      return null;
    }
  }

  /**
   * Push an incident report to Firebase Realtime Database table `public_hazards`
   */
  async pushHazardToFirebase(report: any): Promise<boolean> {
    const endpoint = `${this.databaseUrl}/public_hazards/${report.id}.json`;
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), API_CONFIG.REQUEST_TIMEOUT_MS);

      const res = await fetch(endpoint, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(report),
        signal: controller.signal,
      });
      clearTimeout(timer);
      return res.ok;
    } catch (_err) {
      return false;
    }
  }
}

export const FirebaseService = new FirebaseServiceImpl();
export default FirebaseService;

