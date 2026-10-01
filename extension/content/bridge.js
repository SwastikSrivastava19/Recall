// Recall Extension - Web Bridge Script
// Runs on http://localhost:3000/extension/link* to securely capture auth tokens from the web app

(function () {
  console.log('[Recall Bridge] Connecting to Recall web app...');

  function captureToken(token, user) {
    if (!token) return;
    console.log('[Recall Bridge] Captured auth token:', token);

    chrome.runtime.sendMessage(
      {
        action: 'SAVE_AUTH',
        token,
        user: user || { id: token, email: 'test@recall.dev' },
      },
      (response) => {
        if (response && response.success) {
          console.log('[Recall Bridge] Successfully synchronized with Recall extension storage.');
          // Update the DOM to give visual confirmation
          const el = document.getElementById('recall-extension-auth');
          if (el) {
            el.setAttribute('data-extension-synced', 'true');
          }
        }
      }
    );
  }

  // 1. Check DOM for pre-rendered attribute
  function checkDom() {
    const authEl = document.getElementById('recall-extension-auth');
    if (authEl) {
      const token = authEl.getAttribute('data-token');
      const email = authEl.getAttribute('data-user-email');
      if (token) {
        captureToken(token, { id: token, email: email || 'test@recall.dev' });
        return true;
      }
    }
    return false;
  }

  // 2. Listen for window postMessage events from React page
  window.addEventListener('message', (event) => {
    if (event.data && event.data.type === 'RECALL_EXTENSION_AUTH') {
      const { token, user } = event.data;
      captureToken(token, user);
    }
  });

  // Execute DOM check immediately and on DOMContentLoaded
  if (!checkDom()) {
    document.addEventListener('DOMContentLoaded', checkDom);
    // Polling retry for client-side hydration
    let retries = 0;
    const interval = setInterval(() => {
      if (checkDom() || ++retries > 10) {
        clearInterval(interval);
      }
    }, 500);
  }
})();
