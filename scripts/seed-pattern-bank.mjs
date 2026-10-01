/**
 * Recall Pattern Bank Seeding Pipeline (Step 11)
 * 
 * Sourcing Approach:
 * 1. Primary Source: LeetCode Public GraphQL API (https://leetcode.com/graphql/)
 * 2. Cross-reference: Curated DSA pattern problem sheets (NeetCode 150 / Striver A2Z & SDE / Fraz Sheet)
 *    Only problem slugs/titles are cross-referenced to filter LeetCode's tag space into canonical,
 *    high-quality representative pattern benchmarks (no proprietary writeups copied).
 * 3. Populates `pattern_bank` with 15-20 problems per pattern.
 * 4. Free/Accessible: Filters out paid-only problems so all proxy tests are solvable.
 */

import pg from 'pg';
import dotenv from 'dotenv';
dotenv.config();

const { Pool } = pg;
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

// Canonical problem slugs by pattern from public pattern sheets (NeetCode, Striver, Fraz)
const CURATED_PATTERN_SLUGS = {
  'sliding-window': [
    'longest-substring-without-repeating-characters',
    'longest-repeating-character-replacement',
    'permutation-in-string',
    'minimum-window-substring',
    'sliding-window-maximum',
    'minimum-size-subarray-sum',
    'fruit-into-baskets',
    'max-consecutive-ones-iii',
    'binary-subarrays-with-sum',
    'count-number-of-nice-subarrays',
    'subarrays-with-k-different-integers',
    'find-all-anagrams-in-a-string',
    'contains-duplicate-ii',
    'maximum-points-you-can-obtain-from-cards',
    'repeated-dna-sequences',
    'grumpy-bookstore-owner',
    'longest-turbulent-subarray',
    'frequency-of-the-most-frequent-element',
  ],
  'two-pointers': [
    'valid-palindrome',
    'two-sum-ii-input-array-is-sorted',
    '3sum',
    '4sum',
    'container-with-most-water',
    'trapping-rain-water',
    'remove-duplicates-from-sorted-array',
    'move-zeroes',
    'sort-colors',
    'squares-of-a-sorted-array',
    'rotate-array',
    'boats-to-save-people',
    'backspace-string-compare',
    'valid-palindrome-ii',
    'reverse-string',
    'reverse-vowels-of-a-string',
    'partition-labels',
    'interval-list-intersections',
  ],
  'binary-search': [
    'binary-search',
    'search-a-2d-matrix',
    'koko-eating-bananas',
    'find-minimum-in-rotated-sorted-array',
    'search-in-rotated-sorted-array',
    'time-based-key-value-store',
    'median-of-two-sorted-arrays',
    'find-peak-element',
    'search-insert-position',
    'find-first-and-last-position-of-element-in-sorted-array',
    'single-element-in-a-sorted-array',
    'capacity-to-ship-packages-within-d-days',
    'split-array-largest-sum',
    'peak-index-in-a-mountain-array',
    'sqrtx',
    'first-bad-version',
    'guess-number-higher-or-lower',
    'arranging-coins',
  ],
  'dp-knapsack': [
    'partition-equal-subset-sum',
    'target-sum',
    'coin-change',
    'coin-change-ii',
    'ones-and-zeroes',
    'last-stone-weight-ii',
    'combination-sum-iv',
    'perfect-squares',
    'minimum-cost-for-tickets',
    '2-keys-keyboard',
    'soup-servings',
    'profitable-schemes',
    'count-ways-to-build-good-strings',
    'uncrossed-lines',
    'number-of-dice-rolls-with-target-sum',
    'partition-array-into-two-arrays-to-minimize-sum-difference',
  ],
  'dp-lis': [
    'longest-increasing-subsequence',
    'russian-doll-envelopes',
    'number-of-longest-increasing-subsequence',
    'maximum-length-of-pair-chain',
    'increasing-triplet-subsequence',
    'largest-divisible-subset',
    'longest-string-chain',
    'build-array-where-you-can-find-the-maximum-exactly-k-comparisons',
    'make-array-strictly-increasing',
    'minimum-number-of-removals-to-make-mountain-array',
    'find-the-longest-valid-obstacle-course-at-each-position',
    'delete-and-earn',
    'longest-arithmetic-subsequence',
    'longest-arithmetic-subsequence-of-given-difference',
    'maximum-height-by-stacking-cuboids',
  ],
  'graph-bfs': [
    'word-ladder',
    'rotting-oranges',
    'shortest-path-in-binary-matrix',
    'open-the-lock',
    'minimum-genetic-mutation',
    'snakes-and-ladders',
    '01-matrix',
    'as-far-from-land-as-possible',
    'shortest-bridge',
    'bus-routes',
    'nearest-exit-from-entrance-in-maze',
    'reorder-routes-to-make-all-paths-lead-to-the-city-zero',
    'cut-off-trees-for-golf-event',
    'jump-game-iv',
    'shortest-path-to-get-all-keys',
    'map-of-highest-peak',
  ],
  'graph-dfs': [
    'number-of-islands',
    'max-area-of-island',
    'clone-graph',
    'course-schedule',
    'course-schedule-ii',
    'pacific-atlantic-water-flow',
    'surrounded-regions',
    'number-of-provinces',
    'all-paths-from-source-to-target',
    'is-graph-bipartite',
    'find-eventual-safe-states',
    'reconstruct-itinerary',
    'redundant-connection',
    'network-delay-time',
    'critical-connections-in-a-network',
    'accounts-merge',
    'keys-and-rooms',
  ],
  'backtracking': [
    'subsets',
    'subsets-ii',
    'combination-sum',
    'combination-sum-ii',
    'permutations',
    'permutations-ii',
    'palindrome-partitioning',
    'word-search',
    'n-queens',
    'sudoku-solver',
    'letter-combinations-of-a-phone-number',
    'generate-parentheses',
    'restore-ip-addresses',
    'matchsticks-to-square',
    'partition-to-k-equal-sum-subsets',
    'beautiful-arrangement',
    'combinations',
  ],
  'greedy-intervals': [
    'merge-intervals',
    'insert-interval',
    'non-overlapping-intervals',
    'minimum-number-of-arrows-to-burst-balloons',
    'interval-list-intersections',
    'remove-covered-intervals',
    'car-pooling',
    'my-calendar-i',
    'my-calendar-ii',
    'video-stitching',
    'divide-intervals-into-minimum-number-of-groups',
    'data-stream-as-disjoint-intervals',
    'maximum-number-of-events-that-can-be-attended',
    'meeting-scheduler',
    'teemo-attacking',
    'summary-ranges',
  ],
  'heap-topk': [
    'kth-largest-element-in-an-array',
    'top-k-frequent-elements',
    'find-median-from-data-stream',
    'k-closest-points-to-origin',
    'task-scheduler',
    'last-stone-weight',
    'reorganize-string',
    'merge-k-sorted-lists',
    'kth-largest-element-in-a-stream',
    'maximum-subsequence-score',
    'single-threaded-cpu',
    'sort-characters-by-frequency',
    'furthest-building-you-can-reach',
    'ipo',
    'find-k-pairs-with-smallest-sums',
    'ugly-number-ii',
  ],
  'tree-traversal': [
    'invert-binary-tree',
    'maximum-depth-of-binary-tree',
    'diameter-of-binary-tree',
    'balanced-binary-tree',
    'same-tree',
    'subtree-of-another-tree',
    'lowest-common-ancestor-of-a-binary-search-tree',
    'binary-tree-level-order-traversal',
    'binary-tree-right-side-view',
    'count-good-nodes-in-binary-tree',
    'validate-binary-search-tree',
    'kth-smallest-element-in-a-bst',
    'construct-binary-tree-from-preorder-and-inorder-traversal',
    'binary-tree-maximum-path-sum',
    'serialize-and-deserialize-binary-tree',
    'path-sum',
  ],
  'monotonic-stack': [
    'daily-temperatures',
    'next-greater-element-i',
    'next-greater-element-ii',
    'online-stock-span',
    'largest-rectangle-in-histogram',
    'trapping-rain-water',
    '132-pattern',
    'sum-of-subarray-minimums',
    'asteroid-collision',
    'remove-k-digits',
    'maximal-rectangle',
    'car-fleet',
    'remove-duplicate-letters',
    'final-prices-with-a-special-discount-in-a-shop',
    'sum-of-subarray-ranges',
  ],
  'linked-list-fast-slow': [
    'linked-list-cycle',
    'linked-list-cycle-ii',
    'middle-of-the-linked-list',
    'reorder-list',
    'palindrome-linked-list',
    'remove-nth-node-from-end-of-list',
    'find-the-duplicate-number',
    'rotate-list',
    'reverse-linked-list',
    'reverse-linked-list-ii',
    'merge-two-sorted-lists',
    'swap-nodes-in-pairs',
    'odd-even-linked-list',
    'delete-node-in-a-linked-list',
  ],
  'trie': [
    'implement-trie-prefix-tree',
    'design-add-and-search-words-data-structure',
    'word-search-ii',
    'replace-words',
    'extra-characters-in-a-string',
    'longest-common-prefix',
    'maximum-xor-of-two-numbers-in-an-array',
    'concatenated-words',
    'map-sum-pairs',
    'index-pairs-of-a-string',
    'search-suggestions-system',
    'stream-of-characters',
    'palindrome-pairs',
    'word-break',
  ],
};

// LeetCode tag mappings to enhance or supplement coverage
const LC_TAG_SEARCHES = {
  'sliding-window': 'sliding-window',
  'two-pointers': 'two-pointers',
  'binary-search': 'binary-search',
  'dp-knapsack': 'dynamic-programming',
  'dp-lis': 'dynamic-programming',
  'graph-bfs': 'breadth-first-search',
  'graph-dfs': 'depth-first-search',
  'backtracking': 'backtracking',
  'greedy-intervals': 'greedy',
  'heap-topk': 'heap-priority-queue',
  'tree-traversal': 'tree',
  'monotonic-stack': 'monotonic-stack',
  'linked-list-fast-slow': 'linked-list',
  'trie': 'trie',
};

async function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Fetch single question details from LeetCode GraphQL
async function fetchQuestionBySlug(titleSlug) {
  const query = `
    query getQuestionDetail($titleSlug: String!) {
      question(titleSlug: $titleSlug) {
        questionId
        questionFrontendId
        title
        titleSlug
        difficulty
        paidOnly: isPaidOnly
        topicTags {
          name
          slug
        }
      }
    }
  `;

  try {
    const res = await fetch('https://leetcode.com/graphql/', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        Referer: `https://leetcode.com/problems/${titleSlug}/`,
      },
      body: JSON.stringify({ query, variables: { titleSlug } }),
    });

    if (!res.ok) {
      return { error: `HTTP ${res.status}` };
    }

    const json = await res.json();
    return json.data?.question || null;
  } catch (err) {
    return { error: err.message };
  }
}

// Fetch problem list by tag from LeetCode GraphQL
async function fetchQuestionsByTag(tagSlug, limit = 50) {
  const query = `
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
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        Referer: 'https://leetcode.com/problemset/all/',
      },
      body: JSON.stringify({
        query,
        variables: {
          categorySlug: '',
          skip: 0,
          limit,
          filters: { tags: [tagSlug] },
        },
      }),
    });

    if (!res.ok) {
      return { error: `HTTP ${res.status}` };
    }

    const json = await res.json();
    return json.data?.problemsetQuestionList?.questions || [];
  } catch (err) {
    return { error: err.message };
  }
}

async function runSeed() {
  console.log('========================================================');
  console.log('RECALL PATTERN BANK SEEDING PIPELINE');
  console.log('Primary Source: LeetCode GraphQL API');
  console.log('Cross-reference: NeetCode / Striver / Fraz Pattern Sheets');
  console.log('========================================================\n');

  let totalInserted = 0;
  let totalErrors = 0;
  const patternCounts = {};

  const patterns = Object.keys(CURATED_PATTERN_SLUGS);

  for (const pattern of patterns) {
    console.log(`\n[Pattern: ${pattern}] Processing curated benchmark list...`);
    patternCounts[pattern] = 0;
    const curatedSlugs = CURATED_PATTERN_SLUGS[pattern];
    const candidateMap = new Map();

    // 1. Fetch each curated problem via LeetCode GraphQL
    for (const slug of curatedSlugs) {
      await sleep(120); // polite rate limit spacing
      const q = await fetchQuestionBySlug(slug);

      if (q && !q.error) {
        if (!q.paidOnly) {
          candidateMap.set(slug, {
            name: q.title,
            link: `https://leetcode.com/problems/${q.titleSlug}/`,
            pattern_tag: pattern,
            difficulty: q.difficulty.toLowerCase(),
            is_curated: true,
          });
        } else {
          console.log(`  - Skipped paid-only problem: "${slug}"`);
        }
      } else if (q?.error) {
        console.warn(`  ⚠️ LeetCode API notice for "${slug}": ${q.error}`);
        totalErrors++;
      }
    }

    // 2. If candidates < 15, supplement from LeetCode GraphQL by tag
    if (candidateMap.size < 15 && LC_TAG_SEARCHES[pattern]) {
      console.log(`  Candidate count (${candidateMap.size}) < 15. Supplementing from LeetCode tag "${LC_TAG_SEARCHES[pattern]}"...`);
      const lcQuestions = await fetchQuestionsByTag(LC_TAG_SEARCHES[pattern], 40);

      if (Array.isArray(lcQuestions)) {
        for (const item of lcQuestions) {
          if (candidateMap.size >= 20) break;
          if (!item.paidOnly && !candidateMap.has(item.titleSlug)) {
            candidateMap.set(item.titleSlug, {
              name: item.title,
              link: `https://leetcode.com/problems/${item.titleSlug}/`,
              pattern_tag: pattern,
              difficulty: item.difficulty.toLowerCase(),
              is_curated: false, // from LeetCode tag search
            });
          }
        }
      }
    }

    console.log(`  Found ${candidateMap.size} verified problems for pattern "${pattern}". Storing in database...`);

    // 3. Batch upsert into database
    for (const [slug, item] of candidateMap.entries()) {
      try {
        await pool.query(
          `INSERT INTO public.pattern_bank (name, link, pattern_tag, difficulty, is_curated)
           VALUES ($1, $2, $3, $4, $5)
           ON CONFLICT (link) DO UPDATE SET
             name = EXCLUDED.name,
             pattern_tag = EXCLUDED.pattern_tag,
             difficulty = EXCLUDED.difficulty,
             is_curated = EXCLUDED.is_curated;`,
          [item.name, item.link, item.pattern_tag, item.difficulty, item.is_curated]
        );
        patternCounts[pattern]++;
        totalInserted++;
      } catch (dbErr) {
        console.error(`  ❌ Database insert error for ${item.name}:`, dbErr.message);
      }
    }

    console.log(`  ✓ Pattern "${pattern}": ${patternCounts[pattern]} problems stored.`);
  }

  console.log('\n========================================================');
  console.log('PATTERN BANK SEEDING SUMMARY');
  console.log('========================================================');
  console.log(`Total Problems Stored: ${totalInserted}`);
  console.log('Breakdown by Pattern:');
  for (const [pat, count] of Object.entries(patternCounts)) {
    console.log(`  - ${pat.padEnd(24)}: ${count} problems`);
  }

  // Verification query
  const res = await pool.query(`
    SELECT pattern_tag, difficulty, count(*) as count 
    FROM public.pattern_bank 
    GROUP BY pattern_tag, difficulty 
    ORDER BY pattern_tag, difficulty;
  `);
  console.log('\nDatabase Verification Table:');
  console.table(res.rows);

  await pool.end();
  console.log('\nSeeding completed successfully!');
}

runSeed().catch((err) => {
  console.error('\nFatal seeding error:', err);
  process.exit(1);
});
