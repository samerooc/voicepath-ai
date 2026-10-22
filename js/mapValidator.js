/**
 * VoicePath AI: Map Validator
 * Validates map graph integrity against safety and routing specs.
 */

export function validateMap(mapData) {
  const errors = [];
  const warnings = [];

  if (!mapData || typeof mapData !== "object") {
    return { valid: false, errors: ["Map data is missing or not a valid JSON object."], warnings: [] };
  }

  if (!mapData.nodes || typeof mapData.nodes !== "object" || Object.keys(mapData.nodes).length === 0) {
    errors.push("Map has no nodes defined.");
    return { valid: false, errors, warnings };
  }

  const nodes = mapData.nodes;
  const edges = Array.isArray(mapData.edges) ? mapData.edges : [];

  // 1. Verify startNode
  if (!mapData.startNode || !nodes[mapData.startNode]) {
    errors.push(`startNode "${mapData.startNode}" does not exist in nodes dictionary.`);
  }

  // 2. Validate node properties and types
  const validTypes = new Set(["room", "junction", "entrance", "exit", "stairs", "lift", "help_point"]);
  let hasExit = false;
  let hasHelpPoint = false;
  const seenAliases = new Map();

  for (const [nodeId, node] of Object.entries(nodes)) {
    if (!node.name || typeof node.name !== "string") {
      errors.push(`Node "${nodeId}" has an invalid or empty name.`);
    }

    if (!validTypes.has(node.type)) {
      warnings.push(`Node "${nodeId}" has unfamiliar type "${node.type}". Expected one of: ${Array.from(validTypes).join(", ")}`);
    }

    if (node.type === "exit") hasExit = true;
    if (node.type === "help_point") hasHelpPoint = true;

    if (typeof node.x !== "number" || typeof node.y !== "number") {
      errors.push(`Node "${nodeId}" has invalid coordinates (x: ${node.x}, y: ${node.y}).`);
    }

    if (Array.isArray(node.aliases)) {
      for (const rawAlias of node.aliases) {
        const alias = String(rawAlias).trim().toLowerCase();
        if (!alias) continue;
        if (seenAliases.has(alias) && seenAliases.get(alias) !== nodeId) {
          warnings.push(`Alias collision: "${alias}" is used by both "${seenAliases.get(alias)}" and "${nodeId}".`);
        } else {
          seenAliases.set(alias, nodeId);
        }
      }
    }
  }

  if (!hasExit) {
    errors.push("Safety Requirement Failed: Map must contain at least one node of type 'exit'.");
  }

  if (!hasHelpPoint) {
    warnings.push("Map lacks any 'help_point' node (e.g. reception, guard room).");
  }

  // 3. Validate edges
  const seenEdgeIds = new Set();
  const adjacency = new Map();
  for (const nid of Object.keys(nodes)) adjacency.set(nid, []);

  for (let i = 0; i < edges.length; i++) {
    const edge = edges[i];
    const edgeLabel = edge.id || `edge[${i}]`;

    if (!edge.id) {
      errors.push(`Edge at index ${i} is missing an 'id'.`);
    } else if (seenEdgeIds.has(edge.id)) {
      errors.push(`Duplicate edge ID: "${edge.id}".`);
    } else {
      seenEdgeIds.add(edge.id);
    }

    if (!edge.from || !nodes[edge.from]) {
      errors.push(`Edge "${edgeLabel}" references non-existent 'from' node: "${edge.from}".`);
    }

    if (!edge.to || !nodes[edge.to]) {
      errors.push(`Edge "${edgeLabel}" references non-existent 'to' node: "${edge.to}".`);
    }

    const dist = Number(edge.dist);
    if (!Number.isFinite(dist) || dist <= 0) {
      errors.push(`Edge "${edgeLabel}" dist must be a positive number (got: ${edge.dist}).`);
    }

    if (edge.from && nodes[edge.from] && edge.to && nodes[edge.to]) {
      adjacency.get(edge.from).push(edge.to);
      adjacency.get(edge.to).push(edge.from);
    }
  }

  // 4. Check reachability from startNode
  if (mapData.startNode && nodes[mapData.startNode]) {
    const visited = new Set([mapData.startNode]);
    const queue = [mapData.startNode];
    while (queue.length > 0) {
      const cur = queue.shift();
      const neighbors = adjacency.get(cur) || [];
      for (const n of neighbors) {
        if (!visited.has(n)) {
          visited.add(n);
          queue.push(n);
        }
      }
    }

    for (const nid of Object.keys(nodes)) {
      if (!visited.has(nid)) {
        warnings.push(`Node "${nid}" (${nodes[nid].name}) is disconnected/unreachable from startNode.`);
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings
  };
}
