# VoicePath AI: Technical Architecture and Modules

Part 2 of 8 · Version 1.0 · 22 Oct 2026

Context: VoicePath AI is a voice-first indoor navigation web app for visually impaired users. Phase 1 is a pure front-end app (HTML, CSS, vanilla JavaScript ES modules) with no backend, no framework and no paid API.

## 1. Modules to use and not use

| Module | Use | Why | Do NOT use |
| --- | --- | --- | --- |
| Routing | Own Dijkstra in `router.js` | Tiny graph, full control, no dependency | Graph libraries or paid routing APIs |
| Map display | Inline SVG | Easy highlight and click | Canvas or image-only map (no data) |
| Voice output | `window.speechSynthesis` | Free, mostly works offline | Cloud TTS for MVP |
| Voice input | `SpeechRecognition` / `webkitSpeechRecognition` | Free, no key | Always-on listening without user action |
| Fuzzy search | Own Levenshtein plus token overlap | Small data set | Large NLP libraries |
| Storage | `localStorage` for edited map and settings | Simple | IndexedDB or backend for MVP |
| Haptics | `navigator.vibrate` | Android Chrome only | Relying on it for iPhone |
| Person detection (Phase 2) | MediaPipe Tasks or TensorFlow.js COCO-SSD, `person` class only | Runs in browser | Cloud vision for safety alerts |
| QR (Phase 3) | `html5-qrcode` or `jsQR` | Reliable and small | Custom QR decoding |
| Guard alert (Phase 2) | Firebase Firestore or `BroadcastChannel` mock | Fast setup | Custom server |
| Realtime voice (Phase 3) | Gemini Live or OpenAI Realtime API | Low-latency conversation | Using it as the only source of directions |
| Offline (Phase 3) | Service worker | Cache app and map | Caching without a map version check |

Check current documentation and pricing before using any cloud API.

## 2. Data model: `data/map.json`

```json
{
  "version": 1,
  "lastUpdated": "2026-10-22",
  "startNode": "entrance",
  "nodes": {
    "library": {
      "x": 200, "y": 150,
      "name": "Library",
      "aliases": ["lib", "pustakalay", "पुस्तकालय"],
      "landmark": "glass door",
      "type": "room",
      "lastVerified": "2026-10-20"
    }
  },
  "edges": [
    { "id": "e1", "from": "j1", "to": "library", "dist": 12,
      "blocked": false, "stepFree": true, "reason": "" }
  ]
}
```

**Node types:** `room`, `junction`, `entrance`, `exit`, `stairs`, `lift`, `help_point`.

**Rules**

- Edges are bidirectional. The loader creates both directions.
- `dist` is a positive integer (approximate metres).
- Node ids are unique and every edge references existing nodes.
- `landmark` is optional. If missing, the instruction omits it.
- Add Devanagari aliases for every room because Hindi recognition returns Devanagari text.
- The demo map needs an alternate path to every important room, one stairs edge (`stepFree: false`), one `exit` and one `help_point`.

## 3. Core algorithms

### 3.1 Routing (`router.js`)

- Build an adjacency list from edges, both directions.
- Skip edges with `blocked: true`. In step-free mode also skip `stepFree: false`.
- Return `{ path: [nodeIds], totalDist }` or `null`.
- If `from === to`, return a one-node path and say the user is already there.
- If no route exists, say "Route nahi mila" and offer the nearest help point.

### 3.2 Direction generator (`directions.js`)

For each triple of consecutive nodes (a, b, c):

```js
function turnType(a, b, c) {
  const v1 = { x: b.x - a.x, y: b.y - a.y };
  const v2 = { x: c.x - b.x, y: c.y - b.y };
  const cross = v1.x * v2.y - v1.y * v2.x;
  const dot = v1.x * v2.x + v1.y * v2.y;
  const angle = Math.abs(Math.atan2(cross, dot) * 180 / Math.PI);
  if (angle < 30) return "straight";
  if (angle > 150) return "uturn";
  return cross > 0 ? "right" : "left"; // SVG y axis points DOWN
}
```

- Merge consecutive straight segments into one instruction.
- Use landmarks: "Seedha chalo jab tak water cooler na aaye, phir left lo."
- Optionally add "lagbhag 20 kadam" (distance divided by 0.7), never an exact claim.
- Warn before a stairs edge: "Aage seedhiyan hain."
- Final instruction: "Aapki manzil Library aa gayi."
- Unit tests for four known layouts: left, right, straight, U-turn.

### 3.3 Fuzzy matching (`voice.js`)

1. Normalise: lowercase, trim, remove punctuation, keep Devanagari.
2. Compare with `name` and every alias.
3. Score by Levenshtein distance and token overlap.
4. If the best score passes the threshold and is clearly above the second best, ask "Kya aap Library keh rahe hain?"
5. If two matches are close, read both options and let the user choose.
6. If nothing matches, say "Samajh nahi aaya" and read the first five destinations.

### 3.4 Position model (MVP)

- `state.currentNodeId` starts at `startNode`.
- The user advances with "next" or the large Next button after finishing a step. The app never claims to know the live position.
- Phase 3 option: step counter and compass adjust prompts, and QR checkpoints reset `currentNodeId`.

## 4. State management

One object and one render function:

```js
state = {
  map, currentNodeId, destinationId,
  route: [], stepIndex: 0,
  stepFree: false, language: "hi-IN",
  screenReaderMode: false,
  listening: false, speaking: false,
  guardRequestId: null
}
```

Every change goes through `update(partial)`, which re-renders the UI and logs the change. No hidden globals.

## 5. File structure

```
voicepath-ai/
  index.html            main app UI, Start button
  admin.html            map editor
  guard.html            guard dashboard (Phase 2)
  README.md             run instructions, limitations, safety statement
  css/
    style.css           high contrast, large controls
  data/
    map.json            demo map
  js/
    app.js              wiring, event handlers
    state.js            single state object and update helper
    mapLoader.js        load, merge localStorage edits, version check
    mapValidator.js     validation rules
    router.js           Dijkstra with blocked / stepFree filters
    directions.js       turn detection and sentence builder
    i18n.js             Hindi and English templates
    voice.js            speech in / out, fuzzy match, commands
    ui.js               DOM render, SVG highlight, aria-live
    haptics.js          vibration patterns
    admin.js            map editor logic
    guard.js            alert send and receive
    safety.js           person detection (Phase 2)
    sensors.js          steps and heading (Phase 3)
    qr.js               QR checkpoint (Phase 3)
  tests/
    router.test.js
    directions.test.js
    fuzzy.test.js
    mapValidator.test.js
  sw.js                 service worker (Phase 3)
```

## 6. Hosting

`getUserMedia`, sensors and service workers need HTTPS (localhost is fine). Host the demo on HTTPS, for example GitHub Pages or Netlify, and test on a real phone before the demo.
