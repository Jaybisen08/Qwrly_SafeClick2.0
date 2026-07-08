// QWRLY content script — runs on mail.google.com
// 1. Injects a floating "Report" button in the top-right corner of the page.
// 2. Watches the DOM for opened emails, extracts links, sends each to the
//    background worker for a reputation check, and flags malicious ones
//    inline with a warning badge next to the link.

const SCANNED_ATTR = 'data-qwrly-scanned';

function injectFloatingButton() {
  if (document.getElementById('qwrly-float-btn')) return;

  const btn = document.createElement('button');
  btn.id = 'qwrly-float-btn';
  btn.innerHTML = `
    <img src="${chrome.runtime.getURL('icons/icon32.png')}" alt="" />
    <span>Report</span>
  `;
  btn.title = 'Report a suspicious email or link to QWRLY';
  btn.addEventListener('click', () => {
    chrome.runtime.sendMessage({ type: 'OPEN_COMPLAINT_FORM' });
    window.open(chrome.runtime.getURL('dashboard/dashboard.html#complaints/new'), '_blank');
  });

  document.body.appendChild(btn);
}

function scanLinkElement(anchor) {
  if (anchor.hasAttribute(SCANNED_ATTR)) return;
  const href = anchor.href;
  if (!href || href.startsWith('mailto:') || href.startsWith('javascript:')) return;

  anchor.setAttribute(SCANNED_ATTR, 'pending');

  chrome.runtime.sendMessage(
    { type: 'SCAN_URL', payload: { url: href, source: 'gmail_content_script' } },
    (response) => {
      if (!response) return;
      anchor.setAttribute(SCANNED_ATTR, 'done');

      if (response.ok && response.verdict === 'malicious') {
        flagAnchor(anchor, response.reason);
      }
    }
  );
}

function flagAnchor(anchor, reason) {
  if (anchor.parentElement.querySelector('.qwrly-warning-badge')) return;

  const badge = document.createElement('span');
  badge.className = 'qwrly-warning-badge';
  badge.textContent = 'QWRLY: malicious link';
  badge.title = reason || 'This link matched a known threat signature.';
  anchor.insertAdjacentElement('afterend', badge);
  anchor.classList.add('qwrly-flagged-link');
}

function scanVisibleEmailLinks() {
  // Gmail renders email bodies inside elements with role="listitem" / message
  // containers; scanning all links within the main content pane is a safe,
  // broad net without needing Gmail's internal DOM class names (which churn).
  const links = document.querySelectorAll(`a[href^="http"]:not([${SCANNED_ATTR}])`);
  links.forEach(scanLinkElement);
}

const observer = new MutationObserver(() => {
  scanVisibleEmailLinks();
});

function init() {
  injectFloatingButton();
  scanVisibleEmailLinks();
  observer.observe(document.body, { childList: true, subtree: true });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
