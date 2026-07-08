// QWRLY background service worker
// Owns: backend communication, Gmail OAuth token retrieval, periodic scan
// alarms, badge/notification state. All backend calls hit the URL the user
// sets in Settings (defaults to a local FastAPI instance for development).

const DEFAULT_API_BASE = 'https://qwrly-safe-click2-0.vercel.app';

async function getApiBase() {
  const { apiBase } = await chrome.storage.sync.get('apiBase');
  return apiBase || DEFAULT_API_BASE;
}

async function incrementCounter(key) {
  const data = await chrome.storage.local.get(key);
  const next = (data[key] || 0) + 1;
  await chrome.storage.local.set({ [key]: next });
  return next;
}

// --- URL / QR scan ---------------------------------------------------
async function scanUrl(url, source) {
  const apiBase = await getApiBase();
  await incrementCounter('scansToday');

  try {
    const res = await fetch(`${apiBase}/scan-url`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url, source })
    });

    if (!res.ok) {
      return { ok: false, error: `Backend returned ${res.status}` };
    }

    const data = await res.json();
    if (data.verdict === 'malicious') {
      await incrementCounter('threatsToday');
      notifyThreat(url, data.reason);
    }
    return { ok: true, ...data };
  } catch (err) {
    return { ok: false, error: 'Could not reach backend. Is the FastAPI server running and the URL set in Settings?' };
  }
}

function notifyThreat(url, reason) {
  chrome.notifications.create({
    type: 'basic',
    iconUrl: '../icons/icon128.png',
    title: 'QWRLY blocked a threat',
    message: `${url}\n${reason || 'Flagged as malicious.'}`,
    priority: 2
  });
  chrome.action.setBadgeBackgroundColor({ color: '#ff0055' });
  chrome.action.setBadgeText({ text: '!' });
}

// --- Gmail OAuth -------------------------------------------------------
// Requires manifest.json's oauth2.client_id to be a real Google Cloud
// OAuth client with the Gmail API enabled and gmail.readonly scope.
async function connectGmail() {
  return new Promise((resolve) => {
    chrome.identity.getAuthToken({ interactive: true }, (token) => {
      if (chrome.runtime.lastError || !token) {
        resolve({ ok: false, error: chrome.runtime.lastError?.message || 'Auth cancelled' });
        return;
      }
      chrome.storage.local.set({ gmailConnected: true });
      resolve({ ok: true, token });
    });
  });
}

async function disconnectGmail() {
  const { token } = await chrome.storage.local.get('token');
  if (token) {
    chrome.identity.removeCachedAuthToken({ token }, () => {});
  }
  await chrome.storage.local.set({ gmailConnected: false });
  return { ok: true };
}

// --- Message router ------------------------------------------------------
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  (async () => {
    switch (message.type) {
      case 'SCAN_URL':
        sendResponse(await scanUrl(message.payload.url, message.payload.source));
        break;
      case 'CONNECT_GMAIL':
        sendResponse(await connectGmail());
        break;
      case 'DISCONNECT_GMAIL':
        sendResponse(await disconnectGmail());
        break;
      case 'GET_API_BASE':
        sendResponse({ apiBase: await getApiBase() });
        break;
      case 'SET_API_BASE':
        await chrome.storage.sync.set({ apiBase: message.payload.apiBase });
        sendResponse({ ok: true });
        break;
      default:
        sendResponse({ ok: false, error: 'Unknown message type' });
    }
  })();
  return true; // keep the message channel open for async sendResponse
});

// --- Periodic Gmail poll (fallback to Pub/Sub push if configured) --------
chrome.alarms.create('gmail-poll', { periodInMinutes: 2 });
chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name !== 'gmail-poll') return;
  const { gmailConnected } = await chrome.storage.local.get('gmailConnected');
  if (!gmailConnected) return;

  const apiBase = await getApiBase();
  try {
    await fetch(`${apiBase}/gmail/poll`, { method: 'POST' });
  } catch (err) {
    // Backend offline — silently skip this cycle, surfaced in dashboard status instead.
  }
});

chrome.runtime.onInstalled.addListener((details) => {
  chrome.action.setBadgeText({ text: '' });
  if (details.reason === 'install') {
    chrome.tabs.create({ url: chrome.runtime.getURL('onboarding/login.html') });
  }
});
