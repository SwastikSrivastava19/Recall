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

async function runStep6Tests() {
  console.log('\n========================================');
  console.log('RECALL STEP 6: INTERVIEW READINESS VERIFICATION');
  console.log('========================================\n');

  // 1. Unauthenticated test
  console.log('--- 1. Testing Unauthenticated Request (Expect 401) ---');
  const unauthRes = await fetch(`${BASE_URL}/api/readiness`);
  console.log(`Status: ${unauthRes.status} (expected 401)`);
  const unauthBody = await unauthRes.json();
  console.log('Response:', unauthBody);

  // 2. Authenticated test
  console.log('\n--- 2. Fetching Interview Readiness for Authenticated User ---');
  const res = await fetch(`${BASE_URL}/api/readiness`, {
    headers: { 'x-user-id': TEST_USER_ID },
  });
  console.log(`Status: ${res.status} (expected 200)`);
  const data = await res.json();

  console.log('\n--- 3. Core Readiness Metrics ---');
  console.log(`Overall Readiness Score: ${data.overall_readiness}%`);
  console.log(`Mature Problems Count:   ${data.mature_problems_count}`);
  console.log(`Total Problems Logged:   ${data.total_problems_logged}`);
  console.log(`Interpretation Line:     "${data.interpretation}"`);

  console.log('\n--- 4. Per-Topic Readiness Breakdown (Ranked) ---');
  console.table(
    data.ranked_topics.map((t, idx) => ({
      Rank: `#${idx + 1}`,
      Topic: t.topic,
      'Mature Problems': `${t.mature_problems_count} / ${t.total_problems_logged}`,
      'Readiness Score': `${t.readiness_percentage}%`,
      'Bar Tier': t.retention_tier,
    }))
  );

  console.log('\n--- 5. 8-Week Readiness Trend Line ---');
  console.table(
    data.readiness_trend.map((pt) => ({
      Week: pt.week_label,
      Date: pt.date,
      'Mature Count': pt.mature_count,
      'Total Count': pt.total_count,
      'Readiness %': `${pt.readiness_percentage}%`,
    }))
  );

  console.log('\n--- 6. Direct Database Raw Verification ---');
  const rawTotalRes = await pool.query(
    'SELECT COUNT(DISTINCT problem_id)::int AS total FROM solves WHERE user_id = $1;',
    [TEST_USER_ID]
  );
  const rawTotal = rawTotalRes.rows[0].total;

  const rawMatureRes = await pool.query(
    `SELECT p.name, COUNT(*)::int AS hint_free_cycles
     FROM revision_history rh
     JOIN problems p ON p.id = rh.problem_id
     WHERE rh.user_id = $1 AND rh.was_hint_free = true
     GROUP BY p.name
     HAVING COUNT(*) >= 2;`,
    [TEST_USER_ID]
  );
  console.log(`Raw Database Total Distinct Problems: ${rawTotal}`);
  console.log('Raw Database Mature Problems (>= 2 hint-free cycles):');
  console.table(rawMatureRes.rows);

  const expectedMath = Math.round((rawMatureRes.rows.length / rawTotal) * 100);
  console.log(
    `Math Confirmation: (${rawMatureRes.rows.length} / ${rawTotal}) * 100 = ${expectedMath}% (API returned ${data.overall_readiness}%)`
  );

  if (expectedMath === data.overall_readiness) {
    console.log('MATH VERIFICATION MATCHES EXACTLY!');
  } else {
    throw new Error(`Math mismatch: expected ${expectedMath}%, got ${data.overall_readiness}%`);
  }

  console.log('\nSTEP 6 VERIFICATIONS COMPLETED SUCCESSFULLY!');
  await pool.end();
  process.exit(0);
}

runStep6Tests().catch(async (err) => {
  console.error('Step 6 verification failed:', err);
  await pool.end();
  process.exit(1);
});
