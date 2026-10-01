export type Difficulty = 'easy' | 'medium' | 'hard';
export type HintUsage = 'none' | 'partial' | 'full_editorial';

export const DIFFICULTY_BASELINES: Record<Difficulty, number> = {
  easy: 600,
  medium: 1200,
  hard: 2400,
};

export interface RetentionScoreParams {
  hint_usage: HintUsage;
  difficulty?: Difficulty;
  time_taken_seconds?: number;
  confidence_rating: number;
}

/**
 * Computes the retention score (0-100) based on hint usage, solve time, and confidence.
 */
export function computeRetentionScore(params: RetentionScoreParams): number {
  let score = 100;

  // Hint penalty
  if (params.hint_usage === 'partial') {
    score -= 30;
  } else if (params.hint_usage === 'full_editorial') {
    score -= 60;
  }

  // Time penalty: if > 2x baseline for difficulty, subtract 15
  if (params.difficulty && typeof params.time_taken_seconds === 'number') {
    const baseline = DIFFICULTY_BASELINES[params.difficulty];
    if (baseline && params.time_taken_seconds > 2 * baseline) {
      score -= 15;
    }
  }

  // Confidence adjustment: (confidence_rating - 3) * 5
  // confidence 5 -> +10, 4 -> +5, 3 -> 0, 2 -> -5, 1 -> -10
  score += (params.confidence_rating - 3) * 5;

  // Clamp between 0 and 100
  return Math.max(0, Math.min(100, Math.round(score)));
}

export interface NextRevisionParams {
  was_hint_free: boolean;
  current_interval_days: number;
  ease_factor: number;
}

export interface NextRevisionResult {
  new_interval_days: number;
  new_ease_factor: number;
  next_due_date: string; // YYYY-MM-DD
}

/**
 * Computes the next interval, ease factor, and due date using SM-2-style scheduling.
 */
export function computeNextRevision(params: NextRevisionParams): NextRevisionResult {
  let new_interval_days: number;
  let new_ease_factor: number;

  if (params.was_hint_free) {
    new_interval_days = Math.round(params.current_interval_days * params.ease_factor);
    if (new_interval_days < 1) new_interval_days = 1;
    // ease_factor += 0.1 (capped at 3.0)
    new_ease_factor = Number(Math.min(3.0, params.ease_factor + 0.1).toFixed(2));
  } else {
    // If hints were used, reset interval to 1 day
    new_interval_days = 1;
    // ease_factor = max(1.3, ease_factor - 0.2)
    new_ease_factor = Number(Math.max(1.3, params.ease_factor - 0.2).toFixed(2));
  }

  // next_due_date = today + current_interval_days
  const nextDate = new Date();
  nextDate.setDate(nextDate.getDate() + new_interval_days);
  const next_due_date = nextDate.toISOString().split('T')[0];

  return {
    new_interval_days,
    new_ease_factor,
    next_due_date,
  };
}

/**
 * Returns tomorrow's date string in YYYY-MM-DD format.
 */
export function getTomorrowDateString(): string {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  return tomorrow.toISOString().split('T')[0];
}
