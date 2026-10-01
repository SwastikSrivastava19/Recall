// Recall Extension - Minimal Glanceable Popup Controller (Step 8)

document.addEventListener('DOMContentLoaded', () => {
  const API_BASE_URL = 'http://localhost:3000';
  const DEFAULT_USER_ID = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11';

  // Elements
  const statusDot = document.getElementById('status-dot');
  const statusLabel = document.getElementById('status-label');

  const viewLoading = document.getElementById('view-loading');
  const viewUnauth = document.getElementById('view-unauth');
  const viewError = document.getElementById('view-error');
  const viewMain = document.getElementById('view-main');

  const dueNumeral = document.getElementById('due-count-numeral');
  const dueContext = document.getElementById('due-context-text');
  const sectionEmpty = document.getElementById('section-empty');
  const sectionDueList = document.getElementById('section-due-list');
  const dueRowsContainer = document.getElementById('due-rows-container');
  const btnMoreDue = document.getElementById('btn-more-due');
  const readinessStatText = document.getElementById('readiness-stat-text');

  const btnSignin = document.getElementById('btn-signin');
  const btnRetry = document.getElementById('btn-retry');
  const btnOpenDashboard = document.getElementById('btn-open-dashboard');

  let activeDueCount = 0;
  let activeDueItems = [];
  let activeReadinessPct = 0;

  function showView(view) {
    [viewLoading, viewUnauth, viewError, viewMain].forEach((v) => {
      if (v) v.classList.add('hidden');
    });
    if (view) view.classList.remove('hidden');
  }

  function setAuthHeader(signedIn) {
    if (signedIn) {
      if (statusDot) statusDot.classList.add('active');
      if (statusLabel) statusLabel.textContent = 'Signed in';
    } else {
      if (statusDot) statusDot.classList.remove('active');
      if (statusLabel) statusLabel.textContent = 'Not signed in';
    }
  }

  function renderPopulatedList() {
    dueRowsContainer.innerHTML = '';
    const topThree = activeDueItems.slice(0, 3);

    topThree.forEach((item) => {
      const row = document.createElement('div');
      row.className = 'due-row';
      row.id = `due-row-${item.id}`;

      const diff = (item.difficulty || 'medium').toLowerCase();
      const diffClass = diff === 'easy' ? 'diff-easy' : diff === 'hard' ? 'diff-hard' : 'diff-medium';

      row.innerHTML = `
        <div class="row-left">
          <span class="problem-title" title="${item.problem_name}">${item.problem_name}</span>
          <span class="diff-badge ${diffClass}">${diff}</span>
        </div>
        <div class="row-actions">
          <button type="button" class="btn-inline-needed-hint" data-action="hint" data-id="${item.id}">Needed hint</button>
          <button type="button" class="btn-inline-hint-free" data-action="hint-free" data-id="${item.id}">Hint-free</button>
        </div>
      `;

      // Inline completion listeners
      const btnHintFree = row.querySelector('[data-action="hint-free"]');
      const btnNeededHint = row.querySelector('[data-action="hint"]');

      btnHintFree.addEventListener('click', () => handleComplete(item.id, true, row));
      btnNeededHint.addEventListener('click', () => handleComplete(item.id, false, row));

      dueRowsContainer.appendChild(row);
    });

    // Update +X more button
    if (activeDueCount > 3) {
      const remaining = activeDueCount - 3;
      btnMoreDue.textContent = `+${remaining} more due today`;
      btnMoreDue.classList.remove('hidden');
    } else {
      btnMoreDue.classList.add('hidden');
    }
  }

  function updateHeroState() {
    if (dueNumeral) dueNumeral.textContent = activeDueCount;

    if (activeDueCount === 0) {
      if (dueContext) dueContext.textContent = 'All caught up';
      sectionEmpty.classList.remove('hidden');
      sectionDueList.classList.add('hidden');
    } else {
      if (dueContext) {
        dueContext.textContent = activeDueCount === 1 ? '1 due today' : `${activeDueCount} due today`;
      }
      sectionEmpty.classList.add('hidden');
      sectionDueList.classList.remove('hidden');
    }
  }

  function handleComplete(revisionId, wasHintFree, rowElement) {
    // 1. Immediately animate row out
    rowElement.classList.add('removing');
    rowElement.querySelectorAll('button').forEach((b) => (b.disabled = true));

    // 2. Optimistically decrement due count
    activeDueCount = Math.max(0, activeDueCount - 1);
    activeDueItems = activeDueItems.filter((i) => i.id !== revisionId);
    updateHeroState();

    // 3. Dispatch completion to backend
    if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.sendMessage) {
      chrome.runtime.sendMessage(
        {
          action: 'COMPLETE_REVISION',
          revisionId,
          was_hint_free: wasHintFree,
        },
        (res) => {
          if (!res || !res.success) {
            console.warn('[Recall Popup] Complete revision returned error or failed:', res);
          }
        }
      );
    } else {
      // Direct fetch fallback for mock or standalone test harness
      fetch(`${API_BASE_URL}/api/revisions/${revisionId}/complete`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': DEFAULT_USER_ID,
        },
        body: JSON.stringify({
          was_hint_free: wasHintFree,
          new_confidence_rating: wasHintFree ? 4 : 2,
        }),
      }).catch((e) => console.warn('[Recall Popup] Direct complete failed:', e));
    }

    // 4. Clean up row DOM and backfill next due item if available
    setTimeout(() => {
      rowElement.remove();
      if (activeDueCount > 0 && activeDueItems.length >= 3 && dueRowsContainer.children.length < 3) {
        renderPopulatedList();
      } else if (activeDueCount > 3) {
        btnMoreDue.textContent = `+${activeDueCount - 3} more due today`;
      } else {
        btnMoreDue.classList.add('hidden');
      }
    }, 240);
  }

  function renderData(data) {
    activeDueCount = data.dueCount || 0;
    activeDueItems = data.dueItems || [];
    activeReadinessPct = data.readinessPct || 0;

    if (readinessStatText) {
      readinessStatText.textContent = `${activeReadinessPct}% ready`;
    }

    updateHeroState();

    if (activeDueCount > 0) {
      renderPopulatedList();
    }

    showView(viewMain);
    setAuthHeader(true);
  }

  function loadPopupData() {
    showView(viewLoading);

    // Check for simulated query params (for visual verification across all states)
    const urlParams = new URLSearchParams(window.location.search);
    const mockState = urlParams.get('state');

    if (mockState === 'loading') {
      showView(viewLoading);
      setAuthHeader(true);
      return;
    }
    if (mockState === 'unauth') {
      showView(viewUnauth);
      setAuthHeader(false);
      return;
    }
    if (mockState === 'error') {
      showView(viewError);
      setAuthHeader(true);
      return;
    }
    if (mockState === 'empty') {
      renderData({ dueCount: 0, dueItems: [], readinessPct: 19 });
      return;
    }
    if (mockState === 'populated') {
      renderData({
        dueCount: 4,
        dueItems: [
          { id: 'mock-1', problem_name: 'Clone Graph', difficulty: 'medium' },
          { id: 'mock-2', problem_name: 'Course Schedule II', difficulty: 'medium' },
          { id: 'mock-3', problem_name: 'Candy', difficulty: 'hard' },
          { id: 'mock-4', problem_name: 'Jump Game II', difficulty: 'medium' },
        ],
        readinessPct: 19,
      });
      return;
    }

    // Live Extension Flow via background service worker
    if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.sendMessage) {
      chrome.runtime.sendMessage({ action: 'FETCH_POPUP_DATA' }, (response) => {
        if (!response) {
          showView(viewError);
          setAuthHeader(false);
          return;
        }

        if (response.authenticated === false) {
          showView(viewUnauth);
          setAuthHeader(false);
          return;
        }

        if (response.success) {
          renderData(response);
        } else {
          showView(viewError);
          setAuthHeader(true);
        }
      });
    } else {
      // Standalone/Headless test environment fallback
      Promise.all([
        fetch(`${API_BASE_URL}/api/revisions/due`, {
          headers: { 'x-user-id': DEFAULT_USER_ID },
        }).then((r) => r.json()),
        fetch(`${API_BASE_URL}/api/readiness`, {
          headers: { 'x-user-id': DEFAULT_USER_ID },
        }).then((r) => r.json()),
      ])
        .then(([dueData, readinessData]) => {
          renderData({
            dueCount: dueData.count || 0,
            dueItems: dueData.data || [],
            readinessPct: readinessData.overall_readiness || 0,
          });
        })
        .catch((err) => {
          console.error('[Recall Popup] Fetch fallback error:', err);
          showView(viewError);
          setAuthHeader(true);
        });
    }
  }

  // Navigation handlers
  function openUrl(url) {
    if (typeof chrome !== 'undefined' && chrome.tabs && chrome.tabs.create) {
      chrome.tabs.create({ url });
    } else {
      window.open(url, '_blank');
    }
    if (window.close) window.close();
  }

  if (btnSignin) {
    btnSignin.addEventListener('click', () => {
      openUrl('http://localhost:3000/extension/link');
    });
  }

  if (btnOpenDashboard) {
    btnOpenDashboard.addEventListener('click', () => {
      openUrl('http://localhost:3000/dashboard');
    });
  }

  if (btnMoreDue) {
    btnMoreDue.addEventListener('click', () => {
      openUrl('http://localhost:3000/dashboard');
    });
  }

  if (btnRetry) {
    btnRetry.addEventListener('click', () => {
      loadPopupData();
    });
  }

  // Initial load
  loadPopupData();
});
