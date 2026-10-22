# VoicePath AI 02: Architecture and Modules

Part 2 of 8 of the VoicePath AI build pack · v1.0 · 22 Oct 2026

## 1. Architecture in four layers

```
Layer 1  SAFETY (on-device, works offline)
         Camera -> person detection -> beep / vibration / short alert

Layer 2  NAVIGATION (on-device)
         map.json -> Dijkstra -> direction generator -> spoken steps
         optional: step counter + compass + QR reset

Layer 3  CONVERSATION (cloud, optional)
         Mic <-> realtime voice AI  (never used for safety decisions)

Layer 4  HUMAN HELP
         "Call guard" -> guard dashboard gets name + last node
```

**Golden rule:** safety alerts must never depend on the internet or on an AI model response. Directions come from map data, never from an AI guess.

## 2. Data flow (MVP)

```
User voice -> SpeechRecognition -> Fuzzy matcher -> Destination node
                                                      |
map.json -> Graph -> Dijkstra (skip blocked / stairs) -> Route (node list)
                                                      |
                              Direction generator (angle + landmark)
                                                      |
           SpeechSynthesis (voice) + Vibration + SVG highlight + aria-live text
```

Everything runs in the browser. One `state` object is the single source of truth and every change re-renders the UI.

## 3. Platform decision: web app first

| Option | Pros | Cons | Decision |
| --- | --- | --- | --- |
| Web app (PWA) | No install, fast to build, runs on laptop for demo, easy to host | No barometer, WiFi scan or foreground service, iPhone limits | **Phase 1 to 4** |
| Native Android (Kotlin) | Full sensors, CameraX, offline speech, foreground service | Slower to build, needs Kotlin skill and a device | Future scope, or if the team already knows Kotlin |

The web app is the safe choice for an 8-hour hackathon. The data model (`map.json`) and algorithms are platform-independent, so they can be reused in an Android app later.

## 4. Modules: what to use and what not to use

| Module | Use | Why | Do NOT use |
| --- | --- | --- | --- |
| Routing | Own Dijkstra in `router.js` | Tiny graph, full control, no dependency | A graph library or a paid routing API |
| Map display | Inline SVG | Easy highlight and click | Canvas or image-only map (no data) |
| Voice output | `window.speechSynthesis` | Free, works offline in most browsers | Cloud TTS for the MVP |
| Voice input | `webkitSpeechRecognition` / `SpeechRecognition` | Free, no key | Always-on listening loop without user action |
| Fuzzy search | Own Levenshtein and token overlap | Small data set | Large NLP libraries |
| Storage | `localStorage` for edited map and settings | Simple | IndexedDB or backend for the MVP |
| Haptics | `navigator.vibrate` | Android Chrome only | Relying on it for iPhone |
| Person detection | MediaPipe Tasks or TensorFlow.js COCO-SSD, `person` class only | Runs in browser, no upload | Cloud vision API for safety alerts |
| QR checkpoints | `html5-qrcode` or `jsQR` | Reliable and small | Custom QR decoding |
| Guard alert | Firebase Firestore, or a mock with `BroadcastChannel` | Fast setup | A custom server |
| Realtime voice | Gemini Live API or OpenAI Realtime API | Low-latency conversation | Using it as the only source of directions |
| Offline | Service worker | Cache app and map | Caching without a map version check |
| Hosting | GitHub Pages or Netlify (HTTPS) | Camera, mic and sensors need a secure context | Plain HTTP on a public URL |

Check current documentation, limits and pricing for any cloud API before using it. These change quickly.

## 5. Dependency rules

- Phase 1 and 2 use **no npm packages and no build step**: plain HTML, CSS and ES modules.
- Third-party libraries (MediaPipe, TensorFlow.js, html5-qrcode, Firebase) are added only in later phases, loaded from a CDN with a pinned version.
- Each library must have a fallback: if it fails to load, the core navigation still works.
- Do not load anything on page start that is not needed for navigation.

## 6. Security and privacy basics

- Camera frames are processed in memory only. Never save or upload them.
- Location (last node) is sent to the guard dashboard only when the user presses Call guard or says the command.
- The admin page is PIN protected for the demo. A real deployment needs proper authentication.
- No analytics or third-party trackers.
- Add a short privacy note in the README and in the app footer. Users in India should be informed in line with the DPDP Act principles (consent and purpose limitation).

## 7. Performance targets

| Item | Target |
| --- | --- |
| Route calculation | Under 50 ms for the demo map |
| Reroute after block | Under 1 second including new speech |
| Time from "Start" to first spoken line | Under 2 seconds |
| Person detection loop | 2 to 5 frames per second |
| App size (Phases 1 and 2) | Under 1 MB without libraries |

## 8. Offline behaviour

- Phase 1 and 2 need internet only for speech recognition on Chrome. TTS and routing work offline.
- If recognition is unavailable, the app says so once and switches to buttons and text input.
- Phase 3 service worker caches the app and `map.json`, and checks the map `version` when online.
