const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

console.log('--- Step 1: Building Web Application ---');
execSync('npm run build', { stdio: 'inherit' });

console.log('\n--- Step 2: Inlining Assets into Standalone Server ---');
require('./bundle-assets.cjs');

console.log('\n--- Step 3: Preparing Release Directory ---');
const releaseDir = path.resolve(__dirname, '../release');
if (!fs.existsSync(releaseDir)) {
  fs.mkdirSync(releaseDir, { recursive: true });
}

console.log('\n--- Step 4: Compiling to Standalone .exe (No external bundle/installer) ---');
try {
  // Use @yao-pkg/pkg to produce a standalone Windows x64 .exe
  console.log('Running pkg targeting node20-win-x64...');
  execSync(
    'npx --yes @yao-pkg/pkg dist-standalone/server.cjs --target node20-win-x64 --output release/Synthetix.exe',
    { stdio: 'inherit' }
  );
  console.log('\n[SUCCESS] Standalone .exe generated at release/Synthetix.exe');
} catch (err) {
  console.log('Note: If cross-compilation with pkg encountered an issue, testing Node SEA fallback...');
  try {
    execSync('node --experimental-sea-config sea-config.json', { stdio: 'inherit' });
    console.log('[SUCCESS] Generated SEA blob for injection into node.exe on Windows.');
  } catch (seaErr) {
    console.error('Packaging error:', err);
    process.exit(1);
  }
}
