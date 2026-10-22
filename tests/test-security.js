/**
 * Automated Security & Path Traversal Verification Suite
 * Verifies:
 *  1. Path traversal attacks (/../../etc/hostname) are strictly rejected with 403 Forbidden.
 *  2. URL-encoded traversal attacks (/%2e%2e/%2e%2e/etc/hostname) are rejected with 403 Forbidden.
 *  3. Valid static file requests (/js/app.js) return 200 OK.
 *  4. Health check endpoint (/api/health) returns 200 OK.
 *  5. Staff authentication endpoint works and protects admin endpoints.
 */

import net from "node:net";
import http from "node:http";

const PORT = 8000;

function sendRaw(requestString) {
  return new Promise((resolve, reject) => {
    const client = net.createConnection({ port: PORT, host: "127.0.0.1" }, () => {
      client.write(requestString);
    });

    let rawData = "";
    client.on("data", (chunk) => {
      rawData += chunk.toString();
    });
    client.on("end", () => {
      const statusLine = rawData.split("\r\n")[0];
      const match = statusLine.match(/HTTP\/\d\.\d\s+(\d+)/);
      const statusCode = match ? parseInt(match[1], 10) : 0;
      resolve({ statusCode, rawData, statusLine });
    });
    client.on("error", (err) => reject(err));
  });
}

function httpFetch(path, options = {}) {
  return new Promise((resolve, reject) => {
    const req = http.request(
      {
        host: "127.0.0.1",
        port: PORT,
        path,
        method: options.method || "GET",
        headers: options.headers || {}
      },
      (res) => {
        let body = "";
        res.on("data", (c) => (body += c));
        res.on("end", () => resolve({ statusCode: res.statusCode, body, headers: res.headers }));
      }
    );
    req.on("error", reject);
    if (options.body) req.write(options.body);
    req.end();
  });
}

async function runSecurityTests() {
  console.log("==================================================");
  console.log("Running VoicePath AI Backend & Security Test Suite");
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

  try {
    // 1. Path traversal: raw /../../etc/hostname
    const res1 = await sendRaw("GET /../../etc/hostname HTTP/1.1\r\nHost: localhost\r\n\r\n");
    assert(
      `Request to /../../etc/hostname must return 403 (Got: ${res1.statusCode})`,
      res1.statusCode === 403
    );

    // 2. Encoded path traversal: /%2e%2e/%2e%2e/etc/hostname
    const res2 = await sendRaw("GET /%2e%2e/%2e%2e/etc/hostname HTTP/1.1\r\nHost: localhost\r\n\r\n");
    assert(
      `Request to /%2e%2e/%2e%2e/etc/hostname must return 403 (Got: ${res2.statusCode})`,
      res2.statusCode === 403
    );

    // 3. Valid file: /js/app.js
    const res3 = await httpFetch("/js/app.js");
    assert(
      `Request to /js/app.js must return 200 (Got: ${res3.statusCode})`,
      res3.statusCode === 200
    );

    // 4. Health check: /api/health
    const res4 = await httpFetch("/api/health");
    assert(
      `Health check /api/health must return 200 (Got: ${res4.statusCode})`,
      res4.statusCode === 200
    );
    const healthJson = JSON.parse(res4.body);
    assert(`Health check returns status: 'ok'`, healthJson.status === "ok");

    // 5. Unauthenticated admin endpoint should be 403
    const res5 = await httpFetch("/api/admin/audit-log");
    assert(
      `Unauthenticated /api/admin/audit-log must return 403 (Got: ${res5.statusCode})`,
      res5.statusCode === 403
    );

    // 6. Login as admin and access admin endpoint
    const loginRes = await httpFetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: "admin", password: "AdminSaathi@2026" })
    });
    assert(`Admin login returns 200 (Got: ${loginRes.statusCode})`, loginRes.statusCode === 200);
    const loginJson = JSON.parse(loginRes.body);
    assert(`Login returns admin role`, loginJson.role === "admin");
    assert(`Login returns session token`, Boolean(loginJson.token));

    // 7. Authenticated admin request with session token
    const res7 = await httpFetch("/api/admin/audit-log", {
      headers: { Authorization: `Bearer ${loginJson.token}` }
    });
    assert(
      `Authenticated /api/admin/audit-log returns 200 (Got: ${res7.statusCode})`,
      res7.statusCode === 200
    );

    console.log("==================================================");
    console.log(`Security Tests: ${passed} passed, ${failed} failed.`);
    console.log("==================================================");

    if (failed > 0) process.exit(1);
  } catch (err) {
    console.error("Test execution failed:", err);
    process.exit(1);
  }
}

runSecurityTests();
