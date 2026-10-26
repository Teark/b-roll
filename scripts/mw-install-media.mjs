import path from 'node:path';
import { mkdir, chmod } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { projectRoot, runtimeDirectory } from './mw-env-paths.mjs';
import { fetchVerified } from './mw-download.mjs';
import { toolPath, toolReady } from './mw-media-tools.mjs';

// Official mamba-org/micromamba-releases 2.9.0-0 mirror digests.
const mirrors = {
  'darwin-arm64': ['osx-arm64', 'ec2a072f028e1a7cf20f3e2e74d5a8127cf5a5f27636375b5359811565f4e5be'],
  'darwin-x64': ['osx-64', '1e71054bb3ac9a076e21f7ec48acfef536f9b3f1408f371a942784bf5ef83d8a'],
  'linux-x64': ['linux-64', '366cd9cd8be14df1ab8ed50352a82111082a36686b2d389fdb79a92c3fafb3e3'],
  'linux-arm64': ['linux-aarch64', '9f93b974adcb4d166996af969b6cd371287d1a3e52733704727884d9b74cb7a7'],
  'win32-x64': ['win-64.exe', 'a6d804394b2418991c4e29562853eaace2f2ce9d9da661a98e74e02e8dbb44b0'],
};
export async function installMediaTools({ forceManaged = false } = {}) {
  if (!forceManaged && toolReady('ffmpeg') && toolReady('ffprobe')) {
    console.log(`Using FFmpeg: ${toolPath('ffmpeg')}`);
    return;
  }
  for (const key of ['FFMPEG_PATH', 'FFPROBE_PATH']) {
    if (process.env[key]) throw new Error(`${key} explicitly selects an unusable or incomplete media toolchain. Fix/unset this override and retry.`);
  }
  const mirror = mirrors[`${process.platform}-${process.arch}`];
  if (!mirror) throw new Error(`Automatic FFmpeg installation does not support ${process.platform}/${process.arch}. See docs/mw-getting-started.md.`);
  const micromamba = runtimeDirectory('micromamba', process.platform === 'win32' ? 'micromamba.exe' : 'micromamba');
  await fetchVerified({ url: `https://github.com/mamba-org/micromamba-releases/releases/download/2.9.0-0/micromamba-${mirror[0]}`, sha256: mirror[1] }, micromamba);
  if (process.platform !== 'win32') await chmod(micromamba, 0o755);
  await mkdir(runtimeDirectory('mamba-root'), { recursive: true });
  console.log('Installing private FFmpeg/FFprobe (conda-forge GPL build); no global environment is changed.');
  const env = { ...process.env, MAMBA_ROOT_PREFIX: runtimeDirectory('mamba-root'), CONDA_PKGS_DIRS: runtimeDirectory('mamba-packages') };
  const installed = spawnSync(micromamba, ['create', '--yes', '--no-rc', '--prefix', runtimeDirectory('media'), '--override-channels', '--channel', 'conda-forge', 'ffmpeg=8.0.1=gpl_*'], { cwd: projectRoot, env, stdio: 'inherit', windowsHide: true, timeout: 900000 });
  if (installed.status !== 0) throw new Error(`Private FFmpeg installation failed: ${installed.error?.message || installed.status}. Check network access to conda-forge and rerun setup.`);
  if (!toolReady('ffmpeg') || !toolReady('ffprobe')) throw new Error('Installed FFmpeg/FFprobe did not pass executable/libx264 checks.');
}
