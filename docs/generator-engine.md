# Generator Engine & Performance Architecture

The VAMPIO generation core is engineered for low latency, memory efficiency, and real-time responsiveness.

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
- Employs chunked streaming to prevent browser heap exhaustion when generating datasets of 100,000+ rows.
- Uses the modern **File System Access API** (`showDirectoryPicker` / `FileSystemWritableFileStream`) to stream data directly into the user's selected operating system folder without holding the entire dataset in RAM.
- Falls back to buffered `Blob` chunks and download triggers when the File System Access API is unsupported or permissions are denied.

### 3. Reactive Preview Throttling
- When editing column specifications, regex patterns, or weights, preview generation runs asynchronously on a micro-batch (e.g. 10–50 rows) to keep the UI smooth at 60 FPS.
- Debounced preview refreshes avoid UI stuttering during rapid keystrokes in the Rule Editor.

---

## 📦 Standalone Packaging & CLI Bundling

VAMPIO includes build scripts for packaging the application as an offline asset bundle or single standalone executable:

- `npm run bundle:assets`: Executes `/scripts/bundle-assets.cjs` to compile web assets into static distributions.
- `npm run package:exe`: Executes `/scripts/package-exe.cjs` to package the Node/Express backend and static Vite UI into a self-contained portable executable.
