/**
 * Minimal static file server for local development — zero dependencies.
 *
 * Usage: `npm start` then open http://localhost:4173
 * Override the port with PORT=8080 npm start
 *
 * It only serves files from the project root and refuses to traverse outside
 * it, so a stray "../../etc/passwd" request can't escape the directory.
 */

import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join, normalize, extname } from 'node:path';
import { createHash } from 'node:crypto';

const ROOT = normalize(join(dirname(fileURLToPath(import.meta.url)), '..'));
const PORT = Number(process.env.PORT) || 4173;

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
};

const server = createServer(async (req, res) => {
  try {
    const url = new URL(req.url, `http://localhost:${PORT}`);
    const requested = url.pathname === '/' ? '/index.html' : url.pathname;
    const filePath = normalize(join(ROOT, decodeURIComponent(requested)));

    // Path-traversal guard: the resolved path must stay inside ROOT.
    if (!filePath.startsWith(ROOT)) {
      res.writeHead(403).end('Forbidden');
      return;
    }

    const body = await readFile(filePath);

    // Compute simple content hash for ETag validation
    const hash = createHash('sha1').update(body).digest('base64');
    const etag = `"${hash}"`;

    if (req.headers['if-none-match'] === etag) {
      res.writeHead(304).end();
      return;
    }

    res.writeHead(200, {
      'Content-Type': MIME[extname(filePath)] ?? 'application/octet-stream',
      'Cache-Control': 'no-cache',
      ETag: etag,
    });
    res.end(body);
  } catch {
    res.writeHead(404, { 'Content-Type': 'text/plain' }).end('Not found');
  }
});

server.listen(PORT, () => {
  console.log(`EcoTrack running at http://localhost:${PORT}`);
});
