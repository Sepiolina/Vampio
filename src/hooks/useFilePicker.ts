import React, { useState, useCallback } from 'react';
import {
  pickDirectory,
  pickFiles,
  scanDataTransfer,
  createVirtualDirectoryHandle,
  DirectorySelectionResult,
  DirectorySelectionOptions,
  FileSelectionOptions,
  ScannedDataTransferResult,
} from '../utils/fileSystem';

export interface UseFilePickerOptions {
  onFolderSelect?: (result: DirectorySelectionResult) => void | Promise<void>;
  onFilesSelect?: (files: File[]) => void | Promise<void>;
  autoIframeFallback?: boolean;
  accept?: string;
  multiple?: boolean;
}

export function useFilePicker(options: UseFilePickerOptions = {}) {
  const [isDraggingOver, setIsDraggingOver] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedDirectory, setSelectedDirectory] = useState<DirectorySelectionResult | null>(null);

  const selectFolder = useCallback(
    async (overrideOpts?: DirectorySelectionOptions): Promise<DirectorySelectionResult | null> => {
      setIsLoading(true);
      setError(null);
      try {
        const res = await pickDirectory({
          allowFallback: overrideOpts?.allowFallback ?? options.autoIframeFallback ?? true,
          title: overrideOpts?.title,
          startIn: overrideOpts?.startIn,
        });
        if (res) {
          setSelectedDirectory(res);
          await options.onFolderSelect?.(res);
        }
        return res;
      } catch (err: any) {
        const msg = err?.message || 'Failed to select folder';
        setError(msg);
        throw err;
      } finally {
        setIsLoading(false);
      }
    },
    [options]
  );

  const selectFiles = useCallback(
    async (overrideOpts?: FileSelectionOptions): Promise<File[]> => {
      setIsLoading(true);
      setError(null);
      try {
        const files = await pickFiles({
          accept: overrideOpts?.accept ?? options.accept,
          multiple: overrideOpts?.multiple ?? options.multiple ?? true,
          title: overrideOpts?.title,
        });
        if (files.length > 0) {
          await options.onFilesSelect?.(files);
        }
        return files;
      } catch (err: any) {
        const msg = err?.message || 'Failed to select files';
        setError(msg);
        throw err;
      } finally {
        setIsLoading(false);
      }
    },
    [options]
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!e.currentTarget.contains(e.relatedTarget as Node)) {
      setIsDraggingOver(false);
    }
  }, []);

  const handleDrop = useCallback(
    async (e: React.DragEvent): Promise<ScannedDataTransferResult> => {
      e.preventDefault();
      e.stopPropagation();
      setIsDraggingOver(false);
      setIsLoading(true);
      setError(null);

      try {
        const scanResult = await scanDataTransfer(e.dataTransfer);

        if (scanResult.isDirectory || scanResult.directoryHandle) {
          const dirResult: DirectorySelectionResult = {
            handle:
              scanResult.directoryHandle ||
              createVirtualDirectoryHandle(
                scanResult.folderName || 'dropped_folder',
                undefined,
                scanResult.files
              ),
            name: scanResult.folderName || 'dropped_folder',
            files: scanResult.files,
            isVirtual: !scanResult.directoryHandle,
            path: scanResult.folderName || 'dropped_folder',
          };
          setSelectedDirectory(dirResult);
          await options.onFolderSelect?.(dirResult);
        } else if (scanResult.files.length > 0) {
          await options.onFilesSelect?.(scanResult.files);
        }
        return scanResult;
      } catch (err: any) {
        const msg = err?.message || 'Failed to process dropped files';
        setError(msg);
        throw err;
      } finally {
        setIsLoading(false);
      }
    },
    [options]
  );

  const reset = useCallback(() => {
    setSelectedDirectory(null);
    setError(null);
    setIsDraggingOver(false);
  }, []);

  return {
    isDraggingOver,
    isLoading,
    error,
    selectedDirectory,
    selectFolder,
    selectFiles,
    dragProps: {
      onDragOver: handleDragOver,
      onDragLeave: handleDragLeave,
      onDrop: handleDrop,
    },
    reset,
  };
}
