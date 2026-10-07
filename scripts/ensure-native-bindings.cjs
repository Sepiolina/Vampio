#!/usr/bin/env node
/**
 * Ensures native Tauri CLI, Rollup, LightningCSS, and Tailwind bindings
 * are correctly installed and linked for the host platform and architecture.
 *
 * Fixes npm optional dependencies bug (#4828) in CI/CD environments:
 * https://github.com/npm/cli/issues/4828
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

function isMusl() {
  if (process.platform !== 'linux') return false;
  try {
    const { report } = process;
    if (report && typeof report.getReport === 'function') {
      const rep = report.getReport();
      if (rep && rep.header && rep.header.glibcVersionRuntime === undefined) {
        return true;
      }
    }
  } catch {}
  return false;
}

function getPlatformMatrix() {
  const platform = process.platform;
  const arch = process.arch;
  const musl = isMusl();

  const key = `${platform}-${arch}${musl ? '-musl' : ''}`;
  return { platform, arch, musl, key };
}

function getExpectedBindings() {
  const { platform, arch, musl, key } = getPlatformMatrix();

  const bindings = {
    tauriCli: null,
    rollup: null,
    lightningcss: null,
    oxide: null,
    esbuild: null,
  };

  if (platform === 'win32' && arch === 'x64') {
    bindings.tauriCli = '@tauri-apps/cli-win32-x64-msvc';
    bindings.rollup = '@rollup/rollup-win32-x64-msvc';
    bindings.lightningcss = 'lightningcss-win32-x64-msvc';
    bindings.oxide = '@tailwindcss/oxide-win32-x64-msvc';
    bindings.esbuild = '@esbuild/win32-x64';
  } else if (platform === 'win32' && arch === 'arm64') {
    bindings.tauriCli = '@tauri-apps/cli-win32-arm64-msvc';
    bindings.rollup = '@rollup/rollup-win32-arm64-msvc';
    bindings.esbuild = '@esbuild/win32-arm64';
  } else if (platform === 'darwin' && arch === 'arm64') {
    bindings.tauriCli = '@tauri-apps/cli-darwin-arm64';
    bindings.rollup = '@rollup/rollup-darwin-arm64';
    bindings.lightningcss = 'lightningcss-darwin-arm64';
    bindings.oxide = '@tailwindcss/oxide-darwin-arm64';
    bindings.esbuild = '@esbuild/darwin-arm64';
  } else if (platform === 'darwin' && arch === 'x64') {
    bindings.tauriCli = '@tauri-apps/cli-darwin-x64';
    bindings.rollup = '@rollup/rollup-darwin-x64';
    bindings.lightningcss = 'lightningcss-darwin-x64';
    bindings.oxide = '@tailwindcss/oxide-darwin-x64';
    bindings.esbuild = '@esbuild/darwin-x64';
  } else if (platform === 'linux' && arch === 'x64') {
    bindings.tauriCli = musl ? '@tauri-apps/cli-linux-x64-musl' : '@tauri-apps/cli-linux-x64-gnu';
    bindings.rollup = musl ? '@rollup/rollup-linux-x64-musl' : '@rollup/rollup-linux-x64-gnu';
    bindings.lightningcss = musl ? 'lightningcss-linux-x64-musl' : 'lightningcss-linux-x64-gnu';
    bindings.oxide = musl ? '@tailwindcss/oxide-linux-x64-musl' : '@tailwindcss/oxide-linux-x64-gnu';
    bindings.esbuild = musl ? '@esbuild/linux-x64-musl' : '@esbuild/linux-x64';
  } else if (platform === 'linux' && arch === 'arm64') {
    bindings.tauriCli = musl ? '@tauri-apps/cli-linux-arm64-musl' : '@tauri-apps/cli-linux-arm64-gnu';
    bindings.rollup = musl ? '@rollup/rollup-linux-arm64-musl' : '@rollup/rollup-linux-arm64-gnu';
    bindings.lightningcss = musl ? 'lightningcss-linux-arm64-musl' : 'lightningcss-linux-arm64-gnu';
    bindings.oxide = musl ? '@tailwindcss/oxide-linux-arm64-musl' : '@tailwindcss/oxide-linux-arm64-gnu';
    bindings.esbuild = musl ? '@esbuild/linux-arm64-musl' : '@esbuild/linux-arm64';
  }

  return { key, bindings };
}

function isPackageAvailable(pkgName) {
  if (!pkgName) return true;
  try {
    require.resolve(pkgName);
    return true;
  } catch {
    // Check direct path in node_modules as fallback
    const directPath = path.resolve('node_modules', pkgName);
    return fs.existsSync(directPath);
  }
}

function testTauriCliCanLoad() {
  try {
    require('@tauri-apps/cli');
    return true;
  } catch (err) {
    if (err && err.message && err.message.includes('Cannot find native binding')) {
      return false;
    }
    // If other error, it might still have loaded the binding
    return false;
  }
}

function ensureBindings() {
  const { key, bindings } = getExpectedBindings();
  console.log(`[native-bindings] Checking native binary bindings for host: ${key}`);

  const requiredPackages = Object.values(bindings).filter(Boolean);
  const missingPackages = [];

  for (const pkg of requiredPackages) {
    if (!isPackageAvailable(pkg)) {
      missingPackages.push(pkg);
    }
  }

  const tauriLoadsOk = testTauriCliCanLoad();
  if (!tauriLoadsOk && bindings.tauriCli && !missingPackages.includes(bindings.tauriCli)) {
    missingPackages.push(bindings.tauriCli);
  }

  if (missingPackages.length === 0) {
    console.log(`[native-bindings] ✓ All native bindings for ${key} are present and verified.`);
    return true;
  }

  console.warn(`[native-bindings] ⚠ Missing native binary packages for ${key}:`, missingPackages.join(', '));
  console.log(`[native-bindings] Installing missing platform packages via npm...`);

  try {
    const installCmd = `npm install --no-save ${missingPackages.join(' ')}`;
    console.log(`[native-bindings] Executing: ${installCmd}`);
    execSync(installCmd, { stdio: 'inherit' });

    // Verify after install
    const stillMissing = missingPackages.filter((pkg) => !isPackageAvailable(pkg));
    if (stillMissing.length === 0) {
      console.log(`[native-bindings] ✓ Successfully installed missing native bindings.`);
      return true;
    } else {
      console.warn(`[native-bindings] ⚠ Some packages could not be verified after install:`, stillMissing.join(', '));
      return false;
    }
  } catch (err) {
    console.warn(`[native-bindings] ⚠ Automatic install warning: ${err.message || String(err)}`);
    console.warn(`[native-bindings] If building in CI, ensure @tauri-apps/cli native binding is installed for the target runner.`);
    return false;
  }
}

// Execute when invoked directly
if (require.main === module) {
  try {
    ensureBindings();
  } catch (err) {
    console.warn(`[native-bindings] Unexpected error checking bindings: ${err.message}`);
    // Don't fail postinstall script exit code to avoid breaking npm install in isolated sandboxes
    process.exit(0);
  }
}

module.exports = {
  ensureBindings,
  getExpectedBindings,
  isPackageAvailable,
  testTauriCliCanLoad,
};
