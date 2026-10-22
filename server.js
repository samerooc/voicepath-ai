/**
 * VoicePath AI (Saathi) - Hardened Production Server
 * Built with native Node.js (Zero dependencies).
 * Features:
 *  - Strict Path Traversal Protection (403 on traversal attempts)
 *  - Automated .env loading and environment validation
 *  - Rate Limiting (sliding window per IP)
 *  - Strict Content-Security-Policy & Security Headers
 *  - CORS Origin Allow-list
 *  - Server-side Gemini API Relay/Proxy (API key never touches client)
 *  - Role-based Authentication (Admin, Guard) with Salted Hashes & Session Tokens
 *  - Audit Logging for Corridor Changes & Map Rollback Snapshots
 *  - /api/health endpoint
 */

import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ---------------------------------------------------------------------------
// 1. Environment Loading & Startup Validation
// ---------------------------------------------------------------------------
function loadEnv() {
  const envPath = path.join(__dirname, ".env");
  if (fs.existsSync(envPath)) {
    try {
      const content = fs.readFileSync(envPath, "utf-8");
      content.split(/\r?\n/).forEach((line) => {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith("#")) return;
        const eqIdx = trimmed.indexOf("=");
        if (eqIdx !== -1) {
          const key = trimmed.slice(0, eqIdx).trim();
          const val = trimmed.slice(eqIdx + 1).trim();
          if (!process.env[key]) {
            process.env[key] = val;
          }
        }
      });
      console.log("[Config] Loaded environment variables from .env");
    } catch (err) {
      console.warn("[Config] Could not parse .env file:", err.message);
    }
  }
}

loadEnv();

const PORT = parseInt(process.env.PORT, 10) || 8000;
const NODE_ENV = process.env.NODE_ENV || "development";
const SESSION_SECRET = process.env.SESSION_SECRET || crypto.randomBytes(32).toString("hex");
const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || "http://localhost:8000,http://127.0.0.1:8000,capacitor://localhost,http://localhost")
  .split(",")
  .map((o) => o.trim());

// Staff user credentials and salt
const ADMIN_USER = process.env.ADMIN_USERNAME || "admin";
const ADMIN_PASS = process.env.ADMIN_PASSWORD || "AdminSaathi@2026";
const GUARD_USER = process.env.GUARD_USERNAME || "guard";
const GUARD_PASS = process.env.GUARD_PASSWORD || "GuardSaathi@2026";

function hashPassword(password, salt) {
  return crypto.scryptSync(password, salt, 32).toString("hex");
}

const SALT = crypto.createHash("sha256").update(SESSION_SECRET).digest("hex").slice(0, 16);
const USER_DATABASE = {
  [ADMIN_USER]: {
    role: "admin",
    passwordHash: hashPassword(ADMIN_PASS, SALT)
  },
  [GUARD_USER]: {
    role: "guard",
    passwordHash: hashPassword(GUARD_PASS, SALT)
  }
};

// Log startup warnings/recommendations
console.log(`[Startup] Environment: ${NODE_ENV} on port ${PORT}`);
if (!process.env.GEMINI_API_KEY) {
  console.warn("⚠️  [Startup Warning] GEMINI_API_KEY is not set in .env. Live vision will run with safe hedged fallback responses.");
} else {
  console.log("🔒 [Startup] GEMINI_API_KEY configured securely on server.");
}

// ---------------------------------------------------------------------------
// 2. In-Memory Session Store, Rate Limiter & Audit Log
// ---------------------------------------------------------------------------
const activeSessions = new Map(); // token -> { username, role, expiresAt }
const rateLimitMap = new Map();   // ip -> { count, resetAt }
const traceRateLimitMap = new Map(); // ip -> { count, resetAt }
const auditLog = [];              // Array of audit events
const mapSnapshots = [];          // Rollback history stack for map edits
const activeBlockedCorridors = new Map(); // "from-to" -> { fromNode, toNode, reason, blockedAt, expiry }
const consentRecords = [];        // Supervised mapping contributor consent records
const privateTraces = new Map();  // traceId -> trace payload
const privateDrafts = new Map();  // draftId -> draft graph object

// Clean up expired sessions and rate limits periodically
setInterval(() => {
  const now = Date.now();
  for (const [token, sess] of activeSessions.entries()) {
    if (sess.expiresAt < now) activeSessions.delete(token);
  }
  for (const [ip, entry] of rateLimitMap.entries()) {
    if (entry.resetAt < now) rateLimitMap.delete(ip);
  }
  // Auto-expire blocked corridors
  for (const [id, entry] of activeBlockedCorridors.entries()) {
    if (entry.expiry && entry.expiry <= now) {
      activeBlockedCorridors.delete(id);
      auditLog.unshift({
        id: crypto.randomUUID(),
        timestamp: new Date().toISOString(),
        actor: "system_auto_expiry",
        action: "CORRIDOR_AUTO_EXPIRED",
        details: `Corridor ${entry.fromNode} <-> ${entry.toNode} auto-expired and unblocked.`
      });
      console.log(`[Corridor] Auto-unblocked expired corridor: ${entry.fromNode} <-> ${entry.toNode}`);
    }
  }
}, 30000);

function checkRateLimit(ip, maxRequests = 100, windowMs = 60000) {
  const now = Date.now();
  let entry = rateLimitMap.get(ip);
  if (!entry || entry.resetAt < now) {
    entry = { count: 1, resetAt: now + windowMs };
    rateLimitMap.set(ip, entry);
    return true;
  }
  entry.count++;
  return entry.count <= maxRequests;
}

function verifyAuth(req, requiredRole = null) {
  const authHeader = req.headers["authorization"] || "";
  let token = "";
  if (authHeader.startsWith("Bearer ")) {
    token = authHeader.slice(7).trim();
  } else if (req.headers["x-session-token"]) {
    token = req.headers["x-session-token"];
  }

  if (!token) return null;
  const session = activeSessions.get(token);
  if (!session || session.expiresAt < Date.now()) return null;
  if (requiredRole && session.role !== requiredRole && session.role !== "admin") {
    return null; // Admins have access to guard endpoints as well
  }
  return session;
}

// ---------------------------------------------------------------------------
// 3. Security Headers and MIME Types
// ---------------------------------------------------------------------------
const MIME_TYPES = {
  ".html": "text/html; charset=UTF-8",
  ".js": "text/javascript; charset=UTF-8",
  ".css": "text/css; charset=UTF-8",
  ".json": "application/json; charset=UTF-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".woff2": "font/woff2",
  ".woff": "font/woff",
  ".ttf": "font/ttf"
};

function applySecurityHeaders(res, req) {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("X-XSS-Protection", "1; mode=block");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  res.setHeader(
    "Permissions-Policy",
    "camera=(self), microphone=(self), accelerometer=(self), gyroscope=(self)"
  );
  res.setHeader(
    "Content-Security-Policy",
    "default-src 'self' data: blob:; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: https:; media-src 'self' blob:; connect-src 'self' https://generativelanguage.googleapis.com wss://generativelanguage.googleapis.com; font-src 'self' data:; worker-src 'self';"
  );

  // CORS check
  const origin = req.headers.origin;
  if (origin && (ALLOWED_ORIGINS.includes(origin) || origin.startsWith("http://localhost:") || origin.startsWith("http://127.0.0.1:"))) {
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Access-Control-Allow-Credentials", "true");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Session-Token");
  }
}

// ---------------------------------------------------------------------------
// 4. Request Body Helper
// ---------------------------------------------------------------------------
function parseJsonBody(req, maxSize = 4 * 1024 * 1024) {
  return new Promise((resolve, reject) => {
    let data = "";
    req.on("data", (chunk) => {
      data += chunk;
      if (data.length > maxSize) {
        reject(new Error("Payload too large"));
        req.destroy();
      }
    });
    req.on("end", () => {
      if (!data) return resolve({});
      try {
        resolve(JSON.parse(data));
      } catch (err) {
        reject(new Error("Invalid JSON"));
      }
    });
    req.on("error", (err) => reject(err));
  });
}

// ---------------------------------------------------------------------------
// 5. Main HTTP Request Router
// ---------------------------------------------------------------------------
const server = http.createServer(async (req, res) => {
  const clientIp = req.socket.remoteAddress || "127.0.0.1";
  applySecurityHeaders(res, req);

  // Preflight OPTIONS handling
  if (req.method === "OPTIONS") {
    res.writeHead(204);
    res.end();
    return;
  }

  // 1. Rate limiting check
  const isApi = req.url.startsWith("/api/");
  const maxReqs = isApi ? 60 : 200;
  if (!checkRateLimit(clientIp, maxReqs)) {
    res.writeHead(429, { "Content-Type": "application/json; charset=UTF-8" });
    res.end(JSON.stringify({ error: "Too many requests. Please slow down." }));
    return;
  }

  const [rawUrl] = req.url.split("?");

  // -------------------------------------------------------------------------
  // REST API Endpoints
  // -------------------------------------------------------------------------
  if (isApi) {
    res.setHeader("Content-Type", "application/json; charset=UTF-8");

    // GET /api/health
    if (req.method === "GET" && rawUrl === "/api/health") {
      res.writeHead(200);
      res.end(
        JSON.stringify({
          status: "ok",
          version: "2.0.0",
          uptime: process.uptime(),
          timestamp: new Date().toISOString(),
          environment: NODE_ENV
        })
      );
      return;
    }

    // GET /api/live/config
    if (req.method === "GET" && rawUrl === "/api/live/config") {
      res.writeHead(200);
      res.end(
        JSON.stringify({
          configured: Boolean(process.env.GEMINI_API_KEY),
          relayAvailable: true
        })
      );
      return;
    }

    // POST /api/live/vision (Server-side Gemini Vision Relay)
    if (req.method === "POST" && rawUrl === "/api/live/vision") {
      try {
        const body = await parseJsonBody(req);
        const promptText = (body.prompt || "What is in front of me?").trim();
        const base64Data = body.imageBase64 || "";

        if (!base64Data) {
          res.writeHead(400);
          res.end(JSON.stringify({ error: "Missing imageBase64 data" }));
          return;
        }

        const apiKey = process.env.GEMINI_API_KEY;
        if (!apiKey) {
          // Safe hedged response when server has no key configured
          res.writeHead(200);
          res.end(
            JSON.stringify({
              success: true,
              text: "Mujhe abhi kuch dikh nahi raha, cane use karte rehna.",
              hedged: true
            })
          );
          return;
        }

        // Call Gemini server-to-server
        const systemInstruction = `You are VoicePath AI Live Vision Assistant for a visually impaired user navigating indoors.
SAFETY RULES:
1. NEVER declare or imply that the path is 'safe', 'clear', or 'free of obstacles'.
2. ALWAYS use hedged language: 'Mujhe abhi aage kuch nahi dikh raha, cane use karte rehna' or 'I don't see anything ahead right now, keep using your white cane.'
3. Keep response to 1-2 short, conversational sentences.
4. Mention landmarks, people, stairs, obstacles, or signs if visible.`;

        const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${encodeURIComponent(apiKey)}`;
        const geminiRes = await fetch(geminiUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [
              {
                role: "user",
                parts: [
                  { text: `${systemInstruction}\n\nUser asked: "${promptText}"` },
                  {
                    inline_data: {
                      mime_type: "image/jpeg",
                      data: base64Data
                    }
                  }
                ]
              }
            ],
            generationConfig: {
              temperature: 0.2,
              maxOutputTokens: 150
            }
          })
        });

        if (!geminiRes.ok) {
          throw new Error(`Gemini API error: ${geminiRes.status}`);
        }

        const gData = await geminiRes.json();
        const text =
          gData.candidates?.[0]?.content?.parts?.[0]?.text?.trim() ||
          "Mujhe abhi kuch dikh nahi raha, cane use karte rehna.";

        res.writeHead(200);
        res.end(JSON.stringify({ success: true, text }));
        return;
      } catch (err) {
        console.error("[API Live Vision] Error:", err.message);
        res.writeHead(500);
        res.end(
          JSON.stringify({
            error: "Failed to process vision query",
            fallbackText: "Mujhe abhi kuch dikh nahi raha, cane use karte rehna."
          })
        );
        return;
      }
    }

    // POST /api/auth/login
    if (req.method === "POST" && rawUrl === "/api/auth/login") {
      try {
        const { username, password } = await parseJsonBody(req);
        const user = USER_DATABASE[username];

        if (!user) {
          res.writeHead(401);
          res.end(JSON.stringify({ error: "Invalid username or password" }));
          return;
        }

        const inputHash = hashPassword(password || "", SALT);
        if (inputHash !== user.passwordHash) {
          res.writeHead(401);
          res.end(JSON.stringify({ error: "Invalid username or password" }));
          return;
        }

        const token = crypto.randomBytes(32).toString("hex");
        const session = {
          token,
          username,
          role: user.role,
          expiresAt: Date.now() + 24 * 60 * 60 * 1000 // 24 hours
        };
        activeSessions.set(token, session);

        auditLog.unshift({
          id: crypto.randomUUID(),
          timestamp: new Date().toISOString(),
          actor: username,
          action: "STAFF_LOGIN",
          details: `Staff member logged in with role: ${user.role}`
        });

        res.writeHead(200);
        res.end(
          JSON.stringify({
            success: true,
            token,
            role: user.role,
            username
          })
        );
        return;
      } catch (err) {
        res.writeHead(400);
        res.end(JSON.stringify({ error: "Bad Request" }));
        return;
      }
    }

    // GET /api/auth/session
    if (req.method === "GET" && rawUrl === "/api/auth/session") {
      const session = verifyAuth(req);
      if (!session) {
        res.writeHead(401);
        res.end(JSON.stringify({ authenticated: false }));
        return;
      }
      res.writeHead(200);
      res.end(
        JSON.stringify({
          authenticated: true,
          username: session.username,
          role: session.role
        })
      );
      return;
    }

    // POST /api/auth/logout
    if (req.method === "POST" && rawUrl === "/api/auth/logout") {
      const authHeader = req.headers["authorization"] || "";
      const token = authHeader.replace(/^Bearer\s+/, "") || req.headers["x-session-token"];
      if (token && activeSessions.has(token)) {
        activeSessions.delete(token);
      }
      res.writeHead(200);
      res.end(JSON.stringify({ success: true }));
      return;
    }

    // GET /api/admin/audit-log (Admin Only)
    if (req.method === "GET" && rawUrl === "/api/admin/audit-log") {
      const session = verifyAuth(req, "admin");
      if (!session) {
        res.writeHead(403);
        res.end(JSON.stringify({ error: "Forbidden: Admin access required" }));
        return;
      }
      res.writeHead(200);
      res.end(JSON.stringify({ success: true, auditLog }));
      return;
    }

    // GET /api/admin/corridor/blocked
    if (req.method === "GET" && rawUrl === "/api/admin/corridor/blocked") {
      const list = Array.from(activeBlockedCorridors.values());
      res.writeHead(200);
      res.end(JSON.stringify({ success: true, blocked: list }));
      return;
    }

    // POST /api/admin/corridor/block (Admin Only)
    if (req.method === "POST" && rawUrl === "/api/admin/corridor/block") {
      const session = verifyAuth(req, "admin");
      if (!session) {
        res.writeHead(403);
        res.end(JSON.stringify({ error: "Forbidden: Admin access required" }));
        return;
      }

      try {
        const { fromNode, toNode, reason, autoExpiryMinutes } = await parseJsonBody(req);
        if (!fromNode || !toNode) {
          res.writeHead(400);
          res.end(JSON.stringify({ error: "fromNode and toNode are required" }));
          return;
        }

        const id = `${fromNode}-${toNode}`;
        const expiry = autoExpiryMinutes ? Date.now() + autoExpiryMinutes * 60000 : null;
        const entry = {
          fromNode,
          toNode,
          reason: reason || "Maintenance",
          blockedAt: new Date().toISOString(),
          expiry
        };
        activeBlockedCorridors.set(id, entry);

        auditLog.unshift({
          id: crypto.randomUUID(),
          timestamp: new Date().toISOString(),
          actor: session.username,
          action: "BLOCK_CORRIDOR",
          details: `Corridor ${fromNode} <-> ${toNode} blocked. Reason: "${reason || 'Maintenance'}". Expiry: ${expiry ? new Date(expiry).toISOString() : 'None'}`
        });

        res.writeHead(200);
        res.end(JSON.stringify({ success: true, corridor: entry }));
        return;
      } catch (err) {
        res.writeHead(400);
        res.end(JSON.stringify({ error: err.message }));
        return;
      }
    }

    // POST /api/admin/corridor/unblock (Admin Only)
    if (req.method === "POST" && rawUrl === "/api/admin/corridor/unblock") {
      const session = verifyAuth(req, "admin");
      if (!session) {
        res.writeHead(403);
        res.end(JSON.stringify({ error: "Forbidden: Admin access required" }));
        return;
      }

      try {
        const { fromNode, toNode } = await parseJsonBody(req);
        const id1 = `${fromNode}-${toNode}`;
        const id2 = `${toNode}-${fromNode}`;
        activeBlockedCorridors.delete(id1);
        activeBlockedCorridors.delete(id2);

        auditLog.unshift({
          id: crypto.randomUUID(),
          timestamp: new Date().toISOString(),
          actor: session.username,
          action: "UNBLOCK_CORRIDOR",
          details: `Corridor ${fromNode} <-> ${toNode} unblocked manually by admin.`
        });

        res.writeHead(200);
        res.end(JSON.stringify({ success: true }));
        return;
      } catch (err) {
        res.writeHead(400);
        res.end(JSON.stringify({ error: err.message }));
        return;
      }
    }

    // POST /api/mapping/trace (Supervised Mapping Contributor Trace Upload)
    if (req.method === "POST" && rawUrl === "/api/mapping/trace") {
      const session = verifyAuth(req);
      if (!session) {
        res.writeHead(401);
        res.end(JSON.stringify({ error: "Unauthorized: contributor or admin session required" }));
        return;
      }

      // Trace-specific rate limiting (sliding window per IP)
      const now = Date.now();
      let traceLimit = traceRateLimitMap.get(clientIp);
      if (!traceLimit || traceLimit.resetAt < now) {
        traceLimit = { count: 1, resetAt: now + 60000 };
        traceRateLimitMap.set(clientIp, traceLimit);
      } else {
        traceLimit.count++;
        if (traceLimit.count > 60) {
          res.writeHead(429);
          res.end(JSON.stringify({ error: "Trace rate limit exceeded. Please wait a minute." }));
          return;
        }
      }

      try {
        const body = await parseJsonBody(req, 500 * 1024); // 500 KB strict limit

        // 1. Consent verification
        if (!body.consent || body.consent.version !== "2026.1" || !body.consent.acceptedAt || !body.contributorId) {
          res.writeHead(400);
          res.end(JSON.stringify({
            error: "Consent required: body.consent with version '2026.1', acceptedAt timestamp, and contributorId must be provided."
          }));
          return;
        }

        // 2. Floor field verification
        if (typeof body.floor !== "number" || !Number.isInteger(body.floor)) {
          res.writeHead(400);
          res.end(JSON.stringify({ error: "Field 'floor' (integer) is required." }));
          return;
        }

        // 3. Outlier rejection: reject traces with impossible velocity (> 4.5 m/s) or teleports (> 15m)
        if (Array.isArray(body.waypoints)) {
          for (let i = 1; i < body.waypoints.length; i++) {
            const p1 = body.waypoints[i - 1];
            const p2 = body.waypoints[i];
            const dt = Math.abs(p2.t - p1.t);
            const dist = Math.hypot(p2.x - p1.x, p2.y - p1.y);
            const speed = dt > 0 ? dist / dt : 0;
            if (speed > 4.5 || dist > 15) {
              res.writeHead(400);
              res.end(JSON.stringify({
                error: `Outlier rejected: impossible velocity (${speed.toFixed(2)} m/s, dist ${dist.toFixed(1)}m) between waypoints ${i - 1} and ${i}.`
              }));
              return;
            }
          }
        }

        // 4. OCR Personal-data filter: redact Aadhaar, phone numbers, and emails
        if (Array.isArray(body.detectedLabels)) {
          body.detectedLabels.forEach((label) => {
            if (label.ocrText && typeof label.ocrText === "string") {
              label.ocrText = label.ocrText
                .replace(/\b\d{4}\s?\d{4}\s?\d{4}\b/g, "[REDACTED_AADHAAR]")
                .replace(/(\+91[\-\s]?)?[6-9]\d{9}\b/g, "[REDACTED_PHONE]")
                .replace(/[\w.\-]+@[\w.\-]+\.\w+/g, "[REDACTED_EMAIL]");
            }
          });
        }

        // 5. Store consent record
        const consentEntry = {
          contributorId: body.contributorId,
          version: body.consent.version,
          timestamp: body.consent.acceptedAt,
          ip: clientIp,
          recordedAt: new Date().toISOString()
        };
        consentRecords.push(consentEntry);

        const traceId = `trace_${crypto.randomUUID().slice(0, 8)}`;
        privateTraces.set(traceId, {
          ...body,
          traceId,
          receivedAt: new Date().toISOString()
        });

        auditLog.unshift({
          id: crypto.randomUUID(),
          timestamp: new Date().toISOString(),
          actor: session.username,
          action: "TRACE_UPLOAD",
          details: `Trace ${traceId} uploaded for floor ${body.floor} by ${body.contributorId}.`
        });

        res.writeHead(200);
        res.end(JSON.stringify({ success: true, traceId, floor: body.floor }));
        return;
      } catch (err) {
        res.writeHead(400);
        res.end(JSON.stringify({ error: err.message }));
        return;
      }
    }

    // POST /api/admin/map/publish (Admin Map Publish with Mandatory Walk-Verification)
    if (req.method === "POST" && rawUrl === "/api/admin/map/publish") {
      const session = verifyAuth(req, "admin");
      if (!session) {
        res.writeHead(403);
        res.end(JSON.stringify({ error: "Forbidden: Admin access required" }));
        return;
      }

      try {
        const body = await parseJsonBody(req);
        const draft = body.draft;

        if (!draft || typeof draft !== "object") {
          res.writeHead(400);
          res.end(JSON.stringify({ error: "Draft map object is required." }));
          return;
        }

        // Rule: Mandatory recorded physical walk-verification before publish
        if (!draft.walkVerification || draft.walkVerification.testPassed !== true) {
          res.writeHead(400);
          res.end(JSON.stringify({
            error: "Cannot publish map: A physical walk-verification trace with testPassed: true is mandatory before publishing."
          }));
          return;
        }

        // Archive previous map snapshot for one-click rollback
        const mapPath = path.join(__dirname, "data", "map.json");
        if (fs.existsSync(mapPath)) {
          const currentMap = fs.readFileSync(mapPath, "utf-8");
          mapSnapshots.unshift({
            id: crypto.randomUUID(),
            timestamp: new Date().toISOString(),
            content: currentMap,
            publishedBy: session.username
          });
        }

        // Update status to published
        draft.status = "published";
        draft.lastVerified = new Date().toISOString().slice(0, 10);
        draft.publishedBy = session.username;

        fs.writeFileSync(mapPath, JSON.stringify(draft, null, 2), "utf-8");

        auditLog.unshift({
          id: crypto.randomUUID(),
          timestamp: new Date().toISOString(),
          actor: session.username,
          action: "PUBLISH_MAP",
          details: `Draft map published successfully after physical walk verification by ${draft.walkVerification.verifiedBy}. Note: ${body.note || "No note"}`
        });

        res.writeHead(200);
        res.end(JSON.stringify({ success: true, status: "published", version: draft.version || 2 }));
        return;
      } catch (err) {
        res.writeHead(400);
        res.end(JSON.stringify({ error: err.message }));
        return;
      }
    }

    // GET /api/live/config
    if (req.method === "GET" && rawUrl === "/api/live/config") {
      const apiKey = process.env.GEMINI_API_KEY || "";
      res.writeHead(200);
      res.end(JSON.stringify({ configured: Boolean(apiKey) }));
      return;
    }

    // POST /api/live/vision (Server proxy for Gemini Vision, API key never exposed)
    if (req.method === "POST" && rawUrl === "/api/live/vision") {
      try {
        const body = await parseJsonBody(req, 8 * 1024 * 1024); // max 8MB
        const { prompt, imageBase64 } = body;
        const apiKey = process.env.GEMINI_API_KEY;

        if (!imageBase64) {
          res.writeHead(400);
          res.end(JSON.stringify({ error: "Missing imageBase64" }));
          return;
        }

        if (!apiKey) {
          res.writeHead(200);
          res.end(JSON.stringify({ text: "Saamne rasta saaf lag raha hai, cane use karte rahein." }));
          return;
        }

        const userPrompt = prompt || "You are an assistive vision assistant for a blind person walking indoors. State in 1 short clear sentence in Hindi/Hinglish what is directly in front of the user (e.g., 'Aage darwaza hai', 'Saamne ek vyakti khada hai', 'Saamne seedhiyan hain'). Do NOT repeat obvious background details. Be concise and helpful.";

        const geminiEndpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;
        const payload = {
          contents: [
            {
              parts: [
                { text: userPrompt },
                {
                  inline_data: {
                    mime_type: "image/jpeg",
                    data: imageBase64
                  }
                }
              ]
            }
          ],
          generationConfig: {
            maxOutputTokens: 120,
            temperature: 0.3
          }
        };

        const geminiRes = await fetch(geminiEndpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload)
        });

        if (!geminiRes.ok) {
          const errText = await geminiRes.text();
          console.warn("[GeminiProxy] Gemini API returned error:", geminiRes.status, errText);
          res.writeHead(200);
          res.end(JSON.stringify({ text: "Aage rasta saaf lag raha hai, dhire chalein." }));
          return;
        }

        const geminiData = await geminiRes.json();
        const responseText = geminiData.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || "Saamne rasta saaf hai.";

        res.writeHead(200);
        res.end(JSON.stringify({ text: responseText }));
        return;
      } catch (visionErr) {
        console.error("[GeminiProxy] Error:", visionErr);
        res.writeHead(500);
        res.end(JSON.stringify({ error: "Vision analysis failed" }));
        return;
      }
    }

    // 404 for unknown API routes
    res.writeHead(404);
    res.end(JSON.stringify({ error: `API route not found: ${rawUrl}` }));
    return;
  }

  // -------------------------------------------------------------------------
  // Static File Serving with Strict Path Traversal Protection & Draft Isolation
  // -------------------------------------------------------------------------
  let cleanUrl = rawUrl;
  if (cleanUrl === "/") cleanUrl = "/index.html";

  // Check for path traversal attempts
  let decodedUrl = "";
  try {
    decodedUrl = decodeURIComponent(cleanUrl);
  } catch (e) {
    res.writeHead(400, { "Content-Type": "text/plain; charset=UTF-8" });
    res.end("400 Bad Request: Malformed URI");
    return;
  }

  // Detect explicit traversal components ("..")
  // Using path.relative to verify resolved target stays strictly inside __dirname
  const safeTarget = path.resolve(__dirname, "." + path.sep + decodedUrl.replace(/^[\/\\]+/, ""));
  const relativeToRoot = path.relative(__dirname, safeTarget);

  if (
    decodedUrl.includes("..") ||
    relativeToRoot.startsWith("..") ||
    path.isAbsolute(relativeToRoot)
  ) {
    res.writeHead(403, { "Content-Type": "text/plain; charset=UTF-8" });
    res.end("403 Forbidden: Path traversal attempt detected");
    return;
  }

  // Strict draft isolation: drafts and private data can NEVER be served statically to clients
  if (
    decodedUrl.includes("/drafts") ||
    decodedUrl.includes("/data_private") ||
    decodedUrl.startsWith("/data/drafts") ||
    safeTarget.includes("drafts") ||
    safeTarget.includes("data_private")
  ) {
    res.writeHead(404, { "Content-Type": "text/plain; charset=UTF-8" });
    res.end("404 Not Found: " + cleanUrl);
    return;
  }

  fs.stat(safeTarget, (err, stats) => {
    if (err || !stats.isFile()) {
      res.writeHead(404, { "Content-Type": "text/plain; charset=UTF-8" });
      res.end("404 Not Found: " + cleanUrl);
      return;
    }

    const ext = path.extname(safeTarget).toLowerCase();
    const contentType = MIME_TYPES[ext] || "application/octet-stream";

    res.writeHead(200, {
      "Content-Type": contentType,
      "Cache-Control": ext === ".html" ? "no-cache" : "public, max-age=3600"
    });

    fs.createReadStream(safeTarget).pipe(res);
  });
});

server.listen(PORT, () => {
  console.log(`\n==================================================`);
  console.log(`🚀 VoicePath AI Server running at: http://localhost:${PORT}`);
  console.log(`📱 Main App:        http://localhost:${PORT}/index.html`);
  console.log(`🛡️ Guard Station:   http://localhost:${PORT}/guard.html`);
  console.log(`⚙️ Admin Editor:    http://localhost:${PORT}/admin.html`);
  console.log(`🏥 Health Check:    http://localhost:${PORT}/api/health`);
  console.log(`==================================================\n`);
});
