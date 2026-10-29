import React, { useState, useRef, useEffect, useMemo } from 'react';
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
  Animated,
  StatusBar,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ChatMessage, TriageGuide } from '../types';
import { SosService } from '../services/sosService';
import { ChatbotScreenNavigationProp, ChatbotRouteProp } from '../types/navigation';
import { useTheme } from '../context/ThemeContext';

const TRIAGE_GUIDES: TriageGuide[] = [
  {
    id: 'tg-1',
    title: 'CPR & Resuscitation',
    icon: '🫁',
    urgency: 'high',
    summary: 'Chest compressions for unresponsive breathing emergencies',
    steps: [
      'Call 911 / 108 immediately and ask someone to locate an AED defibrillator.',
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
    title: 'Choking / Heimlich',
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
  'रक्तस्राव कसा थांबवावा? (MR)',
  'सांस नहीं आ रही (HI)',
  'Someone is choking (EN)',
  'छातीत दुखत आहे (MR)',
  'जलने पर क्या करें? (HI)',
  'CPR कसा द्यावा? (MR)',
];

type DetectedLanguage = 'marathi' | 'hindi' | 'english';

function detectLanguage(text: string): DetectedLanguage {
  const t = text.toLowerCase();

  // Distinct Marathi keywords (Devanagari & Latin script)
  const marathiMarkers = [
    'काय', 'कसे', 'कसा', 'कशी', 'करावे', 'करावा', 'करावी', 'करा', 'करू', 'आहे', 'नाही', 'नाहिये',
    'होतोय', 'होतेय', 'येतोय', 'पाहिजे', 'रक्त', 'रक्तस्राव', 'थांबवा', 'थांबवावा', 'श्वास', 'बेशुद्ध',
    'जखम', 'भाजले', 'भाजल्यास', 'साप', 'चावला', 'घशात', 'अडकले', 'मदत', 'हार्ट', 'अटॅक', 'छातीत',
    'दुखत', 'कळ', 'चक्कर', 'ताप', 'दवाखाना', 'रुग्णालय', 'पोलीस', 'मराठी', 'सांगा', 'पडले', 'लागले',
    // Latin transliterations
    'kay', 'kasa', 'kase', 'kashi', 'karave', 'karaycha', 'karu', 'ahe', 'nahiye', 'rakt', 'shwas',
    'beshuddha', 'hotay', 'yetay', 'pahije', 'madat', 'jakhmi', 'bhajle', 'sap', 'chavla', 'chhatit',
    'dukhat', 'ghashat', 'adakle', 'thambva', 'thambvava', 'marathi', 'sanga', 'lagle',
  ];

  // Distinct Hindi keywords (Devanagari & Latin script)
  const hindiMarkers = [
    'क्या', 'कैसे', 'कैसा', 'कैसी', 'करें', 'करो', 'करूं', 'करना', 'है', 'नहीं', 'रहा', 'रही', 'रहे',
    'खून', 'रोकें', 'रोको', 'सांस', 'साँस', 'बेहोश', 'बेहोशी', 'जला', 'जलने', 'सांप', 'काटा', 'गला',
    'गले', 'अटक', 'मदद', 'दर्द', 'सीने', 'दिल', 'दौरा', 'चक्कर', 'बचाओ', 'चाहिए', 'अस्पताल', 'कृपया',
    'हिंदी', 'बताओ', 'गिरा', 'लगा',
    // Latin transliterations
    'kya', 'kaise', 'kaisa', 'kare', 'karein', 'karo', 'karun', 'karna', 'hai', 'khoon', 'saans',
    'behoshi', 'behosh', 'jalne', 'jala', 'saamp', 'kata', 'gale', 'atak', 'madad', 'dard', 'seene',
    'bachao', 'chahiye', 'ho raha', 'ho rahi', 'hindi', 'batao', 'lag gaya',
  ];

  for (const marker of marathiMarkers) {
    if (t.includes(marker)) return 'marathi';
  }

  for (const marker of hindiMarkers) {
    if (t.includes(marker)) return 'hindi';
  }

  return 'english';
}

interface ChatbotScreenProps {
  navigation?: ChatbotScreenNavigationProp;
  route?: ChatbotRouteProp;
}

export default function ChatbotScreen({ navigation, route }: ChatbotScreenProps) {
  const { theme, isDark } = useTheme();
  const chatTheme = useMemo(
    () => ({
      primary: theme.primary,
      primaryDark: theme.primaryDark,
      secondary: isDark ? '#38BDF8' : '#1D3557',
      background: theme.background,
      cardBg: theme.cardBg,
      textPrimary: theme.textPrimary,
      textSecondary: theme.textSecondary,
      textLight: theme.textMuted,
      green: theme.emerald,
      greenBg: isDark ? 'rgba(16, 185, 129, 0.15)' : '#ECFDF5',
      blue: theme.blue,
      blueBg: isDark ? 'rgba(59, 130, 246, 0.15)' : '#EFF6FF',
      marathiOrange: isDark ? '#FB923C' : '#EA580C',
      marathiBg: isDark ? 'rgba(234, 88, 12, 0.15)' : '#FFF7ED',
      hindiTeal: isDark ? '#2DD4BF' : '#0D9488',
      hindiBg: isDark ? 'rgba(13, 148, 136, 0.15)' : '#F0FDFA',
      border: theme.cardBorder,
    }),
    [theme, isDark]
  );
  const THEME = chatTheme;
  const styles = useMemo(() => getStyles(chatTheme), [chatTheme]);

  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'm-1',
      sender: 'assistant',
      text: 'Hello, I am MIA (Medical & Incident Assistant).\n\nमी मराठी, हिंदी आणि इंग्रजी तिन्ही भाषा आपोआप ओळखते. आपण थेट बोलू शकता किंवा टाईप करू शकता.\n\n⚠️ In immediate life danger, tap Call 911 / 108 or activate SOS alert.',
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    },
  ]);
  const [inputText, setInputText] = useState<string>('');
  const [selectedGuide, setSelectedGuide] = useState<TriageGuide | null>(null);
  const [micModalVisible, setMicModalVisible] = useState<boolean>(false);
  const [isRecording, setIsRecording] = useState<boolean>(false);

  const scrollViewRef = useRef<ScrollView | null>(null);
  const micPulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    let loop: Animated.CompositeAnimation | null = null;
    if (micModalVisible) {
      setIsRecording(true);
      loop = Animated.loop(
        Animated.sequence([
          Animated.timing(micPulseAnim, {
            toValue: 1.3,
            duration: 600,
            useNativeDriver: true,
          }),
          Animated.timing(micPulseAnim, {
            toValue: 1,
            duration: 600,
            useNativeDriver: true,
          }),
        ])
      );
      loop.start();
    } else {
      setIsRecording(false);
      micPulseAnim.setValue(1);
    }
    return () => loop?.stop();
  }, [micModalVisible]);

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

    // Generate response in detected language
    setTimeout(() => {
      const reply = generateAiResponse(query);
      const botMsg: ChatMessage = {
        id: `bot-${Date.now()}`,
        sender: 'assistant',
        text: reply,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };
      setMessages((prev) => [...prev, botMsg]);
    }, 350);
  };

  const lastProcessedQuery = useRef<string | null>(null);

  useEffect(() => {
    const initialQuery = route?.params?.initialQuery;
    if (initialQuery && initialQuery !== lastProcessedQuery.current) {
      lastProcessedQuery.current = initialQuery;
      handleSendMessage(initialQuery);
    }
  }, [route?.params?.initialQuery]);

  const handleVoiceShortcut = (spokenText: string) => {
    setMicModalVisible(false);
    handleSendMessage(spokenText);
  };

  const generateAiResponse = (query: string): string => {
    const q = query.toLowerCase();
    const lang = detectLanguage(query);

    // --- MARATHI (मराठी) ---
    if (lang === 'marathi') {
      if (q.includes('chok') || q.includes('घशात') || q.includes('अडक') || q.includes('heimlich') || q.includes('ghashat')) {
        return '🗣️ [मराठी] घशात काही अडकल्यास (CHOKING) प्रथमोपचार:\n\n१. रुग्णाला विचारा: "तुम्हाला बोलता येतंय का?" जर बोलता किंवा खोकता येत नसेल तर तात्काळ कृती करा.\n२. रुग्णाच्या मागे उभे राहून दोन्ही हातांनी त्यांच्या पोटाभोवती विळखा घाला.\n३. एका हाताची मूठ बनवून नाभीच्या (Belly button) किंचित वर ठेवा.\n४. दुसऱ्या हाताने मूठ पकडून आतल्या आणि वरच्या दिशेने जोरदार धक्के (Heimlich Maneuver) द्या.\n५. व्यक्ती बेशुद्ध झाल्यास तात्काळ १०८ / ११२ वर कॉल करा आणि सीपीआर (CPR) सुरू करा.';
      }

      if (q.includes('cpr') || q.includes('हार्ट') || q.includes('बेशुद्ध') || q.includes('श्वास') || q.includes('heart') || q.includes('shwas') || q.includes('beshuddha')) {
        return '🫁 [मराठी] सीपीआर (CPR) आपत्कालीन कृती:\n\n१. तात्काळ १०८ / ११२ वर कॉल करून रुग्णवाहिका बोलवा.\n२. रुग्णाला सपाट, टणक जमिनीवर झोपवा आणि श्वास तपासणी करा.\n३. छातीच्या मध्यभागी एका हातावर दुसरा हात ठेवून बोटांची पकड करा.\n४. जोरात आणि वेगाने दाब द्या (एका मिनिटात १०० ते १२० वेळा, किमान २ इंच खोल).\n५. वैद्यकीय पथक येईपर्यंत सीपीआर थांबवू नका.';
      }

      if (q.includes('रक्त') || q.includes('bleed') || q.includes('जखम') || q.includes('थांबवा') || q.includes('rakt') || q.includes('jakhmi')) {
        return '🩸 [मराठी] तीव्र रक्तस्राव थांबवण्यासाठी प्रथमोपचार:\n\n१. जखमेवर स्वच्छ कापडाने किंवा गॉजने थेट आणि सतत जोरदार दाब द्या.\n२. दाब कमी करू नका; कापड भिजल्यास त्यावरच आणखी कापड ठेवून दाब चालू ठेवा.\n३. जखमी अवयव शक्य असल्यास हृदयाच्या पातळीपेक्षा उंच ठेवा.\n४. जर हाता-पायाचा रक्तस्राव थांबत नसेल, तर जखमेच्या २-३ इंच वर घट्ट पट्टी (Tourniquet) बांधा आणि तात्काळ १०८ वर कॉल करा.';
      }

      if (q.includes('भाज') || q.includes('burn') || q.includes('आग') || q.includes('bhajle')) {
        return '🔥 [मराठी] भाजल्यास प्राथमिक उपचार:\n\n१. भाजलेल्या भागावर किमान १० ते १५ मिनिटे थंड वाहते पाणी टाका.\n२. बर्फ, तूप, तेल किंवा टूथपेस्ट कधीही लावू नका.\n३. सूज येण्यापूर्वी घट्ट दागिने किंवा कपडे हळुवार बाजूला करा.\n४. स्वच्छ निर्जंतुक पट्टीने जखम हलकी झाका आणि त्वरित डॉक्टरांचा सल्ला घ्या.';
      }

      if (q.includes('साप') || q.includes('snake') || q.includes('चावला') || q.includes('sap')) {
        return '🐍 [मराठी] साप चावल्यास आणीबाणी सूचना:\n\n१. रुग्णाला पूर्णपणे शांत ठेवा, हालचाल करू देऊ नका (हालचालीने विष वेगाने पसरते).\n२. चावलेला भाग हृदयाच्या पातळीखाली ठेवा.\n३. जखमेवर चीरा मारू नका, रक्त काढण्याचा किंवा विष चोखण्याचा प्रयत्न करू नका.\n४. तात्काळ जवळच्या शासकीय रुग्णालयात सर्पदंश प्रतिबंधक लस (Anti-venom) साठी घेऊन जा.';
      }

      if (q.includes('छातीत') || q.includes('कळ') || q.includes('chhatit') || q.includes('dukhat')) {
        return '🫀 [मराठी] छातीत दुखणे / हृदयविकाराचा झटका:\n\n१. छातीत तीव्र जडपणा, डाव्या हाताकडे किंवा जबड्याकडे जाणारी कळ ही हृदयविकाराची लक्षणे असू शकतात.\n२. रुग्णाला शांतपणे बसवा, श्वास घेणे सुलभ करा.\n३. त्वरित १०८ किंवा ९११ वर संपर्क करा.\n४. रुग्णाला ऍस्पिरिन (Aspirin) चावून खाण्यास द्या (ऍलर्जी नसल्यास).';
      }

      if (q.includes('sos') || q.includes('मदत') || q.includes('सुरक्षा') || q.includes('पाठलाग') || q.includes('madat') || q.includes('danger') || q.includes('police')) {
        return '🆘 [मराठी] मिया (MIA) आपत्कालीन सुरक्षा मार्गदर्शन:\n\n१. घाबरू नका, शांत राहा. आपले थेट GPS स्थान पालकांना आधीच पाठवले गेले आहे.\n२. जर कोणी पाठलाग करत असेल, तर तात्काळ गर्दीच्या ठिकाणी, दुकानात किंवा पोलीस ठाण्यात जा.\n३. आणीबाणीत त्वरित ११२ (पोलीस) किंवा १०९१ (महिला हेल्पलाईन) वर कॉल करा.\n४. लपलेले असल्यास फोन सायलेंट ठेवा. मदत पोहोचेपर्यंत सुरक्षित राहा.';
      }

      return `🛡️ [मराठी] मिया (MIA) सुरक्षा सहाय्यक:\n\nमला समजले की तुम्हाला मदत हवी आहे ("${query}").\n\n१. घटनास्थळी स्वतःची सुरक्षितता आधी तपासा.\n२. गंभीर परिस्थितीत १०८ किंवा ११२ वर तात्काळ संपर्क करा.\n३. विशिष्ट प्रथमोपचारासाठी वरील CPR, रक्तस्राव, घशात अडकणे किंवा भाजणे या कार्ड्सवर टॅप करा.`;
    }

    // --- HINDI (हिंदी) ---
    if (lang === 'hindi') {
      if (q.includes('chok') || q.includes('गले') || q.includes('अटक') || q.includes('heimlich') || q.includes('gale')) {
        return '🗣️ [हिंदी] गले में कुछ अटकने (CHOKING) पर उपाय:\n\n१. पूछें क्या वे बोल या खांस पा रहे हैं? यदि सांस रुकी है तो तुरंत हेइमलिच पैंतरा (Heimlich Maneuver) करें।\n२. व्यक्ति के पीछे खड़े होकर कमर पर हाथ लपेटें।\n३. एक हाथ की मुट्ठी नाभि के ठीक ऊपर रखें, दूसरे हाथ से पकड़ें।\n४. अंदर और ऊपर की ओर तेजी से ५ झटके दें जब तक फंसी वस्तु बाहर न निकले।\n५. यदि व्यक्ति बेहोश हो, तो तुरंत १०८ / ९११ पर कॉल करें और सीपीआर शुरू करें।';
      }

      if (q.includes('cpr') || q.includes('सांस') || q.includes('बेहोश') || q.includes('दिल') || q.includes('saans') || q.includes('behosh')) {
        return '🫁 [हिंदी] सीपीआर (CPR) की आपातकालीन विधि:\n\n१. तुरंत १०८ या ११२ पर कॉल करके एम्बुलेंस बुलाएं।\n२. मरीज को सख्त जमीन पर सीधा लिटाएं और सांस की जांच करें।\n३. सीने के ठीक बीच में दोनों हाथों को आपस में जोड़कर रखें।\n४. जोर से और तेजी से दबाएं (प्रति मिनट १०० से १२० बार, कम से कम २ इंच गहरा)।\n५. मेडिकल टीम आने तक सीपीआर लगातार चालू रखें।';
      }

      if (q.includes('खून') || q.includes('bleed') || q.includes('रोक') || q.includes('चोट') || q.includes('khoon')) {
        return '🩸 [हिंदी] तेज खून बहने पर प्राथमिक चिकित्सा:\n\n१. घाव पर साफ कपड़े या गॉज से सीधा और लगातार तेज दबाव बनाएं।\n२. कपड़ा खून से भीग जाए तो उसे हटाएं नहीं, उसके ऊपर दूसरा कपड़ा रखकर दबाते रहें।\n३. चोट लगे हिस्से को दिल की ऊंचाई से ऊपर उठाएं।\n४. यदि हाथ या पैर से खून न रुके, तो घाव से २-३ इंच ऊपर टॉर्निकेट (Tourniquet) कसकर बांधें और तुरंत १०८ पर जाएं।';
      }

      if (q.includes('जल') || q.includes('burn') || q.includes('आग') || q.includes('jala') || q.includes('jalne')) {
        return '🔥 [हिंदी] जलने पर फर्स्ट-एड निर्देश:\n\n१. जले हुए हिस्से पर १० से २० मिनट तक ठंडा, साफ बहता पानी डालें।\n२. बर्फ, मक्खन, तेल, टूथपेस्ट या हल्दी बिल्कुल न लगाएं।\n३. सूजन बढ़ने से पहले अंगूठियां या तंग गहने धीरे से निकाल लें।\n४. साफ कपड़े या पट्टी से ढीला ढकें और डॉक्टर से संपर्क करें।';
      }

      if (q.includes('सांप') || q.includes('snake') || q.includes('काटा') || q.includes('saamp')) {
        return '🐍 [हिंदी] सांप के काटने पर आवश्यक कदम:\n\n१. मरीज को बिल्कुल शांत रखें और हिलने-डुलने न दें (हलचल से जहर तेजी से फैलता है)।\n२. काटे हुए अंग को दिल के स्तर से नीचे रखें।\n३. घाव पर चीरा न लगाएं और मुंह से जहर चूसने का प्रयास न करें।\n४. तुरंत नजदीकी सरकारी अस्पताल ले जाएं जहां एंटी-वेनम (Anti-venom) उपलब्ध हो।';
      }

      if (q.includes('सीने') || q.includes('दर्द') || q.includes('seene') || q.includes('dard')) {
        return '🫀 [हिंदी] सीने में दर्द / दिल का दौरा (Heart Attack):\n\n१. सीने में तेज जकड़न, भारीपन जो बाएं हाथ या जबड़े तक फैले दिल के दौरे के लक्षण हैं।\n२. मरीज को आराम से बिठाएं और कपड़े ढीले करें।\n३. तुरंत १०८ या ९११ पर कॉल करें।\n४. यदि मरीज को एलर्जी न हो, तो एस्पिरिन (Aspirin) चबाने को दें।';
      }

      if (q.includes('sos') || q.includes('मदद') || q.includes('सुरक्षा') || q.includes('पीछा') || q.includes('danger') || q.includes('police') || q.includes('bachao')) {
        return '🆘 [हिंदी] मिया (MIA) आपातकालीन सुरक्षा मार्गदर्शन:\n\n१. शांत रहें और घबराएं नहीं। आपकी लाइव जीपीएस लोकेशन पहले ही माता-पिता को भेज दी गई है।\n२. अगर कोई पीछा कर रहा है या खतरा महसूस हो रहा है, तो तुरंत किसी दुकान, पेट्रोल पंप या भीड़ वाली जगह पर जाएं।\n३. तुरंत सहायता के लिए ११२ (पुलिस) या १०९१ (महिला हेल्पलाइन) पर कॉल करें।\n४. यदि आप छुपकर बैठी हैं, तो फोन को साइलेंट रखें। मदद रास्ते में है।';
      }

      return `🛡️ [हिंदी] मिया (MIA) सुरक्षा सहायक:\n\nमुझे समझ आया कि आपको सहायता चाहिए ("${query}")।\n\n१. पहले अपने आसपास की सुरक्षा सुनिश्चित करें।\n२. आपातकालीन स्थिति में तुरंत १०८ या ११२ पर कॉल करें।\n३. सीपीआर, ब्लीडिंग या जलने से संबंधित तुरंत कदमों के लिए ऊपर दिए गए कार्ड्स पर क्लिक करें।`;
    }

    // --- ENGLISH ---
    if (q.includes('sos') || q.includes('safe') || q.includes('follow') || q.includes('danger') || q.includes('trouble') || q.includes('scared') || q.includes('emergency')) {
      return '🆘 [English] MIA EMERGENCY SAFETY PROTOCOL:\n\n1. Take a slow, deep breath. Your live GPS coordinates have been broadcast to your primary guardian/parents.\n2. If someone is following you or you feel unsafe, head immediately toward a well-lit, crowded place (store, metro station, fuel station).\n3. If in immediate danger, dial 112 (Police Dispatch) or 1091 (Women Safety Helpline).\n4. If you are hiding, keep your phone in Silent mode and stay low. Help is on the way.';
    }

    if (q.includes('chok') || q.includes('heimlich')) {
      return '🗣️ [English] CHOKING EMERGENCY RESPONSE:\n\n1. Ask: "Are you choking?" If they cannot speak, cough, or breathe, act immediately.\n2. Stand behind them and wrap arms around their waist.\n3. Make a fist with thumb side against upper abdomen (just above navel).\n4. Deliver sharp, upward thrusts (Heimlich) until airway is cleared.\n5. If person collapses, call 911 / 108 and start CPR immediately.';
    }

    if (q.includes('cpr') || q.includes('heart') || q.includes('unconscious') || q.includes('breathing')) {
      return '🫁 [English] CPR PROTOCOL (ADULT):\n\n1. Call 911 / 108 & send someone for an AED.\n2. Check responsiveness and breathing for 5-10 seconds.\n3. Place hands in center of chest.\n4. Push HARD and FAST at 100-120 BPM, at least 2 inches deep.\n5. Do not stop until emergency services arrive.';
    }

    if (q.includes('bleed') || q.includes('blood') || q.includes('wound') || q.includes('cut')) {
      return '🩸 [English] SEVERE BLEEDING PROTOCOL:\n\n1. Press hard directly on the wound with clean cloth or gauze.\n2. Maintain constant pressure — do not lift gauze to check.\n3. Keep injured limb elevated above heart level.\n4. If bleeding spurts or will not stop on a limb, apply a tourniquet 2-3 inches above wound.\n5. Call 911 / 108 immediately.';
    }

    if (q.includes('burn') || q.includes('scald') || q.includes('fire')) {
      return '🔥 [English] BURN FIRST-AID:\n\n1. Run cool, clean tap water over the burn for 10-20 minutes.\n2. Do NOT apply ice, butter, flour, or oil.\n3. Remove rings or tight items near the area before swelling begins.\n4. Cover loosely with sterile gauze or clean plastic wrap.\n5. Seek medical attention if blistering is severe.';
    }

    if (q.includes('snake') || q.includes('bite') || q.includes('poison')) {
      return '🐍 [English] SNAKEBITE EMERGENCY:\n\n1. Keep person calm and still (movement spreads venom faster).\n2. Keep bitten limb immobilized below heart level.\n3. Do NOT cut the wound or try to suck venom out.\n4. Transport immediately to the nearest hospital for anti-venom.';
    }

    if (q.includes('stroke') || q.includes('fast')) {
      return '🧠 [English] STROKE IDENTIFICATION (FAST):\n\n• F (Face): Does one side of face droop when smiling?\n• A (Arms): Can they raise both arms, or does one drift down?\n• S (Speech): Is speech slurred or strange?\n• T (Time): Call 911 / 108 IMMEDIATELY. Note the time symptoms started.';
    }

    return `🛡️ [English] MIA SAFETY ASSISTANT:\n\nI understand your query ("${query}").\n\n1. Ensure immediate scene safety before taking action.\n2. If someone is injured or in distress, call 911 / 108 / 112 immediately.\n3. For specific emergency instructions, tap any of the Quick Protocol cards above (CPR, Bleeding, Choking, Burns, Grounding).`;
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <StatusBar barStyle={theme.statusBarStyle} backgroundColor={theme.background} />
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
              <Text style={styles.headerTitle}>MIA — AI Safety Companion</Text>
              <View style={styles.statusRow}>
                <View style={styles.statusDot} />
                <Text style={styles.statusText}>EN • हिंदी • मराठी Auto-Detect Active</Text>
              </View>
            </View>
          </View>

          <TouchableOpacity
            style={styles.sosCallBtn}
            onPress={() => SosService.dialEmergencyServices('911')}
            activeOpacity={0.8}
          >
            <Text style={styles.sosCallText}>🚨 911 / 108</Text>
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

        {/* Input Bar with Microphone Dictation Button */}
        <View style={styles.inputContainer}>
          <TouchableOpacity
            style={styles.micBtn}
            onPress={() => setMicModalVisible(true)}
            activeOpacity={0.8}
            accessibilityLabel="Voice Input Microphone"
            accessibilityHint="Tap to speak in Marathi, Hindi, or English"
          >
            <Text style={styles.micIcon}>🎙️</Text>
          </TouchableOpacity>

          <TextInput
            style={styles.input}
            placeholder="Type or tap mic (EN, हिंदी, मराठी)..."
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

      {/* Voice Dictation / Microphone Modal */}
      <Modal
        visible={micModalVisible}
        animationType="fade"
        transparent
        onRequestClose={() => setMicModalVisible(false)}
      >
        <View style={styles.micModalBackdrop}>
          <View style={styles.micModalCard}>
            <View style={styles.micModalHeader}>
              <View>
                <Text style={styles.micModalTitle}>MIA Voice Assistant</Text>
                <Text style={styles.micModalSub}>
                  Auto-detects Marathi, Hindi, or English
                </Text>
              </View>
              <TouchableOpacity onPress={() => setMicModalVisible(false)}>
                <Text style={styles.modalClose}>✕</Text>
              </TouchableOpacity>
            </View>

            {/* Animated Pulsing Audio Waveform Visual */}
            <View style={styles.waveformContainer}>
              <Animated.View
                style={[
                  styles.waveformRing,
                  { transform: [{ scale: micPulseAnim }] },
                ]}
              />
              <View style={styles.micCenterCircle}>
                <Text style={styles.micCenterIcon}>🎙️</Text>
              </View>
            </View>

            <Text style={styles.listeningText}>
              {isRecording ? 'Listening... speak now' : 'Processing speech...'}
            </Text>
            <Text style={styles.listeningSub}>
              "श्वास घेता येत नाही" • "खून कैसे रोकें" • "How to do CPR"
            </Text>

            {/* Instant Voice Emergency Shortcuts (1-Tap to Save Time) */}
            <Text style={styles.voicePresetsHeading}>FAST 1-TAP VOICE SHORTCUTS</Text>
            <View style={styles.voicePresetsGrid}>
              <TouchableOpacity
                style={[styles.voicePresetChip, { backgroundColor: THEME.marathiBg }]}
                onPress={() => handleVoiceShortcut('रक्तस्राव कसा थांबवावा?')}
              >
                <Text style={[styles.voicePresetText, { color: THEME.marathiOrange }]}>
                  🩸 रक्तस्राव कसा थांबवावा? (MR)
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.voicePresetChip, { backgroundColor: THEME.hindiBg }]}
                onPress={() => handleVoiceShortcut('सांस नहीं आ रही है')}
              >
                <Text style={[styles.voicePresetText, { color: THEME.hindiTeal }]}>
                  🫁 सांस नहीं आ रही है (HI)
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.voicePresetChip, { backgroundColor: THEME.marathiBg }]}
                onPress={() => handleVoiceShortcut('छातीत खूप दुखत आहे')}
              >
                <Text style={[styles.voicePresetText, { color: THEME.marathiOrange }]}>
                  🫀 छातीत खूप दुखत आहे (MR)
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.voicePresetChip, { backgroundColor: THEME.hindiBg }]}
                onPress={() => handleVoiceShortcut('गला घुट रहा है')}
              >
                <Text style={[styles.voicePresetText, { color: THEME.hindiTeal }]}>
                  🗣️ गला घुट रहा है (HI)
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.voicePresetChip, { backgroundColor: '#EFF6FF' }]}
                onPress={() => handleVoiceShortcut('How to do CPR?')}
              >
                <Text style={[styles.voicePresetText, { color: THEME.blue }]}>
                  ⚡ How to do CPR? (EN)
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.voicePresetChip, { backgroundColor: THEME.marathiBg }]}
                onPress={() => handleVoiceShortcut('साप चावला आहे काय करावे?')}
              >
                <Text style={[styles.voicePresetText, { color: THEME.marathiOrange }]}>
                  🐍 साप चावला आहे काय करावे? (MR)
                </Text>
              </TouchableOpacity>
            </View>

            <TouchableOpacity
              style={styles.stopMicBtn}
              onPress={() => setMicModalVisible(false)}
              activeOpacity={0.85}
            >
              <Text style={styles.stopMicText}>Done / Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

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
                  <Text style={styles.call911Text}>🚨 Call Emergency (911 / 108)</Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const getStyles = (THEME: any) => StyleSheet.create({
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
  micBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#FEE2E2',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#FCA5A5',
  },
  micIcon: {
    fontSize: 18,
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

  // Mic Modal Styles
  micModalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.85)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  micModalCard: {
    width: '100%',
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 24,
    alignItems: 'center',
    shadowColor: '#E63946',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.25,
    shadowRadius: 18,
    elevation: 10,
  },
  micModalHeader: {
    width: '100%',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 20,
  },
  micModalTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: THEME.textPrimary,
  },
  micModalSub: {
    fontSize: 12,
    color: THEME.textSecondary,
    marginTop: 2,
  },
  waveformContainer: {
    width: 120,
    height: 120,
    justifyContent: 'center',
    alignItems: 'center',
    marginVertical: 10,
  },
  waveformRing: {
    position: 'absolute',
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: 'rgba(230, 57, 70, 0.18)',
  },
  micCenterCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: THEME.primary,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: THEME.primaryDark,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 8,
  },
  micCenterIcon: {
    fontSize: 34,
  },
  listeningText: {
    fontSize: 17,
    fontWeight: '800',
    color: THEME.textPrimary,
    marginTop: 10,
  },
  listeningSub: {
    fontSize: 12,
    color: THEME.textSecondary,
    marginTop: 4,
    textAlign: 'center',
    marginBottom: 20,
  },
  voicePresetsHeading: {
    fontSize: 10,
    fontWeight: '800',
    color: THEME.textLight,
    letterSpacing: 0.8,
    marginBottom: 10,
    alignSelf: 'flex-start',
  },
  voicePresetsGrid: {
    width: '100%',
    gap: 8,
    marginBottom: 20,
  },
  voicePresetChip: {
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: THEME.border,
  },
  voicePresetText: {
    fontSize: 13,
    fontWeight: '700',
  },
  stopMicBtn: {
    width: '100%',
    backgroundColor: '#F1F5F9',
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
  },
  stopMicText: {
    color: THEME.textSecondary,
    fontSize: 13,
    fontWeight: '700',
  },
});

