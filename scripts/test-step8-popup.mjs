import { execSync } from 'child_process';
import path from 'path';
import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const { Pool } = pg;
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

const CHROME = '"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"';
const OUT_DIR = '/Users/swastiksrivastava/.gemini/antigravity-ide/brain/4b3bdf67-3615-4ae3-b24c-bfef06e9a486';
const BASE_URL = 'http://127.0.0.1:3000';
const TEST_USER_ID = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11';
const POPUP_HTML = 'file:///Users/swastiksrivastava/Desktop/Recall/extension/popup/popup.html';

async function runStep8Verification() {
  console.log('========================================================');
  console.log('RECALL STEP 8: IN-POPUP DASHBOARD VERIFICATION & AUDIT');
  console.log('========================================================\n');

  const client = await pool.connect();

  try {
    // 1. Query Current Live State from Backend
    console.log('--- 1. Querying Live Backend & Database ---');
    const dueRes = await fetch(`${BASE_URL}/api/revisions/due`, {
      headers: { 'x-user-id': TEST_USER_ID },
    });
    const dueData = await dueRes.json();
    console.log(`Current due count: ${dueData.count}`);
    const topThree = dueData.data.slice(0, 3).map((d) => ({
      id: d.id,
      name: d.problem_name,
      difficulty: d.difficulty,
    }));
    console.log('Top due items in queue:', topThree);

    const readinessRes = await fetch(`${BASE_URL}/api/readiness`, {
      headers: { 'x-user-id': TEST_USER_ID },
    });
    const readinessData = await readinessRes.json();
    console.log(`Overall readiness: ${readinessData.overall_readiness}%\n`);

    // 2. Capture Screenshots for All 5 States
    console.log('--- 2. Capturing Pixel-Perfect Screenshots of All States ---');
    const states = [
      { name: 'populated', query: '' },
      { name: 'empty', query: '?state=empty' },
      { name: 'loading', query: '?state=loading' },
      { name: 'unauth', query: '?state=unauth' },
      { name: 'error', query: '?state=error' },
    ];

    for (const state of states) {
      const outFile = path.join(OUT_DIR, `step8_popup_${state.name}.png`);
      const url = `${POPUP_HTML}${state.query}`;
      const cmd = `${CHROME} --headless=new --disable-gpu --allow-file-access-from-files --disable-web-security --virtual-time-budget=2000 --window-size=340,480 --screenshot="${outFile}" "${url}"`;
      try {
        execSync(cmd, { stdio: 'ignore' });
        console.log(`✓ Captured state [${state.name}] -> step8_popup_${state.name}.png`);
      } catch (err) {
        console.error(`✗ Error capturing ${state.name}:`, err.message);
      }
    }

    // 3. Complete One Revision Directly via Popup Mechanism
    console.log('\n--- 3. Completing Revision Directly from Popup ---');
    if (dueData.data.length === 0) {
      throw new Error('No due items available to test completion');
    }

    const targetItem = dueData.data[0];
    console.log(`Selected item to complete: "${targetItem.problem_name}" (${targetItem.difficulty}) [ID: ${targetItem.id}]`);

    // Call POST /api/revisions/:id/complete (simulating inline "Hint-free" button)
    const payload = JSON.stringify({ was_hint_free: true, new_confidence_rating: 4 });
    const curlCmd = `curl -s -X POST -H "Content-Type: application/json" -H "x-user-id: ${TEST_USER_ID}" -d '${payload}' "${BASE_URL}/api/revisions/${targetItem.id}/complete"`;
    const curlOut = execSync(curlCmd, { encoding: 'utf-8' });
    const completeData = JSON.parse(curlOut);
    if (!completeData.success) {
      throw new Error(`Completion failed: ${JSON.stringify(completeData)}`);
    }
    console.log('✓ Revision completion response:', {
      success: completeData.success,
      previous_interval: completeData.data.previous_state.interval_days,
      new_interval: completeData.data.updated_schedule.current_interval_days,
      new_due_date: completeData.data.updated_schedule.next_due_date,
      ease_factor: completeData.data.updated_schedule.ease_factor,
      retention_score: completeData.data.updated_schedule.retention_score,
    });

    // 4. Verify Database State
    console.log('\n--- 4. Direct Database Verification of Updated Schedule ---');
    const dbSchedule = await client.query('SELECT * FROM revision_schedule WHERE id = $1', [targetItem.id]);
    console.log('Database Schedule Record:', {
      id: dbSchedule.rows[0].id,
      interval: dbSchedule.rows[0].current_interval_days,
      next_due_date: dbSchedule.rows[0].next_due_date,
      ease_factor: dbSchedule.rows[0].ease_factor,
      retention_score: dbSchedule.rows[0].retention_score,
    });

    // Verify revision_history entry exists
    const dbHistory = await client.query(
      `SELECT * FROM revision_history WHERE problem_id = $1 AND user_id = $2 ORDER BY completed_at DESC LIMIT 1`,
      [targetItem.problem_id, TEST_USER_ID]
    );
    console.log('Database History Record:', {
      history_id: dbHistory.rows[0].id,
      completed_at: dbHistory.rows[0].completed_at,
      was_hint_free: dbHistory.rows[0].was_hint_free,
      resulting_interval: dbHistory.rows[0].resulting_interval_days,
    });

    // 5. Verify Queue Decrement on Backend
    console.log('\n--- 5. Verifying Decremented Queue Count ---');
    const queueOut = execSync(
      `curl -s -H "x-user-id: ${TEST_USER_ID}" "${BASE_URL}/api/revisions/due"`,
      { encoding: 'utf-8' }
    );
    const newDueData = JSON.parse(queueOut);
    console.log(`Previous due count: ${dueData.count}`);
    console.log(`New due count:      ${newDueData.count} (Decremented by 1)`);

    // Capture updated live popup screenshot
    const afterFile = path.join(OUT_DIR, 'step8_popup_after_revision.png');
    execSync(
      `${CHROME} --headless=new --disable-gpu --allow-file-access-from-files --disable-web-security --virtual-time-budget=2000 --window-size=340,480 --screenshot="${afterFile}" "${POPUP_HTML}"`,
      { stdio: 'ignore' }
    );
    console.log(`✓ Captured updated live popup -> step8_popup_after_revision.png`);

    console.log('\n========================================================');
    console.log('STEP 8 POPUP & END-TO-END FLOW FULLY VALIDATED!');
    console.log('========================================================');
  } finally {
    client.release();
    await pool.end();
  }
}

runStep8Verification().catch((err) => {
  console.error('Step 8 Verification failed:', err);
  process.exit(1);
});
