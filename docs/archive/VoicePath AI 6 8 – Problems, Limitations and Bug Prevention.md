# VoicePath AI: Problems, Limitations and Bug Prevention

Part 6 of 8 · Version 1.0 · 22 Oct 2026

Context: this document lists every real-world problem and known technical pitfall for VoicePath AI, with a solution for each. Antigravity should write a test or guard for every bug in section 3.

## 1. Problems, limitations and solutions

| # | Problem or limitation | Impact | Solution in this project |
| --- | --- | --- | --- |
| 1 | No exact indoor position | Wrong turn instruction | Simulated start, step-by-step "Next", QR reset in Phase 3, no exact-location claims |
| 2 | Compass drift near metal and lifts | Wrong left / right | Landmarks in sentences, user confirmation, QR recalibration |
| 3 | Step counter drift | Position error grows | Reset at each junction or QR |
| 4 | Speech recognition fails in noise or with accents | Cannot set destination | Fuzzy match, confirmation, button list, text input |
| 5 | Web Speech API mainly in Chrome / Edge and needs internet | Demo failure | Demo on Chrome, fallback controls, backup video |
| 6 | Browser blocks speech / mic without a click | App silent | Big Start button |
| 7 | Map outdated | Unsafe route | Version and date, Report problem, admin editor, `lastVerified` |
| 8 | Graph broken by a bad edit | Crash | Validator on load and save, undo |
| 9 | All routes blocked | No route | Clear message and nearest help point |
| 10 | Map changes mid-route | Stale instructions | Recompute from current node, cancel speech |
| 11 | Camera cannot reliably see obstacles, doors or gates | False sense of safety | Person alert only, labelled experimental, no gate detection claim |
| 12 | AI hallucination in live conversation | Wrong advice | Optional, facts only from map and detectors, human option |
| 13 | Phone position (pocket or hand) | Camera and sensors useless | Lanyard or chest mount recommended, document in README |
| 14 | Battery and heat | Short use time | Low frame rate, camera only when enabled |
| 15 | Privacy of people in view and of the user's location | Legal and trust issues | No image storage, consent before sending, indicator, privacy note (DPDP Act awareness) |
| 16 | Guard may not respond | User stuck | 60 second escalation, help-point route, emergency number |
| 17 | Poor network indoors | Cloud features fail | Safety and navigation offline, cloud only optional |
| 18 | iPhone limits (no vibrate API, motion permission prompt) | Feature gap | Android Chrome for haptics, iOS permission flow, document in README |
| 19 | Not tested with real blind users | Unknown usability | Screen reader test now, plan a pilot with blind students, say this honestly |
| 20 | Cost of realtime AI APIs | Budget | Phase 3 only, short sessions, check current pricing |
| 21 | Instructions in metres are useless to blind users | Confusing directions | Landmark-based sentences, approximate steps only |
| 22 | Team adds too many features | Nothing finishes | MUST list and phase gates (Doc 8) |

## 2. What NOT to do

- Do not hard-code the map in JavaScript.
- Do not start speech or microphone on page load.
- Do not use an AI model to decide safety or directions.
- Do not write "exact location", "obstacle-free", "safe" or "guaranteed" anywhere in code, UI, README or pitch.
- Do not store or upload camera frames.
- Do not make the SVG the only way to use the app.
- Do not add dependencies that need a build step.
- Do not spend hours on camera features before the MUST list passes.
- Do not edit `map.json` by hand during the demo. Use the admin page or the block button.
- Do not skip the accessibility pass. An inaccessible accessibility app is the worst demo.

## 3. Known bugs and pitfalls to prevent

### Navigation logic

1. **Left and right inverted.** SVG y increases downward. Verify the cross-product sign on four known layouts (left, right, straight, U-turn).
2. **Edges stored in one direction only**, so the return route fails. The loader must create both directions.
3. **Blocked start or destination node** makes Dijkstra return nothing and may crash the app. Handle `null` route.
4. **Destination equals current node.** Handle gracefully.
5. **`stepIndex` out of range** after "next" at the end. Clamp it and announce arrival only once.
6. **Floating-point or string distances** from the editor. Parse as integers.
7. **Stale state after map edit.** Recompute route, step index and SVG highlight in one `update()` call.
8. **`localStorage` map overrides a newer `map.json`.** Compare `version` and ask admin.

### Speech and voice

9. **Old speech continues after reroute.** Always call `speechSynthesis.cancel()` first.
10. **Chrome TTS stops after about 15 seconds** for long text. Split into short sentences.
11. **`getVoices()` returns an empty list on first call.** Wait for the `voiceschanged` event.
12. **Recognition ends by itself after silence.** Restart only on user action and handle `onend` and `onerror`.
13. **`hi-IN` recognition returns Devanagari**, so Roman-only aliases fail. Keep both scripts in aliases.
14. **Screen reader and app speech overlap.** Provide screen reader mode.
15. **Autoplay blocked.** Nothing speaks before the Start tap.

### Device and browser

16. **Camera or microphone permission denied** leaves a blank screen. Show spoken and written fallback.
17. **`getUserMedia` and sensors need HTTPS** (localhost is fine). Host the demo on HTTPS.
18. **iOS `DeviceOrientation` needs `requestPermission()`** after a user tap.
19. **Compass heading differs** (`webkitCompassHeading` on iOS, `alpha` on Android). Normalise.
20. **Screen sleeps during navigation.** Use `navigator.wakeLock`.
21. **Background tab pauses speech and sensors.** Warn the user to keep the app open.
22. **`navigator.vibrate` missing on iPhone.** Check support, skip silently.

### Safety and help

23. **Person alert spam** on every frame. Debounce.
24. **Guard alert sent twice** on double tap. Disable the button until acknowledged or timed out.
25. **Camera frames accidentally stored** in state or storage. Never persist frames.

### General

26. **Unhandled promise rejections** in async speech and camera code. Wrap in try / catch and show a clear message.
27. **Hard-coded language strings in logic files.** Keep all text in `i18n.js`.
28. **Demo-day failure** because of venue internet or noise. Prepare a recorded backup video and button-only flow.

## 4. Bug-hunting workflow for Antigravity

1. After each phase run all tests in `/tests`.
2. Add a regression test for every bug fixed.
3. Test on a real phone (Chrome on Android) and on desktop Chrome.
4. Test with the network off for navigation and person alerts.
5. Test with a screen reader.
6. Keep a `KNOWN_ISSUES.md` file listing anything unfixed, and mention it in the README. Be honest about it in the pitch.
