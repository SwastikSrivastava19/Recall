'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { RecallNav } from '@/components/RecallNav';
import styles from './log.module.css';

const DEFAULT_USER_ID = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11';

const PREDEFINED_TAGS = [
  'arrays',
  'strings',
  'linked-list',
  'trees',
  'graphs',
  'dp',
  'greedy',
  'backtracking',
  'binary-search',
  'two-pointers',
  'sliding-window',
  'heaps',
  'stacks-queues',
  'bit-manipulation',
  'math',
];

interface FormSuccessData {
  problem_name: string;
  problem_link: string;
  difficulty: string;
  retention_score: number;
  next_due_date: string;
}

export default function LogSolvePage() {
  const [problemName, setProblemName] = useState('');
  const [problemLink, setProblemLink] = useState('');
  const [difficulty, setDifficulty] = useState<'easy' | 'medium' | 'hard'>('medium');
  const [selectedTags, setSelectedTags] = useState<string[]>(['arrays']);
  const [customTagInput, setCustomTagInput] = useState('');
  const [hintUsage, setHintUsage] = useState<'none' | 'partial' | 'full_editorial'>('none');
  const [minutes, setMinutes] = useState<string>('15');
  const [seconds, setSeconds] = useState<string>('0');
  const [confidenceRating, setConfidenceRating] = useState<number>(4);

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [successData, setSuccessData] = useState<FormSuccessData | null>(null);

  // Toggle predefined tag
  const handleToggleTag = (tag: string) => {
    setSelectedTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
    );
    if (errors.topic_tags) {
      setErrors((prev) => ({ ...prev, topic_tags: '' }));
    }
  };

  // Add custom tag
  const handleAddCustomTag = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const cleanTag = customTagInput.trim().toLowerCase().replace(/\s+/g, '-');
    if (!cleanTag) return;
    if (!selectedTags.includes(cleanTag)) {
      setSelectedTags((prev) => [...prev, cleanTag]);
    }
    setCustomTagInput('');
    if (errors.topic_tags) {
      setErrors((prev) => ({ ...prev, topic_tags: '' }));
    }
  };

  // Remove tag
  const handleRemoveTag = (tagToRemove: string) => {
    setSelectedTags((prev) => prev.filter((t) => t !== tagToRemove));
  };

  // Validation
  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!problemName.trim()) {
      newErrors.problem_name = 'Problem name is required';
    }

    if (!problemLink.trim()) {
      newErrors.problem_link = 'Problem URL is required';
    } else {
      try {
        const parsedUrl = new URL(problemLink.trim());
        if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
          newErrors.problem_link = 'URL must start with http:// or https://';
        }
      } catch {
        newErrors.problem_link = 'Please enter a well-formed URL (e.g., https://leetcode.com/problems/...)';
      }
    }

    const minNum = parseInt(minutes, 10) || 0;
    const secNum = parseInt(seconds, 10) || 0;
    const totalSeconds = minNum * 60 + secNum;

    if (totalSeconds <= 0) {
      newErrors.time_taken = 'Time taken must be greater than 0 seconds';
    }

    if (selectedTags.length === 0) {
      newErrors.topic_tags = 'Please select or add at least one topic tag';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;

    if (!validateForm()) {
      return;
    }

    setIsSubmitting(true);
    setErrors({});

    const totalSeconds =
      (parseInt(minutes, 10) || 0) * 60 + (parseInt(seconds, 10) || 0);

    try {
      const res = await fetch('/api/solves', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': DEFAULT_USER_ID,
        },
        body: JSON.stringify({
          problem_name: problemName.trim(),
          problem_link: problemLink.trim(),
          topic_tags: selectedTags,
          difficulty,
          hint_usage: hintUsage,
          time_taken_seconds: totalSeconds,
          confidence_rating: confidenceRating,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        if (data.details && Array.isArray(data.details)) {
          const apiErrors: Record<string, string> = {};
          data.details.forEach((d: { field: string; message: string }) => {
            apiErrors[d.field] = d.message;
          });
          setErrors(apiErrors);
        } else {
          setErrors({ general: data.message || 'Failed to record solve' });
        }
        setIsSubmitting(false);
        return;
      }

      // Success
      setSuccessData({
        problem_name: problemName.trim(),
        problem_link: problemLink.trim(),
        difficulty,
        retention_score: data.data.retention_score,
        next_due_date: data.data.revision_schedule?.next_due_date || 'Tomorrow',
      });
    } catch (err: any) {
      console.error('Error submitting solve:', err);
      setErrors({ general: err.message || 'Network error submitting solve' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleResetForm = () => {
    setProblemName('');
    setProblemLink('');
    setDifficulty('medium');
    setSelectedTags(['arrays']);
    setHintUsage('none');
    setMinutes('15');
    setSeconds('0');
    setConfidenceRating(4);
    setErrors({});
    setSuccessData(null);
  };

  return (
    <div className={styles.pageContainer}>
      <div className={styles.contentWrapper}>
        {/* Navigation */}
        <RecallNav currentPage="log" />

        {/* Header */}
        <header className={styles.header}>
          <h1 className={styles.title}>Log a Solve</h1>
          <p className={styles.subtitle}>
            Record a problem you practiced to initialize its spaced repetition schedule.
          </p>
        </header>

        {/* Success Confirmation State */}
        {successData ? (
          <div className={styles.successCard} id="solve-logged-success-card">
            <div className={styles.successIconCircle}>
              <svg
                width="28"
                height="28"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
                <polyline points="22 4 12 14.01 9 11.01"></polyline>
              </svg>
            </div>

            <h2 className={styles.successTitle}>Solve Logged Successfully</h2>
            <p className={styles.successSubtitle}>
              Your practice session was recorded and scheduled for spaced repetition.
            </p>

            <div className={styles.summaryBox}>
              <div className={styles.summaryRow}>
                <span className={styles.summaryLabel}>Problem</span>
                <span className={styles.summaryValue}>{successData.problem_name}</span>
              </div>
              <div className={styles.summaryRow}>
                <span className={styles.summaryLabel}>Difficulty</span>
                <span className={styles.summaryValue} style={{ textTransform: 'capitalize' }}>
                  {successData.difficulty}
                </span>
              </div>
              <div className={styles.summaryRow}>
                <span className={styles.summaryLabel}>Initial Retention Score</span>
                <span className={styles.summaryValue}>{successData.retention_score} / 100</span>
              </div>
              <div className={styles.summaryRow}>
                <span className={styles.summaryLabel}>First Revision Due</span>
                <span className={styles.summaryValue}>Tomorrow ({successData.next_due_date.split('T')[0]})</span>
              </div>
            </div>

            <div className={styles.successActions}>
              <button
                type="button"
                onClick={handleResetForm}
                className={styles.btnSecondary}
                id="log-another-btn"
              >
                Log another problem
              </button>
              <Link href="/dashboard" className={styles.btnPrimary} id="view-queue-btn">
                Back to dashboard
              </Link>
            </div>
          </div>
        ) : (
          /* Main Form */
          <form onSubmit={handleSubmit} className={styles.formCard} id="log-solve-form" noValidate>
            {errors.general && (
              <div className={styles.fieldError} style={{ marginBottom: '0.5rem' }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                  <circle cx="12" cy="12" r="10" />
                </svg>
                <span>{errors.general}</span>
              </div>
            )}

            {/* Problem Name */}
            <div className={styles.formGroup}>
              <div className={styles.labelRow}>
                <label htmlFor="problem_name" className={styles.label}>
                  Problem Name *
                </label>
              </div>
              <input
                id="problem_name"
                name="problem_name"
                type="text"
                placeholder="e.g. Course Schedule, 3Sum, LRU Cache"
                value={problemName}
                onChange={(e) => {
                  setProblemName(e.target.value);
                  if (errors.problem_name) {
                    setErrors((prev) => ({ ...prev, problem_name: '' }));
                  }
                }}
                className={`${styles.input} ${errors.problem_name ? styles.inputError : ''}`}
                disabled={isSubmitting}
                required
              />
              {errors.problem_name && (
                <span className={styles.fieldError} id="error-problem-name">
                  {errors.problem_name}
                </span>
              )}
            </div>

            {/* Problem Link */}
            <div className={styles.formGroup}>
              <div className={styles.labelRow}>
                <label htmlFor="problem_link" className={styles.label}>
                  Problem URL *
                </label>
              </div>
              <input
                id="problem_link"
                name="problem_link"
                type="url"
                placeholder="https://leetcode.com/problems/..."
                value={problemLink}
                onChange={(e) => {
                  setProblemLink(e.target.value);
                  if (errors.problem_link) {
                    setErrors((prev) => ({ ...prev, problem_link: '' }));
                  }
                }}
                className={`${styles.input} ${errors.problem_link ? styles.inputError : ''}`}
                disabled={isSubmitting}
                required
              />
              {errors.problem_link && (
                <span className={styles.fieldError} id="error-problem-link">
                  {errors.problem_link}
                </span>
              )}
            </div>

            {/* Difficulty */}
            <div className={styles.formGroup}>
              <label className={styles.label}>Difficulty</label>
              <div className={styles.segmentedRow}>
                {(['easy', 'medium', 'hard'] as const).map((diff) => (
                  <button
                    key={diff}
                    type="button"
                    onClick={() => setDifficulty(diff)}
                    className={`${styles.segmentedBtn} ${
                      difficulty === diff ? styles.segmentedBtnActive : ''
                    }`}
                    id={`diff-btn-${diff}`}
                    disabled={isSubmitting}
                  >
                    {diff.charAt(0).toUpperCase() + diff.slice(1)}
                  </button>
                ))}
              </div>
            </div>

            {/* Topic Tags */}
            <div className={styles.formGroup}>
              <div className={styles.labelRow}>
                <label className={styles.label}>Topic Tags *</label>
                <span className={styles.optionalTag}>
                  {selectedTags.length} selected
                </span>
              </div>

              <div className={styles.tagsSection}>
                {/* Active Selected Tags */}
                {selectedTags.length > 0 && (
                  <div className={styles.selectedTagsList}>
                    {selectedTags.map((tag) => (
                      <span key={tag} className={styles.selectedTagPill}>
                        #{tag}
                        <button
                          type="button"
                          onClick={() => handleRemoveTag(tag)}
                          className={styles.removeTagBtn}
                          title={`Remove ${tag}`}
                          disabled={isSubmitting}
                        >
                          ×
                        </button>
                      </span>
                    ))}
                  </div>
                )}

                {/* Predefined Tags */}
                <span className={styles.predefinedTagsTitle}>Common Topics</span>
                <div className={styles.predefinedTagsGrid}>
                  {PREDEFINED_TAGS.map((tag) => {
                    const isSelected = selectedTags.includes(tag);
                    return (
                      <button
                        key={tag}
                        type="button"
                        onClick={() => handleToggleTag(tag)}
                        className={`${styles.predefinedTag} ${
                          isSelected ? styles.predefinedTagActive : ''
                        }`}
                        disabled={isSubmitting}
                        id={`tag-btn-${tag}`}
                      >
                        #{tag}
                      </button>
                    );
                  })}
                </div>

                {/* Add Custom Tag */}
                <div className={styles.customTagRow}>
                  <input
                    type="text"
                    placeholder="Add custom tag (e.g. interval, trie)"
                    value={customTagInput}
                    onChange={(e) => setCustomTagInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleAddCustomTag();
                      }
                    }}
                    className={styles.customTagInput}
                    disabled={isSubmitting}
                    id="custom-tag-input"
                  />
                  <button
                    type="button"
                    onClick={() => handleAddCustomTag()}
                    className={styles.addTagBtn}
                    disabled={isSubmitting || !customTagInput.trim()}
                    id="add-custom-tag-btn"
                  >
                    + Add
                  </button>
                </div>
              </div>

              {errors.topic_tags && (
                <span className={styles.fieldError} id="error-topic-tags">
                  {errors.topic_tags}
                </span>
              )}
            </div>

            {/* Hint Usage */}
            <div className={styles.formGroup}>
              <label className={styles.label}>Hint Usage</label>
              <div className={styles.hintCardsRow}>
                {[
                  {
                    value: 'none',
                    title: 'Solved independently',
                    desc: 'No hints, editorial, or external answers used.',
                  },
                  {
                    value: 'partial',
                    title: 'Used a partial hint',
                    desc: 'Peeked at hints, edge cases, or small algorithmic clues.',
                  },
                  {
                    value: 'full_editorial',
                    title: 'Read the full editorial',
                    desc: 'Followed solution walkthrough, video, or copied code.',
                  },
                ].map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() =>
                      setHintUsage(opt.value as 'none' | 'partial' | 'full_editorial')
                    }
                    className={`${styles.hintCard} ${
                      hintUsage === opt.value ? styles.hintCardActive : ''
                    }`}
                    id={`hint-opt-${opt.value}`}
                    disabled={isSubmitting}
                  >
                    <span className={styles.hintCardTitle}>{opt.title}</span>
                    <span className={styles.hintCardDesc}>{opt.desc}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Time Taken */}
            <div className={styles.formGroup}>
              <div className={styles.labelRow}>
                <label className={styles.label}>Time Taken *</label>
                <span className={styles.optionalTag}>Duration to solve</span>
              </div>
              <div className={styles.timeInputsRow}>
                <div className={styles.timeField}>
                  <input
                    type="number"
                    min="0"
                    max="300"
                    value={minutes}
                    onChange={(e) => {
                      setMinutes(e.target.value);
                      if (errors.time_taken) {
                        setErrors((prev) => ({ ...prev, time_taken: '' }));
                      }
                    }}
                    className={styles.timeInput}
                    disabled={isSubmitting}
                    id="input-minutes"
                  />
                  <span className={styles.timeUnit}>min</span>
                </div>
                <div className={styles.timeField}>
                  <input
                    type="number"
                    min="0"
                    max="59"
                    value={seconds}
                    onChange={(e) => {
                      setSeconds(e.target.value);
                      if (errors.time_taken) {
                        setErrors((prev) => ({ ...prev, time_taken: '' }));
                      }
                    }}
                    className={styles.timeInput}
                    disabled={isSubmitting}
                    id="input-seconds"
                  />
                  <span className={styles.timeUnit}>sec</span>
                </div>
              </div>
              {errors.time_taken && (
                <span className={styles.fieldError} id="error-time-taken">
                  {errors.time_taken}
                </span>
              )}
            </div>

            {/* Confidence Rating */}
            <div className={styles.formGroup}>
              <div className={styles.labelRow}>
                <label className={styles.label}>Confidence Rating</label>
                <span className={styles.optionalTag}>How confident do you feel?</span>
              </div>
              <div className={styles.confidenceGrid}>
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
                    onClick={() => setConfidenceRating(opt.rating)}
                    className={`${styles.confidenceBtn} ${
                      confidenceRating === opt.rating
                        ? styles.confidenceBtnActive
                        : ''
                    }`}
                    id={`conf-btn-${opt.rating}`}
                    disabled={isSubmitting}
                  >
                    <span className={styles.confidenceNum}>{opt.rating}</span>
                    <span className={styles.confidenceLabel}>{opt.label}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              className={styles.submitBtn}
              disabled={isSubmitting}
              id="submit-solve-btn"
            >
              {isSubmitting ? (
                <>
                  <svg
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    style={{ animation: 'spin 1s linear infinite' }}
                  >
                    <line x1="12" y1="2" x2="12" y2="6"></line>
                    <line x1="12" y1="18" x2="12" y2="22"></line>
                    <line x1="4.93" y1="4.93" x2="7.76" y2="7.76"></line>
                    <line x1="16.24" y1="16.24" x2="19.07" y2="19.07"></line>
                    <line x1="2" y1="12" x2="6" y2="12"></line>
                    <line x1="18" y1="12" x2="22" y2="12"></line>
                    <line x1="4.93" y1="19.07" x2="7.76" y2="16.24"></line>
                    <line x1="16.24" y1="7.76" x2="19.07" y2="4.93"></line>
                  </svg>
                  Saving & Scheduling...
                </>
              ) : (
                'Save Solve & Schedule Revision'
              )}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
