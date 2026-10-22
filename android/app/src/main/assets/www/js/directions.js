/**
 * VoicePath AI: Direction Generator
 * Converts node sequence into spoken landmark-rich turn-by-turn guidance.
 */

import { getTemplate } from "./i18n.js";

/**
 * Calculates turn direction between three consecutive nodes in SVG coordinates (Y points down).
 * @param {{x: number, y: number}} a
 * @param {{x: number, y: number}} b
 * @param {{x: number, y: number}} c
 * @returns {"straight" | "left" | "right" | "uturn"}
 */
export function turnType(a, b, c) {
  const v1 = { x: b.x - a.x, y: b.y - a.y };
  const v2 = { x: c.x - b.x, y: c.y - b.y };

  const cross = v1.x * v2.y - v1.y * v2.x;
  const dot = v1.x * v2.x + v1.y * v2.y;

  const angle = Math.abs((Math.atan2(cross, dot) * 180) / Math.PI);

  if (angle < 30) return "straight";
  if (angle > 150) return "uturn";
  return cross > 0 ? "right" : "left";
}

/**
 * Generates turn-by-turn instruction objects from a node ID path.
 * @param {Object} map - map data object
 * @param {string[]} path - array of node IDs
 * @param {string} [lang="hi-IN"] - language code
 * @returns {Array<Object>} array of step instruction objects
 */
export function generateDirections(map, path, lang = "hi-IN") {
  if (!map || !map.nodes || !Array.isArray(path) || path.length === 0) {
    return [];
  }

  const nodes = map.nodes;

  // Single node path - already arrived
  if (path.length === 1) {
    const dest = nodes[path[0]];
    const name = dest ? dest.name : path[0];
    return [{
      type: "arrival",
      turn: "arrive",
      nodeId: path[0],
      text: getTemplate("ALREADY_AT_DESTINATION", lang, { destination: name }),
      spokenText: getTemplate("ALREADY_AT_DESTINATION", lang, { destination: name }),
      landmark: dest?.landmark || "",
      dist: 0,
      steps: 0,
      warning: null
    }];
  }

  // Pre-calculate segments between consecutive nodes
  const segments = [];
  for (let i = 0; i < path.length - 1; i++) {
    const fromId = path[i];
    const toId = path[i + 1];
    const fromNode = nodes[fromId];
    const toNode = nodes[toId];

    // Find edge distance & check stairs
    let dist = 10;
    let isStairs = toNode.type === "stairs";
    const edges = map.edges || [];
    for (const e of edges) {
      if ((e.from === fromId && e.to === toId) || (e.from === toId && e.to === fromId)) {
        dist = Math.round(Number(e.dist) || 10);
        if (e.stepFree === false) isStairs = true;
        break;
      }
    }

    segments.push({
      fromId,
      toId,
      fromNode,
      toNode,
      dist,
      isStairs
    });
  }

  const rawSteps = [];

  // Step 1: Initial departure from start
  const firstSeg = segments[0];
  const initialDist = firstSeg.dist;
  const initialApproxSteps = Math.max(2, Math.round(initialDist / 0.7));

  if (segments.length === 1) {
    // Only one segment to destination
    const destNode = firstSeg.toNode;
    rawSteps.push({
      type: "turn",
      turn: "straight",
      nodeId: firstSeg.toId,
      dist: initialDist,
      steps: initialApproxSteps,
      landmark: destNode.landmark || "",
      warning: firstSeg.isStairs ? getTemplate("STAIRS_WARNING", lang) : null,
      targetName: destNode.name
    });
  } else {
    // Departure step towards first junction
    rawSteps.push({
      type: "turn",
      turn: "straight",
      nodeId: firstSeg.toId,
      dist: initialDist,
      steps: initialApproxSteps,
      landmark: firstSeg.toNode.landmark || "",
      warning: firstSeg.isStairs ? getTemplate("STAIRS_WARNING", lang) : null,
      targetName: firstSeg.toNode.name
    });

    // Intermediate junctions
    for (let i = 1; i < segments.length; i++) {
      const prevSeg = segments[i - 1];
      const curSeg = segments[i];

      const a = prevSeg.fromNode;
      const b = curSeg.fromNode; // junction node
      const c = curSeg.toNode;

      const turn = turnType(a, b, c);
      const dist = curSeg.dist;
      const approxSteps = Math.max(2, Math.round(dist / 0.7));

      rawSteps.push({
        type: "turn",
        turn,
        nodeId: curSeg.toId,
        dist,
        steps: approxSteps,
        landmark: curSeg.toNode.landmark || "",
        warning: curSeg.isStairs ? getTemplate("STAIRS_WARNING", lang) : null,
        targetName: curSeg.toNode.name
      });
    }
  }

  // Merge consecutive straight segments
  const mergedSteps = [];
  for (let i = 0; i < rawSteps.length; i++) {
    const cur = rawSteps[i];
    if (mergedSteps.length > 0 && cur.turn === "straight" && mergedSteps[mergedSteps.length - 1].turn === "straight") {
      const prev = mergedSteps[mergedSteps.length - 1];
      prev.dist += cur.dist;
      prev.steps += cur.steps;
      prev.nodeId = cur.nodeId;
      prev.targetName = cur.targetName;
      if (cur.landmark) prev.landmark = cur.landmark;
      if (cur.warning) prev.warning = (prev.warning ? prev.warning + " " : "") + cur.warning;
    } else {
      mergedSteps.push({ ...cur });
    }
  }

  // Build localized speech and display sentences
  const directions = [];
  for (let i = 0; i < mergedSteps.length; i++) {
    const s = mergedSteps[i];
    const isLast = (i === mergedSteps.length - 1);
    const destName = isLast ? nodes[path[path.length - 1]].name : s.targetName;

    let sentence = "";
    if (s.turn === "straight") {
      sentence = s.landmark
        ? getTemplate("STEP_STRAIGHT_LANDMARK", lang, { landmark: s.landmark, steps: s.steps })
        : getTemplate("STEP_STRAIGHT", lang, { steps: s.steps });
    } else if (s.turn === "left") {
      sentence = s.landmark
        ? getTemplate("STEP_LEFT_LANDMARK", lang, { landmark: s.landmark, steps: s.steps })
        : getTemplate("STEP_LEFT", lang, { steps: s.steps });
    } else if (s.turn === "right") {
      sentence = s.landmark
        ? getTemplate("STEP_RIGHT_LANDMARK", lang, { landmark: s.landmark, steps: s.steps })
        : getTemplate("STEP_RIGHT", lang, { steps: s.steps });
    } else if (s.turn === "uturn") {
      sentence = getTemplate("STEP_UTURN", lang, { steps: s.steps });
    }

    if (s.warning) {
      sentence = `${s.warning} ${sentence}`;
    }

    directions.push({
      stepNumber: i + 1,
      totalSteps: mergedSteps.length + 1,
      type: "navigation",
      turn: s.turn,
      nodeId: s.nodeId,
      text: sentence,
      spokenText: sentence,
      landmark: s.landmark || "",
      dist: s.dist,
      steps: s.steps,
      warning: s.warning
    });
  }

  // Final Arrival Instruction
  const finalDest = nodes[path[path.length - 1]];
  const finalName = finalDest ? finalDest.name : "Destination";
  const arrivalText = getTemplate("ARRIVAL_ANNOUNCEMENT", lang, {
    destination: finalName,
    landmark: finalDest.landmark ? ` (${finalDest.landmark})` : ""
  });

  directions.push({
    stepNumber: directions.length + 1,
    totalSteps: directions.length + 1,
    type: "arrival",
    turn: "arrive",
    nodeId: path[path.length - 1],
    text: arrivalText,
    spokenText: arrivalText,
    landmark: finalDest.landmark || "",
    dist: 0,
    steps: 0,
    warning: null
  });

  return directions;
}
