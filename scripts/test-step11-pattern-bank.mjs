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

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function runStep11Tests() {
  console.log('================================================================');
  console.log('RECALL STEP 11: PATTERN-BANK & SUBSTITUTION END-TO-END AUDIT');
  console.log('================================================================\n');

  try {
    // -------------------------------------------------------------------------
    // TEST 1: Pattern Bank Verification in Database
    // -------------------------------------------------------------------------
    console.log('[Test 1] Verifying pattern_bank table contents in PostgreSQL...');
    const bankSummaryRes = await pool.query(`
      SELECT pattern_tag, COUNT(*) as count,
             COUNT(*) FILTER (WHERE difficulty = 'easy') as easy_cnt,
             COUNT(*) FILTER (WHERE difficulty = 'medium') as med_cnt,
             COUNT(*) FILTER (WHERE difficulty = 'hard') as hard_cnt
      FROM public.pattern_bank
      GROUP BY pattern_tag
      ORDER BY pattern_tag;
    `);

    console.table(bankSummaryRes.rows);
    const totalCountRes = await pool.query(`SELECT COUNT(*) as total FROM public.pattern_bank;`);
    const totalProblems = parseInt(totalCountRes.rows[0].total, 10);
    console.log(`Total pattern bank problems: ${totalProblems}`);

    if (totalProblems < 150) {
      throw new Error(`FAIL Test 1: Expected >= 150 problems in pattern_bank, found ${totalProblems}`);
    }
    console.log('✅ PASS Test 1: pattern_bank is populated across all DSA patterns.');

    // -------------------------------------------------------------------------
    // TEST 2: LeetCode Profile Linking & Personalization (Task 3)
    // -------------------------------------------------------------------------
    console.log('\n[Test 2] Testing /api/settings for LeetCode profile linking & public stats fetch...');
    const settingsPostRes = await fetch(`${BASE_URL}/api/settings`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-user-id': TEST_USER_ID,
      },
      body: JSON.stringify({
        leetcode_url: 'https://leetcode.com/u/tourist',
      }),
    });

    const settingsData = await settingsPostRes.json();
    console.log('Settings API Response:', JSON.stringify(settingsData, null, 2));

    if (!settingsData.success || settingsData.settings?.leetcode_username !== 'tourist') {
      throw new Error('FAIL Test 2: Could not save LeetCode username');
    }

    const stats = settingsData.settings?.leetcode_stats;
    console.log('Fetched LeetCode Stats:', stats);
    if (stats?.status === 'verified') {
      console.log(`  - Verified public profile for @tourist! Total solved: ${stats.total_solved}, Easy: ${stats.easy_solved}, Medium: ${stats.medium_solved}, Hard: ${stats.hard_solved}`);
    } else {
      console.log(`  - Profile saved with status "${stats?.status}" (best-effort soft signal fallback).`);
    }
    console.log('✅ PASS Test 2: LeetCode profile URL linked & personalization signal saved.');

    // -------------------------------------------------------------------------
    // TEST 3: Original Problem Setup & 2+ Hint-Free Revisions Gate
    // -------------------------------------------------------------------------
    console.log('\n[Test 3] Setting up original problem and testing 2-revisions threshold gate...');
    
    // Clean up test data for this specific problem if it existed
    const testProblemName = 'Step11 Substring Benchmark';
    const testProblemLink = `https://leetcode.com/problems/step11-test-substring-${Date.now()}/`;
    
    const insertProblemRes = await pool.query(`
      INSERT INTO public.problems (name, link, topic_tags, difficulty)
      VALUES ($1, $2, $3, 'medium')
      RETURNING id, name, link, topic_tags, difficulty;
    `, [testProblemName, testProblemLink, ['sliding-window', 'hash-table', 'string']]);

    const originalProblem = insertProblemRes.rows[0];
    console.log(`Created benchmark problem: "${originalProblem.name}" (ID: ${originalProblem.id})`);

    // Create schedule due today
    const scheduleRes = await pool.query(`
      INSERT INTO public.revision_schedule 
        (user_id, problem_id, ease_factor, current_interval_days, next_due_date, retention_score)
      VALUES ($1, $2, 2.5, 2, CURRENT_DATE, 85)
      ON CONFLICT (user_id, problem_id) DO UPDATE SET
        next_due_date = CURRENT_DATE,
        current_interval_days = 2,
        ease_factor = 2.5
      RETURNING id, user_id, problem_id, ease_factor, current_interval_days, next_due_date;
    `, [TEST_USER_ID, originalProblem.id]);

    const initialSchedule = scheduleRes.rows[0];
    console.log('Initial revision schedule:', initialSchedule);

    // Clean any prior history for this problem
    await pool.query(`DELETE FROM public.revision_history WHERE user_id = $1 AND problem_id = $2;`, [TEST_USER_ID, originalProblem.id]);

    // Subtest 3A: 0 completed hint-free revisions -> Must NOT substitute
    console.log('\n  Checking due revisions with 0 hint-free revisions completed...');
    let dueRes = await fetch(`${BASE_URL}/api/revisions/due?force_substitution=true`, {
      headers: { 'x-user-id': TEST_USER_ID },
    });
    let dueData = await dueRes.json();
    let ourRev = dueData.data?.find((r) => r.problem_id === originalProblem.id);

    console.log('  Result (0 hint-free revs):', {
      problem_name: ourRev?.problem_name,
      is_pattern_substitution: ourRev?.is_pattern_substitution,
      hint_free_count: ourRev?.hint_free_revision_count,
    });

    if (ourRev?.is_pattern_substitution) {
      throw new Error('FAIL Test 3A: Problem was substituted before reaching 2 successful hint-free revisions!');
    }
    console.log('  ✓ 0 hint-free revisions correctly blocked substitution.');

    // Subtest 3B: 1 completed hint-free revision -> Must STILL NOT substitute
    console.log('\n  Adding 1 hint-free revision into revision_history...');
    await pool.query(`
      INSERT INTO public.revision_history (user_id, problem_id, completed_at, was_hint_free, resulting_interval_days)
      VALUES ($1, $2, now() - INTERVAL '3 days', true, 2);
    `, [TEST_USER_ID, originalProblem.id]);

    dueRes = await fetch(`${BASE_URL}/api/revisions/due?force_substitution=true`, {
      headers: { 'x-user-id': TEST_USER_ID },
    });
    dueData = await dueRes.json();
    ourRev = dueData.data?.find((r) => r.problem_id === originalProblem.id);

    console.log('  Result (1 hint-free rev):', {
      problem_name: ourRev?.problem_name,
      is_pattern_substitution: ourRev?.is_pattern_substitution,
      hint_free_count: ourRev?.hint_free_revision_count,
    });

    if (ourRev?.is_pattern_substitution) {
      throw new Error('FAIL Test 3B: Problem was substituted with only 1 successful hint-free revision!');
    }
    console.log('  ✓ 1 hint-free revision correctly blocked substitution.');

    // Subtest 3C: 2 completed hint-free revisions -> Now ELIGIBLE for substitution!
    console.log('\n  Adding 2nd hint-free revision into revision_history...');
    await pool.query(`
      INSERT INTO public.revision_history (user_id, problem_id, completed_at, was_hint_free, resulting_interval_days)
      VALUES ($1, $2, now() - INTERVAL '1 day', true, 5);
    `, [TEST_USER_ID, originalProblem.id]);

    console.log('✅ PASS Test 3: Threshold requirement (>= 2 hint-free revisions) verified.');

    // -------------------------------------------------------------------------
    // TEST 4: Pattern Check Substitution Trigger & Payload Verification
    // -------------------------------------------------------------------------
    console.log('\n[Test 4] Testing Pattern Check Substitution on due queue...');
    dueRes = await fetch(`${BASE_URL}/api/revisions/due?force_substitution=true`, {
      headers: { 'x-user-id': TEST_USER_ID },
    });
    dueData = await dueRes.json();
    ourRev = dueData.data?.find((r) => r.problem_id === originalProblem.id);

    console.log('Substituted Revision Payload:', {
      revision_schedule_id: ourRev?.id,
      original_problem_id: ourRev?.original_problem_id,
      original_problem_name: ourRev?.original_problem_name,
      is_pattern_substitution: ourRev?.is_pattern_substitution,
      pattern_tag: ourRev?.pattern_tag,
      pattern_name: ourRev?.pattern_name,
      substituted_problem_name: ourRev?.problem_name,
      substituted_problem_link: ourRev?.problem_link,
      substituted_difficulty: ourRev?.difficulty,
    });

    if (!ourRev?.is_pattern_substitution) {
      throw new Error('FAIL Test 4: Pattern substitution did not trigger for eligible problem!');
    }
    if (ourRev.pattern_tag !== 'sliding-window') {
      throw new Error(`FAIL Test 4: Expected pattern_tag 'sliding-window', got '${ourRev.pattern_tag}'`);
    }
    if (ourRev.problem_name === originalProblem.name) {
      throw new Error('FAIL Test 4: Substituted problem name must be different from original problem name!');
    }
    if (ourRev.id !== initialSchedule.id) {
      throw new Error('FAIL Test 4: revision id must point to original revision_schedule ID!');
    }

    const firstSubstitutedCandidate = ourRev.problem_link;
    console.log(`✅ PASS Test 4: Problem successfully substituted with "${ourRev.problem_name}" (${ourRev.pattern_name}).`);

    // -------------------------------------------------------------------------
    // TEST 5: Exclude Already-Solved Pattern Bank Problems
    // -------------------------------------------------------------------------
    console.log('\n[Test 5] Testing exclusion of already-solved pattern_bank problems...');
    console.log(`Logging a solve for candidate "${ourRev.problem_name}" (${firstSubstitutedCandidate}) in solves table...`);
    
    // Ensure problem exists in problems table so solves FK constraint is met
    const candProblemRes = await pool.query(`
      INSERT INTO public.problems (name, link, topic_tags, difficulty)
      VALUES ($1, $2, $3, $4)
      ON CONFLICT DO NOTHING
      RETURNING id;
    `, [ourRev.problem_name, ourRev.problem_link, ['sliding-window'], ourRev.difficulty]);

    let candProblemId = candProblemRes.rows[0]?.id;
    if (!candProblemId) {
      const existing = await pool.query(`SELECT id FROM public.problems WHERE link = $1;`, [ourRev.problem_link]);
      candProblemId = existing.rows[0]?.id;
    }

    // Insert solve for this candidate
    await pool.query(`
      INSERT INTO public.solves (user_id, problem_id, hint_usage, time_taken_seconds, confidence_rating)
      VALUES ($1, $2, 'none', 600, 5);
    `, [TEST_USER_ID, candProblemId]);

    console.log('Solve logged. Re-fetching /api/revisions/due to verify candidate is excluded...');
    dueRes = await fetch(`${BASE_URL}/api/revisions/due?force_substitution=true`, {
      headers: { 'x-user-id': TEST_USER_ID },
    });
    dueData = await dueRes.json();
    const updatedRev = dueData.data?.find((r) => r.problem_id === originalProblem.id);

    console.log('New Substituted Candidate:', {
      substituted_problem_name: updatedRev?.problem_name,
      substituted_problem_link: updatedRev?.problem_link,
      is_different_from_first: updatedRev?.problem_link !== firstSubstitutedCandidate,
    });

    if (updatedRev?.problem_link === firstSubstitutedCandidate) {
      throw new Error(`FAIL Test 5: Candidate ${firstSubstitutedCandidate} was re-used despite being logged as solved!`);
    }
    console.log('✅ PASS Test 5: Solved pattern_bank problem was successfully excluded from substitution.');

    // -------------------------------------------------------------------------
    // TEST 6: Proxy Completion Advances the Original Problem Schedule
    // -------------------------------------------------------------------------
    console.log('\n[Test 6] Testing proxy completion: hint-free solve must advance ORIGINAL schedule...');
    
    // Check original problem schedule before complete
    const preCompleteSchedule = (await pool.query(
      `SELECT id, user_id, problem_id, ease_factor, current_interval_days, next_due_date, retention_score 
       FROM public.revision_schedule WHERE id = $1;`,
      [initialSchedule.id]
    )).rows[0];

    console.log('Original schedule BEFORE proxy complete:', preCompleteSchedule);

    // Call POST /api/revisions/:id/complete (using initialSchedule.id = original problem's schedule)
    const completeRes = await fetch(`${BASE_URL}/api/revisions/${initialSchedule.id}/complete`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-user-id': TEST_USER_ID,
      },
      body: JSON.stringify({
        was_hint_free: true,
        new_confidence_rating: 5,
        time_taken_seconds: 450,
      }),
    });

    const completeData = await completeRes.json();
    console.log('Complete API response:', completeData);

    if (!completeData.success) {
      throw new Error(`FAIL Test 6: Complete API returned failure: ${completeData.message}`);
    }

    // Query database directly to confirm the ORIGINAL problem's schedule updated
    const postCompleteSchedule = (await pool.query(
      `SELECT id, user_id, problem_id, ease_factor, current_interval_days, next_due_date, retention_score 
       FROM public.revision_schedule WHERE id = $1;`,
      [initialSchedule.id]
    )).rows[0];

    console.log('Original schedule AFTER proxy complete:', postCompleteSchedule);

    // Verify interval advanced: 2 * 2.5 = 5 days
    if (postCompleteSchedule.current_interval_days <= preCompleteSchedule.current_interval_days) {
      throw new Error(`FAIL Test 6: Interval did not increase! Was ${preCompleteSchedule.current_interval_days}, now ${postCompleteSchedule.current_interval_days}`);
    }
    // Verify ease factor increased: 2.5 -> 2.6
    if (postCompleteSchedule.ease_factor <= preCompleteSchedule.ease_factor) {
      throw new Error(`FAIL Test 6: Ease factor did not increase! Was ${preCompleteSchedule.ease_factor}, now ${postCompleteSchedule.ease_factor}`);
    }
    console.log('  ✓ Interval increased from 2 days to ' + postCompleteSchedule.current_interval_days + ' days.');
    console.log('  ✓ Ease factor increased from ' + preCompleteSchedule.ease_factor + ' to ' + postCompleteSchedule.ease_factor);
    console.log('  ✓ Next due date advanced to ' + postCompleteSchedule.next_due_date);

    // Verify revision_history row was created for original problem
    const historyCheck = await pool.query(
      `SELECT * FROM public.revision_history WHERE user_id = $1 AND problem_id = $2 ORDER BY completed_at DESC LIMIT 1;`,
      [TEST_USER_ID, originalProblem.id]
    );
    console.log('Revision history entry created for original problem:', historyCheck.rows[0]);
    if (!historyCheck.rows[0] || historyCheck.rows[0].was_hint_free !== true) {
      throw new Error('FAIL Test 6: revision_history entry missing or incorrect');
    }

    console.log('✅ PASS Test 6: Solving substituted problem correctly advanced ORIGINAL problem schedule.');

    // -------------------------------------------------------------------------
    // TEST 7: Proxy Failure/Hint Reset Verification
    // -------------------------------------------------------------------------
    console.log('\n[Test 7] Testing proxy failure/hint: hinted solve must reset interval to 1 day...');
    const failCompleteRes = await fetch(`${BASE_URL}/api/revisions/${initialSchedule.id}/complete`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-user-id': TEST_USER_ID,
      },
      body: JSON.stringify({
        was_hint_free: false, // user needed a hint on the proxy pattern test
        new_confidence_rating: 2,
        time_taken_seconds: 1200,
      }),
    });

    const failData = await failCompleteRes.json();
    const resetSchedule = (await pool.query(
      `SELECT id, user_id, problem_id, ease_factor, current_interval_days, next_due_date 
       FROM public.revision_schedule WHERE id = $1;`,
      [initialSchedule.id]
    )).rows[0];

    console.log('Original schedule AFTER hinted proxy solve:', resetSchedule);
    if (resetSchedule.current_interval_days !== 1) {
      throw new Error(`FAIL Test 7: Interval was not reset to 1 day! Is ${resetSchedule.current_interval_days}`);
    }
    console.log('  ✓ Interval successfully reset to 1 day on hinted/failed proxy solve.');
    console.log('✅ PASS Test 7: Hinted proxy solve correctly reset original schedule.');

    console.log('\n================================================================');
    console.log('ALL STEP 11 TESTS PASSED SUCCESSFULLY! DATABASE STATE VERIFIED.');
    console.log('================================================================');
  } finally {
    await pool.end();
  }
}

runStep11Tests().catch((err) => {
  console.error('\n❌ STEP 11 TEST SUITE FAILED:', err);
  process.exit(1);
});
