/**
 * VoicePath AI: Graph Router (Dijkstra's Algorithm)
 * Zero external dependencies. High performance pathfinding supporting blocked edge avoidance and step-free filters.
 */

/**
 * Computes shortest path from startNodeId to destinationNodeId.
 * @param {Object} map
 * @param {string} startNodeId
 * @param {string} destNodeId
 * @param {boolean} stepFree - if true, skips edges where stepFree is false
 * @returns {{ path: string[], totalDist: number, edgeList: Object[] } | null}
 */
export function findRoute(map, startNodeId, destNodeId, stepFree = false) {
  if (!map || !map.nodes) return null;
  if (!map.nodes[startNodeId] || !map.nodes[destNodeId]) return null;

  // If already at destination
  if (startNodeId === destNodeId) {
    return {
      path: [startNodeId],
      totalDist: 0,
      edgeList: []
    };
  }

  // Ensure adjacency is built
  const adj = map.adjacency || buildAdjacencyFromMap(map);

  const distances = new Map();
  const previous = new Map();
  const unvisited = new Set(Object.keys(map.nodes));

  for (const nodeId of unvisited) {
    distances.set(nodeId, Infinity);
  }
  distances.set(startNodeId, 0);

  while (unvisited.size > 0) {
    // Find unvisited node with minimum distance
    let current = null;
    let shortestDist = Infinity;
    for (const nodeId of unvisited) {
      const d = distances.get(nodeId);
      if (d < shortestDist) {
        shortestDist = d;
        current = nodeId;
      }
    }

    if (current === null || shortestDist === Infinity) {
      break; // Remaining nodes are unreachable
    }

    if (current === destNodeId) {
      break; // Reached target
    }

    unvisited.delete(current);

    const neighbors = adj.get(current) || [];
    for (const edge of neighbors) {
      if (!unvisited.has(edge.to)) continue;

      // Filter blocked edges
      if (edge.blocked) continue;

      // Filter non-step-free edges when stepFree is requested
      if (stepFree && !edge.stepFree) continue;

      const alt = shortestDist + edge.dist;
      if (alt < distances.get(edge.to)) {
        distances.set(edge.to, alt);
        previous.set(edge.to, { from: current, edge });
      }
    }
  }

  // Check if destination was reached
  if (distances.get(destNodeId) === Infinity) {
    return null; // No route available
  }

  // Reconstruct path
  const path = [];
  const edgeList = [];
  let curr = destNodeId;

  while (curr !== startNodeId) {
    path.unshift(curr);
    const prevEntry = previous.get(curr);
    if (!prevEntry) break;
    edgeList.unshift(prevEntry.edge);
    curr = prevEntry.from;
  }
  path.unshift(startNodeId);

  return {
    path,
    totalDist: distances.get(destNodeId),
    edgeList
  };
}

/**
 * Finds the nearest help point or exit from a given start node.
 * @param {Object} map
 * @param {string} startNodeId
 * @param {boolean} stepFree
 * @param {string} [preferredType] - "help_point" or "exit"
 * @returns {{ targetNodeId: string, route: Object } | null}
 */
export function findNearestHelpPoint(map, startNodeId, stepFree = false, preferredType = "help_point") {
  if (!map || !map.nodes) return null;

  const candidateNodes = Object.entries(map.nodes).filter(([id, n]) => {
    if (id === startNodeId) return false;
    if (preferredType) {
      return n.type === preferredType || (preferredType === "help_point" && n.type === "exit");
    }
    return n.type === "help_point" || n.type === "exit";
  });

  let bestRoute = null;
  let bestTarget = null;
  let minDistance = Infinity;

  for (const [candId] of candidateNodes) {
    const route = findRoute(map, startNodeId, candId, stepFree);
    if (route && route.totalDist < minDistance) {
      minDistance = route.totalDist;
      bestRoute = route;
      bestTarget = candId;
    }
  }

  if (bestTarget && bestRoute) {
    return { targetNodeId: bestTarget, route: bestRoute };
  }
  return null;
}

function buildAdjacencyFromMap(map) {
  const adj = new Map();
  for (const nid of Object.keys(map.nodes || {})) adj.set(nid, []);
  for (const edge of (map.edges || [])) {
    if (!map.nodes[edge.from] || !map.nodes[edge.to]) continue;
    const dist = Math.max(1, Math.round(Number(edge.dist) || 1));
    adj.get(edge.from).push({ to: edge.to, dist, blocked: !!edge.blocked, stepFree: edge.stepFree !== false, edgeId: edge.id, reason: edge.reason });
    adj.get(edge.to).push({ to: edge.from, dist, blocked: !!edge.blocked, stepFree: edge.stepFree !== false, edgeId: edge.id, reason: edge.reason });
  }
  return adj;
}
