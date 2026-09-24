import React, { useState, useRef, useMemo, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ColumnSpec, ColumnType, ExportFormat, ImportedFileContext } from '../types';
import { AnimatedTabs } from './AnimatedTabs';
import {
  parseExcelOrCsvFile,
  parsePastedDelimitedText,
  parseRowRangeInput,
  parseColumnFocusInput,
  extractFieldArchitecture,
  ExtractedColumnResult,
  ExtractionMode,
  PatternPreference,
  ParsedWorkbook,
} from '../utils/schemaExtractor';
import {
  X,
  FileSpreadsheet,
  Upload,
  ShieldCheck,
  Filter,
  Check,
  Eye,
  ArrowRight,
  Database,
  Lock,
  Unlock,
  AlertCircle,
  FileText,
  HelpCircle,
  Plus,
  RefreshCw,
  Sliders,
  ArrowLeftRight,
  Code2,
  ListOrdered,
  Sparkles,
} from 'lucide-react';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onApplySchema: (
    cols: ColumnSpec[],
    tableName: string,
    append: boolean,
    importContext?: ImportedFileContext
  ) => void;
  currentColumnsCount: number;
  initialFile?: File | null;
  onClearInitialFile?: () => void;
  autoExtract?: boolean;
}

const AVAILABLE_TYPES: ColumnType[] = [
  'String',
  'Int',
  'Float',
  'Boolean',
  'UUID',
  'DateTime',
  'RegEx',
  'Set/Enum',
  'Sequence',
  'Entity',
  'Blob/Hex',
  'Calculation',
];

export const OfflineExtractorModal: React.FC<Props> = ({
  isOpen,
  onClose,
  onApplySchema,
  currentColumnsCount,
  initialFile,
  onClearInitialFile,
  autoExtract,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Parsing & File State
  const [workbook, setWorkbook] = useState<ParsedWorkbook | null>(null);
  const [activeSheetName, setActiveSheetName] = useState<string>('');
  const [isLoadingFile, setIsLoadingFile] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Pasted text alternative
  const [isPastingText, setIsPastingText] = useState<boolean>(false);
  const [pastedText, setPastedText] = useState<string>('');

  // Row & Column Focus
  const [rowFocusInput, setRowFocusInput] = useState<string>('1-500');
  const [columnFocusInput, setColumnFocusInput] = useState<string>('*');
  const [selectedColumnNames, setSelectedColumnNames] = useState<string[]>([]);
  const [columnSearchQuery, setColumnSearchQuery] = useState<string>('');
  const [showDataPreview, setShowDataPreview] = useState<boolean>(false);

  // Extraction Options
  const [extractionMode, setExtractionMode] = useState<ExtractionMode>('realistic');
  const [patternPreference, setPatternPreference] = useState<PatternPreference>('smart');
  const [maxEnumUnique, setMaxEnumUnique] = useState<number>(12);
  const [ignoreAlphanumericInEnum, setIgnoreAlphanumericInEnum] = useState<boolean>(true);

  // Extracted Architecture Results (Editable before applying)
  const [extractedColumns, setExtractedColumns] = useState<ExtractedColumnResult[]>([]);
  const [targetTableName, setTargetTableName] = useState<string>('imported_dataset');
  const [applyMode, setApplyMode] = useState<'replace' | 'append'>('replace');

  // Active Wizard Step: 1 = File & Focus, 2 = Review Extracted Schema
  const [step, setStep] = useState<1 | 2>(1);

  const currentSheet = workbook && activeSheetName ? workbook.sheets[activeSheetName] : null;

  // Handle File Upload
  const handleFileUpload = async (file: File, shouldAutoExtract = false) => {
    setIsLoadingFile(true);
    setErrorMessage(null);
    try {
      const parsed = await parseExcelOrCsvFile(file);
      if (parsed.sheetNames.length === 0) {
        throw new Error('No readable sheets found in this file.');
      }
      setWorkbook(parsed);
      const firstSheet = parsed.sheetNames[0];
      setActiveSheetName(firstSheet);
      const headers = parsed.sheets[firstSheet]?.headers || [];
      setSelectedColumnNames(headers);
      setColumnFocusInput('*');
      const rowFocus = parsed.sheets[firstSheet]?.totalRows && parsed.sheets[firstSheet].totalRows > 500
        ? '1-500'
        : 'all';
      setRowFocusInput(rowFocus);
      const inferredTableName =
        file.name.replace(/\.[^/.]+$/, '').replace(/[^a-zA-Z0-9_]/g, '_').toLowerCase() || 'imported_dataset';
      setTargetTableName(inferredTableName);

      if (shouldAutoExtract && parsed.sheets[firstSheet] && headers.length > 0) {
        const sheet = parsed.sheets[firstSheet];
        const range = parseRowRangeInput(rowFocus, sheet.totalRows);
        const sampleRows = sheet.rows.slice(range.startIndex, range.endIndex);
        if (sampleRows.length > 0) {
          const extracted = extractFieldArchitecture(headers, sampleRows, {
            mode: extractionMode,
            patternPreference,
            maxEnumUnique,
            ignoreAlphanumericInEnum,
            selectedColumnNames: headers,
          });
          setExtractedColumns(extracted);
          setStep(2);
          setIsLoadingFile(false);
          return;
        }
      }

      setExtractedColumns([]);
      setStep(1);
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to parse file.');
    } finally {
      setIsLoadingFile(false);
    }
  };

  useEffect(() => {
    if (isOpen && initialFile) {
      handleFileUpload(initialFile, autoExtract ?? false);
      onClearInitialFile?.();
    }
  }, [isOpen, initialFile]);

  // Handle Pasted CSV / TSV Text
  const handlePastedTextParse = () => {
    if (!pastedText.trim()) return;
    try {
      const parsed = parsePastedDelimitedText(pastedText, 'pasted_dataset.csv');
      setWorkbook(parsed);
      const firstSheet = parsed.sheetNames[0];
      setActiveSheetName(firstSheet);
      setSelectedColumnNames(parsed.sheets[firstSheet]?.headers || []);
      setColumnFocusInput('*');
      setRowFocusInput('all');
      setTargetTableName('pasted_dataset');
      setExtractedColumns([]);
      setIsPastingText(false);
      setStep(1);
    } catch (err: any) {
      setErrorMessage('Failed to parse pasted text: ' + err.message);
    }
  };

  // Switch Sheet
  const handleSheetChange = (sheetName: string) => {
    setActiveSheetName(sheetName);
    if (workbook && workbook.sheets[sheetName]) {
      const sheet = workbook.sheets[sheetName];
      setSelectedColumnNames(sheet.headers);
      setColumnFocusInput('*');
      setRowFocusInput(sheet.totalRows > 500 ? '1-500' : 'all');
      setTargetTableName(sheetName.replace(/[^a-zA-Z0-9_]/g, '_').toLowerCase() || 'imported_dataset');
    }
  };

  // Update selected columns when columnFocusInput changes
  const handleColumnFocusInputChange = (val: string) => {
    setColumnFocusInput(val);
    if (!currentSheet) return;
    const parsedCols = parseColumnFocusInput(val, currentSheet.headers);
    setSelectedColumnNames(parsedCols);
  };

  // Toggle individual column selection
  const toggleColumnSelection = (header: string) => {
    const isSelected = selectedColumnNames.includes(header);
    let updated: string[];
    if (isSelected) {
      updated = selectedColumnNames.filter((h) => h !== header);
    } else {
      updated = [...selectedColumnNames, header];
    }
    setSelectedColumnNames(updated);
    if (currentSheet) {
      if (updated.length === currentSheet.headers.length) {
        setColumnFocusInput('*');
      } else {
        setColumnFocusInput(updated.join(', '));
      }
    }
  };

  const handleSelectAllColumns = () => {
    if (!currentSheet) return;
    setSelectedColumnNames([...currentSheet.headers]);
    setColumnFocusInput('*');
  };

  const handleDeselectAllColumns = () => {
    setSelectedColumnNames([]);
    setColumnFocusInput('');
  };

  // Calculate focused row slice
  const parsedRowRange = useMemo(() => {
    if (!currentSheet) return { startIndex: 0, endIndex: 0, count: 0 };
    return parseRowRangeInput(rowFocusInput, currentSheet.totalRows);
  }, [rowFocusInput, currentSheet]);

  // Focused rows sample data
  const focusedSampleRows = useMemo(() => {
    if (!currentSheet) return [];
    return currentSheet.rows.slice(parsedRowRange.startIndex, parsedRowRange.endIndex);
  }, [currentSheet, parsedRowRange]);

  // Execute Offline Pattern Extraction
  const handleRunExtraction = () => {
    if (!currentSheet) return;
    if (selectedColumnNames.length === 0) {
      setErrorMessage('Please select or type at least one column to focus on.');
      return;
    }
    if (focusedSampleRows.length === 0) {
      setErrorMessage('No rows selected in the specified row range.');
      return;
    }

    setErrorMessage(null);

    const extracted = extractFieldArchitecture(
      currentSheet.headers,
      focusedSampleRows,
      {
        mode: extractionMode,
        patternPreference,
        maxEnumUnique,
        ignoreAlphanumericInEnum,
        selectedColumnNames,
      }
    );

    setExtractedColumns(extracted);
    setStep(2);
  };

  // Switch column type with smart rule inference
  const handleTypeChange = (colId: string, newType: ColumnType) => {
    setExtractedColumns((prev) =>
      prev.map((col) => {
        if (col.id !== colId) return col;
        let newRule = col.rule;
        if (newType === 'RegEx' && col.type !== 'RegEx') {
          newRule = col.inferredRegexRule || col.rule || '[A-Z0-9]{6}';
        } else if (newType === 'Set/Enum' && col.type !== 'Set/Enum') {
          newRule = col.inferredEnumRule || col.rule;
        } else if (newType === 'String' && col.type !== 'String') {
          newRule = '16';
        } else if (newType === 'UUID') {
          newRule = '';
        } else if (newType === 'Boolean') {
          newRule = '';
        }
        return {
          ...col,
          type: newType,
          rule: newRule,
        };
      })
    );
  };

  // Toggle individual column between Set/Enum and RegEx
  const handleToggleBetweenEnumAndRegex = (colId: string) => {
    setExtractedColumns((prev) =>
      prev.map((col) => {
        if (col.id !== colId) return col;
        if (col.type === 'Set/Enum') {
          return {
            ...col,
            type: 'RegEx',
            rule: col.inferredRegexRule || '[A-Z0-9]{6}',
            notes: 'Switched to RegEx pattern',
          };
        } else {
          return {
            ...col,
            type: 'Set/Enum',
            rule: col.inferredEnumRule || col.rule,
            notes: 'Switched to Categorical Set',
          };
        }
      })
    );
  };

  // Batch convert all alphanumeric Enums to RegEx
  const handleBatchConvertEnumToRegex = () => {
    setExtractedColumns((prev) =>
      prev.map((col) => {
        if (col.type === 'Set/Enum' && (col.isAlphanumericCode || col.inferredRegexRule)) {
          return {
            ...col,
            type: 'RegEx',
            rule: col.inferredRegexRule || '[A-Z0-9]{6}',
            notes: 'Batch converted to RegEx',
          };
        }
        return col;
      })
    );
  };

  // Batch convert all RegEx to Set/Enum
  const handleBatchConvertRegexToEnum = () => {
    setExtractedColumns((prev) =>
      prev.map((col) => {
        if (col.type === 'RegEx' && col.inferredEnumRule) {
          return {
            ...col,
            type: 'Set/Enum',
            rule: col.inferredEnumRule,
            notes: 'Batch converted to Set/Enum',
          };
        }
        return col;
      })
    );
  };

  // Update individual extracted column
  const handleUpdateExtractedCol = (id: string, updates: Partial<ExtractedColumnResult>) => {
    setExtractedColumns((prev) =>
      prev.map((col) => (col.id === id ? { ...col, ...updates } : col))
    );
  };

  // Toggle sensitive flag on column
  const handleToggleSensitive = (id: string) => {
    setExtractedColumns((prev) =>
      prev.map((col) => {
        if (col.id !== id) return col;
        const newSensitive = !col.isSensitive;
        return {
          ...col,
          isSensitive: newSensitive,
          // If turning sensitive on, switch to safe mock entity or UUID if text
          rule: newSensitive && col.type === 'String' ? '12' : col.rule,
        };
      })
    );
  };

  // Remove column from extracted list
  const handleRemoveExtractedCol = (id: string) => {
    setExtractedColumns((prev) => prev.filter((col) => col.id !== id));
  };

  // Apply to Workspace
  const handleApplyToWorkspace = () => {
    if (extractedColumns.length === 0) return;

    const specs: ColumnSpec[] = extractedColumns.map((c) => ({
      id: c.id,
      name: c.name,
      type: c.type,
      rule: c.rule,
      skip_pct: c.skip_pct,
      condition: '',
      notes: c.notes,
    }));

    const totalRows = currentSheet?.totalRows || 0;
    const importContext: ImportedFileContext | undefined = workbook
      ? {
          filename: workbook.filename,
          format: (workbook.fileFormat as ExportFormat) || 'csv',
          totalRows,
          startingRowNumber: totalRows + 1,
          headers: currentSheet?.headers || [],
          rawWorkbook: workbook.rawWorkbook,
          rawFile: workbook.rawFile,
          rawRows: currentSheet?.rows || [],
          rawContent: workbook.rawContent,
          targetSheetName: activeSheetName,
          sheetNames: workbook.sheetNames,
        }
      : undefined;

    onApplySchema(specs, targetTableName, applyMode === 'append', importContext);
    onClose();
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 overflow-y-auto">
          {/* Animated Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/60 backdrop-blur-xs -z-10"
          />

          {/* Animated Modal Dialog */}
          <motion.div
            initial={{ opacity: 0, scale: 0.94, y: 16 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.94, y: 16 }}
            transition={{ type: "spring", duration: 0.3, bounce: 0.12 }}
            className="relative w-full max-w-4xl bg-secondary border border-border-subtle rounded-2xl shadow-2xl flex flex-col h-[90vh] max-h-[90vh] overflow-hidden"
          >
            {/* Header with Privacy & Offline Banner */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-border-subtle bg-secondary/80 flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-accent/15 text-accent border border-accent/30 shadow-xs">
              <FileSpreadsheet size={20} />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-base font-bold text-content tracking-tight">
                  Offline Schema &amp; Pattern Extractor
                </h2>
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                  <ShieldCheck size={11} />
                  100% Offline • Zero AI / APIs
                </span>
              </div>
              <p className="text-xs text-content-muted mt-0.5">
                Inspect Excel / CSV files locally in your browser to extract schema architecture, null ratios, and data distributions.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-content-muted hover:text-content hover:bg-tertiary transition"
            title="Close modal"
          >
            <X size={18} />
          </button>
        </div>

        {/* Step Indicator Tabs */}
        <div className="px-5 py-2 border-b border-border-subtle/60 bg-primary/40 flex items-center">
          <AnimatedTabs
            tabs={[
              { id: '1', label: '1. Import & Focus Filter' },
              {
                id: '2',
                label: '2. Review Extracted Architecture',
                badge: extractedColumns.length > 0 ? extractedColumns.length : undefined,
                disabled: extractedColumns.length === 0,
              },
            ]}
            activeTab={String(step)}
            onChange={(tabId) => setStep(Number(tabId) as 1 | 2)}
            layoutId="offline-extractor-steps"
            variant="underline"
            size="sm"
          />
        </div>

        {/* Error Notification if any */}
        {errorMessage && (
          <div className="mx-5 mt-3 p-3 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-300 text-xs flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <AlertCircle size={15} className="flex-shrink-0 text-rose-400" />
              <span>{errorMessage}</span>
            </div>
            <button
              type="button"
              onClick={() => setErrorMessage(null)}
              className="text-rose-400 hover:text-rose-200"
            >
              <X size={14} />
            </button>
          </div>
        )}

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          {/* STEP 1: IMPORT FILE & DEFINE ROW/COLUMN FOCUS */}
          {step === 1 && (
            <div className="space-y-5">
              {/* File Upload / Paste Selection Area */}
              {!workbook ? (
                <div className="space-y-3">
                  {!isPastingText ? (
                    <div
                      onDragOver={(e) => e.preventDefault()}
                      onDrop={(e) => {
                        e.preventDefault();
                        const file = e.dataTransfer.files?.[0];
                        if (file) handleFileUpload(file);
                      }}
                      className="border-2 border-dashed border-border-subtle hover:border-accent/60 bg-primary/30 hover:bg-primary/60 rounded-2xl p-8 flex flex-col items-center justify-center text-center transition-all cursor-pointer group"
                      onClick={() => fileInputRef.current?.click()}
                    >
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept=".xlsx,.xls,.csv,.tsv,.json,.jsonl,.ndjson,.xml,.txt"
                        className="hidden"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) handleFileUpload(file);
                        }}
                      />
                      <div className="p-3.5 rounded-2xl bg-accent/10 text-accent group-hover:bg-accent group-hover:text-white transition-all shadow-inner mb-3">
                        <Upload size={28} />
                      </div>
                      <h3 className="text-sm font-bold text-content">
                        {isLoadingFile ? 'Parsing File Locally...' : 'Drop Excel (.xlsx, .xls), CSV, TSV, JSON, XML, or TXT file here'}
                      </h3>
                      <p className="text-xs text-content-muted mt-1 max-w-md">
                        Supports large spreadsheets, JSON lines &amp; logs. All parsing and schema extraction runs 100% in browser memory with zero network calls.
                      </p>

                      <div className="mt-4 flex items-center gap-2">
                        <span className="px-3 py-1 rounded-lg bg-secondary border border-border-subtle text-xs font-semibold text-content group-hover:border-accent/40 shadow-xs">
                          Browse Files
                        </span>
                        <span className="text-xs text-content-muted">or</span>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setIsPastingText(true);
                          }}
                          className="px-3 py-1 rounded-lg bg-secondary hover:bg-tertiary border border-border-subtle text-xs font-semibold text-accent transition"
                        >
                          Paste CSV / TSV Text
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-content flex items-center gap-1.5">
                          <FileText size={14} className="text-accent" />
                          Paste Delimited Data (CSV / TSV)
                        </span>
                        <button
                          type="button"
                          onClick={() => setIsPastingText(false)}
                          className="text-xs text-accent hover:underline"
                        >
                          Switch back to file upload
                        </button>
                      </div>
                      <textarea
                        rows={6}
                        value={pastedText}
                        onChange={(e) => setPastedText(e.target.value)}
                        placeholder={`id,first_name,last_name,email,price,status\n1,Jane,Doe,jane@example.com,49.99,Active\n2,John,Smith,john@company.com,89.50,Pending`}
                        className="w-full p-3 rounded-xl bg-primary border border-border-subtle text-xs font-mono text-content focus:outline-none focus:border-accent transition resize-y"
                      />
                      <div className="flex justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => setIsPastingText(false)}
                          className="px-3 py-1.5 rounded-lg bg-secondary hover:bg-tertiary text-xs font-medium text-content-muted"
                        >
                          Cancel
                        </button>
                        <button
                          type="button"
                          onClick={handlePastedTextParse}
                          disabled={!pastedText.trim()}
                          className="px-4 py-1.5 rounded-lg bg-accent hover:bg-accent-hover disabled:opacity-50 text-white text-xs font-semibold shadow-xs"
                        >
                          Parse Pasted Text
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                /* File Loaded Banner */
                <div className="p-3.5 rounded-xl bg-primary border border-border-subtle flex flex-wrap items-center justify-between gap-3 shadow-inner">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-accent/20 text-accent font-bold">
                      <FileSpreadsheet size={18} />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-content truncate max-w-xs">
                          {workbook.filename}
                        </span>
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-secondary border border-border-subtle text-content-muted font-mono">
                          {currentSheet?.totalRows.toLocaleString() || 0} rows • {currentSheet?.totalCols || 0} cols
                        </span>
                      </div>

                      {/* Sheet selector if multiple */}
                      {workbook.sheetNames.length > 1 && (
                        <div className="flex items-center gap-1.5 mt-1 text-xs">
                          <span className="text-[11px] text-content-muted font-medium">Sheet:</span>
                          <select
                            value={activeSheetName}
                            onChange={(e) => handleSheetChange(e.target.value)}
                            className="bg-secondary px-2 py-0.5 rounded border border-border-subtle text-xs text-content font-semibold focus:outline-none cursor-pointer"
                          >
                            {workbook.sheetNames.map((s) => (
                              <option key={s} value={s}>
                                {s} ({workbook.sheets[s]?.totalRows || 0} rows)
                              </option>
                            ))}
                          </select>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setWorkbook(null);
                        setExtractedColumns([]);
                      }}
                      className="px-2.5 py-1 rounded-lg bg-secondary hover:bg-tertiary border border-border-subtle text-xs font-medium text-content transition"
                    >
                      Change File
                    </button>
                  </div>
                </div>
              )}

              {/* Focus Controls: Rows & Columns (When Workbook is Loaded) */}
              {currentSheet && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Row Focus Box */}
                  <div className="p-4 rounded-xl bg-primary/60 border border-border-subtle space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-content flex items-center gap-1.5">
                        <Filter size={13} className="text-accent" />
                        Rows to Focus On
                      </span>
                      <span className="text-[11px] font-mono text-content-muted">
                        Total Available: {currentSheet.totalRows.toLocaleString()}
                      </span>
                    </div>

                    <div className="space-y-1.5">
                      <input
                        type="text"
                        value={rowFocusInput}
                        onChange={(e) => setRowFocusInput(e.target.value)}
                        placeholder="e.g. 1-500, 1 to 200, first 100, or all"
                        className="w-full px-3 py-1.5 rounded-lg bg-secondary border border-border-subtle text-xs font-mono text-content focus:outline-none focus:border-accent"
                      />
                      <p className="text-[11px] text-content-muted">
                        Type range like <code>1-500</code>, <code>50-200</code>, <code>first 100</code>, or <code>all</code>.
                      </p>
                    </div>

                    {/* Quick Row Presets */}
                    <div className="space-y-1">
                      <span className="text-[10px] uppercase font-bold text-content-muted">Quick Scope</span>
                      <AnimatedTabs
                        tabs={[
                          { id: 'first 100', label: 'Top 100' },
                          { id: 'first 500', label: 'Top 500' },
                          { id: 'first 1000', label: 'Top 1k' },
                          { id: 'all', label: `All (${currentSheet.totalRows.toLocaleString()})` },
                        ]}
                        activeTab={rowFocusInput === '1-500' ? 'first 500' : rowFocusInput}
                        onChange={(val) => setRowFocusInput(val)}
                        layoutId="extractor-row-focus-tabs"
                        variant="chip"
                        size="xs"
                      />
                    </div>

                    {/* Active Row Scope Indicator */}
                    <div className="text-[11px] px-2.5 py-1 rounded bg-secondary/80 text-content-muted flex items-center justify-between border border-border-subtle/50">
                      <span>Sampling Scope:</span>
                      <strong className="text-content font-mono">
                        Rows {parsedRowRange.startIndex + 1} – {parsedRowRange.endIndex} ({parsedRowRange.count.toLocaleString()} rows)
                      </strong>
                    </div>
                  </div>

                  {/* Column Focus Box */}
                  <div className="p-4 rounded-xl bg-primary/60 border border-border-subtle space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-content flex items-center gap-1.5">
                        <Filter size={13} className="text-accent" />
                        Columns to Focus On
                      </span>
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={handleSelectAllColumns}
                          className="text-[10px] font-bold text-accent hover:underline"
                        >
                          All
                        </button>
                        <span className="text-content-muted">•</span>
                        <button
                          type="button"
                          onClick={handleDeselectAllColumns}
                          className="text-[10px] font-bold text-content-muted hover:text-content"
                        >
                          None
                        </button>
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <input
                        type="text"
                        value={columnFocusInput}
                        onChange={(e) => handleColumnFocusInputChange(e.target.value)}
                        placeholder="e.g. id, name, email, price or A, B, C or *"
                        className="w-full px-3 py-1.5 rounded-lg bg-secondary border border-border-subtle text-xs font-mono text-content focus:outline-none focus:border-accent"
                      />
                      <p className="text-[11px] text-content-muted">
                        Type names, column letters (<code>A, C, D</code>), or <code>*</code> for all.
                      </p>
                    </div>

                    {/* Column Chips Selector */}
                    <div className="max-h-24 overflow-y-auto p-1.5 rounded-lg bg-secondary border border-border-subtle flex flex-wrap gap-1">
                      {currentSheet.headers.map((h, idx) => {
                        const isSelected = selectedColumnNames.includes(h);
                        return (
                          <button
                            key={h + idx}
                            type="button"
                            onClick={() => toggleColumnSelection(h)}
                            className={`px-2 py-0.5 rounded text-[10px] font-mono transition flex items-center gap-1 border ${
                              isSelected
                                ? 'bg-accent/20 border-accent/40 text-accent font-bold shadow-2xs'
                                : 'bg-primary border-border-subtle text-content-muted opacity-60 hover:opacity-100'
                            }`}
                          >
                            <span className="text-[9px] opacity-60">{idx + 1}.</span>
                            <span>{h}</span>
                            {isSelected && <Check size={10} />}
                          </button>
                        );
                      })}
                    </div>

                    <div className="text-[11px] px-2.5 py-1 rounded bg-secondary/80 text-content-muted flex items-center justify-between border border-border-subtle/50">
                      <span>Focused Columns:</span>
                      <strong className="text-content font-mono">
                        {selectedColumnNames.length} of {currentSheet.headers.length} selected
                      </strong>
                    </div>
                  </div>
                </div>
              )}

              {/* Data Sample Preview Drawer */}
              {currentSheet && (
                <div className="border border-border-subtle rounded-xl overflow-hidden bg-primary/40">
                  <div
                    onClick={() => setShowDataPreview(!showDataPreview)}
                    className="flex items-center justify-between px-4 py-2.5 cursor-pointer bg-primary/80 hover:bg-tertiary transition text-xs select-none"
                  >
                    <span className="font-semibold text-content flex items-center gap-2">
                      <Eye size={13} className="text-accent" />
                      Preview Raw Sample Data (Rows {parsedRowRange.startIndex + 1} – {Math.min(parsedRowRange.startIndex + 5, parsedRowRange.endIndex)})
                    </span>
                    <span className="text-[11px] text-accent font-medium">
                      {showDataPreview ? 'Hide Preview' : 'Show Preview'}
                    </span>
                  </div>

                  {showDataPreview && (
                    <div className="overflow-x-auto p-2 max-h-48 border-t border-border-subtle">
                      <table className="w-full text-left border-collapse text-[11px] font-mono">
                        <thead>
                          <tr className="border-b border-border-subtle text-content-muted">
                            <th className="p-1.5">#</th>
                            {selectedColumnNames.map((colName) => (
                              <th key={colName} className="p-1.5 font-bold text-accent whitespace-nowrap">
                                {colName}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {focusedSampleRows.slice(0, 5).map((row, rIdx) => (
                            <tr key={rIdx} className="border-b border-border-subtle/40 hover:bg-secondary/50">
                              <td className="p-1.5 text-content-muted">
                                {parsedRowRange.startIndex + rIdx + 1}
                              </td>
                              {selectedColumnNames.map((colName) => {
                                const cIdx = currentSheet.headers.indexOf(colName);
                                const val = cIdx !== -1 ? row[cIdx] : null;
                                return (
                                  <td
                                    key={colName}
                                    className={`p-1.5 whitespace-nowrap max-w-[160px] truncate ${
                                      val === null ? 'text-rose-400/80 italic' : 'text-content'
                                    }`}
                                  >
                                    {val === null ? 'NULL' : String(val)}
                                  </td>
                                );
                              })}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}

              {/* Extraction Profile Option: Realistic vs Mock */}
              {currentSheet && (
                <div className="p-4 rounded-xl bg-primary border border-border-subtle space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-content uppercase tracking-wider text-accent flex items-center gap-1.5">
                      <Database size={13} />
                      Pattern Extraction Profile
                    </span>
                    <span className="text-[10px] text-content-muted">
                      Select how sensitive fields and patterns should be represented
                    </span>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {/* Realistic Option */}
                    <div
                      onClick={() => setExtractionMode('realistic')}
                      className={`p-3.5 rounded-xl border cursor-pointer transition-all select-none ${
                        extractionMode === 'realistic'
                          ? 'border-accent ring-2 ring-accent/30 shadow-xs bg-secondary'
                          : 'bg-secondary/40 border-border-subtle hover:border-accent/40'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-content flex items-center gap-1.5">
                          <Unlock size={14} className="text-sky-400" />
                          Realistic Profile
                        </span>
                        <div className={`w-4 h-4 rounded-full border flex items-center justify-center transition-colors ${
                          extractionMode === 'realistic' ? 'border-accent bg-accent text-white font-bold' : 'border-border-subtle bg-primary/40'
                        }`}>
                          {extractionMode === 'realistic' && <Check size={10} />}
                        </div>
                      </div>
                      <p className="text-[11px] text-content-muted mt-1.5 leading-relaxed">
                        Retains real observed categorical distributions (e.g. <code>Active:60, Pending:30</code>), exact numeric min/max boundaries, and real date formats. Ideal when data is non-sensitive or for development mirroring.
                      </p>
                    </div>

                    {/* Mock / Anonymized Option */}
                    <div
                      onClick={() => setExtractionMode('mock')}
                      className={`p-3.5 rounded-xl border cursor-pointer transition-all select-none ${
                        extractionMode === 'mock'
                          ? 'border-accent ring-2 ring-accent/30 shadow-xs bg-secondary'
                          : 'bg-secondary/40 border-border-subtle hover:border-accent/40'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-content flex items-center gap-1.5">
                          <Lock size={14} className="text-emerald-400" />
                          Mock Profile (PII &amp; Sensitive Data Safe)
                        </span>
                        <div className={`w-4 h-4 rounded-full border flex items-center justify-center transition-colors ${
                          extractionMode === 'mock' ? 'border-accent bg-accent text-white font-bold' : 'border-border-subtle bg-primary/40'
                        }`}>
                          {extractionMode === 'mock' && <Check size={10} />}
                        </div>
                      </div>
                      <p className="text-[11px] text-content-muted mt-1.5 leading-relaxed">
                        Sanitizes personal identifiers. Converts real customer names, emails, and phone numbers into synthetic random generators. Masks secrets into UUIDs and rounds financial numbers.
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Pattern Detection Criteria: Set/Enum vs RegEx */}
              {currentSheet && (
                <div className="p-4 rounded-xl bg-primary border border-border-subtle space-y-3.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-content uppercase tracking-wider text-accent flex items-center gap-1.5">
                      <Sliders size={13} />
                      Pattern Detection Criteria (Set/Enum vs RegEx)
                    </span>
                    <span className="text-[10px] text-content-muted">
                      Tune how low-cardinality values and alphanumeric patterns are discerned
                    </span>
                  </div>

                  {/* 3 Strategy Choices */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5">
                    {/* Smart Strategy */}
                    <div
                      onClick={() => setPatternPreference('smart')}
                      className={`p-3 rounded-xl border cursor-pointer transition-all select-none ${
                        patternPreference === 'smart'
                          ? 'border-accent ring-2 ring-accent/30 shadow-xs bg-secondary'
                          : 'bg-secondary/40 border-border-subtle hover:border-accent/40'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-content flex items-center gap-1.5">
                          <Sparkles size={13} className="text-amber-400" />
                          Smart Criteria
                        </span>
                        <div className={`w-4 h-4 rounded-full border flex items-center justify-center transition-colors ${
                          patternPreference === 'smart' ? 'border-accent bg-accent text-white font-bold' : 'border-border-subtle bg-primary/40'
                        }`}>
                          {patternPreference === 'smart' && <Check size={10} />}
                        </div>
                      </div>
                      <p className="text-[10px] text-content-muted mt-1 leading-relaxed">
                        Distinguishes alphanumeric tokens/codes/SKUs into <strong>RegEx</strong>, and natural word categories into <strong>Set/Enum</strong>.
                      </p>
                    </div>

                    {/* Prefer RegEx */}
                    <div
                      onClick={() => setPatternPreference('prefer_regex')}
                      className={`p-3 rounded-xl border cursor-pointer transition-all select-none ${
                        patternPreference === 'prefer_regex'
                          ? 'border-accent ring-2 ring-accent/30 shadow-xs bg-secondary'
                          : 'bg-secondary/40 border-border-subtle hover:border-accent/40'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-content flex items-center gap-1.5">
                          <Code2 size={13} className="text-emerald-400" />
                          Prefer RegEx
                        </span>
                        <div className={`w-4 h-4 rounded-full border flex items-center justify-center transition-colors ${
                          patternPreference === 'prefer_regex' ? 'border-accent bg-accent text-white font-bold' : 'border-border-subtle bg-primary/40'
                        }`}>
                          {patternPreference === 'prefer_regex' && <Check size={10} />}
                        </div>
                      </div>
                      <p className="text-[10px] text-content-muted mt-1 leading-relaxed">
                        Synthesizes structural dynamic regex masks whenever codes, prefixes, or alphanumeric formats exist.
                      </p>
                    </div>

                    {/* Prefer Set/Enum */}
                    <div
                      onClick={() => setPatternPreference('prefer_enum')}
                      className={`p-3 rounded-xl border cursor-pointer transition-all select-none ${
                        patternPreference === 'prefer_enum'
                          ? 'border-accent ring-2 ring-accent/30 shadow-xs bg-secondary'
                          : 'bg-secondary/40 border-border-subtle hover:border-accent/40'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-content flex items-center gap-1.5">
                          <ListOrdered size={13} className="text-sky-400" />
                          Prefer Set/Enum
                        </span>
                        <div className={`w-4 h-4 rounded-full border flex items-center justify-center transition-colors ${
                          patternPreference === 'prefer_enum' ? 'border-accent bg-accent text-white font-bold' : 'border-border-subtle bg-primary/40'
                        }`}>
                          {patternPreference === 'prefer_enum' && <Check size={10} />}
                        </div>
                      </div>
                      <p className="text-[10px] text-content-muted mt-1 leading-relaxed">
                        Treats low-cardinality test cases as discrete categorical sets with weighted frequency distributions.
                      </p>
                    </div>
                  </div>

                  {/* Advanced Fine-tuning Rules */}
                  <div className="pt-2 border-t border-border-subtle/60 flex flex-wrap items-center justify-between gap-3 text-xs">
                    <label className="flex items-center gap-2 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={ignoreAlphanumericInEnum}
                        onChange={(e) => setIgnoreAlphanumericInEnum(e.target.checked)}
                        className="rounded accent-accent cursor-pointer"
                      />
                      <span className="text-content text-[11px] font-medium">
                        Prevent alphanumeric codes (IDs, SKUs, mixed digits) from becoming Set/Enum
                      </span>
                    </label>

                    <div className="flex items-center gap-2">
                      <span className="text-[11px] text-content-muted font-medium">
                        Max Enum Cardinality:
                      </span>
                      <div className="flex items-center gap-1">
                        {[6, 12, 20].map((num) => (
                          <button
                            key={num}
                            type="button"
                            onClick={() => setMaxEnumUnique(num)}
                            className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold border transition ${
                              maxEnumUnique === num
                                ? 'bg-accent/20 border-accent/40 text-accent'
                                : 'bg-secondary border-border-subtle text-content-muted hover:text-content'
                            }`}
                          >
                            &le; {num}
                          </button>
                        ))}
                        <input
                          type="number"
                          min={2}
                          max={50}
                          value={maxEnumUnique}
                          onChange={(e) => setMaxEnumUnique(Math.max(2, Math.min(50, parseInt(e.target.value, 10) || 12)))}
                          className="w-12 px-1 py-0.5 rounded bg-secondary border border-border-subtle text-center font-mono text-[11px] text-content focus:outline-none"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Action Button: Run Extraction */}
              {currentSheet && (
                <div className="flex items-center justify-between pt-2">
                  <span className="text-xs text-content-muted">
                    Ready to evaluate {selectedColumnNames.length} columns across {parsedRowRange.count.toLocaleString()} focused rows.
                  </span>
                  <button
                    type="button"
                    onClick={handleRunExtraction}
                    className="flex items-center gap-2 px-5 py-2 rounded-xl bg-accent hover:bg-accent-hover text-white text-xs font-bold shadow-md shadow-accent/20 transition-all cursor-pointer"
                  >
                    <span>Extract Field Architecture</span>
                    <ArrowRight size={14} />
                  </button>
                </div>
              )}
            </div>
          )}

          {/* STEP 2: REVIEW & EDIT EXTRACTED ARCHITECTURE */}
          {step === 2 && (
            <div className="space-y-4">
              {/* File Continuation Details Banner */}
              {currentSheet && (
                <div className="p-3 rounded-xl bg-accent/10 border border-accent/30 flex items-center justify-between text-xs flex-wrap gap-2">
                  <div className="flex items-center gap-2">
                    <Database size={15} className="text-accent" />
                    <div>
                      <span className="font-bold text-content">{workbook?.filename}</span>
                      <span className="text-content-muted ml-1.5">
                        ({currentSheet.totalRows.toLocaleString()} existing rows • Format: {workbook?.fileFormat?.toUpperCase() || 'CSV'})
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 rounded-md bg-accent/20 text-accent font-mono font-bold text-[11px]">
                      Next Row: #{currentSheet.totalRows + 1}
                    </span>
                    <span className="text-[11px] text-content-muted hidden sm:inline">
                      Auto-increment sequences begin at next continuous index
                    </span>
                  </div>
                </div>
              )}

              {/* Summary Bar */}
              <div className="p-3.5 rounded-xl bg-primary border border-border-subtle flex flex-wrap items-center justify-between gap-3 text-xs">
                <div className="flex items-center gap-2.5 flex-wrap">
                  <span className="font-bold text-content">
                    Extracted Architecture:
                  </span>
                  <span className="px-2 py-0.5 rounded-full bg-accent/20 text-accent font-bold font-mono text-[11px]">
                    {extractedColumns.length} Fields
                  </span>
                  <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 font-semibold font-mono text-[11px] flex items-center gap-1">
                    <Code2 size={11} />
                    {extractedColumns.filter((c) => c.type === 'RegEx').length} RegEx
                  </span>
                  <span className="px-2 py-0.5 rounded-full bg-sky-500/20 text-sky-400 font-semibold font-mono text-[11px] flex items-center gap-1">
                    <ListOrdered size={11} />
                    {extractedColumns.filter((c) => c.type === 'Set/Enum').length} Set/Enum
                  </span>
                  <span className="px-2 py-0.5 rounded-full bg-secondary border border-border-subtle text-content-muted font-medium text-[11px]">
                    Mode: {extractionMode === 'mock' ? 'Mock (Sanitized)' : 'Realistic'}
                  </span>
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                  {extractedColumns.some((c) => c.type === 'Set/Enum' && (c.isAlphanumericCode || c.inferredRegexRule)) && (
                    <button
                      type="button"
                      onClick={handleBatchConvertEnumToRegex}
                      className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-accent/15 hover:bg-accent/25 border border-accent/30 text-accent font-semibold text-xs transition cursor-pointer"
                      title="Quickly convert all alphanumeric Enums into synthesized RegEx masks"
                    >
                      <ArrowLeftRight size={12} />
                      <span>Convert Codes to RegEx</span>
                    </button>
                  )}
                  {extractedColumns.some((c) => c.type === 'RegEx' && c.inferredEnumRule) && (
                    <button
                      type="button"
                      onClick={handleBatchConvertRegexToEnum}
                      className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-secondary hover:bg-tertiary border border-border-subtle text-content-muted hover:text-content text-xs transition cursor-pointer"
                      title="Convert RegEx columns back to discrete categorical Sets"
                    >
                      <ArrowLeftRight size={12} />
                      <span>Convert RegEx to Enums</span>
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => setStep(1)}
                    className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-secondary hover:bg-tertiary border border-border-subtle text-xs text-content font-medium transition cursor-pointer"
                  >
                    <RefreshCw size={12} />
                    <span>Re-filter / Re-sample</span>
                  </button>
                </div>
              </div>

              {/* Extracted Columns Table Editor */}
              <div className="border border-border-subtle rounded-xl overflow-hidden bg-primary/40">
                <div className="overflow-x-auto max-h-[44vh]">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="bg-secondary border-b border-border-subtle text-[11px] font-bold text-content-muted uppercase tracking-wider">
                        <th className="p-2.5 pl-3">Field Name</th>
                        <th className="p-2.5">Detected Type</th>
                        <th className="p-2.5">Rule / Distribution</th>
                        <th className="p-2.5 text-center">Null %</th>
                        <th className="p-2.5 text-center">Sensitive / PII</th>
                        <th className="p-2.5">Sample Values</th>
                        <th className="p-2.5 pr-3 text-center">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border-subtle/50">
                      {extractedColumns.map((col) => (
                        <tr key={col.id} className="hover:bg-secondary/60 transition group">
                          {/* Name input */}
                          <td className="p-2.5 pl-3">
                            <input
                              type="text"
                              value={col.name}
                              onChange={(e) =>
                                handleUpdateExtractedCol(col.id, { name: e.target.value })
                              }
                              className="px-2 py-1 rounded bg-secondary border border-border-subtle text-xs font-mono font-bold text-content focus:outline-none focus:border-accent w-32"
                            />
                            {col.originalName !== col.name && (
                              <div className="text-[10px] text-content-muted mt-0.5 truncate max-w-[128px]">
                                Orig: {col.originalName}
                              </div>
                            )}
                          </td>

                          {/* Type dropdown */}
                          <td className="p-2.5">
                            <select
                              value={col.type}
                              onChange={(e) =>
                                handleTypeChange(col.id, e.target.value as ColumnType)
                              }
                              className="px-2 py-1 rounded bg-secondary border border-border-subtle text-xs font-semibold text-accent focus:outline-none cursor-pointer"
                            >
                              {AVAILABLE_TYPES.map((t) => (
                                <option key={t} value={t}>
                                  {t}
                                </option>
                              ))}
                            </select>

                            {/* Quick Switcher Button between Set/Enum and RegEx */}
                            {col.type === 'Set/Enum' && (
                              <button
                                type="button"
                                onClick={() => handleToggleBetweenEnumAndRegex(col.id)}
                                className="mt-1 flex items-center gap-1 text-[10px] text-accent hover:underline font-mono"
                                title={`Switch to RegEx: ${col.inferredRegexRule || '[A-Z0-9]{6}'}`}
                              >
                                <ArrowLeftRight size={10} />
                                <span className="max-w-[130px] truncate">
                                  To RegEx: {col.inferredRegexRule || '[A-Z0-9]{6}'}
                                </span>
                              </button>
                            )}
                            {col.type === 'RegEx' && (
                              <button
                                type="button"
                                onClick={() => handleToggleBetweenEnumAndRegex(col.id)}
                                className="mt-1 flex items-center gap-1 text-[10px] text-sky-400 hover:underline"
                                title="Switch to discrete Set/Enum"
                              >
                                <ArrowLeftRight size={10} />
                                <span className="max-w-[130px] truncate">
                                  To Set/Enum {col.uniqueCount ? `(${col.uniqueCount} vals)` : ''}
                                </span>
                              </button>
                            )}
                          </td>

                          {/* Rule input */}
                          <td className="p-2.5">
                            <input
                              type="text"
                              value={col.rule}
                              onChange={(e) =>
                                handleUpdateExtractedCol(col.id, { rule: e.target.value })
                              }
                              placeholder="rule definition"
                              className="px-2 py-1 rounded bg-secondary border border-border-subtle text-xs font-mono text-content focus:outline-none focus:border-accent w-44"
                            />
                            {col.detectedFormat && (
                              <div className="text-[10px] text-content-muted mt-0.5 truncate max-w-[176px]">
                                {col.detectedFormat}
                              </div>
                            )}
                          </td>

                          {/* Null Skip % */}
                          <td className="p-2.5 text-center">
                            <div className="flex items-center justify-center gap-1">
                              <input
                                type="number"
                                min={0}
                                max={100}
                                value={col.skip_pct}
                                onChange={(e) =>
                                  handleUpdateExtractedCol(col.id, {
                                    skip_pct: Math.min(100, Math.max(0, parseInt(e.target.value, 10) || 0)),
                                  })
                                }
                                className="w-12 px-1 py-0.5 rounded bg-secondary border border-border-subtle text-center font-mono text-xs text-content focus:outline-none"
                              />
                              <span className="text-[11px] text-content-muted">%</span>
                            </div>
                          </td>

                          {/* Sensitive / PII Toggle */}
                          <td className="p-2.5 text-center">
                            <button
                              type="button"
                              onClick={() => handleToggleSensitive(col.id)}
                              className={`px-2 py-0.5 rounded text-[10px] font-bold border transition inline-flex items-center gap-1 ${
                                col.isSensitive
                                  ? 'bg-rose-500/20 border-rose-500/40 text-rose-400'
                                  : 'bg-secondary border-border-subtle text-content-muted hover:text-content'
                              }`}
                              title="Toggle sensitive/PII data flag"
                            >
                              {col.isSensitive ? (
                                <>
                                  <Lock size={10} />
                                  <span>Masked</span>
                                </>
                              ) : (
                                <>
                                  <Unlock size={10} />
                                  <span>Public</span>
                                </>
                              )}
                            </button>
                          </td>

                          {/* Samples */}
                          <td className="p-2.5">
                            <div className="flex items-center gap-1 flex-wrap max-w-[180px]">
                              {col.sampleValues.slice(0, 2).map((s, sIdx) => (
                                <span
                                  key={sIdx}
                                  className="px-1.5 py-0.5 rounded bg-secondary border border-border-subtle text-[10px] font-mono text-content-muted truncate max-w-[80px]"
                                  title={String(s)}
                                >
                                  {s === null ? 'null' : String(s)}
                                </span>
                              ))}
                            </div>
                          </td>

                          {/* Remove button */}
                          <td className="p-2.5 pr-3 text-center">
                            <button
                              type="button"
                              onClick={() => handleRemoveExtractedCol(col.id)}
                              className="p-1 rounded text-content-muted hover:text-rose-400 hover:bg-secondary transition"
                              title="Delete this column from schema"
                            >
                              <X size={14} />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Table Name & Apply Mode */}
              <div className="p-4 rounded-xl bg-primary border border-border-subtle flex flex-wrap items-center justify-between gap-4 text-xs">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-content">Target Table Name:</span>
                  <input
                    type="text"
                    value={targetTableName}
                    onChange={(e) =>
                      setTargetTableName(
                        e.target.value.replace(/[^a-zA-Z0-9_]/g, '_').toLowerCase()
                      )
                    }
                    className="px-2.5 py-1 rounded-lg bg-secondary border border-border-subtle font-mono text-xs font-bold text-content focus:outline-none focus:border-accent w-44"
                  />
                </div>

                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-2">
                    <label className="flex items-center gap-1.5 cursor-pointer">
                      <input
                        type="radio"
                        name="applyMode"
                        checked={applyMode === 'replace'}
                        onChange={() => setApplyMode('replace')}
                        className="accent-accent cursor-pointer"
                      />
                      <span className="text-content font-medium">
                        Replace existing schema ({currentColumnsCount} cols)
                      </span>
                    </label>

                    <label className="flex items-center gap-1.5 cursor-pointer ml-2">
                      <input
                        type="radio"
                        name="applyMode"
                        checked={applyMode === 'append'}
                        onChange={() => setApplyMode('append')}
                        className="accent-accent cursor-pointer"
                      />
                      <span className="text-content font-medium">
                        Append to existing
                      </span>
                    </label>
                  </div>
                </div>
              </div>

              {/* Footer Actions */}
              <div className="flex items-center justify-between pt-2">
                <button
                  type="button"
                  onClick={() => setStep(1)}
                  className="px-4 py-2 rounded-xl bg-secondary hover:bg-tertiary border border-border-subtle text-xs font-semibold text-content transition"
                >
                  Back to Selection
                </button>

                <button
                  type="button"
                  onClick={handleApplyToWorkspace}
                  className="flex items-center gap-2 px-6 py-2 rounded-xl bg-accent hover:bg-accent-hover text-white text-xs font-bold shadow-md shadow-accent/20 transition-all cursor-pointer"
                >
                  <Check size={15} />
                  <span>Apply Schema Architecture to Workspace</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </motion.div>
    </div>
  )}
</AnimatePresence>
);
};
