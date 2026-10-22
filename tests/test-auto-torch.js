/**
 * Automated Test: Auto-Torch Darkness Detection Logic
 * Verifies luminance math, darkness triggers, and lighting restoration thresholds.
 */

function computeMeanLuminance(framePixels) {
  let totalLuminance = 0;
  let totalSamples = 0;

  for (let i = 0; i < framePixels.length; i += 4) {
    const r = framePixels[i];
    const g = framePixels[i + 1];
    const b = framePixels[i + 2];
    const lum = 0.299 * r + 0.587 * g + 0.114 * b;
    totalLuminance += lum;
    totalSamples++;
  }

  return totalSamples > 0 ? totalLuminance / totalSamples : 128;
}

const DARK_THRESHOLD = 35;
const LIGHT_RESTORED_THRESHOLD = 70;

console.log("==================================================");
console.log("Running Auto-Torch Darkness Detection Test Suite");
console.log("==================================================");

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

// 1. Dark Room Simulation (RGB: 10, 10, 12 -> pitch dark / night)
const darkPixels = new Uint8Array([10, 10, 12, 255, 12, 10, 11, 255, 8, 9, 10, 255]);
const darkLum = computeMeanLuminance(darkPixels);
assert(`Dark room luminance (${darkLum.toFixed(1)}) must be below DARK_THRESHOLD (${DARK_THRESHOLD})`, darkLum < DARK_THRESHOLD);

// 2. Brightly Lit Room Simulation (RGB: 180, 190, 175)
const brightPixels = new Uint8Array([180, 190, 175, 255, 185, 195, 170, 255]);
const brightLum = computeMeanLuminance(brightPixels);
assert(`Bright room luminance (${brightLum.toFixed(1)}) must be above LIGHT_RESTORED_THRESHOLD (${LIGHT_RESTORED_THRESHOLD})`, brightLum > LIGHT_RESTORED_THRESHOLD);

// 3. State Machine Transition Simulation
let torchActive = false;
let darkCount = 0;
let lightCount = 0;

function onFrame(lum) {
  if (lum < DARK_THRESHOLD) {
    darkCount++;
    lightCount = 0;
    if (darkCount >= 3 && !torchActive) {
      torchActive = true;
      return "TORCH_TURNED_ON";
    }
  } else if (lum > LIGHT_RESTORED_THRESHOLD) {
    lightCount++;
    darkCount = 0;
    if (lightCount >= 6 && torchActive) {
      torchActive = false;
      return "TORCH_TURNED_OFF";
    }
  }
  return "NO_CHANGE";
}

// Single dark frame should not trigger (avoids sudden shadows)
assert(`Frame 1 of darkness should not turn torch on immediately`, onFrame(15) === "NO_CHANGE");
assert(`Frame 2 of darkness should not turn torch on immediately`, onFrame(18) === "NO_CHANGE");
assert(`Frame 3 of sustained darkness MUST activate torch`, onFrame(20) === "TORCH_TURNED_ON");
assert(`Torch state is now active`, torchActive === true);

// Sudden flash of light for 1 frame should not turn off torch
assert(`Frame 1 of light should not turn off torch immediately (hysteresis protection)`, onFrame(100) === "NO_CHANGE");
assert(`Frame 2 of light`, onFrame(105) === "NO_CHANGE");
assert(`Frame 3 of light`, onFrame(110) === "NO_CHANGE");
assert(`Frame 4 of light`, onFrame(115) === "NO_CHANGE");
assert(`Frame 5 of light`, onFrame(120) === "NO_CHANGE");
assert(`Frame 6 of sustained light MUST turn torch OFF to save battery`, onFrame(125) === "TORCH_TURNED_OFF");
assert(`Torch state is now inactive`, torchActive === false);

console.log("==================================================");
console.log(`Auto-Torch Tests: ${passed} passed, ${failed} failed.`);
console.log("==================================================");

if (failed > 0) process.exit(1);
