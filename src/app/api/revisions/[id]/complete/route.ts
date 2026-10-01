import { NextResponse } from 'next/server';
import { z } from 'zod';
import { query } from '@/lib/db';
import { getAuthenticatedUser } from '@/lib/auth';
import {
  computeNextRevision,
  computeRetentionScore,
  Difficulty,
} from '@/lib/scheduling';

export const dynamic = 'force-dynamic';

const CompleteRevisionSchema = z.object({
  was_hint_free: z.boolean({
    required_error: 'was_hint_free is required',
    invalid_type_error: 'was_hint_free must be a boolean',
  }),
  new_confidence_rating: z
    .number({
      required_error: 'new_confidence_rating is required',
      invalid_type_error: 'new_confidence_rating must be a number',
    })
    .int('new_confidence_rating must be an integer')
    .min(1, 'new_confidence_rating must be between 1 and 5')
    .max(5, 'new_confidence_rating must be between 1 and 5'),
  time_taken_seconds: z
    .number({ invalid_type_error: 'time_taken_seconds must be a number' })
    .int('time_taken_seconds must be an integer')
    .min(0, 'time_taken_seconds must be >= 0')
    .optional(),
});

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
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

    // 2. Validate revision ID parameter
    const revisionId = params.id;
    if (!revisionId || !UUID_REGEX.test(revisionId)) {
      return NextResponse.json(
        { error: 'Bad Request', message: 'Invalid revision schedule ID format (must be a valid UUID)' },
        { status: 400 }
      );
    }

    // 3. Validate request body
    let body: any;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { error: 'Invalid JSON', message: 'Request body must be valid JSON' },
        { status: 400 }
      );
    }

    const parseResult = CompleteRevisionSchema.safeParse(body);
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

    const { was_hint_free, new_confidence_rating, time_taken_seconds } = parseResult.data;

    // 4. Fetch the revision schedule (and associated problem difficulty)
    const revisionRes = await query<{
      id: string;
      user_id: string;
      problem_id: string;
      ease_factor: number;
      current_interval_days: number;
      next_due_date: string;
      retention_score: number;
      difficulty: Difficulty;
    }>(
      `SELECT 
         r.id,
         r.user_id,
         r.problem_id,
         r.ease_factor,
         r.current_interval_days,
         r.next_due_date,
         r.retention_score,
         p.difficulty
       FROM public.revision_schedule r
       INNER JOIN public.problems p ON p.id = r.problem_id
       WHERE r.id = $1 AND r.user_id = $2
       LIMIT 1;`,
      [revisionId, user.id]
    );

    if (revisionRes.rows.length === 0) {
      return NextResponse.json(
        {
          error: 'Not Found',
          message: `Revision schedule with ID '${revisionId}' not found for current user`,
        },
        { status: 404 }
      );
    }

    const existingSchedule = revisionRes.rows[0];

    // 5. Apply SM-2-style scheduling logic
    const { new_interval_days, new_ease_factor, next_due_date } = computeNextRevision({
      was_hint_free,
      current_interval_days: existingSchedule.current_interval_days,
      ease_factor: existingSchedule.ease_factor,
    });

    // 6. Recompute retention score
    const derivedHintUsage = was_hint_free ? 'none' : 'partial';
    const newRetentionScore = computeRetentionScore({
      hint_usage: derivedHintUsage,
      difficulty: existingSchedule.difficulty,
      time_taken_seconds,
      confidence_rating: new_confidence_rating,
    });

    // 7. Update revision_schedule table
    const updateRes = await query(
      `UPDATE public.revision_schedule
       SET 
         ease_factor = $1,
         current_interval_days = $2,
         next_due_date = $3,
         retention_score = $4,
         last_updated = now()
       WHERE id = $5 AND user_id = $6
       RETURNING id, user_id, problem_id, ease_factor, current_interval_days, next_due_date, retention_score, last_updated;`,
      [new_ease_factor, new_interval_days, next_due_date, newRetentionScore, revisionId, user.id]
    );

    const updatedSchedule = updateRes.rows[0];

    // 8. Log cycle into revision_history table
    await query(
      `INSERT INTO public.revision_history 
         (user_id, problem_id, completed_at, was_hint_free, resulting_interval_days)
       VALUES ($1, $2, now(), $3, $4);`,
      [user.id, existingSchedule.problem_id, was_hint_free, new_interval_days]
    );

    return NextResponse.json(
      {
        success: true,
        message: 'Revision completed and schedule updated',
        data: {
          previous_state: {
            ease_factor: existingSchedule.ease_factor,
            interval_days: existingSchedule.current_interval_days,
            retention_score: existingSchedule.retention_score,
          },
          updated_schedule: updatedSchedule,
        },
      },
      { status: 200 }
    );
  } catch (error: any) {
    console.error('Error in POST /api/revisions/:id/complete:', error);
    return NextResponse.json(
      { error: 'Internal Server Error', message: error.message || 'An unexpected error occurred' },
      { status: 500 }
    );
  }
}
