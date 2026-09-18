# VAMPIO Documentation
[![CI - Lint & Test](https://github.com/Sepiolina/Vampio/actions/workflows/CI.yml/badge.svg)](https://github.com/Sepiolina/Vampio/actions/workflows/CI.yml) [![CD - Build & Release Executables](https://github.com/Sepiolina/Vampio/actions/workflows/CD.yml/badge.svg)](https://github.com/Sepiolina/Vampio/actions/workflows/CD.yml)

Welcome to the **VAMPIO (Synthetic Data Generator & Offline Schema Architecture Extractor)** documentation.

VAMPIO is an enterprise-grade, privacy-first synthetic data generation engine and offline schema extraction suite. It runs 100% client-side in browser memory with zero external API calls or cloud uploads, ensuring strict data sovereignty, GDPR/HIPAA compliance, and millisecond latency.

---

## 📚 Documentation Index

| Guide | Description |
| :--- | :--- |
| [**Getting Started**](./getting-started.md) | Quickstart guide, UI walkthrough, batch generation, and streaming setup. |
| [**Schema Architecture & Types**](./schema-architecture.md) | Comprehensive reference for all 12 column types, regex rules, calculations, and distributions. |
| [**Offline Schema Extractor**](./offline-schema-extractor.md) | How the SheetJS-powered pattern recognition engine detects types, enums, and regex formats offline. |
| [**Search & Tokenized Filters**](./search-and-filters.md) | Syntax guide for the tokenized search bar, cell right-click filters, and boolean logic. |
| [**Visual Analytics & Distribution**](./visual-analytics.md) | Guide to the 5 visualization modes, streaming buffer windowing, and D3 analytics. |
| [**Tauri Desktop Compilation**](./tauri-compilation.md) | Guide to running in development mode and building native desktop installers (.exe, .dmg, .AppImage) with Tauri. |
| [**Generator Engine Architecture**](./generator-engine.md) | Performance internals, deterministic PRNG, File System Access API, and standalone packaging. |

---

## 🚀 Key System Highlights

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           VAMPIO WORKSPACE                              │
├──────────────────────────┬─────────────────────────┬────────────────────┤
│   Field Architecture     │   Real-Time Preview     │  Generation Deck   │
│   • 12 Primitive Types   │   • Reactive Data Grid  │  • Batch / Stream  │
│   • Cross-Column Calcs   │   • Tokenized Search    │  • CSV / JSON / SQL│
│   • Drag & Drop Excel    │   • Right-Click Filter  │  • Direct to Disk  │
└──────────────────────────┴─────────────────────────┴────────────────────┘
                                   │
              100% Client-Side Engine (Zero Cloud Uploads)
```

1. **Zero Cloud Dependency**: Excel/CSV files dropped for schema extraction and generated synthetic datasets never leave the user's browser.
2. **Instant Micro-Batch Previews**: Modifications to field rules, distributions, or formats reflect immediately in the live reactive data table.
3. **High-Throughput Generation**: Streams synthetic rows continuously into memory buffers, disk via File System Access API, or direct browser downloads.
4. **Adaptive Responsive Layout**: Clean multi-viewport design with single-screen Schema, Data Preview, or side-by-side Split View modes.
