'use client';

import React from 'react';
import Link from 'next/link';
import styles from './RecallNav.module.css';

export interface RecallNavProps {
  currentPage: 'queue' | 'topics' | 'readiness' | 'log';
  extraRight?: React.ReactNode;
}

export function RecallNav({ currentPage, extraRight }: RecallNavProps) {
  const isSubpage = currentPage !== 'queue';

  return (
    <nav className={styles.navRow} aria-label="Main Navigation">
      {isSubpage ? (
        <Link href="/dashboard" className={styles.backLink} id="nav-back-to-queue">
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <line x1="19" y1="12" x2="5" y2="12"></line>
            <polyline points="12 19 5 12 12 5"></polyline>
          </svg>
          Back to Revision Queue
        </Link>
      ) : (
        <div />
      )}

      <div className={styles.navActions}>
        {currentPage !== 'topics' && (
          <Link
            href="/dashboard/topics"
            className={styles.navBtnSecondary}
            id="nav-to-topics"
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
              aria-hidden="true"
            >
              <line x1="18" y1="20" x2="18" y2="10"></line>
              <line x1="12" y1="20" x2="12" y2="4"></line>
              <line x1="6" y1="20" x2="6" y2="14"></line>
            </svg>
            Topic Weakness
          </Link>
        )}

        {currentPage !== 'readiness' && (
          <Link
            href="/dashboard/readiness"
            className={styles.navBtnSecondary}
            id="nav-to-readiness"
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
              aria-hidden="true"
            >
              <circle cx="12" cy="12" r="10"></circle>
              <polyline points="12 6 12 12 16 14"></polyline>
            </svg>
            Readiness
          </Link>
        )}

        {currentPage !== 'log' && (
          <Link
            href="/dashboard/log"
            className={styles.navBtnPrimary}
            id="nav-to-log"
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
              aria-hidden="true"
            >
              <line x1="12" y1="5" x2="12" y2="19"></line>
              <line x1="5" y1="12" x2="19" y2="12"></line>
            </svg>
            Log a solve
          </Link>
        )}

        {extraRight}
      </div>
    </nav>
  );
}
