/**
 * VoicePath AI: Haptic Feedback Manager
 * Vibration patterns for non-visual direction confirmations on Android Chrome.
 * Silently skips if unsupported on platform (e.g. iOS Safari).
 */

const PATTERNS = {
  left: [120, 80, 120],           // Two short vibrations
  right: [350],                   // One long vibration
  straight: [100],                // One short vibration
  uturn: [200, 100, 200, 100, 200], // Three medium vibrations
  stairs: [80, 60, 80, 60, 80],   // Rapid triple warning
  arrive: [400, 150, 400],        // Long, pause, long
  personAlert: [50, 50, 50, 50, 50, 50], // Rapid burst
  torchToggle: [80, 50, 80],              // Double gentle pulse
  click: [40]                     // Subtle tactile click
};

/**
 * Triggers vibration pattern safely.
 * @param {keyof typeof PATTERNS} patternName
 */
export function triggerHaptic(patternName) {
  const pattern = PATTERNS[patternName] || [60];

  // Native Android bridge support
  if (typeof window !== "undefined" && window.AndroidNative && typeof window.AndroidNative.vibrate === "function") {
    try {
      window.AndroidNative.vibrate(pattern[0] || 60);
      return;
    } catch (e) {}
  }

  if (typeof window === "undefined" || !("vibrate" in navigator)) {
    return; // Unsupported, ignore silently
  }

  try {
    navigator.vibrate(pattern);
  } catch (err) {
    // Vibration blocked or denied, ignore
  }
}
