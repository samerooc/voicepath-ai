/**
 * VoicePath AI: Admin Map Editor & Graph Visualizer
 * Allows building staff to update rooms, block corridors, validate, undo/redo, and export without code edits.
 */

import { loadMap, saveMapToStorage, resetMapToDefault } from "./mapLoader.js";
import { validateMap } from "./mapValidator.js";
import { enforceStaffAuth, getSessionToken } from "./authClient.js";

let currentMap = null;
const historyStack = [];
const redoStack = [];

window.addEventListener("DOMContentLoaded", async () => {
  // Enforce Admin Authentication
  enforceStaffAuth("admin", async (session) => {
    try {
      const { map } = await loadMap("data/map.json");
      currentMap = map;
      saveSnapshot();
      renderAll();
    } catch (err) {
      console.error("[Admin] Map load failed:", err);
    }

    initAdminHandlers();
  });
});

function saveSnapshot() {
  historyStack.push(JSON.parse(JSON.stringify(currentMap)));
  if (historyStack.length > 30) historyStack.shift();
  redoStack.length = 0; // clear redo on new action
}

function initAdminHandlers() {
  document.getElementById("btn-admin-save")?.addEventListener("click", () => {
    try {
      const saved = saveMapToStorage(currentMap);
      currentMap = saved;
      alert(`Map v${saved.version} successfully saved to localStorage!`);
      renderAll();
    } catch (e) {
      alert("Validation Error:\n" + e.message);
    }
  });

  document.getElementById("btn-admin-reset")?.addEventListener("click", () => {
    if (confirm("Reset map to bundled default? Any unsaved edits will be lost.")) {
      resetMapToDefault();
      location.reload();
    }
  });

  document.getElementById("btn-admin-undo")?.addEventListener("click", () => {
    if (historyStack.length > 1) {
      redoStack.push(historyStack.pop());
      currentMap = JSON.parse(JSON.stringify(historyStack[historyStack.length - 1]));
      renderAll();
    }
  });

  document.getElementById("btn-admin-redo")?.addEventListener("click", () => {
    if (redoStack.length > 0) {
      const next = redoStack.pop();
      historyStack.push(next);
      currentMap = JSON.parse(JSON.stringify(next));
      renderAll();
    }
  });

  document.getElementById("btn-admin-export")?.addEventListener("click", () => {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(currentMap, null, 2));
    const dlAnchor = document.createElement("a");
    dlAnchor.setAttribute("href", dataStr);
    dlAnchor.setAttribute("download", `map_v${currentMap.version || 1}.json`);
    dlAnchor.click();
  });

  document.getElementById("input-import-file")?.addEventListener("change", (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const imported = JSON.parse(event.target.result);
        const check = validateMap(imported);
        if (!check.valid) {
          alert("Import rejected due to validation errors:\n" + check.errors.join("\n"));
          return;
        }
        saveSnapshot();
        currentMap = imported;
        renderAll();
        alert("Imported successfully! Remember to click Save.");
      } catch (err) {
        alert("Failed to parse JSON file: " + err.message);
      }
    };
    reader.readAsText(file);
  });

  // Add Room Node
  document.getElementById("form-add-node")?.addEventListener("submit", (e) => {
    e.preventDefault();
    const id = document.getElementById("new-node-id").value.trim().toLowerCase();
    const name = document.getElementById("new-node-name").value.trim();
    const type = document.getElementById("new-node-type").value;
    const landmark = document.getElementById("new-node-landmark").value.trim();
    const x = parseInt(document.getElementById("new-node-x").value, 10) || 200;
    const y = parseInt(document.getElementById("new-node-y").value, 10) || 200;

    if (!id || !name) {
      alert("Node ID and Name are required.");
      return;
    }
    if (currentMap.nodes[id]) {
      alert(`Node ID "${id}" already exists.`);
      return;
    }

    saveSnapshot();
    currentMap.nodes[id] = {
      x, y, name,
      aliases: [name.toLowerCase()],
      landmark,
      type,
      lastVerified: new Date().toISOString().slice(0, 10)
    };

    e.target.reset();
    renderAll();
  });

  // Add Edge
  document.getElementById("form-add-edge")?.addEventListener("submit", (e) => {
    e.preventDefault();
    const from = document.getElementById("edge-from-select").value;
    const to = document.getElementById("edge-to-select").value;
    const dist = parseInt(document.getElementById("edge-dist-input").value, 10) || 10;
    const stepFree = document.getElementById("edge-stepfree-checkbox").checked;

    if (!from || !to || from === to) {
      alert("Select two different nodes.");
      return;
    }

    saveSnapshot();
    const id = `e_${Date.now().toString(36)}`;
    currentMap.edges.push({
      id, from, to, dist,
      blocked: false,
      stepFree,
      reason: ""
    });

    renderAll();
  });
}

function renderAll() {
  renderSVGEditor();
  renderValidationPanel();
  renderEdgeList();
  renderNodeSelects();
}

function renderSVGEditor() {
  const svg = document.getElementById("admin-map-svg");
  if (!svg || !currentMap) return;

  const nodes = currentMap.nodes;
  const edges = currentMap.edges || [];

  let html = `<g class="admin-edges">`;
  for (const edge of edges) {
    const a = nodes[edge.from];
    const b = nodes[edge.to];
    if (!a || !b) continue;

    const strokeColor = edge.blocked ? "#ef4444" : (edge.stepFree === false ? "#f59e0b" : "#64748b");
    const strokeDash = edge.blocked ? "6,4" : (edge.stepFree === false ? "4,4" : "");

    html += `
      <g class="admin-edge-group" style="cursor: pointer;" onclick="window.toggleEdgeBlock('${edge.id}')">
        <line x1="${a.x}" y1="${a.y}" x2="${b.x}" y2="${b.y}"
              stroke="${strokeColor}" stroke-width="8" stroke-dasharray="${strokeDash}" />
        <title>Edge ${edge.id}: ${edge.from} <-> ${edge.to} (${edge.dist}m) - Click to toggle block</title>
      </g>
    `;
  }
  html += `</g><g class="admin-nodes">`;

  for (const [id, node] of Object.entries(nodes)) {
    html += `
      <g class="admin-node-group" transform="translate(${node.x}, ${node.y})" style="cursor: pointer;" onclick="window.editNodePrompt('${id}')">
        <circle r="14" fill="#1e293b" stroke="#38bdf8" stroke-width="2" />
        <text y="4" text-anchor="middle" font-size="10" fill="#ffffff">${node.name.slice(0, 3)}</text>
        <text y="-18" text-anchor="middle" font-size="11" fill="#f8fafc" font-weight="600">${node.name}</text>
        <title>Click to edit: ${node.name} (${node.type})</title>
      </g>
    `;
  }
  html += `</g>`;

  svg.innerHTML = html;
}

function renderValidationPanel() {
  const panel = document.getElementById("admin-validation-results");
  if (!panel || !currentMap) return;

  const res = validateMap(currentMap);
  let html = "";

  if (res.valid && res.warnings.length === 0) {
    html = `<div class="badge-success">✓ Map is fully valid & healthy (0 errors, 0 warnings).</div>`;
  } else {
    if (res.errors.length > 0) {
      html += `<div class="badge-error"><strong>Errors (${res.errors.length}):</strong><ul>`;
      res.errors.forEach(e => html += `<li>${e}</li>`);
      html += `</ul></div>`;
    }
    if (res.warnings.length > 0) {
      html += `<div class="badge-warning"><strong>Warnings (${res.warnings.length}):</strong><ul>`;
      res.warnings.forEach(w => html += `<li>${w}</li>`);
      html += `</ul></div>`;
    }
  }

  panel.innerHTML = html;
}

function renderEdgeList() {
  const listEl = document.getElementById("admin-edges-table-body");
  if (!listEl || !currentMap) return;

  let html = "";
  for (const edge of currentMap.edges) {
    html += `
      <tr>
        <td><strong>${edge.id}</strong></td>
        <td>${edge.from} ↔ ${edge.to}</td>
        <td>${edge.dist}m</td>
        <td>
          <button type="button" class="btn-sm ${edge.blocked ? 'btn-danger' : 'btn-outline'}" onclick="window.toggleEdgeBlock('${edge.id}')">
            ${edge.blocked ? '🔴 Blocked' : '🟢 Open'}
          </button>
        </td>
        <td>${edge.stepFree !== false ? 'Yes' : 'No (Stairs)'}</td>
        <td>
          <button type="button" class="btn-sm btn-delete" onclick="window.deleteEdge('${edge.id}')">Delete</button>
        </td>
      </tr>
    `;
  }
  listEl.innerHTML = html;
}

function renderNodeSelects() {
  const fromSel = document.getElementById("edge-from-select");
  const toSel = document.getElementById("edge-to-select");
  if (!fromSel || !toSel || !currentMap) return;

  const options = Object.keys(currentMap.nodes).map(id => `<option value="${id}">${currentMap.nodes[id].name} (${id})</option>`).join("");
  fromSel.innerHTML = options;
  toSel.innerHTML = options;
}

// Global functions exposed to inline SVG clicks
window.toggleEdgeBlock = (edgeId) => {
  const edge = currentMap.edges.find(e => e.id === edgeId);
  if (!edge) return;
  saveSnapshot();
  edge.blocked = !edge.blocked;
  if (edge.blocked) {
    const reason = prompt("Enter block reason (e.g. Repair, Spill, Construction):", "Maintenance");
    edge.reason = reason || "Closed for repair";
  } else {
    edge.reason = "";
  }
  renderAll();
};

window.deleteEdge = (edgeId) => {
  if (confirm(`Delete edge ${edgeId}?`)) {
    saveSnapshot();
    currentMap.edges = currentMap.edges.filter(e => e.id !== edgeId);
    renderAll();
  }
};

window.editNodePrompt = (nodeId) => {
  const node = currentMap.nodes[nodeId];
  if (!node) return;
  const newName = prompt("Edit Room Name:", node.name);
  if (newName !== null && newName.trim()) {
    saveSnapshot();
    node.name = newName.trim();
    const newLandmark = prompt("Edit Landmark description:", node.landmark || "");
    if (newLandmark !== null) node.landmark = newLandmark.trim();
    node.lastVerified = new Date().toISOString().slice(0, 10);
    renderAll();
  }
};
