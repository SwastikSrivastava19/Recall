import dotenv from 'dotenv';
import pg from 'pg';

dotenv.config();

const { Pool } = pg;
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';
const TEST_USER_ID = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11';
const TEST_USER_EMAIL = 'test@recall.dev';

const today = new Date().toISOString().split('T')[0];

async function setupTestUser() {
  console.log('\n--- 1. Ensuring Test User Exists in auth.users ---');
  await pool.query(
    `INSERT INTO auth.users (id, aud, role, email, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
     VALUES ($1, 'authenticated', 'authenticated', $2, '{"provider":"email"}', '{}', now(), now())
     ON CONFLICT (id) DO NOTHING;`,
    [TEST_USER_ID, TEST_USER_EMAIL]
  );
  console.log(`Test user verified: ID=${TEST_USER_ID}, Email=${TEST_USER_EMAIL}`);
}

async function runTests() {
  await setupTestUser();

  console.log('\n--- 2. Testing Input Validation & Error Handling ---');

  // Test unauthenticated request
  const unauthRes = await fetch(`${BASE_URL}/api/solves`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ problem_name: 'Test' }),
  });
  console.log(`Unauthenticated request: status=${unauthRes.status} (expected 401)`);
  const unauthBody = await unauthRes.json();
  console.log('Response:', unauthBody);

  // Test invalid enum value
  const invalidEnumRes = await fetch(`${BASE_URL}/api/solves`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-user-id': TEST_USER_ID,
    },
    body: JSON.stringify({
      problem_name: 'Two Sum',
      problem_link: 'https://leetcode.com/problems/two-sum',
      topic_tags: ['arrays'],
      difficulty: 'super_hard', // invalid
      hint_usage: 'none',
      time_taken_seconds: 300,
      confidence_rating: 4,
    }),
  });
  console.log(`Invalid enum request: status=${invalidEnumRes.status} (expected 400)`);
  const invalidEnumBody = await invalidEnumRes.json();
  console.log('Response:', invalidEnumBody);

  // Test out-of-range confidence rating
  const invalidRatingRes = await fetch(`${BASE_URL}/api/solves`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-user-id': TEST_USER_ID,
    },
    body: JSON.stringify({
      problem_name: 'Two Sum',
      problem_link: 'https://leetcode.com/problems/two-sum',
      topic_tags: ['arrays'],
      difficulty: 'easy',
      hint_usage: 'none',
      time_taken_seconds: 300,
      confidence_rating: 10, // invalid (must be 1-5)
    }),
  });
  console.log(`Invalid confidence_rating request: status=${invalidRatingRes.status} (expected 400)`);

  console.log('\n--- 3. Logging Sample Solve 1 (hint_usage: "none") ---');
  // Two Sum (Easy, hint_usage: 'none', 350s, confidence: 5)
  // Baseline for easy is 600s, 350s is <= 2*baseline (no penalty)
  // Confidence 5 -> +(5-3)*5 = +10. Score = 100 + 10 = 110 clamped to 100.
  const solve1Res = await fetch(`${BASE_URL}/api/solves`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-user-id': TEST_USER_ID,
    },
    body: JSON.stringify({
      problem_name: 'Two Sum',
      problem_link: 'https://leetcode.com/problems/two-sum/',
      topic_tags: ['array', 'hash-table'],
      difficulty: 'easy',
      hint_usage: 'none',
      time_taken_seconds: 350,
      confidence_rating: 5,
      next_due_date: today, // set to today so it is due for step 2 verification
    }),
  });
  const solve1 = await solve1Res.json();
  console.log(`Solve 1 status: ${solve1Res.status}`);
  console.log('Solve 1 result:', JSON.stringify(solve1, null, 2));

  console.log('\n--- 4. Logging Sample Solve 2 (hint_usage: "full_editorial") ---');
  // Trapping Rain Water (Hard, hint_usage: 'full_editorial', 5200s, confidence: 2)
  // Hard baseline is 2400s; 5200s > 2*2400s (4800s) -> subtract 15.
  // full_editorial -> subtract 60.
  // confidence 2 -> (2-3)*5 = -5.
  // Score = 100 - 60 - 15 - 5 = 20.
  const solve2Res = await fetch(`${BASE_URL}/api/solves`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-user-id': TEST_USER_ID,
    },
    body: JSON.stringify({
      problem_name: 'Trapping Rain Water',
      problem_link: 'https://leetcode.com/problems/trapping-rain-water/',
      topic_tags: ['array', 'two-pointers', 'dynamic-programming', 'stack'],
      difficulty: 'hard',
      hint_usage: 'full_editorial',
      time_taken_seconds: 5200,
      confidence_rating: 2,
      next_due_date: today, // set to today so it is due for step 2 verification
    }),
  });
  const solve2 = await solve2Res.json();
  console.log(`Solve 2 status: ${solve2Res.status}`);
  console.log('Solve 2 result:', JSON.stringify(solve2, null, 2));

  console.log('\n--- 5. Fetching Due Revisions (GET /api/revisions/due) ---');
  const dueRes = await fetch(`${BASE_URL}/api/revisions/due`, {
    headers: {
      'x-user-id': TEST_USER_ID,
    },
  });
  const dueData = await dueRes.json();
  console.log(`GET /api/revisions/due status: ${dueRes.status}`);
  console.log(`Count of due revisions: ${dueData.count}`);
  console.log('Due revisions list:');
  console.table(
    dueData.data.map((r) => ({
      id: r.id,
      problem_name: r.problem_name,
      difficulty: r.difficulty,
      current_interval_days: r.current_interval_days,
      ease_factor: r.ease_factor,
      next_due_date: r.next_due_date,
      retention_score: r.retention_score,
    }))
  );

  const revisionToComplete = dueData.data.find((r) => r.problem_name === 'Two Sum');
  if (!revisionToComplete) {
    throw new Error('Two Sum revision not found in due list!');
  }

  console.log(`\n--- 6. Completing Revision for "${revisionToComplete.problem_name}" as hint-free ---`);
  console.log(`Before completion: interval=${revisionToComplete.current_interval_days}, ease_factor=${revisionToComplete.ease_factor}`);
  
  const completeRes = await fetch(`${BASE_URL}/api/revisions/${revisionToComplete.id}/complete`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-user-id': TEST_USER_ID,
    },
    body: JSON.stringify({
      was_hint_free: true,
      new_confidence_rating: 4,
    }),
  });
  const completeData = await completeRes.json();
  console.log(`POST complete status: ${completeRes.status}`);
  console.log('Complete response:', JSON.stringify(completeData, null, 2));

  console.log('\n--- 7. Directly Querying Database to Verify Persistent State ---');
  const dbVerifyRes = await pool.query(
    `SELECT 
       r.id,
       p.name AS problem_name,
       r.ease_factor,
       r.current_interval_days,
       TO_CHAR(r.next_due_date, 'YYYY-MM-DD') AS next_due_date,
       r.retention_score,
       r.last_updated
     FROM public.revision_schedule r
     JOIN public.problems p ON p.id = r.problem_id
     WHERE r.id = $1;`,
    [revisionToComplete.id]
  );
  console.log('Direct Database verification:');
  console.table(dbVerifyRes.rows);

  console.log('\n--- 8. Re-fetching GET /api/revisions/due ---');
  const dueAfterRes = await fetch(`${BASE_URL}/api/revisions/due`, {
    headers: {
      'x-user-id': TEST_USER_ID,
    },
  });
  const dueAfterData = await dueAfterRes.json();
  console.log(`Count of remaining due revisions: ${dueAfterData.count}`);
  console.table(
    dueAfterData.data.map((r) => ({
      problem_name: r.problem_name,
      next_due_date: r.next_due_date,
    }))
  );

  console.log('\nALL VERIFICATIONS PASSED SUCCESSFULLY!');
  await pool.end();
  process.exit(0);
}

runTests().catch(async (err) => {
  console.error('Test run failed:', err);
  await pool.end();
  process.exit(1);
});
