/**
 * VoicePath AI: Main Application Orchestrator
 * Connects state, voice, router, map loader, safety, sensors, and UI.
 */

import { state, subscribe, update } from "./state.js";
import { loadMap } from "./mapLoader.js";
import { findRoute, findNearestHelpPoint } from "./router.js";
import { generateDirections } from "./directions.js";
import { getTemplate } from "./i18n.js";
import {
  speak,
  cancelSpeech,
  startListening,
  stopListening,
  matchDestination,
  parseCommandIntent
} from "./voice.js";
import { updateDOMView, playTurnSound } from "./ui.js";
import { triggerHaptic } from "./haptics.js";
import { initUserGuardListener, sendGuardAlert } from "./guard.js";
import { startCameraSafety, stopCameraSafety } from "./safety.js";
import { requestScreenWakeLock, startCompass, startPedometer } from "./sensors.js";
import { resetPositionByQR } from "./qr.js";
import { geminiLive } from "./geminiLive.js";

// DOM references
let dom = {};

window.addEventListener("DOMContentLoaded", async () => {
  dom = {
    btnStart: document.getElementById("btn-start-app"),
    welcomeOverlay: document.getElementById("welcome-modal"),
    btnMic: document.getElementById("btn-push-to-talk"),
    btnNext: document.getElementById("btn-next-step"),
    btnRepeat: document.getElementById("btn-repeat-step"),
    btnStop: document.getElementById("btn-stop-nav"),
    btnStepFree: document.getElementById("btn-step-free"),
    btnToggleSR: document.getElementById("btn-toggle-screen-reader"),
    btnCallGuard: document.getElementById("btn-call-guard"),
    btnReportProblem: document.getElementById("btn-report-problem"),
    btnToggleCamera: document.getElementById("btn-toggle-camera"),
    cameraVideo: document.getElementById("safety-camera-feed"),
    quickDestinationGrid: document.getElementById("quick-destinations-grid"),
    qrCheckpointSelect: document.getElementById("qr-checkpoint-select"),
    btnSimulateBlock: document.getElementById("btn-simulate-block"),
    btnToggleLiveAI: document.getElementById("btn-toggle-live-ai"),
    btnConfigGeminiKey: document.getElementById("btn-config-gemini-key"),
    liveAIQuickPrompts: document.getElementById("live-ai-quick-prompts"),
    liveAITranscriptBox: document.getElementById("live-ai-transcript-box")
  };

  // Subscribe UI to state changes
  subscribe(() => {
    updateDOMView();
  });

  // Load and validate map graph
  try {
    const { map, warnings, isOutdated } = await loadMap("data/map.json");
    update({ map, currentNodeId: map.startNode || "entrance" });

    if (isOutdated) {
      console.warn("[App] Map data is older than 30 days.");
    }
    populateQuickDestinations(map);
    populateQRCheckpoints(map);
  } catch (err) {
    console.error("[App] Failed to load initial map:", err);
    alert("Error loading map: " + err.message);
  }

  // Setup Event Handlers
  initEventListeners();
  initUserGuardListener();
});

/**
 * Initializes button and keyboard event listeners.
 */
function initEventListeners() {
  // 1. Mandatory START button to unlock audio and browser speech synthesis
  dom.btnStart?.addEventListener("click", () => {
    if (dom.welcomeOverlay) dom.welcomeOverlay.style.display = "none";
    requestScreenWakeLock();
    startCompass();
    startPedometer();

    speak(getTemplate("WELCOME", state.language), state.language);
  });

  // 2. Push-to-Talk Voice Button
  dom.btnMic?.addEventListener("click", () => {
    if (state.listening) {
      stopListening();
    } else {
      startListening(handleVoiceTranscript, (err) => {
        console.warn("[App] Recognition error:", err);
      });
    }
  });

  // 3. Next Step
  dom.btnNext?.addEventListener("click", advanceStep);

  // 4. Repeat Step
  dom.btnRepeat?.addEventListener("click", repeatCurrentStep);

  // 5. Stop Navigation
  dom.btnStop?.addEventListener("click", stopNavigation);

  // 6. Step-Free Toggle
  dom.btnStepFree?.addEventListener("click", () => {
    const nextState = !state.stepFree;
    update({ stepFree: nextState });
    speak(getTemplate(nextState ? "STEP_FREE_ENABLED" : "STEP_FREE_DISABLED", state.language), state.language);

    // If currently navigating, reroute immediately to respect step-free constraints
    if (state.destinationId) {
      recalculateRoute(false, "Step-free mode toggled");
    }
  });

  // 7. Screen Reader Mode Toggle
  dom.btnToggleSR?.addEventListener("click", () => {
    const newSR = !state.screenReaderMode;
    update({ screenReaderMode: newSR });
    if (!newSR) {
      speak(getTemplate("SCREEN_READER_OFF", state.language), state.language);
    }
  });

  // 9. Call Guard Button
  dom.btnCallGuard?.addEventListener("click", () => {
    sendGuardAlert();
  });

  // 10. Report Problem ("Raasta band hai")
  dom.btnReportProblem?.addEventListener("click", () => {
    reportProblemOnActiveRoute();
  });

  // 11. Camera Safety Toggle
  dom.btnToggleCamera?.addEventListener("click", async () => {
    if (state.cameraActive) {
      stopCameraSafety();
      speak("Camera safety band kar diya gaya hai.", state.language);
      if (dom.cameraVideo) dom.cameraVideo.style.display = "none";
    } else {
      try {
        if (dom.cameraVideo) dom.cameraVideo.style.display = "block";
        await startCameraSafety(dom.cameraVideo);
        speak("Camera chalu hai. Person detection alert active hai.", state.language);
      } catch (e) {
        alert("Camera permission denied or camera unavailable: " + e.message);
      }
    }
  });

  // 12. QR Checkpoint simulation
  dom.qrCheckpointSelect?.addEventListener("change", (e) => {
    const nodeId = e.target.value;
    if (nodeId) {
      resetPositionByQR(nodeId);
      e.target.value = "";
    }
  });

  // 13. Simulate Corridor Block Button (for judges & testing)
  dom.btnSimulateBlock?.addEventListener("click", () => {
    simulateToggleCorridorBlock();
  });

  // 14. "Saathi" – Proactive AI Companion (Live Video + Voice)
  dom.btnToggleProactive = document.getElementById("btn-toggle-proactive-mode");

  dom.btnToggleProactive?.addEventListener("click", () => {
    geminiLive.proactiveMode = !geminiLive.proactiveMode;
    if (geminiLive.proactiveMode) {
      dom.btnToggleProactive.textContent = "🤖 Proactive Guide: ON";
      dom.btnToggleProactive.classList.remove("btn-outline");
      dom.btnToggleProactive.classList.add("btn-success");
      if (geminiLive.isConnected) geminiLive.startProactiveLoop();
      speak("Proactive mode on hai dost. Main bina puche aage se aage guide karta rahunga.", state.language);
    } else {
      dom.btnToggleProactive.textContent = "🤖 Proactive Guide: OFF";
      dom.btnToggleProactive.classList.remove("btn-success");
      dom.btnToggleProactive.classList.add("btn-outline");
      geminiLive.stopProactiveLoop();
      speak("Proactive mode off hai. Ab jab aap poochhenge, tabhi bolunga.", state.language);
    }
  });

  dom.btnConfigGeminiKey?.addEventListener("click", async () => {
    try {
      const res = await fetch("/api/live/config");
      const data = await res.json();
      if (data.configured) {
        alert("🔒 Gemini Live Vision AI is securely configured on the server. No client API key is needed.");
      } else {
        alert("ℹ️ Gemini Live Vision is running in safe hedged relay mode. Server administrators can configure GEMINI_API_KEY in the server .env file.");
      }
    } catch (err) {
      alert("Offline Mode: Navigation graph and local sensors active.");
    }
  });

  dom.btnToggleLiveAI?.addEventListener("click", async () => {
    if (geminiLive.isConnected) {
      geminiLive.disconnect();
      dom.btnToggleLiveAI.textContent = "🤝 Start Saathi (Video + Voice)";
      dom.btnToggleLiveAI.classList.remove("btn-danger");
      dom.btnToggleLiveAI.classList.add("btn-primary");
      if (dom.cameraVideo) dom.cameraVideo.style.display = "none";
      if (dom.liveAIQuickPrompts) dom.liveAIQuickPrompts.style.display = "none";
      speak("Saathi session disconnected. Standing by whenever you need help.", state.language);
    } else {
      try {
        if (dom.cameraVideo) dom.cameraVideo.style.display = "block";
        if (dom.liveAIQuickPrompts) dom.liveAIQuickPrompts.style.display = "flex";
        if (dom.liveAITranscriptBox) dom.liveAITranscriptBox.style.display = "block";

        if (!state.cameraActive) {
          await startCameraSafety(dom.cameraVideo);
        }

        dom.btnToggleLiveAI.textContent = "Connecting to Saathi...";
        await geminiLive.connect(dom.cameraVideo);

        geminiLive.startVideoStream(dom.cameraVideo);
        await geminiLive.startAudioStream();

        dom.btnToggleLiveAI.textContent = "⏹️ Stop Saathi";
        dom.btnToggleLiveAI.classList.remove("btn-primary");
        dom.btnToggleLiveAI.classList.add("btn-danger");

        speak("Hello! I am your companion Saathi. I am monitoring ahead through your camera and will guide you.", state.language);
      } catch (err) {
        alert("Saathi connection note: " + err.message + "\nSwitching to camera vision mode.");
        dom.btnToggleLiveAI.textContent = "🤝 Start Saathi (Video + Voice)";
      }
    }
  });

  // Handle Quick Prompts
  document.querySelectorAll(".btn-live-prompt").forEach(btn => {
    btn.addEventListener("click", () => {
      const promptText = btn.getAttribute("data-prompt");
      if (promptText && geminiLive.isConnected) {
        geminiLive.sendUserText(promptText);
      } else if (!geminiLive.isConnected) {
        alert("Please connect Live AI first by clicking 'Start Live AI'.");
      }
    });
  });

  // Transcript HUD updater
  geminiLive.onTranscript = ({ role, text }) => {
    if (!dom.liveAITranscriptBox) return;
    const msgDiv = document.createElement("div");
    msgDiv.style.marginBottom = "6px";
    if (role === "user") {
      msgDiv.innerHTML = `<span style="color: #38bdf8; font-weight: bold;">User:</span> ${text}`;
    } else {
      msgDiv.innerHTML = `<span style="color: #4ade80; font-weight: bold;">Gemini AI:</span> ${text}`;
    }
    dom.liveAITranscriptBox.appendChild(msgDiv);
    dom.liveAITranscriptBox.scrollTop = dom.liveAITranscriptBox.scrollHeight;
  };

  // 15. Keyboard Accessible Navigation
  window.addEventListener("keydown", (e) => {
    // Space or 'n' -> Next step (if not in text input)
    if (e.target.tagName !== "INPUT" && e.target.tagName !== "TEXTAREA") {
      if (e.key === "n" || e.key === "N") {
        advanceStep();
      } else if (e.key === "r" || e.key === "R") {
        repeatCurrentStep();
      } else if (e.key === "Escape") {
        stopNavigation();
      } else if (e.key === "g" || e.key === "G") {
        sendGuardAlert();
      }
    }
  });
}

/**
 * Handles incoming speech recognition transcripts.
 */
function handleVoiceTranscript(transcript, confidence) {
  const text = transcript.trim();
  console.info(`[VoiceInput] Heard: "${text}" (conf: ${confidence})`);

  // 1. Check if user is responding to a confirmation prompt ("Haan" or "Nahi")
  if (state.awaitingConfirmation) {
    const intent = parseCommandIntent(text);
    if (intent === "confirm_yes") {
      const target = state.awaitingConfirmation;
      update({ awaitingConfirmation: null });
      startNavigationTo(target.candidateId);
      return;
    } else if (intent === "confirm_no") {
      update({ awaitingConfirmation: null });
      speak("Theek hai. Kahan jaana hai, dobara boliye.", state.language);
      return;
    }
  }

  // 1.5 Voice language switching ("Hindi mein bolo" / "Speak English") - voice only, never screen toggle
  if (/^(hindi\s*(mein|me)?\s*bolo|shuddh\s*hindi|hindi)$/i.test(text)) {
    switchSpokenLanguage("hi-IN");
    return;
  }
  if (/^(speak\s*english|in\s*english|english\s*bolo|english)$/i.test(text)) {
    switchSpokenLanguage("en-IN");
    return;
  }

  // 2. Check for navigation/control commands
  const command = parseCommandIntent(text);
  if (command) {
    executeCommand(command);
    return;
  }

  // 2.5 Visual & Situational Queries (Route to Live AI if active)
  const isVisionQuery = /saamne|aage|dekho|kya hai|padho|batao|door|darwaza|obstacle|surrounding|look|ahead|read|who|kya/i.test(text);
  if (geminiLive.isConnected && isVisionQuery) {
    geminiLive.sendUserText(text);
    return;
  }

  // 3. Match destination in map
  const matches = matchDestination(text, state.map);
  if (matches.length === 0) {
    if (geminiLive.isConnected) {
      geminiLive.sendUserText(text);
      return;
    }
    speak(getTemplate("DESTINATION_NOT_FOUND", state.language), state.language);
    return;
  }

  const topMatch = matches[0];

  // If high confidence or exact match
  if (topMatch.score >= 0.85) {
    startNavigationTo(topMatch.nodeId);
  } else {
    // Ask confirmation before starting route
    update({
      awaitingConfirmation: {
        candidateId: topMatch.nodeId,
        candidateName: topMatch.node.name
      }
    });
    speak(
      getTemplate("CONFIRM_DESTINATION", state.language, { destination: topMatch.node.name }),
      state.language
    );
  }
}

/**
 * Executes a parsed intent command.
 */
function executeCommand(command) {
  switch (command) {
    case "next":
      advanceStep();
      break;
    case "repeat":
      repeatCurrentStep();
      break;
    case "where_am_i":
      announceWhereAmI();
      break;
    case "stop":
      stopNavigation();
      break;
    case "nearest_exit":
      routeToSpecial("exit");
      break;
    case "nearest_help":
      routeToSpecial("help_point");
      break;
    case "call_guard":
      sendGuardAlert();
      break;
    case "step_free_on":
      update({ stepFree: true });
      speak(getTemplate("STEP_FREE_ENABLED", state.language), state.language);
      if (state.destinationId) recalculateRoute(false);
      break;
    case "step_free_off":
      update({ stepFree: false });
      speak(getTemplate("STEP_FREE_DISABLED", state.language), state.language);
      if (state.destinationId) recalculateRoute(false);
      break;
    case "lang_hindi":
      switchSpokenLanguage("hi-IN");
      break;
    case "lang_english":
      switchSpokenLanguage("en-IN");
      break;
    case "report_problem":
      reportProblemOnActiveRoute();
      break;
    default:
      speak(getTemplate("COMMAND_UNKNOWN", state.language), state.language);
  }
}

/**
 * Switches spoken language (TTS/STT) via voice command without altering any on-screen UI text.
 * @param {"hi-IN" | "en-IN"} newLang
 */
export function switchSpokenLanguage(newLang) {
  update({ language: newLang });
  if (state.route && state.route.length > 0 && state.map) {
    const directionsSpoken = generateDirections(state.map, state.route, newLang);
    const updatedDirections = (state.directions || []).map((step, idx) => ({
      ...step,
      spokenText: directionsSpoken[idx]?.spokenText || step.spokenText
    }));
    update({ directions: updatedDirections });
  }
  const confirmationMsg = newLang === "hi-IN" ? "हिंदी चुनी गई।" : "English selected.";
  speak(confirmationMsg, newLang);
}

/**
 * Starts navigation towards a given destination node.
 * @param {string} destId
 */
export function startNavigationTo(destId) {
  if (!state.map || !state.map.nodes[destId]) return;

  const destNode = state.map.nodes[destId];
  cancelSpeech();

  // If already at destination
  if (state.currentNodeId === destId) {
    speak(getTemplate("ALREADY_AT_DESTINATION", state.language, { destination: destNode.name }), state.language);
    return;
  }

  const routeResult = findRoute(state.map, state.currentNodeId, destId, state.stepFree);
  if (!routeResult) {
    speak(getTemplate("ROUTE_NOT_FOUND", state.language), state.language, () => {
      // Prompt help point
      routeToSpecial("help_point");
    });
    return;
  }

  // Generate stable English on-screen directions with localized spoken guidance
  const directionsEn = generateDirections(state.map, routeResult.path, "en-IN");
  const directionsSpoken = generateDirections(state.map, routeResult.path, state.language);
  const directions = directionsEn.map((step, idx) => ({
    ...step,
    spokenText: directionsSpoken[idx]?.spokenText || step.spokenText
  }));

  // Atomic state update
  update({
    destinationId: destId,
    route: routeResult.path,
    directions,
    stepIndex: 0
  });

  const totalSteps = directions.reduce((acc, d) => acc + (d.steps || 0), 0);

  // Announce route start
  speak(
    getTemplate("ROUTE_FOUND", state.language, {
      destination: destNode.name,
      steps: totalSteps || 10
    }),
    state.language,
    () => {
      // Speak first step
      if (directions.length > 0) {
        speak(directions[0].spokenText, state.language);
        triggerHaptic(directions[0].turn || "straight");
        playTurnSound(directions[0].turn);
      }
    }
  );
}

/**
 * Advances to the next navigation step.
 */
export function advanceStep() {
  if (!state.destinationId || !state.directions || state.directions.length === 0) {
    speak("Pehle manzil boliye. Jaise 'Library' ya 'Lab'.", state.language);
    return;
  }

  if (state.stepIndex >= state.directions.length - 1) {
    // Already at arrival step
    const finalStep = state.directions[state.directions.length - 1];
    speak(finalStep.spokenText, state.language);
    triggerHaptic("arrive");
    playTurnSound("arrive");
    return;
  }

  const nextIndex = state.stepIndex + 1;
  const nextStep = state.directions[nextIndex];

  // Advance user position to the node corresponding to this step
  const updatedNodeId = nextStep.nodeId || state.currentNodeId;

  update({
    stepIndex: nextIndex,
    currentNodeId: updatedNodeId
  });

  cancelSpeech();
  speak(nextStep.spokenText, state.language);
  triggerHaptic(nextStep.turn || "straight");
  playTurnSound(nextStep.turn);
}

/**
 * Repeats the current step instruction.
 */
export function repeatCurrentStep() {
  if (state.directions && state.directions[state.stepIndex]) {
    const cur = state.directions[state.stepIndex];
    cancelSpeech();
    speak(cur.spokenText, state.language);
  } else {
    speak("Abhi koi route active nahi hai. Kahan jaana hai?", state.language);
  }
}

/**
 * Stops navigation.
 */
export function stopNavigation() {
  cancelSpeech();
  update({
    destinationId: null,
    route: [],
    directions: [],
    stepIndex: 0
  });
  speak(getTemplate("NAVIGATION_STOPPED", state.language), state.language);
}

/**
 * Announces current location.
 */
export function announceWhereAmI() {
  const node = state.map?.nodes ? state.map.nodes[state.currentNodeId] : null;
  const name = node ? `${node.name}${node.landmark ? ' (' + node.landmark + ')' : ''}` : state.currentNodeId;
  speak(getTemplate("WHERE_AM_I", state.language, { location: name }), state.language);
}

/**
 * Routes to nearest exit or help point.
 */
export function routeToSpecial(type) {
  if (!state.map) return;
  const nearest = findNearestHelpPoint(state.map, state.currentNodeId, state.stepFree, type);
  if (nearest) {
    startNavigationTo(nearest.targetNodeId);
  } else {
    speak("Aas paas koi help point ya exit nahi mila.", state.language);
  }
}

/**
 * Recomputes route (e.g. after corridor block or map change).
 */
export function recalculateRoute(speakNotice = true, reason = "") {
  if (!state.destinationId || !state.map) return;

  cancelSpeech();
  const routeResult = findRoute(state.map, state.currentNodeId, state.destinationId, state.stepFree);

  if (!routeResult) {
    update({ route: [], directions: [], stepIndex: 0 });
    speak(getTemplate("ROUTE_NOT_FOUND", state.language), state.language, () => {
      routeToSpecial("help_point");
    });
    return;
  }

  // Generate stable English on-screen directions with localized spoken guidance
  const directionsEn = generateDirections(state.map, routeResult.path, "en-IN");
  const directionsSpoken = generateDirections(state.map, routeResult.path, state.language);
  const directions = directionsEn.map((step, idx) => ({
    ...step,
    spokenText: directionsSpoken[idx]?.spokenText || step.spokenText
  }));

  // Single update to prevent stale UI state
  update({
    route: routeResult.path,
    directions,
    stepIndex: 0
  });

  const notice = reason
    ? getTemplate("ROUTE_BLOCKED_REASON", state.language, { reason })
    : getTemplate("ROUTE_CHANGED", state.language);

  if (speakNotice) {
    speak(notice, state.language, () => {
      if (directions.length > 0) {
        speak(directions[0].spokenText, state.language);
        triggerHaptic(directions[0].turn || "straight");
      }
    });
  }
}

/**
 * Reports problem on the active route by blocking the current next edge.
 */
export function reportProblemOnActiveRoute() {
  if (!state.route || state.route.length < 2 || !state.map) {
    speak("Abhi koi active corridor nahi hai jise block mark kiya ja sake.", state.language);
    return;
  }

  const fromId = state.currentNodeId;
  // Next node in route
  const fromIdx = state.route.indexOf(fromId);
  const toId = fromIdx !== -1 && fromIdx < state.route.length - 1 ? state.route[fromIdx + 1] : state.route[1];

  // Find edge and mark blocked
  const edge = state.map.edges?.find(
    e => (e.from === fromId && e.to === toId) || (e.from === toId && e.to === fromId)
  );

  if (edge) {
    edge.blocked = true;
    edge.reason = "User reported obstacle";
    console.info(`[App] Edge ${edge.id} blocked by user report.`);
  }

  recalculateRoute(true, "Obstacle reported");
}

/**
 * Simulates toggling block on the main central corridor (for demo and pitch).
 */
function simulateToggleCorridorBlock() {
  if (!state.map || !state.map.edges) return;
  // Edge e6 is j1 <-> j3 (the main corridor)
  const mainEdge = state.map.edges.find(e => e.id === "e6") || state.map.edges[0];
  if (!mainEdge) return;

  mainEdge.blocked = !mainEdge.blocked;
  mainEdge.reason = mainEdge.blocked ? "Repair work in progress" : "";

  // Trigger UI update
  update({ map: { ...state.map } });

  if (state.destinationId) {
    recalculateRoute(true, mainEdge.reason);
  } else {
    speak(
      mainEdge.blocked ? "Main corridor ab repair ke liye band hai." : "Main corridor ab khula hai.",
      state.language
    );
  }
}

/**
 * Fills quick destination buttons in the DOM.
 */
function populateQuickDestinations(map) {
  if (!dom.quickDestinationGrid || !map.nodes) return;
  dom.quickDestinationGrid.innerHTML = "";

  const destNodes = Object.entries(map.nodes).filter(([id, n]) => n.type !== "junction" && id !== map.startNode);

  for (const [id, node] of destNodes) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "btn-quick-dest";
    btn.setAttribute("aria-label", `Navigate to ${node.name}`);
    btn.setAttribute("data-content-description", `Navigate to ${node.name}`);
    btn.innerHTML = `
      <span class="dest-icon">${getIconForType(node.type)}</span>
      <span class="dest-name">${node.name}</span>
    `;
    btn.addEventListener("click", () => {
      startNavigationTo(id);
    });
    dom.quickDestinationGrid.appendChild(btn);
  }
}

/**
 * Fills QR Checkpoint simulator select dropdown.
 */
function populateQRCheckpoints(map) {
  if (!dom.qrCheckpointSelect || !map.nodes) return;
  dom.qrCheckpointSelect.innerHTML = `<option value="">-- Select QR Checkpoint to scan --</option>`;

  for (const [id, node] of Object.entries(map.nodes)) {
    const opt = document.createElement("option");
    opt.value = id;
    opt.textContent = `${node.name} (${node.type})`;
    dom.qrCheckpointSelect.appendChild(opt);
  }
}

function getIconForType(type) {
  switch (type) {
    case "entrance": return "🚪";
    case "help_point": return "ℹ️";
    case "exit": return "🏃";
    case "stairs": return "🪜";
    case "lift": return "🛗";
    default: return "📍";
  }
}
