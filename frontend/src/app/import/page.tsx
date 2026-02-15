'use client';

import { useState, useCallback, useRef } from 'react';
import { useMutation } from '@tanstack/react-query';
import { importApi } from '@/lib/api';
import { 
  Upload, 
  FileSpreadsheet, 
  CheckCircle, 
  AlertCircle,
  Loader,
  Terminal,
  X,
  File
} from 'lucide-react';

export default function ImportPage() {
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [importResult, setImportResult] = useState<{
    success: boolean;
    filesProcessed: number;
    imported: number;
    skipped: number;
    errors: string[];
    logs: string[];
  } | null>(null);

  const uploadMutation = useMutation({
    mutationFn: (files: File[]) => importApi.uploadClients(files),
    onSuccess: (response) => {
      setImportResult(response.data);
      setSelectedFiles([]);
    },
    onError: (error: Error) => {
      alert(`Import failed: ${error.message}`);
    },
  });

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    
    const files = Array.from(e.dataTransfer.files).filter(file => 
      file.name.endsWith('.xlsx') || file.name.endsWith('.xls')
    );
    
    if (files.length > 0) {
      setSelectedFiles(prev => [...prev, ...files]);
    }
  }, []);

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files) {
      const validFiles = Array.from(files).filter(file => 
        file.name.endsWith('.xlsx') || file.name.endsWith('.xls')
      );
      setSelectedFiles(prev => [...prev, ...validFiles]);
    }
    // Reset input so same file can be selected again
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }, []);

  const removeFile = useCallback((index: number) => {
    setSelectedFiles(prev => prev.filter((_, i) => i !== index));
  }, []);

  const handleUpload = useCallback(() => {
    if (selectedFiles.length > 0) {
      uploadMutation.mutate(selectedFiles);
    }
  }, [selectedFiles, uploadMutation]);

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 hidden md:block">Import Data</h1>
        <p className="text-gray-600 mt-1">Import clients from Excel files</p>
      </div>

      {/* File Upload Card */}
      <div className="bg-white rounded-xl shadow-sm p-6">
        <div className="text-center">
          <FileSpreadsheet className="h-16 w-16 text-primary-600 mx-auto mb-4" />
          <h2 className="text-lg font-semibold text-gray-900 mb-2">
            Import Clients from Excel
          </h2>
          <p className="text-gray-600 mb-6 max-w-md mx-auto">
            Drag and drop Excel files or select them from your device.
            Duplicate clients will be automatically skipped.
          </p>
          
          {/* Drop Zone */}
          <div
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`
              border-2 border-dashed rounded-lg p-8 cursor-pointer transition-colors
              ${isDragging 
                ? 'border-primary-500 bg-primary-50' 
                : 'border-gray-300 hover:border-primary-400 hover:bg-gray-50'}
            `}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx,.xls"
              multiple
              onChange={handleFileSelect}
              className="hidden"
            />
            <Upload className={`h-10 w-10 mx-auto mb-3 ${isDragging ? 'text-primary-500' : 'text-gray-400'}`} />
            <p className="text-gray-600 mb-1">
              <span className="font-semibold text-primary-600">Click to upload</span> or drag and drop
            </p>
            <p className="text-sm text-gray-500">Excel files (.xlsx, .xls) up to 50MB each</p>
          </div>

          {/* Selected Files List */}
          {selectedFiles.length > 0 && (
            <div className="mt-6">
              <h3 className="text-sm font-medium text-gray-900 mb-3 text-left">
                Selected Files ({selectedFiles.length})
              </h3>
              <div className="space-y-2">
                {selectedFiles.map((file, index) => (
                  <div 
                    key={`${file.name}-${index}`} 
                    className="flex items-center justify-between bg-gray-50 rounded-lg px-4 py-3"
                  >
                    <div className="flex items-center min-w-0">
                      <File className="h-5 w-5 text-primary-600 mr-3 flex-shrink-0" />
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-gray-900 truncate">{file.name}</p>
                        <p className="text-xs text-gray-500">{formatFileSize(file.size)}</p>
                      </div>
                    </div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        removeFile(index);
                      }}
                      className="ml-4 p-1 text-gray-400 hover:text-red-500 transition-colors"
                      aria-label="Remove file"
                    >
                      <X className="h-5 w-5" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Upload Button */}
          <button
            onClick={handleUpload}
            disabled={selectedFiles.length === 0 || uploadMutation.isPending}
            className="mt-6 inline-flex items-center px-6 py-3 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {uploadMutation.isPending ? (
              <>
                <Loader className="h-5 w-5 mr-2 animate-spin" />
                Importing...
              </>
            ) : (
              <>
                <Upload className="h-5 w-5 mr-2" />
                Import {selectedFiles.length > 0 ? `${selectedFiles.length} File${selectedFiles.length > 1 ? 's' : ''}` : 'Files'}
              </>
            )}
          </button>
        </div>
      </div>

      {/* Import Result */}
      {importResult && (
        <div className={`rounded-xl shadow-sm p-6 ${
          importResult.success ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'
        }`}>
          <div className="flex items-start">
            {importResult.success ? (
              <CheckCircle className="h-6 w-6 text-green-600 mr-3 flex-shrink-0" />
            ) : (
              <AlertCircle className="h-6 w-6 text-red-600 mr-3 flex-shrink-0" />
            )}
            <div className="flex-1">
              <h3 className={`font-semibold ${importResult.success ? 'text-green-900' : 'text-red-900'}`}>
                {importResult.success ? 'Import Completed' : 'Import Completed with Errors'}
              </h3>
              
              <div className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="bg-white rounded-lg p-4 text-center">
                  <p className="text-2xl font-bold text-gray-900">{importResult.filesProcessed}</p>
                  <p className="text-sm text-gray-600">Files Processed</p>
                </div>
                <div className="bg-white rounded-lg p-4 text-center">
                  <p className="text-2xl font-bold text-green-600">{importResult.imported}</p>
                  <p className="text-sm text-gray-600">Clients Imported</p>
                </div>
                <div className="bg-white rounded-lg p-4 text-center">
                  <p className="text-2xl font-bold text-yellow-600">{importResult.skipped}</p>
                  <p className="text-sm text-gray-600">Duplicates Skipped</p>
                </div>
              </div>

              {importResult.errors.length > 0 && (
                <div className="mt-4">
                  <h4 className="font-medium text-red-900 mb-2">Errors ({importResult.errors.length})</h4>
                  <div className="bg-white rounded-lg p-4 max-h-48 overflow-y-auto">
                    <ul className="space-y-1 text-sm text-red-700">
                      {importResult.errors.map((error, index) => (
                        <li key={index}>{error}</li>
                      ))}
                    </ul>
                  </div>
                </div>
              )}

              {importResult.logs && importResult.logs.length > 0 && (
                <div className="mt-4">
                  <h4 className="font-medium text-gray-900 mb-2 flex items-center">
                    <Terminal className="h-4 w-4 mr-2" />
                    Import Logs ({importResult.logs.length})
                  </h4>
                  <div className="bg-gray-900 rounded-lg p-4 max-h-64 overflow-y-auto font-mono text-xs">
                    {importResult.logs.map((log, index) => (
                      <div key={index} className="text-green-400 whitespace-pre-wrap">
                        {log}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Instructions */}
      <div className="bg-white rounded-xl shadow-sm p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Supported File Formats</h2>
        <div className="space-y-4 text-gray-600">
          <p>
            The import process supports Excel files (.xlsx, .xls) with the following columns:
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <h3 className="font-medium text-gray-900 mb-2">Required Fields</h3>
              <ul className="list-disc list-inside space-y-1 text-sm">
                <li>Numele Companiei (Company Name)</li>
              </ul>
            </div>
            <div>
              <h3 className="font-medium text-gray-900 mb-2">Contact Fields</h3>
              <ul className="list-disc list-inside space-y-1 text-sm">
                <li>Telefon Principal (Primary Phone)</li>
                <li>Telefon Secundar (Secondary Phone)</li>
                <li>Email Principal (Primary Email)</li>
              </ul>
            </div>
            <div>
              <h3 className="font-medium text-gray-900 mb-2">Location Fields</h3>
              <ul className="list-disc list-inside space-y-1 text-sm">
                <li>Judet (County)</li>
                <li>Localitate (Locality)</li>
                <li>Adresa (Address)</li>
              </ul>
            </div>
            <div>
              <h3 className="font-medium text-gray-900 mb-2">Business Fields</h3>
              <ul className="list-disc list-inside space-y-1 text-sm">
                <li>CUI (Tax ID)</li>
                <li>Cod CAEN (CAEN Code)</li>
                <li>Administrator</li>
                <li>Angajati (Employees)</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
