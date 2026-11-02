import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PORT = Number(process.env.PORT || 4173);
const HOST = '127.0.0.1';

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.webmanifest': 'application/manifest+json',
};

const server = http.createServer((req, res) => {
  const url = new URL(req.url || '/', `http://${HOST}:${PORT}`);
  let pathname = decodeURIComponent(url.pathname);
  if (pathname !== '/arkanoid' && !pathname.startsWith('/arkanoid/')) {
    res.writeHead(404);
    res.end('not found');
    return;
  }
  let rel = pathname.slice('/arkanoid'.length);
  if (rel === '' || rel.endsWith('/')) rel += '/index.html';
  rel = rel.replace(/^\/+/, '');
  if (!rel || rel.includes('\0') || rel.split('/').includes('..')) {
    res.writeHead(403);
    res.end('forbidden');
    return;
  }
  const file = path.resolve(ROOT, rel);
  if (file !== ROOT && !file.startsWith(`${ROOT}${path.sep}`)) {
    res.writeHead(403);
    res.end('forbidden');
    return;
  }
  fs.readFile(file, (error, data) => {
    if (error) {
      res.writeHead(404);
      res.end('not found');
      return;
    }
    res.writeHead(200, {
      'Content-Type': MIME[path.extname(file)] || 'application/octet-stream',
      'Cache-Control': 'no-cache',
    });
    res.end(data);
  });
});

server.listen(PORT, HOST, () => {
  console.log(`arkanoid static ${HOST}:${PORT}/arkanoid/`);
});
