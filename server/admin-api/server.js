/**
 * Meshlink Admin Configuration API
 *
 * Provides a simple REST API + web UI for managing server configuration.
 * Reads/writes the .env file and can restart services via Docker Compose.
 */

const express = require("express");
const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");
const crypto = require("crypto");

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const ENV_PATH = path.resolve(__dirname, ".env");
const COMPOSE_DIR = path.resolve(__dirname);

// --- Auth middleware (basic token from .env REGISTRATION_SHARED_SECRET) ---
function loadEnv() {
  const content = fs.readFileSync(ENV_PATH, "utf-8");
  const env = {};
  for (const line of content.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eqIdx = trimmed.indexOf("=");
    if (eqIdx === -1) continue;
    const key = trimmed.slice(0, eqIdx).trim();
    const val = trimmed.slice(eqIdx + 1).trim();
    env[key] = val;
  }
  return env;
}

function saveEnv(env) {
  const header = `# Meshlink Server Configuration\n# Last updated: ${new Date().toISOString()}\n\n`;
  const lines = Object.entries(env)
    .map(([k, v]) => `${k}=${v}`)
    .join("\n");
  fs.writeFileSync(ENV_PATH, header + lines + "\n", { mode: 0o600 });
}

function authMiddleware(req, res, next) {
  const env = loadEnv();
  const token = req.headers["x-admin-token"] || req.query.token;
  if (token === env.REGISTRATION_SHARED_SECRET) {
    return next();
  }
  // Also accept basic auth with admin credentials
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith("Basic ")) {
    const decoded = Buffer.from(authHeader.slice(6), "base64").toString();
    const [user, pass] = decoded.split(":");
    if (user === env.ADMIN_USER && pass === env.ADMIN_PASSWORD) {
      return next();
    }
  }
  res.status(401).json({ error: "Unauthorized" });
}

// --- API Routes ---

// GET /api/config - Read current configuration (secrets masked)
app.get("/api/config", authMiddleware, (req, res) => {
  const env = loadEnv();
  const safe = { ...env };
  // Mask sensitive values
  const sensitiveKeys = [
    "POSTGRES_PASSWORD",
    "REGISTRATION_SHARED_SECRET",
    "TURN_SECRET",
    "ADMIN_PASSWORD",
  ];
  for (const key of sensitiveKeys) {
    if (safe[key]) safe[key] = "********";
  }
  res.json(safe);
});

// PATCH /api/config - Update configuration values
app.patch("/api/config", authMiddleware, (req, res) => {
  const env = loadEnv();
  const updates = req.body;

  // Prevent changing critical secrets via API (must use CLI)
  const readonlyKeys = [
    "POSTGRES_PASSWORD",
    "REGISTRATION_SHARED_SECRET",
    "TURN_SECRET",
  ];
  for (const key of readonlyKeys) {
    if (updates[key]) {
      return res
        .status(400)
        .json({ error: `Cannot change ${key} via API. Use CLI.` });
    }
  }

  const allowedKeys = [
    "SERVER_HOST",
    "HTTP_PORT",
    "ENABLE_REGISTRATION",
    "ELEMENT_BRAND",
    "ADMIN_USER",
    "ADMIN_PASSWORD",
  ];

  const changed = [];
  for (const [key, value] of Object.entries(updates)) {
    if (allowedKeys.includes(key)) {
      env[key] = value;
      changed.push(key);
    }
  }

  if (changed.length === 0) {
    return res.status(400).json({ error: "No valid fields to update." });
  }

  saveEnv(env);
  res.json({ updated: changed, message: "Config saved. Restart required." });
});

// POST /api/restart - Restart all services
app.post("/api/restart", authMiddleware, (req, res) => {
  try {
    execSync(`cd ${COMPOSE_DIR} && docker compose restart`, {
      timeout: 120000,
    });
    res.json({ message: "All services restarted." });
  } catch (err) {
    res.status(500).json({ error: "Restart failed", details: err.message });
  }
});

// GET /api/status - Service health status
app.get("/api/status", authMiddleware, (req, res) => {
  try {
    const output = execSync(`cd ${COMPOSE_DIR} && docker compose ps --format json`, {
      timeout: 15000,
    }).toString();
    const services = output
      .trim()
      .split("\n")
      .filter(Boolean)
      .map((line) => {
        try {
          return JSON.parse(line);
        } catch {
          return null;
        }
      })
      .filter(Boolean)
      .map((s) => ({
        name: s.Service || s.Name,
        state: s.State,
        status: s.Status,
      }));
    res.json({ services });
  } catch (err) {
    res.status(500).json({ error: "Could not get status", details: err.message });
  }
});

// --- Admin Panel HTML ---
app.get("/", (req, res) => {
  res.send(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Meshlink Admin</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #0a0a12; color: #e0e0e0; min-height: 100vh; }
    .container { max-width: 800px; margin: 0 auto; padding: 2rem; }
    h1 { font-size: 1.8rem; font-style: italic; background: linear-gradient(135deg, #a855f7, #6366f1); -webkit-background-clip: text; -webkit-text-fill-color: transparent; margin-bottom: 0.5rem; }
    .subtitle { color: #888; font-size: 0.85rem; margin-bottom: 2rem; }
    .card { background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); border-radius: 1rem; padding: 1.5rem; margin-bottom: 1.5rem; }
    .card h2 { font-size: 1.1rem; margin-bottom: 1rem; color: #a855f7; }
    .field { margin-bottom: 1rem; }
    .field label { display: block; font-size: 0.75rem; text-transform: uppercase; letter-spacing: 0.1em; color: #888; margin-bottom: 0.3rem; }
    .field input, .field select { width: 100%; padding: 0.6rem 0.8rem; background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.15); border-radius: 0.5rem; color: #e0e0e0; font-size: 0.9rem; }
    .field input:focus, .field select:focus { outline: none; border-color: #a855f7; box-shadow: 0 0 0 2px rgba(168,85,247,0.2); }
    .btn { padding: 0.6rem 1.5rem; border: none; border-radius: 0.5rem; font-size: 0.85rem; font-weight: 600; cursor: pointer; transition: all 0.2s; }
    .btn-primary { background: linear-gradient(135deg, #a855f7, #6366f1); color: white; }
    .btn-primary:hover { transform: scale(1.02); }
    .btn-danger { background: #ef4444; color: white; margin-left: 0.5rem; }
    .btn-danger:hover { background: #dc2626; }
    .status { display: inline-block; padding: 0.2rem 0.6rem; border-radius: 1rem; font-size: 0.75rem; font-weight: 600; }
    .status-running { background: rgba(34,197,94,0.2); color: #22c55e; }
    .status-stopped { background: rgba(239,68,68,0.2); color: #ef4444; }
    .services-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 0.75rem; }
    .service-card { background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.08); border-radius: 0.75rem; padding: 0.75rem; }
    .service-name { font-weight: 600; font-size: 0.85rem; }
    .login-form { max-width: 400px; margin: 4rem auto; }
    .msg { padding: 0.75rem; border-radius: 0.5rem; margin-bottom: 1rem; font-size: 0.85rem; }
    .msg-success { background: rgba(34,197,94,0.15); color: #22c55e; border: 1px solid rgba(34,197,94,0.3); }
    .msg-error { background: rgba(239,68,68,0.15); color: #ef4444; border: 1px solid rgba(239,68,68,0.3); }
    .actions { display: flex; gap: 0.5rem; margin-top: 1rem; }
  </style>
</head>
<body>
  <div class="container">
    <div id="login-view" class="login-form">
      <h1>Meshlink Admin</h1>
      <p class="subtitle">Server Configuration Panel</p>
      <div class="card">
        <div class="field">
          <label>Username</label>
          <input type="text" id="login-user" value="admin">
        </div>
        <div class="field">
          <label>Password</label>
          <input type="password" id="login-pass">
        </div>
        <button class="btn btn-primary" onclick="doLogin()" style="width:100%;margin-top:0.5rem">Sign In</button>
      </div>
    </div>

    <div id="admin-view" style="display:none">
      <h1>Meshlink Admin</h1>
      <p class="subtitle">Server Configuration Panel</p>
      <div id="message"></div>

      <div class="card">
        <h2>Service Status</h2>
        <div id="services" class="services-grid">Loading...</div>
        <div class="actions">
          <button class="btn btn-danger" onclick="restartAll()">Restart All Services</button>
        </div>
      </div>

      <div class="card">
        <h2>Server Configuration</h2>
        <div class="field">
          <label>Server Host (IP or Domain)</label>
          <input type="text" id="cfg-SERVER_HOST">
        </div>
        <div class="field">
          <label>HTTP Port</label>
          <input type="number" id="cfg-HTTP_PORT">
        </div>
        <div class="field">
          <label>Open Registration</label>
          <select id="cfg-ENABLE_REGISTRATION">
            <option value="true">Enabled</option>
            <option value="false">Disabled</option>
          </select>
        </div>
        <div class="field">
          <label>Brand Name</label>
          <input type="text" id="cfg-ELEMENT_BRAND">
        </div>
        <div class="actions">
          <button class="btn btn-primary" onclick="saveConfig()">Save Configuration</button>
        </div>
      </div>

      <div class="card">
        <h2>Quick Links</h2>
        <p style="font-size:0.85rem;color:#aaa;line-height:1.8">
          <a href="/" style="color:#a855f7">Element Web Client</a> &mdash; Main messenger UI<br>
          <a href="/admin" style="color:#a855f7">Synapse Admin</a> &mdash; User/room management<br>
        </p>
      </div>
    </div>
  </div>

  <script>
    let authHeader = '';

    function doLogin() {
      const user = document.getElementById('login-user').value;
      const pass = document.getElementById('login-pass').value;
      authHeader = 'Basic ' + btoa(user + ':' + pass);
      fetch('/api/config', { headers: { 'Authorization': authHeader } })
        .then(r => { if (!r.ok) throw new Error('Auth failed'); return r.json(); })
        .then(cfg => {
          document.getElementById('login-view').style.display = 'none';
          document.getElementById('admin-view').style.display = 'block';
          populateConfig(cfg);
          loadStatus();
        })
        .catch(() => showMsg('Invalid credentials', 'error'));
    }

    function populateConfig(cfg) {
      for (const [key, val] of Object.entries(cfg)) {
        const el = document.getElementById('cfg-' + key);
        if (el) el.value = val;
      }
    }

    function saveConfig() {
      const fields = ['SERVER_HOST', 'HTTP_PORT', 'ENABLE_REGISTRATION', 'ELEMENT_BRAND'];
      const body = {};
      for (const f of fields) {
        const el = document.getElementById('cfg-' + f);
        if (el) body[f] = el.value;
      }
      fetch('/api/config', {
        method: 'PATCH',
        headers: { 'Authorization': authHeader, 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      })
        .then(r => r.json())
        .then(data => {
          if (data.error) showMsg(data.error, 'error');
          else showMsg('Configuration saved. Restart services to apply.', 'success');
        })
        .catch(() => showMsg('Save failed', 'error'));
    }

    function restartAll() {
      if (!confirm('Restart all Meshlink services?')) return;
      showMsg('Restarting...', 'success');
      fetch('/api/restart', { method: 'POST', headers: { 'Authorization': authHeader } })
        .then(r => r.json())
        .then(data => {
          showMsg(data.message || data.error, data.error ? 'error' : 'success');
          setTimeout(loadStatus, 5000);
        })
        .catch(() => showMsg('Restart request failed', 'error'));
    }

    function loadStatus() {
      fetch('/api/status', { headers: { 'Authorization': authHeader } })
        .then(r => r.json())
        .then(data => {
          const el = document.getElementById('services');
          if (!data.services || data.services.length === 0) {
            el.innerHTML = '<p style="color:#888">No services found</p>';
            return;
          }
          el.innerHTML = data.services.map(s =>
            '<div class="service-card">' +
            '<div class="service-name">' + (s.name || 'unknown') + '</div>' +
            '<span class="status ' + (s.state === 'running' ? 'status-running' : 'status-stopped') + '">' +
            (s.state || 'unknown') + '</span>' +
            '</div>'
          ).join('');
        })
        .catch(() => {
          document.getElementById('services').innerHTML = '<p style="color:#ef4444">Could not load status</p>';
        });
    }

    function showMsg(text, type) {
      const el = document.getElementById('message');
      el.innerHTML = '<div class="msg msg-' + type + '">' + text + '</div>';
      setTimeout(() => el.innerHTML = '', 5000);
    }

    document.getElementById('login-pass').addEventListener('keydown', e => {
      if (e.key === 'Enter') doLogin();
    });
  </script>
</body>
</html>`);
});

// --- Start server ---
const PORT = process.env.ADMIN_API_PORT || 9090;
app.listen(PORT, "0.0.0.0", () => {
  console.log(`Meshlink Admin API running on port ${PORT}`);
});
