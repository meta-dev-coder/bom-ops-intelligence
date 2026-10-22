import { describe, expect, it } from 'vitest';
import { cookieValue, createLoginLimiter, createSessions, hashPassword, verifyPassword } from '../server/auth';

describe('EC2 password gate', () => {
  it('verifies only the right password, and the hash never contains it', () => {
    const h = hashPassword('monsoon-squall');
    expect(h).toMatch(/^scrypt\$16384\$8\$1\$/);
    expect(h).not.toContain('monsoon');
    expect(verifyPassword('monsoon-squall', h)).toBe(true);
    expect(verifyPassword('wrong', h)).toBe(false);
    expect(verifyPassword('x', 'garbage')).toBe(false);
  });
  it('issues signed sessions that expire and cannot be forged', () => {
    let t = 1_000;
    const s = createSessions({ ttlMs: 10_000, now: () => t });
    const token = s.issue();
    expect(s.valid(token)).toBe(true);
    expect(s.valid(token.replace(/.$/, c => (c === 'A' ? 'B' : 'A')))).toBe(false);
    expect(s.valid(`${t + 99_999}.${token.split('.')[1]}`)).toBe(false);
    t += 10_001;
    expect(s.valid(token)).toBe(false);
    expect(createSessions().valid(token)).toBe(false); // other process key
  });
  it('locks an IP out after 5 failures for 15 minutes', () => {
    let t = 0;
    const l = createLoginLimiter({ now: () => t });
    for (let i = 0; i < 5; i++) l.fail('1.2.3.4');
    expect(l.locked('1.2.3.4')).toBe(true);
    expect(l.locked('5.6.7.8')).toBe(false);
    t += 15 * 60_000 + 1;
    expect(l.locked('1.2.3.4')).toBe(false);
  });
  it('reads a cookie by name', () => {
    expect(cookieValue('a=1; bom_session=x.y; b=2', 'bom_session')).toBe('x.y');
    expect(cookieValue(undefined, 'bom_session')).toBeUndefined();
  });
});
