// QWRLY dashboard logic
// Runs as an extension page (chrome-extension://.../dashboard/dashboard.html)
// so it has direct access to chrome.storage and can message the background
// worker for actions that need the service worker's context (OAuth, scans).

const navItems = document.querySelectorAll('.nav-item[data-tab]');
const panels = document.querySelectorAll('.dashboard-grid');

function switchTab(tabId) {
  navItems.forEach((item) => item.classList.toggle('active', item.dataset.tab === tabId));
  panels.forEach((panel) => panel.classList.toggle('active-panel', panel.id === tabId));
}

navItems.forEach((item) => {
  item.addEventListener('click', () => {
    switchTab(item.dataset.tab);
    history.replaceState(null, '', `#${item.dataset.tab}`);
  });
});

// Any element with data-goto="tabId" jumps to that tab (used in cross-links
// like "set your API URL in Settings").
document.querySelectorAll('[data-goto]').forEach((el) => {
  el.addEventListener('click', (e) => {
    e.preventDefault();
    switchTab(el.dataset.goto);
    history.replaceState(null, '', `#${el.dataset.goto}`);
  });
});

// Route based on the URL hash on load, e.g. #complaints/new from the popup
// or the Gmail content script's floating Report button.
function routeFromHash() {
  const hash = location.hash.replace('#', '');
  if (!hash) return;
  const [tab, action] = hash.split('/');
  if (document.getElementById(tab)) {
    switchTab(tab);
  }
  if (tab === 'complaints' && action === 'new') {
    document.getElementById('newComplaintCard').style.display = 'block';
  }
}
routeFromHash();
window.addEventListener('hashchange', routeFromHash);

// ---------------------------------------------------------------------
// Settings: backend URL, Twilio number, Retell config, notifications
// ---------------------------------------------------------------------
const settingsApiBase = document.getElementById('settingsApiBase');
const apiBaseSavedNote = document.getElementById('apiBaseSavedNote');
const settingsTwilioNumber = document.getElementById('settingsTwilioNumber');
const settingsRetellAgent = document.getElementById('settingsRetellAgent');
const settingsRetellPhone = document.getElementById('settingsRetellPhone');
const notifyToggle = document.getElementById('notifyToggle');

async function loadSettings() {
  const sync = await chrome.storage.sync.get([
    'apiBase', 'twilioNumber', 'retellAgentId', 'retellPhone', 'notifyOnThreat'
  ]);
  const local = await chrome.storage.local.get(['gmailConnected']);

  settingsApiBase.value = sync.apiBase || 'http://localhost:8000';
  settingsTwilioNumber.value = sync.twilioNumber || '';
  settingsRetellAgent.value = sync.retellAgentId || '';
  settingsRetellPhone.value = sync.retellPhone || '';
  notifyToggle.checked = sync.notifyOnThreat !== false;

  document.getElementById('twilioNumberDisplay').textContent = sync.twilioNumber || 'Not configured';
  document.getElementById('smsNumberDisplay').textContent = sync.twilioNumber || 'Not configured';

  const gmailLabel = local.gmailConnected ? 'Connected' : 'Not connected';
  document.getElementById('gmailStatusValue').textContent = gmailLabel;
  document.getElementById('gmailOauthStatus').textContent = gmailLabel;
  document.getElementById('settingsGmailStatus').textContent = gmailLabel;
}
loadSettings();

document.getElementById('saveApiBaseBtn').addEventListener('click', async () => {
  await chrome.storage.sync.set({ apiBase: settingsApiBase.value.trim() });
  apiBaseSavedNote.textContent = 'Saved.';
  setTimeout(() => (apiBaseSavedNote.textContent = ''), 2000);
});

document.getElementById('saveTwilioBtn').addEventListener('click', async () => {
  await chrome.storage.sync.set({ twilioNumber: settingsTwilioNumber.value.trim() });
  loadSettings();
});

document.getElementById('saveRetellBtn').addEventListener('click', async () => {
  await chrome.storage.sync.set({
    retellAgentId: settingsRetellAgent.value.trim(),
    retellPhone: settingsRetellPhone.value.trim()
  });
});

notifyToggle.addEventListener('change', async () => {
  await chrome.storage.sync.set({ notifyOnThreat: notifyToggle.checked });
});

document.getElementById('settingsConnectGmail').addEventListener('click', async () => {
  const res = await chrome.runtime.sendMessage({ type: 'CONNECT_GMAIL' });
  if (!res.ok) {
    alert(`Gmail connection failed: ${res.error}\n\nMake sure manifest.json has a real Google OAuth client ID with the Gmail API enabled.`);
  }
  loadSettings();
});

document.getElementById('settingsDisconnectGmail').addEventListener('click', async () => {
  await chrome.runtime.sendMessage({ type: 'DISCONNECT_GMAIL' });
  loadSettings();
});

document.getElementById('gmailConnectBtn').addEventListener('click', () => {
  document.getElementById('settingsConnectGmail').click();
  switchTab('settings');
});

// ---------------------------------------------------------------------
// Sandbox: manual URL scan
// ---------------------------------------------------------------------
document.getElementById('sandboxScanBtn').addEventListener('click', async () => {
  const url = document.getElementById('sandboxUrlInput').value.trim();
  const resultBox = document.getElementById('sandboxResult');
  if (!url) return;

  resultBox.className = 'scan-result-block';
  resultBox.textContent = 'Scanning…';

  const res = await chrome.runtime.sendMessage({
    type: 'SCAN_URL',
    payload: { url, source: 'dashboard_sandbox' }
  });

  if (!res || !res.ok) {
    resultBox.classList.add('risky');
    resultBox.textContent = res?.error || 'Could not reach the backend. Set the API base URL in Settings.';
    return;
  }

  if (res.verdict === 'malicious') {
    resultBox.classList.add('risky');
    resultBox.textContent = `Malicious — ${res.reason || 'matched a known threat signature'}.`;
  } else {
    resultBox.classList.add('safe');
    resultBox.textContent = 'Clean — no known threats found.';
  }
});

// ---------------------------------------------------------------------
// Complaints
// ---------------------------------------------------------------------
document.getElementById('newComplaintBtn').addEventListener('click', () => {
  const card = document.getElementById('newComplaintCard');
  card.style.display = card.style.display === 'none' ? 'block' : 'none';
});

document.getElementById('submitComplaintBtn').addEventListener('click', async () => {
  const what = document.getElementById('complaintWhat').value.trim();
  const artifact = document.getElementById('complaintArtifact').value.trim();
  const when = document.getElementById('complaintWhen').value.trim();
  if (!what) return;

  const { apiBase } = await chrome.storage.sync.get('apiBase');
  const base = apiBase || 'http://localhost:8000';

  try {
    await fetch(`${base}/complaints`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ source: 'manual', description: what, artifact, occurred_at: when })
    });
  } catch (err) {
    // Backend may not be running yet in a demo — still reflect it locally.
  }

  const tbody = document.getElementById('complaintsTableBody');
  const row = document.createElement('tr');
  row.innerHTML = `
    <td><span class="badge badge-info">Manual</span></td>
    <td>${what}</td>
    <td><code>${artifact || '—'}</code></td>
    <td><span class="badge badge-warning">Under review</span></td>
  `;
  tbody.prepend(row);

  document.getElementById('complaintWhat').value = '';
  document.getElementById('complaintArtifact').value = '';
  document.getElementById('complaintWhen').value = '';
  document.getElementById('newComplaintCard').style.display = 'none';

  const data = await chrome.storage.local.get('complaintsFiled');
  await chrome.storage.local.set({ complaintsFiled: (data.complaintsFiled || 0) + 1 });
});

// ---------------------------------------------------------------------
// Retell AI voice call — hits the backend's real trigger endpoint.
// Falls back to a clearly-labeled demo script if the backend is offline,
// so the panel is still explainable in a hackathon demo.
// ---------------------------------------------------------------------
document.getElementById('triggerCallBtn').addEventListener('click', async () => {
  const btn = document.getElementById('triggerCallBtn');
  const badge = document.getElementById('callStatusBadge');
  const transcript = document.getElementById('transcriptContainer');
  const jsonBlock = document.getElementById('jsonSchemaBlock');

  btn.disabled = true;
  btn.textContent = 'Dialing…';
  badge.className = 'badge badge-info';
  badge.textContent = 'Connecting…';
  transcript.innerHTML = `<div class="utterance"><span class="speaker-agent">QWRLY agent:</span> Placing outbound call…</div>`;

  const { apiBase, retellAgentId, retellPhone } = await chrome.storage.sync.get(['apiBase', 'retellAgentId', 'retellPhone']);
  const base = apiBase || 'http://localhost:8000';

  try {
    const res = await fetch(`${base}/retell/start-call`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ agent_id: retellAgentId, phone_number: retellPhone })
    });
    if (!res.ok) throw new Error('backend not ready');

    badge.className = 'badge badge-danger';
    badge.textContent = 'Live call running';
    btn.textContent = 'Call in progress…';
    transcript.innerHTML += `<div class="utterance"><span class="speaker-agent">QWRLY agent:</span> Call started — waiting for Retell's webhook to stream the transcript here.</div>`;
    // In production, listen for a runtime message pushed by background.js
    // when Retell's post-call webhook lands on your backend and forwards it.
  } catch (err) {
    runDemoScript(btn, badge, transcript, jsonBlock);
  }
});

function runDemoScript(btn, badge, transcript, jsonBlock) {
  transcript.innerHTML += `<div class="utterance muted-note">Backend not reachable — showing a sample call script for demo purposes.</div>`;

  setTimeout(() => {
    badge.className = 'badge badge-danger';
    badge.textContent = 'Live call running (demo)';
    btn.textContent = 'Call in progress…';
    transcript.innerHTML += `<div class="utterance"><span class="speaker-agent">QWRLY agent:</span> Hello, this is QWRLY. We noticed a suspicious link tied to your account. Did you interact with that message?</div>`;
  }, 1500);

  setTimeout(() => {
    transcript.innerHTML += `<div class="utterance"><span class="speaker-user">Caller:</span> Yes, I clicked it, but the page looked blank so I closed it.</div>`;
  }, 3500);

  setTimeout(() => {
    transcript.innerHTML += `<div class="utterance"><span class="speaker-agent">QWRLY agent:</span> Did you enter your password or any verification code on that page?</div>`;
    transcript.innerHTML += `<div class="utterance"><span class="speaker-user">Caller:</span> No, I closed it right away.</div>`;
    transcript.scrollTop = transcript.scrollHeight;
  }, 6000);

  setTimeout(() => {
    badge.className = 'badge badge-success';
    badge.textContent = 'Call completed (demo)';
    btn.disabled = false;
    btn.textContent = 'Start voice report call';

    jsonBlock.textContent = JSON.stringify({
      incident_state: 'COMPLETED',
      structured_analysis: {
        incident_type: 'phishing_link_click',
        clicked_link: true,
        credentials_compromised: false,
        amount_lost: 0.0,
        risk_level: 'medium'
      },
      telemetry_metrics: {
        duration_seconds: 38,
        user_sentiment: 'concerned_cooperative'
      }
    }, null, 2);
  }, 8500);
}
