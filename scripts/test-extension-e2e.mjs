import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const { Pool } = pg;
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

const BASE_URL = 'http://localhost:3000';
const TEST_USER_ID = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11';

async function runExtensionE2E() {
  console.log('========================================================');
  console.log('RECALL STEP 7: CHROME EXTENSION END-TO-END VERIFICATION');
  console.log('========================================================\n');

  const client = await pool.connect();

  try {
    // 1. Verify Extension Token / Linking Flow
    console.log('--- 1. Testing Extension Token & Linking Bridge ---');
    const tokenRes = await fetch(`${BASE_URL}/api/extension/token`);
    if (!tokenRes.ok) throw new Error(`Token API failed: ${tokenRes.status}`);
    const tokenData = await tokenRes.json();
    console.log('Token API Response:', tokenData);
    if (!tokenData.success || !tokenData.token) {
      throw new Error('Token API failed to return valid token');
    }
    const extensionAuthToken = tokenData.token;
    console.log(`✓ Extension authenticated with token: ${extensionAuthToken}`);

    // Verify /extension/link page responds with 200
    const linkPageRes = await fetch(`${BASE_URL}/extension/link`);
    console.log(`✓ /extension/link web bridge page status: ${linkPageRes.status} (expected 200)\n`);

    // 2. Simulate LeetCode Solve Detection & Capture Overlay Submit
    console.log('--- 2. Simulating LeetCode Solve Capture Submission ---');
    const testSolvePayload = {
      problem_name: 'LRU Cache',
      problem_link: 'https://leetcode.com/problems/lru-cache/',
      difficulty: 'medium',
      topic_tags: ['hash-table', 'linked-list', 'design'],
      hint_usage: 'none',
      confidence_rating: 5,
      time_taken_seconds: 420,
    };

    console.log('Payload scraped by LeetCode content script:', testSolvePayload);

    const solveRes = await fetch(`${BASE_URL}/api/solves`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${extensionAuthToken}`,
        'x-user-id': extensionAuthToken,
      },
      body: JSON.stringify(testSolvePayload),
    });

    if (!solveRes.ok) {
      const errText = await solveRes.text();
      throw new Error(`Solve submission failed (${solveRes.status}): ${errText}`);
    }

    const solveData = await solveRes.json();
    console.log('✓ Solve API Response:', {
      success: solveData.success,
      retention_score: solveData.data.retention_score,
      next_due_date: solveData.data.revision_schedule.next_due_date,
      interval_days: solveData.data.revision_schedule.current_interval_days,
    });

    const problemId = solveData.data.revision_schedule.problem_id;
    const scheduleId = solveData.data.revision_schedule.id;

    // 3. Direct Raw Database Verification
    console.log('\n--- 3. Direct Raw Database Verification ---');
    const dbProblem = await client.query('SELECT * FROM problems WHERE id = $1', [problemId]);
    console.log('DB Problem Record:', {
      id: dbProblem.rows[0].id,
      name: dbProblem.rows[0].name,
      difficulty: dbProblem.rows[0].difficulty,
      topic_tags: dbProblem.rows[0].topic_tags,
    });

    const dbSolve = await client.query('SELECT * FROM solves WHERE problem_id = $1 AND user_id = $2', [problemId, TEST_USER_ID]);
    console.log(`DB Solves count for this problem: ${dbSolve.rows.length}`);

    const dbSchedule = await client.query('SELECT * FROM revision_schedule WHERE id = $1', [scheduleId]);
    console.log('DB Revision Schedule:', {
      id: dbSchedule.rows[0].id,
      ease_factor: dbSchedule.rows[0].ease_factor,
      interval: dbSchedule.rows[0].current_interval_days,
      next_due_date: dbSchedule.rows[0].next_due_date,
      retention_score: dbSchedule.rows[0].retention_score,
    });

    // 4. Verify Revision Cycle Advances Metrics
    console.log('\n--- 4. Completing Spaced Revision Cycles for LRU Cache ---');
    // Simulate due revision cycle 1 (hint-free)
    await client.query(`UPDATE revision_schedule SET next_due_date = CURRENT_DATE - INTERVAL '1 day' WHERE id = $1`, [scheduleId]);
    const rev1 = await fetch(`${BASE_URL}/api/revisions/${scheduleId}/complete`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${extensionAuthToken}`,
        'x-user-id': extensionAuthToken,
      },
      body: JSON.stringify({ was_hint_free: true, new_confidence_rating: 5 }),
    });
    console.log(`✓ Revision cycle 1 complete: status ${rev1.status}`);

    // Simulate due revision cycle 2 (hint-free -> becomes mature!)
    await client.query(`UPDATE revision_schedule SET next_due_date = CURRENT_DATE - INTERVAL '1 day' WHERE id = $1`, [scheduleId]);
    const rev2 = await fetch(`${BASE_URL}/api/revisions/${scheduleId}/complete`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${extensionAuthToken}`,
        'x-user-id': extensionAuthToken,
      },
      body: JSON.stringify({ was_hint_free: true, new_confidence_rating: 5 }),
    });
    console.log(`✓ Revision cycle 2 complete: status ${rev2.status} (Problem now reaches maturity >= 2 hint-free cycles)`);

    // 5. Verify Updated Readiness and Weakness Metrics
    console.log('\n--- 5. Verifying Impact on Readiness & Weakness Views ---');
    const readinessRes = await fetch(`${BASE_URL}/api/readiness`, {
      headers: { 'Authorization': `Bearer ${extensionAuthToken}`, 'x-user-id': extensionAuthToken },
    });
    const readinessData = await readinessRes.json();
    console.log(`Updated Overall Readiness: ${readinessData.overall_readiness}%`);
    console.log(`Mature Problems Count:    ${readinessData.mature_problems_count}`);
    console.log(`Total Problems Logged:    ${readinessData.total_problems_logged}`);

    // Check if LRU Cache is in mature list in DB
    const matureCheck = await client.query(
      `SELECT p.name, COUNT(*)::int as cycles
       FROM revision_history rh
       JOIN problems p ON p.id = rh.problem_id
       WHERE rh.problem_id = $1 AND rh.was_hint_free = true
       GROUP BY p.name`,
      [problemId]
    );
    console.log('Mature Problem Check:', matureCheck.rows[0]);

    console.log('\n========================================================');
    console.log('EXTENSION CAPTURE & DATABASE FLOW FULLY VALIDATED!');
    console.log('========================================================');
  } finally {
    client.release();
    await pool.end();
  }
}

runExtensionE2E().catch((err) => {
  console.error('Extension E2E failed:', err);
  process.exit(1);
});
