const fs = require('fs');
const path = require('path');

// Extract clean version from env or arguments
const rawVersion = process.env.RELEASE_VERSION || process.argv[2] || '';
const version = rawVersion.replace(/^v/i, '').trim();

if (!version) {
  console.error('[sync-version] Error: No version specified. Provide RELEASE_VERSION env variable or pass as argument.');
  process.exit(1);
}

console.log(`[sync-version] Synchronizing application version across configs to: ${version}`);

// 1. Update package.json
const pkgPath = path.resolve('package.json');
if (fs.existsSync(pkgPath)) {
  try {
    const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
    pkg.version = version;
    fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n');
    console.log(`  ✓ Updated package.json version -> ${version}`);
  } catch (err) {
    console.error(`  ✗ Failed to update package.json:`, err.message);
  }
}

// 2. Update src-tauri/tauri.conf.json
const tauriConfPath = path.resolve('src-tauri/tauri.conf.json');
if (fs.existsSync(tauriConfPath)) {
  try {
    const tauriConf = JSON.parse(fs.readFileSync(tauriConfPath, 'utf8'));
    tauriConf.version = version;
    fs.writeFileSync(tauriConfPath, JSON.stringify(tauriConf, null, 2) + '\n');
    console.log(`  ✓ Updated src-tauri/tauri.conf.json version -> ${version}`);
  } catch (err) {
    console.error(`  ✗ Failed to update tauri.conf.json:`, err.message);
  }
}

// 3. Update src-tauri/Cargo.toml
const cargoPath = path.resolve('src-tauri/Cargo.toml');
if (fs.existsSync(cargoPath)) {
  try {
    let cargo = fs.readFileSync(cargoPath, 'utf8');
    cargo = cargo.replace(/^version\s*=\s*"[^"]+"/m, `version = "${version}"`);
    fs.writeFileSync(cargoPath, cargo);
    console.log(`  ✓ Updated src-tauri/Cargo.toml version -> ${version}`);
  } catch (err) {
    console.error(`  ✗ Failed to update Cargo.toml:`, err.message);
  }
}

console.log('[sync-version] Version synchronization complete.');
