import { existsSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { projectRoot, envRoot, venvInterpreter } from './mw-env-paths.mjs';

export { projectRoot, envRoot, venvInterpreter };

export function locatePython() {
  const venvPath = venvInterpreter();
  if (!process.env.PYTHON && existsSync(venvPath)) {
    const result = spawnSync(venvPath, ['-c', 'import sys; sys.exit(0 if sys.version_info >= (3, 10) else 1)'], { encoding: 'utf8', timeout: 10000, windowsHide: true });
    if (result.status !== 0) throw new Error(`公共环境 Python 不可用：${venvPath}。运行 node scripts/mw-bootstrap.mjs 重新检查。`);
    return { command: venvPath, prefix: [], executable: venvPath };
  }
  const attempts = process.env.PYTHON
    ? [[process.env.PYTHON, []]]
    : process.platform === 'win32'
      ? [['py', ['-3']], ['python', []], ['python3', []]]
      : [['python3', []], ['python', []], ...['3.14', '3.13', '3.12', '3.11', '3.10'].map(version => ['python' + version, []])];
  for (const [command, prefix] of attempts) {
    const result = spawnSync(command, [...prefix, '-c', 'import sys; print(sys.executable); sys.exit(0 if sys.version_info >= (3, 10) else 1)'], { encoding: 'utf8', timeout: 10000, windowsHide: true });
    if (result.status === 0) return { command, prefix, executable: result.stdout.trim() };
  }
  throw new Error('Python 3.10+ is required. Install Python and reopen the terminal, or set PYTHON to its executable path (without arguments).');
}
export function callPython(script, args = [], options = {}) {
  const { command, prefix } = locatePython();
  return spawnSync(command, [...prefix, script, ...args], {
    cwd: projectRoot, stdio: 'inherit', windowsHide: true,
    env: { ...process.env, PYTHONUTF8: '1' }, ...options,
  });
}
