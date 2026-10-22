/**
 * VoicePath AI: UI Renderer & Interactive SVG Map
 * Accessible, high-contrast, large touch controls, live SVG route glow & status indicators.
 */

import { state } from "./state.js";
import { triggerHaptic } from "./haptics.js";

// Web Audio API beep generator for crisp tactile feedback
let audioCtx = null;
function playTone(freq = 440, type = "sine", duration = 0.1) {
  try {
    if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    if (audioCtx.state === "suspended") audioCtx.resume();
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, audioCtx.currentTime);
    gain.gain.setValueAtTime(0.15, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + duration);
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.start();
    osc.stop(audioCtx.currentTime + duration);
  } catch (e) {}
}

/**
 * Play a turn alert sound
 */
export function playTurnSound(turn) {
  if (turn === "left") {
    playTone(360, "triangle", 0.12);
    setTimeout(() => playTone(440, "triangle", 0.12), 120);
  } else if (turn === "right") {
    playTone(520, "triangle", 0.18);
  } else if (turn === "arrive") {
    playTone(440, "sine", 0.15);
    setTimeout(() => playTone(660, "sine", 0.25), 160);
  } else {
    playTone(400, "sine", 0.08);
  }
}

/**
 * Renders the SVG map visually representing nodes, edges, blocked corridors, and the active route.
 * @param {SVGSVGElement} svgEl
 * @param {Object} map
 */
export function renderSVGMap(svgEl, map) {
  if (!svgEl || !map || !map.nodes) return;

  const nodes = map.nodes;
  const edges = map.edges || [];
  const route = state.route || [];
  const currentStep = state.directions ? state.directions[state.stepIndex] : null;

  // Build edge lookup for quick active-route check
  const routeEdgeSet = new Set();
  for (let i = 0; i < route.length - 1; i++) {
    routeEdgeSet.add(`${route[i]}--${route[i + 1]}`);
    routeEdgeSet.add(`${route[i + 1]}--${route[i]}`);
  }

  let html = `
    <defs>
      <!-- Glow filter for active route -->
      <filter id="routeGlow" x="-20%" y="-20%" width="140%" height="140%">
        <feGaussianBlur stdDeviation="3" result="blur" />
        <feComposite in="SourceGraphic" in2="blur" operator="over" />
      </filter>
      <!-- Pulsing user dot animation -->
      <radialGradient id="userGrad" cx="50%" cy="50%" r="50%">
        <stop offset="0%" stop-color="#38bdf8" />
        <stop offset="100%" stop-color="#0284c7" />
      </radialGradient>
    </defs>
  `;

  // 1. Draw building corridors (Edges)
  html += `<g class="edges-layer">`;
  for (const edge of edges) {
    const fromNode = nodes[edge.from];
    const toNode = nodes[edge.to];
    if (!fromNode || !toNode) continue;

    const isRouteEdge = routeEdgeSet.has(`${edge.from}--${edge.to}`);
    const isBlocked = !!edge.blocked;
    const isStairs = edge.stepFree === false;

    let strokeClass = "edge-corridor";
    let strokeColor = "#334155";
    let strokeWidth = 8;
    let strokeDash = "";

    if (isBlocked) {
      strokeColor = "#ef4444";
      strokeDash = "6,4";
      strokeClass += " edge-blocked";
    } else if (isRouteEdge) {
      strokeColor = "#22c55e";
      strokeWidth = 10;
      strokeClass += " edge-active-route";
    } else if (isStairs) {
      strokeColor = "#f59e0b";
      strokeDash = "4,4";
      strokeClass += " edge-stairs";
    }

    html += `
      <line id="edge-line-${edge.id}"
            x1="${fromNode.x}" y1="${fromNode.y}"
            x2="${toNode.x}" y2="${toNode.y}"
            stroke="${strokeColor}"
            stroke-width="${strokeWidth}"
            stroke-dasharray="${strokeDash}"
            stroke-linecap="round"
            class="${strokeClass}" />
    `;

    // If blocked, draw a warning indicator badge at edge midpoint
    if (isBlocked) {
      const mx = (fromNode.x + toNode.x) / 2;
      const my = (fromNode.y + toNode.y) / 2;
      html += `
        <g class="blocked-badge" transform="translate(${mx}, ${my})">
          <circle r="11" fill="#b91c1c" stroke="#ffffff" stroke-width="2"/>
          <text y="4" text-anchor="middle" fill="#ffffff" font-size="11" font-weight="bold">✕</text>
        </g>
      `;
    }
  }
  html += `</g>`;

  // 2. Draw Nodes (Rooms, Junctions, Doors)
  html += `<g class="nodes-layer">`;
  for (const [nodeId, node] of Object.entries(nodes)) {
    const isCurrent = nodeId === state.currentNodeId;
    const isDestination = nodeId === state.destinationId;
    const inRoute = route.includes(nodeId);

    let fillColor = "#1e293b";
    let strokeColor = "#64748b";
    let radius = 14;
    let iconSymbol = "";

    switch (node.type) {
      case "entrance":
        fillColor = "#0284c7";
        strokeColor = "#38bdf8";
        radius = 16;
        iconSymbol = "🚪";
        break;
      case "help_point":
        fillColor = "#8b5cf6";
        strokeColor = "#c4b5fd";
        radius = 16;
        iconSymbol = "ℹ️";
        break;
      case "exit":
        fillColor = "#16a34a";
        strokeColor = "#86efac";
        radius = 16;
        iconSymbol = "🏃";
        break;
      case "stairs":
        fillColor = "#d97706";
        strokeColor = "#fcd34d";
        iconSymbol = "🪜";
        break;
      case "lift":
        fillColor = "#0d9488";
        strokeColor = "#5eead4";
        iconSymbol = "🛗";
        break;
      case "junction":
        radius = 8;
        fillColor = "#475569";
        strokeColor = "#94a3b8";
        break;
      default: // room
        radius = 14;
        fillColor = "#334155";
        strokeColor = inRoute ? "#22c55e" : "#64748b";
        iconSymbol = "📍";
        break;
    }

    if (isDestination) {
      fillColor = "#16a34a";
      strokeColor = "#fbbf24";
      radius = 18;
    }

    html += `
      <g id="map-node-${nodeId}" class="map-node ${isCurrent ? 'node-current' : ''}" transform="translate(${node.x}, ${node.y})">
        ${isCurrent ? `<circle r="24" fill="none" stroke="#38bdf8" stroke-width="3" opacity="0.8" class="pulse-ring"/>` : ''}
        <circle r="${radius}" fill="${fillColor}" stroke="${strokeColor}" stroke-width="${isCurrent || isDestination ? 4 : 2}" />
        ${iconSymbol && node.type !== "junction" ? `<text y="4" text-anchor="middle" font-size="11" fill="#ffffff">${iconSymbol}</text>` : ''}
        <text y="${node.y > 350 ? 28 : -20}" text-anchor="middle" fill="#f8fafc" font-size="12" font-weight="600" class="node-label">
          ${node.name}
        </text>
      </g>
    `;
  }
  html += `</g>`;

  svgEl.innerHTML = html;
}

/**
 * Updates all DOM elements with active state values.
 */
export function updateDOMView() {
  const currentStep = state.directions ? state.directions[state.stepIndex] : null;

  // Active step instruction display
  const instructionEl = document.getElementById("active-step-text");
  if (instructionEl) {
    if (currentStep) {
      instructionEl.textContent = currentStep.text;
    } else if (state.awaitingConfirmation) {
      instructionEl.textContent = `Did you mean "${state.awaitingConfirmation.candidateName}"? (Say yes or no)`;
    } else {
      instructionEl.textContent = "Where would you like to go? Tap mic or speak destination.";
    }
  }

  // Landmark pill
  const landmarkPill = document.getElementById("step-landmark-badge");
  if (landmarkPill) {
    if (currentStep && currentStep.landmark) {
      landmarkPill.style.display = "inline-flex";
      landmarkPill.innerHTML = `<span>Landmark:</span> <strong>${currentStep.landmark}</strong>`;
    } else {
      landmarkPill.style.display = "none";
    }
  }

  // Steps / Distance pill
  const stepsPill = document.getElementById("step-distance-badge");
  if (stepsPill) {
    if (currentStep && currentStep.steps > 0) {
      stepsPill.style.display = "inline-flex";
      stepsPill.innerHTML = `<span>Approx</span> <strong>${currentStep.steps} steps</strong> (~${currentStep.dist}m)`;
    } else {
      stepsPill.style.display = "none";
    }
  }

  // Step counter indicator
  const stepCounterEl = document.getElementById("step-progress-indicator");
  if (stepCounterEl) {
    if (state.directions && state.directions.length > 0) {
      stepCounterEl.textContent = `Step ${state.stepIndex + 1} of ${state.directions.length}`;
      stepCounterEl.style.display = "inline-block";
    } else {
      stepCounterEl.style.display = "none";
    }
  }

  // Turn Icon visual
  const turnIconEl = document.getElementById("active-turn-icon");
  if (turnIconEl) {
    if (currentStep) {
      const icons = {
        straight: "⬆️",
        left: "⬅️",
        right: "➡️",
        uturn: "🔄",
        arrive: "🏁"
      };
      turnIconEl.textContent = icons[currentStep.turn] || "🚶";
    } else {
      turnIconEl.textContent = "🎙️";
    }
  }

  // Status message
  const statusLine = document.getElementById("status-bar-message");
  if (statusLine) {
    if (state.listening) {
      statusLine.textContent = "Listening... Speak now";
      statusLine.className = "status-active listening";
    } else if (state.speaking) {
      statusLine.textContent = "Speaking instruction...";
      statusLine.className = "status-active speaking";
    } else if (state.guardStatus === "sent") {
      statusLine.textContent = "Guard alert sent (Awaiting acknowledgment)...";
      statusLine.className = "status-active guard-alert";
    } else if (state.guardStatus === "acknowledged") {
      statusLine.textContent = "Guard has acknowledged and is arriving!";
      statusLine.className = "status-active guard-ok";
    } else {
      statusLine.textContent = "VoicePath AI Ready";
      statusLine.className = "status-idle";
    }
  }

  // Step-Free toggle button state
  const stepFreeBtn = document.getElementById("btn-step-free");
  if (stepFreeBtn) {
    stepFreeBtn.setAttribute("aria-pressed", String(state.stepFree));
    stepFreeBtn.classList.toggle("btn-active", state.stepFree);
  }

  // Screen reader toggle button state
  const srBtn = document.getElementById("btn-toggle-screen-reader");
  if (srBtn) {
    srBtn.setAttribute("aria-pressed", String(state.screenReaderMode));
    srBtn.classList.toggle("btn-active", state.screenReaderMode);
    srBtn.textContent = state.screenReaderMode ? "Screen Reader: ON" : "Screen Reader: OFF";
  }

  // Current location name
  const locEl = document.getElementById("current-location-text");
  if (locEl && state.map?.nodes) {
    const node = state.map.nodes[state.currentNodeId];
    locEl.textContent = node ? node.name : state.currentNodeId;
  }

  // Person detection warning banner
  const personBanner = document.getElementById("person-detected-banner");
  if (personBanner) {
    personBanner.style.display = state.personDetected ? "flex" : "none";
  }

  // Render SVG Map
  const svg = document.getElementById("indoor-map-svg");
  if (svg && state.map) {
    renderSVGMap(svg, state.map);
  }
}
