/**
 * VoicePath AI: Client-Side Staff Authentication Module
 * Provides role-based verification (admin, guard) against the hardened backend.
 */

const TOKEN_KEY = "voicepath_session_token";

export function getSessionToken() {
  return sessionStorage.getItem(TOKEN_KEY) || localStorage.getItem(TOKEN_KEY) || "";
}

export function setSessionToken(token) {
  sessionStorage.setItem(TOKEN_KEY, token);
}

export function clearSessionToken() {
  sessionStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(TOKEN_KEY);
}

/**
 * Verifies current session with backend.
 * @param {string} requiredRole - "admin" | "guard"
 * @returns {Promise<{ authenticated: boolean, role?: string, username?: string }>}
 */
export async function verifyStaffSession(requiredRole = null) {
  const token = getSessionToken();
  if (!token) {
    return { authenticated: false };
  }

  try {
    const res = await fetch("/api/auth/session", {
      headers: {
        "Authorization": `Bearer ${token}`
      }
    });

    if (!res.ok) {
      clearSessionToken();
      return { authenticated: false };
    }

    const data = await res.json();
    if (requiredRole && data.role !== requiredRole && data.role !== "admin") {
      return { authenticated: false, role: data.role, error: "Insufficient privileges" };
    }

    return { authenticated: true, role: data.role, username: data.username };
  } catch (err) {
    console.warn("[AuthClient] Backend session check failed, operating in offline/demo fallback mode:", err);
    return { authenticated: false, offline: true };
  }
}

/**
 * Prompts user with an accessible login dialog.
 * @param {string} requiredRole - "admin" | "guard"
 * @param {Function} onAuthenticated
 */
export function enforceStaffAuth(requiredRole, onAuthenticated) {
  verifyStaffSession(requiredRole).then((session) => {
    if (session.authenticated) {
      if (onAuthenticated) onAuthenticated(session);
      return;
    }

    // Render accessible login overlay
    let overlay = document.getElementById("staff-auth-overlay");
    if (!overlay) {
      overlay = document.createElement("div");
      overlay.id = "staff-auth-overlay";
      overlay.setAttribute("role", "dialog");
      overlay.setAttribute("aria-modal", "true");
      overlay.setAttribute("aria-labelledby", "auth-dialog-title");
      overlay.style.cssText = `
        position: fixed; inset: 0; background: rgba(5, 10, 24, 0.95);
        display: flex; align-items: center; justify-content: center; z-index: 99999;
        padding: 20px;
      `;

      overlay.innerHTML = `
        <div style="background: var(--bg-surface, #11192e); border: 2px solid var(--accent-cyan, #06b6d4); border-radius: 16px; padding: 28px; max-width: 440px; width: 100%; box-shadow: 0 10px 30px rgba(0,0,0,0.8);">
          <h2 id="auth-dialog-title" style="margin-top: 0; color: #ffffff; font-size: 22px;">🔒 Staff Authentication</h2>
          <p style="color: var(--text-muted, #94a3b8); font-size: 14px; margin-bottom: 20px;">
            Access to this console requires <strong>${requiredRole.toUpperCase()}</strong> credentials.
          </p>

          <form id="staff-login-form">
            <div style="margin-bottom: 14px;">
              <label for="auth-username" style="display:block; color: #cbd5e1; font-size: 13px; margin-bottom: 4px; font-weight: 600;">Username</label>
              <input type="text" id="auth-username" required autocomplete="username" style="width: 100%; min-height: 48px; background: #0a0f1d; border: 1px solid #334155; border-radius: 8px; color: #fff; padding: 10px 14px; font-size: 16px;">
            </div>

            <div style="margin-bottom: 18px;">
              <label for="auth-password" style="display:block; color: #cbd5e1; font-size: 13px; margin-bottom: 4px; font-weight: 600;">Password</label>
              <input type="password" id="auth-password" required autocomplete="current-password" style="width: 100%; min-height: 48px; background: #0a0f1d; border: 1px solid #334155; border-radius: 8px; color: #fff; padding: 10px 14px; font-size: 16px;">
            </div>

            <div id="auth-error-msg" style="display: none; background: #7f1d1d; color: #fecaca; padding: 10px; border-radius: 6px; font-size: 13px; margin-bottom: 16px;" role="alert"></div>

            <div style="display: flex; gap: 12px; justify-content: flex-end;">
              <a href="index.html" class="btn btn-outline" style="min-height: 48px; padding: 10px 18px; border-radius: 8px; text-decoration: none; display: inline-flex; align-items: center; justify-content: center; color: #94a3b8; border: 1px solid #475569;">Back</a>
              <button type="submit" id="btn-auth-submit" class="btn btn-primary" style="min-height: 48px; padding: 10px 22px; border-radius: 8px; background: #0284c7; color: #fff; font-weight: bold; border: none; cursor: pointer;">Log In</button>
            </div>
          </form>
        </div>
      `;

      document.body.appendChild(overlay);

      const form = overlay.querySelector("#staff-login-form");
      const errEl = overlay.querySelector("#auth-error-msg");
      const userEl = overlay.querySelector("#auth-username");
      const passEl = overlay.querySelector("#auth-password");

      // Auto-focus username
      setTimeout(() => userEl.focus(), 100);

      form.addEventListener("submit", async (e) => {
        e.preventDefault();
        errEl.style.display = "none";

        const username = userEl.value.trim();
        const password = passEl.value;

        try {
          const res = await fetch("/api/auth/login", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ username, password })
          });

          const data = await res.json();
          if (!res.ok || !data.success) {
            throw new Error(data.error || "Login failed");
          }

          if (requiredRole && data.role !== requiredRole && data.role !== "admin") {
            throw new Error(`Insufficient role: Requires ${requiredRole}`);
          }

          setSessionToken(data.token);
          overlay.remove();
          if (onAuthenticated) onAuthenticated(data);
        } catch (err) {
          errEl.textContent = err.message || "Invalid credentials";
          errEl.style.display = "block";
        }
      });
    }
  });
}
