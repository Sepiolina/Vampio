# VAMPIO - Synthetic Data Generator & Schema Extractor

Welcome to the **VAMPIO (Synthetic Data Generator & Offline Schema Architecture Extractor)** documentation.

VAMPIO is a synthetic data generation engine and schema extraction tool. Built with React, Vite, and Tauri v2, it runs locally on your device without relying on external APIs or cloud services.

## 🚀 Key System Highlights

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           VAMPIO WORKSPACE                              │
├──────────────────────────┬─────────────────────────┬────────────────────┤
│   Field Architecture     │   Real-Time Preview     │  Generation Deck   │
│   • 12 Primitive Types   │   • Reactive Data Grid  │  • Batch / Stream  │
│   • Cross-Column Calcs   │   • Visual Analytics    │  • CSV / JSON / SQL│
│   • Drag & Drop Excel    │   • Right-Click Filter  │  • Direct to Disk  │
└──────────────────────────┴─────────────────────────┴────────────────────┘
                                   │
              100% Offline Engine (Native Desktop & Browser)
```

1. **Local Processing**: Excel/CSV files dropped for schema extraction and generated synthetic datasets are processed entirely on your device.
2. **Instant Previews**: Modifications to field rules, distributions, or formats reflect immediately in the live reactive data table and D3 visualizations.
3. **Data Streaming**: Writes synthetic rows directly to disk using Tauri's native File System plugin (on desktop) or the Web File System Access API (in browser).
4. **Cross-Platform**: Can be run as a web app or compiled into a native desktop application for Windows, macOS, and Linux using Tauri.

---

## 📚 Documentation Index

| Guide | Description |
| :--- | :--- |
| [**Getting Started**](./docs/getting-started.md) | Quickstart guide, UI walkthrough, batch generation, and streaming setup. |
| [**Schema Architecture & Types**](./docs/schema-architecture.md) | Comprehensive reference for all 12 column types, regex rules, calculations, and distributions. |
| [**Offline Schema Extractor**](./docs/offline-schema-extractor.md) | How the SheetJS-powered pattern recognition engine detects types, enums, and regex formats offline. |
| [**Search & Tokenized Filters**](./docs/search-and-filters.md) | Syntax guide for the tokenized search bar, cell right-click filters, and boolean logic. |
| [**Visual Analytics & Distribution**](./docs/visual-analytics.md) | Guide to the 5 visualization modes, streaming buffer windowing, and D3 analytics. |
| [**Tauri Desktop Compilation**](./docs/tauri-compilation.md) | Guide to running in development mode and building native desktop installers (.exe, .dmg, .AppImage) with Tauri. |
| [**Generator Engine Architecture**](./docs/generator-engine.md) | Performance internals, deterministic PRNG, native vs web File System logic, and standalone packaging. |
