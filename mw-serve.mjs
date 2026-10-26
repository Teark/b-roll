import http from 'node:http';
import { createReadStream } from 'node:fs';
import { realpath, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { envRoot } from './scripts/mw-env-paths.mjs';

export const serveRoot = path.dirname(fileURLToPath(import.meta.url));
export const exportRoot = serveRoot;
const mimeTypes = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.ttf': 'font/ttf', '.otf': 'font/otf', '.woff': 'font/woff', '.woff2': 'font/woff2', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.gif': 'image/gif', '.mp4': 'video/mp4', '.webm': 'video/webm', '.wav': 'audio/wav', '.mp3': 'audio/mpeg', '.svg': 'image/svg+xml' };
const blockedSegment = segment => segment.startsWith('.') && segment !== '.agents';
function isInside(baseDir, file) {
  const relative = path.relative(baseDir, file);
  return relative === '' || (!relative.startsWith('..' + path.sep) && relative !== '..' && !path.isAbsolute(relative));
}
export function parseByteRange(value, size) {
  if (!value) return null;
  const match = /^bytes=(\d*)-(\d*)$/.exec(value);
  if (!match || (!match[1] && !match[2]) || size === 0) return false;
  let start = match[1] ? Number(match[1]) : Math.max(0, size - Number(match[2]));
  let end = match[1] && match[2] ? Math.min(Number(match[2]), size - 1) : size - 1;
  if (![start, end].every(Number.isSafeInteger) || start > end || start >= size) return false;
  return { start, end };
}

export async function startPreviewServer({ port = 8793, host = '127.0.0.1', baseDir = serveRoot } = {}) {
  baseDir = await realpath(baseDir);
  // 项目内的目录联结（例如 node_modules 指向公共环境）也在允许范围内，其余越界仍然拒绝。
  const linkedBase = await realpath(envRoot()).catch(() => null);
  const withinAllowed = file => isInside(baseDir, file) || (linkedBase !== null && isInside(linkedBase, file));
  const blockedRelative = (file) => {
    const relative = path.relative(baseDir, file);
    return relative !== '' && relative.split(path.sep).some(blockedSegment);
  };
  const server = http.createServer(async (req, res) => {
    try {
      if (!['GET', 'HEAD'].includes(req.method)) { res.writeHead(405, { Allow: 'GET, HEAD' }).end(); return; }
      let pathname;
      try { pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname); }
      catch { res.writeHead(400).end('Invalid URL'); return; }
      // Reject Windows path syntax even on POSIX, and keep dotfile credentials private.
      const segments = pathname.split('/');
      if (pathname.includes('\\') || pathname.includes(':') || pathname.includes('\0') || segments.some(blockedSegment)) {
        res.writeHead(403).end(); return;
      }
      const target = path.resolve(baseDir, pathname.slice(1) || 'index.html');
      if (!isInside(baseDir, target)) { res.writeHead(403).end(); return; }
      let resolved = await realpath(target);
      if (!withinAllowed(resolved) || (isInside(baseDir, resolved) && blockedRelative(resolved))) { res.writeHead(403).end(); return; }
      let stats = await stat(resolved);
      if (stats.isDirectory()) {
        resolved = await realpath(path.join(resolved, 'index.html'));
        if (!withinAllowed(resolved) || (isInside(baseDir, resolved) && blockedRelative(resolved))) { res.writeHead(403).end(); return; }
        stats = await stat(resolved);
      }
      if (!stats.isFile()) { res.writeHead(404).end(); return; }
      const headers = { 'Content-Type': mimeTypes[path.extname(resolved).toLowerCase()] || 'application/octet-stream', 'Cache-Control': 'no-store', 'Accept-Ranges': 'bytes', 'X-Content-Type-Options': 'nosniff' };
      const range = parseByteRange(req.headers.range, stats.size);
      if (range === false) { res.writeHead(416, { 'Content-Range': `bytes */${stats.size}` }).end(); return; }
      if (range) {
        res.writeHead(206, { ...headers, 'Content-Length': range.end - range.start + 1, 'Content-Range': `bytes ${range.start}-${range.end}/${stats.size}` });
      } else res.writeHead(200, { ...headers, 'Content-Length': stats.size });
      if (req.method === 'HEAD') { res.end(); return; }
      const stream = createReadStream(resolved, range || {});
      stream.on('error', () => res.destroy());
      res.on('close', () => stream.destroy());
      stream.pipe(res);
    } catch (error) {
      res.writeHead(['ENOENT', 'ENOTDIR'].includes(error.code) ? 404 : error.code === 'EACCES' ? 403 : 500).end('Local asset unavailable');
    }
  });
  await new Promise((resolve, reject) => { server.once('error', reject); server.listen(port, host, resolve); });
  const address = server.address();
  return { server, url: `http://${host.includes(':') ? `[${host}]` : host}:${address.port}` };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const { url } = await startPreviewServer({ port: Number(process.env.PORT || 8793) });
  console.log(`Three.js workspace: ${url}`);
  console.log(`Open your film path, for example ${url}/work/my-film/index.html`);
}
