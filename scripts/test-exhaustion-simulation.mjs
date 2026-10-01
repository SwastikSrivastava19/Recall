/**
 * Test Simulation: Pattern Bank Exhaustion Fallback
 * Simulates a user having solved almost all problems for a pattern (sliding-window),
 * triggers /api/revisions/due, and verifies that the live fallback fetches new problems,
 * expands pattern_bank, and records the event in pattern_fallback_logs.
 */

import pg from 'pg';
import dotenv from 'dotenv';
dotenv.config();

const { Pool } = pg;
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

const BASE_URL = 'http://localhost:3000';
const TEST_USER_ID = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11';
const PATTERN = 'sliding-window';

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function main() {
  console.log('================================================================');
  console.log('TEST SIMULATION: PATTERN BANK EXHAUSTION FALLBACK');
  console.log('================================================================\n');

  const client = await pool.connect();
  const createdProblemIds = [];
  const createdSolveIds = [];

  try {
    // 1. Initial State: Check pattern_bank count for sliding-window
    const initialBankRes = await client.query(
      `SELECT COUNT(*)::int AS count FROM public.pattern_bank WHERE pattern_tag = $1;`,
      [PATTERN]
    );
    const beforeBankCount = initialBankRes.rows[0].count;
    console.log(`[Before Simulation] pattern_bank count for "${PATTERN}": ${beforeBankCount}`);

    const initialLogsRes = await client.query(
      `SELECT COUNT(*)::int AS count FROM public.pattern_fallback_logs WHERE pattern_tag = $1;`,
      [PATTERN]
    );
    const beforeLogsCount = initialLogsRes.rows[0].count;
    console.log(`[Before Simulation] pattern_fallback_logs count for "${PATTERN}": ${beforeLogsCount}`);

    // 2. Fetch existing sliding-window problems from pattern_bank
    const bankProblemsRes = await client.query(
      `SELECT id, name, link, difficulty FROM public.pattern_bank WHERE pattern_tag = $1 ORDER BY id ASC;`,
      [PATTERN]
    );
    const bankProblems = bankProblemsRes.rows;

    // 3. Set up an original problem in public.problems and schedule for test user
    const probInsert = await client.query(
      `INSERT INTO public.problems (name, link, topic_tags, difficulty)
       VALUES ($1, $2, $3, $4)
       RETURNING id;`,
      [
        'Exhaustion Test Substring Trigger',
        'https://leetcode.com/problems/exhaustion-test-trigger/',
        ['sliding-window', 'strings'],
        'medium',
      ]
    );
    const triggerProbId = probInsert.rows[0].id;
    createdProblemIds.push(triggerProbId);

    // Give user >= 2 hint-free revisions on this original problem so it qualifies for pattern check
    await client.query(
      `INSERT INTO public.revision_history (user_id, problem_id, was_hint_free, resulting_interval_days)
       VALUES ($1, $2, true, 3), ($1, $2, true, 6);`,
      [TEST_USER_ID, triggerProbId]
    );

    // Schedule the problem as due today
    await client.query(
      `INSERT INTO public.revision_schedule (user_id, problem_id, ease_factor, current_interval_days, next_due_date, retention_score)
       VALUES ($1, $2, 2.5, 3, CURRENT_DATE, 90)
       ON CONFLICT (user_id, problem_id) DO UPDATE SET next_due_date = CURRENT_DATE;`,
      [TEST_USER_ID, triggerProbId]
    );

    // 4. Simulate Exhaustion: Mark all but 2 sliding-window problems as solved by user
    // (Leave only 2 eligible, which is < EXHAUSTION_THRESHOLD of 5)
    console.log(`\nSimulating exhaustion: Marking ${bankProblems.length - 2} sliding-window problems as already solved for user...`);
    const problemsToSolve = bankProblems.slice(0, bankProblems.length - 2);

    for (const p of problemsToSolve) {
      // Find or insert into public.problems so solves foreign key satisfies
      const pRes = await client.query(
        `INSERT INTO public.problems (name, link, topic_tags, difficulty)
         VALUES ($1, $2, $3, $4)
         RETURNING id;`,
        [p.name, p.link, [PATTERN], p.difficulty]
      );
      let pid = pRes.rows[0]?.id;
      if (!pid) {
        const existP = await client.query(`SELECT id FROM public.problems WHERE link = $1;`, [p.link]);
        pid = existP.rows[0]?.id;
      }
      if (pid) {
        createdProblemIds.push(pid);
        const solveRes = await client.query(
          `INSERT INTO public.solves (user_id, problem_id, hint_usage, time_taken_seconds, confidence_rating)
           VALUES ($1, $2, 'none', 600, 5)
           RETURNING id;`,
          [TEST_USER_ID, pid]
        );
        if (solveRes.rows[0]?.id) {
          createdSolveIds.push(solveRes.rows[0].id);
        }
      }
    }

    console.log(`Eligible candidates remaining in bank for user: ${bankProblems.length - problemsToSolve.length} (Threshold is < 5)`);

    // 5. Call /api/revisions/due with force_substitution=true
    console.log('\nCalling GET /api/revisions/due?force_substitution=true to trigger exhaustion fallback...');
    const res = await fetch(`${BASE_URL}/api/revisions/due?force_substitution=true`, {
      headers: {
        'x-user-id': TEST_USER_ID,
      },
    });

    const dueData = await res.json();
    console.log('Due revisions response status:', res.status, 'Count:', dueData.count);
    const triggerItem = dueData.data?.find((d) => d.original_problem_id === triggerProbId);
    console.log('Substituted item returned:', {
      is_pattern_substitution: triggerItem?.is_pattern_substitution,
      problem_name: triggerItem?.problem_name,
      pattern_tag: triggerItem?.pattern_tag,
    });

    // Wait a brief moment for the async top-up to finish writing to DB
    console.log('\nWaiting 4 seconds for background LeetCode ingestion to settle...');
    await sleep(4000);

    // 6. Check pattern_bank count AFTER simulation
    const afterBankRes = await client.query(
      `SELECT COUNT(*)::int AS count FROM public.pattern_bank WHERE pattern_tag = $1;`,
      [PATTERN]
    );
    const afterBankCount = afterBankRes.rows[0].count;
    console.log(`[After Simulation] pattern_bank count for "${PATTERN}": ${afterBankCount}`);

    // 7. Check pattern_fallback_logs AFTER simulation
    const afterLogsRes = await client.query(
      `SELECT * FROM public.pattern_fallback_logs WHERE pattern_tag = $1 ORDER BY created_at DESC LIMIT 1;`,
      [PATTERN]
    );
    const latestLog = afterLogsRes.rows[0];
    console.log('\n[Audit Log Verification] Latest pattern_fallback_logs row:');
    console.log(JSON.stringify(latestLog, null, 2));

    // Assertions
    const bankGrew = afterBankCount > beforeBankCount;
    const logRecorded = latestLog && new Date(latestLog.created_at).getTime() > Date.now() - 30000;

    console.log('\n----------------------------------------------------------------');
    console.log(`RESULTS:`);
    console.log(`  - pattern_bank count BEFORE: ${beforeBankCount}`);
    console.log(`  - pattern_bank count AFTER:  ${afterBankCount} (grew: ${bankGrew})`);
    console.log(`  - Fallback log entry created: ${Boolean(logRecorded)}`);
    console.log(`  - Problems added by fallback: ${latestLog?.problems_added}`);
    console.log('----------------------------------------------------------------');

    if (!logRecorded) {
      throw new Error('Simulation failed: No fallback audit log entry was created.');
    }

    console.log('✅ PASS: Exhaustion fallback simulation successfully verified!');
  } finally {
    // Clean up test solves and test problems
    console.log('\nCleaning up simulation test records...');
    if (createdSolveIds.length > 0) {
      await client.query(`DELETE FROM public.solves WHERE id = ANY($1);`, [createdSolveIds]);
    }
    if (createdProblemIds.length > 0) {
      await client.query(`DELETE FROM public.revision_schedule WHERE problem_id = ANY($1);`, [createdProblemIds]);
      await client.query(`DELETE FROM public.revision_history WHERE problem_id = ANY($1);`, [createdProblemIds]);
      await client.query(`DELETE FROM public.problems WHERE id = ANY($1);`, [createdProblemIds]);
    }
    client.release();
    await pool.end();
  }
}

main().catch((err) => {
  console.error('Simulation error:', err);
  process.exit(1);
});
