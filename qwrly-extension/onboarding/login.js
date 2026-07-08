document.getElementById('togglePassword').addEventListener('click', () => {
  const passwordInput = document.getElementById('password');
  passwordInput.type = passwordInput.type === 'password' ? 'text' : 'password';
});

document.getElementById('googleOauthBtn').addEventListener('click', async () => {
  const res = await chrome.runtime.sendMessage({ type: 'CONNECT_GMAIL' });
  if (res.ok) {
    window.location.href = '../dashboard/dashboard.html#overview';
  } else {
    alert(`Google sign-in failed: ${res.error}\n\nSet a real Google OAuth client ID in manifest.json first.`);
  }
});

document.getElementById('loginForm').addEventListener('submit', (e) => {
  e.preventDefault();
  // Demo credential login — wire this to your own auth backend if QWRLY
  // needs account-level login separate from Gmail OAuth.
  window.location.href = '../dashboard/dashboard.html#overview';
});
