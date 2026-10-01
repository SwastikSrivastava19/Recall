-- Migration: 20260930100000_create_pattern_bank.sql
-- Description: Pattern bank table and user settings for pattern substitution (Step 11)

-- 1. Create pattern_bank table
CREATE TABLE IF NOT EXISTS public.pattern_bank (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    link TEXT NOT NULL UNIQUE,
    pattern_tag TEXT NOT NULL,
    difficulty TEXT NOT NULL CHECK (difficulty IN ('easy', 'medium', 'hard')),
    is_curated BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2. Indexes for pattern bank querying
CREATE INDEX IF NOT EXISTS idx_pattern_bank_pattern_tag 
    ON public.pattern_bank (pattern_tag);

CREATE INDEX IF NOT EXISTS idx_pattern_bank_difficulty 
    ON public.pattern_bank (difficulty);

CREATE INDEX IF NOT EXISTS idx_pattern_bank_pattern_diff 
    ON public.pattern_bank (pattern_tag, difficulty);

CREATE INDEX IF NOT EXISTS idx_pattern_bank_link 
    ON public.pattern_bank (link);

-- 3. Row Level Security for pattern_bank
ALTER TABLE public.pattern_bank ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow authenticated users to read pattern_bank"
    ON public.pattern_bank
    FOR SELECT
    TO authenticated
    USING (true);

CREATE POLICY "Allow admin to manage pattern_bank"
    ON public.pattern_bank
    FOR ALL
    TO authenticated
    USING (
        (auth.jwt() ->> 'role') = 'admin' OR 
        (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
    );

-- 4. User settings table for LeetCode profile linking & personalization
CREATE TABLE IF NOT EXISTS public.user_settings (
    user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    leetcode_username TEXT,
    leetcode_profile_url TEXT,
    leetcode_stats JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.user_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own settings"
    ON public.user_settings
    FOR SELECT
    TO authenticated
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own settings"
    ON public.user_settings
    FOR INSERT
    TO authenticated
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own settings"
    ON public.user_settings
    FOR UPDATE
    TO authenticated
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);
