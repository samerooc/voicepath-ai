# VoicePath AI: Safety Layer and Human Help (Guard) Spec

Part 5 of 8 · Version 1.0 · 22 Oct 2026

Context: these features are Phase 2 to Phase 3. They start only after the MUST list (Doc 1) passes all acceptance tests. They add a camera-based safety alert, optional live AI conversation, and a human-help path.

## 1. Design principles

1. Safety alerts run **on the device** and never wait for the internet or an AI response.
2. AI conversation is helpful but **never the source of navigation or safety facts**. Facts come from map data and device detection.
3. A human can always be called. The AI is not left alone with the user.
4. The app never claims to see obstacles, doors or gates reliably.
5. Privacy first: no images stored, consent before sending anything.

## 2. Person detection (Phase 2, experimental)

**What it does:** warns the user that a person is close in front of the camera.

**Tech:** rear camera through `getUserMedia({ video: { facingMode: "environment" } })` (HTTPS or localhost), with MediaPipe Tasks object detector or TensorFlow.js COCO-SSD. Use the `person` class only.

**Rules**

- Run detection 2 to 5 times per second, not every frame.
- Alert only when the person is large in frame (close) and near the centre.
- Alert style: short beep or vibration plus "Saamne koi hai." Do not announce every person.
- Debounce: not more than one alert every 5 seconds per situation.
- When a person is detected and the user may want help, **ask first**: "Saamne koi hai. Kya main madad maangun?" Continue only on a clear yes.
- UI text: "Experimental. May miss people." A camera-on indicator and an on/off control are always visible and available by voice.
- The camera is off by default and turns on only after the user enables it.

**Not included:** gate open/closed detection, floor hazards, stairs detection, door state. These are future scope because reliability is not proven.

## 3. Why not gate and obstacle detection now

- Standard models have no reliable "gate" or "door state" class.
- Vision-language models can sound confident and be wrong.
- A wrong "gate is open" or "path is clear" can cause harm.
- Safer alternative: keep gate status as **map data** (`blocked` with `reason`), updated by staff, and ask a guard when unsure.

## 4. Human help: guard or volunteer (Phase 2)

**Help points in the map:** reception, security desk, guard room as `help_point` nodes. Command: "nearest help" routes there.

**Call guard flow**

1. User presses Call guard or says "guard ko bulao".
2. App confirms: "Guard ko alert bhej raha hoon. Theek hai?" (consent).
3. App sends `{ userLabel, lastNodeId, nodeName, time, requestId }` to the guard dashboard.
4. Guard dashboard (`guard.html`) shows a list of alerts with a loud sound, the last known place and an **Acknowledge** button.
5. On acknowledgement the user hears: "Guard aa rahe hain."
6. If nobody acknowledges within 60 seconds: "Koi jawab nahi aaya. Reception ke paas chaliye ya emergency number dial kijiye," and offer the route to the nearest help point.
7. Disable the button after the first press until acknowledged or timed out (prevents duplicates).

**Implementation options**

| Option | Use for | Notes |
| --- | --- | --- |
| `BroadcastChannel` mock | Single-device or same-browser demo | No backend, quickest |
| Firebase Firestore (realtime) | Two real devices | Needs a Firebase project and rules |
| Firebase Cloud Messaging | Push to guard phone | More setup, Phase 3 |

Data minimum: no names required, a label like "User 1" is enough.

## 5. Live AI conversation (Phase 3, optional)

- Use a realtime voice API (Gemini Live or OpenAI Realtime). Check current docs, pricing and Hindi support before building.
- Send audio in small chunks over WebSocket or WebRTC. Send camera frames at about 1 to 2 per second only if the user enabled camera and agreed.
- Allow barge-in: when the user speaks, stop the AI speech.
- Allowed topics: "Mere saamne kya hai?" (description with a disclaimer), general questions, help finding words.
- Not allowed: replacing route instructions, declaring a path safe, or giving emergency decisions.
- Add a standing line in the system prompt: "You are an assistant. Never say that a path is safe or clear. Suggest calling a guard when unsure."
- If the network drops: say "Internet nahi hai, basic mode chalu," and continue with offline navigation.

## 6. Latency plan

| Part | Approach |
| --- | --- |
| Safety alerts | On device, low frame rate, no network |
| Navigation | Local, instant |
| Voice AI | Stream small audio chunks, barge-in, short answers |
| Camera to cloud | Low frame rate, small resolution |
| Guard alert | Realtime database listener, push later |

## 7. Privacy and consent

- Do not save or upload images. Process frames in memory.
- Camera and location-like data (last node) leave the device only after a user action (button or confirmed voice command).
- Show a camera-on indicator and a privacy note in the README and app.
- Be aware of India's DPDP Act when deploying for real users, and write a privacy policy.

## 8. Problems and fixes

| Problem | Fix |
| --- | --- |
| False positive person alerts | Size and centre thresholds, debounce |
| Missed person | Say "experimental" in UI and pitch, keep white cane advice |
| Phone not facing forward | Document lanyard or chest mount, show camera-off state |
| Battery and heat | Low frame rate, camera only when enabled |
| Guard busy | Escalation after 60 seconds, help-point route, emergency number |
| Poor network | Safety and navigation offline, cloud features optional |
| AI hallucination | Facts only from map and detectors, human option always visible |
| User annoyed by alerts | Alert only close and centred people, adjustable sensitivity |

## 9. Acceptance tests

1. Camera off by default. Turning it on shows an indicator.
2. A close person in front triggers one alert, no spam.
3. A person far away or at the side triggers nothing.
4. No image data in `localStorage`, network requests or downloads.
5. Call guard: confirmation, alert appears on the guard page with last node, acknowledgement is spoken to the user.
6. No acknowledgement for 60 seconds: escalation message and help-point route.
7. Network off: navigation and person alert still work.
