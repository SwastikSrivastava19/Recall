'use client';

import React from 'react';
import styles from './RankedTopicBar.module.css';

export interface RankedTopicBarProps {
  rank: number;
  topic: string;
  totalProblems: number;
  percentage: number;
  statLabel: string;
  scoreDisplay?: string;
  id?: string;
}

export function RankedTopicBar({
  rank,
  topic,
  totalProblems,
  percentage,
  statLabel,
  scoreDisplay,
  id,
}: RankedTopicBarProps) {
  let barClass = styles.barFillNormal;
  if (percentage < 40) {
    barClass = styles.barFillDanger;
  } else if (percentage <= 70) {
    barClass = styles.barFillWarning;
  }

  const boundedWidth = Math.max(0, Math.min(100, percentage));

  return (
    <div
      className={styles.topicRow}
      id={id || `ranked-topic-${topic}`}
      tabIndex={0}
      role="listitem"
    >
      <div className={styles.topicInfo}>
        <div className={styles.topicNameGroup}>
          <span className={styles.rankNumber}>#{rank}</span>
          <span className={styles.topicName}>{topic}</span>
          <span className={styles.problemCount}>
            • {totalProblems} problem{totalProblems === 1 ? '' : 's'}
          </span>
        </div>

        <div className={styles.topicStatsGroup}>
          <span className={styles.statLabel}>{statLabel}</span>
          <span className={styles.scoreLabel}>
            {scoreDisplay || `${percentage}%`}
          </span>
        </div>
      </div>

      <div className={styles.barTrack}>
        <div
          className={`${styles.barFill} ${barClass}`}
          style={{ width: `${boundedWidth}%` }}
        />
      </div>
    </div>
  );
}
