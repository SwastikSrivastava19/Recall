'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import styles from './landing.module.css';

interface ScreenshotTab {
  id: string;
  name: string;
  badge: string;
  title: string;
  description: string;
  imageSrc: string;
  bullets: string[];
}

const SCREENSHOT_TABS: ScreenshotTab[] = [
  {
    id: 'extension',
    name: 'Chrome Extension',
    badge: 'Ambient 1-Click Capture',
    title: 'Zero Friction — Logs Automatically on LeetCode',
    description:
      'Never touch a spreadsheet or Notion tracker again. When your code gets Accepted on LeetCode, Recall instantly slides in to log your confidence and hint usage in less than 2 seconds.',
    imageSrc: '/screenshots/extension_capture_overlay_test.png',
    bullets: [
      'Listens directly for Accepted submissions via DOM observer',
      'Captures whether you solved without hints in 1 quick click',
      '5-star confidence rating personalizes your SM-2 decay curve',
      'Runs 100% locally with zero performance overhead on LeetCode',
    ],
  },
  {
    id: 'queue',
    name: 'Spaced Revision Queue',
    badge: 'SM-2 Memory Engine',
    title: 'Scientific Spaced Repetition for LeetCode',
    description:
      'Recall schedules each problem based on the SuperMemo-2 spaced repetition algorithm. Review problems exactly at the moment of highest memory decay so solutions lock into permanent memory.',
    imageSrc: '/screenshots/audit_queue_desktop.png',
    bullets: [
      'Daily queue shows only problems mathematically due for review',
      'Hint-free solves compound intervals (1d → 3d → 8d → 21d → 60d)',
      'Hinted solves gracefully reset to 1 day to rebuild foundation',
      'Direct links to problem prompts and personal solve notes',
    ],
  },
  {
    id: 'substitution',
    name: 'Pattern Check Engine',
    badge: 'Bust Rote Memorization',
    title: 'Test True Pattern Understanding, Not Memorization',
    description:
      'Once you prove you can solve a problem hint-free twice, Recall substitutes a DIFFERENT problem sharing the same underlying pattern (40% probability) to ensure you understand the technique.',
    imageSrc: '/screenshots/audit_queue_desktop.png',
    bullets: [
      '20 distinct DSA patterns (Sliding Window, Monotonic Stack, etc.)',
      '820+ curated benchmark problems from NeetCode, Striver & Fraz',
      'Proxy solves advance your original problem schedule seamlessly',
      'Guarantees you never just memorize specific variable names',
    ],
  },
  {
    id: 'readiness',
    name: 'Interview Readiness',
    badge: 'Big Tech Matrix',
    title: 'Know Exactly When You Are Ready to Interview',
    description:
      'Stop guessing if you have prepped enough. Recall computes an overall Interview Readiness Score alongside a visual confidence matrix across every core coding topic.',
    imageSrc: '/screenshots/audit_readiness_desktop.png',
    bullets: [
      'Aggregate Readiness Percentage reflects current retention',
      'Categorizes problems into High, Medium, and Low confidence tiers',
      'Warns you before memory decay drops your readiness score',
      'Targets an 85%+ readiness benchmark for Google / Meta interviews',
    ],
  },
  {
    id: 'topics',
    name: 'Weakness Diagnostics',
    badge: 'Targeted Practice',
    title: 'Pinpoint & Repair Your Algorithmic Blind Spots',
    description:
      'Instead of endlessly doing easy Arrays, Recall highlights the topics with the lowest retention, highest hint reliance, and longest overdue intervals.',
    imageSrc: '/screenshots/audit_topics_desktop.png',
    bullets: [
      'Ranked topic weakness list highlights high-decay categories',
      'Differentiates Dynamic Programming, Graphs, Trees, and Pointers',
      'Personalized drill recommendations directly from your weak spots',
      'Links with public LeetCode stats for tailored difficulty filtering',
    ],
  },
];

const PATTERN_LIST = [
  { name: 'Sliding Window', count: 46 },
  { name: 'Two Pointers', count: 42 },
  { name: 'Binary Search', count: 42 },
  { name: 'DP: Knapsack', count: 42 },
  { name: 'DP: Longest Increasing Subsequence', count: 42 },
  { name: 'Graph: BFS', count: 42 },
  { name: 'Graph: DFS', count: 42 },
  { name: 'Backtracking', count: 42 },
  { name: 'Greedy Intervals', count: 42 },
  { name: 'Heap / Top-K', count: 42 },
  { name: 'Monotonic Stack', count: 42 },
  { name: 'Prefix Sum', count: 42 },
  { name: 'Trie / Prefix Trees', count: 42 },
  { name: 'Union Find / Disjoint Set', count: 40 },
  { name: 'Linked List', count: 40 },
  { name: 'Trees: BFS / Level Order', count: 42 },
  { name: 'Trees: DFS', count: 42 },
  { name: 'Tree Traversal', count: 40 },
  { name: 'Linked List: Fast & Slow', count: 24 },
  { name: 'Bit Manipulation', count: 42 },
];

export default function LandingPage() {
  const [activeTabId, setActiveTabId] = useState<string>('extension');
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  const activeTab = SCREENSHOT_TABS.find((t) => t.id === activeTabId) || SCREENSHOT_TABS[0];

  const toggleFaq = (index: number) => {
    setOpenFaq(openFaq === index ? null : index);
  };

  return (
    <div className={styles.landingContainer}>
      <div className={styles.gridBackground} />

      {/* 1. Header / Navbar */}
      <header className={styles.navbar}>
        <Link href="/" className={styles.brand}>
          <div className={styles.brandLogo}>R</div>
          <span className={styles.brandName}>
            Recall <span className={styles.brandBadge}>DSA Engine</span>
          </span>
        </Link>

        <nav>
          <ul className={styles.navLinks}>
            <li>
              <a href="#what-is-recall" className={styles.navLink}>
                What is Recall
              </a>
            </li>
            <li>
              <a href="#why-recall" className={styles.navLink}>
                Why Recall
              </a>
            </li>
            <li>
              <a href="#how-it-helps" className={styles.navLink}>
                How It Works
              </a>
            </li>
            <li>
              <a href="#screenshots" className={styles.navLink}>
                App Preview
              </a>
            </li>
            <li>
              <a href="#patterns" className={styles.navLink}>
                20 Patterns
              </a>
            </li>
          </ul>
        </nav>

        <div className={styles.navActions}>
          <Link href="/login" className={styles.btnGhost}>
            Log In
          </Link>
          <Link href="/dashboard" className={styles.btnPrimary}>
            Open App →
          </Link>
        </div>
      </header>

      <main>
        {/* 2. Hero Section */}
        <section className={styles.heroSection}>
          <div className={styles.pillBadge}>
            <span className={styles.sparkle}>✦</span> Spaced Repetition + Pattern Mastery for LeetCode
          </div>

          <h1 className={styles.heroHeading}>
            Stop Grinding 500+ LeetCode Problems <br />
            <span className={styles.gradientText}>Just to Forget Them in 2 Weeks.</span>
          </h1>

          <p className={styles.heroSubtitle}>
            <strong>Recall</strong> automatically captures your solves on LeetCode, calculates your personal{' '}
            <strong>memory decay curve with SM-2</strong>, and challenges you with <strong>same-pattern substitutions</strong>{' '}
            so you master problem patterns — not memorized code.
          </p>

          <div className={styles.heroCtas}>
            <Link href="/login" className={styles.ctaBtnPrimary}>
              Start Retaining for Free →
            </Link>
            <Link href="/dashboard" className={styles.ctaBtnSecondary}>
              Explore Live Dashboard
            </Link>
          </div>

          {/* Metrics counter */}
          <div className={styles.metricsGrid}>
            <div className={styles.metricCard}>
              <div className={`${styles.metricValue} ${styles.metricAccentEmerald}`}>820+</div>
              <div className={styles.metricLabel}>Curated Pattern Benchmarks</div>
            </div>
            <div className={styles.metricCard}>
              <div className={`${styles.metricValue} ${styles.metricAccentCyan}`}>20</div>
              <div className={styles.metricLabel}>Core DSA Patterns Covered</div>
            </div>
            <div className={styles.metricCard}>
              <div className={`${styles.metricValue} ${styles.metricAccentIndigo}`}>SM-2</div>
              <div className={styles.metricLabel}>Spaced Repetition Algorithm</div>
            </div>
            <div className={styles.metricCard}>
              <div className={styles.metricValue}>1-Click</div>
              <div className={styles.metricLabel}>Chrome Extension Auto-Capture</div>
            </div>
          </div>
        </section>

        {/* 3. Section 1: What is Recall? */}
        <section id="what-is-recall" className={styles.sectionWrapper}>
          <div className={styles.sectionHeader}>
            <span className={styles.sectionEyebrow}>The Intelligent Retention Engine</span>
            <h2 className={styles.sectionTitle}>What is Recall?</h2>
            <p className={styles.sectionDesc}>
              Recall is an intelligent spaced-repetition platform and browser companion built specifically for software
              engineers preparing for technical interviews.
            </p>
          </div>

          <div className={styles.whatIsGrid}>
            <article className={styles.featureCard}>
              <div className={styles.cardIconBox}>🧠</div>
              <h3 className={styles.cardTitle}>Algorithmic Memory Engine</h3>
              <p className={styles.cardDesc}>
                Static checklists like Blind 75 only tell you what to solve — not when to review. Recall uses the
                SuperMemo-2 (SM-2) algorithm to schedule each problem at the exact mathematical moment of memory decay.
              </p>
              <div className={styles.cardFooterBadge}>✓ Personalized ease factor & intervals</div>
            </article>

            <article className={styles.featureCard}>
              <div className={`${styles.cardIconBox} ${styles.iconEmerald}`}>🧩</div>
              <h3 className={styles.cardTitle}>Pattern Substitution</h3>
              <p className={styles.cardDesc}>
                Memorizing a specific solution is dangerous in Big Tech interviews. After 2 hint-free revisions, Recall
                swaps in a fresh problem sharing the same algorithmic pattern with 40% probability to test true comprehension.
              </p>
              <div className={styles.cardFooterBadge}>✓ 20 core patterns, 820+ problems</div>
            </article>

            <article className={styles.featureCard}>
              <div className={`${styles.cardIconBox} ${styles.iconCyan}`}>⚡</div>
              <h3 className={styles.cardTitle}>Zero-Overhead Chrome Extension</h3>
              <p className={styles.cardDesc}>
                No more manual spreadsheets or messy Notion tables. The Recall Chrome extension detects Accepted
                submissions on LeetCode and logs your confidence rating in under 2 seconds.
              </p>
              <div className={styles.cardFooterBadge}>✓ Works seamlessly on LeetCode</div>
            </article>
          </div>
        </section>

        {/* 4. Section 2: Why Recall? (The Forgetting Curve Problem) */}
        <section id="why-recall" className={styles.sectionWrapper}>
          <div className={styles.sectionHeader}>
            <span className={styles.sectionEyebrow}>The LeetCode Dilemma</span>
            <h2 className={styles.sectionTitle}>Why Recall Exists</h2>
            <p className={styles.sectionDesc}>
              The typical DSA prep cycle is broken: you solve hundreds of problems, but 70% of the mental models vanish
              within 48 hours due to the Ebbinghaus Forgetting Curve.
            </p>
          </div>

          <div className={styles.comparisonGrid}>
            <div className={styles.comparisonCardBad}>
              <span className={styles.comparisonBadgeBad}>❌ Traditional Grinding</span>
              <h3 className={styles.comparisonTitle}>The Rote Memorization Trap</h3>
              <ul className={styles.comparisonList}>
                <li className={styles.comparisonItem}>
                  <span className={styles.bulletBad}>✕</span>
                  <span><strong>Solve 400+ problems</strong> but remember less than 15% when interview day arrives.</span>
                </li>
                <li className={styles.comparisonItem}>
                  <span className={styles.bulletBad}>✕</span>
                  <span><strong>Blank out</strong> when an interviewer tweaks constraints or phrases the prompt differently.</span>
                </li>
                <li className={styles.comparisonItem}>
                  <span className={styles.bulletBad}>✕</span>
                  <span><strong>Waste 150+ hours</strong> re-solving the exact same problems you forgot from 2 months ago.</span>
                </li>
                <li className={styles.comparisonItem}>
                  <span className={styles.bulletBad}>✕</span>
                  <span><strong>Manual logging fatigue</strong>: maintaining spreadsheets and Notion sheets breaks your flow.</span>
                </li>
              </ul>
            </div>

            <div className={styles.comparisonCardGood}>
              <span className={styles.comparisonBadgeGood}>✓ The Recall Approach</span>
              <h3 className={styles.comparisonTitle}>Permanent Pattern Intuition</h3>
              <ul className={styles.comparisonList}>
                <li className={styles.comparisonItem}>
                  <span className={styles.bulletGood}>✓</span>
                  <span><strong>Solve 100-150 canonical problems</strong> with 95%+ permanent retention at interview time.</span>
                </li>
                <li className={styles.comparisonItem}>
                  <span className={styles.bulletGood}>✓</span>
                  <span><strong>Pattern checks</strong> challenge you with unseen problems to build flexible algorithmic intuition.</span>
                </li>
                <li className={styles.comparisonItem}>
                  <span className={styles.bulletGood}>✓</span>
                  <span><strong>Micro-revisions in 15 minutes/day</strong>: review only what is mathematically expiring today.</span>
                </li>
                <li className={styles.comparisonItem}>
                  <span className={styles.bulletGood}>✓</span>
                  <span><strong>Instant 1-click capture</strong> directly on LeetCode via the browser extension.</span>
                </li>
              </ul>
            </div>
          </div>
        </section>

        {/* 5. Section 3: Interactive Screenshots Gallery */}
        <section id="screenshots" className={styles.sectionWrapper}>
          <div className={styles.sectionHeader}>
            <span className={styles.sectionEyebrow}>Live Product Tour</span>
            <h2 className={styles.sectionTitle}>See Recall in Action</h2>
            <p className={styles.sectionDesc}>
              Explore how Recall integrates into your daily LeetCode routine from solve capture to interview readiness.
            </p>
          </div>

          <div className={styles.showcaseContainer}>
            {/* Interactive Tabs */}
            <div className={styles.showcaseTabs} role="tablist">
              {SCREENSHOT_TABS.map((tab) => (
                <button
                  key={tab.id}
                  id={`tab-${tab.id}`}
                  role="tab"
                  aria-selected={activeTabId === tab.id}
                  className={`${styles.tabButton} ${activeTabId === tab.id ? styles.tabButtonActive : ''}`}
                  onClick={() => setActiveTabId(tab.id)}
                >
                  {tab.name}
                </button>
              ))}
            </div>

            {/* Showcase Body */}
            <div className={styles.showcaseBody}>
              {/* Left: Device Mockup Frame */}
              <div className={styles.mockupFrame}>
                <div className={styles.mockupHeader}>
                  <span className={`${styles.mockupDot} ${styles.dotRed}`} />
                  <span className={`${styles.mockupDot} ${styles.dotYellow}`} />
                  <span className={`${styles.mockupDot} ${styles.dotGreen}`} />
                  <span className={styles.mockupTitle}>recall.app — {activeTab.name}</span>
                </div>
                <Image
                  src={activeTab.imageSrc}
                  alt={activeTab.title}
                  width={720}
                  height={450}
                  className={styles.mockupImage}
                  priority
                />
              </div>

              {/* Right: Details & Bullets */}
              <div className={styles.showcaseDetails}>
                <span className={styles.showcaseTag}>{activeTab.badge}</span>
                <h3 className={styles.showcaseHeading}>{activeTab.title}</h3>
                <p className={styles.showcaseText}>{activeTab.description}</p>
                <ul className={styles.featureList}>
                  {activeTab.bullets.map((bullet, idx) => (
                    <li key={idx} className={styles.featureItem}>
                      <span className={styles.checkIcon}>✓</span>
                      <span>{bullet}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </section>

        {/* 6. Section 4: How Recall Helps You (4 Steps) */}
        <section id="how-it-helps" className={styles.sectionWrapper}>
          <div className={styles.sectionHeader}>
            <span className={styles.sectionEyebrow}>The 4-Step Loop</span>
            <h2 className={styles.sectionTitle}>How Recall Helps You Prepare</h2>
            <p className={styles.sectionDesc}>
              A frictionless workflow designed to fit right into your active coding interview preparation.
            </p>
          </div>

          <div className={styles.stepsGrid}>
            <div className={styles.stepCard}>
              <div className={styles.stepNumber}>1</div>
              <h3 className={styles.stepTitle}>Solve on LeetCode</h3>
              <p className={styles.stepDesc}>
                Open LeetCode and solve problems as you normally do. The Recall Chrome extension sits quietly in the
                background without interfering with your editor.
              </p>
            </div>

            <div className={styles.stepCard}>
              <div className={styles.stepNumber}>2</div>
              <h3 className={styles.stepTitle}>Auto-Capture on Accepted</h3>
              <p className={styles.stepDesc}>
                The second LeetCode shows "Accepted", Recall slides in an overlay. Select whether you solved without
                hints and rate your confidence (1-5 stars).
              </p>
            </div>

            <div className={styles.stepCard}>
              <div className={styles.stepNumber}>3</div>
              <h3 className={styles.stepTitle}>Smart Spaced Revisions</h3>
              <p className={styles.stepDesc}>
                Recall calculates your next review date using SM-2. When due, revise in 15 minutes. After 2 hint-free
                solves, enjoy fresh pattern substitutions.
              </p>
            </div>

            <div className={styles.stepCard}>
              <div className={styles.stepNumber}>4</div>
              <h3 className={styles.stepTitle}>Track True Readiness</h3>
              <p className={styles.stepDesc}>
                Monitor your interview readiness matrix. Watch weak topics turn green and walk into your FAANG/Tier-1
                interviews with calm, total confidence.
              </p>
            </div>
          </div>
        </section>

        {/* 7. Section 5: The 20 Pattern Bank */}
        <section id="patterns" className={styles.sectionWrapper}>
          <div className={styles.sectionHeader}>
            <span className={styles.sectionEyebrow}>Pattern Taxonomy</span>
            <h2 className={styles.sectionTitle}>Covering All 20 Core DSA Patterns</h2>
            <p className={styles.sectionDesc}>
              Recall's bank contains 820+ verified, non-paywalled benchmark problems balanced across Easy, Medium, and
              Hard tiers.
            </p>
          </div>

          <div className={styles.patternShowcaseGrid}>
            {PATTERN_LIST.map((pattern) => (
              <div key={pattern.name} className={styles.patternPill}>
                <span>{pattern.name}</span>
                <span className={styles.patternPillCount}>{pattern.count} problems</span>
              </div>
            ))}
          </div>
        </section>

        {/* 8. Section 6: Frequently Asked Questions */}
        <section className={styles.sectionWrapper}>
          <div className={styles.sectionHeader}>
            <span className={styles.sectionEyebrow}>Got Questions?</span>
            <h2 className={styles.sectionTitle}>Frequently Asked Questions</h2>
          </div>

          <div className={styles.faqGrid}>
            <div className={styles.faqItem} onClick={() => toggleFaq(0)}>
              <div className={styles.faqQuestion}>
                <span>How is Recall different from NeetCode 150 or Striver’s Sheet?</span>
                <span>{openFaq === 0 ? '−' : '+'}</span>
              </div>
              {openFaq === 0 && (
                <p className={styles.faqAnswer}>
                  Sheets like NeetCode 150 or Striver SDE are static lists of problems — they tell you what to solve, but
                  give you zero support on <em>when</em> to revise. Recall is an active memory retention engine. It tracks
                  your memory decay using SM-2 and periodically substitutes problems with the same pattern to stop rote
                  memorization.
                </p>
              )}
            </div>

            <div className={styles.faqItem} onClick={() => toggleFaq(1)}>
              <div className={styles.faqQuestion}>
                <span>Does the Chrome Extension slow down LeetCode?</span>
                <span>{openFaq === 1 ? '−' : '+'}</span>
              </div>
              {openFaq === 1 && (
                <p className={styles.faqAnswer}>
                  Not at all. The extension runs a lightweight MutationObserver listening exclusively for the submission
                  result dialog. It consumes near-zero CPU and only displays the capture modal upon an "Accepted" verdict.
                </p>
              )}
            </div>

            <div className={styles.faqItem} onClick={() => toggleFaq(2)}>
              <div className={styles.faqQuestion}>
                <span>What happens when I solve a substituted problem?</span>
                <span>{openFaq === 2 ? '−' : '+'}</span>
              </div>
              {openFaq === 2 && (
                <p className={styles.faqAnswer}>
                  When you complete a pattern proxy problem hint-free, Recall automatically advances the schedule of your
                  original problem (e.g. interval expands from 2 days to 5 days). If you struggle or need hints, the
                  interval gracefully resets to 1 day so you can re-solidify the pattern.
                </p>
              )}
            </div>

            <div className={styles.faqItem} onClick={() => toggleFaq(3)}>
              <div className={styles.faqQuestion}>
                <span>Can I use Recall without installing the Chrome Extension?</span>
                <span>{openFaq === 3 ? '−' : '+'}</span>
              </div>
              {openFaq === 3 && (
                <p className={styles.faqAnswer}>
                  Yes! The Recall Web Dashboard includes a manual solve log form (/dashboard/log) where you can paste any
                  LeetCode URL, select confidence and hint usage, and schedule revisions directly.
                </p>
              )}
            </div>

            <div className={styles.faqItem} onClick={() => toggleFaq(4)}>
              <div className={styles.faqQuestion}>
                <span>Is Recall free to use?</span>
                <span>{openFaq === 4 ? '−' : '+'}</span>
              </div>
              {openFaq === 4 && (
                <p className={styles.faqAnswer}>
                  Yes, Recall is completely free and open source. All 820+ benchmark problems in the pattern bank are
                  filtered to ensure they are free (non-paywalled) on LeetCode so anyone can practice without restriction.
                </p>
              )}
            </div>
          </div>
        </section>

        {/* 9. Section 7: Final Call to Action */}
        <section className={styles.sectionWrapper}>
          <div className={styles.finalCtaBox}>
            <h2 className={styles.finalCtaTitle}>Never Blank Out in an Interview Again.</h2>
            <p className={styles.finalCtaDesc}>
              Join software engineers mastering algorithmic patterns with scientific spaced repetition. Start retaining
              your LeetCode solves today.
            </p>
            <div className={styles.heroCtas}>
              <Link href="/login" className={styles.ctaBtnPrimary}>
                Get Started Free →
              </Link>
              <Link href="/dashboard" className={styles.ctaBtnSecondary}>
                Open Web Dashboard
              </Link>
            </div>
          </div>
        </section>
      </main>

      {/* 10. Footer */}
      <footer className={styles.footer}>
        <div className={styles.footerContent}>
          <div className={styles.footerCopyright}>
            © {new Date().getFullYear()} Recall DSA Retention Engine. Built for engineers cracking coding interviews.
          </div>
          <ul className={styles.footerLinks}>
            <li>
              <Link href="/dashboard">Dashboard</Link>
            </li>
            <li>
              <Link href="/dashboard/readiness">Readiness Matrix</Link>
            </li>
            <li>
              <Link href="/dashboard/topics">Topics</Link>
            </li>
            <li>
              <a href="https://github.com/SwastikSrivastava19/Recall" target="_blank" rel="noopener noreferrer">
                GitHub Repository
              </a>
            </li>
          </ul>
        </div>
      </footer>
    </div>
  );
}
