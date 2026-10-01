-- Migration: 20261001150000_create_pattern_fallback_logs.sql
-- Description: Audit log for live exhaustion fallback when pattern bank runs low for a user

CREATE TABLE IF NOT EXISTS public.pattern_fallback_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    pattern_tag TEXT NOT NULL,
    user_id UUID,
    problems_added INT NOT NULL DEFAULT 0,
    remaining_candidates INT NOT NULL DEFAULT 0,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_pattern_fallback_logs_tag 
    ON public.pattern_fallback_logs (pattern_tag);

CREATE INDEX IF NOT EXISTS idx_pattern_fallback_logs_created 
    ON public.pattern_fallback_logs (created_at DESC);

ALTER TABLE public.pattern_fallback_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow authenticated read pattern_fallback_logs"
    ON public.pattern_fallback_logs
    FOR SELECT
    TO authenticated
    USING (true);

CREATE POLICY "Allow server insert pattern_fallback_logs"
    ON public.pattern_fallback_logs
    FOR INSERT
    TO authenticated
    WITH CHECK (true);
