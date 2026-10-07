#!/usr/bin/env node
/**
 * Resolves the release tag/version and builds release notes.
 *
 * Inputs (env):
 *   RELEASE_TAG        tag to release (e.g. v1.2.3). Falls back to the pushed tag,
 *                      then the tag on HEAD, then the latest reachable tag.
 *   PREVIOUS_TAG       optional override for the comparison base.
 *   GITHUB_REPOSITORY  owner/name, used for links.
 *   GITHUB_TOKEN       optional; enables GitHub's auto-generated notes.
 *   OUTPUT_FILE        defaults to release_notes.md
 *
 * Outputs: <OUTPUT_FILE>, plus tag / version / prev_tag / prerelease step outputs.
 *
 * All git/gh calls use execFileSync with argument arrays (never a shell), so a
 * hostile tag name from a workflow_dispatch input cannot inject commands.
 */
const { execFileSync } = require('child_process');
const fs = require('fs');

const TAG_RE = /^v?\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/;

function run(cmd, args) {
  try {
    return execFileSync(cmd, args, {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
  } catch {
    return '';
  }
}
const git = (...args) => run('git', args);
const refExists = (ref) => git('rev-parse', '--verify', '--quiet', `${ref}^{commit}`) !== '';

function fail(msg) {
  console.error(`[generate-release-notes] ERROR: ${msg}`);
  process.exit(1);
}

// ---------------------------------------------------------------- 1. tag
let tag = (process.env.RELEASE_TAG || '').trim();
if (!tag && process.env.GITHUB_REF_TYPE === 'tag') tag = (process.env.GITHUB_REF_NAME || '').trim();
if (!tag) tag = git('describe', '--tags', '--exact-match', 'HEAD');
if (!tag) tag = git('describe', '--tags', '--abbrev=0');

if (!tag) {
  fail('Could not determine a release tag. Push a tag like v1.0.0 or pass release_tag.');
}
if (!TAG_RE.test(tag)) {
  fail(`Tag "${tag}" is not a valid semver tag (expected vMAJOR.MINOR.PATCH[-prerelease]).`);
}

const version = tag.replace(/^v/i, '');
const prerelease = version.includes('-');
// If the tag already exists, notes are computed up to it; otherwise up to HEAD
// (workflow_dispatch can create the tag as part of publishing).
const tagExists = refExists(tag);
const endRef = tagExists ? tag : 'HEAD';

// ------------------------------------------------------------ 2. previous tag
let prevTag = (process.env.PREVIOUS_TAG || '').trim();
if (prevTag && !refExists(prevTag)) {
  console.warn(`[generate-release-notes] PREVIOUS_TAG "${prevTag}" not found, ignoring.`);
  prevTag = '';
}
if (!prevTag) {
  // Highest semver-like tag that is not the current one and is an ancestor of endRef.
  const candidates = git('tag', '--merged', endRef, '--sort=-v:refname')
    .split('\n')
    .map((t) => t.trim())
    .filter((t) => t && t !== tag && TAG_RE.test(t));
  prevTag = candidates[0] || '';
}

// ----------------------------------------------------------------- 3. commits
const range = prevTag ? `${prevTag}..${endRef}` : endRef;
const logArgs = ['log', range, '--no-merges', '--pretty=format:%H%x09%h%x09%an%x09%s'];
if (!prevTag) logArgs.splice(2, 0, '-n', '50');

const rawCommits = git(...logArgs).split('\n').map((l) => l.trim()).filter(Boolean);
const repo = (process.env.GITHUB_REPOSITORY || '').trim();

// Optional: GitHub-generated notes.
let githubNotes = '';
if (repo && process.env.GITHUB_TOKEN) {
  const ghArgs = ['api', `repos/${repo}/releases/generate-notes`, '-f', `tag_name=${tag}`];
  if (prevTag) ghArgs.push('-f', `previous_tag_name=${prevTag}`);
  if (!tagExists) ghArgs.push('-f', `target_commitish=${git('rev-parse', 'HEAD')}`);
  const res = run('gh', ghArgs);
  if (res) {
    try {
      githubNotes = (JSON.parse(res).body || '').trim();
    } catch {
      /* fall back to commit-based notes */
    }
  }
}

const categories = {
  features: { title: '🚀 Features & Enhancements', items: [] },
  fixes: { title: '🐛 Bug Fixes', items: [] },
  perf: { title: '⚡ Performance Improvements', items: [] },
  ui: { title: '🎨 UI & Visualization', items: [] },
  refactor: { title: '🛠️ Architecture & Maintenance', items: [] },
  docs: { title: '📚 Documentation', items: [] },
  other: { title: '🔍 Other Changes', items: [] },
};

for (const line of rawCommits) {
  const [hash, shortHash, author, ...rest] = line.split('\t');
  const subject = rest.join('\t');
  if (!hash || !subject) continue;

  // Skip automated release/version commits.
  if (/^chore\(release\):|^release:|^v\d+\.\d+\.\d+/i.test(subject)) continue;

  const link = repo
    ? `[\`${shortHash}\`](https://github.com/${repo}/commit/${hash})`
    : `\`${shortHash}\``;
  const entry = `- ${subject} (${link})${author ? ` by ${author}` : ''}`;

  const s = subject.toLowerCase();
  if (/^feat(\(.*?\))?!?:/.test(s)) categories.features.items.push(entry);
  else if (/^(fix|bug|hotfix)(\(.*?\))?!?:/.test(s)) categories.fixes.items.push(entry);
  else if (/^perf(\(.*?\))?!?:/.test(s)) categories.perf.items.push(entry);
  else if (/^(ui|style|theme|design)(\(.*?\))?!?:/.test(s)) categories.ui.items.push(entry);
  else if (/^(refactor|chore|build|ci|deps|test)(\(.*?\))?!?:/.test(s)) categories.refactor.items.push(entry);
  else if (/^docs(\(.*?\))?!?:/.test(s)) categories.docs.items.push(entry);
  else categories.other.items.push(entry);
}

// ------------------------------------------------------------------ 4. body
let body = `## VAMPIO Native Desktop Release v${version}\n\n`;
body += `### 📦 Platform Binaries & Downloads\n`;
body += `- **Windows**: \`.exe\` (NSIS) installer & \`.msi\` package\n`;
body += `- **macOS**: Universal binary (Apple Silicon + Intel) \`.dmg\` installer & \`.app\` bundle\n`;
body += `- **Linux**: portable \`.AppImage\` & Debian/Ubuntu \`.deb\` package\n\n`;
body += `> Builds are not code-signed. Windows SmartScreen / macOS Gatekeeper may warn on first launch.\n\n`;

if (githubNotes) body += `### 📋 What's Changed\n\n${githubNotes}\n\n`;

body += `### 📝 Detailed Commit Log\n\n`;
let hasCommits = false;
for (const cat of Object.values(categories)) {
  if (!cat.items.length) continue;
  hasCommits = true;
  body += `#### ${cat.title}\n${cat.items.join('\n')}\n\n`;
}
if (!hasCommits && !githubNotes) {
  body += `*Initial release or no commit history found between tags.*\n\n`;
}

if (prevTag && repo) {
  body += `**Full Changelog**: https://github.com/${repo}/compare/${prevTag}...${tag}\n`;
} else if (prevTag) {
  body += `**Compared against**: \`${prevTag}\` → \`${tag}\`\n`;
}

// ---------------------------------------------------------------- 5. output
const outputFile = process.env.OUTPUT_FILE || 'release_notes.md';
fs.writeFileSync(outputFile, body, 'utf8');

console.log('[generate-release-notes] Prepared release metadata:');
console.log(`  - Tag:          ${tag}${tagExists ? '' : ' (not yet created; using HEAD)'}`);
console.log(`  - Version:      ${version}`);
console.log(`  - Prerelease:   ${prerelease}`);
console.log(`  - Previous tag: ${prevTag || 'none (initial release)'}`);
console.log(`  - Commits:      ${rawCommits.length}`);
console.log(`  - Output file:  ${outputFile}`);

if (process.env.GITHUB_OUTPUT) {
  fs.appendFileSync(
    process.env.GITHUB_OUTPUT,
    [
      `tag=${tag}`,
      `version=${version}`,
      `prev_tag=${prevTag}`,
      `prerelease=${prerelease}`,
      `tag_exists=${tagExists}`,
      `notes_file=${outputFile}`,
    ].join('\n') + '\n',
    'utf8',
  );
}
