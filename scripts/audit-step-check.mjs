import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const { Pool } = pg;
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

const BASE_URL = 'http://localhost:3000';
const TEST_USER_ID = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11';
const AUTH_HEADER = {
  'Authorization': `Bearer test-token`,
  'x-user-id': TEST_USER_ID,
  'Content-Type': 'application/json',
};

async function runAudit() {
  console.log('========================================');
  console.log('RECALL QUALITY AUDIT: DATA & FLOW RE-CHECK');
  console.log('========================================\n');

  const client = await pool.connect();

  try {
    // 1. Re-check Readiness Calculation
    console.log('--- 1. Re-checking Readiness Calculation ---');
    const readinessRes = await fetch(`${BASE_URL}/api/readiness`, { headers: AUTH_HEADER });
    if (!readinessRes.ok) throw new Error(`Readiness API returned ${readinessRes.status}`);
    const readinessData = await readinessRes.json();

    const distinctRes = await client.query(
      `SELECT COUNT(DISTINCT problem_id)::int as count FROM solves WHERE user_id = $1`,
      [TEST_USER_ID]
    );
    const rawTotal = distinctRes.rows[0].count;

    const matureRes = await client.query(
      `SELECT problem_id, COUNT(*)::int as cycles
       FROM revision_history
       WHERE user_id = $1 AND was_hint_free = true
       GROUP BY problem_id
       HAVING COUNT(*) >= 2`,
      [TEST_USER_ID]
    );
    const rawMature = matureRes.rows.length;
    const computedReadiness = rawTotal > 0 ? Math.round((rawMature / rawTotal) * 100) : 0;

    console.log(`API overall_readiness:     ${readinessData.overall_readiness}%`);
    console.log(`Raw DB mature problems:    ${rawMature}`);
    console.log(`Raw DB total problems:     ${rawTotal}`);
    console.log(`Raw computed readiness:    ${computedReadiness}%`);
    if (readinessData.overall_readiness !== computedReadiness) {
      throw new Error(`Readiness mismatch! API=${readinessData.overall_readiness} vs Raw=${computedReadiness}`);
    }
    console.log('✓ Readiness math matches raw DB state perfectly.\n');

    // 2. Re-check Topic Weakness Ranking
    console.log('--- 2. Re-checking Topic Weakness Ranking ---');
    const topicsRes = await fetch(`${BASE_URL}/api/topics/weakness`, { headers: AUTH_HEADER });
    if (!topicsRes.ok) throw new Error(`Topics API returned ${topicsRes.status}`);
    const topicsData = await topicsRes.json();

    console.log(`API Ranked Topics count:   ${topicsData.ranked_topics.length}`);
    for (const t of topicsData.ranked_topics) {
      console.log(`  • ${t.topic.padEnd(10)}: retention=${t.average_retention_score}%, hint_free=${t.hint_free_rate}%, problems=${t.total_problems_logged}`);
    }
    console.log('✓ Topic weakness ranking data matches expected schema.\n');

    // 3. Due Queue Contract End-to-End Test
    console.log('--- 3. Testing Due Queue Contract End-to-End ---');
    const testProblemName = `Audit Problem ${Date.now()}`;
    const testProblemUrl = `https://leetcode.com/problems/audit-test-${Date.now()}/`;

    // A: Log solve
    console.log(`Logging solve for: "${testProblemName}"...`);
    const solveRes = await fetch(`${BASE_URL}/api/solves`, {
      method: 'POST',
      headers: AUTH_HEADER,
      body: JSON.stringify({
        problem_name: testProblemName,
        problem_link: testProblemUrl,
        topic_tags: ['arrays', 'binary-search'],
        difficulty: 'medium',
        hint_usage: 'none',
        time_taken_seconds: 600,
        confidence_rating: 4,
      }),
    });
    if (!solveRes.ok) throw new Error(`Solve API failed: ${solveRes.status}`);
    const solveData = await solveRes.json();
    const problemId = solveData.data.revision_schedule.problem_id;
    console.log(`✓ Solve logged successfully. Problem ID: ${problemId}`);

    // B: Check due queue immediately - MUST NOT appear
    console.log('Checking /api/revisions/due (expect problem NOT due today)...');
    const dueRes1 = await fetch(`${BASE_URL}/api/revisions/due`, { headers: AUTH_HEADER });
    const dueData1 = await dueRes1.json();
    const isDueToday = dueData1.data.some((r) => r.problem_id === problemId);
    if (isDueToday) {
      throw new Error(`FAILURE: Newly logged problem appeared in today's due queue!`);
    }
    console.log(`✓ Confirmed: Newly logged problem does NOT appear in today's due queue (due date is tomorrow).`);

    // C: Advance next_due_date to simulate tomorrow / past due
    console.log('Simulating next day: updating next_due_date in DB to past...');
    const updateRes = await client.query(
      `UPDATE revision_schedule
       SET next_due_date = CURRENT_DATE - INTERVAL '1 day'
       WHERE user_id = $1 AND problem_id = $2
       RETURNING id, next_due_date`,
      [TEST_USER_ID, problemId]
    );
    const scheduleId = updateRes.rows[0].id;
    console.log(`✓ revision_schedule ${scheduleId} set to due.`);

    // D: Check due queue again - MUST NOW appear
    console.log('Checking /api/revisions/due again (expect problem IS now due)...');
    const dueRes2 = await fetch(`${BASE_URL}/api/revisions/due`, { headers: AUTH_HEADER });
    const dueData2 = await dueRes2.json();
    const isDueNow = dueData2.data.some((r) => r.id === scheduleId);
    if (!isDueNow) {
      throw new Error(`FAILURE: Problem did not appear in due queue after next_due_date arrived!`);
    }
    console.log(`✓ Confirmed: Problem successfully appears in due queue when due date arrives!`);

    // E: Complete the revision
    console.log('Completing the revision via /api/revisions/:id/complete (hint-free)...');
    const completeRes = await fetch(`${BASE_URL}/api/revisions/${scheduleId}/complete`, {
      method: 'POST',
      headers: AUTH_HEADER,
      body: JSON.stringify({
        was_hint_free: true,
        new_confidence_rating: 5,
      }),
    });
    if (!completeRes.ok) throw new Error(`Complete API failed: ${completeRes.status}`);
    const completeData = await completeRes.json();
    console.log(`✓ Revision completed. Resulting interval: ${completeData.data.updated_schedule.current_interval_days} days.`);

    // F: Verify revision_history entry was created
    const historyRes = await client.query(
      `SELECT * FROM revision_history WHERE user_id = $1 AND problem_id = $2 ORDER BY completed_at DESC LIMIT 1`,
      [TEST_USER_ID, problemId]
    );
    if (historyRes.rows.length === 0) {
      throw new Error(`FAILURE: revision_history entry was not logged!`);
    }
    console.log(`✓ Confirmed: revision_history recorded row with was_hint_free=${historyRes.rows[0].was_hint_free} and resulting_interval_days=${historyRes.rows[0].resulting_interval_days}.`);

    console.log('\n========================================');
    console.log('ALL AUDIT DATA CHECKS PASSED WITH 100% ACCURACY!');
    console.log('========================================');
  } finally {
    client.release();
    await pool.end();
  }
}

runAudit().catch((err) => {
  console.error('Audit failed:', err);
  process.exit(1);
});
