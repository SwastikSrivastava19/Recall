// Recall Chrome Extension - LeetCode Content Script (Manifest V3)
// Detects "Accepted" submissions on LeetCode problem pages and presents a friction-free capture overlay.
// Bug Fix: Only triggers after explicit user submit click + verified "Accepted" result. Handles SPA navigation.

(function () {
  console.log('[Recall] LeetCode content script initialized on', window.location.href);

  // 1. Inject main-world interceptor for LeetCode API polling & SPA navigation
  function injectMainWorldInterceptor() {
    try {
      const script = document.createElement('script');
      script.textContent = `
        (function() {
          if (window.__recall_interceptor_active) return;
          window.__recall_interceptor_active = true;

          // A. Intercept fetch for /submissions/detail/*/check/
          const origFetch = window.fetch;
          window.fetch = async function(...args) {
            const response = await origFetch.apply(this, args);
            try {
              const url = typeof args[0] === 'string' ? args[0] : (args[0] && args[0].url) || '';
              if (url.includes('/check/') || url.includes('/submissions/detail/')) {
                const cloned = response.clone();
                cloned.json().then(data => {
                  window.dispatchEvent(new CustomEvent('recall:submission-check-response', { detail: data }));
                }).catch(() => {});
              }
            } catch (e) {}
            return response;
          };

          // B. Intercept XMLHttpRequest for legacy/console checks
          const origOpen = XMLHttpRequest.prototype.open;
          const origSend = XMLHttpRequest.prototype.send;
          XMLHttpRequest.prototype.open = function(method, url, ...rest) {
            this._recall_url = url;
            return origOpen.apply(this, [method, url, ...rest]);
          };
          XMLHttpRequest.prototype.send = function(...args) {
            this.addEventListener('load', function() {
              try {
                if (this._recall_url && (this._recall_url.includes('/check/') || this._recall_url.includes('/submissions/detail/'))) {
                  const data = JSON.parse(this.responseText);
                  window.dispatchEvent(new CustomEvent('recall:submission-check-response', { detail: data }));
                }
              } catch (e) {}
            });
            return origSend.apply(this, args);
          };

          // C. Intercept History API for SPA navigation detection
          const origPush = history.pushState;
          history.pushState = function(...args) {
            const ret = origPush.apply(this, args);
            window.dispatchEvent(new CustomEvent('recall:spa-navigation', { detail: { url: window.location.href } }));
            return ret;
          };
          const origReplace = history.replaceState;
          history.replaceState = function(...args) {
            const ret = origReplace.apply(this, args);
            window.dispatchEvent(new CustomEvent('recall:spa-navigation', { detail: { url: window.location.href } }));
            return ret;
          };
        })();
      `;
      (document.head || document.documentElement).appendChild(script);
      script.remove();
    } catch (e) {
      console.warn('[Recall] Could not inject main world interceptor:', e);
    }
  }
  injectMainWorldInterceptor();

  // Problem extraction helpers
  function extractProblemSlug() {
    const match = window.location.pathname.match(/\/problems\/([^/]+)/);
    if (match) return match[1];
    const params = new URLSearchParams(window.location.search);
    if (params.get('problem')) return params.get('problem');
    if (window.__mockProblemSlug) return window.__mockProblemSlug;
    if (window.location.pathname.includes('mock-leetcode')) return 'lru-cache';
    return '';
  }

  function formatSlugToTitle(slug) {
    if (!slug) return 'LeetCode Problem';
    return slug
      .split('-')
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(' ');
  }

  function extractProblemName() {
    // 1. Try DOM elements with question title
    const titleEl =
      document.querySelector('div[data-cy="question-title"]') ||
      document.querySelector('.text-title-large') ||
      document.querySelector('div[class*="text-title-large"]');
    if (titleEl && titleEl.textContent) {
      const raw = titleEl.textContent.trim();
      return raw.replace(/^\d+\.\s*/, '');
    }

    // 2. Try document title
    const docTitle = document.title;
    if (docTitle && docTitle.includes('- LeetCode')) {
      const parts = docTitle.split('- LeetCode')[0].trim();
      return parts.replace(/^\d+\.\s*/, '');
    }

    // 3. Fallback to URL slug
    return formatSlugToTitle(extractProblemSlug());
  }

  function extractDifficulty() {
    const textElements = Array.from(
      document.querySelectorAll(
        'div[class*="text-olive"], div[class*="text-yellow"], div[class*="text-pink"], span[class*="text-olive"], span[class*="text-yellow"], span[class*="text-pink"], [data-degree]'
      )
    );

    for (const el of textElements) {
      const text = el.textContent ? el.textContent.trim().toLowerCase() : '';
      if (['easy', 'medium', 'hard'].includes(text)) {
        return text;
      }
    }

    const allBadges = Array.from(document.querySelectorAll('div, span'));
    for (const el of allBadges) {
      if (el.children.length === 0 && el.textContent) {
        const t = el.textContent.trim().toLowerCase();
        if (t === 'easy' || t === 'medium' || t === 'hard') {
          return t;
        }
      }
    }

    return 'medium';
  }

  function extractTopicTags() {
    const tags = new Set();
    const tagElements = document.querySelectorAll('a[href*="/tag/"]');
    tagElements.forEach((el) => {
      const text = el.textContent ? el.textContent.trim().toLowerCase() : '';
      if (text) {
        tags.add(text.replace(/\s+/g, '-'));
      }
    });

    if (tags.size > 0) {
      return Array.from(tags);
    }

    const slug = extractProblemSlug();
    if (slug.includes('tree')) tags.add('trees');
    else if (slug.includes('graph')) tags.add('graphs');
    else if (slug.includes('array')) tags.add('arrays');
    else if (slug.includes('string')) tags.add('strings');
    else tags.add('leetcode');

    return Array.from(tags);
  }

  function extractProblemUrl() {
    const slug = extractProblemSlug();
    if (slug) {
      return `https://leetcode.com/problems/${slug}/`;
    }
    return window.location.origin + window.location.pathname;
  }

  // State Management & SPA Navigation Tracking
  let currentProblemSlug = extractProblemSlug();
  let pageOpenTimestamp = Date.now();
  let isAwaitingSubmission = false; // Strictly required to be TRUE for any overlay to trigger!
  let submitClickTimestamp = 0;
  let hasTriggeredForCurrentProblem = false;
  let activeOverlayRoot = null;
  let inactivityTimeoutId = null;

  function resetProblemState(newSlug) {
    console.log(`[Recall] Navigation detected: from "${currentProblemSlug}" to "${newSlug}". Resetting state.`);
    currentProblemSlug = newSlug;
    pageOpenTimestamp = Date.now();
    isAwaitingSubmission = false;
    submitClickTimestamp = 0;
    hasTriggeredForCurrentProblem = false;

    if (inactivityTimeoutId) {
      clearTimeout(inactivityTimeoutId);
      inactivityTimeoutId = null;
    }
    if (activeOverlayRoot) {
      activeOverlayRoot.remove();
      activeOverlayRoot = null;
    }
  }

  function checkNavigation() {
    const newSlug = extractProblemSlug();
    if (newSlug && newSlug !== currentProblemSlug) {
      resetProblemState(newSlug);
    }
  }

  window.addEventListener('popstate', checkNavigation);
  window.addEventListener('recall:spa-navigation', checkNavigation);
  setInterval(checkNavigation, 500);

  // Explicit Submit Action Listener
  function onUserInitiatedSubmit() {
    if (hasTriggeredForCurrentProblem) {
      console.log('[Recall] Already triggered for this problem solve. Ignoring duplicate submit.');
      return;
    }

    console.log('[Recall] User initiated Submit. Awaiting verification of result...');
    isAwaitingSubmission = true;
    submitClickTimestamp = Date.now();

    // Safety timeout: stop awaiting after 90 seconds if no result arrived
    setTimeout(() => {
      if (isAwaitingSubmission && !hasTriggeredForCurrentProblem) {
        console.log('[Recall] Submission verification window timed out (90s).');
        isAwaitingSubmission = false;
      }
    }, 90000);
  }

  // Intercept submit clicks anywhere in DOM
  document.addEventListener(
    'click',
    (e) => {
      const target = e.target;
      if (!target) return;

      // Do not treat clicks inside our own capture overlay as submissions!
      if (target.closest && target.closest('#recall-capture-overlay-host')) {
        return;
      }

      const submitBtn = target.closest(
        '[data-e2e-locator="console-submit-button"], button[data-cypress="submit-code-btn"], #btn-submit-solution, button, [role="button"]'
      );

      if (submitBtn) {
        const text = (submitBtn.textContent || '').trim().toLowerCase();
        const locator = submitBtn.getAttribute('data-e2e-locator') || '';
        const id = submitBtn.id || '';

        if (
          text === 'submit' ||
          text.startsWith('submit') ||
          locator === 'console-submit-button' ||
          id === 'btn-submit-solution' ||
          submitBtn.classList.contains('submit-btn')
        ) {
          onUserInitiatedSubmit();
        }
      }
    },
    true
  );

  // Keyboard shortcut listener for Cmd+Enter / Ctrl+Enter
  document.addEventListener(
    'keydown',
    (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
        onUserInitiatedSubmit();
      }
    },
    true
  );

  // Verified Accepted Handler
  function handleVerifiedAccepted(source) {
    // GUARD 1: Must be explicitly awaiting a submission from user action
    if (!isAwaitingSubmission) {
      console.log(`[Recall] Ignored Accepted signal from ${source}: user has not submitted solution on this page.`);
      return;
    }

    // GUARD 2: Must not have already shown overlay for this problem cycle
    if (hasTriggeredForCurrentProblem) {
      console.log(`[Recall] Ignored Accepted signal from ${source}: overlay already shown.`);
      return;
    }

    // Verified!
    isAwaitingSubmission = false;
    hasTriggeredForCurrentProblem = true;
    console.log(`[Recall] VERIFIED ACCEPTED solve from ${source}! Displaying capture overlay.`);

    const timeTakenSeconds = Math.max(15, Math.round((Date.now() - pageOpenTimestamp) / 1000));
    const problemName = extractProblemName();
    const problemLink = extractProblemUrl();
    const difficulty = extractDifficulty();
    const topicTags = extractTopicTags();

    console.log('[Recall] Scraped problem metadata:', {
      problemName,
      problemLink,
      difficulty,
      topicTags,
      timeTakenSeconds,
    });

    showCaptureOverlay({
      problemName,
      problemLink,
      difficulty,
      topicTags,
      timeTakenSeconds,
    });
  }

  // Network API Interception Listener (Task 3)
  window.addEventListener('recall:submission-check-response', (e) => {
    const data = (e && e.detail) || {};
    console.log('[Recall] Intercepted submission check response:', data);

    // If still in progress (PENDING), wait for next check
    if (data.state && data.state !== 'SUCCESS') return;

    // Check specific result status
    const statusMsg = data.status_msg || '';
    const statusCode = data.status_code;

    if (statusMsg === 'Accepted' || statusCode === 10) {
      handleVerifiedAccepted('network-api');
    } else if (statusMsg || statusCode) {
      // Wrong Answer, Runtime Error, Time Limit Exceeded, etc.
      console.log(`[Recall] Submission result is not accepted: "${statusMsg}" (code: ${statusCode}). Resetting submit state.`);
      isAwaitingSubmission = false;
    }
  });

  // DOM Mutation Observer (Task 2 & Fallback)
  function checkDomForSubmissionResult() {
    if (!isAwaitingSubmission || hasTriggeredForCurrentProblem) return;

    // Look for dedicated submission result elements
    const resultElements = document.querySelectorAll(
      '[data-e2e-locator="submission-result"], #submission-result-box, .result-container, span[class*="text-green"], div[class*="text-green"]'
    );

    for (const el of resultElements) {
      const text = (el.textContent || '').trim();

      if (text === 'Accepted') {
        // Confirm it's not a navigation tab or button
        const isButtonOrTab = el.closest('button, [role="tab"], select, nav');
        if (!isButtonOrTab) {
          handleVerifiedAccepted('dom-observer');
          return;
        }
      } else if (
        text.includes('Wrong Answer') ||
        text.includes('Runtime Error') ||
        text.includes('Time Limit Exceeded') ||
        text.includes('Compile Error') ||
        text.includes('Memory Limit Exceeded')
      ) {
        console.log(`[Recall] DOM shows non-accepted result: "${text}". Resetting submit state.`);
        isAwaitingSubmission = false;
        return;
      }
    }
  }

  const observer = new MutationObserver(() => {
    checkDomForSubmissionResult();
  });

  observer.observe(document.body, {
    childList: true,
    subtree: true,
  });

  // Inject Capture Overlay using isolated Shadow DOM
  function showCaptureOverlay(data) {
    if (activeOverlayRoot) {
      activeOverlayRoot.remove();
      activeOverlayRoot = null;
    }

    const hostDiv = document.createElement('div');
    hostDiv.id = 'recall-capture-overlay-host';
    hostDiv.style.cssText = 'all: initial; position: fixed; z-index: 2147483647; bottom: 24px; right: 24px;';
    document.body.appendChild(hostDiv);
    activeOverlayRoot = hostDiv;

    const shadow = hostDiv.attachShadow({ mode: 'open' });

    const style = document.createElement('style');
    style.textContent = `
      * {
        box-sizing: border-box;
        margin: 0;
        padding: 0;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
      }
      
      .overlay-panel {
        width: 340px;
        background-color: #141417;
        border: 1px solid rgba(255, 255, 255, 0.16);
        border-radius: 12px;
        color: #fafafa;
        padding: 18px 20px;
        box-shadow: 0 16px 36px rgba(0, 0, 0, 0.6);
        animation: slideIn 0.25s cubic-bezier(0.16, 1, 0.3, 1);
        display: flex;
        flex-direction: column;
        gap: 14px;
      }

      @keyframes slideIn {
        from {
          opacity: 0;
          transform: translateY(16px) scale(0.97);
        }
        to {
          opacity: 1;
          transform: translateY(0) scale(1);
        }
      }

      .overlay-header {
        display: flex;
        justify-content: space-between;
        align-items: flex-start;
      }

      .eyebrow {
        font-family: monospace;
        font-size: 10px;
        font-weight: 700;
        letter-spacing: 0.08em;
        text-transform: uppercase;
        color: #a1a1aa;
        display: flex;
        align-items: center;
        gap: 6px;
      }

      .pulse-dot {
        width: 6px;
        height: 6px;
        border-radius: 50%;
        background-color: #ffffff;
      }

      .close-btn {
        background: none;
        border: none;
        color: #71717a;
        cursor: pointer;
        padding: 2px;
        display: flex;
        align-items: center;
        justify-content: center;
        transition: color 0.15s ease;
      }

      .close-btn:hover {
        color: #fafafa;
      }

      .problem-meta {
        display: flex;
        flex-direction: column;
        gap: 4px;
      }

      .problem-title-row {
        display: flex;
        align-items: baseline;
        justify-content: space-between;
        gap: 8px;
      }

      .problem-title {
        font-size: 15px;
        font-weight: 700;
        color: #fafafa;
        letter-spacing: -0.01em;
        line-height: 1.3;
      }

      .diff-badge {
        font-family: monospace;
        font-size: 10px;
        font-weight: 600;
        text-transform: uppercase;
        padding: 2px 6px;
        border-radius: 4px;
        background-color: #1c1c21;
        border: 1px solid rgba(255, 255, 255, 0.12);
        color: #d4d4d8;
        flex-shrink: 0;
      }

      .time-row {
        font-family: monospace;
        font-size: 11px;
        color: #a1a1aa;
      }

      .question-group {
        display: flex;
        flex-direction: column;
        gap: 8px;
      }

      .question-label {
        font-size: 11px;
        font-weight: 600;
        color: #d4d4d8;
        text-transform: uppercase;
        letter-spacing: 0.04em;
      }

      .toggle-grid {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 6px;
      }

      .toggle-btn {
        background-color: #121215;
        border: 1px solid rgba(255, 255, 255, 0.12);
        border-radius: 6px;
        padding: 8px;
        color: #a1a1aa;
        font-size: 12px;
        font-weight: 500;
        cursor: pointer;
        transition: all 0.15s ease;
        text-align: center;
      }

      .toggle-btn:hover {
        background-color: #1c1c21;
        color: #fafafa;
      }

      .toggle-btn.active {
        background-color: #27272a;
        border-color: #ffffff;
        color: #ffffff;
        font-weight: 600;
      }

      .confidence-grid {
        display: grid;
        grid-template-columns: repeat(5, 1fr);
        gap: 4px;
      }

      .conf-btn {
        background-color: #121215;
        border: 1px solid rgba(255, 255, 255, 0.12);
        border-radius: 6px;
        padding: 6px 2px;
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 2px;
        cursor: pointer;
        transition: all 0.15s ease;
      }

      .conf-btn:hover {
        background-color: #1c1c21;
      }

      .conf-btn.active {
        background-color: #27272a;
        border-color: #ffffff;
      }

      .conf-num {
        font-family: monospace;
        font-size: 12px;
        font-weight: 700;
        color: #fafafa;
      }

      .conf-label {
        font-size: 9px;
        color: #71717a;
      }

      .conf-btn.active .conf-label {
        color: #d4d4d8;
      }

      .submit-btn {
        background-color: #f4f4f5;
        color: #09090b;
        border: 1px solid transparent;
        border-radius: 6px;
        padding: 9px 12px;
        font-size: 12px;
        font-weight: 600;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 6px;
        transition: all 0.15s ease;
        margin-top: 4px;
      }

      .submit-btn:hover {
        background-color: #ffffff;
      }

      .submit-btn:active {
        background-color: #e4e4e7;
        transform: translateY(1px);
      }

      .submit-btn:disabled {
        opacity: 0.5;
        cursor: not-allowed;
      }

      .success-box {
        display: flex;
        flex-direction: column;
        align-items: center;
        text-align: center;
        padding: 12px 6px;
        gap: 8px;
        animation: fadeIn 0.2s ease;
      }

      @keyframes fadeIn {
        from { opacity: 0; transform: scale(0.98); }
        to { opacity: 1; transform: scale(1); }
      }

      .success-title {
        font-size: 14px;
        font-weight: 700;
        color: #fafafa;
      }

      .success-sub {
        font-size: 12px;
        color: #a1a1aa;
        line-height: 1.4;
      }
    `;
    shadow.appendChild(style);

    const container = document.createElement('div');
    container.className = 'overlay-panel';
    container.id = 'recall-capture-card';

    const minutes = Math.floor(data.timeTakenSeconds / 60);
    const seconds = data.timeTakenSeconds % 60;
    const timeDisplay = `${minutes}m ${seconds}s`;

    container.innerHTML = `
      <div class="overlay-header">
        <span class="eyebrow">
          <span class="pulse-dot"></span>
          Recall • Solve Detected
        </span>
        <button class="close-btn" id="overlay-close-btn" title="Dismiss without saving">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <line x1="18" y1="6" x2="6" y2="18"></line>
            <line x1="6" y1="6" x2="18" y2="18"></line>
          </svg>
        </button>
      </div>

      <div class="problem-meta">
        <div class="problem-title-row">
          <span class="problem-title">${data.problemName}</span>
          <span class="diff-badge">${data.difficulty}</span>
        </div>
        <span class="time-row">Time taken: ${timeDisplay}</span>
      </div>

      <div id="questions-wrapper">
        <div class="question-group" style="margin-bottom: 12px;">
          <label class="question-label">1. Solved without hints?</label>
          <div class="toggle-grid">
            <button type="button" class="toggle-btn active" id="btn-hint-none" data-hint="none">
              Yes (Hint-free)
            </button>
            <button type="button" class="toggle-btn" id="btn-hint-needed" data-hint="partial">
              No (Needed hint)
            </button>
          </div>
        </div>

        <div class="question-group" style="margin-bottom: 12px;">
          <label class="question-label">2. Confidence Rating</label>
          <div class="confidence-grid">
            <button type="button" class="conf-btn" data-conf="1">
              <span class="conf-num">1</span>
              <span class="conf-label">Shaky</span>
            </button>
            <button type="button" class="conf-btn" data-conf="2">
              <span class="conf-num">2</span>
              <span class="conf-label">Hard</span>
            </button>
            <button type="button" class="conf-btn" data-conf="3">
              <span class="conf-num">3</span>
              <span class="conf-label">Fair</span>
            </button>
            <button type="button" class="conf-btn active" data-conf="4">
              <span class="conf-num">4</span>
              <span class="conf-label">Solid</span>
            </button>
            <button type="button" class="conf-btn" data-conf="5">
              <span class="conf-num">5</span>
              <span class="conf-label">Mastered</span>
            </button>
          </div>
        </div>

        <button type="button" class="submit-btn" id="btn-confirm-solve">
          Schedule Spaced Revision
        </button>
      </div>
    `;

    shadow.appendChild(container);

    let selectedHintUsage = 'none';
    let selectedConfidence = 4;

    const hintBtns = shadow.querySelectorAll('.toggle-btn');
    hintBtns.forEach((btn) => {
      btn.addEventListener('click', () => {
        hintBtns.forEach((b) => b.classList.remove('active'));
        btn.classList.add('active');
        selectedHintUsage = btn.getAttribute('data-hint') || 'none';
        resetInactivityTimer();
      });
    });

    const confBtns = shadow.querySelectorAll('.conf-btn');
    confBtns.forEach((btn) => {
      btn.addEventListener('click', () => {
        confBtns.forEach((b) => b.classList.remove('active'));
        btn.classList.add('active');
        selectedConfidence = parseInt(btn.getAttribute('data-conf') || '4', 10);
        resetInactivityTimer();
      });
    });

    const closeBtn = shadow.getElementById('overlay-close-btn');
    closeBtn.addEventListener('click', () => {
      dismissOverlay();
    });

    const submitBtn = shadow.getElementById('btn-confirm-solve');
    submitBtn.addEventListener('click', () => {
      submitSolve({
        problem_name: data.problemName,
        problem_link: data.problemLink,
        difficulty: data.difficulty,
        topic_tags: data.topicTags,
        hint_usage: selectedHintUsage,
        confidence_rating: selectedConfidence,
        time_taken_seconds: data.timeTakenSeconds,
      });
    });

    function resetInactivityTimer() {
      if (inactivityTimeoutId) clearTimeout(inactivityTimeoutId);
      inactivityTimeoutId = setTimeout(() => {
        console.log('[Recall] Inactivity timeout reached (30s). Dismissing overlay without submitting.');
        dismissOverlay();
      }, 30000);
    }
    resetInactivityTimer();

    function dismissOverlay() {
      if (inactivityTimeoutId) clearTimeout(inactivityTimeoutId);
      if (activeOverlayRoot) {
        activeOverlayRoot.remove();
        activeOverlayRoot = null;
      }
    }

    function submitSolve(payload) {
      if (inactivityTimeoutId) clearTimeout(inactivityTimeoutId);
      submitBtn.disabled = true;
      submitBtn.textContent = 'Saving Problem...';

      console.log('[Recall] Submitting solve payload:', payload);

      chrome.runtime.sendMessage(
        {
          action: 'LOG_SOLVE',
          payload,
        },
        (response) => {
          const wrapper = shadow.getElementById('questions-wrapper');
          if (response && response.success) {
            const retentionScore = response.data?.retention_score ?? 100;
            const nextDueDays = response.data?.revision_schedule?.current_interval_days ?? 1;

            wrapper.innerHTML = `
              <div class="success-box">
                <span class="success-title">✓ Problem Scheduled</span>
                <span class="success-sub">
                  Initial Retention: <strong>${retentionScore}%</strong><br>
                  Next revision in <strong>${nextDueDays} day${nextDueDays === 1 ? '' : 's'}</strong>
                </span>
              </div>
            `;

            setTimeout(() => {
              dismissOverlay();
            }, 2500);
          } else {
            console.error('[Recall] Submit error:', response?.error);
            wrapper.innerHTML = `
              <div class="success-box">
                <span class="success-title" style="color: #ef4444;">Failed to Schedule</span>
                <span class="success-sub">${response?.error || 'Could not contact Recall server'}</span>
                <button type="button" class="submit-btn" style="margin-top: 8px;" id="btn-retry-dismiss">Close</button>
              </div>
            `;
            const retryBtn = shadow.getElementById('btn-retry-dismiss');
            if (retryBtn) retryBtn.addEventListener('click', dismissOverlay);
          }
        }
      );
    }
  }

  // Testing & diagnostic hooks
  window.__recall_content_state = () => ({
    currentProblemSlug,
    isAwaitingSubmission,
    hasTriggeredForCurrentProblem,
    overlayVisible: !!activeOverlayRoot,
  });

  window.__simulateRecallSubmitClick = onUserInitiatedSubmit;
  window.__simulateRecallWrongAnswer = () => {
    onUserInitiatedSubmit();
    window.dispatchEvent(
      new CustomEvent('recall:submission-check-response', {
        detail: { state: 'SUCCESS', status_code: 11, status_msg: 'Wrong Answer' },
      })
    );
  };
  window.__simulateRecallAccepted = (source = 'manual-test') => {
    onUserInitiatedSubmit();
    handleVerifiedAccepted(source);
  };
  window.__simulateRecallAcceptedResponse = () => {
    onUserInitiatedSubmit();
    window.dispatchEvent(
      new CustomEvent('recall:submission-check-response', {
        detail: { state: 'SUCCESS', status_code: 10, status_msg: 'Accepted' },
      })
    );
  };
})();
