import { readFile, readdir, lstat, mkdir, copyFile, writeFile } from 'node:fs/promises';
import { resolve, relative, dirname, join, extname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';

const projectDir = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const bundleConfig = JSON.parse(await readFile(join(projectDir, 'mw-release.config.json'), 'utf8'));
const checkMode = process.argv.includes('--check');
const stamp = new Date().toISOString().replace(/[:.]/g, '-');
const outDir = join(projectDir, 'dist', `b-roll-${stamp}`);
const included = [];
const problems = [];
const skipNames = new Set(['node_modules', '__pycache__', '.DS_Store', '.git']);
async function collect(rel) {
  const entry = join(projectDir, rel);
  const info = await lstat(entry);
  if (info.isSymbolicLink()) throw new Error(`Symlinks are not distributable: ${rel}`);
  if (skipNames.has(rel.split('/').at(-1)) || /\.(pyc|pyo|log)$/.test(rel)) return;
  if (info.isDirectory()) {
    for (const name of (await readdir(entry)).sort()) await collect(`${rel}/${name}`);
    return;
  }
  if (!info.isFile()) throw new Error(`Not a regular file: ${rel}`);
  if (rel.startsWith('reference-library/')) {
    const subtree = rel.split('/')[1];
    if (!['typography', 'analysis'].includes(subtree)) throw new Error(`Private reference library excluded: ${rel}`);
    if (subtree === 'analysis' && !['.md', '.json'].includes(extname(rel))) throw new Error(`Analysis library must be text/JSON only: ${rel}`);
    if (subtree === 'analysis' && /(?:^|\/)(?:transcript|subtitles?|captions?)(?:[.-]|$)/i.test(rel)) throw new Error(`Raw transcript excluded: ${rel}`);
  }
  if (/(^|\/)(\.env(?:\..*)?|credentials[^/]*|id_rsa|id_ed25519)$/.test(rel)) throw new Error(`Private file: ${rel}`);
  if (info.size > 50 * 1024 * 1024) throw new Error(`File exceeds 50 MiB: ${rel}`);
  included.push(rel);
}
for (const entry of bundleConfig.files) await collect(entry);
for (const entry of bundleConfig.directories) await collect(entry);
const includedSet = new Set(included);
for (const rel of included) {
  if (!['.md', '.json', '.yaml', '.yml', '.html', '.mjs', '.py', '.txt'].includes(extname(rel))) continue;
  const content = await readFile(join(projectDir, rel), 'utf8');
  if (rel.startsWith('reference-library/analysis/') && /data:(?:video|audio|image)\/|base64,|<video\b|<audio\b|!\[[^\]]*\]\(|[A-Za-z0-9+/]{2048,}={0,2}/i.test(content)) problems.push(`Embedded reference media excluded: ${rel}`);
  // This script contains signatures, not credentials. Never print matching content.
  if (rel !== 'scripts/mw-package-release.mjs') {
    if (/\/(?:Users|home)\/[A-Za-z0-9._-]+\/(?!\.\.)|codex-clipboard-|-----BEGIN (?:RSA |OPENSSH |EC )?PRIVATE KEY-----|\b(?:sk-proj-|ghp_)[A-Za-z0-9_-]{20,}/.test(content)) problems.push(`Private data signature in ${rel}`);
  }
  if (extname(rel) !== '.md') continue;
  for (const match of content.matchAll(/!?\[[^\]]*\]\(([^)]+)\)/g)) {
    let target = match[1].replace(/^<|>$/g, '').split('#')[0].split('?')[0];
    if (!target || /^[a-z][a-z0-9+.-]*:/i.test(target)) continue;
    try { target = decodeURIComponent(target); } catch {}
    const absolute = resolve(projectDir, dirname(rel), target);
    const dest = relative(projectDir, absolute).split('\\').join('/');
    if (!includedSet.has(dest) && !included.some(p => p.startsWith(`${dest.replace(/\/$/, '')}/`))) problems.push(`Unshipped link in ${rel}: ${target}`);
  }
}
if (problems.length) throw new Error(problems.join('\n'));
const index = [];
for (const rel of included.sort()) {
  const data = await readFile(join(projectDir, rel));
  index.push({ path: rel, bytes: data.length, sha256: createHash('sha256').update(data).digest('hex') });
  if (!checkMode) {
    const dest = join(outDir, rel);
    await mkdir(dirname(dest), { recursive: true });
    await copyFile(join(projectDir, rel), dest);
  }
}
const totalBytes = index.reduce((sum, item) => sum + item.bytes, 0);
if (!checkMode) await writeFile(join(outDir, 'RELEASE-MANIFEST.json'), JSON.stringify({ formatVersion: 1, files: index, bytes: totalBytes }, null, 2) + '\n');
console.log(JSON.stringify({ status: 'pass', mode: checkMode ? 'check' : 'export', files: included.length, bytes: totalBytes, ...(checkMode ? {} : { outDir }) }, null, 2));
