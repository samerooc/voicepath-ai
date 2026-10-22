/**
 * VoicePath AI: Router Unit Tests
 * Tests Dijkstra pathfinding, blocked edges, step-free mode, and disconnected graphs.
 */

import { findRoute, findNearestHelpPoint } from "../js/router.js";

export function runRouterTests(assert) {
  const testMap = {
    nodes: {
      entrance: { x: 0, y: 0, name: "Entrance", type: "entrance" },
      j1: { x: 10, y: 0, name: "Junction 1", type: "junction" },
      j2: { x: 20, y: 0, name: "Junction 2", type: "junction" },
      library: { x: 20, y: -10, name: "Library", type: "room" },
      stairs_node: { x: 30, y: 0, name: "Stairs Landing", type: "stairs" },
      help_desk: { x: 10, y: 10, name: "Help Desk", type: "help_point" },
      exit_node: { x: 40, y: 0, name: "Emergency Exit", type: "exit" },
      isolated: { x: 100, y: 100, name: "Isolated Room", type: "room" }
    },
    edges: [
      { id: "e1", from: "entrance", to: "j1", dist: 10, blocked: false, stepFree: true },
      { id: "e2", from: "j1", to: "j2", dist: 10, blocked: false, stepFree: true },
      { id: "e3", from: "j2", to: "library", dist: 10, blocked: false, stepFree: true },
      { id: "e4", from: "j1", to: "help_desk", dist: 10, blocked: false, stepFree: true },
      { id: "e5", from: "j2", to: "stairs_node", dist: 10, blocked: false, stepFree: false }, // stairs!
      { id: "e6", from: "stairs_node", to: "exit_node", dist: 10, blocked: false, stepFree: false },
      { id: "e7", from: "j2", to: "exit_node", dist: 30, blocked: false, stepFree: true } // longer step-free route
    ]
  };

  // Test 1: Shortest route calculation
  const r1 = findRoute(testMap, "entrance", "library");
  assert.ok(r1 !== null, "Route to library should exist");
  assert.deepEqual(r1.path, ["entrance", "j1", "j2", "library"], "Should find shortest path [entrance, j1, j2, library]");
  assert.equal(r1.totalDist, 30, "Total distance should be 30m");

  // Test 2: Same start and destination
  const r2 = findRoute(testMap, "library", "library");
  assert.ok(r2 !== null, "Same node route should succeed");
  assert.deepEqual(r2.path, ["library"], "Should return single node path");
  assert.equal(r2.totalDist, 0, "Distance should be 0");

  // Test 3: Blocked edge handling
  testMap.edges[1].blocked = true; // block j1 <-> j2
  const r3 = findRoute(testMap, "entrance", "library");
  assert.equal(r3, null, "Should return null when the only connecting corridor is blocked");
  testMap.edges[1].blocked = false; // unblock

  // Test 4: Step-Free Mode skips stairs
  const rDefault = findRoute(testMap, "j2", "exit_node", false);
  assert.deepEqual(rDefault.path, ["j2", "stairs_node", "exit_node"], "Standard mode should take shorter stairs path (20m)");
  assert.equal(rDefault.totalDist, 20);

  const rStepFree = findRoute(testMap, "j2", "exit_node", true);
  assert.deepEqual(rStepFree.path, ["j2", "exit_node"], "Step-free mode should avoid stairs and use 30m corridor");
  assert.equal(rStepFree.totalDist, 30);

  // Test 5: Disconnected / Unreachable node
  const rDisconnected = findRoute(testMap, "entrance", "isolated");
  assert.equal(rDisconnected, null, "Disconnected node must return null");

  // Test 6: Nearest help point
  const nearest = findNearestHelpPoint(testMap, "entrance");
  assert.ok(nearest !== null, "Should find nearest help point");
  assert.equal(nearest.targetNodeId, "help_desk", "Nearest help point to entrance should be help_desk");
}
