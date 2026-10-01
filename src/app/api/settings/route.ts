import { NextResponse } from 'next/server';
import { z } from 'zod';
import { query } from '@/lib/db';
import { getAuthenticatedUser } from '@/lib/auth';

export const dynamic = 'force-dynamic';

const SettingsInputSchema = z.object({
  leetcode_url: z.string().trim().optional(),
  leetcode_username: z.string().trim().optional(),
});

function extractLeetCodeUsername(input: string): string {
  if (!input) return '';
  const trimmed = input.trim();
  if (!trimmed.includes('/') && !trimmed.includes('.')) {
    return trimmed;
  }
  const match = trimmed.match(/leetcode\.com\/(?:u\/)?([^/?#]+)/i);
  if (match) return match[1];
  return trimmed.replace(/^https?:\/\//i, '').split('/')[0] || trimmed;
}

async function fetchLeetCodeStats(username: string) {
  if (!username) return null;

  const graphqlQuery = `
    query userPublicProfile($username: String!) {
      matchedUser(username: $username) {
        username
        submitStats: submitStatsGlobal {
          acSubmissionNum { difficulty count }
        }
        profile { ranking reputation starRating }
      }
    }
  `;

  try {
    const res = await fetch('https://leetcode.com/graphql/', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        Referer: `https://leetcode.com/u/${username}/`,
      },
      body: JSON.stringify({ query: graphqlQuery, variables: { username } }),
    });

    if (!res.ok) {
      return {
        status: 'unverified',
        error: `LeetCode API HTTP ${res.status}`,
        fetched_at: new Date().toISOString(),
      };
    }

    const data = await res.json();
    const matched = data?.data?.matchedUser;

    if (!matched) {
      return {
        status: 'not_found',
        error: `User "${username}" not found or profile is private`,
        fetched_at: new Date().toISOString(),
      };
    }

    const acList = matched.submitStats?.acSubmissionNum || [];
    let total = 0;
    let easy = 0;
    let medium = 0;
    let hard = 0;

    for (const item of acList) {
      if (item.difficulty === 'All') total = item.count;
      else if (item.difficulty === 'Easy') easy = item.count;
      else if (item.difficulty === 'Medium') medium = item.count;
      else if (item.difficulty === 'Hard') hard = item.count;
    }

    return {
      status: 'verified',
      username: matched.username,
      total_solved: total,
      easy_solved: easy,
      medium_solved: medium,
      hard_solved: hard,
      ranking: matched.profile?.ranking || null,
      fetched_at: new Date().toISOString(),
    };
  } catch (err: any) {
    return {
      status: 'unverified',
      error: err.message || 'Network error fetching LeetCode profile',
      fetched_at: new Date().toISOString(),
    };
  }
}

export async function GET(request: Request) {
  try {
    const authResult = await getAuthenticatedUser(request);
    if (!authResult.authenticated || !authResult.user) {
      return NextResponse.json(
        { error: 'Unauthorized', message: authResult.error || 'Authentication required' },
        { status: 401 }
      );
    }
    const user = authResult.user;

    const res = await query(
      `SELECT user_id, leetcode_username, leetcode_profile_url, leetcode_stats, updated_at
       FROM public.user_settings
       WHERE user_id = $1
       LIMIT 1;`,
      [user.id]
    );

    const settings = res.rows[0] || {
      user_id: user.id,
      leetcode_username: null,
      leetcode_profile_url: null,
      leetcode_stats: {},
    };

    return NextResponse.json({ success: true, settings });
  } catch (error: any) {
    console.error('Error in GET /api/settings:', error);
    return NextResponse.json({ error: 'Internal Server Error', message: error.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const authResult = await getAuthenticatedUser(request);
    if (!authResult.authenticated || !authResult.user) {
      return NextResponse.json(
        { error: 'Unauthorized', message: authResult.error || 'Authentication required' },
        { status: 401 }
      );
    }
    const user = authResult.user;

    let body: any;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON', message: 'Request body must be valid JSON' }, { status: 400 });
    }

    const parseResult = SettingsInputSchema.safeParse(body);
    if (!parseResult.success) {
      return NextResponse.json({ error: 'Validation Error', details: parseResult.error.errors }, { status: 400 });
    }

    const { leetcode_url, leetcode_username } = parseResult.data;
    const rawInput = leetcode_url || leetcode_username || '';
    const username = extractLeetCodeUsername(rawInput);
    const profileUrl = username ? `https://leetcode.com/u/${username}/` : null;

    let leetcodeStats: any = {};
    if (username) {
      leetcodeStats = (await fetchLeetCodeStats(username)) || {};
    }

    const upsertRes = await query(
      `INSERT INTO public.user_settings 
         (user_id, leetcode_username, leetcode_profile_url, leetcode_stats, updated_at)
       VALUES ($1, $2, $3, $4, now())
       ON CONFLICT (user_id) DO UPDATE SET
         leetcode_username = EXCLUDED.leetcode_username,
         leetcode_profile_url = EXCLUDED.leetcode_profile_url,
         leetcode_stats = EXCLUDED.leetcode_stats,
         updated_at = now()
       RETURNING user_id, leetcode_username, leetcode_profile_url, leetcode_stats, updated_at;`,
      [user.id, username || null, profileUrl, JSON.stringify(leetcodeStats)]
    );

    return NextResponse.json({
      success: true,
      message: 'Settings updated successfully',
      settings: upsertRes.rows[0],
    });
  } catch (error: any) {
    console.error('Error in POST /api/settings:', error);
    return NextResponse.json({ error: 'Internal Server Error', message: error.message }, { status: 500 });
  }
}
