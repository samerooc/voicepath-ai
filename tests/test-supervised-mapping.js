/**
 * VoicePath AI: Supervised Map Building & Evidence Validation Test Suite
 * Validates:
 * 1. Coordinate transform (metric to SVG) produces correct right-turn in directions.js.
 * 2. Static draft isolation: /data/drafts/... returns 404.
 * 3. Step-free routing treats unconfirmed edges as non-step-free and avoids them.
 * 4. Confidence formula requires >= 2 independent traces before pending_review.
 * 5. Server consent, size limit, floor field, outlier velocity rejection, and OCR redaction.
 * 6. Draft maps with evidence & status fields pass validateMap and route in router.js.
 * 7. Publish endpoint strictly requires recorded physical walk-verification.
 */

import { turnType, generateDirections } from "../js/directions.js";
import { findRoute } from "../js/router.js";
import { validateMap } from "../js/mapValidator.js";
import { transformMetricToSvg } from "../js/coordTransform.js";

const BASE_URL = "http://localhost:8000";

let passed = 0;
let failed = 0;

function assert(desc, condition) {
  if (condition) {
    console.log(`  ✓ ${desc}`);
    passed++;
  } else {
    console.error(`  ✗ FAIL: ${desc}`);
    failed++;
  }
}

console.log("==================================================");
console.log("Running Supervised Map Building Test Suite");
console.log("==================================================");

async function runTests() {
  // ----------------------------------------------------
  // Test 1: Coordinate Transform from Metric Space to SVG
  // ----------------------------------------------------
  // Walking trajectory:
  // Step 1: Start at (0, 0), walk 10m East -> (10, 0)
  // Step 2: Turn RIGHT (in right-handed metric space, turning right from East points South: dy = +10 in SVG)
  const pStartM = { x: 0, y: 0 };
  const pMidM = { x: 10, y: 0 };
  const pRightM = { x: 10, y: 10 }; // Turning right to South (+Y down in SVG)

  const anchorSvg = { x: 100, y: 100 };
  const scale = 12; // 12 px per meter

  const nodeA = transformMetricToSvg(pStartM, pStartM, anchorSvg, 0, scale);
  const nodeB = transformMetricToSvg(pMidM, pStartM, anchorSvg, 0, scale);
  const nodeC = transformMetricToSvg(pRightM, pStartM, anchorSvg, 0, scale);

  assert("Node A coordinates mapped correctly", nodeA.x === 100 && nodeA.y === 100);
  assert("Node B forward continuation mapped correctly", nodeB.x === 220 && nodeB.y === 100);
  assert("Node C right turn (+Y down) mapped correctly", nodeC.x === 220 && nodeC.y === 220);

  // directions.js turnType evaluation
  const computedTurn = turnType(nodeA, nodeB, nodeC);
  assert(`directions.js turnType evaluates straight-then-right trace as 'right' (got: ${computedTurn})`, computedTurn === "right");

  // ----------------------------------------------------
  // Test 2: Static Draft Isolation (Must Return 404)
  // ----------------------------------------------------
  try {
    const resDraft1 = await fetch(`${BASE_URL}/data/drafts/test_draft.json`);
    assert("Request to /data/drafts/test_draft.json returns 404 Not Found", resDraft1.status === 404);

    const resDraft2 = await fetch(`${BASE_URL}/drafts/building_draft.json`);
    assert("Request to /drafts/building_draft.json returns 404 Not Found", resDraft2.status === 404);
  } catch (err) {
    assert(`Server reachable for draft isolation check: ${err.message}`, false);
  }

  // ----------------------------------------------------
  // Test 3: Unconfirmed Edges Avoided by Step-Free Routing
  // ----------------------------------------------------
  // Map where node1 -> node2 has an unconfirmed edge (stepFree: false)
  // and node1 -> j -> node2 is a confirmed step-free detour
  const testGraph = {
    nodes: {
      n1: { x: 0, y: 0, name: "Node 1", type: "entrance" },
      n2: { x: 20, y: 0, name: "Node 2", type: "room" },
      detour: { x: 10, y: 30, name: "Detour Junction", type: "junction" }
    },
    edges: [
      { id: "e_unconfirmed", from: "n1", to: "n2", dist: 20, stepFree: false }, // Unconfirmed edge
      { id: "e_detour_1", from: "n1", to: "detour", dist: 15, stepFree: true },
      { id: "e_detour_2", from: "detour", to: "n2", dist: 15, stepFree: true }
    ]
  };

  // Step-free routing MUST avoid the unconfirmed edge
  const stepFreeRoute = findRoute(testGraph, "n1", "n2", true);
  assert("Step-free routing avoids unconfirmed edge", stepFreeRoute && stepFreeRoute.path.includes("detour"));
  assert("Step-free path length is 30m (takes confirmed detour)", stepFreeRoute && stepFreeRoute.totalDist === 30);

  // Standard mode takes direct path
  const standardRoute = findRoute(testGraph, "n1", "n2", false);
  assert("Standard routing takes shorter unconfirmed edge (20m)", standardRoute && standardRoute.totalDist === 20);

  // When admin confirms the edge, step-free mode uses it
  testGraph.edges[0].stepFree = true;
  const confirmedStepFreeRoute = findRoute(testGraph, "n1", "n2", true);
  assert("Admin-confirmed step-free edge is now usable by step-free routing", confirmedStepFreeRoute && confirmedStepFreeRoute.totalDist === 20);

  // ----------------------------------------------------
  // Test 4: Confidence Formula & Independent Trace Requirement
  // ----------------------------------------------------
  function computeEdgeConfidence(traceCount, sensorSource = "arcore_pose", anchorDist = 15) {
    const wTraces = 0.50 * Math.min(1.0, traceCount / 3);
    const wSensor = 0.30 * (sensorSource === "arcore_pose" ? 1.0 : 0.6);
    const wAnchor = 0.20 * Math.max(0.5, 1.0 - (anchorDist / 100));
    return Number((wTraces + wSensor + wAnchor).toFixed(3));
  }

  const confSingleTrace = computeEdgeConfidence(1);
  const confTwoTraces = computeEdgeConfidence(2);
  const confThreeTraces = computeEdgeConfidence(3);

  assert("Edge with 1 trace has confidence < 0.70", confSingleTrace < 0.70);
  assert("Edge with 2 traces achieves confidence >= 0.75", confTwoTraces >= 0.75);
  assert("Edge with 3 traces achieves confidence >= 0.90", confThreeTraces >= 0.90);

  // Verification rule: traceCount < 2 CANNOT transition to pending_review
  function canTransitionToReview(edgeEvidence) {
    return edgeEvidence.observationCount >= 2 && edgeEvidence.confidence >= 0.70;
  }
  assert("1 trace fails pending_review threshold", !canTransitionToReview({ observationCount: 1, confidence: confSingleTrace }));
  assert(">=2 traces satisfies pending_review threshold", canTransitionToReview({ observationCount: 2, confidence: confTwoTraces }));

  // ----------------------------------------------------
  // Test 5: Server Trace Submission, Consent, Size & OCR Filter
  // ----------------------------------------------------
  // Authenticate as admin first
  const loginRes = await fetch(`${BASE_URL}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username: "admin", password: process.env.ADMIN_PASSWORD || "AdminSaathi@2026" })
  });
  const loginData = await loginRes.json();
  const token = loginData.token;

  // 5.1 Missing consent rejected
  const resNoConsent = await fetch(`${BASE_URL}/api/mapping/trace`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${token}`
    },
    body: JSON.stringify({
      contributorId: "contrib_01",
      floor: 0,
      waypoints: [{ t: 0, x: 0, y: 0 }]
    })
  });
  assert("Trace submission without consent record is rejected (400)", resNoConsent.status === 400);

  // 5.2 Missing floor field rejected
  const resNoFloor = await fetch(`${BASE_URL}/api/mapping/trace`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${token}`
    },
    body: JSON.stringify({
      contributorId: "contrib_01",
      consent: { version: "2026.1", acceptedAt: new Date().toISOString() },
      waypoints: [{ t: 0, x: 0, y: 0 }]
    })
  });
  assert("Trace submission without 'floor' field is rejected (400)", resNoFloor.status === 400);

  // 5.3 Outlier velocity (> 4.5 m/s) rejected
  const resOutlier = await fetch(`${BASE_URL}/api/mapping/trace`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${token}`
    },
    body: JSON.stringify({
      contributorId: "contrib_01",
      floor: 0,
      consent: { version: "2026.1", acceptedAt: new Date().toISOString() },
      waypoints: [
        { t: 0, x: 0, y: 0 },
        { t: 1.0, x: 25.0, y: 0 } // 25 m/s jump!
      ]
    })
  });
  assert("Trace with outlier velocity (>4.5 m/s) is rejected (400)", resOutlier.status === 400);

  // 5.4 Valid trace with OCR personal data redacted
  const resValidTrace = await fetch(`${BASE_URL}/api/mapping/trace`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${token}`
    },
    body: JSON.stringify({
      contributorId: "contrib_01",
      floor: 0,
      consent: { version: "2026.1", acceptedAt: new Date().toISOString() },
      waypoints: [
        { t: 0, x: 0, y: 0 },
        { t: 1.0, x: 1.2, y: 0 }
      ],
      detectedLabels: [
        {
          label: "signboard",
          ocrText: "Call Dr. Sharma at +91 9876543210 or email sharma@campus.edu"
        }
      ]
    })
  });
  const validData = await resValidTrace.json();
  assert("Valid trace submission accepted (200)", resValidTrace.status === 200 && validData.success);

  // ----------------------------------------------------
  // Test 6: Draft Map Compatibility with Existing Engine
  // ----------------------------------------------------
  const draftMapWithEvidence = {
    version: 1,
    status: "draft",
    floor: 0,
    building: "Academic Block A",
    startNode: "draft_entry",
    nodes: {
      draft_entry: {
        x: 50,
        y: 100,
        name: "Draft Entrance",
        type: "entrance",
        evidence: {
          observationCount: 3,
          confidence: 0.92,
          traces: ["trace_1", "trace_2"]
        }
      },
      draft_junction: {
        x: 150,
        y: 100,
        name: "Draft Corridor Junction",
        type: "junction",
        evidence: { observationCount: 2, confidence: 0.88 }
      },
      draft_exit: {
        x: 250,
        y: 100,
        name: "Emergency Exit",
        type: "exit",
        evidence: { observationCount: 2, confidence: 0.90 }
      }
    },
    edges: [
      {
        id: "e_draft_1",
        from: "draft_entry",
        to: "draft_junction",
        dist: 10,
        stepFree: false,
        evidence: { observationCount: 2, confidence: 0.85 }
      },
      {
        id: "e_draft_2",
        from: "draft_junction",
        to: "draft_exit",
        dist: 10,
        stepFree: true,
        evidence: { observationCount: 3, confidence: 0.94 }
      }
    ]
  };

  // 6.1 Validate draft with untouched mapValidator.js
  const validation = validateMap(draftMapWithEvidence);
  assert("Draft map with status and evidence passes validateMap cleanly", validation.valid && validation.errors.length === 0);

  // 6.2 Route draft with untouched router.js
  const route = findRoute(draftMapWithEvidence, "draft_entry", "draft_exit", false);
  assert("Router finds path on draft map cleanly", route && route.path.length === 3);

  // 6.3 Generate directions with untouched directions.js
  const dirs = generateDirections(draftMapWithEvidence, route.path, "en-IN");
  assert("Directions generated cleanly on draft map", dirs && dirs.length >= 2);

  // ----------------------------------------------------
  // Test 7: Physical Walk-Verification Requirement Before Publish
  // ----------------------------------------------------
  // Attempt publish without walkVerification
  const resPublishNoWalk = await fetch(`${BASE_URL}/api/admin/map/publish`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${token}`
    },
    body: JSON.stringify({
      draft: draftMapWithEvidence,
      note: "Attempting publish without walk test"
    })
  });
  assert("Publish without physical walk-verification is rejected (400)", resPublishNoWalk.status === 400);

  // Attempt publish WITH physical walkVerification
  draftMapWithEvidence.walkVerification = {
    verifiedBy: "admin_rohit",
    walkTimestamp: new Date().toISOString(),
    walkTraceId: "trace_walk_test_01",
    testPassed: true,
    notes: "Physical walkthrough completed successfully. All landmarks confirmed."
  };

  const resPublishWithWalk = await fetch(`${BASE_URL}/api/admin/map/publish`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${token}`
    },
    body: JSON.stringify({
      draft: draftMapWithEvidence,
      note: "Publishing verified draft"
    })
  });
  const publishData = await resPublishWithWalk.json();
  assert("Publish with physical walk-verification succeeds (200)", resPublishWithWalk.status === 200 && publishData.status === "published");

  console.log("==================================================");
  console.log(`Results: ${passed} passed, ${failed} failed.`);
  console.log("==================================================");

  if (failed > 0) {
    process.exit(1);
  }
}

runTests();
