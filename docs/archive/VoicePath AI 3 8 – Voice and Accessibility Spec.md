# VoicePath AI: Voice and Accessibility Spec

Part 3 of 8 · Version 1.0 · 22 Oct 2026

Context: VoicePath AI is a voice-first indoor navigation web app for blind and low-vision users. This spec covers voice input and output, commands, UI and accessibility rules.

## 1. Voice output (SpeechSynthesis)

- A large **Start** button is mandatory. Browsers block speech and microphone without a user gesture.
- Speak **one instruction at a time**. Wait for "next" or the Next button.
- Call `speechSynthesis.cancel()` before every new utterance and on every reroute.
- Split long text into sentences under about 200 characters (prevents a known Chrome cut-off).
- Load voices through the `voiceschanged` event before choosing `hi-IN` or `en-IN`.
- Keep sentences short, with landmarks instead of metres: "Seedha chalo jab tak water cooler na aaye, phir left lo."
- Offer speech rate control (slow, normal, fast), because users differ.

## 2. Voice input (SpeechRecognition)

- Use a push-to-talk style: one listen per button press or per prompt.
- Language setting: `hi-IN` or `en-IN`, switchable by button and by command.
- Handle `no-speech`, `not-allowed`, `network`, `aborted` errors: tell the user in speech and text, then fall back to buttons and text input.
- Always **confirm** a destination before routing: "Kya aap Library keh rahe hain? Haan ya nahi bolo."
- Fuzzy matching rules are in Doc 2, section 3.3.
- Hindi recognition may return Devanagari, so aliases must include both Roman and Devanagari.

## 3. Commands

| Intent | English | Hindi / Hinglish |
| --- | --- | --- |
| Next step | next | aage, agla |
| Repeat | repeat | dobara, phir se |
| Where am I | where am I | main kahan hoon |
| Stop | stop | ruko, band karo |
| Nearest exit | nearest exit | nikasi / exit kahan hai |
| Nearest help point | nearest help | madad kahan hai |
| Call guard | call guard | guard ko bulao |
| Step-free on / off | step free on / off | seedhi nahi, lift se |
| Change language | Hindi / English | Hindi / English bolo |

Unknown command: "Samajh nahi aaya. Next, repeat ya stop bol sakte hain."

## 4. Interaction flow

```
Start pressed -> welcome message -> "Kahan jaana hai?"
-> user speaks destination -> fuzzy match -> confirm
-> route calculated -> first instruction spoken
-> user says "next" -> next instruction ... -> arrival announced once
```

If the route changes (block, map update): cancel speech, say "Raasta badal gaya hai, naya route bata raha hoon," then read the new first instruction.

## 5. Screen reader mode

Problem: a screen reader and the app's own speech can talk at the same time.

- Add a setting **"I use a screen reader"** (also detect on first run by asking).
- When on, the app does not call SpeechSynthesis. It writes instructions to an `aria-live="polite"` region and the screen reader reads them.
- When off, the same region still updates (for accessibility tools) but it is visually hidden or marked so it does not cause duplicate speech.

## 6. UI requirements

- Minimum touch target 48 px, base font 18 px or larger, high contrast (WCAG AA), no colour-only meaning.
- Whole app works with keyboard only (Tab, Enter, Space, Esc), with a visible focus ring and a logical focus order.
- Every control has an `aria-label`.
- Main screen: large Start, destination list, big Next / Repeat / Stop, Step-free toggle, Call guard, language toggle, status line.
- The SVG map is for sighted helpers and judges. It has a text description and is `aria-hidden` in the blind-user flow.
- Keep the screen awake during navigation with `navigator.wakeLock` (with fallback message if unsupported).
- Warn the user to keep the app in the foreground, because background tabs pause speech and sensors.

## 7. Haptics

`navigator.vibrate` works on Android Chrome only (not iPhone). Patterns:

| Event | Pattern |
| --- | --- |
| Turn left | two short |
| Turn right | one long |
| Go straight | one short |
| Stairs ahead | three short |
| Arrived | long, pause, long |
| Person alert | rapid pulses |

Haptics support speech, they never replace it. If unsupported, skip silently.

## 8. Language and i18n

- All spoken text lives in `i18n.js` as templates per language with placeholders (`{landmark}`, `{turn}`, `{steps}`).
- Hindi in Roman script (Hinglish) for speech works with most `hi-IN` voices, but test the voice on the demo phone. If it sounds bad, switch to Devanagari text for Hindi speech.
- Never concatenate raw strings in logic files.

## 9. Voice and accessibility test checklist

1. Press Start with eyes closed: welcome is heard.
2. Say "Library", "lib", "pustakalay": all match and ask confirmation.
3. Say nonsense: friendly error and options.
4. Deny microphone permission: app still works with buttons.
5. Block a corridor mid-route: old speech stops, new route is spoken.
6. Keyboard only: all actions reachable.
7. NVDA or TalkBack on: instructions read once, labels correct.
8. Chrome TTS with a long sentence: no cut-off.
9. Test in a noisy room: fallback controls usable.
