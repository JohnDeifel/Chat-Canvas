// ------------------------------
// --- Get important HTML elements
// ------------------------------
const canvas = document.getElementById("pixelCanvas"),
      ctx = canvas.getContext("2d"),
      popup = document.getElementById("popup"),
      pixelInfo = document.getElementById("pixel-info"),
      colorSelect = document.getElementById("color-select"),
      colorButton = document.getElementById("color-btn"),
      popupClose = document.getElementById("popup-close");

// Hook up checkboxes
document.getElementById("toggle-grid")?.addEventListener("change", e => {
  showGrid = e.target.checked;
  draw();
});
document.getElementById("toggle-nums")?.addEventListener("change", e => {
  showNums = e.target.checked;
  draw();
});

ctx.imageSmoothingEnabled = false;

// ------------------------------
// --- Constants
// ------------------------------
const GRID = 1000;
const QUADS = 4;
const QSIZE = GRID / QUADS;
const OVERLAY_SCALE = 1.6;

const MIN_SCALE = 0.25, MAX_SCALE = 16;
const DRAG_THRESHOLD = 3;

// ------------------------------
// --- State
// ------------------------------
// ------------------------------
// --- Config (extensible for Twitch/user-based cooldowns later)
// ------------------------------
const CONFIG = {
  baseCooldownMs: 30_000,                 // 30 seconds by default
  getCurrentUserId: () => 'local-anon',   // placeholder for future auth
  getCooldownMsForUser: (userId) => CONFIG.baseCooldownMs,
};

// ------------------------------
// --- Cooldown state
// ------------------------------
// Track cooldown per user for easy expansion later
const cooldownUntilByUser = new Map(); // userId -> epoch ms
let cooldownTimerId = null;

let pixelMap = new Map();

let hoveredQuadrant = null;
let hoverLocked = false;
let lockedQuadrant = null;
let selectedPixel = null;
let showGrid = true;
let showNums = true;

let scale = 1;
let originX = 0;
let originY = 0;
let vpScale = 1;
let vpOffsetX = 0;
let vpOffsetY = 0;

let isPanning = false;
let isMouseDown = false;
let spaceDown = false;
let lastMX = 0, lastMY = 0;
let suppressClickOnce = false;

// ------------------------------
// --- Base layer
// ------------------------------
const baseLayer = document.createElement("canvas");
baseLayer.width = baseLayer.height = GRID;
const baseCtx = baseLayer.getContext("2d");
baseCtx.imageSmoothingEnabled = false;

// ------------------------------
// --- Utils
// ------------------------------
const getMouseWorld = (mx, my) => {
  const r = canvas.getBoundingClientRect();
  const sx = canvas.width / r.width;
  const sy = canvas.height / r.height;
  const cx = (mx - r.left) * sx;
  const cy = (my - r.top) * sy;
  const inv = 1 / (vpScale * scale);
  return { x: (cx - vpOffsetX - originX) * inv, y: (cy - vpOffsetY - originY) * inv };
};

const getQuadrantAt = (x, y) => {
  const qx = Math.floor(x / QSIZE);
  const qy = Math.floor(y / QSIZE);
  if (qx < 0 || qx >= QUADS || qy < 0 || qy >= QUADS) return null;
  return { row: qy, col: qx };
};

const overlayRectForQuadrant = q => {
  const sx = q.col * QSIZE, sy = q.row * QSIZE, s = QSIZE;
  const dw = s * OVERLAY_SCALE, dh = s * OVERLAY_SCALE;
  const dx = sx + s/2 - dw/2, dy = sy + s/2 - dh/2;
  return { dx, dy, dw, dh };
};

const paintPixel = (x, y, color) => { pixelMap.set(`${x},${y}`, color); draw(); };
const paintPixelRowCol = (row, col, color) => paintPixel(col, row, color);

// ------------------------------
// --- Cooldown helpers
// ------------------------------
const getUserCooldownUntil = (uid = CONFIG.getCurrentUserId()) => cooldownUntilByUser.get(uid) || 0;
const setUserCooldownUntil  = (t, uid = CONFIG.getCurrentUserId()) => cooldownUntilByUser.set(uid, t);
const isOnCooldown = (uid = CONFIG.getCurrentUserId()) => Date.now() < getUserCooldownUntil(uid);

function startCooldown() {
  const uid = CONFIG.getCurrentUserId();
  const ms = Math.max(0, CONFIG.getCooldownMsForUser(uid) | 0);
  setUserCooldownUntil(Date.now() + ms, uid);

  if (!cooldownTimerId) {
    cooldownTimerId = setInterval(() => {
      updateCooldownUI();
      if (!isOnCooldown(uid)) {
        clearInterval(cooldownTimerId);
        cooldownTimerId = null;
      }
    }, 200);
  }
  updateCooldownUI();
}

function updateCooldownUI() {
  if (!colorButton) return;
  const uid = CONFIG.getCurrentUserId();
  if (isOnCooldown(uid)) {
    const sec = Math.max(0, Math.ceil((getUserCooldownUntil(uid) - Date.now()) / 1000));
    colorButton.disabled = true;
    colorButton.textContent = `Apply (${sec}s)`;
  } else {
    colorButton.disabled = false;
    colorButton.textContent = 'Apply';
  }
}

// ------------------------------
// --- Draw
// ------------------------------
function draw() {
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  ctx.setTransform(vpScale * scale, 0, 0, vpScale * scale, vpOffsetX + originX, vpOffsetY + originY);

  baseCtx.clearRect(0, 0, GRID, GRID);
  baseCtx.fillStyle = "#fff";
  baseCtx.fillRect(0, 0, GRID, GRID);

  pixelMap.forEach((c, k) => {
    const [x, y] = k.split(",").map(Number);
    baseCtx.fillStyle = c;
    baseCtx.fillRect(x, y, 1, 1);
  });

  ctx.drawImage(baseLayer, 0, 0);

  // outer perimeter (always visible)
  ctx.lineWidth = 2;
  ctx.strokeStyle = "rgba(0,0,0,0.6)";
  ctx.strokeRect(0, 0, GRID, GRID);


  // grid lines
  if (showGrid) {
    ctx.lineWidth = 2;
    ctx.strokeStyle = "rgba(0,0,0,0.35)";
    for (let i = QSIZE; i < GRID; i += QSIZE) {
      ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i, GRID); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(0, i); ctx.lineTo(GRID, i); ctx.stroke();
    }
  }
// quadrant numbers
  if (showNums) {
  ctx.fillStyle = "rgba(0,0,0,0.25)";
  ctx.font = "24px sans-serif"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
  for (let r = 0; r < QUADS; r++) for (let c = 0; c < QUADS; c++)
    ctx.fillText(r * QUADS + c + 1, c * QSIZE + QSIZE/2, r * QSIZE + QSIZE/2);
  }

  // hover overlay
  if (hoveredQuadrant) {
    const { dx, dy, dw, dh } = overlayRectForQuadrant(hoveredQuadrant);
    const s = QSIZE, sx = hoveredQuadrant.col * s, sy = hoveredQuadrant.row * s;
    ctx.save();
    ctx.imageSmoothingEnabled = false;

    ctx.fillStyle = "#fff"; ctx.fillRect(dx, dy, dw, dh);
    ctx.shadowColor = "rgba(0,0,0,0.28)"; ctx.shadowBlur = 18;
    ctx.drawImage(baseLayer, sx, sy, s, s, dx, dy, dw, dh);
    ctx.shadowColor = "transparent";

    ctx.lineWidth = 0.35; ctx.strokeStyle = "rgba(0,0,0,0.12)";
    for (let i=0;i<=s;i++){ const gx=dx+i*dw/s; ctx.beginPath(); ctx.moveTo(gx,dy); ctx.lineTo(gx,dy+dh); ctx.stroke(); }
    for (let j=0;j<=s;j++){ const gy=dy+j*dh/s; ctx.beginPath(); ctx.moveTo(dx,gy); ctx.lineTo(dx+dw,gy); ctx.stroke(); }
    ctx.restore();
  }
}

// ------------------------------
// --- Viewport / resize
// ------------------------------
function updateViewport() {
  const dpr = window.devicePixelRatio || 1;
  const w = Math.max(1, window.innerWidth), h = Math.max(1, window.innerHeight);
  canvas.style.width = w + "px"; canvas.style.height = h + "px";
  canvas.width = Math.floor(w*dpr); canvas.height = Math.floor(h*dpr);

  vpScale = Math.min(canvas.width, canvas.height) / GRID;
  vpOffsetX = (canvas.width - GRID*vpScale)/2;
  vpOffsetY = (canvas.height - GRID*vpScale)/2;
}

// ------------------------------
// --- Pointer & keyboard events
// ------------------------------

// make drags smooth and continuous
canvas.addEventListener("pointerdown", e => {
  lastMX = e.clientX; lastMY = e.clientY;
  isMouseDown = (e.button === 0);

  // capture so we keep getting moves even off-canvas
  canvas.setPointerCapture(e.pointerId);

  // start panning immediately for non-left button or when holding space
  if (e.button !== 0 || spaceDown) {
    isPanning = true;
    if (e.button === 0) suppressClickOnce = true;
    e.preventDefault();
  }
});

canvas.addEventListener("pointermove", e => {
  const { x, y } = getMouseWorld(e.clientX, e.clientY);

  if (isPanning) {
    const dx = e.clientX - lastMX, dy = e.clientY - lastMY;
    const r = canvas.getBoundingClientRect();
    const sx = canvas.width / r.width, sy = canvas.height / r.height;
    originX += dx * sx; originY += dy * sy;
    lastMX = e.clientX; lastMY = e.clientY;
    draw(); // critical: redraw while dragging so it "slides"
    return;
  }

  // not panning: update hover
  // When hovering near the edges of a zoomed quadrant, we want the
  // existing zoomed overlay to take priority over the underlying canvas.
  // This means that as long as the pointer remains within the enlarged
  // overlay region of the currently hovered quadrant, we keep that
  // quadrant active instead of switching to the adjacent one. Without
  // this check, moving near the quadrant's boundary would immediately
  // switch the hover to the neighboring quadrant.  (Dev note: added
  // overlay-boundary check to preserve hoveredQuadrant until the
  // pointer exits its overlay.)
  let nextHover;
  if (hoverLocked) {
    nextHover = lockedQuadrant;
  } else {
    nextHover = getQuadrantAt(x, y);
    if (hoveredQuadrant && nextHover !== hoveredQuadrant) {
      const { dx, dy, dw, dh } = overlayRectForQuadrant(hoveredQuadrant);
      if (x >= dx && x < dx + dw && y >= dy && y < dy + dh) {
        nextHover = hoveredQuadrant;
      }
    }
  }
  hoveredQuadrant = nextHover;
  canvas.style.cursor = hoveredQuadrant ? "crosshair" : "default";

  // promote to panning after threshold with left button
  if (isMouseDown &&
      (Math.abs(e.clientX - lastMX) > DRAG_THRESHOLD || Math.abs(e.clientY - lastMY) > DRAG_THRESHOLD)) {
    isPanning = true;
    suppressClickOnce = true;
    lastMX = e.clientX; lastMY = e.clientY;
    return; // next move will update/draw
  }

  draw();
});

canvas.addEventListener("pointerup", e => {
  isPanning = false;
  isMouseDown = false;
  try { canvas.releasePointerCapture(e.pointerId); } catch {}
});

// Click to select & (re)lock to the clicked quadrant, even if one is already selected
canvas.addEventListener("click", e => {
  if (suppressClickOnce) { suppressClickOnce = false; return; }
  const { x, y } = getMouseWorld(e.clientX, e.clientY);

  // If a zoomed quadrant is active but the click is outside its overlay, close the popup and unlock.
  if (hoveredQuadrant) {
    const { dx, dy, dw, dh } = overlayRectForQuadrant(hoveredQuadrant);
    if (x < dx || x >= dx + dw || y < dy || y >= dy + dh) {
      popup?.classList.add("hidden");
      hoverLocked = false; lockedQuadrant = null;
      draw();
      return;
    }
  }

  /**
   * When the mouse is over a zoomed-in quadrant (hoveredQuadrant), the overlay
   * extends beyond the boundaries of the base grid. Clicking within this
   * overlay should select the pixel relative to the enlarged view, not the
   * underlying world coordinate. The logic below checks if the click falls
   * inside the overlay bounding box. If it does, we map the click position
   * back into the hovered quadrant using the overlay's scale. Otherwise we
   * treat the click as a normal world-space selection.
   */
  let px, py, q;
  let handledByOverlay = false;
  if (hoveredQuadrant) {
    const { dx, dy, dw, dh } = overlayRectForQuadrant(hoveredQuadrant);
    if (x >= dx && x < dx + dw && y >= dy && y < dy + dh) {
      // Normalize the click position to a 0..1 range within the overlay
      const relX = (x - dx) / dw;
      const relY = (y - dy) / dh;
      // Map back into the original quadrant coordinates
      const mappedX = hoveredQuadrant.col * QSIZE + relX * QSIZE;
      const mappedY = hoveredQuadrant.row * QSIZE + relY * QSIZE;
      px = Math.floor(mappedX);
      py = Math.floor(mappedY);
      q = hoveredQuadrant;
      handledByOverlay = true;
    }
  }
  if (!handledByOverlay) {
    // Outside the overlay: only proceed if within the base grid
    if (x < 0 || y < 0 || x >= GRID || y >= GRID) return;
    q = getQuadrantAt(x, y);
    if (!q) return;
    px = Math.floor(x);
    py = Math.floor(y);
  }
  // At this point, q, px and py are defined
  selectedPixel = { row: py, col: px };

  // Lock hover to the clicked quadrant (whether via overlay or not)
  hoverLocked = true;
  lockedQuadrant = q;
  hoveredQuadrant = q;
  // Show or reposition popup near the click
  if (popup) {
    popup.classList.remove("hidden");
    popup.style.left = (e.pageX + 10) + "px";
    popup.style.top  = (e.pageY + 10) + "px";
    updateCooldownUI();
  }

  // Update pixel info: show the quadrant number along with the selected row/column
  if (pixelInfo) {
    pixelInfo.textContent = `Quadrant: ${q.row * QUADS + q.col + 1} | Column: ${px}, Row: ${py}`;
  }

  draw();
});


// Close popup
popupClose?.addEventListener("click", () => {
  popup.classList.add("hidden");
  hoverLocked = false; lockedQuadrant = null;
  draw();
});

// Apply color
colorButton?.addEventListener("click", () => {
  if (!selectedPixel) return;
if (isOnCooldown()) { updateCooldownUI(); return; }
paintPixelRowCol(selectedPixel.row, selectedPixel.col, colorSelect.value || "#000");
// Keep popup open so countdown stays visible
startCooldown();
draw();
});

// Zoom
canvas.addEventListener("wheel", e => {
  e.preventDefault();
  const r = canvas.getBoundingClientRect(), sx = canvas.width/r.width, sy = canvas.height/r.height;
  const cx = (e.clientX - r.left) * sx, cy = (e.clientY - r.top) * sy;
  const wx = (cx - vpOffsetX - originX) / (vpScale * scale);
  const wy = (cy - vpOffsetY - originY) / (vpScale * scale);
  const factor = e.deltaY < 0 ? 1.1 : 1/1.1;
  const newScale = Math.max(MIN_SCALE, Math.min(MAX_SCALE, scale * factor));
  if (newScale === scale) return;
  originX = cx - vpOffsetX - wx * vpScale * newScale;
  originY = cy - vpOffsetY - wy * vpScale * newScale;
  scale = newScale;
  draw();
}, { passive: false });

// Palette bg/fg contrast
(function(){
  const sel = colorSelect;
  const luminance = hex => {
    if (!hex||hex[0]!="#") return 1;
    const n = parseInt(hex.slice(1),16), r=(n>>16)&255, g=(n>>8)&255, b=n&255;
    return (0.2126*r + 0.7152*g + 0.0722*b)/255;
  };
  const paint = () => { sel.style.background = sel.value; sel.style.color = luminance(sel.value)>0.6?"#000":"#fff"; };
  sel.addEventListener("change", paint); paint();
})();

// Spacebar = temporary pan
window.addEventListener("keydown", e => {
  if (e.code === "Space") { spaceDown = true; e.preventDefault(); }
});
window.addEventListener("keyup", e => {
  if (e.code === "Space") { spaceDown = false; }
});

// Resize
window.addEventListener("resize", () => { updateViewport(); draw(); updateCooldownUI(); });

// Init
updateViewport(); draw(); updateCooldownUI();
