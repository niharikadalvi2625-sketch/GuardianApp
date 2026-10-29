import { NativeModules, Platform } from 'react-native';
import { SafetyReport, SafeZone } from '../types';

const { GuardianSQLite } = NativeModules;

export interface SQLiteDatabaseInfo {
  databaseName: string;
  version: number;
  path: string;
  isOpen: boolean;
  tables: string[];
}

class SQLiteServiceImpl {
  private isAvailable: boolean = Platform.OS === 'android' && !!GuardianSQLite;

  /**
   * Check if native SQLite database module is available on this platform
   */
  isSQLiteAvailable(): boolean {
    return this.isAvailable;
  }

  /**
   * Save a safety hazard report to local SQLite database table `safety_reports`
   */
  async insertReport(report: SafetyReport): Promise<boolean> {
    if (!this.isAvailable) return false;
    try {
      return await GuardianSQLite.sqliteInsertReport(JSON.stringify(report));
    } catch (err) {
      console.warn('SQLite insertReport error:', err);
      return false;
    }
  }

  /**
   * Retrieve all safety hazard reports from local SQLite database
   */
  async getReports(): Promise<SafetyReport[]> {
    if (!this.isAvailable) return [];
    try {
      const jsonStr = await GuardianSQLite.sqliteGetReports();
      return JSON.parse(jsonStr) as SafetyReport[];
    } catch (err) {
      console.warn('SQLite getReports error:', err);
      return [];
    }
  }

  /**
   * Delete a report from local SQLite database
   */
  async deleteReport(id: string): Promise<boolean> {
    if (!this.isAvailable) return false;
    try {
      return await GuardianSQLite.sqliteDeleteReport(id);
    } catch (err) {
      console.warn('SQLite deleteReport error:', err);
      return false;
    }
  }

  /**
   * Insert a custom safe haven / emergency shelter into SQLite table `safe_havens`
   */
  async insertSafeHaven(haven: SafeZone): Promise<boolean> {
    if (!this.isAvailable) return false;
    try {
      return await GuardianSQLite.sqliteInsertSafeHaven(JSON.stringify(haven));
    } catch (err) {
      console.warn('SQLite insertSafeHaven error:', err);
      return false;
    }
  }

  /**
   * Retrieve all custom safe havens from local SQLite database
   */
  async getSafeHavens(): Promise<SafeZone[]> {
    if (!this.isAvailable) return [];
    try {
      const jsonStr = await GuardianSQLite.sqliteGetSafeHavens();
      return JSON.parse(jsonStr) as SafeZone[];
    } catch (err) {
      console.warn('SQLite getSafeHavens error:', err);
      return [];
    }
  }

  /**
   * Generic Key-Value set operation in SQLite table `kv_store`
   */
  async setItem(key: string, value: string): Promise<boolean> {
    if (!this.isAvailable) return false;
    try {
      return await GuardianSQLite.sqliteSetItem(key, value);
    } catch (err) {
      console.warn('SQLite setItem error:', err);
      return false;
    }
  }

  /**
   * Generic Key-Value get operation from SQLite table `kv_store`
   */
  async getItem(key: string): Promise<string | null> {
    if (!this.isAvailable) return null;
    try {
      return await GuardianSQLite.sqliteGetItem(key);
    } catch (err) {
      console.warn('SQLite getItem error:', err);
      return null;
    }
  }

  /**
   * Generic Key-Value delete operation from SQLite table `kv_store`
   */
  async removeItem(key: string): Promise<boolean> {
    if (!this.isAvailable) return false;
    try {
      return await GuardianSQLite.sqliteRemoveItem(key);
    } catch (err) {
      console.warn('SQLite removeItem error:', err);
      return false;
    }
  }

  /**
   * Returns SQLite database metadata (database name, version, path, and active tables)
   * Perfect for academic / project inspection during viva or evaluation!
   */
  async getDatabaseInfo(): Promise<SQLiteDatabaseInfo | null> {
    if (!this.isAvailable) return null;
    try {
      return await GuardianSQLite.sqliteGetDatabaseInfo();
    } catch (err) {
      console.warn('SQLite getDatabaseInfo error:', err);
      return null;
    }
  }
}

export const SQLiteService = new SQLiteServiceImpl();
export default SQLiteService;

