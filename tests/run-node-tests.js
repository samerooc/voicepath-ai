/**
 * Node.js Command Line Test Runner
 */

import { runRouterTests } from "./router.test.js";
import { runDirectionsTests } from "./directions.test.js";
import { runFuzzyTests } from "./fuzzy.test.js";
import { runMapValidatorTests } from "./mapValidator.test.js";

let total = 0;
let passed = 0;
let failed = 0;

function createAssert(suiteName) {
  return {
    ok(val, desc = "Assertion passed") {
      total++;
      if (val) {
        passed++;
        console.log(`  ✓ [${suiteName}] ${desc}`);
      } else {
        failed++;
        console.error(`  ✗ [${suiteName}] FAIL: ${desc}`);
      }
    },
    equal(actual, expected, desc = "Equal assertion") {
      total++;
      if (actual === expected) {
        passed++;
        console.log(`  ✓ [${suiteName}] ${desc}`);
      } else {
        failed++;
        console.error(`  ✗ [${suiteName}] FAIL: ${desc} (Expected ${expected}, got ${actual})`);
      }
    },
    deepEqual(actual, expected, desc = "Deep equal assertion") {
      total++;
      const sAct = JSON.stringify(actual);
      const sExp = JSON.stringify(expected);
      if (sAct === sExp) {
        passed++;
        console.log(`  ✓ [${suiteName}] ${desc}`);
      } else {
        failed++;
        console.error(`  ✗ [${suiteName}] FAIL: ${desc}\n    Expected: ${sExp}\n    Got:      ${sAct}`);
      }
    }
  };
}

console.log("=========================================");
console.log("VoicePath AI: Running Automated Test Suite");
console.log("=========================================");

runRouterTests(createAssert("Router"));
runDirectionsTests(createAssert("Directions"));
runFuzzyTests(createAssert("Fuzzy Matcher"));
runMapValidatorTests(createAssert("Map Validator"));

console.log("=========================================");
if (failed === 0) {
  console.log(`SUCCESS: All ${passed} assertions PASSED cleanly! (0 failures)`);
  process.exit(0);
} else {
  console.error(`FAILURE: ${failed} assertions FAILED out of ${total}`);
  process.exit(1);
}
