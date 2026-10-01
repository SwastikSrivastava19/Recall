import { NextResponse } from 'next/server';
import { z } from 'zod';
import { query } from '@/lib/db';
import { getAuthenticatedUser } from '@/lib/auth';
import {
  computeRetentionScore,
  getTomorrowDateString,
  Difficulty,
  HintUsage,
} from '@/lib/scheduling';

export const dynamic = 'force-dynamic';

const SolveInputSchema = z.object({
  problem_name: z.string().trim().min(1, 'problem_name is required'),
  problem_link: z.string().trim().min(1, 'problem_link is required'),
  topic_tags: z.array(z.string()).default([]),
  difficulty: z.enum(['easy', 'medium', 'hard'], {
    errorMap: () => ({ message: "difficulty must be 'easy', 'medium', or 'hard'" }),
  }),
  hint_usage: z.enum(['none', 'partial', 'full_editorial'], {
    errorMap: () => ({ message: "hint_usage must be 'none', 'partial', or 'full_editorial'" }),
  }),
  time_taken_seconds: z
    .number({ invalid_type_error: 'time_taken_seconds must be a number' })
    .int('time_taken_seconds must be an integer')
    .min(0, 'time_taken_seconds must be >= 0'),
  confidence_rating: z
    .number({ invalid_type_error: 'confidence_rating must be a number' })
    .int('confidence_rating must be an integer')
    .min(1, 'confidence_rating must be between 1 and 5')
    .max(5, 'confidence_rating must be between 1 and 5'),
  next_due_date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'next_due_date must be in YYYY-MM-DD format')
    .optional(),
});

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-user-id',
    },
  });
}

export async function POST(request: Request) {
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-user-id',
  };

  try {
    // 1. Authenticate user
    const authResult = await getAuthenticatedUser(request);
    if (!authResult.authenticated || !authResult.user) {
      return NextResponse.json(
        { error: 'Unauthorized', message: authResult.error || 'Authentication required' },
        { status: 401, headers: corsHeaders }
      );
    }
    const user = authResult.user;

    // 2. Validate input body
    let body: any;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { error: 'Invalid JSON', message: 'Request body must be valid JSON' },
        { status: 400 }
      );
    }

    const parseResult = SolveInputSchema.safeParse(body);
    if (!parseResult.success) {
      return NextResponse.json(
        {
          error: 'Validation Error',
          details: parseResult.error.errors.map((e) => ({
            field: e.path.join('.'),
            message: e.message,
          })),
        },
        { status: 400 }
      );
    }

    const {
      problem_name,
      problem_link,
      topic_tags,
      difficulty,
      hint_usage,
      time_taken_seconds,
      confidence_rating,
      next_due_date: customNextDueDate,
    } = parseResult.data;

    // 3. Ensure problem exists in problems table (match by link)
    let problemId: string;
    const existingProblemRes = await query<{ id: string }>(
      'SELECT id FROM public.problems WHERE link = $1 LIMIT 1;',
      [problem_link]
    );

    if (existingProblemRes.rows.length > 0) {
      problemId = existingProblemRes.rows[0].id;
    } else {
      const insertProblemRes = await query<{ id: string }>(
        `INSERT INTO public.problems (name, link, topic_tags, difficulty)
         VALUES ($1, $2, $3, $4)
         RETURNING id;`,
        [problem_name, problem_link, topic_tags, difficulty]
      );
      problemId = insertProblemRes.rows[0].id;
    }

    // 4. Insert row into solves
    const insertSolveRes = await query(
      `INSERT INTO public.solves (user_id, problem_id, hint_usage, time_taken_seconds, confidence_rating)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, user_id, problem_id, solved_at, hint_usage, time_taken_seconds, confidence_rating;`,
      [user.id, problemId, hint_usage, time_taken_seconds, confidence_rating]
    );
    const solve = insertSolveRes.rows[0];

    // 5. Compute retention score
    const retentionScore = computeRetentionScore({
      hint_usage: hint_usage as HintUsage,
      difficulty: difficulty as Difficulty,
      time_taken_seconds,
      confidence_rating,
    });

    // 6. Manage revision_schedule
    // Default next_due_date = tomorrow (or custom override if specified for testing)
    const nextDueDate = customNextDueDate || getTomorrowDateString();

    const scheduleRes = await query(
      `INSERT INTO public.revision_schedule 
         (user_id, problem_id, ease_factor, current_interval_days, next_due_date, retention_score, last_updated)
       VALUES ($1, $2, 2.5, 1, $3, $4, now())
       ON CONFLICT (user_id, problem_id) DO UPDATE SET
         retention_score = EXCLUDED.retention_score,
         last_updated = now()
       RETURNING id, user_id, problem_id, ease_factor, current_interval_days, next_due_date, retention_score, last_updated;`,
      [user.id, problemId, nextDueDate, retentionScore]
    );
    const revisionSchedule = scheduleRes.rows[0];

    return NextResponse.json(
      {
        success: true,
        message: 'Solve logged successfully and revision scheduled',
        data: {
          solve,
          revision_schedule: revisionSchedule,
          retention_score: retentionScore,
        },
      },
      { status: 201, headers: corsHeaders }
    );
  } catch (error: any) {
    console.error('Error in POST /api/solves:', error);
    return NextResponse.json(
      { error: 'Internal Server Error', message: error.message || 'An unexpected error occurred' },
      { status: 500, headers: corsHeaders }
    );
  }
}
