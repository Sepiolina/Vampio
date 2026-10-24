# Log profile exports

`FolderAnalysisResult` is the common input for machine profiles, simulation schemas and human-readable inspection reports. The main import route is the versioned workspace profile bundle in `folderBehaviorAnalyzer.ts`. It carries workspace settings as well as inspection findings; validate bundles before applying them.

`src/utils/profileExports.ts` supplies pure deterministic helpers:

```ts
exportLogProfileMarkdown(analysis, { includeSamples: false });
buildSimulationTemplate(analysis);
exportSimulationTemplateJson(analysis);
getSimulationFormat(analysis);
```

For workspace import, `workspaceSettingsFromProfile()` restores the simulation settings into a fresh download destination. Its result is also accepted by `createDefaultWorkspace()` and the workspace importer. Version-1 bundles remain compatible; the new `batchCount`, `generationMode`, `filename`, per-file profiles, and sample-inclusion flag are optional. The importer validates nested data before rendering or running it.

File profiles carry a stable `sourceId` (`relativePath` or filename); `analysis.sampleFileUsed` identifies the selected source with that ID. Pass an optional fourth source ID to `analyzeFolderFiles()` or use `useFolderMonitor().selectSchemaSource()` to switch schemas without dropping the folder inventory. File-list snapshots never poll. Directory scans are serialized and stale completions cannot overwrite a newly selected source.

Content reads are limited to 64 KiB per file and 25 files by default. Native sampling uses read-only `open`/`read` handles that close in `finally`; complete bounded XLSX/XLS workbooks retain schema support. OS exclusive locks are not probed by attempting writes. The monitor records read errors and explicit sharing-violation evidence, plus observed metadata changes; it cannot establish lock ownership, continuous append or rotation solely from metadata.

Regression checks:

```bash
npm run lint
npm test
npm run build
# With npm run dev running; requires Python Playwright and Chromium:
python scripts/check-log-monitor.py
```

The Markdown report uses the analysis timestamp and records inventory, retained sample byte counts, per-file encoding/format evidence and confidence, truncation/read status, schema rules, recommendations and compatibility limits. When per-file profiles are unavailable it says so explicitly. By default it excludes raw snippets, extracted sample values and per-file sample rows. `includeSamples: true` opts into those fields. Table content is escaped, untrusted controls are made visible, and sample fences exceed the longest embedded backtick run.

The schema export has `{ tableName, columns, metadata }`, which the existing PresetSelector schema importer accepts. Columns preserve generator rules, IDs and dependencies; metadata describes source encoding, recommended output settings, privacy and limitations. The importer intentionally applies only columns and table name. A schema import does not configure cadence, format, filename or destination; use the full profile bundle for that workflow.

Neither default export is an anonymization boundary: names, paths, constants, enum rules and inferred ranges may retain source details. Do not add source records to schema metadata. Review before sharing, especially if a source column is modeled as an enum.

Inference describes bounded observed content. A confidence value is evidence strength, not certainty, and no portable read operation establishes an OS lock. Generated records are normalized synthetic output: JSONL is structured records, CSV/TSV have fixed separators, and TXT is a generic serializer rather than an exact log layout. Current text exports use UTF-8; source legacy encoding, BOM, newline style, nested structure, cross-field semantics and exact producer timing are not automatically reproduced. Explicitly document any custom serializer needed by a consuming system.
