/**
 * Finish Seeding All Remaining Patterns to reach 40-45 per pattern
 * Targets: graph-dfs, trees-bfs, trees-dfs, linked-list-fast-slow, two-pointers, graph-bfs
 */

import pg from 'pg';
import dotenv from 'dotenv';
dotenv.config();

const { Pool } = pg;
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

const TARGET_CANDIDATES = {
  'graph-dfs': [
    'find-eventual-safe-states',
    'minesweeper',
    'battleships-in-a-board',
    'reconstruct-itinerary',
    'critical-connections-in-a-network',
    'concatenated-words',
    'contain-virus',
    'couples-holding-hands',
    'cracking-the-safe',
    'course-schedule-iii',
    'frog-position-after-t-seconds',
    'count-sub-islands',
    'number-of-closed-islands',
    'number-of-enclaves',
    'minimum-score-of-a-path-between-two-cities',
    'reorder-routes-to-make-all-paths-lead-to-the-city-zero',
    'number-of-nodes-in-the-sub-tree-with-the-same-label',
    'lexicographically-smallest-equivalent-string',
    'find-all-groups-of-farmland',
    'all-ancestors-of-a-node-in-a-directed-acyclic-graph',
  ],
  'trees-bfs': [
    'binary-tree-level-order-traversal-ii',
    'print-binary-tree',
    'step-by-step-directions-from-a-binary-tree-node-to-another',
    'sum-of-nodes-with-even-valued-grandparent',
    'amount-of-time-for-binary-tree-to-be-infected',
    'maximum-level-sum-of-a-binary-tree',
    'cousins-in-binary-tree',
    'deepest-leaves-sum',
    'maximum-width-of-binary-tree',
    'minimum-depth-of-binary-tree',
    'average-of-levels-in-binary-tree',
    'even-odd-tree',
    'find-largest-value-in-each-tree-row',
    'find-bottom-left-tree-value',
    'populating-next-right-pointers-in-each-node-ii',
    // Hard BFS / Tree problems
    'cut-off-trees-for-golf-event',
    'sliding-puzzle',
    'minimum-cost-to-make-at-least-one-valid-path-in-a-grid',
    'word-ladder-ii',
    'bus-routes',
    'shortest-path-visiting-all-nodes',
    'trapping-rain-water-ii',
  ],
  'trees-dfs': [
    'merge-two-binary-trees',
    'leaf-similar-trees',
    'sum-of-left-leaves',
    'univalued-binary-tree',
    'range-sum-of-bst',
    'search-in-a-binary-search-tree',
    'binary-tree-tilt',
    'evaluate-boolean-binary-tree',
    'delete-node-in-a-bst',
    'insert-into-a-binary-search-tree',
    'trim-a-binary-search-tree',
    'all-possible-full-binary-trees',
    'distribute-coins-in-binary-tree',
    'maximum-difference-between-node-and-ancestor',
    'pseudo-palindromic-paths-in-a-binary-tree',
    'most-frequent-subtree-sum',
    'all-elements-in-two-binary-search-trees',
    'balance-a-binary-search-tree',
    // Hard Tree DFS
    'binary-tree-cameras',
    'recover-a-tree-from-preorder-traversal',
    'sum-of-distances-in-tree',
    'maximum-sum-bst-in-binary-tree',
    'height-of-binary-tree-after-subtree-removal-queries',
  ],
  'linked-list-fast-slow': [
    'remove-nodes-from-linked-list',
    'nodes-between-critical-points',
    'split-linked-list-in-parts',
    'spiral-matrix-iv',
    'linked-list-in-binary-tree',
    'odd-even-linked-list',
    'partition-list',
    'reverse-linked-list-ii',
    'reverse-nodes-in-k-group',
    'all-oone-data-structure',
    'lfu-cache',
    'lru-cache',
    'design-browser-history',
    'design-linked-list',
    'design-front-middle-back-queue',
    'design-circular-deque',
    'design-circular-queue',
    'swapping-nodes-in-a-linked-list',
    'flatten-a-multilevel-doubly-linked-list',
    'merge-in-between-linked-lists',
    'delete-nodes-from-linked-list-present-in-array',
    'next-greater-node-in-linked-list',
    'remove-zero-sum-consecutive-nodes-from-linked-list',
    'rotate-list',
    'swap-nodes-in-pairs',
  ],
  'two-pointers': [
    'string-compression',
    'remove-duplicates-from-sorted-array-ii',
    'compare-version-numbers',
    'heaters',
    'magical-string',
    'longest-word-in-dictionary-through-deleting',
  ],
  'graph-bfs': [
    'nearest-exit-from-entrance-in-maze',
    'cheapest-flights-within-k-stops',
    'minimum-cost-to-reach-destination-in-time',
    'shortest-path-to-get-all-keys',
  ],
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

    if (!res.ok) return null;
    const json = await res.json();
    return json.data?.question || null;
  } catch (err) {
    return null;
  }
}

async function fetchQuestionsByTag(tagSlug, limit = 50, skip = 0) {
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
        variables: { categorySlug: '', skip, limit, filters: { tags: [tagSlug] } },
      }),
    });

    if (!res.ok) return [];
    const json = await res.json();
    return json.data?.problemsetQuestionList?.questions || [];
  } catch (err) {
    return [];
  }
}

async function main() {
  const client = await pool.connect();
  try {
    const existingLinksRes = await client.query('SELECT link FROM public.pattern_bank;');
    const existingLinks = new Set(existingLinksRes.rows.map((r) => r.link));
    console.log(`Current links in pattern_bank: ${existingLinks.size}`);

    for (const [patternTag, slugs] of Object.entries(TARGET_CANDIDATES)) {
      const curCountRes = await client.query(
        'SELECT COUNT(*)::int AS count FROM public.pattern_bank WHERE pattern_tag = $1;',
        [patternTag]
      );
      let count = curCountRes.rows[0].count;
      console.log(`\n[Target: ${patternTag}] Current count: ${count}`);

      for (const slug of slugs) {
        if (count >= 42) break;

        const link = `https://leetcode.com/problems/${slug}/`;
        if (existingLinks.has(link)) continue;

        const q = await fetchQuestionBySlug(slug);
        await sleep(100);

        if (!q || q.paidOnly) continue;

        const difficulty = q.difficulty.toLowerCase();
        await client.query(
          `INSERT INTO public.pattern_bank (name, link, pattern_tag, difficulty, is_curated)
           VALUES ($1, $2, $3, $4, true)
           ON CONFLICT (link) DO NOTHING;`,
          [q.title, link, patternTag, difficulty]
        );

        existingLinks.add(link);
        count++;
        console.log(`  ✓ Added [${difficulty}] ${q.title} (${slug}) -> count: ${count}`);
      }

      // If still under 42, fetch with pagination skips
      if (count < 42) {
        console.log(`  Paginating LeetCode tag for "${patternTag}" to reach 42...`);
        const searchTag =
          patternTag.includes('trees')
            ? 'tree'
            : patternTag.includes('linked-list')
            ? 'linked-list'
            : patternTag.includes('graph-dfs')
            ? 'depth-first-search'
            : patternTag.includes('graph-bfs')
            ? 'breadth-first-search'
            : 'algorithms';

        for (const skip of [50, 100, 150]) {
          if (count >= 42) break;
          const questions = await fetchQuestionsByTag(searchTag, 50, skip);
          for (const q of questions) {
            if (count >= 42) break;
            if (q.paidOnly) continue;

            const link = `https://leetcode.com/problems/${q.titleSlug}/`;
            if (existingLinks.has(link)) continue;

            const difficulty = q.difficulty.toLowerCase();
            await client.query(
              `INSERT INTO public.pattern_bank (name, link, pattern_tag, difficulty, is_curated)
               VALUES ($1, $2, $3, $4, true)
               ON CONFLICT (link) DO NOTHING;`,
              [q.title, link, patternTag, difficulty]
            );

            existingLinks.add(link);
            count++;
            console.log(`  ✓ Added tag problem [${difficulty}] ${q.title} -> count: ${count}`);
          }
        }
      }

      console.log(`  Pattern "${patternTag}" completed with ${count} problems.`);
    }

    console.log('\nAll targeted patterns updated!');
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
