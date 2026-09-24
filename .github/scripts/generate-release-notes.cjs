const { execSync } = require('child_process');
const fs = require('fs');

function run(cmd) {
  try {
    return execSync(cmd, { encoding: 'utf8', stdio: ['pipe', 'pipe', 'ignore'] }).trim();
  } catch {
    return '';
  }
}

// 1. Automatically get tag & version
let tag = (process.env.RELEASE_TAG || '').trim();

if (!tag && process.env.GITHUB_REF_TYPE === 'tag') {
  tag = (process.env.GITHUB_REF_NAME || '').trim();
}

if (!tag && process.env.GITHUB_REF && process.env.GITHUB_REF.startsWith('refs/tags/')) {
  tag = process.env.GITHUB_REF.replace('refs/tags/', '').trim();
}

if (!tag) {
  // Check if HEAD has an exact tag
  tag = run('git describe --tags --exact-match HEAD');
}

if (!tag) {
  // Check latest reachable tag
  tag = run('git describe --tags --abbrev=0');
}

// Fallback to v1.0.0 if no tags found
if (!tag) {
  tag = 'v1.0.0';
}

// Automatically extract clean semver version from tag (strips leading 'v' or 'V')
const version = tag.replace(/^v/i, '');

// 2. Find previous tag to compare against
let prevTag = (process.env.PREVIOUS_TAG || '').trim();

if (!prevTag) {
  // Find the immediate previous tag before current tag
  prevTag = run(`git describe --tags --abbrev=0 "${tag}^" 2>/dev/null`);
}

if (!prevTag) {
  // Try retrieving list of tags sorted by tag creation
  const allTags = run('git tag --sort=-creatordate')
    .split('\n')
    .map(t => t.trim())
    .filter(Boolean);

  const currentIndex = allTags.indexOf(tag);
  if (currentIndex !== -1 && currentIndex + 1 < allTags.length) {
    prevTag = allTags[currentIndex + 1];
  } else if (allTags.length > 0 && allTags[0] !== tag) {
    prevTag = allTags[0];
  }
}

// 3. Get details of changes from commits
let gitLogCmd = '';
if (prevTag) {
  gitLogCmd = `git log "${prevTag}..HEAD" --pretty=format:"%H%x09%h%x09%an%x09%s" --no-merges`;
} else {
  gitLogCmd = `git log HEAD -n 50 --pretty=format:"%H%x09%h%x09%an%x09%s" --no-merges`;
}

const rawCommits = run(gitLogCmd)
  .split('\n')
  .map(line => line.trim())
  .filter(Boolean);

const repo = (process.env.GITHUB_REPOSITORY || '').trim();

// Try GitHub API generate-notes if gh CLI and token are present
let githubNotes = '';
if (repo && process.env.GITHUB_TOKEN) {
  try {
    let ghCmd = `gh api repos/${repo}/releases/generate-notes -f tag_name="${tag}"`;
    if (prevTag) {
      ghCmd += ` -f previous_tag_name="${prevTag}"`;
    }
    const res = run(ghCmd);
    if (res) {
      const parsed = JSON.parse(res);
      if (parsed.body) {
        githubNotes = parsed.body.trim();
      }
    }
  } catch {
    // Graceful fallback to commit-based notes
  }
}

// Categorize commits
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
  const parts = line.split('\t');
  if (parts.length < 4) continue;
  const [hash, shortHash, author, subject] = parts;

  // Skip automated version bump or release commits in changelog
  if (/^chore\(release\):|^release:|^v\d+\.\d+\.\d+/i.test(subject)) {
    continue;
  }

  const commitLink = repo
    ? `[\`${shortHash}\`](https://github.com/${repo}/commit/${hash})`
    : `\`${shortHash}\``;

  const authorText = author ? `by @${author}` : '';
  const formattedLine = `- ${subject} (${commitLink}) ${authorText}`.trim();

  const lower = subject.toLowerCase();
  if (/^feat(\(.*\))?:/.test(lower)) {
    categories.features.items.push(formattedLine);
  } else if (/^fix(\(.*\))?:|^bug(\(.*\))?:|^hotfix(\(.*\))?:/.test(lower)) {
    categories.fixes.items.push(formattedLine);
  } else if (/^perf(\(.*\))?:/.test(lower)) {
    categories.perf.items.push(formattedLine);
  } else if (/^(ui|style|theme|design)(\(.*\))?:/.test(lower)) {
    categories.ui.items.push(formattedLine);
  } else if (/^(refactor|chore|build|ci|deps)(\(.*\))?:/.test(lower)) {
    categories.refactor.items.push(formattedLine);
  } else if (/^docs(\(.*\))?:/.test(lower)) {
    categories.docs.items.push(formattedLine);
  } else {
    categories.other.items.push(formattedLine);
  }
}

// 4. Construct release markdown body
let body = `## VAMPIO Native Desktop Release v${version}\n\n`;

body += `### 📦 Platform Binaries & Downloads\n`;
body += `- **Windows**: Standalone \`.exe\` installer & \`.msi\` enterprise package\n`;
body += `- **macOS**: Universal Binary (Apple Silicon M-Series + Intel x86_64) \`.dmg\` installer & \`.app\` bundle\n`;
body += `- **Linux**: Standalone portable \`.AppImage\` & Debian/Ubuntu \`.deb\` package\n\n`;

if (githubNotes) {
  body += `### 📋 What's Changed\n\n${githubNotes}\n\n`;
}

body += `### 📝 Detailed Commit Log\n\n`;

let hasCommits = false;
for (const key of Object.keys(categories)) {
  const cat = categories[key];
  if (cat.items.length > 0) {
    hasCommits = true;
    body += `#### ${cat.title}\n`;
    body += cat.items.join('\n') + '\n\n';
  }
}

if (!hasCommits && !githubNotes) {
  body += `*Initial release or no commit history found between tags.*\n\n`;
}

if (prevTag && repo) {
  body += `**Full Changelog & Comparison**: https://github.com/${repo}/compare/${prevTag}...${tag}\n`;
} else if (prevTag) {
  body += `**Comparing against previous tag**: \`${prevTag}\` → \`${tag}\`\n`;
}

// 5. Write release body to file
const outputFile = process.env.OUTPUT_FILE || 'release_notes.md';
fs.writeFileSync(outputFile, body, 'utf8');

console.log(`[generate-release-notes] Successfully prepared release metadata:`);
console.log(`  - Tag: ${tag}`);
console.log(`  - Version: ${version}`);
console.log(`  - Previous Tag: ${prevTag || 'none (initial release)'}`);
console.log(`  - Output File: ${outputFile}`);

// 6. Set outputs for GitHub Actions step
if (process.env.GITHUB_OUTPUT) {
  const delimiter = `RELEASE_BODY_DELIMITER_${Date.now()}`;
  const githubOutput = [
    `tag=${tag}`,
    `version=${version}`,
    `prev_tag=${prevTag || ''}`,
    `release_body<<${delimiter}`,
    body,
    delimiter,
  ].join('\n') + '\n';

  fs.appendFileSync(process.env.GITHUB_OUTPUT, githubOutput, 'utf8');
}
