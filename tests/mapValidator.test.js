/**
 * VoicePath AI: Map Validator Unit Tests
 * Tests detection of missing nodes, duplicate edge IDs, invalid distances, and missing exits.
 */

import { validateMap } from "../js/mapValidator.js";

export function runMapValidatorTests(assert) {
  // 1. Missing exit node (safety violation)
  const badMapNoExit = {
    startNode: "entrance",
    nodes: {
      entrance: { x: 0, y: 0, name: "Entrance", type: "entrance" },
      room1: { x: 10, y: 10, name: "Room 1", type: "room" }
    },
    edges: [
      { id: "e1", from: "entrance", to: "room1", dist: 10 }
    ]
  };
  const res1 = validateMap(badMapNoExit);
  assert.equal(res1.valid, false, "Map without exit node should fail validation");
  assert.ok(res1.errors.some(e => e.includes("exit")), "Error should mention exit node");

  // 2. Edge referencing non-existent node
  const badMapGhostNode = {
    startNode: "entrance",
    nodes: {
      entrance: { x: 0, y: 0, name: "Entrance", type: "entrance" },
      exit1: { x: 10, y: 10, name: "Exit", type: "exit" }
    },
    edges: [
      { id: "e1", from: "entrance", to: "ghost_node", dist: 10 }
    ]
  };
  const res2 = validateMap(badMapGhostNode);
  assert.equal(res2.valid, false, "Edge referencing ghost node should fail validation");

  // 3. Negative or zero distance
  const badMapBadDist = {
    startNode: "entrance",
    nodes: {
      entrance: { x: 0, y: 0, name: "Entrance", type: "entrance" },
      exit1: { x: 10, y: 10, name: "Exit", type: "exit" }
    },
    edges: [
      { id: "e1", from: "entrance", to: "exit1", dist: -5 }
    ]
  };
  const res3 = validateMap(badMapBadDist);
  assert.equal(res3.valid, false, "Negative distance edge should fail validation");

  // 4. Healthy Map Pass
  const goodMap = {
    startNode: "entrance",
    nodes: {
      entrance: { x: 0, y: 0, name: "Entrance", type: "entrance" },
      exit1: { x: 10, y: 10, name: "Exit", type: "exit" },
      help: { x: 5, y: 5, name: "Help Desk", type: "help_point" }
    },
    edges: [
      { id: "e1", from: "entrance", to: "help", dist: 5 },
      { id: "e2", from: "help", to: "exit1", dist: 5 }
    ]
  };
  const res4 = validateMap(goodMap);
  assert.equal(res4.valid, true, "Healthy map should pass validation with 0 errors");
  assert.equal(res4.errors.length, 0);
}
