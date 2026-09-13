import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  Modal,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { SosService } from '../services/sosService';
import { AuthService } from '../services/authService';
import { CloudSyncService } from '../services/cloudSyncService';
import AuthModal from '../components/AuthModal';
import { UserProfile, EmergencyContact, SosAlertSession, AuthUser, CloudSyncState } from '../types';

const THEME = {
  primary: '#E63946',
  primaryDark: '#B71C1C',
  secondary: '#1D3557',
  background: '#F8F9FA',
  cardBg: '#FFFFFF',
  textPrimary: '#1E293B',
  textSecondary: '#64748B',
  textLight: '#94A3B8',
  safeGreen: '#2A9D8F',
  safeGreenBg: '#E8F5E9',
  border: '#E2E8F0',
};

const BLOOD_TYPES = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];

export default function ProfileScreen() {
  const [profile, setProfile] = useState<UserProfile>({
    name: '',
    phone: '',
    bloodType: 'O+',
    allergies: '',
    emergencyNotes: '',
    sosMessageTemplate: '',
  });
  const [contacts, setContacts] = useState<EmergencyContact[]>([]);
  const [history, setHistory] = useState<SosAlertSession[]>([]);
  const [isEditingProfile, setIsEditingProfile] = useState<boolean>(false);
  const [addContactModal, setAddContactModal] = useState<boolean>(false);

  // Authentication & Cloud Sync State
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(null);
  const [syncState, setSyncState] = useState<CloudSyncState | null>(null);
  const [authModalVisible, setAuthModalVisible] = useState<boolean>(false);
  const [syncing, setSyncing] = useState<boolean>(false);

  // New Contact Form State
  const [newContactName, setNewContactName] = useState<string>('');
  const [newContactPhone, setNewContactPhone] = useState<string>('');
  const [newContactRel, setNewContactRel] = useState<string>('Family');
  const [newContactPrimary, setNewContactPrimary] = useState<boolean>(false);

  useEffect(() => {
    loadData();
    const unsubAuth = AuthService.onAuthStateChanged((user) => {
      setCurrentUser(user);
    });
    const unsubSync = CloudSyncService.onSyncStateChanged((state) => {
      setSyncState(state);
    });
    return () => {
      unsubAuth();
      unsubSync();
    };
  }, []);

  const loadData = async () => {
    const p = await SosService.getProfile();
    const c = await SosService.getContacts();
    const h = await SosService.getSosHistory();
    setProfile(p);
    setContacts(c);
    setHistory(h);
  };

  const handleSaveProfile = async () => {
    await SosService.saveProfile(profile);
    setIsEditingProfile(false);
    Alert.alert('Saved', 'Medical ID & Emergency Profile updated successfully.');
  };

  const handleAddContact = async () => {
    if (!newContactName.trim() || !newContactPhone.trim()) {
      Alert.alert('Incomplete', 'Please enter both contact name and phone number.');
      return;
    }

    const newContact: EmergencyContact = {
      id: `c-${Date.now()}`,
      name: newContactName.trim(),
      phone: newContactPhone.trim(),
      relationship: newContactRel.trim() || 'Contact',
      isPrimary: newContactPrimary,
    };

    let updated = [...contacts];
    if (newContactPrimary) {
      updated = updated.map((c) => ({ ...c, isPrimary: false }));
    }
    updated.push(newContact);

    await SosService.saveContacts(updated);
    setContacts(updated);
    setAddContactModal(false);
    setNewContactName('');
    setNewContactPhone('');
    setNewContactPrimary(false);
  };

  const handleDeleteContact = (id: string) => {
    Alert.alert('Delete Guardian', 'Are you sure you want to remove this emergency contact?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          const updated = contacts.filter((c) => c.id !== id);
          await SosService.saveContacts(updated);
          setContacts(updated);
        },
      },
    ]);
  };

  const handleTogglePrimary = async (id: string) => {
    const updated = contacts.map((c) => ({
      ...c,
      isPrimary: c.id === id,
    }));
    await SosService.saveContacts(updated);
    setContacts(updated);
  };

  const handleManualSync = async () => {
    setSyncing(true);
    try {
      const res = await CloudSyncService.syncToCloud();
      Alert.alert(res.success ? '☁️ Google Cloud Synced' : 'Sync Notice', res.message);
    } finally {
      setSyncing(false);
    }
  };

  const handleSignOut = () => {
    Alert.alert('Sign Out', 'Are you sure you want to disconnect? Your offline emergency data will stay safe on this device.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign Out',
        style: 'destructive',
        onPress: async () => {
          await AuthService.signOut();
          setCurrentUser(null);
        },
      },
    ]);
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Profile & Guardians</Text>
          <Text style={styles.headerSubtitle}>
            Emergency Medical ID & Trusted Dispatch Contacts
          </Text>
        </View>

        {/* --- GOOGLE ACCOUNT & CLOUD SYNC CARD --- */}
        {currentUser && currentUser.provider !== 'guest' ? (
          <View style={styles.accountCard}>
            <View style={styles.accountTopRow}>
              <View style={styles.avatarCircle}>
                <Text style={styles.avatarText}>
                  {currentUser.name ? currentUser.name.charAt(0).toUpperCase() : 'G'}
                </Text>
              </View>
              <View style={styles.accountInfoCol}>
                <View style={styles.accountNameRow}>
                  <Text style={styles.accountUserName} numberOfLines={1}>
                    {currentUser.name}
                  </Text>
                  <View style={styles.providerBadge}>
                    <Text style={styles.providerBadgeText}>
                      {currentUser.provider === 'google' ? 'GOOGLE SYNCED' : currentUser.provider.toUpperCase()}
                    </Text>
                  </View>
                </View>
                <Text style={styles.accountUserEmail} numberOfLines={1}>
                  {currentUser.email || currentUser.phone || 'Connected Account'}
                </Text>
              </View>
            </View>

            {/* Cloud Sync Status Info */}
            <View style={styles.cloudSyncBox}>
              <View style={styles.syncStatusRow}>
                <Text style={styles.syncStatusDot}>🟢</Text>
                <Text style={styles.syncStatusHeadline}>
                  Google Cloud Live Sync Active
                </Text>
              </View>

              <Text style={styles.syncDetailText}>
                📍 Last Location:{' '}
                <Text style={styles.syncDetailBold}>
                  {syncState?.lastSyncedLocation?.city ||
                    syncState?.lastSyncedLocation?.subLocality ||
                    'Auto-anchored to GPS'}
                </Text>
              </Text>
              <Text style={styles.syncDetailText}>
                🛡️ Backed Up Guardians:{' '}
                <Text style={styles.syncDetailBold}>{contacts.length} emergency contacts</Text>
              </Text>
              <Text style={styles.syncDetailText}>
                🩺 Medical Profile:{' '}
                <Text style={styles.syncDetailBold}>Synced ({profile.bloodType || 'ID saved'})</Text>
              </Text>
            </View>

            {/* Action Buttons: Sync Now & Sign Out */}
            <View style={styles.accountActionsRow}>
              <TouchableOpacity
                style={styles.syncNowBtn}
                onPress={handleManualSync}
                disabled={syncing}
                activeOpacity={0.8}
              >
                {syncing ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <>
                    <Text style={styles.syncNowIcon}>☁️</Text>
                    <Text style={styles.syncNowText}>Sync to Cloud Now</Text>
                  </>
                )}
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.signOutBtn}
                onPress={handleSignOut}
                activeOpacity={0.8}
              >
                <Text style={styles.signOutText}>Sign Out</Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : (
          <TouchableOpacity
            style={styles.connectGoogleCard}
            onPress={() => setAuthModalVisible(true)}
            activeOpacity={0.88}
          >
            <View style={styles.connectGoogleIconBg}>
              <Text style={styles.connectGoogleIcon}>🌐</Text>
            </View>
            <View style={styles.connectGoogleTextCol}>
              <Text style={styles.connectGoogleTitle}>Sign in with Google to Sync Location</Text>
              <Text style={styles.connectGoogleSub}>
                Automatically back up your live coordinates, parents' numbers, and medical ID to Google Cloud.
              </Text>
              <View style={styles.connectGooglePill}>
                <Text style={styles.connectGooglePillText}>CONNECT GOOGLE ACCOUNT ➔</Text>
              </View>
            </View>
          </TouchableOpacity>
        )}

        {/* Offline Status Pill */}
        <View style={styles.offlineBanner}>
          <Text style={styles.offlineIcon}>⚡</Text>
          <View style={styles.offlineTextContainer}>
            <Text style={styles.offlineTitle}>Device Disk Storage Active</Text>
            <Text style={styles.offlineSub}>
              Contacts & Medical ID securely cached in native disk storage. Works offline.
            </Text>
          </View>
        </View>

        {/* Section 1: Emergency Medical ID */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <View style={styles.cardTitleRow}>
              <Text style={styles.cardIcon}>🩺</Text>
              <Text style={styles.cardTitle}>Emergency Medical ID</Text>
            </View>
            <TouchableOpacity
              style={styles.editBtn}
              onPress={() => {
                if (isEditingProfile) handleSaveProfile();
                else setIsEditingProfile(true);
              }}
            >
              <Text style={styles.editBtnText}>
                {isEditingProfile ? 'Save' : 'Edit'}
              </Text>
            </TouchableOpacity>
          </View>

          {isEditingProfile ? (
            <View style={styles.formContainer}>
              <Text style={styles.inputLabel}>Full Name</Text>
              <TextInput
                style={styles.input}
                value={profile.name}
                onChangeText={(v) => setProfile({ ...profile, name: v })}
                placeholder="e.g. Alex Morgan"
              />

              <Text style={styles.inputLabel}>Blood Type</Text>
              <View style={styles.bloodTypeRow}>
                {BLOOD_TYPES.map((bt) => (
                  <TouchableOpacity
                    key={bt}
                    style={[
                      styles.bloodChip,
                      profile.bloodType.startsWith(bt) && styles.bloodChipActive,
                    ]}
                    onPress={() => setProfile({ ...profile, bloodType: bt })}
                  >
                    <Text
                      style={[
                        styles.bloodChipText,
                        profile.bloodType.startsWith(bt) && styles.bloodChipTextActive,
                      ]}
                    >
                      {bt}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={styles.inputLabel}>Known Allergies</Text>
              <TextInput
                style={styles.input}
                value={profile.allergies}
                onChangeText={(v) => setProfile({ ...profile, allergies: v })}
                placeholder="e.g. Penicillin, Peanuts"
              />

              <Text style={styles.inputLabel}>Medical Conditions & Emergency Notes</Text>
              <TextInput
                style={[styles.input, styles.textArea]}
                multiline
                numberOfLines={3}
                value={profile.emergencyNotes}
                onChangeText={(v) => setProfile({ ...profile, emergencyNotes: v })}
                placeholder="e.g. Asthmatic, carries epi-pen in bag"
              />
            </View>
          ) : (
            <View style={styles.infoGrid}>
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>User Name</Text>
                <Text style={styles.infoValue}>{profile.name || 'Not specified'}</Text>
              </View>
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Blood Group</Text>
                <View style={styles.bloodBadge}>
                  <Text style={styles.bloodBadgeText}>{profile.bloodType || 'Unknown'}</Text>
                </View>
              </View>
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Allergies</Text>
                <Text style={styles.infoValue}>{profile.allergies || 'None listed'}</Text>
              </View>
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Emergency Notes</Text>
                <Text style={styles.infoValue}>
                  {profile.emergencyNotes || 'No notes specified'}
                </Text>
              </View>
            </View>
          )}
        </View>

        {/* Section 2: Guardian Contacts */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <View style={styles.cardTitleRow}>
              <Text style={styles.cardIcon}>🛡️</Text>
              <Text style={styles.cardTitle}>Trusted Guardians ({contacts.length})</Text>
            </View>
            <TouchableOpacity
              style={styles.addBtn}
              onPress={() => setAddContactModal(true)}
            >
              <Text style={styles.addBtnText}>+ Add</Text>
            </TouchableOpacity>
          </View>

          {contacts.length === 0 ? (
            <Text style={styles.emptyText}>
              No emergency contacts yet. Tap "+ Add" to add family or friends.
            </Text>
          ) : (
            contacts.map((contact) => (
              <View key={contact.id} style={styles.contactItem}>
                <View style={styles.contactDetails}>
                  <View style={styles.contactNameRow}>
                    <Text style={styles.contactName}>{contact.name}</Text>
                    {contact.isPrimary && (
                      <View style={styles.primaryBadge}>
                        <Text style={styles.primaryBadgeText}>PRIMARY</Text>
                      </View>
                    )}
                  </View>
                  <Text style={styles.contactPhone}>{contact.phone}</Text>
                  <Text style={styles.contactRel}>{contact.relationship}</Text>
                </View>

                <View style={styles.contactActions}>
                  {!contact.isPrimary && (
                    <TouchableOpacity
                      style={styles.makePrimaryBtn}
                      onPress={() => handleTogglePrimary(contact.id)}
                    >
                      <Text style={styles.makePrimaryText}>Make Primary</Text>
                    </TouchableOpacity>
                  )}
                  <TouchableOpacity
                    style={styles.deleteContactBtn}
                    onPress={() => handleDeleteContact(contact.id)}
                  >
                    <Text style={styles.deleteContactText}>🗑️</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ))
          )}
        </View>

        {/* Section 3: Recent SOS Alert Log */}
        <View style={styles.card}>
          <View style={styles.cardTitleRow}>
            <Text style={styles.cardIcon}>🚨</Text>
            <Text style={styles.cardTitle}>Recent SOS Dispatch History</Text>
          </View>

          {history.length === 0 ? (
            <Text style={styles.emptyText}>
              No emergency alerts recorded. Your system is safe and ready.
            </Text>
          ) : (
            history.slice(0, 5).map((item) => (
              <View key={item.id} style={styles.historyItem}>
                <View style={styles.historyHeader}>
                  <Text style={styles.historyStatus}>
                    {item.status.toUpperCase()} ALERT
                  </Text>
                  <Text style={styles.historyDate}>
                    {new Date(item.timestamp).toLocaleDateString()}{' '}
                    {new Date(item.timestamp).toLocaleTimeString([], {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </Text>
                </View>
                <Text style={styles.historyCoords}>
                  Coordinates: {item.coords.latitude.toFixed(4)},{' '}
                  {item.coords.longitude.toFixed(4)}
                </Text>
                <Text style={styles.historyNotified}>
                  Pushed to: {item.contactsNotified.join(', ')}
                </Text>
              </View>
            ))
          )}
        </View>
      </ScrollView>

      {/* Modal: Add Guardian Contact */}
      <Modal
        visible={addContactModal}
        animationType="slide"
        transparent
        onRequestClose={() => setAddContactModal(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Add Trusted Guardian</Text>
              <TouchableOpacity onPress={() => setAddContactModal(false)}>
                <Text style={styles.modalClose}>✕</Text>
              </TouchableOpacity>
            </View>

            <Text style={styles.inputLabel}>Full Name</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g. John Doe"
              value={newContactName}
              onChangeText={setNewContactName}
            />

            <Text style={styles.inputLabel}>Phone Number</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g. +1 (555) 123-4567"
              keyboardType="phone-pad"
              value={newContactPhone}
              onChangeText={setNewContactPhone}
            />

            <Text style={styles.inputLabel}>Relationship</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g. Parent, Sibling, Friend"
              value={newContactRel}
              onChangeText={setNewContactRel}
            />

            <TouchableOpacity
              style={styles.checkboxRow}
              onPress={() => setNewContactPrimary(!newContactPrimary)}
              activeOpacity={0.7}
            >
              <View style={[styles.checkbox, newContactPrimary && styles.checkboxActive]}>
                {newContactPrimary && <Text style={styles.checkmark}>✓</Text>}
              </View>
              <Text style={styles.checkboxLabel}>Set as Primary Guardian (1st to receive SOS)</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.submitBtn}
              onPress={handleAddContact}
              activeOpacity={0.8}
            >
              <Text style={styles.submitBtnText}>Save Guardian Contact</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <AuthModal
        visible={authModalVisible}
        onClose={() => setAuthModalVisible(false)}
        onSuccess={(u) => {
          setCurrentUser(u);
          loadData();
        }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: THEME.background,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 40,
  },
  header: {
    marginBottom: 16,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: THEME.textPrimary,
  },
  headerSubtitle: {
    fontSize: 13,
    color: THEME.textSecondary,
    marginTop: 4,
    fontWeight: '500',
  },
  offlineBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F0FDF4',
    padding: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#BBF7D0',
    marginBottom: 18,
  },
  offlineIcon: {
    fontSize: 20,
    marginRight: 10,
  },
  offlineTextContainer: {
    flex: 1,
  },
  offlineTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: '#166534',
  },
  offlineSub: {
    fontSize: 11,
    color: '#15803D',
    marginTop: 2,
  },
  card: {
    backgroundColor: THEME.cardBg,
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: THEME.border,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.03,
    shadowRadius: 6,
    elevation: 1,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  cardTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  cardIcon: {
    fontSize: 18,
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: THEME.textPrimary,
  },
  editBtn: {
    backgroundColor: '#F1F5F9',
    paddingVertical: 4,
    paddingHorizontal: 12,
    borderRadius: 8,
  },
  editBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: THEME.secondary,
  },
  addBtn: {
    backgroundColor: THEME.primary,
    paddingVertical: 4,
    paddingHorizontal: 12,
    borderRadius: 8,
  },
  addBtnText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  formContainer: {
    marginTop: 6,
  },
  inputLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: THEME.textSecondary,
    marginBottom: 4,
    marginTop: 8,
    textTransform: 'uppercase',
  },
  input: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: THEME.border,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 13,
    color: THEME.textPrimary,
  },
  textArea: {
    minHeight: 64,
    textAlignVertical: 'top',
  },
  bloodTypeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 6,
  },
  bloodChip: {
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 8,
    backgroundColor: '#F1F5F9',
  },
  bloodChipActive: {
    backgroundColor: THEME.primary,
  },
  bloodChipText: {
    fontSize: 11,
    fontWeight: '800',
    color: THEME.textSecondary,
  },
  bloodChipTextActive: {
    color: '#FFFFFF',
  },
  infoGrid: {
    gap: 10,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 4,
    borderBottomWidth: 1,
    borderBottomColor: '#F8FAFC',
  },
  infoLabel: {
    fontSize: 13,
    color: THEME.textSecondary,
    fontWeight: '600',
  },
  infoValue: {
    fontSize: 13,
    fontWeight: '700',
    color: THEME.textPrimary,
    maxWidth: '65%',
    textAlign: 'right',
  },
  bloodBadge: {
    backgroundColor: '#FEE2E2',
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderRadius: 6,
  },
  bloodBadgeText: {
    fontSize: 12,
    fontWeight: '800',
    color: THEME.primary,
  },
  emptyText: {
    fontSize: 13,
    color: THEME.textLight,
    fontStyle: 'italic',
    paddingVertical: 8,
  },
  contactItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  contactDetails: {
    flex: 1,
  },
  contactNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  contactName: {
    fontSize: 14,
    fontWeight: '700',
    color: THEME.textPrimary,
  },
  primaryBadge: {
    backgroundColor: THEME.safeGreenBg,
    paddingVertical: 2,
    paddingHorizontal: 6,
    borderRadius: 4,
  },
  primaryBadgeText: {
    fontSize: 8,
    fontWeight: '800',
    color: THEME.safeGreen,
  },
  contactPhone: {
    fontSize: 12,
    color: THEME.textSecondary,
    marginTop: 2,
  },
  contactRel: {
    fontSize: 11,
    color: THEME.textLight,
    marginTop: 1,
  },
  contactActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  makePrimaryBtn: {
    backgroundColor: '#EFF6FF',
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 6,
  },
  makePrimaryText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#2563EB',
  },
  deleteContactBtn: {
    padding: 6,
  },
  deleteContactText: {
    fontSize: 14,
  },
  historyItem: {
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  historyHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  historyStatus: {
    fontSize: 11,
    fontWeight: '800',
    color: THEME.primary,
  },
  historyDate: {
    fontSize: 11,
    color: THEME.textLight,
  },
  historyCoords: {
    fontSize: 12,
    color: THEME.textSecondary,
    marginTop: 2,
  },
  historyNotified: {
    fontSize: 11,
    color: THEME.textLight,
    marginTop: 1,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.6)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: THEME.textPrimary,
  },
  modalClose: {
    fontSize: 18,
    color: THEME.textLight,
    padding: 4,
  },
  checkboxRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginVertical: 14,
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: THEME.border,
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkboxActive: {
    backgroundColor: THEME.primary,
    borderColor: THEME.primary,
  },
  checkmark: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '800',
  },
  checkboxLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: THEME.textSecondary,
    flex: 1,
  },
  submitBtn: {
    backgroundColor: THEME.primary,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 8,
  },
  submitBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
  },
  accountCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  accountTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  avatarCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#4285F4',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  avatarText: {
    fontSize: 20,
    fontWeight: '900',
    color: '#FFFFFF',
  },
  accountInfoCol: {
    flex: 1,
  },
  accountNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 2,
  },
  accountUserName: {
    fontSize: 16,
    fontWeight: '800',
    color: THEME.textPrimary,
    flex: 1,
    marginRight: 8,
  },
  providerBadge: {
    backgroundColor: '#EFF6FF',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#BFDBFE',
  },
  providerBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#2563EB',
  },
  accountUserEmail: {
    fontSize: 12,
    color: THEME.textSecondary,
  },
  cloudSyncBox: {
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 12,
  },
  syncStatusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  syncStatusDot: {
    fontSize: 10,
    marginRight: 6,
  },
  syncStatusHeadline: {
    fontSize: 12,
    fontWeight: '800',
    color: '#15803D',
    letterSpacing: 0.3,
  },
  syncDetailText: {
    fontSize: 12,
    color: THEME.textSecondary,
    marginBottom: 2,
  },
  syncDetailBold: {
    fontWeight: '700',
    color: THEME.textPrimary,
  },
  accountActionsRow: {
    flexDirection: 'row',
    gap: 10,
  },
  syncNowBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#2563EB',
    borderRadius: 10,
    paddingVertical: 10,
  },
  syncNowIcon: {
    fontSize: 14,
    marginRight: 6,
  },
  syncNowText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  signOutBtn: {
    backgroundColor: '#F1F5F9',
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  signOutText: {
    fontSize: 13,
    fontWeight: '700',
    color: THEME.textSecondary,
  },
  connectGoogleCard: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 16,
    borderWidth: 1.5,
    borderColor: '#93C5FD',
    marginBottom: 16,
    shadowColor: '#3B82F6',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 10,
    elevation: 3,
  },
  connectGoogleIconBg: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: '#EFF6FF',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  connectGoogleIcon: {
    fontSize: 22,
  },
  connectGoogleTextCol: {
    flex: 1,
  },
  connectGoogleTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#1E40AF',
    marginBottom: 3,
  },
  connectGoogleSub: {
    fontSize: 12,
    color: THEME.textSecondary,
    lineHeight: 16,
    marginBottom: 8,
  },
  connectGooglePill: {
    alignSelf: 'flex-start',
    backgroundColor: '#2563EB',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  connectGooglePillText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: 0.5,
  },
});
