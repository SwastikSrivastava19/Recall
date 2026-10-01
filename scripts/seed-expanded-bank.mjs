/**
 * Recall Pattern Bank Bulk Expansion Pipeline
 * Expands all 20 pattern tags to 40-50 problems per pattern,
 * rebalancing difficulty distributions to eliminate zero-count tiers.
 */

import pg from 'pg';
import dotenv from 'dotenv';
dotenv.config();

const { Pool } = pg;
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

// Curated priority additions per pattern with intentional difficulty balance
const CURATED_ADDITIONS = {
  'backtracking': {
    easy: [
      'binary-watch',
      'sum-of-all-subset-xor-totals',
      'letter-case-permutation',
    ],
    medium: [
      'subsets',
      'subsets-ii',
      'permutations',
      'permutations-ii',
      'combination-sum',
      'combination-sum-ii',
      'combination-sum-iii',
      'letter-combinations-of-a-phone-number',
      'generate-parentheses',
      'word-search',
      'palindrome-partitioning',
      'restore-ip-addresses',
      'path-with-maximum-gold',
      'beautiful-arrangement',
      'non-decreasing-subsequences',
      'split-a-string-into-the-max-number-of-unique-substrings',
      'the-k-th-lexicographical-string-of-all-happy-strings-of-length-n',
      'target-sum',
      'matchsticks-to-square',
      'maximum-length-of-a-concatenated-string-with-unique-characters',
    ],
    hard: [
      'n-queens',
      'n-queens-ii',
      'sudoku-solver',
      'word-search-ii',
      'remove-invalid-parentheses',
      'unique-paths-iii',
      'find-minimum-time-to-finish-all-jobs',
    ],
  },
  'binary-search': {
    easy: [
      'valid-perfect-square',
      'count-negative-numbers-in-a-sorted-matrix',
      'find-target-indices-after-sorting-array',
      'the-k-weakest-rows-in-a-matrix',
      'intersection-of-two-arrays-ii',
    ],
    medium: [
      'search-a-2d-matrix-ii',
      'find-minimum-in-rotated-sorted-array-ii',
      'search-in-rotated-sorted-array-ii',
      'h-index-ii',
      'magnetic-force-between-two-balls',
      'minimized-maximum-of-products-distributed-to-any-store',
      'kth-smallest-element-in-a-sorted-matrix',
      'find-k-closest-elements',
      'minimum-limit-of-balls-in-a-bag',
      'most-profit-assigning-work',
      'maximum-value-at-a-given-index-in-a-bounded-array',
      'two-sum-ii-input-array-is-sorted',
      'online-election',
      'maximum-candies-allocated-to-k-children',
      'find-positive-integer-solution-for-a-given-equation',
      'minimum-time-to-complete-trips',
      'successful-pairs-of-spells-and-potions',
      'heaters',
    ],
    hard: [
      'find-in-mountain-array',
      'count-of-smaller-numbers-after-self',
      'dungeon-game',
      'find-k-th-smallest-pair-distance',
      'online-election',
      'maximum-running-time-of-n-computers',
    ],
  },
  'bit-manipulation': {
    easy: [
      'binary-number-with-alternating-bits',
      'prime-number-of-set-bits-in-binary-representation',
      'sort-integers-by-the-number-of-1-bits',
      'number-of-steps-to-reduce-a-number-to-zero',
      'xor-operation-in-an-array',
    ],
    medium: [
      'utf-8-validation',
      'total-hamming-distance',
      'gray-code',
      'bitwise-ors-of-subarrays',
      'xor-queries-of-a-subarray',
      'count-triplets-that-can-form-two-arrays-of-equal-xor',
      'maximum-xor-for-each-query',
      'concatenation-of-consecutive-binary-numbers',
      'divide-two-integers',
      'circular-permutation-in-binary-representation',
      'find-the-original-array-of-prefix-xor',
      'maximum-xor-of-two-numbers-in-an-array',
      'neighboring-bitwise-xor',
      'minimize-xor',
      'bitwise-xor-of-all-pairings',
    ],
    hard: [
      'minimum-number-of-k-consecutive-bit-flips',
      'number-of-valid-words-for-each-puzzle',
      'find-xor-sum-of-all-pairs-bitwise-and',
      'maximum-score-words-formed-by-letters',
      'chalkboard-xor-game',
      'maximum-xor-with-an-element-from-array',
      'triples-with-bitwise-and-equal-to-zero',
    ],
  },
  'dp-knapsack': {
    easy: [
      'climbing-stairs',
      'min-cost-climbing-stairs',
      'divisor-game',
      'pascals-triangle',
      'pascals-triangle-ii',
      'n-th-tribonacci-number',
      'get-maximum-in-generated-array',
    ],
    medium: [
      'house-robber',
      'house-robber-ii',
      'delete-and-earn',
      'perfect-squares',
      'integer-break',
      'word-break',
      'minimum-cost-for-tickets',
      'shopping-offers',
      'partition-to-k-equal-sum-subsets',
      'can-partition-k-subsets',
      'fair-distribution-of-cookies',
      'maximum-subarray',
      'best-time-to-buy-and-sell-stock-with-cooldown',
      'best-time-to-buy-and-sell-stock-with-transaction-fee',
      'coin-change',
      'coin-change-ii',
      'combination-sum-iv',
      'last-stone-weight-ii',
    ],
    hard: [
      'profitable-schemes',
      'tallest-billboard',
      'pizza-with-3n-slices',
      'painting-the-walls',
      'form-largest-integer-with-digits-that-add-up-to-target',
      'best-time-to-buy-and-sell-stock-iii',
      'best-time-to-buy-and-sell-stock-iv',
      'reducing-dishes',
      'maximum-value-of-k-coins-from-piles',
    ],
  },
  'dp-lis': {
    easy: [
      'longest-continuous-increasing-subsequence',
      'is-subsequence',
      'longest-subsequence-with-limited-sum',
    ],
    medium: [
      'longest-string-chain',
      'increasing-triplet-subsequence',
      'longest-arithmetic-subsequence',
      'longest-arithmetic-subsequence-of-given-difference',
      'longest-common-subsequence',
      'delete-operation-for-two-strings',
      'minimum-ascii-delete-sum-for-two-strings',
      'uncrossed-lines',
      'interleaving-string',
      'maximum-length-of-repeated-subarray',
      'wiggle-subsequence',
      'longest-turbulent-subarray',
      'longest-palindromic-subsequence',
      'palindromic-substrings',
      'longest-palindromic-substring',
      'check-if-there-is-a-valid-partition-for-the-array',
      'append-characters-to-string-to-make-subsequence',
      'maximum-alternating-subsequence-sum',
      'partition-array-for-maximum-sum',
      'minimum-deletions-to-make-string-balanced',
    ],
    hard: [
      'maximum-height-by-stacking-cuboids',
      'build-array-where-you-can-find-the-maximum-exactly-k-comparisons',
      'minimum-operations-to-make-the-array-k-increasing',
      'make-array-strictly-increasing',
      'distinct-subsequences',
      'distinct-subsequences-ii',
      'shortest-common-supersequence',
      'count-different-palindromic-subsequences',
      'find-the-longest-valid-obstacle-course-at-each-position',
      'minimum-number-of-removals-to-make-mountain-array',
      'constrain-subsequence-sum',
    ],
  },
  'graph-bfs': {
    easy: [
      'flood-fill',
      'island-perimeter',
      'find-center-of-star-graph',
      'find-the-town-judge',
      'matrix-cells-in-distance-order',
    ],
    medium: [
      'rotting-oranges',
      '01-matrix',
      'shortest-path-in-binary-matrix',
      'snakes-and-ladders',
      'open-the-lock',
      'minimum-genetic-mutation',
      'as-far-from-land-as-possible',
      'nearest-exit-from-entrance-in-maze',
      'is-graph-bipartite',
      'cheapest-flights-within-k-stops',
      'network-delay-time',
      'jump-game-iii',
      'reorder-routes-to-make-all-paths-lead-to-the-city-zero',
      'shortest-bridge',
      'map-of-highest-peak',
      'find-all-groups-of-farmland',
      'minimum-fuel-cost-to-report-to-the-capital',
      'minesweeper',
    ],
    hard: [
      'word-ladder-ii',
      'shortest-path-visiting-all-nodes',
      'cut-off-trees-for-golf-event',
      'sliding-puzzle',
      'minimum-cost-to-make-at-least-one-valid-path-in-a-grid',
      'shortest-path-to-get-all-keys',
    ],
  },
  'graph-dfs': {
    easy: [
      'find-if-path-exists-in-graph',
      'employee-importance',
      'flood-fill',
    ],
    medium: [
      'number-of-islands',
      'max-area-of-island',
      'surrounded-regions',
      'pacific-atlantic-water-flow',
      'course-schedule',
      'course-schedule-ii',
      'number-of-enclaves',
      'number-of-closed-islands',
      'count-sub-islands',
      'find-eventual-safe-states',
      'detect-cycles-in-2d-grid',
      'battleships-in-a-board',
      'evaluate-division',
      'clone-graph',
      'accounts-merge',
      'most-stones-removed-with-same-row-or-column',
      'redundant-connection',
      'longest-consecutive-sequence',
      'find-all-possible-recipes-from-given-supplies',
      'lexicographically-smallest-equivalent-string',
    ],
    hard: [
      'making-a-large-island',
      'longest-increasing-path-in-a-matrix',
      'concatenated-words',
      'contain-virus',
      'couples-holding-hands',
      'course-schedule-iii',
    ],
  },
  'greedy-intervals': {
    easy: [
      'assign-cookies',
      'lemonade-change',
      'can-place-flowers',
      'maximum-units-on-a-truck',
      'minimum-subsequence-in-non-increasing-order',
    ],
    medium: [
      'task-scheduler',
      'gas-station',
      'jump-game',
      'jump-game-ii',
      'partition-labels',
      'hand-of-straights',
      'dota2-senate',
      'boats-to-save-people',
      'bag-of-tokens',
      'queue-reconstruction-by-height',
      'remove-covered-intervals',
      'maximum-points-you-can-obtain-from-cards',
      'minimum-number-of-taps-to-open-to-water-a-garden',
      'two-city-scheduling',
      'advantage-shuffle',
      'wiggle-sort-ii',
      'reorganize-string',
      'monotone-increasing-digits',
      'minimum-time-to-make-rope-colorful',
      'eliminate-maximum-number-of-monsters',
    ],
    hard: [
      'my-calendar-iii',
      'minimum-interval-to-include-each-query',
      'maximum-number-of-events-that-can-be-attended-ii',
      'candy',
      'course-schedule-iii',
      'ipo',
      'patching-array',
      'minimum-initial-energy-to-finish-tasks',
    ],
  },
  'heap-topk': {
    easy: [
      'kth-largest-element-in-a-stream',
      'last-stone-weight',
      'relative-ranks',
      'take-gifts-from-the-richest-pile',
    ],
    medium: [
      'k-closest-points-to-origin',
      'reorganize-string',
      'ugly-number-ii',
      'sort-characters-by-frequency',
      'furthest-building-you-can-reach',
      'single-threaded-cpu',
      'maximum-subsequence-score',
      'total-cost-to-hire-k-workers',
      'seat-reservation-manager',
      'distant-barcodes',
      'diagonal-traverse-ii',
      'longest-happy-string',
      'minimum-cost-to-connect-sticks',
      'find-the-kth-smallest-sum-of-a-matrix-with-sorted-rows',
      'maximum-product-after-k-increments',
      'find-players-with-zero-or-one-losses',
      'least-number-of-unique-integers-after-k-removals',
      'reduce-array-size-to-the-half',
      'minimum-operations-to-halve-array-sum',
      'maximum-bags-with-full-capacity-of-rocks',
    ],
    hard: [
      'find-median-from-data-stream',
      'trapping-rain-water-ii',
      'find-k-th-smallest-pair-distance',
      'sliding-window-median',
      'minimum-cost-to-hire-k-workers',
      'shortest-path-to-get-all-keys',
    ],
  },
  'linked-list': {
    easy: [
      'remove-linked-list-elements',
      'delete-node-in-a-linked-list',
      'remove-duplicates-from-sorted-list',
      'convert-binary-number-in-a-linked-list-to-integer',
    ],
    medium: [
      'add-two-numbers-ii',
      'split-linked-list-in-parts',
      'swapping-nodes-in-a-linked-list',
      'delete-the-middle-node-of-a-linked-list',
      'merge-nodes-in-between-zeros',
      'maximum-twin-sum-of-a-linked-list',
      'insert-greatest-common-divisors-in-linked-list',
      'double-a-number-represented-as-a-linked-list',
      'design-linked-list',
      'design-browser-history',
      'flatten-a-multilevel-doubly-linked-list',
      'remove-zero-sum-consecutive-nodes-from-linked-list',
      'reverse-linked-list-ii',
      'nodes-between-critical-points',
      'remove-nodes-from-linked-list',
      'spiral-matrix-iv',
      'linked-list-in-binary-tree',
      'swap-nodes-in-pairs',
      'odd-even-linked-list',
      'partition-list',
    ],
    hard: [
      'reverse-nodes-in-k-group',
      'merge-k-sorted-lists',
      'all-oone-data-structure',
      'lfu-cache',
    ],
  },
  'linked-list-fast-slow': {
    easy: [
      'linked-list-cycle',
      'middle-of-the-linked-list',
      'palindrome-linked-list',
      'happy-number',
    ],
    medium: [
      'linked-list-cycle-ii',
      'circular-array-loop',
      'delete-the-middle-node-of-a-linked-list',
      'swapping-nodes-in-a-linked-list',
      'split-linked-list-in-parts',
      'maximum-twin-sum-of-a-linked-list',
      'merge-nodes-in-between-zeros',
      'double-a-number-represented-as-a-linked-list',
      'reverse-linked-list-ii',
      'remove-zero-sum-consecutive-nodes-from-linked-list',
      'insert-greatest-common-divisors-in-linked-list',
      'intersection-of-two-linked-lists',
      'rotate-list',
      'odd-even-linked-list',
      'swap-nodes-in-pairs',
      'partition-list',
      'remove-nth-node-from-end-of-list',
      'reorder-list',
      'remove-nodes-from-linked-list',
      'nodes-between-critical-points',
    ],
    hard: [
      'reverse-nodes-in-k-group',
      'merge-k-sorted-lists',
      'all-oone-data-structure',
    ],
  },
  'monotonic-stack': {
    easy: [
      'final-prices-with-a-special-discount-in-a-shop',
      'next-greater-element-i',
    ],
    medium: [
      'next-greater-element-ii',
      'online-stock-span',
      '132-pattern',
      'remove-k-digits',
      'sum-of-subarray-minimums',
      'sum-of-subarray-ranges',
      'car-fleet',
      'evaluate-reverse-polish-notation',
      'asteroid-collision',
      'shortest-unsorted-continuous-subarray',
      'steps-to-make-array-non-decreasing',
      'maximum-width-ramp',
      'find-the-most-competitive-subsequence',
      'flatten-nested-list-iterator',
      'beautiful-towers-ii',
      'next-greater-node-in-linked-list',
      'remove-duplicate-letters',
      'smallest-subsequence-of-distinct-characters',
      'daily-temperatures',
    ],
    hard: [
      'largest-rectangle-in-histogram',
      'maximal-rectangle',
      'trapping-rain-water',
      'sliding-window-maximum',
      'maximum-score-of-a-good-subarray',
      'count-submatrices-with-all-ones',
      'create-maximum-number',
    ],
  },
  'prefix-sum': {
    easy: [
      'find-the-middle-index-in-array',
      'minimum-value-to-get-positive-step-by-step-sum',
      'running-sum-of-1d-array',
      'left-and-right-sum-differences',
    ],
    medium: [
      'corporate-flight-bookings',
      'matrix-block-sum',
      'find-two-non-overlapping-sub-arrays-each-with-target-sum',
      'path-sum-iii',
      'sum-of-absolute-differences-in-a-sorted-array',
      'make-sum-divisible-by-p',
      'maximum-sum-circular-subarray',
      'plates-between-candles',
      'find-good-days-to-rob-the-bank',
      'minimum-size-subarray-sum',
      'k-radius-subarray-averages',
      'sum-of-subarray-ranges',
      'count-subarrays-with-score-less-than-k',
      'maximum-product-subarray',
      'count-subarrays-with-more-ones-than-zeros',
      'find-longest-subarray-lcci',
    ],
    hard: [
      'max-sum-of-rectangle-no-larger-than-k',
      'count-of-range-sum',
      'number-of-submatrices-that-sum-to-target',
      'maximum-score-of-a-good-subarray',
      'split-array-largest-sum',
    ],
  },
  'sliding-window': {
    easy: [
      'maximum-average-subarray-i',
      'substrings-of-size-three-with-distinct-characters',
      'minimum-recolors-to-get-k-consecutive-black-blocks',
      'contains-duplicate-ii',
    ],
    medium: [
      'get-equal-substrings-within-budget',
      'maximum-number-of-vowels-in-a-substring-of-given-length',
      'maximum-erasure-value',
      'minimum-operations-to-reduce-x-to-zero',
      'number-of-sub-arrays-of-size-k-and-average-greater-than-or-equal-to-threshold',
      'longest-substring-of-all-vowels-in-order',
      'max-consecutive-ones-iii',
      'fruit-into-baskets',
      'frequency-of-the-most-frequent-element',
      'grumpy-bookstore-owner',
      'longest-turbulent-subarray',
      'repeated-dna-sequences',
      'maximum-points-you-can-obtain-from-cards',
      'count-complete-subarrays-in-an-array',
      'length-of-longest-subarray-with-at-most-k-frequency',
    ],
    hard: [
      'minimum-window-substring',
      'sliding-window-maximum',
      'subarrays-with-k-different-integers',
      'sliding-window-median',
      'substring-with-concatenation-of-all-words',
    ],
  },
  'tree-traversal': {
    easy: [
      'univalued-binary-tree',
      'range-sum-of-bst',
      'search-in-a-binary-search-tree',
      'binary-tree-tilt',
      'evaluate-boolean-binary-tree',
    ],
    medium: [
      'distribute-coins-in-binary-tree',
      'flatten-binary-tree-to-linked-list',
      'kth-smallest-element-in-a-bst',
      'all-nodes-distance-k-in-binary-tree',
      'find-duplicate-subtrees',
      'binary-search-tree-iterator',
      'maximum-binary-tree',
      'insert-into-a-binary-search-tree',
      'trim-a-binary-search-tree',
      'path-sum-iii',
      'all-elements-in-two-binary-search-trees',
      'balance-a-binary-search-tree',
      'pseudo-palindromic-paths-in-a-binary-tree',
      'most-frequent-subtree-sum',
      'maximum-difference-between-node-and-ancestor',
    ],
    hard: [
      'binary-tree-maximum-path-sum',
      'serialize-and-deserialize-binary-tree',
      'recover-a-tree-from-preorder-traversal',
      'binary-tree-cameras',
    ],
  },
  'trees-bfs': {
    easy: [
      'average-of-levels-in-binary-tree',
      'cousins-in-binary-tree',
      'minimum-depth-of-binary-tree',
      'maximum-depth-of-n-ary-tree',
      'n-ary-tree-level-order-traversal',
    ],
    medium: [
      'even-odd-tree',
      'maximum-level-sum-of-a-binary-tree',
      'all-nodes-distance-k-in-binary-tree',
      'find-bottom-left-tree-value',
      'print-binary-tree',
      'step-by-step-directions-from-a-binary-tree-node-to-another',
      'find-largest-value-in-each-tree-row',
      'deepest-leaves-sum',
      'maximum-width-of-binary-tree',
      'populating-next-right-pointers-in-each-node-ii',
      'binary-tree-right-side-view',
      'binary-tree-zigzag-level-order-traversal',
      'sum-of-nodes-with-even-valued-grandparent',
      'amount-of-time-for-binary-tree-to-be-infected',
    ],
    hard: [
      'serialize-and-deserialize-binary-tree',
      'binary-tree-maximum-path-sum',
      'vertical-order-traversal-of-a-binary-tree',
      'word-ladder',
      'bus-routes',
    ],
  },
  'trees-dfs': {
    easy: [
      'merge-two-binary-trees',
      'root-equals-sum-of-children',
      'binary-tree-paths',
    ],
    medium: [
      'lowest-common-ancestor-of-a-binary-tree',
      'lowest-common-ancestor-of-a-binary-search-tree',
      'path-sum-ii',
      'validate-binary-search-tree',
      'flatten-binary-tree-to-linked-list',
      'construct-binary-tree-from-preorder-and-inorder-traversal',
      'kth-smallest-element-in-a-bst',
      'sum-root-to-leaf-numbers',
      'count-good-nodes-in-binary-tree',
      'house-robber-iii',
      'delete-node-in-a-bst',
      'all-possible-full-binary-trees',
      'trim-a-binary-search-tree',
      'insert-into-a-binary-search-tree',
      'distribute-coins-in-binary-tree',
      'maximum-difference-between-node-and-ancestor',
      'pseudo-palindromic-paths-in-a-binary-tree',
    ],
    hard: [
      'binary-tree-maximum-path-sum',
      'serialize-and-deserialize-binary-tree',
      'serialize-and-deserialize-bst',
      'recover-a-tree-from-preorder-traversal',
      'binary-tree-cameras',
    ],
  },
  'trie': {
    easy: [
      'longest-common-prefix',
      'find-the-index-of-the-first-occurrence-in-a-string',
      'check-if-a-word-occurs-as-a-prefix-of-any-word-in-a-sentence',
    ],
    medium: [
      'implement-trie-prefix-tree',
      'design-add-and-search-words-data-structure',
      'replace-words',
      'map-sum-pairs',
      'maximum-xor-of-two-numbers-in-an-array',
      'implement-magic-dictionary',
      'short-encoding-of-words',
      'top-k-frequent-words',
      'extra-characters-in-a-string',
      'search-suggestions-system',
      'lexicographical-numbers',
      'word-break',
      'sum-of-prefix-scores-of-strings',
      'longest-word-in-dictionary',
      'design-file-system',
      'remove-sub-folders-from-the-filesystem',
    ],
    hard: [
      'word-search-ii',
      'concatenated-words',
      'prefix-and-suffix-search',
      'maximum-genetic-difference-query',
      'stream-of-characters',
    ],
  },
  'two-pointers': {
    easy: [
      'merge-sorted-array',
      'is-subsequence',
      'intersection-of-two-arrays',
      'intersection-of-two-arrays-ii',
    ],
    medium: [
      '3sum-closest',
      'next-permutation',
      'array-with-elements-not-equal-to-average-of-neighbors',
      'minimum-difference-between-highest-and-lowest-of-k-scores',
      'rearrange-array-elements-by-sign',
      'rotate-array',
      'boats-to-save-people',
      'backspace-string-compare',
      'partition-labels',
      'interval-list-intersections',
      'bag-of-tokens',
      'find-the-duplicate-number',
      'find-k-closest-elements',
      '4sum',
      'container-with-most-water',
      'sort-colors',
      'squares-of-a-sorted-array',
      'partition-array-according-to-given-pivot',
      'number-of-subsequences-that-satisfy-the-given-sum-condition',
    ],
    hard: [
      'trapping-rain-water',
      'minimum-window-substring',
      'substring-with-concatenation-of-all-words',
      'subarrays-with-k-different-integers',
      'first-missing-positive',
    ],
  },
  'union-find': {
    easy: [
      'find-if-path-exists-in-graph',
      'find-the-town-judge',
    ],
    medium: [
      'max-area-of-island',
      'count-unreachable-pairs-of-nodes-in-an-undirected-graph',
      'number-of-provinces',
      'redundant-connection',
      'accounts-merge',
      'is-graph-bipartite',
      'satisfiability-of-equality-equations',
      'number-of-operations-to-make-network-connected',
      'smallest-string-with-swaps',
      'most-stones-removed-with-same-row-or-column',
      'regions-cut-by-slashes',
      'surrounded-regions',
      'lexicographically-smallest-equivalent-string',
      'min-cost-to-connect-all-points',
      'find-all-people-with-secret',
      'longest-consecutive-sequence',
      'evaluate-division',
    ],
    hard: [
      'remove-max-number-of-edges-to-keep-graph-fully-traversable',
      'swim-in-rising-water',
      'making-a-large-island',
      'checking-existence-of-edge-length-limited-paths',
      'greatest-common-divisor-traversal',
      'rank-transform-of-a-matrix',
    ],
  },
};

const LC_TAG_SEARCH = {
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
    console.log('========================================================');
    console.log('RECALL PATTERN BANK EXPANSION (TARGET: 40-50 PER PATTERN)');
    console.log('========================================================\n');

    const existingLinksRes = await client.query('SELECT link FROM public.pattern_bank;');
    const existingLinks = new Set(existingLinksRes.rows.map((r) => r.link));
    console.log(`Initial total in pattern_bank: ${existingLinks.size}\n`);

    const patterns = Object.keys(CURATED_ADDITIONS);
    let totalAdded = 0;

    for (const patternTag of patterns) {
      const curCountRes = await client.query(
        'SELECT COUNT(*)::int AS count FROM public.pattern_bank WHERE pattern_tag = $1;',
        [patternTag]
      );
      let count = curCountRes.rows[0].count;
      console.log(`[Pattern: ${patternTag}] Current count: ${count}`);

      const targetCount = 42; // Target 42-45 problems per pattern
      const additions = CURATED_ADDITIONS[patternTag] || { easy: [], medium: [], hard: [] };

      // Process curated slugs (prioritizing missing difficulty tiers)
      const allCuratedSlugs = [
        ...(additions.easy || []),
        ...(additions.hard || []),
        ...(additions.medium || []),
      ];

      for (const slug of allCuratedSlugs) {
        if (count >= targetCount) break;

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
        totalAdded++;
        console.log(`  ✓ Added curated [${difficulty}] ${q.title} (${slug}) -> now ${count}`);
      }

      // If still under target, pull from LeetCode tag search
      if (count < targetCount) {
        const lcTag = LC_TAG_SEARCH[patternTag];
        console.log(`  Fetching tag questions for "${lcTag}" to reach target...`);
        const tagQuestions = await fetchQuestionsByTag(lcTag, 60, 0);

        for (const q of tagQuestions) {
          if (count >= targetCount) break;
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
          totalAdded++;
          console.log(`  ✓ Added tag problem [${difficulty}] ${q.title} (${q.titleSlug}) -> now ${count}`);
        }
      }

      console.log(`  -> Pattern "${patternTag}" finalized at ${count} problems.\n`);
    }

    console.log(`\n========================================================`);
    console.log(`EXPANSION COMPLETE! Added ${totalAdded} new problems.`);
    console.log(`Total problems in pattern_bank: ${existingLinks.size}`);
    console.log(`========================================================`);
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
