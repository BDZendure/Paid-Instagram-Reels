const BACKEND = 'http://localhost:3000';
const CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789./\\|_-+=<>';

// ── State ──────────────────────────────────────────────────────────
let balanceCents = null;
let lastSlug = null;
let scrambleTimer = null;
let isScrambling = false;
let pollTimer = null;

// ── Helpers ────────────────────────────────────────────────────────
function formatBalance(cents) {
  return '$' + (cents / 100).toFixed(2);
}

function randomizeStr(str) {
  return str.split('').map(c => {
    if (c === '$' || c === '.') return c;
    return CHARS[Math.floor(Math.random() * CHARS.length)];
  }).join('');
}

function extractSlug(url) {
  const match = url.match(/\/reels\/([^/?#]+)/);
  return match ? match[1] : null;
}

// ── Overlay DOM ────────────────────────────────────────────────────
function buildOverlay() {
  const style = document.createElement('style');
  style.textContent = `
    @font-face {
      font-family: 'Orbitron';
      src: url('${chrome.runtime.getURL('assets/fonts/Orbitron-Bold.woff2')}') format('woff2');
      font-weight: 700;
    }
    @font-face {
      font-family: 'ShareTechMono';
      src: url('${chrome.runtime.getURL('assets/fonts/ShareTechMono-Regular.woff2')}') format('woff2');
    }
    #pir-widget {
      position: fixed !important;
      top: 16px !important;
      right: 16px !important;
      z-index: 2147483647 !important;
      background: rgba(8,8,12,0.82) !important;
      backdrop-filter: blur(12px) !important;
      -webkit-backdrop-filter: blur(12px) !important;
      border: 1px solid rgba(255,255,255,0.08) !important;
      border-radius: 10px !important;
      padding: 10px 14px !important;
      min-width: 110px !important;
      cursor: default !important;
      user-select: none !important;
      transition: border-color 0.3s ease, box-shadow 0.3s ease !important;
    }
    #pir-widget:hover {
      border-color: rgba(120,220,255,0.25) !important;
      box-shadow: 0 0 20px rgba(80,180,255,0.08), 0 0 1px rgba(120,220,255,0.3) !important;
    }
    #pir-label {
      font-family: 'ShareTechMono', monospace !important;
      font-size: 8px !important;
      letter-spacing: 0.18em !important;
      text-transform: uppercase !important;
      color: rgba(255,255,255,0.3) !important;
      margin-bottom: 4px !important;
    }
    #pir-balance {
      font-family: 'Orbitron', monospace !important;
      font-size: 20px !important;
      font-weight: 700 !important;
      color: #e2e8f0 !important;
      line-height: 1 !important;
      letter-spacing: 0.02em !important;
      min-width: 80px !important;
      display: inline-block !important;
      transition: color 0.15s ease !important;
    }
    #pir-balance.pir-scrambling { color: rgba(120,220,255,0.9) !important; }
    #pir-sub {
      font-family: 'ShareTechMono', monospace !important;
      font-size: 9px !important;
      color: rgba(255,255,255,0.2) !important;
      margin-top: 4px !important;
      letter-spacing: 0.08em !important;
    }
    #pir-blocked {
      display: none !important;
      position: fixed !important;
      inset: 0 !important;
      z-index: 2147483646 !important;
      backdrop-filter: blur(18px) !important;
      -webkit-backdrop-filter: blur(18px) !important;
      background: rgba(0,0,0,0.6) !important;
      flex-direction: column !important;
      align-items: center !important;
      justify-content: center !important;
      gap: 12px !important;
    }
    #pir-blocked.pir-visible { display: flex !important; }
    #pir-blocked-title {
      font-family: 'Orbitron', monospace !important;
      font-size: 13px !important;
      font-weight: 700 !important;
      letter-spacing: 0.12em !important;
      color: rgba(255,255,255,0.9) !important;
      text-transform: uppercase !important;
    }
    #pir-blocked-sub {
      font-family: 'ShareTechMono', monospace !important;
      font-size: 10px !important;
      color: rgba(255,255,255,0.35) !important;
      letter-spacing: 0.08em !important;
    }
    #pir-topup-btn {
      font-family: 'Orbitron', monospace !important;
      font-size: 10px !important;
      font-weight: 700 !important;
      letter-spacing: 0.12em !important;
      text-transform: uppercase !important;
      background: rgba(120,220,255,0.12) !important;
      border: 1px solid rgba(120,220,255,0.4) !important;
      color: rgba(120,220,255,0.9) !important;
      padding: 8px 20px !important;
      border-radius: 6px !important;
      cursor: pointer !important;
      transition: all 0.2s ease !important;
    }
    #pir-topup-btn:hover {
      background: rgba(120,220,255,0.2) !important;
      box-shadow: 0 0 16px rgba(120,220,255,0.15) !important;
    }
  `;
  document.head.appendChild(style);

  const widget = document.createElement('div');
  widget.id = 'pir-widget';
  widget.innerHTML = `
    <div id="pir-label">WALLET</div>
    <div id="pir-balance">---</div>
    <div id="pir-sub">loading...</div>
  `;
  widget.addEventListener('mouseenter', triggerScramble);
  document.body.appendChild(widget);

  const blocked = document.createElement('div');
  blocked.id = 'pir-blocked';
  blocked.innerHTML = `
    <div id="pir-blocked-title">BALANCE DEPLETED</div>
    <div id="pir-blocked-sub">ADD FUNDS TO CONTINUE</div>
    <button id="pir-topup-btn">TOP UP →</button>
  `;
  document.body.appendChild(blocked);

  document.getElementById('pir-topup-btn').addEventListener('click', quickTopUp);
}

// ── Scramble effect ────────────────────────────────────────────────
// Fires once on hover: 2 noise frames → reveal one char/frame → settle (~0.3s total)
function triggerScramble() {
  if (isScrambling || balanceCents === null) return;
  isScrambling = true;

  const el = document.getElementById('pir-balance');
  const target = formatBalance(balanceCents);
  el.classList.add('pir-scrambling');

  const NOISE_FRAMES = 2;
  const INTERVAL_MS = 30;
  let frame = 0;

  clearInterval(scrambleTimer);
  scrambleTimer = setInterval(() => {
    if (frame < NOISE_FRAMES) {
      el.textContent = randomizeStr(target);
    } else {
      const revealed = frame - NOISE_FRAMES;
      if (revealed >= target.length) {
        clearInterval(scrambleTimer);
        el.textContent = target;
        el.classList.remove('pir-scrambling');
        isScrambling = false;
        return;
      }
      el.textContent = target.slice(0, revealed) + randomizeStr(target.slice(revealed));
    }
    frame++;
  }, INTERVAL_MS);
}

// ── Overlay update ─────────────────────────────────────────────────
function updateOverlay(cents, blocked) {
  balanceCents = cents;

  const balEl = document.getElementById('pir-balance');
  const subEl = document.getElementById('pir-sub');
  const blockedEl = document.getElementById('pir-blocked');

  if (!isScrambling) balEl.textContent = formatBalance(cents);
  balEl.style.setProperty('color', cents <= 100 ? 'rgba(255,100,100,0.9)' : '#e2e8f0', 'important');
  subEl.textContent = Math.floor(cents / 10) + ' reels left';

  if (blocked) {
    blockedEl.classList.add('pir-visible');
    startPolling();
  } else {
    blockedEl.classList.remove('pir-visible');
  }
}

// ── Balance polling (detects top-up completion) ────────────────────
function startPolling() {
  if (pollTimer) return;
  pollTimer = setInterval(async () => {
    const { uuid } = await chrome.storage.local.get('uuid');
    if (!uuid) return;
    try {
      const res = await fetch(`${BACKEND}/wallet/balance?uuid=${uuid}`);
      if (!res.ok) return;
      const { balance_cents } = await res.json();
      if (balance_cents > 0) {
        updateOverlay(balance_cents, false);
        clearInterval(pollTimer);
        pollTimer = null;
      }
    } catch (_) {}
  }, 3000);
}

// ── Top-up (quick $5 from blocked overlay) ─────────────────────────
async function quickTopUp() {
  const { uuid } = await chrome.storage.local.get('uuid');
  if (!uuid) return;
  // Background script handles chrome.tabs.create (content scripts cannot)
  chrome.runtime.sendMessage({ type: 'TOPUP', uuid, amountCents: 500 });
}

// ── Deduct ─────────────────────────────────────────────────────────
async function deductReel(slug) {
  const { uuid } = await chrome.storage.local.get('uuid');
  if (!uuid) return;

  try {
    const res = await fetch(`${BACKEND}/deduct`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ uuid, slug }),
    });
    if (!res.ok) return;
    const { balance_cents, blocked } = await res.json();
    updateOverlay(balance_cents, blocked);
  } catch (err) {
    // Fail open — backend down must not block the user
    console.warn('[PaidReels] deduct failed, failing open:', err.message);
  }
}

// ── Initial balance fetch ──────────────────────────────────────────
async function fetchInitialBalance() {
  const { uuid } = await chrome.storage.local.get('uuid');
  if (!uuid) return;
  try {
    const res = await fetch(`${BACKEND}/wallet/balance?uuid=${uuid}`);
    if (!res.ok) return;
    const { balance_cents } = await res.json();
    updateOverlay(balance_cents, balance_cents <= 0);
  } catch (_) {}
}

// ── URL watcher ────────────────────────────────────────────────────
function onUrlChange() {
  const slug = extractSlug(window.location.href);
  if (slug && slug !== lastSlug) {
    lastSlug = slug;
    deductReel(slug);
  }
}

// Intercept history.pushState — Instagram's primary navigation method
const _pushState = history.pushState.bind(history);
history.pushState = function (...args) {
  _pushState(...args);
  onUrlChange();
};

window.addEventListener('popstate', onUrlChange);

// ── Init ───────────────────────────────────────────────────────────
function init() {
  buildOverlay();
  fetchInitialBalance();
  onUrlChange();
}

if (document.body) {
  init();
} else {
  document.addEventListener('DOMContentLoaded', init);
}
