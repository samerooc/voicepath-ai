/**
 * VoicePath AI: Human-in-the-Loop Guard & Volunteer Dispatch
 * Coordinates real-time security alerts between user device and guard dashboard (guard.html).
 * Uses BroadcastChannel with localStorage event fallback.
 */

import { state, update } from "./state.js";
import { speak } from "./voice.js";
import { getTemplate } from "./i18n.js";
import { findNearestHelpPoint } from "./router.js";

const CHANNEL_NAME = "voicepath_guard_channel";
const STORAGE_ALERT_KEY = "voicepath_active_guard_alert";
const STORAGE_ACK_KEY = "voicepath_guard_ack";

let broadcastChannel = null;
let timeoutTimer = null;

if (typeof window !== "undefined" && "BroadcastChannel" in window) {
  try {
    broadcastChannel = new BroadcastChannel(CHANNEL_NAME);
  } catch (e) {
    console.warn("[Guard] BroadcastChannel failed, using storage events:", e);
  }
}

/**
 * Initializes the user-side guard listener for acknowledgements.
 * @param {Function} onAcknowledged
 */
export function initUserGuardListener(onAcknowledged) {
  function handleAck(ackData) {
    if (!state.guardRequestId || ackData.requestId !== state.guardRequestId) return;

    if (timeoutTimer) clearTimeout(timeoutTimer);
    update({ guardStatus: "acknowledged" });

    speak(getTemplate("GUARD_ACKNOWLEDGED", state.language), state.language);
    if (onAcknowledged) onAcknowledged(ackData);
  }

  if (broadcastChannel) {
    broadcastChannel.onmessage = (event) => {
      if (event.data && event.data.type === "GUARD_ACKNOWLEDGED") {
        handleAck(event.data);
      }
    };
  }

  // Cross-tab storage event fallback
  window.addEventListener("storage", (e) => {
    if (e.key === STORAGE_ACK_KEY && e.newValue) {
      try {
        const data = JSON.parse(e.newValue);
        handleAck(data);
      } catch (err) {}
    }
  });
}

/**
 * Sends a help alert to the guard dashboard.
 * @param {Object} [meta] - additional details
 * @returns {string} requestId
 */
export function sendGuardAlert(meta = {}) {
  const map = state.map;
  const currentNode = map?.nodes ? map.nodes[state.currentNodeId] : null;
  const requestId = "REQ-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 6);

  const alertPayload = {
    type: "GUARD_REQUEST",
    requestId,
    timestamp: Date.now(),
    userLabel: meta.userLabel || "Student 1",
    lastNodeId: state.currentNodeId,
    nodeName: currentNode ? currentNode.name : state.currentNodeId,
    landmark: currentNode?.landmark || "Unknown area",
    stepFreeNeeded: state.stepFree
  };

  update({
    guardRequestId: requestId,
    guardStatus: "sent"
  });

  // 1. BroadcastChannel dispatch
  if (broadcastChannel) {
    try {
      broadcastChannel.postMessage(alertPayload);
    } catch (err) {
      console.warn("[Guard] Failed posting to channel:", err);
    }
  }

  // 2. LocalStorage broadcast for different tabs/windows
  try {
    localStorage.setItem(STORAGE_ALERT_KEY, JSON.stringify(alertPayload));
  } catch (err) {}

  // Spoken confirmation to user
  speak(getTemplate("GUARD_ALERT_SENT", state.language), state.language);

  // 3. Start 60-second escalation timer
  if (timeoutTimer) clearTimeout(timeoutTimer);
  timeoutTimer = setTimeout(() => {
    if (state.guardStatus === "sent") {
      update({ guardStatus: "timeout" });
      speak(getTemplate("GUARD_TIMEOUT", state.language), state.language, () => {
        // Offer route to nearest help point
        if (state.map) {
          const nearest = findNearestHelpPoint(state.map, state.currentNodeId, state.stepFree);
          if (nearest) {
            console.info("[Guard] Escalating to nearest help point:", nearest.targetNodeId);
          }
        }
      });
    }
  }, 60000);

  return requestId;
}

// -------------------------------------------------------------
// Guard Dashboard Interface (Used by guard.html)
// -------------------------------------------------------------

/**
 * Initializes the guard dashboard receiver.
 * @param {Function} onNewAlert - callback receiving (alertPayload)
 */
export function initGuardDashboard(onNewAlert) {
  if (broadcastChannel) {
    broadcastChannel.onmessage = (event) => {
      if (event.data && event.data.type === "GUARD_REQUEST") {
        onNewAlert(event.data);
      }
    };
  }

  window.addEventListener("storage", (e) => {
    if (e.key === STORAGE_ALERT_KEY && e.newValue) {
      try {
        const alert = JSON.parse(e.newValue);
        onNewAlert(alert);
      } catch (err) {}
    }
  });

  // Check if an unhandled alert exists from before load
  try {
    const existing = localStorage.getItem(STORAGE_ALERT_KEY);
    if (existing) {
      const alert = JSON.parse(existing);
      if (Date.now() - alert.timestamp < 180000) { // within last 3 minutes
        onNewAlert(alert);
      }
    }
  } catch (e) {}
}

/**
 * Dispatches guard acknowledgement back to the user app.
 * @param {string} requestId
 * @param {string} [guardName="Station Guard"]
 */
export function acknowledgeAlert(requestId, guardName = "Station Guard") {
  const ackPayload = {
    type: "GUARD_ACKNOWLEDGED",
    requestId,
    guardName,
    ackTimestamp: Date.now()
  };

  if (broadcastChannel) {
    try {
      broadcastChannel.postMessage(ackPayload);
    } catch (e) {}
  }

  try {
    localStorage.setItem(STORAGE_ACK_KEY, JSON.stringify(ackPayload));
  } catch (e) {}
}
