/**
 * VoicePath AI: Map Loader & Storage Manager
 * Loads bundled map, handles localStorage version overrides, and generates bidirectional adjacency graphs.
 */

import { validateMap } from "./mapValidator.js";

export const LOCAL_STORAGE_KEY = "voicepath_map_data";

/**
 * Loads the map data, checking for localStorage overrides.
 * @param {string} url - default URL to bundled map.json
 * @returns {Promise<{ map: Object, source: string, warnings: string[], isOutdated: boolean }>}
 */
export async function loadMap(url = "data/map.json") {
  let bundledMap = null;
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status} loading ${url}`);
    bundledMap = await res.json();
  } catch (err) {
    console.warn("[MapLoader] Failed to fetch map file, trying localStorage fallback:", err);
  }

  let localMap = null;
  try {
    const stored = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (stored) localMap = JSON.parse(stored);
  } catch (err) {
    console.warn("[MapLoader] Corrupt map in localStorage, discarding:", err);
    localStorage.removeItem(LOCAL_STORAGE_KEY);
  }

  let chosenMap = bundledMap;
  let source = "bundled";

  if (localMap && bundledMap) {
    // If stored version is newer or equal, use it.
    if ((localMap.version || 0) >= (bundledMap.version || 0)) {
      chosenMap = localMap;
      source = "localStorage";
    } else {
      console.info("[MapLoader] Bundled map is newer than localStorage version. Using bundled.");
    }
  } else if (localMap && !bundledMap) {
    chosenMap = localMap;
    source = "localStorage";
  }

  if (!chosenMap) {
    throw new Error("Unable to load indoor map data.");
  }

  // Validate the chosen map
  const validation = validateMap(chosenMap);
  if (!validation.valid) {
    console.error("[MapLoader] Loaded map has validation errors:", validation.errors);
    // If local was invalid, fall back to bundled
    if (source === "localStorage" && bundledMap) {
      console.warn("[MapLoader] Falling back to bundled map due to local validation errors.");
      chosenMap = bundledMap;
      source = "bundled-fallback";
    }
  }

  // Check lastUpdated date (warn if > 30 days old)
  let isOutdated = false;
  if (chosenMap.lastUpdated) {
    const updatedTime = new Date(chosenMap.lastUpdated).getTime();
    const diffDays = (Date.now() - updatedTime) / (1000 * 60 * 60 * 24);
    if (diffDays > 30) {
      isOutdated = true;
    }
  }

  // Pre-process adjacency list (bidirectional edges)
  const adjacency = buildAdjacency(chosenMap);
  chosenMap.adjacency = adjacency;

  return {
    map: chosenMap,
    source,
    warnings: validation.warnings,
    isOutdated
  };
}

/**
 * Builds bidirectional adjacency graph from map edges.
 * @param {Object} map
 * @returns {Map<string, Array<{ to: string, dist: number, blocked: boolean, stepFree: boolean, edgeId: string, reason: string }>>}
 */
export function buildAdjacency(map) {
  const adj = new Map();
  for (const nid of Object.keys(map.nodes || {})) {
    adj.set(nid, []);
  }

  const edges = Array.isArray(map.edges) ? map.edges : [];
  for (const edge of edges) {
    if (!map.nodes[edge.from] || !map.nodes[edge.to]) continue;
    const dist = Math.max(1, Math.round(Number(edge.dist) || 1));
    const blocked = Boolean(edge.blocked);
    const stepFree = edge.stepFree !== false; // defaults to true
    const reason = edge.reason || "";

    adj.get(edge.from).push({
      to: edge.to,
      dist,
      blocked,
      stepFree,
      edgeId: edge.id,
      reason
    });

    // Bidirectional
    adj.get(edge.to).push({
      to: edge.from,
      dist,
      blocked,
      stepFree,
      edgeId: edge.id,
      reason
    });
  }

  return adj;
}

/**
 * Persists an edited map to localStorage with validation.
 * @param {Object} map
 */
export function saveMapToStorage(map) {
  const check = validateMap(map);
  if (!check.valid) {
    throw new Error("Cannot save invalid map:\n" + check.errors.join("\n"));
  }
  map.version = (map.version || 1) + 1;
  map.lastUpdated = new Date().toISOString().slice(0, 10);
  localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(map));
  return map;
}

/**
 * Clears localStorage override.
 */
export function resetMapToDefault() {
  localStorage.removeItem(LOCAL_STORAGE_KEY);
}
