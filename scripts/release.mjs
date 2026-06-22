#!/usr/bin/env node
// Release orchestrator for the @selfcure/* monorepo.
//
// Usage:
//   node scripts/release.mjs <patch|minor|major|x.y.z> [--dry-run] [--no-git]
//
// What it does, in order:
//   1. Bumps the version of all 9 packages in lockstep.
//   2. Rewrites internal @selfcure/* dependency ranges to ^<newVersion>
//      (required because 0.x caret ranges do NOT cross minor bumps).
//   3. npm install (relink workspaces + refresh lockfile).
//   4. Typecheck (tsc --noEmit) + build + tests.
//   5. npm publish each package in dependency order, stopping on first failure.
//   6. git commit + tag v<newVersion> (unless --no-git).
//
// Auth: requires `npm whoami` to succeed with publish rights on the @selfcure
// org. For a 2FA account, either run `npm login` first and pass an OTP via the
// npm prompt, or configure a granular token with "bypass 2FA". See docs/releasing.md.

import { readFileSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

// Topological publish order — every package must be published after its deps.
const PUBLISH_ORDER = [
  'crawler',
  'analyzer',
  'generator',
  'runner',
  'selfcure',
  'reporter',
  'web',
  'mcp',
  'cli',
];

const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const noGit = args.includes('--no-git');
const bump = args.find((a) => !a.startsWith('--')) ?? 'patch';

const log = (msg) => console.log(`\x1b[36m▸\x1b[0m ${msg}`);
const die = (msg) => {
  console.error(`\x1b[31m✖ ${msg}\x1b[0m`);
  process.exit(1);
};

function run(cmd, cmdArgs, opts = {}) {
  log(`${cmd} ${cmdArgs.join(' ')}`);
  if (dryRun && opts.skipOnDryRun) {
    console.log('   (skipped — dry run)');
    return;
  }
  execFileSync(cmd, cmdArgs, { cwd: ROOT, stdio: 'inherit', shell: process.platform === 'win32', ...opts });
}

function pkgPath(name) {
  return join(ROOT, 'packages', name, 'package.json');
}

function readPkg(name) {
  return JSON.parse(readFileSync(pkgPath(name), 'utf8'));
}

function nextVersion(current, kind) {
  if (/^\d+\.\d+\.\d+/.test(kind)) return kind; // explicit version
  const [maj, min, pat] = current.split('.').map(Number);
  if (kind === 'major') return `${maj + 1}.0.0`;
  if (kind === 'minor') return `${maj}.${min + 1}.0`;
  if (kind === 'patch') return `${maj}.${min}.${pat + 1}`;
  die(`Unknown bump "${kind}" — use patch | minor | major | x.y.z`);
}

// 1 — compute the new version from the current cli version
const current = readPkg('cli').version;
const version = nextVersion(current, bump);
log(`Releasing ${current} → \x1b[1m${version}\x1b[0m${dryRun ? ' (dry run)' : ''}`);

// 2 — bump every package + sync internal dep ranges
for (const name of PUBLISH_ORDER) {
  const pkg = readPkg(name);
  pkg.version = version;
  for (const field of ['dependencies', 'devDependencies', 'peerDependencies']) {
    const deps = pkg[field];
    if (!deps) continue;
    for (const dep of Object.keys(deps)) {
      if (dep.startsWith('@selfcure/')) deps[dep] = `^${version}`;
    }
  }
  writeFileSync(pkgPath(name), JSON.stringify(pkg, null, 2) + '\n');
  log(`  bumped @selfcure/${name} + synced internal deps`);
}

// 3 — relink + 4 — verify
run('npm', ['install']);
run('npx', ['tsc', '--noEmit']); // typecheck (avoids npm-run workspace fan-out)
run('npm', ['run', 'build']);
run('npx', ['vitest', 'run']);

// 5 — publish in dependency order
for (const name of PUBLISH_ORDER) {
  const publishArgs = ['publish', '-w', `@selfcure/${name}`];
  if (dryRun) publishArgs.push('--dry-run');
  try {
    run('npm', publishArgs);
  } catch {
    die(`publish failed at @selfcure/${name} — fix and re-run. Packages before it are already on npm.`);
  }
}

// 6 — git commit + tag
if (!noGit && !dryRun) {
  run('git', ['add', '-A']);
  run('git', ['commit', '-m', `release: v${version}`]);
  run('git', ['tag', `v${version}`]);
  log(`Committed and tagged v${version}. Push with: git push origin main --tags`);
}

log(`\x1b[32m✔ Release ${version} complete.\x1b[0m`);
