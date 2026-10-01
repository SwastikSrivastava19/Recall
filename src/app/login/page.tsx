'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import styles from './login.module.css';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [currentUser, setCurrentUser] = useState<any>(null);

  useEffect(() => {
    // Check active session
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        setCurrentUser(session.user);
      }
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setCurrentUser(session?.user || null);
    });

    return () => subscription.unsubscribe();
  }, []);

  const handleGoogleSignIn = async () => {
    setLoading(true);
    setErrorMessage(null);

    try {
      const redirectUrl = `${window.location.origin}/auth/callback`;
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: redirectUrl,
          queryParams: {
            access_type: 'offline',
            prompt: 'consent',
          },
        },
      });

      if (error) throw error;
    } catch (err: any) {
      console.error('Google OAuth sign-in error:', err);
      setErrorMessage(
        err.message ||
          'Failed to initialize Google Sign-in. Please ensure Google OAuth provider is enabled in Supabase settings.'
      );
      setLoading(false);
    }
  };

  const handleEmailSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      setErrorMessage('Please enter both email and password.');
      return;
    }

    setLoading(true);
    setErrorMessage(null);

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) throw error;

      if (data.session) {
        setSuccessMessage('Signed in successfully! Redirecting...');
        setTimeout(() => router.push('/dashboard'), 600);
      }
    } catch (err: any) {
      console.error('Email sign-in error:', err);
      setErrorMessage(err.message || 'Invalid credentials or user does not exist.');
    } finally {
      setLoading(false);
    }
  };

  const handleDevQuickLogin = () => {
    // For local dev and verification checks
    localStorage.setItem('recall_dev_user', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11');
    setSuccessMessage('Switched to seeded developer user (test@recall.dev)! Redirecting...');
    setTimeout(() => router.push('/dashboard'), 400);
  };

  const handleSignOut = async () => {
    setLoading(true);
    await supabase.auth.signOut();
    localStorage.removeItem('recall_dev_user');
    setCurrentUser(null);
    setSuccessMessage('Signed out successfully.');
    setLoading(false);
  };

  return (
    <div className={styles.pageContainer}>
      <div className={styles.loginCard}>
        <div className={styles.header}>
          <span className={styles.brandLabel}>RECALL • SPACED REPETITION</span>
          <h1 className={styles.title}>Sign In</h1>
          <p className={styles.subtitle}>
            Connect with Google or your Recall account to sync your queue and track interview readiness.
          </p>
        </div>

        {errorMessage && <div className={styles.errorBanner}>{errorMessage}</div>}
        {successMessage && <div className={styles.successBanner}>{successMessage}</div>}

        {currentUser ? (
          <div className={styles.sessionCard}>
            <p className={styles.sessionEmail}>Signed in as: {currentUser.email || currentUser.id}</p>
            <div className={styles.sessionActions}>
              <button
                type="button"
                onClick={() => router.push('/dashboard')}
                className={styles.btnPrimary}
              >
                Go to Dashboard
              </button>
              <button
                type="button"
                onClick={handleSignOut}
                className={styles.devBtn}
                disabled={loading}
              >
                Sign Out
              </button>
            </div>
          </div>
        ) : (
          <>
            {/* Official Google Sign-in Button */}
            <button
              type="button"
              onClick={handleGoogleSignIn}
              disabled={loading}
              className={styles.googleBtn}
              id="btn-google-signin"
            >
              <span className={styles.googleIconWrapper}>
                <svg width="18" height="18" viewBox="0 0 18 18">
                  <path
                    fill="#4285F4"
                    d="M17.64 9.2045c0-.6381-.0573-1.2518-.1636-1.8409H9v3.4814h4.8436c-.2086 1.125-.8427 2.0782-1.7959 2.7164v2.2581h2.9087c1.7018-1.5668 2.6836-3.874 2.6836-6.615z"
                  />
                  <path
                    fill="#34A853"
                    d="M9 18c2.43 0 4.4673-.806 5.9564-2.1805l-2.9087-2.2581c-.8059.54-1.8368.859-3.0477.859-2.344 0-4.3282-1.5831-5.036-3.7104H.9573v2.3318C2.4382 15.9832 5.4818 18 9 18z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M3.964 10.71c-.18-.54-.2822-1.1168-.2822-1.71s.1023-1.17.2823-1.71V4.9582H.9573A8.9965 8.9965 0 0 0 0 9c0 1.4523.3477 2.8268.9573 4.0418L3.964 10.71z"
                  />
                  <path
                    fill="#EA4335"
                    d="M9 3.5795c1.3214 0 2.5077.4541 3.4405 1.346l2.5813-2.5814C13.4632.9245 11.426 0 9 0 5.4818 0 2.4382 2.0168.9573 4.9582L3.964 7.29C4.6718 5.1627 6.656 3.5795 9 3.5795z"
                  />
                </svg>
              </span>
              <span>Continue with Google</span>
            </button>

            <div className={styles.divider}>or sign in with email</div>

            {/* Email / Password Form */}
            <form onSubmit={handleEmailSignIn} className={styles.emailForm}>
              <div className={styles.formGroup}>
                <label className={styles.label} htmlFor="email">
                  Email
                </label>
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@example.com"
                  className={styles.input}
                  required
                />
              </div>

              <div className={styles.formGroup}>
                <label className={styles.label} htmlFor="password">
                  Password
                </label>
                <input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className={styles.input}
                  required
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className={styles.btnPrimary}
                id="btn-email-signin"
              >
                {loading ? 'Signing in...' : 'Sign in with Email'}
              </button>
            </form>

            {/* Dev Quick Access for testing */}
            <div className={styles.devBox}>
              <span className={styles.devLabel}>Local Development & Testing</span>
              <button
                type="button"
                onClick={handleDevQuickLogin}
                className={styles.devBtn}
                id="btn-dev-quick-login"
              >
                Quick Sign-in as test@recall.dev
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
