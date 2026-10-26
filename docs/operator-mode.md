# Operator Mode

Operator Mode inspects a local folder and creates a reusable simulation profile for a developer. Choose it on first launch or through **Others → Switch to Operator Mode**. The same monitor is available in Developer Studio through **Others → Target Folder Behavior Monitor**.

## Inspect a folder

1. Select a folder to monitor. A folder picker that supports live handles can be rescanned; a file-list fallback is a snapshot and requires selecting the folder again to refresh it.
2. Review recommendations, source files, encoding evidence, per-file formats, extracted fields and events. Live directory monitoring starts automatically; pause it when repeated reads are unnecessary. Uploads remain snapshots.
3. In a mixed folder, expand a file profile and choose **Use for simulation** to select its schema. The inventory and Markdown report still cover every discovered file.
4. Review the simulation rules and export the artifact you need.
5. In Developer Studio, import the profile bundle to restore the suggested workspace, then review the destination and generate a small test batch before starting continuous output.

Analysis stays on your device. Content inspection is sampled, with explicit byte and file limits. An incomplete sample can omit later fields and cut off a final record. An unreadable or skipped file has no reliable content profile. Folder modification times support a cadence estimate; repeated scans provide evidence of actual growth, additions, removals and truncation. A successful read does not prove the absence of an OS lock, and a read error may mean denied permissions rather than a lock.

## Choose an export

| Export | Use | Import |
| --- | --- | --- |
| Profile bundle (`.json`) | Main reusable profile: schema, source findings and recommended simulation settings | **Others → Import Machine Profile Bundle** in Developer Studio |
| Simulation template (`-simulation.json`) | Reuse the inferred columns and generator rules in another workspace | Schema/preset selector's schema import |
| Inspection report (`.md`) | Share readable documentation of the files inspected, evidence, rules, settings and limitations | Read as Markdown; this is documentation, not an import format |

Raw snippets and sample rows are omitted by default. The sample inclusion control explicitly adds these production values to supported exports. Filenames, paths, column names, inferred enums/constants and numeric ranges can still reveal source information even with samples disabled. Review every artifact before sharing it.

## What the findings mean

Encoding and language labels are heuristic findings with confidence and evidence. BOMs and valid byte sequences provide stronger evidence than already-decoded text; some legacy encodings remain ambiguous. Per-file profiles help identify mixed folders instead of assuming every file matches the selected schema sample.

JSONL and delimited files yield structured fields where recognized. Apache-style, timestamp/level, key-value and generic text logs may yield useful field approximations. Binary or unrecognized input may have no extractable schema. The suggested template may use a fallback when extraction cannot find fields; check its stated reason and confidence.

Simulation generates new values using the extracted rules. It does not replay exact original records, relationships, timing, legacy encoding, BOMs or arbitrary raw log layouts. Output uses UTF-8 and each selected format's serializer. Custom delimiters and exact text log layouts need a custom serializer. Template-only imports load columns and table name; their metadata documents suggested settings but does not apply them. The profile bundle is the main route for restoring simulation settings; review the destination before writing files.

Profile imports restore the row count, interval, execution mode, filename pattern and selected schema. They start with a new browser download named for the simulation. Source directories are kept separate from output destinations, and source append suggestions become fresh output until you explicitly configure an append target.

## Review column types

Expand **How Enum, Regex and String are chosen** for the decision criteria, then inspect **Why this type?** beside each inferred field. Status values such as `OK`, `Error`, and `not OK` become enums with their observed frequencies even under unrelated column names. Repeated short categories favor Enum; mostly unique codes with a consistent shape favor Regex; free text and uncertain evidence stay String. Sample counts, distinct counts and confidence help distinguish a well-observed choice from a provisional one. Every observed enum label is retained, including labels with spaces or commas.

After applying the schema, Developer Studio lets you change the type and generation rule. Exported profiles, simulation templates and Markdown reports retain the inference explanation. For detailed thresholds, see [Log profile exports](./log-profiles.md#column-inference-criteria).

When opening generated CSV in Excel, `#######` is a spreadsheet display issue: CSV has no column widths. AutoFit the date/time columns or choose **Use XLSX with fitted columns** in the generation panel. Time-only source values now generate clock values instead of full timestamps.
