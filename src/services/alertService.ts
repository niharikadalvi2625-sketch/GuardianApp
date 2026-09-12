import { NativeModules, Vibration, Platform } from 'react-native';

const { GuardianAlert } = NativeModules;

class AlertServiceImpl {
  /**
   * Start phone ring vibration pattern for simulated incoming fake call
   */
  startPhoneRingVibrate(): void {
    if (Platform.OS === 'android' && GuardianAlert?.triggerPhoneRingVibrate) {
      GuardianAlert.triggerPhoneRingVibrate();
    } else {
      // Cross-platform fallback
      Vibration.vibrate([0, 1000, 1000, 1000], true);
    }
  }

  /**
   * Stop simulated phone ring vibration
   */
  stopPhoneRingVibrate(): void {
    if (Platform.OS === 'android' && GuardianAlert?.stopPhoneRingVibrate) {
      GuardianAlert.stopPhoneRingVibrate();
    }
    Vibration.cancel();
  }

  /**
   * Trigger a discreet haptic confirmation tick
   */
  triggerHaptic(): void {
    if (Platform.OS === 'android' && GuardianAlert?.triggerHapticConfirmation) {
      GuardianAlert.triggerHapticConfirmation();
    } else {
      Vibration.vibrate(50);
    }
  }

  /**
   * Directly open SMS composer targeted at phone number with pre-filled distress message
   */
  async openSmsComposer(phone: string, message: string): Promise<boolean> {
    if (Platform.OS === 'android' && GuardianAlert?.openSmsComposer) {
      try {
        const result = await GuardianAlert.openSmsComposer(phone, message);
        return result !== false;
      } catch (e) {
        console.warn('Native openSmsComposer error:', e);
        return false;
      }
    }
    return false;
  }
}

export const AlertService = new AlertServiceImpl();
export default AlertService;

