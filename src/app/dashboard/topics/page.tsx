'use client';

import React, { useState, useEffect, Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { RankedTopicBar } from '@/components/RankedTopicBar';
import { RecallNav } from '@/components/RecallNav';
import styles from './topics.module.css';

interface TopicWeaknessItem {
  topic: string;
  total_problems_logged: number;
  total_solves: number;
  hint_free_solves: number;
  hint_free_rate: number;
  average_retention_score: number;
  retention_tier: 'danger' | 'warning' | 'normal';
}

interface InsufficientTopicItem {
  topic: string;
  total_problems_logged: number;
  hint_free_rate: number;
  average_retention_score: number;
  reason: string;
}

interface TakeawayData {
  weakest_topic: string | null;
  summary: string;
  hint_free_rate?: number;
  average_retention_score?: number;
}

const DEFAULT_USER_ID = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11';

function TopicsDashboardContent() {
  const searchParams = useSearchParams();
  const stateParam = searchParams.get('state') as 'loading' | 'empty' | 'error' | null;

  const [simState, setSimState] = useState<'live' | 'loading' | 'empty' | 'error'>(
    stateParam || 'live'
  );

  const [rankedTopics, setRankedTopics] = useState<TopicWeaknessItem[]>([]);
  const [insufficientTopics, setInsufficientTopics] = useState<InsufficientTopicItem[]>([]);
  const [takeaway, setTakeaway] = useState<TakeawayData | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const fetchTopicWeakness = async () => {
    setIsLoading(true);
    setErrorMessage(null);

    try {
      const res = await fetch('/api/topics/weakness', {
        headers: {
          'x-user-id': DEFAULT_USER_ID,
        },
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.message || `Server returned ${res.status}`);
      }

      const data = await res.json();
      setRankedTopics(data.ranked_topics || []);
      setInsufficientTopics(data.insufficient_data_topics || []);
      setTakeaway(data.takeaway || null);
    } catch (err: any) {
      console.error('Failed to fetch topic weakness:', err);
      setErrorMessage(err.message || 'Unable to analyze topic weakness. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (stateParam) {
      setSimState(stateParam);
    }
  }, [stateParam]);

  useEffect(() => {
    if (simState === 'live') {
      fetchTopicWeakness();
    }
  }, [simState]);

  const currentMode = simState;

  return (
    <div className={styles.pageContainer}>
      <div className={styles.contentWrapper}>
        {/* Navigation Bar */}
        <RecallNav currentPage="topics" />

        {/* Page Header */}
        <header className={styles.header}>
          <span className={styles.brandLabel}>Recall • Weakness Detection</span>
          <div className={styles.titleRow}>
            <h1 className={styles.title}>Topic Weakness Analysis</h1>
            {currentMode === 'live' && !isLoading && !errorMessage && (
              <span className={styles.countBadge} id="ranked-topics-count">
                {rankedTopics.length} ranked
              </span>
            )}
          </div>
          <p className={styles.subtitle}>
            Ranks DSA topics by memory retention and independent solve rate rather than pure problem volume.
          </p>
        </header>

        {/* 1. LOADING STATE */}
        {(currentMode === 'loading' || (currentMode === 'live' && isLoading)) && (
          <div className={styles.skeletonCard} id="loading-state-view">
            <div className={`${styles.skeletonHeader} skeleton-shimmer`} />
            <div className={styles.topicRowsList}>
              {[1, 2, 3].map((i) => (
                <div key={i} className={styles.skeletonRow}>
                  <div className={styles.skeletonRowTop}>
                    <div className={`${styles.skeletonRowTitle} skeleton-shimmer`} />
                    <div className={`${styles.skeletonRowStats} skeleton-shimmer`} />
                  </div>
                  <div className={`${styles.skeletonBar} skeleton-shimmer`} />
                </div>
              ))}
            </div>
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
            <h2 className={styles.errorTitle}>Failed to analyze topic weakness</h2>
            <p className={styles.errorMessage}>
              {errorMessage || 'A network error occurred while querying topic metrics.'}
            </p>
            <button
              onClick={() => {
                setSimState('live');
                fetchTopicWeakness();
              }}
              className={styles.btnPrimary}
              id="retry-analysis-btn"
            >
              Retry Analysis
            </button>
          </div>
        )}

        {/* 3. EMPTY STATE */}
        {(currentMode === 'empty' ||
          (currentMode === 'live' && !isLoading && !errorMessage && rankedTopics.length === 0)) && (
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
                <circle cx="12" cy="12" r="10"></circle>
                <path d="M8 12h8"></path>
                <path d="M12 8v8"></path>
              </svg>
            </div>
            <h2 className={styles.emptyTitle}>Not enough data to calculate weak areas.</h2>
            <p className={styles.emptySubtitle}>
              Log at least 3 problems in any topic to establish a statistical baseline and reveal retention vulnerabilities.
            </p>
            <Link href="/dashboard/log" className={styles.btnPrimary} id="empty-log-solve-btn">
              Log your first solves
            </Link>
          </div>
        )}

        {/* 4. POPULATED STATE */}
        {currentMode === 'live' && !isLoading && !errorMessage && rankedTopics.length > 0 && (
          <>
            {/* Ranked Horizontal Bar List Card */}
            <div className={styles.rankedCard} id="ranked-topics-list">
              <div className={styles.cardHeaderRow}>
                <span className={styles.cardTitle}>Ranked by Retention (Weakest First)</span>
                <div className={styles.legendRow}>
                  <div className={styles.legendItem}>
                    <span className={`${styles.legendDot} ${styles.legendDotDanger}`} />
                    <span>&lt;40% Critical</span>
                  </div>
                  <div className={styles.legendItem}>
                    <span className={`${styles.legendDot} ${styles.legendDotWarning}`} />
                    <span>40-70% Vulnerable</span>
                  </div>
                  <div className={styles.legendItem}>
                    <span className={`${styles.legendDot} ${styles.legendDotNormal}`} />
                    <span>&gt;70% Retained</span>
                  </div>
                </div>
              </div>

              <div className={styles.topicRowsList}>
                {rankedTopics.map((item, idx) => (
                  <RankedTopicBar
                    key={item.topic}
                    rank={idx + 1}
                    topic={item.topic}
                    totalProblems={item.total_problems_logged}
                    percentage={item.average_retention_score}
                    statLabel={`${item.hint_free_rate}% hint-free`}
                    id={`topic-row-${item.topic}`}
                  />
                ))}
              </div>
            </div>

            {/* Dynamic One-Line Takeaway Card */}
            {takeaway && (
              <div className={styles.takeawayCard} id="takeaway-card">
                <div className={styles.takeawayIconCircle}>
                  <svg
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <circle cx="12" cy="12" r="10"></circle>
                    <line x1="12" y1="16" x2="12" y2="12"></line>
                    <line x1="12" y1="8" x2="12.01" y2="8"></line>
                  </svg>
                </div>
                <div className={styles.takeawayTextGroup}>
                  <span className={styles.takeawayTitle}>Recommended Action</span>
                  <p className={styles.takeawaySentence} id="takeaway-sentence">
                    {takeaway.summary}
                  </p>
                </div>
              </div>
            )}

            {/* Topics with Fewer than 3 Solves */}
            {insufficientTopics.length > 0 && (
              <div className={styles.insufficientSection} id="insufficient-topics-section">
                <div className={styles.insufficientHeader}>
                  <span className={styles.insufficientTitle}>Not Enough Data Yet</span>
                  <span className={styles.insufficientSubtitle}>
                    Needs 3 logged problems to rank accurately
                  </span>
                </div>
                <div className={styles.insufficientGrid}>
                  {insufficientTopics.map((item) => (
                    <div key={item.topic} className={styles.insufficientBadge}>
                      <span className={styles.insufficientTopicName}>{item.topic}</span>
                      <span className={styles.insufficientCount}>
                        ({item.total_problems_logged}/3 logged)
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* State Switcher Toolbar for Verification */}
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
    </div>
  );
}

export default function TopicsPage() {
  return (
    <Suspense fallback={<div className={styles.pageContainer}>Loading...</div>}>
      <TopicsDashboardContent />
    </Suspense>
  );
}
