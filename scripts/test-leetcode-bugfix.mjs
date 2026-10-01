import { spawn } from 'child_process';

const CHROME_PATH = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const PORT = 9222;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function runTest() {
  console.log('====================================================');
  console.log('RECALL EXTENSION - LEETCODE DETECTION BUG FIX AUDIT');
  console.log('====================================================\n');

  console.log('[Setup] Launching headless Google Chrome...');
  const chromeProcess = spawn(CHROME_PATH, [
    '--headless=new',
    `--remote-debugging-port=${PORT}`,
    '--disable-gpu',
    '--no-first-run',
    '--no-default-browser-check',
    '--user-data-dir=/tmp/chrome-test-recall-' + Date.now(),
    'about:blank'
  ]);

  chromeProcess.stderr.on('data', (d) => {
    // console.log('[Chrome STDERR]', d.toString());
  });

  // Wait for Chrome CDP port to become active
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

  if (!targets || targets.length === 0) {
    chromeProcess.kill();
    throw new Error('Failed to connect to headless Chrome on port ' + PORT);
  }

  console.log('[Setup] Connected to Chrome DevTools Protocol targets:', targets.map(t => ({ type: t.type, url: t.url })));
  let target = targets.find((t) => t.type === 'page');
  if (!target) {
    const newTargetRes = await fetch(`http://127.0.0.1:${PORT}/json/new?http://localhost:3000/mock-leetcode.html`, { method: 'PUT' });
    target = await newTargetRes.json();
  }
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
    if (res.exceptionDetails) {
      throw new Error(`Eval error: ${JSON.stringify(res.exceptionDetails)}`);
    }
    return res.result?.value;
  }

  try {
    await sendCommand('Page.enable');
    await sendCommand('Runtime.enable');

    console.log('[Nav] Navigating to http://localhost:3000/mock-leetcode.html ...');
    await sendCommand('Page.navigate', { url: 'http://localhost:3000/mock-leetcode.html' });
    await sleep(1500);

    // TEST CASE 1
    console.log('\n--- TEST CASE 1 ---');
    console.log('Goal: Open LeetCode problem, do NOT submit anything. Confirm no overlay appears even after waiting.');
    await sleep(2500); // Wait 2.5 seconds to confirm no false positive on load
    const tc1State = await evaluate(`({
      overlayExists: !!document.querySelector('#recall-capture-overlay-host'),
      internalState: window.__recall_content_state ? window.__recall_content_state() : null,
      domResultText: document.getElementById('submission-result-box')?.textContent?.trim()
    })`);

    console.log('Result TC1:', tc1State);
    if (tc1State.overlayExists || tc1State.internalState?.overlayVisible) {
      throw new Error('FAIL TC1: Overlay appeared without submitting!');
    }
    console.log('✅ PASS TC1: Overlay did NOT appear on page load without submission.');

    // TEST CASE 2
    console.log('\n--- TEST CASE 2 ---');
    console.log('Goal: Submit a wrong/incorrect solution. Confirm no overlay appears.');
    // Click Wrong Answer button
    await evaluate(`document.getElementById('btn-submit-wrong').click()`);
    console.log('Clicked "Submit (Wrong Answer)", waiting for response...');
    await sleep(1500);

    const tc2State = await evaluate(`({
      overlayExists: !!document.querySelector('#recall-capture-overlay-host'),
      internalState: window.__recall_content_state ? window.__recall_content_state() : null,
      domResultText: document.getElementById('submission-result-box')?.textContent?.trim()
    })`);

    console.log('Result TC2:', tc2State);
    if (tc2State.overlayExists || tc2State.internalState?.overlayVisible) {
      throw new Error('FAIL TC2: Overlay appeared after Wrong Answer submission!');
    }
    if (tc2State.internalState?.isAwaitingSubmission) {
      throw new Error('FAIL TC2: Content script is still awaiting submission after wrong answer!');
    }
    console.log('✅ PASS TC2: Wrong answer correctly rejected; no overlay appeared and submit state reset.');

    // TEST CASE 3
    console.log('\n--- TEST CASE 3 ---');
    console.log('Goal: Submit a correct solution. Confirm overlay appears exactly once, only after Accepted result.');
    // Click Accepted button
    await evaluate(`document.getElementById('btn-submit-solution').click()`);
    console.log('Clicked "Submit (Accepted)", waiting for judging and result...');
    await sleep(1500);

    const tc3State = await evaluate(`({
      overlayExists: !!document.querySelector('#recall-capture-overlay-host'),
      overlayCount: document.querySelectorAll('#recall-capture-overlay-host').length,
      internalState: window.__recall_content_state ? window.__recall_content_state() : null,
      domResultText: document.getElementById('submission-result-box')?.textContent?.trim(),
      shadowContentHeader: document.querySelector('#recall-capture-overlay-host')?.shadowRoot?.querySelector('.problem-title')?.textContent?.trim()
    })`);

    console.log('Result TC3:', tc3State);
    if (!tc3State.overlayExists || !tc3State.internalState?.overlayVisible) {
      throw new Error('FAIL TC3: Overlay failed to appear after Accepted submission!');
    }
    if (tc3State.overlayCount !== 1) {
      throw new Error(`FAIL TC3: Expected 1 overlay, found ${tc3State.overlayCount}!`);
    }
    console.log('✅ PASS TC3: Overlay appeared exactly once after Accepted submission for "' + tc3State.shadowContentHeader + '".');

    // TEST CASE 4
    console.log('\n--- TEST CASE 4 ---');
    console.log('Goal: Navigate to a different problem via LeetCode SPA navigation without submitting. Confirm no overlay appears on new problem.');
    await evaluate(`document.getElementById('btn-spa-two-sum').click()`);
    console.log('Triggered SPA navigation to Two Sum. Waiting for navigation observer...');
    await sleep(1500);

    const tc4State = await evaluate(`({
      currentUrl: window.location.href,
      overlayExists: !!document.querySelector('#recall-capture-overlay-host'),
      internalState: window.__recall_content_state ? window.__recall_content_state() : null,
      problemTitle: document.querySelector('[data-cy="question-title"]')?.textContent?.trim()
    })`);

    console.log('Result TC4:', tc4State);
    if (tc4State.overlayExists || tc4State.internalState?.overlayVisible) {
      throw new Error('FAIL TC4: Overlay from previous problem persisted or falsely triggered on new problem!');
    }
    if (tc4State.internalState?.currentProblemSlug !== 'two-sum') {
      throw new Error(`FAIL TC4: Expected slug to be 'two-sum', but was '${tc4State.internalState?.currentProblemSlug}'!`);
    }
    if (tc4State.internalState?.isAwaitingSubmission) {
      throw new Error('FAIL TC4: New problem state is incorrectly awaiting submission!');
    }
    console.log('✅ PASS TC4: State successfully reset on SPA navigation to "' + tc4State.problemTitle + '". No overlay present.');

    // TEST CASE 5
    console.log('\n--- TEST CASE 5 ---');
    console.log('Goal: Submit correctly on this new problem. Confirm overlay appears correctly here too.');
    await evaluate(`document.getElementById('btn-submit-solution').click()`);
    console.log('Clicked "Submit (Accepted)" on new problem. Waiting for judging...');
    await sleep(1500);

    const tc5State = await evaluate(`({
      overlayExists: !!document.querySelector('#recall-capture-overlay-host'),
      overlayCount: document.querySelectorAll('#recall-capture-overlay-host').length,
      internalState: window.__recall_content_state ? window.__recall_content_state() : null,
      domResultText: document.getElementById('submission-result-box')?.textContent?.trim(),
      shadowContentHeader: document.querySelector('#recall-capture-overlay-host')?.shadowRoot?.querySelector('.problem-title')?.textContent?.trim()
    })`);

    console.log('Result TC5:', tc5State);
    if (!tc5State.overlayExists || !tc5State.internalState?.overlayVisible) {
      throw new Error('FAIL TC5: Overlay failed to appear on new problem after Accepted submission!');
    }
    if (tc5State.overlayCount !== 1) {
      throw new Error(`FAIL TC5: Expected 1 overlay, found ${tc5State.overlayCount}!`);
    }
    console.log('✅ PASS TC5: Overlay appeared successfully on new problem for "' + tc5State.shadowContentHeader + '".');

    console.log('\n====================================================');
    console.log('ALL 5 TEST CASES PASSED SUCCESSFULLY!');
    console.log('====================================================');
  } finally {
    ws.close();
    chromeProcess.kill();
  }
}

runTest().catch((err) => {
  console.error('\n❌ TEST RUNNER FAILED:', err);
  process.exit(1);
});
