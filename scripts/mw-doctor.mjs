import { spawnSync } from 'node:child_process';
import { locatePython, projectRoot, callPython } from './mw-runtime.mjs';
import path from 'node:path';
import { toolPath, toolEnv } from './mw-media-tools.mjs';
import { openBrowser } from './mw-browser.mjs';
const summary = { platform: process.platform, arch: process.arch, checks: [] };
function addCheck(name, ok, detail) { summary.checks.push({ name, ok, detail }); }
addCheck('node', Number(process.versions.node.split('.')[0]) >= 22, process.version);
try { addCheck('python', true, locatePython().executable); } catch (error) { addCheck('python', false, error.message); }
for (const tool of ['ffmpeg', 'ffprobe']) {
  const binary = toolPath(tool);
  const probe = spawnSync(binary, ['-version'], { encoding: 'utf8', timeout: 10000, windowsHide: true });
  addCheck(tool, probe.status === 0, probe.status === 0 ? probe.stdout.split(/\r?\n/)[0] : `Not available: ${binary}. Install FFmpeg and reopen the terminal, or set ${tool.toUpperCase()}_PATH.`);
}
const encoders = spawnSync(toolPath('ffmpeg'), ['-hide_banner', '-encoders'], { encoding: 'utf8', timeout: 10000, windowsHide: true });
addCheck('h264-encoder', encoders.status === 0 && /\blibx264\b/.test(encoders.stdout || ''), encoders.status === 0 && /\blibx264\b/.test(encoders.stdout || '') ? 'libx264 available' : 'Run npm run onboard, or choose an FFmpeg build with libx264.');
if (process.argv.includes('--matting')) {
  try {
    const probe = callPython(path.join(projectRoot, 'scripts', 'mw-matte.py'), ['--check'], { env: toolEnv(), stdio: 'pipe', encoding: 'utf8', timeout: 60000 });
    addCheck('rvm-matting', probe.status === 0, probe.status === 0 ? JSON.parse(probe.stdout) : (probe.stderr?.trim() || probe.error?.message || 'Run npm run onboard.'));
  } catch (error) { addCheck('rvm-matting', false, error.message); }
}
let browser;
try {
  browser = await openBrowser();
  const page = await browser.newPage();
  const probe = await page.evaluate(() => {
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl2');
    return gl ? { version: gl.getParameter(gl.VERSION), renderer: gl.getParameter(gl.RENDERER) } : null;
  });
  addCheck('chromium-webgl2', Boolean(probe), probe || 'WebGL2 unavailable; check graphics drivers or headless rendering support.');
} catch (error) {
  addCheck('chromium-webgl2', false, `Run npm run setup, or set BROWSER_EXECUTABLE/BROWSER_CHANNEL. ${error.message.split('\n')[0]}`);
} finally { await browser?.close(); }
summary.ok = summary.checks.every(check => check.ok);
if (process.argv.includes('--json')) console.log(JSON.stringify(summary, null, 2));
else {
  console.log(`Platform: ${summary.platform} ${summary.arch}`);
  for (const check of summary.checks) console.log(`${check.ok ? 'PASS' : 'FAIL'} ${check.name}: ${typeof check.detail === 'string' ? check.detail : JSON.stringify(check.detail)}`);
  console.log('Checks cover local tooling, not finished-film visual/audio quality or an agent provider.');
}
process.exitCode = summary.ok ? 0 : 1;
