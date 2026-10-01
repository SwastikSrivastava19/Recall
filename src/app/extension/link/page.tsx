'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import styles from './link.module.css';

export default function ExtensionLinkPage() {
  const [token, setToken] = useState('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11');
  const [email, setEmail] = useState('test@recall.dev');
  const [copied, setCopied] = useState(false);
  const [bridgeSent, setBridgeSent] = useState(false);

  useEffect(() => {
    // Attempt to fetch current user session from /api/extension/token
    fetch('/api/extension/token')
      .then((res) => res.json())
      .then((data) => {
        if (data && data.token) {
          setToken(data.token);
          if (data.user?.email) setEmail(data.user.email);

          // Broadcast token to extension content script
          window.postMessage(
            {
              type: 'RECALL_EXTENSION_AUTH',
              token: data.token,
              user: data.user,
            },
            '*'
          );
          setBridgeSent(true);
        }
      })
      .catch((err) => {
        console.error('Failed to load extension token:', err);
      });
  }, []);

  const handleCopy = () => {
    navigator.clipboard.writeText(token);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className={styles.container}>
      <div
        className={styles.card}
        id="recall-extension-auth"
        data-token={token}
        data-user-email={email}
      >
        <div className={styles.iconCircle}>
          <svg
            width="28"
            height="28"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"></path>
            <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"></path>
          </svg>
        </div>

        <span className={styles.eyebrow}>Recall Extension Bridge</span>
        <h1 className={styles.title}>Extension Linked</h1>
        <p className={styles.subtitle}>
          Your Recall session has been authorized for the Chrome extension.
          Automatic LeetCode solve detection is active.
        </p>

        <div className={styles.statusBox}>
          <div className={styles.statusRow}>
            <span className={styles.statusLabel}>Account</span>
            <span className={styles.statusValue}>{email}</span>
          </div>
          <div className={styles.statusRow}>
            <span className={styles.statusLabel}>Session Status</span>
            <span className={styles.statusValue} style={{ color: '#fafafa' }}>
              {bridgeSent ? 'Transferred to Extension' : 'Ready'}
            </span>
          </div>
        </div>

        <div className={styles.actions}>
          <button
            type="button"
            onClick={handleCopy}
            className={styles.btnSecondary}
            id="copy-token-btn"
          >
            {copied ? '✓ Token Copied' : 'Copy Auth Token'}
          </button>

          <Link href="/dashboard" className={styles.btnPrimary} id="go-dashboard-btn">
            Open Dashboard
          </Link>
        </div>
      </div>
    </div>
  );
}
