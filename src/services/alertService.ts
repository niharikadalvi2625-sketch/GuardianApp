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
}

export const AlertService = new AlertServiceImpl();
export default AlertService;

