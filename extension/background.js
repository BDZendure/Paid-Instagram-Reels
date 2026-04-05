const BACKEND = 'http://localhost:3000';

chrome.runtime.onInstalled.addListener(async () => {
  const { uuid } = await chrome.storage.local.get('uuid');
  if (uuid) return; // already initialized

  const newUuid = crypto.randomUUID();
  await chrome.storage.local.set({ uuid: newUuid });

  try {
    await fetch(`${BACKEND}/wallet/init`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ uuid: newUuid }),
    });
  } catch (err) {
    console.error('[PaidReels] Failed to init wallet:', err.message);
  }
});

// Handle top-up requests from content.js (content scripts cannot call chrome.tabs.create)
chrome.runtime.onMessage.addListener((msg) => {
  if (msg.type === 'TOPUP') {
    initiateTopUp(msg.uuid, msg.amountCents);
  }
});

async function initiateTopUp(uuid, amountCents) {
  try {
    const res = await fetch(`${BACKEND}/checkout`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ uuid, amount_cents: amountCents }),
    });
    const { url } = await res.json();
    if (url) chrome.tabs.create({ url });
  } catch (err) {
    console.error('[PaidReels] Top-up failed:', err.message);
  }
}
