'use client';

import React, { useState, useEffect, Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { RankedTopicBar } from '@/components/RankedTopicBar';
import { RecallNav } from '@/components/RecallNav';
import styles from './readiness.module.css';

interface TopicReadinessItem {
  topic: string;
  total_problems_logged: number;
  mature_problems_count: number;
  readiness_percentage: number;
  retention_tier: 'danger' | 'warning' | 'normal';
}

interface InsufficientTopicItem {
  topic: string;
  total_problems_logged: number;
  mature_problems_count: number;
  readiness_percentage: number;
  reason: string;
}

interface ReadinessTrendPoint {
  week_label: string;
  date: string;
  mature_count: number;
  total_count: number;
  readiness_percentage: number;
}

interface ReadinessData {
  overall_readiness: number;
  mature_problems_count: number;
  total_problems_logged: number;
  interpretation: string;
  ranked_topics: TopicReadinessItem[];
  insufficient_topics: InsufficientTopicItem[];
  readiness_trend: ReadinessTrendPoint[];
}

const DEFAULT_USER_ID = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11';

function ReadinessContent() {
  const searchParams = useSearchParams();
  const stateParam = searchParams.get('state') as 'loading' | 'empty' | 'error' | null;

  const [simState, setSimState] = useState<'live' | 'loading' | 'empty' | 'error'>(
    stateParam || 'live'
  );

  const [data, setData] = useState<ReadinessData | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const fetchReadiness = async () => {
    setIsLoading(true);
    setErrorMessage(null);

    try {
      const res = await fetch('/api/readiness', {
        headers: {
          'x-user-id': DEFAULT_USER_ID,
        },
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.message || `Server returned ${res.status}`);
      }

      const resData = await res.json();
      setData(resData);
    } catch (err: any) {
      console.error('Failed to fetch readiness data:', err);
      setErrorMessage(err.message || 'Unable to calculate readiness score.');
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
      fetchReadiness();
    }
  }, [simState]);

  const currentMode = simState;

  // Build SVG Sparkline coordinates from readiness_trend (8 points)
  const buildSvgPath = (points: ReadinessTrendPoint[]) => {
    if (!points || points.length === 0) return { pathD: '', areaD: '', coordinates: [] };

    const svgWidth = 600;
    const svgHeight = 120;
    const paddingX = 30;
    const paddingY = 20;

    const usableWidth = svgWidth - paddingX * 2;
    const usableHeight = svgHeight - paddingY * 2;

    const coordinates = points.map((p, i) => {
      const x = paddingX + (i / (points.length - 1)) * usableWidth;
      const pct = Math.max(0, Math.min(100, p.readiness_percentage));
      const y = svgHeight - paddingY - (pct / 100) * usableHeight;
      return { x, y, point: p };
    });

    const pathD = coordinates.reduce((acc, c, i) => {
      return i === 0 ? `M ${c.x} ${c.y}` : `${acc} L ${c.x} ${c.y}`;
    }, '');

    const first = coordinates[0];
    const last = coordinates[coordinates.length - 1];
    const areaD = `${pathD} L ${last.x} ${svgHeight - paddingY} L ${first.x} ${svgHeight - paddingY} Z`;

    return { pathD, areaD, coordinates };
  };

  const trendData = data?.readiness_trend || [];
  const { pathD, areaD, coordinates } = buildSvgPath(trendData);

  return (
    <div className={styles.pageContainer}>
      <div className={styles.contentWrapper}>
        {/* Navigation Bar */}
        <RecallNav currentPage="readiness" />

        {/* Page Header */}
        <header className={styles.header}>
          <span className={styles.brandLabel}>Recall • Interview Readiness</span>
          <h1 className={styles.title}>Interview-Readiness Score</h1>
          <p className={styles.subtitle}>
            Measures long-term recall stability based on verified, hint-free spaced revision cycles.
          </p>
        </header>

        {/* 1. LOADING STATE */}
        {(currentMode === 'loading' || (currentMode === 'live' && isLoading)) && (
          <div id="loading-state-view">
            <div className={`${styles.skeletonHero} skeleton-shimmer`} />
            <div className={`${styles.skeletonTrend} skeleton-shimmer`} />
            <div className={`${styles.skeletonTopics} skeleton-shimmer`} />
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
            <h2 className={styles.errorTitle}>Failed to calculate readiness score</h2>
            <p className={styles.errorMessage}>
              {errorMessage || 'A network error occurred while querying revision history.'}
            </p>
            <button
              onClick={() => {
                setSimState('live');
                fetchReadiness();
              }}
              className={styles.btnPrimary}
              id="retry-readiness-btn"
            >
              Retry Connection
            </button>
          </div>
        )}

        {/* 3. EMPTY STATE */}
        {(currentMode === 'empty' ||
          (currentMode === 'live' &&
            !isLoading &&
            !errorMessage &&
            data &&
            data.total_problems_logged === 0)) && (
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
                <path d="M12 6v6l4 2"></path>
              </svg>
            </div>
            <h2 className={styles.emptyTitle}>No mature problems yet</h2>
            <p className={styles.emptySubtitle}>
              To establish genuine interview readiness, problems must undergo at least 2 successful,
              hint-free spaced revision cycles. Complete your pending revisions in the queue to begin
              accumulating readiness data.
            </p>
            <Link href="/dashboard" className={styles.btnPrimary} id="empty-go-to-queue-btn">
              Go to Revision Queue
            </Link>
          </div>
        )}

        {/* 4. POPULATED STATE */}
        {currentMode === 'live' && !isLoading && !errorMessage && data && data.total_problems_logged > 0 && (
          <>
            {/* HERO SCORE CARD */}
            <div className={styles.scoreHeroCard} id="readiness-hero-card">
              <div className={styles.scoreContainer}>
                <span className={styles.scoreNumber} id="hero-readiness-number">
                  {data.overall_readiness}
                </span>
                <span className={styles.scoreUnit}>%</span>
              </div>

              <span className={styles.scoreLabel}>Interview Ready</span>

              <span className={styles.scoreMeta} id="hero-readiness-meta">
                {data.mature_problems_count} of {data.total_problems_logged} distinct problems mature
                (2+ hint-free cycles)
              </span>

              <p className={styles.scoreInterpretation} id="hero-interpretation-text">
                {data.interpretation}
              </p>
            </div>

            {/* 8-WEEK READINESS TREND */}
            <div className={styles.trendCard} id="readiness-trend-card">
              <div className={styles.trendHeader}>
                <span className={styles.trendTitle}>8-Week Readiness Trend</span>
                <span className={styles.trendSubtitle}>Calculated from revision history</span>
              </div>

              <div className={styles.chartContainer}>
                <svg viewBox="0 0 600 120" className={styles.chartSvg}>
                  <defs>
                    <linearGradient id="trendGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#ffffff" stopOpacity="0.15" />
                      <stop offset="100%" stopColor="#ffffff" stopOpacity="0.0" />
                    </linearGradient>
                  </defs>

                  {/* Grid Lines at 0%, 50%, 100% */}
                  <line x1="30" y1="20" x2="570" y2="20" className={styles.chartGridLine} />
                  <line x1="30" y1="60" x2="570" y2="60" className={styles.chartGridLine} />
                  <line x1="30" y1="100" x2="570" y2="100" className={styles.chartGridLine} />

                  {/* Shaded Area */}
                  {areaD && <path d={areaD} className={styles.chartArea} />}

                  {/* Trend Line */}
                  {pathD && <path d={pathD} className={styles.chartTrendLine} />}

                  {/* Data Point Dots */}
                  {coordinates.map((c, i) => (
                    <circle
                      key={i}
                      cx={c.x}
                      cy={c.y}
                      r={3.5}
                      className={styles.chartDot}
                      id={`trend-dot-${i}`}
                    >
                      <title>{`${c.point.week_label}: ${c.point.readiness_percentage}% (${c.point.mature_count}/${c.point.total_count} mature)`}</title>
                    </circle>
                  ))}
                </svg>

                {/* Week Labels */}
                <div className={styles.chartLabelsRow}>
                  {trendData.map((p, idx) => (
                    <span key={idx} className={styles.chartLabel}>
                      {p.week_label}
                    </span>
                  ))}
                </div>
              </div>
            </div>

            {/* EXPLAINER BANNER */}
            <div className={styles.explainerBanner}>
              <svg
                className={styles.explainerIcon}
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <circle cx="12" cy="12" r="10"></circle>
                <line x1="12" y1="16" x2="12" y2="12"></line>
                <line x1="12" y1="8" x2="12.01" y2="8"></line>
              </svg>
              <p className={styles.explainerText}>
                <strong>Retention vs. Readiness:</strong> Retention reflects recall quality on your
                last practice session; Readiness measures proven mastery across 2+ spaced, hint-free
                revision cycles over time.
              </p>
            </div>

            {/* PER-TOPIC READINESS BREAKDOWN */}
            <div className={styles.topicCard} id="per-topic-readiness-card">
              <div className={styles.topicCardHeader}>
                <span className={styles.topicCardTitle}>Topic Readiness Breakdown</span>
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
                    <span>&gt;70% Ready</span>
                  </div>
                </div>
              </div>

              <div className={styles.topicRowsList}>
                {data.ranked_topics.map((item, idx) => (
                  <RankedTopicBar
                    key={item.topic}
                    rank={idx + 1}
                    topic={item.topic}
                    totalProblems={item.total_problems_logged}
                    percentage={item.readiness_percentage}
                    statLabel={`${item.mature_problems_count}/${item.total_problems_logged} mature`}
                    id={`readiness-row-${item.topic}`}
                  />
                ))}
              </div>
            </div>

            {/* Topics with Fewer than 3 Solves */}
            {data.insufficient_topics && data.insufficient_topics.length > 0 && (
              <div className={styles.insufficientSection} id="insufficient-topics-section">
                <div className={styles.insufficientHeader}>
                  <span className={styles.insufficientTitle}>Not Enough Data Yet</span>
                  <span className={styles.insufficientSubtitle}>
                    Needs 3 logged problems to rank accurately
                  </span>
                </div>
                <div className={styles.insufficientGrid}>
                  {data.insufficient_topics.map((item) => (
                    <div key={item.topic} className={styles.insufficientBadge}>
                      <span className={styles.insufficientTopicName}>{item.topic}</span>
                      <span className={styles.insufficientCount}>
                        ({item.total_problems_logged}/3 logged • {item.mature_problems_count} mature)
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

export default function ReadinessPage() {
  return (
    <Suspense fallback={<div className={styles.pageContainer}>Loading...</div>}>
      <ReadinessContent />
    </Suspense>
  );
}
