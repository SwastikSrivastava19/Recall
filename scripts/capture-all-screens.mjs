import { execSync } from 'child_process';
import path from 'path';

const CHROME = '"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"';
const OUT_DIR = '/Users/swastiksrivastava/.gemini/antigravity-ide/brain/4b3bdf67-3615-4ae3-b24c-bfef06e9a486';

const screens = [
  { name: 'queue', path: '/dashboard' },
  { name: 'log', path: '/dashboard/log' },
  { name: 'topics', path: '/dashboard/topics' },
  { name: 'readiness', path: '/dashboard/readiness' },
];

const viewports = [
  { label: 'desktop', width: 1440, height: 1000 },
  { label: 'tablet', width: 768, height: 1024 },
  { label: 'mobile', width: 375, height: 812 },
];

for (const screen of screens) {
  for (const vp of viewports) {
    const outFile = path.join(OUT_DIR, `audit_${screen.name}_${vp.label}.png`);
    const cmd = `${CHROME} --headless=new --disable-gpu --virtual-time-budget=4000 --window-size=${vp.width},${vp.height} --screenshot="${outFile}" http://localhost:3000${screen.path}`;
    console.log(`Capturing ${screen.name} @ ${vp.label}...`);
    try {
      execSync(cmd, { stdio: 'ignore' });
      console.log(`  ✓ Saved ${outFile}`);
    } catch (e) {
      console.error(`  ✗ Error capturing ${screen.name} @ ${vp.label}:`, e.message);
    }
  }
}

console.log('All audit screenshots captured successfully!');
