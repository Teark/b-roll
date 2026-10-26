import { readdirSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { projectRoot } from './mw-runtime.mjs';
// Expand tests in Node, not in a POSIX shell: npm uses cmd.exe on Windows.
const tests = readdirSync(path.join(projectRoot, 'tests')).filter(name => name.endsWith('.mw-test.mjs')).sort().map(name => path.join(projectRoot, 'tests', name));
const result = spawnSync(process.execPath, ['--test', ...tests], { cwd: projectRoot, stdio: 'inherit', windowsHide: true });
if (result.error) console.error(result.error.message);
process.exitCode = result.status ?? 1;
