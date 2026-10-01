import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { getAuthenticatedUser } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export interface TopicWeaknessItem {
  topic: string;
  total_problems_logged: number;
  total_solves: number;
  hint_free_solves: number;
  hint_free_rate: number; // 0 - 100 percentage
  average_retention_score: number; // 0 - 100
  retention_tier: 'danger' | 'warning' | 'normal';
}

export interface InsufficientTopicItem {
  topic: string;
  total_problems_logged: number;
  hint_free_rate: number;
  average_retention_score: number;
  reason: string;
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

    // 2. Query stats grouped by unnested topic tag
    // Normalizes common singular/plural variations like 'array' -> 'arrays', 'string' -> 'strings'
    const sql = `
      WITH normalized_problems AS (
        SELECT 
          p.id AS problem_id,
          CASE 
            WHEN LOWER(TRIM(tag)) = 'array' THEN 'arrays'
            WHEN LOWER(TRIM(tag)) = 'string' THEN 'strings'
            WHEN LOWER(TRIM(tag)) = 'graph' THEN 'graphs'
            WHEN LOWER(TRIM(tag)) = 'tree' THEN 'trees'
            WHEN LOWER(TRIM(tag)) = 'heap' THEN 'heaps'
            ELSE LOWER(TRIM(tag))
          END AS topic
        FROM public.problems p
        JOIN public.solves s ON s.problem_id = p.id AND s.user_id = $1
        CROSS JOIN unnest(p.topic_tags) AS tag
        GROUP BY p.id, topic
      ),
      topic_solves AS (
        SELECT 
          CASE 
            WHEN LOWER(TRIM(tag)) = 'array' THEN 'arrays'
            WHEN LOWER(TRIM(tag)) = 'string' THEN 'strings'
            WHEN LOWER(TRIM(tag)) = 'graph' THEN 'graphs'
            WHEN LOWER(TRIM(tag)) = 'tree' THEN 'trees'
            WHEN LOWER(TRIM(tag)) = 'heap' THEN 'heaps'
            ELSE LOWER(TRIM(tag))
          END AS topic,
          s.id AS solve_id,
          s.hint_usage
        FROM public.solves s
        JOIN public.problems p ON p.id = s.problem_id
        CROSS JOIN unnest(p.topic_tags) AS tag
        WHERE s.user_id = $1
      ),
      topic_retention AS (
        SELECT 
          np.topic,
          COUNT(DISTINCT np.problem_id)::integer AS total_problems_logged,
          ROUND(AVG(r.retention_score)::numeric, 1)::float AS average_retention_score
        FROM normalized_problems np
        JOIN public.revision_schedule r ON r.problem_id = np.problem_id AND r.user_id = $1
        GROUP BY np.topic
      ),
      topic_hints AS (
        SELECT 
          ts.topic,
          COUNT(ts.solve_id)::integer AS total_solves,
          COUNT(CASE WHEN ts.hint_usage = 'none' THEN 1 END)::integer AS hint_free_solves,
          ROUND(
            (COUNT(CASE WHEN ts.hint_usage = 'none' THEN 1 END)::numeric / NULLIF(COUNT(ts.solve_id), 0)) * 100,
            1
          )::float AS hint_free_rate
        FROM topic_solves ts
        GROUP BY ts.topic
      )
      SELECT 
        tr.topic,
        tr.total_problems_logged,
        COALESCE(th.total_solves, 0)::integer AS total_solves,
        COALESCE(th.hint_free_solves, 0)::integer AS hint_free_solves,
        COALESCE(th.hint_free_rate, 0)::float AS hint_free_rate,
        COALESCE(tr.average_retention_score, 0)::float AS average_retention_score
      FROM topic_retention tr
      LEFT JOIN topic_hints th ON th.topic = tr.topic
      ORDER BY tr.average_retention_score ASC, tr.total_problems_logged DESC;
    `;

    const res = await query(sql, [user.id]);
    const allTopics = res.rows;

    const rankedTopics: TopicWeaknessItem[] = [];
    const insufficientTopics: InsufficientTopicItem[] = [];

    allTopics.forEach((t) => {
      const avgScore = Number(t.average_retention_score);
      const hintRate = Number(t.hint_free_rate);
      const problemsCount = Number(t.total_problems_logged);

      let tier: 'danger' | 'warning' | 'normal' = 'normal';
      if (avgScore < 40) {
        tier = 'danger';
      } else if (avgScore <= 70) {
        tier = 'warning';
      }

      if (problemsCount >= 3) {
        rankedTopics.push({
          topic: t.topic,
          total_problems_logged: problemsCount,
          total_solves: Number(t.total_solves),
          hint_free_solves: Number(t.hint_free_solves),
          hint_free_rate: hintRate,
          average_retention_score: avgScore,
          retention_tier: tier,
        });
      } else {
        insufficientTopics.push({
          topic: t.topic,
          total_problems_logged: problemsCount,
          hint_free_rate: hintRate,
          average_retention_score: avgScore,
          reason: `Requires at least 3 logged problems to rank (currently ${problemsCount})`,
        });
      }
    });

    // 3. Compute dynamic takeaway line
    let takeaway: {
      weakest_topic: string | null;
      summary: string;
      hint_free_rate?: number;
      average_retention_score?: number;
    } | null = null;

    if (rankedTopics.length > 0) {
      const weakest = rankedTopics[0];
      takeaway = {
        weakest_topic: weakest.topic,
        hint_free_rate: weakest.hint_free_rate,
        average_retention_score: weakest.average_retention_score,
        summary: `Focus next: ${weakest.topic} — only ${weakest.hint_free_rate}% retained without hints (avg. retention: ${weakest.average_retention_score}%)`,
      };
    }

    return NextResponse.json(
      {
        success: true,
        ranked_topics: rankedTopics,
        insufficient_data_topics: insufficientTopics,
        total_ranked: rankedTopics.length,
        total_insufficient: insufficientTopics.length,
        takeaway,
      },
      { status: 200 }
    );
  } catch (error: any) {
    console.error('Error in GET /api/topics/weakness:', error);
    return NextResponse.json(
      { error: 'Internal Server Error', message: error.message || 'An unexpected error occurred' },
      { status: 500 }
    );
  }
}
