import path from 'node:path';
import { projectRoot, callPython } from './mw-runtime.mjs';
try {
  const result = callPython(path.join(projectRoot, '.agents/skills/motion-forge/scripts/mf-read-stage.py'), process.argv.slice(2));
  if (result.error) throw result.error;
  process.exitCode = result.status ?? 1;
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
