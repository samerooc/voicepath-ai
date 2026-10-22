# VoicePath AI: Map Changes and Admin Editor Spec

Part 4 of 8 · Version 1.0 · 22 Oct 2026

Context: the map is a JSON graph (`data/map.json`, schema in Doc 2). Buildings change, so the app must handle map changes without code edits and without breaking a route in progress.

## 1. Principle

Never hard-code the map. The map is data. Dijkstra recomputes automatically from whatever graph is loaded.

## 2. Types of change and the action

| Change | Action |
| --- | --- |
| Temporary closure (repair, event) | Set `blocked: true` and fill `reason` |
| Room renamed or moved | Edit node `name`, `aliases`, `x`, `y` |
| New room | Add node plus edges (both directions are created by the loader) |
| Room removed | Remove node and all its edges |
| New shortcut or door | Add edge |
| Broken lift | Block lift edges |
| Landmark changed | Edit node `landmark` |

## 3. Levels of implementation

**Level 1 (MUST):** edit `map.json`, refresh the page. Block / unblock buttons on the main demo screen.

**Level 2 (SHOULD):** `admin.html` editor with `localStorage` save and JSON export.

**Level 3 (future):** online dashboard with a backend (Firebase or Supabase) so staff updates reach all users automatically.

## 4. Loader rules (`mapLoader.js`)

1. Load `data/map.json`.
2. If an edited copy exists in `localStorage`, compare `version`. If the stored version is older than the file version, ignore the stored copy and tell admin. If newer, use it.
3. Run the validator (section 5). If it fails, show errors on the admin page and keep the last valid map for users.
4. Expand edges into an adjacency list in both directions.
5. If `lastUpdated` is older than 30 days, warn: "Map purana ho sakta hai."

## 5. Validation (`mapValidator.js`)

Run on load and before every admin save.

1. Every edge references existing nodes.
2. No duplicate node ids or edge ids.
3. `dist` is a positive integer.
4. Every node is reachable from `startNode` (warning, not error).
5. At least one `exit` node exists.
6. At least one `help_point` node exists (warning).
7. Aliases are non-empty strings and unique across nodes (warning on clash).
8. Return `{ errors: [], warnings: [] }`.

Errors and warnings are shown to admin only. The end user never hears validator messages.

## 6. Map change during navigation

1. Detect the change event (block, unblock, admin save, map reload).
2. Cancel current speech.
3. Recompute the route from `state.currentNodeId` to `state.destinationId`.
4. If a route exists: speak "Raasta badal gaya hai, naya route bata raha hoon," reset `stepIndex` to 0, update SVG highlight.
5. If no route exists: speak "Route nahi mila," and offer the nearest help point.
6. If the blocked edge has a `reason`, include it: "Library wala raasta repair ki wajah se band hai."
7. Update route, step index and SVG together in a single `update()` call to avoid stale state.

## 7. Report a problem (user feedback)

- Button and voice command: "Raasta band hai" / "Report problem".
- Effect: mark the next edge on the current route as temporarily blocked, reroute immediately, and log a report `{ edgeId, time, userLabel }` for admin.
- Temporary blocks expire after a configurable time (for example 30 minutes) or when admin confirms.
- This is the practical answer to "what if the real building changes and the map is outdated?"

## 8. Admin page (`admin.html`, `admin.js`)

Features:

- Show the SVG map. Click an edge to block / unblock and edit `reason`. Click a node to edit name, aliases, landmark and position.
- Add room, delete room, add edge, delete edge.
- Validation panel with errors and warnings.
- Undo and redo (keep a history stack of map snapshots).
- Export JSON (download) and Import JSON.
- Save to `localStorage` and increase `version` and `lastUpdated`.
- Simple PIN for the demo (note in README that this is not real security).
- "Mark as verified today" for a node or edge (updates `lastVerified`).

Admin must not break the user app: user pages always use the last valid saved map.

## 9. Edge cases

| Case | Handling |
| --- | --- |
| All routes to destination blocked | Clear message and help-point option |
| Start node blocked or removed | Ask admin / use nearest valid node and warn |
| Destination removed mid-route | Cancel route, say destination is no longer available, offer list |
| Stored map older than file map | Prefer newer, show admin notice |
| Landmark missing for a new node | Instruction omits landmark, admin gets a warning |
| Two rooms with the same alias | Ask user to choose by reading both names |
| Admin imports invalid JSON | Reject with errors, do not overwrite |

## 10. Tests

- Block an edge on the active route: reroute within 1 second, speech cancelled.
- Unblock: original shorter route returns.
- Delete a node with edges: validator passes only if all edges are removed.
- Import a file with a missing node reference: rejected.
- Reload after admin save: edits persist, version increased.
- Old `lastUpdated`: warning appears for admin and a short notice for the user.

## 11. Demo line

> The map is not hard-coded. Staff can block a corridor or edit a room without coding, and the app reroutes automatically.
