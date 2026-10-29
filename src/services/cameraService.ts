import { Platform, PermissionsAndroid, NativeModules, Alert } from 'react-native';

const { GuardianCamera } = NativeModules;

export interface RealIncidentPhoto {
  uri: string;
  path: string;
  fileSize?: number;
  isRealCapture: boolean;
  capturedAt: string;
}

class CameraServiceImpl {
  /**
   * Check if camera permission is already granted
   */
  async checkCameraPermission(): Promise<boolean> {
    if (Platform.OS === 'android') {
      try {
        return await PermissionsAndroid.check(PermissionsAndroid.PERMISSIONS.CAMERA);
      } catch (_err) {
        return false;
      }
    }
    return true;
  }

  /**
   * Request camera permission from the user (same as location permission)
   */
  async requestCameraPermission(): Promise<boolean> {
    if (Platform.OS === 'android') {
      try {
        const isAlreadyGranted = await PermissionsAndroid.check(PermissionsAndroid.PERMISSIONS.CAMERA);
        if (isAlreadyGranted) {
          return true;
        }

        const granted = await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.CAMERA);
        return granted === PermissionsAndroid.RESULTS.GRANTED;
      } catch (err) {
        console.warn('Camera permission request error:', err);
        return false;
      }
    }
    return true;
  }

  /**
   * Launch native device camera to capture an actual incident photo
   */
  async takePhoto(): Promise<RealIncidentPhoto | null> {
    const hasPermission = await this.requestCameraPermission();
    if (!hasPermission) {
      Alert.alert(
        '📷 Camera Permission Needed',
        'Camera permission was not granted. Guardian requires camera access to take actual real incident photos.\n\nYou can enable camera permission in your phone Settings -> Apps -> Guardian.',
        [{ text: 'OK', style: 'default' }]
      );
      return null;
    }

    if (!GuardianCamera?.launchCamera) {
      Alert.alert('Notice', 'Camera module is not available on this platform.');
      return null;
    }

    try {
      const result = await GuardianCamera.launchCamera();
      if (!result || !result.uri) {
        return null;
      }

      return {
        uri: result.uri,
        path: result.path || result.uri,
        fileSize: result.fileSize,
        isRealCapture: true,
        capturedAt: new Date().toISOString(),
      };
    } catch (err: any) {
      if (err?.code !== 'E_PICKER_CANCELLED') {
        Alert.alert('Camera Error', `Could not capture photo: ${err?.message || 'Unknown error'}`);
      }
      return null;
    }
  }

  /**
   * Pick an actual incident photo from device gallery / camera roll
   */
  async pickFromGallery(): Promise<RealIncidentPhoto | null> {
    if (!GuardianCamera?.launchGallery) {
      Alert.alert('Notice', 'Gallery module is not available on this platform.');
      return null;
    }

    try {
      const result = await GuardianCamera.launchGallery();
      if (!result || !result.uri) {
        return null;
      }

      return {
        uri: result.uri,
        path: result.path || result.uri,
        fileSize: result.fileSize,
        isRealCapture: true,
        capturedAt: new Date().toISOString(),
      };
    } catch (err: any) {
      if (err?.code !== 'E_PICKER_CANCELLED') {
        Alert.alert('Gallery Error', `Could not select photo: ${err?.message || 'Unknown error'}`);
      }
      return null;
    }
  }
}

export const CameraService = new CameraServiceImpl();
