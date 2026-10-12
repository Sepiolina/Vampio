# Implementation Plan: Custom JSON Payload Configuration

Allow users to define and configure custom JSON payload structures for both file exports/data preview and webhook action dispatches, using intuitive JSON templates with `{{placeholder}}` variables and built-in presets.

---

## 1. User Requirements & Confirmed Specifications
- **Scope**: Applies to **both** dataset file exports (JSON format/preview) and webhook action payloads.
- **Configuration Method**: JSON template with placeholder variables, paired with instant live preview and validation.
- **Syntax**: Double curly braces, e.g. `{{records}}`, `{{count}}`, `{{timestamp}}`, `{{tableName}}`, and column variables `{{column_name}}`.

---

## 2. Architecture & Data Structures

### A. Types (`src/types.ts`)
```ts
export interface CustomJsonConfig {
  enabled: boolean;
  template: string; // The user-defined JSON template
  rowTemplate?: string; // Optional custom template for individual rows
  prettyPrint: boolean; // 2-space indentation vs compact
}
```
- Integrate `customJsonConfig` into:
  - `WorkspaceSession` (persisted per workspace)
  - `ActionConfig` (webhook configuration, inherits workspace config or has custom override)

### B. Template Interpolation Engine (`src/utils/customJsonTemplate.ts`)
- Build robust template processor:
  - Supports structural replacement: `"data": "{{records}}"` or `"items": "{{records}}"` replaces the placeholder token with the actual parsed rows array (preserving numeric, boolean, null types without stringifying them).
  - Supports primitive replacement: `{{count}}` -> numeric count, `{{timestamp}}` -> ISO string, `{{tableName}}` -> table name, `{{epochMs}}` -> numeric epoch.
  - Supports per-record row templating when customizing row object schemas.
  - JSON syntax validator: Instant linting to notify user if their template has unclosed braces, invalid commas, or syntax errors.
  - Built-in industry presets:
    1. **Standard Flat Array**: `{{records}}`
    2. **REST API Envelope**: `{ "status": "success", "timestamp": "{{timestamp}}", "count": "{{count}}", "data": "{{records}}" }`
    3. **GraphQL Response**: `{ "data": { "dataset": { "totalCount": "{{count}}", "nodes": "{{records}}" } } }`
    4. **Webhook Event Wrapper**: `{ "event": "data.generated", "occurred_at": "{{timestamp}}", "payload": { "table": "{{tableName}}", "records": "{{records}}" } }`
    5. **GeoJSON Feature Collection** (if coordinate columns exist): `{ "type": "FeatureCollection", "features": "{{records}}" }`

---

## 3. Core Engine & Export Integrations

### A. Export & Formatting (`src/utils/export.ts`)
- Update `formatDataset` for `format === 'json'`:
  - When `customJsonConfig?.enabled` is active, apply `renderCustomJsonTemplate(template, rows, metadata)`.
  - Fall back to standard `JSON.stringify(rows, null, 2)` when disabled.

### B. Action & Webhook Dispatcher (`src/utils/actionDispatcher.ts`)
- Update `formatActionPayload`:
  - If custom JSON template is active in action config or workspace, render the custom template with the dispatched batch or per-entry row.

### C. Live Data Preview (`src/components/DataPreview.tsx`)
- Update the `<> JSON` preview tab:
  - Renders the custom JSON structure live so the user immediately sees the exact payload structure their export/webhook will generate.
  - Includes a quick badge indicator `"Custom JSON Template: Active"` with a shortcut button to edit the template.

---

## 4. UI & Modal Implementation

### A. Custom JSON Template Modal (`src/components/CustomJsonConfigModal.tsx`)
- Dedicated, user-friendly modal accessible from:
  1. Top navigation / File menu ("Custom JSON Payload...")
  2. Data Preview JSON tab shortcut button
  3. Generation Deck / Webhook settings
- Features:
  - **Enable/Disable Switch**: Toggle between Default Array and Custom Template.
  - **Preset Gallery**: One-click selection of common API payload structures.
  - **Template Code Editor**: Monospace code editor with syntax color highlights.
  - **Placeholder Variable Chips**: Clickable badges (`{{records}}`, `{{count}}`, `{{timestamp}}`, `{{tableName}}`, plus all active column names) that insert the variable directly at the cursor.
  - **Side-by-side Live Sample Preview**: Real-time rendering with 3 sample rows so users see changes instantly as they type.
  - **Validation Status**: Real-time indicator showing "Valid JSON" or specific line syntax errors.

### B. Integration into Webhook Settings (`src/components/ActionConfigModal.tsx`)
- Add Custom Payload section inside Webhook configuration, allowing either inheriting the workspace's JSON template or defining a dedicated webhook envelope.

---

## 5. Verification & Testing
1. **Compilation**: Run `compile_applet` and `lint_applet` to ensure type safety.
2. **Template Substitution**:
   - Verify `"{{records}}"` renders as a real JSON array (not escaped string `"[{\"id\":1}]"`).
   - Verify `"{{count}}"` renders as a number without syntax errors.
3. **Export Test**:
   - Test JSON file download and copy-to-clipboard with custom template active.
   - Verify turning custom template OFF reverts to clean standard array.
4. **Webhook Dispatch Test**:
   - Test payload generation in `formatActionPayload` matches the custom template.
5. **Data Preview Test**:
   - Verify `<> JSON` tab in the preview view displays the rendered template.
