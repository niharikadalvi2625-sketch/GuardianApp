// Dynamic Theme Color Palettes for GuardianApp

export interface ThemeColors {
  isDark: boolean;
  background: string;
  cardBg: string;
  cardBorder: string;
  cardElevated: string;
  cardInner: string;
  primary: string;
  primaryDark: string;
  primaryGlow: string;
  primaryHalo: string;
  primaryBg: string;
  primaryBorder: string;
  emerald: string;
  emeraldGlow: string;
  emeraldBg: string;
  emeraldBorder: string;
  blue: string;
  blueBg: string;
  blueBorder: string;
  amber: string;
  amberBg: string;
  amberBorder: string;
  purple: string;
  purpleBg: string;
  purpleBorder: string;
  teal: string;
  tealBg: string;
  tealBorder: string;
  textPrimary: string;
  textSecondary: string;
  textMuted: string;
  divider: string;
  inputBg: string;
  inputBorder: string;
  tabBarBg: string;
  tabBarBorder: string;
  statusBarStyle: 'light-content' | 'dark-content';
  mapCanvas: string;
  mapSatelliteCanvas: string;
  radarGrid: string;
}

export const DarkTheme: ThemeColors = {
  isDark: true,
  background: '#090D16',       // Deepest Obsidian Space
  cardBg: '#111827',           // Dark Command Surface
  cardBorder: 'rgba(255, 255, 255, 0.08)',
  cardElevated: '#1A2234',
  cardInner: '#1E293B',
  primary: '#EF4444',          // Tactical Crimson Alert
  primaryDark: '#B91C1C',
  primaryGlow: 'rgba(239, 68, 68, 0.35)',
  primaryHalo: 'rgba(239, 68, 68, 0.14)',
  primaryBg: 'rgba(239, 68, 68, 0.15)',
  primaryBorder: 'rgba(239, 68, 68, 0.3)',
  emerald: '#10B981',          // Cyber Emerald (Shield Active)
  emeraldGlow: 'rgba(16, 185, 129, 0.25)',
  emeraldBg: 'rgba(16, 185, 129, 0.12)',
  emeraldBorder: 'rgba(16, 185, 129, 0.3)',
  blue: '#3B82F6',             // Electric Cobalt (GPS / Telemetry)
  blueBg: 'rgba(59, 130, 246, 0.12)',
  blueBorder: 'rgba(59, 130, 246, 0.3)',
  amber: '#F59E0B',            // Warning Amber
  amberBg: 'rgba(245, 158, 11, 0.12)',
  amberBorder: 'rgba(245, 158, 11, 0.3)',
  purple: '#8B5CF6',
  purpleBg: 'rgba(139, 92, 246, 0.12)',
  purpleBorder: 'rgba(139, 92, 246, 0.3)',
  teal: '#0D9488',
  tealBg: 'rgba(13, 148, 136, 0.12)',
  tealBorder: 'rgba(13, 148, 136, 0.3)',
  textPrimary: '#F8FAFC',
  textSecondary: '#94A3B8',
  textMuted: '#64748B',
  divider: '#1E293B',
  inputBg: '#1E293B',
  inputBorder: '#334155',
  tabBarBg: '#111827',
  tabBarBorder: 'rgba(255, 255, 255, 0.08)',
  statusBarStyle: 'light-content',
  mapCanvas: '#0A0F1D',
  mapSatelliteCanvas: '#05080E',
  radarGrid: 'rgba(59, 130, 246, 0.18)',
};

export const LightTheme: ThemeColors = {
  isDark: false,
  background: '#F8FAFC',       // Crisp, Clean Modern Light Slate
  cardBg: '#FFFFFF',           // Crisp White Card Surface
  cardBorder: '#E2E8F0',       // Clean, high-clarity border
  cardElevated: '#F1F5F9',     // Subtle slate tint for raised surfaces
  cardInner: '#F8FAFC',
  primary: '#DC2626',          // Authoritative Emergency Red
  primaryDark: '#991B1B',
  primaryGlow: 'rgba(220, 38, 38, 0.22)',
  primaryHalo: 'rgba(220, 38, 38, 0.1)',
  primaryBg: 'rgba(220, 38, 38, 0.08)',
  primaryBorder: 'rgba(220, 38, 38, 0.25)',
  emerald: '#059669',          // Deep, legible emerald
  emeraldGlow: 'rgba(5, 150, 105, 0.2)',
  emeraldBg: 'rgba(5, 150, 105, 0.08)',
  emeraldBorder: 'rgba(5, 150, 105, 0.25)',
  blue: '#2563EB',             // Sharp, clear cobalt blue
  blueBg: 'rgba(37, 99, 235, 0.08)',
  blueBorder: 'rgba(37, 99, 235, 0.25)',
  amber: '#D97706',            // High-contrast warm amber
  amberBg: 'rgba(217, 119, 6, 0.08)',
  amberBorder: 'rgba(217, 119, 6, 0.25)',
  purple: '#7C3AED',
  purpleBg: 'rgba(124, 58, 237, 0.08)',
  purpleBorder: 'rgba(124, 58, 237, 0.25)',
  teal: '#0F766E',
  tealBg: 'rgba(15, 118, 110, 0.08)',
  tealBorder: 'rgba(15, 118, 110, 0.25)',
  textPrimary: '#0F172A',      // High-contrast deep slate text
  textSecondary: '#475569',    // Readable slate-600
  textMuted: '#94A3B8',        // Subdued slate-400
  divider: '#E2E8F0',
  inputBg: '#F1F5F9',
  inputBorder: '#CBD5E1',
  tabBarBg: '#FFFFFF',
  tabBarBorder: '#E2E8F0',
  statusBarStyle: 'dark-content',
  mapCanvas: '#EDF2F7',        // Clear daylight cartographic canvas
  mapSatelliteCanvas: '#0F172A',
  radarGrid: 'rgba(37, 99, 235, 0.2)',
};
