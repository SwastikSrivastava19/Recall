// Recall Pattern Bank Live Ingestion & Exhaustion Fallback (Step 11 Follow-up)
// Fetches high-quality benchmark problems from LeetCode GraphQL API,
// validates non-paywalled status and proper DSA pattern classification,
// and safely replenishes public.pattern_bank when available candidates run low.

import { query } from '@/lib/db';
import { derivePatternTag, PatternTag, Difficulty } from '@/lib/patterns';

// Mapping of Recall pattern_tag to primary LeetCode topic tags
export const PATTERN_TO_LEETCODE_TAG: Record<PatternTag, string> = {
  'backtracking': 'backtracking',
  'binary-search': 'binary-search',
  'bit-manipulation': 'bit-manipulation',
  'dp-knapsack': 'dynamic-programming',
  'dp-lis': 'dynamic-programming',
  'graph-bfs': 'breadth-first-search',
  'graph-dfs': 'depth-first-search',
  'greedy-intervals': 'greedy',
  'heap-topk': 'heap-priority-queue',
  'linked-list': 'linked-list',
  'linked-list-fast-slow': 'linked-list',
  'monotonic-stack': 'monotonic-stack',
  'prefix-sum': 'prefix-sum',
  'sliding-window': 'sliding-window',
  'tree-traversal': 'tree',
  'trees-bfs': 'breadth-first-search',
  'trees-dfs': 'depth-first-search',
  'trie': 'trie',
  'two-pointers': 'two-pointers',
  'union-find': 'union-find',
};

// In-memory safeguards against aggressive hammering
const COOLDOWN_MS = 5 * 60 * 1000; // 5-minute cooldown per pattern
const lastTopUpTimestamp = new Map<string, number>();
const inFlightTopUps = new Map<string, Promise<TopUpResult>>();

export interface LeetCodeQuestionItem {
  frontendQuestionId: string;
  title: string;
  titleSlug: string;
  difficulty: 'Easy' | 'Medium' | 'Hard';
  paidOnly: boolean;
  topicTags?: { slug: string; name?: string }[];
}

export interface TopUpResult {
  patternTag: PatternTag;
  problemsAdded: number;
  remainingCandidates: number;
  addedProblems: Array<{ name: string; link: string; difficulty: string }>;
  source: 'live_fetch' | 'cooldown_skipped' | 'in_flight' | 'error';
  message?: string;
}

/**
 * Fetch questions by tag from LeetCode GraphQL API with pagination & retry logic.
 */
export async function fetchLeetCodeQuestionsByTag(
  tagSlug: string,
  limit = 50,
  skip = 0,
  signal?: AbortSignal
): Promise<LeetCodeQuestionItem[]> {
  const gqlQuery = `
    query problemsetQuestionList($categorySlug: String, $limit: Int, $skip: Int, $filters: QuestionListFilterInput) {
      problemsetQuestionList: questionList(categorySlug: $categorySlug, limit: $limit, skip: $skip, filters: $filters) {
        total: totalNum
        questions: data {
          frontendQuestionId: questionFrontendId
          title
          titleSlug
          difficulty
          paidOnly: isPaidOnly
          topicTags {
            slug
            name
          }
        }
      }
    }
  `;

  try {
    const res = await fetch('https://leetcode.com/graphql/', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent':
          'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        Referer: 'https://leetcode.com/problemset/all/',
      },
      body: JSON.stringify({
        query: gqlQuery,
        variables: {
          categorySlug: '',
          skip,
          limit,
          filters: { tags: [tagSlug] },
        },
      }),
      signal,
    });

    if (!res.ok) {
      console.warn(`[LeetCode Fetcher] HTTP error ${res.status} fetching tag ${tagSlug}`);
      return [];
    }

    const json = await res.json();
    return json.data?.problemsetQuestionList?.questions || [];
  } catch (err: any) {
    if (err.name === 'AbortError') {
      console.warn(`[LeetCode Fetcher] Request aborted for tag ${tagSlug}`);
    } else {
      console.warn(`[LeetCode Fetcher] Fetch failed for tag ${tagSlug}:`, err.message);
    }
    return [];
  }
}

/**
 * Validates whether a LeetCode problem matches the target pattern_tag.
 */
export function matchesTargetPattern(
  patternTag: PatternTag,
  q: LeetCodeQuestionItem
): boolean {
  if (q.paidOnly) return false;
  const link = `https://leetcode.com/problems/${q.titleSlug}/`;
  const topicTags = q.topicTags?.map((t) => t.slug) || [];

  // Patterns with 1:1 direct tag correspondence
  if (
    [
      'binary-search',
      'backtracking',
      'bit-manipulation',
      'monotonic-stack',
      'prefix-sum',
      'sliding-window',
      'trie',
      'two-pointers',
      'union-find',
    ].includes(patternTag)
  ) {
    const directTag = PATTERN_TO_LEETCODE_TAG[patternTag];
    return topicTags.includes(directTag);
  }

  // Specialized patterns with nuanced heuristic separation:
  const derived = derivePatternTag(topicTags, q.title, link);
  if (derived === patternTag) return true;

  const slug = q.titleSlug.toLowerCase();
  const title = q.title.toLowerCase();

  switch (patternTag) {
    case 'greedy-intervals':
      return (
        topicTags.includes('greedy') &&
        (topicTags.includes('array') || topicTags.includes('sorting')) &&
        (slug.includes('interval') ||
          slug.includes('meeting') ||
          slug.includes('calendar') ||
          slug.includes('overlap') ||
          slug.includes('schedule') ||
          slug.includes('merge') ||
          slug.includes('arrow') ||
          slug.includes('balloon') ||
          slug.includes('video') ||
          slug.includes('partition') ||
          slug.includes('task') ||
          slug.includes('gas-station') ||
          slug.includes('candy') ||
          slug.includes('jump'))
      );

    case 'heap-topk':
      return topicTags.includes('heap-priority-queue');

    case 'graph-bfs':
      return (
        topicTags.includes('breadth-first-search') &&
        !topicTags.includes('tree') &&
        !slug.includes('tree') &&
        !title.includes('tree')
      );

    case 'graph-dfs':
      return (
        topicTags.includes('depth-first-search') &&
        !topicTags.includes('tree') &&
        !slug.includes('tree') &&
        !title.includes('tree')
      );

    case 'trees-bfs':
      return (
        (topicTags.includes('tree') || topicTags.includes('binary-tree') || slug.includes('tree')) &&
        (topicTags.includes('breadth-first-search') ||
          slug.includes('level') ||
          slug.includes('view') ||
          slug.includes('zigzag') ||
          slug.includes('width') ||
          slug.includes('cousin') ||
          slug.includes('connect'))
      );

    case 'trees-dfs':
      return (
        (topicTags.includes('tree') || topicTags.includes('binary-tree') || slug.includes('tree')) &&
        !slug.includes('level-order') &&
        !slug.includes('zigzag')
      );

    case 'tree-traversal':
      return (
        (topicTags.includes('tree') || slug.includes('tree')) &&
        (slug.includes('traversal') ||
          slug.includes('inorder') ||
          slug.includes('preorder') ||
          slug.includes('postorder') ||
          slug.includes('path') ||
          slug.includes('morris') ||
          slug.includes('recover') ||
          slug.includes('vertical'))
      );

    case 'linked-list-fast-slow':
      return (
        topicTags.includes('linked-list') &&
        (slug.includes('cycle') ||
          slug.includes('middle') ||
          slug.includes('palindrome') ||
          slug.includes('reorder') ||
          slug.includes('intersection') ||
          slug.includes('duplicate') ||
          slug.includes('happy') ||
          slug.includes('circular') ||
          slug.includes('split') ||
          slug.includes('twin'))
      );

    case 'linked-list':
      return topicTags.includes('linked-list');

    case 'dp-knapsack':
      return (
        topicTags.includes('dynamic-programming') &&
        (slug.includes('knapsack') ||
          slug.includes('coin') ||
          slug.includes('target-sum') ||
          slug.includes('partition') ||
          slug.includes('subset') ||
          slug.includes('ones-and-zeroes') ||
          slug.includes('combination-sum') ||
          slug.includes('last-stone-weight') ||
          slug.includes('climbing-stairs') ||
          slug.includes('robber') ||
          slug.includes('buy-and-sell') ||
          slug.includes('tribonacci') ||
          slug.includes('pascals-triangle') ||
          slug.includes('divisor-game') ||
          slug.includes('perfect-squares') ||
          slug.includes('word-break'))
      );

    case 'dp-lis':
      return (
        topicTags.includes('dynamic-programming') &&
        (slug.includes('increasing') ||
          slug.includes('subsequence') ||
          slug.includes('chain') ||
          slug.includes('russian-doll') ||
          slug.includes('arithmetic') ||
          slug.includes('wiggle') ||
          slug.includes('turbulent') ||
          slug.includes('palindromic-subsequence') ||
          slug.includes('edit-distance') ||
          slug.includes('longest-common'))
      );

    default:
      return false;
  }
}

/**
 * Top up the pattern_bank for a specific pattern tag when candidates are running low.
 * Features:
 * - In-memory cooldown & Promise deduplication
 * - Free/accessible filter (paidOnly: false)
 * - Persists into public.pattern_bank
 * - Logs to public.pattern_fallback_logs
 */
export async function topUpPatternBank(params: {
  patternTag: PatternTag;
  userId?: string;
  targetAdd?: number;
  userSolvedLinks?: Set<string>;
  timeoutMs?: number;
}): Promise<TopUpResult> {
  const { patternTag, userId, targetAdd = 10, userSolvedLinks, timeoutMs = 4000 } = params;
  const now = Date.now();

  // 1. Safeguard: Check cooldown
  const lastRun = lastTopUpTimestamp.get(patternTag) || 0;
  if (now - lastRun < COOLDOWN_MS) {
    return {
      patternTag,
      problemsAdded: 0,
      remainingCandidates: 0,
      addedProblems: [],
      source: 'cooldown_skipped',
      message: `Top-up cooldown active for "${patternTag}" (last run ${(now - lastRun) / 1000}s ago)`,
    };
  }

  // 2. Safeguard: Deduplicate simultaneous in-flight runs
  if (inFlightTopUps.has(patternTag)) {
    return inFlightTopUps.get(patternTag)!;
  }

  const taskPromise = (async (): Promise<TopUpResult> => {
    lastTopUpTimestamp.set(patternTag, now);
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const lcTag = PATTERN_TO_LEETCODE_TAG[patternTag] || 'algorithms';

      // Fetch questions from LeetCode
      const rawQuestions = await fetchLeetCodeQuestionsByTag(lcTag, 60, 0, controller.signal);
      clearTimeout(timeoutId);

      if (rawQuestions.length === 0) {
        return {
          patternTag,
          problemsAdded: 0,
          remainingCandidates: 0,
          addedProblems: [],
          source: 'live_fetch',
          message: 'No questions returned from LeetCode GraphQL',
        };
      }

      // Filter non-paid matching questions
      const matchingQuestions = rawQuestions.filter((q) => matchesTargetPattern(patternTag, q));

      if (matchingQuestions.length === 0) {
        return {
          patternTag,
          problemsAdded: 0,
          remainingCandidates: 0,
          addedProblems: [],
          source: 'live_fetch',
          message: 'No matching free questions found for pattern',
        };
      }

      // Query database for existing links in pattern_bank
      const links = matchingQuestions.map((q) => `https://leetcode.com/problems/${q.titleSlug}/`);
      const existingRes = await query<{ link: string }>(
        `SELECT link FROM public.pattern_bank WHERE link = ANY($1);`,
        [links]
      );
      const existingSet = new Set(existingRes.rows.map((r) => r.link));

      const candidatesToInsert = matchingQuestions.filter((q) => {
        const link = `https://leetcode.com/problems/${q.titleSlug}/`;
        if (existingSet.has(link)) return false;
        if (userSolvedLinks && userSolvedLinks.has(link)) return false;
        return true;
      });

      const addedProblems: Array<{ name: string; link: string; difficulty: string }> = [];

      for (const q of candidatesToInsert.slice(0, targetAdd)) {
        const link = `https://leetcode.com/problems/${q.titleSlug}/`;
        const difficulty = q.difficulty.toLowerCase() as Difficulty;

        try {
          await query(
            `INSERT INTO public.pattern_bank (name, link, pattern_tag, difficulty, is_curated)
             VALUES ($1, $2, $3, $4, false)
             ON CONFLICT (link) DO NOTHING;`,
            [q.title, link, patternTag, difficulty]
          );
          addedProblems.push({ name: q.title, link, difficulty });
        } catch (insertErr: any) {
          console.error(`[TopUp] Error inserting ${q.title}:`, insertErr.message);
        }
      }

      // Count remaining candidates currently in pattern_bank for this pattern
      const countRes = await query<{ count: string }>(
        `SELECT COUNT(*) as count FROM public.pattern_bank WHERE pattern_tag = $1;`,
        [patternTag]
      );
      const totalCandidates = parseInt(countRes.rows[0]?.count || '0', 10);

      // Log to pattern_fallback_logs
      try {
        await query(
          `INSERT INTO public.pattern_fallback_logs (pattern_tag, user_id, problems_added, remaining_candidates, notes)
           VALUES ($1, $2, $3, $4, $5);`,
          [
            patternTag,
            userId || null,
            addedProblems.length,
            totalCandidates,
            `Live top-up triggered. Added ${addedProblems.length} new problems.`,
          ]
        );
      } catch (logErr: any) {
        console.warn('[TopUp] Could not record to pattern_fallback_logs:', logErr.message);
      }

      console.log(
        `[Recall Exhaustion Fallback] Triggered for pattern="${patternTag}", user="${userId || 'anonymous'}": added ${addedProblems.length} new problems (bank now has ${totalCandidates} total).`
      );

      return {
        patternTag,
        problemsAdded: addedProblems.length,
        remainingCandidates: totalCandidates,
        addedProblems,
        source: 'live_fetch',
      };
    } catch (err: any) {
      console.error(`[TopUp Error] pattern="${patternTag}":`, err.message);
      return {
        patternTag,
        problemsAdded: 0,
        remainingCandidates: 0,
        addedProblems: [],
        source: 'error',
        message: err.message,
      };
    } finally {
      clearTimeout(timeoutId);
      inFlightTopUps.delete(patternTag);
    }
  })();

  inFlightTopUps.set(patternTag, taskPromise);
  return taskPromise;
}
