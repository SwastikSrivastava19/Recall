import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { getAuthenticatedUser } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export interface TopicReadinessItem {
  topic: string;
  total_problems_logged: number;
  mature_problems_count: number;
  readiness_percentage: number;
  retention_tier: 'danger' | 'warning' | 'normal';
}

export interface ReadinessTrendPoint {
  week_label: string;
  date: string;
  mature_count: number;
  total_count: number;
  readiness_percentage: number;
}

function getInterpretation(percentage: number): string {
  if (percentage < 40) {
    return "Not yet interview-ready — most of your practice hasn't been retention-tested.";
  } else if (percentage <= 70) {
    return 'Getting there — keep completing revisions.';
  } else {
    return 'Solid — your practice is holding up over time.';
  }
}

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

    // 2. Identify mature problems for this user
    // A problem is mature if it has reached at least 2 successful hint-free revision cycles in revision_history
    const matureProblemsRes = await query<{ problem_id: string; hint_free_cycles: number }>(
      `SELECT problem_id, COUNT(*)::integer AS hint_free_cycles
       FROM public.revision_history
       WHERE user_id = $1 AND was_hint_free = true
       GROUP BY problem_id
       HAVING COUNT(*) >= 2;`,
      [user.id]
    );

    const matureProblemIds = new Set<string>(matureProblemsRes.rows.map((r) => r.problem_id));
    const matureCount = matureProblemIds.size;

    // 3. Count total distinct problems logged by the user
    const totalProblemsRes = await query<{ count: string }>(
      `SELECT COUNT(DISTINCT problem_id)::integer AS count
       FROM public.solves
       WHERE user_id = $1;`,
      [user.id]
    );
    const totalProblemsLogged = parseInt(totalProblemsRes.rows[0]?.count || '0', 10);

    const overallReadiness =
      totalProblemsLogged > 0 ? Math.round((matureCount / totalProblemsLogged) * 100) : 0;

    // 4. Per-topic readiness
    // Only topics with >= 3 logged problems are included in ranked list
    const topicStatsRes = await query<{
      topic: string;
      problem_id: string;
    }>(
      `SELECT 
         CASE 
           WHEN LOWER(TRIM(tag)) = 'array' THEN 'arrays'
           WHEN LOWER(TRIM(tag)) = 'string' THEN 'strings'
           WHEN LOWER(TRIM(tag)) = 'graph' THEN 'graphs'
           WHEN LOWER(TRIM(tag)) = 'tree' THEN 'trees'
           WHEN LOWER(TRIM(tag)) = 'heap' THEN 'heaps'
           ELSE LOWER(TRIM(tag))
         END AS topic,
         p.id AS problem_id
       FROM public.problems p
       JOIN public.solves s ON s.problem_id = p.id AND s.user_id = $1
       CROSS JOIN unnest(p.topic_tags) AS tag
       GROUP BY p.id, topic;`,
      [user.id]
    );

    // Group distinct problems per topic
    const topicProblemsMap: Record<string, Set<string>> = {};
    topicStatsRes.rows.forEach((row) => {
      if (!topicProblemsMap[row.topic]) {
        topicProblemsMap[row.topic] = new Set();
      }
      topicProblemsMap[row.topic].add(row.problem_id);
    });

    const rankedTopics: TopicReadinessItem[] = [];
    const insufficientTopics: Array<{
      topic: string;
      total_problems_logged: number;
      mature_problems_count: number;
      readiness_percentage: number;
      reason: string;
    }> = [];

    Object.keys(topicProblemsMap).forEach((topic) => {
      const pIds = topicProblemsMap[topic];
      const total = pIds.size;
      let matureInTopic = 0;
      pIds.forEach((pid) => {
        if (matureProblemIds.has(pid)) {
          matureInTopic++;
        }
      });

      const readinessPct = total > 0 ? Math.round((matureInTopic / total) * 100) : 0;
      let tier: 'danger' | 'warning' | 'normal' = 'normal';
      if (readinessPct < 40) tier = 'danger';
      else if (readinessPct <= 70) tier = 'warning';

      if (total >= 3) {
        rankedTopics.push({
          topic,
          total_problems_logged: total,
          mature_problems_count: matureInTopic,
          readiness_percentage: readinessPct,
          retention_tier: tier,
        });
      } else {
        insufficientTopics.push({
          topic,
          total_problems_logged: total,
          mature_problems_count: matureInTopic,
          readiness_percentage: readinessPct,
          reason: `Requires at least 3 logged problems to rank (currently ${total})`,
        });
      }
    });

    // Sort ranked topics ascending (weakest readiness first)
    rankedTopics.sort((a, b) => a.readiness_percentage - b.readiness_percentage);

    // 5. Readiness trend for last 8 weeks
    // Compute readiness as of the end of each of the past 8 weekly intervals
    const now = new Date();
    const trendPoints: ReadinessTrendPoint[] = [];

    // Pre-fetch all solves and hint-free revision events with completed_at timestamps
    const userSolvesTimelineRes = await query<{ problem_id: string; solved_at: string }>(
      `SELECT problem_id, solved_at FROM public.solves WHERE user_id = $1;`,
      [user.id]
    );

    const userHistoryTimelineRes = await query<{ problem_id: string; completed_at: string }>(
      `SELECT problem_id, completed_at 
       FROM public.revision_history 
       WHERE user_id = $1 AND was_hint_free = true;`,
      [user.id]
    );

    for (let i = 7; i >= 0; i--) {
      const cutoffDate = new Date(now.getTime() - i * 7 * 24 * 60 * 60 * 1000);
      const cutoffIso = cutoffDate.toISOString();
      const cutoffLabel = i === 0 ? 'Current' : `W-${i}`;

      // Total distinct problems logged on or before cutoff
      const totalCutoffProblems = new Set(
        userSolvesTimelineRes.rows
          .filter((s) => new Date(s.solved_at) <= cutoffDate)
          .map((s) => s.problem_id)
      ).size;

      // Count mature problems on or before cutoff (problems with >= 2 hint-free completed revisions)
      const problemHintFreeCounts: Record<string, number> = {};
      userHistoryTimelineRes.rows
        .filter((h) => new Date(h.completed_at) <= cutoffDate)
        .forEach((h) => {
          problemHintFreeCounts[h.problem_id] = (problemHintFreeCounts[h.problem_id] || 0) + 1;
        });

      let matureAtCutoff = 0;
      Object.values(problemHintFreeCounts).forEach((c) => {
        if (c >= 2) matureAtCutoff++;
      });

      const readinessAtCutoff =
        totalCutoffProblems > 0 ? Math.round((matureAtCutoff / totalCutoffProblems) * 100) : 0;

      trendPoints.push({
        week_label: cutoffLabel,
        date: cutoffIso.split('T')[0],
        mature_count: matureAtCutoff,
        total_count: totalCutoffProblems,
        readiness_percentage: readinessAtCutoff,
      });
    }

    const interpretation = getInterpretation(overallReadiness);

    return NextResponse.json(
      {
        success: true,
        overall_readiness: overallReadiness,
        mature_problems_count: matureCount,
        total_problems_logged: totalProblemsLogged,
        interpretation,
        ranked_topics: rankedTopics,
        insufficient_topics: insufficientTopics,
        readiness_trend: trendPoints,
      },
      { status: 200 }
    );
  } catch (error: any) {
    console.error('Error in GET /api/readiness:', error);
    return NextResponse.json(
      { error: 'Internal Server Error', message: error.message || 'An unexpected error occurred' },
      { status: 500 }
    );
  }
}
