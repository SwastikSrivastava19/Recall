import { spawn } from 'child_process';
import path from 'path';

const CHROME_PATH = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const PORT = 9224;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function verifyPopup() {
  console.log('Testing extension popup with simulated populated state...');
  const popupHtmlPath = path.resolve('extension/popup/popup.html');
  const fileUrl = `file://${popupHtmlPath}?state=populated`;

  const chromeProcess = spawn(CHROME_PATH, [
    '--headless=new',
    `--remote-debugging-port=${PORT}`,
    '--disable-gpu',
    '--allow-file-access-from-files',
    'about:blank'
  ]);

  let targets = null;
  for (let i = 0; i < 30; i++) {
    await sleep(250);
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
    await sendCommand('Page.navigate', { url: fileUrl });
    await sleep(1500);

    const popupInspection = await evaluate(`({
      hasPatternRow: !!document.querySelector('.due-row.pattern-row'),
      patternEyebrowMiniText: document.querySelector('.pattern-eyebrow-mini')?.textContent?.trim(),
      firstTitle: document.querySelector('.problem-title')?.textContent?.trim(),
      hasHintFreeBtn: !!document.querySelector('.btn-inline-hint-free')
    })`);

    console.log('Extension Popup Inspection:', popupInspection);

    if (!popupInspection.hasPatternRow || popupInspection.patternEyebrowMiniText !== 'Pattern check: Sliding Window') {
      throw new Error('FAIL: Popup does not display pattern check visual styling correctly');
    }

    console.log('✅ Popup UI verification passed! Pattern check styling visually confirmed.');
  } finally {
    ws.close();
    chromeProcess.kill();
  }
}

verifyPopup().catch((e) => {
  console.error('Popup verification error:', e);
  process.exit(1);
});
