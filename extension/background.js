// Recall Chrome Extension - Background Service Worker (Manifest V3)
// Step 9: Native Google OAuth with Supabase & chrome.identity

const API_BASE_URL = 'http://localhost:3000';
const SUPABASE_PROJECT_REF = 'utxyhzwdxlxpxtwifgrg';
const SUPABASE_URL = `https://${SUPABASE_PROJECT_REF}.supabase.co`;
const SUPABASE_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InV0eHloendkeGx4cHh0d2lmZ3JnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTA2OTY0NzIsImV4cCI6MjEwNjI3MjQ3Mn0.G3bSOupm-tiFH6k64KezT4yBZ9RXQ3lODeGhWMWrlFQ';
const DEFAULT_USER_ID = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11';

// Initialize default storage on install
chrome.runtime.onInstalled.addListener(() => {
  console.log('[Recall Background] Extension installed/updated with Google OAuth support.');
});

// Message listener for popup and content scripts
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (!message || !message.action) return false;

  switch (message.action) {
    case 'CHECK_AUTH': {
      chrome.storage.sync.get(['recall_token', 'recall_user'], (data) => {
        const token = data.recall_token || null;
        const user = data.recall_user || null;
        sendResponse({
          authenticated: !!token,
          token,
          user,
        });
      });
      return true;
    }

    case 'LOGIN_WITH_GOOGLE': {
      // 1. First attempt: native launchWebAuthFlow with Supabase Google OAuth provider
      if (chrome.identity && chrome.identity.launchWebAuthFlow) {
        const redirectUrl = chrome.identity.getRedirectURL();
        console.log('[Recall Background] Initiating Google OAuth via Supabase. Redirect URL:', redirectUrl);

        const authUrl = `${SUPABASE_URL}/auth/v1/authorize?provider=google&redirect_to=${encodeURIComponent(
          redirectUrl
        )}`;

        chrome.identity.launchWebAuthFlow(
          {
            url: authUrl,
            interactive: true,
          },
          async (callbackUrl) => {
            if (chrome.runtime.lastError || !callbackUrl) {
              const errMsg = chrome.runtime.lastError
                ? chrome.runtime.lastError.message
                : 'Login window dismissed';
              console.warn('[Recall Background] launchWebAuthFlow notice:', errMsg);

              // 2. Fallback attempt: chrome.identity.getAuthToken if OAuth2 client_id is configured
              if (chrome.identity.getAuthToken) {
                chrome.identity.getAuthToken({ interactive: true }, async (googleAuthToken) => {
                  if (chrome.runtime.lastError || !googleAuthToken) {
                    sendResponse({
                      success: false,
                      error: errMsg || chrome.runtime.lastError?.message || 'Google Sign-in failed',
                    });
                    return;
                  }

                  try {
                    // Exchange Google token with Supabase signInWithIdToken
                    const exchangeRes = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=id_token`, {
                      method: 'POST',
                      headers: {
                        'Content-Type': 'application/json',
                        apikey: SUPABASE_ANON_KEY,
                      },
                      body: JSON.stringify({
                        provider: 'google',
                        id_token: googleAuthToken,
                      }),
                    });

                    if (exchangeRes.ok) {
                      const session = await exchangeRes.json();
                      const user = session.user || { email: 'google-user@recall.dev' };
                      chrome.storage.sync.set(
                        {
                          recall_token: session.access_token,
                          recall_user: user,
                        },
                        () => {
                          sendResponse({ success: true, user, token: session.access_token });
                        }
                      );
                      return;
                    }
                  } catch (e) {
                    console.error('[Recall Background] getAuthToken exchange error:', e);
                  }

                  sendResponse({ success: false, error: errMsg });
                });
                return;
              }

              sendResponse({ success: false, error: errMsg });
              return;
            }

            try {
              // Parse Supabase hash parameters: #access_token=...&refresh_token=...
              const urlObj = new URL(callbackUrl);
              const hashParams = new URLSearchParams(urlObj.hash.substring(1));
              const queryParams = urlObj.searchParams;

              const accessToken = hashParams.get('access_token') || queryParams.get('access_token');
              const refreshToken = hashParams.get('refresh_token') || queryParams.get('refresh_token');

              if (!accessToken) {
                throw new Error('No access token returned from Google OAuth redirect');
              }

              // Fetch verified user details from Supabase using the access token
              const userRes = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
                headers: {
                  Authorization: `Bearer ${accessToken}`,
                  apikey: SUPABASE_ANON_KEY,
                },
              });

              let userData = null;
              if (userRes.ok) {
                userData = await userRes.json();
              }

              const user = {
                id: userData?.id || accessToken,
                email: userData?.email || 'google-user@recall.dev',
              };

              // Persist native Supabase session in chrome.storage.sync
              chrome.storage.sync.set(
                {
                  recall_token: accessToken,
                  recall_refresh_token: refreshToken,
                  recall_user: user,
                },
                () => {
                  console.log('[Recall Background] Google user signed in and session saved:', user);
                  sendResponse({
                    success: true,
                    user,
                    token: accessToken,
                  });
                }
              );
            } catch (err) {
              console.error('[Recall Background] Failed to process OAuth callback:', err);
              sendResponse({ success: false, error: err.message });
            }
          }
        );
        return true;
      } else {
        sendResponse({ success: false, error: 'chrome.identity API unavailable' });
        return false;
      }
    }

    case 'LOGOUT': {
      chrome.storage.sync.get(['recall_token'], async (data) => {
        const token = data.recall_token;
        if (token) {
          // Attempt graceful logout on Supabase
          try {
            await fetch(`${SUPABASE_URL}/auth/v1/logout`, {
              method: 'POST',
              headers: {
                Authorization: `Bearer ${token}`,
                apikey: SUPABASE_ANON_KEY,
              },
            });
          } catch (e) {
            // Ignore network errors on logout
          }
        }

        chrome.storage.sync.remove(['recall_token', 'recall_refresh_token', 'recall_user'], () => {
          console.log('[Recall Background] User signed out and storage cleared.');
          sendResponse({ success: true });
        });
      });
      return true;
    }

    case 'LOG_SOLVE': {
      const solvePayload = message.payload;
      chrome.storage.sync.get(['recall_token'], async (data) => {
        const token = data.recall_token || DEFAULT_USER_ID;

        try {
          console.log('[Recall Background] Submitting solve to Recall API:', solvePayload);
          const response = await fetch(`${API_BASE_URL}/api/solves`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${token}`,
              'x-user-id': token,
            },
            body: JSON.stringify(solvePayload),
          });

          const result = await response.json();

          if (!response.ok) {
            console.error('[Recall Background] API error:', result);
            sendResponse({
              success: false,
              error: result.message || result.error || 'Failed to submit solve',
            });
            return;
          }

          console.log('[Recall Background] Solve successfully logged:', result);
          sendResponse({
            success: true,
            data: result.data,
          });
        } catch (err) {
          console.error('[Recall Background] Network error during solve submit:', err);
          sendResponse({
            success: false,
            error: err.message || 'Network error reaching Recall server',
          });
        }
      });
      return true;
    }

    case 'FETCH_POPUP_DATA': {
      chrome.storage.sync.get(['recall_token'], async (data) => {
        const token = data.recall_token || null;
        if (!token) {
          sendResponse({ success: true, authenticated: false });
          return;
        }

        try {
          const [dueRes, readinessRes] = await Promise.all([
            fetch(`${API_BASE_URL}/api/revisions/due`, {
              headers: {
                Authorization: `Bearer ${token}`,
                'x-user-id': token,
              },
            }),
            fetch(`${API_BASE_URL}/api/readiness`, {
              headers: {
                Authorization: `Bearer ${token}`,
                'x-user-id': token,
              },
            }),
          ]);

          if (!dueRes.ok) {
            throw new Error(`Failed to fetch due revisions: ${dueRes.status}`);
          }
          if (!readinessRes.ok) {
            throw new Error(`Failed to fetch readiness: ${readinessRes.status}`);
          }

          const dueData = await dueRes.json();
          const readinessData = await readinessRes.json();

          sendResponse({
            success: true,
            authenticated: true,
            dueCount: dueData.count || 0,
            dueItems: dueData.data || [],
            readinessPct: readinessData.overall_readiness || 0,
          });
        } catch (err) {
          console.error('[Recall Background] Error in FETCH_POPUP_DATA:', err);
          sendResponse({
            success: false,
            error: err.message || 'Failed to fetch popup data',
          });
        }
      });
      return true;
    }

    case 'COMPLETE_REVISION': {
      const { revisionId, was_hint_free } = message;
      chrome.storage.sync.get(['recall_token'], async (data) => {
        const token = data.recall_token || DEFAULT_USER_ID;
        try {
          const response = await fetch(`${API_BASE_URL}/api/revisions/${revisionId}/complete`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${token}`,
              'x-user-id': token,
            },
            body: JSON.stringify({
              was_hint_free: !!was_hint_free,
              new_confidence_rating: was_hint_free ? 4 : 2,
            }),
          });

          const result = await response.json();
          if (!response.ok) {
            throw new Error(result.message || result.error || 'Failed to complete revision');
          }

          sendResponse({
            success: true,
            data: result.data,
          });
        } catch (err) {
          console.error('[Recall Background] Error in COMPLETE_REVISION:', err);
          sendResponse({
            success: false,
            error: err.message || 'Failed to complete revision',
          });
        }
      });
      return true;
    }

    default:
      return false;
  }
});
