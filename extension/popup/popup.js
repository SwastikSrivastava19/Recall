// Recall Extension - Minimal Glanceable Popup Controller (Step 9: Google OAuth)

document.addEventListener('DOMContentLoaded', () => {
  const API_BASE_URL = 'http://localhost:3000';
  const DEFAULT_USER_ID = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11';

  // Elements
  const statusDot = document.getElementById('status-dot');
  const statusLabel = document.getElementById('status-label');
  const btnSignout = document.getElementById('btn-signout');

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

  const btnGoogleSignin = document.getElementById('btn-google-signin');
  const btnRetry = document.getElementById('btn-retry');
  const btnOpenDashboard = document.getElementById('btn-open-dashboard');

  let activeDueCount = 0;
  let activeDueItems = [];
  let activeReadinessPct = 0;
  let currentUser = null;

  function showView(view) {
    [viewLoading, viewUnauth, viewError, viewMain].forEach((v) => {
      if (v) v.classList.add('hidden');
    });
    if (view) view.classList.remove('hidden');
  }

  function setAuthHeader(signedIn, user) {
    currentUser = user || null;
    if (signedIn) {
      if (statusDot) statusDot.classList.add('active');
      if (statusLabel) {
        const display = user?.email ? user.email.split('@')[0] : 'Signed in';
        statusLabel.textContent = display;
        if (user?.email) statusLabel.title = user.email;
      }
      if (btnSignout) btnSignout.classList.remove('hidden');
    } else {
      if (statusDot) statusDot.classList.remove('active');
      if (statusLabel) {
        statusLabel.textContent = 'Not signed in';
        statusLabel.title = '';
      }
      if (btnSignout) btnSignout.classList.add('hidden');
    }
  }

  function renderPopulatedList() {
    dueRowsContainer.innerHTML = '';
    const topThree = activeDueItems.slice(0, 3);

    topThree.forEach((item) => {
      const row = document.createElement('div');
      row.className = `due-row ${item.is_pattern_substitution ? 'pattern-row' : ''}`;
      row.id = `due-row-${item.id}`;

      const diff = (item.difficulty || 'medium').toLowerCase();
      const diffClass = diff === 'easy' ? 'diff-easy' : diff === 'hard' ? 'diff-hard' : 'diff-medium';

      const patternLabelHtml = item.is_pattern_substitution
        ? `<div class="pattern-eyebrow-mini">Pattern check: ${item.pattern_name}</div>`
        : '';

      row.innerHTML = `
        <div class="row-left">
          <div style="display: flex; flex-direction: column; min-width: 0; flex: 1;">
            ${patternLabelHtml}
            <div style="display: flex; align-items: center; gap: 6px; min-width: 0;">
              <span class="problem-title" title="${item.problem_name}">${item.problem_name}</span>
              <span class="diff-badge ${diffClass}">${diff}</span>
            </div>
          </div>
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

  function renderData(data, user) {
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
    setAuthHeader(true, user);
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
      renderData({ dueCount: 0, dueItems: [], readinessPct: 19 }, { email: 'swastik@recall.dev' });
      return;
    }
    if (mockState === 'populated') {
      renderData(
        {
          dueCount: 4,
          dueItems: [
            {
              id: 'mock-1',
              problem_name: 'Fruit Into Baskets',
              difficulty: 'medium',
              is_pattern_substitution: true,
              pattern_name: 'Sliding Window',
            },
            { id: 'mock-2', problem_name: 'Course Schedule II', difficulty: 'medium' },
            { id: 'mock-3', problem_name: 'Candy', difficulty: 'hard' },
            { id: 'mock-4', problem_name: 'Jump Game II', difficulty: 'medium' },
          ],
          readinessPct: 19,
        },
        { email: 'swastik@recall.dev' }
      );
      return;
    }

    // Live Extension Flow via background service worker
    if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.sendMessage) {
      chrome.runtime.sendMessage({ action: 'CHECK_AUTH' }, (authRes) => {
        if (!authRes || !authRes.authenticated) {
          showView(viewUnauth);
          setAuthHeader(false);
          return;
        }

        const user = authRes.user || { email: 'user@gmail.com' };

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
            renderData(response, user);
          } else {
            showView(viewError);
            setAuthHeader(true, user);
          }
        });
      });
    } else {
      // Standalone/Headless test environment fallback
      const devUser = localStorage.getItem('recall_dev_user');
      const isUnauth = urlParams.get('auth') === 'false';

      if (isUnauth) {
        showView(viewUnauth);
        setAuthHeader(false);
        return;
      }

      Promise.all([
        fetch(`${API_BASE_URL}/api/revisions/due`, {
          headers: { 'x-user-id': devUser || DEFAULT_USER_ID },
        }).then((r) => r.json()),
        fetch(`${API_BASE_URL}/api/readiness`, {
          headers: { 'x-user-id': devUser || DEFAULT_USER_ID },
        }).then((r) => r.json()),
      ])
        .then(([dueData, readinessData]) => {
          renderData(
            {
              dueCount: dueData.count || 0,
              dueItems: dueData.data || [],
              readinessPct: readinessData.overall_readiness || 0,
            },
            { email: 'test@recall.dev' }
          );
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

  if (btnGoogleSignin) {
    btnGoogleSignin.addEventListener('click', () => {
      if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.sendMessage) {
        btnGoogleSignin.disabled = true;
        btnGoogleSignin.textContent = 'Connecting with Google...';

        chrome.runtime.sendMessage({ action: 'LOGIN_WITH_GOOGLE' }, (response) => {
          btnGoogleSignin.disabled = false;
          btnGoogleSignin.innerHTML = `
            <span class="google-icon-wrapper">
              <svg width="18" height="18" viewBox="0 0 18 18">
                <path fill="#4285F4" d="M17.64 9.2045c0-.6381-.0573-1.2518-.1636-1.8409H9v3.4814h4.8436c-.2086 1.125-.8427 2.0782-1.7959 2.7164v2.2581h2.9087c1.7018-1.5668 2.6836-3.874 2.6836-6.615z"/>
                <path fill="#34A853" d="M9 18c2.43 0 4.4673-.806 5.9564-2.1805l-2.9087-2.2581c-.8059.54-1.8368.859-3.0477.859-2.344 0-4.3282-1.5831-5.036-3.7104H.9573v2.3318C2.4382 15.9832 5.4818 18 9 18z"/>
                <path fill="#FBBC05" d="M3.964 10.71c-.18-.54-.2822-1.1168-.2822-1.71s.1023-1.17.2823-1.71V4.9582H.9573A8.9965 8.9965 0 0 0 0 9c0 1.4523.3477 2.8268.9573 4.0418L3.964 10.71z"/>
                <path fill="#EA4335" d="M9 3.5795c1.3214 0 2.5077.4541 3.4405 1.346l2.5813-2.5814C13.4632.9245 11.426 0 9 0 5.4818 0 2.4382 2.0168.9573 4.9582L3.964 7.29C4.6718 5.1627 6.656 3.5795 9 3.5795z"/>
              </svg>
            </span>
            <span>Sign in with Google</span>
          `;

          if (response && response.success) {
            loadPopupData();
          } else {
            console.warn('[Recall Popup] Google OAuth error:', response);
            if (response && response.error) {
              alert(`Google Sign-in: ${response.error}`);
            }
          }
        });
      } else {
        openUrl('http://localhost:3000/login');
      }
    });
  }

  if (btnSignout) {
    btnSignout.addEventListener('click', (e) => {
      e.stopPropagation();
      if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.sendMessage) {
        chrome.runtime.sendMessage({ action: 'LOGOUT' }, () => {
          loadPopupData();
        });
      } else {
        localStorage.removeItem('recall_dev_user');
        window.location.search = '?state=unauth';
      }
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
