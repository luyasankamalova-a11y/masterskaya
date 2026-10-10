// Простой статический сервер для тестов (собранная папка dist/ или dist-offline/).
import { createServer } from 'node:http';
import { readFileSync, statSync } from 'node:fs';
import { extname, join, normalize } from 'node:path';

const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml', '.webmanifest': 'application/manifest+json', '.json': 'application/json' };

export function serve(dir, port = 0) {
  return new Promise((resolve) => {
    const server = createServer((req, res) => {
      let p = normalize(decodeURIComponent(req.url.split('?')[0])).replace(/^(\.\.[/\\])+/, '');
      if (p.endsWith('/')) p += 'index.html';
      const file = join(dir, p);
      try {
        if (!statSync(file).isFile()) throw new Error();
        res.writeHead(200, { 'content-type': TYPES[extname(file)] ?? 'application/octet-stream' });
        res.end(readFileSync(file));
      } catch { res.writeHead(404); res.end('not found'); }
    }).listen(port, () => resolve({ url: `http://localhost:${server.address().port}/`, close: () => server.close() }));
  });
}
