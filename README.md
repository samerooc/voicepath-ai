# VoicePath AI: Voice-First Indoor Navigation

> **Tagline:** Navigate by Voice, Move with Confidence.  
> **One-liner:** The user says where they want to go; the app computes a safe route on a digital indoor graph and speaks short, landmark-based instructions one step at a time. When a corridor is blocked, it reroutes automatically in under 1 second. When unsure, it puts a human guard in the loop.

---

## 1. Features & Capabilities

- **Zero-Dependency Vanilla Architecture:** Built with pure HTML5, CSS3, and ES Modules. No build step or heavy npm framework required.
- **Dijkstra Shortest Path Engine:** Custom graph algorithm in `js/router.js` with instant corridor blocking support and step-free stairs avoidance.
- **Landmark-Grounded Spoken Turns:** Spoken guidance leverages physical building landmarks (*"Walk straight until the water cooler, then turn left"*) instead of confusing meters.
- **Bilingual Voice Engine (`hi-IN` & `en-IN`):** Supports Hindi/Hinglish and English voice synthesis and push-to-talk speech recognition.
- **Fuzzy Destination Matching:** Levenshtein distance + token overlap matching with Devanagari script support (e.g., *"lib"*, *"pustakalay"*, *"पुस्तकालय"* all resolve to Central Library).
- **Interactive Sighted Helper SVG Map:** Real-time visual SVG map for judges and sighted companions with glowing route pulses and blocked corridor markers.
- **Human-in-the-Loop Guard Dispatch:** One-tap emergency guard assistance with instant `BroadcastChannel` alerting, 60s timeout escalation, and audio dispatch confirmation.
- **No-Code Admin Map Editor:** `admin.html` enables staff to block corridors, rename rooms, adjust landmarks, and export updated map JSON without touching code.
- **Experimental On-Device Camera Safety:** Low-latency memory-only person proximity alerts (zero image persistence).
- **Accessibility & Screen Reader Mode:** High-contrast WCAG AA layout, minimum 48px touch targets, full keyboard navigation (N, R, Esc, G), and dedicated Screen Reader mode to prevent audio overlap.
- **Offline Capable:** Service worker (`sw.js`) caches app shell and floor graph for reliable local navigation.

---

## 2. Architecture Overview

```
Layer 1: SAFETY (On-device, works offline)
         Camera -> person proximity heuristic -> beep / vibration / spoken alert

Layer 2: NAVIGATION (On-device graph routing)
         map.json -> Dijkstra -> direction generator -> landmark-based spoken turns
         Step-free filter + QR checkpoint position reset + WakeLock

Layer 3: CONVERSATION & INPUT (On-device + Web Speech API)
         Push-to-talk SpeechRecognition -> Levenshtein fuzzy matcher -> Destination confirmation

Layer 4: HUMAN HELP (Volunteer / Guard)
         Call Guard button -> BroadcastChannel / Storage -> Guard dashboard alert
```

---

## 3. Quick Start & How to Run

Because VoicePath AI uses ES modules, SpeechSynthesis, and camera sensors, it should be served over HTTP/HTTPS or localhost:

### Option A: Using Python (Built-in)
```bash
python -m http.server 8000
```
Open **`http://localhost:8000`** in Google Chrome or Microsoft Edge.

### Option B: Using Node `npx serve`
```bash
npx -y serve .
```

### Option C: Direct File Access
You can also open `index.html` directly in your browser.

---

## 4. Key Pages

1. **User App:** [`index.html`](file:///d:/Downloads/vp%20modle/index.html) — Main accessible voice navigation interface.
2. **Admin Editor:** [`admin.html`](file:///d:/Downloads/vp%20modle/admin.html) — Floor plan manager & corridor blocking tool (Demo PIN: `1234`).
3. **Guard Dashboard:** [`guard.html`](file:///d:/Downloads/vp%20modle/guard.html) — Security station receiver for student assistance calls.
4. **Automated Test Suite:** [`tests/tests.html`](file:///d:/Downloads/vp%20modle/tests/tests.html) — In-browser test runner.

---

## 5. Automated Tests

Run the command-line test suite:
```bash
node tests/run-node-tests.js
```
*Current Status:* **42/42 Tests Passing (Router, Directions, Fuzzy Matcher, Map Validator).**

---

## 6. Live 3-Minute Demo Flow

1. Click **Start Navigation / शुरू करें** to unlock browser audio.
2. Tap the **Tap to Speak / बोलिए** button and say: *"Library le chalo"* (or click the **Central Library** quick button).
3. The app confirms: *"Kya aap Central Library keh rahe hain?"* Say *"Haan"* or confirm.
4. The route lights up in green on the SVG map and speaks the first landmark instruction.
5. Tap **Next Step ➡️** twice to demonstrate step-by-step guidance.
6. Click **⚡ Demo: Toggle Corridor Block** (or tap **Raasta Band Hai**). Notice how the app instantly cancels prior speech, recalculates an alternative route around the blockage, and announces: *"Raasta badal gaya hai, naya route bata raha hoon."*
7. Toggle **♿ Step-Free** mode: the stairs segment is instantly eliminated in favor of elevator corridors.
8. Tap **🛡️ Call Guard**: open `guard.html` side-by-side to witness the real-time audio chime and click **Acknowledge** to hear the user app say: *"Guard aa rahe hain."*

---

## 7. Safety & Honesty Statement

> **VoicePath AI is an assistive prototype.** It does not detect all obstacles, hazards, or closed doors, and its position is an estimate based on step progression. It is a supplement to a white cane or guide dog and never a replacement. Users must always use their own judgement and seek human assistance when unsure.
