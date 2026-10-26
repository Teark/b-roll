import { spawnSync } from 'node:child_process';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { createRequire } from 'node:module';
import { projectRoot, browsersDirectory, modelsDirectory } from './mw-env-paths.mjs';
import { installMedia } from './mw-install-media.mjs';
import { fetchVerified } from './mw-download.mjs';
const require = createRequire(import.meta.url);
const args = process.argv.slice(2);
try {
  if (args.some(arg => !['--with-deps', '--core-only', '--managed-media'].includes(arg))) throw new Error('Usage: npm run setup -- [--with-deps] [--core-only] [--managed-media]');
  await installMedia({ forceManaged: args.includes('--managed-media') || process.env.BROLL_FORCE_MANAGED_MEDIA === '1' });
  const playwrightCli = path.join(path.dirname(require.resolve('playwright-core/package.json')), 'cli.js');
  const browserDir = process.env.PLAYWRIGHT_BROWSERS_PATH || browsersDirectory();
  await mkdir(browserDir, { recursive: true });
  const install = spawnSync(process.execPath, [playwrightCli, 'install', ...(args.includes('--with-deps') ? ['--with-deps'] : []), 'chromium'], { stdio: 'inherit', windowsHide: true, env: { ...process.env, PLAYWRIGHT_BROWSERS_PATH: browserDir, PLAYWRIGHT_SKIP_BROWSER_GC: '1' } });
  if (install.status !== 0) throw new Error(install.error?.message || 'Chromium install failed; check network. Linux system packages may require npm run setup -- --with-deps.');
  if (!args.includes('--core-only')) {
    const downloads = JSON.parse(await readFile(path.join(projectRoot, 'scripts', 'mw-rvm-model.json'), 'utf8'));
    const modelDir = modelsDirectory();
    await fetchVerified(downloads.model, path.join(modelDir, 'rvm_mobilenetv3_fp32.onnx'));
    await fetchVerified(downloads.license, path.join(modelDir, 'RVM-LICENSE'));
    await writeFile(path.join(modelDir, 'RVM-SOURCE.json'), JSON.stringify(downloads, null, 2) + '\n');
    console.log(`RVM model verified. Upstream terms retained in ${path.join(modelDir, 'RVM-LICENSE')}.`);
  }
  console.log('Media tools and browser prepared. First-time users: npm run onboard. Check complete matting readiness: npm run doctor -- --matting.');
} catch (error) {
  console.error(`Setup failed: ${error.message}`);
  process.exitCode = 1;
}
