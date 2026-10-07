import React, { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Folder,
  FolderPlus,
  FolderOpen,
  Monitor,
  Globe,
  ExternalLink,
  Check,
  X,
  AlertTriangle,
  HardDrive,
  Sparkles,
  History,
  FileCode2,
  CheckCircle2,
  Upload,
} from 'lucide-react';
import {
  isTauri,
  isEmbeddedIframe,
  createVirtualDirectoryHandle,
  requestDirectoryHandle,
} from '../utils/fileSystem';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSelectFolder: (handle: any, folderName: string) => void;
  currentFolderName?: string | null;
  recentFolders?: string[];
  initialErrorNotice?: string | null;
}

export const FolderSelectModal: React.FC<Props> = ({
  isOpen,
  onClose,
  onSelectFolder,
  currentFolderName,
  recentFolders = [],
  initialErrorNotice,
}) => {
  const isDesktop = isTauri();
  const inIframe = isEmbeddedIframe();

  const [activeTab, setActiveTab] = useState<'browse' | 'virtual' | 'manual'>(
    isDesktop ? 'browse' : 'virtual'
  );
  const [folderNameInput, setFolderNameInput] = useState<string>(
    currentFolderName || 'synthetic_dataset_export'
  );
  const [manualPathInput, setManualPathInput] = useState<string>('');
  const [isLoadingNative, setIsLoadingNative] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(initialErrorNotice || null);
  const [selectedHtmlFilesCount, setSelectedHtmlFilesCount] = useState<number | null>(null);

  const htmlDirInputRef = useRef<HTMLInputElement>(null);

  // Trigger Native OS Folder Dialog (Tauri Desktop)
  const handleNativeBrowse = async () => {
    setIsLoadingNative(true);
    setErrorMessage(null);
    try {
      const handle = await requestDirectoryHandle();
      if (handle) {
        onSelectFolder(handle, handle.name);
        onClose();
      }
    } catch (err: any) {
      console.warn('Native picker error:', err);
      setErrorMessage(err.message || 'Could not access directory');
    } finally {
      setIsLoadingNative(false);
    }
  };

  // Handle Manual Path Submission (useful for desktop or custom paths)
  const handleManualPathSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = manualPathInput.trim();
    if (!trimmed) {
      setErrorMessage('Please enter a directory path');
      return;
    }

    const folderName = trimmed.split(/[\\/]/).pop() || trimmed;
    if (isDesktop) {
      // In Tauri, a path string functions as a direct filesystem path
      const handle = { kind: 'tauri-dir', path: trimmed, name: folderName };
      onSelectFolder(handle, folderName);
    } else {
      const handle = createVirtualDirectoryHandle(folderName, trimmed);
      onSelectFolder(handle, folderName);
    }
    onClose();
  };

  // Handle Virtual Folder Lock
  const handleVirtualFolderSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = folderNameInput.trim().replace(/^[/\\]+/, '') || 'output_folder';
    const handle = createVirtualDirectoryHandle(trimmed);
    onSelectFolder(handle, trimmed);
    onClose();
  };

  // Handle HTML Directory selection via <input webkitdirectory />
  const handleHtmlDirSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const firstPath = (files[0] as any).webkitRelativePath || '';
    const rootName = firstPath.split('/')[0] || 'Selected_Folder';
    setSelectedHtmlFilesCount(files.length);
    setFolderNameInput(rootName);

    const handle = {
      kind: 'virtual-dir',
      name: rootName,
      path: rootName,
      htmlFileList: files,
    };
    onSelectFolder(handle, rootName);
    onClose();
  };

  // Open App in New Tab to escape iframe restrictions
  const handleOpenInNewTab = () => {
    if (typeof window !== 'undefined') {
      window.open(window.location.href, '_blank', 'noopener,noreferrer');
    }
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div
        className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm"
        onClick={(e) => {
          if (e.target === e.currentTarget) onClose();
        }}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 10 }}
          transition={{ duration: 0.15 }}
          className="bg-secondary border border-border-subtle rounded-2xl w-full max-w-xl shadow-2xl overflow-hidden flex flex-col text-content"
        >
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-border-subtle bg-primary/40">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-accent/15 border border-accent/30 text-accent">
                <FolderPlus size={20} />
              </div>
              <div>
                <h3 className="text-sm font-bold text-content flex items-center gap-2">
                  <span>Select Output Directory</span>
                  {isDesktop ? (
                    <span className="text-[10px] px-2 py-0.5 rounded-full font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 flex items-center gap-1">
                      <Monitor size={10} /> Native Desktop App
                    </span>
                  ) : inIframe ? (
                    <span className="text-[10px] px-2 py-0.5 rounded-full font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30 flex items-center gap-1">
                      <Globe size={10} /> Browser Iframe
                    </span>
                  ) : (
                    <span className="text-[10px] px-2 py-0.5 rounded-full font-bold bg-blue-500/20 text-blue-300 border border-blue-500/30 flex items-center gap-1">
                      <Globe size={10} /> Web Browser
                    </span>
                  )}
                </h3>
                <p className="text-xs text-content-muted">
                  Choose where generated datasets and batch streams are saved
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-lg text-content-muted hover:text-content hover:bg-tertiary transition cursor-pointer"
              title="Close"
            >
              <X size={16} />
            </button>
          </div>

          {/* Iframe Notice Banner if applicable */}
          {inIframe && (
            <div className="px-6 py-3 border-b border-border-subtle bg-amber-500/10 text-amber-200 text-xs flex items-start justify-between gap-3">
              <div className="flex items-start gap-2.5">
                <AlertTriangle size={16} className="text-amber-400 flex-shrink-0 mt-0.5" />
                <div className="space-y-0.5">
                  <span className="font-semibold text-content">Embedded Browser Environment</span>
                  <p className="text-[11px] text-content-muted leading-relaxed">
                    Browser security blocks low-level disk access inside embedded iframes. You can use a <strong>Virtual Output Folder</strong> (downloads bundled ZIPs) or open the app in a standalone tab for native File System API access.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={handleOpenInNewTab}
                className="px-2.5 py-1 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/40 text-amber-200 text-xs font-semibold flex items-center gap-1 whitespace-nowrap transition cursor-pointer"
              >
                <ExternalLink size={12} />
                <span>Open in Tab</span>
              </button>
            </div>
          )}

          {/* Error Message Notice if any */}
          {errorMessage && (
            <div className="px-6 py-2.5 bg-rose-500/10 border-b border-rose-500/25 text-rose-300 text-xs flex items-center gap-2">
              <AlertTriangle size={14} className="text-rose-400 flex-shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Navigation Tabs */}
          <div className="flex items-center gap-2 px-6 pt-3 border-b border-border-subtle bg-primary/20 text-xs font-semibold">
            {isDesktop ? (
              <>
                <button
                  type="button"
                  onClick={() => setActiveTab('browse')}
                  className={`pb-2.5 border-b-2 flex items-center gap-1.5 cursor-pointer transition ${
                    activeTab === 'browse'
                      ? 'border-accent text-accent'
                      : 'border-transparent text-content-muted hover:text-content'
                  }`}
                >
                  <FolderOpen size={14} />
                  <span>Native OS Dialog</span>
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('manual')}
                  className={`pb-2.5 border-b-2 flex items-center gap-1.5 cursor-pointer transition ${
                    activeTab === 'manual'
                      ? 'border-accent text-accent'
                      : 'border-transparent text-content-muted hover:text-content'
                  }`}
                >
                  <HardDrive size={14} />
                  <span>Enter Path Manually</span>
                </button>
              </>
            ) : (
              <>
                <button
                  type="button"
                  onClick={() => setActiveTab('virtual')}
                  className={`pb-2.5 border-b-2 flex items-center gap-1.5 cursor-pointer transition ${
                    activeTab === 'virtual'
                      ? 'border-accent text-accent'
                      : 'border-transparent text-content-muted hover:text-content'
                  }`}
                >
                  <Folder size={14} />
                  <span>Target Folder Name</span>
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('browse')}
                  className={`pb-2.5 border-b-2 flex items-center gap-1.5 cursor-pointer transition ${
                    activeTab === 'browse'
                      ? 'border-accent text-accent'
                      : 'border-transparent text-content-muted hover:text-content'
                  }`}
                >
                  <FolderOpen size={14} />
                  <span>Browse via HTML5</span>
                </button>
              </>
            )}
          </div>

          {/* Modal Body */}
          <div className="p-6 space-y-5">
            {/* TAB: Native OS Browse (Desktop mode) */}
            {activeTab === 'browse' && isDesktop && (
              <div className="space-y-4">
                <div className="p-4 rounded-xl bg-primary/50 border border-border-subtle space-y-2 text-xs">
                  <div className="font-semibold text-content flex items-center gap-2">
                    <CheckCircle2 size={15} className="text-emerald-400" />
                    <span>Direct Local Drive Access Active</span>
                  </div>
                  <p className="text-content-muted text-[11px] leading-relaxed">
                    Click the button below to launch the standard Windows Explorer / macOS Finder directory picker dialog. All generated files will be written straight to disk without browser prompts.
                  </p>
                </div>

                <button
                  type="button"
                  disabled={isLoadingNative}
                  onClick={handleNativeBrowse}
                  className="w-full py-3 rounded-xl bg-accent hover:bg-accent-hover text-white font-bold text-xs flex items-center justify-center gap-2 shadow-md shadow-accent/20 transition cursor-pointer disabled:opacity-50"
                >
                  <FolderOpen size={16} />
                  <span>{isLoadingNative ? 'Opening Native Dialog...' : 'Launch Native Folder Selector'}</span>
                </button>
              </div>
            )}

            {/* TAB: Virtual Folder (Browser / Iframe mode) */}
            {activeTab === 'virtual' && (
              <form onSubmit={handleVirtualFolderSubmit} className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-content block">
                    Target Folder Name / Destination Label:
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-2.5 text-xs text-content-muted font-mono">📁 /</span>
                    <input
                      type="text"
                      value={folderNameInput}
                      onChange={(e) => setFolderNameInput(e.target.value)}
                      placeholder="e.g. ecommerce_exports_2026"
                      className="w-full pl-8 pr-3 py-2 rounded-xl bg-primary border border-border-subtle text-xs font-mono text-content focus:outline-none focus:border-accent"
                      autoFocus
                    />
                  </div>
                  <p className="text-[11px] text-content-muted">
                    Files generated with folder destination will be grouped into this target label. Multi-file outputs and batches will be cleanly organized and packaged as a <code>{folderNameInput || 'dataset'}_bundle.zip</code> download.
                  </p>
                </div>

                <div className="flex items-center justify-end gap-3 pt-2">
                  <button
                    type="button"
                    onClick={onClose}
                    className="px-4 py-2 rounded-xl bg-secondary hover:bg-tertiary border border-border-subtle text-xs font-semibold text-content transition cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2 rounded-xl bg-accent hover:bg-accent-hover text-white text-xs font-bold shadow-md shadow-accent/20 flex items-center gap-1.5 transition cursor-pointer"
                  >
                    <Check size={14} />
                    <span>Set Target Folder</span>
                  </button>
                </div>
              </form>
            )}

            {/* TAB: HTML5 Directory Input (Browser mode) */}
            {activeTab === 'browse' && !isDesktop && (
              <div className="space-y-4 text-xs">
                <div className="p-4 rounded-xl bg-primary/50 border border-border-subtle space-y-2">
                  <span className="font-semibold text-content">Browse with Browser Directory Selector</span>
                  <p className="text-[11px] text-content-muted leading-relaxed">
                    Uses the HTML5 <code>webkitdirectory</code> standard supported by Chrome, Edge, Safari, and Firefox even inside iframes.
                  </p>
                </div>

                <input
                  ref={htmlDirInputRef}
                  type="file"
                  /* @ts-ignore */
                  webkitdirectory=""
                  directory=""
                  multiple
                  className="hidden"
                  onChange={handleHtmlDirSelect}
                />

                <button
                  type="button"
                  onClick={() => htmlDirInputRef.current?.click()}
                  className="w-full py-3 rounded-xl bg-accent hover:bg-accent-hover text-white font-bold text-xs flex items-center justify-center gap-2 shadow-md shadow-accent/20 transition cursor-pointer"
                >
                  <Upload size={16} />
                  <span>Choose Local Directory (HTML5)</span>
                </button>
              </div>
            )}

            {/* TAB: Manual Path Entry (Desktop mode) */}
            {activeTab === 'manual' && isDesktop && (
              <form onSubmit={handleManualPathSubmit} className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-content block">
                    Absolute Folder Path on Disk:
                  </label>
                  <input
                    type="text"
                    value={manualPathInput}
                    onChange={(e) => setManualPathInput(e.target.value)}
                    placeholder={navigator.platform.includes('Win') ? 'C:\\Data\\Exports' : '/home/user/exports'}
                    className="w-full px-3 py-2 rounded-xl bg-primary border border-border-subtle text-xs font-mono text-content focus:outline-none focus:border-accent"
                    autoFocus
                  />
                  <p className="text-[11px] text-content-muted">
                    Paste an exact path from File Explorer or terminal. Writes will go directly to this destination directory.
                  </p>
                </div>

                <div className="flex items-center justify-end gap-3 pt-2">
                  <button
                    type="button"
                    onClick={onClose}
                    className="px-4 py-2 rounded-xl bg-secondary hover:bg-tertiary border border-border-subtle text-xs font-semibold text-content transition cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2 rounded-xl bg-accent hover:bg-accent-hover text-white text-xs font-bold shadow-md shadow-accent/20 flex items-center gap-1.5 transition cursor-pointer"
                  >
                    <Check size={14} />
                    <span>Apply Path</span>
                  </button>
                </div>
              </form>
            )}

            {/* Recent Folders History */}
            {recentFolders.length > 0 && (
              <div className="pt-3 border-t border-border-subtle space-y-2">
                <span className="text-[11px] font-semibold text-content-muted flex items-center gap-1.5">
                  <History size={12} />
                  <span>Recently Used Folders:</span>
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {recentFolders.map((rf) => (
                    <button
                      key={rf}
                      type="button"
                      onClick={() => {
                        if (isDesktop && (rf.includes('/') || rf.includes('\\'))) {
                          const name = rf.split(/[\\/]/).pop() || rf;
                          onSelectFolder({ kind: 'tauri-dir', path: rf, name }, name);
                        } else {
                          const handle = createVirtualDirectoryHandle(rf);
                          onSelectFolder(handle, rf);
                        }
                        onClose();
                      }}
                      className="px-2.5 py-1 rounded-lg bg-primary hover:bg-tertiary border border-border-subtle text-xs font-mono text-content hover:text-accent transition cursor-pointer flex items-center gap-1.5"
                    >
                      <span>📁 /{rf}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
