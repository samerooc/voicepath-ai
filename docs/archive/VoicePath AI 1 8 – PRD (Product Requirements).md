# VoicePath AI: Product Requirements (PRD)

Part 1 of 8 · Version 1.0 · 22 Oct 2026 · 8-hour hackathon build · Author: Rana

Companion docs: 2 Technical Architecture, 3 Voice and Accessibility, 4 Map Changes and Admin, 5 Safety and Guard Help, 6 Problems and Bug Prevention, 7 Testing, Demo and Pitch, 8 Antigravity Prompts.

## 1. Product overview

**Name:** VoicePath AI **Tagline:** Navigate by Voice, Move with Confidence. **One line:** The user says where they want to go. The app finds a safe route on a pre-built indoor map and speaks short, landmark-based instructions one step at a time.

**Target buildings:** college, hospital, office, mall. Hackathon demo: one college floor with 8 to 10 rooms.

**Important statement (must appear in README and app):** VoicePath AI is supplementary assistance. It is not a replacement for a white cane, guide dog or human help.

## 2. Problem statement

Visually impaired people struggle to navigate unfamiliar buildings:

- GPS does not work reliably indoors at room level.
- They often must ask strangers for directions every time.
- Stairs, blocked corridors and changed layouts make routes unsafe or confusing.
- Existing indoor navigation products are paid, need installed hardware, or are not built voice-first.

**Goal:** make independent indoor navigation more accessible and affordable using a phone, a digital map, voice and a human-help fallback.

## 3. Users and scenarios

| User | Scenario |
| --- | --- |
| Blind or low-vision student | Enters college, says "Library le chalo", follows spoken steps |
| Wheelchair or step-free user | Turns on step-free mode, route avoids stairs |
| Guard or reception staff | Gets a "help needed" alert with the user's last known place |
| Building admin | Blocks a corridor for repair or renames a room without coding |
| Judge or sighted helper | Watches the map and route on screen during the demo |

## 4. Goals and non-goals

**Goals**

1. Working voice-first navigation on a demo map.
2. Correct left / right / straight instructions with landmarks.
3. Automatic rerouting when a corridor is blocked or the map changes.
4. Fully usable by keyboard, screen reader and large buttons.
5. Honest about limitations.

**Non-goals for the hackathon**

- Exact real-time indoor positioning.
- Reliable obstacle avoidance or gate open/closed detection.
- Replacing a white cane, guide dog or human assistance.
- Multi-building or outdoor navigation.
- User accounts, payments, analytics.

## 5. Scope (MoSCoW)

### MUST (Phase 1, hours 1 to 6)

1. Demo map as JSON graph plus SVG display.
2. Dijkstra routing that skips blocked edges and optionally non-step-free edges.
3. Turn-by-turn instruction generator with landmarks.
4. Voice output (SpeechSynthesis), one instruction at a time.
5. Voice input for destination with fuzzy match and confirmation, plus button list fallback.
6. Commands: next, repeat, where am I, stop, nearest exit.
7. Block / unblock corridor button and automatic reroute.
8. Step-free toggle.
9. Accessibility pass (keyboard, aria-live, contrast).

### SHOULD (hours 6 to 7)

10. Admin map editor with validation and export.
11. Hindi and English (`hi-IN`, `en-IN`).
12. Haptic patterns (Android Chrome only).
13. "Call guard" button with a guard dashboard page.
14. Person detection with beep or vibration (experimental).

### COULD (only if everything above works)

15. QR checkpoint scan to reset position.
16. Step counter and compass heading.
17. Realtime voice AI conversation.
18. Offline support with a service worker.

### WON'T (future scope, say it in the pitch)

- Gate or door open/closed detection from camera.
- Sensor fusion with BLE beacons.
- Native Android app with foreground service.
- WebRTC live video help.
- Multi-floor lift logic with barometer.

## 6. System layers

```
Layer 1  SAFETY (on-device, works offline)
         Camera -> person detection -> beep / vibration / short alert

Layer 2  NAVIGATION (on-device)
         map.json -> Dijkstra -> direction generator -> spoken steps

Layer 3  CONVERSATION (cloud, optional)
         Mic <-> realtime voice AI (never used for safety decisions)

Layer 4  HUMAN HELP
         "Call guard" -> guard dashboard gets name + last node
```

**Rule:** safety alerts must never depend on the internet or on an AI model response.

## 7. Success criteria

- A judge can say "Library" and hear a correct route within 10 seconds.
- Blocking a corridor produces a new spoken route within 1 second.
- The whole app works with keyboard only and with a screen reader.
- The pitch contains no claim that is not implemented.

## 8. Timeline (8 hours)

| Hour | Work |
| --- | --- |
| 1 | Project setup, demo `map.json`, SVG render, validator |
| 2 to 3 | Router, direction generator, unit tests |
| 4 | Speech output, command handling, UI state |
| 5 | Speech input, fuzzy match, confirmation flow |
| 6 | Block corridor, reroute, step-free, accessibility pass |
| 7 | Admin editor, Call guard, optional person detection, bug fixing |
| 8 | Rehearsal, backup video, README, pitch |

If behind schedule, drop in this order: person detection, guard dashboard, haptics, admin editor. Never drop the accessibility pass.

## 9. Future scope

BLE beacons and sensor fusion, native Android app with foreground service, multi-floor and lift support, on-device obstacle and door-state models trained on real data, WebRTC live video help, crowdsourced closure reports, caregiver mode, smart cane and wearable integration, and pilot testing with blind users.
