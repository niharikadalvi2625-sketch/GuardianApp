export type FirstAidCategory =
  | 'all'
  | 'cardiac'
  | 'bleeding'
  | 'bites'
  | 'burns'
  | 'disaster';

export interface FirstAidPlaybook {
  id: string;
  title: string;
  subtitle: string;
  category: Exclude<FirstAidCategory, 'all'>;
  severity: 'CRITICAL' | 'URGENT' | 'HIGH';
  icon: string;
  summary: string;
  vitalRule: string;
  hasMetronome?: boolean;
  emergencyPhone: string;
  steps: { number: number; heading: string; detail: string }[];
  dos: string[];
  donts: string[];
}

export const FIRST_AID_CATEGORIES: { id: FirstAidCategory; label: string; icon: string }[] = [
  { id: 'all', label: 'All Guides', icon: '🌐' },
  { id: 'cardiac', label: 'CPR & Choking', icon: '🫀' },
  { id: 'bleeding', label: 'Bleeding & Trauma', icon: '🩸' },
  { id: 'bites', label: 'Bites & Stings', icon: '🐍' },
  { id: 'burns', label: 'Burns & Shock', icon: '🔥' },
  { id: 'disaster', label: 'Disaster Survival', icon: '🌪️' },
];

const PLAYBOOKS: FirstAidPlaybook[] = [
  {
    id: 'adult-cpr',
    title: 'Adult CPR (Cardiac Arrest)',
    subtitle: 'Unresponsive & not breathing normally',
    category: 'cardiac',
    severity: 'CRITICAL',
    icon: '🫀',
    summary: 'Cardiopulmonary Resuscitation maintains oxygenated blood flow to the brain until emergency medics arrive.',
    vitalRule: 'Push hard and fast in the center of the chest at 100-120 beats per minute.',
    hasMetronome: true,
    emergencyPhone: '108',
    steps: [
      {
        number: 1,
        heading: 'Check Response & Call 108',
        detail: 'Shake shoulders gently and shout "Are you okay?". If no response and not breathing, call 108 or 112 immediately.',
      },
      {
        number: 2,
        heading: 'Hand Placement',
        detail: 'Place the heel of one hand in the center of the chest (lower half of breastbone). Interlock your other hand on top.',
      },
      {
        number: 3,
        heading: 'Push Hard & Fast (110 BPM)',
        detail: 'Lock your elbows straight. Compress chest at least 2 inches (5 cm) deep at 100-120 compressions/min (to the rhythm of "Stayin Alive").',
      },
      {
        number: 4,
        heading: 'Allow Full Chest Recoil',
        detail: 'Let the chest rise completely between each compression. Do not lean on the chest.',
      },
      {
        number: 5,
        heading: 'Continuous Compressions',
        detail: 'Do hands-only CPR non-stop until emergency medics arrive, an AED is ready, or the person wakes up.',
      },
    ],
    dos: [
      'Lock your elbows straight and use upper body weight',
      'Keep compressions fast: 100 to 120 beats per minute',
      'Swap with another rescuer every 2 minutes if exhausted',
    ],
    donts: [
      'NEVER stop compressions for more than 10 seconds',
      'Do not place hands too low near the stomach or ribs',
      'Do not hesitate — Hands-Only CPR triples survival chances',
    ],
  },
  {
    id: 'choking-heimlich',
    title: 'Severe Choking (Heimlich Maneuver)',
    subtitle: 'Cannot breathe, speak, cough, or clutches throat',
    category: 'cardiac',
    severity: 'CRITICAL',
    icon: '🗣️',
    summary: 'Airway obstruction prevents oxygen from reaching lungs and brain, causing unconsciousness in under 2 minutes.',
    vitalRule: 'Alternate 5 sharp back blows between shoulder blades with 5 quick inward and upward abdominal thrusts.',
    emergencyPhone: '108',
    steps: [
      {
        number: 1,
        heading: 'Verify Complete Blockage',
        detail: 'Ask "Are you choking?". If they cannot speak, cough, or breathe, act immediately.',
      },
      {
        number: 2,
        heading: '5 Sharp Back Blows',
        detail: 'Stand behind and slightly to the side. Support their chest with one hand, lean them forward, and deliver 5 firm blows between shoulder blades with the heel of your hand.',
      },
      {
        number: 3,
        heading: '5 Abdominal Thrusts (Heimlich)',
        detail: 'Stand behind them. Wrap arms around their waist. Make a fist with thumb side just above their navel. Grasp fist with other hand and pull sharply inward and upward.',
      },
      {
        number: 4,
        heading: 'Repeat Cycle',
        detail: 'Repeat 5 back blows and 5 abdominal thrusts until object is expelled or person becomes unconscious.',
      },
      {
        number: 5,
        heading: 'If Unconscious: Start CPR',
        detail: 'Lower them carefully to the ground, call 108, and begin chest compressions.',
      },
    ],
    dos: [
      'Lean person forward so the expelled object falls out of mouth',
      'Use sharp upward thrusts to pop the airway blockage',
      'If pregnant or obese, deliver chest thrusts instead of abdominal thrusts',
    ],
    donts: [
      'NEVER perform blind finger sweeps in the mouth',
      'Do not slap the back if the person is coughing forcefully (encourage coughing)',
      'Do not give water while someone is actively choking',
    ],
  },
  {
    id: 'severe-bleeding',
    title: 'Severe Bleeding & Tourniquet',
    subtitle: 'Pumping or heavy continuous arterial blood loss',
    category: 'bleeding',
    severity: 'CRITICAL',
    icon: '🩸',
    summary: 'Arterial bleeding can cause fatal hemorrhagic shock within 3 to 5 minutes without immediate intervention.',
    vitalRule: 'Apply firm, continuous direct pressure with a clean cloth. If bleeding from a limb is uncontrollable, apply a tourniquet 2 inches above the wound.',
    emergencyPhone: '108',
    steps: [
      {
        number: 1,
        heading: 'Direct Firm Pressure',
        detail: 'Cover the wound with sterile gauze or clean cloth. Press firmly with both hands using your body weight.',
      },
      {
        number: 2,
        heading: 'Pack Deep Wounds',
        detail: 'For deep puncture wounds, pack clean cloth directly into the wound and maintain continuous downward pressure.',
      },
      {
        number: 3,
        heading: 'Apply Tourniquet (Limb Only)',
        detail: 'If bleeding does not stop and is on an arm or leg, place tourniquet 2 to 3 inches above the wound (never over a joint). Tighten windlass until bleeding stops completely.',
      },
      {
        number: 4,
        heading: 'Note the Time of Application',
        detail: 'Write the exact time on the tourniquet or victims forehead (e.g. "T 14:30") so emergency surgeons know duration.',
      },
      {
        number: 5,
        heading: 'Treat for Shock',
        detail: 'Keep the victim warm with a blanket. Lay them flat and elevate legs 12 inches if no spinal injury.',
      },
    ],
    dos: [
      'Maintain direct pressure without lifting gauze to "check"',
      'If cloth soaks through, add MORE cloth on top — do not remove first layer',
      'Keep victim calm and lying down to reduce heart rate',
    ],
    donts: [
      'NEVER loosen or remove a tourniquet once applied (let doctors do it)',
      'Never apply a tourniquet over an elbow or knee joint',
      'Never remove an impaled object (knife, glass); stabilize it in place',
    ],
  },
  {
    id: 'snakebite-protocol',
    title: 'Venomous Snakebite Protocol',
    subtitle: 'Cobras, Vipers, Kraits & deadly venomous snakes',
    category: 'bites',
    severity: 'CRITICAL',
    icon: '🐍',
    summary: 'Over 80% of snakebite complications occur due to harmful myths. Correct immobilization and fast hospital transport saves lives.',
    vitalRule: 'Keep patient 100% still. Immobilize the bitten limb like a fracture. Transport immediately to a hospital with Anti-Snake Venom (ASV).',
    emergencyPhone: '108',
    steps: [
      {
        number: 1,
        heading: 'Keep Patient Completely Calm & Still',
        detail: 'Movement increases heart rate and pumps venom into the lymphatic bloodstream. Lay victim down and keep them quiet.',
      },
      {
        number: 2,
        heading: 'Immobilize the Bitten Limb',
        detail: 'Apply a broad splint or bandage along the entire bitten limb to keep it still. Keep the bite at or slightly below heart level.',
      },
      {
        number: 3,
        heading: 'Remove Constrictive Items',
        detail: 'Immediately remove rings, bangles, watches, and tight clothing before swelling begins.',
      },
      {
        number: 4,
        heading: 'Rush to Nearest Hospital with ASV',
        detail: 'Call 108 or transport victim in a vehicle lying flat. Do not let them walk or run.',
      },
      {
        number: 5,
        heading: 'Remember Snake Description',
        detail: 'Take a quick photo of snake from safe distance if possible, or note colors and head shape. Do not attempt to catch or kill it.',
      },
    ],
    dos: [
      'Immobilize the limb with a firm splint to halt venom spread',
      'Rush to a primary health center (PHC) or hospital with Anti-Snake Venom (ASV)',
      'Keep the bite site clean and covered with dry sterile cloth',
    ],
    donts: [
      'NEVER cut the wound or try to suck venom out (causes severe necrosis and infection)',
      'NEVER apply tight arterial tourniquets (causes gangrene and amputation)',
      'NEVER apply ice, herbal pastes, cow dung, or electrical shocks',
      'Do not give caffeine, alcohol, or painkiller aspirin',
    ],
  },
  {
    id: 'thermal-burns',
    title: 'Severe Burns & Fire Scalds',
    subtitle: 'Thermal burns, boiling water scalds & flame exposure',
    category: 'burns',
    severity: 'URGENT',
    icon: '🔥',
    summary: 'Proper burn first aid stops the burning process, relieves agonizing pain, and prevents life-threatening infections.',
    vitalRule: 'Cool the burn with cool running tap water for 20 continuous minutes. Cover loosely with clean plastic cling film.',
    emergencyPhone: '108',
    steps: [
      {
        number: 1,
        heading: 'Stop the Burning Process',
        detail: 'Extinguish flames ("Stop, Drop, and Roll"). Safely remove from heat source.',
      },
      {
        number: 2,
        heading: 'Cool with Running Water (20 Mins)',
        detail: 'Hold burned area under cool (not ice cold) running tap water for 15-20 minutes. This draws heat out of deep tissue.',
      },
      {
        number: 3,
        heading: 'Remove Rings & Constrictions',
        detail: 'Carefully remove watches, jewelry, and loose clothing around burn before swelling starts.',
      },
      {
        number: 4,
        heading: 'Cover Loosely with Cling Film or Clean Sheet',
        detail: 'Cover with clean plastic wrap (cling film) or a clean, non-fluffy sterile dressing to protect exposed nerves from air and infection.',
      },
      {
        number: 5,
        heading: 'Keep Patient Warm',
        detail: 'Cool the burn, but keep the rest of the body warm to prevent hypothermia.',
      },
    ],
    dos: [
      'Cool with clean, running room-temperature tap water',
      'Cover with transparent cling film or clean dry cloth',
      'Seek emergency hospital care if burn is larger than victim palm',
    ],
    donts: [
      'NEVER apply ice or ice-cold water (causes frostbite tissue damage)',
      'NEVER apply butter, oil, toothpaste, or turmeric powder',
      'NEVER burst burn blisters (they act as a natural sterile barrier)',
      'Do not peel away clothing stuck to charred skin',
    ],
  },
  {
    id: 'electrical-shock',
    title: 'Electrical Shock & Electrocution',
    subtitle: 'High-voltage lines, submerged water current, lightning',
    category: 'burns',
    severity: 'CRITICAL',
    icon: '⚡',
    summary: 'Electrical current causes cardiac arrhythmias (ventricular fibrillation), internal burns, and muscle paralysis.',
    vitalRule: 'DO NOT TOUCH the victim until the power source is completely switched off or severed with a dry non-conductive object.',
    emergencyPhone: '108',
    steps: [
      {
        number: 1,
        heading: 'Disconnect the Power Source',
        detail: 'Turn off the main electrical breaker immediately. Unplug the appliance safely.',
      },
      {
        number: 2,
        heading: 'Separate Safely if Power Cannot Be Cut',
        detail: 'Stand on a dry wooden board or rubber mat. Use a dry wooden broom handle or PVC pipe to push victim away from current. Never use metal or wet items.',
      },
      {
        number: 3,
        heading: 'Check Breathing & Heartbeat',
        detail: 'Once safe to touch, check response. If not breathing, call 108 and immediately start CPR.',
      },
      {
        number: 4,
        heading: 'Check for Entry & Exit Burns',
        detail: 'Electrical burns often have an entry point (hands) and exit point (feet). Cool burns and cover with clean cloth.',
      },
    ],
    dos: [
      'Isolate the electrical main switch before approaching',
      'Use dry wood, dry plastic, or thick dry rubber to break contact',
      'Begin CPR immediately if victim has no pulse',
    ],
    donts: [
      'NEVER touch the victim with bare hands while they are touching the live wire',
      'Never step into standing water near an electrocuted victim',
      'Never touch high-voltage overhead wires with any object',
    ],
  },
  {
    id: 'flood-survival',
    title: 'Flash Flood & Submersion Survival',
    subtitle: 'Rising floodwater, submerged vehicles & river overflow',
    category: 'disaster',
    severity: 'CRITICAL',
    icon: '🌊',
    summary: 'Flash floods are the deadliest weather hazard. Just 6 inches of moving water can knock you down, and 12 inches can sweep away cars.',
    vitalRule: 'Move immediately to higher ground. NEVER walk or drive through moving flood water ("Turn Around, Don\'t Drown").',
    emergencyPhone: '112',
    steps: [
      {
        number: 1,
        heading: 'Seek Immediate High Ground',
        detail: 'Evacuate low-lying riverbeds, basements, and floodplains. Climb to a sturdy upper floor or roof.',
      },
      {
        number: 2,
        heading: 'Escape from Submerged Vehicle',
        detail: 'If trapped in a car in rising water: Unbuckle seatbelts, roll down or smash side windows immediately before electrics short out, and climb onto car roof.',
      },
      {
        number: 3,
        heading: 'Avoid Electrical Hazards',
        detail: 'Stay far away from fallen utility poles and power lines. Water conducts lethal electrical current from downed wires.',
      },
      {
        number: 4,
        heading: 'Signal Rescuers',
        detail: 'Tie a bright cloth (red/orange) to a high pole or use a whistle. Use phone flashlight SOS strobe pattern (3 short, 3 long, 3 short).',
      },
      {
        number: 5,
        heading: 'Boil Drinking Water',
        detail: 'Floodwaters contain sewage, industrial chemicals, and dead pathogens. Never drink floodwater; boil or purify all water before consumption.',
      },
    ],
    dos: [
      'Disconnect home electricity mains and gas cylinders before evacuating',
      'Carry emergency survival pack: flashlight, phone in waterproof pouch, whistle, medications',
      'Follow NDRF / SDRF / Civil Defense evacuation sirens',
    ],
    donts: [
      'NEVER attempt to drive through flooded roads or underpasses',
      'Never walk in moving floodwater — hidden manholes and strong undercurrents cause drownings',
      'Never swim in floodwaters with live power lines nearby',
    ],
  },
  {
    id: 'earthquake-survival',
    title: 'Earthquake: Drop, Cover, Hold On',
    subtitle: 'Violent ground tremors, building collapse & aftershocks',
    category: 'disaster',
    severity: 'CRITICAL',
    icon: '🏚️',
    summary: 'Most earthquake injuries are caused by falling debris, shattering glass, and collapsing roof tiles rather than ground splitting.',
    vitalRule: 'DROP to your hands and knees, COVER your head and neck under a sturdy table, and HOLD ON until shaking stops.',
    emergencyPhone: '112',
    steps: [
      {
        number: 1,
        heading: 'DROP onto Hands & Knees',
        detail: 'Drop down immediately. This position protects you from being knocked down and allows you to stay low.',
      },
      {
        number: 2,
        heading: 'COVER Head & Neck',
        detail: 'Crawl under a sturdy desk or table. If no shelter is nearby, crawl next to an interior wall away from windows and cover your head with both arms.',
      },
      {
        number: 3,
        heading: 'HOLD ON Until Tremors Stop',
        detail: 'Hold on to your shelter with one hand; move with it if it shifts. Protect your head with the other hand.',
      },
      {
        number: 4,
        heading: 'If Outdoors: Move to Open Space',
        detail: 'Move away from buildings, streetlights, brick walls, and utility wires. Drop and cover until shaking stops.',
      },
      {
        number: 5,
        heading: 'Evacuate Safely After Shaking Stops',
        detail: 'Use stairs — NEVER elevators. Turn off gas valves. Expect strong aftershocks.',
      },
    ],
    dos: [
      'Drop, Cover, and Hold On under heavy furniture',
      'Protect head with pillows, books, or arms if caught in bed',
      'Be prepared for aftershocks within hours of the main quake',
    ],
    donts: [
      'NEVER use elevators during or immediately after an earthquake',
      'Do not run outside while shaking is occurring (falling facade bricks cause fatal head strikes)',
      'Do not stand in doorways (modern doorways are not structural shields)',
    ],
  },
];

export const FirstAidService = {
  getAllPlaybooks(): FirstAidPlaybook[] {
    return PLAYBOOKS;
  },

  getByCategory(category: FirstAidCategory): FirstAidPlaybook[] {
    if (category === 'all') return PLAYBOOKS;
    return PLAYBOOKS.filter((p) => p.category === category);
  },

  search(query: string, category: FirstAidCategory = 'all'): FirstAidPlaybook[] {
    const q = query.trim().toLowerCase();
    const base = this.getByCategory(category);
    if (!q) return base;

    return base.filter(
      (p) =>
        p.title.toLowerCase().includes(q) ||
        p.subtitle.toLowerCase().includes(q) ||
        p.summary.toLowerCase().includes(q) ||
        p.vitalRule.toLowerCase().includes(q) ||
        p.dos.some((d) => d.toLowerCase().includes(q)) ||
        p.steps.some((s) => s.heading.toLowerCase().includes(q) || s.detail.toLowerCase().includes(q))
    );
  },

  getPlaybookById(id: string): FirstAidPlaybook | undefined {
    return PLAYBOOKS.find((p) => p.id === id);
  },
};

export default FirstAidService;

