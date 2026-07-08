// QWRLY popup logic
// Talks to the background service worker for scans/state, and opens the
// full dashboard (options page) for deeper views.

const complaintBtn = document.getElementById('complaintBtn');
const openDashboard = document.getElementById('openDashboard');
const openSettings = document.getElementById('openSettings');
const quickScanBtn = document.getElementById('quickScanBtn');
const quickUrl = document.getElementById('quickUrl');
const scanResult = document.getElementById('scanResult');

function openDashboardTab(hash) {
  const url = chrome.runtime.getURL('dashboard/dashboard.html') + (hash ? `#${hash}` : '');
  chrome.tabs.create({ url });
}

// Top-right complaint button — jumps straight to a pre-filled complaint form
// in the dashboard, same entry point used by the on-page injected button.
complaintBtn.addEventListener('click', () => {
  openDashboardTab('complaints/new');
});

openDashboard.addEventListener('click', () => openDashboardTab('overview'));
openSettings.addEventListener('click', () => openDashboardTab('settings'));

quickScanBtn.addEventListener('click', async () => {
  const value = quickUrl.value.trim();
  if (!value) return;

  scanResult.className = 'scan-result';
  scanResult.textContent = 'Scanning…';

  try {
    const response = await chrome.runtime.sendMessage({
      type: 'SCAN_URL',
      payload: { url: value, source: 'popup_manual' }
    });

    if (!response || !response.ok) {
      scanResult.classList.add('risky');
      scanResult.textContent = response?.error || 'Could not reach the scan backend — check Settings.';
      return;
    }

    if (response.verdict === 'malicious') {
      scanResult.classList.add('risky');
      scanResult.textContent = `Flagged: ${response.reason || 'matches a known threat signature'}.`;
    } else {
      scanResult.classList.add('safe');
      scanResult.textContent = 'No known threats found.';
    }
  } catch (err) {
    scanResult.classList.add('risky');
    scanResult.textContent = 'Backend unreachable — set your API URL in Settings.';
  }
});

// Populate live counters from local storage (kept in sync by background.js)
chrome.storage.local.get(['threatsToday', 'scansToday', 'complaintsFiled'], (data) => {
  if (data.threatsToday !== undefined) document.getElementById('threatsToday').textContent = data.threatsToday;
  if (data.scansToday !== undefined) document.getElementById('scansToday').textContent = data.scansToday;
  if (data.complaintsFiled !== undefined) document.getElementById('complaintsFiled').textContent = data.complaintsFiled;
});
