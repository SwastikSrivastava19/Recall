import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { getAuthenticatedUser } from '@/lib/auth';
import {
  derivePatternTag,
  getAllowedDifficulties,
  getDeterministicHash,
  PATTERN_NAMES,
  PATTERN_SUBSTITUTION_PROBABILITY,
  Difficulty,
} from '@/lib/patterns';
import { topUpPatternBank } from '@/lib/pattern-bank-fetcher';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    // 1. Authenticate user
    const authResult = await getAuthenticatedUser(request);
    if (!authResult.authenticated || !authResult.user) {
      return NextResponse.json(
        { error: 'Unauthorized', message: authResult.error || 'Authentication required' },
        { status: 401 }
      );
    }
    const user = authResult.user;

    // Optional query overrides (for testing and manual control)
    const url = new URL(request.url);
    const forceSubstitution = url.searchParams.get('force_substitution') === 'true';
    const disableSubstitution = url.searchParams.get('disable_substitution') === 'true';

    // 2. Fetch all revision_schedule rows for user where next_due_date <= today,
    // joined with problem name, link, topic_tags, and difficulty.
    const res = await query(
      `SELECT 
         r.id,
         r.user_id,
         r.problem_id,
         r.ease_factor,
         r.current_interval_days,
         TO_CHAR(r.next_due_date, 'YYYY-MM-DD') AS next_due_date,
         r.retention_score,
         r.last_updated,
         p.name AS problem_name,
         p.link AS problem_link,
         p.topic_tags,
         p.difficulty
       FROM public.revision_schedule r
       INNER JOIN public.problems p ON p.id = r.problem_id
       WHERE r.user_id = $1 
         AND r.next_due_date <= CURRENT_DATE
       ORDER BY r.next_due_date ASC, r.retention_score ASC;`,
      [user.id]
    );

    const dueRevisions = res.rows;
    if (dueRevisions.length === 0) {
      return NextResponse.json({ success: true, count: 0, data: [] }, { status: 200 });
    }

    // 3. Fetch user's hint-free revision counts per problem from revision_history
    const historyRes = await query<{ problem_id: string; hint_free_count: string }>(
      `SELECT problem_id, COUNT(*) as hint_free_count
       FROM public.revision_history
       WHERE user_id = $1 AND was_hint_free = true
       GROUP BY problem_id;`,
      [user.id]
    );
    const hintFreeCountMap = new Map<string, number>();
    for (const row of historyRes.rows) {
      hintFreeCountMap.set(row.problem_id, parseInt(row.hint_free_count, 10));
    }

    // 4. Fetch user settings for LeetCode profile bias (soft signal)
    const settingsRes = await query(
      `SELECT leetcode_stats FROM public.user_settings WHERE user_id = $1 LIMIT 1;`,
      [user.id]
    );
    const userStats = settingsRes.rows[0]?.leetcode_stats || null;
    const userStatsParsed =
      userStats?.status === 'verified'
        ? { hardSolved: userStats.hard_solved, totalSolved: userStats.total_solved }
        : undefined;

    // 5. Fetch all problem links the user has already solved (to exclude from pattern substitution)
    const solvedLinksRes = await query<{ link: string }>(
      `SELECT DISTINCT p.link
       FROM public.solves s
       INNER JOIN public.problems p ON p.id = s.problem_id
       WHERE s.user_id = $1;`,
      [user.id]
    );
    const solvedLinksSet = new Set(solvedLinksRes.rows.map((r) => r.link));

    // 6. Process each due revision and evaluate pattern substitution
    const processedRevisions = [];

    for (const rev of dueRevisions) {
      const hintFreeCount = hintFreeCountMap.get(rev.problem_id) || 0;
      // Guard: User must have at least 2 successful hint-free revisions of the original problem
      const isEligibleForSubstitution = hintFreeCount >= 2;

      // Map problem topic_tags / name to specific pattern tag
      const patternTag = derivePatternTag(rev.topic_tags, rev.problem_name, rev.problem_link);

      // Deterministic roll per revision per due day to avoid UI flickering on page refresh
      const todayDate = new Date().toISOString().split('T')[0];
      const deterministicSeed = `${user.id}:${rev.id}:${todayDate}`;
      const hash = getDeterministicHash(deterministicSeed);
      const randomRoll = (hash % 100) / 100; // 0.00 to 0.99

      const shouldSubstitute =
        !disableSubstitution &&
        isEligibleForSubstitution &&
        patternTag !== null &&
        (forceSubstitution || randomRoll < PATTERN_SUBSTITUTION_PROBABILITY);

      if (!shouldSubstitute || !patternTag) {
        processedRevisions.push({
          ...rev,
          is_pattern_substitution: false,
          hint_free_revision_count: hintFreeCount,
          pattern_tag: patternTag,
        });
        continue;
      }

      // Query candidates from pattern_bank matching pattern and allowed difficulties
      const allowedDifficulties = getAllowedDifficulties(rev.difficulty as Difficulty, userStatsParsed);

      const candidateRes = await query<{
        id: string;
        name: string;
        link: string;
        pattern_tag: string;
        difficulty: 'easy' | 'medium' | 'hard';
      }>(
        `SELECT id, name, link, pattern_tag, difficulty
         FROM public.pattern_bank
         WHERE pattern_tag = $1
           AND difficulty = ANY($2)
         ORDER BY difficulty ASC, name ASC;`,
        [patternTag, allowedDifficulties]
      );

      // Exclude already solved problems and the original problem itself
      let availableCandidates = candidateRes.rows.filter(
        (cand) => cand.link !== rev.problem_link && !solvedLinksSet.has(cand.link)
      );

      // Exhaustion Fallback: Check if available candidate pool is low (< 5)
      const EXHAUSTION_THRESHOLD = 5;
      if (availableCandidates.length < EXHAUSTION_THRESHOLD) {
        if (availableCandidates.length > 0) {
          // If we still have at least 1 candidate, trigger background top-up asynchronously (non-blocking)
          // so this request completes instantly without latency, while replenishing the bank for future cycles.
          topUpPatternBank({
            patternTag,
            userId: user.id,
            userSolvedLinks: solvedLinksSet,
            targetAdd: 10,
            timeoutMs: 5000,
          }).catch((err) => console.warn('[Background Top-up Error]:', err.message));
        } else {
          // Pool is completely empty (0 candidates). Try a short-budget live fetch (1500ms).
          try {
            const liveResult = await Promise.race([
              topUpPatternBank({
                patternTag,
                userId: user.id,
                userSolvedLinks: solvedLinksSet,
                targetAdd: 10,
                timeoutMs: 2500,
              }),
              new Promise<null>((resolve) => setTimeout(() => resolve(null), 1500)),
            ]);

            if (liveResult && liveResult.problemsAdded > 0) {
              // Re-query database for newly added candidates
              const refetchRes = await query<{
                id: string;
                name: string;
                link: string;
                pattern_tag: string;
                difficulty: 'easy' | 'medium' | 'hard';
              }>(
                `SELECT id, name, link, pattern_tag, difficulty
                 FROM public.pattern_bank
                 WHERE pattern_tag = $1
                   AND difficulty = ANY($2)
                 ORDER BY difficulty ASC, name ASC;`,
                [patternTag, allowedDifficulties]
              );
              availableCandidates = refetchRes.rows.filter(
                (cand) => cand.link !== rev.problem_link && !solvedLinksSet.has(cand.link)
              );
            }
          } catch (liveErr: any) {
            console.warn('[Live Fallback Error]:', liveErr.message);
          }
        }
      }

      if (availableCandidates.length === 0) {
        // Fallback gracefully to original problem if no unseen candidate is available in time
        processedRevisions.push({
          ...rev,
          is_pattern_substitution: false,
          hint_free_revision_count: hintFreeCount,
          pattern_tag: patternTag,
        });
        continue;
      }

      // Pick a candidate deterministically using hash
      const candidateIndex = hash % availableCandidates.length;
      const chosen = availableCandidates[candidateIndex];
      const patternHumanName = PATTERN_NAMES[patternTag] || patternTag;

      processedRevisions.push({
        id: rev.id, // Original revision_schedule ID
        user_id: rev.user_id,
        problem_id: rev.problem_id, // Original problem ID
        original_problem_id: rev.problem_id,
        original_problem_name: rev.problem_name,
        original_problem_link: rev.problem_link,
        original_difficulty: rev.difficulty,

        // Substituted problem metadata
        is_pattern_substitution: true,
        pattern_tag: patternTag,
        pattern_name: patternHumanName,
        problem_name: chosen.name,
        problem_link: chosen.link,
        difficulty: chosen.difficulty,
        topic_tags: [patternTag, ...(rev.topic_tags || [])],

        // Schedule metrics
        ease_factor: rev.ease_factor,
        current_interval_days: rev.current_interval_days,
        next_due_date: rev.next_due_date,
        retention_score: rev.retention_score,
        last_updated: rev.last_updated,
        hint_free_revision_count: hintFreeCount,
      });
    }

    return NextResponse.json(
      {
        success: true,
        count: processedRevisions.length,
        data: processedRevisions,
      },
      { status: 200 }
    );
  } catch (error: any) {
    console.error('Error in GET /api/revisions/due:', error);
    return NextResponse.json(
      { error: 'Internal Server Error', message: error.message || 'An unexpected error occurred' },
      { status: 500 }
    );
  }
}
