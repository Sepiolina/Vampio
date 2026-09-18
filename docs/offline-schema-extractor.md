# Offline Schema Extractor

The **Schema Extractor** enables users to upload Excel spreadsheets (`.xlsx`, `.xls`) or delimited text files (`.csv`, `.tsv`) and automatically infer their underlying data schema, field types, and generation rules.

---

## 🔒 Local Processing

All parsing and statistical profiling algorithms are executed **locally on your device** (via native desktop runtime or in-browser) using SheetJS (`xlsx`) and background workers:
- **No data leaves your device.**
- **No external APIs or cloud services are invoked.**

---

## 🔍 How Pattern Recognition Works

When a file is loaded or dropped onto VAMPIO, the engine performs the following analytical passes:

```
[Raw Excel/CSV File]
        │
        ▼ (SheetJS in Memory)
[Sheet & Header Parser]
        │
        ▼
[Row Focus Sampling (e.g. 1-500 Rows)]
        │
        ├─► Null Distribution Analysis (% null cells)
        ├─► Cardinality & Uniqueness Ratio
        ├─► Pattern Matching & Type Inference:
        │     • ISO Date / Timestamp detection -> DateTime
        │     • UUID regex detection -> UUID
        │     • Integer vs. Decimal Floating-point -> Int / Float
        │     • Low unique count (<12 unique strings) -> Set/Enum
        │     • Monotonic increments (+1) -> Sequence
        │     • Formatted alphanumeric codes -> RegEx
        │     • Names, emails, IPs, currencies -> Entity
        │
        ▼
[Extracted Field Architecture Blueprint]
        │
        ▼
[Review & Apply: Replace or Append]
```

---

## 🎯 Smart Type Inference Rules

1. **UUIDs**: Matches RFC 4122 pattern `^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$` (case-insensitive).
2. **DateTimes**: Validates ISO date formats, standard SQL dates (`YYYY-MM-DD`), and timestamp values. Infers `start` and `end` bounds from the sample dataset.
3. **Set / Enums**: If a column has fewer than a configurable threshold of unique values (default: 12) across non-null rows, it is classified as a `Set/Enum`. Generates weighted or uniform values matching the source distribution.
4. **Sequences**: Detects incremental counter sequences (e.g., `1, 2, 3, ...` or `1001, 1002, ...`) and calculates the starting offset and step interval.
5. **RegEx Reverse Engineering**: Analyzes fixed-length alphanumeric codes (e.g., `ORD-98214`, `US-WA-091`) to deduce character classes (`[A-Z]`, `\d`) and literal separators.
6. **Numeric Ranges**: Computes observed `min` and `max` values and infers appropriate distribution types (`uniform` vs `normal`).
7. **Null Percentages**: Measures the exact ratio of empty or undefined cells to automatically configure the `nullPercentage` property on the extracted column.

---

## 🕹️ User Controls in the Extractor

- **Sheet Selection**: For multi-tab workbooks, choose any individual worksheet to extract.
- **Row Focus Range**: Specify custom sampling ranges (e.g., `1-500`, `100-2000`, or `all`) to balance profiling depth and browser performance.
- **Column Focus**: Target specific column names (e.g. `user_id, status, amount`) or use `*` for all fields.
- **Extraction Modes**:
  - `realistic`: Balanced heuristics matching observed data distributions and formats.
  - `strict`: Enforces tight regular expression patterns and rigid ranges.
  - `permissive`: Wider bounds and general string/numeric classifications.
- **Review Step**: Inspect, rename, tweak inferred data types, adjust rules, or toggle between **Replace Existing Schema** and **Append to Existing Schema** before applying.
