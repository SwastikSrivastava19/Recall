-- Migration: 20260929172510_create_recall_schema.sql
-- Description: Schema setup for Recall (spaced-repetition DSA)
-- Tables: problems, solves, revision_schedule

-- 1. Create problems table
CREATE TABLE IF NOT EXISTS public.problems (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    link TEXT NOT NULL,
    topic_tags TEXT[] NOT NULL DEFAULT '{}',
    difficulty TEXT NOT NULL CHECK (difficulty IN ('easy', 'medium', 'hard')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2. Create solves table
CREATE TABLE IF NOT EXISTS public.solves (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    problem_id UUID NOT NULL REFERENCES public.problems(id) ON DELETE CASCADE,
    solved_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    hint_usage TEXT NOT NULL CHECK (hint_usage IN ('none', 'partial', 'full_editorial')),
    time_taken_seconds INTEGER NOT NULL CHECK (time_taken_seconds >= 0),
    confidence_rating INTEGER NOT NULL CHECK (confidence_rating >= 1 AND confidence_rating <= 5)
);

-- 3. Create revision_schedule table
CREATE TABLE IF NOT EXISTS public.revision_schedule (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    problem_id UUID NOT NULL REFERENCES public.problems(id) ON DELETE CASCADE,
    ease_factor DOUBLE PRECISION NOT NULL DEFAULT 2.5,
    current_interval_days INTEGER NOT NULL DEFAULT 1,
    next_due_date DATE NOT NULL,
    retention_score DOUBLE PRECISION NOT NULL DEFAULT 0,
    last_updated TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT revision_schedule_user_problem_unique UNIQUE (user_id, problem_id)
);

-- 4. Create Indexes
-- Revision schedule indexes (fast querying of due today revisions by user)
CREATE INDEX IF NOT EXISTS idx_revision_schedule_user_due_date 
    ON public.revision_schedule (user_id, next_due_date);

CREATE INDEX IF NOT EXISTS idx_revision_schedule_user_id 
    ON public.revision_schedule (user_id);

CREATE INDEX IF NOT EXISTS idx_revision_schedule_problem_id 
    ON public.revision_schedule (problem_id);

CREATE INDEX IF NOT EXISTS idx_revision_schedule_next_due_date 
    ON public.revision_schedule (next_due_date);

-- Solves indexes
CREATE INDEX IF NOT EXISTS idx_solves_user_id 
    ON public.solves (user_id);

CREATE INDEX IF NOT EXISTS idx_solves_problem_id 
    ON public.solves (problem_id);

CREATE INDEX IF NOT EXISTS idx_solves_user_problem 
    ON public.solves (user_id, problem_id);

CREATE INDEX IF NOT EXISTS idx_solves_solved_at 
    ON public.solves (solved_at DESC);

-- Problems indexes
CREATE INDEX IF NOT EXISTS idx_problems_difficulty 
    ON public.problems (difficulty);

CREATE INDEX IF NOT EXISTS idx_problems_topic_tags 
    ON public.problems USING GIN (topic_tags);

-- 5. Enable Row Level Security (RLS)
ALTER TABLE public.problems ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.solves ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.revision_schedule ENABLE ROW LEVEL SECURITY;

-- 6. RLS Policies: problems
-- Readable by all authenticated users
CREATE POLICY "Allow authenticated users to read problems"
    ON public.problems
    FOR SELECT
    TO authenticated
    USING (true);

-- Writable only by admin role
CREATE POLICY "Allow admin users to insert problems"
    ON public.problems
    FOR INSERT
    TO authenticated
    WITH CHECK (
        (auth.jwt() ->> 'role') = 'admin' OR 
        (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
    );

CREATE POLICY "Allow admin users to update problems"
    ON public.problems
    FOR UPDATE
    TO authenticated
    USING (
        (auth.jwt() ->> 'role') = 'admin' OR 
        (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
    )
    WITH CHECK (
        (auth.jwt() ->> 'role') = 'admin' OR 
        (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
    );

CREATE POLICY "Allow admin users to delete problems"
    ON public.problems
    FOR DELETE
    TO authenticated
    USING (
        (auth.jwt() ->> 'role') = 'admin' OR 
        (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
    );

-- 7. RLS Policies: solves
-- Users can only read/write their own rows
CREATE POLICY "Users can view their own solves"
    ON public.solves
    FOR SELECT
    TO authenticated
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own solves"
    ON public.solves
    FOR INSERT
    TO authenticated
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own solves"
    ON public.solves
    FOR UPDATE
    TO authenticated
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own solves"
    ON public.solves
    FOR DELETE
    TO authenticated
    USING (auth.uid() = user_id);

-- 8. RLS Policies: revision_schedule
-- Users can only read/write their own rows
CREATE POLICY "Users can view their own revision schedule"
    ON public.revision_schedule
    FOR SELECT
    TO authenticated
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own revision schedule"
    ON public.revision_schedule
    FOR INSERT
    TO authenticated
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own revision schedule"
    ON public.revision_schedule
    FOR UPDATE
    TO authenticated
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own revision schedule"
    ON public.revision_schedule
    FOR DELETE
    TO authenticated
    USING (auth.uid() = user_id);
