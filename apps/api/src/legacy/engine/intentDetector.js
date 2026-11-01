/**
 * Intent Detection Engine
 * 
 * Detects multiple intents from a single message using weighted phrase/keyword
 * scoring. Supports 24 intent categories with priority levels.
 * Replaces the old single-regex-match approach.
 */

// Intent definitions with weighted patterns
const INTENT_DEFINITIONS = {
  greeting: {
    priority: 'P6',
    phrases: [
      { p: /^(hi|hello|hey|good\s*(morning|afternoon|evening)|howdy|greetings|salaam|assalam)/i, w: 10 },
      { p: /^(what'?s up|sup|yo)\b/i, w: 8 },
    ],
    keywords: [],
    threshold: 7,
  },

  general_business_inquiry: {
    priority: 'P4',
    phrases: [
      { p: /tell me (about|more about) (your|the) (business|company|organization|firm)/i, w: 10 },
      { p: /what (do you|does your company|does your business) (do|offer|provide|specialize)/i, w: 10 },
      { p: /can you (explain|describe) (your|the) (services?|business)/i, w: 9 },
    ],
    keywords: [
      { k: 'about', w: 2 }, { k: 'company', w: 3 }, { k: 'business', w: 2 },
    ],
    threshold: 7,
  },

  product_service_inquiry: {
    priority: 'P4',
    phrases: [
      { p: /what (services?|products?|treatments?|options?|packages?) (do you|are|have)/i, w: 10 },
      { p: /do you (offer|provide|have|sell|do)\b/i, w: 8 },
      { p: /tell me about (your|the) (menu|services?|products?|offerings?|treatments?|listings?|properties|plans?)/i, w: 10 },
      { p: /what('s| is) (on the|your) menu/i, w: 10 },
      { p: /what (kind|type|sort) of/i, w: 6 },
    ],
    keywords: [
      { k: 'services', w: 3 }, { k: 'products', w: 3 }, { k: 'menu', w: 4 },
      { k: 'treatments', w: 3 }, { k: 'listings', w: 3 }, { k: 'offer', w: 2 },
      { k: 'options', w: 2 }, { k: 'packages', w: 3 },
    ],
    threshold: 7,
  },

  pricing_inquiry: {
    priority: 'P4',
    phrases: [
      { p: /how much (does?|is|are|will|would|for)/i, w: 12 },
      { p: /what('s| is| are) (the )?(price|cost|rate|fee|charge|pricing|quote)/i, w: 12 },
      { p: /can (i|you) get a (quote|estimate|price|pricing)/i, w: 10 },
      { p: /do you (take|accept|have) (insurance|financing|payment plans?)/i, w: 9 },
      { p: /what (do you|does it) charge/i, w: 10 },
      { p: /is (it|this|that) (free|expensive|affordable)/i, w: 7 },
    ],
    keywords: [
      { k: 'price', w: 5 }, { k: 'pricing', w: 5 }, { k: 'cost', w: 5 },
      { k: 'fee', w: 4 }, { k: 'quote', w: 5 }, { k: 'rate', w: 3 },
      { k: 'budget', w: 4 }, { k: 'insurance', w: 3 }, { k: 'dollar', w: 4 },
      { k: 'expensive', w: 3 }, { k: 'affordable', w: 3 }, { k: 'discount', w: 4 },
      { k: 'coupon', w: 4 }, { k: 'deal', w: 2 },
    ],
    negativeKeywords: ['close', 'open', 'located', 'address', 'emergency'],
    threshold: 7,
  },

  location_inquiry: {
    priority: 'P4',
    phrases: [
      { p: /where (are you|is your|is the) (located|office|clinic|branch|store|shop|restaurant|building|studio|firm|headquarters)/i, w: 14 },
      { p: /what('s| is) (your|the) (address|location|place)/i, w: 14 },
      { p: /where (is|are) (your|the) (office|clinic|branch|store|shop|restaurant|studio|firm)/i, w: 14 },
      { p: /can you (share|give|send|tell) (me )?(your |the )?(address|location)/i, w: 12 },
      { p: /where (can i|do i|should i) (find|go|come|visit|reach) (you|your)/i, w: 12 },
      { p: /which (area|city|neighborhood|street|road) (are you|is your)/i, w: 12 },
      { p: /what (area|city|neighborhood) (are you|do you serve)/i, w: 10 },
      { p: /nearest (branch|office|location|clinic|store)/i, w: 12 },
      { p: /where are you\b/i, w: 12 },
      { p: /your address/i, w: 12 },
      { p: /branch address/i, w: 14 },
    ],
    keywords: [
      { k: 'located', w: 6 }, { k: 'location', w: 6 }, { k: 'address', w: 7 },
      { k: 'branch', w: 3 }, { k: 'office', w: 2 }, { k: 'where', w: 3 },
    ],
    negativeKeywords: ['open', 'close', 'hour', 'time', 'schedule'],
    threshold: 9,
  },

  operating_hours_inquiry: {
    priority: 'P4',
    phrases: [
      { p: /what (time|are your|are the) (do you|hours?|business hours?)/i, w: 14 },
      { p: /(are you|is your .+) open/i, w: 14 },
      { p: /when (do you|does your|does the|are you) (open|close|start|finish|operate)/i, w: 14 },
      { p: /what('s| is| are) (your|the) (hours?|timing|timings?|schedule|working hours?|business hours?|operating hours?)/i, w: 14 },
      { p: /(are|is) (you|your .+|the .+) (open|closed|available) (on|right now|today|tomorrow)/i, w: 14 },
      { p: /open (on )?(sunday|saturday|monday|tuesday|wednesday|thursday|friday|weekend|weekday)/i, w: 14 },
      { p: /do you (work|operate|open) on (sunday|saturday|weekend|holidays?)/i, w: 14 },
      { p: /what time do you (close|open|shut|finish)/i, w: 14 },
      { p: /are you open right now/i, w: 14 },
      { p: /when (do|can) you close/i, w: 14 },
      { p: /opening (hours?|time)/i, w: 12 },
      { p: /closing (hours?|time)/i, w: 12 },
    ],
    keywords: [
      { k: 'hours', w: 5 }, { k: 'timing', w: 5 }, { k: 'timings', w: 5 },
      { k: 'schedule', w: 3 }, { k: 'open', w: 4 }, { k: 'close', w: 4 },
      { k: 'closed', w: 4 }, { k: 'sunday', w: 3 }, { k: 'saturday', w: 3 },
      { k: 'weekend', w: 3 },
    ],
    negativeKeywords: ['located', 'address', 'where is', 'directions'],
    threshold: 9,
  },

  contact_inquiry: {
    priority: 'P4',
    phrases: [
      { p: /what('s| is) (your|the) (phone|contact|email|number|whatsapp)/i, w: 12 },
      { p: /how (can|do) i (contact|reach|call|email|message) (you|your|the)/i, w: 12 },
      { p: /can (i|you) (give|share|send) (me )?(your |the )?(phone|contact|email|number)/i, w: 10 },
    ],
    keywords: [
      { k: 'phone', w: 4 }, { k: 'contact', w: 4 }, { k: 'email', w: 4 },
      { k: 'whatsapp', w: 4 }, { k: 'number', w: 2 },
    ],
    threshold: 8,
  },

  directions_inquiry: {
    priority: 'P4',
    phrases: [
      { p: /how (do|can|should) i (get|come|go|reach|drive|navigate|travel) (to |there)/i, w: 14 },
      { p: /can you (guide|direct|navigate|help) me (to|there)/i, w: 12 },
      { p: /(give|share|send) (me )?(directions|a map|google maps)/i, w: 12 },
      { p: /how far (is|are) (your|the)/i, w: 10 },
      { p: /directions to (your|the)/i, w: 14 },
    ],
    keywords: [
      { k: 'directions', w: 6 }, { k: 'navigate', w: 5 }, { k: 'route', w: 5 },
      { k: 'map', w: 4 }, { k: 'maps', w: 4 }, { k: 'drive', w: 2 },
    ],
    threshold: 9,
  },

  appointment_scheduling: {
    priority: 'P3',
    phrases: [
      { p: /(book|schedule|make|set up|arrange|request) (an? )?(appointment|booking|consultation|meeting|visit|showing|viewing|session|slot|reservation)/i, w: 14 },
      { p: /i('d| would) (like|want) to (book|schedule|make|visit|see|come)/i, w: 12 },
      { p: /can i (book|schedule|make|get) (an? )?(appointment|booking|consultation|meeting|visit|showing|viewing)/i, w: 14 },
      { p: /do you have (any )?(availability|available|slots?|openings?)/i, w: 10 },
      { p: /when (can i|is .+ available|are you available)/i, w: 8 },
      { p: /i need (an? )?(appointment|booking|consultation|visit)/i, w: 12 },
    ],
    keywords: [
      { k: 'appointment', w: 7 }, { k: 'booking', w: 6 }, { k: 'schedule', w: 4 },
      { k: 'book', w: 4 }, { k: 'consultation', w: 5 }, { k: 'showing', w: 5 },
      { k: 'viewing', w: 5 }, { k: 'reservation', w: 5 }, { k: 'visit', w: 3 },
    ],
    threshold: 8,
  },

  order_placement: {
    priority: 'P3',
    phrases: [
      { p: /i('d| would) (like|want) to (order|place|get|have|buy|purchase)/i, w: 12 },
      { p: /can i (order|place|get|buy|purchase)/i, w: 12 },
      { p: /(place|make|submit) (an? )?(order|purchase)/i, w: 12 },
      { p: /i('ll| will) (take|have|get|order)/i, w: 10 },
      { p: /add .+ to (my )?(order|cart|basket)/i, w: 12 },
    ],
    keywords: [
      { k: 'order', w: 4 }, { k: 'buy', w: 4 }, { k: 'purchase', w: 5 },
    ],
    threshold: 8,
  },

  order_modification: {
    priority: 'P3',
    phrases: [
      { p: /(change|modify|update|edit|alter) (my |the |an? )?(order|delivery|item|quantity)/i, w: 14 },
      { p: /i (want|need|'d like) to (change|modify|update|switch|swap)/i, w: 10 },
      { p: /can (i|you) (change|modify|update|edit) (my |the )?(order|item|delivery)/i, w: 12 },
    ],
    keywords: [
      { k: 'modify', w: 5 }, { k: 'change', w: 3 }, { k: 'update', w: 3 },
      { k: 'swap', w: 4 }, { k: 'switch', w: 3 },
    ],
    threshold: 8,
  },

  order_cancellation: {
    priority: 'P3',
    phrases: [
      { p: /(cancel|void|revoke) (my |the |an? )?(order|booking|reservation|appointment|subscription)/i, w: 14 },
      { p: /i (want|need|'d like) to cancel/i, w: 12 },
      { p: /can (i|you) cancel (my |the )?(order|booking|reservation|appointment)/i, w: 14 },
      { p: /i don'?t want (this|the|my) (order|booking|reservation) anymore/i, w: 12 },
    ],
    keywords: [
      { k: 'cancel', w: 7 }, { k: 'cancellation', w: 7 },
      { k: 'void', w: 5 }, { k: 'revoke', w: 5 },
    ],
    threshold: 8,
  },

  delivery_availability_inquiry: {
    priority: 'P4',
    phrases: [
      { p: /do you (deliver|ship|offer delivery|have delivery)/i, w: 12 },
      { p: /(when|how long) (will|does|would) (it|my order|delivery) (take|arrive|be delivered)/i, w: 12 },
      { p: /is .+ (available|in stock|in-stock)/i, w: 10 },
      { p: /do you have .+ (available|in stock)/i, w: 10 },
      { p: /delivery (time|estimate|fee|charge|area|range|option)/i, w: 12 },
      { p: /(is|are) .+ (available|out of stock)/i, w: 8 },
    ],
    keywords: [
      { k: 'delivery', w: 5 }, { k: 'deliver', w: 5 }, { k: 'shipping', w: 5 },
      { k: 'available', w: 3 }, { k: 'stock', w: 4 }, { k: 'availability', w: 5 },
    ],
    negativeKeywords: ['terrible', 'awful', 'disappointing', 'disappointed', 'love', 'excellent', 'amazing', 'complaint'],
    threshold: 8,
  },

  positive_feedback: {
    priority: 'P6',
    phrases: [
      { p: /(excellent|amazing|wonderful|fantastic|great|awesome|outstanding|impressive|incredible|superb) (service|experience|support|team|staff|work|job|product)/i, w: 14 },
      { p: /i (really )?(love|liked|enjoyed|appreciate) (your|the|this)/i, w: 12 },
      { p: /thank(s| you) (so much|a lot|for)/i, w: 8 },
      { p: /(keep up|well done|good job|great job|kudos|bravo|hat'?s off)/i, w: 12 },
      { p: /you('ve| have) been (very |really |so )?(helpful|great|amazing|wonderful)/i, w: 12 },
      { p: /really (impressed|happy|satisfied|pleased|delighted)/i, w: 12 },
      { p: /(best|greatest) (service|experience|team|support)/i, w: 12 },
      { p: /your (staff|team|people|employees?) (was|were|are|is) (very |really |so )?(helpful|great|amazing|professional|friendly|kind|nice)/i, w: 14 },
    ],
    keywords: [
      { k: 'excellent', w: 5 }, { k: 'amazing', w: 5 }, { k: 'wonderful', w: 5 },
      { k: 'fantastic', w: 5 }, { k: 'impressed', w: 5 }, { k: 'outstanding', w: 5 },
      { k: 'love', w: 3 }, { k: 'appreciate', w: 4 },
    ],
    negativeKeywords: ['terrible', 'awful', 'bad', 'worst', 'poor'],
    threshold: 9,
  },

  negative_feedback: {
    priority: 'P2',
    phrases: [
      { p: /(terrible|awful|horrible|worst|pathetic|unacceptable|disgusting|appalling|dreadful) (service|experience|support|team|staff|product|quality)/i, w: 14 },
      { p: /i('m| am) (very |really |so |extremely )?(disappointed|dissatisfied|unhappy|frustrated|upset|angry|furious)/i, w: 14 },
      { p: /your (service|support|product|quality|staff|team|customer service) (is|are|was|were) (really |very |so |absolutely )?(terrible|awful|bad|poor|horrible|pathetic|worst)/i, w: 16 },
      { p: /(not|never) (happy|satisfied|pleased|impressed) (with|by|about)/i, w: 12 },
      { p: /(bad|poor|terrible|awful|horrible|worst) (experience|service|quality|product)/i, w: 14 },
      { p: /this (is|was) (a |the )?(worst|terrible|horrible|awful|bad|poor)/i, w: 12 },
      { p: /not (good|great|satisfactory|acceptable)/i, w: 8 },
      { p: /(service|support|product|quality|staff|team|customer service) is (terrible|awful|horrible|bad|poor|pathetic|worst|unacceptable|disappointing)/i, w: 14 },
      { p: /(is|are|was|were) (terrible|awful|horrible|pathetic|worst|unacceptable|disappointing|dreadful)/i, w: 10 },
      { p: /disappointing|disappointed/i, w: 8 },
    ],
    keywords: [
      { k: 'terrible', w: 6 }, { k: 'awful', w: 6 }, { k: 'horrible', w: 6 },
      { k: 'worst', w: 6 }, { k: 'pathetic', w: 6 }, { k: 'disappointing', w: 5 },
      { k: 'disappointed', w: 5 }, { k: 'dissatisfied', w: 5 }, { k: 'frustrated', w: 4 },
      { k: 'unacceptable', w: 5 }, { k: 'poor', w: 4 },
    ],
    threshold: 7,
  },

  customer_complaint: {
    priority: 'P2',
    phrases: [
      { p: /my (order|item|product|package|delivery|food|meal) (arrived|came|was|is|has been) (late|damaged|wrong|incorrect|broken|missing|cold|stale|expired)/i, w: 16 },
      { p: /i (was |got |have been )?charged (twice|double|extra|incorrectly|wrong)/i, w: 16 },
      { p: /your (employee|staff|driver|agent|worker) (was|were|is) (rude|unprofessional|disrespectful|unhelpful|aggressive)/i, w: 16 },
      { p: /nobody (responded|replied|answered|called back|got back)/i, w: 14 },
      { p: /i (want|need|'d like) to (file|make|submit|lodge|report) (a )?(complaint|grievance|report)/i, w: 14 },
      { p: /still (waiting|haven'?t|not received|no response|no reply|pending)/i, w: 10 },
      { p: /(wrong|incorrect|missing|broken|damaged|defective) (item|product|order|delivery|package)/i, w: 14 },
      { p: /i received (the )?(wrong|a different|incorrect|damaged|broken)/i, w: 14 },
    ],
    keywords: [
      { k: 'complaint', w: 7 }, { k: 'damaged', w: 5 }, { k: 'broken', w: 5 },
      { k: 'wrong', w: 3 }, { k: 'incorrect', w: 4 }, { k: 'missing', w: 4 },
      { k: 'rude', w: 5 }, { k: 'overcharged', w: 6 }, { k: 'refund', w: 4 },
    ],
    threshold: 9,
  },

  refund_compensation: {
    priority: 'P2',
    phrases: [
      { p: /i (want|need|'d like|demand|expect) (a |my )?(refund|money back|compensation|reimbursement|credit)/i, w: 14 },
      { p: /can (i|you) (get|give|process|issue) (a |my )?(refund|money back|compensation|reimbursement|credit)/i, w: 14 },
      { p: /return (policy|process|this|the|my)/i, w: 10 },
      { p: /(exchange|replace|swap|return) (this|the|my|it)/i, w: 10 },
    ],
    keywords: [
      { k: 'refund', w: 7 }, { k: 'compensation', w: 6 }, { k: 'reimburse', w: 6 },
      { k: 'reimbursement', w: 6 }, { k: 'return', w: 3 }, { k: 'exchange', w: 4 },
      { k: 'replace', w: 3 }, { k: 'replacement', w: 5 }, { k: 'money back', w: 7 },
    ],
    threshold: 8,
  },

  urgent_assistance: {
    priority: 'P1',
    phrases: [
      { p: /i (need|require|want) (urgent|immediate|quick|fast|instant|priority) (help|assistance|support|attention|response)/i, w: 16 },
      { p: /this is (very |really |extremely )?(urgent|critical|serious|important|time-sensitive)/i, w: 14 },
      { p: /(please |can you )?(hurry|rush|asap|right away|right now|immediately)/i, w: 10 },
      { p: /as soon as possible/i, w: 8 },
    ],
    keywords: [
      { k: 'urgent', w: 5 }, { k: 'asap', w: 5 }, { k: 'immediately', w: 5 },
      { k: 'critical', w: 4 }, { k: 'priority', w: 3 },
    ],
    threshold: 8,
  },

  emergency_escalation: {
    priority: 'P0',
    phrases: [
      { p: /i have (an? )?(emergency|crisis|life-threatening|dangerous)/i, w: 18 },
      // "help me" on its own is not an emergency ("can you help me choose a plan?").
      { p: /(emergency|\bsos\b|save me|i'?m in danger|please help( me)? (now|quickly|asap|immediately))/i, w: 16 },
      { p: /someone (needs to|has to|must) (call|help|come|respond) (me )?(urgently|immediately|right now|now)/i, w: 16 },
      // Hazards described as happening, not product words ("fire alarm", "electrical panel").
      { p: /(gas leak|smell(s|ing)? (of )?gas|carbon monoxide|(house|kitchen|building|car) (is )?on fire|caught fire|there'?s a fire|fire (in|at) (my|the|our)|flooding|flooded|water (is )?(pouring|everywhere|leaking)|burst pipe|sparking|sparks (coming|flying)|electrocut\w*|burning smell|smoke (is )?coming)/i, w: 18 },
      { p: /(injur(y|ed)|accident|medical emergency|bleeding (a lot|heavily|badly|won'?t stop|that won'?t stop)|(is|are|keeps?) bleeding|can'?t breathe|cannot breathe|trouble breathing|chest pain|unconscious|passed out|severe (pain|swelling)|knocked out (a |my |his |her )?tooth)/i, w: 18 },
      { p: /this is (a |an )?(serious |real )?(emergency|crisis|life-threatening)/i, w: 18 },
      { p: /connect me (with someone|to someone|immediately|right now|urgently)/i, w: 14 },
      { p: /need (immediate|urgent|emergency) (help|assistance|support|response)/i, w: 16 },
    ],
    keywords: [
      { k: 'emergency', w: 8 }, { k: 'crisis', w: 7 }, { k: 'danger', w: 6 },
      { k: 'life-threatening', w: 9 }, { k: 'sos', w: 8 },
    ],
    negativeKeywords: ['appointment', 'price', 'menu'],
    threshold: 10,
  },

  human_representative_request: {
    priority: 'P1',
    phrases: [
      { p: /(can|may|could) i (speak|talk|chat) (to|with) (a |an? )?(real |actual |human |live )?(person|human|agent|representative|manager|supervisor|someone)/i, w: 16 },
      { p: /i (want|need|'d like|prefer) to (speak|talk|chat) (to|with) (a |an? )?(real |actual |human |live )?(person|human|agent|representative|manager|someone)/i, w: 16 },
      { p: /connect me (to|with) (a |an? )?(person|human|agent|manager|supervisor|representative|someone)/i, w: 16 },
      { p: /transfer (me |my call )?(to|with) (a |an? )?(person|human|agent|manager|supervisor)/i, w: 16 },
      { p: /can someone (call|contact|reach out to|get back to) me/i, w: 14 },
      { p: /i don'?t want to (speak|talk|chat|deal) with (an? )?(ai|bot|chatbot|robot|automated|machine)/i, w: 16 },
      { p: /get me (a |an? )?(real |human |live )?(person|human|agent|representative|manager|supervisor)/i, w: 16 },
      { p: /put me through to/i, w: 12 },
    ],
    keywords: [
      { k: 'manager', w: 5 }, { k: 'supervisor', w: 5 }, { k: 'representative', w: 5 },
      { k: 'human', w: 4 }, { k: 'person', w: 3 }, { k: 'someone', w: 2 },
    ],
    threshold: 10,
  },

  follow_up_request: {
    priority: 'P3',
    phrases: [
      { p: /i('m| am) following up (on|about|regarding)/i, w: 14 },
      { p: /any (update|progress|news|status) (on|about|regarding)/i, w: 12 },
      { p: /what('s| is) the (status|update|progress) (of|on|about|regarding)/i, w: 14 },
      { p: /i (called|emailed|messaged|contacted|reached out) (earlier|before|yesterday|last week)/i, w: 12 },
      { p: /checking (in|back|on) (on|about|regarding|my)/i, w: 10 },
    ],
    keywords: [
      { k: 'follow-up', w: 6 }, { k: 'followup', w: 6 }, { k: 'status', w: 3 },
      { k: 'update', w: 2 }, { k: 'progress', w: 3 },
    ],
    threshold: 8,
  },

  sales_lead_qualification: {
    priority: 'P5',
    phrases: [
      { p: /i('m| am) (interested|looking|thinking|considering)/i, w: 8 },
      { p: /i (want|need|'d like) to (buy|purchase|get|invest|start|sign up|subscribe|enroll)/i, w: 10 },
      { p: /can (i|you) (sign|set) (me )?up/i, w: 8 },
      { p: /i('d| would) like (more )?information (about|on|regarding)/i, w: 6 },
      { p: /how (do|can) i (get started|sign up|subscribe|register|begin|enroll|join)/i, w: 10 },
    ],
    keywords: [
      { k: 'interested', w: 3 }, { k: 'invest', w: 4 }, { k: 'subscribe', w: 4 },
      { k: 'signup', w: 4 }, { k: 'register', w: 3 }, { k: 'enroll', w: 4 },
    ],
    threshold: 7,
  },

  faq: {
    priority: 'P4',
    phrases: [
      { p: /do you (accept|take) (cash|card|credit|debit|crypto|bitcoin|apple pay|google pay)/i, w: 10 },
      { p: /what (forms?|methods?|types?) of payment/i, w: 10 },
      { p: /do you have (parking|wifi|wi-fi|wheelchair|disability|pet|valet)/i, w: 8 },
      { p: /is there (parking|wifi|wi-fi|wheelchair|disability|pet|valet)/i, w: 8 },
      { p: /what (is|are) (your|the) (policy|policies|rules?|terms?|conditions?)/i, w: 8 },
      { p: /do i need (to bring|an? |any )/i, w: 6 },
    ],
    keywords: [
      { k: 'parking', w: 4 }, { k: 'wifi', w: 4 }, { k: 'policy', w: 3 },
      { k: 'wheelchair', w: 4 }, { k: 'payment', w: 3 },
    ],
    threshold: 7,
  },

  unsupported_request: {
    priority: 'P4',
    phrases: [],
    keywords: [],
    threshold: 999, // never auto-detected, assigned as fallback
  },
};

// Priority ordering map
const PRIORITY_ORDER = { P0: 0, P1: 1, P2: 2, P3: 3, P4: 4, P5: 5, P6: 6 };

/**
 * Detect all intents in a message with confidence scores.
 * Returns an array sorted by priority (highest first), then by score.
 * 
 * @param {string} message - The user's message
 * @param {Object} conversationState - Current conversation state for context
 * @returns {Array<{intent: string, score: number, priority: string, confidence: number}>}
 */
function detectIntents(message, conversationState = {}) {
  const msg = (message || '').trim();
  if (!msg) return [{ intent: 'greeting', score: 0, priority: 'P6', confidence: 0.5 }];

  const msgLower = msg.toLowerCase();
  const results = [];

  // Check for callback number in active emergency/escalation workflow
  if (conversationState.activeWorkflow) {
    const wf = conversationState.activeWorkflow;
    if ((wf.type === 'emergency_escalation' || wf.type === 'human_handoff') &&
        (wf.state === 'AWAITING_CALLBACK_NUMBER' || wf.state === 'AWAITING_INFO')) {
      // Check if message contains a phone number
      const phoneMatch = msg.match(/[\+]?[\d\s\-\(\)]{7,15}/);
      if (phoneMatch) {
        return [{
          intent: 'callback_number_provided',
          score: 20,
          priority: 'P0',
          confidence: 0.99,
          extractedData: { callbackNumber: phoneMatch[0].replace(/[\s\-\(\)]/g, '') }
        }];
      }
      // Check for name
      const nameMatch = msg.match(/^(?:(?:my name is|i'?m|this is|i am)\s+)?([A-Z][a-z]+ [A-Z][a-z]+)/i);
      if (nameMatch) {
        return [{
          intent: 'customer_info_provided',
          score: 18,
          priority: wf.type === 'emergency_escalation' ? 'P0' : 'P1',
          confidence: 0.95,
          extractedData: { customerName: nameMatch[1] }
        }];
      }
    }

    // Continue appointment scheduling context
    if (wf.type === 'appointment_scheduling' && 
        (wf.state === 'AWAITING_DATE' || wf.state === 'AWAITING_TIME' || wf.state === 'AWAITING_NAME')) {
      const dateMatch = msg.match(/\b(tomorrow|today|monday|tuesday|wednesday|thursday|friday|saturday|sunday|next week)\b/i);
      const timeMatch = msg.match(/\b(\d{1,2}(?::\d{2})?\s*(?:am|pm)?|morning|afternoon|evening|noon)\b/i);
      const nameMatch = msg.match(/^(?:(?:my name is|i'?m|this is|i am)\s+)?([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)/i);
      
      if (wf.state === 'AWAITING_DATE' && (dateMatch || timeMatch)) {
        return [{
          intent: 'appointment_info_provided',
          score: 18,
          priority: 'P3',
          confidence: 0.95,
          extractedData: { 
            date: dateMatch ? dateMatch[1] : null,
            time: timeMatch ? timeMatch[1] : null
          }
        }];
      }
      if (wf.state === 'AWAITING_TIME' && timeMatch) {
        return [{
          intent: 'appointment_info_provided',
          score: 18,
          priority: 'P3',
          confidence: 0.95,
          extractedData: { time: timeMatch[1] }
        }];
      }
      if (wf.state === 'AWAITING_NAME' && nameMatch && msg.length < 60) {
        return [{
          intent: 'appointment_info_provided',
          score: 18,
          priority: 'P3',
          confidence: 0.95,
          extractedData: { customerName: nameMatch[1] }
        }];
      }
    }
  }

  // Score each intent
  for (const [intentName, def] of Object.entries(INTENT_DEFINITIONS)) {
    if (intentName === 'unsupported_request') continue;
    
    let score = 0;

    // Check phrases (higher weight, more specific)
    for (const { p, w } of def.phrases) {
      if (p.test(msgLower) || p.test(msg)) {
        score += w;
      }
    }

    // Check keywords
    for (const { k, w } of (def.keywords || [])) {
      const kLower = k.toLowerCase();
      if (msgLower.includes(kLower)) {
        score += w;
      }
    }

    // Apply negative keyword penalties
    for (const neg of (def.negativeKeywords || [])) {
      if (msgLower.includes(neg.toLowerCase())) {
        score -= 4;
      }
    }

    if (score >= def.threshold) {
      const maxPossible = def.phrases.reduce((s, p) => s + p.w, 0) +
                          (def.keywords || []).reduce((s, k) => s + k.w, 0);
      const confidence = Math.min(0.99, Math.max(0.6, score / Math.max(maxPossible, 1)));
      
      results.push({
        intent: intentName,
        score,
        priority: def.priority,
        confidence: Number(confidence.toFixed(2)),
      });
    }
  }

  // Sort by priority first, then by score within same priority
  results.sort((a, b) => {
    const pDiff = PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority];
    if (pDiff !== 0) return pDiff;
    return b.score - a.score;
  });

  // If no intents detected, use unsupported_request
  if (results.length === 0) {
    // Check if it might be a simple short response to an ongoing conversation
    if (conversationState.activeWorkflow && msg.length < 50) {
      return [{
        intent: 'contextual_response',
        score: 5,
        priority: 'P4',
        confidence: 0.6,
      }];
    }
    return [{
      intent: 'unsupported_request',
      score: 0,
      priority: 'P4',
      confidence: 0.3,
    }];
  }

  return results;
}

/**
 * Extract structured entities from a message
 */
function extractEntities(message) {
  const msg = (message || '').trim();
  const entities = {};

  // Phone number
  const phoneMatch = msg.match(/[\+]?[\d\s\-\(\)]{7,15}/);
  if (phoneMatch) {
    entities.phoneNumber = phoneMatch[0].replace(/[\s\-\(\)]/g, '');
  }

  // Email
  const emailMatch = msg.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
  if (emailMatch) {
    entities.email = emailMatch[0];
  }

  // Date references
  const dateMatch = msg.match(/\b(tomorrow|today|monday|tuesday|wednesday|thursday|friday|saturday|sunday|next week|next month)\b/i);
  if (dateMatch) {
    entities.dateReference = dateMatch[1].toLowerCase();
  }

  // Time references
  const timeMatch = msg.match(/\b(\d{1,2}(?::\d{2})?\s*(?:am|pm)|morning|afternoon|evening|noon)\b/i);
  if (timeMatch) {
    entities.timeReference = timeMatch[1];
  }

  // Name
  const nameMatch = msg.match(/(?:my name is|i'?m|this is|i am)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)/i);
  if (nameMatch) {
    entities.customerName = nameMatch[1];
  }

  // Order/reference number
  const orderMatch = msg.match(/(?:order|reference|booking|confirmation|ticket|case)\s*(?:#|no\.?|number)?\s*:?\s*([A-Z0-9-]{4,20})/i);
  if (orderMatch) {
    entities.referenceNumber = orderMatch[1];
  }

  return entities;
}

module.exports = { detectIntents, extractEntities, INTENT_DEFINITIONS, PRIORITY_ORDER };
