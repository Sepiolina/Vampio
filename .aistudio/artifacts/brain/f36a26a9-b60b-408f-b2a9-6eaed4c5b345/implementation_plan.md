# Implementation Plan: Genuine Target Folder Behavior Monitor (No Simulated Mocks)

Transition the Target Folder Behavior Monitor from illusionary simulated examples to a 100% working, real-world folder ingestion and monitoring engine supporting both directory pickers and drag-and-drop folder uploads with live polling.

---

## 1. User Decisions & Confirmed Requirements

- **Real Ingestion Methods**: Both native/HTML5 folder picker and direct drag-and-drop folder/file upload.
- **Mock Elimination**: Completely remove all mock simulation buttons, synthetic scenarios (`iot`, `ecommerce`, `access_log`), and the `+ Simulate Incoming File` fake generator.
- **Live Updating**: Live automatic polling of real directory handles and file change detection.
- **Zero Illusionary Placeholders**: Every metric, schema inference, cadence calculation, and file lock detection is computed strictly from real files supplied by the user.

---

## 2. Architecture & Implementation Details

### A. Folder Ingestion Engine (`src/components/FolderMonitorModal.tsx`)
1. **Drag-and-Drop Zone**:
   - Implement `onDragOver`, `onDragLeave`, and `onDrop` handlers on the modal workspace.
   - Support recursive directory traversal using `DataTransferItem.webkitGetAsEntry()` / `FileSystemDirectoryEntry.createReader()` to read real folder hierarchies dropped into the browser.
   - Fallback to `e.dataTransfer.files` if directory entries are unsupported.
2. **Reliable Folder Picker**:
   - Provide a direct synchronous button click on `<input type="file" webkitdirectory directory />` to bypass iframe user-gesture expiration.
   - Also allow selecting individual multi-file batches (`<input type="file" multiple />`) for environments where directory picking is restricted.
3. **Removal of Mock/Simulated Code**:
   - Remove `handleLoadSampleScenario` and mock file definitions (`iot_fleet_ingest`, `orders_daily_pipeline`, `nginx_access_logs`).
   - Remove `handleSimulateNewFile` and `simulated-dir` state.
   - Remove mock banner (`Quick test with simulated offline folder behaviors`).
   - Remove `+ Simulate Incoming File` button from the live events tab.

### B. Live Real-Folder Polling & Event Stream
1. **Directory Handle Polling**:
   - For real `FileSystemDirectoryHandle` (native or desktop), run periodic polling (every 3 seconds) using `readFolderFromDirectoryHandle`.
   - Detect real new files, deleted files, and file size updates, firing genuine `file_added` and `file_modified` events.
2. **Real Folder Status & Empty State**:
   - Clean empty state with high-contrast drop zone, file/folder select buttons, and instructions explaining how to link a local folder.
   - Clear indicators showing folder path, total files discovered, dominant format, and real read permissions.

### C. Offline Analysis & Forensics on Real Files (`src/utils/folderBehaviorAnalyzer.ts`)
- Ensure all metric cards (file count, total bytes, dominant format, naming pattern detection, temporal cadence, encoding, delimiter, and schema column inference) render purely from real discovered files.
- If a folder is empty, report zero files and prompt the user to generate or drop files into it.

---

## 3. UI & Design Guidelines (`references/3_saas_dashboard.md`)
- **Typography & Tabular Figures**: Use `font-mono` and `tabular-nums` for timestamps, file sizes, and row counters to prevent jitter.
- **Zero-Pill Discipline**: Unboxed metadata text with `·` separators for file stats.
- **Responsive Layout**: High-density table list of discovered files with real file sizes, last modified times, and format indicators.
- **Status Colors**: Emerald for verified/locked files, amber for cadence warnings, crimson for file lock errors.

---

## 4. Verification & Validation Steps
1. **Directory Selection & Drop Test**:
   - Drag and drop a real local folder with CSV/JSON files into the monitor.
   - Verify all real files appear in the Discovered Files table with actual file sizes and snippets.
2. **Schema & Strategy Detection**:
   - Verify detected columns and suggested output strategies match the real files.
3. **Live Polling Test**:
   - Verify that adding a new file to the folder triggers real change detection.
4. **Mock Elimination Verification**:
   - Verify zero references to mock scenarios or "+ Simulate Incoming File" exist in the UI.
5. **Applet Compilation & Linting**:
   - Run `compile_applet` and `lint_applet` to confirm clean compilation and zero lint errors.
   - Run Vitest suite to ensure existing folder analyzer and directory selection tests pass.
