import { LocationCoords, SafetyReport, HazardReportType } from '../types';
import { StorageService } from './storageService';
import { LocationService } from './locationService';
import { SQLiteService } from './sqliteService';
import { API_CONFIG } from './apiConfig';
import { FirebaseService } from './firebaseService';

const REPORTS_CACHE_KEY = '@guardian_community_hazard_reports';
const GLOBAL_TOPIC = API_CONFIG.CLOUD_PUB_SUB_GLOBAL;

export type ReportScope = 'nearby' | 'city' | 'all';

class CommunityReportServiceImpl {
  private memoryReports: SafetyReport[] = [];
  private isInitialized: boolean = false;
  private isSyncing: boolean = false;

  private sanitizeTopicName(city?: string): string {
    if (!city) return 'local';
    return city.toLowerCase().replace(/[^a-z0-9]/g, '_').substring(0, 32);
  }

  /**
   * Initializes local reports from SQLite database and StorageService
   */
  async init(userCoords?: LocationCoords | null): Promise<SafetyReport[]> {
    try {
      // 1. Check local SQLite Database
      if (SQLiteService.isSQLiteAvailable()) {
        const sqliteReports = await SQLiteService.getReports();
        if (sqliteReports && sqliteReports.length > 0) {
          this.memoryReports = sqliteReports;
          this.isInitialized = true;
          return this.memoryReports;
        }
      }

      // 2. Check StorageService cache
      const stored = await StorageService.getItem(REPORTS_CACHE_KEY);
      if (stored) {
        this.memoryReports = JSON.parse(stored);
      } else if (userCoords) {
        // First launch: generate localized seed reports around user's actual location
        this.memoryReports = this.generateLocalizedSeedReports(userCoords);
        await StorageService.setItem(REPORTS_CACHE_KEY, JSON.stringify(this.memoryReports));
        // Save initial seeds to SQLite
        for (const s of this.memoryReports) {
          await SQLiteService.insertReport(s);
        }
      }
    } catch (_err) {
      if (userCoords) {
        this.memoryReports = this.generateLocalizedSeedReports(userCoords);
      }
    }
    this.isInitialized = true;
    return this.memoryReports;
  }

  /**
   * Retrieves reports sorted and filtered by proximity to the user's location
   */
  async getReports(
    userCoords?: LocationCoords | null,
    scope: ReportScope = 'nearby',
    triggerCloudSync: boolean = true
  ): Promise<SafetyReport[]> {
    if (!this.isInitialized) {
      await this.init(userCoords);
    }

    // Background sync with cloud if requested and not already syncing
    if (triggerCloudSync && !this.isSyncing) {
      this.syncWithCloud(userCoords).catch(() => {});
    }

    // Attach calculated distance to each report relative to userCoords
    const enriched = this.memoryReports.map((report) => {
      let distanceKm: number | undefined;
      if (userCoords && report.latitude && report.longitude) {
        distanceKm = LocationService.calculateDistance(
          userCoords.latitude,
          userCoords.longitude,
          report.latitude,
          report.longitude
        );
      }
      return {
        ...report,
        distanceKm,
      };
    });

    // Apply Scope Filter
    let filtered = enriched;
    if (scope === 'nearby') {
      // Nearby within 50 km (Reports visible to citizens within at least 50km radius)
      filtered = enriched.filter((r) => r.distanceKm === undefined || r.distanceKm <= 50);
    } else if (scope === 'city') {
      const userCity = userCoords?.city?.toLowerCase();
      filtered = enriched.filter(
        (r) =>
          (userCity && r.city?.toLowerCase().includes(userCity)) ||
          (r.distanceKm !== undefined && r.distanceKm <= 75)
      );
    }

    // Sort by proximity (closest first), then by timestamp (newest first)
    filtered.sort((a, b) => {
      if (a.distanceKm !== undefined && b.distanceKm !== undefined) {
        return a.distanceKm - b.distanceKm;
      }
      return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime();
    });

    return filtered;
  }

  /**
   * 📡 Publishes a safety report to the community:
   * 1. Saves to local on-device storage immediately
   * 2. Broadcasts to shared global topic and city-specific topic on ntfy.sh
   */
  async publishReport(
    reportData: {
      title: string;
      type: HazardReportType;
      description: string;
      locality?: string;
      city?: string;
      authorName?: string;
      imageUrl?: string;
      isVerified?: boolean;
      verificationScore?: number;
      detectedHazard?: string;
    },
    userCoords?: LocationCoords | null
  ): Promise<SafetyReport> {
    const coords = userCoords || (await LocationService.getCurrentLocation());
    const locality =
      reportData.locality ||
      coords.subLocality ||
      coords.city ||
      'Neighborhood Location';
    const city = reportData.city || coords.city || 'My City';

    const newReport: SafetyReport = {
      id: `rep_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      title: reportData.title.trim(),
      type: reportData.type,
      description: reportData.description.trim(),
      latitude: coords.latitude,
      longitude: coords.longitude,
      locality,
      city,
      authorName: reportData.authorName || 'Nearby Citizen',
      timestamp: new Date().toISOString(),
      isSynced: false,
      confirmationsCount: 1,
      imageUrl: reportData.imageUrl,
      isVerified: reportData.isVerified || false,
      verificationScore: reportData.verificationScore || (reportData.imageUrl ? 0.90 : 0.50),
      detectedHazard: reportData.detectedHazard,
    };

    // Calculate distance for creator
    newReport.distanceKm = 0.0;

    // 1. Optimistic Local Save (Memory + StorageService + Native Android SQLite)
    this.memoryReports = [newReport, ...this.memoryReports];
    await StorageService.setItem(REPORTS_CACHE_KEY, JSON.stringify(this.memoryReports));
    await SQLiteService.insertReport(newReport);

    // 2. Cloud Broadcast: Python/Flask API + Firebase + Global Pub/Sub
    try {
      // Post to Python/Flask backend if active
      fetch(`${API_CONFIG.FLASK_BASE_URL}/api/reports`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newReport),
      }).catch(() => {});

      // Push to Google Firebase Realtime Database
      FirebaseService.pushHazardToFirebase(newReport).catch(() => {});

      // Broadcast to Global Pub/Sub channel
      const payload = JSON.stringify({
        action: 'new_report',
        report: newReport,
      });

      fetch(GLOBAL_TOPIC, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: payload,
      }).catch(() => {});

      // Broadcast to City channel
      const cityTopic = `https://ntfy.sh/guardian_hazards_${this.sanitizeTopicName(city)}`;
      fetch(cityTopic, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: payload,
      }).catch(() => {});

      newReport.isSynced = true;
      await StorageService.setItem(REPORTS_CACHE_KEY, JSON.stringify(this.memoryReports));
    } catch (_err) {
      // Local SQLite copy preserved even if offline
    }

    return newReport;
  }

  /**
   * 👍 Confirm an active hazard (upvote community verification)
   */
  async confirmReport(reportId: string): Promise<number> {
    let updatedCount = 1;
    this.memoryReports = this.memoryReports.map((r) => {
      if (r.id === reportId) {
        updatedCount = (r.confirmationsCount || 1) + 1;
        return {
          ...r,
          confirmationsCount: updatedCount,
        };
      }
      return r;
    });

    await StorageService.setItem(REPORTS_CACHE_KEY, JSON.stringify(this.memoryReports));

    // Broadcast confirmation upvote to community
    try {
      const payload = JSON.stringify({
        action: 'confirm_report',
        reportId,
        newCount: updatedCount,
        timestamp: Date.now(),
      });
      fetch(GLOBAL_TOPIC, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: payload,
      }).catch(() => {});
    } catch {}

    return updatedCount;
  }

  /**
   * 🔄 Cloud Sync: Fetches community broadcasts from the last 48 hours,
   * merges with local reports, deduplicates, and saves to storage.
   */
  async syncWithCloud(userCoords?: LocationCoords | null): Promise<{
    reports: SafetyReport[];
    newCount: number;
  }> {
    this.isSyncing = true;
    let newCount = 0;

    try {
      // Retrieve messages from the last 48 hours
      const sinceTs = Math.floor(Date.now() / 1000) - 86400 * 2;
      const endpoints = [
        `${GLOBAL_TOPIC}/json?poll=1&since=${sinceTs}`,
      ];

      if (userCoords?.city) {
        const cityTopic = `https://ntfy.sh/guardian_hazards_${this.sanitizeTopicName(userCoords.city)}/json?poll=1&since=${sinceTs}`;
        endpoints.push(cityTopic);
      }

      const existingMap = new Map<string, SafetyReport>();
      this.memoryReports.forEach((r) => existingMap.set(r.id, r));

      // 1. Fetch from Python / Flask REST Backend API if running
      try {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 2500);
        const flaskUrl = `${API_CONFIG.FLASK_BASE_URL}/api/reports?radius_km=100`;
        const fRes = await fetch(flaskUrl, { signal: controller.signal });
        clearTimeout(timer);
        if (fRes.ok) {
          const fData = await fRes.json();
          if (fData.success && Array.isArray(fData.reports)) {
            for (const r of fData.reports) {
              if (!existingMap.has(r.id)) {
                existingMap.set(r.id, r);
                newCount++;
              }
            }
          }
        }
      } catch {}

      // 2. Fetch from Cloud Topics
      for (const ep of endpoints) {
        try {
          const controller = new AbortController();
          const timer = setTimeout(() => controller.abort(), 6000);
          const res = await fetch(ep, { signal: controller.signal });
          clearTimeout(timer);

          if (!res.ok) continue;
          const text = await res.text();
          const lines = text.trim().split('\n').filter(Boolean);

          for (const line of lines) {
            try {
              const msgObj = JSON.parse(line);
              if (msgObj.event === 'message' && msgObj.message) {
                const parsed = JSON.parse(msgObj.message);

                if (parsed.action === 'new_report' && parsed.report?.id) {
                  const cloudReport: SafetyReport = parsed.report;
                  cloudReport.isSynced = true;

                  if (!existingMap.has(cloudReport.id)) {
                    existingMap.set(cloudReport.id, cloudReport);
                    newCount++;
                  } else {
                    // Update confirmations count if higher
                    const existing = existingMap.get(cloudReport.id)!;
                    if ((cloudReport.confirmationsCount || 1) > (existing.confirmationsCount || 1)) {
                      existing.confirmationsCount = cloudReport.confirmationsCount;
                    }
                  }
                } else if (parsed.action === 'confirm_report' && parsed.reportId) {
                  const target = existingMap.get(parsed.reportId);
                  if (target) {
                    target.confirmationsCount = Math.max(
                      target.confirmationsCount || 1,
                      parsed.newCount || 1
                    );
                  }
                }
              }
            } catch {}
          }
        } catch {}
      }

      this.memoryReports = Array.from(existingMap.values());
      await StorageService.setItem(REPORTS_CACHE_KEY, JSON.stringify(this.memoryReports));
    } catch (_err) {
      // Offline fallback
    } finally {
      this.isSyncing = false;
    }

    return {
      reports: this.memoryReports,
      newCount,
    };
  }

  /**
   * Generates realistic initial awareness reports dynamically centered around the user's
   * detected GPS coordinates (e.g. Palghar, Mumbai, etc.) so new users immediately have
   * relevant localized situational awareness instead of unrelated Pune data.
   */
  private generateLocalizedSeedReports(coords: LocationCoords): SafetyReport[] {
    const locality = coords.subLocality || coords.city || 'Station Area';
    const city = coords.city || 'Neighborhood';

    return [
      {
        id: `seed_1_${coords.city || 'local'}`,
        title: `Streetlight Failure & Low Visibility Near ${locality}`,
        type: 'danger',
        description: `Multiple streetlights out along the main road near ${locality}. Dim lighting after 7:00 PM; use caution or travel in groups.`,
        latitude: coords.latitude + 0.006, // ~0.7 km north
        longitude: coords.longitude + 0.003,
        locality: `${locality} Main Road`,
        city,
        authorName: 'Local Watch Volunteer',
        timestamp: new Date(Date.now() - 35 * 60000).toISOString(),
        isSynced: true,
        confirmationsCount: 4,
        imageUrl: 'https://images.unsplash.com/photo-1509114397022-ed747cca3f65?w=600&q=80',
        isVerified: true,
        verificationScore: 0.92,
        detectedHazard: 'Low Visibility & Luminance Hazard',
      },
      {
        id: `seed_2_${coords.city || 'local'}`,
        title: `Waterlogged Underpass / Road Diversion near ${city} Central`,
        type: 'blocked_road',
        description: `Low-lying subway has standing water accumulation. Two-wheelers diverted via parallel flyover.`,
        latitude: coords.latitude - 0.012, // ~1.3 km south
        longitude: coords.longitude - 0.005,
        locality: `${city} Central Subway`,
        city,
        authorName: 'Traffic Warden Alert',
        timestamp: new Date(Date.now() - 90 * 60000).toISOString(),
        isSynced: true,
        confirmationsCount: 7,
        imageUrl: 'https://images.unsplash.com/photo-1515694346937-94d85e41e6f0?w=600&q=80',
        isVerified: true,
        verificationScore: 0.95,
        detectedHazard: 'Roadway Waterlogging Obstruction',
      },
      {
        id: `seed_3_${coords.city || 'local'}`,
        title: `Community Safety & First-Aid Booth at ${locality}`,
        type: 'safe_haven',
        description: `Emergency volunteers stationed with first-aid kits, drinking water, and direct police wireless contact point.`,
        latitude: coords.latitude + 0.004, // ~0.5 km
        longitude: coords.longitude - 0.008,
        locality: `Community Hall, ${locality}`,
        city,
        authorName: 'Disaster Cell Volunteer',
        timestamp: new Date(Date.now() - 150 * 60000).toISOString(),
        isSynced: true,
        confirmationsCount: 12,
        imageUrl: 'https://images.unsplash.com/photo-1584515979956-d9f6e5d09982?w=600&q=80',
        isVerified: true,
        verificationScore: 0.98,
        detectedHazard: 'Verified Community Safe Haven',
      },
    ];
  }
}

export const CommunityReportService = new CommunityReportServiceImpl();
export default CommunityReportService;

