/**
 * VoicePath AI: Internationalization & Spoken Templates
 * Strictly centralizes all spoken and display text. Never concatenate raw strings in logic.
 */

const TEMPLATES = {
  "hi-IN": {
    WELCOME: "VoicePath AI me aapka swagat hai. Kahan jaana hai? Destination ka naam boliye, ya screen par button dabaiye.",
    WELCOME_SHORT: "VoicePath AI taiyar hai. Boliye kahan jaana hai.",
    CONFIRM_DESTINATION: "Kya aap {destination} keh rahe hain? Haan ya nahi bolo.",
    DESTINATION_AMBIGUOUS: "Samajh nahi aaya. Kya aap {opt1} ya {opt2} jaana chahte hain?",
    DESTINATION_NOT_FOUND: "Maaf kijiye, samajh nahi aaya. Next, repeat, ya destination ka naam dobara boliye.",
    ROUTE_FOUND: "{destination} ke liye raasta mil gaya hai. Kul lagbhag {steps} kadam. Agle step ke liye 'Next' boliye.",
    ALREADY_AT_DESTINATION: "Aap pehle se hi {destination} par hain.",
    ROUTE_NOT_FOUND: "Manzil ke liye koi khula raasta nahi mila. Kya nearest help point chalu?",
    ROUTE_CHANGED: "Raasta badal gaya hai. Naya route bata raha hoon.",
    ROUTE_BLOCKED_REASON: "{reason} ki wajah se raasta band hai. Rerouting ho rahi hai.",
    STEP_STRAIGHT: "Seedha chalo lagbhag {steps} kadam.",
    STEP_STRAIGHT_LANDMARK: "Seedha chalo jab tak {landmark} na aaye, lagbhag {steps} kadam.",
    STEP_LEFT: "Yahan se left mudo, phir lagbhag {steps} kadam chalo.",
    STEP_LEFT_LANDMARK: "Yahan se left mudo aur {landmark} ki taraf lagbhag {steps} kadam chalo.",
    STEP_RIGHT: "Yahan se right mudo, phir lagbhag {steps} kadam chalo.",
    STEP_RIGHT_LANDMARK: "Yahan se right mudo aur {landmark} ki taraf lagbhag {steps} kadam chalo.",
    STEP_UTURN: "Peeche ghum kar wapas mudo aur lagbhag {steps} kadam chalo.",
    STAIRS_WARNING: "Dhyan dein! Aage seedhiyan hain.",
    ARRIVAL_ANNOUNCEMENT: "Aapki manzil {destination} aa gayi hai.{landmark}",
    WHERE_AM_I: "Aap abhi {location} ke paas hain.",
    REPEAT_CURRENT: "Step {stepNumber}: {text}",
    NAVIGATION_STOPPED: "Navigation rok diya gaya hai.",
    GUARD_CONFIRM_PROMPT: "Guard ko alert bhej raha hoon. Theek hai? Haan ya nahi boliye.",
    GUARD_ALERT_SENT: "Guard ko alert bhej diya gaya hai. Kripya yahin rukhein, madad aa rahi hai.",
    GUARD_ACKNOWLEDGED: "Guard aa rahe hain. Sahayata jald pahunchegi.",
    GUARD_TIMEOUT: "60 seconds me koi jawab nahi aaya. Kripya reception ke paas chaliye ya helpline number dial kijiye.",
    PERSON_ALERT: "Saamne koi hai.",
    PERSON_HELP_OFFER: "Saamne vyakti hai. Kya main madad maangun?",
    STEP_FREE_ENABLED: "Step-free mode chalu ho gaya hai. Seedhiyan avoid ki jayengi.",
    STEP_FREE_DISABLED: "Step-free mode band ho gaya hai.",
    COMMAND_UNKNOWN: "Samajh nahi aaya. Next, repeat, stop, ya guard bol sakte hain.",
    REPORT_PROBLEM_DONE: "Corridor ko temporarily band mark kar diya hai. Naya route bata raha hoon.",
    SCREEN_READER_ON: "Screen reader mode chalu hai. App ki voice mute hai.",
    SCREEN_READER_OFF: "Screen reader mode band hai. App ki voice chalu hai.",
    TORCH_AUTO_ON: "Kam roshni detect hui, torch on kar di gayi hai.",
    TORCH_AUTO_OFF: "Roshni wapas aa gayi, torch band kar di gayi hai."
  },
  "en-IN": {
    WELCOME: "Welcome to VoicePath AI. Where would you like to go? Speak a destination name or tap a button.",
    WELCOME_SHORT: "VoicePath AI is ready. Where to?",
    CONFIRM_DESTINATION: "Did you say {destination}? Please say yes or no.",
    DESTINATION_AMBIGUOUS: "Not sure. Did you mean {opt1} or {opt2}?",
    DESTINATION_NOT_FOUND: "Sorry, I didn't catch that. Please repeat or choose from the list.",
    ROUTE_FOUND: "Route to {destination} ready. Approximately {steps} steps. Say 'Next' to advance.",
    ALREADY_AT_DESTINATION: "You are already at {destination}.",
    ROUTE_NOT_FOUND: "No open route available. Would you like directions to the nearest help point?",
    ROUTE_CHANGED: "The route has changed. Calculating an updated path.",
    ROUTE_BLOCKED_REASON: "Corridor blocked due to {reason}. Rerouting now.",
    STEP_STRAIGHT: "Walk straight for about {steps} steps.",
    STEP_STRAIGHT_LANDMARK: "Walk straight until you reach {landmark}, about {steps} steps.",
    STEP_LEFT: "Turn left, then walk forward about {steps} steps.",
    STEP_LEFT_LANDMARK: "Turn left towards {landmark}, walk about {steps} steps.",
    STEP_RIGHT: "Turn right, then walk forward about {steps} steps.",
    STEP_RIGHT_LANDMARK: "Turn right towards {landmark}, walk about {steps} steps.",
    STEP_UTURN: "Make a U-turn and walk back about {steps} steps.",
    STAIRS_WARNING: "Caution: Flight of stairs directly ahead.",
    ARRIVAL_ANNOUNCEMENT: "You have arrived at your destination: {destination}.{landmark}",
    WHERE_AM_I: "You are currently near {location}.",
    REPEAT_CURRENT: "Step {stepNumber}: {text}",
    NAVIGATION_STOPPED: "Navigation stopped.",
    GUARD_CONFIRM_PROMPT: "Sending an alert to security guard. Is that okay? Say yes or no.",
    GUARD_ALERT_SENT: "Security alert sent with your location. Please remain here.",
    GUARD_ACKNOWLEDGED: "Guard has acknowledged your alert and is on the way.",
    GUARD_TIMEOUT: "No guard acknowledgement within 60 seconds. Please proceed towards reception or emergency exit.",
    PERSON_ALERT: "Person detected ahead.",
    PERSON_HELP_OFFER: "Person in front. Would you like me to ask for help?",
    STEP_FREE_ENABLED: "Step-free mode enabled. Avoiding stairs.",
    STEP_FREE_DISABLED: "Step-free mode disabled.",
    COMMAND_UNKNOWN: "Command not recognized. You can say 'next', 'repeat', 'stop', or 'guard'.",
    REPORT_PROBLEM_DONE: "Corridor reported as blocked. Re-routing immediately.",
    SCREEN_READER_ON: "Screen reader mode active. App voice synthesizer muted.",
    SCREEN_READER_OFF: "Screen reader mode deactivated. App voice active.",
    TORCH_AUTO_ON: "Low light detected, flashlight turned on.",
    TORCH_AUTO_OFF: "Lighting restored, flashlight turned off."
  }
};

/**
 * Retrieves a formatted localized string template.
 * @param {string} key
 * @param {string} lang - "hi-IN" or "en-IN"
 * @param {Object} [params]
 * @returns {string}
 */
export function getTemplate(key, lang = "hi-IN", params = {}) {
  const dictionary = TEMPLATES[lang] || TEMPLATES["hi-IN"];
  let text = dictionary[key] || TEMPLATES["en-IN"][key] || key;

  for (const [k, val] of Object.entries(params)) {
    text = text.replace(new RegExp(`\\{${k}\\}`, "g"), String(val));
  }
  return text;
}
