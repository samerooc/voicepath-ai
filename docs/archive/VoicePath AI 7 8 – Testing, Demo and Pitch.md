# VoicePath AI: Testing, Demo and Pitch

Part 7 of 8 · Version 1.0 · 22 Oct 2026

Context: this document covers how to test VoicePath AI, how to run the demo in front of judges, and what to say. Use it in the last two hours of the hackathon.

## 1. Unit tests (`/tests`)

| File | What it checks |
| --- | --- |
| `router.test.js` | Shortest route is correct, blocked edge skipped, step-free skips stairs, disconnected graph returns `null`, same start and end |
| `directions.test.js` | Left, right, straight, U-turn, merged straight segments, stairs warning, missing landmark |
| `fuzzy.test.js` | "lib", "libary", "computer lab", "comp lab", Devanagari alias, two close matches |
| `mapValidator.test.js` | Missing node, duplicate id, unreachable node, no exit, bad `dist` |

Tests must run with a simple command (for example `node --test` or opening a `tests.html` page) and need no build step.

## 2. Manual acceptance tests

| # | Test | Pass condition |
| --- | --- | --- |
| 1 | Open the app and press Start | Welcome message is spoken |
| 2 | Say "Library le chalo" | Confirmation asked, route highlighted, first instruction spoken |
| 3 | Say "next" repeatedly | Each step spoken once, arrival announced once |
| 4 | Block a corridor on the active route | Speech cancelled, new route spoken, map updated within 1 second |
| 5 | Turn step-free on | Route contains no stairs edge |
| 6 | Block every route | Clear "Route nahi mila" message and help-point option |
| 7 | Voice recognition fails or mic denied | Buttons and text input still complete the task |
| 8 | Keyboard only | Every action reachable, focus visible |
| 9 | Screen reader on (NVDA or TalkBack) | Instructions read once, labels correct |
| 10 | Admin edit then reload | Change persists, validator passes |
| 11 | Call guard | Guard page shows alert with last node, acknowledgement spoken |
| 12 | Person detection (if built) | Alert for a close person, no spam, no frames stored |
| 13 | Network off | Navigation still works |
| 14 | Real Android phone, Chrome | Full flow works, haptics fire |
| 15 | Noisy environment | Fallback controls usable |

## 3. Last two hours checklist

**Hour 7**

- Run all unit tests.
- Run acceptance tests 1 to 10 on a real phone and a laptop.
- Fix only blocking bugs. Stop adding features.
- Write `README.md` and `KNOWN_ISSUES.md`.

**Hour 8**

- Rehearse the demo 3 to 4 times with a timer.
- Record a backup screen video of the full flow.
- Check speaker volume, microphone, browser (Chrome), HTTPS link, battery, charger.
- Prepare a printed or open copy of the pitch and judge Q and A.

## 4. Demo script (about 3 minutes)

1. Press Start. The welcome message plays.
2. Say "Take me to the library" (or "Library le chalo"). Confirm. The route is highlighted and the first instruction is spoken.
3. Say "next" twice to show step-by-step guidance and landmarks.
4. Block a corridor on the route. The app reroutes and speaks new directions.
5. Turn on step-free mode. The stairs route disappears.
6. Say "where am I" and "repeat".
7. Press Call guard and show the alert on the guard page (if built).
8. Open the admin page, rename a room or block another corridor, and show that the app adapts without code changes.

**Demo-day risks and fixes**

| Risk | Fix |
| --- | --- |
| Venue internet is slow or down | Use the backup video, keep button controls |
| Speech recognition fails in noise | Speak close to the mic, use destination buttons |
| Speaker too quiet | Check volume before starting |
| Browser asks for permissions mid-demo | Grant mic and camera permission before the judges arrive |
| Judge asks for something unexpected | Show the button fallback and answer honestly |

## 5. Pitch (30 seconds)

> Our project, VoicePath AI, is an accessibility-focused indoor navigation assistant for visually impaired people. GPS is not enough for rooms and corridors inside buildings, so we combine a digital indoor map, voice commands, graph-based pathfinding and spoken landmark-based directions. When a corridor is blocked or the map changes, the app reroutes automatically, and staff can update the map without coding. For safety we keep a human in the loop with a one-button guard alert. Our prototype uses a simulated start location. QR checkpoints and sensor fusion are our next step. It supports a white cane or guide dog and does not replace them.

## 6. Likely judge questions and answers

| Question | Answer |
| --- | --- |
| How do you know the user's location? | The prototype uses a simulated start and step-by-step confirmation. Next steps are QR checkpoints, then sensor fusion. We do not claim exact positioning. |
| What if the map is wrong or outdated? | Map version and verification dates, an admin editor, and a Report problem option that blocks the edge immediately. |
| Is it safe? | It is supplementary. Safety alerts run on the device, we never claim obstacle-free paths, and a guard can be called. |
| Have you tested with blind users? | Not yet. We tested with a screen reader and keyboard. A pilot with blind students is our first next step. |
| Why not Google Maps indoor or paid SDKs? | Those need paid setup or only cover large venues. We target colleges and hospitals with a low-cost map and a phone. |
| What happens without internet? | Navigation and person alerts work on the device. Cloud features are optional. |
| What about privacy? | No images are stored, camera is off by default, and data is sent only after a user action. |
| What is the technology? | HTML, CSS, JavaScript, Web Speech API, SpeechSynthesis, SVG, Dijkstra's algorithm. Optional: MediaPipe or TensorFlow.js. |
| What is new here? | Voice-first design, landmark-based instructions, live rerouting, admin-editable map, and a human-help fallback in one low-cost web app. |

## 7. Slide outline (if the hackathon needs slides)

1. Title and tagline
2. Problem
3. Solution in one line
4. Live demo flow
5. How it works (layers)
6. Safety and honesty (limitations and human help)
7. Accessibility and privacy
8. What is next (QR, sensors, pilot with users)
9. Team and thanks

## 8. Honesty rules for all presentations

- Say "simulated start location" exactly as it is.
- Do not say "exact", "real-time location", "obstacle detection" or "safe" unless it is implemented and tested.
- Mention that it is supplementary to a white cane or guide dog.
- Show limitations yourself before judges ask. It makes the project look mature.
