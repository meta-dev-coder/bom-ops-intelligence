/**
 * Optional password gate for the EC2 host (pattern from acs-demo live-dc): the password is stored
 * only as a salted scrypt hash; a successful login sets an HttpOnly, SameSite=Strict session
 * cookie signed with a per-process key (a restart signs everyone out); 5 failed logins from one
 * IP lock it out for 15 minutes.
 */
import { createHmac, randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';

const N = 16384, R = 8, P = 1, KEYLEN = 32;

export function hashPassword(password: string): string {
  const salt = randomBytes(16);
  const hash = scryptSync(password, salt, KEYLEN, { N, r: R, p: P });
  return `scrypt$${N}$${R}$${P}$${salt.toString('base64')}$${hash.toString('base64')}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  const parts = stored.split('$');
  if (parts.length !== 6 || parts[0] !== 'scrypt') return false;
  const [n, r, p] = parts.slice(1, 4).map(Number);
  const salt = Buffer.from(parts[4], 'base64');
  const expected = Buffer.from(parts[5], 'base64');
  const actual = scryptSync(password, salt, expected.length, { N: n, r, p });
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

export function createSessions(opts: { ttlMs?: number; now?: () => number } = {}) {
  const key = randomBytes(32);
  const ttl = opts.ttlMs ?? 8 * 3600_000;
  const now = opts.now ?? Date.now;
  const sign = (v: string) => createHmac('sha256', key).update(v).digest('base64url');
  return {
    issue(): string {
      const exp = String(now() + ttl);
      return `${exp}.${sign(exp)}`;
    },
    valid(token?: string): boolean {
      if (!token) return false;
      const [exp, sig] = token.split('.');
      if (!exp || !sig) return false;
      const good = Buffer.from(sign(exp));
      const got = Buffer.from(sig);
      return good.length === got.length && timingSafeEqual(good, got) && Number(exp) > now();
    },
    maxAgeSeconds: Math.floor(ttl / 1000),
  };
}

export function createLoginLimiter(opts: { maxFailures?: number; lockMs?: number; now?: () => number } = {}) {
  const max = opts.maxFailures ?? 5;
  const lock = opts.lockMs ?? 15 * 60_000;
  const now = opts.now ?? Date.now;
  const state = new Map<string, { failures: number; lockedUntil: number }>();
  return {
    locked(ip: string) { return (state.get(ip)?.lockedUntil ?? 0) > now(); },
    fail(ip: string) {
      const s = state.get(ip) ?? { failures: 0, lockedUntil: 0 };
      s.failures += 1;
      if (s.failures >= max) { s.lockedUntil = now() + lock; s.failures = 0; }
      state.set(ip, s);
    },
    succeed(ip: string) { state.delete(ip); },
  };
}

export function cookieValue(header: string | undefined, name: string): string | undefined {
  for (const part of (header ?? '').split(';')) {
    const [k, ...v] = part.trim().split('=');
    if (k === name) return v.join('=');
  }
  return undefined;
}
