// Global fetch is built into Node 22

const TAG_MAP = {
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

async function checkTags() {
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
        }
      }
    }
  `;

  for (const [pattern, tag] of Object.entries(TAG_MAP)) {
    try {
      const res = await fetch('https://leetcode.com/graphql/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'User-Agent': 'Mozilla/5.0' },
        body: JSON.stringify({
          query,
          variables: { categorySlug: '', skip: 0, limit: 100, filters: { tags: [tag] } },
        }),
      });
      const data = await res.json();
      const list = data.data?.problemsetQuestionList?.questions || [];
      const free = list.filter((q) => !q.paidOnly);
      const easy = free.filter((q) => q.difficulty === 'Easy').length;
      const med = free.filter((q) => q.difficulty === 'Medium').length;
      const hard = free.filter((q) => q.difficulty === 'Hard').length;
      console.log(
        `${pattern.padEnd(23)} [tag: ${tag.padEnd(20)}] Total: ${data.data?.problemsetQuestionList?.total} | Free: ${free.length} (Easy: ${easy}, Med: ${med}, Hard: ${hard})`
      );
    } catch (e) {
      console.error(pattern, e.message);
    }
  }
}

checkTags();
