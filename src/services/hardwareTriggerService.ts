import { NativeModules, DeviceEventEmitter, Platform } from 'react-native';
import { StorageService } from './storageService';

const { GuardianAlert } = NativeModules;

const STORAGE_KEYS = {
  POWER_TRIGGER_ENABLED: 'guardian_power_trigger_enabled',
  LOCK_NOTIFICATION_ENABLED: 'guardian_lock_notification_enabled',
};

type PowerTriggerCallback = () => void;

class HardwareTriggerManager {
  private powerTriggerSubscribers: Set<PowerTriggerCallback> = new Set();
  private isListening = false;
  private isInitialized = false;

  async initialize(): Promise<void> {
    if (this.isInitialized || Platform.OS !== 'android') return;
    this.isInitialized = true;

    // Start event listener for power button triple press
    DeviceEventEmitter.addListener('onGuardianPowerTriggerDetected', () => {
      this.powerTriggerSubscribers.forEach((cb) => {
        try {
          cb();
        } catch (_e) {}
      });
    });

    const powerEnabled = await this.isPowerTriggerEnabled();
    if (powerEnabled) {
      await this.startPowerTriggerListener();
    }

    const notifEnabled = await this.isLockScreenNotificationEnabled();
    if (notifEnabled) {
      await this.showLockScreenNotification();
    }
  }

  async isPowerTriggerEnabled(): Promise<boolean> {
    const val = await StorageService.getItem(STORAGE_KEYS.POWER_TRIGGER_ENABLED);
    return val !== 'false'; // Enabled by default
  }

  async setPowerTriggerEnabled(enabled: boolean): Promise<void> {
    await StorageService.setItem(STORAGE_KEYS.POWER_TRIGGER_ENABLED, enabled ? 'true' : 'false');
    if (enabled) {
      await this.startPowerTriggerListener();
    } else {
      await this.stopPowerTriggerListener();
    }
  }

  async isLockScreenNotificationEnabled(): Promise<boolean> {
    const val = await StorageService.getItem(STORAGE_KEYS.LOCK_NOTIFICATION_ENABLED);
    return val !== 'false'; // Enabled by default
  }

  async setLockScreenNotificationEnabled(enabled: boolean): Promise<void> {
    await StorageService.setItem(STORAGE_KEYS.LOCK_NOTIFICATION_ENABLED, enabled ? 'true' : 'false');
    if (enabled) {
      await this.showLockScreenNotification();
    } else {
      await this.hideLockScreenNotification();
    }
  }

  async startPowerTriggerListener(): Promise<void> {
    if (Platform.OS !== 'android' || !GuardianAlert?.startPowerButtonTrigger) return;
    try {
      await GuardianAlert.startPowerButtonTrigger();
      this.isListening = true;
    } catch (_e) {}
  }

  async stopPowerTriggerListener(): Promise<void> {
    if (Platform.OS !== 'android' || !GuardianAlert?.stopPowerButtonTrigger) return;
    try {
      await GuardianAlert.stopPowerButtonTrigger();
      this.isListening = false;
    } catch (_e) {}
  }

  async showLockScreenNotification(): Promise<void> {
    if (Platform.OS !== 'android' || !GuardianAlert?.showEmergencyQuickNotification) return;
    try {
      await GuardianAlert.showEmergencyQuickNotification(
        '🛡️ Guardian Protection Active',
        'Emergency SOS ready • Triple-click power button in danger'
      );
    } catch (_e) {}
  }

  async hideLockScreenNotification(): Promise<void> {
    if (Platform.OS !== 'android' || !GuardianAlert?.hideEmergencyQuickNotification) return;
    try {
      await GuardianAlert.hideEmergencyQuickNotification();
    } catch (_e) {}
  }

  onPowerTrigger(callback: PowerTriggerCallback): () => void {
    this.powerTriggerSubscribers.add(callback);
    return () => {
      this.powerTriggerSubscribers.delete(callback);
    };
  }
}

export const HardwareTriggerService = new HardwareTriggerManager();
export default HardwareTriggerService;
