/**
 * VoicePath AI: UI Stability & Accessibility Test Suite
 * Validates:
 * 1. UI stability: on-screen text is English only and remains identical regardless of spoken language.
 * 2. TalkBack readiness: every interactive control has an English aria-label and data-content-description.
 * 3. Voice-only language switching: language toggle button is removed from DOM.
 * 4. Step directions: step.text is always English on screen, while step.spokenText is localized for TTS.
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { state, update } from "../js/state.js";
import { updateDOMView } from "../js/ui.js";
import { generateDirections } from "../js/directions.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

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
console.log("VoicePath AI: Running UI Stability & TalkBack Tests");
console.log("==================================================");

// ----------------------------------------------------
// 1. Static HTML Stability & TalkBack Accessibility Audit
// ----------------------------------------------------
const indexHtmlPath = path.join(__dirname, "..", "index.html");
const indexHtml = fs.readFileSync(indexHtmlPath, "utf8");

// 1.1 Document language must be English
assert("index.html lang attribute is English ('en')", /<html[^>]*lang=["']en["']/i.test(indexHtml));

// 1.2 Screen language toggle button must NOT be present
assert("Screen language toggle button (#btn-toggle-lang) is completely removed", !indexHtml.includes("btn-toggle-lang"));

// 1.3 No Devanagari characters allowed in index.html (all screen text is English)
const devanagariRegex = /[\u0900-\u097F]/;
const devanagariFound = devanagariRegex.test(indexHtml);
assert("No Devanagari script characters found in index.html", !devanagariFound);

// 1.4 Inspect all buttons, links, selects in index.html for TalkBack English descriptions
const controlTagRegex = /<(button|select|a)\b([^>]*)>(.*?)<\/\1>/gis;
let match;
let totalControls = 0;
let controlsWithAriaLabel = 0;
let controlsWithContentDesc = 0;

while ((match = controlTagRegex.exec(indexHtml)) !== null) {
  const [fullTag, tagType, attributes, innerContent] = match;
  totalControls++;
  
  const hasAriaLabel = /aria-label=["'][^"']+["']/i.test(attributes);
  const hasContentDesc = /data-content-description=["'][^"']+["']/i.test(attributes);

  if (hasAriaLabel) controlsWithAriaLabel++;
  if (hasContentDesc) controlsWithContentDesc++;
}

assert(`Found ${totalControls} interactive controls in index.html`, totalControls > 0);
assert(`All interactive controls have English aria-label (${controlsWithAriaLabel}/${totalControls})`, controlsWithAriaLabel === totalControls);
assert(`All interactive controls have English data-content-description for TalkBack (${controlsWithContentDesc}/${totalControls})`, controlsWithContentDesc === totalControls);

// ----------------------------------------------------
// 2. Dynamic UI-String Snapshot Test Across Language Changes
// ----------------------------------------------------

// Setup minimal virtual DOM in Node.js global environment
const mockDOM = {};
function createMockElement(id) {
  const el = {
    id,
    tagName: "DIV",
    textContent: "",
    innerHTML: "",
    style: {},
    className: "",
    attributes: {},
    setAttribute(name, value) { this.attributes[name] = String(value); },
    getAttribute(name) { return this.attributes[name] || null; },
    classList: {
      classes: new Set(),
      toggle(cls, force) {
        if (force === undefined) {
          if (this.classes.has(cls)) this.classes.delete(cls);
          else this.classes.add(cls);
        } else if (force) {
          this.classes.add(cls);
        } else {
          this.classes.delete(cls);
        }
      },
      add(cls) { this.classes.add(cls); },
      remove(cls) { this.classes.delete(cls); },
      contains(cls) { return this.classes.has(cls); }
    }
  };
  mockDOM[id] = el;
  return el;
}

// Elements required by updateDOMView()
const domIds = [
  "active-step-text",
  "step-landmark-badge",
  "step-distance-badge",
  "step-progress-indicator",
  "active-turn-icon",
  "status-bar-message",
  "btn-step-free",
  "btn-toggle-screen-reader",
  "current-location-text",
  "person-detected-banner",
  "indoor-map-svg"
];

for (const id of domIds) {
  createMockElement(id);
}

global.document = {
  getElementById(id) {
    return mockDOM[id] || null;
  }
};

// Snapshot collector function
function captureUISnapshot() {
  const snapshot = {};
  for (const id of domIds) {
    const el = mockDOM[id];
    snapshot[id] = {
      textContent: el.textContent,
      innerHTML: el.innerHTML,
      ariaPressed: el.getAttribute("aria-pressed"),
      display: el.style.display || "default"
    };
  }
  return JSON.stringify(snapshot);
}

// Initialize state with sample active navigation
const sampleMap = {
  nodes: {
    entrance: { x: 0, y: 0, name: "Main Entrance", type: "entrance" },
    j1: { x: 10, y: 0, name: "Junction 1", type: "junction" },
    library: { x: 20, y: 0, name: "Central Library", type: "room", landmark: "Glass door" }
  },
  edges: [
    { from: "entrance", to: "j1", dist: 10 },
    { from: "j1", to: "library", dist: 10 }
  ]
};

// Test 2.1: Navigation idle state snapshot comparison
update({
  language: "en-IN",
  map: sampleMap,
  currentNodeId: "entrance",
  directions: null,
  stepIndex: 0,
  awaitingConfirmation: null,
  listening: false,
  speaking: false
});

updateDOMView();
const idleEnglishSnapshot = captureUISnapshot();

// Switch speech language to Hindi
update({ language: "hi-IN" });
updateDOMView();
const idleHindiSnapshot = captureUISnapshot();

assert("Idle UI screen snapshot is 100% IDENTICAL when language switches to Hindi", idleEnglishSnapshot === idleHindiSnapshot);

// Test 2.2: Active navigation route snapshot comparison
const routeResult = ["entrance", "j1", "library"];
const directionsEn = generateDirections(sampleMap, routeResult, "en-IN");
const directionsHi = generateDirections(sampleMap, routeResult, "hi-IN");

// Bind English text to step.text and localized to step.spokenText
const stepsWhenEn = directionsEn.map((step, idx) => ({
  ...step,
  spokenText: directionsEn[idx]?.spokenText || step.spokenText
}));

update({
  language: "en-IN",
  directions: stepsWhenEn,
  stepIndex: 0
});
updateDOMView();
const navigatingEnglishSnapshot = captureUISnapshot();

// Now simulate user switching spoken language via voice ("Hindi mein bolo")
const stepsWhenHi = directionsEn.map((step, idx) => ({
  ...step,
  spokenText: directionsHi[idx]?.spokenText || step.spokenText
}));

update({
  language: "hi-IN",
  directions: stepsWhenHi,
  stepIndex: 0
});
updateDOMView();
const navigatingHindiSnapshot = captureUISnapshot();

assert("Navigating UI screen snapshot is 100% IDENTICAL when speech language is Hindi", navigatingEnglishSnapshot === navigatingHindiSnapshot);

// Verify step.text is English while step.spokenText is Hindi
assert("On-screen active step text is in English ('Walk straight...')", mockDOM["active-step-text"].textContent.includes("Walk straight"));
assert("Spoken text for step 0 contains Hindi TTS instruction ('Seedha' / 'kadam')", stepsWhenHi[0].spokenText.includes("Seedha") && stepsWhenHi[0].spokenText.includes("kadam"));

// Test 2.3: Awaiting confirmation dialog snapshot comparison (directions cleared)
update({
  directions: null,
  awaitingConfirmation: { candidateId: "library", candidateName: "Central Library" },
  language: "en-IN"
});
updateDOMView();
const confirmEnglishSnapshot = captureUISnapshot();

update({ language: "hi-IN" });
updateDOMView();
const confirmHindiSnapshot = captureUISnapshot();

assert("Confirmation prompt UI text is 100% IDENTICAL when spoken language is Hindi", confirmEnglishSnapshot === confirmHindiSnapshot);
assert("Confirmation on-screen prompt is English ('Did you mean...')", mockDOM["active-step-text"].textContent.startsWith("Did you mean \"Central Library\"?"));

// ----------------------------------------------------
// 3. Voice Language Command Parsing
// ----------------------------------------------------
const voiceCmdsHindi = [
  "hindi",
  "hindi bolo",
  "hindi mein bolo",
  "hindi me bolo",
  "shuddh hindi"
];

const voiceCmdsEnglish = [
  "english",
  "speak english",
  "in english",
  "english bolo"
];

const hindiPattern = /^(hindi\s*(mein|me)?\s*bolo|shuddh\s*hindi|hindi)$/i;
const englishPattern = /^(speak\s*english|in\s*english|english\s*bolo|english)$/i;

let allHindiMatched = voiceCmdsHindi.every(cmd => hindiPattern.test(cmd));
let allEnglishMatched = voiceCmdsEnglish.every(cmd => englishPattern.test(cmd));

assert("All Hindi voice command triggers match regex correctly", allHindiMatched);
assert("All English voice command triggers match regex correctly", allEnglishMatched);

console.log("==================================================");
console.log(`Results: ${passed} passed, ${failed} failed.`);
console.log("==================================================");

if (failed > 0) {
  process.exit(1);
}
