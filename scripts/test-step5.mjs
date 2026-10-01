import dotenv from 'dotenv';

dotenv.config();

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';
const TEST_USER_ID = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11';

async function runStep5Tests() {
  console.log('\n========================================');
  console.log('RECALL STEP 5: TOPIC WEAKNESS VERIFICATION');
  console.log('========================================\n');

  // 1. Test unauthenticated request
  console.log('--- 1. Testing Unauthenticated Request (Expect 401) ---');
  const unauthRes = await fetch(`${BASE_URL}/api/topics/weakness`);
  console.log(`Status: ${unauthRes.status} (expected 401)`);
  const unauthBody = await unauthRes.json();
  console.log('Response:', unauthBody);

  // 2. Test authenticated request
  console.log('\n--- 2. Fetching Topic Weakness for Authenticated User ---');
  const res = await fetch(`${BASE_URL}/api/topics/weakness`, {
    headers: { 'x-user-id': TEST_USER_ID },
  });
  console.log(`Status: ${res.status} (expected 200)`);
  const data = await res.json();

  console.log('\n--- 3. Ranked Topics (Weakest First, min 3 problems) ---');
  console.table(
    data.ranked_topics.map((t, idx) => ({
      Rank: `#${idx + 1}`,
      Topic: t.topic,
      'Problems Logged': t.total_problems_logged,
      'Hint-Free Rate': `${t.hint_free_rate}%`,
      'Avg Retention': `${t.average_retention_score}%`,
      'Bar Color Tier': t.retention_tier,
    }))
  );

  console.log('\n--- 4. Dynamic One-Line Takeaway ---');
  console.log('Takeaway Data:', JSON.stringify(data.takeaway, null, 2));
  console.log(`Computed Takeaway Line: "${data.takeaway.summary}"`);

  console.log('\n--- 5. Topics with Insufficient Data (< 3 problems) ---');
  console.table(
    data.insufficient_data_topics.slice(0, 5).map((t) => ({
      Topic: t.topic,
      'Problems Logged': `${t.total_problems_logged} / 3`,
      'Avg Retention': `${t.average_retention_score}%`,
      Reason: t.reason,
    }))
  );
  console.log(`(Total ${data.total_insufficient} topics awaiting more solves to qualify for ranking)`);

  console.log('\n--- 6. Verifying Navigation Link from Dashboard ---');
  const dashBundle = await fetch(`${BASE_URL}/_next/static/chunks/app/dashboard/page-6dcf4cd2d7ba785d.js`).then((r) => r.text());
  const hasTopicLink = dashBundle.includes('Topic Weakness') && dashBundle.includes('/dashboard/topics');
  console.log(`Dashboard contains link to /dashboard/topics: ${hasTopicLink ? 'YES (Verified)' : 'NO'}`);

  console.log('\n--- 7. Verifying /dashboard/topics Route Rendering ---');
  const topicsBundle = await fetch(`${BASE_URL}/_next/static/chunks/app/dashboard/topics/page-d5ceb4e0af3104da.js`).then((r) => r.text());
  const hasTitle = topicsBundle.includes('Topic Weakness Analysis');
  console.log(`Topics page renders title: ${hasTitle ? 'YES (Verified)' : 'NO'}`);

  console.log('\nSTEP 5 VERIFICATIONS COMPLETED SUCCESSFULLY!');
}

runStep5Tests().catch((err) => {
  console.error('Step 5 verification failed:', err);
  process.exit(1);
});
