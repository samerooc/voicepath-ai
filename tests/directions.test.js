/**
 * VoicePath AI: Directions Unit Tests
 * Tests turn angle calculation (inverted SVG Y-axis), straight segment merging, and landmarks.
 */

import { turnType, generateDirections } from "../js/directions.js";

export function runDirectionsTests(assert) {
  // Remember: In SVG screen space, Y increases DOWNWARD!
  // Moving East: (0, 0) -> (10, 0)
  // Turn South (+Y): (10, 10) => Right turn
  // Turn North (-Y): (10, -10) => Left turn

  const a = { x: 0, y: 0 };
  const b = { x: 10, y: 0 };

  // 1. Straight
  const cStraight = { x: 20, y: 0 };
  assert.equal(turnType(a, b, cStraight), "straight", "Forward continuation should be straight");

  // 2. Right turn (towards +Y in SVG)
  const cRight = { x: 10, y: 10 };
  assert.equal(turnType(a, b, cRight), "right", "Turning down (+Y) in SVG should be right");

  // 3. Left turn (towards -Y in SVG)
  const cLeft = { x: 10, y: -10 };
  assert.equal(turnType(a, b, cLeft), "left", "Turning up (-Y) in SVG should be left");

  // 4. U-Turn
  const cUTurn = { x: 0, y: 0 };
  assert.equal(turnType(a, b, cUTurn), "uturn", "Going back to start should be uturn");

  // 5. Test full direction generation and straight merging
  const mapData = {
    nodes: {
      n1: { x: 0, y: 0, name: "Start Point" },
      n2: { x: 10, y: 0, name: "Hallway A", landmark: "water cooler" },
      n3: { x: 20, y: 0, name: "Hallway B" }, // straight continuation
      n4: { x: 20, y: 10, name: "Library", landmark: "glass door" } // right turn
    },
    edges: [
      { from: "n1", to: "n2", dist: 10 },
      { from: "n2", to: "n3", dist: 10 },
      { from: "n3", to: "n4", dist: 10 }
    ]
  };

  const dirs = generateDirections(mapData, ["n1", "n2", "n3", "n4"], "en-IN");
  assert.ok(dirs.length >= 2, "Should generate merged directions and final arrival");

  // The first segment n1->n2 and n2->n3 are both straight, so they should be merged
  const firstDir = dirs[0];
  assert.equal(firstDir.turn, "straight", "First segment should be straight");
  assert.ok(firstDir.dist >= 20, "Consecutive straight segments should be merged into 20m");

  // The last instruction should be arrival
  const arrivalDir = dirs[dirs.length - 1];
  assert.equal(arrivalDir.type, "arrival", "Final step must be an arrival type");
  assert.ok(arrivalDir.text.includes("Library"), "Arrival text should mention destination name");
}
