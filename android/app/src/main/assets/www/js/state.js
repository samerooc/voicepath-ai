/**
 * VoicePath AI: Central State Management
 * Single source of truth. Every change goes through update(partial).
 */

export const state = {
  map: null,
  currentNodeId: "entrance",
  destinationId: null,
  route: [],         // Array of node IDs e.g. ["entrance", "j1", "j3", "library"]
  directions: [],    // Array of direction objects { turn, text, landmark, dist, steps, warning }
  stepIndex: 0,
  stepFree: false,
  language: "hi-IN", // "hi-IN" or "en-IN"
  screenReaderMode: false,
  speechRate: 1.0,
  listening: false,
  speaking: false,
  awaitingConfirmation: null, // { candidateId, candidateName }
  guardRequestId: null,
  guardStatus: null, // "sent", "acknowledged", "timeout"
  cameraActive: false,
  personDetected: false,
  torchActive: false,
  isDarkEnvironment: false,
  compassHeading: null,
  stepCount: 0,
  lastError: null
};

const listeners = new Set();

/**
 * Register a listener callback to run whenever state updates.
 * @param {Function} fn (state) => void
 * @returns {Function} unsubscribe function
 */
export function subscribe(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

/**
 * Update state with partial properties and notify listeners.
 * @param {Object} partial
 */
export function update(partial) {
  Object.assign(state, partial);
  for (const listener of listeners) {
    try {
      listener(state);
    } catch (err) {
      console.error("[State Listener Error]", err);
    }
  }
}
