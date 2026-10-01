import pg from 'pg';
import dotenv from 'dotenv';
dotenv.config();

const { Pool } = pg;
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

const CANDIDATES = {
  'linked-list-fast-slow': [
    'happy-number',
    'circular-array-loop',
    'delete-the-middle-node-of-a-linked-list',
    'swapping-nodes-in-a-linked-list',
    'split-linked-list-in-parts',
    'remove-zero-sum-consecutive-nodes-from-linked-list',
    'insert-greatest-common-divisors-in-linked-list',
    'double-a-number-represented-as-a-linked-list',
    'maximum-twin-sum-of-a-linked-list',
    'merge-nodes-in-between-zeros',
    'convert-binary-number-in-a-linked-list-to-integer',
    'flatten-a-multilevel-doubly-linked-list',
    'design-linked-list',
    'design-browser-history',
  ],
  'tree-traversal': [
    'binary-tree-inorder-traversal',
    'binary-tree-preorder-traversal',
    'binary-tree-postorder-traversal',
    'binary-tree-paths',
    'vertical-order-traversal-of-a-binary-tree',
    'construct-binary-tree-from-inorder-and-postorder-traversal',
    'construct-binary-search-tree-from-preorder-traversal',
    'recover-binary-search-tree',
    'find-mode-in-binary-search-tree',
    'minimum-absolute-difference-in-bst',
    'increasing-order-search-tree',
    'leaf-similar-trees',
    'sum-of-left-leaves',
    'find-bottom-left-tree-value',
    'delete-node-in-a-bst',
  ],
  'graph-dfs': [
    'keys-and-rooms',
    'all-paths-from-source-to-target',
    'time-needed-to-inform-all-employees',
    'reconstruct-itinerary',
    'critical-connections-in-a-network',
  ],
  'greedy-intervals': [
    'video-stitching',
    'my-calendar-i',
    'my-calendar-ii',
    'maximum-number-of-events-that-can-be-attended',
    'divide-intervals-into-minimum-number-of-groups',
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
    console.error(`Error fetching ${titleSlug}:`, err.message);
    return null;
  }
}

async function main() {
  const client = await pool.connect();
  try {
    const existingLinksRes = await client.query('SELECT link FROM public.pattern_bank;');
    const existingLinks = new Set(existingLinksRes.rows.map((r) => r.link));
    console.log(`Currently ${existingLinks.size} problems in pattern_bank.`);

    let insertedTotal = 0;

    for (const [patternTag, slugs] of Object.entries(CANDIDATES)) {
      console.log(`\nProcessing pattern: ${patternTag}...`);
      let countForPattern = 0;

      // Check current count for this pattern
      const curCountRes = await client.query(
        'SELECT COUNT(*)::int AS count FROM public.pattern_bank WHERE pattern_tag = $1;',
        [patternTag]
      );
      let currentCount = curCountRes.rows[0].count;
      console.log(`  Current count for "${patternTag}": ${currentCount}`);

      for (const slug of slugs) {
        if (currentCount >= 17) {
          console.log(`  Target count of 17 reached for "${patternTag}". Moving to next pattern.`);
          break;
        }

        const link = `https://leetcode.com/problems/${slug}/`;
        if (existingLinks.has(link)) {
          console.log(`  Skipping existing link: ${slug}`);
          continue;
        }

        const q = await fetchQuestionBySlug(slug);
        await sleep(150);

        if (!q || q.paidOnly) {
          console.log(`  Skipping non-free / missing: ${slug}`);
          continue;
        }

        const difficulty = q.difficulty.toLowerCase();

        await client.query(
          `INSERT INTO public.pattern_bank (name, link, pattern_tag, difficulty, is_curated)
           VALUES ($1, $2, $3, $4, true)
           ON CONFLICT (link) DO NOTHING;`,
          [q.title, link, patternTag, difficulty]
        );

        existingLinks.add(link);
        currentCount++;
        insertedTotal++;
        countForPattern++;
        console.log(`  ✓ Inserted [${difficulty}] ${q.title} (${slug}) -> total: ${currentCount}`);
      }
    }

    console.log(`\nCompleted! Added ${insertedTotal} additional benchmark problems.`);
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
