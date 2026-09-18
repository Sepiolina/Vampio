# Generator Engine & Architecture

The generation core handles data creation, validation, and streaming.

---

## ⚡ Architecture Overview

```
                  ┌─────────────────────────────────┐
                  │          Schema Specs           │
                  │ (Types, Rules, Dist, Null %)    │
                  └────────────────┬────────────────┘
                                   │
                                   ▼
                  ┌─────────────────────────────────┐
                  │         Generator Engine        │
                  │   • Deterministic PRNG          │
                  │   • Cross-Column Evaluator      │
                  │   • Constraint & Unique Cache   │
                  └───────┬─────────────────┬───────┘
                          │                 │
            (Batch / Preview)             (Continuous Stream)
                          │                 │
                          ▼                 ▼
                  ┌───────────────┐   ┌───────────────────────────┐
                  │ Memory Buffer │   │ StreamFileWriter (Chunks) │
                  │ (React State) │   │ • File System Access API  │
                  └───────────────┘   │ • Blob Accumulator        │
                                      └───────────────────────────┘
```

---

## 🧠 Core Components

### 1. `GeneratorEngine` (`/src/utils/generator.ts`)
- Evaluates field rules, compiles regex token trees into pseudo-random string emitters, and samples statistical distributions (Uniform, Box-Muller Normal, Inverse Transform Exponential).
- Resolves cross-column calculations with topological ordering to satisfy column dependencies before evaluation.
- Guarantees uniqueness for fields marked `isUnique` using fast in-memory hash sets with fallback collision retry budgets.

### 2. Stream File Writer (`/src/utils/fileSystem.ts`)
- Employs chunked streaming to prevent memory heap exhaustion when generating datasets of 100,000+ rows.
- **Desktop (Tauri)**: Uses the native Rust `@tauri-apps/plugin-fs` to stream bytes securely and efficiently with zero browser-memory overhead.
- **Web**: Uses the modern **Web File System Access API** (`showDirectoryPicker` / `FileSystemWritableFileStream`) to stream data directly into the user's selected operating system folder.
- Falls back to buffered `Blob` chunks and download triggers when streaming capabilities are unsupported.

### 3. Reactive Preview Throttling
- When editing column specifications, regex patterns, or weights, preview generation runs asynchronously on a micro-batch (e.g. 10–50 rows) to keep the UI smooth at 60 FPS.
- Debounced preview refreshes avoid UI stuttering during rapid keystrokes in the Rule Editor.

---

## 📦 Native Desktop Packaging with Tauri

VAMPIO is compiled into a lightweight native desktop binary using Tauri v2:

- `npm run tauri:dev`: Runs the Vite frontend inside the native Tauri desktop window with live HMR.
- `npm run tauri:build`: Bundles and compiles release binaries (`.exe`, `.msi`, `.dmg`, `.AppImage`) using the Rust toolchain in `src-tauri/`.
See [**`docs/tauri-compilation.md`**](./tauri-compilation.md) for full compilation instructions.
