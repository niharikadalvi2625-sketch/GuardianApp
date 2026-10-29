import { NativeModules } from 'react-native';

const { GuardianAlert, GuardianSQLite } = NativeModules;

class StorageServiceImpl {
  private memoryCache: Map<string, string> = new Map();

  async getItem(key: string): Promise<string | null> {
    // Check in-memory cache first
    if (this.memoryCache.has(key)) {
      return this.memoryCache.get(key) ?? null;
    }

    // Try SQLite Database table `kv_store`
    if (GuardianSQLite && typeof GuardianSQLite.sqliteGetItem === 'function') {
      try {
        const sqlVal = await GuardianSQLite.sqliteGetItem(key);
        if (sqlVal !== null && sqlVal !== undefined) {
          this.memoryCache.set(key, sqlVal);
          return sqlVal;
        }
      } catch {}
    }

    // Fall back to SharedPreferences
    if (GuardianAlert && typeof GuardianAlert.getStorageItem === 'function') {
      try {
        const val = await GuardianAlert.getStorageItem(key);
        if (val !== null && val !== undefined) {
          this.memoryCache.set(key, val);
          return val;
        }
      } catch {
        // Fall back to memory
      }
    }

    return null;
  }

  async setItem(key: string, value: string): Promise<void> {
    this.memoryCache.set(key, value);

    // Persist to local SQLite table `kv_store`
    if (GuardianSQLite && typeof GuardianSQLite.sqliteSetItem === 'function') {
      try {
        await GuardianSQLite.sqliteSetItem(key, value);
      } catch {}
    }

    // Also persist to SharedPreferences
    if (GuardianAlert && typeof GuardianAlert.setStorageItem === 'function') {
      try {
        await GuardianAlert.setStorageItem(key, value);
      } catch {
        // Native write error tolerated
      }
    }
  }

  async removeItem(key: string): Promise<void> {
    this.memoryCache.delete(key);

    if (GuardianAlert && typeof GuardianAlert.removeStorageItem === 'function') {
      try {
        await GuardianAlert.removeStorageItem(key);
      } catch {
        // Tolerated
      }
    }
  }

  async clear(): Promise<void> {
    this.memoryCache.clear();

    if (GuardianAlert && typeof GuardianAlert.clearStorage === 'function') {
      try {
        await GuardianAlert.clearStorage();
      } catch {
        // Tolerated
      }
    }
  }
}

export const StorageService = new StorageServiceImpl();
export default StorageService;
