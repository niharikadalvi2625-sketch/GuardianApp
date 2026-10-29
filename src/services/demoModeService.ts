import { LocationCoords, EmergencyContact, UserProfile } from '../types';
import { StorageService } from './storageService';
import { AlertService } from './alertService';

const DEMO_MODE_KEY = '@guardian_examiner_demo_mode';
const GUARDIAN_RESPONSE_KEY = '@guardian_simulated_response';

export interface SimulatedSosPayload {
  victimName: string;
  victimPhone?: string;
  timestamp: string;
  timeFormatted: string;
  batteryLevel: number;
  coords: LocationCoords;
  locality: string;
  trackingUrl: string;
  guardianContact: EmergencyContact;
  sosId: string;
}

export interface GuardianAcknowledgment {
  acknowledged: boolean;
  guardianName: string;
  guardianPhone: string;
  etaMinutes: number;
  message: string;
  timestamp: string;
  policeEscalated?: boolean;
}

type DemoListener = (payload: SimulatedSosPayload | null) => void;
type AckListener = (ack: GuardianAcknowledgment | null) => void;
type StateListener = (enabled: boolean) => void;

class DemoModeServiceImpl {
  private isDemoModeEnabled: boolean = true; // Enabled by default for college evaluations
  private initialized: boolean = false;
  private activePayload: SimulatedSosPayload | null = null;
  private currentAcknowledgment: GuardianAcknowledgment | null = null;
  private alertTimer: ReturnType<typeof setTimeout> | null = null;

  private demoListeners: Set<DemoListener> = new Set();
  private ackListeners: Set<AckListener> = new Set();
  private stateListeners: Set<StateListener> = new Set();

  async init(): Promise<boolean> {
    if (this.initialized) return this.isDemoModeEnabled;
    try {
      const stored = await StorageService.getItem(DEMO_MODE_KEY);
      if (stored !== null) {
        this.isDemoModeEnabled = stored === 'true';
      } else {
        // Default to true for academic grading & viva
        this.isDemoModeEnabled = true;
        await StorageService.setItem(DEMO_MODE_KEY, 'true');
      }

      const storedAck = await StorageService.getItem(GUARDIAN_RESPONSE_KEY);
      if (storedAck) {
        this.currentAcknowledgment = JSON.parse(storedAck);
      }
    } catch {
      this.isDemoModeEnabled = true;
    }
    this.initialized = true;
    return this.isDemoModeEnabled;
  }

  isDemoMode(): boolean {
    return this.isDemoModeEnabled;
  }

  async setDemoMode(enabled: boolean): Promise<void> {
    this.isDemoModeEnabled = enabled;
    await StorageService.setItem(DEMO_MODE_KEY, enabled ? 'true' : 'false');
    this.notifyStateListeners();
    if (!enabled) {
      this.clearActiveDemo();
    }
  }

  async toggleDemoMode(): Promise<boolean> {
    const next = !this.isDemoModeEnabled;
    await this.setDemoMode(next);
    return next;
  }

  onStateChanged(listener: StateListener): () => void {
    this.stateListeners.add(listener);
    listener(this.isDemoModeEnabled);
    return () => this.stateListeners.delete(listener);
  }

  onGuardianAlertReceived(listener: DemoListener): () => void {
    this.demoListeners.add(listener);
    if (this.activePayload) listener(this.activePayload);
    return () => this.demoListeners.delete(listener);
  }

  onGuardianAcknowledged(listener: AckListener): () => void {
    this.ackListeners.add(listener);
    if (this.currentAcknowledgment) listener(this.currentAcknowledgment);
    return () => this.ackListeners.delete(listener);
  }

  getActivePayload(): SimulatedSosPayload | null {
    return this.activePayload;
  }

  getCurrentAcknowledgment(): GuardianAcknowledgment | null {
    return this.currentAcknowledgment;
  }

  /**
   * Called when SOS is triggered in the app.
   * Simulates 2.5 seconds cellular transmission delay, then notifies the simulated guardian.
   */
  simulateIncomingSosAlert(
    coords: LocationCoords | null,
    profile?: UserProfile | null,
    contacts?: EmergencyContact[]
  ): void {
    if (!this.isDemoModeEnabled) return;

    if (this.alertTimer) clearTimeout(this.alertTimer);

    // Pick primary guardian or fallback
    const primaryContact: EmergencyContact = contacts?.find((c) => c.isPrimary) ||
      contacts?.[0] || {
        id: 'mock-dad',
        name: 'Dad',
        phone: '+91 98765 43210',
        relationship: 'Father',
        isPrimary: true,
      };

    const victimName = profile?.name || 'Niharika Dalvi';
    const activeCoords: LocationCoords = coords || {
      latitude: 18.5204,
      longitude: 73.8567,
      accuracy: 5,
      city: 'Pune',
      subLocality: 'FC Road / Shivajinagar',
      address: 'Fergusson College Road',
    };

    const locality =
      activeCoords.subLocality ||
      activeCoords.address ||
      activeCoords.city ||
      'Current GPS Position';

    const sosId = 'sos_' + Math.floor(1000 + Math.random() * 9000);
    const now = new Date();
    const timeFormatted = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    const payload: SimulatedSosPayload = {
      victimName,
      victimPhone: profile?.phone || '+91 91234 56789',
      timestamp: now.toISOString(),
      timeFormatted,
      batteryLevel: 84, // realistic mobile battery level
      coords: activeCoords,
      locality,
      trackingUrl: `https://guardianapp.live/track/${sosId}`,
      guardianContact: primaryContact,
      sosId,
    };

    // 2.5 second network propagation simulation
    this.alertTimer = setTimeout(() => {
      this.activePayload = payload;
      AlertService.triggerHaptic();
      this.notifyDemoListeners(payload);
    }, 2500);
  }

  /**
   * Simulates Guardian tapping "Acknowledge & Mark En Route"
   */
  async acknowledgeAlert(etaMinutes: number = 5, customNote?: string): Promise<GuardianAcknowledgment> {
    if (!this.activePayload) {
      throw new Error('No active SOS alert to acknowledge');
    }

    const ack: GuardianAcknowledgment = {
      acknowledged: true,
      guardianName: this.activePayload.guardianContact.name,
      guardianPhone: this.activePayload.guardianContact.phone,
      etaMinutes,
      message:
        customNote ||
        `I received your live GPS coordinates! I am on my way to your location now. Stay on the line.`,
      timestamp: new Date().toISOString(),
      policeEscalated: false,
    };

    this.currentAcknowledgment = ack;
    await StorageService.setItem(GUARDIAN_RESPONSE_KEY, JSON.stringify(ack));
    AlertService.triggerHaptic();
    this.notifyAckListeners(ack);
    return ack;
  }

  /**
   * Simulates Guardian escalating to 112 Emergency Control Room
   */
  async escalateToPolice(): Promise<GuardianAcknowledgment> {
    if (!this.currentAcknowledgment) {
      await this.acknowledgeAlert(4, 'Alert forwarded to nearest Police Control Room.');
    }
    if (this.currentAcknowledgment) {
      this.currentAcknowledgment.policeEscalated = true;
      this.currentAcknowledgment.message =
        'Emergency dispatched to local PCR Van. Police Patrol unit en route (ETA: 4 mins).';
      await StorageService.setItem(GUARDIAN_RESPONSE_KEY, JSON.stringify(this.currentAcknowledgment));
      this.notifyAckListeners(this.currentAcknowledgment);
    }
    return this.currentAcknowledgment!;
  }

  /**
   * Clears the active demo simulation
   */
  async clearActiveDemo(): Promise<void> {
    if (this.alertTimer) {
      clearTimeout(this.alertTimer);
      this.alertTimer = null;
    }
    this.activePayload = null;
    this.currentAcknowledgment = null;
    await StorageService.removeItem(GUARDIAN_RESPONSE_KEY);
    this.notifyDemoListeners(null);
    this.notifyAckListeners(null);
  }

  private notifyDemoListeners(payload: SimulatedSosPayload | null) {
    this.demoListeners.forEach((fn) => {
      try {
        fn(payload);
      } catch (e) {
        console.warn('Demo listener error:', e);
      }
    });
  }

  private notifyAckListeners(ack: GuardianAcknowledgment | null) {
    this.ackListeners.forEach((fn) => {
      try {
        fn(ack);
      } catch (e) {
        console.warn('Ack listener error:', e);
      }
    });
  }

  private notifyStateListeners() {
    this.stateListeners.forEach((fn) => {
      try {
        fn(this.isDemoModeEnabled);
      } catch (e) {
        console.warn('State listener error:', e);
      }
    });
  }
}

export const DemoModeService = new DemoModeServiceImpl();
