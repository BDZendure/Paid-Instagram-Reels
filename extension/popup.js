const BACKEND = 'http://localhost:3000';

async function loadBalance() {
  const { uuid } = await chrome.storage.local.get('uuid');
  if (!uuid) {
    document.getElementById('balance').textContent = '$0.00';
    return;
  }
  try {
    const res = await fetch(`${BACKEND}/wallet/balance?uuid=${uuid}`);
    const { balance_cents } = await res.json();
    const el = document.getElementById('balance');
    el.textContent = '$' + (balance_cents / 100).toFixed(2);
    if (balance_cents <= 100) el.classList.add('low');
  } catch (_) {
    document.getElementById('balance').textContent = 'ERR';
  }
}

async function topUp(amountCents) {
  const statusEl = document.getElementById('status');
  statusEl.textContent = 'REDIRECTING...';

  const { uuid } = await chrome.storage.local.get('uuid');
  if (!uuid) { statusEl.textContent = 'ERROR: NO UUID'; return; }

  try {
    const res = await fetch(`${BACKEND}/checkout`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ uuid, amount_cents: amountCents }),
    });
    const { url, error } = await res.json();
    if (error) { statusEl.textContent = error.toUpperCase().slice(0, 30); return; }
    chrome.tabs.create({ url });
    window.close();
  } catch (_) {
    statusEl.textContent = 'CONNECTION ERROR';
  }
}

document.querySelectorAll('.amount-btn').forEach(btn => {
  btn.addEventListener('click', () => topUp(parseInt(btn.dataset.cents, 10)));
});

loadBalance();
