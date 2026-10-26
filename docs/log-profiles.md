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
python scripts/check-monitor-inference.py
```

The Markdown report uses the analysis timestamp and records inventory, retained sample byte counts, per-file encoding/format evidence and confidence, truncation/read status, schema rules, recommendations and compatibility limits. When per-file profiles are unavailable it says so explicitly. By default it excludes raw snippets, extracted sample values and per-file sample rows. `includeSamples: true` opts into those fields. Table content is escaped, untrusted controls are made visible, and sample fences exceed the longest embedded backtick run.

The schema export has `{ tableName, columns, metadata }`, which the existing PresetSelector schema importer accepts. Columns preserve generator rules, IDs and dependencies; metadata describes source encoding, recommended output settings, privacy and limitations. The importer intentionally applies only columns and table name. A schema import does not configure cadence, format, filename or destination; use the full profile bundle for that workflow.

Neither default export is an anonymization boundary: names, paths, constants, enum rules and inferred ranges may retain source details. Do not add source records to schema metadata. Review before sharing, especially if a source column is modeled as an enum.

Inference describes bounded observed content. A confidence value is evidence strength, not certainty, and no portable read operation establishes an OS lock. Generated records are normalized synthetic output: JSONL is structured records, CSV/TSV have fixed separators, and TXT is a generic serializer rather than an exact log layout. Current text exports use UTF-8; source legacy encoding, BOM, newline style, nested structure, cross-field semantics and exact producer timing are not automatically reproduced. Explicitly document any custom serializer needed by a consuming system.

## Column inference criteria

The monitor uses `columnInference.ts` for every supported reader. Up to 200 records from the bounded sample are considered together; missing values remain in the statistics, while the first three distinct examples are shown in the UI. Every inferred field records its reason, heuristic confidence, sampled/nonempty/distinct counts and missing ratio. Exported schema notes and Markdown preserve the explanation. Raw frequency lists are included in profile JSON only when samples are explicitly enabled; enum rules themselves retain source labels and weights.

| Choice | Evidence used |
| --- | --- |
| Primitive or recognized format | All nonempty values validate as a number, Boolean, UUID, email, IPv4 address, calendar date, timestamp or clock time. A header alone cannot turn `OK` into a number/date/Boolean. Leading-zero identifiers stay textual. |
| Enum | Known status-like labels, including `OK`, `Error`, `not OK`, `NG` and `NOK`, are retained even in sparse samples. Otherwise compact repeated categories require at least four nonempty samples, at most 32 distinct choices, and a distinct/nonempty ratio of at most 50%. Compact means at most 48 characters and four words without sentence-ending punctuation or newlines. A categorical header can suggest a lower-confidence enum from two compact samples when no strong code pattern is present. |
| Regex | Mostly distinct code tokens share character classes, literal separators and fixed widths. Values contain no whitespace and are at most 64 characters. Mixed letter/digit codes require at least three distinct observations and a distinct/nonempty ratio of at least 70%; uppercase-only codes need six. Zero-padded identifiers can establish their width with fewer observations. |
| String | Prose, multiline/nested content, heterogeneous formats or insufficient evidence for a safe category set/code pattern. The reason states why stronger typing was not selected. |

Enums preserve all observed labels with observed frequency weights; they no longer keep only the first five labels or depend on a `status` header. Common rules remain readable (`OK:8, Error:1, not OK:1`). Labels containing commas, surrounding whitespace or newlines use the lossless form `{"values":[{"value":"Error, retry","weight":1}]}`. The generator, rule preview and Base editor parser share `enumRules.ts` so those labels survive import and generation. Missing ratios become the generated column's null percentage. Numeric ranges can generate unseen intermediate numbers; text code patterns can generate unseen codes. Review inferred rules before using them against a consuming system.

## Times in Excel

Time-only inputs produce time-only rules (`time`, `HH:mm`, or `HH:mm:ss.SSS`) rather than a full date/time. The generator also respects explicit supported date/time token formats. CSV contains those actual string values and never uses display formulas or prefixes to force Excel's interpretation.

CSV cannot store column widths. If Excel displays `#######`, use AutoFit on its date/time columns or choose the XLSX alternative offered in the generation panel. XLSX/XLS exports set bounded widths from displayed values, preserve time strings, and expand narrow columns when appending without shrinking existing wider columns. Tests check workbook cell values, types and width metadata; they do not automate the Excel desktop application.
