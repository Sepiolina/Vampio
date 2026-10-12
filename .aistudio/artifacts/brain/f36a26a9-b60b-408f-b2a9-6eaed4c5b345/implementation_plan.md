# Implementation Plan: Code Quality & Maintainability Refinement

Refactor the application architecture to separate orchestration from business logic, decompose monolithic views, enforce strict boundary guards, and establish typed error envelopes across the generation pipeline and file system engine.

---

## User Review & Critical Decisions

> [!IMPORTANT]
> The following architectural decisions were confirmed by the user in Phase 1:
> - **Scope**: End-to-end audit across file engine, generation pipeline, and UI modals.
> - **Structural Remedy**: Extract domain sub-hooks and cleanly separate business logic from UI orchestration.
> - **Error Handling**: Add strict boundary guards and explicit typed error envelopes.

---

## 1. Overview & Core Concept

While the application provides extensive capabilities (multi-format synthetic generation, streaming file output, REST API enrichment, offline folder behavior monitoring, and multi-file batching), several core files have become overgrown monoliths:
- `App.tsx` exceeds 2,400 lines, conflating UI state, column management, REST prefetch orchestration, generation loops, and modal routing.
- `FolderMonitorModal.tsx` exceeds 1,000 lines, embedding 4 full tab views, polling cadence, diffing algorithms, and event logging in a single component.
- Error handling in multiple hot paths relies on raw `catch (err: any)` and ad-hoc string formatting instead of structured typed error boundaries.

This refactoring implements targeted **Structural Remedies**:
1. **Separate Orchestration from Presentation**: Extract `useDatasetGenerator` and `useFolderMonitor` hooks to encapsulate background tasks, timeouts, stream writers, and cancel tokens.
2. **Decompose Monolithic Modals**: Split `FolderMonitorModal` tabs into dedicated, single-responsibility sub-components (`RecommendationsTab`, `MetricsTab`, `SchemaTab`, `EventsTab`).
3. **Strict Boundary Guards & Typed Error Envelopes**: Replace untyped `any` errors with a typed `Result<T, E>` / `AppError` envelope that distinguishes file system permissions, generator validation failures, and network timeouts.
4. **Zero-Pill Visual Cleanliness**: Refine metadata and status labels across headers and summary views to comply with the frontend design standard.

---

## 2. Technical Architecture & System Layout

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                            UI View Layer                                    │
│   ┌────────────────────┐ ┌────────────────────┐ ┌────────────────────────┐  │
│   │ App.tsx (Lean UI)  │ │ FolderMonitorModal │ │ FolderSelectModal      │  │
│   └─────────┬──────────┘ └─────────┬──────────┘ └───────────┬────────────┘  │
│             │                      │                        │               │
│             │   ┌──────────────────┴──────────────────┐     │               │
│             │   │ Decomposed Modal Tab Sub-Components │     │               │
│             │   │ - RecommendationsTab                │     │               │
│             │   │ - MetricsTab                        │     │               │
│             │   │ - SchemaTab                         │     │               │
│             │   │ - EventsTab                         │     │               │
│             │   └──────────────────┬──────────────────┘     │               │
└─────────────┼──────────────────────┼────────────────────────┼───────────────┘
              │                      │                        │
              ▼                      ▼                        ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                       Domain Orchestration Hooks                            │
│  ┌───────────────────────────────┐   ┌───────────────────────────────────┐  │
│  │ src/hooks/useDatasetGenerator │   │ src/hooks/useFolderMonitor.ts     │  │
│  │ - Batch generation lifecycle  │   │ - Polling cadence & diffing       │  │
│  │ - Streaming writer management │   │ - Event logging & audit stream    │  │
│  │ - Progress, rate & cancel     │   │ - Analysis caching                │  │
│  └───────────────┬───────────────┘   └─────────────────┬─────────────────┘  │
└──────────────────┼─────────────────────────────────────┼────────────────────┘
                   │                                     │
                   ▼                                     ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                       Core Engine & Typed Boundary Layer                    │
│  ┌───────────────────────────────┐   ┌───────────────────────────────────┐  │
│  │ src/utils/errors.ts           │   │ src/utils/fileSystem.ts           │  │
│  │ - Typed AppError envelopes    │   │ - Single Source of Truth for I/O  │  │
│  │ - Result<T, E> functional map │   │ - Tauri, Web & Virtual Handles    │  │
│  ├───────────────────────────────┤   ├───────────────────────────────────┤  │
│  │ src/utils/generator.ts        │   │ src/utils/folderBehaviorAnalyzer  │  │
│  │ - Strict boundary guards      │   │ - Pure analysis & metric engine   │  │
│  │ - Column spec validation      │   │ - 100% offline file forensics     │  │
│  └───────────────────────────────┘   └───────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 3. Detailed Implementation Steps

### A. Typed Error Boundaries & Result Envelopes (`src/utils/errors.ts`)
1. Create a structured error domain:
   - `FileSystemError`: Permission denied, abort/cancel, path invalid, storage quota.
   - `GeneratorError`: Invalid column spec, circular calculation rule, memory ceiling.
   - `ApiPrefetchError`: Timeout, rate limit, CORS block, bad HTTP response.
2. Define a clean `Result<T, E>` pattern (`ok(val)` / `err(error)`) for robust edge case handling without untyped rejections.

### B. Extract Generation Orchestration (`src/hooks/useDatasetGenerator.ts`)
1. Move batch generation, streaming generation, cancellation tokens, row rate estimation, and multi-file writing out of `App.tsx` into `useDatasetGenerator`:
   - Inputs: columns, format, output destination, directory handle, action config, table name.
   - State: `isGenerating`, `progress`, `recordsGenerated`, `currentThroughput`, `error`.
   - Actions: `startBatchGeneration(count)`, `startStreaming(intervalMs, targetCount)`, `stopGeneration()`.
2. Ensure race condition safety: clean up timers and file streams when unmounted or aborted.

### C. Decompose `FolderMonitorModal.tsx` & Extract `useFolderMonitor.ts`
1. Create `src/hooks/useFolderMonitor.ts`:
   - Manages periodic polling (every 3s), file diffing (added, modified, removed), analysis trigger, and event buffer.
2. Break down `FolderMonitorModal.tsx` into modular sub-components:
   - `src/components/folderMonitor/FolderMonitorRecommendationsTab.tsx`
   - `src/components/folderMonitor/FolderMonitorMetricsTab.tsx`
   - `src/components/folderMonitor/FolderMonitorSchemaTab.tsx`
   - `src/components/folderMonitor/FolderMonitorEventsTab.tsx`
3. Reduce `FolderMonitorModal.tsx` from 1,050+ lines to ~200 lines of clean container orchestration.

### D. Enforce Strict Boundary Guards in Generation Engine
1. In `src/utils/generator.ts`:
   - Add boundary checks for `Int`, `Float`, `DateTime`, `Sequence`, and `Calculation` types to prevent `NaN`, infinite loops, or out-of-range dates when rules contain malformed inputs.
   - Prevent division by zero and circular dependencies in calculation expressions.
2. In `src/utils/export.ts`:
   - Validate multi-file index formatting and template substitution so empty templates cleanly default to `{tableName}_{index}.{ext}`.

### E. Frontend Design Standards
1. Replace metadata pills in header strips with clean unboxed typographic labels separated by `·`.
2. Ensure interactive tabs remain functional segmented buttons while static counts remain quiet text.

---

## 4. Verification & Validation Steps

1. **Unit Testing (`vitest run`)**:
   - Maintain 100% pass rate across all existing test suites.
   - Add unit tests for typed error boundaries (`errors.test.ts`) and generator boundary guards.
2. **Compilation & Static Analysis**:
   - `npx tsc --noEmit` (`lint_applet`) to ensure zero TypeScript errors or missing types.
   - `npm run build` (`compile_applet`) to confirm clean Vite bundle creation.
3. **End-to-End Workflow Verification**:
   - Batch generation: generate 5,000 rows across CSV, JSON, and Parquet/SQL.
   - Streaming generation: stream with 150ms interval, pause/resume, and stop safely.
   - Folder monitor: open modal, inspect real folder, test tab switching, and apply recommendations.
