/**
 * VoicePath AI: QR Code Checkpoint & Position Reset
 * Allows resetting user's estimated currentNodeId via physical QR codes placed on building door frames.
 */

import { state, update } from "./state.js";
import { speak } from "./voice.js";
import { findRoute } from "./router.js";
import { generateDirections } from "./directions.js";

/**
 * Resets the current user position to a scanned QR node ID and reroutes if active.
 * @param {string} scannedNodeId
 * @returns {boolean} success
 */
export function resetPositionByQR(scannedNodeId) {
  if (!state.map || !state.map.nodes || !state.map.nodes[scannedNodeId]) {
    speak("QR checkpoint anjaan hai. Position reset nahi ho payi.", state.language);
    return false;
  }

  const node = state.map.nodes[scannedNodeId];
  update({ currentNodeId: scannedNodeId });

  // If currently navigating to a destination, recompute route from here
  if (state.destinationId && state.destinationId !== scannedNodeId) {
    const newRoute = findRoute(state.map, scannedNodeId, state.destinationId, state.stepFree);
    if (newRoute) {
      const directions = generateDirections(state.map, newRoute.path, state.language);
      update({
        route: newRoute.path,
        directions,
        stepIndex: 0
      });

      speak(`QR checkpoint verified: ${node.name}. Naya raasta yahan se shuru hota hai.`, state.language, () => {
        if (directions.length > 0) {
          speak(directions[0].spokenText, state.language);
        }
      });
      return true;
    }
  }

  speak(`Checkpoint verified. Aap abhi ${node.name} par hain.`, state.language);
  return true;
}
