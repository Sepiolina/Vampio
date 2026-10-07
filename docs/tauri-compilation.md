# Compiling & Running with Tauri

VAMPIO is fully migrated and configured as a native desktop application using **Tauri v2** and **React 19 + Vite**.

---

## 🛠️ Prerequisites for Native Compilation

To compile native desktop binaries, ensure you have the standard Tauri/Rust prerequisites installed on your system:

1. **Node.js**: v18+ with `npm`
2. **Rust & Cargo**: Latest stable Rust toolchain:
   ```bash
   # macOS / Linux
   curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh

   # Windows
   # Download and run rustup-init.exe from https://rustup.rs
   ```
3. **OS-Specific Build Tools**:
   - **macOS**: Xcode Command Line Tools (`xcode-select --install`)
   - **Windows**: Microsoft C++ Build Tools (from Visual Studio Build Tools, with C++ development tools selected)
   - **Linux (Ubuntu/Debian)**:
     ```bash
     sudo apt update && sudo apt install -y libwebkit2gtk-4.1-dev build-essential curl wget file libxdo-dev libssl-dev libayatana-appindicator3-dev librsvg2-dev
     ```

---

## 🚀 Running in Development Mode

Launch the application inside a native desktop window with hot reloading:

```bash
npm run tauri:dev
```

This will:
1. Boot the Vite dev server at `http://localhost:3000`.
2. Compile and launch the native Rust Tauri shell pointing to the local dev server.

---

## 📦 Compiling Production Desktop Binaries

To compile an optimized, standalone release installer:

```bash
npm run tauri:build
```

This executes:
1. `npm run build` (builds minified React + Vite assets into `dist/`).
2. `cargo tauri build` (compiles Rust binaries and bundles them into platform-specific packages).

### Generated Output Artifacts (`src-tauri/target/release/bundle/`)
- **Windows**: `.exe` standalone installer / `.msi` package
- **macOS**: `.dmg` disk image / `.app` bundle (supports Apple Silicon `aarch64` and Intel `x86_64`)
- **Linux**: `.deb` package / `.AppImage` standalone portable executable

---

## ⚙️ Architecture & Configuration Files

| File | Purpose |
| :--- | :--- |
| `src-tauri/tauri.conf.json` | Tauri v2 application configuration: window dimensions, dev/build scripts, security, and icon paths. |
| `src-tauri/Cargo.toml` | Rust crate manifest and dependency definitions (`tauri v2`, `serde`, `serde_json`). |
| `src-tauri/src/main.rs` & `lib.rs` | Tauri v2 desktop entry point and runtime builder. |
| `src-tauri/capabilities/default.json` | Security permissions and window capabilities. |
| `src-tauri/icons/` | Native app icons (`32x32.png`, `128x128.png`, `128x128@2x.png`, `icon.png`, `icon.ico`). |
| `vite.config.ts` | Configured with `clearScreen: false`, `port: 3000`, and `strictPort: true` for Tauri IPC integration. |

---

## 🚢 CI & Releases

**CI** (`.github/workflows/CI.yml`) runs on every push/PR: typecheck, unit tests and Vite build on Node 20 and 22, `rustfmt` + `clippy` on the Tauri crate, and a check that the version in `package.json`, `tauri.conf.json` and `Cargo.toml` agree.

**Releasing:**

```bash
git tag v1.2.3
git push origin v1.2.3
```

The release workflow then:
1. Validates the tag (`vMAJOR.MINOR.PATCH[-prerelease]`), generates notes and creates **one draft** release.
2. Runs typecheck + tests as a gate.
3. Builds Windows (`.msi`/`.exe`), macOS universal (`.dmg`), and Linux (`.deb`/`.AppImage`) installers in parallel and attaches them to the draft. The app version is synced from the tag automatically.
4. Publishes the release **only if every platform's installer is present**. If any build fails, the release stays a draft and nothing half-finished goes public; re-run the failed jobs.

You can also run it manually from the Actions tab (optionally as a draft). Keep `src-tauri/Cargo.lock` committed; run `cargo update` in `src-tauri/` to refresh dependencies.

> Installers are not code-signed. Windows SmartScreen and macOS Gatekeeper may warn on first launch.
