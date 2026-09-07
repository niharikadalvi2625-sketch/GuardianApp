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
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { SosService } from '../services/sosService';
import { UserProfile, EmergencyContact, SosAlertSession } from '../types';

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

  // New Contact Form State
  const [newContactName, setNewContactName] = useState<string>('');
  const [newContactPhone, setNewContactPhone] = useState<string>('');
  const [newContactRel, setNewContactRel] = useState<string>('Family');
  const [newContactPrimary, setNewContactPrimary] = useState<boolean>(false);

  useEffect(() => {
    loadData();
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

        {/* Offline Status Pill */}
        <View style={styles.offlineBanner}>
          <Text style={styles.offlineIcon}>⚡</Text>
          <View style={styles.offlineTextContainer}>
            <Text style={styles.offlineTitle}>Offline Mode Active</Text>
            <Text style={styles.offlineSub}>
              Contacts & Medical ID cached locally. Works without cellular data.
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
});
