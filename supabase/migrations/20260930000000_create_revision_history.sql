-- Migration: 20260930000000_create_revision_history.sql
-- Description: Table for tracking revision history cycles to compute interview readiness

CREATE TABLE IF NOT EXISTS public.revision_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    problem_id UUID NOT NULL REFERENCES public.problems(id) ON DELETE CASCADE,
    completed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    was_hint_free BOOLEAN NOT NULL,
    resulting_interval_days INTEGER NOT NULL
);

-- Indexes for fast querying of mature problems and historical trends
CREATE INDEX IF NOT EXISTS idx_revision_history_user_problem 
    ON public.revision_history (user_id, problem_id);

CREATE INDEX IF NOT EXISTS idx_revision_history_user_completed 
    ON public.revision_history (user_id, completed_at);

-- Row Level Security
ALTER TABLE public.revision_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own revision history"
    ON public.revision_history
    FOR SELECT
    TO authenticated
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own revision history"
    ON public.revision_history
    FOR INSERT
    TO authenticated
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own revision history"
    ON public.revision_history
    FOR DELETE
    TO authenticated
    USING (auth.uid() = user_id);
