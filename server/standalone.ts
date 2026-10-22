/**
 * Production server for a Node host (EC2): serves the built web app and the same /api proxy that
 * `npm run dev` mounts, from one process. Settings come from the environment (systemd
 * EnvironmentFile=/etc/bom-ops/env); provider keys never reach the browser.
 *
 *   node server.mjs                   start (BOM_HTTP_PORT, default 8096)
 *   node server.mjs --hash-password   print a scrypt hash for BOM_DEMO_PASSWORD_HASH
 */
import { createReadStream, existsSync, readFileSync, statSync } from 'node:fs';
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { dirname, extname, join, normalize, sep } from 'node:path';
import { createInterface } from 'node:readline';
import { fileURLToPath } from 'node:url';
import { createApi } from './apiPlugin';
import { cookieValue, createLoginLimiter, createSessions, hashPassword, verifyPassword } from './auth';

const HERE = dirname(fileURLToPath(import.meta.url));
const WEB_DIR = process.env.BOM_WEB_DIR ?? join(HERE, 'web');
const DATA_DIR = process.env.BOM_DATA_DIR ?? join(HERE, 'data');
const VERSION = existsSync(join(HERE, 'VERSION')) ? readFileSync(join(HERE, 'VERSION'), 'utf8').trim() : 'dev';
const COOKIE = 'bom_session';

const MIME: Record<string, string> = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.geojson': 'application/geo+json', '.svg': 'image/svg+xml',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.gif': 'image/gif', '.ico': 'image/x-icon',
  '.wasm': 'application/wasm', '.woff': 'font/woff', '.woff2': 'font/woff2', '.ttf': 'font/ttf', '.xml': 'application/xml',
  '.ktx2': 'image/ktx2', '.glb': 'model/gltf-binary', '.txt': 'text/plain; charset=utf-8',
};

async function promptHidden(question: string): Promise<string> {
  const rl = createInterface({ input: process.stdin, output: process.stdout, terminal: true });
  const write = (rl as unknown as { _writeToOutput: (s: string) => void });
  let muted = false;
  write._writeToOutput = (s: string) => { if (!muted) process.stdout.write(s); };
  return new Promise(resolve => {
    rl.question(question, answer => { rl.close(); process.stdout.write('\n'); resolve(answer); });
    muted = true;
  });
}

const LOGIN_PAGE = (error = '') => `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>BOM Operations Intelligence — sign in</title>
<style>body{margin:0;min-height:100vh;display:grid;place-items:center;background:#05080f;color:#e2e8f0;font-family:Inter,system-ui,sans-serif}
form{background:#0a1020;border:1px solid rgba(148,163,184,.16);border-radius:14px;padding:28px;width:min(340px,90vw)}
h1{font-size:17px;margin:0 0 4px}p{font-size:12px;color:#94a3b8;margin:0 0 16px}label{font-size:12px;color:#94a3b8}
input{width:100%;box-sizing:border-box;margin:6px 0 14px;padding:9px 10px;border-radius:8px;border:1px solid #1f2a44;background:#05080f;color:#fff;font-size:14px}
button{width:100%;padding:10px;border:0;border-radius:8px;background:#f59e0b;color:#05080f;font-weight:600;font-size:14px;cursor:pointer}
.e{color:#f87171;font-size:12px;margin:-6px 0 12px}</style></head><body>
<form method="post" action="/api/login"><h1>BOM Operations Intelligence</h1><p>Proof of concept — sign in to continue.</p>
<label for="p">Password</label><input id="p" name="password" type="password" autocomplete="current-password" autofocus required>
${error ? `<div class="e" role="alert">${error}</div>` : ''}<button type="submit">Sign in</button></form></body></html>`;

function readBody(req: IncomingMessage, limit = 4096): Promise<string> {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', c => { body += c; if (body.length > limit) { reject(new Error('BODY_TOO_LARGE')); req.destroy(); } });
    req.on('end', () => resolve(body));
    req.on('error', reject);
  });
}

function serveStatic(req: IncomingMessage, res: ServerResponse): boolean {
  const url = new URL(req.url ?? '/', 'http://local');
  let rel = decodeURIComponent(url.pathname);
  if (rel.endsWith('/')) rel += 'index.html';
  const file = normalize(join(WEB_DIR, rel));
  if (!file.startsWith(WEB_DIR + sep) && file !== WEB_DIR) return false; // path traversal
  let target = file;
  if (!existsSync(target) || !statSync(target).isFile()) {
    // SPA fallback for page routes only; missing assets stay 404.
    if (extname(rel)) return false;
    target = join(WEB_DIR, 'index.html');
  }
  const isHtml = target.endsWith('.html');
  res.statusCode = 200;
  res.setHeader('Content-Type', MIME[extname(target)] ?? 'application/octet-stream');
  res.setHeader('Cache-Control', isHtml ? 'no-cache' : rel.startsWith('/assets/') ? 'public, max-age=31536000, immutable' : 'public, max-age=3600');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  createReadStream(target).pipe(res);
  return true;
}

async function main() {
  if (process.argv.includes('--hash-password')) {
    const a = await promptHidden('Password: ');
    const b = await promptHidden('Repeat: ');
    if (!a || a !== b) { console.error('Passwords did not match.'); process.exit(1); }
    console.log(hashPassword(a));
    return;
  }

  const env = process.env;
  const passwordHash = env.BOM_DEMO_PASSWORD_HASH?.trim();
  if (!passwordHash && env.BOM_ALLOW_NO_PASSWORD !== 'true') {
    console.error('bom-ops: BOM_DEMO_PASSWORD_HASH is not set (or set BOM_ALLOW_NO_PASSWORD=true). Refusing to start.');
    process.exit(2);
  }
  const files = {
    entities: readFileSync(join(DATA_DIR, 'bom-entities.geojson'), 'utf8'),
    baseline: readFileSync(join(DATA_DIR, 'bom-baseline.json'), 'utf8'),
    model: readFileSync(join(DATA_DIR, 'model.json'), 'utf8'),
  };
  const api = createApi({
    TOMTOM_API_KEY: env.TOMTOM_API_KEY, OPEN_METEO_API_KEY: env.OPEN_METEO_API_KEY,
    AERODATABOX_API_KEY: env.AERODATABOX_API_KEY, AERODATABOX_VIA: env.AERODATABOX_VIA,
    AERODATABOX_BASE_URL: env.AERODATABOX_BASE_URL, AERODATABOX_KEY_HEADER: env.AERODATABOX_KEY_HEADER,
    AERODATABOX_REFRESH_SECONDS: env.AERODATABOX_REFRESH_SECONDS,
  }, files, '/');
  const sessions = createSessions();
  const limiter = createLoginLimiter();
  const startedAt = new Date().toISOString();

  const server = createServer(async (req, res) => {
    const url = new URL(req.url ?? '/', 'http://local');
    const ip = req.socket.remoteAddress ?? 'unknown';
    try {
      if (url.pathname === '/healthz') {
        res.setHeader('Content-Type', 'application/json');
        return res.end(JSON.stringify({ ok: true, version: VERSION, startedAt }));
      }
      if (passwordHash) {
        if (url.pathname === '/login' && req.method === 'GET') {
          res.setHeader('Content-Type', 'text/html; charset=utf-8');
          return res.end(LOGIN_PAGE());
        }
        if (url.pathname === '/api/login' && req.method === 'POST') {
          if (limiter.locked(ip)) { res.statusCode = 429; res.setHeader('Content-Type', 'text/html; charset=utf-8'); return res.end(LOGIN_PAGE('Too many attempts. Try again in 15 minutes.')); }
          const body = await readBody(req);
          const password = new URLSearchParams(body).get('password') ?? '';
          if (verifyPassword(password, passwordHash)) {
            limiter.succeed(ip);
            res.statusCode = 303;
            res.setHeader('Set-Cookie', `${COOKIE}=${sessions.issue()}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${sessions.maxAgeSeconds}`);
            res.setHeader('Location', '/');
            return res.end();
          }
          limiter.fail(ip);
          console.warn(`bom-ops: failed login from ${ip}`);
          res.statusCode = 401; res.setHeader('Content-Type', 'text/html; charset=utf-8');
          return res.end(LOGIN_PAGE('Wrong password.'));
        }
        if (!sessions.valid(cookieValue(req.headers.cookie, COOKIE))) {
          if (url.pathname.startsWith('/api/')) { res.statusCode = 401; res.setHeader('Content-Type', 'application/json'); return res.end('{"error":"UNAUTHENTICATED"}'); }
          res.statusCode = 303; res.setHeader('Location', '/login'); return res.end();
        }
      }
      if (url.pathname.startsWith('/api/')) return void (await api(req, res, () => { res.statusCode = 404; res.end('{"error":"NOT_FOUND"}'); }));
      if (req.method !== 'GET' && req.method !== 'HEAD') { res.statusCode = 405; return res.end(); }
      if (!serveStatic(req, res)) { res.statusCode = 404; res.end('Not found'); }
    } catch (err) {
      console.error('bom-ops: request failed', err instanceof Error ? err.message : err);
      if (!res.headersSent) res.statusCode = 500;
      res.end();
    }
  });

  const port = Number(env.BOM_HTTP_PORT ?? 8096);
  const host = env.BOM_HTTP_HOST ?? '0.0.0.0';
  server.listen(port, host, () => {
    const keys = ['AERODATABOX_API_KEY', 'TOMTOM_API_KEY', 'OPEN_METEO_API_KEY'].filter(k => env[k]).join(', ') || 'none';
    console.log(`bom-ops ${VERSION} listening on http://${host}:${port} · password gate ${passwordHash ? 'on' : 'OFF'} · provider keys set: ${keys}`);
  });
  const stop = () => server.close(() => process.exit(0));
  process.on('SIGTERM', stop);
  process.on('SIGINT', stop);
}

void main();
