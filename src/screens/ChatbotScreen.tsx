import React, { useState, useRef } from 'react';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Modal,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ChatMessage, TriageGuide } from '../types';
import { SosService } from '../services/sosService';

const THEME = {
  primary: '#E63946',
  primaryDark: '#B71C1C',
  secondary: '#1D3557',
  background: '#F8F9FA',
  cardBg: '#FFFFFF',
  textPrimary: '#1E293B',
  textSecondary: '#64748B',
  textLight: '#94A3B8',
  green: '#10B981',
  greenBg: '#ECFDF5',
  blue: '#2563EB',
  blueBg: '#EFF6FF',
  border: '#E2E8F0',
};

const TRIAGE_GUIDES: TriageGuide[] = [
  {
    id: 'tg-1',
    title: 'CPR & Resuscitation',
    icon: '🫁',
    urgency: 'high',
    summary: 'Chest compressions for unresponsive breathing emergencies',
    steps: [
      'Call 911 immediately and ask someone to locate an AED defibrillator.',
      'Place heel of one hand in center of the chest, interlock other hand on top.',
      'Push hard and fast: 100 to 120 compressions per minute, at least 2 inches deep.',
      'Allow chest to fully recoil between each compression.',
      'Continue until emergency paramedics arrive or person begins breathing.',
    ],
  },
  {
    id: 'tg-2',
    title: 'Severe Bleeding Control',
    icon: '🩸',
    urgency: 'high',
    summary: 'Direct pressure and tourniquet application',
    steps: [
      'Apply firm, continuous direct pressure with sterile gauze or clean cloth.',
      'Do NOT remove saturated cloth — place fresh layers directly on top.',
      'Elevate injured limb above heart level if no fractures suspected.',
      'If bleeding does not stop on limb, apply tourniquet 2-3 inches above wound.',
      'Tighten tourniquet until bleeding stops; note the exact time applied.',
    ],
  },
  {
    id: 'tg-3',
    title: 'Choking / Heimlich Maneuver',
    icon: '🗣️',
    urgency: 'high',
    summary: 'Relieving blocked airway in conscious adults',
    steps: [
      'Stand behind person, wrap arms around their waist.',
      'Make a fist with one hand; place thumb side just above navel.',
      'Grasp fist with your other hand.',
      'Deliver quick, inward and upward abdominal thrusts.',
      'Repeat until object is dislodged or person becomes unconscious (then begin CPR).',
    ],
  },
  {
    id: 'tg-4',
    title: 'Burns & Scalds',
    icon: '🔥',
    urgency: 'medium',
    summary: 'Cooling, protecting, and infection prevention',
    steps: [
      'Cool burn under gentle cool running tap water for 10-20 minutes.',
      'Do NOT use ice, butter, or ointments on open blisters.',
      'Gently remove tight rings or clothing before swelling begins.',
      'Cover loosely with sterile, non-adherent dressing or clean plastic wrap.',
      'Seek urgent medical care if burn is larger than palm or has white/charred skin.',
    ],
  },
  {
    id: 'tg-5',
    title: 'Panic & Crisis Grounding',
    icon: '🧘',
    urgency: 'low',
    summary: '5-4-3-2-1 Sensory Grounding for acute anxiety/shock',
    steps: [
      'Inhale slowly through nose for 4 seconds, hold for 4s, exhale for 6s.',
      'Name 5 things you can SEE around you right now.',
      'Name 4 things you can physically TOUCH or feel (e.g. feet on ground).',
      'Name 3 distinct sounds you can HEAR.',
      'Name 2 things you can SMELL.',
      'Name 1 thing you can TASTE or remind yourself: "I am safe right now."',
    ],
  },
];

const QUICK_PROMPTS = [
  'Someone is choking',
  'How to treat a burn?',
  'Severe bleeding steps',
  'Signs of a stroke',
  'Earthquake immediate safety',
];

export default function ChatbotScreen() {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'm-1',
      sender: 'assistant',
      text: 'Hello, I am Guardian AI, your emergency triage & safety companion. I am fully available offline to guide you through first-aid, crisis situations, and disaster preparedness.\n\n⚠️ If you are in immediate life danger, tap Call 911 or activate the SOS alert.',
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    },
  ]);
  const [inputText, setInputText] = useState<string>('');
  const [selectedGuide, setSelectedGuide] = useState<TriageGuide | null>(null);

  const scrollViewRef = useRef<ScrollView | null>(null);

  const handleSendMessage = (textToSend?: string) => {
    const query = textToSend || inputText;
    if (!query.trim()) return;

    const userMsg: ChatMessage = {
      id: `usr-${Date.now()}`,
      sender: 'user',
      text: query.trim(),
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    const newThread = [...messages, userMsg];
    setMessages(newThread);
    setInputText('');

    // Generate simulated intelligent triage response
    setTimeout(() => {
      const reply = generateAiResponse(query);
      const botMsg: ChatMessage = {
        id: `bot-${Date.now()}`,
        sender: 'assistant',
        text: reply,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };
      setMessages((prev) => [...prev, botMsg]);
    }, 400);
  };

  const generateAiResponse = (query: string): string => {
    const q = query.toLowerCase();

    if (q.includes('chok') || q.includes('heimlich')) {
      return '🗣️ CHOKING EMERGENCY RESPONSE:\n\n1. Ask: "Are you choking?" If they cannot speak, cough, or breathe, act immediately.\n2. Stand behind them and wrap arms around their waist.\n3. Make a fist with thumb side against their upper abdomen (just above belly button).\n4. Perform sharp, upward thrusts until airway is cleared.\n5. If person collapses, call 911 and start CPR immediately.';
    }

    if (q.includes('cpr') || q.includes('heart') || q.includes('unconscious') || q.includes('breathing')) {
      return '🫁 CPR PROTOCOL (ADULT):\n\n1. Call 911 & send someone for an AED.\n2. Check responsiveness and breathing for 5-10 seconds.\n3. Place hands in center of chest.\n4. Push HARD and FAST at 100-120 BPM (to beat of "Stayin Alive"), at least 2 inches deep.\n5. Do not stop until emergency services arrive.';
    }

    if (q.includes('bleed') || q.includes('blood') || q.includes('wound') || q.includes('cut')) {
      return '🩸 SEVERE BLEEDING PROTOCOL:\n\n1. Press hard directly on the wound with clean cloth or gauze.\n2. Maintain constant pressure — do not lift gauze to check.\n3. Keep injured limb elevated above heart level.\n4. If bleeding spurts or will not stop on a limb, apply a commercial or improvised tourniquet 2-3 inches above wound.';
    }

    if (q.includes('burn') || q.includes('scald') || q.includes('fire')) {
      return '🔥 BURN FIRST-AID:\n\n1. Run cool, clean tap water over the burn for 10-20 minutes.\n2. Do NOT apply ice, butter, flour, or oil.\n3. Remove rings or tight items near the area before swelling begins.\n4. Cover loosely with sterile gauze or clean plastic wrap.\n5. Seek medical attention if blistering is severe or on face/hands.';
    }

    if (q.includes('stroke') || q.includes('fast')) {
      return '🧠 STROKE IDENTIFICATION (FAST):\n\n• F (Face): Does one side of face droop when smiling?\n• A (Arms): Can they raise both arms, or does one drift down?\n• S (Speech): Is speech slurred or strange?\n• T (Time): Call 911 IMMEDIATELY. Note the time symptoms started.';
    }

    if (q.includes('earthquake')) {
      return '🏚️ EARTHQUAKE SAFETY:\n\n1. DROP to your hands and knees.\n2. COVER your head and neck under a sturdy table or desk.\n3. HOLD ON until shaking stops completely.\n4. Stay away from windows, glass, and exterior walls.\n5. If outdoors, move to an open area away from power lines and buildings.';
    }

    if (q.includes('panic') || q.includes('anxiety') || q.includes('calm') || q.includes('scared')) {
      return '🧘 GROUNDING & PANIC RELIEF:\n\nTake a slow breath: Inhale 4s, hold 4s, exhale 6s.\n\nNow use 5-4-3-2-1 Grounding:\n• 5 things you can SEE\n• 4 things you can TOUCH\n• 3 things you can HEAR\n• 2 things you can SMELL\n• 1 thing you can TASTE\n\nYou are in control and help is accessible.';
    }

    return `🛡️ GUARDIAN AI ASSISTANCE:\n\nI understand your concern about "${query}".\n\n1. Ensure immediate scene safety before taking action.\n2. If someone is injured or in distress, call 911 immediately.\n3. For specific emergency instructions, select one of the Quick First Aid cards above (CPR, Bleeding, Choking, Burns, Grounding).`;
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <KeyboardAvoidingView
        style={styles.keyboardContainer}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        {/* Top Header */}
        <View style={styles.header}>
          <View style={styles.headerInfo}>
            <View style={styles.botAvatar}>
              <Text style={styles.botEmoji}>🤖</Text>
            </View>
            <View>
              <Text style={styles.headerTitle}>Guardian AI Assistant</Text>
              <View style={styles.statusRow}>
                <View style={styles.statusDot} />
                <Text style={styles.statusText}>Offline Medical Triage Engine Active</Text>
              </View>
            </View>
          </View>

          <TouchableOpacity
            style={styles.sosCallBtn}
            onPress={() => SosService.dialEmergencyServices('911')}
            activeOpacity={0.8}
          >
            <Text style={styles.sosCallText}>🚨 911</Text>
          </TouchableOpacity>
        </View>

        {/* Quick Triage Carousel / Chips */}
        <View style={styles.triageSection}>
          <Text style={styles.triageSectionTitle}>QUICK EMERGENCY PROTOCOLS</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.triageScroll}
          >
            {TRIAGE_GUIDES.map((guide) => (
              <TouchableOpacity
                key={guide.id}
                style={styles.triageCard}
                onPress={() => setSelectedGuide(guide)}
                activeOpacity={0.75}
              >
                <Text style={styles.triageIcon}>{guide.icon}</Text>
                <Text style={styles.triageTitle}>{guide.title}</Text>
                <Text style={styles.triageAction}>View Steps ➔</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        {/* Chat Thread */}
        <ScrollView
          ref={scrollViewRef}
          style={styles.chatScroll}
          contentContainerStyle={styles.chatContent}
          onContentSizeChange={() => scrollViewRef.current?.scrollToEnd({ animated: true })}
          showsVerticalScrollIndicator={false}
        >
          {messages.map((msg) => {
            const isBot = msg.sender === 'assistant';
            return (
              <View
                key={msg.id}
                style={[
                  styles.msgWrapper,
                  isBot ? styles.msgWrapperBot : styles.msgWrapperUser,
                ]}
              >
                <View
                  style={[
                    styles.msgBubble,
                    isBot ? styles.msgBubbleBot : styles.msgBubbleUser,
                  ]}
                >
                  <Text
                    style={[
                      styles.msgText,
                      isBot ? styles.msgTextBot : styles.msgTextUser,
                    ]}
                  >
                    {msg.text}
                  </Text>
                  <Text
                    style={[
                      styles.msgTimestamp,
                      isBot ? styles.msgTimeBot : styles.msgTimeUser,
                    ]}
                  >
                    {msg.timestamp}
                  </Text>
                </View>
              </View>
            );
          })}
        </ScrollView>

        {/* Suggested Quick Question Chips */}
        <View style={styles.chipsContainer}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            {QUICK_PROMPTS.map((prompt, i) => (
              <TouchableOpacity
                key={i}
                style={styles.promptChip}
                onPress={() => handleSendMessage(prompt)}
                activeOpacity={0.7}
              >
                <Text style={styles.promptChipText}>{prompt}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        {/* Input Bar */}
        <View style={styles.inputContainer}>
          <TextInput
            style={styles.input}
            placeholder="Ask first-aid or safety question..."
            placeholderTextColor={THEME.textLight}
            value={inputText}
            onChangeText={setInputText}
            onSubmitEditing={() => handleSendMessage()}
          />
          <TouchableOpacity
            style={[styles.sendBtn, !inputText.trim() && styles.sendBtnDisabled]}
            onPress={() => handleSendMessage()}
            disabled={!inputText.trim()}
            activeOpacity={0.8}
          >
            <Text style={styles.sendIcon}>➔</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>

      {/* Triage Steps Modal */}
      <Modal
        visible={selectedGuide !== null}
        animationType="slide"
        transparent
        onRequestClose={() => setSelectedGuide(null)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            {selectedGuide && (
              <>
                <View style={styles.modalHeader}>
                  <View style={styles.modalTitleRow}>
                    <Text style={styles.modalGuideIcon}>{selectedGuide.icon}</Text>
                    <View>
                      <Text style={styles.modalGuideTitle}>{selectedGuide.title}</Text>
                      <Text style={styles.modalGuideSub}>{selectedGuide.summary}</Text>
                    </View>
                  </View>
                  <TouchableOpacity onPress={() => setSelectedGuide(null)}>
                    <Text style={styles.modalClose}>✕</Text>
                  </TouchableOpacity>
                </View>

                <ScrollView showsVerticalScrollIndicator={false} style={styles.stepsScroll}>
                  <Text style={styles.stepsHeading}>STEP-BY-STEP ACTION GUIDE</Text>
                  {selectedGuide.steps.map((step, idx) => (
                    <View key={idx} style={styles.stepItem}>
                      <View style={styles.stepNumberBadge}>
                        <Text style={styles.stepNumber}>{idx + 1}</Text>
                      </View>
                      <Text style={styles.stepText}>{step}</Text>
                    </View>
                  ))}
                </ScrollView>

                <TouchableOpacity
                  style={styles.call911FromGuide}
                  onPress={() => {
                    setSelectedGuide(null);
                    SosService.dialEmergencyServices('911');
                  }}
                  activeOpacity={0.85}
                >
                  <Text style={styles.call911Text}>🚨 Call 911 Immediately</Text>
                </TouchableOpacity>
              </>
            )}
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
  keyboardContainer: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
    backgroundColor: THEME.cardBg,
    borderBottomWidth: 1,
    borderBottomColor: THEME.border,
  },
  headerInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  botAvatar: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: '#EEF2FF',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#C7D2FE',
  },
  botEmoji: {
    fontSize: 22,
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: THEME.textPrimary,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: THEME.green,
    marginRight: 6,
  },
  statusText: {
    fontSize: 10,
    fontWeight: '700',
    color: THEME.green,
  },
  sosCallBtn: {
    backgroundColor: '#FEE2E2',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#FCA5A5',
  },
  sosCallText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#DC2626',
  },
  triageSection: {
    backgroundColor: THEME.cardBg,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: THEME.border,
  },
  triageSectionTitle: {
    fontSize: 10,
    fontWeight: '800',
    color: THEME.textLight,
    letterSpacing: 0.8,
    paddingHorizontal: 20,
    marginBottom: 8,
  },
  triageScroll: {
    paddingHorizontal: 20,
    gap: 10,
  },
  triageCard: {
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    padding: 10,
    borderWidth: 1,
    borderColor: THEME.border,
    width: 130,
  },
  triageIcon: {
    fontSize: 20,
    marginBottom: 4,
  },
  triageTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: THEME.textPrimary,
  },
  triageAction: {
    fontSize: 10,
    fontWeight: '700',
    color: THEME.blue,
    marginTop: 6,
  },
  chatScroll: {
    flex: 1,
  },
  chatContent: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 20,
    gap: 12,
  },
  msgWrapper: {
    flexDirection: 'row',
  },
  msgWrapperBot: {
    justifyContent: 'flex-start',
  },
  msgWrapperUser: {
    justifyContent: 'flex-end',
  },
  msgBubble: {
    maxWidth: '85%',
    borderRadius: 16,
    padding: 14,
  },
  msgBubbleBot: {
    backgroundColor: THEME.cardBg,
    borderWidth: 1,
    borderColor: THEME.border,
    borderTopLeftRadius: 4,
  },
  msgBubbleUser: {
    backgroundColor: THEME.secondary,
    borderTopRightRadius: 4,
  },
  msgText: {
    fontSize: 13,
    lineHeight: 20,
  },
  msgTextBot: {
    color: THEME.textPrimary,
  },
  msgTextUser: {
    color: '#FFFFFF',
  },
  msgTimestamp: {
    fontSize: 9,
    marginTop: 6,
    textAlign: 'right',
  },
  msgTimeBot: {
    color: THEME.textLight,
  },
  msgTimeUser: {
    color: '#94A3B8',
  },
  chipsContainer: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    backgroundColor: THEME.cardBg,
  },
  promptChip: {
    backgroundColor: '#F1F5F9',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 16,
    marginRight: 8,
  },
  promptChipText: {
    fontSize: 11,
    color: THEME.secondary,
    fontWeight: '600',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: THEME.cardBg,
    borderTopWidth: 1,
    borderTopColor: THEME.border,
    gap: 10,
  },
  input: {
    flex: 1,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: THEME.border,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    fontSize: 13,
    color: THEME.textPrimary,
  },
  sendBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: THEME.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sendBtnDisabled: {
    backgroundColor: '#CBD5E1',
  },
  sendIcon: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '800',
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.7)',
    justifyContent: 'flex-end',
  },
  modalCard: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    maxHeight: '85%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  modalTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  modalGuideIcon: {
    fontSize: 32,
  },
  modalGuideTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: THEME.textPrimary,
  },
  modalGuideSub: {
    fontSize: 12,
    color: THEME.textSecondary,
    marginTop: 2,
  },
  modalClose: {
    fontSize: 20,
    color: THEME.textLight,
    padding: 4,
  },
  stepsScroll: {
    marginBottom: 16,
  },
  stepsHeading: {
    fontSize: 10,
    fontWeight: '800',
    color: THEME.textLight,
    letterSpacing: 0.8,
    marginBottom: 12,
  },
  stepItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 12,
    gap: 12,
  },
  stepNumberBadge: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: THEME.secondary,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 2,
  },
  stepNumber: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '800',
  },
  stepText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 20,
    color: THEME.textPrimary,
    fontWeight: '500',
  },
  call911FromGuide: {
    backgroundColor: THEME.primary,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  call911Text: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
  },
});
