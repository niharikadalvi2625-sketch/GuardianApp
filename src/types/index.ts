export interface EmergencyContact {
  id: string;
  name: string;
  phone: string;
  relationship: string;
  isPrimary: boolean;
}

export interface UserProfile {
  name: string;
  phone: string;
  bloodType: string;
  allergies: string;
  emergencyNotes: string;
  sosMessageTemplate?: string;
}

export interface LocationCoords {
  latitude: number;
  longitude: number;
  accuracy?: number;
  timestamp?: number;
  city?: string;
  subLocality?: string;
  region?: string;
  country?: string;
  address?: string;
}

export type SafeZoneCategory = 'hospital' | 'police' | 'shelter' | 'fire_station';

export interface SafeZone {
  id: string;
  name: string;
  category: SafeZoneCategory;
  address: string;
  phone: string;
  latitude: number;
  longitude: number;
  isOpen24Hours: boolean;
  distanceKm?: number;
  verified: boolean;
  isUserAdded?: boolean;
}

export type HazardReportType = 'danger' | 'hazard' | 'blocked_road' | 'safe_haven';

export interface SafetyReport {
  id: string;
  title: string;
  type: HazardReportType;
  description: string;
  latitude: number;
  longitude: number;
  timestamp: string;
  isSynced: boolean;
}

export interface SosAlertSession {
  id: string;
  timestamp: string;
  coords: LocationCoords;
  status: 'active' | 'cancelled' | 'resolved';
  contactsNotified: string[];
}

export interface ChatMessage {
  id: string;
  sender: 'user' | 'assistant';
  text: string;
  timestamp: string;
  quickActions?: { label: string; query: string }[];
}

export interface TriageGuide {
  id: string;
  title: string;
  icon: string;
  urgency: 'high' | 'medium' | 'low';
  summary: string;
  steps: string[];
}