import { spawn } from 'child_process';
import pg from 'pg';
import dotenv from 'dotenv';
dotenv.config();

const { Pool } = pg;
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

const CHROME_PATH = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const PORT = 9222;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function verifyUI() {
  console.log('Ensuring test benchmark problem is due today in PostgreSQL...');
  await pool.query(`
    UPDATE public.revision_schedule 
    SET next_due_date = CURRENT_DATE 
    WHERE problem_id IN (SELECT id FROM public.problems WHERE name LIKE 'Step11 Substring Benchmark%');
  `);
  console.log('Launching headless Chrome to capture UI verification...');
  const chromeProcess = spawn(CHROME_PATH, [
    '--headless=new',
    `--remote-debugging-port=${PORT}`,
    '--disable-gpu',
    '--no-first-run',
    '--no-default-browser-check',
    '--window-size=1280,900',
    '--user-data-dir=/tmp/chrome-ui-verify-' + Date.now(),
    'http://localhost:3000/dashboard?force_substitution=true'
  ]);

  let targets = null;
  for (let i = 0; i < 30; i++) {
    await sleep(300);
    try {
      const res = await fetch(`http://127.0.0.1:${PORT}/json/list`);
      if (res.ok) {
        targets = await res.json();
        if (targets.length > 0) break;
      }
    } catch (e) {}
  }

  let target = targets.find((t) => t.type === 'page');
  const ws = new WebSocket(target.webSocketDebuggerUrl);

  let msgId = 1;
  const pendingRequests = new Map();

  ws.onmessage = (event) => {
    const data = JSON.parse(event.data);
    if (data.id && pendingRequests.has(data.id)) {
      const { resolve, reject } = pendingRequests.get(data.id);
      pendingRequests.delete(data.id);
      if (data.error) reject(data.error);
      else resolve(data.result);
    }
  };

  await new Promise((resolve) => {
    if (ws.readyState === WebSocket.OPEN) resolve();
    else ws.onopen = resolve;
  });

  function sendCommand(method, params = {}) {
    return new Promise((resolve, reject) => {
      const id = msgId++;
      pendingRequests.set(id, { resolve, reject });
      ws.send(JSON.stringify({ id, method, params }));
    });
  }

  async function evaluate(expression) {
    const res = await sendCommand('Runtime.evaluate', {
      expression,
      returnByValue: true,
      awaitPromise: true,
    });
    return res.result?.value;
  }

  try {
    await sendCommand('Page.enable');
    await sendCommand('Runtime.enable');
    console.log('Navigating to http://localhost:3000/dashboard?force_substitution=true ...');
    await sendCommand('Page.navigate', { url: 'http://localhost:3000/dashboard?force_substitution=true' });
    await sleep(2500);

    // Verify Pattern Check element in DOM
    const uiInspection = await evaluate(`({
      hasPatternEyebrow: !!document.querySelector('[id^="pattern-eyebrow-"]'),
      patternEyebrowText: document.querySelector('[id^="pattern-eyebrow-"]')?.textContent?.trim(),
      hasProxyNote: !!document.querySelector('[id^="pattern-proxy-"]'),
      proxyNoteText: document.querySelector('[id^="pattern-proxy-"]')?.textContent?.trim(),
      hasSettingsNavBtn: !!document.getElementById('nav-settings-btn'),
      firstProblemTitle: document.querySelector('.problemLink span')?.textContent?.trim()
    })`);

    console.log('Dashboard UI Inspection:', uiInspection);

    // Test clicking Settings button to open modal
    await evaluate(`document.getElementById('nav-settings-btn')?.click()`);
    await sleep(600);

    const modalInspection = await evaluate(`({
      modalVisible: !!document.getElementById('settings-modal-overlay'),
      modalTitle: document.getElementById('settings-modal-card')?.querySelector('h2')?.textContent?.trim(),
      hasInput: !!document.getElementById('leetcode-profile-input'),
      hasSaveBtn: !!document.getElementById('btn-save-settings')
    })`);

    console.log('Settings Modal Inspection:', modalInspection);

    if (!uiInspection.hasPatternEyebrow || !uiInspection.hasSettingsNavBtn || !modalInspection.modalVisible) {
      throw new Error('FAIL: UI elements not properly rendered');
    }

    console.log('✅ UI Verification successful! Both Pattern Check card & Settings Modal confirmed.');
  } finally {
    ws.close();
    chromeProcess.kill();
  }
}

verifyUI().catch((e) => {
  console.error('UI verification error:', e);
  process.exit(1);
});
