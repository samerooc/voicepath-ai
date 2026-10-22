/**
 * VoicePath AI: Speech Synthesis, Recognition & Fuzzy Matcher
 * Built for high-reliability assistive usage with screen reader mode, split sentences, and token matching.
 */

import { state, update } from "./state.js";
import { getTemplate } from "./i18n.js";
import { triggerHaptic } from "./haptics.js";

// Cached voice references
let cachedVoices = [];
let recognitionInstance = null;
let isRecognizing = false;

// Initialize voice lists
if (typeof window !== "undefined" && "speechSynthesis" in window) {
  window.speechSynthesis.onvoiceschanged = () => {
    cachedVoices = window.speechSynthesis.getVoices();
  };
  cachedVoices = window.speechSynthesis.getVoices();
}

/**
 * Speaks text using SpeechSynthesis with Chrome cut-off protection and screen reader safety.
 * @param {string} text
 * @param {string} [lang] - "hi-IN" or "en-IN"
 * @param {Function} [onEnd]
 */
export function speak(text, lang = state.language, onEnd = null) {
  if (!text || typeof window === "undefined") return;

  // Screen reader mode bypass: don't talk over screen readers
  if (state.screenReaderMode) {
    announceAriaLive(text, true);
    if (onEnd) setTimeout(onEnd, 200);
    return;
  }

  // Always update aria-live for accessibility tools
  announceAriaLive(text, false);

  // Native Android TextToSpeech engine bridge
  if (typeof window !== "undefined" && window.AndroidNative && typeof window.AndroidNative.speak === "function") {
    try {
      window.AndroidNative.speak(text, lang);
      if (onEnd) setTimeout(onEnd, Math.max(800, text.length * 60));
      return;
    } catch (e) {
      console.warn("[Voice] Native TTS fallback to Web Speech:", e);
    }
  }

  if (!("speechSynthesis" in window)) {
    console.warn("[Voice] SpeechSynthesis unsupported on this browser.");
    if (onEnd) onEnd();
    return;
  }

  // Cancel any ongoing utterance before starting a new one
  window.speechSynthesis.cancel();

  // Split into sentences under 180 chars to avoid Chrome TTS cutoff bug
  const sentences = splitIntoSentences(text, 180);
  if (sentences.length === 0) return;

  update({ speaking: true });

  let currentIndex = 0;

  function speakNextChunk() {
    if (currentIndex >= sentences.length) {
      update({ speaking: false });
      if (onEnd) onEnd();
      return;
    }

    const chunk = sentences[currentIndex];
    const utterance = new SpeechSynthesisUtterance(chunk);
    utterance.lang = lang;
    utterance.rate = state.speechRate || 1.0;

    // Pick best matching voice
    const voice = pickVoice(lang);
    if (voice) utterance.voice = voice;

    utterance.onend = () => {
      currentIndex++;
      speakNextChunk();
    };

    utterance.onerror = (e) => {
      console.warn("[Voice] Speech error:", e);
      currentIndex++;
      speakNextChunk();
    };

    window.speechSynthesis.speak(utterance);
  }

  speakNextChunk();
}

/**
 * Stops any active speech synthesis immediately.
 */
export function cancelSpeech() {
  if (typeof window !== "undefined" && window.AndroidNative && typeof window.AndroidNative.stopSpeech === "function") {
    try {
      window.AndroidNative.stopSpeech();
    } catch (e) {}
  }
  if (typeof window !== "undefined" && "speechSynthesis" in window) {
    window.speechSynthesis.cancel();
    update({ speaking: false });
  }
}

/**
 * Splits a long string into clauses under maxLength characters.
 */
function splitIntoSentences(text, maxLength = 180) {
  if (text.length <= maxLength) return [text];
  const parts = text.split(/([।?!.,;]+|\n)/);
  const chunks = [];
  let current = "";

  for (const part of parts) {
    if ((current + part).length > maxLength && current.trim().length > 0) {
      chunks.push(current.trim());
      current = part;
    } else {
      current += part;
    }
  }
  if (current.trim().length > 0) chunks.push(current.trim());
  return chunks;
}

/**
 * Selects an appropriate system voice for the given language.
 */
function pickVoice(lang) {
  if (!cachedVoices || cachedVoices.length === 0) {
    cachedVoices = window.speechSynthesis.getVoices();
  }
  const prefix = lang.slice(0, 2).toLowerCase();

  // Exact match first e.g. hi-IN
  let match = cachedVoices.find(v => v.lang.toLowerCase() === lang.toLowerCase());
  if (match) return match;

  // Language family match e.g. hi or en
  match = cachedVoices.find(v => v.lang.toLowerCase().startsWith(prefix));
  if (match) return match;

  // Default fallback
  return cachedVoices[0] || null;
}

/**
 * Pushes text to the visually-hidden screen reader region.
 */
export function announceAriaLive(text, assertive = false) {
  const elId = assertive ? "sr-announcements-assertive" : "sr-announcements-polite";
  const el = document.getElementById(elId);
  if (el) {
    el.textContent = "";
    setTimeout(() => {
      el.textContent = text;
    }, 50);
  }
}

/**
 * Starts a push-to-talk voice recognition session.
 * @param {Function} onTranscript - callback receiving { transcript, isFinal }
 * @param {Function} onError - callback receiving error object
 */
export function startListening(onTranscript, onError) {
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

  if (!SpeechRecognition) {
    const err = new Error("Speech recognition not supported in this browser.");
    if (onError) onError(err);
    speak("Voice input is not supported in this browser. Please use the buttons.", state.language);
    return;
  }

  if (isRecognizing && recognitionInstance) {
    try { recognitionInstance.stop(); } catch (e) {}
  }

  cancelSpeech(); // Don't listen while speaking
  triggerHaptic("click");

  recognitionInstance = new SpeechRecognition();
  recognitionInstance.lang = state.language;
  recognitionInstance.continuous = false;
  recognitionInstance.interimResults = false;
  recognitionInstance.maxAlternatives = 3;

  recognitionInstance.onstart = () => {
    isRecognizing = true;
    update({ listening: true });
  };

  recognitionInstance.onresult = (event) => {
    if (event.results && event.results.length > 0) {
      const topResult = event.results[0][0].transcript;
      const confidence = event.results[0][0].confidence;
      if (onTranscript) onTranscript(topResult, confidence);
    }
  };

  recognitionInstance.onerror = (event) => {
    isRecognizing = false;
    update({ listening: false });
    console.warn("[VoiceInput] Recognition error:", event.error);
    if (onError) onError(event);
  };

  recognitionInstance.onend = () => {
    isRecognizing = false;
    update({ listening: false });
  };

  try {
    recognitionInstance.start();
  } catch (err) {
    isRecognizing = false;
    update({ listening: false });
    if (onError) onError(err);
  }
}

/**
 * Stops any active listening.
 */
export function stopListening() {
  if (recognitionInstance && isRecognizing) {
    try {
      recognitionInstance.stop();
    } catch (e) {}
  }
  isRecognizing = false;
  update({ listening: false });
}

// -------------------------------------------------------------
// Fuzzy Matcher & NLP Utilities
// -------------------------------------------------------------

/**
 * Normalizes input text: lowercase, remove punctuation, keep Devanagari.
 */
export function normalizeText(text) {
  if (!text) return "";
  return String(text)
    .toLowerCase()
    .replace(/[.,/#!$%^&*;:{}=\-_`~()?"'|[\]\\]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Calculates Levenshtein edit distance.
 */
export function levenshteinDistance(s1, s2) {
  const m = s1.length;
  const n = s2.length;
  const dp = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));

  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost = s1[i - 1] === s2[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(
        dp[i - 1][j] + 1,       // deletion
        dp[i][j - 1] + 1,       // insertion
        dp[i - 1][j - 1] + cost // substitution
      );
    }
  }
  return dp[m][n];
}

/**
 * Matches a query against destination rooms in the map.
 * Returns sorted array of candidate matches: [{ nodeId, node, score, matchedOn }]
 * @param {string} query
 * @param {Object} map
 * @returns {Array<{ nodeId: string, node: Object, score: number, matchedOn: string }>}
 */
export function matchDestination(query, map) {
  if (!query || !map || !map.nodes) return [];

  const cleanQuery = normalizeText(query);
  const queryTokens = cleanQuery.split(" ");
  const results = [];

  for (const [nodeId, node] of Object.entries(map.nodes)) {
    // Only search destinations (rooms, help points, exits, lifts, stairs)
    if (node.type === "junction") continue;

    const termsToTest = [
      node.name,
      nodeId,
      ...(node.aliases || [])
    ];

    let bestScoreForNode = 0;
    let bestMatchedTerm = "";

    for (const rawTerm of termsToTest) {
      const term = normalizeText(rawTerm);
      if (!term) continue;

      let score = 0;

      // Exact match
      if (cleanQuery === term) {
        score = 1.0;
      }
      // Substring match
      else if (cleanQuery.includes(term) || term.includes(cleanQuery)) {
        score = 0.85;
      }
      // Token overlap
      else {
        const termTokens = term.split(" ");
        let matchingTokens = 0;
        for (const qt of queryTokens) {
          if (termTokens.some(tt => tt.includes(qt) || qt.includes(tt))) {
            matchingTokens++;
          }
        }
        if (matchingTokens > 0) {
          score = Math.max(score, 0.6 + (0.3 * (matchingTokens / Math.max(queryTokens.length, termTokens.length))));
        }

        // Levenshtein similarity on words > 3 characters
        if (cleanQuery.length >= 3 && term.length >= 3) {
          const maxLen = Math.max(cleanQuery.length, term.length);
          const dist = levenshteinDistance(cleanQuery, term);
          const levScore = 1.0 - (dist / maxLen);
          if (levScore > 0.6) {
            score = Math.max(score, levScore);
          }
        }
      }

      if (score > bestScoreForNode) {
        bestScoreForNode = score;
        bestMatchedTerm = rawTerm;
      }
    }

    if (bestScoreForNode >= 0.5) {
      results.push({
        nodeId,
        node,
        score: bestScoreForNode,
        matchedOn: bestMatchedTerm
      });
    }
  }

  // Sort descending by score
  results.sort((a, b) => b.score - a.score);
  return results;
}

/**
 * Checks if a phrase matches known navigation or control commands.
 * @param {string} text
 * @returns {string | null} command intent name
 */
export function parseCommandIntent(text) {
  const norm = normalizeText(text);

  if (/^(next|aage|agla|agle|forward|chalo)$/i.test(norm)) return "next";
  if (/^(repeat|dobara|phir se|fir se|phir|fir)$/i.test(norm)) return "repeat";
  if (/^(where am i|kahan hoon|main kahan hoon|location|position)$/i.test(norm)) return "where_am_i";
  if (/^(stop|ruko|rok do|band karo|cancel)$/i.test(norm)) return "stop";
  if (/^(nearest exit|exit|emergency exit|nikasi|bahar)$/i.test(norm)) return "nearest_exit";
  if (/^(nearest help|help point|madad|reception|inquiry)$/i.test(norm)) return "nearest_help";
  if (/^(call guard|guard|security|guard ko bulao|suraksha)$/i.test(norm)) return "call_guard";
  if (/^(step free on|step free|seedhi nahi|wheelchair|no stairs)$/i.test(norm)) return "step_free_on";
  if (/^(step free off|seedhi chalu|with stairs)$/i.test(norm)) return "step_free_off";
  if (/^(hindi|hindi bolo|shuddh hindi)$/i.test(norm)) return "lang_hindi";
  if (/^(english|speak english)$/i.test(norm)) return "lang_english";
  if (/^(raasta band hai|path blocked|blocked|report|problem)$/i.test(norm)) return "report_problem";
  if (/^(haan|yes|ha|sahi|theek|confirm)$/i.test(norm)) return "confirm_yes";
  if (/^(nahi|no|na|galat|cancel)$/i.test(norm)) return "confirm_no";

  return null;
}
