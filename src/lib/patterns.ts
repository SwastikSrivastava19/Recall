// Recall Pattern Substitution Engine (Step 11)
// Maps problem tags to specific DSA patterns, applies probability & difficulty gates,
// and excludes already-solved problems from the pattern_bank.

export const PATTERN_SUBSTITUTION_PROBABILITY = 0.4; // Configurable default: 40% chance

export const PATTERN_NAMES: Record<string, string> = {
  'sliding-window': 'Sliding Window',
  'two-pointers': 'Two Pointers',
  'binary-search': 'Binary Search',
  'dp-knapsack': 'DP: Knapsack',
  'dp-lis': 'DP: Longest Increasing Subsequence',
  'graph-bfs': 'Graph: BFS',
  'graph-dfs': 'Graph: DFS',
  'backtracking': 'Backtracking',
  'greedy-intervals': 'Greedy Intervals',
  'heap-topk': 'Heap / Top-K',
  'tree-traversal': 'Tree Traversal',
  'trees-bfs': 'Trees: BFS / Level Order',
  'trees-dfs': 'Trees: DFS',
  'monotonic-stack': 'Monotonic Stack',
  'linked-list-fast-slow': 'Linked List: Fast & Slow',
  'linked-list': 'Linked List',
  'trie': 'Trie',
  'union-find': 'Union Find / Disjoint Set',
  'prefix-sum': 'Prefix Sum',
  'bit-manipulation': 'Bit Manipulation',
};

export type PatternTag = keyof typeof PATTERN_NAMES;
export type Difficulty = 'easy' | 'medium' | 'hard';

/**
 * Derives the most specific pattern_tag from a problem's existing topic_tags and name/slug.
 * Current topic_tags (e.g. 'arrays', 'dynamic-programming') are often broader than specific patterns.
 */
export function derivePatternTag(
  topicTags: string[] = [],
  problemName = '',
  problemLink = ''
): PatternTag | null {
  const normalizedTags = topicTags.map((t) => t.toLowerCase().trim().replace(/\s+/g, '-'));
  const tagSet = new Set(normalizedTags);

  const textToInspect = `${problemName} ${problemLink}`.toLowerCase().replace(/[^a-z0-9]/g, ' ');

  // 1. Direct Pattern Matches
  if (tagSet.has('sliding-window')) return 'sliding-window';
  if (tagSet.has('two-pointers')) return 'two-pointers';
  if (tagSet.has('binary-search')) return 'binary-search';
  if (tagSet.has('backtracking')) return 'backtracking';
  if (tagSet.has('monotonic-stack')) return 'monotonic-stack';
  if (tagSet.has('trie')) return 'trie';
  if (
    tagSet.has('union-find') ||
    tagSet.has('disjoint-set') ||
    textToInspect.includes('redundant connection') ||
    textToInspect.includes('accounts merge') ||
    textToInspect.includes('provinces')
  ) {
    return 'union-find';
  }
  if (
    tagSet.has('prefix-sum') ||
    textToInspect.includes('prefix sum') ||
    textToInspect.includes('subarray sum') ||
    textToInspect.includes('pivot index')
  ) {
    return 'prefix-sum';
  }
  if (
    tagSet.has('bit-manipulation') ||
    tagSet.has('bitwise') ||
    textToInspect.includes('single number') ||
    textToInspect.includes('counting bits')
  ) {
    return 'bit-manipulation';
  }

  // 2. Greedy Intervals
  if (
    tagSet.has('intervals') ||
    textToInspect.includes('interval') ||
    textToInspect.includes('meeting') ||
    textToInspect.includes('calendar')
  ) {
    return 'greedy-intervals';
  }

  // 3. Heap / Top-K
  if (
    tagSet.has('heap-priority-queue') ||
    tagSet.has('heap') ||
    textToInspect.includes('kth largest') ||
    textToInspect.includes('top k') ||
    textToInspect.includes('median from data')
  ) {
    return 'heap-topk';
  }

  // 4. Trees: BFS vs DFS vs General
  if (tagSet.has('tree') || tagSet.has('binary-tree') || textToInspect.includes('binary tree') || textToInspect.includes('bst')) {
    if (
      textToInspect.includes('level order') ||
      textToInspect.includes('right side view') ||
      textToInspect.includes('zigzag') ||
      textToInspect.includes('width of binary tree')
    ) {
      return 'trees-bfs';
    }
    return 'trees-dfs';
  }

  // 5. Graph BFS vs DFS
  if (tagSet.has('breadth-first-search') || textToInspect.includes('shortest path') || textToInspect.includes('word ladder')) {
    return 'graph-bfs';
  }
  if (
    tagSet.has('depth-first-search') ||
    tagSet.has('graph') ||
    textToInspect.includes('island') ||
    textToInspect.includes('course schedule') ||
    textToInspect.includes('clone graph')
  ) {
    return 'graph-dfs';
  }

  // 6. Linked List Fast & Slow vs General Linked List
  if (tagSet.has('linked-list') || textToInspect.includes('linked list')) {
    if (
      textToInspect.includes('cycle') ||
      textToInspect.includes('middle') ||
      textToInspect.includes('reorder') ||
      textToInspect.includes('fast')
    ) {
      return 'linked-list-fast-slow';
    }
    return 'linked-list';
  }

  // 7. Dynamic Programming sub-patterns
  if (tagSet.has('dynamic-programming') || tagSet.has('dp')) {
    if (
      textToInspect.includes('increasing') ||
      textToInspect.includes('subsequence') ||
      textToInspect.includes('lis') ||
      textToInspect.includes('russian doll')
    ) {
      return 'dp-lis';
    }
    if (
      textToInspect.includes('knapsack') ||
      textToInspect.includes('coin') ||
      textToInspect.includes('partition') ||
      textToInspect.includes('target sum') ||
      textToInspect.includes('subset')
    ) {
      return 'dp-knapsack';
    }
    // Default DP fallback
    return 'dp-knapsack';
  }

  // 8. Monotonic Stack text indicators
  if (
    tagSet.has('stack') &&
    (textToInspect.includes('temperature') ||
      textToInspect.includes('next greater') ||
      textToInspect.includes('histogram') ||
      textToInspect.includes('stock span'))
  ) {
    return 'monotonic-stack';
  }

  // 9. Broader fallbacks
  if (tagSet.has('queue')) return 'graph-bfs';
  if (tagSet.has('recursion')) return 'backtracking';
  if (tagSet.has('greedy')) return 'greedy-intervals';
  if (tagSet.has('linked-list')) return 'linked-list-fast-slow';

  return null;
}

/**
 * Returns allowed difficulties for substitution:
 * Rule: similar-or-harder difficulty (never easier).
 * Soft Signal: If user's LeetCode profile indicates low hard solve experience,
 * avoid substituting hard problems for easy/medium originals.
 */
export function getAllowedDifficulties(
  originalDiff: Difficulty,
  userStats?: { hardSolved?: number; totalSolved?: number }
): Difficulty[] {
  const userHardCount = userStats?.hardSolved ?? 0;
  const userIsComfortableWithHard = userHardCount >= 10;

  switch (originalDiff) {
    case 'easy':
      // Easy can step up to Medium or Hard (if comfortable)
      return userIsComfortableWithHard ? ['easy', 'medium', 'hard'] : ['easy', 'medium'];
    case 'medium':
      // Medium can stay Medium or step up to Hard (if comfortable)
      return userIsComfortableWithHard ? ['medium', 'hard'] : ['medium'];
    case 'hard':
      // Hard can only be substituted with Hard
      return ['hard'];
    default:
      return ['medium', 'hard'];
  }
}

/**
 * Stable hash helper to ensure that a given revision on a given due date
 * deterministically decides whether to substitute and which candidate to pick,
 * avoiding flicker across page refreshes.
 */
export function getDeterministicHash(input: string): number {
  let hash = 0;
  for (let i = 0; i < input.length; i++) {
    hash = (hash << 5) - hash + input.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}
