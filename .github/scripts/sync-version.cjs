#!/usr/bin/env node
/**
 * Keeps the app version identical across every file that carries one:
 *   package.json, package-lock.json, src-tauri/tauri.conf.json,
 *   src-tauri/Cargo.toml, src-tauri/Cargo.lock
 *
 * Usage:
 *   RELEASE_VERSION=v1.2.3 node sync-version.cjs     # write
 *   node sync-version.cjs 1.2.3                       # write
 *   node sync-version.cjs --check                     # verify files agree (CI)
 *   node sync-version.cjs --check 1.2.3               # verify files equal 1.2.3
 *
 * Exits non-zero on any problem (missing file, bad version, failed write).
 */
const fs = require('fs');
const path = require('path');

const SEMVER = /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/;

const args = process.argv.slice(2);
const checkOnly = args.includes('--check');
const positional = args.find((a) => !a.startsWith('--'));
const rawVersion = (process.env.RELEASE_VERSION || positional || '').trim();
const version = rawVersion.replace(/^v/i, '');

const root = process.cwd();
const p = (...s) => path.join(root, ...s);
const read = (f) => fs.readFileSync(f, 'utf8');
const fail = (msg) => {
  console.error(`[sync-version] ERROR: ${msg}`);
  process.exit(1);
};

if (version && !SEMVER.test(version)) {
  fail(`"${rawVersion}" is not a valid semantic version (expected e.g. 1.2.3 or v1.2.3-beta.1).`);
}
if (!version && !checkOnly) {
  fail('No version given. Set RELEASE_VERSION or pass it as an argument.');
}

/** Each target knows how to read and (optionally) write its version. */
const targets = [
  {
    file: p('package.json'),
    get: (txt) => JSON.parse(txt).version,
    set: (txt, v) => {
      const j = JSON.parse(txt);
      j.version = v;
      return JSON.stringify(j, null, 2) + '\n';
    },
  },
  {
    file: p('package-lock.json'),
    optional: true,
    get: (txt) => JSON.parse(txt).version,
    set: (txt, v) => {
      const j = JSON.parse(txt);
      j.version = v;
      if (j.packages && j.packages['']) j.packages[''].version = v;
      return JSON.stringify(j, null, 2) + '\n';
    },
  },
  {
    file: p('src-tauri', 'tauri.conf.json'),
    get: (txt) => JSON.parse(txt).version,
    set: (txt, v) => {
      const j = JSON.parse(txt);
      j.version = v;
      return JSON.stringify(j, null, 2) + '\n';
    },
  },
  {
    file: p('src-tauri', 'Cargo.toml'),
    // First `version = "..."` inside the [package] table.
    get: (txt) => {
      const pkg = txt.split(/^\[/m).find((s) => s.startsWith('package]'));
      const m = pkg && pkg.match(/^version\s*=\s*"([^"]+)"/m);
      return m ? m[1] : undefined;
    },
    set: (txt, v) =>
      txt.replace(/(\[package\][^[]*?^version\s*=\s*")[^"]+(")/ms, `$1${v}$2`),
  },
  {
    file: p('src-tauri', 'Cargo.lock'),
    optional: true,
    // Entry for our own crate: name = "vampio" followed by its version.
    get: (txt) => {
      const m = txt.match(/\[\[package\]\]\nname = "vampio"\nversion = "([^"]+)"/);
      return m ? m[1] : undefined;
    },
    set: (txt, v) =>
      txt.replace(/(\[\[package\]\]\nname = "vampio"\nversion = ")[^"]+(")/, `$1${v}$2`),
  },
];

let problems = 0;
const seen = new Set();

for (const t of targets) {
  const rel = path.relative(root, t.file);
  if (!fs.existsSync(t.file)) {
    if (t.optional) {
      console.log(`  - ${rel} not found, skipped`);
      continue;
    }
    fail(`${rel} not found. Run this script from the repository root.`);
  }

  const txt = read(t.file);
  let current;
  try {
    current = t.get(txt);
  } catch (e) {
    fail(`could not parse ${rel}: ${e.message}`);
  }
  if (!current) fail(`could not find a version in ${rel}`);
  seen.add(current);

  if (checkOnly) {
    if (version && current !== version) {
      console.error(`  ✗ ${rel}: ${current} (expected ${version})`);
      problems++;
    } else {
      console.log(`  ✓ ${rel}: ${current}`);
    }
    continue;
  }

  const next = t.set(txt, version);
  if (t.get(next) !== version) fail(`failed to update version in ${rel}`);
  fs.writeFileSync(t.file, next);
  console.log(`  ✓ ${rel}: ${current} -> ${version}`);
}

if (checkOnly) {
  if (!version && seen.size > 1) {
    console.error(`[sync-version] ERROR: version files disagree: ${[...seen].join(', ')}`);
    process.exit(1);
  }
  if (problems) process.exit(1);
  console.log('[sync-version] All version files are consistent.');
} else {
  console.log(`[sync-version] Version synchronized to ${version}.`);
}
