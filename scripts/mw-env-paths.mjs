import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

export const projectRoot = path.dirname(path.dirname(fileURLToPath(import.meta.url)));

// 环境根：Python 环境、抠像模型与运行时缓存都放在这里，不写进项目目录。
// 解析顺序：MW_ENV_ROOT 环境变量 → 项目内 .env-root 文件 → 项目目录本身（回退）。
function markerRoot() {
  const marker = path.join(projectRoot, '.env-root');
  if (!existsSync(marker)) return null;
  const value = readFileSync(marker, 'utf8')
    .split(/\r?\n/)
    .map(line => line.trim())
    .find(line => line && !line.startsWith('#'));
  return value ? path.resolve(projectRoot, value) : null;
}

export function envRoot() {
  if (process.env.MW_ENV_ROOT) return path.resolve(process.env.MW_ENV_ROOT);
  return markerRoot() || projectRoot;
}

export function venvDirectory(root = envRoot()) {
  return path.join(root, '.venv');
}

export function venvInterpreter(root = envRoot(), platform = process.platform) {
  return path.join(venvDirectory(root), ...(platform === 'win32' ? ['Scripts', 'python.exe'] : ['bin', 'python']));
}

export function runtimeDirectory(...parts) {
  return path.join(envRoot(), '.runtime', ...parts);
}

export function modelsDirectory() {
  return runtimeDirectory('models');
}

export function browsersDirectory() {
  return runtimeDirectory('browsers');
}

export function mediaDirectory() {
  return runtimeDirectory('media');
}
