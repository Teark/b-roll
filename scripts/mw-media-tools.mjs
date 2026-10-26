import { existsSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { mediaDirectory } from './mw-env-paths.mjs';

export function toolPath(name) {
  if (!['ffmpeg', 'ffprobe'].includes(name)) throw new Error(`Unknown media tool: ${name}`);
  if (process.env[name.toUpperCase() + '_PATH']) return process.env[name.toUpperCase() + '_PATH'];
  const cached = path.join(mediaDirectory(), ...(process.platform === 'win32' ? ['Library', 'bin', name + '.exe'] : ['bin', name]));
  return existsSync(cached) ? cached : name;
}
export function toolEnv() {
  return { ...process.env, PATH: [path.dirname(toolPath('ffmpeg')), process.env.PATH || process.env.Path || ''].join(path.delimiter), FFMPEG_PATH: toolPath('ffmpeg'), FFPROBE_PATH: toolPath('ffprobe'), PYTHONUTF8: '1' };
}
export function toolReady(name) {
  const result = spawnSync(toolPath(name), ['-version'], { encoding: 'utf8', timeout: 60000, windowsHide: true });
  if (result.status !== 0) return false;
  if (name !== 'ffmpeg') return true;
  const encoderList = spawnSync(toolPath(name), ['-hide_banner', '-encoders'], { encoding: 'utf8', timeout: 60000, windowsHide: true });
  return encoderList.status === 0 && /\blibx264\b/.test(encoderList.stdout);
}
