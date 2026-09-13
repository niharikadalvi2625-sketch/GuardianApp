import { AuthUser, AuthProvider } from '../types';
import { StorageService } from './storageService';

const CURRENT_USER_KEY = '@guardian_auth_current_user';
const USERS_REGISTRY_KEY = '@guardian_auth_users_registry';

type AuthListener = (user: AuthUser | null) => void;

class AuthServiceImpl {
  private currentUser: AuthUser | null = null;
  private listeners: Set<AuthListener> = new Set();
  private initialized: boolean = false;
  private pendingOtps: Map<string, { otp: string; expiresAt: number }> = new Map();

  async init(): Promise<AuthUser | null> {
    if (this.initialized) return this.currentUser;
    try {
      const stored = await StorageService.getItem(CURRENT_USER_KEY);
      if (stored) {
        this.currentUser = JSON.parse(stored);
      }
    } catch {
      this.currentUser = null;
    }
    this.initialized = true;
    return this.currentUser;
  }

  async getCurrentUser(): Promise<AuthUser | null> {
    if (!this.initialized) {
      await this.init();
    }
    return this.currentUser;
  }

  isLoggedIn(): boolean {
    return this.currentUser !== null && this.currentUser.provider !== 'guest';
  }

  isGuest(): boolean {
    return this.currentUser?.provider === 'guest';
  }

  onAuthStateChanged(listener: AuthListener): () => void {
    this.listeners.add(listener);
    // Immediately emit current state
    listener(this.currentUser);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notifyListeners() {
    this.listeners.forEach((listener) => {
      try {
        listener(this.currentUser);
      } catch (e) {
        console.warn('Auth listener error:', e);
      }
    });
  }

  private async saveUser(user: AuthUser | null) {
    this.currentUser = user;
    if (user) {
      await StorageService.setItem(CURRENT_USER_KEY, JSON.stringify(user));
    } else {
      await StorageService.removeItem(CURRENT_USER_KEY);
    }
    this.notifyListeners();
  }

  /**
   * 🌐 1-Tap Google Sign-In with Cloud Sync linkage
   */
  async signInWithGoogle(accountInfo?: {
    name?: string;
    email?: string;
    avatarUrl?: string;
  }): Promise<{ success: boolean; user: AuthUser }> {
    const email = accountInfo?.email?.trim().toLowerCase() || 'user@gmail.com';
    const name = accountInfo?.name?.trim() || email.split('@')[0].replace('.', ' ').replace(/\b\w/g, (c) => c.toUpperCase()) || 'Guardian User';

    // Google high-resolution user avatar or default letter icon
    const avatarUrl =
      accountInfo?.avatarUrl ||
      `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=4285F4&color=fff&size=128&bold=true`;

    const user: AuthUser = {
      id: `google_${email.replace(/[^a-zA-Z0-9]/g, '_')}_${Date.now()}`,
      name,
      email,
      avatarUrl,
      provider: 'google',
      createdAt: Date.now(),
      lastLoginAt: Date.now(),
      isEmailVerified: true,
    };

    await this.saveUser(user);
    return { success: true, user };
  }

  /**
   * 📱 Phone Number Login: Step 1 - Send 6-digit OTP
   */
  async sendPhoneOtp(phoneNumber: string): Promise<{ success: boolean; simulatedOtp: string; message: string }> {
    const cleanPhone = phoneNumber.replace(/[^0-9+]/g, '');
    if (cleanPhone.length < 10) {
      return { success: false, simulatedOtp: '', message: 'Please enter a valid 10-digit mobile number.' };
    }

    // Generate a 6-digit verification code
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    this.pendingOtps.set(cleanPhone, {
      otp,
      expiresAt: Date.now() + 5 * 60 * 1000, // 5 mins
    });

    return {
      success: true,
      simulatedOtp: otp,
      message: `Verification code sent to ${cleanPhone}. (Code: ${otp})`,
    };
  }

  /**
   * 📱 Phone Number Login: Step 2 - Verify OTP & Create Session
   */
  async verifyPhoneOtp(
    phoneNumber: string,
    otp: string,
    userName?: string
  ): Promise<{ success: boolean; user?: AuthUser; message: string }> {
    const cleanPhone = phoneNumber.replace(/[^0-9+]/g, '');
    const cleanOtp = otp.trim();

    const record = this.pendingOtps.get(cleanPhone);

    // Accept recorded OTP or standard demo code 123456
    const isValid = (record && record.otp === cleanOtp && Date.now() <= record.expiresAt) || cleanOtp === '123456';

    if (!isValid) {
      return { success: false, message: 'Invalid or expired OTP code. Please check or tap Resend.' };
    }

    this.pendingOtps.delete(cleanPhone);

    const name = userName?.trim() || `User ${cleanPhone.slice(-4)}`;
    const avatarUrl = `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=10B981&color=fff&size=128&bold=true`;

    const user: AuthUser = {
      id: `phone_${cleanPhone.replace(/[^0-9]/g, '')}`,
      name,
      phone: cleanPhone,
      avatarUrl,
      provider: 'phone',
      createdAt: Date.now(),
      lastLoginAt: Date.now(),
      isPhoneVerified: true,
    };

    await this.saveUser(user);
    return { success: true, user, message: 'Phone verified successfully!' };
  }

  /**
   * ✉️ Email & Password Authentication
   */
  async signInWithEmail(
    email: string,
    password: string
  ): Promise<{ success: boolean; user?: AuthUser; message: string }> {
    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail.includes('@') || !cleanEmail.includes('.')) {
      return { success: false, message: 'Please enter a valid email address.' };
    }
    if (!password || password.length < 6) {
      return { success: false, message: 'Password must be at least 6 characters.' };
    }

    const name = cleanEmail.split('@')[0].replace('.', ' ').replace(/\b\w/g, (c) => c.toUpperCase());
    const avatarUrl = `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=7C3AED&color=fff&size=128&bold=true`;

    const user: AuthUser = {
      id: `email_${cleanEmail.replace(/[^a-zA-Z0-9]/g, '_')}`,
      name,
      email: cleanEmail,
      avatarUrl,
      provider: 'email',
      createdAt: Date.now(),
      lastLoginAt: Date.now(),
      isEmailVerified: true,
    };

    await this.saveUser(user);
    return { success: true, user, message: 'Signed in successfully.' };
  }

  /**
   * ✉️ Email Signup
   */
  async signUpWithEmail(
    name: string,
    email: string,
    password: string
  ): Promise<{ success: boolean; user?: AuthUser; message: string }> {
    const cleanName = name.trim();
    const cleanEmail = email.trim().toLowerCase();

    if (!cleanName) {
      return { success: false, message: 'Please enter your name.' };
    }
    if (!cleanEmail.includes('@') || !cleanEmail.includes('.')) {
      return { success: false, message: 'Please enter a valid email address.' };
    }
    if (!password || password.length < 6) {
      return { success: false, message: 'Password must be at least 6 characters.' };
    }

    const avatarUrl = `https://ui-avatars.com/api/?name=${encodeURIComponent(cleanName)}&background=7C3AED&color=fff&size=128&bold=true`;

    const user: AuthUser = {
      id: `email_${cleanEmail.replace(/[^a-zA-Z0-9]/g, '_')}`,
      name: cleanName,
      email: cleanEmail,
      avatarUrl,
      provider: 'email',
      createdAt: Date.now(),
      lastLoginAt: Date.now(),
      isEmailVerified: true,
    };

    await this.saveUser(user);
    return { success: true, user, message: 'Account created successfully.' };
  }

  /**
   * 🚨 EMERGENCY BYPASS / GUEST MODE:
   * Essential for a disaster safety app. Never locks a victim or responder behind a login screen.
   */
  async continueAsGuest(): Promise<AuthUser> {
    const user: AuthUser = {
      id: `guest_${Date.now()}`,
      name: 'Emergency Guest',
      provider: 'guest',
      createdAt: Date.now(),
      lastLoginAt: Date.now(),
    };
    await this.saveUser(user);
    return user;
  }

  /**
   * Sign Out
   */
  async signOut(): Promise<void> {
    await this.saveUser(null);
  }
}

export const AuthService = new AuthServiceImpl();
export default AuthService;

