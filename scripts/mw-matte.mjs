import path from 'node:path';
import { callPython, projectRoot } from './mw-runtime.mjs';
import { toolEnv } from './mw-media-tools.mjs';
const args = process.argv.slice(2);
const result = callPython(path.join(projectRoot, 'scripts', 'mw-matte.py'), args, { env: toolEnv() });
if (result.error) console.error(result.error.message);
process.exitCode = result.status ?? 1;
