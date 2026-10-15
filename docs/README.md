# VAMPIO Documentation

Vampio is an offline-first synthetic data generator and schema extractor built with React, Vite and Tauri v2. Files you analyse and data you generate stay on your device; the only network access is what you configure yourself (REST columns, scripted API calls, webhook actions).

![Vampio workspace](./screenshots/split-workspace.png)

| Guide | Description |
| :--- | :--- |
| [Getting Started](./getting-started.md) | Install, first workflows, batch and streaming output. |
| [Interface Tour](./user-interface.md) | Annotated screenshots of every major screen. |
| [Schema Architecture & Types](./schema-architecture.md) | The 12 column types, rules, distributions and attributes. |
| [Offline Schema Extractor](./offline-schema-extractor.md) | How types, enums and patterns are inferred from Excel/CSV files. |
| [Search & Filters](./search-and-filters.md) | Tokenized search syntax and cell right-click filters. |
| [Visual Analytics](./visual-analytics.md) | The five chart modes and buffer windowing. |
| [Custom Types & Scripting](./custom-types-and-scripting.md) | Lua/JS column types, the `ctx` API and REST enrichment. |
| [Workspaces & Actions](./workspaces-and-actions.md) | Tabs, save policy, output strategies and webhooks. |
| [Operator Mode](./operator-mode.md) | Folder monitoring and profile bundles. |
| [Generator Engine](./generator-engine.md) | Internals: PRNG, dependency ordering and streaming writers. |
| [Tauri Desktop Build](./tauri-compilation.md) | Building and releasing native installers. |
