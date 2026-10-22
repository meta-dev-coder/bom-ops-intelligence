#!/usr/bin/env node
/**
 * Builds the EC2 release: web app (same-origin /api, Real mode available) + bundled Node server +
 * data files + ops scripts → releases/bom-ops-<tag>.tar.gz and .sha256.
 *   node tools/build-ec2-release.mjs [tag]       (tag defaults to ec2-<UTC yyyymmdd-hhmm>)
 * The ion token (VITE_CESIUM_ION_TOKEN) is a public browser key and is baked into the web bundle;
 * server-side provider keys are never packed — they live in /etc/bom-ops/env on the instance.
 */
import { execFileSync } from 'node:child_process';
import { cpSync, createReadStream, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join, relative } from 'node:path';
import { build } from 'esbuild';

const root = process.cwd();
const now = new Date();
const tag = process.argv[2] ?? `ec2-${now.toISOString().slice(0, 16).replace(/[-:]/g, '').replace('T', '-')}`;
const out = join(root, 'build', 'ec2');
rmSync(out, { recursive: true, force: true });
mkdirSync(join(out, 'data'), { recursive: true });

console.log(`• web build (tag ${tag})`);
execFileSync('npx', ['vite', 'build', '--outDir', join(out, 'web'), '--emptyOutDir'], {
  stdio: 'inherit',
  env: { ...process.env, BASE_PATH: '/', VITE_STATIC_HOSTING: 'false', VITE_API_BASE: '' },
});

console.log('• server bundle');
await build({
  entryPoints: [join(root, 'server', 'standalone.ts')],
  bundle: true, platform: 'node', format: 'esm', target: 'node22',
  outfile: join(out, 'server.mjs'),
  external: ['vite'],
  banner: { js: "import { createRequire } from 'node:module'; const require = createRequire(import.meta.url);" },
  logLevel: 'warning',
});

cpSync(join(root, 'src/data/fixtures/bom-entities.geojson'), join(out, 'data/bom-entities.geojson'));
cpSync(join(root, 'src/data/fixtures/bom-baseline.json'), join(out, 'data/bom-baseline.json'));
cpSync(join(root, 'src/config/model.json'), join(out, 'data/model.json'));
for (const f of ['install.sh', 'bomops.sh', 'bom-ops.service', 'env.example']) cpSync(join(root, 'deploy/ec2', f), join(out, f));
writeFileSync(join(out, 'VERSION'), `${tag}\n`);

// Refuse to pack anything secret-looking (acs-demo release rule).
const banned = [/AKIA[0-9A-Z]{16}/, /-----BEGIN [A-Z ]*PRIVATE KEY-----/, /scrypt\$\d+\$\d+\$\d+\$[A-Za-z0-9+/=]{16,}\$/];
const serverKeys = ['AERODATABOX_API_KEY', 'TOMTOM_API_KEY', 'OPEN_METEO_API_KEY'].map(k => process.env[k]).filter(v => v && v.length >= 8);
const walk = d => readdirSync(d).flatMap(n => (statSync(join(d, n)).isDirectory() ? walk(join(d, n)) : [join(d, n)]));
for (const file of walk(out)) {
  const name = relative(out, file);
  if (/(^|\/)\.env|token$|\.pem$|\.key$/.test(name)) throw new Error(`refusing to pack ${name}`);
  if (statSync(file).size > 20e6) continue;
  const text = readFileSync(file, 'latin1');
  for (const re of banned) if (re.test(text)) throw new Error(`secret-like content in ${name}: ${re}`);
  for (const v of serverKeys) if (text.includes(v)) throw new Error(`server key value found in ${name}`);
}

mkdirSync(join(root, 'releases'), { recursive: true });
const tarball = join(root, 'releases', `bom-ops-${tag}.tar.gz`);
execFileSync('tar', ['-czf', tarball, '-C', out, '.']);
const hash = createHash('sha256');
await new Promise((res, rej) => createReadStream(tarball).on('data', d => hash.update(d)).on('end', res).on('error', rej));
writeFileSync(`${tarball}.sha256`, `${hash.digest('hex')}  bom-ops-${tag}.tar.gz\n`);
const S3 = process.env.BOM_RELEASE_S3 ?? 's3://i595stackv5-i595corridordata41064a5b-oixfpv0dyrzj/releases/live-dc/bom-ops';
writeFileSync(join(root, 'releases', 'latest'), `${tag}\n`);
console.log(`\nUpload (run yourself, with the uploader IAM user; \`latest\` LAST):
aws s3 cp releases/bom-ops-${tag}.tar.gz        ${S3}/bom-ops-${tag}.tar.gz
aws s3 cp releases/bom-ops-${tag}.tar.gz.sha256 ${S3}/bom-ops-${tag}.tar.gz.sha256
aws s3 cp releases/latest                       ${S3}/latest --content-type text/plain --cache-control no-store\n`);
console.log(`✓ ${relative(root, tarball)} (+ .sha256) — ion token in web bundle: ${process.env.VITE_CESIUM_ION_TOKEN || existsSync('.env.local') ? 'yes' : 'NO (map will lack terrain/buildings)'}`);
