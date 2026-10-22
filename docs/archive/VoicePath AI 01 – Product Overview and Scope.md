# VoicePath AI 01: Product Overview and Scope

Part 1 of 8 of the VoicePath AI build pack · v1.0 · 22 Oct 2026 · 8-hour hackathon · Author: Rana

**Build pack:** 01 Overview and Scope · 02 Architecture and Modules · 03 Map Data, Routing and Directions · 04 Voice, UI and Accessibility · 05 Safety Layer and Human Help · 06 Antigravity Rules and File Structure · 07 Problems, Limitations and Bugs · 08 Testing, Timeline, Demo and Pitch

## 1. Product overview

**Name:** VoicePath AI **Tagline:** Navigate by Voice, Move with Confidence. **One line:** The user says where they want to go. The app finds a safe route on a pre-built indoor map and speaks short, landmark-based instructions one step at a time.

**Target buildings:** college, hospital, office, mall. Hackathon demo: one college floor with 8 to 10 rooms.

**Core idea:** treat the building as a graph (rooms and junctions are nodes, corridors are edges), run Dijkstra's algorithm, and turn the route into spoken directions. When a corridor is blocked or the map changes, reroute automatically. When the app is unsure or the user needs help, bring a human into the loop.

## 2. Problem statement

Visually impaired people struggle to navigate unfamiliar buildings:

- GPS does not work reliably indoors at room level.
- They often have to ask strangers for directions every time.
- Stairs, blocked corridors and changed layouts make routes unsafe or confusing.
- Existing indoor navigation products are paid, need installed hardware, or are not built for voice-first use.

**Goal:** make independent indoor navigation more accessible and affordable using a phone, a digital map, voice and a human-help fallback.

## 3. Users and scenarios

| User | Scenario |
| --- | --- |
| Blind or low-vision student | Enters college, says "Library le chalo", follows spoken steps |
| Wheelchair or step-free user | Turns on step-free mode, route avoids stairs |
| Guard or reception staff | Gets a "help needed" alert with the user's last known location |
| Building admin | Blocks a corridor for repair or edits a room name without coding |
| Judge or sighted helper | Watches the map and route on screen during the demo |

## 4. Goals and non-goals

**Goals**

1. Working voice-first navigation on a demo map.
2. Correct left, right and straight instructions with landmarks.
3. Automatic rerouting when a corridor is blocked or the map changes.
4. Fully usable by keyboard, screen reader and large buttons.
5. Honest about limitations in the UI, README and pitch.

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
5. Voice input for destination (SpeechRecognition) with fuzzy match and confirmation, plus button list fallback.
6. Commands: next, repeat, where am I, stop, nearest exit.
7. Block/unblock corridor button and automatic reroute.
8. Step-free toggle.
9. Accessibility pass (keyboard, aria-live, contrast).

### SHOULD (Phase 2, hours 6 to 7)

10. Admin map editor with validation and export.
11. Hindi and English support (`hi-IN`, `en-IN`).
12. Haptic patterns (Android Chrome only).
13. "Call guard" button that sends an alert to a guard dashboard page.
14. Person detection in camera view with a short beep or vibration. Mark as experimental.

### COULD (only if everything above is done)

15. QR checkpoint scan to reset position.
16. Step counter and compass heading.
17. Realtime voice AI conversation.
18. Offline support via service worker.

### WON'T (say in pitch as future scope)

- Gate or door state detection from camera.
- Sensor fusion with BLE beacons.
- Native Android app with foreground service.
- WebRTC live video help.
- Multi-floor lift logic with barometer.

**Drop order if behind schedule:** person detection, guard dashboard, haptics, admin editor. Never drop the accessibility pass.

## 6. Success criteria

- A first-time user can reach a destination on the demo map using voice only.
- Reroute after a blocked corridor completes within 1 second and is spoken clearly.
- Every action is possible without touching the map SVG.
- The app works with a screen reader and with keyboard only.
- No UI text or pitch line claims exact location, obstacle detection or guaranteed safety.

## 7. Assumptions and constraints

- Team has 8 hours, and a demo on Chrome (desktop or Android) with a working mic and speaker.
- A demo floor plan is created by the team (real floor plan is optional).
- Start location is simulated (entrance node), with QR reset as a later step.
- No backend and no paid API for the MVP.
- The demo is run over HTTPS or localhost, because camera, microphone and sensors need a secure context.

## 8. Safety statement (use in README and UI footer)

VoicePath AI is an assistive prototype. It does not detect all obstacles, hazards or closed doors, and its position is an estimate. It is a supplement to a white cane or guide dog and never a replacement. Users should always use their own judgement and ask for human help when unsure.
