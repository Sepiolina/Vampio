# Getting Started with VAMPIO

This guide walks you through launching VAMPIO, configuring synthetic data schemas, using the offline extractor, and generating datasets.

---

## 🛠️ Installation & Local Development

### Prerequisites
- Node.js (v18+)
- npm or bun
- **Rust Toolchain** (For native desktop compilation)

### Setup Commands
```bash
# Install dependencies
npm install

# Run the web development server (browser-based)
npm run dev

# Run the native desktop development shell (Tauri)
npm run tauri:dev

# Build the desktop installers for release (Windows/macOS/Linux)
npm run tauri:build
```

---

## 🧭 Workspace Overview

The application is structured into three primary operational views accessible via the top navigation pill:

1. **Schema View (`Columns`)**: Define, reorder, and configure field specifications, distributions, unique constraints, and null percentages.
2. **Preview View (`Table`)**: Inspect live generated sample rows, search with tokenized filters, right-click on cell values to filter, and examine data heatmaps.
3. **Split View (`Split`)**: Side-by-side (or vertically stacked on mobile) view showing field schema definitions alongside the live data preview for real-time iteration.

---

## ⚡ Quick Workflows

### 1. Starting from a Preset Blueprint
Click the **Presets** button in the header navigation to load pre-configured domain schemas:
- **E-Commerce Orders**: Transaction IDs, customers, line items, SKU codes, prices, and timestamps.
- **Healthcare Records**: Patient IDs, blood types, vital statistics, medical codes (ICD-10).
- **Financial Transactions**: IBANs, currency codes, debit/credit flags, timestamps.
- **SaaS User Accounts**: UUIDs, usernames, emails, subscription tiers, and activity dates.

### 2. Drag-and-Drop Excel / CSV Schema Extraction
To generate synthetic data matching an existing real-world spreadsheet:
1. Drag any `.xlsx`, `.xls`, or `.csv` file directly onto the **Field Architecture** panel or empty dropzone.
2. VAMPIO immediately parses the spreadsheet in memory using SheetJS.
3. Review detected fields, inferred data types, categorical enums, regex patterns, and null ratios.
4. Click **Apply Extracted Schema** (choose either *Replace Schema* or *Append to Current*).

### 3. Adding & Customizing Fields Manually
1. Click **+ Add Field** in the controls bar or choose a category from the quick strip (*ID*, *Names*, *Finance*, *Dates*, *Network*, *Geo*).
2. Configure:
   - **Field Name**: Unique identifier (alphanumeric and underscores).
   - **Type**: Choose from 12 primitive types (String, Int, Float, DateTime, Enum, etc.).
   - **Rule**: Type-specific parameters (e.g., `min: 1, max: 100`, regex patterns, or custom comma-separated lists).
   - **Null %**: Percentage of rows that will generate null/empty values (0%–100%).
   - **Reorder**: Drag the grab handle on the left of any column card to reorder fields.

### 4. Generating & Exporting Data
Open the **Generation Deck** in the bottom bar or right sidebar:
- **Batch Mode**: Enter row count (e.g. `1,000` to `1,000,000` rows) and click **Export Dataset**.
- **Continuous Mode**: Toggle streaming to continuously write records at controlled intervals (e.g. `100ms`).
- **Export Formats**:
  - **CSV**: Comma-separated values with quoted fields and headers.
  - **JSON**: Formatted JSON array of record objects.
  - **SQL**: Database DDL (`CREATE TABLE`) followed by batch `INSERT INTO` statements.
- **Destination**:
  - Direct download (`.csv`, `.json`, `.sql`).
  - **Save to Local Folder**: Uses Tauri's native File System APIs (on desktop) or the Web File System Access API (on browser) to stream chunks directly to disk with zero cloud uploads.
