/**
 * VoicePath AI: Fuzzy Matching Unit Tests
 * Tests Levenshtein distance, token overlap, Devanagari matches, and abbreviations.
 */

import { matchDestination, parseCommandIntent } from "../js/voice.js";

export function runFuzzyTests(assert) {
  const mapData = {
    nodes: {
      library: {
        name: "Central Library",
        aliases: ["lib", "pustakalay", "books", "पुस्तकालय", "लाइब्रेरी"],
        type: "room"
      },
      comp_lab: {
        name: "Computer Lab 101",
        aliases: ["comp lab", "computer lab", "lab", "कंप्यूटर लैब"],
        type: "room"
      },
      cafeteria: {
        name: "Cafeteria",
        aliases: ["canteen", "cafe", "कैंटीन"],
        type: "room"
      }
    }
  };

  // 1. Slang / abbreviation "lib"
  const m1 = matchDestination("lib", mapData);
  assert.ok(m1.length > 0, "Should match 'lib'");
  assert.equal(m1[0].nodeId, "library", "'lib' should match Central Library");

  // 2. Typo "libary"
  const m2 = matchDestination("libary", mapData);
  assert.ok(m2.length > 0, "Should match typo 'libary'");
  assert.equal(m2[0].nodeId, "library", "'libary' typo should resolve to Central Library");

  // 3. Devanagari Hindi speech transcript "पुस्तकालय"
  const m3 = matchDestination("पुस्तकालय", mapData);
  assert.ok(m3.length > 0, "Should match Devanagari 'पुस्तकालय'");
  assert.equal(m3[0].nodeId, "library", "Devanagari should resolve to Central Library");

  // 4. Token overlap "comp lab"
  const m4 = matchDestination("comp lab", mapData);
  assert.ok(m4.length > 0, "Should match 'comp lab'");
  assert.equal(m4[0].nodeId, "comp_lab", "'comp lab' should resolve to Computer Lab 101");

  // 5. Command Intent Parser
  assert.equal(parseCommandIntent("aage"), "next", "'aage' should parse as 'next'");
  assert.equal(parseCommandIntent("dobara"), "repeat", "'dobara' should parse as 'repeat'");
  assert.equal(parseCommandIntent("kahan hoon"), "where_am_i", "'kahan hoon' should parse as 'where_am_i'");
  assert.equal(parseCommandIntent("ruko"), "stop", "'ruko' should parse as 'stop'");
  assert.equal(parseCommandIntent("guard ko bulao"), "call_guard", "'guard ko bulao' should parse as 'call_guard'");
}
