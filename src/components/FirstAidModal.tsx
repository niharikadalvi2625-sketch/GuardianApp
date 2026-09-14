import React, { useState, useEffect, useRef } from 'react';
import {
  StyleSheet,
  Text,
  View,
  Modal,
  TouchableOpacity,
  ScrollView,
  TextInput,
  Animated,
  Linking,
  StatusBar,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  FirstAidService,
  FirstAidPlaybook,
  FirstAidCategory,
  FIRST_AID_CATEGORIES,
} from '../services/firstAidService';
import { AlertService } from '../services/alertService';

interface FirstAidModalProps {
  visible: boolean;
  onClose: () => void;
  initialPlaybookId?: string;
}

export default function FirstAidModal({
  visible,
  onClose,
  initialPlaybookId,
}: FirstAidModalProps) {
  const [selectedCategory, setSelectedCategory] = useState<FirstAidCategory>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedPlaybook, setSelectedPlaybook] = useState<FirstAidPlaybook | null>(null);

  // CPR Metronome State
  const [metronomeActive, setMetronomeActive] = useState<boolean>(false);
  const metronomeAnim = useRef(new Animated.Value(1)).current;
  const metronomeInterval = useRef<any>(null);

  useEffect(() => {
    if (visible && initialPlaybookId) {
      const pb = FirstAidService.getPlaybookById(initialPlaybookId);
      if (pb) setSelectedPlaybook(pb);
    }
  }, [visible, initialPlaybookId]);

  useEffect(() => {
    if (metronomeActive) {
      // 110 BPM = 60,000ms / 110 = ~545ms per beat
      const beatIntervalMs = 545;

      metronomeInterval.current = setInterval(() => {
        AlertService.triggerHaptic();
        Animated.sequence([
          Animated.timing(metronomeAnim, {
            toValue: 1.3,
            duration: 120,
            useNativeDriver: true,
          }),
          Animated.timing(metronomeAnim, {
            toValue: 1,
            duration: 150,
            useNativeDriver: true,
          }),
        ]).start();
      }, beatIntervalMs);
    } else {
      if (metronomeInterval.current) {
        clearInterval(metronomeInterval.current);
        metronomeInterval.current = null;
      }
      metronomeAnim.setValue(1);
    }

    return () => {
      if (metronomeInterval.current) {
        clearInterval(metronomeInterval.current);
      }
    };
  }, [metronomeActive]);

  const handleSelectPlaybook = (pb: FirstAidPlaybook) => {
    AlertService.triggerHaptic();
    setSelectedPlaybook(pb);
    setMetronomeActive(false);
  };

  const handleBackToList = () => {
    AlertService.triggerHaptic();
    setSelectedPlaybook(null);
    setMetronomeActive(false);
  };

  const handleCallEmergency = (phone: string) => {
    AlertService.triggerHaptic();
    Linking.openURL(`tel:${phone}`).catch(() => {});
  };

  const playbooks = FirstAidService.search(searchQuery, selectedCategory);

  if (!visible) return null;

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle="light-content" backgroundColor="#0F172A" />

        {/* Top Header */}
        <View style={styles.topHeader}>
          <View style={styles.topHeaderLeft}>
            {selectedPlaybook ? (
              <TouchableOpacity style={styles.backBtn} onPress={handleBackToList}>
                <Text style={styles.backBtnIcon}>←</Text>
                <Text style={styles.backBtnText}>All Guides</Text>
              </TouchableOpacity>
            ) : (
              <View>
                <Text style={styles.headerTitle}>🩺 First-Aid & Survival</Text>
                <Text style={styles.headerSubtitle}>100% Offline Emergency Protocols</Text>
              </View>
            )}
          </View>

          <View style={styles.topHeaderRight}>
            <TouchableOpacity
              style={styles.call108Btn}
              onPress={() => handleCallEmergency('108')}
              activeOpacity={0.8}
            >
              <Text style={styles.call108Text}>📞 108</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.closeBtn} onPress={onClose}>
              <Text style={styles.closeBtnText}>✕</Text>
            </TouchableOpacity>
          </View>
        </View>

        {selectedPlaybook ? (
          /* PLAYBOOK DETAIL VIEW */
          <ScrollView
            style={styles.detailScroll}
            contentContainerStyle={styles.detailScrollContent}
            showsVerticalScrollIndicator={false}
          >
            {/* Playbook Hero Card */}
            <View style={styles.heroCard}>
              <View style={styles.heroTopRow}>
                <Text style={styles.heroIcon}>{selectedPlaybook.icon}</Text>
                <View style={styles.heroBadges}>
                  <View
                    style={[
                      styles.severityBadge,
                      selectedPlaybook.severity === 'CRITICAL' && styles.severityCritical,
                    ]}
                  >
                    <Text style={styles.severityText}>{selectedPlaybook.severity}</Text>
                  </View>
                  <View style={styles.offlinePill}>
                    <Text style={styles.offlinePillText}>💾 OFFLINE READY</Text>
                  </View>
                </View>
              </View>

              <Text style={styles.playbookTitle}>{selectedPlaybook.title}</Text>
              <Text style={styles.playbookSubtitle}>{selectedPlaybook.subtitle}</Text>
              <Text style={styles.playbookSummary}>{selectedPlaybook.summary}</Text>

              {/* Vital Golden Rule Banner */}
              <View style={styles.vitalRuleCard}>
                <Text style={styles.vitalRuleLabel}>⚡ GOLDEN LIFE-SAVING RULE:</Text>
                <Text style={styles.vitalRuleText}>{selectedPlaybook.vitalRule}</Text>
              </View>
            </View>

            {/* CPR Interactive Metronome (if applicable) */}
            {selectedPlaybook.hasMetronome && (
              <View style={styles.metronomeCard}>
                <View style={styles.metronomeHeader}>
                  <Animated.View
                    style={[
                      styles.heartPulseWrapper,
                      { transform: [{ scale: metronomeAnim }] },
                    ]}
                  >
                    <Text style={styles.heartPulseIcon}>🫀</Text>
                  </Animated.View>
                  <View style={styles.metronomeTextCol}>
                    <Text style={styles.metronomeTitle}>Interactive CPR Rhythm Metronome</Text>
                    <Text style={styles.metronomeSub}>
                      110 Beats Per Minute • Matches recommended chest compression speed
                    </Text>
                  </View>
                </View>

                <TouchableOpacity
                  style={[
                    styles.metronomeToggleBtn,
                    metronomeActive && styles.metronomeToggleBtnActive,
                  ]}
                  onPress={() => {
                    AlertService.triggerHaptic();
                    setMetronomeActive((prev) => !prev);
                  }}
                  activeOpacity={0.85}
                >
                  <Text style={styles.metronomeToggleText}>
                    {metronomeActive ? '⏸ PAUSE METRONOME' : '▶ START CPR BEAT (110 BPM)'}
                  </Text>
                </TouchableOpacity>
              </View>
            )}

            {/* Step-by-Step Instructions */}
            <Text style={styles.sectionHeader}>Step-by-Step Action Plan</Text>
            {selectedPlaybook.steps.map((step) => (
              <View key={step.number} style={styles.stepCard}>
                <View style={styles.stepBadge}>
                  <Text style={styles.stepBadgeText}>{step.number}</Text>
                </View>
                <View style={styles.stepContent}>
                  <Text style={styles.stepHeading}>{step.heading}</Text>
                  <Text style={styles.stepDetail}>{step.detail}</Text>
                </View>
              </View>
            ))}

            {/* DO THIS (Green Checkmarks) */}
            <View style={styles.dosCard}>
              <View style={styles.doHeaderRow}>
                <Text style={styles.doIcon}>✅</Text>
                <Text style={styles.doHeaderTitle}>DO THIS (LIFE-SAVING ACTIONS)</Text>
              </View>
              {selectedPlaybook.dos.map((item, idx) => (
                <View key={idx} style={styles.bulletRow}>
                  <Text style={styles.doBullet}>•</Text>
                  <Text style={styles.doText}>{item}</Text>
                </View>
              ))}
            </View>

            {/* NEVER DO THIS (Red Warnings) */}
            <View style={styles.dontsCard}>
              <View style={styles.dontHeaderRow}>
                <Text style={styles.dontIcon}>⛔</Text>
                <Text style={styles.dontHeaderTitle}>NEVER DO THIS (DANGEROUS MISTAKES)</Text>
              </View>
              {selectedPlaybook.donts.map((item, idx) => (
                <View key={idx} style={styles.bulletRow}>
                  <Text style={styles.dontBullet}>✕</Text>
                  <Text style={styles.dontText}>{item}</Text>
                </View>
              ))}
            </View>

            {/* Emergency Hotline Button */}
            <TouchableOpacity
              style={styles.ambulanceCallBtn}
              onPress={() => handleCallEmergency(selectedPlaybook.emergencyPhone)}
              activeOpacity={0.85}
            >
              <Text style={styles.ambulanceCallIcon}>🚨</Text>
              <Text style={styles.ambulanceCallText}>
                CALL AMBULANCE ({selectedPlaybook.emergencyPhone}) NOW
              </Text>
            </TouchableOpacity>
          </ScrollView>
        ) : (
          /* PLAYBOOK LIST VIEW */
          <View style={styles.listContainer}>
            {/* Search Input */}
            <View style={styles.searchBar}>
              <Text style={styles.searchIcon}>🔍</Text>
              <TextInput
                style={styles.searchInput}
                placeholder="Search first aid (e.g. CPR, snake, bleeding, burn)..."
                placeholderTextColor="#64748B"
                value={searchQuery}
                onChangeText={setSearchQuery}
              />
              {searchQuery.length > 0 && (
                <TouchableOpacity onPress={() => setSearchQuery('')}>
                  <Text style={styles.searchClear}>✕</Text>
                </TouchableOpacity>
              )}
            </View>

            {/* Category Filter Chips */}
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.categoryChips}
            >
              {FIRST_AID_CATEGORIES.map((cat) => {
                const isSelected = selectedCategory === cat.id;
                return (
                  <TouchableOpacity
                    key={cat.id}
                    style={[
                      styles.categoryChip,
                      isSelected && styles.categoryChipActive,
                    ]}
                    onPress={() => {
                      AlertService.triggerHaptic();
                      setSelectedCategory(cat.id);
                    }}
                    activeOpacity={0.8}
                  >
                    <Text style={styles.categoryIcon}>{cat.icon}</Text>
                    <Text
                      style={[
                        styles.categoryLabel,
                        isSelected && styles.categoryLabelActive,
                      ]}
                    >
                      {cat.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            {/* Playbooks List */}
            <ScrollView
              style={styles.playbookList}
              contentContainerStyle={styles.playbookListContent}
              showsVerticalScrollIndicator={false}
            >
              <Text style={styles.resultsCount}>
                Showing {playbooks.length} offline guides
              </Text>

              {playbooks.map((pb) => (
                <TouchableOpacity
                  key={pb.id}
                  style={styles.playbookCard}
                  onPress={() => handleSelectPlaybook(pb)}
                  activeOpacity={0.85}
                >
                  <View style={styles.cardLeftIcon}>
                    <Text style={styles.cardEmoji}>{pb.icon}</Text>
                  </View>
                  <View style={styles.cardCenterText}>
                    <View style={styles.cardTitleRow}>
                      <Text style={styles.cardTitle}>{pb.title}</Text>
                      {pb.severity === 'CRITICAL' && (
                        <View style={styles.cardCriticalBadge}>
                          <Text style={styles.cardCriticalText}>CRITICAL</Text>
                        </View>
                      )}
                    </View>
                    <Text style={styles.cardSubtitle} numberOfLines={1}>
                      {pb.subtitle}
                    </Text>
                    <Text style={styles.cardRule} numberOfLines={2}>
                      ⚡ {pb.vitalRule}
                    </Text>
                  </View>
                  <Text style={styles.cardChevron}>➔</Text>
                </TouchableOpacity>
              ))}

              {playbooks.length === 0 && (
                <View style={styles.emptyContainer}>
                  <Text style={styles.emptyIcon}>🔍</Text>
                  <Text style={styles.emptyTitle}>No matching emergency guides</Text>
                  <Text style={styles.emptyDesc}>
                    Try searching for "CPR", "burn", "snakebite", or "bleeding".
                  </Text>
                </View>
              )}
            </ScrollView>
          </View>
        )}
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0F172A',
  },
  topHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#1E293B',
    backgroundColor: '#0F172A',
  },
  topHeaderLeft: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '900',
    color: '#FFFFFF',
  },
  headerSubtitle: {
    fontSize: 11,
    color: '#94A3B8',
    marginTop: 1,
  },
  backBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  backBtnIcon: {
    fontSize: 20,
    color: '#38BDF8',
    fontWeight: '900',
  },
  backBtnText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#38BDF8',
  },
  topHeaderRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  call108Btn: {
    backgroundColor: '#DC2626',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 8,
  },
  call108Text: {
    fontSize: 12,
    fontWeight: '900',
    color: '#FFFFFF',
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#1E293B',
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeBtnText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#94A3B8',
  },
  listContainer: {
    flex: 1,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1E293B',
    marginHorizontal: 16,
    marginTop: 12,
    marginBottom: 8,
    borderRadius: 12,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: '#334155',
  },
  searchIcon: {
    fontSize: 14,
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    paddingVertical: 10,
    fontSize: 13,
    color: '#FFFFFF',
  },
  searchClear: {
    fontSize: 14,
    color: '#94A3B8',
    padding: 4,
  },
  categoryChips: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    gap: 8,
  },
  categoryChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1E293B',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#334155',
    gap: 6,
  },
  categoryChipActive: {
    backgroundColor: '#0284C7',
    borderColor: '#38BDF8',
  },
  categoryIcon: {
    fontSize: 13,
  },
  categoryLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#94A3B8',
  },
  categoryLabelActive: {
    color: '#FFFFFF',
    fontWeight: '800',
  },
  playbookList: {
    flex: 1,
  },
  playbookListContent: {
    paddingHorizontal: 16,
    paddingBottom: 40,
  },
  resultsCount: {
    fontSize: 11,
    color: '#64748B',
    fontWeight: '600',
    marginBottom: 10,
    marginTop: 4,
  },
  playbookCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1E293B',
    borderRadius: 16,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#334155',
  },
  cardLeftIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: '#0F172A',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
    borderWidth: 1,
    borderColor: '#334155',
  },
  cardEmoji: {
    fontSize: 22,
  },
  cardCenterText: {
    flex: 1,
  },
  cardTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 2,
  },
  cardTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#FFFFFF',
    flex: 1,
    marginRight: 6,
  },
  cardCriticalBadge: {
    backgroundColor: 'rgba(239, 68, 68, 0.2)',
    paddingVertical: 2,
    paddingHorizontal: 6,
    borderRadius: 4,
    borderWidth: 0.5,
    borderColor: '#EF4444',
  },
  cardCriticalText: {
    fontSize: 8,
    fontWeight: '900',
    color: '#F87171',
  },
  cardSubtitle: {
    fontSize: 11,
    color: '#94A3B8',
    marginBottom: 4,
  },
  cardRule: {
    fontSize: 11,
    color: '#FBBF24',
    fontWeight: '600',
  },
  cardChevron: {
    fontSize: 14,
    color: '#38BDF8',
    fontWeight: '900',
    marginLeft: 8,
  },
  emptyContainer: {
    alignItems: 'center',
    marginTop: 40,
    paddingHorizontal: 20,
  },
  emptyIcon: {
    fontSize: 40,
    marginBottom: 10,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  emptyDesc: {
    fontSize: 12,
    color: '#94A3B8',
    marginTop: 4,
    textAlign: 'center',
  },

  // Detail View Styles
  detailScroll: {
    flex: 1,
  },
  detailScrollContent: {
    padding: 16,
    paddingBottom: 40,
  },
  heroCard: {
    backgroundColor: '#1E293B',
    borderRadius: 20,
    padding: 18,
    borderWidth: 1,
    borderColor: '#334155',
    marginBottom: 16,
  },
  heroTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  heroIcon: {
    fontSize: 36,
  },
  heroBadges: {
    flexDirection: 'row',
    gap: 6,
  },
  severityBadge: {
    backgroundColor: '#D97706',
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderRadius: 6,
  },
  severityCritical: {
    backgroundColor: '#DC2626',
  },
  severityText: {
    fontSize: 9,
    fontWeight: '900',
    color: '#FFFFFF',
  },
  offlinePill: {
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderRadius: 6,
    borderWidth: 0.5,
    borderColor: '#10B981',
  },
  offlinePillText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#34D399',
  },
  playbookTitle: {
    fontSize: 20,
    fontWeight: '900',
    color: '#FFFFFF',
    marginBottom: 4,
  },
  playbookSubtitle: {
    fontSize: 13,
    fontWeight: '600',
    color: '#38BDF8',
    marginBottom: 8,
  },
  playbookSummary: {
    fontSize: 13,
    color: '#94A3B8',
    lineHeight: 19,
    marginBottom: 14,
  },
  vitalRuleCard: {
    backgroundColor: 'rgba(245, 158, 11, 0.12)',
    borderRadius: 12,
    padding: 12,
    borderLeftWidth: 4,
    borderLeftColor: '#F59E0B',
  },
  vitalRuleLabel: {
    fontSize: 10,
    fontWeight: '900',
    color: '#FBBF24',
    letterSpacing: 0.8,
    marginBottom: 3,
  },
  vitalRuleText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FEF3C7',
    lineHeight: 18,
  },

  // Metronome
  metronomeCard: {
    backgroundColor: '#1E293B',
    borderRadius: 18,
    padding: 16,
    borderWidth: 2,
    borderColor: '#EF4444',
    marginBottom: 16,
  },
  metronomeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 12,
  },
  heartPulseWrapper: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(239, 68, 68, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  heartPulseIcon: {
    fontSize: 24,
  },
  metronomeTextCol: {
    flex: 1,
  },
  metronomeTitle: {
    fontSize: 13,
    fontWeight: '900',
    color: '#FFFFFF',
  },
  metronomeSub: {
    fontSize: 11,
    color: '#94A3B8',
    marginTop: 2,
  },
  metronomeToggleBtn: {
    backgroundColor: '#DC2626',
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
  },
  metronomeToggleBtnActive: {
    backgroundColor: '#B91C1C',
    borderWidth: 1,
    borderColor: '#FCA5A5',
  },
  metronomeToggleText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '900',
    letterSpacing: 0.5,
  },

  // Steps
  sectionHeader: {
    fontSize: 16,
    fontWeight: '900',
    color: '#FFFFFF',
    marginBottom: 12,
    marginTop: 4,
  },
  stepCard: {
    flexDirection: 'row',
    backgroundColor: '#1E293B',
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#334155',
    gap: 12,
  },
  stepBadge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#0284C7',
    justifyContent: 'center',
    alignItems: 'center',
  },
  stepBadgeText: {
    fontSize: 14,
    fontWeight: '900',
    color: '#FFFFFF',
  },
  stepContent: {
    flex: 1,
  },
  stepHeading: {
    fontSize: 14,
    fontWeight: '800',
    color: '#FFFFFF',
    marginBottom: 3,
  },
  stepDetail: {
    fontSize: 12,
    color: '#94A3B8',
    lineHeight: 18,
  },

  // DOs and DONTs
  dosCard: {
    backgroundColor: 'rgba(16, 185, 129, 0.08)',
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.3)',
    marginTop: 8,
    marginBottom: 12,
  },
  doHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  doIcon: { fontSize: 16 },
  doHeaderTitle: {
    fontSize: 12,
    fontWeight: '900',
    color: '#34D399',
    letterSpacing: 0.5,
  },
  bulletRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 6,
  },
  doBullet: {
    fontSize: 14,
    color: '#34D399',
    fontWeight: '900',
  },
  doText: {
    fontSize: 12,
    color: '#D1FAE5',
    flex: 1,
    lineHeight: 17,
  },

  dontsCard: {
    backgroundColor: 'rgba(239, 68, 68, 0.08)',
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.3)',
    marginBottom: 18,
  },
  dontHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  dontIcon: { fontSize: 16 },
  dontHeaderTitle: {
    fontSize: 12,
    fontWeight: '900',
    color: '#F87171',
    letterSpacing: 0.5,
  },
  dontBullet: {
    fontSize: 12,
    color: '#F87171',
    fontWeight: '900',
    marginTop: 1,
  },
  dontText: {
    fontSize: 12,
    color: '#FEE2E2',
    flex: 1,
    lineHeight: 17,
  },

  // Call Ambulance
  ambulanceCallBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#DC2626',
    paddingVertical: 14,
    borderRadius: 14,
    gap: 8,
    shadowColor: '#DC2626',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 4,
  },
  ambulanceCallIcon: { fontSize: 18 },
  ambulanceCallText: {
    fontSize: 14,
    fontWeight: '900',
    color: '#FFFFFF',
    letterSpacing: 0.5,
  },
});
