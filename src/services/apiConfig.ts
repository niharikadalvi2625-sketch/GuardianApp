import { Platform } from 'react-native';

/**
 * GuardianApp API Configuration
 * Automatically routes to the local Python/Flask backend if available,
 * with seamless fallback to cloud relay services.
 */
export const API_CONFIG = {
  // Android Emulator uses 10.0.2.2 to reach host machine localhost:5000
  // Real device uses host machine's Wi-Fi LAN IP or localhost
  FLASK_BASE_URL:
    Platform.OS === 'android'
      ? 'http://10.0.2.2:5000'
      : 'http://localhost:5000',

  // Community Cloud Pub/Sub Topic
  CLOUD_PUB_SUB_GLOBAL: 'https://ntfy.sh/guardian_community_hazards_global',

  // Firebase Realtime Database
  FIREBASE_DB_URL: 'https://guardianapp-emergency-default-rtdb.firebaseio.com',

  // Timeout settings
  REQUEST_TIMEOUT_MS: 5000,
};

export default API_CONFIG;

