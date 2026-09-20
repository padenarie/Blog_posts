import { createServer } from 'node:http';
import { readFile, stat, watch } from 'node:fs/promises';
import { execFile } from 'node:child_process';
import { join, extname, normalize, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');
const dist = join(root, 'dist');
const port = Number(process.env.PORT || 4173);
const watchMode = process.argv.includes('--watch');

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml', '.webp': 'image/webp', '.ico': 'image/x-icon',
  '.txt': 'text/plain; charset=utf-8', '.woff2': 'font/woff2',
};

async function handler(req, res) {
  let p = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
  if (p.endsWith('/')) p += 'index.html';
  const filePath = normalize(join(dist, p));
  if (!filePath.startsWith(dist)) { res.writeHead(403); return res.end('Forbidden'); }
  try {
    const s = await stat(filePath);
    const target = s.isDirectory() ? join(filePath, 'index.html') : filePath;
    const data = await readFile(target);
    res.writeHead(200, { 'Content-Type': MIME[extname(target)] || 'application/octet-stream' });
    res.end(data);
  } catch {
    try {
      const nf = await readFile(join(dist, '404.html'));
      res.writeHead(404, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(nf);
    } catch { res.writeHead(404); res.end('Not found'); }
  }
}

const server = createServer(handler);
server.listen(port, () => console.log(`> blog dev server: http://localhost:${port}`));

if (watchMode) {
  let timer;
  const rebuild = () => {
    clearTimeout(timer);
    timer = setTimeout(() => {
      console.log('  change detected, rebuilding...');
      execFile('node', [join(__dirname, 'build.mjs')], () => console.log('  rebuilt'));
    }, 120);
  };
  for (const dir of ['content', 'assets']) {
    watch(join(root, dir), { recursive: true }, rebuild);
  }
  console.log('  watching content/ and assets/');
}
