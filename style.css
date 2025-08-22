console.log("✅ v6.1 restored, fixed 18-color palette, 120s per-user cooldown");

const TWITCH_CLIENT_ID = "  ";

// Canvas setup
const canvas = document.getElementById("pixelCanvas");
const ctx = canvas.getContext("2d");
ctx.imageSmoothingEnabled = false;

const GRID = 1000,
  QUADS = 4,
  QSIZE = GRID / QUADS,
  OVERLAY_SCALE = 1.6;

const gridCb = document.getElementById("toggle-grid"),
  numsCb = document.getElementById("toggle-nums"),
  popup = document.getElementById("popup");

const pixelInfo = document.getElementById("pixel-info"),
  colorSelect = document.getElementById("color-select"),
  colorButton = document.getElementById("color-btn"),
  popupClose = document.getElementById("popup-close"),
  cooldownMsg = document.getElementById("cooldown-msg");

const chatSend = document.getElementById("chat-send"),
  chatMsg = document.getElementById("chat-msg"),
  chatPlatform = document.getElementById("chat-platform"),
  testUser = document.getElementById("test-user");

const stTwitch = document.getElementById("status-twitch"),
  stKick = document.getElementById("status-kick"),
  stYT = document.getElementById("status-youtube"),
  btnTwitch = document.getElementById("login-twitch"),
  btnKick = document.getElementById("login-kick"),
  btnYT = document.getElementById("login-youtube");

let showGridLines = gridCb ? gridCb.checked : true,
  showNumbers = numsCb ? numsCb.checked : true,
  hoveredQuadrant = null,
  selectedPixel = null;

let hoverLocked = false,
  lockedQuadrant = null;

let scale = 1,
  originX = 0,
  originY = 0,
  vpScale = 1,
  vpOffsetX = 0,
  vpOffsetY = 0;

let isPanning = false,
  isMouseDown = false,
  spaceDown = false,
  lastMX = 0,
  lastMY = 0,
  suppressClickOnce = false;

const DRAG_THRESHOLD = 3;
const pixelMap = new Map();

// Base layer
const baseLayer = document.createElement("canvas");
baseLayer.width = GRID;
baseLayer.height = GRID;
const baseCtx = baseLayer.getContext("2d");
baseCtx.imageSmoothingEnabled = false;

// --- Token management ---
function loadTokens() {
  try {
    return JSON.parse(localStorage.getItem("pixel_tokens") || "{}");
  } catch {
    return {};
  }
}

function saveTokens(tok) {
  localStorage.setItem("pixel_tokens", JSON.stringify(tok || {}));
}

function getToken(p) {
  const t = loadTokens();
  return t[p] || "";
}

function setToken(p, val) {
  const t = loadTokens();
  t[p] = val || "";
  saveTokens(t);
  refreshLoginStatus();
  refreshControls();
}

function clearToken(p) {
  try {
    const t = loadTokens();
    if (t && p in t) {
      delete t[p];
    }
    localStorage.setItem("pixel_tokens", JSON.stringify(t || {}));
  } catch (e) {}

  try {
    refreshLoginStatus && refreshLoginStatus();
  } catch (e) {}

  try {
    if (p === "twitch") {
      currentViewer.twitch = null;
      if (typeof testUser !== "undefined" && testUser) {
        testUser.textContent = "Not logged in";
        testUser.classList.remove("filled");
      }
    }
  } catch (e) {}

  try {
    refreshControls && refreshControls();
  } catch (e) {}
}

function isLoggedIn(p) {
  return !!getToken(p);
}

function mask(s) {
  if (!s) return "";
  return s.length <= 8 ? s : s.slice(0, 4) + "…" + s.slice(-4);
}

function refreshLoginStatus() {
  if (stTwitch)
    stTwitch.textContent = isLoggedIn("twitch")
      ? "Token: " + mask(getToken("twitch"))
      : "No token";
  if (stKick)
    stKick.textContent = isLoggedIn("kick")
      ? "Token: " + mask(getToken("kick"))
      : "No token";
  if (stYT)
    stYT.textContent = isLoggedIn("youtube")
      ? "Token: " + mask(getToken("youtube"))
      : "No token";
}

function loginFlow(provider) {
  const existing = getToken(provider);
  if (existing) {
    if (confirm(`Logout ${provider.toUpperCase()}?`)) setToken(provider, "");
    return;
  }
  const token = prompt(
    `Enter ${provider.toUpperCase()} OAuth token (paste a dev/test token).\n(This simulates real login for now.)`
  );
  if (token && token.trim()) setToken(provider, token.trim());
}

// Logout button
const btnLogout = document.getElementById("btn-logout");
if (btnLogout) {
  btnLogout.addEventListener("click", () => {
    // Determine which provider to log out of; prefer selected, else whichever has a token.
    let p =
      typeof chatPlatform !== "undefined" && chatPlatform && chatPlatform.value
        ? chatPlatform.value
        : "";
    if (!p) {
      if (getToken("twitch")) p = "twitch";
      else if (getToken("youtube")) p = "youtube";
      else if (getToken("kick")) p = "kick";
      else p = "twitch";
    }
    clearToken(p);
  });
}

if (btnTwitch) btnTwitch.addEventListener("click", () => startTwitchLogin());
if (btnKick) btnKick.addEventListener("click", () => loginFlow("kick"));
if (btnYT) btnYT.addEventListener("click", () => loginFlow("youtube"));

let currentViewer = { twitch: null, youtube: null, kick: null };

// --- Cooldown logic ---
const COOLDOWN_MS = 120000;

// Persistent cooldowns per provider:user
function loadCooldowns() {
  try {
    return JSON.parse(localStorage.getItem("pixel_cooldowns") || "{}");
  } catch (e) {
    return {};
  }
}

function saveCooldowns(obj) {
  try {
    localStorage.setItem("pixel_cooldowns", JSON.stringify(obj || {}));
  } catch (e) {}
}

let cooldownUntil = Object.assign(
  { twitch: {}, kick: {}, youtube: {} },
  loadCooldowns()
);

let cooldownTimer = null;

function actorFromUI() {
  const provider = chatPlatform ? chatPlatform.value : "twitch";
  const uname = (testUser && testUser.value || "").trim().toLowerCase();
  if (!uname) return null;
  return { provider, uname, key: provider + ":" + uname };
}

function now() {
  return Date.now();
}

function remainingFor(actor) {
  const pmap =
    cooldownUntil[actor.provider] || (cooldownUntil[actor.provider] = {});
  return Math.max(0, (pmap[actor.key] || 0) - now());
}

function isOnCooldown(actor) {
  return remainingFor(actor) > 0;
}

function startCooldown(actor) {
  const pmap =
    cooldownUntil[actor.provider] || (cooldownUntil[actor.provider] = {});
  pmap[actor.key] = Date.now() + COOLDOWN_MS;
  saveCooldowns(cooldownUntil);

  if (!cooldownTimer) cooldownTimer = setInterval(updateCooldownUI, 100);
  updateCooldownUI();
}

function updateCooldownUI() {
  const actor = actorFromUI();
  const authed = actor && isLoggedIn(actor.provider);

  let onCd = false, seconds = "0.0";

  if (actor) {
    const rem = remainingFor(actor);
    onCd = rem > 0;
    seconds = (rem / 1000).toFixed(1);
  }

  if (chatSend) chatSend.disabled = !authed || !actor || onCd;
  if (colorButton) colorButton.disabled = !authed || !actor || onCd || !selectedPixel;

  if (chatSend) chatSend.textContent = onCd ? `Send (${seconds}s)` : "Send";
  if (colorButton) colorButton.textContent = onCd ? `Apply (${seconds}s)` : "Apply";

  if (cooldownMsg) {
    if (onCd) cooldownMsg.classList.remove("hidden");
    else cooldownMsg.classList.add("hidden");
  }

  const anyActive =
    Object.values(cooldownUntil.twitch).some(t => t > now()) ||
    Object.values(cooldownUntil.kick).some(t => t > now()) ||
    Object.values(cooldownUntil.youtube).some(t => t > now());

  if (!anyActive && cooldownTimer) {
    clearInterval(cooldownTimer);
    cooldownTimer = null;
  }
}

function refreshControls() {
  updateCooldownUI();
}

if (chatPlatform) chatPlatform.addEventListener("change", refreshControls);
if (testUser) testUser.addEventListener("input", refreshControls);

function isTypingInInput(e) {
  const el = e && e.target;
  return el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable);
}

function updateViewport() {
  const dpr = window.devicePixelRatio || 1;
  const cssW = Math.max(1, window.innerWidth),
        cssH = Math.max(1, window.innerHeight);

  canvas.style.width = cssW + 'px';
  canvas.style.height = cssH + 'px';

  canvas.width = Math.floor(cssW * dpr);
  canvas.height = Math.floor(cssH * dpr);

  vpScale = Math.min(canvas.width, canvas.height) / GRID;
  vpOffsetX = (canvas.width - GRID * vpScale) / 2;
  vpOffsetY = (canvas.height - GRID * vpScale) / 2;
}

function getMouseWorld(clientX, clientY) {
  const r = canvas.getBoundingClientRect();
  const sx = canvas.width / r.width,
        sy = canvas.height / r.height;

  const cx = (clientX - r.left) * sx,
        cy = (clientY - r.top) * sy;

  const inv = 1 / (vpScale * scale);

  return {
    x: (cx - vpOffsetX - originX) * inv,
    y: (cy - vpOffsetY - originY) * inv
  };
}

function getQuadrantAt(x, y) {
  const qx = Math.floor(x / QSIZE),
        qy = Math.floor(y / QSIZE);

  if (qx < 0 || qx >= QUADS || qy < 0 || qy >= QUADS) return null;
  return { row: qy, col: qx };
}

function overlayRectForQuadrant(q) {
  const sx = q.col * QSIZE,
        sy = q.row * QSIZE,
        s = QSIZE;

  const dw = s * OVERLAY_SCALE,
        dh = s * OVERLAY_SCALE;

  const dx = sx + s / 2 - dw / 2,
        dy = sy + s / 2 - dh / 2;

  return { dx, dy, dw, dh };
}

function pointInRect(x, y, rect) {
  const eps = 1e-6;
  return (
    x >= rect.dx - eps &&
    x <= rect.dx + rect.dw + eps &&
    y >= rect.dy - eps &&
    y <= rect.dy + rect.dh + eps
  );
}

function paintPixelXY(x, y, color) {
  pixelMap.set(`${x},${y}`, color);
  draw();
}

function paintPixelRowCol(row, col, color) {
  paintPixelXY(col, row, color);
}

function draw() {
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.setTransform(
    vpScale * scale, 0, 0, vpScale * scale,
    vpOffsetX + originX, vpOffsetY + originY
  );

  baseCtx.clearRect(0, 0, GRID, GRID);
  baseCtx.fillStyle = "#ffffff";
  baseCtx.fillRect(0, 0, GRID, GRID);

  for (const [k, color] of pixelMap.entries()) {
    const [x, y] = k.split(",").map(Number);
    baseCtx.fillStyle = color;
    baseCtx.fillRect(x, y, 1, 1);
  }

  ctx.drawImage(baseLayer, 0, 0);

  if (showGridLines) {
    ctx.strokeStyle = "rgba(0,0,0,0.35)";
    ctx.lineWidth = 2;

    for (let i = 0; i <= GRID; i += QSIZE) {
      ctx.beginPath();
      ctx.moveTo(i, 0);
      ctx.lineTo(i, GRID);
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(0, i);
      ctx.lineTo(GRID, i);
      ctx.stroke();
    }
  }

  if (showNumbers) {
    ctx.fillStyle = "rgba(0,0,0,0.25)";
    ctx.font = "24px sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";

    for (let r = 0; r < QUADS; r++) {
      for (let c = 0; c < QUADS; c++) {
        const num = r * QUADS + c + 1;
        ctx.fillText(num, c * QSIZE + QSIZE / 2, r * QSIZE + QSIZE / 2);
      }
    }
  }

  if (hoveredQuadrant) {
    const rect = overlayRectForQuadrant(hoveredQuadrant);
    const { dx, dy, dw, dh } = rect;

    const sx = hoveredQuadrant.col * QSIZE,
          sy = hoveredQuadrant.row * QSIZE,
          s = QSIZE;

    ctx.save();
    ctx.imageSmoothingEnabled = false;

    ctx.fillStyle = "#ffffff";
    ctx.fillRect(dx, dy, dw, dh);

    ctx.shadowColor = "rgba(0,0,0,0.28)";
    ctx.shadowBlur = 18;
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 0;

    ctx.drawImage(baseLayer, sx, sy, s, s, dx, dy, dw, dh);

    ctx.shadowColor = "transparent";

    if (showGridLines) {
      ctx.lineWidth = 0.35;
      ctx.strokeStyle = "rgba(0,0,0,0.12)";

      const stepX = dw / s, stepY = dh / s;

      for (let i = 0; i <= s; i++) {
        const gx = dx + i * stepX;
        ctx.beginPath();
        ctx.moveTo(gx, dy);
        ctx.lineTo(gx, dy + dh);
        ctx.stroke();
      }

      for (let j = 0; j <= s; j++) {
        const gy = dy + j * stepY;
        ctx.beginPath();
        ctx.moveTo(dx, gy);
        ctx.lineTo(dx + dw, gy);
        ctx.stroke();
      }
    }

    ctx.restore();
  }
}

if (gridCb) {
  gridCb.addEventListener("change", () => {
    showGridLines = gridCb.checked;
    draw();
  });
}

if (numsCb) {
  numsCb.addEventListener("change", () => {
    showNumbers = numsCb.checked;
    draw();
  });
}

canvas.addEventListener("mousemove", (e) => {
  const { x, y } = getMouseWorld(e.clientX, e.clientY);
  const qUnder = getQuadrantAt(x, y);

  if (hoverLocked && lockedQuadrant) {
    hoveredQuadrant = lockedQuadrant;
  } else if (hoveredQuadrant) {
    const rect = overlayRectForQuadrant(hoveredQuadrant);
    if (!pointInRect(x, y, rect)) hoveredQuadrant = qUnder;
  } else {
    hoveredQuadrant = qUnder;
  }

  canvas.style.cursor = hoveredQuadrant ? "crosshair" : "default";

  if (!isPanning) draw();
});

canvas.addEventListener("click", (e) => {
  /* __CLOSE_IF_OUTSIDE_OVERLAY__ */
  try {
    if (
      popup &&
      !popup.classList.contains("hidden") &&
      hoverLocked &&
      hoveredQuadrant
    ) {
      const p = getMouseWorld(e.clientX, e.clientY);
      const rect = overlayRectForQuadrant(hoveredQuadrant);

      if (!pointInRect(p.x, p.y, rect)) {
        popup.classList.add("hidden");
        hoverLocked = false;
        lockedQuadrant = null;
        selectedPixel = null;
        refreshControls();
        return; // don't select a new pixel on this click
      }
    }
  } catch (err) {
    /* no-op */
  }

  if (suppressClickOnce) {
    suppressClickOnce = false;
    return;
  }

  const { x, y } = getMouseWorld(e.clientX, e.clientY);
  let px, py, q;

  if (hoveredQuadrant) {
    const rect = overlayRectForQuadrant(hoveredQuadrant);

    if (pointInRect(x, y, rect)) {
      const s = QSIZE;
      const sx = hoveredQuadrant.col * s;
      const sy = hoveredQuadrant.row * s;
      const u = (x - rect.dx) / rect.dw;
      const v = (y - rect.dy) / rect.dh;
      px = Math.floor(sx + Math.min(Math.max(u, 0), 1) * s);
      py = Math.floor(sy + Math.min(Math.max(v, 0), 1) * s);
      q = hoveredQuadrant;
    }
  }

  if (px === undefined || py === undefined) {
    if (x < 0 || y < 0 || x >= GRID || y >= GRID) return;
    q = getQuadrantAt(x, y);
    if (!q) return;
    px = Math.floor(x);
    py = Math.floor(y);
  }

  selectedPixel = { row: py, col: px };
  const quadrant = q.row * QUADS + q.col + 1;

  if (popup) {
    popup.style.left = `${e.pageX + 10}px`;
    popup.style.top = `${e.pageY + 10}px`;
    popup.classList.remove("hidden");
  }

  hoverLocked = true;
  lockedQuadrant = q;

  if (pixelInfo) {
    pixelInfo.textContent = `Quadrant: ${quadrant} | Column: ${px}, Row: ${py}`;
  }

  refreshControls();
});

if (popupClose) {
  popupClose.addEventListener("click", () => {
    popup.classList.add("hidden");
    hoverLocked = false;
    lockedQuadrant = null;
  });
}

document.addEventListener("click", (e) => {
  const withinCanvas = e.target === canvas;
  const withinPopup = popup && popup.contains(e.target);

  if (!withinCanvas && !withinPopup) {
    if (popup) popup.classList.add("hidden");
    hoverLocked = false;
    lockedQuadrant = null;
    selectedPixel = null;
    refreshControls();
  }
});

if (popup) {
  popup.addEventListener("click", (e) => e.stopPropagation());
}

if (colorButton) {
  colorButton.addEventListener("click", () => {
    const actor = actorFromUI();

    if (!actor) {
      alert("Enter a username (viewer) to apply.");
      return;
    }

    if (!isLoggedIn(actor.provider)) {
      alert("Please log in (token) for the selected platform.");
      return;
    }

    if (!selectedPixel) return;

    if (isOnCooldown(actor)) {
      updateCooldownUI();
      return;
    }

    const color = colorSelect ? colorSelect.value : "#000000";
    paintPixelRowCol(selectedPixel.row, selectedPixel.col, color);

    if (popup) popup.classList.add("hidden");
    hoverLocked = false;
    lockedQuadrant = null;

    startCooldown(actor);
  });
}

const MIN_SCALE = 0.25,
  MAX_SCALE = 16;

function onWheel(e) {
  e.preventDefault();

  const r = canvas.getBoundingClientRect();
  const sx = canvas.width / r.width,
    sy = canvas.height / r.height;
  const cx = (e.clientX - r.left) * sx,
    cy = (e.clientY - r.top) * sy;
  const wx = (cx - vpOffsetX - originX) / (vpScale * scale);
  const wy = (cy - vpOffsetY - originY) / (vpScale * scale);

  const factor = e.deltaY < 0 ? 1.1 : 1 / 1.1;
  const newScale = Math.max(MIN_SCALE, Math.min(MAX_SCALE, scale * factor));

  if (newScale === scale) return;

  originX = cx - vpOffsetX - wx * (vpScale * newScale);
  originY = cy - vpOffsetY - wy * (vpScale * newScale);
  scale = newScale;

  draw();
}

canvas.addEventListener("wheel", onWheel, { passive: false });

window.addEventListener("keydown", (e) => {
  if (e.code === "Space" && !isTypingInInput(e)) {
    spaceDown = true;
    e.preventDefault();
  }
});

window.addEventListener("keyup", (e) => {
  if (e.code === "Space" && !isTypingInInput(e)) {
    spaceDown = false;
  }
});

canvas.addEventListener("mousedown", (e) => {
  lastMX = e.clientX;
  lastMY = e.clientY;
  isMouseDown = e.button === 0;

  if (e.button === 1 || e.button === 2 || (e.button === 0 && spaceDown)) {
    isPanning = true;
    if (e.button === 0) suppressClickOnce = true;
    e.preventDefault();
  }
});

canvas.addEventListener("mousemove", (e) => {
  if (isPanning) {
    const dx = e.clientX - lastMX,
      dy = e.clientY - lastMY;
    const r = canvas.getBoundingClientRect();
    const sx = canvas.width / r.width,
      sy = canvas.height / r.height;
    originX += dx * sx;
    originY += dy * sy;
    lastMX = e.clientX;
    lastMY = e.clientY;
    draw();
  } else if (isMouseDown) {
    const dx = e.clientX - lastMX,
      dy = e.clientY - lastMY;
    if (Math.abs(dx) > DRAG_THRESHOLD || Math.abs(dy) > DRAG_THRESHOLD) {
      isPanning = true;
      suppressClickOnce = true;
      lastMX = e.clientX;
      lastMY = e.clientY;
    }
  }
});

window.addEventListener("mouseup", () => {
  isPanning = false;
  isMouseDown = false;
});

canvas.addEventListener("contextmenu", (e) => e.preventDefault());

function parseChatCommand(s) {
  const msg = String(s).trim();
  let m = msg.match(/^!(?:co|color)\s+(\d+)\s*,\s*(\d+)\s*,\s*([#A-Za-z0-9]+)$/i);
  if (m) return { col: parseInt(m[1], 10), row: parseInt(m[2], 10), color: m[3] };

  m = msg.match(/^!(?:co|color)\s+(\d+)\s+(\d+)\s+([#A-Za-z0-9]+)$/i);
  if (m) return { col: parseInt(m[1], 10), row: parseInt(m[2], 10), color: m[3] };

  return null;
}

if (chatSend && chatMsg) {
  chatSend.addEventListener("click", () => {
    const actor = actorFromUI();

    if (!actor) {
      alert("Enter a username (viewer) to send.");
      return;
    }

    if (!isLoggedIn(actor.provider)) {
      alert("Please log in (token) for the selected platform.");
      return;
    }

    if (isOnCooldown(actor)) {
      updateCooldownUI();
      return;
    }

    const cmd = parseChatCommand(chatMsg.value);
    if (!cmd) return;

    const { col, row, color } = cmd;
    if (col < 0 || row < 0 || col >= GRID || row >= GRID) return;

    paintPixelRowCol(row, col, color);
    startCooldown(actor);
  });

  chatMsg.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      const actor = actorFromUI();

      if (!actor) {
        alert("Enter a username (viewer) to send.");
        return;
      }

      if (!isLoggedIn(actor.provider)) {
        alert("Please log in (token) for the selected platform.");
        return;
      }

      if (isOnCooldown(actor)) {
        updateCooldownUI();
        return;
      }

      const cmd = parseChatCommand(chatMsg.value);
      if (!cmd) return;

      const { col, row, color } = cmd;
      if (col < 0 || row < 0 || col >= GRID || row >= GRID) return;

      paintPixelRowCol(row, col, color);
      startCooldown(actor);
    }
  });
}

function handleResize() {
  updateViewport();
  draw();
}

window.addEventListener("resize", handleResize);

updateViewport();
refreshLoginStatus();
refreshControls();
draw();

/*__PALETTE_SELECT_BG__*/
(function () {
  const sel = document.getElementById("color-select");
  if (!sel) return;

  function luminance(hex) {
    try {
      if (!hex || hex[0] !== "#") return 1;
      const n = parseInt(hex.slice(1), 16);
      const r = (n >> 16) & 255,
        g = (n >> 8) & 255,
        b = n & 255;
      return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
    } catch (e) {
      return 1;
    }
  }

  function paint() {
    const v = sel.value || "#ffffff";
    sel.style.background = v;
    sel.style.color = luminance(v) > 0.6 ? "#000" : "#fff";
  }

  sel.addEventListener("change", paint);
  paint();
})();

/*__GLOBAL_CLOSE_OUTSIDE_OVERLAY__*/
document.addEventListener(
  "click",
  (e) => {
    try {
      if (!(popup && !popup.classList.contains("hidden") && hoverLocked && hoveredQuadrant)) return;

      // Still let people interact with the popup (choose color, press Apply)
      if (popup.contains(e.target)) return;

      const rectCanvas = canvas.getBoundingClientRect();
      const insideCanvas =
        e.clientX >= rectCanvas.left &&
        e.clientX <= rectCanvas.right &&
        e.clientY >= rectCanvas.top &&
        e.clientY <= rectCanvas.bottom;

      if (!insideCanvas) {
        popup.classList.add("hidden");
        hoverLocked = false;
        lockedQuadrant = null;
        selectedPixel = null;
        refreshControls();
        return;
      }

      const p = getMouseWorld(e.clientX, e.clientY);
      const rect = overlayRectForQuadrant(hoveredQuadrant);

      if (!pointInRect(p.x, p.y, rect)) {
        popup.classList.add("hidden");
        hoverLocked = false;
        lockedQuadrant = null;
        selectedPixel = null;
        refreshControls();
        return;
      }
    } catch (err) {
      /* no-op */
    }
  },
  true
);

// ----- Twitch OAuth (Implicit) -----
function twitchAuthUrl() {
  const redirect = location.origin + location.pathname;
  const p = new URL("https://id.twitch.tv/oauth2/authorize");
  p.searchParams.set("client_id", TWITCH_CLIENT_ID);
  p.searchParams.set("redirect_uri", redirect);
  p.searchParams.set("response_type", "token");
  p.searchParams.set("scope", "chat:read chat:edit");
  p.searchParams.set("state", Math.random().toString(36).slice(2));
  return p.toString();
}

function startTwitchLogin() {
  location.href = twitchAuthUrl();
}

function handleTwitchRedirectFragment() {
  if (!location.hash || !location.hash.includes("access_token")) return false;

  const params = new URLSearchParams(location.hash.slice(1));
  const token = params.get("access_token");

  if (token) {
    setToken("twitch", token);
    try {
      refreshControls && refreshControls();
    } catch (e) { }
  }

  history.replaceState({}, "", location.pathname + location.search);
  validateTwitchToken();
  return true;
}

async function validateTwitchToken() {
  const token = getToken("twitch");
  if (!token) return;

  try {
    const r = await fetch("https://id.twitch.tv/oauth2/validate", {
      headers: { "Authorization": "OAuth " + token }
    });
    const j = await r.json();

    if (stTwitch) {
      stTwitch.textContent = j.login
        ? "Logged in as " + j.login
        : "Token: " + mask(token);
    }

    /*__REFRESH_AFTER_VALIDATE__*/ 
    try {
      refreshControls && refreshControls();
    } catch (e) { }

    try {
      currentViewer.twitch = j.login || currentViewer.twitch;
      if (testUser) {
        testUser.textContent = currentViewer.twitch ? currentViewer.twitch : "Not logged in";
        testUser.classList.toggle("filled", !!currentViewer.twitch);
      }
    } catch (_) { }
  } catch (e) {
    /* ignore */
  }
}

// Handle Twitch OAuth redirect on load
handleTwitchRedirectFragment();

/*__INIT_USER_BADGE__*/
if (typeof testUser !== "undefined" && testUser) {
  testUser.textContent = currentViewer.twitch || "Not logged in";
}


/*__PROVIDER_FALLBACK_AND_ACTOR_PATCH__*/
function getSelectedProvider() {
  try {
    const v = (typeof chatPlatform !== "undefined" && chatPlatform && chatPlatform.value)
      ? chatPlatform.value
      : "";
    if (v) return v;
  } catch (e) { }

  try { if (getToken && getToken("twitch")) return "twitch"; } catch (e) { }
  try { if (getToken && getToken("youtube")) return "youtube"; } catch (e) { }
  try { if (getToken && getToken("kick")) return "kick"; } catch (e) { }

  return "twitch";
}

// Override actorFromUI to use currentViewer + provider fallback
try {
  actorFromUI = function() {
    const provider = getSelectedProvider();
    const uname = (typeof currentViewer !== "undefined" && currentViewer && currentViewer[provider])
      ? String(currentViewer[provider]).trim().toLowerCase()
      : "";
    if (!uname) return null;
    return { provider, uname, key: provider + ":" + uname };
  };
} catch (e) { /* no-op */ }

// Ensure controls re-evaluate with the new logic
try {
  if (typeof refreshControls === "function") refreshControls();
} catch (e) { }


/*__VALIDATE_IF_STORED_TOKEN__*/
try {
  if (getToken("twitch")) {
    validateTwitchToken();
    if (typeof refreshControls === "function") refreshControls();
  }
} catch (e) { }


/*__INJECT_LOGOUT_IF_MISSING__*/
(function() {
  const hasLogout = document.getElementById("btn-logout");
  if (!hasLogout) {
    const btn = document.createElement("button");
    btn.id = "btn-logout";
    btn.textContent = "Log out";
    btn.className = "muted";

    const anchor = document.getElementById("btn-login-twitch");
    if (anchor && anchor.parentElement) {
      anchor.insertAdjacentElement("afterend", btn);
    } else {
      const panel = document.getElementById("panel") || document.getElementById("topbar") || document.body;
      panel.appendChild(btn);
    }

    btn.addEventListener("click", () => {
      let p = (typeof chatPlatform !== "undefined" && chatPlatform && chatPlatform.value)
        ? chatPlatform.value
        : "";
      if (!p) {
        if (getToken("twitch")) p = "twitch";
        else if (getToken("youtube")) p = "youtube";
        else if (getToken("kick")) p = "kick";
        else p = "twitch";
      }
      clearToken(p);
    });
  }
})();


/*__LOAD_COOLDOWNS_ON_BOOT__*/
try {
  const nowTs = Date.now();
  ["twitch", "youtube", "kick"].forEach(p => {
    cooldownUntil[p] = cooldownUntil[p] || {};
    Object.keys(cooldownUntil[p]).forEach(k => {
      if (!cooldownUntil[p][k] || cooldownUntil[p][k] < nowTs) delete cooldownUntil[p][k];
    });
  });
  saveCooldowns(cooldownUntil);
} catch (e) { }


