'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import styles from './dashboard.module.css';

interface DueRevision {
  id: string;
  user_id: string;
  problem_id: string;
  ease_factor: number;
  current_interval_days: number;
  next_due_date: string;
  retention_score: number;
  last_updated: string;
  problem_name: string;
  problem_link: string;
  topic_tags: string[];
  difficulty: 'easy' | 'medium' | 'hard';
  is_pattern_substitution?: boolean;
  pattern_name?: string;
  pattern_tag?: string;
  original_problem_id?: string;
  original_problem_name?: string;
  original_problem_link?: string;
  original_difficulty?: 'easy' | 'medium' | 'hard';
}

interface CardState {
  activeAction: 'hint_free' | 'hint_needed' | null;
  selectedConfidence: number;
  isSubmitting: boolean;
  inlineConfirmation: string | null;
  isExiting: boolean;
}

const DEFAULT_USER_ID = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11';

function formatDaysSince(dateString: string): string {
  if (!dateString) return 'Solved recently';
  const solvedDate = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - solvedDate.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays <= 0) return 'Solved today';
  if (diffDays === 1) return 'Solved 1 day ago';
  return `Solved ${diffDays} days ago`;
}

function DashboardContent() {
  const searchParams = useSearchParams();
  const stateParam = searchParams.get('state') as 'loading' | 'empty' | 'error' | null;

  // Active view state: 'live' | 'loading' | 'empty' | 'error'
  const [simState, setSimState] = useState<'live' | 'loading' | 'empty' | 'error'>(
    stateParam || 'live'
  );

  const [revisions, setRevisions] = useState<DueRevision[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Per-card interaction state keyed by revision id
  const [cardStates, setCardStates] = useState<Record<string, CardState>>({});

  const fetchDueRevisions = async () => {
    setIsLoading(true);
    setErrorMessage(null);

    try {
      const queryStr = searchParams.toString();
      const endpoint = queryStr ? `/api/revisions/due?${queryStr}` : '/api/revisions/due';
      const res = await fetch(endpoint, {
        headers: {
          'x-user-id': DEFAULT_USER_ID,
        },
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.message || `Server returned ${res.status}`);
      }

      const data = await res.json();
      setRevisions(data.data || []);
    } catch (err: any) {
      console.error('Failed to fetch due revisions:', err);
      setErrorMessage(err.message || 'Unable to connect to the database. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  // Settings modal & personalization state
  const [showSettingsModal, setShowSettingsModal] = useState<boolean>(false);
  const [leetcodeUrl, setLeetcodeUrl] = useState<string>('');
  const [isSavingSettings, setIsSavingSettings] = useState<boolean>(false);
  const [settingsFeedback, setSettingsFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [userSettings, setUserSettings] = useState<{
    leetcode_username?: string | null;
    leetcode_profile_url?: string | null;
    leetcode_stats?: any;
  } | null>(null);

  const fetchSettings = async () => {
    try {
      const res = await fetch('/api/settings', {
        headers: { 'x-user-id': DEFAULT_USER_ID },
      });
      if (res.ok) {
        const data = await res.json();
        setUserSettings(data.settings);
        if (data.settings?.leetcode_profile_url) {
          setLeetcodeUrl(data.settings.leetcode_profile_url);
        } else if (data.settings?.leetcode_username) {
          setLeetcodeUrl(data.settings.leetcode_username);
        }
      }
    } catch (e) {
      console.warn('Failed to load settings:', e);
    }
  };

  useEffect(() => {
    fetchSettings();
  }, []);

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSavingSettings(true);
    setSettingsFeedback(null);
    try {
      const res = await fetch('/api/settings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': DEFAULT_USER_ID,
        },
        body: JSON.stringify({ leetcode_url: leetcodeUrl }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Failed to save settings');
      setUserSettings(data.settings);
      setSettingsFeedback({
        type: 'success',
        message:
          data.settings?.leetcode_stats?.status === 'verified'
            ? `Verified! Linked profile ${data.settings.leetcode_username} with ${data.settings.leetcode_stats.total_solved} solved problems.`
            : `Saved! Profile set to ${data.settings.leetcode_username || 'unlinked'}.`,
      });
      fetchDueRevisions(); // refresh queue with potential personalization bias
    } catch (err: any) {
      setSettingsFeedback({ type: 'error', message: err.message || 'Failed to update profile' });
    } finally {
      setIsSavingSettings(false);
    }
  };

  useEffect(() => {
    if (stateParam) {
      setSimState(stateParam);
    }
  }, [stateParam]);

  useEffect(() => {
    if (simState === 'live') {
      fetchDueRevisions();
    }
  }, [simState]);

  // Open confidence rating selector for a specific card
  const handleInitiateAction = (id: string, action: 'hint_free' | 'hint_needed') => {
    setCardStates((prev) => ({
      ...prev,
      [id]: {
        activeAction: action,
        selectedConfidence: 4, // default to confident
        isSubmitting: false,
        inlineConfirmation: null,
        isExiting: false,
      },
    }));
  };

  const handleCancelAction = (id: string) => {
    setCardStates((prev) => ({
      ...prev,
      [id]: {
        ...prev[id],
        activeAction: null,
      },
    }));
  };

  const handleSelectConfidence = (id: string, confidence: number) => {
    setCardStates((prev) => ({
      ...prev,
      [id]: {
        ...prev[id],
        selectedConfidence: confidence,
      },
    }));
  };

  // Submit completion
  const handleCompleteRevision = async (id: string) => {
    const cardState = cardStates[id];
    if (!cardState || !cardState.activeAction) return;

    const wasHintFree = cardState.activeAction === 'hint_free';
    const confidenceRating = cardState.selectedConfidence;

    // Set submitting
    setCardStates((prev) => ({
      ...prev,
      [id]: { ...prev[id], isSubmitting: true },
    }));

    try {
      const res = await fetch(`/api/revisions/${id}/complete`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': DEFAULT_USER_ID,
        },
        body: JSON.stringify({
          was_hint_free: wasHintFree,
          new_confidence_rating: confidenceRating,
        }),
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.message || 'Failed to complete revision');
      }

      const resData = await res.json();
      const updatedInterval = resData.data?.updated_schedule?.current_interval_days ?? (wasHintFree ? 3 : 1);

      const confirmationText = wasHintFree
        ? `✓ Marked hint-free • Next revision in ${updatedInterval} day${updatedInterval === 1 ? '' : 's'}`
        : `✓ Recorded with hint • Scheduled for review tomorrow`;

      // 1. Show inline confirmation on the card
      setCardStates((prev) => ({
        ...prev,
        [id]: {
          ...prev[id],
          isSubmitting: false,
          activeAction: null,
          inlineConfirmation: confirmationText,
          isExiting: false,
        },
      }));

      // 2. Trigger exit animation after short delay to let the user read confirmation
      setTimeout(() => {
        setCardStates((prev) => ({
          ...prev,
          [id]: {
            ...prev[id],
            isExiting: true,
          },
        }));

        // 3. Remove from list after 320ms exit animation
        setTimeout(() => {
          setRevisions((prev) => prev.filter((r) => r.id !== id));
        }, 320);
      }, 550);
    } catch (err: any) {
      console.error('Failed to complete revision:', err);
      alert(`Could not complete revision: ${err.message}`);
      setCardStates((prev) => ({
        ...prev,
        [id]: { ...prev[id], isSubmitting: false },
      }));
    }
  };

  // Determine current display mode
  const currentMode = simState;

  return (
    <div className={styles.pageContainer}>
      <div className={styles.contentWrapper}>
        {/* Top Header */}
        <header className={styles.header}>
          <div className={styles.headerLeft}>
            <span className={styles.brandLabel}>Recall • Spaced Repetition</span>
            <div className={styles.titleRow}>
              <h1 className={styles.title}>Revision Queue</h1>
              {currentMode === 'live' && !isLoading && !errorMessage && (
                <span className={styles.countBadge} id="due-count-badge">
                  {revisions.length} due today
                </span>
              )}
            </div>
          </div>

          <div className={styles.headerActions}>
            <Link
              href="/dashboard/readiness"
              className={styles.topicsNavBtn}
              id="nav-readiness-btn"
            >
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <circle cx="12" cy="12" r="10"></circle>
                <polyline points="12 6 12 12 16 14"></polyline>
              </svg>
              Readiness
            </Link>

            <Link
              href="/dashboard/topics"
              className={styles.topicsNavBtn}
              id="nav-topics-btn"
            >
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <line x1="18" y1="20" x2="18" y2="10"></line>
                <line x1="12" y1="20" x2="12" y2="4"></line>
                <line x1="6" y1="20" x2="6" y2="14"></line>
              </svg>
              Topic Weakness
            </Link>

            <Link
              href="/dashboard/log"
              className={styles.logSolveNavBtn}
              id="nav-log-solve-btn"
            >
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <line x1="12" y1="5" x2="12" y2="19"></line>
                <line x1="5" y1="12" x2="19" y2="12"></line>
              </svg>
              Log a solve
            </Link>

            <button
              onClick={() => {
                setSettingsFeedback(null);
                setShowSettingsModal(true);
              }}
              className={styles.settingsNavBtn}
              id="nav-settings-btn"
              title="LeetCode profile personalization"
            >
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <circle cx="12" cy="12" r="3"></circle>
                <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path>
              </svg>
              Settings
            </button>

            <button
              onClick={() => fetchDueRevisions()}
              className={styles.refreshBtn}
              title="Refresh queue"
              disabled={isLoading && currentMode === 'live'}
              id="refresh-queue-btn"
            >
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <polyline points="23 4 23 10 17 10"></polyline>
                <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"></path>
              </svg>
              Refresh
            </button>
          </div>
        </header>

        {/* 1. LOADING STATE */}
        {(currentMode === 'loading' || (currentMode === 'live' && isLoading)) && (
          <div className={styles.cardsList} id="loading-state-view">
            {[1, 2].map((i) => (
              <div key={i} className={styles.skeletonCard}>
                <div className={`${styles.skeletonTitle} skeleton-shimmer`} />
                <div className={`${styles.skeletonMeta} skeleton-shimmer`} />
                <div className={styles.skeletonTags}>
                  <div className={`${styles.skeletonTag} skeleton-shimmer`} />
                  <div className={`${styles.skeletonTag} skeleton-shimmer`} />
                  <div className={`${styles.skeletonTag} skeleton-shimmer`} />
                </div>
                <div className={styles.skeletonActions}>
                  <div className={`${styles.skeletonBtn} skeleton-shimmer`} />
                  <div className={`${styles.skeletonBtn} skeleton-shimmer`} />
                </div>
              </div>
            ))}
          </div>
        )}

        {/* 2. ERROR STATE */}
        {(currentMode === 'error' || (currentMode === 'live' && !isLoading && errorMessage)) && (
          <div className={styles.errorState} id="error-state-view">
            <div className={styles.errorIconCircle}>
              <svg
                width="22"
                height="22"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <circle cx="12" cy="12" r="10"></circle>
                <line x1="12" y1="8" x2="12" y2="12"></line>
                <line x1="12" y1="16" x2="12.01" y2="16"></line>
              </svg>
            </div>
            <h2 className={styles.errorTitle}>Failed to load revision queue</h2>
            <p className={styles.errorMessage}>
              {errorMessage || 'A network error occurred while querying due revisions.'}
            </p>
            <button
              onClick={() => {
                setSimState('live');
                fetchDueRevisions();
              }}
              className={styles.btnPrimary}
              id="retry-fetch-btn"
            >
              Retry Connection
            </button>
          </div>
        )}

        {/* 3. EMPTY STATE */}
        {(currentMode === 'empty' ||
          (currentMode === 'live' && !isLoading && !errorMessage && revisions.length === 0)) && (
          <div className={styles.emptyState} id="empty-state-view">
            <div className={styles.emptyIconCircle}>
              <svg
                width="26"
                height="26"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
                <polyline points="22 4 12 14.01 9 11.01"></polyline>
              </svg>
            </div>
            <h2 className={styles.emptyTitle}>You&apos;re all caught up.</h2>
            <p className={styles.emptySubtitle}>
              Nothing due today. Your memory traces are reinforced and spaced out for maximum retention.
            </p>
            <div className={styles.emptyMetaBox}>
              <span className={styles.statusDot} />
              <span>0 problems due • Queue up to date</span>
            </div>
          </div>
        )}

        {/* 4. POPULATED STATE */}
        {currentMode === 'live' && !isLoading && !errorMessage && revisions.length > 0 && (
          <div className={styles.cardsList} id="populated-state-view">
            {revisions.map((rev) => {
              const cardState = cardStates[rev.id] || {
                activeAction: null,
                selectedConfidence: 4,
                isSubmitting: false,
                inlineConfirmation: null,
                isExiting: false,
              };

              const diffClass =
                rev.difficulty === 'easy'
                  ? styles.diffEasy
                  : rev.difficulty === 'medium'
                  ? styles.diffMedium
                  : styles.diffHard;

              return (
                <div
                  key={rev.id}
                  className={`${styles.card} ${rev.is_pattern_substitution ? styles.patternCard : ''} ${cardState.isExiting ? 'animating-exit' : ''}`}
                  id={`revision-card-${rev.id}`}
                >
                  {/* Pattern Substitution Eyebrow */}
                  {rev.is_pattern_substitution && (
                    <div className={styles.patternEyebrow} id={`pattern-eyebrow-${rev.id}`}>
                      <span className={styles.patternDot} />
                      Pattern check: {rev.pattern_name}
                    </div>
                  )}

                  {/* Card Header: Title & Difficulty */}
                  <div className={styles.cardHeader}>
                    <a
                      href={rev.problem_link}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={styles.problemLink}
                      id={`problem-link-${rev.id}`}
                    >
                      <span>{rev.problem_name}</span>
                      <svg
                        className={styles.linkIcon}
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path>
                        <polyline points="15 3 21 3 21 9"></polyline>
                        <line x1="10" y1="14" x2="21" y2="3"></line>
                      </svg>
                    </a>

                    <div className={styles.metaRow}>
                      <span className={`${styles.difficultyBadge} ${diffClass}`}>
                        {rev.difficulty}
                      </span>
                      <span className={styles.timeMuted}>
                        {formatDaysSince(rev.last_updated)}
                      </span>
                    </div>
                  </div>

                  {/* Proxy note for pattern substitutions */}
                  {rev.is_pattern_substitution && rev.original_problem_name && (
                    <div className={styles.patternProxyNote} id={`pattern-proxy-${rev.id}`}>
                      <span>Proxy test for:</span>
                      <strong>{rev.original_problem_name}</strong>
                    </div>
                  )}

                  {/* Topic Tags */}
                  {rev.topic_tags && rev.topic_tags.length > 0 && (
                    <div className={styles.tagsRow}>
                      {rev.topic_tags.map((tag) => (
                        <span key={tag} className={styles.tagPill}>
                          #{tag}
                        </span>
                      ))}
                    </div>
                  )}

                  {/* Primary Actions (when rating panel is not active) */}
                  {!cardState.activeAction && !cardState.inlineConfirmation && (
                    <div className={styles.actionsRow}>
                      <button
                        onClick={() => handleInitiateAction(rev.id, 'hint_needed')}
                        className={styles.btnSecondary}
                        id={`btn-hint-needed-${rev.id}`}
                      >
                        Needed a hint
                      </button>
                      <button
                        onClick={() => handleInitiateAction(rev.id, 'hint_free')}
                        className={styles.btnPrimary}
                        id={`btn-hint-free-${rev.id}`}
                      >
                        Mark as solved hint-free
                      </button>
                    </div>
                  )}

                  {/* Inline Confidence Rating Selector */}
                  {cardState.activeAction && (
                    <div className={styles.ratingPanel} id={`rating-panel-${rev.id}`}>
                      <div className={styles.ratingHeader}>
                        <span className={styles.ratingPrompt}>
                          Rate recall confidence (1 = Shaky, 5 = Mastered):
                        </span>
                        <span className={styles.hintStatusBadge}>
                          {cardState.activeAction === 'hint_free' ? 'Hint-Free' : 'Used Hint'}
                        </span>
                      </div>

                      <div className={styles.ratingButtonsRow}>
                        {[
                          { rating: 1, label: 'Shaky' },
                          { rating: 2, label: 'Struggled' },
                          { rating: 3, label: 'Moderate' },
                          { rating: 4, label: 'Confident' },
                          { rating: 5, label: 'Mastered' },
                        ].map((opt) => (
                          <button
                            key={opt.rating}
                            type="button"
                            onClick={() => handleSelectConfidence(rev.id, opt.rating)}
                            className={`${styles.ratingOption} ${
                              cardState.selectedConfidence === opt.rating
                                ? styles.ratingOptionActive
                                : ''
                            }`}
                            id={`rating-${rev.id}-${opt.rating}`}
                          >
                            <span className={styles.ratingNum}>{opt.rating}</span>
                            <span className={styles.ratingLabel}>{opt.label}</span>
                          </button>
                        ))}
                      </div>

                      <div className={styles.ratingActions}>
                        <button
                          type="button"
                          onClick={() => handleCancelAction(rev.id)}
                          className={styles.btnCancel}
                          disabled={cardState.isSubmitting}
                        >
                          Cancel
                        </button>
                        <button
                          type="button"
                          onClick={() => handleCompleteRevision(rev.id)}
                          className={styles.btnPrimary}
                          disabled={cardState.isSubmitting}
                          id={`btn-submit-${rev.id}`}
                        >
                          {cardState.isSubmitting ? 'Saving...' : 'Confirm & Complete'}
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Inline Confirmation Feedback */}
                  {cardState.inlineConfirmation && (
                    <div className={styles.inlineSuccess} id={`inline-confirmation-${rev.id}`}>
                      <svg
                        className={styles.checkIcon}
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <polyline points="20 6 9 17 4 12"></polyline>
                      </svg>
                      <span>{cardState.inlineConfirmation}</span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* State Switcher Toolbar for Testing All 4 States */}
      <div className={styles.simToolbar} id="sim-toolbar">
        <span className={styles.simLabel}>State View:</span>
        <button
          onClick={() => setSimState('live')}
          className={`${styles.simBtn} ${currentMode === 'live' ? styles.simBtnActive : ''}`}
          id="toggle-live-state"
        >
          Populated (Live)
        </button>
        <button
          onClick={() => setSimState('loading')}
          className={`${styles.simBtn} ${currentMode === 'loading' ? styles.simBtnActive : ''}`}
          id="toggle-loading-state"
        >
          Loading
        </button>
        <button
          onClick={() => setSimState('empty')}
          className={`${styles.simBtn} ${currentMode === 'empty' ? styles.simBtnActive : ''}`}
          id="toggle-empty-state"
        >
          Empty
        </button>
        <button
          onClick={() => setSimState('error')}
          className={`${styles.simBtn} ${currentMode === 'error' ? styles.simBtnActive : ''}`}
          id="toggle-error-state"
        >
          Error
        </button>
      </div>

      {/* Settings & Profile Personalization Modal */}
      {showSettingsModal && (
        <div className={styles.modalOverlay} id="settings-modal-overlay">
          <div className={styles.modalContent} id="settings-modal-card">
            <div className={styles.modalHeader}>
              <h2 className={styles.modalTitle}>Settings & Personalization</h2>
              <button
                type="button"
                onClick={() => setShowSettingsModal(false)}
                className={styles.modalCloseBtn}
                id="close-settings-modal-btn"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="18" y1="6" x2="6" y2="18"></line>
                  <line x1="6" y1="6" x2="18" y2="18"></line>
                </svg>
              </button>
            </div>

            <form onSubmit={handleSaveSettings} className={styles.settingsForm}>
              <div className={styles.settingsField}>
                <label className={styles.fieldLabel} htmlFor="leetcode-profile-input">
                  LeetCode Profile URL or Username
                </label>
                <input
                  id="leetcode-profile-input"
                  type="text"
                  placeholder="https://leetcode.com/u/your_username"
                  value={leetcodeUrl}
                  onChange={(e) => setLeetcodeUrl(e.target.value)}
                  className={styles.fieldInput}
                />
                <span className={styles.fieldHelp}>
                  Used as a soft signal to bias pattern substitutions toward your solving level (e.g. avoiding hard substitutions if you rarely attempt hards).
                </span>
              </div>

              {/* Cached Stats Display */}
              {userSettings?.leetcode_stats && userSettings.leetcode_stats.status === 'verified' && (
                <div className={styles.statsBox}>
                  <span className={styles.statsTitle}>
                    Linked Profile: @{userSettings.leetcode_username} (Verified)
                  </span>
                  <div className={styles.statsRow}>
                    <div className={styles.statItem}>
                      <span className={styles.statNumber}>{userSettings.leetcode_stats.total_solved}</span>
                      <span className={styles.statLabel}>Total Solved</span>
                    </div>
                    <div className={styles.statItem}>
                      <span className={styles.statNumber}>{userSettings.leetcode_stats.easy_solved}</span>
                      <span className={styles.statLabel}>Easy</span>
                    </div>
                    <div className={styles.statItem}>
                      <span className={styles.statNumber}>{userSettings.leetcode_stats.medium_solved}</span>
                      <span className={styles.statLabel}>Medium</span>
                    </div>
                    <div className={styles.statItem}>
                      <span className={styles.statNumber}>{userSettings.leetcode_stats.hard_solved}</span>
                      <span className={styles.statLabel}>Hard</span>
                    </div>
                  </div>
                </div>
              )}

              {userSettings?.leetcode_stats && userSettings.leetcode_stats.status === 'not_found' && (
                <div className={styles.statsBox} style={{ borderColor: 'rgba(239, 68, 68, 0.4)' }}>
                  <span className={styles.statsTitle} style={{ color: '#ef4444' }}>
                    Profile Notice
                  </span>
                  <p style={{ fontSize: '12px', color: '#a1a1aa', margin: 0 }}>
                    {userSettings.leetcode_stats.error || 'Public profile not found or private. Soft difficulty bias will default to standard progression.'}
                  </p>
                </div>
              )}

              {settingsFeedback && (
                <div
                  style={{
                    fontSize: '12px',
                    padding: '8px 10px',
                    borderRadius: '6px',
                    backgroundColor:
                      settingsFeedback.type === 'success' ? 'rgba(44, 187, 93, 0.12)' : 'rgba(239, 68, 68, 0.12)',
                    color: settingsFeedback.type === 'success' ? '#2cbb5d' : '#ef4444',
                    border:
                      settingsFeedback.type === 'success'
                        ? '1px solid rgba(44, 187, 93, 0.25)'
                        : '1px solid rgba(239, 68, 68, 0.25)',
                  }}
                >
                  {settingsFeedback.message}
                </div>
              )}

              <button
                type="submit"
                disabled={isSavingSettings}
                className={styles.btnPrimary}
                style={{ width: '100%', justifyContent: 'center' }}
                id="btn-save-settings"
              >
                {isSavingSettings ? 'Linking Profile...' : 'Save & Link Profile'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default function DashboardPage() {
  return (
    <Suspense fallback={<div className={styles.pageContainer}>Loading...</div>}>
      <DashboardContent />
    </Suspense>
  );
}
