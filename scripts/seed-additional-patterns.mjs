/**
 * Seed Additional DSA Patterns into Pattern Bank
 * Covers: union-find, prefix-sum, bit-manipulation, trees-bfs, trees-dfs, linked-list
 */

import pg from 'pg';
import dotenv from 'dotenv';
dotenv.config();

const { Pool } = pg;
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

const ADDITIONAL_PATTERNS = {
  'union-find': [
    'redundant-connection',
    'number-of-provinces',
    'accounts-merge',
    'is-graph-bipartite',
    'satisfiability-of-equality-equations',
    'number-of-operations-to-make-network-connected',
    'smallest-string-with-swaps',
    'most-stones-removed-with-same-row-or-column',
    'remove-max-number-of-edges-to-keep-graph-fully-traversable',
    'regions-cut-by-slashes',
    'surrounded-regions',
    'swim-in-rising-water',
    'making-a-large-island',
    'min-cost-to-connect-all-points',
    'find-all-people-with-secret',
    'longest-consecutive-sequence',
    'lexicographically-smallest-equivalent-string',
  ],
  'prefix-sum': [
    'subarray-sum-equals-k',
    'range-sum-query-immutable',
    'range-sum-query-2d-immutable',
    'continuous-subarray-sum',
    'contiguous-array',
    'product-of-array-except-self',
    'find-pivot-index',
    'subarray-sums-divisible-by-k',
    'minimum-value-to-get-positive-step-by-step-sum',
    'random-pick-with-weight',
    'matrix-block-sum',
    'running-sum-of-1d-array',
    'binary-subarrays-with-sum',
    'count-number-of-nice-subarrays',
    'find-the-middle-index-in-array',
    'shifting-letters',
    'car-pooling',
  ],
  'bit-manipulation': [
    'single-number',
    'number-of-1-bits',
    'counting-bits',
    'reverse-bits',
    'missing-number',
    'sum-of-two-integers',
    'single-number-ii',
    'single-number-iii',
    'bitwise-and-of-numbers-range',
    'power-of-two',
    'minimum-flips-to-make-a-or-b-equal-to-c',
    'maximum-product-of-word-lengths',
    'find-the-difference',
    'subsets',
    'power-of-four',
    'add-binary',
    'decode-xored-array',
  ],
  'trees-bfs': [
    'binary-tree-level-order-traversal',
    'binary-tree-level-order-traversal-ii',
    'binary-tree-zigzag-level-order-traversal',
    'binary-tree-right-side-view',
    'populating-next-right-pointers-in-each-node',
    'populating-next-right-pointers-in-each-node-ii',
    'deepest-leaves-sum',
    'maximum-width-of-binary-tree',
    'minimum-depth-of-binary-tree',
    'find-largest-value-in-each-tree-row',
    'all-nodes-distance-k-in-binary-tree',
    'even-odd-tree',
    'average-of-levels-in-binary-tree',
    'n-ary-tree-level-order-traversal',
    'cousins-in-binary-tree',
    'maximum-level-sum-of-a-binary-tree',
  ],
  'trees-dfs': [
    'maximum-depth-of-binary-tree',
    'diameter-of-binary-tree',
    'balanced-binary-tree',
    'same-tree',
    'invert-binary-tree',
    'lowest-common-ancestor-of-a-binary-tree',
    'binary-tree-maximum-path-sum',
    'path-sum',
    'path-sum-ii',
    'path-sum-iii',
    'subtree-of-another-tree',
    'validate-binary-search-tree',
    'flatten-binary-tree-to-linked-list',
    'construct-binary-tree-from-preorder-and-inorder-traversal',
    'symmetric-tree',
    'kth-smallest-element-in-a-bst',
    'sum-root-to-leaf-numbers',
  ],
  'linked-list': [
    'reverse-linked-list',
    'merge-two-sorted-lists',
    'remove-nth-node-from-end-of-list',
    'reorder-list',
    'add-two-numbers',
    'copy-list-with-random-pointer',
    'reverse-nodes-in-k-group',
    'sort-list',
    'palindrome-linked-list',
    'remove-duplicates-from-sorted-list',
    'remove-duplicates-from-sorted-list-ii',
    'partition-list',
    'swap-nodes-in-pairs',
    'rotate-list',
    'odd-even-linked-list',
    'delete-node-in-a-linked-list',
    'intersection-of-two-linked-lists',
  ],
};

const LC_TAG_SEARCHES = {
  'union-find': 'union-find',
  'prefix-sum': 'prefix-sum',
  'bit-manipulation': 'bit-manipulation',
  'trees-bfs': 'breadth-first-search',
  'trees-dfs': 'depth-first-search',
  'linked-list': 'linked-list',
};

async function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchQuestionBySlug(titleSlug) {
  const query = `
    query getQuestionDetail($titleSlug: String!) {
      question(titleSlug: $titleSlug) {
        title
        titleSlug
        difficulty
        paidOnly: isPaidOnly
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

    if (!res.ok) return { error: `HTTP ${res.status}` };
    const json = await res.json();
    return json.data?.question || null;
  } catch (err) {
    return { error: err.message };
  }
}

async function fetchQuestionsByTag(tagSlug, limit = 40) {
  const query = `
    query problemsetQuestionList($categorySlug: String, $limit: Int, $skip: Int, $filters: QuestionListFilterInput) {
      problemsetQuestionList: questionList(categorySlug: $categorySlug, limit: $limit, skip: $skip, filters: $filters) {
        questions: data {
          title
          titleSlug
          difficulty
          paidOnly: isPaidOnly
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
        variables: { categorySlug: '', skip: 0, limit, filters: { tags: [tagSlug] } },
      }),
    });

    if (!res.ok) return [];
    const json = await res.json();
    return json.data?.problemsetQuestionList?.questions || [];
  } catch (err) {
    return [];
  }
}

async function seedAdditional() {
  console.log('Seeding additional gap patterns into pattern_bank...');
  let totalInserted = 0;

  for (const [pattern, slugs] of Object.entries(ADDITIONAL_PATTERNS)) {
    console.log(`\n[Pattern: ${pattern}] Fetching canonical benchmarks...`);
    const candidateMap = new Map();

    for (const slug of slugs) {
      await sleep(100);
      const q = await fetchQuestionBySlug(slug);
      if (q && !q.error && !q.paidOnly) {
        candidateMap.set(slug, {
          name: q.title,
          link: `https://leetcode.com/problems/${q.titleSlug}/`,
          pattern_tag: pattern,
          difficulty: q.difficulty.toLowerCase(),
          is_curated: true,
        });
      }
    }

    if (candidateMap.size < 15 && LC_TAG_SEARCHES[pattern]) {
      console.log(`  Candidate count (${candidateMap.size}) < 15. Supplementing from tag "${LC_TAG_SEARCHES[pattern]}"...`);
      const lcItems = await fetchQuestionsByTag(LC_TAG_SEARCHES[pattern], 40);
      for (const item of lcItems) {
        if (candidateMap.size >= 18) break;
        if (!item.paidOnly && !candidateMap.has(item.titleSlug)) {
          candidateMap.set(item.titleSlug, {
            name: item.title,
            link: `https://leetcode.com/problems/${item.titleSlug}/`,
            pattern_tag: pattern,
            difficulty: item.difficulty.toLowerCase(),
            is_curated: false,
          });
        }
      }
    }

    console.log(`  Found ${candidateMap.size} verified problems for "${pattern}". Upserting into DB...`);
    for (const [slug, item] of candidateMap.entries()) {
      await pool.query(
        `INSERT INTO public.pattern_bank (name, link, pattern_tag, difficulty, is_curated)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (link) DO UPDATE SET
           pattern_tag = EXCLUDED.pattern_tag,
           difficulty = EXCLUDED.difficulty,
           name = EXCLUDED.name;`,
        [item.name, item.link, item.pattern_tag, item.difficulty, item.is_curated]
      );
      totalInserted++;
    }
    console.log(`  ✓ Pattern "${pattern}": ${candidateMap.size} stored.`);
  }

  console.log(`\nFinished inserting ${totalInserted} problems.`);
  await pool.end();
}

seedAdditional().catch((e) => {
  console.error(e);
  process.exit(1);
});
